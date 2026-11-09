-- Click check of all document links (09.11.2026): about 3,000 catalog notices only named a portal (no number after the
-- host, e.g. http://www.evergabe-online.de, https://www.tender24.de, …/NetServer/), so "Unterlagen herunterladen"
-- opened the portal's start page. Those get the notice page on oeffentlichevergabe.de, which shows the notice and its
-- documents link. Here: notices whose id is known (release id in roh, or the number in a national OCDS id);
-- alarm/katalog_links.py does the rest from the daily exports. New imports choose the same (katalog-daten.ts).
update public.vergabekatalog k
set link = 'https://oeffentlichevergabe.de/ui/de/notices/' || coalesce(
      case when lower(k.roh->>'id') ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]{6,12})$' then lower(k.roh->>'id') end,
      substring(k.quelle_id from '^ocds-[a-z0-9]+-([0-9]{6,12})$'))
where k.quelle = 'bks'
  and substring(k.link from '^https?://[^/?#]+(.*)$') !~ '[0-9]'
  and (lower(k.roh->>'id') ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]{6,12})$'
       or k.quelle_id ~ '^ocds-[a-z0-9]+-[0-9]{6,12}$');

update public.vorgaenge v set link = k.link from public.vergabekatalog k
where substring(v.link from '^https?://[^/?#]+(.*)$') !~ '[0-9]' and k.quelle = 'bks'
  and k.link like 'https://oeffentlichevergabe.de/ui/de/notices/%'
  and (v.katalog_id = k.id or v.quelle_id = k.quelle_id or v.quelle_id = k.id);
