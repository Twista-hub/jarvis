-- Rechtsprüfung 03.11.2026, Datenschutz D1 and D4 (docs/recht/pruefung-2026-11.md):
-- * D1: readers (e.g. the tax adviser) keep what payroll needs (names, hours, absences without notes, expenses, wages,
--   time accounts) but no longer see qualifications and certificates, PSA, checklists, instruction records, ratings,
--   time-clock events, patrol scans, the guard book, driving-licence checks, signatures and temporary agency
--   assignments (Art. 5 Abs. 1 c DSGVO, § 26 BDSG). Restrictive policies are added on top of the existing ones.
-- * D4: patrol scans and guard book entries are visible to the office only for sites in their locations
--   (darf_bereich over site → customer → location), readers excluded.

do $$
declare t text;
begin
  foreach t in array array['personal_nachweise', 'psa_ausgaben', 'checklisten_punkte', 'unterweisung_teilnahmen', 'einsatz_bewertungen',
                           'stempel', 'rundgang_scans', 'wachbuch', 'fuehrerschein_kontrollen', 'unterschriften', 'ueberlassungen'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists kein_leser on public.%I', t);
      execute format('create policy kein_leser on public.%I as restrictive for select to authenticated using (public.meine_rolle(firma_id) is distinct from %L)', t, 'leser');
    end if;
  end loop;
end $$;

-- Site of a patrol point / guard book entry belongs to a customer, the customer to a location (bereich).
create or replace function jarvis_intern.darf_einsatzort(f uuid, o uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.einsatzorte e left join public.kunden k on k.id = e.kunde_id
                  where e.id = o and e.firma_id = f and public.darf_bereich(f, k.bereich_id))
$$;
revoke all on function jarvis_intern.darf_einsatzort(uuid, uuid) from public, anon;
grant execute on function jarvis_intern.darf_einsatzort(uuid, uuid) to authenticated;

drop policy if exists standort on public.rundgang_scans;
create policy standort on public.rundgang_scans as restrictive for select to authenticated using (
  public.meine_rolle(firma_id) = 'mitarbeiter'
  or jarvis_intern.darf_einsatzort(firma_id, (select kp.einsatzort_id from public.kontrollpunkte kp where kp.id = kontrollpunkt_id)));
drop policy if exists standort on public.wachbuch;
create policy standort on public.wachbuch as restrictive for select to authenticated using (
  public.meine_rolle(firma_id) = 'mitarbeiter' or jarvis_intern.darf_einsatzort(firma_id, einsatzort_id)
  or (einsatzort_id is null and public.darf_bereich(firma_id, null)));

notify pgrst, 'reload schema';
