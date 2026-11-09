-- Start page example (09.11.2026): service trades first, readable titles (no leading number, no abbreviations like "u" or "Anl").

create or replace function jarvis_intern.start_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'woche', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist is not null and v.quell_datum > now() - interval '7 days'),
    'offen', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')),
    'beispiel', (select jsonb_build_object('id', v.id, 'titel', left(v.titel, 140), 'ort', left(regexp_replace(regexp_replace(v.ort, '\s*\(Auftraggeberadresse; Einsatzort prüfen\)', ''), '\s*DE[0-9A-Z]{1,3}\y', '', 'g'), 60), 'frist', v.frist)
                 from public.vergabekatalog v
                 where v.quelle = 'bks' and v.status in ('offen', 'unbekannt') and v.frist > now() + interval '7 days' and v.quell_datum > now() - interval '10 days'
                   and length(v.titel) between 20 and 120 and v.titel !~ '^[0-9]' and v.titel !~* '(^|\s)(u|anl|zentr|ausf|lfg)(\s|\.|$)'
                   and exists (select 1 from unnest(v.cpv) c where c like any (array['90911%', '90919%', '90910%', '79710%', '79713%', '79714%', '79715%', '77310%', '77311%', '77313%', '77314%', '90620%', '90630%', '5552%', '5532%', '5551%', '7962%', '45442%', '45441%', '45410%', '4533%', '45311%', '45315%', '45421%', '45432%', '45431%']))
                 order by (case when exists (select 1 from unnest(v.cpv) c where c like any (array['90911%', '90919%', '90910%', '79710%', '79713%', '79714%', '79715%', '5552%', '7962%', '77310%', '90620%'])) then 0 else 1 end), v.quell_datum desc limit 1),
    'stand', now())
$$;

select jarvis_intern.sitemaps_aktualisieren();

notify pgrst, 'reload schema';
