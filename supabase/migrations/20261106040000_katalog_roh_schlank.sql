-- Platz sparen (Benjamin 06.11.2026: "pass auf die Limits auf"; Datenbank 342 MB, Katalog-Import pausiert ab 350 MB,
-- Gratis-Grenze 500 MB). Rohdaten abgeschlossener oder abgelaufener Bekanntmachungen werden auf das verkleinert, was die
-- App noch braucht: Kennungen, Auftraggeber (Name, Kennung, Anschrift, Kontaktstelle), Titel, Status, Wert, Fristen,
-- Vertragslaufzeiten (Neuausschreibungs-Radar), Lose (Kennung, Titel, Wert, Fristen, Laufzeit), Zuschläge und Verträge.
-- Weg fallen Beschreibung (steht in der Spalte beschreibung), Positionen (CPV in der Spalte cpv), Dokumente, Parteien.
-- Offene Bekanntmachungen bleiben vollständig (KI-Bewertung und Steckbrief brauchen sie). Ausgeführt vom Ablauf
-- "Katalog-Fristen" (modus schlank), nicht von dieser Migration.
create or replace function jarvis_intern.roh_schlank(r jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'ocid', r->'ocid', 'id', r->'id', 'date', r->'date', 'tag', r->'tag', '_schlank', true,
    'buyer', case when jsonb_typeof(r->'buyer') = 'object' then jsonb_strip_nulls(jsonb_build_object(
      'id', r#>'{buyer,id}', 'name', r#>'{buyer,name}', 'identifier', r#>'{buyer,identifier}', 'address', r#>'{buyer,address}',
      'contactPoint', r#>'{buyer,contactPoint}')) end,
    'tender', case when jsonb_typeof(r->'tender') = 'object' then jsonb_strip_nulls(jsonb_build_object(
      'id', r#>'{tender,id}', 'title', r#>'{tender,title}', 'status', r#>'{tender,status}', 'value', r#>'{tender,value}',
      'tenderPeriod', r#>'{tender,tenderPeriod}', 'enquiryPeriod', r#>'{tender,enquiryPeriod}', 'contractPeriod', r#>'{tender,contractPeriod}',
      'lots', case when jsonb_typeof(r#>'{tender,lots}') = 'array' then (
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', l->'id', 'title', l->'title', 'value', l->'value',
          'tenderPeriod', l->'tenderPeriod', 'contractPeriod', l->'contractPeriod', 'status', l->'status')))
        from jsonb_array_elements(r#>'{tender,lots}') l) end)) end,
    'awards', case when jsonb_typeof(r->'awards') = 'array' then (
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', a->'id', 'date', a->'date', 'status', a->'status', 'value', a->'value',
        'relatedLots', a->'relatedLots',
        'suppliers', case when jsonb_typeof(a->'suppliers') = 'array' then (
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s->'id', 'name', s->'name'))) from jsonb_array_elements(a->'suppliers') s) end)))
      from jsonb_array_elements(r->'awards') a) end,
    'contracts', case when jsonb_typeof(r->'contracts') = 'array' then (
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', c->'id', 'period', c->'period', 'value', c->'value', 'awardID', c->'awardID')))
      from jsonb_array_elements(r->'contracts') c) end))
$$;
revoke all on function jarvis_intern.roh_schlank(jsonb) from public, anon, authenticated;
