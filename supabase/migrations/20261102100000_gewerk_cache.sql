-- Trade page numbers are computed in the background (every 6 hours, workflow gewerk-zahlen.yml): computing them
-- on page view took longer than the 3 seconds a request without login may take. The page reads the cached result.
create index if not exists vergabekatalog_quell_datum on public.vergabekatalog (quell_datum desc);

create table if not exists jarvis_intern.gewerk_cache (
  schluessel text primary key check (length(schluessel) <= 200),
  praefixe text[] not null,
  daten jsonb,
  stand timestamptz
);
revoke all on jarvis_intern.gewerk_cache from public, authenticated, anon;

create or replace function jarvis_intern.gewerk_berechnen(praefixe text[])
returns jsonb language sql stable set search_path = '' as $$
  with treffer as (
    select v.titel, v.auftraggeber, v.ort, v.frist, v.link, v.quell_datum
    from public.vergabekatalog v
    where v.quell_datum > now() - interval '30 days'
      and exists (select 1 from unnest(v.cpv) c where c like any (select p || '%' from unnest(gewerk_berechnen.praefixe) p where p ~ '^[0-9]{2,8}$'))
  )
  select jsonb_build_object(
    'monat', (select count(*) from treffer),
    'offen', (select count(*) from treffer where frist > now()),
    'beispiele', coalesce((select jsonb_agg(x) from (
        select left(titel, 140) titel, left(auftraggeber, 100) auftraggeber, left(ort, 60) ort, frist, link
        from treffer where frist > now() order by quell_datum desc limit 8) x), '[]'::jsonb),
    'stand', now())
$$;

drop function if exists public.gewerk_statistik(text[]);
create or replace function public.gewerk_statistik(praefixe text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k text; d jsonb;
begin
  if cardinality(gewerk_statistik.praefixe) not between 1 and 12 or exists (select 1 from unnest(gewerk_statistik.praefixe) p where p !~ '^[0-9]{2,8}$') then
    return jsonb_build_object('monat', 0, 'offen', 0, 'beispiele', '[]'::jsonb);
  end if;
  k := array_to_string(gewerk_statistik.praefixe, ',');
  select c.daten into d from jarvis_intern.gewerk_cache c where c.schluessel = k;
  if not found and (select count(*) from jarvis_intern.gewerk_cache) < 100 then
    insert into jarvis_intern.gewerk_cache (schluessel, praefixe) values (k, gewerk_statistik.praefixe) on conflict do nothing;
  end if;
  return d;
end $$;
revoke all on function public.gewerk_statistik(text[]) from public;
grant execute on function public.gewerk_statistik(text[]) to anon, authenticated;

create or replace function jarvis_intern.gewerk_aktualisieren() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update jarvis_intern.gewerk_cache set daten = jarvis_intern.gewerk_berechnen(praefixe), stand = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function jarvis_intern.gewerk_aktualisieren() from public, authenticated, anon;

insert into jarvis_intern.gewerk_cache (schluessel, praefixe) values
  ('45311,45315,45317,45310', array['45311','45315','45317','45310']),
  ('4533', array['4533']),
  ('45421', array['45421']),
  ('90911,90919,90910', array['90911','90919','90910']),
  ('45442,45441,45410,45324', array['45442','45441','45410','45324']),
  ('45261,45422', array['45261','45422']),
  ('77310,77311,77313,77314,90620,90630', array['77310','77311','77313','77314','90620','90630']),
  ('79710,79713,79714,79715', array['79710','79713','79714','79715']),
  ('45432,45431', array['45432','45431']),
  ('79620,79621,79622,79624,79625', array['79620','79621','79622','79624','79625'])
on conflict do nothing;
