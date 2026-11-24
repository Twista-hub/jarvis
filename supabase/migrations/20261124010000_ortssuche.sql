-- Place search of the public search (/demo/suche) and of the search subscriptions (24.11.2026).
-- 1. A number ("52", "52428") is a postal code prefix and nothing else. Before, it was also looked for anywhere in the
--    place text, so "52" found "17252 Mirow" and every place in the NUTS region "DEA52".
-- 2. A place without many notices ("Düren", "Heinsberg", "Eschweiler") ran into the 3-second limit of anonymous
--    queries: every open notice was read to compare its place. Two indexes answer the place first.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create index if not exists vergabekatalog_ort_trgm on public.vergabekatalog using gin (ort extensions.gin_trgm_ops);
create index if not exists vergabekatalog_plz on public.vergabekatalog using gin (plz);

-- All postal codes with four or five digits that start with the given digits ("52" -> 5200 … 5299, 52000 … 52999).
create or replace function jarvis_intern.plz_kandidaten(anfang text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(anfang || lpad(n::text, l - length(anfang), '0')), '{}')
  from unnest(array[4, 5]) l cross join lateral generate_series(0, (10 ^ (l - length(anfang)))::int - 1) n
  where anfang ~ '^[0-9]{2,5}$' and l >= length(anfang)
$$;
revoke all on function jarvis_intern.plz_kandidaten(text) from public, anon, authenticated;

-- Ids of the newest matching notices. Built as one statement per kind of search and planned with the real values, so
-- the planner can choose the place index for a rare place and the date index for a frequent one.
create or replace function jarvis_intern.katalog_suche_ids(suche text, gebiet text, nur_offen boolean, seit timestamptz, anzahl integer)
returns table (id text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s text := left(btrim(coalesce(suche, '')), 120);
  g text := left(btrim(coalesce(gebiet, '')), 60);
  als_plz boolean;
  sql text := 'select i.id from public.vergabekatalog i where true';
begin
  als_plz := g ~ '^[0-9]{2,5}$';
  if s <> '' then sql := sql || ' and to_tsvector(''german'', i.titel || '' '' || i.beschreibung) @@ websearch_to_tsquery(''german'', $1)'; end if;
  if als_plz then sql := sql || ' and i.plz && $2';
  elsif g <> '' then sql := sql || ' and i.ort ilike $3'; end if;
  if nur_offen then sql := sql || ' and i.status in (''offen'', ''unbekannt'') and (i.frist is null or i.frist > now())'; end if;
  if seit is not null then sql := sql || ' and i.quell_datum > $4'; end if;
  sql := sql || ' order by i.quell_datum desc, i.id limit $5';
  return query execute sql
    using s, case when als_plz then jarvis_intern.plz_kandidaten(g) end, '%' || replace(replace(replace(g, '\', ''), '%', ''), '_', '') || '%', seit, least(greatest(coalesce(anzahl, 30), 1), 100);
end $$;
revoke all on function jarvis_intern.katalog_suche_ids(text, text, boolean, timestamptz, integer) from public, anon, authenticated;

-- Search: at most 30 hits, only the public columns. Empty search shows the newest open notices.
create or replace function public.demo_suche(suche text default '', gebiet text default '', zustand text default 'offen')
returns table (id text, titel text, auftraggeber text, ort text, frist timestamptz, link text, quell_datum timestamptz, status text, quelle text, steckbrief boolean)
language sql stable security definer set search_path = '' as $$
  select k.id, left(k.titel, 300), left(k.auftraggeber, 200), left(k.ort, 120), k.frist, k.link, k.quell_datum, k.status, k.quelle,
         exists (select 1 from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id)
  from jarvis_intern.katalog_suche_ids(suche, gebiet, coalesce(zustand, 'offen') <> 'alle', null, 30) t
  join public.vergabekatalog k on k.id = t.id
  order by k.quell_datum desc, k.id
$$;
revoke all on function public.demo_suche(text, text, text) from public;
grant execute on function public.demo_suche(text, text, text) to anon, authenticated;

-- New open notices for one subscription since a point in time: same matching as public.demo_suche, at most 15.
create or replace function jarvis_intern.such_abo_treffer(suche text, gebiet text, seit timestamptz)
returns table (id text, titel text, auftraggeber text, ort text, frist timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.id, left(k.titel, 300), left(k.auftraggeber, 200), left(k.ort, 120), k.frist
  from jarvis_intern.katalog_suche_ids(suche, gebiet, true, seit, 15) t
  join public.vergabekatalog k on k.id = t.id
  order by k.quell_datum desc, k.id
$$;
revoke all on function jarvis_intern.such_abo_treffer(text, text, timestamptz) from public, anon, authenticated;
notify pgrst, 'reload schema';
