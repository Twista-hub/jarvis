-- Local test of the firm/area/role rules. Run against an empty Postgres (see supabase/tests/README):
-- creates a minimal stand-in for Supabase's auth schema, applies the migrations and checks who sees what.
\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;
\ir ../migrations/20261029120000_firmen_und_rechte.sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'chef@perlease.test'),
  ('00000000-0000-0000-0000-00000000000b', 'berlin@perlease.test'),
  ('00000000-0000-0000-0000-00000000000c', 'fremd@andere.test');

create function test_als(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pruefe(ok boolean, was text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FEHLER: %', was; end if; raise notice 'ok: %', was; end $$;

set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select public.firma_anlegen('Perlease GmbH') as firma \gset
insert into public.bereiche (firma_id, name) values (:'firma', 'Berlin') returning id as berlin \gset
insert into public.bereiche (firma_id, parent_id, name, art) values (:'firma', :'berlin', 'Berlin Messe', 'team') returning id as messe \gset
insert into public.bereiche (firma_id, name) values (:'firma', 'Hamburg') returning id as hamburg \gset
insert into public.vorgaenge (firma_id, bereich_id, titel) values (:'firma', :'messe', 'Messe-Catering ITB'), (:'firma', :'hamburg', 'Hotel Hamburg'), (:'firma', null, 'Bundesweit');
insert into public.einladungen (firma_id, email, rolle, bereich_ids, token_hash)
  values (:'firma', 'berlin@perlease.test', 'bearbeiter', array[:'berlin']::uuid[], encode(sha256(convert_to('geheim', 'UTF8')), 'hex'));
select pruefe(public.nutzer_zaehlen(:'firma') = 1, 'Inhaber zählt als 1 Nutzer');

-- Berlin employee accepts the invitation and sees Berlin (incl. sub-team) and firm-wide items, not Hamburg.
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(public.einladung_annehmen('geheim') = :'firma', 'Einladung angenommen');
select pruefe((select count(*) from public.vorgaenge) = 2, 'Berlin sieht 2 Vorgänge');
select pruefe(not exists (select 1 from public.vorgaenge where titel = 'Hotel Hamburg'), 'Berlin sieht Hamburg nicht');
update public.vorgaenge set status = 'pruefen' where titel = 'Messe-Catering ITB';
select pruefe((select status from public.vorgaenge where titel = 'Messe-Catering ITB') = 'pruefen', 'Bearbeiter ändert Status');
select pruefe((select count(*) from public.einladungen) = 0, 'Bearbeiter sieht keine Einladungen');
do $$ begin
  insert into public.bereiche (firma_id, name) select firma_id, 'Heimlich' from public.mitglieder limit 1;
  raise exception 'FEHLER: Bearbeiter durfte Bereich anlegen';
exception when insufficient_privilege then raise notice 'ok: Bearbeiter darf keine Bereiche anlegen'; end $$;
do $$ begin
  update public.mitglieder set rolle = 'inhaber' where user_id = auth.uid();
  if exists (select 1 from public.mitglieder where user_id = auth.uid() and rolle = 'inhaber') then
    raise exception 'FEHLER: Bearbeiter hat sich selbst zum Inhaber gemacht'; end if;
  raise notice 'ok: Bearbeiter kann sich nicht hochstufen';
end $$;

-- Outsider sees nothing.
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) from public.vorgaenge) = 0 and (select count(*) from public.firmen) = 0, 'Fremde sehen nichts');
do $$ begin
  perform public.einladung_annehmen('geheim');
  raise exception 'FEHLER: Einladung zweimal nutzbar';
exception when raise_exception then
  if sqlerrm like 'FEHLER%' then raise; end if;
  raise notice 'ok: Einladung nur einmal und nur für die eingeladene Adresse';
end $$;

-- Owner: seats, admin promotion, cannot remove the last owner.
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe(public.nutzer_zaehlen(:'firma') = 2, 'Inhaber + Bearbeiter = 2 Nutzer');
update public.mitglieder set rolle = 'leser' where user_id = '00000000-0000-0000-0000-00000000000b';
select pruefe(public.nutzer_zaehlen(:'firma') = 1, 'Leser sind kostenlos');
select pruefe((select count(*) from public.vorgaenge) = 3, 'Inhaber sieht alles');
do $$ begin
  update public.mitglieder set rolle = 'admin' where user_id = '00000000-0000-0000-0000-00000000000a';
  raise exception 'FEHLER: letzter Inhaber entfernt';
exception when raise_exception then
  if sqlerrm like 'FEHLER%' then raise; end if;
  raise notice 'ok: letzter Inhaber bleibt';
end $$;
select pruefe((select count(*) from public.protokoll) = 2, 'Protokoll hat 2 Einträge');
\echo ALLE TESTS OK
