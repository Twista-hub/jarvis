-- Live numbers for the start page (09.11.2026): new German calls for tender in the last 7 days, open ones today and one
-- current example from a service trade. Computed with the sitemaps every 6 hours (workflow gewerk-zahlen.yml), the page
-- only reads the cache.

alter table jarvis_intern.sitemap_cache drop constraint if exists sitemap_cache_name_check;
alter table jarvis_intern.sitemap_cache add constraint sitemap_cache_name_check check (name in ('auftraggeber', 'ausschreibungen', 'start'));

create or replace function jarvis_intern.start_berechnen() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'woche', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist is not null and v.quell_datum > now() - interval '7 days'),
    'offen', (select count(*) from public.vergabekatalog v where v.quelle = 'bks' and v.frist > now() and v.status in ('offen', 'unbekannt')),
    'beispiel', (select jsonb_build_object('id', v.id, 'titel', left(v.titel, 140), 'ort', left(regexp_replace(regexp_replace(v.ort, '\s*\(Auftraggeberadresse; Einsatzort prüfen\)', ''), '\s*DE[0-9A-Z]{1,3}\y', '', 'g'), 60), 'frist', v.frist)
                 from public.vergabekatalog v
                 where v.quelle = 'bks' and v.status in ('offen', 'unbekannt') and v.frist > now() + interval '10 days' and v.quell_datum > now() - interval '3 days'
                   and length(v.titel) between 25 and 110
                   and exists (select 1 from unnest(v.cpv) c where c like any (array['90911%', '90919%', '90910%', '79710%', '79713%', '79714%', '77310%', '77311%', '90620%', '5552%']))
                 order by v.quell_datum desc limit 1),
    'stand', now())
$$;

create or replace function jarvis_intern.sitemaps_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  insert into jarvis_intern.sitemap_cache (name, daten, stand) values
    ('auftraggeber', jarvis_intern.sitemap_auftraggeber_berechnen(), now()),
    ('ausschreibungen', jarvis_intern.sitemap_ausschreibungen_berechnen(), now()),
    ('start', jarvis_intern.start_berechnen(), now())
  on conflict (name) do update set daten = excluded.daten, stand = excluded.stand;
  return (select sum(jsonb_array_length(daten))::integer from jarvis_intern.sitemap_cache where jsonb_typeof(daten) = 'array');
end $$;
revoke all on function jarvis_intern.sitemaps_aktualisieren() from public, anon, authenticated;

create or replace function public.start_zahlen() returns jsonb
language sql stable security definer set search_path = '' as $$
  select c.daten from jarvis_intern.sitemap_cache c where c.name = 'start'
$$;
revoke all on function public.start_zahlen() from public;
grant execute on function public.start_zahlen() to anon, authenticated;

select jarvis_intern.sitemaps_aktualisieren();

notify pgrst, 'reload schema';
