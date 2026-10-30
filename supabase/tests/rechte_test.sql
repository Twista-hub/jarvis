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
\ir ../migrations/20261030010000_firmen_freigabe.sql
\ir ../migrations/20261030200000_einrichtung.sql
\ir ../migrations/20261030210000_benachrichtigungen.sql
\ir ../migrations/20261030220000_push.sql
\ir ../migrations/20261030141331_mitarbeiter_freigaben_angebote.sql
\ir ../migrations/20261030230000_angebotsfreigabe_abgabe.sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'chef@perlease.test'),
  ('00000000-0000-0000-0000-00000000000b', 'berlin@perlease.test'),
  ('00000000-0000-0000-0000-00000000000c', 'fremd@andere.test');

insert into public.freigaben (email) values ('chef@perlease.test');

create function test_als(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pruefe(ok boolean, was text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FEHLER: %', was; end if; raise notice 'ok: %', was; end $$;

set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select public.firma_anlegen('Perlease GmbH') as firma \gset
select set_config('test.firma', :'firma', false);
insert into public.bereiche (firma_id, name) values (:'firma', 'Berlin') returning id as berlin \gset
insert into public.bereiche (firma_id, parent_id, name, art) values (:'firma', :'berlin', 'Berlin Messe', 'team') returning id as messe \gset
insert into public.bereiche (firma_id, name) values (:'firma', 'Hamburg') returning id as hamburg \gset
insert into public.vorgaenge (firma_id, bereich_id, titel) values (:'firma', :'messe', 'Messe-Catering ITB'), (:'firma', :'hamburg', 'Hotel Hamburg'), (:'firma', null, 'Bundesweit');
insert into public.einladungen (firma_id, email, rolle, bereich_ids, token_hash)
  values (:'firma', 'berlin@perlease.test', 'bearbeiter', array[:'berlin']::uuid[], encode(sha256(convert_to('geheim', 'UTF8')), 'hex'));
select pruefe(public.nutzer_zaehlen(:'firma') = 1, 'Inhaber zählt als 1 Nutzer');

-- Someone who signed up on their own cannot create a firm.
select test_als('00000000-0000-0000-0000-00000000000c');
do $$ begin perform public.firma_anlegen('Fremde GmbH'); raise exception 'FEHLER: Firma ohne Freigabe angelegt';
exception when others then if sqlerrm <> 'nicht freigeschaltet' then raise; end if; raise notice 'ok: ohne Freigabe keine Firma'; end $$;
select pruefe(not exists (select 1 from public.freigaben), 'Freigaben sind nicht lesbar');


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

-- Setup assistant: the owner saves one firm-wide search profile, the reader cannot change it.
insert into public.suchprofile (firma_id, name, beschreibung, einstellungen)
  values (:'firma', 'Perlease GmbH', 'Zeitarbeit', '{"leistungen": [{"name": "Service", "cpv": ["79620"], "woerter": ["servicepersonal"]}]}');
do $$ begin
  insert into public.suchprofile (firma_id, name) select firma_id, 'zweites' from public.suchprofile limit 1;
  raise exception 'FEHLER: zweites Firmen-Suchprofil angelegt';
exception when unique_violation then raise notice 'ok: ein Suchprofil pro Firma'; end $$;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) from public.suchprofile) = 1, 'Mitarbeiter sieht das Suchprofil');
update public.suchprofile set beschreibung = 'gehackt';
select pruefe((select beschreibung from public.suchprofile) = 'Zeitarbeit', 'Leser ändert das Suchprofil nicht');

-- Daily mail: everyone sets only their own hour.
insert into public.benachrichtigungen (firma_id, user_id, stunde) values (:'firma', '00000000-0000-0000-0000-00000000000b', 7);
do $$ begin
  insert into public.benachrichtigungen (firma_id, user_id, stunde) select firma_id, '00000000-0000-0000-0000-00000000000a', 9 from public.mitglieder limit 1;
  raise exception 'FEHLER: Mail-Zeit für jemand anderen gesetzt';
exception when insufficient_privilege then raise notice 'ok: nur die eigene Mail-Zeit'; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
do $$ begin
  insert into public.benachrichtigungen (firma_id, user_id, stunde) values (current_setting('test.firma')::uuid, auth.uid(), 7);
  raise exception 'FEHLER: Fremder bekommt Mails einer Firma';
exception when insufficient_privilege or foreign_key_violation then raise notice 'ok: Fremde bekommen keine Mails'; end $$;
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*) from public.benachrichtigungen) = 0, 'Inhaber sieht fremde Mail-Zeiten nicht');

