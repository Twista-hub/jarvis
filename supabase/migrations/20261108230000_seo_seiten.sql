-- Google pages (08.11.2026): trade × federal state pages (/ausschreibungen/<gewerk>/<land>) and one public page per open
-- notice (/ausschreibung/<id>) with its own sitemap. The state comes from the NUTS code in the catalogue location
-- (e.g. "DEA23" = Nordrhein-Westfalen, first letter after "DE" = state). Numbers are computed every 6 hours together with
-- the trade pages (workflow gewerk-zahlen.yml), the pages only read the cache.

create table if not exists jarvis_intern.gewerk_land_cache (
  schluessel text not null check (length(schluessel) <= 200),
  land text not null check (land ~ '^[1-9A-G]$'),
  daten jsonb not null,
  stand timestamptz not null default now(),
  primary key (schluessel, land)
);
revoke all on jarvis_intern.gewerk_land_cache from public, anon, authenticated;

-- NUTS level 1 of a location text ("… 47475 Kamp-Lintfort DEA1F" → 'A'), null without a German NUTS code.
create or replace function jarvis_intern.nuts_land(ort text) returns text
language sql immutable set search_path = '' as $$
  select substring(ort from '(?:^|[^0-9A-Za-z])DE([1-9A-G])[0-9A-Z]{0,3}(?![0-9A-Za-z])')
$$;

-- Trade numbers now also carry the catalogue id of each example (links to the public notice page).
create or replace function jarvis_intern.gewerk_berechnen(praefixe text[])
returns jsonb language sql stable set search_path = '' as $$
  with treffer as (
    select v.id, v.titel, v.auftraggeber, v.ort, v.frist, v.link, v.quell_datum
    from public.vergabekatalog v
    where v.quell_datum > now() - interval '30 days'
      and exists (select 1 from unnest(v.cpv) c where c like any (select p || '%' from unnest(gewerk_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where frist > now()),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select id, left(titel, 140) titel, left(auftraggeber, 100) auftraggeber, left(ort, 60) ort, frist, link
        from treffer where frist > now() order by quell_datum desc limit 8) x), '[]'::jsonb),
    'stand', now())
$$;

create or replace function jarvis_intern.gewerk_land_berechnen(praefixe text[])
returns table (land text, daten jsonb) language sql stable set search_path = '' as $$
  with treffer as (
    select v.id, v.titel, v.auftraggeber, v.ort, v.frist, v.quell_datum, jarvis_intern.nuts_land(v.ort) as land
    from public.vergabekatalog v
    where v.quell_datum > now() - interval '30 days'
      and exists (select 1 from unnest(v.cpv) c where c like any (select p || '%' from unnest(gewerk_land_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  ), nummeriert as (
    select t.*, row_number() over (partition by t.land order by t.quell_datum desc) as n from treffer t where t.land is not null and t.frist > now()
  )
  select t.land, jsonb_build_object(
    'monat', count(*), 'offen', count(*) filter (where t.frist > now()),
    'beispiele', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'titel', left(b.titel, 140), 'auftraggeber', left(b.auftraggeber, 100), 'ort', left(b.ort, 60), 'frist', b.frist) order by b.n)
                           from nummeriert b where b.land = t.land and b.n <= 10), '[]'::jsonb),
    'stand', now())
  from treffer t where t.land is not null group by t.land
$$;

create or replace function jarvis_intern.gewerk_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update jarvis_intern.gewerk_cache
     set daten = case when schluessel like 'fr:%' then jarvis_intern.metier_berechnen(praefixe)
                      when schluessel ~ '^(pl|es|it):' then jarvis_intern.land_berechnen(left(schluessel, 2), praefixe)
                      else jarvis_intern.gewerk_berechnen(praefixe) end,
         stand = now();
  get diagnostics n = row_count;
  -- German trade pages per federal state (keys without a country prefix).
  delete from jarvis_intern.gewerk_land_cache;
  insert into jarvis_intern.gewerk_land_cache (schluessel, land, daten)
  select c.schluessel, x.land, x.daten from jarvis_intern.gewerk_cache c cross join lateral jarvis_intern.gewerk_land_berechnen(c.praefixe) x
  where c.schluessel !~ '^[a-z]{2}:';
  return n;
end $$;
revoke all on function jarvis_intern.gewerk_aktualisieren() from public, authenticated, anon;

-- Numbers of one trade in one state for the public page (empty when there were none in the last 30 days).
create or replace function public.gewerk_land_statistik(praefixe text[], land text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.daten from jarvis_intern.gewerk_land_cache c
                   where c.schluessel = array_to_string(gewerk_land_statistik.praefixe, ',') and c.land = gewerk_land_statistik.land),
                  jsonb_build_object('monat', 0, 'offen', 0, 'beispiele', '[]'::jsonb))
  where gewerk_land_statistik.land ~ '^[1-9A-G]$'
$$;
revoke all on function public.gewerk_land_statistik(text[], text) from public;
grant execute on function public.gewerk_land_statistik(text[], text) to anon, authenticated;

-- Open German notices for the notice sitemap (newest first, at most 45,000).
create index if not exists vergabekatalog_bks_frist on public.vergabekatalog (frist) where quelle = 'bks';
create or replace function public.sitemap_ausschreibungen() returns table (id text, datum date)
language sql stable security definer set search_path = '' as $$
  select v.id, v.quell_datum::date from public.vergabekatalog v
  where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')
  order by v.quell_datum desc limit 45000
$$;
revoke all on function public.sitemap_ausschreibungen() from public;
grant execute on function public.sitemap_ausschreibungen() to anon, authenticated;

notify pgrst, 'reload schema';
