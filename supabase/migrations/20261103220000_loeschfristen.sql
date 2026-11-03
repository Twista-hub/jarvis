-- Rechtsprüfung 03.11.2026, Datenschutz D7 (docs/recht/pruefung-2026-11.md): fixed deletion periods (Art. 5 Abs. 1 e,
-- Art. 17 DSGVO). Runs every night before the backup (.github/workflows/sicherung.yml), so backups do not keep expired
-- rows. Periods always count from the end of the calendar year and are at least as long as the legal minimum:
--   stempel, rundgang_scans   2 years   (§ 16 Abs. 2 ArbZG, § 17 MiLoG: at least two years)
--   einsatz_bewertungen       2 years   (only needed for current planning)
--   personal_abwesenheiten    3 years   (regular limitation period § 195 BGB, e.g. holiday claims)
--   wachbuch                  3 years   (§ 195 BGB, claims arising from incidents)
-- Time sheets, signatures, expenses, receipts and invoices fall under tax retention (§ 147 AO, § 41 EStG: 6–8 years)
-- and stay; the first of them only expire in 2032. Applicants are deleted by their own date (bewerber.loeschen_ab).
create or replace function jarvis_intern.loeschfristen(stichtag date default current_date)
returns table (tabelle text, geloescht bigint)
language plpgsql security definer set search_path = '' as $$
declare
  jahr date := date_trunc('year', stichtag)::date;
  n bigint;
begin
  delete from public.stempel where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'stempel'; geloescht := n; return next;
  delete from public.rundgang_scans where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'rundgang_scans'; geloescht := n; return next;
  delete from public.einsatz_bewertungen where datum < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'einsatz_bewertungen'; geloescht := n; return next;
  delete from public.personal_abwesenheiten where bis < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'personal_abwesenheiten'; geloescht := n; return next;
  delete from public.wachbuch where zeit < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'wachbuch'; geloescht := n; return next;
end $$;
revoke all on function jarvis_intern.loeschfristen(date) from public, anon, authenticated;
