# Auftrag an den Browser-Chat: Links mit Herkunftsangabe (utm) in Profilen und Verzeichnissen (08.11.2026)

**Neu (2. Runde, 08.11. abends): Kurzlinks statt langer utm-Adressen.** `https://crewtender.eu/instagram`, `/facebook`,
`/linkedin`, `/bluesky`, `/mastodon`, `/g2`, `/omr`, `/getapp` leiten auf die Startseite weiter und geben die Herkunft mit.
Überall, wo schon ein langer utm-Link steht, durch den Kurzlink ersetzen (Facebook-Website, Bluesky-Beschreibung,
Mastodon-Zusatzfeld). Instagram ändert Benjamin in der App (Link: `https://crewtender.eu/instagram`, Titel z. B. „Website“).
Neue Einträge (LinkedIn, G2, OMR, GetApp) gleich mit dem Kurzlink. Die Tabelle unten bleibt gültig, falls ein Kurzlink nicht geht.

Benjamins OK liegt vor (Auftrag „Messung einbauen und erste Klicks“, 08.11.2026). Nur Crewtender. Nichts posten, nichts kaufen,
keine Werbung, keine Einladungen. Nur das Website-/Link-Feld ändern; wo das Feld keine Parameter annimmt (Fehlermeldung oder
es wird abgeschnitten), den bisherigen Link lassen und „nicht möglich“ notieren.

Seit 08.11.2026 merkt sich crewtender.eu die Herkunft eines Besuchers ohne Cookie und speichert sie bei der Registrierung.
Dafür sollen alle Links auf crewtender.eu eine Quelle tragen:

| Wo | Feld | Neuer Link |
|---|---|---|
| Instagram @crewtender (Profil bearbeiten) | Website/Link | `https://crewtender.eu/?utm_source=instagram&utm_medium=social&utm_campaign=profil` |
| Facebook-Seite Crewtender (Seiteninfo) | Website | `https://crewtender.eu/?utm_source=facebook&utm_medium=social&utm_campaign=profil` |
| LinkedIn-Unternehmensseite Crewtender (Seite bearbeiten → Details) | Website | `https://crewtender.eu/?utm_source=linkedin&utm_medium=social&utm_campaign=profil` |
| Bluesky @crewtender.eu (Profil, Beschreibung) | Link im Text | `https://crewtender.eu/?utm_source=bluesky&utm_medium=social&utm_campaign=profil` |
| Mastodon (Profil, Zusatzfelder) | Website | `https://crewtender.eu/?utm_source=mastodon&utm_medium=social&utm_campaign=profil` |
| G2 (Produktseite Crewtender, falls bearbeitbar) | Website | `https://crewtender.eu/?utm_source=g2&utm_medium=verzeichnis` |
| OMR Reviews (sobald freigeschaltet) | Website | `https://crewtender.eu/?utm_source=omr&utm_medium=verzeichnis` |
| GetApp / Software Advice (sobald freigeschaltet) | Website | `https://crewtender.eu/?utm_source=getapp&utm_medium=verzeichnis` |

Für die Wochenpakete Facebook/Instagram: Links in Posts mit `utm_source=facebook` bzw. `utm_source=instagram`,
`utm_medium=social` und `utm_campaign=kw<Kalenderwoche>` (z. B. `kw47`). Auf LinkedIn genauso mit `utm_source=linkedin`.

## Zusatz: doppelte Sitemap in der Search Console entfernen
`sitemap.xml` liefert dieselben 271 Seiten wie `sitemap-seiten.xml` (die „Erfolgreich“ ist) und hängt bei Google auf
„Konnte nicht abgerufen werden“, obwohl die Datei funktioniert. Damit die Übersicht sauber ist:
https://search.google.com/search-console/sitemaps?resource_id=sc-domain:crewtender.eu → Zeile `sitemap.xml` anklicken →
oben rechts ⋮ → „Sitemap entfernen“. Die anderen drei Sitemaps bleiben.

## Rückmeldung
In docs/browser/protokoll.md (oder als Kopiertext an Benjamin): „## Erledigt (Datum)“ mit je Zeile: geändert / nicht möglich (warum). Keine Passwörter.
