# Italien: Datenquelle für nationale Ausschreibungen (Recherche 02.11.2026)

> **Live geprüft 02./03.11.2026 (Workflows `italien-test.yml` Run 41542963808, `italien-felder.yml`):**
> - **robots.txt:** `pubblicitalegale.anticorruzione.it` liefert keine robots.txt (die Web-App antwortet mit ihrer
>   Startseite) → keine Regeln; `www.anticorruzione.it/robots.txt`: `User-Agent: * / Allow: /`. `dati.anticorruzione.it`
>   sperrt GitHub-Rechenzentren (HTTP 403, F5) – wird nicht gebraucht.
> - **Lizenz:** www.anticorruzione.it/copyright (live gelesen): „I dati pubblicati sul presente sito sono messi a
>   disposizione con licenza **CC-BY 4.0** … liberamente distribuibili e riutilizzabili, a patto che sia sempre citata
>   la fonte e – ove possibile – riportato l'indirizzo web della pagina originale.“ Zusätzlich CAD Art. 52 Abs. 2.
>   Quellenangabe: „Fonte: ANAC – Piattaforma Pubblicità a valore legale (CC BY 4.0)“ plus Link zur Bekanntmachung.
> - **Schnittstelle:** `/api/v0/date` und `/api/v0/avvisi` antworten ohne Anmeldung (HTTP 200, < 1 s). Am 02.11.2026
>   100 Bandi (codiceScheda 2,4; 81 Erstveröffentlichungen, 19 Berichtigungen), insgesamt 3.826 Einträge aller Arten.
>   `codiceScheda=5` (Indagini) liefert HTTP 500 → später andere Kennung prüfen.
> - **Ergebnis: grünes Licht** für den Einbau (`alarm/anac.py`).
> - **Eingebaut 03.11.2026:** `alarm/anac.py` (alle Bandi des Tages, nur aktive Erstveröffentlichungen mit künftiger
>   Frist, Regionen über Provinz → NUTS-2, `alarm/province_it.json`), Italien kommt komplett aus der PVL, TED nur als Ersatz
>   bei Ausfall. Länder-Durchlauf (Mailänder Reinigungsfirma, 4 Regionen, 10 Tage)
>   https://github.com/Twista-hub/jarvis/actions/runs/41544733109: **ALLES OK**, 0,074 $. Zwei kommunale
>   Reinigungsaufträge 9/10 (Bacoli, Kampanien), Rovigo 8/10, Kanal-/Klärschlamm-Reinigung richtig 1–2/10; Steckbrief und
>   Mail („Nuove gare: 7 – Pulizie Rossi S.r.l.“) auf Italienisch.
>   **CPV:** ANAC liefert den CPV nur als amtliche italienische Bezeichnung („Servizi di pulizia“, Probe `italien-cpv.yml`).
>   Zuordnung zum Code über `alarm/cpv_it.json` (Bezeichnungen unserer Gewerke) und Wortregeln in `anac.cpv_code`.
>   Live-Zahlen /it/gare-d-appalto (30 Tage): Reinigung 34, Grünpflege 20, Sicherheit 11, Personal 8, Elektro 5, Sanitär 5.

> **Recherche-Stand 02.11.2026 (vor den Lese-Tests):** Aus dieser Cloud-Sitzung waren alle italienischen Hosts gesperrt
> (`pubblicitalegale.anticorruzione.it`, `dati.anticorruzione.it`, `www.anticorruzione.it`, `www.gazzettaufficiale.it`,
> auch `apify.com`, `data.open-contracting.org`, `web.archive.org`). Alles unten stammt aus Suchergebnissen und aus
> öffentlichem Quellcode auf GitHub (vier unabhängige Projekte, die die Schnittstelle 2026 nutzen).
> - **Empfehlung:** Plattform „Pubblicità a valore legale“ (PVL) der ANAC, öffentliche JSON-Schnittstelle
>   `https://pubblicitalegale.anticorruzione.it/api/v0/avvisi`, ohne Anmeldung, **täglich** neue Bekanntmachungen,
>   **alle Schwellen** (seit 01.01.2024 die gesetzliche Veröffentlichung in Italien, ersetzt die Gazzetta Ufficiale).
> - **Lizenz:** Auf der PVL selbst keine ausdrückliche Lizenz gefunden. Nach italienischem Recht (CAD Art. 52 Abs. 2)
>   gelten ohne Lizenz veröffentlichte Daten der Verwaltung als offene Daten, auch für geschäftliche Nutzung.
>   Das ANAC-Open-Data-Portal nutzt CC BY 4.0 (OCDS), einzelne Datensätze CC BY-SA 4.0. **Live prüfen.**
> - **robots.txt: unbekannt**, prüft `.github/workflows/italien-test.yml`. Erst danach einbauen.
> - Die monatlichen Open-Data-Dateien (BDNCP, OCDS) sind für einen Tagesalarm zu langsam.

