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
