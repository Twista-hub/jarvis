-- Beispielfirma „Rheinland Facility Service GmbH (Beispiel)“ für ein Konto (Inhaber mit Finanzfreigabe), damit alle
-- Bereiche der App mit Daten gefüllt sind. Alle Personen, Kunden, Adressen und Ausschreibungen sind erfunden.
-- Aufruf: psql -v nutzer=<user uuid> -f supabase/demo/beispielfirma.sql   (läuft erneut: alte Beispielfirma wird ersetzt)
-- Entfernen: psql -v nutzer=<user uuid> -v entfernen=1 -f supabase/demo/beispielfirma.sql
-- Kein KI-Lauf: das Suchprofil trägt einstellungen.demo = true (alarm/profile_db.py überspringt es). Keine Mails:
-- Einladungen werden nur angelegt, nicht versendet; Handy-Nachrichten, die Trigger dabei erzeugen, werden gelöscht.
\set ON_ERROR_STOP on
\if :{?entfernen}
\else
\set entfernen 0
\endif
begin;
select set_config('demo.nutzer', :'nutzer', true), set_config('demo.entfernen', :'entfernen', true);

do $demo$
declare
  u uuid := current_setting('demo.nutzer')::uuid;
  start timestamptz := clock_timestamp();
  heute date := (now() at time zone 'Europe/Berlin')::date;
  mo date := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;  -- Monday of this week
  vm text := to_char(date_trunc('month', heute) - interval '1 month', 'YYYY-MM');  -- last month
  vvm text := to_char(date_trunc('month', heute) - interval '2 month', 'YYYY-MM');
  f uuid; b_ac uuid; b_k uuid; b_d uuid; b_km uuid;
  p uuid[] := '{}'; x uuid;
  k_stadt uuid; k_messe uuid; k_klinik uuid; k_log uuid; k_bank uuid;
  o_rathaus uuid; o_schule uuid; o_halle uuid; o_klinik uuid; o_lager uuid; o_bank uuid;
  v_neu1 uuid; v_neu2 uuid; v_neu3 uuid; v_pr1 uuid; v_pr2 uuid; v_ang uuid; v_abg uuid; v_gew uuid; v_verl uuid; v_verw uuid;
  pa1 uuid; pa2 uuid; pa3 uuid; uw1 uuid; uw2 uuid; uw3 uuid; kp1 uuid; kp2 uuid; kp3 uuid; bw uuid; anfrage uuid;
  mo_ uuid; i int;
  kalk jsonb := '{"lohn":14.25,"nebenkosten":23,"ausfall":18,"anteilNacht":10,"zuschlagNacht":25,"anteilSonntag":5,"zuschlagSonntag":50,"anteilFeiertag":2,"zuschlagFeiertag":100,"anteilUeber":3,"zuschlagUeber":25,"zuschlaege":0,"stundenTag":8,"fahrt":6,"verpflegung":0,"unterkunft":0,"einmalig":180,"stundenKraft":1600,"sonstiges":0.4,"gemeinkosten":12,"gewinn":6}';
