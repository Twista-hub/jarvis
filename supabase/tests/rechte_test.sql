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
-- Like Supabase: new tables in public get all table rights for authenticated (a migration's revoke then applies).
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
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
\ir ../migrations/20261101080000_suchprofil_filter_vorschau.sql
\ir ../migrations/20261101090000_einstellungen_konto.sql
\ir ../migrations/20261101100000_aueg_ueberlassungen.sql
\ir ../migrations/20261101110000_foerderung_radar.sql
\ir ../migrations/20261101120000_auftraege_auftraggeber_auswertung.sql
\ir ../migrations/20261101130000_textbausteine_leistungsverzeichnis.sql
\ir ../migrations/20261101140000_termine_partner_disposition.sql
\ir ../migrations/20261101150000_firmenprofil_personalakte.sql
\ir ../migrations/20261101160000_team_vertretung_aufgaben_selbstpflege.sql
\ir ../migrations/20261101170000_stunden_schichten_brett_fristen.sql
\ir ../migrations/20261101180000_kunden_leistungsnachweis_ausfall.sql
\ir ../migrations/20261101190000_psa_bewerber_checklisten_urlaub_bewertung.sql
\ir ../migrations/20261101200000_abrechnung_lohn_stempel_selbstbedienung.sql
\ir ../migrations/20261101210000_betreiber_konto_loeschen.sql
\ir ../migrations/20261101220000_betreiber_push_anmeldung.sql
\ir ../migrations/20261102080000_fehler_alarm.sql
\ir ../migrations/20261102090000_gewerk_statistik.sql
\ir ../migrations/20261102100000_gewerk_cache.sql
\ir ../migrations/20261102110000_gewerk_offen.sql
\ir ../migrations/20261102120000_us_bieterprofil.sql
\ir ../migrations/20261102130000_boamp_bestand.sql
\ir ../migrations/20261102150000_ausland_bestand.sql
\ir ../migrations/20261103010000_ausland_bestand_italien.sql
\ir ../migrations/20261103020000_rechnungen_mahnwesen.sql
\ir ../migrations/20261103030000_rechnungsvorlagen.sql
\ir ../migrations/20261103040000_rundgang_wachbuch.sql
\ir ../migrations/20261103050000_belege.sql
\ir ../migrations/20261103060000_kundenportal.sql
\ir ../migrations/20261103070000_datev.sql
\ir ../migrations/20261103080000_auftragsboerse.sql
\ir ../migrations/20261103090000_nachkalkulation.sql
\ir ../migrations/20261103100000_team_chat.sql
\ir ../migrations/20261103110000_rechnungen_gobd.sql
\ir ../migrations/20261103120000_datenschutz_ausfall_portal_link.sql
\ir ../migrations/20261103130000_land_der_firma.sql
\ir ../migrations/20261103140000_leser_rundgang_rechte.sql
\ir ../migrations/20261103150000_personal_aufbewahrung.sql
\ir ../migrations/20261103160000_arbzg_schicht_uebernehmen.sql
\ir ../migrations/20261103170000_zeitarbeit_tarif.sql
grant usage on schema public to authenticated;

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

-- Search profile (H1–H3): only owners/administration change exclusions and further profiles; preview for them only.
reset role;
select set_config('test.uid', '', false);
insert into public.suchprofile (firma_id, name, einstellungen) values (:'firma', 'Perlease', '{"leistungen": [{"name": "Reinigung", "cpv": [], "woerter": ["reinigung"]}]}')
  on conflict do nothing;
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
insert into public.vergabekatalog (id,quelle,quelle_id,version,quell_datum,titel,beschreibung,link,auftraggeber,auftraggeber_id,cpv,plz,status,roh) values
('test:v1','bks','v1','1',now() - interval '2 days','Unterhaltsreinigung Rathaus','Reinigung der Büros','https://example.org/v1','Stadt A','a',array['90910000'],array['10115'],'offen','{"tender": {"value": {"amount": 120000}}}'),
('test:v2','bks','v2','1',now() - interval '3 days','Glasreinigung Schule','Fenster','https://example.org/v2','Stadt B','b',array['90911300'],array['20095'],'offen','{"tender": {"value": {"amount": 20000}}}'),
('test:v3','bks','v3','1',now() - interval '30 days','Reinigung alt','x','https://example.org/v3','Stadt C','c',array['90910000'],array['10115'],'offen','{}');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe(public.suchprofil_ausschluss(:'firma', 'Fenster') = '["fenster"]'::jsonb, 'Ausschlusswort per Daumen gespeichert');
select pruefe(public.suchprofil_ausschluss(:'firma', 'fenster', true) = '[]'::jsonb, 'Ausschlusswort wieder entfernt');
select public.suchprofil_zusatz(:'firma', '[{"id": "a1b2c3d4-0000-4000-8000-000000000001", "name": "Winterdienst", "woerter": ["winterdienst"]}]');
select pruefe((select einstellungen->'zusatzprofile'->0->>'name' = 'Winterdienst' and einstellungen->'leistungen' is not null from public.suchprofile where firma_id = :'firma' and bereich_id is null), 'Weiteres Suchprofil gespeichert, Hauptprofil bleibt');
do $$ begin
  perform public.suchprofil_zusatz(current_setting('test.firma')::uuid, '[{},{},{},{}]');
  raise exception 'FEHLER: mehr als 3 weitere Suchprofile';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select pruefe((select count(*) = 2 from public.suchprofil_vorschau(:'firma', '(?<!\w)reinigung')), 'Vorschau findet die Reinigungen der letzten 7 Tage');
select pruefe((select array_agg(id) = array['test:v1'] from public.suchprofil_vorschau(:'firma', '(?<!\w)reinigung', 'fenster', '{}', array['10'])), 'Vorschau beachtet Ausschluss und Gebiet');
select pruefe((select array_agg(id) = array['test:v1'] from public.suchprofil_vorschau(:'firma', '(?!x)x', '', array['9091'], '{}', 50000, null, false)), 'Vorschau beachtet Kennziffern und Mindestwert (ohne Wertangabe ausgeblendet)');
select test_als('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.suchprofil_ausschluss(current_setting('test.firma')::uuid, 'test');
  raise exception 'FEHLER: Bearbeiter ändert das Suchprofil';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select pruefe((select count(*) = 0 from public.suchprofil_vorschau(:'firma', '(?<!\w)reinigung')), 'Bearbeiter bekommt keine Vorschau');
reset role;
select set_config('test.uid', '', false);
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';

-- AÜG-Wächter (N13): assignments follow the worker's location rights; staff-only members and other firms see nothing.
reset role;
select set_config('test.uid', '', false);
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.ueberlassungen (firma_id, personal_id, entleiher, von) values (:'firma', :'p_berlin', 'Messe Berlin GmbH', current_date - 200);
select pruefe((select count(*) = 1 from public.ueberlassungen), 'Bearbeiter trägt Überlassung am eigenen Standort ein');
do $$ begin
  insert into public.ueberlassungen (firma_id, personal_id, entleiher, von)
    select current_setting('test.firma')::uuid, id, 'Hafen Hamburg', current_date from public.personal where vorname = 'Protokoll' and nachname = 'Hamburg';
  if found then raise exception 'FEHLER: Überlassung an fremdem Standort'; end if;
exception when insufficient_privilege or check_violation then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*) = 1 from public.aenderungsprotokoll where bereich = 'ueberlassungen' and datensatz = 'Protokoll Berlin bei Messe Berlin GmbH'), 'Protokoll nennt Person und Entleiher');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.ueberlassungen), 'Fremde Firma sieht keine Überlassungen');
reset role;
select set_config('test.uid', '', false);
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';

-- Settings and account (I1–I4): own name and function, notification settings, deleting one's own login.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
select public.mein_profil(:'firma', '  Benjamin   Schiffer ', 'Geschäftsführung');
select pruefe((select anzeigename = 'Benjamin Schiffer' and funktion = 'Geschäftsführung' and rolle = 'inhaber' from public.mitglieder where firma_id = :'firma' and user_id = '00000000-0000-0000-0000-00000000000a'), 'Eigener Name und Funktion geändert, Rolle bleibt');
insert into public.benachrichtigungen (firma_id, user_id, stunde, kanal, sofort_ab, ruhe_von, ruhe_bis, fristen)
  values (:'firma', '00000000-0000-0000-0000-00000000000a', 8, 'push', 8, 20, 7, false)
  on conflict (firma_id, user_id) do update set sofort_ab = 8, ruhe_von = 20, ruhe_bis = 7, fristen = false;
select pruefe((select sofort_ab = 8 and ruhe_von = 20 and not fristen from public.benachrichtigungen where user_id = '00000000-0000-0000-0000-00000000000a' and firma_id = :'firma'), 'Benachrichtigung fein eingestellt');
do $$ begin
  perform public.konto_loeschen();
  raise exception 'FEHLER: letzter Inhaber mit Team konnte sein Konto löschen';
exception when raise_exception then if sqlerrm <> 'LETZTER_INHABER' then raise; end if; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
do $$ begin
  perform public.mein_profil(current_setting('test.firma')::uuid, 'Eindringling', 'x');
  raise exception 'FEHLER: fremder Name gesetzt';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select test_als('00000000-0000-0000-0000-00000000000e');
select pruefe((select cardinality(public.konto_loeschen()) = 1), 'Allein-Inhaber löscht sein Konto, seine Firma geht mit');
reset role;
select pruefe(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000e') and not exists (select 1 from public.firmen where id = :'selbst'), 'Konto und eigene Firma sind gelöscht');
select set_config('test.uid', '', false);

-- N2: funding programmes are shared, assessments belong to the firm; staff marks only the column "stand".
reset role;
insert into public.foerderprogramme (id, titel, link, veroeffentlicht) values
  ('https://www.foerderdatenbank.de/p1', 'Digital Jetzt', 'https://www.foerderdatenbank.de/p1', current_date);
insert into public.foerder_bewertungen (firma_id, programm_id, punkte, grund) values (:'firma', 'https://www.foerderdatenbank.de/p1', 8, 'Passt');
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  insert into public.foerderprogramme (id, titel, link) values ('x', 'Fremd', 'https://example.org/x');
  raise exception 'FEHLER: Förderprogramm mit fremdem Link';
exception when check_violation then null; end $$;
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
update public.foerder_bewertungen set stand = 'gemerkt' where firma_id = :'firma';
select pruefe((select stand = 'gemerkt' from public.foerder_bewertungen where firma_id = :'firma'), 'Bearbeiter merkt ein Förderprogramm');
do $$ begin
  update public.foerder_bewertungen set punkte = 10;
  raise exception 'FEHLER: Punkte der KI-Bewertung geändert';
exception when insufficient_privilege then null; when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.foerder_bewertungen), 'Fremde Firma sieht keine Förderbewertungen');
update public.foerder_bewertungen set stand = 'ausgeblendet';
reset role;
select pruefe((select stand = 'gemerkt' from public.foerder_bewertungen where firma_id = :'firma'), 'Fremde Firma ändert keine Förderbewertung');

-- N3: contract end from the award notice, the announced period or award date plus duration; radar by profile.
insert into public.vergabekatalog (id,quelle,quelle_id,version,quell_datum,titel,beschreibung,link,auftraggeber,auftraggeber_id,cpv,plz,status,zuschlaege,vertragsende,roh) values
('test:r1','bks','r1','1',now() - interval '20 days','Unterhaltsreinigung Kita','Reinigung','https://example.org/r1','Stadt R','r',array['90910000'],array['10115'],'vergeben',
  '[{"id":"1","datum":"2026-10-01T00:00:00Z","gewinner":["Blitz GmbH"],"wert":240000,"waehrung":"EUR"}]', (current_date + 400), '{}'),
