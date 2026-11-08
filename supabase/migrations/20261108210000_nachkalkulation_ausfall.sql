-- Rechtsprüfung S27: post-calculation with paid downtime (leave, public holidays, sick pay) as a surcharge on wage costs;
-- default 20 % (about 44 paid days off on 206 productive days). The firm can change it.
alter table public.nachkalkulation_werte add column if not exists ausfall numeric(5, 2) not null default 20 check (ausfall between 0 and 100);
