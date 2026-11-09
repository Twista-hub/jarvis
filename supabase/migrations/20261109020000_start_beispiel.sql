-- Start page example tender (09.11.2026): the first filter (3 days, 10 trades) found none; now 10 days and all Crewtender trades.

create or replace function jarvis_intern.start_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'woche', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist is not null and v.quell_datum > now() - interval '7 days'),
    'offen', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')),
    'beispiel', (select jsonb_build_object('id', v.id, 'titel', left(v.titel, 140), 'ort', left(regexp_replace(regexp_replace(v.ort, '\s*\(Auftraggeberadresse; Einsatzort prüfen\)', ''), '\s*DE[0-9A-Z]{1,3}\y', '', 'g'), 60), 'frist', v.frist)
                 from public.vergabekatalog v
                 where v.quelle = 'bks' and v.status in ('offen', 'unbekannt') and v.frist > now() + interval '7 days' and v.quell_datum > now() - interval '10 days'
                   and length(v.titel) between 20 and 120
                   and exists (select 1 from unnest(v.cpv) c where c like any (array['90911%', '90919%', '90910%', '79710%', '79713%', '79714%', '79715%', '77310%', '77311%', '77313%', '77314%', '90620%', '90630%', '5552%', '5532%', '5551%', '7962%', '45442%', '45441%', '45410%', '4533%', '45311%', '45315%', '45421%', '45432%', '45431%']))
                 order by v.quell_datum desc limit 1),
    'stand', now())
$$;

select jarvis_intern.sitemaps_aktualisieren();

notify pgrst, 'reload schema';
