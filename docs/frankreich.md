# Frankreich: Datenquelle und Stand (02.11.2026)

## Quelle: BOAMP über die Open-Data-Dateien der DILA
- **Was:** Bulletin officiel des annonces des marchés publics. Pflichtveröffentlichung für alle Aufträge über den EU-Schwellen
  (die auch auf TED stehen) und für nationale Aufträge ab 90.000 € (FNS) sowie viele kleinere (MAPA).
- **Abruf:** `https://echanges.dila.gouv.fr/OPENDATA/BOAMP/JJJJ/MM/TT/<idweb>.xml`, eine XML-Datei pro Bekanntmachung,
  täglich neu (zweimal am Tag). `alarm/boamp.py`.
- **Lizenz:** Licence Ouverte / Open Licence 2.0 (data.gouv.fr, Datensätze „BOAMP“ und „API BOAMP“, Lizenzkennung `fr-lo`).
  Kostenlose Weiterverwendung, auch geschäftlich; Pflicht: Quelle nennen („Source : BOAMP, DILA“). Steht im Kurzüberblick.
- **robots.txt:** `echanges.dila.gouv.fr/robots.txt` gibt 404 (keine Einschränkung).
  **Nicht genutzt:** die Opendatasoft-API `boamp-datadila.opendatasoft.com/api/…`, weil deren robots.txt `/api/` für
  alle Crawler außer Googlebot sperrt (Regel: robots.txt beachten).
- **Menge:** Sonntag 01.11.: 144 Aufrufe zum Wettbewerb (nur EU-Bekanntmachungen); Montag 02.11. bis 21 Uhr: 117
  (94 FNS, 17 MAPA, 4 EU, 2 DSP). Auf dem Opendatasoft-Portal rund 20.500 Einträge (inkl. Zuschläge) in 60 Tagen.
- **Felder:** Auftraggeber, Abgabefrist, Départements, BOAMP-Kategorien (descripteurs), Kurzbeschreibung, Beschreibung,
  CPV (bei ca. 80 %), Postleitzahl/Ort, Link zur Bekanntmachung und zum Käuferprofil mit den Unterlagen.

## Eingebaut
- `alarm/boamp.py`: Tagesliste lesen, XML einlesen, nur Aufrufe (`NATURE=APPEL_OFFRE`, `STATUT=INITIAL`), Umwandlung in
  das Release-Format wie TED. `alarm/alarm.py`: Frankreich kommt jetzt aus BOAMP statt aus TED (keine Doppelten).
- `alarm/profile_db.py`: Umkreis in km nur für deutsche Postleitzahlen (Koordinaten sind nur für DE vorhanden).
  Französische Bekanntmachungen filtert nur die Départements-Auswahl der Firma (`departements`, aus `<DEP_PUBLICATION>`,
  sonst aus der PLZ); ohne Auswahl ganz Frankreich. Deutsche Suchorte gelten dort nicht.
- Oberfläche, KI-Texte und Mails auf Französisch (`web/src/franzoesisch/`, `alarm/sprache-fr.txt`, `mail.py`).
- Gewerke-Seiten `/fr/appels-d-offres/…` (`web/src/gewerke-fr.ts`).
- Test `alarm/test_boamp.py`, Lese-Workflow `.github/workflows/frankreich-test.yml`.

## Offen
- Live-Zahlen auf den Gewerke-Seiten (brauchen einen Katalog für Frankreich oder eine Zählung aus den Tagesdateien).
- Französische Rechtsseiten (Mentions légales, Datenschutz) und Preise in Euro für Frankreich.
