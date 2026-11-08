-- Public authority pages keyed by name (08.11.2026): the live check showed that the buyer id from the notices is not
-- unique (the identifier in many German notices is generic, so hundreds of different authorities shared three ids).
-- The public page now groups German notices (bks) by a slug of the authority's name (/auftraggeber/stadt-koeln).
-- "Auftraggeber nicht angegeben" gets no page.

create or replace function jarvis_intern.ag_slug(n text) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(
           replace(replace(replace(replace(lower(coalesce(n, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
           '[^a-z0-9]+', '-', 'g'), '-'), 150), '')
$$;

create index if not exists vergabekatalog_bks_ag_slug on public.vergabekatalog (jarvis_intern.ag_slug(auftraggeber), quell_datum desc) where quelle = 'bks';

create or replace function public.auftraggeber_oeffentlich(a text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with alle as (
    select v.id, v.titel, v.auftraggeber, v.ort, v.frist, v.status, v.quell_datum, v.cpv, v.laufzeit_ende, v.zuschlaege
    from public.vergabekatalog v
    where v.quelle = 'bks' and jarvis_intern.ag_slug(v.auftraggeber) = left(auftraggeber_oeffentlich.a, 150)
      and auftraggeber_oeffentlich.a <> 'auftraggeber-nicht-angegeben' and v.quell_datum > now() - interval '3 years'
    order by v.quell_datum desc limit 400
  ), neu as (select * from alle order by quell_datum desc limit 1)
  select case when not exists (select 1 from alle) then null else jsonb_build_object(
    'id', left(auftraggeber_oeffentlich.a, 150),
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

create or replace function public.sitemap_auftraggeber_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(x.s, x.zuletzt) order by x.n desc, x.zuletzt desc), '[]'::jsonb) from (
    select jarvis_intern.ag_slug(v.auftraggeber) as s, max(v.quell_datum)::date as zuletzt, count(*) as n from public.vergabekatalog v
    where v.quelle = 'bks' and v.quell_datum > now() - interval '1 year'
    group by 1 having jarvis_intern.ag_slug(v.auftraggeber) is not null and jarvis_intern.ag_slug(v.auftraggeber) <> 'auftraggeber-nicht-angegeben'
    order by count(*) desc, max(v.quell_datum) desc limit 45000) x
$$;
revoke all on function public.sitemap_auftraggeber_json() from public;
grant execute on function public.sitemap_auftraggeber_json() to anon, authenticated;

-- The public notice names the slug of its authority page (German notices only).
create or replace function public.demo_eintrag(i text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', k.id, 'titel', left(k.titel, 300), 'auftraggeber', left(k.auftraggeber, 200), 'auftraggeber_id', k.auftraggeber_id,
    'auftraggeber_seite', case when k.quelle = 'bks' and jarvis_intern.ag_slug(k.auftraggeber) <> 'auftraggeber-nicht-angegeben' then jarvis_intern.ag_slug(k.auftraggeber) end,
    'ort', left(k.ort, 120), 'frist', k.frist,
    'link', k.link, 'status', k.status, 'quelle', k.quelle, 'quell_datum', k.quell_datum, 'beschreibung', left(k.beschreibung, 2500),
    'cpv', to_jsonb(k.cpv[1:6]),
    'lose', coalesce((select jsonb_agg(left(l->>'titel', 200)) from (select x as l from jsonb_array_elements(case when jsonb_typeof(k.lose) = 'array' then k.lose else '[]'::jsonb end) x limit 20) y), '[]'::jsonb),
    'steckbrief', (select d.markdown from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id))
  from public.vergabekatalog k where k.id = left(i, 400)
$$;
revoke all on function public.demo_eintrag(text) from public;
grant execute on function public.demo_eintrag(text) to anon, authenticated;

notify pgrst, 'reload schema';
