-- Public trade pages (/ausschreibungen/<gewerk>): live counts and recent examples from the tender catalogue.
-- Only public notice data (Bekanntmachungsservice, CC0); no firm or customer data. Callable without login.
create or replace function public.gewerk_statistik(praefixe text[])
returns jsonb language sql stable security definer set search_path = '' as $$
  with treffer as (
    select v.titel, v.auftraggeber, v.ort, v.frist, v.link, v.quell_datum
    from public.vergabekatalog v
    where v.quell_datum > now() - interval '30 days'
      and exists (select 1 from unnest(v.cpv) c where c like any (select p || '%' from unnest(gewerk_statistik.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where frist > now()),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select left(titel, 140) titel, left(auftraggeber, 100) auftraggeber, left(ort, 60) ort, frist, link
        from treffer where frist > now() order by quell_datum desc limit 8) x), '[]'::jsonb),
    'stand', now())
  where cardinality(gewerk_statistik.praefixe) between 1 and 12
$$;
revoke all on function public.gewerk_statistik(text[]) from public;
grant execute on function public.gewerk_statistik(text[]) to anon, authenticated;
