-- Precomputed sitemaps (08.11.2026): building the authority sitemap groups ~38,000 notices and took about 3 seconds,
-- the statement limit for anonymous requests, so every second cold request answered 503. Both large sitemaps are now
-- computed in the background (workflow gewerk-zahlen.yml, every 6 hours) and the public functions read the result.

create table if not exists jarvis_intern.sitemap_cache (
  name text primary key check (name in ('auftraggeber', 'ausschreibungen')),
  daten jsonb not null,
  stand timestamptz not null default now()
);
revoke all on jarvis_intern.sitemap_cache from public, anon, authenticated;

create or replace function jarvis_intern.sitemap_auftraggeber_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(x.s, x.zuletzt) order by x.n desc, x.zuletzt desc), '[]'::jsonb) from (
    select jarvis_intern.ag_slug(v.auftraggeber) as s, max(v.quell_datum)::date as zuletzt, count(*) as n from public.vergabekatalog v
    where v.quelle = 'bks' and v.quell_datum > now() - interval '1 year'
    group by 1 having jarvis_intern.ag_slug(v.auftraggeber) is not null and jarvis_intern.ag_slug(v.auftraggeber) <> 'auftraggeber-nicht-angegeben'
    order by count(*) desc, max(v.quell_datum) desc limit 45000) x
$$;

create or replace function jarvis_intern.sitemap_ausschreibungen_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(x.id, x.datum) order by x.quell_datum desc), '[]'::jsonb) from (
    select v.id, v.quell_datum, v.quell_datum::date as datum from public.vergabekatalog v
    where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')
    order by v.quell_datum desc limit 45000) x
$$;

create or replace function jarvis_intern.sitemaps_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  insert into jarvis_intern.sitemap_cache (name, daten, stand) values
    ('auftraggeber', jarvis_intern.sitemap_auftraggeber_berechnen(), now()),
    ('ausschreibungen', jarvis_intern.sitemap_ausschreibungen_berechnen(), now())
  on conflict (name) do update set daten = excluded.daten, stand = excluded.stand;
  return (select sum(jsonb_array_length(daten))::integer from jarvis_intern.sitemap_cache);
end $$;
revoke all on function jarvis_intern.sitemaps_aktualisieren() from public, anon, authenticated;

-- Public: the cached list; only without a cache entry (fresh database) computed on the spot.
create or replace function public.sitemap_auftraggeber_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.daten from jarvis_intern.sitemap_cache c where c.name = 'auftraggeber'), jarvis_intern.sitemap_auftraggeber_berechnen())
$$;
revoke all on function public.sitemap_auftraggeber_json() from public;
grant execute on function public.sitemap_auftraggeber_json() to anon, authenticated;

create or replace function public.sitemap_ausschreibungen_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.daten from jarvis_intern.sitemap_cache c where c.name = 'ausschreibungen'), jarvis_intern.sitemap_ausschreibungen_berechnen())
$$;
revoke all on function public.sitemap_ausschreibungen_json() from public;
grant execute on function public.sitemap_ausschreibungen_json() to anon, authenticated;

select jarvis_intern.sitemaps_aktualisieren();

notify pgrst, 'reload schema';