begin
  if u is null or not exists (select 1 from auth.users where id = u) then raise exception 'Nutzer nicht gefunden'; end if;
  -- Replace an earlier copy (everything hangs on the firm and is removed with it).
  delete from public.firmen where name = 'Rheinland Facility Service GmbH (Beispiel)'
    and id in (select firma_id from public.mitglieder where user_id = u and rolle = 'inhaber');
  if current_setting('demo.entfernen') = '1' then raise notice 'Beispielfirma entfernt'; return; end if;

  -- ---------- Firma, Profil, Standorte ----------
  insert into public.firmen (name, paket, strasse, plz, ort, telefon, website)
  values ('Rheinland Facility Service GmbH (Beispiel)', 'test', 'Am Beispielpark 12', '52068', 'Aachen', '+49 241 99999-0', 'https://www.beispiel-facility.invalid')
  returning id into f;
  -- Operator's demo firm: no trial AI limit (the demo flag keeps it out of the daily AI search anyway).
  update public.firmen set ki_budget_usd = null where id = f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche, aktiv, anzeigename, funktion, finanzen)
  values (f, u, 'inhaber', true, true, 'Benjamin', 'Geschäftsführung', true);
  insert into public.firmenprofil (firma_id, rechtsform, registergericht, registernummer, gruendungsjahr, mitarbeiter, website, email, ustid,
    geschaeftsfuehrung, taetigkeit, bundesland, steuernummer, kleinunternehmer, zahlungshinweis, datev_berater, datev_mandant, datev_skr)
  values (f, 'GmbH', 'Amtsgericht Aachen', 'HRB 99999', 2012, 48, 'https://www.beispiel-facility.invalid', 'info@beispiel-facility.invalid', 'DE999999999',
    'Benjamin (Beispiel)', 'Unterhalts- und Glasreinigung, Hausmeisterdienste, Objekt- und Veranstaltungsschutz sowie Arbeitnehmerüberlassung für Messe, Gastronomie und Logistik im Rheinland.',
    'NW', '201/5999/0001', false, 'Zahlbar innerhalb von 14 Tagen ohne Abzug. Bankverbindung: Beispielbank, IBAN DE00 0000 0000 0000 0000 00', '1234567', '10001', '03');
  insert into public.firmen_kennzahlen (firma_id, jahr, umsatz, beschaeftigte) values
    (f, extract(year from heute)::int - 3, 1650000, 36), (f, extract(year from heute)::int - 2, 1920000, 41), (f, extract(year from heute)::int - 1, 2240000, 46);
  insert into public.bereiche (firma_id, name, art, ansprechpartner, telefon, email) values (f, 'Aachen (Hauptsitz)', 'standort', 'Sabine Krüger', '+49 241 99999-10', 'aachen@beispiel-facility.invalid') returning id into b_ac;
  insert into public.bereiche (firma_id, name, art, ansprechpartner, telefon, email) values (f, 'Köln', 'standort', 'Lukas Schmitz', '+49 221 99999-20', 'koeln@beispiel-facility.invalid') returning id into b_k;
  insert into public.bereiche (firma_id, name, art, ansprechpartner, telefon, email) values (f, 'Düsseldorf', 'standort', 'Marie Schulz', '+49 211 99999-30', 'duesseldorf@beispiel-facility.invalid') returning id into b_d;
  insert into public.bereiche (firma_id, parent_id, name, art) values (f, b_k, 'Messe-Team Köln', 'team') returning id into b_km;

  insert into public.firmen_zertifikate (firma_id, art, bezeichnung, nummer, aussteller, gueltig_bis) values
    (f, 'iso9001', 'ISO 9001:2015 Qualitätsmanagement', 'QM-2024-0815', 'Beispiel-Zertifizierung GmbH', heute + 400),
    (f, 'pq_vob', 'Präqualifikation VOB', 'PQ-099-9999', 'PQ-Verein (Beispiel)', heute + 25),
    (f, 'sonstiges', 'Gütezeichen Gebäudereinigung', 'GZ-1234', 'Gütegemeinschaft (Beispiel)', heute + 700);
  insert into public.firmen_qualifikationen (firma_id, bereich_id, name) values
    (f, null, 'Unterhaltsreinigung'), (f, null, 'Glas- und Fassadenreinigung'), (f, b_k, 'Veranstaltungsschutz'), (f, b_d, 'Arbeitnehmerüberlassung Logistik');
  insert into public.firmen_tarifvertraege (firma_id, name, geltungsbereich, gruppen, quelle, gueltig_ab, tarifart, gruppenart, berufe, datenstatus) values
    (f, 'Rahmentarifvertrag Gebäudereinigung (Beispielwerte)', 'Bundesgebiet', '{LG 1,LG 2,LG 3,LG 4,LG 5,LG 6}', 'Firmenangabe (Beispiel)', date_trunc('year', heute)::date, 'Tarifvertrag', 'Lohngruppe', '{Reinigungskraft,Glasreiniger,Objektleitung}', 'Firmenangabe'),
    (f, 'Branchenmindestlohn Sicherheit NRW (Beispielwerte)', 'Nordrhein-Westfalen', '{Gruppe 1,Gruppe 2}', 'Firmenangabe (Beispiel)', date_trunc('year', heute)::date, 'Branchenmindestlohn', 'Lohngruppe', '{Sicherheitsmitarbeiter}', 'Firmenangabe');
  insert into public.referenzen (firma_id, auftraggeber, leistung, ort, von, bis, laufend, auftragswert, personal, ansprechpartner, kontakt) values
    (f, 'Städtisches Gebäudemanagement Musterstadt (Beispiel)', 'Unterhaltsreinigung von 6 Schulen, 28.000 m²', 'Aachen', heute - 900, null, true, 410000, 14, 'Frau Beispiel', '+49 241 0000000'),
    (f, 'Messegesellschaft Rhein (Beispiel)', 'Servicepersonal und Hallenreinigung zu 12 Messen pro Jahr', 'Köln', heute - 1200, heute - 120, false, 280000, 35, 'Herr Muster', 'einkauf@messe-rhein.invalid'),
    (f, 'Logistik Rheinland AG (Beispiel)', 'Arbeitnehmerüberlassung Lagerhelfer, Werkschutz', 'Düsseldorf', heute - 500, null, true, 190000, 9, 'Frau Lager', '');
  insert into public.textbausteine (firma_id, titel, kategorie, text, immer) values
    (f, 'Unternehmensvorstellung', 'Allgemein', 'Die Rheinland Facility Service GmbH betreut seit 2012 öffentliche und private Auftraggeber im Rheinland mit eigenem, tarifgebundenem Personal an drei Standorten.', true),
    (f, 'Qualitätssicherung', 'Qualität', 'Monatliche Qualitätskontrollen mit Protokoll, feste Objektleitung je Auftrag, Reaktionszeit bei Mängeln innerhalb von 4 Stunden.', false),
    (f, 'Vertretungsregelung', 'Personal', 'Für jedes Objekt sind eingewiesene Springer benannt. Ausfälle werden über unsere Disposition am selben Tag ersetzt.', false),
    (f, 'Nachhaltigkeit', 'Umwelt', 'Wir setzen zertifizierte, umweltschonende Reinigungsmittel und Mikrofasersysteme ein und planen Touren mit kurzen Wegen.', false);
  insert into public.partner (firma_id, name, gewerke, ansprechpartner, telefon, email, region, bewertung, notiz) values
    (f, 'Höhenwerk Glas & Fassade (Beispiel)', '{Glasreinigung,Fassadenreinigung}', 'Herr Hoch', '+49 221 0000001', 'info@hoehenwerk.invalid', 'Köln, Bonn', 5, 'Hubsteiger bis 30 m'),
    (f, 'Winterdienst Eifel (Beispiel)', '{Winterdienst,Grünpflege}', 'Frau Schnee', '+49 2441 000002', '', 'Aachen, Eifel', 4, ''),
    (f, 'SchädlingsStopp Rhein (Beispiel)', '{Schädlingsbekämpfung}', 'Herr Kammer', '+49 211 0000003', 'kontakt@schaedlingsstopp.invalid', 'Düsseldorf', 3, 'Nur werktags');
  insert into public.partnerprofile (firma_id, name, leistungen, region, kontakt, sichtbar)
  values (f, 'Rheinland Facility Service GmbH (Beispiel)', 'Unterhaltsreinigung, Glasreinigung, Hausmeister, Veranstaltungsschutz', 'Aachen, Köln, Düsseldorf', 'info@beispiel-facility.invalid', false);
  insert into public.kalkulationsprofile (firma_id, name, eingaben) values (f, 'Reinigung Standard', kalk), (f, 'Sicherheit Nacht', kalk || '{"lohn":15.10,"anteilNacht":60,"zuschlagNacht":25}');
  insert into public.kalkulationsvorlagen (firma_id, bereich_id, eingaben) values (f, null, kalk), (f, b_k, kalk || '{"lohn":14.60,"fahrt":8}');
  insert into public.nachkalkulation_werte (firma_id, lohn, nebenkosten, nacht, sonntag, feiertag) values (f, 14.5, 23, 25, 50, 100);
  insert into public.betriebsmittel (firma_id, bereich_id, art, bezeichnung, kennung, pruefart, naechste_pruefung, notiz) values
    (f, b_ac, 'fahrzeug', 'VW Caddy Kasten', 'AC-RF 101', 'HU/AU', heute + 12, 'Firmenwagen Objektleitung'),
    (f, b_k, 'fahrzeug', 'Ford Transit 9-Sitzer', 'K-RF 202', 'HU/AU', heute + 160, ''),
    (f, b_ac, 'maschine', 'Scheuersaugmaschine Kärcher B 60', 'SM-03', 'UVV / DGUV V3', heute - 5, 'Prüfung überfällig'),
    (f, b_d, 'geraet', 'Mehrzweckleiter 3-teilig', 'L-07', 'Leiterprüfung', heute + 45, ''),
    (f, b_k, 'werkzeug', 'Funkgeräte-Set (6 Stück)', 'FG-1', '', null, 'Für Veranstaltungsschutz');
  insert into public.unterweisungen (firma_id, titel, intervall_monate, beschreibung) values (f, 'Arbeitsschutz allgemein', 12, 'Jährliche Unterweisung nach § 12 ArbSchG.') returning id into uw1;
  insert into public.unterweisungen (firma_id, titel, intervall_monate, beschreibung) values (f, 'Gefahrstoffe und Reinigungsmittel', 12, 'Betriebsanweisungen, Hautschutz, Verdünnung.') returning id into uw2;
  insert into public.unterweisungen (firma_id, titel, intervall_monate, beschreibung) values (f, 'Brandschutz und Evakuierung', 24, '') returning id into uw3;

  -- ---------- Personal ----------
  insert into public.personal (firma_id, bereich_id, vorname, nachname, berufe, qualifikationen, eg, telefon, email, status, eintritt, beschaeftigung, wochenstunden, fuehrerschein, sprachen, wohn_plz, firmenwagen, personalnummer, geburtstag, notiz)
  values
    (f, b_ac, 'Sabine', 'Krüger', '{Objektleitung,Reinigungskraft}', '{Ersthelfer,Desinfektor}', '', '+49 170 0000001', 'sabine.krueger@beispiel.invalid', 'einsatz', '2019-03-01', 'vollzeit', 40, '{B}', '{Deutsch,Englisch}', '52064', true, '1001', heute + 3 - interval '44 years', 'Objektleitung Aachen'),
    (f, b_ac, 'Mehmet', 'Yılmaz', '{Reinigungskraft}', '{}', '', '+49 170 0000002', '', 'einsatz', '2021-08-15', 'teilzeit', 25, '{}', '{Deutsch,Türkisch}', '52070', false, '1002', '1985-06-12', ''),
    (f, b_ac, 'Anna', 'Nowak', '{Reinigungskraft}', '{}', '', '+49 170 0000003', '', 'verfuegbar', heute - 120, 'minijob', 10, '{}', '{Polnisch,Deutsch}', '52066', false, '1003', '1999-11-02', ''),
    (f, b_ac, 'Thomas', 'Becker', '{Hausmeister}', '{Elektrofachkraft für festgelegte Tätigkeiten}', '', '+49 170 0000004', '', 'einsatz', '2016-01-04', 'vollzeit', 40, '{B,BE}', '{Deutsch}', '52146', true, '1004', '1971-02-20', ''),
    (f, b_km, 'Jana', 'Hoffmann', '{Servicekraft}', '{Gesundheitszeugnis (§ 43 IfSG)}', '', '+49 170 0000005', '', 'einsatz', heute - 230, 'aushilfe', 15, '{}', '{Deutsch,Englisch}', '50679', false, '2001', '2002-04-30', 'Überlassen an Messegesellschaft'),
    (f, b_k, 'Lukas', 'Schmitz', '{Sicherheitsmitarbeiter}', '{Sachkundeprüfung § 34a GewO,Ersthelfer}', '', '+49 170 0000006', '', 'einsatz', '2020-05-01', 'vollzeit', 40, '{B}', '{Deutsch}', '50823', false, '2002', '1990-09-09', 'Schichtleiter'),
    (f, b_k, 'Ewa', 'Kowalska', '{Reinigungskraft,Glasreiniger}', '{}', '', '+49 170 0000007', '', 'verfuegbar', '2022-02-01', 'teilzeit', 30, '{}', '{Polnisch,Deutsch}', '51103', false, '2003', '1983-12-24', ''),
    (f, b_k, 'Ahmad', 'Rahimi', '{Sicherheitsmitarbeiter}', '{Unterrichtung § 34a GewO}', '', '+49 170 0000008', '', 'einsatz', heute - 300, 'vollzeit', 40, '{}', '{Deutsch,Dari,Englisch}', '50733', false, '2004', '1995-03-15', ''),
    (f, b_d, 'Marie', 'Schulz', '{Servicekraft}', '{Gesundheitszeugnis (§ 43 IfSG)}', '', '+49 170 0000009', '', 'verfuegbar', heute - 70, 'teilzeit', 20, '{B}', '{Deutsch,Französisch}', '40210', false, '3001', heute + 9 - interval '31 years', ''),
    (f, b_d, 'Kevin', 'Wagner', '{Lagerhelfer}', '{Staplerschein}', '', '+49 170 0000010', '', 'einsatz', heute - 260, 'vollzeit', 38, '{B}', '{Deutsch}', '40472', false, '3002', '1997-07-07', 'Überlassen an Logistik Rheinland'),
    (f, b_d, 'Fatma', 'Demir', '{Reinigungskraft}', '{}', '', '+49 170 0000011', '', 'verfuegbar', '2023-04-01', 'teilzeit', 25, '{}', '{Deutsch,Türkisch,Arabisch}', '40227', false, '3003', '1988-01-19', ''),
    (f, b_d, 'Daniel', 'Fischer', '{Hausmeister}', '{}', '', '+49 170 0000012', '', 'nicht', '2018-09-01', 'vollzeit', 40, '{B}', '{Deutsch}', '40589', false, '3004', '1979-10-10', 'Kündigung zum Monatsende'),
    (f, b_ac, 'Laura', 'Meyer', '{Reinigungskraft}', '{}', '', '+49 170 0000013', '', 'verfuegbar', heute - 40, 'azubi', 39, '{}', '{Deutsch}', '52062', false, '1005', '2007-05-05', 'Ausbildung Gebäudereinigerin, 1. Jahr'),
    (f, b_k, 'Piotr', 'Zieliński', '{Glasreiniger}', '{Höhenzugangstechnik}', '', '+49 170 0000014', '', 'einsatz', '2017-06-01', 'vollzeit', 40, '{B}', '{Polnisch,Deutsch}', '51065', false, '2005', '1980-08-08', '');
  select array_agg(id order by personalnummer) into p from public.personal where firma_id = f;
  -- p: 1001 Sabine, 1002 Mehmet, 1003 Anna, 1004 Thomas, 1005 Laura, 2001 Jana, 2002 Lukas, 2003 Ewa, 2004 Ahmad, 2005 Piotr, 3001 Marie, 3002 Kevin, 3003 Fatma, 3004 Daniel
  update public.personal set befristet_bis = heute + 50 where id = p[3];
  update public.personal set probezeit_bis = heute + 20 where id = p[11];
  update public.personal set aufenthalt_bis = heute + 40 where id = p[9];
  update public.personal set austritt_am = (date_trunc('month', heute) + interval '1 month - 1 day')::date where id = p[14];
  update public.personal set probezeit_bis = heute + 140 where id = p[5];
  update public.personal set eg = g.eg, tarifvertrag_id = t.id
    from (values ('1001', 'LG 6'), ('1002', 'LG 1'), ('1003', 'LG 1'), ('2003', 'LG 3'), ('2005', 'LG 3'), ('3003', 'LG 1'), ('2002', 'Gruppe 2'), ('2004', 'Gruppe 1')) g(nr, eg)
    join public.firmen_tarifvertraege t on t.firma_id = f and g.eg = any(t.gruppen)
   where personal.firma_id = f and personal.personalnummer = g.nr;

  insert into public.personal_loehne (personal_id, firma_id, stundenlohn)
    select id, f, case personalnummer when '1001' then 19.80 when '1004' then 18.40 when '2002' then 17.20 when '2004' then 15.30 when '2005' then 17.90 when '1005' then 9.50 else 14.25 end from public.personal where firma_id = f;
  insert into public.urlaubskonten (firma_id, personal_id, jahr, anspruch, uebertrag) select f, id, extract(year from heute)::int, case beschaeftigung when 'minijob' then 12 when 'aushilfe' then 10 else 30 end, case when personalnummer in ('1001','2002') then 3 else 0 end from public.personal where firma_id = f;
  insert into public.zeitkonten (firma_id, personal_id, ab, startsaldo_min) select f, id, date_trunc('year', heute)::date, case personalnummer when '1001' then 1260 when '2002' then -180 else 0 end from public.personal where firma_id = f and beschaeftigung in ('vollzeit', 'teilzeit');
  insert into public.personal_nachweise (firma_id, personal_id, bezeichnung, erworben, gueltig_bis) values
    (f, p[1], 'Erste-Hilfe-Ausbildung', heute - 700, heute + 30),
    (f, p[1], 'Desinfektor-Lehrgang', '2021-04-12', null),
    (f, p[7], 'Sachkundeprüfung § 34a GewO', '2020-03-10', null),
    (f, p[7], 'Erste-Hilfe-Ausbildung', heute - 760, heute - 30),
    (f, p[9], 'Unterrichtung § 34a GewO', heute - 320, null),
    (f, p[6], 'Gesundheitszeugnis (§ 43 IfSG)', heute - 240, null),
    (f, p[11], 'Gesundheitszeugnis (§ 43 IfSG)', heute - 80, null),
    (f, p[12], 'Staplerschein', '2023-02-01', heute + 600),
    (f, p[10], 'Höhenzugangstechnik (SKT A)', heute - 300, heute + 65),
    (f, p[4], 'Elektrofachkraft für festgelegte Tätigkeiten', '2019-05-20', heute + 10);
  insert into public.personal_abwesenheiten (firma_id, personal_id, von, bis, grund, notiz, status, kurzfristig) values
    (f, p[2], mo + 7, mo + 11, 'urlaub', 'Sommerurlaub nachgeholt', 'bestaetigt', false),
    (f, p[8], mo + 14, mo + 25, 'urlaub', '', 'beantragt', false),
    (f, p[13], heute + 20, heute + 22, 'urlaub', 'Familienfeier', 'beantragt', false),
    (f, p[7], mo + 3, mo + 3, 'schulung', 'Brandschutzhelfer-Lehrgang', 'bestaetigt', false),
    (f, p[3], heute, heute, 'abwesend', 'Kurzfristig verhindert', 'bestaetigt', true),
    (f, p[1], mo - 21, mo - 17, 'urlaub', '', 'bestaetigt', false);
  insert into public.psa_ausgaben (firma_id, personal_id, artikel, groesse, menge, ausgegeben, austausch, notiz) values
    (f, p[1], 'Sicherheitsschuhe S2', '39', 1, heute - 340, heute + 25, ''),
    (f, p[2], 'Schutzhandschuhe Nitril', 'L', 10, heute - 30, null, ''),
    (f, p[4], 'Sicherheitsschuhe S3', '44', 1, heute - 200, heute + 165, ''),
    (f, p[7], 'Warnweste mit Aufdruck', 'XL', 2, heute - 400, null, ''),
    (f, p[10], 'Auffanggurt mit Falldämpfer', 'M/L', 1, heute - 300, heute + 65, 'Jährliche Sachkundigenprüfung'),
    (f, p[12], 'Sicherheitsschuhe S3', '43', 1, heute - 250, heute + 115, '');
  insert into public.checklisten_punkte (firma_id, personal_id, art, titel, reihenfolge, erledigt) values
    (f, p[5], 'einstieg', 'Arbeitsvertrag unterschrieben', 1, now() - interval '45 days'),
    (f, p[5], 'einstieg', 'Unterweisung Arbeitsschutz', 2, now() - interval '40 days'),
    (f, p[5], 'einstieg', 'Arbeitskleidung und Schuhe ausgegeben', 3, now() - interval '40 days'),
    (f, p[5], 'einstieg', 'Berufsschul-Anmeldung', 4, null),
    (f, p[5], 'einstieg', 'Schlüssel Objekt Rathaus', 5, null),
    (f, p[14], 'austritt', 'Schlüssel und Transponder zurück', 1, null),
    (f, p[14], 'austritt', 'Arbeitskleidung zurück', 2, null),
    (f, p[14], 'austritt', 'Arbeitszeugnis erstellen', 3, null),
    (f, p[14], 'austritt', 'Zugänge sperren', 4, now() - interval '1 day');
  insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum)
    select f, uw1, id, heute - (case when personalnummer in ('2004', '3003') then 380 else 90 end) from public.personal where firma_id = f and personalnummer <> '1005';
  insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum)
    select f, uw2, id, heute - 200 from public.personal where firma_id = f and 'Reinigungskraft' = any(berufe);
  insert into public.unterweisung_teilnahmen (firma_id, unterweisung_id, personal_id, datum)
    select f, uw3, id, heute - 500 from public.personal where firma_id = f and bereich_id in (b_k, b_km);
  insert into public.fuehrerschein_kontrollen (firma_id, personal_id, datum, klassen, notiz, geprueft_von) values
    (f, p[1], heute - 170, '{B}', 'Original vorgelegt', u), (f, p[4], heute - 60, '{B,BE}', '', u);
  insert into public.ueberlassungen (firma_id, personal_id, entleiher, von, bis, notiz) values
    (f, p[6], 'Messegesellschaft Rhein (Beispiel)', heute - 230, null, 'Servicepersonal Halle 3'),
    (f, p[12], 'Logistik Rheinland AG (Beispiel)', heute - 260, heute + 200, 'Lagerhelfer Wareneingang');
  insert into public.bewerber (firma_id, bereich_id, vorname, nachname, email, telefon, beruf, quelle, status, gespraech, notiz, loeschen_ab) values
    (f, b_k, 'Svenja', 'Brandt', 'svenja.brandt@beispiel.invalid', '+49 160 0000020', 'Sicherheitsmitarbeiterin', 'Website', 'gespraech', now() + interval '2 days' + interval '10 hours', 'Hat Sachkundeprüfung', heute + 180),
    (f, b_ac, 'Oleksandr', 'Bondar', '', '+49 160 0000021', 'Reinigungskraft', 'Empfehlung Mehmet', 'neu', null, '', heute + 180),
    (f, b_d, 'Nina', 'Kraus', 'nina.kraus@beispiel.invalid', '', 'Servicekraft', 'Jobbörse', 'zusage', null, 'Start zum 1. des Monats', heute + 180),
    (f, b_ac, 'Robert', 'Lang', '', '', 'Hausmeister', 'Zeitung', 'absage', null, '', heute + 30);

  -- ---------- Kunden, Einsatzorte, Preise ----------
  insert into public.kunden (firma_id, bereich_id, name, strasse, plz, ort, ansprechpartner, telefon, email, notiz) values
    (f, b_ac, 'Städtisches Gebäudemanagement Musterstadt (Beispiel)', 'Rathausplatz 1', '52062', 'Aachen', 'Frau Beispiel', '+49 241 0000100', 'gebaeude@musterstadt.invalid', 'Rahmenvertrag Unterhaltsreinigung') returning id into k_stadt;
  insert into public.kunden (firma_id, bereich_id, name, strasse, plz, ort, ansprechpartner, telefon, email, notiz, bz_tarif) values
    (f, b_k, 'Messegesellschaft Rhein (Beispiel)', 'Messeallee 5', '50679', 'Köln', 'Herr Muster', '+49 221 0000200', 'einkauf@messe-rhein.invalid', 'Branchenzuschlag Gastronomie', 'Gastgewerbe') returning id into k_messe;
  insert into public.kunden (firma_id, bereich_id, name, strasse, plz, ort, ansprechpartner, telefon, email, notiz) values
    (f, b_d, 'Klinikum Nord Düsseldorf (Beispiel)', 'Gesundheitsweg 20', '40468', 'Düsseldorf', 'Frau Dr. Hygiene', '+49 211 0000300', '', 'Hygieneplan beachten') returning id into k_klinik;
  insert into public.kunden (firma_id, bereich_id, name, strasse, plz, ort, ansprechpartner, telefon, email, notiz) values
    (f, b_d, 'Logistik Rheinland AG (Beispiel)', 'Hafenstraße 88', '40221', 'Düsseldorf', 'Frau Lager', '+49 211 0000400', 'personal@logistik-rheinland.invalid', 'Werkschutz nachts, Überlassung tagsüber') returning id into k_log;
  insert into public.kunden (firma_id, bereich_id, name, strasse, plz, ort, ansprechpartner, telefon, email, notiz) values
    (f, b_ac, 'Beispielbank Filiale Markt (Beispiel)', 'Markt 3', '52062', 'Aachen', 'Herr Kasse', '+49 241 0000500', '', 'Reinigung nur nach 18 Uhr') returning id into k_bank;
  insert into public.kunden_preise (firma_id, kunde_id, satz, zuschlag_nacht, zuschlag_sonntag, zuschlag_feiertag) values
    (f, k_stadt, 29.90, 25, 50, 100), (f, k_messe, 34.50, 25, 50, 125), (f, k_klinik, 31.20, 25, 50, 100), (f, k_log, 32.80, 25, 50, 100), (f, k_bank, 33.00, 0, 0, 0);
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_stadt, 'Rathaus Musterstadt', 'Rathausplatz 1', '52062', 'Aachen', 'Hausmeister Herr Tür', '+49 241 0000101', 'Seiteneingang Hof, Klingel „Reinigung“', 'Firmenkleidung, Namensschild', 'Ratssaal dienstags erst ab 20 Uhr reinigen.') returning id into o_rathaus;
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_stadt, 'Grundschule am Weiher', 'Weiherweg 4', '52066', 'Aachen', 'Schulsekretariat', '+49 241 0000102', 'Hausmeisterloge', 'Firmenkleidung', 'Schlüsselkasten Code bei der Objektleitung.') returning id into o_schule;
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_messe, 'Messe Halle 3', 'Messeallee 5', '50679', 'Köln', 'Hallenmeister Herr Gang', '+49 221 0000201', 'Eingang Süd, Personalschleuse', 'Schwarze Hose, weißes Hemd, schwarze Schuhe', 'Akkreditierung am Eingang vorzeigen.') returning id into o_halle;
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_klinik, 'Klinikum Nord, Station 4–6', 'Gesundheitsweg 20', '40468', 'Düsseldorf', 'Stationsleitung', '+49 211 0000301', 'Wirtschaftshof, Umkleide UG', 'Klinikkleidung wird gestellt', 'Desinfektionsplan Version 3 gilt.') returning id into o_klinik;
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_log, 'Logistikzentrum Hafen', 'Hafenstraße 88', '40221', 'Düsseldorf', 'Schichtleitung Lager', '+49 211 0000401', 'Pforte Tor 2', 'Sicherheitsschuhe S3, Warnweste', 'Rundgang nachts alle 2 Stunden, Kontrollpunkte scannen.') returning id into o_lager;
  insert into public.einsatzorte (firma_id, kunde_id, name, strasse, plz, ort, ansprechpartner, telefon, treffpunkt, kleidung, hinweise) values
    (f, k_bank, 'Filiale Markt', 'Markt 3', '52062', 'Aachen', 'Filialleitung', '+49 241 0000501', 'Hintereingang, Alarmanlage beachten', 'Firmenkleidung', 'Alarmcode nur über die Objektleitung.') returning id into o_bank;
  insert into public.kontrollpunkte (firma_id, einsatzort_id, name) values (f, o_lager, 'Tor 2 Pforte') returning id into kp1;
  insert into public.kontrollpunkte (firma_id, einsatzort_id, name) values (f, o_lager, 'Halle B Notausgang') returning id into kp2;
  insert into public.kontrollpunkte (firma_id, einsatzort_id, name) values (f, o_lager, 'Ladezone Rampe 7') returning id into kp3;
  for i in 0..5 loop
    insert into public.rundgang_scans (firma_id, kontrollpunkt_id, personal_id, zeit) values
      (f, kp1, p[9], (heute - 1)::timestamp + interval '22 hours' + i * interval '2 hours'),
      (f, kp2, p[9], (heute - 1)::timestamp + interval '22 hours 10 minutes' + i * interval '2 hours'),
      (f, kp3, p[9], (heute - 1)::timestamp + interval '22 hours 20 minutes' + i * interval '2 hours');
  end loop;
  insert into public.wachbuch (firma_id, einsatzort_id, personal_id, zeit, art, text) values
    (f, o_lager, p[9], (heute - 1)::timestamp + interval '22 hours', 'uebergabe', 'Dienstübernahme von Tagschicht, keine besonderen Vorkommnisse.'),
    (f, o_lager, p[9], (heute)::timestamp + interval '1 hour 40 minutes', 'vorfall', 'Rolltor Rampe 7 nicht verschlossen, verschlossen und Schichtleitung informiert.'),
    (f, o_lager, p[9], (heute)::timestamp + interval '5 hours 55 minutes', 'meldung', 'Rundgänge vollständig, Übergabe an Frühschicht.');
  insert into public.kunden_meldungen (firma_id, kunde_id, art, text, name, erstellt, erledigt_am) values
    (f, k_stadt, 'mangel', 'Im Ratssaal wurden die Fensterbänke nicht gewischt.', 'Frau Beispiel', now() - interval '2 days', null),
    (f, k_stadt, 'lob', 'Die Grundschule war nach der Projektwoche top sauber, danke!', 'Schulleitung', now() - interval '9 days', now() - interval '8 days'),
    (f, k_messe, 'wunsch', 'Zur nächsten Messe bitte 2 zusätzliche Servicekräfte am Eröffnungstag.', 'Herr Muster', now() - interval '1 day', null);
  insert into public.kunden_portale (firma_id, kunde_id, token_hash, aktiv, rechnungen_zeigen, berichte_zeigen, erstellt_von)
    values (f, k_stadt, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), true, true, true, u);
  insert into public.rechnungsvorlagen (firma_id, kunde_id, text, betrag, aktiv, letzter_monat) values
    (f, k_bank, 'Unterhaltsreinigung Filiale Markt, monatliche Pauschale', 1450.00, true, vm);
  insert into public.einsatz_bewertungen (firma_id, personal_id, kunde_id, einsatz, datum, sterne, wieder, notiz, erstellt_von) values
    (f, p[6], k_messe, 'Messe Halle 3', heute - 12, 5, 'ja', 'Sehr freundlich, gern wieder.', u),
    (f, p[2], k_stadt, 'Rathaus Musterstadt', heute - 20, 4, 'ja', '', u),
    (f, p[9], k_log, 'Logistikzentrum Hafen', heute - 5, 3, 'egal', 'Rundgangsprotokoll unvollständig.', u),
    (f, p[13], k_klinik, 'Klinikum Nord', heute - 8, 2, 'nein', 'Hygieneplan nicht eingehalten.', u);

  -- ---------- Schichten (diese und nächste Woche), Stunden, Stempel, Spesen ----------
  for i in 0..11 loop
    if extract(isodow from mo + i) < 6 then
      insert into public.schichten (firma_id, bereich_id, personal_id, datum, beginn, ende, ort, antwort, einsatzort_id, erstellt_von) values
        (f, b_ac, p[2], mo + i, '17:00', '21:00', 'Rathaus Musterstadt', case when i < 7 then 'zugesagt' else 'offen' end, o_rathaus, u),
        (f, b_ac, p[1], mo + i, '06:00', '14:30', 'Grundschule am Weiher', 'zugesagt', o_schule, u),
        (f, b_d, p[12], mo + i, '07:00', '15:30', 'Logistikzentrum Hafen', 'zugesagt', o_lager, u),
        (f, b_d, p[9], mo + i, '22:00', '06:00', 'Logistikzentrum Hafen', case when i = 9 then 'abgesagt' else 'zugesagt' end, o_lager, u);
    end if;
  end loop;
  insert into public.schichten (firma_id, bereich_id, personal_id, datum, beginn, ende, ort, antwort, einsatzort_id, erstellt_von, notiz) values
    (f, b_km, p[6], mo + 3, '08:00', '18:00', 'Messe Halle 3', 'zugesagt', o_halle, u, 'Messe „Bau & Raum“ (Beispiel)'),
    (f, b_km, p[6], mo + 4, '08:00', '18:00', 'Messe Halle 3', 'offen', o_halle, u, ''),
    (f, b_k, p[7], mo + 4, '16:00', '23:00', 'Messe Halle 3', 'zugesagt', o_halle, u, 'Abendveranstaltung'),
    (f, b_k, p[8], mo + 2, '06:00', '12:00', 'Messe Halle 3', 'abgesagt', o_halle, u, ''),
    (f, b_d, p[13], mo + 1, '18:00', '22:00', 'Klinikum Nord, Station 4–6', 'zugesagt', o_klinik, u, ''),
    (f, b_ac, p[3], heute, '18:00', '21:00', 'Filiale Markt', 'abgesagt', o_bank, u, 'Ausfall gemeldet'),
    (f, b_ac, null, heute + 1, '18:00', '21:00', 'Filiale Markt', 'offen', o_bank, u, 'Ersatz gesucht'),
    (f, b_km, null, mo + 10, '08:00', '18:00', 'Messe Halle 3', 'offen', o_halle, u, '2 Servicekräfte für Eröffnungstag');
  update public.schichten set beruf = 'Servicekraft' where firma_id = f and personal_id is null and ort = 'Messe Halle 3';
  update public.schichten set beruf = 'Reinigungskraft' where firma_id = f and personal_id is null and ort = 'Filiale Markt';
  for i in 1..30 loop
    if extract(isodow from heute - i) < 6 then
      insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, pause_min, einsatz, status, freigegeben_von, freigegeben_am, kunde_id, erstellt_von) values
        (f, p[2], heute - i, '17:00', '21:00', 0, 'Rathaus Musterstadt', case when i > 3 then 'freigegeben' else 'erfasst' end, case when i > 3 then u end, case when i > 3 then now() - (i - 2) * interval '1 day' end, k_stadt, u),
        (f, p[1], heute - i, '06:00', '14:30', 30, 'Grundschule am Weiher', case when i > 3 then 'freigegeben' else 'erfasst' end, case when i > 3 then u end, case when i > 3 then now() - (i - 2) * interval '1 day' end, k_stadt, u),
        (f, p[12], heute - i, '07:00', '15:30', 30, 'Logistikzentrum Hafen', case when i > 3 then 'freigegeben' else 'erfasst' end, case when i > 3 then u end, case when i > 3 then now() - (i - 2) * interval '1 day' end, k_log, u),
        (f, p[9], heute - i, '22:00', '06:00', 30, 'Logistikzentrum Hafen', case when i > 3 then 'freigegeben' else 'erfasst' end, case when i > 3 then u end, case when i > 3 then now() - (i - 2) * interval '1 day' end, k_log, u);
    end if;
    if extract(isodow from heute - i) = 6 then
      insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, pause_min, einsatz, status, kunde_id, erstellt_von) values
        (f, p[6], heute - i, '08:00', '18:00', 45, 'Messe Halle 3', 'freigegeben', k_messe, u),
        (f, p[7], heute - i, '16:00', '23:00', 30, 'Messe Halle 3', 'freigegeben', k_messe, u);
    end if;
  end loop;
  insert into public.stundenzettel (firma_id, personal_id, datum, beginn, ende, pause_min, einsatz, status, notiz, kunde_id, erstellt_von) values
    (f, p[13], heute - 2, '18:00', '23:30', 0, 'Klinikum Nord', 'abgelehnt', 'Bitte Pause eintragen', k_klinik, u);
  insert into public.stempel (firma_id, personal_id, art, zeit, einsatz, am_ort) values
    (f, p[1], 'kommen', heute::timestamp + interval '5 hours 58 minutes', 'Grundschule am Weiher', true),
    (f, p[12], 'kommen', heute::timestamp + interval '6 hours 55 minutes', 'Logistikzentrum Hafen', true),
    (f, p[12], 'pause', heute::timestamp + interval '10 hours', 'Logistikzentrum Hafen', true);
  insert into public.spesen (firma_id, personal_id, datum, art, betrag, notiz, status, freigegeben_von, freigegeben_am) values
    (f, p[1], heute - 6, 'tanken', 68.40, 'Firmenwagen AC-RF 101', 'freigegeben', u, now() - interval '4 days'),
    (f, p[1], heute - 2, 'parken', 6.50, 'Parkhaus Markt', 'erfasst', null, null),
    (f, p[7], heute - 9, 'verpflegung', 14.00, 'Messe-Nachtschicht', 'erfasst', null, null),
    (f, p[4], heute - 15, 'material', 23.89, 'Baumarkt: Ersatzteile Spender', 'abgelehnt', u, now() - interval '12 days');

  -- ---------- Rechnungen, Belege ----------
  -- Issued invoices (GoBD since 03.11.2026): first into a temporary table, then frozen with sender/recipient snapshot.
  create temp table tmp_re (like public.rechnungen including defaults) on commit drop;
  insert into tmp_re (firma_id, kunde_id, nummer, monat, datum, positionen, netto, ust_satz, erstellt_von, bezahlt_am, mahnstufe, gemahnt_am, zahlungsziel_tage) values
    (f, k_stadt, 'RE-' || to_char(heute, 'YYYY') || '-0041', vvm, (date_trunc('month', heute) - interval '1 month')::date + 2,
      '[{"text":"Unterhaltsreinigung Rathaus und Grundschule","menge":312,"einheit":"Std.","preis":29.90,"betrag":9328.80}]', 9328.80, 19, u, (date_trunc('month', heute) - interval '1 month')::date + 15, 0, null, 14),
    (f, k_log, 'RE-' || to_char(heute, 'YYYY') || '-0042', vvm, (date_trunc('month', heute) - interval '1 month')::date + 2,
      '[{"text":"Arbeitnehmerüberlassung Lagerhelfer","menge":168,"einheit":"Std.","preis":32.80,"betrag":5510.40},{"text":"Werkschutz Nacht inkl. Nachtzuschlag","menge":176,"einheit":"Std.","preis":41.00,"betrag":7216.00}]', 12726.40, 19, u, null, 1, heute - 6, 14),
    (f, k_stadt, 'RE-' || to_char(heute, 'YYYY') || '-0047', vm, date_trunc('month', heute)::date + 1,
      '[{"text":"Unterhaltsreinigung Rathaus und Grundschule","menge":298,"einheit":"Std.","preis":29.90,"betrag":8910.20}]', 8910.20, 19, u, null, 0, null, 14),
    (f, k_bank, 'RE-' || to_char(heute, 'YYYY') || '-0048', vm, date_trunc('month', heute)::date + 1,
      '[{"text":"Unterhaltsreinigung Filiale Markt, monatliche Pauschale","menge":1,"einheit":"Monat","preis":1450.00,"betrag":1450.00}]', 1450.00, 19, u, date_trunc('month', heute)::date + 5, 0, null, 14);
  perform set_config('jarvis.rechnung_fn', '1', true);
  insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, positionen, netto, ust_satz, erstellt_von, bezahlt_am, mahnstufe, gemahnt_am,
    zahlungsziel_tage, status, art, absender, empfaenger, kleinunternehmer, ust_betrag, ausgestellt_am)
  select t.firma_id, t.kunde_id, t.nummer, t.monat, t.datum, t.positionen, t.netto, t.ust_satz, t.erstellt_von, t.bezahlt_am, t.mahnstufe, t.gemahnt_am,
    t.zahlungsziel_tage, 'ausgestellt', 'rechnung',
    jsonb_build_object('name', fi.name, 'strasse', coalesce(fi.strasse, ''), 'plz', coalesce(fi.plz, ''), 'ort', coalesce(fi.ort, ''), 'telefon', coalesce(fi.telefon, ''),
      'email', coalesce(fp.email, ''), 'ustid', coalesce(fp.ustid, ''), 'steuernummer', coalesce(fp.steuernummer, ''), 'zahlungshinweis', coalesce(fp.zahlungshinweis, '')),
    jsonb_build_object('name', k.name, 'ansprechpartner', coalesce(k.ansprechpartner, ''), 'strasse', coalesce(k.strasse, ''), 'plz', coalesce(k.plz, ''),
      'ort', coalesce(k.ort, ''), 'email', coalesce(k.email, ''), 'leitweg', ''),
    false, round(t.netto * t.ust_satz / 100, 2), t.datum::timestamptz
  from tmp_re t join public.firmen fi on fi.id = t.firma_id left join public.firmenprofil fp on fp.firma_id = t.firma_id join public.kunden k on k.id = t.kunde_id;
  perform set_config('jarvis.rechnung_fn', '', true);
  insert into jarvis_intern.rechnungsnummern (firma_id, jahr, letzte) values (f, extract(year from heute)::int, 48)
    on conflict (firma_id, jahr) do update set letzte = greatest(jarvis_intern.rechnungsnummern.letzte, 48);
  insert into public.belege (firma_id, datum, lieferant, kategorie, brutto, ust_satz, notiz, erstellt_von) values
    (f, heute - 3, 'Tankstelle am Ring', 'fahrzeug', 84.20, 19, 'AC-RF 101', u),
    (f, heute - 5, 'Reinigungsbedarf Rheinland', 'material', 612.45, 19, 'Mikrofasertücher, Konzentrat', u),
    (f, heute - 8, 'Bürobedarf Schreiber', 'buero', 37.90, 19, '', u),
    (f, date_trunc('month', heute)::date, 'Hausverwaltung Beispielpark', 'miete', 2380.00, 19, 'Büro und Lager Aachen', u),
    (f, heute - 12, 'Mobilfunk Beispiel', 'telefon', 119.00, 19, '8 Diensthandys', u),
    (f, heute - 14, 'Bäckerei Krümel', 'reise', 18.60, 7, 'Verpflegung Messeaufbau', u),
    (f, (date_trunc('month', heute) - interval '1 month')::date + 4, 'Versicherung Rhein (Beispiel)', 'versicherung', 1245.00, 0, 'Betriebshaftpflicht Quartal', u),
    (f, (date_trunc('month', heute) - interval '1 month')::date + 10, 'Reinigungsbedarf Rheinland', 'material', 455.10, 19, '', u),
    (f, (date_trunc('month', heute) - interval '1 month')::date + 18, 'Tankstelle am Ring', 'fahrzeug', 96.70, 19, 'K-RF 202', u);

  -- ---------- Ausschreibungen (Treffer) mit Angebot, Kalkulation, Fristen ----------
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, fragefrist, erstellt, zustaendig) values
    (f, b_ac, 'Unterhaltsreinigung von 9 Kitas im Kreis Beispiel-Land (Beispiel)', 'https://www.evergabe-online.de', (heute + 19)::timestamp + interval '10 hours', 'neu', 9,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Unterhalts- und Glasreinigung in 9 Kitas, 3 Lose\n\n**Warum passend:** Kerngeschäft Unterhaltsreinigung, Kitas im Umkreis von Aachen, Lose auch für mittlere Betriebe.\n\n## Auf einen Blick\n\n| | |\n|---|---|\n| **Auftraggeber** | Kreisverwaltung Beispiel-Land, Zentrale Vergabestelle (Beispiel) |\n| **Was** | Unterhaltsreinigung von 9 Kindertagesstätten, 3 Lose |\n| **Laufzeit** | 24 Monate, Verlängerung um 2 × 12 Monate möglich |\n| **Umfang** | geschätzter Gesamtwert 620.000 EUR |\n| **Zuschlag** | 60 % Preis, 40 % Qualität (Reinigungskonzept) |\n\n## ⏰ Fristen\n\nAngebotsabgabe elektronisch, Rückfragen bis 7 Tage vor Ablauf. Ortsbesichtigung empfohlen.\n\n## Die Lose / Leistungen\n\n| Los | Leistung | Ort | Menge |\n|---|---|---|---|\n| 1 | Kitas Nord (3 Häuser) | Beispiel-Land | 2.900 m² |\n| 2 | Kitas Mitte (3 Häuser) | Beispiel-Land | 3.100 m² |\n| 3 | Kitas Süd (3 Häuser) | Beispiel-Land | 2.700 m² |\n\n## Passt das zum Kunden? 9/10\n\n**Dafür spricht:** Kerngeschäft, Region, mehrere Lose.\n\n**Worauf achten:** Hygieneplan Kita, Nachweis Referenzen aus den letzten 3 Jahren.\n',
     18, (heute + 12)::timestamp + interval '12 hours', now() - interval '1 day', null) returning id into v_neu1;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_k, 'Bewachung und Empfangsdienst Verwaltungsgebäude Köln-Deutz (Beispiel)', 'https://www.evergabe-online.de', (heute + 26)::timestamp + interval '11 hours', 'neu', 8,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Empfangs- und Wachdienst werktags 6–22 Uhr, Revierfahrten nachts\n\n**Warum passend:** Objektschutz gehört zu euren Leistungen, Standort Köln.\n\n## Kurzüberblick\n\n**Geschätzter Auftragswert:** 540.000 €\n\n**Laufzeit:** 36 Monate\n\n**Nachweise:** Sachkunde § 34a für alle Kräfte, Bewachungserlaubnis, Haftpflicht 5 Mio. €.\n',
     6, now() - interval '2 days') returning id into v_neu2;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_d, 'Glasreinigung Hochschulgebäude Düsseldorf (Beispiel)', 'https://www.evergabe-online.de', (heute + 5)::timestamp + interval '10 hours', 'neu', 6,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Glas- und Rahmenreinigung zweimal jährlich, ca. 14.000 m² Glasfläche\n\n**Warum passend:** Glasreinigung im Leistungsspektrum, teilweise mit Hubsteiger (Partner nötig).\n\n## Kurzüberblick\n\n**Geschätzter Auftragswert:** 85.000 €\n\n**Laufzeit:** 24 Monate\n',
     9, now() - interval '3 days') returning id into v_neu3;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_km, 'Servicepersonal für Kongresse und Messen, Rahmenvereinbarung (Beispiel)', 'https://www.evergabe-online.de', (heute + 11)::timestamp + interval '12 hours', 'pruefen', 9,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Servicekräfte, Garderobe und Einlass für ca. 40 Veranstaltungstage im Jahr\n\n**Warum passend:** Messe-Team Köln, Überlassung von Servicepersonal ist Kerngeschäft.\n\n## Kurzüberblick\n\n**Lose:** 2 (Service; Einlass und Garderobe)\n\n**Geschätzter Auftragswert:** 300.000 €\n\n**Laufzeit:** 24 Monate\n',
     4, now() - interval '6 days') returning id into v_pr1;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_ac, 'Hausmeisterdienste und Winterdienst Schulzentrum (Beispiel)', 'https://www.evergabe-online.de', (heute + 3)::timestamp + interval '9 hours', 'pruefen', 7,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Hausmeister vor Ort 30 Std./Woche und Winterdienst\n\n**Warum passend:** Hausmeisterdienste gehören zu euren Leistungen; Winterdienst über Partner möglich.\n\n## Kurzüberblick\n\n**Geschätzter Auftragswert:** 140.000 €\n\n**Laufzeit:** 36 Monate\n',
     22, now() - interval '8 days') returning id into v_pr2;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt, kaufverantwortlich_id) values
    (f, b_d, 'Unterhaltsreinigung Klinik-Verwaltung und Ambulanzen (Beispiel)', 'https://www.evergabe-online.de', (heute + 8)::timestamp + interval '10 hours', 'angebot', 8,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Unterhaltsreinigung 8.400 m² Verwaltung und Ambulanzen, Desinfektion nach Hygieneplan\n\n**Warum passend:** Bestandskunde Klinikum, Desinfektor im Team.\n\n## Die Lose / Leistungen\n\n| Los | Leistung | Ort | Menge |\n|---|---|---|---|\n| 1 | Verwaltung | Düsseldorf | 5.200 m², ca. 6.100 Std./Jahr |\n| 2 | Ambulanzen | Düsseldorf | 3.200 m², ca. 4.300 Std./Jahr |\n',
     5, now() - interval '14 days', u) returning id into v_ang;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_d, 'Werkschutz Hafenareal, 24/7 (Beispiel)', 'https://www.evergabe-online.de', (heute - 4)::timestamp + interval '10 hours', 'abgegeben', 7,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Werkschutz mit 2 Kräften rund um die Uhr, Rundgänge mit Kontrollsystem\n\n**Warum passend:** Erfahrung aus Logistikzentrum Hafen.\n',
     3, now() - interval '30 days') returning id into v_abg;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_ac, 'Unterhaltsreinigung Rathaus und Grundschule Musterstadt (Beispiel)', 'https://www.evergabe-online.de', (heute - 300)::timestamp + interval '10 hours', 'gewonnen', 9,
     E'## Jarvis-Bewertung\n\n**Gesucht:** Unterhaltsreinigung Rathaus und eine Grundschule\n\n**Warum passend:** Direkt am Standort Aachen.\n',
     2, now() - interval '330 days') returning id into v_gew;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, b_k, 'Reinigung Bürgerämter Köln (Beispiel)', 'https://www.evergabe-online.de', (heute - 60)::timestamp + interval '10 hours', 'verloren', 6, E'## Jarvis-Bewertung\n\n**Gesucht:** Reinigung von 4 Bürgerämtern\n', 11, now() - interval '100 days') returning id into v_verl;
  insert into public.vorgaenge (firma_id, bereich_id, titel, link, frist, status, punkte, steckbrief, entfernung_km, erstellt) values
    (f, null, 'Gebäudereinigung Bundesbehörde Berlin (Beispiel)', 'https://www.evergabe-online.de', (heute + 15)::timestamp + interval '10 hours', 'verworfen', 4, E'## Jarvis-Bewertung\n\n**Gesucht:** Reinigung eines Dienstgebäudes in Berlin\n\n**Warum passend:** Leistung passt, aber außerhalb der Region.\n', 560, now() - interval '5 days') returning id into v_verw;
  insert into public.treffer_feedback (firma_id, vorgang_id, grund, notiz) values (f, v_verw, 'region', 'Berlin ist zu weit weg'), (f, v_neu1, 'passt', '');
  insert into public.kalkulationen (firma_id, vorgang_id, eingaben, erstellt_von) values (f, v_ang, kalk || '{"lohn":14.80}', u), (f, v_gew, kalk, u);
  insert into public.angebotsmappen (firma_id, vorgang_id, erstellt_von, text, freigabe_status) values
    (f, v_ang, u, E'# Angebot Unterhaltsreinigung Klinik-Verwaltung und Ambulanzen\n\nSehr geehrte Damen und Herren,\n\nwir bieten die Unterhaltsreinigung beider Lose mit eigenem, eingewiesenem Personal an.\n\n## Preise\n\n- Los 1 Verwaltung: 28,90 € je Stunde\n- Los 2 Ambulanzen: 31,40 € je Stunde (inkl. Desinfektion)\n\n## Qualität\n\nFeste Objektleitung, monatliche Kontrollen, Reaktionszeit 4 Stunden.\n', 'wartet'),
    (f, v_abg, u, E'# Angebot Werkschutz Hafenareal\n\nWerkschutz 24/7 mit 2 Kräften, Rundgangskontrolle per QR-Kontrollpunkten.\n\nStundensatz: 39,80 € (Nacht 49,75 €)\n', 'wartet');
  -- Approving is only allowed for the firm's management itself (trigger checks auth.uid()), so act as the account here.
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  update public.angebotsmappen set freigabe_status = 'genehmigt', freigabe_von = u, freigabe_am = now() - interval '6 days', freigabe_notiz = 'Passt so, bitte abgeben.' where firma_id = f and vorgang_id = v_abg;
  perform set_config('request.jwt.claims', '', true);
  insert into public.bieterfragen (firma_id, vorgang_id, frage, status, gestellt_am, antwort, user_id) values
    (f, v_ang, 'Sind die Reinigungsmittel vom Auftragnehmer zu stellen oder gibt es ein Klinik-Sortiment?', 'beantwortet', heute - 6, 'Desinfektionsmittel stellt die Klinik, alle übrigen Mittel der Auftragnehmer.', u),
    (f, v_ang, 'Ist eine Besichtigung der Ambulanzen außerhalb der Sprechzeiten möglich?', 'gestellt', heute - 2, '', u),
    (f, v_neu1, 'Gibt es Flächenaufstellungen je Kita als Excel-Datei?', 'offen', null, '', u);
  insert into public.eigene_termine (firma_id, vorgang_id, user_id, titel, zeit, art, ort, notiz) values
    (f, v_neu1, u, 'Ortsbesichtigung Kita Nord', (heute + 6)::timestamp + interval '9 hours', 'besichtigung', 'Kita Sonnenblume, Beispielweg 3', 'Sabine mitnehmen'),
    (f, v_ang, u, 'Submission Klinik', (heute + 8)::timestamp + interval '10 hours', 'submission', 'elektronisch', ''),
    (f, null, u, 'Jahresgespräch Messegesellschaft', (heute + 2)::timestamp + interval '14 hours', 'gespraech', 'Köln, Messeallee 5', '');
  insert into public.vorgang_notizen (firma_id, vorgang_id, user_id, text) values
    (f, v_ang, u, 'Kalkulation mit Lohn 14,80 € (LG 1 + Zulage), Desinfektion als eigene Position.'),
    (f, v_neu1, u, 'Klingt gut. Sabine prüft Kapazität für Los 1 und 3.'),
    (f, v_gew, u, 'Verlängerungsoption rechtzeitig ansprechen.');
  insert into public.aufgaben (firma_id, vorgang_id, titel, zustaendig_id, faellig, erstellt_von) values
    (f, v_ang, 'Angebot freigeben und hochladen', u, heute + 6, u),
    (f, v_neu1, 'Referenzliste Kitas aktualisieren', u, heute + 4, u),
    (f, v_pr2, 'Partner für Winterdienst anfragen', u, heute - 1, u),
    (f, null, 'Präqualifikation VOB verlängern', u, heute + 14, u);
  insert into public.aufgaben (firma_id, vorgang_id, titel, zustaendig_id, faellig, erledigt, erstellt_von) values
    (f, v_abg, 'Angebot Werkschutz abgeben', u, heute - 5, now() - interval '5 days', u);
  insert into public.einsaetze (firma_id, vorgang_id, personal_id, status) values
    (f, v_ang, p[13], 'zugesagt'), (f, v_ang, p[11], 'angefragt'), (f, v_ang, p[1], 'geplant'),
    (f, v_pr1, p[6], 'zugesagt'), (f, v_pr1, p[8], 'angefragt'),
    (f, v_gew, p[2], 'zugesagt'), (f, v_gew, p[1], 'zugesagt'), (f, v_gew, p[5], 'zugesagt');
  insert into public.einsatzplaene (vorgang_id, firma_id, ort, beginn, ende, treffpunkt, kleidung, ansprechpartner, hinweise) values
    (v_pr1, f, 'Kongresszentrum Rhein (Beispiel), Köln', (heute + 30)::timestamp + interval '7 hours', (heute + 30)::timestamp + interval '19 hours', 'Personaleingang Nord', 'Schwarz-weiß, schwarze Schuhe', 'Lukas Schmitz, +49 170 0000006', 'Akkreditierung am Vortag abholen.');
  insert into public.partner_anfragen (firma_id, vorgang_id, partner_id, los, status, notiz)
    select f, v_neu3, id, 'Glasflächen über 8 m', 'angebot', 'Hubsteiger inklusive' from public.partner where firma_id = f and name like 'Höhenwerk%' returning id into anfrage;
  insert into public.partner_preise (firma_id, anfrage_id, preis) values (f, anfrage, 12400);
  insert into public.partner_anfragen (firma_id, vorgang_id, partner_id, los, status)
    select f, v_pr2, id, 'Winterdienst', 'angefragt' from public.partner where firma_id = f and name like 'Winterdienst%';
  insert into public.vertraege (firma_id, vorgang_id, beginn, ende, verlaengerung_bis, option_frist, personen_soll, ansprechpartner, notiz) values
    (f, v_gew, heute - 270, heute + 95, heute + 460, heute + 20, 4, 'Frau Beispiel, +49 241 0000100', 'Verlängerung um 12 Monate, Erklärung 3 Monate vor Ende');
  insert into public.angebotsergebnisse (firma_id, vorgang_id, umsatz, kosten, notiz) values
    (f, v_gew, 107000, 89500, 'Erstes Vertragsjahr hochgerechnet'), (f, v_verl, 0, 0, 'Preis 6 % über dem Zuschlag');

  -- ---------- Schwarzes Brett, Chat, Suchprofil, Einladungen ----------
  insert into public.mitteilungen (firma_id, bereich_id, titel, text, gueltig_bis, erstellt_von) values
    (f, null, 'Weihnachtsfeier am 12. Dezember', 'Alle Standorte, ab 18 Uhr im Brauhaus (Beispiel). Bitte bis Monatsende zusagen.', heute + 30, u),
    (f, b_k, 'Neue Funkgeräte im Lager Köln', 'Die alten Geräte bitte bis Freitag abgeben.', heute + 7, u),
    (f, null, 'Neue Arbeitsschutz-Unterweisung', 'Bitte digital bestätigen unter „Meine Einsätze & Daten“.', null, u);
  insert into public.chat_nachrichten (firma_id, bereich_id, einsatzort_id, user_id, text, erstellt) values
    (f, null, null, u, 'Willkommen im Team-Chat! Hier kommen kurze Infos für alle rein.', now() - interval '3 days'),
    (f, b_k, null, u, 'Köln: Fahrzeug K-RF 202 steht ab Montag wieder zur Verfügung.', now() - interval '1 day'),
    (f, null, o_halle, u, 'Messe Halle 3: Treffpunkt Donnerstag 7:45 Uhr Eingang Süd, Akkreditierung mitbringen.', now() - interval '5 hours'),
    (f, null, o_lager, u, 'Rolltor Rampe 7 wird morgen repariert, bitte beim Rundgang trotzdem prüfen.', now() - interval '2 hours');
  insert into public.suchprofile (firma_id, name, beschreibung, aktiv, einstellungen) values
    (f, 'Hauptprofil', 'Gebäudereinigung, Glasreinigung, Hausmeisterdienste, Objekt- und Veranstaltungsschutz sowie Arbeitnehmerüberlassung (Service, Logistik) im Rheinland.', true,
     jsonb_build_object('demo', true, 'recherche_version', 2, 'recherchiert_am', to_char(now() - interval '20 days', 'YYYY-MM-DD'),
       'website_beschreibung', 'Beispielfirma: Gebäudereinigung, Sicherheit und Personalservice an drei Standorten im Rheinland.',
       'websuche_beschreibung', 'Beispielfirma, keine echte Websuche.', 'radius_km', 50, 'laender', jsonb_build_array('DEU'), 'min_punkte', 6, 'suchgebiet_modus', 'firmenstandorte',
       'leistungen', jsonb_build_array(
         jsonb_build_object('name', 'Unterhaltsreinigung', 'cpv', jsonb_build_array('90911200', '90919200'), 'woerter', jsonb_build_array('unterhaltsreinigung', 'gebäudereinigung')),
         jsonb_build_object('name', 'Glasreinigung', 'cpv', jsonb_build_array('90911300'), 'woerter', jsonb_build_array('glasreinigung', 'fensterreinigung')),
         jsonb_build_object('name', 'Hausmeisterdienste', 'cpv', jsonb_build_array('98341140'), 'woerter', jsonb_build_array('hausmeister', 'winterdienst')),
         jsonb_build_object('name', 'Objektschutz', 'cpv', jsonb_build_array('79710000', '79713000'), 'woerter', jsonb_build_array('bewachung', 'wachdienst', 'empfangsdienst')),
         jsonb_build_object('name', 'Arbeitnehmerüberlassung', 'cpv', jsonb_build_array('79620000'), 'woerter', jsonb_build_array('arbeitnehmerüberlassung', 'leihpersonal', 'servicepersonal'))),
       'ausschluss', jsonb_build_array('reinraum', 'schiffsreinigung'), 'ausschluss_cpv', jsonb_build_array(),
       'firmenstandorte', jsonb_build_array(
         jsonb_build_object('name', 'Aachen', 'plz', '52068', 'quelle', 'Firmenprofil', 'bereich_id', b_ac),
         jsonb_build_object('name', 'Köln', 'plz', '50679', 'quelle', 'Firmenprofil', 'bereich_id', b_k),
         jsonb_build_object('name', 'Düsseldorf', 'plz', '40210', 'quelle', 'Firmenprofil', 'bereich_id', b_d)),
       'standorte', jsonb_build_array(
         jsonb_build_object('name', 'Aachen', 'plz_praefixe', jsonb_build_array('52'), 'bereich_id', b_ac),
         jsonb_build_object('name', 'Köln', 'plz_praefixe', jsonb_build_array('50', '51'), 'bereich_id', b_k),
         jsonb_build_object('name', 'Düsseldorf', 'plz_praefixe', jsonb_build_array('40', '41'), 'bereich_id', b_d)),
       'suchpunkte', jsonb_build_array(
         jsonb_build_object('name', 'Aachen', 'plz', '52068', 'lat', 50.7826, 'lon', 6.1131),
         jsonb_build_object('name', 'Köln', 'plz', '50679', 'lat', 50.9375, 'lon', 6.9773),
         jsonb_build_object('name', 'Düsseldorf', 'plz', '40210', 'lat', 51.2203, 'lon', 6.7920)),
       'erstlauf', to_char(now() - interval '20 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'erstlauf_fertig', to_char(now() - interval '20 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
       'suchlauf_ergebnis', jsonb_build_object('treffer', 10, 'geprueft', 2140)));
  insert into public.einladungen (firma_id, email, rolle, bereich_ids, token_hash, erstellt_von, anzeigename, funktion, finanzen, personal_id) values
    (f, 'sabine.krueger@beispiel.invalid', 'standortleitung', array[b_ac], encode(sha256(gen_random_uuid()::text::bytea), 'hex'), u, 'Sabine Krüger', 'Objektleitung Aachen', false, p[1]),
    (f, 'lukas.schmitz@beispiel.invalid', 'mitarbeiter', '{}', encode(sha256(gen_random_uuid()::text::bytea), 'hex'), u, 'Lukas Schmitz', 'Schichtleiter', false, p[7]),
    (f, 'steuerbuero@beispiel.invalid', 'leser', '{}', encode(sha256(gen_random_uuid()::text::bytea), 'hex'), u, 'Steuerbüro (Beispiel)', 'Steuerberatung', true, null);

  -- Phone notifications the triggers queued for this account while seeding are not sent.
  delete from public.push_warteschlange where user_id = u and erstellt >= start;
  raise notice 'Beispielfirma angelegt: %', f;
end $demo$;
commit;