('test:r2','bks','r2','1',now() - interval '20 days','Glasreinigung Schule','Reinigung der Fenster','https://example.org/r2','Stadt S','s',array['90911300'],array['10117'],'vergeben',
  '[{"id":"2","datum":"2026-10-15T00:00:00Z","gewinner":["Klar AG"],"wert":null,"waehrung":"EUR"}]', null,
  '{"tender": {"lots": [{"contractPeriod": {"durationInDays": 365, "maxExtentDate": "2029-10-15"}}, {"contractPeriod": {"durationInDays": "kaputt"}}]}}'),
('test:r3','bks','r3','1',now() - interval '20 days','Reinigung Hallenbad','Reinigung','https://example.org/r3','Stadt R','r',array['90910000'],array['80331'],'vergeben',
  '[]', null, '{"tender": {"contractPeriod": {"startDate": "2026-11-01", "endDate": "2030-10-31"}}}'),
('test:r4','bks','r4','1',now() - interval '20 days','Reinigung offen','Reinigung','https://example.org/r4','Stadt R','r',array['90910000'],array['10115'],'offen',
  '[]', null, '{"tender": {"contractPeriod": {"durationInDays": 100}}}');
select pruefe((select laufzeit_art = 'vertrag' and laufzeit_ende = current_date + 400 from public.vergabekatalog where id = 'test:r1'), 'Vertragsende aus dem Vertrag');
select pruefe((select laufzeit_art = 'geschaetzt' and laufzeit_ende = date '2027-10-15' and verlaengerung_bis = date '2029-10-15' from public.vergabekatalog where id = 'test:r2'), 'Vertragsende aus Zuschlag plus Laufzeit, Verlängerung bis');
select pruefe((select laufzeit_art = 'bekanntmachung' and laufzeit_ende = date '2030-10-31' from public.vergabekatalog where id = 'test:r3'), 'Vertragsende aus der Bekanntmachung');
select pruefe((select laufzeit_ende is null from public.vergabekatalog where id = 'test:r4'), 'Ohne Zuschlag keine geschätzte Laufzeit');
insert into public.vergabekatalog (id,quelle,quelle_id,version,quell_datum,titel,beschreibung,link,auftraggeber,auftraggeber_id,cpv,plz,status) values
('test:r5','bks','r5','1',now(),'Unterhaltsreinigung Kitas 2027','Reinigung','https://example.org/r5','Stadt R','r',array['90919200'],array['10115'],'offen');
update public.vergabekatalog set quell_datum = now() - interval '200 days' where id = 'test:r1';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select array_agg(id order by ende) = array['test:r2','test:r1'] from public.neuausschreibung_radar(:'firma', '(?<!\w)reinigung', '', '{}', array['10'], 24)), 'Radar: passende Verträge im Gebiet, nach Ende sortiert');
select pruefe((select neu_id = 'test:r5' from public.neuausschreibung_radar(:'firma', '(?<!\w)reinigung', '', '{}', array['10'], 24) where id = 'test:r1'), 'Radar erkennt die schon veröffentlichte Neuausschreibung');
select pruefe((select array_agg(id order by ende) = array['test:r1','test:r3'] from public.neuausschreibung_radar(:'firma', '(?!x)x', 'glas', array['9091'], '{}', 60)), 'Radar mit Kennziffern, Ausschluss und 5 Jahren');
select pruefe((select wert = 240000 and gewinner = 'Blitz GmbH' from public.neuausschreibung_radar(:'firma', '(?<!\w)kita', '', '{}', '{}', 24)), 'Radar zeigt Gewinner und Wert');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.neuausschreibung_radar(:'firma', '(?<!\w)reinigung')), 'Fremde bekommen keinen Radar dieser Firma');
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- N4: contract data follows the tender's location rights; N5: buyer contacts per firm; N6: AI costs per firm.
reset role;
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
update public.vorgaenge set status = 'gewonnen' where titel in ('Messe-Catering ITB', 'Hotel Hamburg');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.vertraege (firma_id, vorgang_id, beginn, ende, option_frist, personen_soll)
  values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), '2026-01-01', '2027-12-31', '2027-09-30', 6);
select pruefe((select personen_soll = 6 from public.vertraege), 'Bearbeiter trägt Vertragsdaten im eigenen Bereich ein');
reset role;
select id as hamburg_vorgang from public.vorgaenge where titel = 'Hotel Hamburg' \gset
select set_config('test.hh', :'hamburg_vorgang', false);
set role authenticated;
do $$ begin
  insert into public.vertraege (firma_id, vorgang_id, ende) values (current_setting('test.firma')::uuid, current_setting('test.hh')::uuid, '2027-01-01');
  raise exception 'FEHLER: Vertrag im fremden Bereich';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.vertraege set beginn = '2028-01-01';
  raise exception 'FEHLER: Ende vor Beginn';
exception when check_violation then null; end $$;
insert into public.auftraggeber_kontakte (firma_id, auftraggeber_schluessel, name, telefon) values (:'firma', 'bks:abc', 'Frau Meier', '030 123');
select pruefe((select count(*) = 1 from public.auftraggeber_kontakte), 'Kontakt beim Auftraggeber gespeichert');
select pruefe((select count(*) = 0 from public.ki_kosten_firma(:'firma')), 'Bearbeiter sieht keine KI-Kosten');
reset role;
select pruefe(jarvis_katalog.ki_reservieren_fuer(0.01, 'test', :'firma') is not null, 'KI-Buchung mit Firma');
select pruefe((select count(*) = 1 from jarvis_katalog.ki_kosten where firma_id = :'firma'), 'KI-Buchung ist der Firma zugeordnet');
update public.mitglieder set rolle = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pruefe((select kosten >= 0.01 and anfragen = 1 from public.ki_kosten_firma(:'firma') where zweck = 'test'), 'Admin sieht die KI-Kosten der eigenen Firma');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.vertraege) and (select count(*) = 0 from public.auftraggeber_kontakte) and (select count(*) = 0 from public.ki_kosten_firma(:'firma')), 'Fremde Firma sieht keine Verträge, Kontakte oder Kosten');
reset role;
update public.mitglieder set rolle = 'bearbeiter', aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- N7: text modules per firm; N9: bill of quantities with prices only with finance rights.
reset role;
update public.mitglieder set aktiv = true, finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.textbausteine (firma_id, titel, kategorie, text) values (:'firma', 'Firmenvorstellung', 'Einleitung', '{{FIRMA}} ist seit 2010 am Markt.');
select pruefe((select count(*) = 1 from public.textbausteine), 'Bearbeiter legt einen Textbaustein an');
do $$ begin
  insert into public.leistungsverzeichnisse (firma_id, vorgang_id, dateiname, struktur)
    values (current_setting('test.firma')::uuid, (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), 'LV.X83', '[]');
  raise exception 'FEHLER: LV ohne Finanzfreigabe gespeichert';
exception when insufficient_privilege then null; end $$;
reset role;
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
insert into public.leistungsverzeichnisse (firma_id, vorgang_id, dateiname, struktur, preise)
  values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), 'LV.X83', '[{"k":"p","id":"P1"}]', '{"P1": 12.5}');
select pruefe((select (preise->>'P1')::numeric = 12.5 from public.leistungsverzeichnisse), 'Mit Finanzfreigabe: LV mit Preisen gespeichert');
do $$ begin
  insert into public.leistungsverzeichnisse (firma_id, vorgang_id, dateiname, struktur)
    values (current_setting('test.firma')::uuid, current_setting('test.hh')::uuid, 'LV.X83', '[]');
  raise exception 'FEHLER: LV im fremden Standort';
exception when insufficient_privilege then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.textbausteine) and (select count(*) = 0 from public.leistungsverzeichnisse), 'Fremde Firma sieht keine Textbausteine und kein LV');
reset role;
update public.mitglieder set finanzen = false, aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- N10: typed appointments and bidder questions; N11: partners, requests, prices only with finance rights.
reset role;
update public.mitglieder set aktiv = true, finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.eigene_termine (firma_id, vorgang_id, titel, zeit, art, ort)
  values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), 'Besichtigung Halle 7', now() + interval '3 days', 'besichtigung', 'Halle 7, Tor B');
select pruefe((select art = 'besichtigung' and ort = 'Halle 7, Tor B' from public.eigene_termine where titel = 'Besichtigung Halle 7'), 'Termin mit Art und Ort gespeichert');
insert into public.bieterfragen (firma_id, vorgang_id, frage) values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), 'Ist eine Besichtigung Pflicht?');
update public.bieterfragen set status = 'beantwortet', antwort = 'Nein.' where frage like 'Ist eine%';
select pruefe((select status = 'beantwortet' from public.bieterfragen), 'Bieterfrage gestellt und Antwort eingetragen');
do $$ begin
  insert into public.bieterfragen (firma_id, vorgang_id, frage) values (current_setting('test.firma')::uuid, current_setting('test.hh')::uuid, 'Frage im fremden Standort');
  raise exception 'FEHLER: Bieterfrage im fremden Standort';
exception when insufficient_privilege then null; end $$;
insert into public.partner (firma_id, name, gewerke) values (:'firma', 'Elektro Kaya', array['Elektro']);
insert into public.partner_anfragen (firma_id, vorgang_id, partner_id, los)
  values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), (select id from public.partner where name = 'Elektro Kaya'), 'Los 2');
select pruefe((select count(*) = 1 from public.partner_anfragen), 'Anfrage an Partner gespeichert');
do $$ begin
  insert into public.partner_preise (firma_id, anfrage_id, preis) values (current_setting('test.firma')::uuid, (select id from public.partner_anfragen limit 1), 1000);
  raise exception 'FEHLER: Partnerpreis ohne Finanzfreigabe';
exception when insufficient_privilege then null; end $$;
reset role;
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
insert into public.partner_preise (firma_id, anfrage_id, preis) values (:'firma', (select id from public.partner_anfragen limit 1), 12500);
select pruefe((select preis = 12500 from public.partner_preise), 'Mit Finanzfreigabe: Partnerpreis gespeichert');
reset role;
update public.mitglieder set finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pruefe((select count(*) = 0 from public.partner_preise), 'Ohne Finanzfreigabe kein Partnerpreis sichtbar');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.bieterfragen) and (select count(*) = 0 from public.partner) and (select count(*) = 0 from public.partner_anfragen), 'Fremde Firma sieht keine Bieterfragen, Partner oder Anfragen');
do $$ begin
  insert into public.partner_anfragen (firma_id, vorgang_id, partner_id) select v.firma_id, v.id, (select id from public.partner limit 1) from public.vorgaenge v limit 1;
  if found then raise exception 'FEHLER: fremde Anfrage'; end if;
