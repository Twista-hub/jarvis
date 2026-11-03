-- Small fixes to the live demo firm without recreating it (beispielfirma.yml, aktion=pflegen). Idempotent.
-- 03.11.2026 (Benjamin): the short-notice absence carried a health note ("Kind krank"); replaced by a neutral note.
update public.personal_abwesenheiten a set notiz = 'Kurzfristig verhindert'
  from public.firmen f
 where f.id = a.firma_id and f.name = 'Rheinland Facility Service GmbH (Beispiel)' and a.notiz = 'Kind krank';
select 'Abwesenheitsnotizen korrigiert: ' || count(*) from public.personal_abwesenheiten a join public.firmen f on f.id = a.firma_id
 where f.name = 'Rheinland Facility Service GmbH (Beispiel)' and a.kurzfristig and a.notiz = 'Kurzfristig verhindert';
