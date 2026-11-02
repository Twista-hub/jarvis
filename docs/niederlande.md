# Niederlande: Datenquelle für nationale Ausschreibungen (Recherche 02.11.2026)

> **Stand 02.11.2026, NICHT live geprüft.** Aus dieser Cloud-Sitzung waren alle niederländischen Hosts gesperrt
> (`www.tenderned.nl`, `data.overheid.nl`, auch `data.europa.eu`, `data.open-contracting.org`, `en.wikipedia.org`).
> Alles unten stammt aus Suchergebnissen (mit Auszügen der Seiten) und aus öffentlichem Quellcode auf GitHub
> (mehrere unabhängige Projekte, die die Schnittstelle 2026 nutzen, u. a. eines mit „live geprüften“ Parametern).
> - **Empfehlung:** TenderNed, öffentlicher Publikations-Webservice „TNS“
>   `https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties` (JSON, **ohne Anmeldung**). TenderNed ist die
>   gesetzliche Plattform: Jede niederländische Vergabestelle veröffentlicht hier, **national und europäisch**; die
>   EU-Bekanntmachungen leitet TenderNed an TED weiter. Neue Bekanntmachungen erscheinen laufend (werktäglich).
> - **Lizenz:** Datensatz „Aankondigingen van overheidsopdrachten – TenderNed“ auf data.overheid.nl: **CC0 1.0**
>   (Herausgeber PIANOo/Rijk). Der Eintrag nennt RSS, den TNS-Webservice und die XML-API als Zugänge. **Live prüfen.**
> - **Nur die eForms-XML-API** (`/publicaties/{id}/public-xml`) braucht Benutzername und Passwort (Antrag per Mail an
>   TenderNed). Brauchen wir nicht; wir beantragen nichts.
> - **robots.txt: unbekannt**, prüft `.github/workflows/niederlande-test.yml`. Erst danach einbauen.
> - Die Halbjahres-/Quartalsdateien (CC0, Excel/CSV/OCDS) sind für einen Tagesalarm zu langsam.

**Kurz:** Die Weboberfläche von TenderNed lädt alle Bekanntmachungen über den eigenen JSON-Webservice unter `/papi/`
(„papi“ = public API). data.overheid.nl beschreibt ihn als frei zugänglich, warnt aber, dass er **ohne Vorankündigung
geändert werden kann**. Filter nach Veröffentlichungstag, Art der Bekanntmachung, CPV, Auftragsart, Verfahren und
national/europäisch. Höchstens 100 Einträge pro Seite, höchstens Seite 99. Rund 50 neue Aufträge pro Werktag:
ein Abruf pro Tag reicht.

## 1. Quellen im Vergleich

