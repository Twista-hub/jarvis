-- Idea 21 (docs/ideen-arbeitsoberflaeche.md): company receipts by photo for bookkeeping. Finance access only. The file is
-- stored in the firm's private bucket (belege/<firm>/<id>); the CSV export goes to the tax adviser (no tax advice in Jarvis).
create table if not exists public.belege (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  datum date not null,
  lieferant text not null default '' check (length(lieferant) <= 160),
  kategorie text not null default 'sonstiges' check (kategorie in ('material', 'fahrzeug', 'buero', 'miete', 'versicherung', 'telefon', 'reise', 'personal', 'sonstiges')),
  brutto numeric(12, 2) not null check (brutto > 0 and brutto <= 1000000),
  ust_satz numeric(4, 2) not null default 19 check (ust_satz in (0, 7, 19)),
  notiz text not null default '' check (length(notiz) <= 300),
  beleg_mime text check (beleg_mime is null or beleg_mime in ('application/pdf', 'image/png', 'image/jpeg')),
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create index if not exists belege_datum on public.belege (firma_id, datum desc);
alter table public.belege enable row level security;
create policy finanzen on public.belege for all to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
revoke all on public.belege from anon;
grant select, insert, delete on public.belege to authenticated;
revoke update on public.belege from authenticated;
