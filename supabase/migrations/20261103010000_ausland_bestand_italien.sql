-- Italy joins the foreign trade pages (/it/gare-d-appalto): ANAC PVL calls for tenders (CC BY 4.0) in the same stock,
-- filled by alarm/ausland_bestand.py; numbers through the same background cache (keys "it:…").
alter table jarvis_intern.ausland_avis drop constraint if exists ausland_avis_land_check;
alter table jarvis_intern.ausland_avis add constraint ausland_avis_land_check check (land in ('pl', 'es', 'it'));

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
  return n;
end $$;
revoke all on function jarvis_intern.gewerk_aktualisieren() from public, authenticated, anon;

create or replace function public.land_statistik(land text, praefixe text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  if land_statistik.land not in ('pl', 'es', 'it') or cardinality(land_statistik.praefixe) not between 1 and 12
     or exists (select 1 from unnest(land_statistik.praefixe) p where p !~ '^[0-9]{2,8}$') then
    return jsonb_build_object('monat', 0, 'offen', 0, 'beispiele', '[]'::jsonb);
  end if;
  select c.daten into d from jarvis_intern.gewerk_cache c where c.schluessel = land_statistik.land || ':' || array_to_string(land_statistik.praefixe, ',');
  return d;
end $$;
revoke all on function public.land_statistik(text, text[]) from public;
grant execute on function public.land_statistik(text, text[]) to anon, authenticated;

insert into jarvis_intern.gewerk_cache (schluessel, praefixe)
select 'it:' || array_to_string(p, ','), p
from (values (array['9091','90919']), (array['7971']), (array['7731','77211']), (array['4531']), (array['4533']),
             (array['45442','45441','45410','454211']), (array['45421']), (array['45261','45422']), (array['45432','45431']), (array['7962'])) v(p)
on conflict do nothing;
