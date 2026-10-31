-- Statutory minimum-wage provisions for the roofing trade, transcribed from
-- § 2 TVMindestlohnDachd 13. These are floors, not the complete sector tariff.
insert into public.tarifkatalog
  (id,name,branche,region,tarifart,gruppenart,gruppen,berufe,quelle,quelle_url,gueltig_ab,geprueft_am,datenstatus,hinweis,aktiv)
values
  ('dachdecker-mindestlohn-2026','Dachdeckerhandwerk – Branchenmindestlohn','Dachdeckerhandwerk (Dach-, Wand- und Abdichtungstechnik)','Deutschland','Branchenmindestlohn','Mindestlohnstufe',
   array['Mindestlohn 1 · ungelernt','Mindestlohn 2 · gelernt/Geselle'],
   array['Dachdecker/in','Zimmerer/Zimmerin','Klempner/in'],
   '§ 2 TVMindestlohnDachd 13 – Rechtsnormen des Tarifvertrags zum Mindestlohn im Dachdeckerhandwerk',
   'https://www.gesetze-im-internet.de/tvmindestlohndachd_13/__2.html','2026-01-01','2026-10-31','Originalquelle',
   'Gesetzliche Branchenuntergrenze, kein vollständiger Tarifvertrag. Mindestlohn 1 gilt für überwiegend Hilfs-/Vorbereitungstätigkeiten. Mindestlohn 2 gilt für gelernte Beschäftigte mit den gesetzlich beschriebenen Berufsabschlüssen/Qualifikationen. Höhere Ansprüche aus anderen Tarifverträgen oder Einzelvereinbarungen bleiben unberührt. Vor Anwendung Geltungsbereich und aktuelle Rechtsfassung prüfen.',true)
on conflict (id) do nothing;

insert into public.tarifkatalog_saetze (tarif_id,gruppe,betrag,einheit,gueltig_ab,quelle_url,datenstand) values
('dachdecker-mindestlohn-2026','Mindestlohn 1 · ungelernt',14.96,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/tvmindestlohndachd_13/__2.html','2026-10-31'),
('dachdecker-mindestlohn-2026','Mindestlohn 2 · gelernt/Geselle',16.60,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/tvmindestlohndachd_13/__2.html','2026-10-31'),
('dachdecker-mindestlohn-2026','Mindestlohn 2 · gelernt/Geselle',17.10,'Stunde','2027-01-01','https://www.gesetze-im-internet.de/tvmindestlohndachd_13/__2.html','2026-10-31'),
('dachdecker-mindestlohn-2026','Mindestlohn 2 · gelernt/Geselle',17.60,'Stunde','2028-01-01','https://www.gesetze-im-internet.de/tvmindestlohndachd_13/__2.html','2026-10-31')
on conflict (tarif_id,gruppe,einheit,gueltig_ab) do nothing;

-- Add the new entry to the private tariff selection of every existing firm.
insert into public.firmen_tarifvertraege
  (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
select f.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
from public.firmen f cross join public.tarifkatalog c
where c.id='dachdecker-mindestlohn-2026' and c.aktiv and cardinality(c.gruppen)>0
on conflict do nothing;