| Quelle | Inhalt | Aktualität | Maschinenlesbar | Für uns | Quelle der Angabe |
|---|---|---|---|---|---|
| **TenderNed TNS-Webservice**, `https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties` | Alle Bekanntmachungen (Auftrag, Vorinformation, Marktkonsultation, Zuschlag, Berichtigung …), national und europäisch | laufend | JSON, ohne Anmeldung | **Ja, Hauptquelle** (nach Prüfung) | data.overheid.nl-Eintrag (Suchauszug: „Zowel de RSS als TNS zijn vrij toegankelijk“), https://data.overheid.nl/dataset/aankondigingen-van-overheidsopdrachten---tenderned; Code: https://github.com/WAINUTAI/NL-GOV-MCP/blob/main/src/sources/tenderned.ts, https://github.com/mvanhorn/printing-press-library/blob/main/library/sales-and-crm/tenderned/spec.yaml |
| TenderNed RSS „laatste publicaties“, `https://www.tenderned.nl/papi/tenderned-rs-tns/rss/laatste-publicatie.rss` (ältere Angabe: `/tenderned-rss-web/rss/laatste-publicatie.rss`; ein Projekt nennt `…/v2/rss/…`) | Neueste Bekanntmachungen | laufend | RSS/Atom | Nein (nur die neuesten, ohne Filter); höchstens als Ausfall-Warnung | Suchauszug data.overheid.nl; printing-press-library (Pfad widersprüchlich, **live prüfen**) |
| TenderNed eForms-XML-API, `…/v2/publicaties/{id}/public-xml` | Vollständige eForms-Bekanntmachung (wie TED) | laufend | XML, **Basic Auth** | Nein: Zugang nur auf Antrag per Mail (functioneelbeheer@tenderned.nl); nicht nötig | Suchauszug data.overheid.nl („Als u onze API wilt gebruiken, dan heeft u een gebruikersnaam en wachtwoord nodig“); https://github.com/tenderned-analyse/code-example-tn-xml-api |
| TenderNed-Datensätze für Analysen, https://www.tenderned.nl/cms/nl/aanbesteden-in-cijfers/datasets-aanbestedingen | Alle Bekanntmachungen/Verfahren eines Zeitraums | halbjährlich (data.overheid.nl), laut OCDS-Register vierteljährlich | Excel/CSV, OCDS-JSON | Nein für den Alarm (zu spät); evtl. später Marktdaten/Zuschläge | data.overheid.nl („Twee keer per jaar publiceren we een overzicht …“); https://data.open-contracting.org/en/publication/133 |
| Swagger-Doku, https://www.tenderned.nl/info/swagger/ | Beschreibung der Schnittstelle | „bij elke release automatisch geüpdatet“ | HTML | Nur zum Nachlesen | Suchauszug data.overheid.nl |
| Weboberfläche, https://www.tenderned.nl/aankondigingen/overzicht/{publicatieId} | Eine Bekanntmachung | aktuell | HTML | Nur als Link in Mail/App | |
| TED | Nur über den EU-Schwellen | täglich | API | Rückfall; NL-Teil ist eine Teilmenge von TenderNed | `alarm/ted.py`, `docs/europa-markt.md` |

