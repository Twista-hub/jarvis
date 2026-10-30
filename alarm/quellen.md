# Datenquellen: Prüfung der Nutzungsbedingungen

Regel: vor jedem automatischen Abruf Nutzungsbedingungen und robots.txt prüfen und hier festhalten.

## Bekanntmachungen (wer schreibt was aus?)

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| **Bekanntmachungsservice** (oeffentlichevergabe.de), Tagesexport | 28.10.2026 | Lizenz CC0 in jeder Datei; robots.txt 404. Rund 500 neue Ausschreibungen pro Tag aus über 40 Portalen | **Hauptquelle, täglich und zentraler stündlicher Katalog** |
| **TED** (EU), API v3 | 28./29.10.2026 | Legal Notice: Bekanntmachungen frei wiederverwendbar, auch kommerziell. API ohne Schlüssel | erlaubt; nur nötig für Kunden mit Standorten außerhalb Deutschlands |
| service.bund.de | 29.10.2026 | robots.txt sperrt `/Content/DE/Ausschreibungen/Suche/` (auch das RSS der Suche) | **nein**; Bundesvergaben stehen ohnehin im Bekanntmachungsservice |
| Vergabeplattform Berlin (berlin.de/vergabeplattform, RIB) | 29.10.2026 | robots.txt: Bots erlaubt, wenn sie sich ausweisen und robots.txt einhalten; RSS auf der Startseite erlaubt | erlaubt (RSS), bringt aber kaum mehr als der Bekanntmachungsservice |

### Neue Kandidaten (Claude, 30.10.2026, erkunden.yml Lauf 41127835342)

Abdeckung des Bekanntmachungsservice gemessen (14 Tage, 7.038 Ausschreibungen, Herkunft per Link der Unterlagen): Er enthält bereits Bekanntmachungen fast aller Landes- und Kommunalplattformen, u. a. HAD Hessen (108), Niedersachsen (225), evergabe.nrw (178), Vergabe Westfalen (174), Metropole Ruhr (155), VMP Rheinland (123), Brandenburg (319), Sachsen (59 + 43), Hamburg (66), Berlin (66), Bremen (48), MV (51), RLP (43), Bayern (41), Staatsanzeiger BW (76), Autobahn (139), Deutsche Bahn (136), GIZ (62), Fraunhofer (48). Auffällig wenig: Bayern und Baden-Württemberg im Verhältnis zur Größe.

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| TED Such-API v3 | 30.10.2026 | Legal Notice: Bekanntmachungen „zu kommerziellen oder nichtkommerziellen Zwecken frei weiterverwendbar“; Metadaten CC0; API ohne Schlüssel; robots.txt sperrt nur Webseiten-Suchergebnisse, nicht die API | **in Betrieb seit 30.10.2026** (`alarm/ted.py`): nur Länder, die eine Firma im Suchprofil ankreuzt; Deutschland nie über TED. Testlauf 29.10.2026: 75 Auftragsbekanntmachungen allein aus AT+NL an einem Tag, Titel auf Deutsch übersetzt |
| **Find a Tender** (Großbritannien, OCDS-API) | 30.10.2026 | Seite „Data and API documentation“: „Notice data is available under the Open Government Licence“ (v3, Weiterverwendung auch kommerziell mit Quellenangabe); robots.txt 404 | **in Betrieb** (`alarm/uk.py`), nur für Firmen mit Land Großbritannien; Quellenhinweis im Kurzüberblick. Testlauf 29.10.2026: 505 Bekanntmachungen, davon 66 neue Ausschreibungen und 23 Änderungen |
| Contracts Finder (England, kleine Aufträge) | 30.10.2026 | API offen dokumentiert, Nutzungsbedingungen-Seite nicht gefunden (404) | **noch nicht**, erst Bedingungen finden |
| **SAM.gov** (USA, Bundesbehörden, Get Opportunities API v2) | 30.10.2026 | Terms of Use (sam.gov/about/terms-of-use): „Systematic access (electronic harvesting) or extraction of content from the website, including the use of bots or spiders, is prohibited“ → **nur die offizielle API**, nie die Webseite. D&B-Beschränkungen (keine kommerzielle Nutzung außer „D&B Open Data“) betreffen Firmen-/Registrierungsdaten; Jarvis liest nur Ausschreibungen (Titel, Behörde, Ort, Frist, Link) | vorbereitet (`alarm/usa.py`), aktiv erst mit Secret `SAM_API_KEY`; vor Werbung für USA die API-Bedingungen auf open.gsa.gov noch einmal vollständig lesen |
| Open Data Bonn „Ausschreibungen/Vergabeverfahren“ (JSON) | 30.10.2026 | Lizenz CC0; robots.txt erlaubt, Crawl-delay 10; Quelle ist die TIS-Schnittstelle des Vergabemarktplatz NRW (geplante + vergebene städtische Aufträge) | erlaubt; geringer Mehrwert (Bonn steht über evergabe.nrw schon im Bekanntmachungsservice), höchstens geplante Vergaben als Frühwarnung |
| Vergabemarktplatz NRW Open-Data-Schnittstelle (ZIP, eForms-DE, täglich 23 Uhr) | 30.10.2026 | Abruf nur mit Kennung, die die Verfahrensbetreuung vergibt; Lizenz der Daten nicht angegeben; robots.txt der Infoseite unauffällig | **offen**: nur nach schriftlicher Freigabe und Kennung (Anfrage per Mail nur mit Benjamins OK). Vermutlich weitgehend doppelt zum Bekanntmachungsservice |
| HAD Hessen (had.de) | 30.10.2026 | robots.txt sperrt alle Such- und Archivseiten; XML-Schnittstelle nur für eVergabeplattformen; AGB Bieter noch nicht gelesen | **nein** (Suche gesperrt); Hessen kommt ohnehin über den Bekanntmachungsservice |
| auftraege.bayern.de | 30.10.2026 | robots.txt 404; Seite „Legalinfo“ noch nicht gelesen | offen; prüfen, weil Bayern im Bekanntmachungsservice unterrepräsentiert wirkt |
| vergabe.niedersachsen.de | 30.10.2026 | robots.txt `Allow: /` | erlaubt, aber schon im Bekanntmachungsservice (225 in 14 Tagen) |
| e-vergabe-sh.de, vergabe.rlp.de, sachsen-vergabe.de | 30.10.2026 | robots.txt 404 bzw. ohne Sperren; AGB-Seiten gefunden, noch nicht gelesen | offen, geringer Mehrwert (im Bekanntmachungsservice) |
| vergabe.metropoleruhr.de | 30.10.2026 | Verbindung abgelehnt (Skriptabruf) | **nein**, wir umgehen das nicht; kommt über den Bekanntmachungsservice |

