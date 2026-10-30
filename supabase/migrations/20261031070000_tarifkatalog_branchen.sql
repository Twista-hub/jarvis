-- Shared, source-linked tariff reference catalog. Only authenticated users may read it;
-- companies cannot mutate the shared entries. Customer-specific copies stay under existing RLS.
create table public.tarifkatalog (
  id text primary key check (length(id) between 3 and 100),
  name text not null check (length(trim(name)) between 2 and 180),
  branche text not null check (length(branche) between 2 and 180),
  region text not null check (length(region) between 2 and 120),
  tarifart text not null check (tarifart in ('Tarifvertrag', 'Branchenmindestlohn')),
  gruppenart text not null check (length(gruppenart) between 2 and 100),
  gruppen text[] not null default '{}',
  berufe text[] not null default '{}',
  quelle text not null check (length(quelle) between 2 and 500),
  quelle_url text not null check (quelle_url ~ '^https://'),
  gueltig_ab date,
  gueltig_bis date,
  geprueft_am date not null,
  datenstatus text not null check (datenstatus in ('Originalquelle', 'Tarifregister NRW – Gruppenanzahl geprüft', 'Branchenmindestlohn – Verbandsangabe', 'Nur Metadaten – Gruppen fehlen')),
  hinweis text not null default '',
  aktiv boolean not null default false,
  erstellt timestamptz not null default now(),
  check (gueltig_bis is null or gueltig_ab is null or gueltig_bis >= gueltig_ab),
  check ((datenstatus <> 'Nur Metadaten – Gruppen fehlen') or cardinality(gruppen) = 0),
  check (not aktiv or cardinality(gruppen) > 0)
);
alter table public.tarifkatalog enable row level security;
revoke all on table public.tarifkatalog from anon, authenticated;
grant select on table public.tarifkatalog to authenticated;
create policy tarifkatalog_lesen on public.tarifkatalog for select to authenticated using (true);

create table public.tarifkatalog_saetze (
  id bigint generated always as identity primary key,
  tarif_id text not null references public.tarifkatalog(id) on delete cascade,
  gruppe text not null check (length(gruppe) between 1 and 80),
  betrag numeric(10,2) not null check (betrag >= 0),
  waehrung text not null default 'EUR' check (waehrung = 'EUR'),
  einheit text not null check (einheit in ('Stunde','Monat','Jahr')),
  gueltig_ab date not null,
  gueltig_bis date,
  quelle_url text not null check (quelle_url ~ '^https://'),
  datenstand date not null,
  check (gueltig_bis is null or gueltig_bis >= gueltig_ab),
  unique (tarif_id,gruppe,einheit,gueltig_ab)
);
alter table public.tarifkatalog_saetze enable row level security;
revoke all on table public.tarifkatalog_saetze from anon, authenticated;
grant select on table public.tarifkatalog_saetze to authenticated;
create policy tarifkatalog_saetze_lesen on public.tarifkatalog_saetze for select to authenticated using (true);

alter table public.firmen_tarifvertraege
  add column katalog_id text references public.tarifkatalog(id) on delete set null,
  add column tarifart text not null default 'Tarifvertrag' check (tarifart in ('Tarifvertrag', 'Branchenmindestlohn')),
  add column gruppenart text not null default 'Entgeltgruppe',
  add column berufe text[] not null default '{}',
  add column quelle_url text not null default '' check (quelle_url = '' or quelle_url ~ '^https://'),
  add column datenstand date,
  add column datenstatus text not null default 'Firmenangabe',
  add column hinweis text not null default '';
-- Some agreements have separate wage and salary ladders (GaLaBau: 21 LG + 17 GG).
alter table public.firmen_tarifvertraege drop constraint firmen_tarifvertraege_gruppen_check;
alter table public.firmen_tarifvertraege add constraint firmen_tarifvertraege_gruppen_check
  check (cardinality(gruppen) between 1 and 60);
create unique index firmen_tarifvertraege_katalog on public.firmen_tarifvertraege(firma_id,katalog_id) where katalog_id is not null;

