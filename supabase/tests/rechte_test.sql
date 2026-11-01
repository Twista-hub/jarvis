-- Local test of the firm/area/role rules. Run against an empty Postgres (see supabase/tests/README):
-- creates a minimal stand-in for Supabase's auth schema, applies the migrations and checks who sees what.
\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('test.uid', true), ''), nullif(current_setting('request.jwt.claim.sub', true), ''))::uuid $$;
grant usage on schema auth to authenticated;
\ir ../migrations/20261029120000_firmen_und_rechte.sql
\ir ../migrations/20261030010000_firmen_freigabe.sql
\ir ../migrations/20261030200000_einrichtung.sql
\ir ../migrations/20261030210000_benachrichtigungen.sql
\ir ../migrations/20261030220000_push.sql
\ir ../migrations/20261030141331_mitarbeiter_freigaben_angebote.sql
\ir ../migrations/20261030230000_angebotsfreigabe_abgabe.sql
\ir ../migrations/20261031000000_registrierung.sql
\ir ../migrations/20261031010000_selbst_freischalten.sql
\ir ../migrations/20261031020000_personal.sql
\ir ../migrations/20261031030000_einsaetze.sql
\ir ../migrations/20261031040000_standortleitung_qualifikationen.sql
\ir ../migrations/20261031050000_personal_tarifvertraege.sql
\ir ../migrations/20261030181644_vergabekatalog.sql
\ir ../migrations/20261031060000_einsatzplaene.sql
\ir ../migrations/20261031070000_tarifkatalog_branchen.sql
\ir ../migrations/20261031080000_onboarding_firmenwebsite_suchprofil.sql
\ir ../migrations/20261031090000_angebotsabgabe_verfasser_bei_kontoloeschung.sql
\ir ../migrations/20261031110000_dachdecker_mindestlohn.sql
\ir ../migrations/20261031120000_tarifliche_mindestentgelte_pflege_reinigung.sql
\ir ../migrations/20261031130000_geruestbau_mindestlohn.sql
\ir ../migrations/20261031140000_weitere_branchenmindestentgelte.sql
\ir ../migrations/20261030224121_kaufverantwortung.sql
\ir ../migrations/20261031150000_kontoloeschung_inhaber.sql
\ir ../migrations/20261031160636_firmenpruefung_testbudget.sql
\ir ../migrations/20261031180000_ki_tageslimit_10_euro.sql
\ir ../migrations/20261101000000_ki_offene_reservierungen.sql
\ir ../migrations/20261101010000_vorgaenge_entfernung_fragefrist.sql
\ir ../migrations/20261101020000_vorgang_notizen.sql
\ir ../migrations/20261101030000_eigene_termine_kalenderabo.sql
\ir ../migrations/20261101040000_unterlagen_ordner_referenzen.sql
\ir ../migrations/20261101050000_kalkulationsprofile_zuschlagvergleich.sql
\ir ../migrations/20261101060000_zuschlag_vergleich_robust.sql
\ir ../migrations/20261101070000_team_abwesenheit_kontakt_protokoll.sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email) values
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

-- Someone who signed up on their own gets their own firm in the free plan, without seeing others.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'selbst@neu.test');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000e');
select public.firma_anlegen('Selbst GmbH') as selbst \gset
select pruefe((select paket = 'kostenlos' from public.firmen where id = :'selbst'), 'Eigene Firma im kostenlosen Tarif');
select pruefe((select count(*) = 1 from public.firmen), 'Neue Firma sieht nur sich selbst');
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

