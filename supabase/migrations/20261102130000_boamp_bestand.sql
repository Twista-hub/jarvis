-- French calls for tenders from the BOAMP open data (DILA, Licence Ouverte 2.0) for the live numbers of the public
-- French trade pages (/fr/appels-d-offres/<métier>). Only public notice facts, internal schema (not reachable through
-- the API); filled daily by alarm/boamp_bestand.py (workflow boamp-bestand.yml), kept 90 days. The numbers use the
-- same background cache as the German pages (jarvis_intern.gewerk_cache, keys "fr:<prefixes>").
create table if not exists jarvis_intern.boamp_avis (
  idweb text primary key check (length(idweb) <= 40),
  publication date not null,
  titel text not null check (length(titel) <= 1000),
  acheteur text not null default '' check (length(acheteur) <= 500),
  departements text[] not null default '{}',
  cpv text[] not null default '{}',
  limite timestamptz,
  link text not null check (link like 'https://%' and length(link) <= 500),
  abgerufen timestamptz not null default now()
);
create index if not exists boamp_avis_publication on jarvis_intern.boamp_avis (publication desc);
create index if not exists boamp_avis_cpv on jarvis_intern.boamp_avis using gin (cpv);
revoke all on jarvis_intern.boamp_avis from public, authenticated, anon;

create or replace function jarvis_intern.metier_berechnen(praefixe text[])
returns jsonb language sql stable set search_path = '' as $$
  with treffer as (
    select a.titel, a.acheteur, a.departements, a.limite, a.link, a.publication,
           a.limite is null or a.limite > now() as offen
    from jarvis_intern.boamp_avis a
    where a.publication > current_date - 30
      and exists (select 1 from unnest(a.cpv) c where c like any (select p || '%' from unnest(metier_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where offen),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select left(titel, 140) titel, left(acheteur, 100) auftraggeber,
               coalesce('Département ' || array_to_string(departements[1:3], ', '), '') ort, limite frist, link
        from treffer where offen order by publication desc, link limit 8) x), '[]'::jsonb),
    'stand', now())
$$;
revoke all on function jarvis_intern.metier_berechnen(text[]) from public, authenticated, anon;

-- One refresh for both countries.
create or replace function jarvis_intern.gewerk_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update jarvis_intern.gewerk_cache
     set daten = case when schluessel like 'fr:%' then jarvis_intern.metier_berechnen(praefixe) else jarvis_intern.gewerk_berechnen(praefixe) end,
         stand = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function jarvis_intern.gewerk_aktualisieren() from public, authenticated, anon;

create or replace function public.metier_statistik(praefixe text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  if cardinality(metier_statistik.praefixe) not between 1 and 12 or exists (select 1 from unnest(metier_statistik.praefixe) p where p !~ '^[0-9]{2,8}$') then
    return jsonb_build_object('monat', 0, 'offen', 0, 'beispiele', '[]'::jsonb);
  end if;
  select c.daten into d from jarvis_intern.gewerk_cache c where c.schluessel = 'fr:' || array_to_string(metier_statistik.praefixe, ',');
  return d;
end $$;
revoke all on function public.metier_statistik(text[]) from public;
grant execute on function public.metier_statistik(text[]) to anon, authenticated;

-- The ten French trades (same prefixes as web/src/gewerke-fr.ts, which checks this list in a test).
insert into jarvis_intern.gewerk_cache (schluessel, praefixe) values
  ('fr:9091,90919', array['9091','90919']),
  ('fr:7971', array['7971']),
  ('fr:7731,77211', array['7731','77211']),
  ('fr:4531', array['4531']),
  ('fr:4533', array['4533']),
  ('fr:45442,45441,45410,454211', array['45442','45441','45410','454211']),
  ('fr:45421', array['45421']),
  ('fr:45261,45422', array['45261','45422']),
  ('fr:45432,45431', array['45432','45431']),
  ('fr:7962', array['7962'])
on conflict do nothing;
