-- Documents link (Benjamin 09.11.2026, "Digitales Kulturwerk" Lübeck): older catalog rows did not keep the release id in
-- roh, so 20261109100000 left about 9,000 title-search links. For national notices the number in the OCDS id
-- (ocds-mnwr74-<number>) is the notice id (checked on oeffentlichevergabe.de for 25960800, 25993686, 25978516).
-- EU notices carry the procedure UUID there, not the notice UUID; alarm/katalog_links.py fills those from the exports.
update public.vergabekatalog k
set link = 'https://oeffentlichevergabe.de/ui/de/notices/' || substring(k.quelle_id from '^ocds-[a-z0-9]+-([0-9]{6,12})$')
where k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%'
  and k.quelle_id ~ '^ocds-[a-z0-9]+-[0-9]{6,12}$';

update public.vorgaenge v set link = k.link from public.vergabekatalog k
where v.link like 'https://oeffentlichevergabe.de/ui/de/search?q=%' and k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/notices/%'
  and (v.katalog_id = k.id or v.quelle_id = k.quelle_id or v.quelle_id = k.id);