-- Personnel pool: editors add people at their own locations only.
insert into public.personal (firma_id, bereich_id, vorname, berufe) values (:'firma', :'berlin', 'Eva', '{Servicekraft}');
select pruefe((select count(*) = 1 from public.personal), 'Bearbeiter trägt Personal in Berlin ein');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and name='Zeitarbeit GVP/DGB' and '2a'=any(gruppen)), 'Firma erhält GVP/DGB mit dokumentierten Entgeltgruppen');
select pruefe((select count(*) = 21 from public.firmen_tarifvertraege where firma_id=:'firma' and vorgegeben), 'Neue Firma erhält den quellengebundenen Startbestand einschließlich der ergänzten Mindestentgelte');
select pruefe((select count(*) = 1 from public.tarifkatalog where id='geruestbau-mindestlohn-2026' and aktiv and 'Gerüstbauer/in'=any(berufe) and gueltig_ab='2026-01-01' and gueltig_bis='2027-12-31'), 'Gerüstbau-Mindestlohn ist mit Branche, Beruf und Geltungszeitraum dokumentiert');
select pruefe((select count(*) = 2 from public.tarifkatalog_saetze where tarif_id='geruestbau-mindestlohn-2026' and einheit='Stunde'), 'Gerüstbau-Mindestlohn hat beide amtlichen Stichtagswerte');
select pruefe((select betrag=14.35 from public.tarifkatalog_saetze where tarif_id='geruestbau-mindestlohn-2026' and gueltig_ab='2026-01-01'), 'Gerüstbau-Mindestlohn 2026 stimmt mit § 2 TVMindestlohn Gerüstb 9 überein');
select pruefe((select betrag=14.90 from public.tarifkatalog_saetze where tarif_id='geruestbau-mindestlohn-2026' and gueltig_ab='2027-01-01'), 'Gerüstbau-Mindestlohn 2027 stimmt mit § 2 TVMindestlohn Gerüstb 9 überein');
select pruefe((select count(*)=2 from public.tarifkatalog_saetze where tarif_id='ausbildung-mindestentgelt-2026' and einheit='Stunde'), 'Aus- und Weiterbildungsmindestentgelt enthält beide 2026er Qualifikationsgruppen');
select pruefe((select betrag=20.24 from public.tarifkatalog_saetze where tarif_id='ausbildung-mindestentgelt-2026' and gruppe='Mindestlohn I · pädagogische Tätigkeit' and gueltig_ab='2026-01-01'), 'Ausbildungsmindestentgelt I stimmt mit der BMAS-Übersicht überein');
select pruefe((select count(*)=6 from public.tarifkatalog_saetze where tarif_id='luftsicherheit-flughaefen-2026' and einheit='Stunde'), 'Luftsicherheitsmindestentgelt enthält beide Stichtage für die erfassten Gruppen');
select pruefe((select betrag=24.09 from public.tarifkatalog_saetze where tarif_id='luftsicherheit-flughaefen-2026' and gruppe='Entgeltgruppe II · Luftsicherheitskontrollpersonal' and gueltig_ab='2026-04-01'), 'Luftsicherheitsmindestentgelt EG II stimmt mit dem 01.04.2026-Satz überein');
select pruefe((select count(*)=4 from public.tarifkatalog_saetze where tarif_id='elektrohandwerk-mindestentgelt-2025' and einheit='Stunde'), 'Elektrohandwerk-Mindestentgelt enthält alle vier vertraglichen Stichtage');
select pruefe((select betrag=14.93 from public.tarifkatalog_saetze where tarif_id='elektrohandwerk-mindestentgelt-2025' and gueltig_ab='2026-01-01'), 'Elektrohandwerk-Mindestentgelt 2026 stimmt mit der AVE-Bekanntmachung überein');
select pruefe((select count(*)=20 from public.tarifkatalog_saetze where tarif_id='bodenabfertigung-flughaefen-mindestentgelt-2025' and einheit='Stunde'), 'Bodenabfertigung enthält 10 AVE-Gruppen/Stufen an beiden Stichtagen');
select pruefe((select betrag=24.09 from public.tarifkatalog_saetze where tarif_id='bodenabfertigung-flughaefen-mindestentgelt-2025' and gruppe='EG 6 · Stufe 2' and gueltig_ab='2026-05-01'), 'Bodenabfertigung EG 6 Stufe 2 stimmt mit der AVE 2026 überein');
select pruefe(not exists (select 1 from public.tarifkatalog where id='bodenabfertigung-flughaefen-mindestentgelt-2025' and ('EG 1'=any(gruppen) or 'EG 8'=any(gruppen) or 'EG 9'=any(gruppen) or 'EG 10'=any(gruppen))), 'Von der AVE ausgenommene Bodenabfertigungsgruppen werden nicht angeboten');
select pruefe((select count(*)=2 from public.tarifkatalog_saetze where tarif_id='allgemeiner-mindestlohn-2026' and einheit='Stunde'), 'Allgemeiner Mindestlohn enthält die gültigen Stichtage 2026 und 2027');
select pruefe((select betrag=14.60 from public.tarifkatalog_saetze where tarif_id='allgemeiner-mindestlohn-2026' and gueltig_ab='2027-01-01'), 'Allgemeiner Mindestlohn 2027 stimmt mit MiLoV5 überein');
select pruefe((select tarifart='Gesetzlicher Mindestlohn' from public.tarifkatalog where id='allgemeiner-mindestlohn-2026'), 'Allgemeiner Mindestlohn ist als gesetzlicher statt als Branchenmindestlohn markiert');
select pruefe((select count(*)=3 from public.tarifkatalog_saetze where tarif_id='aue-lohnuntergrenze-2026' and einheit='Stunde'), 'AÜ-Lohnuntergrenze enthält alle drei gesetzlichen Stichtage');
select pruefe((select betrag=15.33 from public.tarifkatalog_saetze where tarif_id='aue-lohnuntergrenze-2026' and gueltig_ab='2026-09-01'), 'AÜ-Lohnuntergrenze September 2026 stimmt mit der 7. Verordnung überein');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000f', 'tarif-trigger@perlease.test');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000f');
select public.firma_anlegen('Tarif-Trigger-Prüfung') as tarif_trigger_firma \gset
select pruefe((select count(*)=21 from public.firmen_tarifvertraege where firma_id=:'tarif_trigger_firma' and vorgegeben), 'Neu angelegte Firmen erhalten alle 21 geschützten Tarifauswahlen');
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and name='Elektrohandwerk NRW' and 'EG 12'=any(gruppen) and 'Elektriker/in'=any(berufe) and quelle_url like 'https://%'), 'Branchenvertrag hat Gruppen, Beruf und Quelle');
select pruefe((select cardinality(gruppen) = 38 from public.firmen_tarifvertraege where firma_id=:'firma' and name like 'Garten-, Landschaft%'), 'Tarif mit getrennten Lohn- und Gehaltsgruppen passt vollständig ins Schema');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and name like 'Maler-%' and tarifart='Branchenmindestlohn'), 'Branchenmindestlohn ist als solcher gekennzeichnet');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and katalog_id='dachdecker-mindestlohn-2026' and tarifart='Branchenmindestlohn' and cardinality(gruppen)=2 and 'Zimmerer/Zimmerin'=any(berufe)), 'Dachdecker-Mindestlohn wird firmengebunden mit Stufen und Berufsbezug bereitgestellt');
select pruefe((select count(*) = 4 from public.tarifkatalog_saetze where tarif_id='dachdecker-mindestlohn-2026' and einheit='Stunde'), 'Dachdecker-Mindestlöhne enthalten vier belegte Zeitwerte');
select pruefe((select betrag=14.96 from public.tarifkatalog_saetze where tarif_id='dachdecker-mindestlohn-2026' and gruppe='Mindestlohn 1 · ungelernt' and gueltig_ab='2026-01-01'), 'Dachdecker-Mindestlohn 1 stimmt mit der Rechtsnorm überein');
select pruefe((select betrag=16.60 from public.tarifkatalog_saetze where tarif_id='dachdecker-mindestlohn-2026' and gruppe='Mindestlohn 2 · gelernt/Geselle' and gueltig_ab='2026-01-01'), 'Dachdecker-Mindestlohn 2 stimmt mit der Rechtsnorm überein');
select pruefe((select betrag=17.10 from public.tarifkatalog_saetze where tarif_id='dachdecker-mindestlohn-2026' and gueltig_ab='2027-01-01'), 'Dachdecker-Mindestlohn 2027 ist als eigener Stichtag gespeichert');
select pruefe((select betrag=17.60 from public.tarifkatalog_saetze where tarif_id='dachdecker-mindestlohn-2026' and gueltig_ab='2028-01-01'), 'Dachdecker-Mindestlohn 2028 ist als eigener Stichtag gespeichert');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and katalog_id='pflege-mindestentgelt-2026' and cardinality(gruppen)=3 and gueltig_bis='2028-09-30'), 'Pflegemindestentgelt wird mit drei Qualifikationsstufen und Verordnungsende vorbelegt');
select pruefe((select count(*) = 6 from public.tarifkatalog_saetze where tarif_id='pflege-mindestentgelt-2026' and einheit='Stunde'), 'Pflegemindestentgelt enthält alle drei Stufen für 2026 und 2027');
select pruefe((select betrag=21.03 from public.tarifkatalog_saetze where tarif_id='pflege-mindestentgelt-2026' and gruppe='Pflegefachkraft' and gueltig_ab='2026-07-01'), 'Pflegemindestentgelt für Pflegefachkräfte stimmt mit der Verordnung überein');
select pruefe((select count(*) = 1 from public.firmen_tarifvertraege where firma_id=:'firma' and katalog_id='gebaeudereinigung-mindestlohn-de-2026' and cardinality(gruppen)=2 and gueltig_bis='2026-12-31'), 'Gebäudereinigungsmindestlohn wird national mit zwei belegten Lohngruppen und Ende vorbelegt');
select pruefe((select count(*) = 1 from public.tarifkatalog_saetze where tarif_id='gebaeudereinigung-mindestlohn-de-2026' and gruppe='LG 1 · Innen-/Unterhaltsreinigung' and betrag=15.00 and gueltig_ab='2026-01-01'), 'Reinigungsmindestlohn LG 1 stimmt mit der Verordnung überein');
select pruefe((select count(*) = 1 from public.tarifkatalog_saetze where tarif_id='gebaeudereinigung-mindestlohn-de-2026' and gruppe='LG 6 · Glas-/Fassadenreinigung' and betrag=18.40 and gueltig_ab='2026-01-01'), 'Reinigungsmindestlohn LG 6 stimmt mit der Verordnung überein');
select pruefe((select quelle_url='https://www.gesetze-im-internet.de/tvmindestlohn_maler_12/BJNR0B30B0025.html' and datenstatus='Originalquelle' and hinweis like '%30.06.2027%' from public.tarifkatalog where id='maler-gesellenmindestlohn-2026'), 'Maler-Mindestlohn verweist auf Rechtsnorm und Ablaufdatum');
select pruefe((select count(*) = 30 from public.tarifkatalog_saetze where tarif_id='aue-gvp-dgb-2026'), 'GVP/DGB-Löhne enthalten drei datierte Tabellen für EG 1–9');
select pruefe((select count(*) = 1 from public.tarifkatalog_saetze where tarif_id='maler-gesellenmindestlohn-2026' and betrag=16.13 and einheit='Stunde'), 'Maler-Mindestlohn hat Betrag und Einheit aus Quelle');
select pruefe(has_table_privilege('authenticated','public.tarifkatalog','select') and (select relrowsecurity from pg_class where oid='public.tarifkatalog'::regclass), 'Gemeinsamer Tarifkatalog hat Leserecht und RLS');
select pruefe(has_table_privilege('authenticated','public.tarifkatalog_saetze','select') and (select relrowsecurity from pg_class where oid='public.tarifkatalog_saetze'::regclass), 'Tarifwerte haben Leserecht und RLS');
do $$ begin
  insert into public.tarifkatalog(id,name,branche,region,tarifart,gruppenart,gruppen,quelle,quelle_url,geprueft_am,datenstatus,aktiv)
    values('test-mut','Fremde Änderung','Testbranche','Test','Tarifvertrag','Entgeltgruppe','{1}','Test','https://example.test','2026-10-30','Originalquelle',true);
  raise exception 'FEHLER: authentifizierter Nutzer ändert den gemeinsamen Tarifkatalog';
