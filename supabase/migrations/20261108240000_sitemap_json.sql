-- Notice sitemap without the PostgREST row limit (08.11.2026).
-- Open German notices for the notice sitemap as one JSON array [[id, date], …] (a table result would be cut at the
-- PostgREST row limit of 1,000), newest first, at most 45,000.
create or replace function public.sitemap_ausschreibungen_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(x.id, x.datum) order by x.quell_datum desc), '[]'::jsonb) from (
    select v.id, v.quell_datum, v.quell_datum::date as datum from public.vergabekatalog v
    where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')
    order by v.quell_datum desc limit 45000) x
$$;
revoke all on function public.sitemap_ausschreibungen_json() from public;
grant execute on function public.sitemap_ausschreibungen_json() to anon, authenticated;

notify pgrst, 'reload schema';
