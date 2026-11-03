-- Idee 39: Team-Chat je Firma, Standort und Einsatzort (ohne Übersetzung). Firmen-Infos bleiben in der Firma statt in
-- privaten WhatsApp-Gruppen. Who is in a room (same rule for reading, writing and phone notifications):
--   Ganze Firma:  every active member except readers (tax office).
--   Standort:     office members who may see that location (like darf_bereich), staff whose personnel record is there
--                 (or below it).
--   Einsatzort:   office members who may see the site's customer, staff with a shift there from 14 days ago on.
-- Messages are deleted after 180 days (alarm/mail.py, hourly push run).

create or replace function jarvis_intern.chat_buero(u uuid, f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- darf_bereich for any user u (needed for the phone notifications of other members).
  with recursive kette as (
    select id, parent_id from public.bereiche where id = b and firma_id = f
    union all select p.id, p.parent_id from public.bereiche p join kette k on p.id = k.parent_id
  )
  select exists (select 1 from public.mitglieder m
    where m.firma_id = f and m.user_id = u and m.aktiv and m.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')
      and (m.rolle in ('inhaber', 'admin')
        or (m.rolle <> 'standortleitung' and (b is null or m.alle_bereiche))
        or (b is not null and exists (select 1 from public.mitglied_bereiche mb
              where mb.firma_id = f and mb.user_id = u and mb.bereich_id in (select id from kette)))))
$$;

create or replace function jarvis_intern.im_chat(u uuid, f uuid, b uuid, o uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when u is null or not exists (select 1 from public.mitglieder m where m.firma_id = f and m.user_id = u and m.aktiv and m.rolle <> 'leser') then false
    when b is not null and o is not null then false
    when o is not null then
      exists (select 1 from public.einsatzorte e left join public.kunden k on k.id = e.kunde_id
               where e.id = o and e.firma_id = f and jarvis_intern.chat_buero(u, f, k.bereich_id))
      or exists (select 1 from public.schichten s join public.personal p on p.id = s.personal_id and p.firma_id = s.firma_id
                  where s.firma_id = f and s.einsatzort_id = o and p.user_id = u
                    and s.datum >= (now() at time zone 'Europe/Berlin')::date - 14)
    when b is not null then
      exists (select 1 from public.bereiche x where x.id = b and x.firma_id = f)
      and (jarvis_intern.chat_buero(u, f, b)
        or exists (select 1 from public.personal p where p.firma_id = f and p.user_id = u and jarvis_intern.im_bereich(f, p.bereich_id, b)))
    else true
  end
$$;
revoke all on function jarvis_intern.chat_buero(uuid, uuid, uuid) from public, anon;
revoke all on function jarvis_intern.im_chat(uuid, uuid, uuid, uuid) from public, anon;
-- Policies run as the caller; jarvis_intern is not exposed through the API.
grant execute on function jarvis_intern.im_chat(uuid, uuid, uuid, uuid) to authenticated;

create table if not exists public.chat_nachrichten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid references public.bereiche on delete cascade,
  einsatzort_id uuid references public.einsatzorte on delete cascade,
  user_id uuid default auth.uid() references auth.users on delete set null,
  text text not null check (length(trim(text)) between 1 and 1000),
  erstellt timestamptz not null default now(),
  check (bereich_id is null or einsatzort_id is null)
);
create index if not exists chat_nachrichten_raum on public.chat_nachrichten (firma_id, bereich_id, einsatzort_id, erstellt desc);
alter table public.chat_nachrichten enable row level security;
create policy lesen on public.chat_nachrichten for select to authenticated using
  (jarvis_intern.im_chat(auth.uid(), firma_id, bereich_id, einsatzort_id));
create policy schreiben on public.chat_nachrichten for insert to authenticated with check
  (user_id = auth.uid() and jarvis_intern.im_chat(auth.uid(), firma_id, bereich_id, einsatzort_id));
-- Own messages can be withdrawn; owners and admins can remove any message of their firm.
create policy loeschen on public.chat_nachrichten for delete to authenticated using
  (user_id = auth.uid() and public.meine_rolle(firma_id) is not null or public.ist_admin(firma_id));
revoke all on public.chat_nachrichten from anon;
grant select, insert, delete on public.chat_nachrichten to authenticated;

-- Last time someone opened a room (unread counter). raum: 'firma', 'b:<location>' or 'o:<site>'.
create table if not exists public.chat_gelesen (
  firma_id uuid not null references public.firmen on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  raum text not null check (raum = 'firma' or raum ~ '^[bo]:[0-9a-f-]{36}$'),
  zuletzt timestamptz not null default now(),
  primary key (firma_id, user_id, raum)
);
alter table public.chat_gelesen enable row level security;
create policy eigene on public.chat_gelesen for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.meine_rolle(firma_id) is not null);
revoke all on public.chat_gelesen from anon;
grant select, insert, update on public.chat_gelesen to authenticated;

