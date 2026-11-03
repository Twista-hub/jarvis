-- Part-time leave (open item A-M3, 03.11.2026): the weekdays a person works (ISO 1 = Monday … 7 = Sunday).
-- null = Monday to Friday. Leave days are counted only on these weekdays, and the statutory minimum leave is
-- 4 days per weekly working day (§ 3 BUrlG: 24 working days on a 6-day week).
alter table public.personal add column if not exists arbeitstage smallint[]
  check (arbeitstage is null or (arbeitstage <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(arbeitstage) between 1 and 7));
notify pgrst, 'reload schema';
