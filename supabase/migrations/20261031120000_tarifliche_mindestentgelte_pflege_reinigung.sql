-- Additional national sector minimums from published federal legal provisions.
-- These are separate floors, not full tariff agreements or costing rules.
insert into public.tarifkatalog
  (id,name,branche,region,tarifart,gruppenart,gruppen,berufe,quelle,quelle_url,gueltig_ab,gueltig_bis,geprueft_am,datenstatus,hinweis,aktiv)
values
  ('pflege-mindestentgelt-2026','Pflegebranche – Mindestentgelt','Ambulante, teilstationäre und stationäre Pflege','Deutschland','Branchenmindestlohn','Pflegemindestentgeltgruppe',
   array['Pflegekraft','Pflegeassistenz · mindestens einjährige Ausbildung','Pflegefachkraft'],
   array['Pflegehelfer/in','Pflegefachassistenz','Pflegefachkraft','Altenpfleger/in','Gesundheits- und Krankenpfleger/in'],
   '§ 2 Siebte Pflegearbeitsbedingungenverordnung (7. PflegeArbbV)','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html',
   '2026-07-01','2028-09-30','2026-10-31','Originalquelle',
   'Bundesweite gesetzliche Mindestentgelte nur für Pflegebetriebe und Beschäftigte im Geltungsbereich der §§ 1–2 7. PflegeArbbV. Auszubildende, Krankenhäuser und Beschäftigte in Verwaltung, Haustechnik, Küche, Hauswirtschaft, Gebäudereinigung, Empfang/Sicherheit, Gartenpflege, Wäscherei und Logistik sind grundsätzlich ausgenommen; gesetzliche Ausnahmen beachten. Pflegeassistenz setzt mindestens einjährige einschlägige Ausbildung und passende Tätigkeit voraus; Pflegefachkräfte benötigen die gesetzliche Berufsqualifikation. Kein vollständiger Tarifvertrag, keine automatische Lohnkalkulation.',true),
  ('gebaeudereinigung-mindestlohn-de-2026','Gebäudereinigung – Branchenmindestlohn','Gebäudereinigung','Deutschland','Branchenmindestlohn','Lohngruppe',
   array['LG 1 · Innen-/Unterhaltsreinigung','LG 6 · Glas-/Fassadenreinigung'],
   array['Gebäudereiniger/in','Reinigungskraft','Glas- und Fassadenreiniger/in'],
   '§ 2 TVMindestlohnGebäude 2024; 10. GebäudeArbbV','https://www.gesetze-im-internet.de/tvmindestlohngeb_ude_2024/__2.html',
   '2025-02-01','2026-12-31','2026-10-31','Originalquelle',
   'Bundesweite gesetzliche Branchenuntergrenze für gewerbliche Beschäftigte in Betrieben im Geltungsbereich des RTV Gebäudereinigung. Ab 01.01.2026: LG 1 15,00 €/Std., LG 6 18,40 €/Std. Die zwingende Arbeitsbedingungenverordnung gilt bis 31.12.2026; neue Sätze nach Ablauf erst nach Prüfung einer Nachfolgeregelung eintragen. Kein vollständiger Tarifvertrag, keine automatische Lohnkalkulation.',true)
on conflict (id) do nothing;

insert into public.tarifkatalog_saetze (tarif_id,gruppe,betrag,einheit,gueltig_ab,quelle_url,datenstand) values
('pflege-mindestentgelt-2026','Pflegekraft',16.52,'Stunde','2026-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('pflege-mindestentgelt-2026','Pflegeassistenz · mindestens einjährige Ausbildung',17.80,'Stunde','2026-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('pflege-mindestentgelt-2026','Pflegefachkraft',21.03,'Stunde','2026-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('pflege-mindestentgelt-2026','Pflegekraft',16.95,'Stunde','2027-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('pflege-mindestentgelt-2026','Pflegeassistenz · mindestens einjährige Ausbildung',18.26,'Stunde','2027-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('pflege-mindestentgelt-2026','Pflegefachkraft',21.58,'Stunde','2027-07-01','https://www.gesetze-im-internet.de/pflegearbbv_7/__2.html','2026-10-31'),
('gebaeudereinigung-mindestlohn-de-2026','LG 1 · Innen-/Unterhaltsreinigung',15.00,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/tvmindestlohngeb_ude_2024/__2.html','2026-10-31'),
('gebaeudereinigung-mindestlohn-de-2026','LG 6 · Glas-/Fassadenreinigung',18.40,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/tvmindestlohngeb_ude_2024/__2.html','2026-10-31')
on conflict (tarif_id,gruppe,einheit,gueltig_ab) do nothing;

-- Replace the prior trade-association citation for the painter floor with the
-- published legal provision, and propagate its provenance to firm copies.
update public.tarifkatalog set
  quelle='§ 2 TVMindestlohn Maler 12 (Rechtsnormen des Tarifvertrags)',
  quelle_url='https://www.gesetze-im-internet.de/tvmindestlohn_maler_12/BJNR0B30B0025.html',
  datenstatus='Originalquelle',
  hinweis='Bundesweite gesetzliche Branchenuntergrenze für gelernte Arbeitnehmer/Gesellen; ungelernte Arbeitnehmer fallen nicht unter diese Gesellenstufe. Betrieblicher und persönlicher Geltungsbereich sind in § 1 festgelegt; insbesondere gelten Ausnahmen für Baugewerbe und stationäre Fahrzeug-/Metalllackierung. Höhere Ansprüche bleiben unberührt. MalerArbbV 12 tritt mit Ablauf des 30.06.2027 außer Kraft. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation.'
where id='maler-gesellenmindestlohn-2026';

update public.tarifkatalog_saetze set quelle_url='https://www.gesetze-im-internet.de/tvmindestlohn_maler_12/BJNR0B30B0025.html'
where tarif_id='maler-gesellenmindestlohn-2026';

update public.firmen_tarifvertraege t set
  quelle=c.quelle, quelle_url=c.quelle_url, datenstatus=c.datenstatus, hinweis=c.hinweis,
  gueltig_bis=c.gueltig_bis
from public.tarifkatalog c
where t.katalog_id=c.id and c.id='maler-gesellenmindestlohn-2026';

-- Firm-specific copies for existing firms; future firms receive these from
-- the catalog-driven trigger created by migration 20261031070000.
insert into public.firmen_tarifvertraege
  (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
select f.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
from public.firmen f cross join public.tarifkatalog c
where c.id in ('pflege-mindestentgelt-2026','gebaeudereinigung-mindestlohn-de-2026') and c.aktiv and cardinality(c.gruppen)>0
on conflict do nothing;