-- Rooms of the current user with last message and unread count. Sites only while active (shift from 14 days ago
-- to 30 days ahead or a message in 90 days), so the office list stays short; others open from the customer page.
create or replace function public.meine_chats(f uuid) returns table (bereich_id uuid, einsatzort_id uuid, name text, letzte timestamptz, ungelesen int)
language sql stable security definer set search_path = '' as $$
  with raeume as (
    select null::uuid as b, null::uuid as o, 'Ganze Firma'::text as n, 0 as sortierung
    union all
    select x.id, null, x.name, 1 from public.bereiche x where x.firma_id = f and jarvis_intern.im_chat(auth.uid(), f, x.id, null)
    union all
    select null, e.id, e.name, 2 from public.einsatzorte e
     where e.firma_id = f and jarvis_intern.im_chat(auth.uid(), f, null, e.id)
       and (exists (select 1 from public.schichten s where s.firma_id = f and s.einsatzort_id = e.id
                     and s.datum between (now() at time zone 'Europe/Berlin')::date - 14 and (now() at time zone 'Europe/Berlin')::date + 30)
         or exists (select 1 from public.chat_nachrichten c where c.firma_id = f and c.einsatzort_id = e.id and c.erstellt > now() - interval '90 days'))
  )
  select r.b, r.o, r.n,
    (select max(c.erstellt) from public.chat_nachrichten c
      where c.firma_id = f and c.bereich_id is not distinct from r.b and c.einsatzort_id is not distinct from r.o),
    (select count(*)::int from public.chat_nachrichten c
      where c.firma_id = f and c.bereich_id is not distinct from r.b and c.einsatzort_id is not distinct from r.o
        and c.user_id is distinct from auth.uid()
        and c.erstellt > coalesce((select g.zuletzt from public.chat_gelesen g where g.firma_id = f and g.user_id = auth.uid()
                                    and g.raum = coalesce('b:' || r.b::text, 'o:' || r.o::text, 'firma')), now() - interval '30 days'))
  from raeume r
  where jarvis_intern.im_chat(auth.uid(), f, null, null)
  order by 4 desc nulls last, r.sortierung, r.n
$$;
revoke all on function public.meine_chats(uuid) from public, anon;
grant execute on function public.meine_chats(uuid) to authenticated;

-- Phone notification to everyone in the room except the author (combined per person in the hourly run).
create or replace function jarvis_intern.chat_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  raumname text;
  autor text;
begin
  raumname := coalesce((select x.name from public.bereiche x where x.id = new.bereich_id),
                       (select e.name from public.einsatzorte e where e.id = new.einsatzort_id), 'Ganze Firma');
  autor := coalesce((select coalesce(nullif(m.anzeigename, ''), m.funktion) from public.mitglieder m
                      where m.firma_id = new.firma_id and m.user_id = new.user_id), 'Team');
  insert into public.push_warteschlange (user_id, titel, text, url)
  select m.user_id, '💬 ' || left(raumname, 60), left(autor || ': ' || new.text, 140),
         '/konto/chat' || coalesce('?b=' || new.bereich_id::text, '?o=' || new.einsatzort_id::text, '?raum=firma')
    from public.mitglieder m
   where m.firma_id = new.firma_id and m.aktiv and m.user_id is distinct from new.user_id
     and jarvis_intern.im_chat(m.user_id, new.firma_id, new.bereich_id, new.einsatzort_id);
  return null;
end $$;
drop trigger if exists chat_push on public.chat_nachrichten;
create trigger chat_push after insert on public.chat_nachrichten for each row execute function jarvis_intern.chat_push();