exception when insufficient_privilege then raise notice 'ok: gemeinsamer Tarifkatalog kann nicht geändert werden'; end $$;
insert into public.personal (firma_id, bereich_id, vorname, tarifvertrag_id, eg)
  select :'firma', :'berlin', 'Tarifkraft', id, '2a' from public.firmen_tarifvertraege where firma_id=:'firma' and name='Zeitarbeit GVP/DGB' and vorgegeben;
select pruefe((select count(*) = 1 from public.personal where vorname='Tarifkraft' and eg='2a'), 'Entgeltgruppe des gewählten Vertrags ist zulässig');
insert into public.personal (firma_id, bereich_id, vorname, tarifvertrag_id, eg)
  select :'firma', :'berlin', 'Dachdecker', id, 'Mindestlohn 2 · gelernt/Geselle' from public.firmen_tarifvertraege where firma_id=:'firma' and katalog_id='dachdecker-mindestlohn-2026';
select pruefe((select count(*) = 1 from public.personal where vorname='Dachdecker' and eg='Mindestlohn 2 · gelernt/Geselle'), 'Dachdecker-Mindestlohnstufe kann als vertragsgebundene Auswahl gespeichert werden');
insert into public.personal (firma_id, bereich_id, vorname, tarifvertrag_id, eg)
  select :'firma', :'berlin', 'Pflegefachkraft', id, 'Pflegefachkraft' from public.firmen_tarifvertraege where firma_id=:'firma' and katalog_id='pflege-mindestentgelt-2026';
