-- Rechtsprüfung S16: the service description on invoices per customer (e.g. "Unterhaltsreinigung Objekt Hauptstraße"),
-- instead of the fixed "Leistungen <Monat> lt. Leistungsnachweis". The month is added by the app.
alter table public.kunden_preise add column if not exists leistungstext text not null default '' check (length(leistungstext) <= 200);
