-- Additional, currently documented German sector floors from official sources.
-- These are minimums only, not complete tariff scales or automatic costing rules.
alter table public.tarifkatalog drop constraint tarifkatalog_tarifart_check;
alter table public.tarifkatalog add constraint tarifkatalog_tarifart_check
  check (tarifart in ('Tarifvertrag','Branchenmindestlohn','Gesetzlicher Mindestlohn'));
alter table public.firmen_tarifvertraege drop constraint firmen_tarifvertraege_tarifart_check;
alter table public.firmen_tarifvertraege add constraint firmen_tarifvertraege_tarifart_check
  check (tarifart in ('Tarifvertrag','Branchenmindestlohn','Gesetzlicher Mindestlohn'));

insert into public.tarifkatalog
  (id,name,branche,region,tarifart,gruppenart,gruppen,berufe,quelle,quelle_url,gueltig_ab,gueltig_bis,geprueft_am,datenstatus,hinweis,aktiv)
values
  ('ausbildung-mindestentgelt-2026','Aus- und Weiterbildung nach SGB II/III – Mindestentgelt','Pädagogische Aus- und Weiterbildungsdienstleistungen nach SGB II/III','Deutschland','Branchenmindestlohn','Mindestentgeltgruppe',
   array['Mindestlohn I · pädagogische Tätigkeit','Mindestlohn II · qualifizierte pädagogische Tätigkeit'],
   array['Pädagogische Fachkraft','Dozent/in','Lehrkraft'],
   '§ 2 6. AusbDienstLArbbV; aktuelle Sätze in der BMAS-Übersicht Branchenmindestlöhne',
   'https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2023-02-01','2026-12-31','2026-10-31','Originalquelle',
   'Gilt nur für pädagogisches Personal bei Aus- und Weiterbildungsdienstleistungen nach dem Zweiten oder Dritten Buch SGB. Mindestlohn II setzt die in der Verordnung bezeichnete Qualifikation voraus. Für 2026 gelten 20,24 bzw. 20,86 Euro je Stunde; Verordnung endet am 31.12.2026. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.',true),
  ('luftsicherheit-flughaefen-2026','Luftsicherheit an Verkehrsflughäfen – Mindestentgelt','Sicherheitskräfte an Verkehrsflughäfen','Deutschland','Branchenmindestlohn','Entgeltgruppe',
   array['Entgeltgruppe II · Luftsicherheitskontrollpersonal','Entgeltgruppe III · Luftsicherheitskontroll- und Sicherheitsdienst','Entgeltgruppe IV · qualifizierte Service- und Fluggastdienste'],
   array['Sicherheitskraft','Luftsicherheitskontrollkraft'],
   '§ 2 4. VFlughSiKArbbV; aktuelle Sätze in der BMAS-Übersicht Branchenmindestlöhne',
   'https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-01-01','2026-12-31','2026-10-31','Originalquelle',
   'Gilt ausschließlich im betrieblichen und persönlichen Geltungsbereich der 4. VFlughSiKArbbV für Sicherheitskräfte an Verkehrsflughäfen. Enthält nur die dort erfassten Entgeltgruppen II bis IV; die Verordnung endet am 31.12.2026. Kein allgemeiner Sicherheitsdienst-Mindestlohn, kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.',true),
  ('elektrohandwerk-mindestentgelt-2025','Elektrohandwerk – allgemeinverbindliches Mindestentgelt','Elektro- und Informationstechnische Handwerke','Deutschland','Branchenmindestlohn','Mindestentgelt',
   array['Allgemeinverbindliches Mindestentgelt'],
   array['Elektriker/in','Elektroniker/in','Mechatroniker/in','Telekommunikationstechniker/in','Elektroniker/in für Energie- und Gebäudetechnik'],
   'Allgemeinverbindlicherklärung des TV Mindestentgelt Elektrohandwerke vom 19.12.2024, BAnz AT 30.12.2024 B3',
   'https://www.bundesanzeiger.de/pub/publication/ngEun6IBpbkbTtpUDr5/content/ngEun6IBpbkbTtpUDr5/BAnz%20AT%2030.12.2024%20B3.pdf?inline','2025-01-01','2028-12-31','2026-10-31','Originalquelle',
   'Bundesweite Untergrenze im betrieblichen und persönlichen Geltungsbereich der Allgemeinverbindlicherklärung: handwerksmäßige Installation, Wartung oder Instandhaltung elektrischer und informationstechnischer Anlagen/Geräte sowie die im Tariftext beschriebenen Leitungs- und Kabelbauarbeiten. Auszubildende sind ausgenommen. Höhere regionale, betriebliche oder individuelle Ansprüche bleiben unberührt. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.',true),
  ('bodenabfertigung-flughaefen-mindestentgelt-2025','Bodenabfertigung an Verkehrsflughäfen – Mindestentgelt','Bodenabfertigungsdienste an deutschen Verkehrsflughäfen','Deutschland','Branchenmindestlohn','Entgeltgruppe / Stufe',
   array['EG 2 · Stufe 1','EG 3 · Stufe 1','EG 3 · Stufe 2','EG 4 · Stufe 1','EG 4 · Stufe 2','EG 5 · Stufe 1','EG 5 · Stufe 2','EG 6 · Stufe 1','EG 6 · Stufe 2','EG 7 · Stufe 1'],
   array['Flugzeugabfertiger/in','Gepäckabfertiger/in','Ramp Agent','Vorfeldmitarbeiter/in','Flughafenservicekraft','Bodenverkehrsdienstmitarbeiter/in','Check-in-Agent/in'],
   'Allgemeinverbindlicherklärung des ETV BVD vom 16.03.2026, BAnz AT 26.03.2026 B2',
   'https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2025-05-01',null,'2026-10-31','Originalquelle',
   'Nur die ausdrücklich allgemeinverbindlichen Gruppen/Stufen sind aufgeführt: EG 2 Stufe 1; EG 3 Stufen 1–2; EG 4–6 Stufen 1–2; EG 7 Stufe 1. EG 1 und EG 8–10 sowie weitere Stufen sind in der Bekanntmachung von der Allgemeinverbindlicherklärung ausgenommen. Gilt im fachlichen Geltungsbereich des Manteltarifvertrags für Bodenverkehrsdienstleistungen an deutschen Flughäfen; der Tarif ist frühestens zum 31.03.2027 kündbar. Entgeltstand vor Anwendung prüfen. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.',true),
  ('allgemeiner-mindestlohn-2026','Allgemeiner gesetzlicher Mindestlohn','Alle Branchen','Deutschland','Gesetzlicher Mindestlohn','Gesetzliche Untergrenze',
   array['Gesetzliche Untergrenze'],array[]::text[],
   '§ 1 Fünfte Mindestlohnanpassungsverordnung (MiLoV5)',
   'https://www.gesetze-im-internet.de/milov5/__1.html','2026-01-01',null,'2026-10-31','Originalquelle',
   'Allgemeine gesetzliche Untergrenze: 13,90 €/Std. ab 01.01.2026 und 14,60 €/Std. ab 01.01.2027. Gilt branchenübergreifend vorbehaltlich der gesetzlichen Ausnahmen, insbesondere § 22 MiLoG. Für anwendbare Branchenmindestlöhne oder höhere Tarif-/Einzelansprüche gilt nicht automatisch dieser niedrigere Betrag. Keine automatische Lohnkalkulation.',true),
  ('aue-lohnuntergrenze-2026','Arbeitnehmerüberlassung – gesetzliche Lohnuntergrenze','Arbeitnehmerüberlassung','Deutschland','Gesetzlicher Mindestlohn','Lohnuntergrenze',
   array['Gesetzliche Lohnuntergrenze'],array[]::text[],
   '§ 2 Siebte Verordnung über eine Lohnuntergrenze in der Arbeitnehmerüberlassung',
   'https://www.recht.bund.de/bgbl/1/2026/186/VO.html','2026-07-01','2027-09-30','2026-10-31','Originalquelle',
   'Branchenübergreifende Lohnuntergrenze für Beschäftigte in der Arbeitnehmerüberlassung: 14,96 €/Std. ab 01.07.2026, 15,33 €/Std. ab 01.09.2026 und 15,87 €/Std. ab 01.04.2027. Die Verordnung endet am 30.09.2027. Höhere Ansprüche aus dem anwendbaren Tarifvertrag oder Einsatzbereich bleiben unberührt. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.',true)
