-- N7 Textbausteine and N9 Leistungsverzeichnis (GAEB).

-- N7: recurring offer texts of a firm (company profile, quality, staffing, closing). "immer" pre-ticks the text
-- module when an offer is prepared.
create table if not exists public.textbausteine (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  titel text not null check (length(trim(titel)) between 2 and 120),
  kategorie text not null default 'Allgemein' check (length(trim(kategorie)) between 1 and 60),
  text text not null check (length(trim(text)) between 1 and 10000),
  immer boolean not null default false,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists textbausteine_firma on public.textbausteine (firma_id, kategorie, titel);
alter table public.textbausteine enable row level security;
create policy lesen on public.textbausteine for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.textbausteine for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
revoke all on public.textbausteine from anon;
grant select, insert, update, delete on public.textbausteine to authenticated;

-- N9: bill of quantities read from a GAEB DA XML file (X81/X82/X83) of a tender, with the firm's unit prices.
-- Prices are finance data: same rights as the calculation of the tender.
create table if not exists public.leistungsverzeichnisse (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null,
  vorgang_id uuid not null,
  dateiname text not null check (length(dateiname) <= 200),
  kopf jsonb not null default '{}',
  struktur jsonb not null,
  preise jsonb not null default '{}',
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  unique (firma_id, vorgang_id),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade,
  check (octet_length(struktur::text) < 4000000 and octet_length(preise::text) < 500000)
);
alter table public.leistungsverzeichnisse enable row level security;
create policy lesen on public.leistungsverzeichnisse for select to authenticated using
  (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = leistungsverzeichnisse.firma_id and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id)));
create policy verwalten on public.leistungsverzeichnisse for all to authenticated
  using (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = leistungsverzeichnisse.firma_id
                 and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id) and public.darf_bearbeiten(v.firma_id, v.bereich_id)))
  with check (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = leistungsverzeichnisse.firma_id
                 and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id) and public.darf_bearbeiten(v.firma_id, v.bereich_id)));
revoke all on public.leistungsverzeichnisse from anon;
grant select, insert, update, delete on public.leistungsverzeichnisse to authenticated;

notify pgrst, 'reload schema';
