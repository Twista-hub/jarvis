-- Notices without a documents link pointed to a title search on oeffentlichevergabe.de, which often showed other
-- tenders (Benjamin, 09.11.2026). They now point to the notice's own page /ui/de/notices/<notice id> (the OCDS release
-- id, stored in roh.id). Existing catalogue entries and the firms' Vorgänge copied from them are corrected here; new
-- imports set the link directly (katalog-daten.ts, alarm.py).
update public.vergabekatalog k
set link = 'https://oeffentlichevergabe.de/ui/de/notices/' || lower(k.roh->>'id')
where k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%'
  and lower(k.roh->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.vorgaenge v
set link = k.link
from public.vergabekatalog k
where v.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%'
  and k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/notices/%'
  and (v.katalog_id = k.id or v.quelle_id = k.quelle_id or v.quelle_id = k.id);