## Vergabeunterlagen (PDFs)

| Portal | Anteil an unseren Treffern (7 Tage) | Ergebnis | Nutzung |
|---|---|---|---|
| DTVP (dtvp.de) | 9,7 % | AGB Bieter (29.10.2026): „Unzulässig sind systematische Abrufe der Auftragsbekanntmachungen sowie der Vergabeunterlagen, um damit eigene kommerzielle Angebote anzubieten oder diese damit anzureichern.“ Keine Weitergabe an Dritte | **nein** (der einmalige Test vom 29.10. bleibt eine Ausnahme) |
| Vergabeplattform Berlin (RIB) | 0,7 % | Nutzungsbedingungen §(4)/(5): Unterlagen nur für den eigenen Gebrauch, nicht an Dritte senden, nicht in Datenbanken einstellen | **nein** |
| subreport-elvis.de | 7,1 % | robots.txt: `Disallow: /` | **nein** |
| vergabemarktplatz.brandenburg.de | 4,5 % | robots.txt: `Disallow: /`; Nutzungsbedingungen: Rechte nur für die eigene Teilnahme an Vergabeverfahren | **nein** |
| evergabe.de | 7,5 % | robots.txt erlaubt; Seite schützt sich mit reCAPTCHA gegen Bots; AGB als PDF (20260416_agb.pdf) noch nicht gelesen | offen, eher nein |
| meinauftrag.rib.de | 6,1 % | robots.txt erlaubt; Nutzungsbedingungen (PDF) noch nicht gelesen | offen |
| evergabe-online.de (Bund) | 7,0 % | Abruf mit Skript abgelehnt (HTTP 400, auch robots.txt; erneut geprüft 30.10.2026). Wir umgehen das nicht | **nein**, Kunde lädt selbst herunter und lädt am Treffer hoch |

