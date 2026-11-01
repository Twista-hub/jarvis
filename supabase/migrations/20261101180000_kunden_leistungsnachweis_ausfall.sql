-- T33 Kunden und Einsatzorte, T29 Leistungsnachweis (uses time sheets + customers), T30 Zuschläge (holidays per
-- federal state), T31 Einsatz-Infoblatt (site details for staff on their shift), T32 kurzfristiger Ausfall.

-- ---------- T33: customers (hourly rate only with finance access) and sites ----------
create table if not exists public.kunden (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid references public.bereiche on delete set null,
  name text not null check (length(trim(name)) between 2 and 160),
  strasse text not null default '' check (length(strasse) <= 160),
  plz text not null default '' check (plz = '' or plz ~ '^\d{5}$'),
  ort text not null default '' check (length(ort) <= 100),
  ansprechpartner text not null default '' check (length(ansprechpartner) <= 160),
  telefon text not null default '' check (length(telefon) <= 60),
  email text not null default '' check (length(email) <= 200),
  notiz text not null default '' check (length(notiz) <= 500),
  erstellt timestamptz not null default now()
);
create unique index if not exists kunden_name on public.kunden (firma_id, lower(name));
alter table public.kunden enable row level security;
create policy lesen on public.kunden for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter' and public.darf_bereich(firma_id, bereich_id));
create policy verwalten on public.kunden for all to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id)) with check (public.darf_bearbeiten(firma_id, bereich_id));
revoke all on public.kunden from anon;
grant select, insert, update, delete on public.kunden to authenticated;

create table if not exists public.kunden_preise (
  firma_id uuid not null,
  kunde_id uuid not null references public.kunden on delete cascade,
  satz numeric(10, 2) not null check (satz >= 0 and satz <= 10000),
  geaendert timestamptz not null default now(),
  primary key (firma_id, kunde_id)
);
alter table public.kunden_preise enable row level security;
create policy lesen on public.kunden_preise for select to authenticated using
  (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_preise.firma_id and jarvis_intern.darf_finanzen(k.firma_id, k.bereich_id)));
create policy verwalten on public.kunden_preise for all to authenticated
  using (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_preise.firma_id and jarvis_intern.darf_finanzen(k.firma_id, k.bereich_id) and public.darf_bearbeiten(k.firma_id, k.bereich_id)))
  with check (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_preise.firma_id and jarvis_intern.darf_finanzen(k.firma_id, k.bereich_id) and public.darf_bearbeiten(k.firma_id, k.bereich_id)));
revoke all on public.kunden_preise from anon;
grant select, insert, update, delete on public.kunden_preise to authenticated;

create table if not exists public.einsatzorte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid references public.kunden on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  strasse text not null default '' check (length(strasse) <= 160),
  plz text not null default '' check (plz = '' or plz ~ '^\d{5}$'),
  ort text not null default '' check (length(ort) <= 100),
  ansprechpartner text not null default '' check (length(ansprechpartner) <= 160),
  telefon text not null default '' check (length(telefon) <= 60),
  treffpunkt text not null default '' check (length(treffpunkt) <= 300),
  kleidung text not null default '' check (length(kleidung) <= 300),
  hinweise text not null default '' check (length(hinweise) <= 1000),
  erstellt timestamptz not null default now()
);
create index if not exists einsatzorte_firma on public.einsatzorte (firma_id, kunde_id);
alter table public.einsatzorte enable row level security;
create policy lesen on public.einsatzorte for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and (kunde_id is null or exists (select 1 from public.kunden k where k.id = kunde_id and public.darf_bereich(k.firma_id, k.bereich_id))));
create policy verwalten on public.einsatzorte for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')
    and (kunde_id is null or exists (select 1 from public.kunden k where k.id = kunde_id and public.darf_bearbeiten(k.firma_id, k.bereich_id))))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')
    and (kunde_id is null or exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = einsatzorte.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id))));
revoke all on public.einsatzorte from anon;
grant select, insert, update, delete on public.einsatzorte to authenticated;

-- T31: shifts point to a site; staff read the site of their own shifts (from yesterday on).
alter table public.schichten add column if not exists einsatzort_id uuid references public.einsatzorte on delete set null;
create policy eigene_einsatzorte on public.einsatzorte for select to authenticated using
  (exists (select 1 from public.schichten s join public.personal p on p.id = s.personal_id and p.firma_id = s.firma_id
            where s.einsatzort_id = einsatzorte.id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null
              and s.datum >= (now() at time zone 'Europe/Berlin')::date - 1));

