-- Idea 41 (docs/ideen-arbeitsoberflaeche.md): post-calculation per customer and month (planned vs. actual hours,
-- wage costs vs. revenue, contribution margin). Hourly wage per person and the firm's cost factors; finance only.
create table if not exists public.personal_loehne (
  personal_id uuid primary key references public.personal on delete cascade,
  firma_id uuid not null references public.firmen on delete cascade,
  stundenlohn numeric(7, 2) not null check (stundenlohn > 0 and stundenlohn <= 500),
  geaendert timestamptz not null default now()
);
alter table public.personal_loehne enable row level security;
create policy lesen on public.personal_loehne for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_loehne.firma_id and jarvis_intern.darf_finanzen(p.firma_id, p.bereich_id)));
create policy verwalten on public.personal_loehne for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_loehne.firma_id
         and jarvis_intern.darf_finanzen(p.firma_id, p.bereich_id) and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_loehne.firma_id
         and jarvis_intern.darf_finanzen(p.firma_id, p.bereich_id) and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
revoke all on public.personal_loehne from anon;
grant select, insert, update, delete on public.personal_loehne to authenticated;
do $$ begin
  drop trigger if exists protokoll on public.personal_loehne;
  create trigger protokoll after insert or update or delete on public.personal_loehne for each row execute function jarvis_intern.protokollieren();
end $$;

-- Firm-wide cost factors (defaults like the price calculation): standard wage, employer costs, surcharges in %.
create table if not exists public.nachkalkulation_werte (
  firma_id uuid primary key references public.firmen on delete cascade,
  lohn numeric(7, 2) not null default 15 check (lohn > 0 and lohn <= 500),
  nebenkosten numeric(5, 2) not null default 23 check (nebenkosten between 0 and 100),
  nacht numeric(5, 2) not null default 25 check (nacht between 0 and 300),
  sonntag numeric(5, 2) not null default 50 check (sonntag between 0 and 300),
  feiertag numeric(5, 2) not null default 100 check (feiertag between 0 and 300)
);
alter table public.nachkalkulation_werte enable row level security;
create policy lesen on public.nachkalkulation_werte for select to authenticated using (jarvis_intern.darf_finanzen(firma_id, null));
create policy verwalten on public.nachkalkulation_werte for all to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
revoke all on public.nachkalkulation_werte from anon;
grant select, insert, update, delete on public.nachkalkulation_werte to authenticated;