exception when insufficient_privilege or not_null_violation then null; end $$;
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- T1–T6: company profile for admins, key figures only with finance rights, proofs and instructions per location.
reset role;
update public.mitglieder set aktiv = true, finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.p_hh', :'p_hamburg', false);
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.firmenprofil (firma_id, rechtsform, gruendungsjahr, mitarbeiter) values (:'firma', 'GmbH', 2009, 400);
insert into public.firmen_kennzahlen (firma_id, jahr, umsatz, beschaeftigte) values (:'firma', 2025, 12500000, 390);
insert into public.firmen_zertifikate (firma_id, art, bezeichnung, nummer, gueltig_bis) values (:'firma', 'pq_vob', 'Präqualifikation VOB', '010.123456', '2027-06-30');
insert into public.unterweisungen (firma_id, titel, intervall_monate) values (:'firma', 'Arbeitsschutz', 12);
select pruefe((select count(*) = 1 from public.firmen_kennzahlen), 'Inhaber pflegt Umsatz und Beschäftigte');
update public.firmen set strasse = 'Hauptstraße 1' where id = :'firma';
do $$ begin
  update public.firmen set paket = 'pro' where id = current_setting('test.firma')::uuid;
  raise exception 'FEHLER: Inhaber ändert den Plan selbst';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select pruefe((select strasse = 'Hauptstraße 1' and paket <> 'pro' from public.firmen where id = :'firma'), 'Inhaber ändert die Anschrift, aber nicht den Plan');
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select rechtsform = 'GmbH' from public.firmenprofil) and (select count(*) = 1 from public.firmen_zertifikate), 'Bearbeiter sieht Firmenprofil und Zertifikate');
select pruefe((select count(*) = 0 from public.firmen_kennzahlen), 'Ohne Finanzfreigabe kein Umsatz');
update public.firmenprofil set rechtsform = 'AG';
select pruefe((select rechtsform = 'GmbH' from public.firmenprofil), 'Bearbeiter ändert das Firmenprofil nicht');
update public.personal set beschaeftigung = 'teilzeit', wochenstunden = 20, fuehrerschein = '{B,C1}', sprachen = '{Deutsch,Türkisch}', wohn_plz = '10115' where id = :'p_berlin';
select pruefe((select beschaeftigung = 'teilzeit' and wohn_plz = '10115' from public.personal where id = :'p_berlin'), 'Personalakte mit neuen Feldern gepflegt');
insert into public.personal_nachweise (firma_id, personal_id, bezeichnung, gueltig_bis) values (:'firma', :'p_berlin', 'Staplerschein', '2028-01-31');
insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum) values (:'firma', (select id from public.unterweisungen limit 1), :'p_berlin', '2026-10-15');
select pruefe((select count(*) = 1 from public.personal_nachweise) and (select count(*) = 1 from public.unterweisung_teilnahmen), 'Nachweis und Unterweisung im eigenen Standort');
do $$ begin
  insert into public.personal_nachweise (firma_id, personal_id, bezeichnung) values (current_setting('test.firma')::uuid, current_setting('test.p_hh')::uuid, 'Erste Hilfe');
  raise exception 'FEHLER: Nachweis im fremden Standort';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum) values (current_setting('test.firma')::uuid, (select id from public.unterweisungen limit 1), current_setting('test.p_hh')::uuid, '2026-10-15');
  raise exception 'FEHLER: Unterweisung im fremden Standort';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.personal set wohn_plz = '1011' where vorname = 'Protokoll' and nachname = 'Berlin';
  raise exception 'FEHLER: ungültige PLZ';
exception when check_violation then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.firmenprofil) and (select count(*) = 0 from public.firmen_zertifikate) and (select count(*) = 0 from public.personal_nachweise) and (select count(*) = 0 from public.unterweisungen), 'Fremde Firma sieht weder Profil noch Personalakte');
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- T12–T16: cover, tasks, equipment; a staff member sees and requests only their own data.
reset role;
update public.mitglieder set aktiv = true, rolle = 'bearbeiter' where user_id = '00000000-0000-0000-0000-00000000000b';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'einsatz@perlease.test');
insert into public.mitglieder (firma_id, user_id, rolle, aktiv) values (:'firma', '00000000-0000-0000-0000-0000000000e1', 'mitarbeiter', true);
update public.personal set user_id = '00000000-0000-0000-0000-0000000000e1' where id = :'p_berlin';
insert into public.ueberlassungen (firma_id, personal_id, entleiher, von) values (:'firma', :'p_berlin', 'Messe Berlin', '2026-10-01'), (:'firma', :'p_hamburg', 'Fremder Kunde', '2026-10-01');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.vertretungen (firma_id, user_id, vertreter_id, von, bis) values (:'firma', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '2026-11-10', '2026-11-20');
do $$ begin
  insert into public.vertretungen (firma_id, user_id, vertreter_id, von, bis) values (current_setting('test.firma')::uuid, '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-11-10', '2026-11-20');
  raise exception 'FEHLER: Bearbeiter trägt Vertretung für jemand anderen ein';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.vertretungen (firma_id, user_id, vertreter_id, von, bis) values (current_setting('test.firma')::uuid, '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1', '2026-11-10', '2026-11-20');
  raise exception 'FEHLER: Einsatzkraft als Vertretung';
exception when insufficient_privilege then null; end $$;
insert into public.aufgaben (firma_id, vorgang_id, titel, zustaendig_id, faellig) values (:'firma', (select id from public.vorgaenge where titel = 'Messe-Catering ITB'), 'Preisblatt ausfüllen', '00000000-0000-0000-0000-00000000000b', '2026-11-12');
do $$ begin
  insert into public.aufgaben (firma_id, vorgang_id, titel) values (current_setting('test.firma')::uuid, current_setting('test.hh')::uuid, 'Fremde Aufgabe');
  raise exception 'FEHLER: Aufgabe zu fremder Ausschreibung';
exception when insufficient_privilege then null; end $$;
insert into public.betriebsmittel (firma_id, art, bezeichnung, kennung, naechste_pruefung) values (:'firma', 'fahrzeug', 'VW Crafter', 'B-JV 123', '2027-03-31');
select pruefe((select count(*) = 1 from public.vertretungen) and (select count(*) = 1 from public.aufgaben) and (select count(*) = 1 from public.betriebsmittel), 'Vertretung, Aufgabe und Fahrzeug gespeichert');
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 1 and min(vorname) = 'Protokoll' from public.personal), 'Einsatzkraft sieht nur den eigenen Personaldatensatz');
select pruefe((select count(*) = 2 and bool_and(entleiher like 'Messe Berlin%') from public.ueberlassungen), 'Einsatzkraft sieht nur eigene Einsätze');
insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis, grund, status) values (:'firma', :'p_berlin', current_date + 30, current_date + 40, 'urlaub', 'beantragt');
do $$ begin
  insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis, grund, status) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), current_date + 50, current_date + 51, 'urlaub', 'bestaetigt');
  raise exception 'FEHLER: Einsatzkraft bestätigt den eigenen Urlaub';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis, grund, status) values (current_setting('test.firma')::uuid, current_setting('test.p_hh')::uuid, current_date + 50, current_date + 51, 'urlaub', 'beantragt');
  raise exception 'FEHLER: Urlaub für fremde Person';
exception when insufficient_privilege then null; end $$;
insert into public.personal_nachweise (firma_id, personal_id, bezeichnung, gueltig_bis) values (:'firma', :'p_berlin', 'Erste Hilfe', '2028-05-01');
select pruefe((select count(*) = 2 from public.personal_nachweise), 'Einsatzkraft lädt eigenen Nachweis hoch und sieht ihre Nachweise');
select pruefe((select count(*) = 0 from public.aufgaben) and (select count(*) = 0 from public.betriebsmittel) and (select count(*) = 0 from public.vertretungen) and (select count(*) = 0 from public.unterweisungen), 'Einsatzkraft sieht keine Aufgaben, Geräte, Vertretungen oder Unterweisungs-Liste');
select pruefe((select count(*) = 1 from public.meine_unterweisungen(:'firma') where letzte = '2026-10-15'), 'Einsatzkraft sieht ihre Unterweisungen');
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select pruefe((select count(*) = 0 from public.personal) and (select count(*) = 0 from public.meine_unterweisungen(:'firma')), 'Gesperrte Einsatzkraft sieht nichts mehr');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.aufgaben) and (select count(*) = 0 from public.betriebsmittel) and (select count(*) = 0 from public.vertretungen), 'Fremde Firma sieht nichts davon');
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- T17–T22: time sheets, shifts, notice board, licence checks, digital instructions.
reset role;
update public.mitglieder set aktiv = true, rolle = 'bearbeiter' where user_id = '00000000-0000-0000-0000-00000000000b';
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-0000000000e1';
delete from public.push_warteschlange;
select set_config('test.berlin', :'berlin', false);
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e1');
insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, pause_min, einsatz) values (:'firma', :'p_berlin', current_date - 1, '07:00', '15:30', 30, 'Messe Berlin');
do $$ begin
  insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, status) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), current_date, '07:00', '15:00', 'freigegeben');
  raise exception 'FEHLER: Einsatzkraft gibt eigene Stunden frei';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende) values (current_setting('test.firma')::uuid, current_setting('test.p_hh')::uuid, current_date, '07:00', '15:00');
  raise exception 'FEHLER: Stunden für fremde Person';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), current_date + 3, '07:00', '15:00');
  raise exception 'FEHLER: Stunden in der Zukunft';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.stundenzettel set status = 'freigegeben';
  raise exception 'FEHLER: Einsatzkraft ändert Status auf freigegeben';
exception when insufficient_privilege then null; end $$;
select pruefe((select count(*) = 1 and bool_and(status = 'erfasst') from public.stundenzettel), 'Einsatzkraft erfasst Stunden, kann sie aber nicht freigeben');
select test_als('00000000-0000-0000-0000-00000000000b');
update public.stundenzettel set status = 'freigegeben', freigegeben_von = '00000000-0000-0000-0000-00000000000b', freigegeben_am = now();
select pruefe((select count(*) = 1 and bool_and(status = 'freigegeben') from public.stundenzettel), 'Bearbeiter gibt Stunden am eigenen Standort frei');
insert into public.schichten (firma_id, bereich_id, personal_id, datum, beginn, ende, ort) values (:'firma', :'berlin', :'p_berlin', current_date + 2, '06:00', '14:00', 'Messe Halle 3');
do $$ begin
  insert into public.schichten (firma_id, bereich_id, personal_id, datum, beginn, ende) values (current_setting('test.firma')::uuid, current_setting('test.berlin')::uuid, current_setting('test.p_hh')::uuid, current_date + 2, '06:00', '14:00');
  raise exception 'FEHLER: Schicht für Person am fremden Standort';
exception when insufficient_privilege then null; end $$;
insert into public.mitteilungen (firma_id, titel, text) values (:'firma', 'Betriebsversammlung', 'Freitag 14 Uhr');
do $$ begin
  insert into public.mitteilungen (firma_id, bereich_id, titel) values (current_setting('test.firma')::uuid, (select id from public.bereiche where name = 'Hamburg' limit 1), 'Fremder Standort');
  raise exception 'FEHLER: Bearbeiter Berlin schreibt für Hamburg';