**Kurz:** Seit 01.01.2024 muss jede italienische Vergabestelle Bekanntmachungen über die Banca Dati Nazionale dei
Contratti Pubblici (BDNCP) der ANAC veröffentlichen. Die Plattform PVL zeigt sie öffentlich an, auch unter den
EU-Schwellen, und leitet die Aufträge über den Schwellen an TED weiter. Die Weboberfläche (Angular) lädt alles über
eine offene JSON-Schnittstelle (`/api/v0/…`, Spring-Seiten). Eine offizielle API-Dokumentation hat die ANAC nicht
veröffentlicht; die Schnittstelle ist die der eigenen Oberfläche. Das ist der wichtigste Vorbehalt.

## 1. Quellen im Vergleich

| Quelle | Inhalt | Aktualität | Maschinenlesbar | Für uns | Quelle der Angabe |
|---|---|---|---|---|---|
| **PVL – Piattaforma per la pubblicità legale** (ANAC/BDNCP), https://pubblicitalegale.anticorruzione.it | Bandi, Esiti, Altri avvisi; alle Schwellen; seit 02.01.2024 | täglich (Veröffentlichung am Werktag nach Eingang, Samstag zählt nicht) | JSON, `GET /api/v0/avvisi` u. a., ohne Anmeldung | **Ja, Hauptquelle** (nach Prüfung) | ANAC-Mitteilung „Pubblicità legale degli appalti“ https://www.anticorruzione.it/-/pubblicit%C3%A0-legale-degli-appalti; Code: https://github.com/mayai-it/bandiradar/blob/main/src/bandiradar/sources/anac_pvl.py, https://github.com/aborruso/anac-pl-pp-cli/blob/main/spec.yaml |
| ANAC Open Data, BDNCP-Datensätze (CIG, Aggiudicazioni, Partecipanti …), https://dati.anticorruzione.it/opendata | Alle CIG/Verfahren, nach Jahr und Monat | **monatlich** (seit 2023 Monats-„Delta“-Dateien); eine Portalseite sagt „wöchentlich“ | CSV/JSON-Download, CKAN-Katalog | Nein für den Alarm (zu spät); evtl. später für Zuschläge/Marktdaten | Suchergebnisse zu https://dati.anticorruzione.it/opendata, https://dati.anticorruzione.it/opendata/dataset/aggiudicazioni |
| ANAC OCDS, https://dati.anticorruzione.it/opendata/ocds_it | Vergabeverfahren im OCDS-Format (JSONL.gz), Aufträge ab 40.000 € | monatlich, „am 2. jedes Monats“ | JSON/CSV/Excel | Nein für den Alarm | https://dati.anticorruzione.it/opendata/ocds_it, https://dati.anticorruzione.it/opendata/dataset/ocds-appalti-ordinari-2025, https://data.open-contracting.org/en/publication/117 |
| Detailseite pro CIG (Superset), `https://dati.anticorruzione.it/superset/dettaglio_cig/<CIG>` | Ein Verfahren | aktuell | HTML/Dashboard | Nein (nur Einzelabfrage) | https://ondata.substack.com/p/associazione-ondata-newsletter-21 |
| MIT „Servizio Contratti Pubblici“ (SCP), https://dati.mit.gov.it/catalog/dataset/scp | Bandi/Avvisi/Esiti bis 2023 | war täglich | CSV | **Nein**: seit 01.01.2024 keine Pflicht mehr, dort zu veröffentlichen (Delibera ANAC 582/2023) | https://github.com/ondata/italian-public-sector-pnrr-data-guide/blob/main/fonti/scp/index.qmd |
| Gazzetta Ufficiale, 5ª Serie Speciale Contratti pubblici | Bis 2023 gesetzliche Bekanntmachung | täglich | HTML/PDF | **Nein**: seit 01.01.2024 durch PVL ersetzt | https://enna.ance.it/2024/01/09/dal-1-gennaio-2024-pubblicita-delle-gare-sulla-piattaforma-anac-al-posto-della-gazzetta-ufficiale/ |
| Regionale/zertifizierte E-Vergabe-Plattformen (z. B. Sintel Lombardia, START Toscana, SATER Emilia-Romagna, MePA) | Verfahrensunterlagen, Abgabe | laufend | uneinheitlich | Nein: Seit 2024 müssen sie mit der BDNCP verbunden sein; die Bekanntmachung landet ohnehin in der PVL. Nur als Link zu den Unterlagen | Art. 25 D.Lgs. 36/2023 (Fachwissen, nicht nachgelesen) |
| TED | Nur über den EU-Schwellen | täglich | API | Bleibt Rückfall; Italien-Teil ist eine Teilmenge der PVL | `alarm/ted.py` |

