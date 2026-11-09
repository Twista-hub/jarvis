-- National notices (below the EU thresholds) carry a numeric notice id (e.g. 25960800); the portal page
-- /ui/de/notices/<number> opens them as well (checked 09.11.2026 with "Digitales Kulturwerk", Hansestadt Lübeck).
-- Same correction as 20261109090000 for these ~9,400 entries and the Vorgänge copied from them.
update public.vergabekatalog k
set link = 'https://oeffentlichevergabe.de/ui/de/notices/' || (k.roh->>'id')
where k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%'
  and (k.roh->>'id') ~ '^[0-9]{6,12}$';

update public.vorgaenge v
set link = k.link
from public.vergabekatalog k
where v.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%'
  and k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/notices/%'
  and (v.katalog_id = k.id or v.quelle_id = k.quelle_id or v.quelle_id = k.id);
