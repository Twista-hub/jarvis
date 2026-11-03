-- Rechtsprüfung 03.11.2026, Arbeitsrecht A2 / Datenschutz D6 (docs/recht/pruefung-2026-11.md): deleting a person used
-- to delete (cascade) the time sheets, time-clock events and temporary agency assignments that must be kept for two
-- years (§ 17 MiLoG, § 16 Abs. 2 ArbZG; AÜG documentation). A person with such records younger than two years can no
-- longer be deleted; the office enters the leaving date instead. Deleting the whole firm stays possible.
create or replace function jarvis_intern.personal_aufbewahrung() returns trigger
language plpgsql set search_path = '' as $$
declare frist date;
begin
  if pg_trigger_depth() >= 2 then return old; end if;  -- cascade from public.firmen (whole firm deleted)
  select greatest(
      (select max(datum) from public.stundenzettel where personal_id = old.id),
      (select max(zeit)::date from public.stempel where personal_id = old.id),
      (select max(coalesce(u.bis, current_date)) from public.ueberlassungen u where u.personal_id = old.id))
    into frist;
  if frist is not null and frist > current_date - interval '2 years' then
    raise exception 'Aufbewahrungspflicht: Stundenzettel, Stempelzeiten und Überlassungen dieser Person müssen bis % aufbewahrt werden (§ 17 MiLoG). Bitte stattdessen den Austritt eintragen.',
      to_char(frist + interval '2 years', 'DD.MM.YYYY') using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists personal_aufbewahrung on public.personal;
create trigger personal_aufbewahrung before delete on public.personal for each row execute function jarvis_intern.personal_aufbewahrung();