Rechtsgrundlage der PVL: Art. 27, 84, 85 D.Lgs. 36/2023 und Delibera ANAC 263 vom 20.06.2023. Zitat ANAC:
> „Il servizio è disponibile al link: https://pubblicitalegale.anticorruzione.it con operatività dal giorno 2 gennaio
> 2024. Il servizio è pubblico e non richiede l'uso di credenziali di accesso.“

und zum Takt:
> „La BDNCP prende in carico le richieste di pubblicazione pervenute nei giorni non festivi dal lunedì al venerdì e
> pubblica gli atti il primo giorno feriale successivo alla data di presa in carico.“ … „Non rientra tra i giorni
> feriali utili alla pubblicazione la giornata di sabato.“

(beide laut Suchauszug aus ANAC-Seiten, u. a. https://www.anticorruzione.it/-/pubblicit%C3%A0-legale-degli-appalti;
Wortlaut live prüfen). Handbuch der Oberfläche: https://pubblicitalegale.anticorruzione.it/assets/manuale_utente_pvl.pdf
(enthält laut Auszug nur die Bedienung, keine API).

## 2. Lizenz und Weiterverwendung

- **PVL:** Weder Suche noch der Code der vier Projekte nennen eine Lizenz oder Nutzungsbedingungen der PVL. Ein
  Projekt schreibt „public, no license restriction“ (bandiradar, Docstring). Die PVL-Seite verlinkt im Menü
  „Dati aperti BDNCP“. Ein „Note legali“-Text der PVL wurde nicht gefunden. **Live prüfen** (Workflow liest Startseite,
  Handbuch und die Note legali von anticorruzione.it).
