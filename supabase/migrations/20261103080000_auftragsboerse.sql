-- Idea 26 (docs/ideen-arbeitsoberflaeche.md): job exchange between Jarvis firms. BUILT BUT SWITCHED OFF in the web app
-- (web/src/boerse.ts, BOERSE_AKTIV = false) until the terms of use were checked by a lawyer (platform duties under the
-- DSA, liability of the main contractor for minimum wage / social security of subcontractors) and Benjamin agrees.
-- A firm posts a (part) job; other firms see open jobs (firm name, trade, place, period, description) and register
-- interest. Contact details are only exchanged once the posting firm accepts an interest.
create table if not exists public.boerse_auftraege (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  titel text not null check (length(trim(titel)) between 3 and 160),
  gewerk text not null default '' check (length(gewerk) <= 60),
  plz text not null default '' check (plz = '' or plz ~ '^\d{5}$'),
  ort text not null default '' check (length(ort) <= 100),
  von date,
  bis date check (bis is null or von is null or bis >= von),
  beschreibung text not null default '' check (length(beschreibung) <= 2000),
  status text not null default 'offen' check (status in ('offen', 'vergeben', 'geschlossen')),
  ablauf date not null default (now() at time zone 'Europe/Berlin')::date + 30,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create index if not exists boerse_offen on public.boerse_auftraege (status, ablauf);
create table if not exists public.boerse_interessen (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null references public.boerse_auftraege on delete cascade,
  firma_id uuid not null references public.firmen on delete cascade,
  nachricht text not null default '' check (length(nachricht) <= 1000),
  status text not null default 'offen' check (status in ('offen', 'angenommen', 'abgelehnt')),
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now(),
  unique (auftrag_id, firma_id)
);
create table if not exists public.boerse_meldungen (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null references public.boerse_auftraege on delete cascade,
  grund text not null check (length(trim(grund)) between 3 and 1000),
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);

alter table public.boerse_auftraege enable row level security;
alter table public.boerse_interessen enable row level security;
alter table public.boerse_meldungen enable row level security;
-- Office roles of any firm see open, unexpired jobs; the own firm sees all its jobs.
create policy lesen on public.boerse_auftraege for select to authenticated using
  (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser')
   or (status = 'offen' and ablauf >= (now() at time zone 'Europe/Berlin')::date
       and exists (select 1 from public.mitglieder m where m.user_id = auth.uid() and m.aktiv and m.rolle in ('inhaber', 'admin', 'bearbeiter'))));
create policy verwalten on public.boerse_auftraege for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter') and ablauf <= (now() at time zone 'Europe/Berlin')::date + 90);
-- Interests: the interested firm and the posting firm see them; only the interested firm creates/withdraws,
-- only the posting firm accepts or rejects (column status only).
create policy lesen on public.boerse_interessen for select to authenticated using
  (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser')
   or exists (select 1 from public.boerse_auftraege a where a.id = auftrag_id and public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser')));
create policy bekunden on public.boerse_interessen for insert to authenticated with check
  (status = 'offen' and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter')
   and exists (select 1 from public.boerse_auftraege a where a.id = auftrag_id and a.firma_id <> boerse_interessen.firma_id and a.status = 'offen'));
create policy zurueckziehen on public.boerse_interessen for delete to authenticated using
  (status = 'offen' and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
create policy entscheiden on public.boerse_interessen for update to authenticated
  using (exists (select 1 from public.boerse_auftraege a where a.id = auftrag_id and public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter')))
  with check (exists (select 1 from public.boerse_auftraege a where a.id = auftrag_id and public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter')));
-- Reports of illegal or abusive jobs (DSA notice): anyone in the office can report; only the operator reads them.
create policy melden on public.boerse_meldungen for insert to authenticated with check
  (exists (select 1 from public.mitglieder m where m.user_id = auth.uid() and m.aktiv and m.rolle <> 'mitarbeiter'));
revoke all on public.boerse_auftraege, public.boerse_interessen, public.boerse_meldungen from anon;
revoke all on public.boerse_interessen, public.boerse_meldungen from authenticated;
grant select, insert, update, delete on public.boerse_auftraege to authenticated;
grant select, insert, delete on public.boerse_interessen to authenticated;
grant update (status) on public.boerse_interessen to authenticated;
grant insert on public.boerse_meldungen to authenticated;

-- Contact of the other side, only for an accepted interest (both directions).
create or replace function public.boerse_kontakt(interesse uuid) returns table (firma text, ort text, telefon text, email text)
language sql stable security definer set search_path = '' as $$
  select f.name, trim(coalesce(f.plz, '') || ' ' || coalesce(f.ort, '')), coalesce(f.telefon, ''), coalesce(fp.email, '')
    from public.boerse_interessen i join public.boerse_auftraege a on a.id = i.auftrag_id
    join public.firmen f on f.id = case when public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser') then i.firma_id else a.firma_id end
    left join public.firmenprofil fp on fp.firma_id = f.id
   where i.id = boerse_kontakt.interesse and i.status = 'angenommen'
     and (public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser') or public.meine_rolle(i.firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser'))
$$;
revoke all on function public.boerse_kontakt(uuid) from public;
grant execute on function public.boerse_kontakt(uuid) to authenticated;
-- Firm names of other firms are not readable directly; this gives the names for visible jobs and interests.
create or replace function public.boerse_firmennamen(ids uuid[]) returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select f.id, f.name from public.firmen f where f.id = any(ids)
    and (exists (select 1 from public.boerse_auftraege a where a.firma_id = f.id and a.status = 'offen')
      or exists (select 1 from public.boerse_interessen i join public.boerse_auftraege a on a.id = i.auftrag_id
                  where i.firma_id = f.id and public.meine_rolle(a.firma_id) in ('inhaber', 'admin', 'bearbeiter', 'leser')))
    and exists (select 1 from public.mitglieder m where m.user_id = auth.uid() and m.aktiv and m.rolle <> 'mitarbeiter')
$$;
revoke all on function public.boerse_firmennamen(uuid[]) from public;
grant execute on function public.boerse_firmennamen(uuid[]) to authenticated;

-- The posting firm gets a phone message for each new interest.
create or replace function jarvis_intern.boerse_interesse_melden() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.boerse_auftraege;
begin
  select * into a from public.boerse_auftraege where id = new.auftrag_id;
  if a.erstellt_von is not null then
    insert into public.push_warteschlange (user_id, titel, text, url) values (a.erstellt_von, '🤝 Interesse an deinem Auftrag',
      left(coalesce((select name from public.firmen where id = new.firma_id), ''), 60) || ' · ' || left(a.titel, 80), '/konto/boerse');
  end if;
  return new;
end $$;
drop trigger if exists melden on public.boerse_interessen;
create trigger melden after insert on public.boerse_interessen for each row execute function jarvis_intern.boerse_interesse_melden();
