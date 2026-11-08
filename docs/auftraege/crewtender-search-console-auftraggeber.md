# Auftrag an den Browser-Chat: Sitemap der Auftraggeber-Seiten einreichen (08.11.2026)

Benjamins OK liegt vor (Chat 08.11.2026: „Ja, fang mit den Auftraggeber-Seiten an“). Nur Crewtender, nur die Sitemap einreichen und eine URL prüfen; nichts anderes ändern.
Google-Konto: dasselbe wie für sc-domain:crewtender.eu.

1. https://search.google.com/search-console/sitemaps?resource_id=sc-domain:crewtender.eu öffnen.
2. Bei „Neue Sitemap hinzufügen“ `sitemap-auftraggeber.xml` eintragen → „Senden“.
3. Nach dem Neuladen den Status ablesen (Erfolgreich / Konnte nicht abgerufen werden, Anzahl „Erkannte Seiten“).
4. Oben „URL prüfen“: die erste Adresse aus https://crewtender.eu/sitemap-auftraggeber.xml einfügen (Zeile mit `<loc>…</loc>`, nur die Adresse) → „Indexierung beantragen“.

## Rückmeldung
In docs/browser/protokoll.md (oder als Kopiertext an Benjamin): „## Erledigt (Datum)“ mit Status und Seitenzahl aus 3 und der geprüften Adresse aus 4. Keine Passwörter.
