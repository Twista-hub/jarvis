# Datenquellen: Prüfung der Nutzungsbedingungen

Regel: vor jedem automatischen Abruf Nutzungsbedingungen und robots.txt prüfen und hier festhalten.

## Bekanntmachungen (wer schreibt was aus?)

| Quelle | Geprüft | Ergebnis | Nutzung |
|---|---|---|---|
| **Bekanntmachungsservice** (oeffentlichevergabe.de), Tagesexport | 28.10.2026 | Lizenz CC0 in jeder Datei; robots.txt 404. Rund 500 neue Ausschreibungen pro Tag aus über 40 Portalen | **Hauptquelle, täglich** |
| **TED** (EU), API v3 | 28./29.10.2026 | Legal Notice: Bekanntmachungen frei wiederverwendbar, auch kommerziell. API ohne Schlüssel | erlaubt; nur nötig für Kunden mit Standorten außerhalb Deutschlands |
| service.bund.de | 29.10.2026 | robots.txt sperrt `/Content/DE/Ausschreibungen/Suche/` (auch das RSS der Suche) | **nein**; Bundesvergaben stehen ohnehin im Bekanntmachungsservice |
| Vergabeplattform Berlin (berlin.de/vergabeplattform, RIB) | 29.10.2026 | robots.txt: Bots erlaubt, wenn sie sich ausweisen und robots.txt einhalten; RSS auf der Startseite erlaubt | erlaubt (RSS), bringt aber kaum mehr als der Bekanntmachungsservice |

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
