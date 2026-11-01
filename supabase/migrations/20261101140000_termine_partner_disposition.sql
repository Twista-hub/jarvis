-- N10 Termine & Bieterfragen, N11 Nachunternehmer & Partner (N12 Disposition uses existing tables).

-- N10: kind of appointment (site visit, bidder questions, submission, opening, clarification talk) and the place.
alter table public.eigene_termine
  add column if not exists art text not null default 'sonstiges'
    check (art in ('besichtigung', 'bieterfragen', 'submission', 'eroeffnung', 'gespraech', 'sonstiges')),
  add column if not exists ort text not null default '' check (length(ort) <= 300),
  add column if not exists notiz text not null default '' check (length(notiz) <= 1000);

-- Questions to the contracting authority per tender: collected in the team, then asked in the portal, answer noted.
create table if not exists public.bieterfragen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null,
  vorgang_id uuid not null,
  frage text not null check (length(trim(frage)) between 3 and 2000),
  status text not null default 'offen' check (status in ('offen', 'gestellt', 'beantwortet')),
  gestellt_am date,
  antwort text not null default '' check (length(antwort) <= 4000),
  user_id uuid default auth.uid() references auth.users on delete set null,
  erstellt timestamptz not null default now(),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade
);
create index if not exists bieterfragen_vorgang on public.bieterfragen (vorgang_id, erstellt);
alter table public.bieterfragen enable row level security;
create policy lesen on public.bieterfragen for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = bieterfragen.firma_id and public.darf_bereich(v.firma_id, v.bereich_id)));
create policy verwalten on public.bieterfragen for all to authenticated
  using (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = bieterfragen.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id)))
  with check (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = bieterfragen.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id)));
revoke all on public.bieterfragen from anon;
grant select, insert, update, delete on public.bieterfragen to authenticated;

-- N11: the firm's own subcontractors and partner firms per trade (private, unlike the public partner profiles).
create table if not exists public.partner (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  name text not null check (length(trim(name)) between 2 and 200),
  gewerke text[] not null default '{}' check (cardinality(gewerke) <= 20),
  ansprechpartner text not null default '' check (length(ansprechpartner) <= 200),
  telefon text not null default '' check (length(telefon) <= 60),
  email text not null default '' check (length(email) <= 200),
  region text not null default '' check (length(region) <= 200),
  bewertung integer check (bewertung is null or bewertung between 1 and 5),
  notiz text not null default '' check (length(notiz) <= 1000),
  erstellt timestamptz not null default now()
);
create index if not exists partner_firma on public.partner (firma_id, name);
alter table public.partner enable row level security;
create policy lesen on public.partner for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.partner for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.partner from anon;
grant select, insert, update, delete on public.partner to authenticated;

-- Requests to partners per tender and lot, with status. The partner's price is finance data: own table below.
create table if not exists public.partner_anfragen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null,
  vorgang_id uuid not null,
  partner_id uuid not null references public.partner on delete cascade,
  los text not null default '' check (length(los) <= 200),
  status text not null default 'angefragt' check (status in ('angefragt', 'angebot', 'zugesagt', 'abgesagt')),
  notiz text not null default '' check (length(notiz) <= 1000),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  unique (firma_id, id),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade
);
create index if not exists partner_anfragen_vorgang on public.partner_anfragen (vorgang_id);
alter table public.partner_anfragen enable row level security;
create policy lesen on public.partner_anfragen for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = partner_anfragen.firma_id and public.darf_bereich(v.firma_id, v.bereich_id)));
create policy verwalten on public.partner_anfragen for all to authenticated
  using (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = partner_anfragen.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id)))
  with check (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = partner_anfragen.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id))
              and exists (select 1 from public.partner p where p.id = partner_id and p.firma_id = partner_anfragen.firma_id));
revoke all on public.partner_anfragen from anon;
grant select, insert, update, delete on public.partner_anfragen to authenticated;

-- The price a partner quoted: only with finance rights for the tender (like the calculation).
create table if not exists public.partner_preise (
  firma_id uuid not null,
  anfrage_id uuid not null,
  preis numeric(14, 2) not null check (preis >= 0),
  geaendert timestamptz not null default now(),
  primary key (firma_id, anfrage_id),
  foreign key (firma_id, anfrage_id) references public.partner_anfragen (firma_id, id) on delete cascade
);
alter table public.partner_preise enable row level security;
create policy lesen on public.partner_preise for select to authenticated using
  (exists (select 1 from public.partner_anfragen a join public.vorgaenge v on v.id = a.vorgang_id and v.firma_id = a.firma_id
           where a.id = anfrage_id and a.firma_id = partner_preise.firma_id and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id)));
create policy verwalten on public.partner_preise for all to authenticated
  using (exists (select 1 from public.partner_anfragen a join public.vorgaenge v on v.id = a.vorgang_id and v.firma_id = a.firma_id
           where a.id = anfrage_id and a.firma_id = partner_preise.firma_id and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id) and public.darf_bearbeiten(v.firma_id, v.bereich_id)))
  with check (exists (select 1 from public.partner_anfragen a join public.vorgaenge v on v.id = a.vorgang_id and v.firma_id = a.firma_id
           where a.id = anfrage_id and a.firma_id = partner_preise.firma_id and jarvis_intern.darf_finanzen(v.firma_id, v.bereich_id) and public.darf_bearbeiten(v.firma_id, v.bereich_id)));
revoke all on public.partner_preise from anon;
grant select, insert, update, delete on public.partner_preise to authenticated;

notify pgrst, 'reload schema';