select pruefe((select count(*) = 1 from public.personal where vorname='Pflegefachkraft' and eg='Pflegefachkraft'), 'Pflegemindestentgeltstufe kann als vertragsgebundene Auswahl gespeichert werden');
do $$ begin
  insert into public.personal (firma_id, bereich_id, vorname, tarifvertrag_id, eg)
    select current_setting('test.firma')::uuid, (select id from public.bereiche where name='Berlin'), 'Falsche Gruppe', id, 'Meister'
    from public.firmen_tarifvertraege where firma_id=current_setting('test.firma')::uuid and name='Zeitarbeit GVP/DGB' and vorgegeben;
  raise exception 'FEHLER: fremde Entgeltgruppe akzeptiert';
exception when raise_exception then
  if sqlerrm like 'FEHLER%' then raise; end if;
  raise notice 'ok: Entgeltgruppe muss zum gewählten Vertrag gehören';
end $$;
do $$ begin
  insert into public.personal (firma_id, bereich_id, vorname) values (current_setting('test.firma')::uuid, (select id from public.bereiche where name = 'Hamburg'), 'Heimlich');
  raise exception 'FEHLER: Personal in fremdem Standort eingetragen';
exception when insufficient_privilege then raise notice 'ok: kein Personal in fremden Standorten'; end $$;
insert into public.einsaetze (firma_id, vorgang_id, personal_id)
  select :'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), (select id from public.personal where vorname = 'Eva');
select pruefe((select count(*) = 1 from public.einsaetze), 'Bearbeiter plant Eva für Messe-Catering ein');
insert into public.einsatzplaene (vorgang_id, firma_id, ort) select id, :'firma', 'Messe Berlin, Halle 3' from public.vorgaenge where titel = 'Messe-Catering ITB';
select pruefe((select ort = 'Messe Berlin, Halle 3' from public.einsatzplaene), 'Bearbeiter legt Einsatzplan an');
do $$ begin
  insert into public.einsaetze (firma_id, vorgang_id, personal_id)
    select current_setting('test.firma')::uuid, (select id from public.vorgaenge where titel = 'Hotel Hamburg'), (select id from public.personal where vorname = 'Eva');
  raise exception 'FEHLER: Einsatz für unsichtbare Ausschreibung';
exception when insufficient_privilege or not_null_violation then raise notice 'ok: kein Einsatz für fremde Ausschreibungen'; end $$;

