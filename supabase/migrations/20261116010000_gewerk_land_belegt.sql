-- Sitemap of the pages (/sitemap-seiten.xml): which trade pages per federal state have notices in the last 30 days.
-- Pages without any carry "noindex" (thin page); Google reported them on 16.11.2026 as "in the sitemap but excluded by
-- noindex". The sitemap now lists only the pages that may be indexed. Returns pairs [trade key, state code].
create or replace function public.gewerk_land_belegt() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(c.schluessel, c.land)), '[]'::jsonb)
  from jarvis_intern.gewerk_land_cache c
  where coalesce((c.daten->>'monat')::integer, 0) > 0
$$;
revoke all on function public.gewerk_land_belegt() from public;
grant execute on function public.gewerk_land_belegt() to anon, authenticated;