exception when insufficient_privilege then null; end $$;
update public.personal set firmenwagen = true, probezeit_bis = current_date + 20 where id = :'p_berlin';
insert into public.fuehrerschein_kontrollen (firma_id, personal_id, datum, klassen) values (:'firma', :'p_berlin', current_date, '{B}');
reset role;
insert into public.mitteilungen (firma_id, bereich_id, titel) values (:'firma', :'hamburg', 'Nur Hamburg');
select pruefe((select count(*) = 1 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000e1' and titel like '📅 Neue Schicht%'), 'Neue Schicht landet in der Handy-Warteschlange der Einsatzkraft');
select pruefe((select count(*) = 1 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000e1' and titel like '📌%'), 'Einsatzkraft bekommt nur die Mitteilung für alle, nicht die für Hamburg');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 1 from public.schichten) and (select count(*) = 1 from public.fuehrerschein_kontrollen), 'Einsatzkraft sieht eigene Schicht und eigene Führerscheinkontrolle');
select pruefe(public.schicht_antworten((select id from public.schichten), 'zugesagt'), 'Einsatzkraft sagt die Schicht zu');
select pruefe((select antwort = 'zugesagt' from public.schichten), 'Zusage gespeichert');
update public.schichten set datum = current_date + 9, ort = 'geändert';
select pruefe((select ort = 'Messe Halle 3' from public.schichten), 'Einsatzkraft kann die Schicht selbst nicht ändern');
select pruefe((select count(*) = 1 and min(titel) = 'Betriebsversammlung' from public.mitteilungen), 'Einsatzkraft sieht nur Mitteilungen für alle und ihren Standort');
insert into public.mitteilung_gelesen (mitteilung_id, firma_id) values ((select id from public.mitteilungen), :'firma');
do $$ begin
  insert into public.mitteilungen (firma_id, titel) values (current_setting('test.firma')::uuid, 'Von der Einsatzkraft');
  raise exception 'FEHLER: Einsatzkraft schreibt ans Schwarze Brett';
exception when insufficient_privilege then null; end $$;
select pruefe(public.unterweisung_bestaetigen((select id from public.meine_unterweisungen(:'firma') limit 1)), 'Einsatzkraft bestätigt Unterweisung digital');
select pruefe((select bool_or(digital and letzte = (now() at time zone 'Europe/Berlin')::date) from public.meine_unterweisungen(:'firma')), 'Digitale Bestätigung zählt als Teilnahme von heute');
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 1 from public.mitteilung_gelesen), 'Büro sieht, wer gelesen hat');
select pruefe(not public.schicht_antworten((select id from public.schichten), 'abgesagt'), 'Bürokraft kann nicht für die Einsatzkraft antworten');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.stundenzettel) and (select count(*) = 0 from public.schichten) and (select count(*) = 0 from public.mitteilungen) and (select count(*) = 0 from public.fuehrerschein_kontrollen), 'Fremde Firma sieht keine Stunden, Schichten, Mitteilungen oder Kontrollen');
reset role;
-- Idee 39: team chat per firm, location and site (who is in a room = who reads, writes and gets the notification).
delete from public.push_warteschlange;
insert into public.einsatzorte (firma_id, name) values (:'firma', 'Messe Halle 3') returning id as ort_messe \gset
insert into public.einsatzorte (firma_id, name) values (:'firma', 'Hafen Lager') returning id as ort_hafen \gset
update public.schichten set einsatzort_id = :'ort_messe' where personal_id = :'p_berlin';
select set_config('test.ort_hafen', :'ort_hafen', false);
select set_config('test.hamburg', :'hamburg', false);
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.chat_nachrichten (firma_id, text) values (:'firma', 'Hallo zusammen');
insert into public.chat_nachrichten (firma_id, bereich_id, text) values (:'firma', :'berlin', 'Berlin: Schlüssel liegt im Büro');
insert into public.chat_nachrichten (firma_id, einsatzort_id, text) values (:'firma', :'ort_messe', 'Treffpunkt Eingang Süd');
do $$ begin
  insert into public.chat_nachrichten (firma_id, bereich_id, text) values (current_setting('test.firma')::uuid, current_setting('test.hamburg')::uuid, 'Hamburg?');
  raise exception 'FEHLER: Bearbeiter Berlin schreibt in den Hamburg-Chat';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.chat_nachrichten (firma_id, text, user_id) values (current_setting('test.firma')::uuid, 'Unter fremdem Namen', '00000000-0000-0000-0000-00000000000a');
  raise exception 'FEHLER: Chat-Nachricht unter fremdem Namen';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.chat_nachrichten (firma_id, bereich_id, einsatzort_id, text) values (current_setting('test.firma')::uuid, current_setting('test.berlin')::uuid, current_setting('test.ort_hafen')::uuid, 'Beides');
  raise exception 'FEHLER: Nachricht in zwei Räumen';
exception when insufficient_privilege or check_violation then null; end $$;
reset role;
select pruefe((select count(*) = 3 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000e1' and titel like '💬%'), 'Einsatzkraft bekommt Handy-Nachrichten aus Firma, eigenem Standort und eigenem Einsatzort');
select pruefe((select count(*) = 0 from public.push_warteschlange where user_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c') and titel like '💬%'), 'Keine Chat-Nachricht an den Absender oder an fremde Firmen');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 3 from public.chat_nachrichten), 'Einsatzkraft liest Firma, eigenen Standort und eigenen Einsatzort');
insert into public.chat_nachrichten (firma_id, einsatzort_id, text) values (:'firma', :'ort_messe', 'Bin unterwegs');
do $$ begin
  insert into public.chat_nachrichten (firma_id, einsatzort_id, text) values (current_setting('test.firma')::uuid, current_setting('test.ort_hafen')::uuid, 'Fremder Einsatzort');
  raise exception 'FEHLER: Einsatzkraft schreibt in den Chat eines fremden Einsatzorts';
exception when insufficient_privilege then null; end $$;
select pruefe((select bool_or(name = 'Ganze Firma') and bool_or(name = 'Messe Halle 3') and not bool_or(name in ('Hamburg', 'Hafen Lager')) from public.meine_chats(:'firma')), 'Räume der Einsatzkraft: Firma, Standort, eigener Einsatzort');
select pruefe((select sum(ungelesen) = 3 from public.meine_chats(:'firma')), 'Ungelesen zählt fremde Nachrichten, nicht die eigene');
insert into public.chat_gelesen (firma_id, raum) values (:'firma', 'firma');
select pruefe((select ungelesen = 0 from public.meine_chats(:'firma') where bereich_id is null and einsatzort_id is null), 'Nach dem Öffnen ist der Firmen-Chat gelesen');
delete from public.chat_nachrichten where text = 'Hallo zusammen';
select pruefe((select count(*) = 1 from public.chat_nachrichten where text = 'Hallo zusammen'), 'Einsatzkraft löscht keine fremde Nachricht');
delete from public.chat_nachrichten where text = 'Bin unterwegs';
select pruefe((select count(*) = 0 from public.chat_nachrichten where text = 'Bin unterwegs'), 'Einsatzkraft zieht eigene Nachricht zurück');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.chat_nachrichten) and (select count(*) = 0 from public.chat_gelesen) and (select count(*) = 0 from public.meine_chats(:'firma')), 'Fremde Firma sieht keinen Chat');
reset role;
update public.schichten set datum = current_date - 20 where personal_id = :'p_berlin';
update public.mitglieder set rolle = 'leser' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 2 from public.chat_nachrichten) and not exists (select 1 from public.meine_chats(:'firma') where name = 'Messe Halle 3'), 'Nach 14 Tagen ohne Schicht ist der Einsatzort-Chat weg');
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 0 from public.chat_nachrichten) and (select count(*) = 0 from public.meine_chats(:'firma')), 'Leser (Steuerbüro) ist in keinem Chat');
select test_als('00000000-0000-0000-0000-00000000000a');
delete from public.chat_nachrichten where text = 'Treffpunkt Eingang Süd';
select pruefe((select count(*) = 2 from public.chat_nachrichten), 'Inhaber kann jede Nachricht entfernen');
reset role;
update public.mitglieder set rolle = 'bearbeiter' where user_id = '00000000-0000-0000-0000-00000000000b';
update public.mitglieder set aktiv = false where user_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1');
select set_config('test.uid', '', false);

-- T29–T33: customers and sites, hourly rate only with finance access, site info for staff, short-notice absence.
reset role;
update public.mitglieder set aktiv = true, rolle = 'bearbeiter', finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-0000000000e1';
delete from public.push_warteschlange;
delete from public.personal_abwesenheiten where personal_id = :'p_berlin' and status = 'bestaetigt';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.kunden (firma_id, bereich_id, name, ort) values (:'firma', :'berlin', 'Messe Berlin GmbH', 'Berlin') returning id as kunde_berlin \gset
do $$ begin
  insert into public.kunden (firma_id, bereich_id, name) values (current_setting('test.firma')::uuid, (select id from public.bereiche where name = 'Hamburg' limit 1), 'Fremder Kunde');
  raise exception 'FEHLER: Bearbeiter Berlin legt Kunden in Hamburg an';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.kunden_preise (firma_id, kunde_id, satz) values (current_setting('test.firma')::uuid, (select id from public.kunden limit 1), 32.5);
  raise exception 'FEHLER: Verrechnungssatz ohne Finanzfreigabe';
