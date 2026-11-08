-- Rechtsprüfung S19: staff expenses with the tax-free flat rates instead of receipts only.
-- * Kilometergeld (own car on a business trip, § 9 Abs. 1 Satz 3 Nr. 4a EStG, tax-free under § 3 Nr. 16 EStG): 0.30 € per km.
-- * Verpflegungsmehraufwand (§ 9 Abs. 4a EStG): 14 € for more than 8 hours away or the day of arrival/departure of a trip
--   with overnight stay, 28 € for a full 24-hour day; reduced by 20 % of 28 € (5.60 €) for a breakfast and 40 % (11.20 €)
--   for each lunch or dinner provided by the employer. At most one flat rate per person and day.
-- The amount is computed by the app and checked here, so a hand-made request cannot claim more.
alter table public.spesen add column if not exists km numeric(6, 1) check (km is null or (km > 0 and km <= 5000));
alter table public.spesen add column if not exists vma text check (vma is null or vma in ('8h', 'an_ab', '24h'));
alter table public.spesen add column if not exists mahlzeiten smallint not null default 0 check (mahlzeiten between 0 and 7); -- 1 breakfast, 2 lunch, 4 dinner
alter table public.spesen drop constraint if exists spesen_art_check;
alter table public.spesen add constraint spesen_art_check check (art in ('tanken', 'parken', 'material', 'verpflegung', 'fahrkarte', 'sonstiges', 'km', 'vma'));
alter table public.spesen drop constraint if exists spesen_km_betrag;
alter table public.spesen add constraint spesen_km_betrag check ((art = 'km') = (km is not null) and (art <> 'km' or betrag = round(km * 0.30, 2)));
alter table public.spesen drop constraint if exists spesen_vma_betrag;
alter table public.spesen add constraint spesen_vma_betrag check ((art = 'vma') = (vma is not null) and (art <> 'vma' or betrag =
  (case vma when '24h' then 28 else 14 end) - (case when mahlzeiten & 1 > 0 then 5.60 else 0 end)
  - (case when mahlzeiten & 2 > 0 then 11.20 else 0 end) - (case when mahlzeiten & 4 > 0 then 11.20 else 0 end)));
create unique index if not exists spesen_vma_tag on public.spesen (personal_id, datum) where art = 'vma' and status <> 'abgelehnt';