**Folge:** Die vollen Unterlagen liest Jarvis nicht selbst. Der ausführliche Steckbrief kommt über den Kunden: Er lädt die Unterlagen herunter und gibt sie Jarvis (Pro-Paket). Vorher muss ein Anwalt klären, ob das gegen die Klauseln „keine Weitergabe an Dritte“ verstößt (Jarvis als beauftragter Dienstleister des Bieters).

## Förderprogramme

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| Förderdatenbank des Bundes (foerderdatenbank.de) | 29.10.2026 | Impressum: Texte unter CC BY-ND 4.0 DE (Namensnennung, keine Bearbeitung). robots.txt erlaubt, `Crawl-delay: 30`. RSS-Feed „Förderprogramme“: https://www.foerderdatenbank.de/FDB/DE/Service/RSS/Functions/foerderprogram_rssnewsfeed.xml | seit 29.10.2026 im Morgenbericht (`alarm/foerder.py`), über RSS mit Quellenangabe. Texte nicht umschreiben und weitergeben: nur Titel, Link und unsere eigene Einschätzung zeigen |

## Messen und Events (Vertriebs-Alarm)

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| AUMA-Messedatenbank | 29.10.2026 | robots.txt sperrt Messedatenbank und `/api/TradeFairData/` | **nein**; falls nötig, Lizenz bei AUMA anfragen (nur mit Benjamins OK) |

## Tarifverträge und Entgelt

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| **BMAS-Tarifregister** (bmas.de) | 30.10.2026 | Das Register umfasst einen sehr großen Bestand (laut BMAS-Seite über 90.000 gültige Tarifverträge zu Jahresbeginn 2026). BMAS gibt vollständige Tarifverträge nicht weiter; Tarifdatenblätter sind nur eine Auswahl. `robots.txt` verbietet alle Pfade mit Query-String (`Disallow: /*?*`) und setzt `Crawl-delay: 180`. | Als Register- und Kontaktstelle verlinken; keine Massenabfrage, keine PDF-Abrufe mit Query-String. Keine Vollständigkeit behaupten. |
| **Tarifregister NRW – Tarifdaten aus Branchen** (tarifregister.nrw.de) | 30.10.2026 | `robots.txt` geprüft: öffentliche Tarifinformationsseiten sind erlaubt; `/search/` ist gesperrt. Das Register erhält sämtliche ihm zugesandten, in NRW gültigen Verträge (durchschnittlich 1.800/Jahr). Öffentlich sind standardisierte Datenblätter aus über 100 **ausgewählten** Wirtschaftszweigen. Die Seite nennt Aktualisierung Oktober 2026, übernimmt aber keine Haftung für Richtigkeit oder Aktualität. Aufgeführt sind u. a. AÜ, Bau, Dachdecker, Elektro, Einzelhandel, Gebäudereinigung, Maler/Lackierer, Metall/Elektro, Pflege-nahe Berufe, Logistik und Sicherheit. | Gute Quelle für Recherche und Startabdeckung; öffentlich gelistete Tarifbereiche als Hinweise, keine automatische Übernahme vollständiger Vertragsinhalte oder ungeprüfter Entgeltgruppen. Jede Gruppe/Lohnregel muss gegen den maßgeblichen Originalvertrag und Geltungsbereich geprüft werden. |
| **Tarifregister NRW – Grundvergütung** | 30.10.2026 | Öffentliche Recherche zu ausgewählten Tarifbereichen mit Beruf, Branche, Qualifikation, Tätigkeit, Arbeitszeit, Grundvergütung und Gültigkeitszeitraum. Ebenfalls Stand Oktober 2026 und mit ausdrücklichem Aktualitäts-/Richtigkeitsvorbehalt. Die Suchroute `/search/` ist laut `robots.txt` gesperrt. | Als manuelle Recherchequelle verlinken; gesperrte Suche nicht automatisiert abrufen. Ohne geklärte Nutzungsrechte und verlässliche Aktualisierung keine automatisierte Katalogbefüllung. |
| **WSI-Tarifarchiv** (wsi.de) | 30.10.2026 | `robots.txt` geprüft; die öffentlichen Tarifseiten sind nicht gesperrt. Die WSI-Seite beschreibt Tarifvergütungen in über 200 Berufen und rund 50 Branchen sowie Tarifvergütungstabellen ausgewählter Branchen mit regionalen Tarifbereichen und Tarifregelungen in 50 Branchen. Das WSI weist selbst darauf hin, dass Entgeltstände teils mehrere Jahre zurückliegen können; es verschickt keine Tarifverträge und erteilt keine Einzelauskünfte. Es ist ein gepflegtes Rechercheangebot, aber keine vollständige Sammlung aller Verträge. Eine offene Lizenz für die Übernahme in Jarvis wurde auf den geprüften Seiten nicht gefunden. | Manuelle Recherche/Abgleich mit Originalen und Quellenlink; keine automatische Übernahme ohne geklärte Nutzungsrechte und Aktualisierungsweg. |
| **DGB/GVP-Originalverträge** (dgb.de) | 30.10.2026 | Im Repo liegen Originalquellen für Entgelt- und Rahmentarifvertrag Zeitarbeit. Die Gruppen 1–9 und Löhne gelten nur für den jeweiligen GVP/DGB-Tarifbereich, nicht für andere Branchen. | Bestehende Zeitarbeits-Kalkulation bleibt auf diesen Vertrag begrenzt. |