exception when insufficient_privilege then null; end $$;
insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, treffpunkt, kleidung) values (:'firma', :'kunde_berlin', 'Messe Halle 3', 'Messedamm 22', '14055', 'Berlin', 'Eingang Süd', 'Schwarz, Sicherheitsschuhe') returning id as ort_halle \gset
-- ausfall_melden counts today in Berlin time; the shift and the reports use the same day (also after 23:00 UTC).
insert into public.schichten (firma_id, bereich_id, personal_id, einsatzort_id, datum, beginn, ende, ort) values (:'firma', :'berlin', :'p_berlin', :'ort_halle', (now() at time zone 'Europe/Berlin')::date, '06:00', '14:00', 'Messe Halle 3');
insert into public.einsatzorte (firma_id, kunde_id, name) values (:'firma', :'kunde_berlin', 'Messe Halle 7');
reset role;
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.kunden_preise (firma_id, kunde_id, satz) values (:'firma', :'kunde_berlin', 32.5);
select pruefe((select count(*) = 1 from public.kunden_preise), 'Mit Finanzfreigabe Verrechnungssatz speichern');
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 0 from public.kunden) and (select count(*) = 0 from public.kunden_preise), 'Einsatzkraft sieht keine Kunden und keine Preise');
select pruefe((select count(*) = 1 and min(treffpunkt) = 'Eingang Süd' from public.einsatzorte), 'Einsatzkraft sieht nur den Einsatzort ihrer Schicht');
insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, pause_min, einsatz) values (:'firma', :'p_berlin', current_date, '06:00', '14:00', 30, 'Messe Halle 3');
reset role;
select pruefe((select kunde_id = :'kunde_berlin' from public.stundenzettel where datum = current_date and einsatz = 'Messe Halle 3'), 'Stunden der Einsatzkraft werden über den Einsatzort dem Kunden zugeordnet');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe(public.ausfall_melden((now() at time zone 'Europe/Berlin')::date + 3, '') = -1, 'Ausfall nur für heute oder morgen');
select pruefe(public.ausfall_melden((now() at time zone 'Europe/Berlin')::date, 'Kind krank') = 1, 'Ausfall gemeldet, eine Schicht abgesagt');
select pruefe((select count(*) = 0 from public.personal_abwesenheiten where kurzfristig and notiz <> ''), 'Ausfall speichert keinen Grund (Art. 9 DSGVO)');
select pruefe(public.ausfall_melden((now() at time zone 'Europe/Berlin')::date, '') = -2, 'Ausfall nicht doppelt');
select pruefe((select antwort = 'abgesagt' from public.schichten where datum = (now() at time zone 'Europe/Berlin')::date), 'Schicht des Tages ist abgesagt');
reset role;
select pruefe((select count(*) = 1 and bool_and(kurzfristig and status = 'bestaetigt') from public.personal_abwesenheiten where personal_id = :'p_berlin' and von = (now() at time zone 'Europe/Berlin')::date), 'Kurzfristiger Ausfall als Abwesenheit gespeichert');
select pruefe((select count(*) >= 2 from public.push_warteschlange where titel like '🚨 Ausfall%') and not exists (select 1 from public.push_warteschlange where titel like '🚨 Ausfall%' and user_id = '00000000-0000-0000-0000-0000000000e1'), 'Ausfall geht an Planer und Leitung, nicht an die Einsatzkraft selbst');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.kunden) and (select count(*) = 0 from public.einsatzorte) and (select count(*) = 0 from public.kunden_preise), 'Fremde Firma sieht keine Kunden, Orte oder Preise');
select pruefe(public.ausfall_melden((now() at time zone 'Europe/Berlin')::date, '') = -1, 'Ohne eigene Personalakte kein Ausfall');
reset role;
-- Idea 11: patrol checkpoints and guard log.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.kontrollpunkte (firma_id, einsatzort_id, name) values (:'firma', :'ort_halle', 'Notausgang Nord') returning token as kp_token \gset
select set_config('test.kp', :'kp_token', false);
select set_config('test.p_berlin', :'p_berlin', false);
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 0 from public.kontrollpunkte), 'Einsatzkraft sieht keine Kontrollpunkte (Token geheim)');
select pruefe(public.rundgang_scannen(:'kp_token')->>'punkt' = 'Notausgang Nord', 'Einsatzkraft scannt Kontrollpunkt');
select pruefe(public.rundgang_scannen(:'kp_token') is not null and (select count(*) = 1 from public.rundgang_scans), 'Doppelscan innerhalb einer Minute zählt einmal, eigener Scan sichtbar');
select pruefe(public.rundgang_scannen('falsch') is null, 'Unbekannter Kontrollpunkt');
insert into public.wachbuch (firma_id, einsatzort_id, personal_id, art, text) values (:'firma', :'ort_halle', :'p_berlin', 'vorfall', 'Tür 3 offen vorgefunden, verschlossen');
do $$ begin
  insert into public.wachbuch (firma_id, personal_id, text, zeit) values (current_setting('test.firma')::uuid, current_setting('test.p_berlin', true)::uuid, 'rückdatiert', now() - interval '1 day');
  raise exception 'FEHLER: Wachbuch rückdatierbar';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.wachbuch set text = 'geändert';
  if found then raise exception 'FEHLER: Wachbuch nachträglich änderbar'; end if;
exception when insufficient_privilege then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe(public.rundgang_scannen(current_setting('test.kp')) is null and (select count(*) = 0 from public.wachbuch) and (select count(*) = 0 from public.rundgang_scans), 'Fremde Firma: kein Scan, kein Wachbuch');
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*) = 1 from public.rundgang_scans) and (select count(*) = 1 and min(art) = 'vorfall' from public.wachbuch), 'Büro sieht Scans und Wachbuch');
reset role;
update public.mitglieder set aktiv = false, finanzen = false where user_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1');
select set_config('test.uid', '', false);

-- T23–T27: PSA, applicants, checklists, leave accounts, ratings.
reset role;
update public.mitglieder set aktiv = true, rolle = 'bearbeiter' where user_id = '00000000-0000-0000-0000-00000000000b';
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.psa_ausgaben (firma_id, personal_id, artikel, groesse, ausgegeben, austausch) values (:'firma', :'p_berlin', 'Sicherheitsschuhe S3', '43', current_date, current_date + 365);
do $$ begin
  insert into public.psa_ausgaben (firma_id, personal_id, artikel, ausgegeben) values (current_setting('test.firma')::uuid, current_setting('test.p_hh')::uuid, 'Helm', current_date);
  raise exception 'FEHLER: PSA für Person am fremden Standort';
exception when insufficient_privilege then null; end $$;
insert into public.bewerber (firma_id, bereich_id, vorname, nachname, beruf) values (:'firma', :'berlin', 'Bea', 'Bewerberin', 'Servicekraft') returning id as bew \gset
update public.bewerber set status = 'absage' where id = :'bew';
select pruefe((select loeschen_ab = (now() at time zone 'Europe/Berlin')::date + 183 from public.bewerber where id = :'bew'), 'Absage setzt Löschdatum in 6 Monaten');
update public.bewerber set status = 'gespraech' where id = :'bew';
select pruefe((select loeschen_ab is null from public.bewerber where id = :'bew'), 'Zurück ins Gespräch hebt das Löschdatum auf');
do $$ begin
  insert into public.bewerber (firma_id, bereich_id, vorname) values (current_setting('test.firma')::uuid, (select id from public.bereiche where name = 'Hamburg' limit 1), 'Fremd');
  raise exception 'FEHLER: Bewerber am fremden Standort';
exception when insufficient_privilege then null; end $$;
insert into public.bewerber_dateien (firma_id, bewerber_id, name, mime, groesse) values (:'firma', :'bew', 'Lebenslauf.pdf', 'application/pdf', 1000);
insert into public.checklisten_punkte (firma_id, personal_id, art, titel) values (:'firma', :'p_berlin', 'einstieg', 'Arbeitsvertrag unterschrieben');
insert into public.urlaubskonten (firma_id, personal_id, jahr, anspruch, uebertrag) values (:'firma', :'p_berlin', 2026, 26, 3);
insert into public.einsatz_bewertungen (firma_id, personal_id, kunde_id, datum, sterne, wieder) values (:'firma', :'p_berlin', (select id from public.kunden limit 1), current_date, 5, 'ja');
select pruefe((select count(*) = 1 from public.psa_ausgaben) and (select count(*) = 1 from public.bewerber) and (select count(*) = 1 from public.checklisten_punkte) and (select count(*) = 1 from public.urlaubskonten) and (select count(*) = 1 from public.einsatz_bewertungen), 'PSA, Bewerber, Checkliste, Urlaubskonto und Bewertung gespeichert');
reset role;
update public.mitglieder set rolle = 'leser' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 0 from public.bewerber) and (select count(*) = 0 from public.bewerber_dateien), 'Leser sieht keine Bewerber');
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 1 from public.psa_ausgaben) and (select count(*) = 1 and min(anspruch) = 26 from public.urlaubskonten), 'Einsatzkraft sieht eigene PSA und ihr Urlaubskonto');
select pruefe((select count(*) = 0 from public.einsatz_bewertungen) and (select count(*) = 0 from public.bewerber) and (select count(*) = 0 from public.checklisten_punkte), 'Einsatzkraft sieht keine Bewertungen, Bewerber oder Checklisten');
do $$ begin
  insert into public.urlaubskonten (firma_id, personal_id, jahr, anspruch) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), 2027, 60);
  raise exception 'FEHLER: Einsatzkraft setzt sich Urlaubsanspruch';
exception when insufficient_privilege then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.psa_ausgaben) and (select count(*) = 0 from public.bewerber) and (select count(*) = 0 from public.urlaubskonten) and (select count(*) = 0 from public.einsatz_bewertungen), 'Fremde Firma sieht nichts davon');
reset role;
update public.mitglieder set aktiv = false where user_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1');
select set_config('test.uid', '', false);

-- T34–T45: invoices, expenses, time account, signatures, customer link, time clock, link invitations, open shifts.
reset role;
update public.mitglieder set aktiv = true, rolle = 'bearbeiter', finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-0000000000e1';
delete from public.push_warteschlange;
delete from public.personal_abwesenheiten where personal_id = :'p_berlin';
update public.personal set berufe = '{Servicekraft}', status = 'verfuegbar' where id = :'p_berlin';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into public.rechnungen (firma_id, nummer, monat, datum) values (current_setting('test.firma')::uuid, 'ENTWURF-1', '2026-11', current_date);
  raise exception 'FEHLER: Rechnung ohne Finanzfreigabe';
exception when insufficient_privilege then null; end $$;
insert into public.schichten (firma_id, bereich_id, datum, beginn, ende, ort, beruf) values (:'firma', :'berlin', current_date + 5, '06:00', '14:00', 'Offen Berlin', 'Servicekraft') returning id as offen_ok \gset
insert into public.schichten (firma_id, bereich_id, datum, beginn, ende, ort, beruf) values (:'firma', :'berlin', current_date + 5, '06:00', '14:00', 'Nur Köche', 'Koch') returning id as offen_koch \gset
select set_config('test.offen_koch', :'offen_koch', false);
reset role;
select pruefe((select count(*) = 1 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000e1' and titel like '🔓 Offene Schicht%'), 'Offene Schicht wird nur passenden Einsatzkräften gemeldet');
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
-- GoBD (Rechtsprüfung 03.11.2026): draft → issue with counter number → frozen; cancel instead of delete.
do $$ begin
  insert into public.rechnungen (firma_id, nummer, monat, datum) values (current_setting('test.firma')::uuid, 'RE-2026-0099', '2026-11', current_date);
  raise exception 'FEHLER: Rechnung mit eigener Nummer statt Entwurf';
exception when check_violation or insufficient_privilege then null; end $$;
do $$ begin
  insert into public.rechnungen (firma_id, nummer, monat, datum, status) values (current_setting('test.firma')::uuid, 'ENTWURF-x', '2026-11', current_date, 'ausgestellt');
  raise exception 'FEHLER: Rechnung direkt als ausgestellt angelegt';
exception when check_violation or insufficient_privilege then null; end $$;
insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, netto) values (:'firma', :'kunde_berlin', 'ENTWURF-a1', '2026-11', current_date, 100) returning id as re1 \gset
insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, netto) values (:'firma', :'kunde_berlin', 'ENTWURF-a2', '2026-11', current_date, 50) returning id as re_weg \gset
do $$ begin
  perform public.rechnung_ausstellen((select id from public.rechnungen where nummer = 'ENTWURF-a1'));
  raise exception 'FEHLER: Ausstellen ohne Steuernummer';
exception when raise_exception then null; end $$;
reset role;
update public.firmen set strasse = 'Teststr. 1', plz = '10115', ort = 'Berlin' where id = :'firma';
insert into public.firmenprofil (firma_id, steuernummer) values (:'firma', '12/345/67890') on conflict (firma_id) do update set steuernummer = excluded.steuernummer;
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select public.rechnung_ausstellen(:'re1') as nr1 \gset
select pruefe(:'nr1' = 'RE-' || extract(year from now() at time zone 'Europe/Berlin')::int || '-0001', 'Ausstellen vergibt die erste Nummer aus dem Zähler');
select pruefe((select status = 'ausgestellt' and absender->>'steuernummer' = '12/345/67890' and empfaenger->>'name' is not null and ust_betrag = 19 from public.rechnungen where id = :'re1'), 'Ausgestellte Rechnung friert Absender, Empfänger und Steuer ein');
delete from public.rechnungen where id = :'re_weg';
select pruefe((select count(*) = 0 from public.rechnungen where id = :'re_weg'), 'Entwurf lässt sich löschen');
do $$ begin
  delete from public.rechnungen where nummer like 'RE-%';
  raise exception 'FEHLER: ausgestellte Rechnung gelöscht';
