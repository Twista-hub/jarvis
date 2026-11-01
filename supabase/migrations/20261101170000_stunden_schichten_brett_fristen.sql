-- T17 Stundenzettel, T18 Schichtplan, T19 Schwarzes Brett, T20 Personalfristen, T21 Führerscheinkontrolle,
-- T22 Unterweisung digital bestätigen. Staff (role "mitarbeiter") only ever reach their own records.

-- Helper: is area b the area ziel or below it?
create or replace function jarvis_intern.im_bereich(f uuid, b uuid, ziel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive kette as (
    select id, parent_id from public.bereiche where id = b and firma_id = f
    union all select p.id, p.parent_id from public.bereiche p join kette k on p.id = k.parent_id
  )
  select ziel is not null and exists (select 1 from kette where id = ziel)
$$;

-- Push queue: filled by triggers below, sent hourly by alarm/mail.py (Web Push needs the VAPID key, which only the job has).
create table if not exists public.push_warteschlange (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  titel text not null,
  text text not null default '',
  url text not null default '/konto',
  erstellt timestamptz not null default now(),
  gesendet timestamptz
);
create index if not exists push_warteschlange_offen on public.push_warteschlange (erstellt) where gesendet is null;
alter table public.push_warteschlange enable row level security;
revoke all on public.push_warteschlange from anon, authenticated;

-- ---------- T17: time sheets ----------
create table if not exists public.stundenzettel (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  datum date not null,
  beginn time not null,
  ende time not null,
  pause_min integer not null default 0 check (pause_min between 0 and 600),
  einsatz text not null default '' check (length(einsatz) <= 160),
  notiz text not null default '' check (length(notiz) <= 300),
  status text not null default 'erfasst' check (status in ('erfasst', 'freigegeben', 'abgelehnt')),
  freigegeben_von uuid,
  freigegeben_am timestamptz,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now(),
  check (beginn <> ende)
);
create index if not exists stundenzettel_monat on public.stundenzettel (firma_id, datum);
create index if not exists stundenzettel_person on public.stundenzettel (personal_id, datum);
alter table public.stundenzettel enable row level security;
create policy lesen on public.stundenzettel for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.stundenzettel for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.stundenzettel for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_erfassen on public.stundenzettel for insert to authenticated with check
  (status = 'erfasst' and freigegeben_von is null and freigegeben_am is null
   and datum between (now() at time zone 'Europe/Berlin')::date - 62 and (now() at time zone 'Europe/Berlin')::date
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_aendern on public.stundenzettel for update to authenticated
  using (status = 'erfasst' and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null))
  with check (status = 'erfasst' and freigegeben_von is null and freigegeben_am is null
   and datum between (now() at time zone 'Europe/Berlin')::date - 62 and (now() at time zone 'Europe/Berlin')::date
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_loeschen on public.stundenzettel for delete to authenticated using
  (status = 'erfasst' and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stundenzettel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.stundenzettel from anon;
grant select, insert, update, delete on public.stundenzettel to authenticated;

-- ---------- T18: shift plan ----------
create table if not exists public.schichten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid references public.bereiche on delete set null,
  personal_id uuid references public.personal on delete set null,
  datum date not null,
  beginn time not null,
  ende time not null,
  ort text not null default '' check (length(ort) <= 160),
  notiz text not null default '' check (length(notiz) <= 300),
  antwort text not null default 'offen' check (antwort in ('offen', 'zugesagt', 'abgesagt')),
  beantwortet timestamptz,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now(),
  check (beginn <> ende)
);
create index if not exists schichten_tag on public.schichten (firma_id, datum);
create index if not exists schichten_person on public.schichten (personal_id, datum);
alter table public.schichten enable row level security;
create policy lesen on public.schichten for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter' and public.darf_bereich(firma_id, bereich_id));
create policy verwalten on public.schichten for all to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id))
  with check (public.darf_bearbeiten(firma_id, bereich_id)
    and (personal_id is null or exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = schichten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id))));
create policy eigene_lesen on public.schichten for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = schichten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.schichten from anon;
grant select, insert, update, delete on public.schichten to authenticated;