### Konsequenz für den Tarifkatalog

Es gibt keine geprüfte, frei abrufbare Komplettdatenbank mit allen deutschen Verträgen, Gruppen, Regionen und Laufzeiten. Das BMAS-Register ist nicht als Massendatensatz verfügbar. Das WSI ist die breiteste geprüfte Recherchequelle für Deutschland, enthält aber ausgewählte Branchen/Berufe und keine vollständige Sammlung; das NRW-Register ergänzt über 100 ausgewählte Branchen nur für NRW. Jarvis zeigt deshalb nur Verträge und Gruppen, deren Quelle und Gültigkeit hinterlegt sind. Weitere Verträge können firmenbezogen aus dem konkreten Originalvertrag erfasst werden. Werte werden nicht aus dem Beruf abgeleitet oder zwischen Branchen kopiert. Eine automatisierte breite Übernahme bleibt offen, bis Nutzungsrechte, Aktualisierung und zulässige Abrufwege geklärt sind.

**Startbestand am 30.10.2026:** Migration `20261031070000_tarifkatalog_branchen.sql` speichert ausgewählte NRW-Tarifbereiche (Elektro, Reinigung, Bau, Groß-/Außenhandel, GaLaBau), TVöD-VKA (Allgemein/SuE/Pflege), TV-L, DGB/GVP und den Maler-Gesellenmindestlohn. Je Eintrag bleiben Region, Quelle, Laufzeit, Berufsbezug und Prüfstand sichtbar. Die NRW-Datenblätter sind Arbeitshilfen; wo nur Zahl und Laufzeit der Gruppen verfügbar sind, behauptet der Katalog keine geprüften Tätigkeitsmerkmale oder Lohnsätze. Für GVP sind die drei Entgelttabellen aus dem DGB-Original gespeichert; der Malerwert ist als Branchenmindestlohn (nicht als Tarifvertrag) getrennt gekennzeichnet. DEHOGA NRW wird vorerst nur als Metadatum geführt, da zur aktuellen Vereinbarung keine vollständige Gruppentabelle belegt war. Die Übernahme ausgewählter Bezeichnungen/Metadaten ersetzt keine rechtliche Geltungsprüfung; Tariftreue und Nutzungsrechte sind je konkretem Vertrag zu prüfen.

## Zentraler Vergabekatalog (30.10.2026)

Bekanntmachungsservice erneut geprüft: robots.txt liefert 404. Der erlaubte Tagesexport wurde exemplarisch abgerufen (29.10.2026: 1.018 JSON-Dateien); die Pakete enthalten die Lizenz https://opendefinition.org/licenses/cc-zero/. Der Worker prüft robots.txt und die CC0-Paketlizenz auch zur Laufzeit, nutzt bedingte HTTP-Abfragen und begrenzte historische Abrufe. Gesperrte Portale werden weiter nur verlinkt; dortige Unterlagen werden nicht heruntergeladen. Weitere Quellen werden ohne Adapterprüfung und Freigabe nicht automatisch aktiviert.