exception when insufficient_privilege then null; end $$;
update public.rechnungen set bezahlt_am = current_date, mahnstufe = 1, gemahnt_am = current_date where id = :'re1';
select pruefe((select bezahlt_am = current_date and mahnstufe = 1 from public.rechnungen where id = :'re1'), 'Zahlungsstatus und Mahnstufe änderbar (Finanzfreigabe)');
reset role;
update public.firmenprofil set steuernummer = '99/999/99999', kleinunternehmer = true where firma_id = :'firma';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select absender->>'steuernummer' = '12/345/67890' and not kleinunternehmer and ust_betrag = 19 from public.rechnungen where id = :'re1'), 'Spätere Änderung im Firmenprofil ändert alte Rechnungen nicht');
select public.rechnung_stornieren(:'re1') as nr2 \gset
select pruefe((select art = 'storno' and netto = -100 and ust_betrag = -19 and bezug_nummer = :'nr1' from public.rechnungen where nummer = :'nr2') and (select storniert_durch is not null from public.rechnungen where id = :'re1'), 'Storno erzeugt Gegenrechnung mit eigener Nummer');
select pruefe(right(:'nr2', 4) = '0002', 'Storno-Nummer folgt lückenlos');
do $$ begin
  perform public.rechnung_stornieren((select id from public.rechnungen where art = 'rechnung' and status = 'ausgestellt' limit 1));
  raise exception 'FEHLER: doppelt storniert';
exception when raise_exception then null; end $$;
reset role;
update public.firmenprofil set kleinunternehmer = false where firma_id = :'firma';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.rechnungsvorlagen (firma_id, kunde_id, text, betrag) values (:'firma', :'kunde_berlin', 'Unterhaltsreinigung pauschal', 1200);
insert into public.belege (firma_id, datum, lieferant, kategorie, brutto) values (:'firma', current_date, 'Tankstelle', 'fahrzeug', 80);
select pruefe((select count(*) = 1 from public.belege), 'Beleg mit Finanzfreigabe erfassen');
select pruefe((select count(*) = 1 from public.rechnungsvorlagen), 'Rechnungsvorlage mit Finanzfreigabe anlegen');
do $$ begin
  update public.rechnungen set netto = 1 where nummer like 'RE-%';
  raise exception 'FEHLER: Rechnungsbetrag nachträglich änderbar';
exception when insufficient_privilege then null; end $$;
insert into public.nachweis_freigaben (firma_id, monat, titel, inhalt, token_hash) values (:'firma', '2026-11', 'Messe Berlin', '{"zeilen":[]}', encode(sha256(convert_to('geheim-123', 'UTF8')), 'hex'));
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 1 and min(ort) = 'Offen Berlin' from public.schichten where personal_id is null), 'Einsatzkraft sieht nur passende offene Schichten');
select pruefe(public.schicht_uebernehmen(current_setting('test.offen_koch')::uuid) = 'nicht_passend', 'Unpassende Schicht ist für die Einsatzkraft nicht übernehmbar');
select pruefe(public.schicht_uebernehmen(:'offen_ok') = 'ok', 'Einsatzkraft übernimmt offene Schicht');
select pruefe(public.schicht_uebernehmen(:'offen_ok') = 'vergeben', 'Zweites Übernehmen geht nicht');
insert into public.spesen (firma_id, personal_id, datum, art, betrag) values (:'firma', :'p_berlin', current_date, 'parken', 4.5);
do $$ begin
  insert into public.spesen (firma_id, personal_id, datum, betrag, status) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), current_date, 10, 'freigegeben');
  raise exception 'FEHLER: Einsatzkraft gibt eigene Spesen frei';
exception when insufficient_privilege then null; end $$;
insert into public.stempel (firma_id, personal_id, art) values (:'firma', :'p_berlin', 'kommen');
do $$ begin
  insert into public.stempel (firma_id, personal_id, art, zeit) values (current_setting('test.firma')::uuid, (select id from public.personal limit 1), 'gehen', now() - interval '3 hours');
  raise exception 'FEHLER: Stempelzeit zurückdatiert';
exception when insufficient_privilege then null; end $$;
insert into public.unterschriften (firma_id, personal_id, art, bezug) values (:'firma', :'p_berlin', 'psa', '2026-11');
select pruefe((select count(*) = 0 from public.rechnungen) and (select count(*) = 0 from public.rechnungsvorlagen) and (select count(*) = 0 from public.belege) and (select count(*) = 0 from public.nachweis_freigaben), 'Einsatzkraft sieht keine Rechnungen, Vorlagen, Belege und keine Kundenlinks');
reset role;
set role anon;
select pruefe((select count(*) = 1 from public.nachweis_abrufen('geheim-123')) and (select count(*) = 0 from public.nachweis_abrufen('falsch')), 'Kundenlink funktioniert nur mit dem richtigen Schlüssel');
select pruefe(public.nachweis_bestaetigen('geheim-123', 'Frau Meier', '', false, false) is not null, 'Kunde bestätigt ohne Anmeldung');
select pruefe(public.nachweis_bestaetigen('geheim-123', 'Noch mal', '', false, false) is null, 'Zweite Bestätigung geht nicht');
do $$ begin
  perform 1 from public.nachweis_freigaben;
  raise exception 'FEHLER: anonym lesbar';
exception when insufficient_privilege then null; end $$;
reset role;
-- Idea 40: customer portal (secret link per customer, read and report without login).
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, netto) values (:'firma', :'kunde_berlin', 'ENTWURF-p1', '2026-11', current_date, 500) returning id as re_portal \gset
select public.rechnung_ausstellen(:'re_portal');
insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, netto) values (:'firma', :'kunde_berlin', 'ENTWURF-p2', '2026-11', current_date, 7);
insert into public.nachweis_freigaben (firma_id, kunde_id, monat, titel, inhalt, token_hash) values (:'firma', :'kunde_berlin', '2026-10', 'Messe Berlin GmbH', '{"zeilen":[{"name":"Protokoll Berlin"}],"summe":{"std":12.5}}', encode(sha256(convert_to('nachweis-portal', 'UTF8')), 'hex'));
insert into public.kunden_portale (firma_id, kunde_id, token_hash, rechnungen_zeigen, berichte_zeigen) values (:'firma', :'kunde_berlin', encode(sha256(convert_to('portal-geheim-1', 'UTF8')), 'hex'), true, true);
select test_als('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  insert into public.kunden_portale (firma_id, kunde_id, token_hash) values (current_setting('test.firma')::uuid, (select id from public.kunden limit 1), 'x');
  raise exception 'FEHLER: Einsatzkraft legt Kundenportal an';
exception when insufficient_privilege then null; end $$;
reset role;
update public.mitglieder set finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
update public.kunden_portale set rechnungen_zeigen = false;
do $$ begin
  update public.kunden_portale set rechnungen_zeigen = true;
  raise exception 'FEHLER: Rechnungen im Portal ohne Finanzfreigabe einschaltbar';
exception when insufficient_privilege then null; end $$;
reset role;
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
update public.kunden_portale set rechnungen_zeigen = true;
set role anon;
select pruefe(public.portal_abrufen('falsch') is null, 'Portal nur mit richtigem Link');
select pruefe((select (d->>'kunde') = 'Messe Berlin GmbH' and jsonb_array_length(d->'rechnungen') = 3 and d::text not like '%ENTWURF%' and (d->'rechnungen'->0->>'nummer') like 'RE-%-0003'
  and jsonb_array_length(d->'nachweise') = 1 and (d->'nachweise'->0->'summe'->>'std') = '12.5' and d::text not like '%Protokoll Berlin%'
  and jsonb_array_length(d->'vorfaelle') = 1 and not (d->'vorfaelle'->0 ? 'text') and (d->'orte'->0->>'scans')::int = 1 from public.portal_abrufen('portal-geheim-1') d),
  'Portal zeigt nur Rechnungen, Summen und Berichte dieses Kunden, keine Namen');
select pruefe(public.portal_melden('portal-geheim-1', 'mangel', 'Mülleimer in Halle 3 nicht geleert', 'Frau Meier'), 'Kunde meldet Mangel ohne Anmeldung');
select pruefe(not public.portal_melden('falsch', 'mangel', 'Test Test', '') and not public.portal_melden('portal-geheim-1', 'quatsch', 'Test Test', ''), 'Melden nur mit gültigem Link und gültiger Art');
do $$ begin
  perform 1 from public.kunden_meldungen;
  raise exception 'FEHLER: Meldungen anonym lesbar';
exception when insufficient_privilege then null; end $$;
reset role;
select pruefe((select count(*) = 1 from public.push_warteschlange where titel = '⚠️ Mangel gemeldet' and user_id = '00000000-0000-0000-0000-00000000000b'), 'Büro bekommt Handy-Nachricht zur Meldung');
do $$ begin for i in 1..12 loop perform public.portal_melden('portal-geheim-1', 'wunsch', 'Wunsch Nummer ' || i, ''); end loop; end $$;
select pruefe((select count(*) = 10 from public.kunden_meldungen), 'Höchstens 10 Meldungen pro Tag');
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
update public.kunden_meldungen set erledigt_am = now() where art = 'mangel';
do $$ begin
  update public.kunden_meldungen set text = 'geändert';
  raise exception 'FEHLER: Kundenmeldung inhaltlich änderbar';
exception when insufficient_privilege then null; end $$;
select pruefe((select count(*) = 1 from public.kunden_meldungen where erledigt_am is not null), 'Büro hakt Meldung ab');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.kunden_portale) and (select count(*) = 0 from public.kunden_meldungen), 'Fremde Firma sieht keine Portale und Meldungen');
reset role;
update public.kunden_portale set aktiv = false;
select pruefe(public.portal_abrufen('portal-geheim-1') is null, 'Gesperrter Portal-Link zeigt nichts');
-- DATEV settings in the firm profile: only admins, numbers checked.
insert into public.firmenprofil (firma_id) values (:'firma') on conflict do nothing;
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
update public.firmenprofil set datev_berater = '1234567', datev_mandant = '42', datev_skr = '04', lohnarten = '{"stunden":"1000"}' where firma_id = :'firma';
select pruefe((select datev_skr = '04' and lohnarten->>'stunden' = '1000' from public.firmenprofil where firma_id = :'firma'), 'Inhaber trägt DATEV-Daten ein');
do $$ begin
  update public.firmenprofil set datev_berater = '12' where firma_id = current_setting('test.firma')::uuid;
  raise exception 'FEHLER: ungültige Beraternummer gespeichert';
exception when check_violation then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000b');
update public.firmenprofil set datev_mandant = '99' where firma_id = :'firma';
select pruefe((select datev_mandant = '42' from public.firmenprofil where firma_id = :'firma'), 'Bearbeiter ändert DATEV-Daten nicht');
reset role;
-- Tax adviser: reader with finance access reads invoices and receipts, changes nothing; reader without finance sees nothing.
update public.mitglieder set rolle = 'leser', finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) >= 1 from public.rechnungen) and (select count(*) = 1 from public.belege), 'Steuerbüro (Leser mit Finanzfreigabe) liest Rechnungen und Belege');
do $$ begin
  insert into public.belege (firma_id, datum, brutto) values (current_setting('test.firma')::uuid, current_date, 1);
  raise exception 'FEHLER: Leser legt Beleg an';