-- Outsider sees nothing.
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) from public.vorgaenge) = 0 and (select count(*) from public.firmen) = 0, 'Fremde sehen nichts');
select pruefe((select count(*) = 0 from public.personal), 'Fremde sehen kein Personal');
select pruefe((select count(*) = 0 from public.einsaetze), 'Fremde sehen keine Einsätze');
select pruefe((select count(*) = 0 from public.einsatzplaene), 'Fremde sehen keine Einsatzpläne');
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
-- Standortleitung ist auf exakt einen zugewiesenen Bereich beschränkt und erhält keine Finanzrechte.
select test_als('00000000-0000-0000-0000-00000000000a');
select public.mitglied_aktualisieren(:'firma','00000000-0000-0000-0000-00000000000b','Berlin Leitung','Standortleitung','standortleitung',true,false,array[:'berlin']::uuid[]);
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(public.darf_bearbeiten(:'firma',:'berlin') and not public.darf_bearbeiten(:'firma',:'hamburg'),'Standortleitung bearbeitet nur zugeordneten Bereich');
select pruefe(not public.darf_bereich(:'firma',null) and not public.darf_bearbeiten(:'firma',null),'Standortleitung sieht und ändert keine firmenweiten Vorgänge');
select pruefe(not jarvis_intern.darf_finanzen(:'firma',:'berlin'),'Standortleitung erhält trotz Anfrage keine Finanzrechte');
insert into public.personal(firma_id,bereich_id,vorname) values (:'firma',:'berlin','Leitungskraft');
insert into public.firmen_qualifikationen(firma_id,bereich_id,name,erstellt_von) values (:'firma',:'berlin','Brandschutzhelfer',auth.uid());
select pruefe((select count(*)=1 from public.firmen_qualifikationen where name='Brandschutzhelfer'),'Standortleitung ergänzt Qualifikationen');
do $$ begin
  insert into public.personal(firma_id,bereich_id,vorname) values (current_setting('test.firma')::uuid,(select id from public.bereiche where name='Hamburg'),'Fremder Standort');
  raise exception 'FEHLER: Standortleitung bearbeitete fremden Bereich';
exception when insufficient_privilege then raise notice 'ok: Standortleitung bleibt standortbegrenzt'; end $$;
do $$ begin
  insert into public.firmen_qualifikationen(firma_id,name,erstellt_von) values (current_setting('test.firma')::uuid,'Globale Quali',auth.uid());
  raise exception 'FEHLER: Standortleitung legte globale Qualifikation an';
exception when insufficient_privilege then raise notice 'ok: globale Qualifikationen bleiben Administration'; end $$;
select test_als('00000000-0000-0000-0000-00000000000a');
select public.mitglied_aktualisieren(:'firma','00000000-0000-0000-0000-00000000000b','Berlin Service','Serviceleiter/in','bearbeiter',true,false,array[:'berlin']::uuid[]);
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

-- Deleting the person who logged the proof keeps the proof but clears the author reference.
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1', 'test-loeschen@firma.test', '{}');
update public.angebotsabgaben set abgegeben_von='00000000-0000-0000-0000-0000000000e1' where dateiname='eingang.pdf';
delete from auth.users where id='00000000-0000-0000-0000-0000000000e1';
select pruefe((select abgegeben_von is null and dateiname='eingang.pdf' from public.angebotsabgaben where dateiname='eingang.pdf'), 'Angebotsbeleg bleibt bei Kontolöschung erhalten');

