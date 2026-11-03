-- Ideas 3 and 22: DATEV exports. The firm enters its Berater-/Mandantennummer (from the tax adviser), chart of accounts,
-- start of the business year and the payroll office's wage types. Not secret; only admins change the firm profile.
alter table public.firmenprofil add column if not exists datev_berater text not null default '' check (datev_berater ~ '^(\d{4,7})?$');
alter table public.firmenprofil add column if not exists datev_mandant text not null default '' check (datev_mandant ~ '^(\d{1,5})?$');
alter table public.firmenprofil add column if not exists datev_skr text not null default '03' check (datev_skr in ('03', '04'));
alter table public.firmenprofil add column if not exists datev_wj_beginn smallint not null default 1 check (datev_wj_beginn between 1 and 12);
alter table public.firmenprofil add column if not exists lohnarten jsonb not null default '{}' check (jsonb_typeof(lohnarten) = 'object' and length(lohnarten::text) <= 500);

-- Tax adviser access: a free "Leser" with finance access may read invoices and receipts (not change them).
create policy steuerbuero_lesen on public.rechnungen for select to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) = 'leser');
create policy steuerbuero_lesen on public.belege for select to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) = 'leser');