Rechtsgrundlage: Nach der Aanbestedingswet 2012 müssen Vergabestellen europäische und nationale offene Verfahren auf
TenderNed bekanntmachen (Fachwissen; laut Suchauszug der älteren Nutzungsbedingungen von 2024: Vergabestellen sind
„legally obliged to use TenderNed for publishing tender notices“). Untergrenze für nationale Pflichtbekanntmachungen
je nach Auftraggeber und Art (Gemeinden folgen meist dem Gids Proportionaliteit); viele kleinere Aufträge laufen ohne
Bekanntmachung (Einladung von 1–5 Firmen). Laut einem Projekt liegt der „nationale Rest“ etwa bei 40.000 bis 220.000 €
für Dienstleistungen (https://github.com/mvanhorn/printing-press-library, tools-manifest.json; nicht amtlich).

## 2. Lizenz und Weiterverwendung

- **data.overheid.nl, Datensatz „Aankondigingen van overheidsopdrachten – TenderNed“:** Lizenz **CC-0 (1.0)**,
  Herausgeber **PIANOo (Rijk)**, öffentlich, zuletzt geändert 08.10.2025 (alles laut Suchauszug). Text des Eintrags
  (Auszug):
  > „Alle aankondigingen op TenderNed zijn openbaar, zodat de gegevens voor iedereen beschikbaar zijn.“

  Als Zugänge nennt der Eintrag RSS, den Publikations-Webservice (TNS) und die XML-API, mit dem Hinweis, dass „deze
  Webservice zonder voorafgaande kennisgeving gewijzigd kan worden“. Damit gilt CC0 für die Daten der Bekanntmachungen,
  auch wenn wir sie über den Webservice holen. URL: https://data.overheid.nl/dataset/aankondigingen-van-overheidsopdrachten---tenderned
  (EU-Spiegel: https://data.europa.eu/data/datasets/aankondigingen-van-overheidsopdrachten-tenderned). **Live prüfen**
  (Workflow liest die Seite und die CKAN-Metadaten `license_id`).
- **OCDS-Register** (TenderNed-Daten, Ministerie van Economische Zaken): „License: Creative Commons CC0 1.0 Universal
  Public Domain Dedication“ (Suchauszug, https://data.open-contracting.org/en/publication/133).
- **Portal-Grundsatz** data.overheid.nl: „bij twijfel adviseren we altijd de CC0 licentie te kiezen“
  (https://data.overheid.nl/ondersteuning/data-publiceren/licentie-keuze).
- **CC0 heißt:** keine Bedingungen, auch geschäftliche Nutzung, keine Namensnennung nötig.
- **Nutzungsbedingungen TenderNed** (https://www.tenderned.nl/cms/nl/over-deze-site/gebruiksvoorwaarden,
  EN: https://www.tenderned.nl/cms/en/english/tenderned-terms-use, Stand 19.11.2025): gelten für die Nutzung des
  elektronischen Vergabesystems und der Bekanntmachungsplattform; man nimmt sie mit der **Registrierung** an
  („By registering on TenderNed, the User accepts these Terms of Use“). Wir registrieren uns nicht. Ein Verbot
  automatischer Abrufe zeigte keiner der Suchauszüge, der volle Text war aber nicht lesbar. **Live prüfen** (Workflow
  durchsucht beide Seiten nach „scrap|crawl|robot|geautomatiseerd|automated|hergebruik|licentie …“). Betreiber laut
  Suchauszug: Rijksdienst voor Ondernemend Nederland (RVO) bzw. PIANOo, Ministerie van Economische Zaken.
- **Gesetz:** Wet hergebruik van overheidsinformatie (Who, Umsetzung der Open-Data-Richtlinie (EU) 2019/1024). Laut
  Suchauszug zu Art. 6: Bedingungen müssen „objectief, proportioneel en niet-discriminerend“ sein und dürfen die
  Weiterverwendung nicht unnötig einschränken (https://inview.nl/openCitation/ida90518efef5d4a72b3fe9425ba94cf97/wet-hergebruik-van-overheidsinformatie-artikel-6).
- **Ergebnis:** Weiterverwendung inkl. geschäftlich nach CC0 erlaubt, **sofern** die Nutzungsbedingungen nichts
  anderes für automatische Abrufe sagen und robots.txt `/papi/` erlaubt (beides prüft der Workflow).
- **Quellenangabe** (freiwillig, aber wie bei allen Ländern): „Bron: TenderNed (aankondigingen van
  overheidsopdrachten), CC0 1.0, opgehaald op DD-MM-JJJJ“. In `alarm/alarm.py` z. B.
  „**Land:** Niederlande · Quelle: TenderNed (CC0 1.0)“.
- **Datenschutz:** Kontaktpersonen der Vergabestellen nicht speichern oder verschicken, nur Vergabestelle und Link.

## 3. robots.txt

| Host | Pfade, die wir brauchen | Ergebnis |
|---|---|---|
| www.tenderned.nl/robots.txt | `/papi/tenderned-rs-tns/v2/publicaties`, `/papi/tenderned-rs-tns/v2/publicaties/{id}`, evtl. `/papi/tenderned-rs-tns/rss/…`; Nutzungsbedingungen unter `/cms/` | **nicht geprüft** (Host gesperrt; die Suche fand die Datei nicht) |
| data.overheid.nl/robots.txt | Datensatzseite `/dataset/…`, CKAN `/data/api/3/action/package_show` | **nicht geprüft** (Host gesperrt) |

Die Schnittstelle liegt auf demselben Host wie die Webseite, es gibt keinen eigenen API-Host. Der Workflow
`niederlande-test.yml` liest beide robots.txt und entscheidet mit `urllib.robotparser`, ob die Pfade erlaubt sind;
nur dann ruft er sie ab. Ist robots.txt nicht erreichbar (Fehler/5xx), ruft er vorsichtshalber nichts ab.

## 4. Schnittstelle und Felder

**Liste:** `GET https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?…` (Kopfzeile `Accept: application/json`;
ein Projekt bekam mit falscher Accept-Zeile HTTP 406).

| Parameter | Bedeutung | Quelle/Stand |
|---|---|---|
| `publicatieDatumVanaf`, `publicatieDatumTot` | Veröffentlichungstag `JJJJ-MM-TT` | in mehreren Projekten „live geprüft“ |
| `publicatieType` | `AAO` Aankondiging van een opdracht (neue Aufträge), `VOP` Vooraankondiging, `MAC` Marktconsultatie, `AGO` Gegunde opdracht, `RVO`/`REC` Rectificatie, `WNO` Wijziging | n8n-Vorlage, printing-press spec (Codes teils widersprüchlich) |
| `nationaalOfEuropees` | `NA` = nur national (unter Schwelle), `EU` = europäisch | printing-press spec; **live prüfen**, siehe Warnung |
| `cpvCodes` | CPV mit Prüfziffer (`90910000-9`), wiederholbar | n8n-Vorlage, tenderned-mcp |
| `typeOpdracht` | `D` Dienste, `L` Lieferungen, `W` Bauleistungen | live geprüft (NL-GOV-MCP) |
| `procedure`, `aanbestedendeDienstId`, `typeAanbestedendeDienst`, `sluitingsDatumVanaf/Tot`, `search` | weitere Filter | NL-GOV-MCP / printing-press |
| `page` (ab 0, **max. 99**), `size` (Standard 50, **max. 100**, größer = HTTP 400) | Seiten; je Abfrage höchstens 10.000 Treffer erreichbar | NL-GOV-MCP, „live geprüft“ |

**Warnung (NL-GOV-MCP, SOURCES.md):** Unbekannte Parameter werden **still ignoriert** (kein Fehler, sondern alle
Treffer). Jeder Filter muss deshalb an den Gesamtzahlen geprüft werden. Der Workflow vergleicht
`totalElements` von AAO gesamt mit `nationaalOfEuropees=NA` und `=EU`.

**Antwort:** `{content: [...], totalElements, totalPages, size, number, last}` (Spring-Seite).

| Wir brauchen | Feld (Liste) | Feld (Detail `GET …/publicaties/{publicatieId}`) | Bemerkung |
|---|---|---|---|
| Kennung | `publicatieId`, `kenmerk` (Verfahrensnummer) | `publicatieId`, `kenmerk`, `referentieNummer` | |
| Titel | `aanbestedingNaam` | `aanbestedingNaam` | |
| Beschreibung | `opdrachtBeschrijving` | `opdrachtBeschrijving`, `trefwoord1/2` | |
| Auftraggeber | `opdrachtgeverNaam` | `opdrachtgeverNaam` | Register: `/aanbestedendediensten` (ca. 2.700) |
| CPV | – | `cpvCodes[]` (`code`, `omschrijving`, `isHoofdOpdracht`) | nur im Detail: 1 Abruf je Bekanntmachung |
| Ort / Provinz | – | `nutsCodes[]` (`code`, `omschrijving`) | NUTS-Code, siehe Abschnitt 6 |
| Wert | – | **kein Feld gefunden** | steht laut NL-GOV-MCP in der HTML-Ansicht `…/{id}/html` bzw. im PDF `…/{id}/pdf` |
| Abgabefrist | `sluitingsDatum` (Marktkonsultation: `sluitingsDatumMarktconsultatie`) | `sluitingsDatum` | bei Marktkonsultationen oft abweichend von der Bekanntmachung (NL-GOV-MCP: 24 von 40) |
| Art / Verfahren | `typePublicatie`, `publicatiecode`, `procedure`, `typeOpdracht` | `aankondigingCode`, `procedureCode`, `typeOpdrachtCode`, `opdrachtAardCode`, `juridischKaderCode`, `formType` | Objekte mit `code`/`omschrijving` |
| National/EU | `europees` (wahr/falsch) | `nationaalOfEuropeesCode` | für den TED-Abgleich |
| Link | `link.href` | – | Menschen-Link: `https://www.tenderned.nl/aankondigingen/overzicht/{publicatieId}` |
| Lose | – | **kein Feld gefunden** | evtl. nur in eForms-XML/HTML; **live prüfen** |
| Unterlagen | – | `…/{id}/documenten`, `…/documenten/zip` (ohne Anmeldung) | später für Steckbriefe aus Unterlagen interessant |
| Status | – | `aanbestedingStatus`, `isGegund`, `afgerondeAanbesteding`, `isVroegtijdigBeeindigd`, `publicatieIDLaatsteRectificatie`, `isDigitaalInschrijvenMogelijk` | |

Quellen der Feldnamen: https://github.com/WAINUTAI/NL-GOV-MCP (src/sources/tenderned.ts, docs/SOURCES.md),
https://github.com/MarcosTaz/Obrasignal (netherlands_tenderned.py), https://github.com/mvanhorn/printing-press-library
(library/sales-and-crm/tenderned). Alle vor dem Einbau an einer echten Antwort prüfen (Workflow druckt die Feldnamen).

**Ratenlimit:** Keins dokumentiert. NL-GOV-MCP nutzt höchstens 3 gleichzeitige Abrufe; wir bleiben bei 1 Abruf alle
3 Sekunden. Der Workflow druckt Kopfzeilen wie `X-RateLimit-*`/`Retry-After`, falls vorhanden.

## 5. Menge

- 2024: **25.014 Veröffentlichungen** auf TenderNed (alle Arten, inkl. Berichtigungen und Zuschläge; +7 %) und
  **über 12.800 gestartete Vergabeverfahren** (+7,5 %). Quelle: TenderNed, Jaarstatistieken 2024,
  https://www.tenderned.nl/cms/nl/aanbesteden-in-cijfers/jaarstatistieken/2024 (Suchauszug); bestätigt bei
  https://tenderwolf.com/en/blog/public-procurement-netherlands-figures-2024.
- Das sind rund **100 Veröffentlichungen** und rund **50 neue Aufträge pro Werktag**. Bei `publicatieType=AAO` und
  100 pro Seite: 1 Listenabruf pro Tag, plus 1 Detailabruf je Bekanntmachung für CPV/NUTS (rund 50, mit 3 s Pause
  etwa 2,5 Minuten).
- Aufteilung national/europäisch: **nicht gefunden** (nur nach Wert: rund 30 % des Volumens über den EU-Schwellen,
  laut tenderwolf). Der Workflow zählt beides für einen Tag.
- TED-Vergleich aus `docs/europa-markt.md` (03.09.–02.11.2026): NLD 2.352 Auftragsbekanntmachungen, davon 343 in
  unseren Gewerken (u. a. Zeitarbeit 85, GaLaBau 108, Reinigung 42, Sicherheit 25). Das sind mehr als die
  TenderNed-Jahreszahl hochgerechnet erwarten lässt; vermutlich zählt TED Änderungen/Lose mit. Offene Frage.
- Zum Vergleich: Frankreich 120–150, Polen ca. 520, Italien ca. 120, Katalonien ca. 120 pro Werktag.

## 6. Empfehlung für den Einbau (nur wenn Nutzungsbedingungen und robots.txt grün)

1. **Neues Modul `alarm/tenderned.py`** nach dem Muster von `alarm/bzp.py`:
   - Täglich die Bekanntmachungen des Vortags (bzw. ab der letzten gelesenen Zeit) holen:
     `GET /papi/tenderned-rs-tns/v2/publicaties?publicatieDatumVanaf=<Tag>&publicatieDatumTot=<Tag>&publicatieType=AAO&page=<n>&size=100`
     Blättern bis `last=true` (höchstens Seite 99). Später optional `VOP` und `MAC` (Marktkonsultationen) als
     Frühwarnung.
   - Für jede Bekanntmachung einmal das Detail (`…/publicaties/{id}`) für `cpvCodes` und `nutsCodes`. Vorher nach
     Auftragsart filtern (`typeOpdracht`: Dienste `D` und Bauleistungen `W`; Lieferungen `L` brauchen unsere
     Gewerke kaum), um Abrufe zu sparen.
   - 3 s Pause, User-Agent `JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)`, `Accept:
     application/json`, Zeitlimit 60 s, bei 403/429 abbrechen und Fehler melden (wie BZP).
   - Weil der Webservice sich ohne Ankündigung ändern kann: beim Einlesen Pflichtfelder prüfen (`publicatieId`,
     `publicatieDatum`, `aanbestedingNaam`), bei fehlenden Feldern Fehler melden statt still 0 Treffer.
   - Nur Frist in der Zukunft, nicht `isVroegtijdigBeeindigd`. Ein Release pro Bekanntmachung im TED-Format,
     `_land: "NLD"`, `_quelle: "TenderNed"`.
2. **Regionen:** neue Datei `alarm/provincies.json` wie `woiwodschaften.json`: 12 Provinzen = NUTS-2.
   NL11 Groningen, NL12 Friesland (Fryslân), NL13 Drenthe, NL21 Overijssel, NL22 Gelderland, NL23 Flevoland,
   NL32 Noord-Holland, NL34 Zeeland, NL41 Noord-Brabant, NL42 Limburg, **Utrecht NL35 (früher NL31)**,
   **Zuid-Holland NL36 (früher NL33)**. (Utrecht NL35 und Noord-Holland NL32 laut Suchauszug NUTS 2024 bestätigt;
   die Umbenennung NL31→NL35 und NL33→NL36 seit NUTS 2021 ist Fachwissen, **live prüfen**.) Zuordnung: erste
   4 Zeichen von `nutsCodes[].code` → Provinz (alte und neue Codes beide eintragen); sonst Provinzname in
   `nutsCodes[].omschrijving`; sonst „Gemeente X“/„Provincie X“ im Namen der Vergabestelle (Gemeindeliste CBS);
   sonst „ganze Niederlande“. `NL`/`NLZ`/`NLZZZ` = landesweit.
3. **Doppelte mit TED:** TenderNed enthält alle niederländischen TED-Aufträge und ist früher (Weiterleitung an TED
   dauert laut Mercell bis zu 48 h, https://mercell.atlassian.net/wiki/x/Koo-rC0). Darum wie bei Katalonien und
   Italien: **Niederlande komplett aus TenderNed, TED-Einträge mit Land NLD ausfiltern**, solange TenderNed läuft;
   fällt TenderNed aus, Rückfall auf TED. Alternative, falls der Abruf zu groß wird: nur `nationaalOfEuropees=NA`
   aus TenderNed, EU weiter aus TED (dann muss der Filter nachweislich wirken, siehe Warnung in Abschnitt 4).
   Zusätzlich Abgleich über TED-Nummer, falls das Detail eine enthält (Workflow sucht Schlüssel mit „ted“).
4. **CPV-Liste der Gewerke** wie in Deutschland/Frankreich. Die KI liest Niederländisch; Oberfläche und Mails auf
   Niederländisch (`sprache-nl.txt`, `mail.T["nl"]`, Zeitzone Europe/Amsterdam; `web/src/besucher.ts` kennt `nl`
   schon).
5. **Quellenangabe** in jeder Mail und auf der Seite (Abschnitt 2). Keine Kontaktpersonen übernehmen.
6. In `alarm/alarm.py` neben `bzp`/`katalonien`: `if "NLD" in ausland: import tenderned …`, und `"NLD"` aus der
   TED-Länderliste nehmen (wie `FRA`).

## 7. Offene Fragen

1. **Netzwerk:** `www.tenderned.nl` und `data.overheid.nl` in den Netzwerkeinstellungen der Cloud-Umgebung
   erlauben oder den Workflow `niederlande-test.yml` laufen lassen: https://github.com/Twista-hub/jarvis/actions/workflows/niederlande-test.yml
   → Knopf „Run workflow“ → grüner Knopf „Run workflow“. Ergebnis hier oben in den Kasten schreiben.
2. **robots.txt** von www.tenderned.nl: Ist `/papi/` erlaubt?
3. **Nutzungsbedingungen** (19.11.2025): Verbieten sie automatische Abrufe? Gelten sie überhaupt ohne Registrierung?
4. Wirkt der Filter `nationaalOfEuropees` (oder wird er still ignoriert)? Wie viele AAO sind national, wie viele EU?
5. Gibt es im Detail einen geschätzten Wert, Lose und die TED-Nummer? Sonst Wert aus `…/{id}/html` lesen
   (ein Abruf mehr pro Bekanntmachung) oder weglassen.
6. Genauer RSS-Pfad (`/papi/tenderned-rs-tns/rss/…` oder `…/v2/rss/…`), falls wir ihn als Ausfall-Warnung nutzen.
7. Laufen Abrufe aus GitHub Actions (geteilte IPs) ohne Sperre? Ratenlimit unbekannt.
8. Warum zählt TED für NLD mehr Auftragsbekanntmachungen als TenderNed neue Verfahren meldet? (Nach dem ersten
   Länder-Durchlauf einen Tag in beiden Quellen vergleichen.)
9. Die eForms-XML-API (mit Zugang) wäre stabiler dokumentiert. Zugang nur per Mail an TenderNed: Entscheidung
   und Anfrage nur durch Benjamin.
