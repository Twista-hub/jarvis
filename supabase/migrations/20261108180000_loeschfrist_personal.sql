-- Rechtsprüfung A2: automatic deletion of staff who left once all retention periods are over (6 full calendar years after
-- leaving, § 41 EStG / § 147 AO for payroll records; the 2-year minimum of § 17 MiLoG is contained). Runs nightly in
-- jarvis_intern.loeschfristen before the backup; files are removed via jarvis_intern.r2_loeschen.
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
  -- A2: staff who left more than 6 full calendar years ago (payroll records, § 41 Abs. 1 EStG: 6 years) and have no
  -- newer time records, stamps or assignments are deleted with their records; their files go to the R2 deletion list.
  insert into jarvis_intern.r2_loeschen (schluessel, grund)
  select x.k, 'A2: Person nach Aufbewahrungsfrist gelöscht' from public.personal p
   cross join lateral (select 'personal-fotos/' || p.firma_id || '/' || p.id as k
                       union all select 'personal_nachweise/' || n.firma_id || '/' || n.personal_id || '/' || n.id from public.personal_nachweise n where n.personal_id = p.id and n.datei_name is not null) x
   where p.austritt_am < jahr - interval '6 years'
     and not exists (select 1 from public.stundenzettel s where s.personal_id = p.id and s.datum >= jahr - interval '6 years')
     and not exists (select 1 from public.stempel s where s.personal_id = p.id and s.zeit >= jahr - interval '6 years')
     and not exists (select 1 from public.ueberlassungen u where u.personal_id = p.id and coalesce(u.bis, current_date) >= jahr - interval '6 years')
  on conflict do nothing;
  delete from public.personal p
   where p.austritt_am < jahr - interval '6 years'
     and not exists (select 1 from public.stundenzettel s where s.personal_id = p.id and s.datum >= jahr - interval '6 years')
     and not exists (select 1 from public.stempel s where s.personal_id = p.id and s.zeit >= jahr - interval '6 years')
     and not exists (select 1 from public.ueberlassungen u where u.personal_id = p.id and coalesce(u.bis, current_date) >= jahr - interval '6 years');
  get diagnostics n = row_count; tabelle := 'personal (ausgeschieden, Frist abgelaufen)'; geloescht := n; return next;
  -- D5: customer portal links expire (default 12 months after creation or renewal).
  update public.kunden_portale set aktiv = false where aktiv and gueltig_bis < stichtag;
  get diagnostics n = row_count; tabelle := 'kunden_portale (abgelaufen)'; geloescht := n; return next;
end $$;
revoke all on function jarvis_intern.loeschfristen(date) from public, anon, authenticated;