insert into public.tarifkatalog
(id,name,branche,region,tarifart,gruppenart,gruppen,berufe,quelle,quelle_url,gueltig_ab,gueltig_bis,geprueft_am,datenstatus,hinweis,aktiv)
values
('aue-gvp-dgb-2026','Zeitarbeit GVP/DGB','Arbeitnehmerüberlassung','Deutschland','Tarifvertrag','Entgeltgruppe',
  array['1','2a','2b','3','4','5','6','7','8','9'],array[]::text[],
  'DGB/GVP Entgelttarifvertrag 12.09.2025 und Entgeltrahmentarifvertrag 20.05.2025',
  'https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf',
  '2026-01-01',null,'2026-10-30','Originalquelle',
  'Branchenweiter Zeitarbeitstarif. Die Eingruppierung richtet sich nach der tatsächlich überwiegenden Tätigkeit; nicht nach dem Beruf des Kunden. Tariflohnwerte sind in der bestehenden Zeitarbeits-Kalkulation hinterlegt.',true),
('elektrohandwerk-nrw-2025','Elektrohandwerk NRW','Elektrotechniker-, Elektromaschinenbauer- und Informationstechniker-Handwerk','Nordrhein-Westfalen','Tarifvertrag','Entgeltgruppe',
  array['EG 1','EG 2','EG 3','EG 4','EG 5','EG 6','EG 7','EG 8','EG 9','EG 10','EG 11','EG 12'],
  array['Elektriker/in','Elektroniker/in','Mechatroniker/in','Telekommunikationstechniker/in'],
  'Tarifregister NRW, Datenblatt Elektrohandwerk (Stand 30.10.2026; Gruppenanzahl und Laufzeit)',
  'https://www.tarifregister.nrw.de/material/elektro.pdf','2025-10-01','2027-10-31','2026-10-30','Tarifregister NRW – Gruppenanzahl geprüft',
  'Übersicht nennt 12 Entgeltgruppen. Sie ist eine Arbeitshilfe; genaue Tätigkeitsmerkmale und Lohnhöhe bitte im Originalvertrag prüfen. Entgelttarifvertrag kündbar zum 31.10.2027.',true),
('gebaeudereinigung-nrw-2025','Gebäudereinigerhandwerk NRW','Gebäudereinigung','Nordrhein-Westfalen','Tarifvertrag','Lohngruppe',
  array['LG 1','LG 2','LG 3','LG 4','LG 5','LG 6','LG 7','LG 8'],
  array['Gebäudereiniger/in','Reinigungskraft','Hauswirtschaftskraft'],
  'Tarifregister NRW, Datenblatt Gebäudereinigerhandwerk (Stand 30.10.2026; Lohntarifvertrag)',
  'https://www.tarifregister.nrw.de/material/gebaeudereiniger3.pdf','2025-01-01','2026-12-31','2026-10-30','Tarifregister NRW – Gruppenanzahl geprüft',
  'Der aktuelle Lohntarifvertrag nennt 8 Lohngruppen und läuft bis 31.12.2026. Das ältere Gehaltstarifwerk wurde gekündigt und ist hier nicht als gültige Gruppe enthalten. Exakte Eingruppierung am Original prüfen.',true),
('baugewerbe-nrw-2025','Baugewerbe NRW','Bauhauptgewerbe und laut Tarifbereich zugehörige Baubetriebe','Nordrhein-Westfalen','Tarifvertrag','Lohn- und Gehaltsgruppe',
  array['LG 1','LG 2','LG 3','LG 4','LG 5','LG 6','LG 7','GG 1','GG 2','GG 3','GG 4','GG 5','GG 6','GG 7','GG 8','GG 9','GG 10','GG 11','GG 12'],
  array['Maurer/in','Maler/in','Lackierer/in','Trockenbauer/in','Fliesenleger/in','Dachdecker/in','Zimmerer/Zimmerin','Tischler/in','Bauhelfer/in','Baugeräteführer/in'],
  'Tarifregister NRW, Datenblatt Baugewerbe (Stand 30.10.2026; Gruppenanzahl und Laufzeit)',
  'https://www.tarifregister.nrw.de/material/bau6.pdf','2025-05-01','2027-03-31','2026-10-30','Tarifregister NRW – Gruppenanzahl geprüft',
  'Übersicht nennt 7 Lohngruppen und 12 Gehaltsgruppen; Lohn- und Gehaltstarifverträge laufen bis 31.03.2027. Die Berufszuordnung ist ein Branchenhinweis, keine rechtliche Eingruppierung.',true),