exception when insufficient_privilege then null; end $$;
delete from public.rechnungen; delete from public.belege;
reset role;
select pruefe((select count(*) >= 2 from public.rechnungen) and (select count(*) = 1 from public.belege), 'Leser löscht nichts');
-- Rechtsprüfung D1: the tax adviser keeps names for payroll but no certificates, guard book, time-clock events.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) >= 1 from public.personal) and (select count(*) = 0 from public.personal_nachweise) and (select count(*) = 0 from public.wachbuch)
  and (select count(*) = 0 from public.stempel) and (select count(*) = 0 from public.rundgang_scans), 'Steuerbüro sieht Namen, aber keine Nachweise, Wachbuch, Stempel und Rundgänge');
reset role;
update public.mitglieder set finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 0 from public.rechnungen) and (select count(*) = 0 from public.belege), 'Leser ohne Finanzfreigabe sieht keine Rechnungen und Belege');
reset role;
update public.mitglieder set rolle = 'bearbeiter', finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
-- Idea 26: job exchange between firms (switched off in the web app until the terms are checked).
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'partner@boerse.test');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000f1');
select public.firma_anlegen('Selbst GmbH') as selbst \gset
select set_config('test.selbst', :'selbst', false);
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.boerse_auftraege (firma_id, titel, gewerk, plz, ort) values (:'firma', 'Glasreinigung Bürohaus', 'Reinigung', '10115', 'Berlin') returning id as job \gset
select set_config('test.job', :'job', false);
do $$ begin
  insert into public.boerse_interessen (auftrag_id, firma_id) values (current_setting('test.job')::uuid, current_setting('test.firma')::uuid);
  raise exception 'FEHLER: Interesse am eigenen Auftrag';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.boerse_auftraege (firma_id, titel, ablauf) values (current_setting('test.firma')::uuid, 'Zu lang', current_date + 400);
  raise exception 'FEHLER: Börsen-Auftrag länger als 90 Tage';
exception when insufficient_privilege then null; end $$;
select test_als('00000000-0000-0000-0000-0000000000f1');
select pruefe((select count(*) = 1 from public.boerse_auftraege) and (select name = 'Perlease GmbH' from public.boerse_firmennamen(array[current_setting('test.firma')::uuid])), 'Andere Firma sieht offenen Auftrag mit Firmennamen');
select pruefe((select count(*) = 0 from public.firmen where id = :'firma'), 'Firmendaten selbst bleiben unsichtbar');
insert into public.boerse_interessen (auftrag_id, firma_id, nachricht) values (:'job', :'selbst', 'Wir haben freie Kapazität') returning id as interesse \gset
select pruefe((select count(*) = 0 from public.boerse_kontakt(:'interesse')), 'Kein Kontakt vor der Annahme');
update public.boerse_interessen set status = 'angenommen' where id = :'interesse';
select pruefe((select status = 'offen' from public.boerse_interessen where id = :'interesse'), 'Interessent nimmt sich nicht selbst an');
do $$ begin
  update public.boerse_auftraege set titel = 'gekapert';
  if found then raise exception 'FEHLER: fremder Börsen-Auftrag änderbar'; end if;
end $$;
insert into public.boerse_meldungen (auftrag_id, grund) values (:'job', 'Verdacht auf Scheinselbstständigkeit');
select test_als('00000000-0000-0000-0000-00000000000a');
select pruefe((select count(*) = 1 from public.boerse_interessen) and (select name = 'Selbst GmbH' from public.boerse_firmennamen(array[current_setting('test.selbst')::uuid])), 'Auftraggeber sieht Interesse und Firmennamen');
do $$ begin
  perform 1 from public.boerse_meldungen;
  raise exception 'FEHLER: Börsen-Meldungen für Firmen lesbar';
exception when insufficient_privilege then null; end $$;
update public.boerse_interessen set status = 'angenommen' where id = :'interesse';
select pruefe((select firma = 'Selbst GmbH' from public.boerse_kontakt(:'interesse')), 'Nach Annahme: Kontakt des Interessenten');
select test_als('00000000-0000-0000-0000-0000000000f1');
select pruefe((select firma = 'Perlease GmbH' from public.boerse_kontakt(:'interesse')), 'Nach Annahme: Kontakt des Auftraggebers');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.boerse_auftraege) and (select count(*) = 0 from public.boerse_firmennamen(array[current_setting('test.firma')::uuid])) and (select count(*) = 0 from public.boerse_kontakt(current_setting('test.job')::uuid)), 'Ohne Firma: keine Börse');
reset role;
select pruefe((select count(*) = 1 from public.push_warteschlange where titel = '🤝 Interesse an deinem Auftrag' and user_id = '00000000-0000-0000-0000-00000000000a'), 'Auftraggeber bekommt Handy-Nachricht zum Interesse');
-- Idea 41: wages per person and cost factors only with finance access.
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
insert into public.personal_loehne (personal_id, firma_id, stundenlohn) values (:'p_berlin', :'firma', 16.5);
insert into public.nachkalkulation_werte (firma_id, lohn) values (:'firma', 15.5);
do $$ begin
  insert into public.personal_loehne (personal_id, firma_id, stundenlohn) values (current_setting('test.p_hh')::uuid, current_setting('test.firma')::uuid, 20);
  raise exception 'FEHLER: Lohn für Person am fremden Standort';
exception when insufficient_privilege then null; end $$;
select pruefe((select count(*) = 1 from public.personal_loehne) and (select count(*) = 1 from public.nachkalkulation_werte), 'Finanzfreigabe: Lohn und Kostenwerte gespeichert');
reset role;
update public.mitglieder set finanzen = false where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select count(*) = 0 from public.personal_loehne) and (select count(*) = 0 from public.nachkalkulation_werte), 'Ohne Finanzfreigabe keine Löhne');
select test_als('00000000-0000-0000-0000-0000000000e1');
select pruefe((select count(*) = 0 from public.personal_loehne), 'Einsatzkraft sieht keine Löhne, auch nicht den eigenen');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.personal_loehne) and (select count(*) = 0 from public.nachkalkulation_werte), 'Fremde sehen keine Löhne');
reset role;
update public.mitglieder set finanzen = true where user_id = '00000000-0000-0000-0000-00000000000b';
-- Link invitation without e-mail links the personnel record.
update public.personal set user_id = null where id = :'p_hamburg';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e2', 'neu.kraft@perlease.test');
insert into public.einladungen (firma_id, email, rolle, token_hash, personal_id) values (:'firma', '', 'mitarbeiter', encode(sha256(convert_to('link-abc', 'UTF8')), 'hex'), :'p_hamburg');
insert into public.einladungen (firma_id, email, rolle, token_hash) values (:'firma', '', 'bearbeiter', encode(sha256(convert_to('link-boese', 'UTF8')), 'hex'));
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  perform public.einladung_annehmen('link-boese');
  raise exception 'FEHLER: Link-Einladung ohne Personalakte als Bearbeiter';
exception when raise_exception then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select pruefe(public.einladung_annehmen('link-abc') = current_setting('test.firma')::uuid, 'Link-Einladung angenommen');
select pruefe((select count(*) = 1 and min(vorname) = 'Protokoll' from public.personal), 'Neue Einsatzkraft ist mit ihrer Personalakte verknüpft');
reset role;
select pruefe((select rolle = 'mitarbeiter' from public.mitglieder where user_id = '00000000-0000-0000-0000-0000000000e2'), 'Link-Einladung gibt nur die Rolle Einsatzkraft');
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-0000000000e2';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.rechnungen) and (select count(*) = 0 from public.rechnungsvorlagen) and (select count(*) = 0 from public.belege) and (select count(*) = 0 from public.spesen) and (select count(*) = 0 from public.stempel) and (select count(*) = 0 from public.nachweis_freigaben), 'Fremde Firma sieht nichts davon');
reset role;
update public.mitglieder set aktiv = false, finanzen = false where user_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1');
select set_config('test.uid', '', false);

