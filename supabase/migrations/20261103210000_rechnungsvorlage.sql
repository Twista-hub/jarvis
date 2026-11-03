-- Rechnungsvorlage (Benjamin 03.11.2026): opening and closing text on invoices; logo and footer come from the firm profile.
alter table public.firmenprofil add column if not exists rechnung_einleitung text not null default '' check (length(rechnung_einleitung) <= 1000);
alter table public.firmenprofil add column if not exists rechnung_schluss text not null default '' check (length(rechnung_schluss) <= 1000);
notify pgrst, 'reload schema';
