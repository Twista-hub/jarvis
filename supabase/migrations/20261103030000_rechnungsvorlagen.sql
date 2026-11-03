-- Idea 19 (docs/ideen-arbeitsoberflaeche.md): recurring invoices. A template per customer with a fixed monthly amount;
-- "Rechnungen für <Monat> erstellen" turns all active templates into numbered drafts once per month. Nothing is sent.
create table if not exists public.rechnungsvorlagen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid not null references public.kunden on delete cascade,
  text text not null check (length(trim(text)) between 2 and 200),
  betrag numeric(12, 2) not null check (betrag > 0 and betrag <= 1000000),
  aktiv boolean not null default true,
  letzter_monat text check (letzter_monat is null or letzter_monat ~ '^\d{4}-\d{2}$'),
  erstellt timestamptz not null default now()
);
alter table public.rechnungsvorlagen enable row level security;
create policy finanzen on public.rechnungsvorlagen for all to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
revoke all on public.rechnungsvorlagen from anon;
grant select, insert, update, delete on public.rechnungsvorlagen to authenticated;
