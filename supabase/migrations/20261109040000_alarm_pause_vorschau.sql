-- No daily paid AI search for two internal firms (Benjamin 09.11.2026): the demo example firm "Rheinland Facility
-- Service GmbH (Beispiel)" and "PerLease (Vorschau)". Marked like example firms (einstellungen.demo), so the daily alarm
-- skips them; a run started by hand for exactly this firm (alarm.yml input "firma") still works. Saves about 15 USD a month.
update public.suchprofile
   set einstellungen = coalesce(einstellungen, '{}'::jsonb) || '{"demo": true}'::jsonb
 where firma_id in ('c3401eb9-aa97-47a9-887d-2287c07363ff', '7e4a6c1e-5c2b-4f0a-9d3e-000000000001');
