-- US: "Darf ich bieten?"-Ampel und Fristen-Tracker.
-- 1. US bidder profile per firm (SAM.gov registration, NAICS, SBA certifications, size). Readable by the office team,
--    changed by owners and admins (like firmenprofil). Revenue only with finance rights is not needed: the size check
--    uses the firm's own statement "small for these NAICS" plus optional average revenue, both entered by admins.
create table if not exists public.us_bieterprofil (
  firma_id uuid primary key references public.firmen on delete cascade,
  uei text not null default '' check (uei = '' or uei ~ '^[A-Z0-9]{12}$'),
  cage text not null default '' check (cage = '' or cage ~ '^[A-Z0-9]{5}$'),
  sam_gueltig_bis date,
  naics text[] not null default '{}' check (cardinality(naics) <= 100 and array_to_string(naics, '') ~ '^[0-9]*$'),
  klein_naics text[] not null default '{}' check (cardinality(klein_naics) <= 100 and array_to_string(klein_naics, '') ~ '^[0-9]*$'),
  zertifikate text[] not null default '{}' check (zertifikate <@ array['8a','hubzone','wosb','edwosb','vosb','sdvosb','iee']::text[]),
  umsatz_durchschnitt numeric(14,0) check (umsatz_durchschnitt is null or umsatz_durchschnitt >= 0),
  mitarbeiter integer check (mitarbeiter is null or mitarbeiter between 0 and 1000000),
  geaendert timestamptz not null default now()
);
alter table public.us_bieterprofil enable row level security;
create policy lesen on public.us_bieterprofil for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.us_bieterprofil for all to authenticated using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));
revoke all on public.us_bieterprofil from anon;
grant select, insert, update, delete on public.us_bieterprofil to authenticated;

-- 2. Structured SAM.gov fields of a US hit (set-aside, NAICS, PSC, solicitation number, notice type, deadline with
--    offset, amendments seen). Written by the alarm run; same row level security as the tender row.
alter table public.vorgaenge add column if not exists us jsonb check (us is null or (jsonb_typeof(us) = 'object' and octet_length(us::text) < 20000));