-- Staff answer their own shift (only the answer, only for today or later). A cancellation notifies whoever planned it.
create or replace function public.schicht_antworten(s uuid, a text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare z record;
begin
  if a not in ('zugesagt', 'abgesagt') then return false; end if;
  update public.schichten sc set antwort = a, beantwortet = now()
    from public.personal p
   where sc.id = s and p.id = sc.personal_id and p.firma_id = sc.firma_id and p.user_id = auth.uid()
     and public.meine_rolle(p.firma_id) is not null and sc.datum >= (now() at time zone 'Europe/Berlin')::date
  returning sc.datum, sc.beginn, sc.erstellt_von, trim(p.vorname || ' ' || p.nachname) as name into z;
  if not found then return false; end if;
  if a = 'abgesagt' and z.erstellt_von is not null and z.erstellt_von <> auth.uid() then
    insert into public.push_warteschlange (user_id, titel, text, url)
    values (z.erstellt_von, '❌ Schicht abgesagt', z.name || ' · ' || to_char(z.datum, 'DD.MM.') || ' ' || to_char(z.beginn, 'HH24:MI') || ' Uhr', '/konto/schichten?woche=' || to_char(z.datum, 'YYYY-MM-DD'));
  end if;
  return true;
end $$;
revoke all on function public.schicht_antworten(uuid, text) from public, anon;
grant execute on function public.schicht_antworten(uuid, text) to authenticated;

create or replace function jarvis_intern.schicht_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  select p.user_id into u from public.personal p where p.id = new.personal_id and p.firma_id = new.firma_id;
  if u is not null and u is distinct from auth.uid()
     and exists (select 1 from public.mitglieder m where m.firma_id = new.firma_id and m.user_id = u and m.aktiv) then
    insert into public.push_warteschlange (user_id, titel, text, url)
    values (u, '📅 Neue Schicht ' || to_char(new.datum, 'DD.MM.') || ' · ' || to_char(new.beginn, 'HH24:MI') || '–' || to_char(new.ende, 'HH24:MI'),
            coalesce(nullif(new.ort, ''), 'Bitte zusagen oder absagen'), '/konto/ich#schichten');
  end if;
  return null;
end $$;
drop trigger if exists schicht_push on public.schichten;
create trigger schicht_push after insert or update of personal_id on public.schichten for each row
  when (new.personal_id is not null) execute function jarvis_intern.schicht_push();

-- ---------- T19: notice board ----------
create table if not exists public.mitteilungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid references public.bereiche on delete cascade,
  titel text not null check (length(trim(titel)) between 2 and 120),
  text text not null default '' check (length(text) <= 2000),
  gueltig_bis date,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create index if not exists mitteilungen_firma on public.mitteilungen (firma_id, erstellt desc);
alter table public.mitteilungen enable row level security;
-- Office sees all; staff see firm-wide notices and those for their own location (or a region above it).
create policy lesen on public.mitteilungen for select to authenticated using
  (public.meine_rolle(firma_id) is not null and (public.meine_rolle(firma_id) <> 'mitarbeiter' or bereich_id is null
    or exists (select 1 from public.personal p where p.firma_id = mitteilungen.firma_id and p.user_id = auth.uid() and jarvis_intern.im_bereich(p.firma_id, p.bereich_id, mitteilungen.bereich_id))));
create policy schreiben on public.mitteilungen for insert to authenticated with check
  (erstellt_von = auth.uid() and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')
   and (bereich_id is not null and public.darf_bearbeiten(firma_id, bereich_id) or bereich_id is null and public.meine_rolle(firma_id) <> 'standortleitung'));
create policy loeschen on public.mitteilungen for delete to authenticated using
  (erstellt_von = auth.uid() and public.meine_rolle(firma_id) is not null or public.ist_admin(firma_id));
revoke all on public.mitteilungen from anon;
grant select, insert, delete on public.mitteilungen to authenticated;

create table if not exists public.mitteilung_gelesen (
  mitteilung_id uuid not null references public.mitteilungen on delete cascade,
  firma_id uuid not null references public.firmen on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  gelesen timestamptz not null default now(),
  primary key (mitteilung_id, user_id)
);
alter table public.mitteilung_gelesen enable row level security;
create policy lesen on public.mitteilung_gelesen for select to authenticated using
  (user_id = auth.uid() or coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy bestaetigen on public.mitteilung_gelesen for insert to authenticated with check
  (user_id = auth.uid() and exists (select 1 from public.mitteilungen m where m.id = mitteilung_id and m.firma_id = mitteilung_gelesen.firma_id));
revoke all on public.mitteilung_gelesen from anon;
grant select, insert on public.mitteilung_gelesen to authenticated;

create or replace function jarvis_intern.mitteilung_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_warteschlange (user_id, titel, text, url)
  select m.user_id, '📌 ' || left(new.titel, 80), left(new.text, 140), '/konto/brett'
    from public.mitglieder m
   where m.firma_id = new.firma_id and m.aktiv and m.user_id is distinct from new.erstellt_von
     and (new.bereich_id is null or m.rolle <> 'mitarbeiter'
          or exists (select 1 from public.personal p where p.firma_id = m.firma_id and p.user_id = m.user_id and jarvis_intern.im_bereich(p.firma_id, p.bereich_id, new.bereich_id)));
  return null;
end $$;
drop trigger if exists mitteilung_push on public.mitteilungen;
create trigger mitteilung_push after insert on public.mitteilungen for each row execute function jarvis_intern.mitteilung_push();

-- ---------- T20: personnel deadlines ----------
alter table public.personal add column if not exists probezeit_bis date;
alter table public.personal add column if not exists befristet_bis date;
alter table public.personal add column if not exists aufenthalt_bis date;
alter table public.personal add column if not exists firmenwagen boolean not null default false;

-- ---------- T21: driving licence checks (every six months for people driving company vehicles) ----------
create table if not exists public.fuehrerschein_kontrollen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  datum date not null check (datum <= (now() at time zone 'Europe/Berlin')::date + 1),
  klassen text[] not null default '{}',
  notiz text not null default '' check (length(notiz) <= 300),
  geprueft_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create index if not exists fuehrerschein_kontrollen_person on public.fuehrerschein_kontrollen (personal_id, datum desc);
alter table public.fuehrerschein_kontrollen enable row level security;
create policy lesen on public.fuehrerschein_kontrollen for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = fuehrerschein_kontrollen.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.fuehrerschein_kontrollen for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = fuehrerschein_kontrollen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = fuehrerschein_kontrollen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.fuehrerschein_kontrollen for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = fuehrerschein_kontrollen.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.fuehrerschein_kontrollen from anon;
grant select, insert, update, delete on public.fuehrerschein_kontrollen to authenticated;

-- ---------- T22: instructions confirmed by the staff member on the phone ----------
-- The instruction text is read on the phone, so it may be longer now.
alter table public.unterweisungen drop constraint if exists unterweisungen_beschreibung_check;
alter table public.unterweisungen add constraint unterweisungen_beschreibung_check check (length(beschreibung) <= 4000);
alter table public.unterweisung_teilnahmen add column if not exists digital boolean not null default false;
alter table public.unterweisung_teilnahmen add column if not exists bestaetigt_am timestamptz;

drop function if exists public.meine_unterweisungen(uuid);
create function public.meine_unterweisungen(f uuid)
returns table (id uuid, titel text, intervall_monate integer, beschreibung text, letzte date, digital boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.titel, u.intervall_monate, u.beschreibung, t.datum, coalesce(t.digital, false)
    from public.personal p
    join public.unterweisungen u on u.firma_id = p.firma_id
    left join lateral (select x.datum, x.digital from public.unterweisung_teilnahmen x
                        where x.unterweisung_id = u.id and x.personal_id = p.id order by x.datum desc limit 1) t on true
   where p.firma_id = meine_unterweisungen.f and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null
   order by u.titel
$$;
revoke all on function public.meine_unterweisungen(uuid) from public, anon;
grant execute on function public.meine_unterweisungen(uuid) to authenticated;

create or replace function public.unterweisung_bestaetigen(u uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare pid uuid; fid uuid;
begin
  select p.id, p.firma_id into pid, fid
    from public.unterweisungen w join public.personal p on p.firma_id = w.firma_id
   where w.id = u and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null;
  if pid is null then return false; end if;
  insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum, digital, bestaetigt_am)
  values (fid, u, pid, (now() at time zone 'Europe/Berlin')::date, true, now())
  on conflict (unterweisung_id, personal_id, datum) do update set digital = true, bestaetigt_am = now();
  return true;
end $$;
revoke all on function public.unterweisung_bestaetigen(uuid) from public, anon;
grant execute on function public.unterweisung_bestaetigen(uuid) to authenticated;

-- Changes to time sheets, shifts and licence checks appear in the change log.
do $$
declare t text;
begin
  foreach t in array array['stundenzettel', 'schichten', 'fuehrerschein_kontrollen', 'mitteilungen'] loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