-- Phone notifications: own devices and messages only, server keys hidden.
reset role;
insert into public.app_schluessel values ('vapid_public', 'OEFFENTLICH'), ('vapid_private', 'GEHEIM');
insert into public.push_nachrichten (user_id, titel) values ('00000000-0000-0000-0000-00000000000b', 'Für Berlin');
set role authenticated;
select pruefe(public.push_schluessel() = 'OEFFENTLICH', 'Öffentlicher Push-Schlüssel lesbar');
select pruefe(not exists (select 1 from public.app_schluessel), 'Server-Schlüssel nicht lesbar');
insert into public.push_abos (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'a');
select pruefe((select user_id from public.push_abos) = auth.uid(), 'Gerät gehört dem Anmelder');
select pruefe(not exists (select 1 from public.push_nachrichten), 'Fremde Push-Texte nicht lesbar');
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(not exists (select 1 from public.push_abos), 'Fremde Geräte nicht lesbar');
select pruefe((select count(*) from public.push_nachrichten) = 1, 'Eigene Push-Texte lesbar');
-- Selected snapshots never grant access to the original brief or financial rows.
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.kalkulationsvorlagen(firma_id,eingaben) values (:'firma','{"gewinn":30}');
select id as vorgang from public.vorgaenge where titel='Messe-Catering ITB' \gset
insert into public.vorgang_freigaben(firma_id,vorgang_id,empfaenger_id,titel,inhalte) values
  (:'firma',:'vorgang','00000000-0000-0000-0000-00000000000b','Einsatz ITB','{"leistungen":"Service am Messestand"}');
select public.mitglied_aktualisieren(:'firma','00000000-0000-0000-0000-00000000000b','Berlin Service','Serviceleiter/in','mitarbeiter',false,false,array[:'berlin']::uuid[]);
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select funktion from public.mitglieder where user_id=auth.uid())='Serviceleiter/in','Funktion unabhängig von Zugriff gespeichert');
select pruefe(not exists(select 1 from public.vorgaenge),'Eingeschränkte Mitarbeiter sehen keine Original-Steckbriefe');
select pruefe(not exists(select 1 from public.kalkulationsvorlagen),'Eingeschränkte Mitarbeiter sehen keine Finanzwerte');
select pruefe((select count(*) from public.vorgang_freigaben)=1,'Empfänger sieht nur ausgewählte Freigabe');
select pruefe((select inhalte from public.vorgang_freigaben)='{"leistungen":"Service am Messestand"}'::jsonb,'Freigabe enthält nur ausgewählte Texte');
update public.mitglieder set finanzen=true where user_id=auth.uid();
select pruefe(not (select finanzen from public.mitglieder where user_id=auth.uid()),'Mitarbeiter kann sich Finanzrechte nicht selbst geben');
do $$ begin
  perform public.mitglied_aktualisieren(current_setting('test.firma')::uuid,auth.uid(),'Ich','Chef','admin',true,true,'{}');
  raise exception 'FEHLER: Mitarbeiter durfte sich selbst hochstufen';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe(not exists(select 1 from public.vorgang_freigaben),'Fremde sehen auch mit Freigabe-ID nichts');
select test_als('00000000-0000-0000-0000-00000000000a');
select public.mitglied_aktualisieren(:'firma','00000000-0000-0000-0000-00000000000b','Berlin Service','Serviceleiter/in','bearbeiter',false,false,array[:'berlin']::uuid[]);
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(exists(select 1 from public.vorgaenge),'Vollständige Steckbriefe nach ausdrücklicher Rechteänderung sichtbar');
select pruefe(not exists(select 1 from public.kalkulationsvorlagen),'Bearbeiter ohne Finanzfreigabe sieht keine Kalkulation');
select test_als('00000000-0000-0000-0000-00000000000a');
select public.mitglied_aktualisieren(:'firma','00000000-0000-0000-0000-00000000000b','Berlin Service','Serviceleiter/in','bearbeiter',true,false,array[:'berlin']::uuid[]);
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(exists(select 1 from public.kalkulationsvorlagen),'Ausdrückliche Finanzfreigabe greift');
select test_als('00000000-0000-0000-0000-00000000000a');
delete from public.vorgang_freigaben;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(not exists(select 1 from public.vorgang_freigaben),'Widerruf wirkt sofort');

-- Every offer version waits for a manager; employees cannot approve it themselves.
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.angebotsmappen(firma_id,vorgang_id,text) values (:'firma',:'vorgang','Angebot 100 Euro') returning id as mappe \gset
select set_config('test.mappe', :'mappe', false);
select pruefe((select freigabe_status='wartet' from public.angebotsmappen where id=:'mappe'),'Angebot wartet auf Chef-Freigabe');
select test_als('00000000-0000-0000-0000-00000000000b');
do $$ begin
  update public.angebotsmappen set freigabe_status='genehmigt',freigabe_von=auth.uid(),freigabe_am=now() where id=current_setting('test.mappe')::uuid;
  raise exception 'FEHLER: Bearbeiter genehmigte eigenes Angebot';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; raise notice 'ok: nur Firmenleitung genehmigt'; end $$;
select test_als('00000000-0000-0000-0000-00000000000a');
update public.angebotsmappen set freigabe_status='genehmigt',freigabe_von=auth.uid(),freigabe_am=now() where id=:'mappe';
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.angebotsabgaben(firma_id,mappe_id,portal,dateiname,mime,groesse)
values (:'firma',:'mappe','Testportal','eingang.pdf','application/pdf',10);
select pruefe((select count(*)=1 from public.angebotsabgaben),'Freigegebenes Angebot samt Eingangsbeleg protokolliert');
\echo ALLE TESTS OK
