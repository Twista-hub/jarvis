-- Statutory minimum wage for the scaffolding trade, effective 2026–2027.
-- This is a sector floor with a narrow business scope, not a full tariff agreement.
insert into public.tarifkatalog
  (id,name,branche,region,tarifart,gruppenart,gruppen,berufe,quelle,quelle_url,gueltig_ab,gueltig_bis,geprueft_am,datenstatus,hinweis,aktiv)
values
  ('geruestbau-mindestlohn-2026','Gerüstbauerhandwerk – Branchenmindestlohn','Gerüstbauerhandwerk','Deutschland','Branchenmindestlohn','Mindestlohnstufe',
   array['Gesetzlicher Branchenmindestlohn'],
   array['Gerüstbauer/in'],
   '§ 2 TV Mindestlohn Gerüstb 9, erstreckt durch § 1 9. GerüstbauerArbbV',
   'https://www.gesetze-im-internet.de/tvmindestlohn_ger_stb_9/__2.html','2026-01-01','2027-12-31','2026-10-31','Originalquelle',
   'Bundesweit zwingende Untergrenze im fachlichen Geltungsbereich des Gerüstbauer-Mindestlohntarifvertrags. Die Verordnung gilt vom 01.01.2026 bis 31.12.2027 und erfasst nicht pauschal alle Personen mit dem Beruf Gerüstbauer/in: maßgeblich sind unter anderem die betrieblichen Tätigkeiten und gesetzlichen Ausnahmen. Kein vollständiger Tarifvertrag und keine automatische Lohnkalkulation; Geltungsbereich und höhere Ansprüche im Einzelfall prüfen.',true)
on conflict (id) do nothing;

insert into public.tarifkatalog_saetze (tarif_id,gruppe,betrag,einheit,gueltig_ab,quelle_url,datenstand) values
('geruestbau-mindestlohn-2026','Gesetzlicher Branchenmindestlohn',14.35,'Stunde','2026-01-01','https://www.gesetze-im-internet.de/tvmindestlohn_ger_stb_9/__2.html','2026-10-31'),
('geruestbau-mindestlohn-2026','Gesetzlicher Branchenmindestlohn',14.90,'Stunde','2027-01-01','https://www.gesetze-im-internet.de/tvmindestlohn_ger_stb_9/__2.html','2026-10-31')
on conflict (tarif_id,gruppe,einheit,gueltig_ab) do nothing;

-- Add the new entry to existing firms; new firms receive it from the catalog trigger.
insert into public.firmen_tarifvertraege
  (firma_id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,katalog_id,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis)
select f.id,c.name,c.region,c.gruppen,c.quelle,c.quelle_url,c.gueltig_ab,c.gueltig_bis,true,c.id,c.tarifart,c.gruppenart,c.berufe,c.geprueft_am,c.datenstatus,c.hinweis
from public.firmen f cross join public.tarifkatalog c
where c.id='geruestbau-mindestlohn-2026' and c.aktiv and cardinality(c.gruppen)>0
on conflict do nothing;