('gross-aussenhandel-nrw-2026','Groß- und Außenhandel NRW','Groß- und Außenhandel einschließlich tariflich zugehöriger Hilfs- und Nebenbetriebe','Nordrhein-Westfalen','Tarifvertrag','Lohn- und Gehaltsgruppe',
  array['LG 1','LG 2','LG 3','LG 4','LG 5','LG 6','LG 7','LG 8','GG 1','GG 2','GG 3','GG 4','GG 5','GG 6'],
  array['Kaufmännische Fachkraft','Bürokaufmann/-frau','Sachbearbeiter/in','Lagerhelfer/in','Kommissionierer/in','Fachkraft Lagerlogistik','Berufskraftfahrer/in'],
  'Tarifregister NRW, Datenblatt Groß- und Außenhandel (Stand 30.10.2026; Lohn- und Gehaltstarifvertrag)',
  'https://www.tarifregister.nrw.de/material/gross_aussen1.pdf','2026-05-01','2028-04-30','2026-10-30','Tarifregister NRW – Gruppenanzahl geprüft',
  'Übersicht nennt 8 Lohngruppen und 6 Gehaltsgruppen; Fassung vom 23.07.2026, kündbar zum 30.04.2028. Geltung muss anhand der Arbeitgeberbranche geprüft werden.',true),
('galabau-nrw-2025','Garten-, Landschafts- und Sportplatzbau NRW','Garten-, Landschafts- und Sportplatzbaubetriebe','Nordrhein-Westfalen','Tarifvertrag','Lohn- und Gehaltsgruppe',
  array['LG 1','LG 2','LG 3','LG 4','LG 5','LG 6','LG 7','LG 8','LG 9','LG 10','LG 11','LG 12','LG 13','LG 14','LG 15','LG 16','LG 17','LG 18','LG 19','LG 20','LG 21','GG 1','GG 2','GG 3','GG 4','GG 5','GG 6','GG 7','GG 8','GG 9','GG 10','GG 11','GG 12','GG 13','GG 14','GG 15','GG 16','GG 17'],
  array['Garten- und Landschaftsbauer/in','Gärtner/in'],
  'Tarifregister NRW, Datenblatt Garten-, Landschafts- und Sportplatzbau (Stand 30.10.2026; Gruppenanzahl und Laufzeit)',
  'https://www.tarifregister.nrw.de/material/gartenbau3.pdf','2025-07-01','2027-06-30','2026-10-30','Tarifregister NRW – Gruppenanzahl geprüft',
  'Übersicht nennt 21 Lohngruppen und 17 Gehaltsgruppen; Tarifverträge laufen bis 30.06.2027. Gruppenzuordnung nach tatsächlicher Aufgabe und Originalvertrag prüfen.',true),
('tvoed-vka-allgemein','TVöD-VKA – Allgemeiner Dienst','Kommunaler öffentlicher Dienst, allgemeiner Teil','Deutschland · VKA','Tarifvertrag','Entgeltgruppe',
  array['E 1','E 2','E 3','E 4','E 5','E 6','E 7','E 8','E 9a','E 9b','E 9c','E 10','E 11','E 12','E 13','E 14','E 15'],
  array['Bürokraft','Sachbearbeiter/in','Kaufmännische Fachkraft','Hausmeister/in'],
  'VKA, Durchgeschriebene Fassung TVöD-V (Lesefassung, Stand 01.08.2025)',
  'https://vka.de/wp-content/uploads/2026/04/250406_TVoeD-V_AEV_19_Lesefassung_Stand_01.08.2025.pdf',null,null,'2026-10-30','Originalquelle',
  'Gilt für erfasste kommunale Arbeitgeber, nicht pauschal für private Firmen. Eingruppierung nach Arbeitgeberbindung, Entgeltordnung und tatsächlich übertragener Tätigkeit.',true),
