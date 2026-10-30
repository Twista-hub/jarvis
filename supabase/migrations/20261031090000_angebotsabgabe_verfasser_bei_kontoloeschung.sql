-- Preserve the proof of a manual tender submission if its creator's account is deleted.
alter table public.angebotsabgaben alter column abgegeben_von drop not null;
alter table public.angebotsabgaben drop constraint if exists angebotsabgaben_abgegeben_von_fkey;
alter table public.angebotsabgaben
  add constraint angebotsabgaben_abgegeben_von_fkey
  foreign key (abgegeben_von) references auth.users(id) on delete set null;