-- T29: time sheets know their customer. The assignment text is matched to a customer or site name (also for entries made by staff,
-- who cannot read the customer list themselves).
alter table public.stundenzettel add column if not exists kunde_id uuid references public.kunden on delete set null;
create index if not exists stundenzettel_kunde on public.stundenzettel (kunde_id, datum);
create or replace function jarvis_intern.stunden_kunde() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kunde_id is null and coalesce(trim(new.einsatz), '') <> '' then
    select k.id into new.kunde_id from public.kunden k where k.firma_id = new.firma_id and lower(k.name) = lower(trim(new.einsatz)) limit 1;
    if new.kunde_id is null then
      select o.kunde_id into new.kunde_id from public.einsatzorte o where o.firma_id = new.firma_id and o.kunde_id is not null and lower(o.name) = lower(trim(new.einsatz)) limit 1;
    end if;
  elsif new.kunde_id is not null and not exists (select 1 from public.kunden k where k.id = new.kunde_id and k.firma_id = new.firma_id) then
    new.kunde_id := null;
  end if;
  return new;
end $$;
drop trigger if exists stunden_kunde on public.stundenzettel;
create trigger stunden_kunde before insert or update of einsatz, kunde_id on public.stundenzettel for each row execute function jarvis_intern.stunden_kunde();

-- T30: federal state for public holidays (empty = derived from the firm's postal code).
alter table public.firmenprofil add column if not exists bundesland text not null default ''
  check (bundesland in ('', 'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'));

-- ---------- T32: short-notice absence ----------
alter table public.personal_abwesenheiten add column if not exists kurzfristig boolean not null default false;

-- Staff report "I can't come" for today or tomorrow (no reason, no health data). Their shifts that day are cancelled and
-- planners, owners/admins and the site lead get a phone notification.
create or replace function public.ausfall_melden(tag date, notiz text default '') returns integer
language plpgsql security definer set search_path = '' as $$
declare p record; n integer; heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if tag not in (heute, heute + 1) then return -1; end if;
  select x.id, x.firma_id, x.bereich_id, trim(x.vorname || ' ' || x.nachname) as name into p
    from public.personal x where x.user_id = auth.uid() and public.meine_rolle(x.firma_id) is not null limit 1;
  if p.id is null then return -1; end if;
  if exists (select 1 from public.personal_abwesenheiten a where a.personal_id = p.id and a.status = 'bestaetigt' and tag between a.von and a.bis) then return -2; end if;
  insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis, grund, notiz, status, kurzfristig)
  values (p.firma_id, p.id, tag, tag, 'abwesend', left(coalesce(notiz, ''), 200), 'bestaetigt', true);
  with weg as (
    update public.schichten s set antwort = 'abgesagt', beantwortet = now()
     where s.personal_id = p.id and s.firma_id = p.firma_id and s.datum = tag and s.antwort <> 'abgesagt' returning s.erstellt_von)
  select count(*) into n from weg;
  insert into public.push_warteschlange (user_id, titel, text, url)
  select distinct m.user_id, '🚨 Ausfall: ' || p.name || (case when tag = heute then ' heute' else ' morgen' end),
         case when n > 0 then n || ' ' || (case when n = 1 then 'Schicht' else 'Schichten' end) || ' ohne Besetzung – Ersatz vorschlagen' else 'kurzfristig nicht verfügbar' end,
         '/konto/schichten?woche=' || to_char(tag, 'YYYY-MM-DD') || '#ausfall'
    from public.mitglieder m
   where m.firma_id = p.firma_id and m.aktiv and m.user_id <> auth.uid()
     and (m.rolle in ('inhaber', 'admin')
          or m.user_id in (select s.erstellt_von from public.schichten s where s.personal_id = p.id and s.datum = tag)
          or (m.rolle = 'standortleitung' and exists (select 1 from public.mitglied_bereiche mb where mb.firma_id = m.firma_id and mb.user_id = m.user_id
                                                       and jarvis_intern.im_bereich(p.firma_id, p.bereich_id, mb.bereich_id))));
  return n;
end $$;
revoke all on function public.ausfall_melden(date, text) from public, anon;
grant execute on function public.ausfall_melden(date, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['kunden', 'einsatzorte'] loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