('tvoed-vka-sue','TVöD-VKA – Sozial- und Erziehungsdienst','Kommunaler Sozial- und Erziehungsdienst','Deutschland · VKA','Tarifvertrag','S-Entgeltgruppe',
  array['S 2','S 3','S 4','S 5','S 6','S 7','S 8a','S 8b','S 9','S 10','S 11a','S 11b','S 12','S 13','S 14','S 15','S 16','S 17','S 18'],
  array['Pädagogische Fachkraft','Erzieher/in','Kinderpfleger/in','Schulbegleiter/in','Integrationshelfer/in','Sozialassistent/in'],
  'VKA, TVöD-V – Anlage C Sozial- und Erziehungsdienst (Lesefassung, Stand 01.08.2025)',
  'https://vka.de/wp-content/uploads/2026/04/250406_TVoeD-V_AEV_19_Lesefassung_Stand_01.08.2025.pdf',null,null,'2026-10-30','Originalquelle',
  'Sondertabelle des TVöD-VKA. Welche S-Gruppe gilt, ergibt sich aus Tätigkeitsmerkmalen und Arbeitgeberbindung, nicht allein aus der Berufsbezeichnung.',true),
('tvoed-vka-pflege','TVöD-VKA – Pflege','Pflege- und Betreuungseinrichtungen kommunaler Arbeitgeber','Deutschland · VKA','Tarifvertrag','P-Entgeltgruppe',
  array['P 5','P 6','P 7','P 8','P 9','P 10','P 11','P 12','P 13','P 14','P 15','P 16'],
  array['Pflegefachkraft','Pflegehelfer/in','Betreuungskraft'],
  'VKA, Durchgeschriebene Fassung TVöD-B (Lesefassung, Stand 01.08.2025)',
  'https://vka.de/wp-content/uploads/2026/04/250406_TVoeD-B_AEV_18_Lesefassung_Stand_01.08.2025.pdf',null,null,'2026-10-30','Originalquelle',
  'Besondere Entgelttabelle TVöD-B; die Tabellenfassung nennt P 5 bis P 16. Arbeitgeberbindung und Tätigkeitsmerkmale am Original prüfen.',true),
('tv-l-allgemein-2026','TV-L – Allgemeine Entgelttabelle','Arbeitgeber der Länder, soweit vom TV-L erfasst','Deutschland · Länder','Tarifvertrag','Entgeltgruppe',
  array['E 1','E 2','E 3','E 4','E 5','E 6','E 7','E 8','E 9a','E 9b','E 9c','E 10','E 11','E 12','E 13','E 14','E 15'],
  array['Bürokraft','Sachbearbeiter/in','Lehrkraft'],
  'TdL, TV-L Anlage B, Entgelttabelle gültig 01.04.2026–31.12.2026',
  'https://www.tdl-online.de/fileadmin/downloads/TV-L/TV-L_Anlagen/Allgemeine_Entgelttabelle__Anlage_B___g%C3%BCltig_vom_01.04.2026_bis_31.12.2026.pdf',
  '2026-04-01','2026-12-31','2026-10-30','Originalquelle',
  'Gruppensystem und Entgelttabelle sind getrennte Angaben; die verlinkte Tabelle gilt bis 31.12.2026. Für Lehrkräfte können zusätzliche Tarifregeln gelten.',true),
('maler-gesellenmindestlohn-2026','Maler- und Lackiererhandwerk – Gesellenmindestlohn','Maler- und Lackiererhandwerk','Deutschland','Branchenmindestlohn','Mindestlohnstufe',
  array['Gesellen-Mindestlohn'],array['Maler/in','Lackierer/in'],
  'Bundesverband Farbe Gestaltung Bautenschutz, Mindestlohn ab 01.07.2026; 12. Mindestlohn-Verordnung',
  'https://www.farbe.de/aktuell/nachricht/artikel/mindestlohn-und-ecklohn-ost-steigen-zum-1-juli-2026',
  '2026-07-01','2027-06-30','2026-10-30','Branchenmindestlohn – Verbandsangabe',
  'Branchenmindestlohn, kein vollständiger Entgelttarifvertrag. Die veröffentlichte Gesellen-Untergrenze beträgt 16,13 €/Std. ab 01.07.2026; ungelernte Hilfskräfte fallen auf den gesetzlichen Mindestlohn zurück. Nicht als automatische Angebotspreiskalkulation verwendet.',true),
