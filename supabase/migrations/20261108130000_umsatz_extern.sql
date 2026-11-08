-- Rechtsprüfung S13: the small-business watch counts turnover the firm made outside Crewtender too (entered per year,
-- {"2026": 1234.50}).
alter table public.firmenprofil add column if not exists umsatz_extern jsonb not null default '{}'
  check (jsonb_typeof(umsatz_extern) = 'object' and length(umsatz_extern::text) <= 400);
