-- T23 PSA-Ausgabe, T24 Bewerber, T25 Einstieg/Austritt-Checklisten, T26 Urlaubskonto, T27 Einsatz-Bewertung
-- (T28 Personal-Auswertung reads existing data only).

-- ---------- T23: personal protective equipment ----------
create table if not exists public.psa_ausgaben (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  artikel text not null check (length(trim(artikel)) between 2 and 120),
  groesse text not null default '' check (length(groesse) <= 20),
  menge integer not null default 1 check (menge between 1 and 99),
  ausgegeben date not null,
  austausch date,
  zurueck date,
  notiz text not null default '' check (length(notiz) <= 300),
  erstellt timestamptz not null default now()
);
create index if not exists psa_person on public.psa_ausgaben (personal_id, ausgegeben desc);
alter table public.psa_ausgaben enable row level security;
create policy lesen on public.psa_ausgaben for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = psa_ausgaben.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.psa_ausgaben for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = psa_ausgaben.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = psa_ausgaben.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.psa_ausgaben for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = psa_ausgaben.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.psa_ausgaben from anon;
grant select, insert, update, delete on public.psa_ausgaben to authenticated;

-- ---------- T24: applicants (only office roles that may edit; deleted 6 months after rejection) ----------
create table if not exists public.bewerber (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid references public.bereiche on delete set null,
  vorname text not null check (length(trim(vorname)) between 1 and 80),
  nachname text not null default '' check (length(nachname) <= 80),
  email text not null default '' check (length(email) <= 200),
  telefon text not null default '' check (length(telefon) <= 60),
  beruf text not null default '' check (length(beruf) <= 120),
  quelle text not null default '' check (length(quelle) <= 120),
  status text not null default 'neu' check (status in ('neu', 'gespraech', 'zusage', 'absage', 'eingestellt')),
  gespraech timestamptz,
  notiz text not null default '' check (length(notiz) <= 1000),
  loeschen_ab date,
  personal_id uuid references public.personal on delete set null,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists bewerber_firma on public.bewerber (firma_id, status);
alter table public.bewerber enable row level security;
create policy verwalten on public.bewerber for all to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id)) with check (public.darf_bearbeiten(firma_id, bereich_id));
revoke all on public.bewerber from anon;
grant select, insert, update, delete on public.bewerber to authenticated;

-- Deletion date follows the status: rejection = 6 months (AGG claims), hired = 30 days (data is in the personnel file then).
create or replace function jarvis_intern.bewerber_frist() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.geaendert := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.loeschen_ab := case new.status when 'absage' then (now() at time zone 'Europe/Berlin')::date + 183
                                       when 'eingestellt' then (now() at time zone 'Europe/Berlin')::date + 30 else null end;
  end if;
  return new;
end $$;
drop trigger if exists bewerber_frist on public.bewerber;
create trigger bewerber_frist before insert or update on public.bewerber for each row execute function jarvis_intern.bewerber_frist();

create table if not exists public.bewerber_dateien (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bewerber_id uuid not null references public.bewerber on delete cascade,
  name text not null check (length(name) between 1 and 200),
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  groesse integer not null check (groesse between 1 and 10485760),
  erstellt timestamptz not null default now()
);
alter table public.bewerber_dateien enable row level security;
create policy verwalten on public.bewerber_dateien for all to authenticated
  using (exists (select 1 from public.bewerber b where b.id = bewerber_id and b.firma_id = bewerber_dateien.firma_id and public.darf_bearbeiten(b.firma_id, b.bereich_id)))
  with check (exists (select 1 from public.bewerber b where b.id = bewerber_id and b.firma_id = bewerber_dateien.firma_id and public.darf_bearbeiten(b.firma_id, b.bereich_id)));
revoke all on public.bewerber_dateien from anon;
grant select, insert, delete on public.bewerber_dateien to authenticated;

-- ---------- T25: onboarding / leaving checklists ----------
alter table public.personal add column if not exists austritt_am date;
create table if not exists public.checklisten_punkte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  art text not null check (art in ('einstieg', 'austritt')),
  titel text not null check (length(trim(titel)) between 2 and 160),
  reihenfolge integer not null default 0,
  erledigt timestamptz,
  erledigt_von uuid,
  erstellt timestamptz not null default now()
);
create index if not exists checklisten_person on public.checklisten_punkte (personal_id, art, reihenfolge);
alter table public.checklisten_punkte enable row level security;
create policy lesen on public.checklisten_punkte for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = checklisten_punkte.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.checklisten_punkte for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = checklisten_punkte.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = checklisten_punkte.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
revoke all on public.checklisten_punkte from anon;
grant select, insert, update, delete on public.checklisten_punkte to authenticated;

-- ---------- T26: leave entitlement per person and year ----------
create table if not exists public.urlaubskonten (
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  jahr integer not null check (jahr between 2020 and 2100),
  anspruch numeric(5, 1) not null default 0 check (anspruch between 0 and 100),
  uebertrag numeric(5, 1) not null default 0 check (uebertrag between -100 and 100),
  primary key (personal_id, jahr)
);
alter table public.urlaubskonten enable row level security;
create policy lesen on public.urlaubskonten for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = urlaubskonten.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.urlaubskonten for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = urlaubskonten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = urlaubskonten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.urlaubskonten for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = urlaubskonten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.urlaubskonten from anon;
grant select, insert, update, delete on public.urlaubskonten to authenticated;

-- ---------- T27: assignment feedback (office only; staff do not see ratings) ----------
create table if not exists public.einsatz_bewertungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  kunde_id uuid references public.kunden on delete set null,
  einsatz text not null default '' check (length(einsatz) <= 160),
  datum date not null,
  sterne integer not null check (sterne between 1 and 5),
  wieder text not null default 'egal' check (wieder in ('ja', 'nein', 'egal')),
  notiz text not null default '' check (length(notiz) <= 500),
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create index if not exists bewertungen_person on public.einsatz_bewertungen (personal_id, datum desc);
alter table public.einsatz_bewertungen enable row level security;
create policy lesen on public.einsatz_bewertungen for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsatz_bewertungen.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.einsatz_bewertungen for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsatz_bewertungen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsatz_bewertungen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id))
    and (kunde_id is null or exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = einsatz_bewertungen.firma_id)));
revoke all on public.einsatz_bewertungen from anon;
grant select, insert, update, delete on public.einsatz_bewertungen to authenticated;

do $$
declare t text;
begin
  foreach t in array array['psa_ausgaben', 'bewerber', 'checklisten_punkte', 'urlaubskonten', 'einsatz_bewertungen'] loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
