-- Award comparison: the parameter "cpv" was shadowed by the column vergabekatalog.cpv, so every award matched.
-- Parameters are now qualified with the function name. Malformed dates and implausible values are skipped.
create or replace function public.zuschlag_vergleich(f uuid, worte text[] default '{}', cpv text[] default '{}', ohne text default '')
returns table (id text, titel text, auftraggeber text, ort text, datum timestamptz, wert numeric, gewinner text, link text)
language sql stable security invoker set search_path = '' as $$
  with z as (
    select k.id, k.titel, k.auftraggeber, k.ort, k.link, k.cpv, k.titel || ' ' || k.beschreibung as text, a,
           case when a->>'datum' ~ '^\d{4}-\d{2}-\d{2}T' then (a->>'datum')::timestamptz end as datum
    from public.vergabekatalog k, jsonb_array_elements(k.zuschlaege) a
    where public.meine_rolle(zuschlag_vergleich.f) in ('inhaber','admin','bearbeiter','leser','standortleitung')
      and k.id <> zuschlag_vergleich.ohne
      and jsonb_typeof(a->'wert') = 'number' and (a->>'wert')::numeric between 1000 and 10000000000
      and coalesce(a->>'waehrung', 'EUR') in ('EUR', '')
  )
  select z.id, z.titel, z.auftraggeber, z.ort, z.datum, (z.a->>'wert')::numeric,
         coalesce((select string_agg(g, ', ') from jsonb_array_elements_text(z.a->'gewinner') g), ''), z.link
  from z
  where (cardinality(zuschlag_vergleich.cpv) > 0 and exists (select 1 from unnest(z.cpv) c, unnest(zuschlag_vergleich.cpv) q where left(c, 5) = left(q, 5)))
     or (cardinality(zuschlag_vergleich.worte) > 0 and to_tsvector('german', z.text) @@ to_tsquery('german',
          (select string_agg(quote_literal(w) || ':*', ' | ') from unnest(zuschlag_vergleich.worte[1:6]) w where w ~ '^[[:alpha:]äöüÄÖÜß]{4,40}$')))
  order by z.datum desc nulls last
  limit 12
$$;
