-- Public contracting-authority pages (08.11.2026): /auftraggeber/<id> shows what an authority currently tenders and has
-- tendered in the last year, from the public notices (CC0). No winners' names (sole traders can be natural persons),
-- no contact persons; awards only as count, date and value. Own sitemap /sitemap-auftraggeber.xml.

create or replace function public.auftraggeber_oeffentlich(a text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with alle as (
    select v.id, v.titel, v.auftraggeber, v.ort, v.frist, v.status, v.quell_datum, v.cpv, v.laufzeit_ende, v.zuschlaege
    from public.vergabekatalog v
    where v.auftraggeber_id = left(auftraggeber_oeffentlich.a, 200) and v.quell_datum > now() - interval '3 years'
    order by v.quell_datum desc limit 400
  ), neu as (select * from alle order by quell_datum desc limit 1)
  select case when not exists (select 1 from alle) then null else jsonb_build_object(
    'id', left(auftraggeber_oeffentlich.a, 200),
    'name', (select left(auftraggeber, 200) from neu),
    'ort', (select left(ort, 160) from neu),
    'offen_anzahl', (select count(*) from alle where frist > now() and status in ('offen', 'unbekannt')),
    'jahr', (select count(*) from alle where quell_datum > now() - interval '1 year'),
    'gesamt', (select count(*) from alle),
    'offen', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titel', left(x.titel, 200), 'frist', x.frist) order by x.frist)
                       from (select * from alle where frist > now() and status in ('offen', 'unbekannt') order by frist limit 30) x), '[]'::jsonb),
    'frueher', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titel', left(x.titel, 200), 'datum', x.quell_datum::date, 'status', x.status,
                           'laufzeit_ende', x.laufzeit_ende,
                           'zuschlag_wert', (select sum((z->>'wert')::numeric) from jsonb_array_elements(case when jsonb_typeof(x.zuschlaege) = 'array' then x.zuschlaege else '[]'::jsonb end) z
                                             where coalesce(z->>'waehrung', 'EUR') = 'EUR' and (z->>'wert') ~ '^[0-9]+(\.[0-9]+)?$'))
                         order by x.quell_datum desc)
                       from (select * from alle where not (frist > now() and status in ('offen', 'unbekannt')) order by quell_datum desc limit 25) x), '[]'::jsonb),
    'cpv', coalesce((select jsonb_agg(c) from (select c from alle, unnest(alle.cpv[1:2]) c group by c order by count(*) desc limit 12) y), '[]'::jsonb)
  ) end
$$;
revoke all on function public.auftraggeber_oeffentlich(text) from public;
grant execute on function public.auftraggeber_oeffentlich(text) to anon, authenticated;

-- Authorities of German notices from the last 12 months for the sitemap: [[id, last date], …], most active first.
create or replace function public.sitemap_auftraggeber_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(x.auftraggeber_id, x.zuletzt) order by x.n desc, x.zuletzt desc), '[]'::jsonb) from (
    select v.auftraggeber_id, max(v.quell_datum)::date as zuletzt, count(*) as n from public.vergabekatalog v
    where v.quelle = 'bks' and v.quell_datum > now() - interval '1 year'
    group by v.auftraggeber_id order by count(*) desc, max(v.quell_datum) desc limit 45000) x
$$;
revoke all on function public.sitemap_auftraggeber_json() from public;
grant execute on function public.sitemap_auftraggeber_json() to anon, authenticated;

-- The public notice now names its authority's id (link to the authority page).
create or replace function public.demo_eintrag(i text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', k.id, 'titel', left(k.titel, 300), 'auftraggeber', left(k.auftraggeber, 200), 'auftraggeber_id', k.auftraggeber_id, 'ort', left(k.ort, 120), 'frist', k.frist,
    'link', k.link, 'status', k.status, 'quelle', k.quelle, 'quell_datum', k.quell_datum, 'beschreibung', left(k.beschreibung, 2500),
    'cpv', to_jsonb(k.cpv[1:6]),
    'lose', coalesce((select jsonb_agg(left(l->>'titel', 200)) from (select x as l from jsonb_array_elements(case when jsonb_typeof(k.lose) = 'array' then k.lose else '[]'::jsonb end) x limit 20) y), '[]'::jsonb),
    'steckbrief', (select d.markdown from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id))
  from public.vergabekatalog k where k.id = left(i, 400)
$$;
revoke all on function public.demo_eintrag(text) from public;
grant execute on function public.demo_eintrag(text) to anon, authenticated;

notify pgrst, 'reload schema';
