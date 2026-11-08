# Auftrag an den Browser-Chat: Sitemap der Auftraggeber-Seiten erneut senden (08.11.2026, 2. Runde)

Benjamins OK liegt vor (Chat 08.11.2026). Nur Crewtender; nichts anderes ändern.
Hintergrund: Google hat die Sitemap gelesen, als sie noch die alte Fassung mit 47 `bks:`-Adressen hatte. Seit der Umstellung auf Namen enthält sie rund 8.015 Adressen; die alten `bks:`-Adressen geben 404 (gewollt).

1. Vorab im Browser https://crewtender.eu/sitemap-auftraggeber.xml öffnen: Die Adressen müssen wie `https://crewtender.eu/auftraggeber/db-infrago-ag-…` aussehen (Namen, kein `bks%3A`). Wenn nicht: abbrechen und Benjamin Bescheid geben.
2. https://search.google.com/search-console/sitemaps?resource_id=sc-domain:crewtender.eu öffnen.
3. Bei „Neue Sitemap hinzufügen“ erneut `sitemap-auftraggeber.xml` eintragen → „Senden“ (das löst einen neuen Abruf aus).
4. Seite neu laden, Status und „Erkannte Seiten“ ablesen (Soll: rund 8.000; falls noch 47, in 1–2 Stunden noch einmal neu laden).
5. Oben „URL prüfen“: `https://crewtender.eu/auftraggeber/db-infrago-ag-geschaeftsbereich-fahrweg-bukr-16` → „Indexierung beantragen“.

## Rückmeldung
In docs/browser/protokoll.md (oder als Kopiertext an Benjamin): „## Erledigt (Datum)“ mit Status und Seitenzahl aus 4 und Ergebnis aus 5. Keine Passwörter.
