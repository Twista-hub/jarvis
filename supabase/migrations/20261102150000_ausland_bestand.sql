-- Polish and Spanish calls for tenders for the live numbers of the public trade pages (/pl/przetargi/<branża>,
-- /es/licitaciones/<oficio>). Only public notice facts, internal schema (not reachable through the API); filled daily
-- by alarm/ausland_bestand.py (workflow ausland-bestand.yml) from BZP (UZP, Poland) and the Catalan open data
-- (Generalitat de Catalunya), kept 90 days. Same background cache as the German and French pages (keys "pl:…", "es:…").
create table if not exists jarvis_intern.ausland_avis (
  land text not null check (land in ('pl', 'es')),
  id text not null check (length(id) <= 120),
  publication date not null,
  titel text not null check (length(titel) <= 1000),
  auftraggeber text not null default '' check (length(auftraggeber) <= 500),
  region text not null default '' check (length(region) <= 120),
  cpv text[] not null default '{}',
  frist timestamptz,
  link text not null check (link like 'https://%' and length(link) <= 500),
  abgerufen timestamptz not null default now(),
  primary key (land, id)
);
create index if not exists ausland_avis_publication on jarvis_intern.ausland_avis (land, publication desc);
create index if not exists ausland_avis_cpv on jarvis_intern.ausland_avis using gin (cpv);
revoke all on jarvis_intern.ausland_avis from public, authenticated, anon;

create or replace function jarvis_intern.land_berechnen(land text, praefixe text[])
returns jsonb language sql stable set search_path = '' as $$
  with treffer as (
    select a.titel, a.auftraggeber, a.region, a.frist, a.link, a.publication,
           a.frist is null or a.frist > now() as offen
    from jarvis_intern.ausland_avis a
    where a.land = land_berechnen.land and a.publication > current_date - 30
      and exists (select 1 from unnest(a.cpv) c where c like any (select p || '%' from unnest(land_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where offen),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select left(titel, 140) titel, left(auftraggeber, 100) auftraggeber, region ort, frist, link
        from treffer where offen order by publication desc, link limit 8) x), '[]'::jsonb),
    'stand', now())
$$;
revoke all on function jarvis_intern.land_berechnen(text, text[]) from public, authenticated, anon;

-- One refresh for all countries.
create or replace function jarvis_intern.gewerk_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update jarvis_intern.gewerk_cache
     set daten = case when schluessel like 'fr:%' then jarvis_intern.metier_berechnen(praefixe)
                      when schluessel ~ '^(pl|es):' then jarvis_intern.land_berechnen(left(schluessel, 2), praefixe)
                      else jarvis_intern.gewerk_berechnen(praefixe) end,
         stand = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function jarvis_intern.gewerk_aktualisieren() from public, authenticated, anon;

create or replace function public.land_statistik(land text, praefixe text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  if land_statistik.land not in ('pl', 'es') or cardinality(land_statistik.praefixe) not between 1 and 12
     or exists (select 1 from unnest(land_statistik.praefixe) p where p !~ '^[0-9]{2,8}$') then
    return jsonb_build_object('monat', 0, 'offen', 0, 'beispiele', '[]'::jsonb);
  end if;
  select c.daten into d from jarvis_intern.gewerk_cache c where c.schluessel = land_statistik.land || ':' || array_to_string(land_statistik.praefixe, ',');
  return d;
end $$;
revoke all on function public.land_statistik(text, text[]) from public;
grant execute on function public.land_statistik(text, text[]) to anon, authenticated;

-- The ten trades per country (same prefixes as web/src/gewerke-land.ts, which checks this list in a test).
insert into jarvis_intern.gewerk_cache (schluessel, praefixe)
select l || ':' || array_to_string(p, ','), p
from unnest(array['pl', 'es']) l,
     (values (array['9091','90919']), (array['7971']), (array['7731','77211']), (array['4531']), (array['4533']),
             (array['45442','45441','45410','454211']), (array['45421']), (array['45261','45422']), (array['45432','45431']), (array['7962'])) v(p)
on conflict do nothing;