('dehoga-nrw-2026','Gastgewerbe NRW – Tarifabschluss 2026 (Gruppen offen)','Gaststätten- und Hotelgewerbe','Nordrhein-Westfalen','Tarifvertrag','Tarifband',
  '{}','{Servicekraft,Koch/Köchin,Küchenhilfe,Rezeptionist/in,Housekeeping}',
  'DEHOGA NRW, Tarifabschluss vom 23.09.2026; veröffentlichte Laufzeit 24 Monate, Gruppenbezeichnungen noch nicht bestätigt',
  'https://www.dehoga-nrw.de/branchenthemen/tarifeundloehne','2026-10-01',null,'2026-10-30','Nur Metadaten – Gruppen fehlen',
  'Öffentliche Verbandsseite bestätigt Tarifabschluss und Erhöhungsstufen, stellt aber keine aktuelle vollständige Gruppentabelle bereit. Daher noch keine Auswahl im Mitarbeiterformular.',false);

-- Effective wage values: the three GVP/DGB tables are copied from the original ETV.
-- Maler is a statutory minimum floor, not a full occupational tariff table.
insert into public.tarifkatalog_saetze (tarif_id,gruppe,betrag,einheit,gueltig_ab,quelle_url,datenstand) values
('aue-gvp-dgb-2026','1',14.96,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2a',15.29,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2b',15.69,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','3',16.69,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','4',17.65,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','5',19.78,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','6',21.97,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','7',25.56,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','8',27.36,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','9',28.70,'Stunde','2026-01-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','1',15.33,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2a',15.67,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2b',16.08,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','3',17.11,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','4',18.09,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','5',20.27,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','6',22.52,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','7',26.20,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','8',28.04,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','9',29.42,'Stunde','2026-09-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','1',15.87,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2a',16.22,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','2b',16.64,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','3',17.71,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','4',18.72,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','5',20.98,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','6',23.31,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','7',27.12,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','8',29.02,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('aue-gvp-dgb-2026','9',30.45,'Stunde','2027-04-01','https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf','2026-10-30'),
('maler-gesellenmindestlohn-2026','Gesellen-Mindestlohn',16.13,'Stunde','2026-07-01','https://www.farbe.de/aktuell/nachricht/artikel/mindestlohn-und-ecklohn-ost-steigen-zum-1-juli-2026','2026-10-30');

-- Each company receives its own RLS-protected copy so the existing staff form and
-- personal_tarifvertrag_fk remain company-scoped. The shared catalog is the source of truth.
update public.firmen_tarifvertraege t set
  katalog_id=c.id, tarifart=c.tarifart, gruppenart=c.gruppenart, berufe=c.berufe,
  quelle_url=c.quelle_url, datenstand=c.geprueft_am, datenstatus=c.datenstatus,
  hinweis=c.hinweis, geltungsbereich=c.region, gueltig_ab=coalesce(t.gueltig_ab,c.gueltig_ab),
  gueltig_bis=coalesce(t.gueltig_bis,c.gueltig_bis), quelle=c.quelle
from public.tarifkatalog c
where c.id='aue-gvp-dgb-2026' and t.name='Zeitarbeit GVP/DGB';

insert into public.firmen_tarifvertraege
  (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
select f.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
from public.firmen f cross join public.tarifkatalog c
where c.aktiv and cardinality(c.gruppen)>0
on conflict do nothing;

create or replace function public.firmen_tarifvertraege_anlegen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.firmen_tarifvertraege
    (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
  select new.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
  from public.tarifkatalog c where c.aktiv and cardinality(c.gruppen)>0
  on conflict do nothing;
  return new;
end $$;
