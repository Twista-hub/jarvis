-- Rechtsprüfung S11: e-invoices (XRechnung / ZUGFeRD / Factur-X as XML) are stored as the receipt itself.
alter table public.belege drop constraint if exists belege_beleg_mime_check;
alter table public.belege add constraint belege_beleg_mime_check
  check (beleg_mime is null or beleg_mime in ('application/pdf', 'image/png', 'image/jpeg', 'application/xml'));
