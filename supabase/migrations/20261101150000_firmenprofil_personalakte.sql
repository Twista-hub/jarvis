-- T1–T8: Firmenprofil (master data, key figures, certificates) and Personalakte (more fields, qualification proofs with
-- expiry, recurring instructions).

-- T1: master data asked for in tenders. Readable by the office team, changed by owners and admins.
create table if not exists public.firmenprofil (
  firma_id uuid primary key references public.firmen on delete cascade,
  rechtsform text not null default '' check (length(rechtsform) <= 60),
  registergericht text not null default '' check (length(registergericht) <= 100),
  registernummer text not null default '' check (length(registernummer) <= 60),
  gruendungsjahr integer check (gruendungsjahr is null or gruendungsjahr between 1800 and 2100),
  mitarbeiter integer check (mitarbeiter is null or mitarbeiter between 0 and 1000000),
  website text not null default '' check (length(website) <= 200),
  email text not null default '' check (length(email) <= 200),
  ustid text not null default '' check (length(ustid) <= 20),
  geschaeftsfuehrung text not null default '' check (length(geschaeftsfuehrung) <= 300),
  taetigkeit text not null default '' check (length(taetigkeit) <= 2000),
  logo text check (logo is null or logo in ('image/png', 'image/jpeg')),
  geaendert timestamptz not null default now()
);
alter table public.firmenprofil enable row level security;
create policy lesen on public.firmenprofil for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.firmenprofil for all to authenticated using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));
revoke all on public.firmenprofil from anon;
grant select, insert, update, delete on public.firmenprofil to authenticated;

-- Revenue and staff of the last years (asked for in the suitability declaration): finance data.
create table if not exists public.firmen_kennzahlen (
  firma_id uuid not null references public.firmen on delete cascade,
  jahr integer not null check (jahr between 1990 and 2100),
  umsatz numeric(16, 2) check (umsatz is null or umsatz >= 0),
  beschaeftigte integer check (beschaeftigte is null or beschaeftigte between 0 and 1000000),
  primary key (firma_id, jahr)
);
alter table public.firmen_kennzahlen enable row level security;
create policy lesen on public.firmen_kennzahlen for select to authenticated using (jarvis_intern.darf_finanzen(firma_id, null));
create policy verwalten on public.firmen_kennzahlen for all to authenticated
  using (public.ist_admin(firma_id) and jarvis_intern.darf_finanzen(firma_id, null))
  with check (public.ist_admin(firma_id) and jarvis_intern.darf_finanzen(firma_id, null));
revoke all on public.firmen_kennzahlen from anon;
grant select, insert, update, delete on public.firmen_kennzahlen to authenticated;

-- T3: prequalification and certificates of the firm with number and expiry (optionally the stored document).
create table if not exists public.firmen_zertifikate (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  art text not null default 'sonstiges' check (art in ('pq_vob', 'avpq', 'iso9001', 'iso14001', 'iso45001', 'scc', 'sonstiges')),
  bezeichnung text not null check (length(trim(bezeichnung)) between 2 and 200),
  nummer text not null default '' check (length(nummer) <= 100),
  aussteller text not null default '' check (length(aussteller) <= 200),
  gueltig_bis date,
  unterlage_id uuid references public.firmenunterlagen on delete set null,
  erstellt timestamptz not null default now()
);
create index if not exists firmen_zertifikate_firma on public.firmen_zertifikate (firma_id, gueltig_bis);
alter table public.firmen_zertifikate enable row level security;
create policy lesen on public.firmen_zertifikate for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.firmen_zertifikate for all to authenticated using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));
revoke all on public.firmen_zertifikate from anon;
grant select, insert, update, delete on public.firmen_zertifikate to authenticated;

-- T4: more fields per person. The home postal code is only used for the distance to a site.
alter table public.personal
  add column if not exists eintritt date,
  add column if not exists beschaeftigung text not null default '' check (beschaeftigung in ('', 'vollzeit', 'teilzeit', 'minijob', 'aushilfe', 'azubi')),
  add column if not exists wochenstunden numeric(4, 1) check (wochenstunden is null or wochenstunden between 0 and 60),
  add column if not exists fuehrerschein text[] not null default '{}' check (cardinality(fuehrerschein) <= 12),
  add column if not exists sprachen text[] not null default '{}' check (cardinality(sprachen) <= 12),
  add column if not exists wohn_plz text not null default '' check (wohn_plz = '' or wohn_plz ~ '^\d{5}$');

-- T5: qualification proofs per person (forklift licence, first aid, hygiene instruction, §34a …) with expiry and file.
create table if not exists public.personal_nachweise (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  bezeichnung text not null check (length(trim(bezeichnung)) between 2 and 120),
  erworben date,
  gueltig_bis date,
  datei_name text check (datei_name is null or length(datei_name) <= 200),
  datei_mime text check (datei_mime is null or datei_mime in ('application/pdf', 'image/png', 'image/jpeg')),
  datei_groesse integer check (datei_groesse is null or datei_groesse between 1 and 5242880),
  erstellt timestamptz not null default now(),
  check (gueltig_bis is null or erworben is null or gueltig_bis >= erworben)
);
create index if not exists personal_nachweise_person on public.personal_nachweise (personal_id, gueltig_bis);
alter table public.personal_nachweise enable row level security;
create policy lesen on public.personal_nachweise for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_nachweise.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.personal_nachweise for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_nachweise.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_nachweise.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
revoke all on public.personal_nachweise from anon;
grant select, insert, update, delete on public.personal_nachweise to authenticated;

-- T6: recurring instructions (occupational safety, hygiene …) with an interval, and who took part when.
create table if not exists public.unterweisungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  titel text not null check (length(trim(titel)) between 2 and 120),
  intervall_monate integer not null default 12 check (intervall_monate between 1 and 60),
  beschreibung text not null default '' check (length(beschreibung) <= 1000),
  erstellt timestamptz not null default now()
);
alter table public.unterweisungen enable row level security;
create policy lesen on public.unterweisungen for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.unterweisungen for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.unterweisungen from anon;
grant select, insert, update, delete on public.unterweisungen to authenticated;

create table if not exists public.unterweisung_teilnahmen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  unterweisung_id uuid not null references public.unterweisungen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  datum date not null,
  erstellt timestamptz not null default now(),
  unique (unterweisung_id, personal_id, datum)
);
create index if not exists unterweisung_teilnahmen_person on public.unterweisung_teilnahmen (personal_id, datum);
alter table public.unterweisung_teilnahmen enable row level security;
create policy lesen on public.unterweisung_teilnahmen for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterweisung_teilnahmen.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.unterweisung_teilnahmen for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterweisung_teilnahmen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterweisung_teilnahmen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id))
              and exists (select 1 from public.unterweisungen u where u.id = unterweisung_id and u.firma_id = unterweisung_teilnahmen.firma_id));
revoke all on public.unterweisung_teilnahmen from anon;
grant select, insert, update, delete on public.unterweisung_teilnahmen to authenticated;

-- Owners may update their firm's row (address, website), but not the plan: that is set by the operator or billing.
create or replace function jarvis_intern.paket_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.paket is distinct from old.paket then
    raise exception 'Der Plan kann nur über die Abrechnung geändert werden';
  end if;
  return new;
end $$;
drop trigger if exists paket_schuetzen on public.firmen;
create trigger paket_schuetzen before update on public.firmen for each row execute function jarvis_intern.paket_schuetzen();

notify pgrst, 'reload schema';