-- Registration: with a confirmed e-mail the firm is created at once, free plan, with the address.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000d1', 'neu@firma.test', '{"vorname":"Eva","nachname":"Neu","firma":"Neu GmbH","strasse":"Weg 1","plz":"52531","ort":"Übach","website":"https://www.neu-firma.example"}');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000d1');
select public.registrierung_abschliessen() as neufirma \gset
select pruefe((select plz='52531' and name='Neu GmbH' and paket='kostenlos' and website='https://www.neu-firma.example' from public.firmen where id=:'neufirma'), 'Firma kostenlos mit Anschrift und Website angelegt');
select pruefe((select rolle='inhaber' and anzeigename='Eva Neu' from public.mitglieder where firma_id=:'neufirma'), 'Registrierte Person ist Inhaber');
select pruefe(public.registrierung_abschliessen() is null, 'Kein zweites Anlegen');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe(public.registrierung_abschliessen() is null, 'Ohne Registrierungsdaten keine Firma');
-- Shared public facts must never grant access to another firm's operational records.
reset role;
insert into public.vergabekatalog(id,quelle,quelle_id,version,quell_datum,titel,link,auftraggeber,auftraggeber_id,status,frist)
values('bks:test','bks','test','v1','2026-10-30','Elektriker für die Verwaltung','https://example.test/notice','Stadt Test','buyer-1','offen','2100-01-01');
insert into public.vergabekatalog(id,quelle,quelle_id,version,quell_datum,titel,link,auftraggeber,auftraggeber_id,status,frist)
values('bks:alt','bks','alt','v1','2026-10-30','Geschlossene Ausschreibung','https://example.test/old','Stadt Test','buyer-1','offen','2000-01-01');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*)=1 from public.katalog_suche(:'firma','','','','offen')),'Bestandssuche schließt abgelaufene Fristen aus');
select pruefe((select count(*)=0 from public.katalog_suche(:'selbst','','','','offen')),'Katalogsuche verlangt Mitgliedschaft der angegebenen Firma');
select public.katalog_uebernehmen(:'firma','bks:test',null) as katalog_vorgang \gset
select pruefe((select katalog_id='bks:test' from public.vorgaenge where id=:'katalog_vorgang'),'Katalogtreffer wird ohne doppelte Ausschreibung übernommen');
select pruefe(public.katalog_uebernehmen(:'firma','bks:test',null)=:'katalog_vorgang','Wiederholte Übernahme bleibt idempotent');
insert into public.treffer_feedback(firma_id,vorgang_id,grund) values(:'firma',:'katalog_vorgang','region');
insert into public.partnerprofile(firma_id,name,leistungen) values(:'firma','Testpartner','Elektroarbeiten');
select test_als('00000000-0000-0000-0000-0000000000d1');
select pruefe(not exists(select 1 from public.treffer_feedback),'Andere Firma sieht keine Rückmeldungen');
select pruefe(not exists(select 1 from public.partnerprofile),'Partnerprofile sind ohne Opt-in unsichtbar');
select test_als('00000000-0000-0000-0000-00000000000a');
update public.partnerprofile set sichtbar=true where firma_id=:'firma';
select test_als('00000000-0000-0000-0000-0000000000d1');
select pruefe((select count(*)=1 from public.partnerprofile),'Nur freigegebenes Partnerprofil sichtbar');
reset role;
select jarvis_katalog.aufnehmen(jsonb_build_array(to_jsonb(k)||'{"version":"v2","quell_datum":"2026-10-31T10:00:00Z","frist":"2101-01-01T00:00:00Z"}'::jsonb)) from public.vergabekatalog k where id='bks:test';
select pruefe((select version='v2' and frist='2101-01-01' from public.vergabekatalog where id='bks:test'),'Änderungen aktualisieren zentralen Bestand');
select pruefe((select count(*)=1 from public.katalog_aenderungen where katalog_id='bks:test'),'Änderungsverlauf wird gespeichert');
select pruefe((select frist='2101-01-01' from public.vorgaenge where id=:'katalog_vorgang'),'Geänderte Frist wird im eigenen Vorgang nachgeführt');
select jarvis_katalog.aufnehmen(jsonb_build_array(to_jsonb(k)||'{"version":"v0","quell_datum":"2025-01-01T10:00:00Z","frist":"2000-01-01T00:00:00Z"}'::jsonb)) from public.vergabekatalog k where id='bks:test';
select pruefe((select version='v2' from public.vergabekatalog where id='bks:test'),'Ältere Exporte überschreiben neue Fristen nicht');
select jarvis_katalog.aufnehmen(jsonb_build_array(to_jsonb(k)||'{"quell_datum":"2026-11-01T10:00:00Z"}'::jsonb)) from public.vergabekatalog k where id='bks:test';
select pruefe((select count(*)=1 from public.katalog_aenderungen where katalog_id='bks:test'),'Gleicher Inhalt erzeugt keine neue kostenpflichtige Version');
select pruefe(jarvis_katalog.ki_tageslimit('2026-11-15T12:00:00Z')=11,'Tageslimit 11 USD (rund 10 Euro)');
select pruefe(jarvis_katalog.ki_reservieren(3.1,'test') is null,'Einzelanfragen bleiben auf höchstens 3 USD begrenzt');
select jarvis_katalog.ki_reservieren(3,'test') as reservierung \gset
select pruefe(jarvis_katalog.ki_reservieren(3,'test') is not null and jarvis_katalog.ki_reservieren(3,'test') is not null,'Bis zum Tageslimit sind mehrere Anfragen möglich');
select pruefe(jarvis_katalog.ki_reservieren(3,'test') is null,'KI-Tageslimit wird vor Anfrage atomar geprüft');
select jarvis_katalog.ki_abschliessen(:'reservierung',0.1);
select jarvis_katalog.ki_abschliessen(:'reservierung',0.01);
select pruefe((select reserviert=0.1 from jarvis_katalog.ki_kosten where id=:'reservierung'),'Abrechnung gibt Reservierung nur einmal frei');
-- A reservation left open for more than an hour is settled at an estimate (at most 0.50 USD) on the next reservation.
insert into jarvis_katalog.ki_kosten(zeit,zweck,reserviert) values (now()-interval '2 hours','web',2.05) returning id as offen \gset
select jarvis_katalog.ki_reservieren(0.01,'test');
select pruefe((select verbraucht=0.5 and reserviert=0.5 from jarvis_katalog.ki_kosten where id=:'offen'),'Hängende Reservierung wird nach einer Stunde mit höchstens 0,50 USD abgerechnet');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*)=0 from public.vergabekatalog),'Nichtmitglieder sehen keinen Katalog');
do $$ begin
 perform jarvis_katalog.ki_reservieren(0.1,'heimlich');
 raise exception 'FEHLER: Nutzer durfte Budget direkt verändern';
exception when insufficient_privilege then raise notice 'ok: Budgetledger ist intern'; end $$;
select test_als('00000000-0000-0000-0000-00000000000a');
update public.mitglieder set aktiv=false where firma_id=:'firma' and user_id='00000000-0000-0000-0000-00000000000b';
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe(public.meine_rolle(:'firma') is null,'Gesperrter Mitarbeiter verliert nur den Firmenzugang');
select pruefe(not exists(select 1 from public.vorgaenge where firma_id=:'firma'),'Gesperrter Mitarbeiter verliert RLS-Zugriff');
select test_als('00000000-0000-0000-0000-00000000000a');
update public.mitglieder set aktiv=true where firma_id=:'firma' and user_id='00000000-0000-0000-0000-00000000000b';
select set_config('test.firma', :'firma', false);
do $$ begin
 update public.mitglieder set aktiv=false where firma_id=current_setting('test.firma')::uuid and user_id=auth.uid();
 raise exception 'FEHLER: Letzter Inhaber wurde gesperrt';
