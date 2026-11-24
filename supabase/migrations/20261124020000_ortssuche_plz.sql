-- Place search, second step (24.11.2026). The postal code search with a list of all candidates ("52" -> 1,100 codes,
-- migration 20261124010000) was right but slow on the real catalog: 3.7 s for "52". Now every notice is indexed under
-- the beginnings of its postal codes ("52428" -> 52, 524, 5242, 52428), so a prefix is one exact index lookup.
-- And a place name must start a word: "Heinsberg" no longer finds "Rheinsberg".
create or replace function jarvis_intern.plz_anfaenge(plz text[]) returns text[]
language sql immutable parallel safe as $$
  select coalesce(array_agg(distinct left(p, n)), '{}')
  from unnest(plz) p cross join generate_series(2, 5) n
  where p ~ '^[0-9]{4,5}$' and n <= length(p)
$$;
revoke all on function jarvis_intern.plz_anfaenge(text[]) from public, anon, authenticated;

create index if not exists vergabekatalog_plz_anfang on public.vergabekatalog using gin (jarvis_intern.plz_anfaenge(plz));
drop index if exists public.vergabekatalog_plz;
drop function if exists jarvis_intern.plz_kandidaten(text);
-- Statistics for the new index expression, so the planner knows how rare a postal code prefix is.
analyze public.vergabekatalog;

create or replace function jarvis_intern.katalog_suche_ids(suche text, gebiet text, nur_offen boolean, seit timestamptz, anzahl integer)
returns table (id text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s text := left(btrim(coalesce(suche, '')), 120);
  g text := left(btrim(coalesce(gebiet, '')), 60);
  -- Place name without the pattern characters of LIKE.
  name text;
  als_plz boolean;
  sql text := 'select i.id from public.vergabekatalog i where true';
begin
  als_plz := g ~ '^[0-9]{2,5}$';
  name := btrim(replace(replace(replace(g, '\', ''), '%', ''), '_', ''));
  if s <> '' then sql := sql || ' and to_tsvector(''german'', i.titel || '' '' || i.beschreibung) @@ websearch_to_tsquery(''german'', $1)'; end if;
  if als_plz then
    sql := sql || ' and jarvis_intern.plz_anfaenge(i.plz) @> array[$2]';
  elsif name <> '' then
    -- First condition: answered by the trigram index. Second: the name starts a word (after a space, hyphen, slash,
    -- bracket or comma), compared on the same text with these characters turned into spaces.
    sql := sql || ' and i.ort ilike $3 and ('' '' || translate(i.ort, ''-/(,;'', ''     '')) ilike $6';
  end if;
  if nur_offen then sql := sql || ' and i.status in (''offen'', ''unbekannt'') and (i.frist is null or i.frist > now())'; end if;
  if seit is not null then sql := sql || ' and i.quell_datum > $4'; end if;
  sql := sql || ' order by i.quell_datum desc, i.id limit $5';
  return query execute sql
    using s, g, '%' || name || '%', seit, least(greatest(coalesce(anzahl, 30), 1), 100), '% ' || translate(name, '-/(,;', '     ') || '%';
end $$;
revoke all on function jarvis_intern.katalog_suche_ids(text, text, boolean, timestamptz, integer) from public, anon, authenticated;
