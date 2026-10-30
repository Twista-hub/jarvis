-- Personnel pool per location (temporary workers the firm places), not app users: name, occupations,
-- qualifications, wage group, phone, availability. Visible to members who may see the location;
-- changed by editors of that location. Employees with "Mitarbeiter" access see nothing (darf_bereich).
create table public.personal (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  vorname text not null check (length(vorname) between 1 and 100),
  nachname text not null default '' check (length(nachname) <= 100),
  berufe text[] not null default '{}' check (cardinality(berufe) <= 20),
  qualifikationen text[] not null default '{}' check (cardinality(qualifikationen) <= 20),
  eg text not null default '' check (eg in ('', '1', '2a', '2b', '3', '4', '5', '6', '7', '8', '9')),
  telefon text not null default '' check (length(telefon) <= 40),
  email text not null default '' check (length(email) <= 200),
  status text not null default 'verfuegbar' check (status in ('verfuegbar', 'einsatz', 'nicht')),
  notiz text not null default '' check (length(notiz) <= 500),
  erstellt timestamptz not null default now(),
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete set null (bereich_id)
);
create index on public.personal (firma_id, bereich_id);
alter table public.personal enable row level security;
create policy lesen on public.personal for select to authenticated using (public.darf_bereich(firma_id, bereich_id));
create policy anlegen on public.personal for insert to authenticated with check (public.darf_bearbeiten(firma_id, bereich_id));
create policy aendern on public.personal for update to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id)) with check (public.darf_bearbeiten(firma_id, bereich_id));
create policy loeschen on public.personal for delete to authenticated using (public.darf_bearbeiten(firma_id, bereich_id));
grant select, insert, update, delete on public.personal to authenticated;