exception when raise_exception then
 if sqlerrm = 'FEHLER: Letzter Inhaber wurde gesperrt' then raise; end if;
 raise notice 'ok: Letzter aktiver Inhaber bleibt geschützt';
end $$;
update public.vorgaenge set kaufverantwortlich_id='00000000-0000-0000-0000-00000000000b' where titel='Messe-Catering ITB';
select pruefe((select kaufverantwortlich_id='00000000-0000-0000-0000-00000000000b' from public.vorgaenge where titel='Messe-Catering ITB'),'Kaufmännische Zuständigkeit wird für passenden Bereich gespeichert');
do $$ begin
 update public.vorgaenge set kaufverantwortlich_id='00000000-0000-0000-0000-00000000000b' where titel='Hotel Hamburg';
 raise exception 'FEHLER: Bearbeiter ohne Bereichszugriff wurde zugewiesen';
exception when raise_exception then
 if sqlerrm = 'FEHLER: Bearbeiter ohne Bereichszugriff wurde zugewiesen' then raise; end if;
 raise notice 'ok: kaufmännische Zuweisung prüft den Bereichszugriff';
end $$;
update public.mitglieder set aktiv=false where firma_id=:'firma' and user_id='00000000-0000-0000-0000-00000000000b';
do $$ begin
 update public.vorgaenge set kaufverantwortlich_id='00000000-0000-0000-0000-00000000000b' where titel='Bundesweit';
 raise exception 'FEHLER: Gesperrter Mitarbeiter wurde zugewiesen';
exception when raise_exception then
 if sqlerrm = 'FEHLER: Gesperrter Mitarbeiter wurde zugewiesen' then raise; end if;
 raise notice 'ok: kaufmännische Zuweisung verlangt ein aktives Mitglied';
end $$;
-- Team notes: visible to people who see the tender, invisible to other firms.
reset role;
select id as notiz_vorgang from public.vorgaenge where firma_id=:'firma' limit 1 \gset
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.vorgang_notizen (firma_id, vorgang_id, text) values (:'firma', :'notiz_vorgang', 'Kunde angerufen');
select pruefe((select count(*)=1 from public.vorgang_notizen where vorgang_id=:'notiz_vorgang'), 'Notiz zur Ausschreibung gespeichert');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*)=0 from public.vorgang_notizen), 'Fremde Firma sieht keine Notizen');
do $$ begin
  insert into public.vorgang_notizen (firma_id, vorgang_id, text) select firma_id, id, 'fremd' from public.vorgaenge limit 1;
  if found then raise exception 'FEHLER: Fremde Notiz angelegt'; end if;
exception when insufficient_privilege or check_violation then null; end $$;
reset role;

-- Own deadlines and the calendar feed: the token shows its owner's visible deadlines, nothing for wrong tokens.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.eigene_termine (firma_id, titel, zeit) values (:'firma', 'Ortsbesichtigung', now() + interval '3 days');
insert into public.kalender_abos (token, firma_id) values (repeat('a', 43), :'firma');
select pruefe((select count(*)=1 from public.eigene_termine), 'Eigener Termin gespeichert');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*)=0 from public.eigene_termine), 'Fremde sehen keine eigenen Termine');
reset role;
select set_config('test.uid', '', false);
set role anon;
select pruefe((select count(*)>=1 from public.kalender_fristen(repeat('a', 43)) where art='eigen'), 'Kalender-Abo liefert eigene Termine');
select pruefe((select count(*)=0 from public.kalender_fristen(repeat('b', 43))), 'Falscher Kalender-Schlüssel liefert nichts');
reset role;

-- References: the administration keeps them, other firms see nothing.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.referenzen (firma_id, auftraggeber, leistung, von, bis) values (:'firma', 'Stadt Aachen', 'Reinigung Rathaus', '2024-01-01', '2025-12-31');
select pruefe((select count(*)=1 from public.referenzen), 'Referenz gespeichert');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*)=0 from public.referenzen), 'Fremde Firma sieht keine Referenzen');
do $$ begin
  insert into public.referenzen (firma_id, auftraggeber, leistung) values (current_setting('test.firma')::uuid, 'x', 'y');
  raise exception 'FEHLER: Fremde Referenz angelegt';
exception when insufficient_privilege or check_violation then null; end $$;
reset role;