-- Operator: look up and delete a customer login (only the operator; own login and last owner protected).
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'benschiffer79@gmail.com'), ('00000000-0000-0000-0000-0000000000b2', 'kunde@weg.test'), ('00000000-0000-0000-0000-0000000000b3', 'kollege@weg.test');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000b2');
select public.firma_anlegen('Weg GmbH') as wegfirma \gset
insert into public.vorgaenge (firma_id, titel) values (:'wegfirma', 'Wird gelöscht');
select public.firma_anlegen('Team Weg GmbH') as teamweg \gset
reset role;
insert into public.mitglieder (firma_id, user_id, rolle, anzeigename) values (:'teamweg', '00000000-0000-0000-0000-0000000000b3', 'bearbeiter', 'Kollege');
set role authenticated;
do $$ begin perform public.betreiber_konto_suchen('kunde@weg.test'); raise exception 'FEHLER: Nicht-Betreiber darf suchen'; exception when others then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
do $$ begin perform public.betreiber_konto_loeschen('kollege@weg.test', true); raise exception 'FEHLER: Kunde darf andere löschen'; exception when others then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
select test_als('00000000-0000-0000-0000-0000000000b1');
select pruefe(public.ist_betreiber(), 'Betreiber erkannt');
select pruefe((select count(*) = 2 from public.betreiber_konto_suchen('KUNDE@weg.test')), 'Betreiber findet beide Firmen des Kunden');
do $$ begin perform public.betreiber_konto_loeschen('benschiffer79@gmail.com', true); raise exception 'FEHLER: eigenes Konto löschbar'; exception when others then if sqlerrm like 'FEHLER%' then raise; end if; end $$;
do $$ begin perform public.betreiber_konto_loeschen('kunde@weg.test', false); raise exception 'FEHLER: letzter Inhaber ohne Firmenlöschung'; exception when others then if sqlerrm not like '%LETZTER_INHABER%' then raise; end if; end $$;
select public.betreiber_konto_loeschen('kunde@weg.test', true) as erg \gset
reset role;
select pruefe((select count(*) >= 3 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000b1' and (titel like '🆕%' or titel like '🏢%')), 'Betreiber bekommt Handy-Nachricht bei neuer Anmeldung und neuer Firma');
select pruefe(not exists (select 1 from public.push_warteschlange where user_id <> '00000000-0000-0000-0000-0000000000b1' and titel like '🆕%'), 'Nur der Betreiber bekommt Anmelde-Nachrichten');
set role authenticated;
select test_als('00000000-0000-0000-0000-0000000000b1');
reset role;
select pruefe(not exists (select 1 from auth.users where email = 'kunde@weg.test') and not exists (select 1 from public.firmen where id in (:'wegfirma', :'teamweg')) and exists (select 1 from auth.users where email = 'kollege@weg.test'), 'Betreiber löscht Kunde samt eigener Firmen, Kollege bleibt');
select pruefe((:'erg'::jsonb->'vorgaenge') ? '' is false and jsonb_array_length(:'erg'::jsonb->'firmen') = 2 and jsonb_array_length(:'erg'::jsonb->'vorgaenge') = 1, 'Rückgabe nennt Firmen und Ausschreibungen für das Aufräumen der Dateien');
-- Trade pages: public counts without login, only catalogue data.
reset role;
insert into public.vergabekatalog (id, quelle, quelle_id, version, quell_datum, titel, link, auftraggeber, auftraggeber_id, cpv, frist, status)
  values ('test:g1', 'bks', 'g1', '1', now() - interval '2 days', 'Elektroinstallation Schule', 'https://x.test', 'Stadt X', 'a', array['45311000'], now() + interval '10 days', 'offen'),
         ('test:g2', 'bks', 'g2', '1', now() - interval '40 days', 'Elektro alt', 'https://x.test', 'Stadt X', 'a', array['45311000'], now() - interval '1 day', 'offen');
set role anon;
select pruefe(public.gewerk_statistik(array['45311']) is null, 'Vor der Berechnung noch keine Zahlen (Seite zeigt dann keine)');
do $$ begin perform jarvis_intern.gewerk_aktualisieren(); raise exception 'FEHLER: anon darf Zahlen berechnen'; exception when insufficient_privilege then null; end $$;
reset role;
select pruefe(jarvis_intern.gewerk_aktualisieren() >= 11, 'Hintergrundberechnung für alle Gewerke');
set role anon;
select pruefe((select (public.gewerk_statistik(array['45311'])->>'monat')::int = 1 and (public.gewerk_statistik(array['45311'])->>'offen')::int = 1), 'Gewerk-Zahlen ohne Anmeldung, nur letzte 30 Tage');
select pruefe(public.gewerk_statistik(array['45311'])->'beispiele'->0->>'titel' = 'Elektroinstallation Schule', 'Beispiele mit offener Frist');
select pruefe(public.gewerk_statistik(array['x%; drop']) ->> 'monat' = '0', 'Ungültige Präfixe liefern nichts');
reset role;
delete from public.vergabekatalog where id like 'test:g%';

-- French trade pages: BOAMP stock is internal, the numbers are public and come from the same background cache.
reset role;
insert into jarvis_intern.boamp_avis (idweb, publication, titel, acheteur, departements, cpv, limite, link) values
  ('26-1', current_date - 1, 'Nettoyage des locaux de la mairie', 'Ville de Lyon', '{69}', '{90911200}', now() + interval '12 days', 'https://www.boamp.fr/pages/avis/?q=idweb:26-1'),
  ('26-2', current_date - 3, 'Nettoyage clos', 'Ville de Lyon', '{69}', '{90910000}', now() - interval '1 day', 'https://www.boamp.fr/pages/avis/?q=idweb:26-2'),
  ('26-3', current_date - 45, 'Nettoyage ancien', 'Ville de Lyon', '{69}', '{90910000}', null, 'https://www.boamp.fr/pages/avis/?q=idweb:26-3'),
  ('26-4', current_date - 1, 'Gardiennage', 'CHU', '{75}', '{79713000}', null, 'https://www.boamp.fr/pages/avis/?q=idweb:26-4');
set role anon;
do $$ begin perform 1 from jarvis_intern.boamp_avis; raise exception 'FEHLER: anon liest BOAMP-Bestand'; exception when insufficient_privilege then null; end $$;
select pruefe(coalesce((public.metier_statistik(array['9091','90919'])->>'monat')::int, 0) = 0, 'Neue Bekanntmachungen erst nach der Hintergrundberechnung sichtbar');
set role authenticated;
do $$ begin insert into jarvis_intern.boamp_avis (idweb, publication, titel, link) values ('x', current_date, 'x', 'https://x'); raise exception 'FEHLER: authenticated schreibt BOAMP-Bestand'; exception when insufficient_privilege then null; end $$;
reset role;
select pruefe(jarvis_intern.gewerk_aktualisieren() >= 21, 'Hintergrundberechnung deutsch und französisch');
set role anon;
select pruefe((public.metier_statistik(array['9091','90919'])->>'monat')::int = 2 and (public.metier_statistik(array['9091','90919'])->>'offen')::int = 1, 'Französische Zahlen: 30 Tage, offen nach Frist');
select pruefe(public.metier_statistik(array['9091','90919'])->'beispiele'->0->>'ort' = 'Département 69', 'Beispiel mit Département');
select pruefe((public.metier_statistik(array['7971'])->>'offen')::int = 1, 'Ohne Frist gilt als offen');
select pruefe(public.metier_statistik(array['x%; drop'])->>'monat' = '0', 'Ungültige Präfixe liefern nichts (fr)');
select pruefe(public.gewerk_statistik(array['9091','90919']) is null, 'Deutsche Abfrage sieht die französischen Zahlen nicht');
reset role;
delete from jarvis_intern.boamp_avis;

-- Polish and Spanish trade pages: stock internal, numbers public per country from the background cache.
insert into jarvis_intern.ausland_avis (land, id, publication, titel, auftraggeber, region, cpv, frist, link) values
  ('pl', 'bzp-1', current_date - 1, 'Sprzątanie urzędu', 'Gmina Kraków', 'woj. małopolskie', '{90911200}', now() + interval '9 days', 'https://ezamowienia.gov.pl/mp-client/search/list/ocds-148610-1'),
  ('pl', 'bzp-2', current_date - 2, 'Sprzątanie szkoły', 'Gmina Kraków', 'woj. małopolskie', '{90910000}', now() - interval '1 day', 'https://ezamowienia.gov.pl/x'),
  ('es', 'cat-1', current_date - 1, 'Neteja escola', 'Ajuntament de Girona', 'Girona', '{90911200}', null, 'https://contractaciopublica.cat/ca/detall-publicacio/1'),
  ('it', 'anac-1', current_date - 1, 'Servizio di pulizia', 'Comune di Milano', 'ITC4', '{90911200}', now() + interval '5 days', 'https://pubblicitalegale.anticorruzione.it/bandi/1');
set role anon;
do $$ begin perform 1 from jarvis_intern.ausland_avis; raise exception 'FEHLER: anon liest Auslandsbestand'; exception when insufficient_privilege then null; end $$;
set role authenticated;
do $$ begin insert into jarvis_intern.ausland_avis (land, id, publication, titel, link) values ('pl', 'x', current_date, 'x', 'https://x'); raise exception 'FEHLER: authenticated schreibt Auslandsbestand'; exception when insufficient_privilege then null; end $$;
reset role;
select pruefe(jarvis_intern.gewerk_aktualisieren() >= 51, 'Hintergrundberechnung für alle Länder');
set role anon;
select pruefe((public.land_statistik('it', array['9091','90919'])->>'offen')::int = 1, 'Italienische Zahlen');
reset role;
set role anon;
select pruefe((public.land_statistik('pl', array['9091','90919'])->>'monat')::int = 2 and (public.land_statistik('pl', array['9091','90919'])->>'offen')::int = 1, 'Polnische Zahlen: 30 Tage, offen nach Frist');
select pruefe(public.land_statistik('pl', array['9091','90919'])->'beispiele'->0->>'ort' = 'woj. małopolskie', 'Beispiel mit Woiwodschaft');
select pruefe((public.land_statistik('es', array['9091','90919'])->>'monat')::int = 1, 'Spanische Zahlen getrennt von Polen');
select pruefe(public.land_statistik('de', array['9091'])->>'monat' = '0', 'Nur pl und es');
select pruefe(public.land_statistik('pl', array['x%; drop'])->>'monat' = '0', 'Ungültige Präfixe liefern nichts (pl)');
reset role;
delete from jarvis_intern.ausland_avis;

-- Error alarm: callable without login, limited, goes to the operator only; budget warning at 80 %.
reset role;
delete from public.push_warteschlange;
set role anon;
select pruefe(public.fehler_melden('app', 'Test: Seite /x antwortet mit 500'), 'Fehler wird gemeldet (auch ohne Anmeldung)');
select pruefe(not public.fehler_melden('app', 'Test: Seite /x antwortet mit 500'), 'Gleicher Fehler nicht doppelt innerhalb von 30 Minuten');
do $$ begin perform 1 from jarvis_intern.fehler_meldungen; raise exception 'FEHLER: Fehlerliste lesbar'; exception when insufficient_privilege then null; end $$;
reset role;
select pruefe((select count(*) = 1 from public.push_warteschlange where user_id = '00000000-0000-0000-0000-0000000000b1' and titel = '⚠️ Jarvis: Fehler in der App'), 'Fehlermeldung geht nur an den Betreiber');
insert into jarvis_katalog.ki_budget (monat, reserviert, limit_usd) values ('2030-01-01', 15, 20);
update jarvis_katalog.ki_budget set reserviert = 16.5 where monat = '2030-01-01';
update jarvis_katalog.ki_budget set reserviert = 17 where monat = '2030-01-01';
select pruefe((select count(*) = 1 from public.push_warteschlange where titel = '⚠️ Jarvis: KI-Budget'), 'Budget-Warnung bei 80 % genau einmal');
delete from jarvis_katalog.ki_budget where monat = '2030-01-01';
select set_config('test.uid', '', false);

-- US bidder profile: admins maintain it, the office team reads it, other firms see nothing; format checks.
reset role;
update public.mitglieder set aktiv = true where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
insert into public.us_bieterprofil (firma_id, uei, cage, sam_gueltig_bis, naics, klein_naics, zertifikate) values (:'firma', 'ABCDEF123456', '1A2B3', '2027-05-01', '{561720,561730}', '{561720}', '{wosb}');
select pruefe((select count(*) = 1 from public.us_bieterprofil), 'Inhaber pflegt das US-Bieterprofil');
do $$ begin
  update public.us_bieterprofil set zertifikate = '{erfunden}';
  raise exception 'FEHLER: unbekanntes Zertifikat';
exception when check_violation then null; end $$;
do $$ begin
  update public.us_bieterprofil set uei = 'zu-kurz';
  raise exception 'FEHLER: ungültige UEI';
exception when check_violation then null; end $$;
select test_als('00000000-0000-0000-0000-00000000000b');
select pruefe((select uei = 'ABCDEF123456' from public.us_bieterprofil), 'Bearbeiter sieht das US-Bieterprofil');
update public.us_bieterprofil set uei = 'ZZZZZZ999999';
select pruefe((select uei = 'ABCDEF123456' from public.us_bieterprofil), 'Bearbeiter ändert das US-Bieterprofil nicht');
select test_als('00000000-0000-0000-0000-00000000000c');
select pruefe((select count(*) = 0 from public.us_bieterprofil), 'Fremde Firma sieht kein US-Bieterprofil');
reset role;
update public.mitglieder set aktiv = false where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('test.uid', '', false);

-- Deleting a login: a firm with only this person disappears with it; a firm with other members stays.
reset role;
select id as neufirma2 from public.firmen where name='Neu GmbH' \gset
-- Rechtsprüfung A2: a person with time-clock events younger than 2 years cannot be deleted (§ 17 MiLoG).
select set_config('test.p_berlin_id', :'p_berlin', false);
set role authenticated;
select test_als('00000000-0000-0000-0000-00000000000a');
do $$ begin
  delete from public.personal where id = current_setting('test.p_berlin_id')::uuid;
  raise exception 'FEHLER: Person mit Stempelzeiten gelöscht';
exception when insufficient_privilege then null; end $$;
reset role;
select pruefe(exists (select 1 from public.personal where id = :'p_berlin'), 'Person mit aufbewahrungspflichtigen Zeiten bleibt erhalten');
delete from auth.users where id='00000000-0000-0000-0000-0000000000d1';
select pruefe(not exists (select 1 from public.firmen where id=:'neufirma2'), 'Kontolöschung entfernt Firma ohne weitere Mitglieder');
delete from auth.users where id='00000000-0000-0000-0000-00000000000a';
select pruefe(exists (select 1 from public.firmen where id=:'firma') and not exists (select 1 from public.mitglieder where user_id='00000000-0000-0000-0000-00000000000a'), 'Kontolöschung des letzten Inhabers klappt, Firma mit Team bleibt');
\echo ALLE TESTS OK
