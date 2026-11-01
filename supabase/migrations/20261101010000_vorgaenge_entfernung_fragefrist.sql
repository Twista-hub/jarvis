-- Distance from the nearest firm location (km, from postal code coordinates) for sorting hits, and the deadline for
-- bidder questions (OCDS tender.enquiryPeriod.endDate) for the deadline calendar. Both are written by the alarm.
alter table public.vorgaenge
  add column if not exists entfernung_km numeric(6,1) check (entfernung_km is null or entfernung_km >= 0),
  add column if not exists fragefrist timestamptz;