-- Calculation templates: kept per firm, invisible to others; award comparison runs for members only.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.kalkulationsprofile (firma_id, name, eingaben) values (:'firma', 'Gastro', '{"lohn": 15}');
select pruefe((select count(*)=1 from public.kalkulationsprofile), 'Kalkulationsvorlage gespeichert');
reset role;
insert into public.vergabekatalog (id,quelle,quelle_id,version,quell_datum,titel,beschreibung,link,auftraggeber,auftraggeber_id,cpv,status,zuschlaege) values
('test:z1','bks','z1','1',now(),'Leihpersonal Gastronomie','Servicekräfte','https://example.org/1','Stadt A','a',array['79620000'],'vergeben','[{"id":"1","datum":"2025-05-01T00:00:00.000Z","gewinner":["Muster GmbH"],"wert":420000,"waehrung":"EUR"}]'),
('test:z2','bks','z2','1',now(),'Unterhaltsreinigung Rathaus','Reinigung','https://example.org/2','Stadt B','b',array['90910000'],'vergeben','[{"id":"2","datum":"kaputt","gewinner":[],"wert":90000,"waehrung":"EUR"},{"id":"3","datum":null,"gewinner":[],"wert":5,"waehrung":"EUR"}]');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select array_agg(id)=array['test:z1'] from public.zuschlag_vergleich(:'firma', '{}', array['79620000'])), 'Zuschlagsvergleich findet nur die gleiche CPV-Gruppe');
select pruefe((select array_agg(id)=array['test:z2'] from public.zuschlag_vergleich(:'firma', array['rathaus'], '{}')), 'Zuschlagsvergleich findet per Stichwort, kaputtes Datum und Kleinstwert stören nicht');
select pruefe((select count(*)=0 from public.zuschlag_vergleich(:'firma', '{}', array['79620000'], 'test:z1')), 'Eigene Bekanntmachung wird nicht mit sich selbst verglichen');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*)=0 from public.kalkulationsprofile), 'Fremde Firma sieht keine Kalkulationsvorlagen');
select pruefe((select count(*)=0 from public.zuschlag_vergleich(:'firma', array['Reinigung'], array['90910000'])), 'Fremde bekommen keinen Zuschlagsvergleich dieser Firma');
reset role;

-- Team: absences follow the worker's location rights, contacts per location, change log only for owners.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.personal (firma_id, bereich_id, vorname, nachname) values (:'firma', :'berlin', 'Protokoll', 'Berlin') returning id as p_berlin \gset
insert into public.personal (firma_id, bereich_id, vorname, nachname) values (:'firma', :'hamburg', 'Protokoll', 'Hamburg') returning id as p_hamburg \gset
update public.personal set status = 'einsatz' where id = :'p_berlin';
update public.bereiche set ansprechpartner = 'Frau Berg', telefon = '030 123' where id = :'berlin';
select pruefe((select count(*) >= 1 from public.aenderungsprotokoll where bereich = 'personal' and aktion = 'UPDATE' and datensatz = 'Protokoll Berlin'
  and aenderungen @> '[{"feld": "status", "alt": "verfuegbar", "neu": "einsatz"}]'), 'Protokoll hält Statusänderung mit alt und neu fest');
select pruefe((select count(*) = 1 from public.aenderungsprotokoll where bereich = 'bereiche' and aktion = 'UPDATE' and wer <> ''), 'Protokoll nennt, wer den Standort geändert hat');
do $$ begin
  insert into public.aenderungsprotokoll (firma_id, bereich, aktion) values (current_setting('test.firma')::uuid, 'x', 'INSERT');
  raise exception 'FEHLER: Protokoll von Hand beschrieben';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('test.uid', '', false);
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis) values (:'firma', :'p_berlin', current_date, current_date + 10);
select pruefe((select count(*) = 1 from public.personal_abwesenheiten where personal_id = :'p_berlin'), 'Bearbeiter trägt Urlaub am eigenen Standort ein');
do $$ begin
  insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis)
    select current_setting('test.firma')::uuid, id, current_date, current_date + 1 from public.personal where vorname = 'Protokoll' and nachname = 'Hamburg';
  if found then raise exception 'FEHLER: Urlaub an fremdem Standort eingetragen'; end if;
exception when insufficient_privilege or check_violation then null; end $$;
select pruefe((select count(*) = 0 from public.aenderungsprotokoll), 'Bearbeiter sieht das Änderungsprotokoll nicht');
select pruefe((select ansprechpartner = 'Frau Berg' from public.bereiche where id = :'berlin'), 'Ansprechpartner des Standorts ist für das Team sichtbar');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.aenderungsprotokoll), 'Fremde Firma sieht kein Protokoll');
select pruefe((select count(*) = 0 from public.personal_abwesenheiten), 'Fremde Firma sieht keine Abwesenheiten');
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*) >= 1 from public.aenderungsprotokoll where bereich = 'personal_abwesenheiten' and datensatz = 'Protokoll Berlin'), 'Inhaber sieht den eingetragenen Urlaub im Protokoll');
reset role;
select pruefe((select count(*) = 0 from public.aenderungsprotokoll where user_id is null), 'Hintergrundänderungen ohne Person werden nicht protokolliert');
select set_config('test.uid', '', false);
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';

-- Deleting a login: a firm with only this person disappears with it; a firm with other members stays.
reset role;
select id as neufirma2 from public.firmen where name='Neu GmbH' \gset
delete from auth.users where id='00000000-0000-0000-0000-0000000000d1';
select pruefe(not exists (select 1 from public.firmen where id=:'neufirma2'), 'Kontolöschung entfernt Firma ohne weitere Mitglieder');
delete from auth.users where id='00000000-0000-0000-0000-00000000000a';
select pruefe(exists (select 1 from public.firmen where id=:'firma') and not exists (select 1 from public.mitglieder where user_id='00000000-0000-0000-0000-00000000000a'), 'Kontolöschung des letzten Inhabers klappt, Firma mit Team bleibt');
\echo ALLE TESTS OK