on conflict (id) do nothing;

insert into public.tarifkatalog_saetze (tarif_id,gruppe,betrag,einheit,gueltig_ab,quelle_url,datenstand) values
('ausbildung-mindestentgelt-2026','Mindestlohn I · pädagogische Tätigkeit',20.24,'Stunde','2026-01-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('ausbildung-mindestentgelt-2026','Mindestlohn II · qualifizierte pädagogische Tätigkeit',20.86,'Stunde','2026-01-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe II · Luftsicherheitskontrollpersonal',23.09,'Stunde','2026-01-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe III · Luftsicherheitskontroll- und Sicherheitsdienst',21.24,'Stunde','2026-01-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe IV · qualifizierte Service- und Fluggastdienste',17.21,'Stunde','2026-01-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe II · Luftsicherheitskontrollpersonal',24.09,'Stunde','2026-04-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe III · Luftsicherheitskontroll- und Sicherheitsdienst',22.24,'Stunde','2026-04-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('luftsicherheit-flughaefen-2026','Entgeltgruppe IV · qualifizierte Service- und Fluggastdienste',18.21,'Stunde','2026-04-01','https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Branchenmindestlohn/Branchenmindestlohn-art.html','2026-10-31'),
('elektrohandwerk-mindestentgelt-2025','Allgemeinverbindliches Mindestentgelt',14.41,'Stunde','2025-01-01','https://www.bundesanzeiger.de/pub/publication/ngEun6IBpbkbTtpUDr5/content/ngEun6IBpbkbTtpUDr5/BAnz%20AT%2030.12.2024%20B3.pdf?inline','2026-10-31'),
('elektrohandwerk-mindestentgelt-2025','Allgemeinverbindliches Mindestentgelt',14.93,'Stunde','2026-01-01','https://www.bundesanzeiger.de/pub/publication/ngEun6IBpbkbTtpUDr5/content/ngEun6IBpbkbTtpUDr5/BAnz%20AT%2030.12.2024%20B3.pdf?inline','2026-10-31'),
('elektrohandwerk-mindestentgelt-2025','Allgemeinverbindliches Mindestentgelt',15.49,'Stunde','2027-01-01','https://www.bundesanzeiger.de/pub/publication/ngEun6IBpbkbTtpUDr5/content/ngEun6IBpbkbTtpUDr5/BAnz%20AT%2030.12.2024%20B3.pdf?inline','2026-10-31'),
('elektrohandwerk-mindestentgelt-2025','Allgemeinverbindliches Mindestentgelt',16.10,'Stunde','2028-01-01','https://www.bundesanzeiger.de/pub/publication/ngEun6IBpbkbTtpUDr5/content/ngEun6IBpbkbTtpUDr5/BAnz%20AT%2030.12.2024%20B3.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 2 · Stufe 1',18.18,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 3 · Stufe 1',18.90,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 3 · Stufe 2',19.42,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 4 · Stufe 1',19.52,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 4 · Stufe 2',19.98,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 5 · Stufe 1',20.76,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 5 · Stufe 2',21.37,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 6 · Stufe 1',22.67,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 6 · Stufe 2',23.22,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 7 · Stufe 1',23.59,'Stunde','2025-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 2 · Stufe 1',18.91,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 3 · Stufe 1',19.65,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 3 · Stufe 2',20.19,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 4 · Stufe 1',20.29,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 4 · Stufe 2',20.76,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 5 · Stufe 1',21.57,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 5 · Stufe 2',22.19,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 6 · Stufe 1',23.53,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 6 · Stufe 2',24.09,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('bodenabfertigung-flughaefen-mindestentgelt-2025','EG 7 · Stufe 1',24.47,'Stunde','2026-05-01','https://www.bundesanzeiger.de/pub/publication/z9YYLxOeVvo6VqJMxDh/content/z9YYLxOeVvo6VqJMxDh/BAnz%20AT%2026.03.2026%20B2.pdf?inline','2026-10-31'),
('allgemeiner-mindestlohn-2026','Gesetzliche Untergrenze',13.90,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/milov5/__1.html','2026-10-31'),
('allgemeiner-mindestlohn-2026','Gesetzliche Untergrenze',14.60,'Stunde','2027-01-01','https://www.gesetze-im-internet.de/milov5/__1.html','2026-10-31'),
('aue-lohnuntergrenze-2026','Gesetzliche Lohnuntergrenze',14.96,'Stunde','2026-07-01','https://www.recht.bund.de/bgbl/1/2026/186/VO.html','2026-10-31'),
('aue-lohnuntergrenze-2026','Gesetzliche Lohnuntergrenze',15.33,'Stunde','2026-09-01','https://www.recht.bund.de/bgbl/1/2026/186/VO.html','2026-10-31'),
('aue-lohnuntergrenze-2026','Gesetzliche Lohnuntergrenze',15.87,'Stunde','2027-04-01','https://www.recht.bund.de/bgbl/1/2026/186/VO.html','2026-10-31')
on conflict (tarif_id,gruppe,einheit,gueltig_ab) do nothing;

insert into public.firmen_tarifvertraege
  (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
select f.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
from public.firmen f cross join public.tarifkatalog c
where c.id in ('ausbildung-mindestentgelt-2026','luftsicherheit-flughaefen-2026','elektrohandwerk-mindestentgelt-2025','bodenabfertigung-flughaefen-mindestentgelt-2025','allgemeiner-mindestlohn-2026','aue-lohnuntergrenze-2026')
  and c.aktiv and cardinality(c.gruppen)>0
on conflict do nothing;
