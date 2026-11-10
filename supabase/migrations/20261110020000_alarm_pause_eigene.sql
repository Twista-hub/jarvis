-- No daily paid AI search for Benjamin's own demo and test firms either (Benjamin 10.11.2026: "brauche ich nicht, kostet
-- nur Geld"; the API credit is for customers): "WP Digital Ranger", "Malerbetrieb Schlacheit" and the E2E test firm.
-- Same mark as 20261109040000 (einstellungen.demo): the daily alarm skips them; a run started by hand for exactly one
-- firm (alarm.yml input "firma") still works. With this no firm takes part in the daily AI search until a customer signs up.
update public.suchprofile
   set einstellungen = coalesce(einstellungen, '{}'::jsonb) || '{"demo": true}'::jsonb
 where firma_id in ('1a006cc4-eee6-4dcc-8b5f-32ab7432dc4c', '7548b874-b2ff-42a4-b05d-8971d447e4a9', '98cbccb7-06ad-49b2-a387-99f490877b3a');