- **Gesetz, offene Daten als Standard:** Codice dell'amministrazione digitale (CAD, D.Lgs. 82/2005), Art. 52 Abs. 2:
  > „I dati e i documenti che le amministrazioni titolari pubblicano, con qualsiasi modalità, senza l'espressa adozione
  > di una licenza […], si intendono rilasciati come dati di tipo aperto ai sensi all'articolo 68, comma 3, del presente
  > Codice.“

  (Suchauszug, u. a. https://brocardi.it/codice-dell-amministrazione-digitale/capo-v/sezione-i/art52.html,
  https://miolegale.it/codici/codice-amministrazione-digitale/art-52/). „Dati di tipo aperto“ heißt nach der
  Begriffsbestimmung des CAD (Art. 1 Abs. 1 lit. l-ter): Nutzung „da parte di chiunque, anche per finalità
  commerciali“, kostenlos, maschinenlesbar (Fachwissen, Wortlaut auf https://www.normattiva.it prüfen).
  Weiterverwendung allgemein: D.Lgs. 36/2006 (PSI-Richtlinie, geändert durch D.Lgs. 200/2021).
- **ANAC Open-Data-Portal:** OCDS-Seite: Lizenz **CC BY 4.0** („schema di licenza CC-BY 4.0“, von AgID empfohlen);
  Datensatz „partecipanti“ dagegen **CC BY-SA 4.0**; das ältere Betriebshandbuch
  (https://dati.anticorruzione.it/opendata/download/ManualeGestioneOperativa-OD.pdf) sagt „I dati sono resi disponibili
  con licenza CC BY-SA 4.0“. Für den Alarm nutzen wir diese Dateien nicht; bei späterer Nutzung pro Datensatz prüfen
  (BY-SA würde verlangen, abgeleitete Datensätze unter gleicher Lizenz weiterzugeben).
- **Ergebnis (vorläufig):** Geschäftliche Weiterverwendung der PVL-Bekanntmachungen ist nach CAD Art. 52 zulässig,
  solange die PVL keine eigene, engere Lizenz nennt. Wir nennen trotzdem immer die Quelle, wie bei CC BY:
  **„Fonte: ANAC – Banca Dati Nazionale dei Contratti Pubblici, Piattaforma Pubblicità a valore legale
  (consultato il GG/MM/AAAA, dati rielaborati)“**. Keine ANAC-Logos.
- **Datenschutz:** Bekanntmachungen nennen den RUP (Responsabile unico del progetto) mit Namen und oft Kontakt.
  Keine Personen speichern oder verschicken, nur Vergabestelle, CIG und Link.

## 3. robots.txt

| Host | Ergebnis |
|---|---|
| pubblicitalegale.anticorruzione.it/robots.txt | **nicht geprüft** (Host gesperrt; auch die Suche fand die Datei nicht) |
| dati.anticorruzione.it/robots.txt | **nicht geprüft** |
| www.anticorruzione.it/robots.txt | **nicht geprüft** |

Wir würden nur `/api/v0/avvisi`, `/api/v0/date` und `/api/v0/map` abrufen (keine HTML-Seiten). Wenn robots.txt
`/api/` oder alles sperrt, wird die PVL **nicht** automatisch genutzt, nur dokumentiert, und Italien bleibt bei TED
(wie Spanien/PLACSP). Hinweis: Eine Kolumne von Punto Informatico deutet an, dass die robots.txt einer staatlichen
Transparenz-Seite Einschränkungen enthält; um welche Seite es geht, ist im Auszug nicht erkennbar
(https://www.punto-informatico.it/lampi-di-cassandra-trasparenza-allitaliana/). Also wirklich prüfen.

## 4. Schnittstelle und Felder

Basis `https://pubblicitalegale.anticorruzione.it/api/v0`, ohne Anmeldung, `Accept: application/json`.
Belegt durch eine Netzwerkaufzeichnung der Weboberfläche vom 19./20.08.2026
(https://github.com/walidgdg1-ai/tender-engine/blob/main/control/anac_pvl_network_probe.json,
https://github.com/walidgdg1-ai/tender-engine/blob/main/control/it_anac_pvl_network_probe.json) und vier Clients
(bandiradar, ObraSignal https://github.com/MarcosTaz/Obrasignal/blob/main/italy_anac_pvl.py, tenlens
https://github.com/youssbim/architettura-dati-tenlens/blob/main/pipeline/lib/anac.ts, anac-pl-cli).

| Pfad | Zweck | Parameter |
|---|---|---|
| `GET /avvisi` | Liste, Spring-Seite `{content, totalElements, totalPages, number, size, …}`; die Einträge enthalten bereits den vollen Inhalt (`template`) | `dataPubblicazioneStart`, `dataPubblicazioneEnd` (**TT/MM/JJJJ**), `codiceScheda` (Template-Nummern, kommagetrennt; die Seite „Bandi“ nutzt `2,4`), `page` (ab 0), `size` (Clients nutzen 100), `sortField=dataPubblicazione`, `sortDirection=ASC/DESC`, `ricercaArchivio=true` (Archiv, Zeitraum < 6 Monate) |
| `GET /avvisi/{idAvviso}` | Einzelne Bekanntmachung | |
| `GET /avvisi/{idAvviso}/cronologia` | Versionen/Berichtigungen | `idAppalto`, `ricercaArchivio` |
| `GET /avvisi-full-text` | Volltextsuche | `keywords`/`fullText`, `cpv`, `importoLotto`, `paginationToken` |
| `GET /date` | Die letzten 3 Veröffentlichungstage, z. B. `["20/08/2026","19/08/2026","18/08/2026"]` | |
| `GET /map` | Zuordnung Template → `codiceScheda` | |

Ratenlimit: nicht dokumentiert. Ein Client meldet Gateway-Zeitüberschreitungen (504 nach ca. 180 s) bei tiefen
Seiten über das ganze Archiv (ca. 2,3 Mio. Einträge) → immer mit Datumsfenster abfragen, 3 s Pause, Zeitlimit 120 s.

**Arten (`codiceScheda`)**, aus dem Code der Oberfläche (tenlens, `codici-scheda.ts`):
Template 1 Vorinformation (`PL1_*`, `PL2_*`), **2 Bando nach Vorinformation (`P1_10…14`, `P2_10…14`)**, 3
Qualifizierungssystem, **4 Bando di gara** (Standard, Codes in der Liste nicht enthalten, vermutlich `P1_16…`/`P2_16…`),
5 Indagine di mercato (`P7_1_*`, Interessenbekundung vor Verhandlungsverfahren), 6 Liste der Bieter, 7 Esiti
(`A1_*`, `A2_*`, `NAG` …), 8 Direktvergabe (`AD3`, `A3_6`), 9 Ex-ante-Transparenz, 10 Vertragsänderung.
Die Ziffer hinter dem Unterstrich ist der eForms-Untertyp (16 = Auftragsbekanntmachung). Vermutlich steht `P1`/`A1`
für über und `P2`/`A2` für unter der EU-Schwelle (**live prüfen**). `tipo` ist `avviso` (Erstveröffentlichung) oder
`rettifica` (Berichtigung).

**Felder.** Belegt durch eine echte Beispieldatei mit 11 Bekanntmachungen vom 08.06.2026 (bandiradar,
https://github.com/mayai-it/bandiradar/blob/main/src/bandiradar/data/fixtures/anac_pvl.json; Arten `P7_1_2`,
`P7_1_3`, `P2_20`, `M2`). Dort: `cpv` nur als Bezeichnung („Servizi di assistenza al parco macchine“),
`luogo_nuts` als Provinzname („Genova“, „Reggio di Calabria“, auch „ITALIA“, „GERMANIA“), `luogo_istat` als Gemeinde
in Großbuchstaben, `valore_complessivo_stimato` als Text („5148.0“), `codiceEform` überall leer, Frist oft nur als
`termine_invito`. Vergabestelle: `denominazione_amministrazione` und `codice_fiscale`.

| Wir brauchen | Feld | Bemerkung |
|---|---|---|
| Kennung | `idAvviso` (UUID), `idAppalto` (UUID des Verfahrens) | |
| Art / Version | `codiceScheda`, `codiceEform`, `tipo`, `attivo`, `oscurato` | nur `tipo=avviso`, `attivo=true`, `oscurato=false` |
| Datum | `dataPubblicazione`, `dataCreazione`, `dataPubblicazioneRettifica` | |
| Abgabefrist | `dataScadenza`, sonst pro Los `termine_ricezione` / `termine_invito` | |
| Titel | `template[0].template.metadata.descrizione` (bzw. `titolo`) | |
| Link zu TED | `template[0].template.metadata.link_eform_ted` | **Damit TED-Doppelte erkennen** |
| Auftraggeber | Abschnitt mit `fields.soggetti_sa[0].denominazione_amministrazione` | Steuernummer der Stelle vermutlich daneben |
| Lose | `template[0].template.sections[]` mit Namen „SEZ. C - Oggetto“, darin `items[]` | |
| CIG | Los: `cig` | Pflichtkennung jedes Loses in Italien |
| Art des Auftrags | Los: `natura_principale` (`Lavori`, `Servizi`, `Forniture`) | |
| CPV | Los: `cpv` | **Nur die italienische Bezeichnung, kein Code** (Beispieldatei). Bezeichnung → Code über die amtliche CPV-Liste (IT) |
| Ort | Los: `luogo_nuts`, `luogo_istat` | Provinzname bzw. Gemeindename, nicht der Code (Beispieldatei) |
| Wert | Los: `valore_complessivo_stimato` | Text, z. B. „58000.0“; laut bandiradar oft leer |
| Unterlagen | Los oder „SEZ. B - Dati Generali“: `documenti_di_gara_link` | Link zur Vergabeplattform (z. B. tuttogare, ARIA, trasparenza-pa.net) |
| Link für Menschen | `https://pubblicitalegale.anticorruzione.it/bandi/<idAvviso>` (bandiradar) bzw. `/dettaglio-avviso/<idAvviso>` | richtige Form live prüfen |

## 5. Menge

- **Alle Arten zusammen:** rund 4.000 Bekanntmachungen pro Tag, davon nur ein kleiner Teil offene Ausschreibungen
  (der Rest Esiti, Direktvergaben, Berichtigungen). Quelle: bandiradar (Docstring, gemessen 2026).
- **Bandi:** 29.865 von Sep. 2025 bis Aug. 2026, davon ca. 60 % eForms über der Schwelle (also auch auf TED);
  dazu 17.978 Indagini di mercato, 306 Qualifizierungssysteme, 160 Vorinformationen mit Aufruf. Quelle: Anthrion-
  Marktanalyse vom 23.09.2026, gezählt über die PVL-API
  (https://github.com/Anthrion/anthrion-signal/blob/main/docs/market-coverage-2026-09-23.md). TED Italien im selben
  Jahr: 15.815.
- Das sind rund **120 Bandi pro Werktag** (ca. 50 nur national, ca. 70 auch auf TED) plus rund **70 Indagini di
  mercato**. Bei `codiceScheda=2,4` und 100 pro Seite: 2 Abrufe pro Tag. Zum Vergleich: Frankreich 120–150, Polen
  ca. 520, Katalonien ca. 120 pro Tag.
- Hinweis aus `docs/europa-markt.md`: Italien hat auf TED viele Bekanntmachungen, aber wenige in unseren CPV-Gewerken
  (197 von 3.009 in zwei Monaten). Italienische Stellen nutzen oft grobe CPV (z. B. 45000000). Darum bei Italien
  Titel und Losbeschreibung stärker gewichten als den CPV-Code.

## 6. Empfehlung für den Einbau (nur wenn Lizenz und robots.txt grün)

1. **Neues Modul `alarm/anac.py`** nach dem Muster von `alarm/bzp.py`:
   - Täglich die Bekanntmachungen des letzten Veröffentlichungstags holen (über `/api/v0/date`, weil Samstag/Sonntag
     und Feiertage leer sind):
     `GET /api/v0/avvisi?dataPubblicazioneStart=<TT/MM/JJJJ>&dataPubblicazioneEnd=<TT/MM/JJJJ>&codiceScheda=2,4&sortField=dataPubblicazione&sortDirection=ASC&page=<n>&size=100`
   - Blättern bis `last=true`; 3 s Pause, eigener User-Agent mit Kontaktadresse, Zeitlimit 120 s, bei 403/429 abbrechen
     und Fehler melden (wie BZP).
   - Nur `tipo == "avviso"`, `attivo`, nicht `oscurato`, Frist in der Zukunft. Ein Release pro Bekanntmachung mit allen
     Losen (CIG als Los-Kennung, wie bei TED die Lose).
   - Später optional Template 5 (Indagini di mercato) als eigene Art „Interessenbekundung“: Für Reinigung und
     Sicherheit unter der Schwelle (Verhandlungsverfahren mit Einladung) ist das oft der einzige öffentliche Einstieg.
2. **Regionen:** neue Datei `alarm/regioni.json` wie `comunidades.json`/`woiwodschaften.json`: 21 NUTS-2-Gebiete
   ITC1 Piemonte, ITC2 Valle d'Aosta, ITC3 Liguria, ITC4 Lombardia, ITH1 Bolzano, ITH2 Trento, ITH3 Veneto,
   ITH4 Friuli-Venezia Giulia, ITH5 Emilia-Romagna, ITI1 Toscana, ITI2 Umbria, ITI3 Marche, ITI4 Lazio, ITF1 Abruzzo,
   ITF2 Molise, ITF3 Campania, ITF4 Puglia, ITF5 Basilicata, ITF6 Calabria, ITG1 Sicilia, ITG2 Sardegna; je Region die
   Provinznamen (inkl. Schreibvarianten wie „Bolzano/Bozen“, „Reggio di Calabria“, „Forlì-Cesena“) und die Kürzel
   (TO, MI, RM …). Zuordnung: `luogo_nuts` (Provinz oder NUTS-Code) → Region; sonst `luogo_istat` (Gemeinde, über die
   ISTAT-Gemeindeliste) → Region; sonst „Comune di X“ im Namen der Vergabestelle; sonst „ganz Italien“.
3. **Doppelte mit TED:** Die PVL enthält auch alle italienischen TED-Aufträge (ANAC leitet sie an TED weiter) und ist
   meist früher. Darum wie bei Katalonien: Italien komplett aus der PVL, **TED-Einträge mit Land ITA ausfiltern**,
   solange die PVL läuft; fällt die PVL aus, Rückfall auf TED. Zusätzlich Abgleich über `link_eform_ted`
   (TED-Nummer) und die CIG, falls beide Quellen gleichzeitig laufen. Erst prüfen (Workflow): Wie viele Bandi haben
   `link_eform_ted`, und finden sich TED-ITA-Bekanntmachungen eines Tages in der PVL wieder?
4. **CPV:** Wenn die PVL nur Bezeichnungen liefert: Zuordnung Bezeichnung → Code über die amtliche italienische
   CPV-Liste (einmal als Datei ablegen). Unbekannte Bezeichnungen als Text an die KI geben.
5. **Sprache:** KI liest Italienisch; Oberfläche und Mails auf Italienisch (`sprache-it.txt`, `mail.T["it"]`,
   Zeitzone Europe/Rome), siehe `docs/nachtplan.md` Punkte 2–4.
6. **Quellenangabe** in jeder Mail und auf der Seite (siehe Abschnitt 2). Keine RUP-Namen übernehmen.

## 7. Offene Fragen

1. **Netzwerk:** `pubblicitalegale.anticorruzione.it`, `dati.anticorruzione.it`, `www.anticorruzione.it` in den
   Netzwerkeinstellungen der Cloud-Umgebung erlauben oder den Workflow `italien-test.yml` (Actions → „Italien-Test“ →
   „Run workflow“) laufen lassen. Ergebnis hier oben in den Kasten schreiben.
2. **robots.txt** der drei Hosts: Ist `/api/` erlaubt?
3. **Lizenz der PVL:** Gibt es auf der PVL oder auf anticorruzione.it „Note legali“ mit einer eigenen Lizenz oder
   einem Verbot automatischer Abfragen? Wenn ja, gilt das und nicht CAD Art. 52.
4. Ist die Schnittstelle ohne `Origin`/`Referer` (wie aus der Oberfläche) erreichbar? Einige Clients setzen diese
   Kopfzeilen; wir täuschen nichts vor und setzen nur User-Agent und Accept.
5. Template 4: Welche `codiceScheda` gehören dazu, und steht `P2` wirklich für unter der Schwelle?
6. CPV kommt laut Beispieldatei nur als Bezeichnung, `luogo_nuts` als Provinzname: an der Tagesprobe bestätigen.
7. Gibt es ein Ratenlimit? Laufen Abrufe aus GitHub Actions (geteilte IPs) ohne Sperre?
8. Indagini di mercato (Template 5) mit aufnehmen? Erst nach dem ersten Länder-Durchlauf entscheiden.
