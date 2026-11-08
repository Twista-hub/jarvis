-- Rechtsprüfung S18 (cautious defaults until the tax adviser checks them):
-- * zahlart: receipts paid in cash are posted against the cash account instead of the creditor.
-- * reverse_charge: invoice of a supplier abroad without German VAT (e.g. software, advertising, § 13b UStG) – the receipt
--   carries 0 % and DATEV gets the § 13b key, so VAT owed and input VAT are booked.
-- * category arbeitskleidung (work clothes, protective equipment) instead of "Fremdleistung".
alter table public.belege add column if not exists zahlart text not null default 'unbar' check (zahlart in ('unbar', 'bar'));
alter table public.belege add column if not exists reverse_charge boolean not null default false;
alter table public.belege drop constraint if exists belege_reverse_charge_satz;
alter table public.belege add constraint belege_reverse_charge_satz check (not reverse_charge or (ust_satz = 0 and brutto_7 is null));
alter table public.belege drop constraint if exists belege_kategorie_check;
alter table public.belege add constraint belege_kategorie_check check (kategorie in ('material', 'fahrzeug', 'buero', 'miete', 'versicherung', 'telefon', 'reise', 'bewirtung', 'arbeitskleidung', 'personal', 'sonstiges'));
