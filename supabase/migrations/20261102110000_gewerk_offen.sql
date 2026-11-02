-- "Still open" like everywhere else in the app: status open/unknown and no deadline passed (many notices in the
-- catalogue carry no deadline field). Examples come from these open tenders.
create or replace function jarvis_intern.gewerk_berechnen(praefixe text[])
returns jsonb language sql stable set search_path = '' as $$
  with treffer as (
    select v.titel, v.auftraggeber, v.ort, v.frist, v.link, v.quell_datum,
           v.status in ('offen', 'unbekannt') and (v.frist is null or v.frist > now()) as offen
    from public.vergabekatalog v
    where v.quell_datum > now() - interval '30 days'
      and exists (select 1 from unnest(v.cpv) c where c like any (select p || '%' from unnest(gewerk_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where offen),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select left(titel, 140) titel, left(auftraggeber, 100) auftraggeber, left(ort, 60) ort, frist, link
        from treffer where offen order by quell_datum desc limit 8) x), '[]'::jsonb),
    'stand', now())
$$;
