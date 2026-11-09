-- Market overview (/konto/markt?ansicht=bedarf): the numbers are the same for every firm but scanned the whole catalogue
-- on each page view and ran into the 8-second limit (click check 09.11.2026: HTTP 500 after 8.4 s). They are now
-- computed with the sitemaps every 6 hours (workflow gewerk-zahlen.yml); the function only reads the cache. Without a
-- cache entry (fresh database) it computes on the spot as before.

alter table jarvis_intern.sitemap_cache drop constraint if exists sitemap_cache_name_check;
alter table jarvis_intern.sitemap_cache add constraint sitemap_cache_name_check check (name in ('auftraggeber', 'ausschreibungen', 'start', 'katalog'));

create or replace function jarvis_intern.katalog_statistik_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'gesamt', (select count(*) from public.vergabekatalog),
    'offen', (select count(*) from public.vergabekatalog where status in ('offen','unbekannt') and (frist is null or frist > now())),
    'unbekannte_frist', (select count(*) from public.vergabekatalog where status in ('offen','unbekannt') and frist is null),
    'berufe', (select coalesce(jsonb_agg(x), '[]') from (select b->>'name' as name, count(distinct k.id) as anzahl from public.vergabekatalog k cross join lateral jsonb_array_elements(k.bedarf) b where b->>'art' = 'beruf' and k.status in ('offen','unbekannt') and (k.frist is null or k.frist > now()) group by 1 order by 2 desc limit 20) x),
    'regionen', (select coalesce(jsonb_agg(x), '[]') from (select left(p, 2) as plz_praefix, count(distinct k.id) as anzahl from public.vergabekatalog k cross join lateral unnest(k.plz) p where p ~ '^[0-9]{5}$' and k.ort not like '%Auftraggeberadresse%' and k.status in ('offen','unbekannt') and (k.frist is null or k.frist > now()) group by 1 order by 2 desc limit 20) x),
    'prognosen', (select coalesce(jsonb_agg(x), '[]') from (select id, titel, auftraggeber, vertragsende, greatest(current_date, vertragsende - 90) as vorbereitung_ab from public.vergabekatalog where vertragsende > current_date and vertragsende < current_date + interval '18 months' order by vertragsende limit 20) x),
    'wiederkehrend', (select coalesce(jsonb_agg(x), '[]') from (select auftraggeber, regexp_replace(lower(titel), '[0-9]+', '', 'g') as titel, count(*) as anzahl, min(quell_datum) as zuerst, max(quell_datum) as zuletzt from public.vergabekatalog group by auftraggeber, regexp_replace(lower(titel), '[0-9]+', '', 'g') having count(*) >= 2 and max(quell_datum) - min(quell_datum) > interval '180 days' order by max(quell_datum) desc limit 15) x))
$$;
revoke all on function jarvis_intern.katalog_statistik_berechnen() from public, anon, authenticated;

create or replace function jarvis_intern.sitemaps_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  insert into jarvis_intern.sitemap_cache (name, daten, stand) values
    ('auftraggeber', jarvis_intern.sitemap_auftraggeber_berechnen(), now()),
    ('ausschreibungen', jarvis_intern.sitemap_ausschreibungen_berechnen(), now()),
    ('start', jarvis_intern.start_berechnen(), now()),
    ('katalog', jarvis_intern.katalog_statistik_berechnen(), now())
  on conflict (name) do update set daten = excluded.daten, stand = excluded.stand;
  return (select sum(jsonb_array_length(daten))::integer from jarvis_intern.sitemap_cache where jsonb_typeof(daten) = 'array');
end $$;
revoke all on function jarvis_intern.sitemaps_aktualisieren() from public, anon, authenticated;

-- Same signature and rights check as before (office roles of the firm only), now reading the cache.
create or replace function public.katalog_statistik(f uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d jsonb;
begin
  if public.meine_rolle(f) is null or public.meine_rolle(f) = 'mitarbeiter' then raise exception 'Nicht erlaubt'; end if;
  select c.daten into d from jarvis_intern.sitemap_cache c where c.name = 'katalog';
  return coalesce(d, jarvis_intern.katalog_statistik_berechnen());
end $$;
revoke all on function public.katalog_statistik(uuid) from public, anon;
grant execute on function public.katalog_statistik(uuid) to authenticated;

select jarvis_intern.sitemaps_aktualisieren();
notify pgrst, 'reload schema';
