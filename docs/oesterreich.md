# Österreich und Schweiz: nationale Ausschreibungen (03.11.2026)

## Österreich – eingebaut

**Quelle:** Kerndaten nach BVergG 2018 (§§ 59 ff.). Jede Vergabestelle oder ihre Plattform veröffentlicht eine
Kerndatenquelle (KDQ: Liste von Links mit `lastmod`) und meldet sie auf data.gv.at. Damit sind Aufträge **unter und
über** den EU-Schwellen enthalten; TED hat nur die über den Schwellen.

- **Lizenz:** data.gv.at-Nutzungsbedingungen (live gelesen 03.11.2026): Open Data unter **CC BY 4.0**, kommerzielle
  Nutzung und Bearbeitung erlaubt, Namensnennung Pflicht. Quellenzeile im Steckbrief: „Kerndaten nach BVergG 2018 über
  data.gv.at (CC BY 4.0)“ plus Link zur jeweiligen KDQ.
- **Liste der Quellen:** `https://www.data.gv.at/api/hub/search/search?q=kerndaten&limit=100` (piveau; Links stehen als
  Liste in `distributions[].access_url`). Am 03.11.2026: 49 Einträge, davon 42 brauchbare KDQ-Links (PDFs, OneDrive,
  Kontaktseiten werden aussortiert).
- **robots.txt:** wird pro Host vor jedem Abruf geprüft (`oesterreich.erlaubt`), inkl. `Crawl-delay` (Standard 0,5 s).
- **ANKÖ** (`ogd.ankoe.at`) setzt `Content-Signal: ai-input=no` → wird **nicht** gelesen, weil Jarvis Bekanntmachungen mit
  KI bewertet. kerndaten.at (Wiener Zeitung), eVergabe, BBG und provia haben keine robots.txt (= keine Regeln).
- **Ablauf** (`alarm/oesterreich.py`): je Tag nur KDQ-Einträge mit `lastmod` am Tag oder Vortag, höchstens 150 je Quelle
  und 600 gesamt; nur Bekanntmachungen (eForms `ContractNotice` oder altes `KD_8_1_*`), Zuschläge werden übersprungen;
  nur künftige oder unbekannte Frist; gleiche Bekanntmachung auf zwei Plattformen (Titel + Auftraggeber) nur einmal.
- **TED-Doppel:** Österreichische TED-Bekanntmachungen mit gleichem Titel fallen weg, die nationale Fassung bleibt.
- **Ort:** Ort der Ausführung (NUTS, PLZ, Ort). Die Adresse des Auftraggebers zählt nur, wenn die Bekanntmachung gar
  keinen Ausführungsort nennt (ASFINAG sitzt in Wien, baut aber in Tirol).
- **Suchgebiet:** neue Auswahl „Bundesländer in Österreich“ im Suchprofil (`einstellungen.bundeslaender`, NUTS-2
  AT11–AT34, `alarm/bundeslaender_at.json`). Keine Auswahl = ganz Österreich. Gilt auch für österreichische
  TED-Bekanntmachungen. Vorher fielen AT-Treffer bei Firmen mit deutschen Standorten praktisch immer heraus.
- **Live-Test** `oesterreich-schweiz-test.yml` (Workflow „Österreich-Test“, Tag wählbar): 02.11.2026 → 42 Quellen,
  13 offene Bekanntmachungen (ASFINAG, ÖBB, KABEG, BVAEB, Vorarlberger Energienetze …).

## Schweiz – wartet auf Benjamin

**Quelle wäre:** simap.ch (alle öffentlichen Ausschreibungen der Schweiz). Die Schnittstelle
`/api/publications/v2/project/project-search` antwortet ohne Anmeldung (Test 03.11.2026).

**Warum nicht eingebaut:** Die AGB von simap.ch (live gelesen 03.11.2026, Ziffer 1) sagen: „Zusatzleistungen wie
Abonnements für automatisierte Profilsuchen sowie die **API-Nutzung können in Rechnung gestellt werden** (vgl. hierfür
die separaten AGB «Online-Abonnent» und AGB «Nutzung des API»).“ Die API-AGB müssten akzeptiert werden, eventuell
kostet es Geld. Das ist eine Vertrags- und Ausgabenentscheidung → nur mit Benjamins OK.

**Nächster Schritt mit OK:** API-AGB von simap.ch lesen (Preis, Weiterverbreitung, Quellenangabe), dann bei simap.ch
nach Konditionen fragen (Mail nur nach OK) und erst danach einbauen. Bis dahin kommen Schweizer Aufträge nur über TED
(nur wenige, die Schweiz ist kein EU-Mitglied).
