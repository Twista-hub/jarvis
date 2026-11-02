# Polen: Datenquelle für nationale Ausschreibungen (Recherche 02.11.2026)

**Kurz:** Es gibt eine offizielle, kostenlose JSON-Schnittstelle ohne Anmeldung für den Biuletyn Zamówień Publicznych
(BZP) auf der Plattform e-Zamówienia: `https://ezamowienia.gov.pl/mo-board/api/v1/notice`. Grenze: 30 Abrufe pro Minute
und IP (seit 06.10.2026). Ab 11.01.2027 höchstens 100 Datensätze pro Seite. Das reicht für einen täglichen Abruf.

**Wichtige Einschränkung dieser Recherche:** Die Cloud-Sitzung durfte die polnischen Seiten nicht direkt abrufen
(ezamowienia.gov.pl, media.ezamowienia.gov.pl, www.gov.pl, dane.gov.pl, uzp.gov.pl, apify.com und weitere waren
„nicht erlaubt“). Alles unten stammt aus Suchergebnissen mit Auszügen dieser Seiten und aus einem GitHub-Issue.
**robots.txt, der Wortlaut der API-Regeln und eine Beispielantwort sind deshalb noch NICHT selbst geprüft.**
Siehe „Offene Fragen“.

## 1. Quelle und Zugang

| Punkt | Stand | Quelle |
|---|---|---|
| Lese-API für nationale BZP-Bekanntmachungen | `GET https://ezamowienia.gov.pl/mo-board/api/v1/notice` (laut Integrationsseite) | https://ezamowienia.gov.pl/pl/integracja/ |
| Älterer Pfad laut API-Regeln 2022/2023 | `https://ezamowienia.gov.pl/mo-client-board/api/notices/` | https://media.ezamowienia.gov.pl/pod/2023/01/Regulamin-korzystania-z-API.pdf, https://media.ezamowienia.gov.pl/pod/2023/02/Regulamin-korzystania-z-API-1.pdf |
| Anmeldung | Keine. „W zakresie Webservie nie wymagane jest składanie wniosku dostępowego.“ Lesen von Bekanntmachungen und Statistik braucht kein Integrationsverfahren. | wie oben, Integrationsseite |
| Kosten | Kostenlos („Usługa Webservie jest bezpłatna“) | API-Regeln (PDF oben) |
| Ratenlimit | Seit 06.10.2026: garantiert 30 Anfragen/Minute pro IP für `/mo-board/api/v1/notice` und alle Unterpfade; danach HTTP 403 | https://ezamowienia.gov.pl/pl/integracja/ |
| Geplante Änderung | `PageSize` max. 100 statt 500; falsche Parameter (z. B. `pageNumber`) geben 404. Test (edu.ezamowienia.gov.pl) ab 15.10.2026, Produktion ab **11.01.2027**. API bleibt öffentlich, Datenumfang gleich. | https://ezamowienia.gov.pl/pl/planowane-zmiany-w-api-bzp/, https://www.gov.pl/web/uzp/planowane-zmiany-w-api-bzp |
| Format | JSON | Integrationsseite; Beispiele bei Drittanbietern |
| Weitere (inoffizielle, undokumentierte) Pfade | `mo-board/api/v1/Board/Search` (Katalog, ca. 3,1 Mio. Datensätze; Filter `NoticeNumber`, `NoticeType`, `PublicationDateFrom/To`, `OrganizationId`), `mo-board/api/v1/notice/stats`, `mp-readmodels/api/Search/SearchTenders` | https://github.com/open-contracting/collect-generic/issues/40 |
| Bekanntmachungen eines Tages | Parameter `NoticeType=ContractNotice`, `PublicationDateFrom`, `PublicationDateTo` (ISO-Datum/Zeit). Drittanbieter berichten: max. 500 Zeilen pro Abfrage, Seitenwechsel wird teils ignoriert, darum in Zeitfenstern abfragen (bzw. `SearchAfter`). | Apify-Beschreibungen in den Suchergebnissen (z. B. https://apify.com/galhali/ezamowienia-tenders-scraper, https://apify.com/nexgensignal/pl-bzp-procurement-notice-records) |
| RSS / Massendateien | Nicht gefunden. Auf dane.gov.pl fand die Suche keinen BZP-Datensatz. | Suche ohne Treffer |
| Oberfläche für Menschen | https://ezamowienia.gov.pl/mo-client-board/bzp/list | |

Hinweis zum Umfang: Der BZP enthält nur **nationale** Bekanntmachungen (unter den EU-Schwellen). Aufträge über den
Schwellen stehen in TED, nicht im BZP. Doppelte mit TED sind daher kaum zu erwarten. Untergrenze für die BZP-Pflicht:
130.000 PLN netto (Art. 2 Pzp; Fachwissen, in dieser Sitzung nicht nachgelesen).

## 2. Lizenz und Weiterverwendung

- **API-Regeln (UZP, Zarządzenie 20/2022 bzw. 1/2023):** kostenlos, ohne Antrag. Pflicht: die Regeln vor der Nutzung
  lesen („Przed rozpoczęciem korzystania z usługi API BZP (WebService) użytkownik ma obowiązek zapoznać się z niniejszym
  Regulaminem.“). Eine eigene Lizenz oder ein Verbot geschäftlicher Nutzung zeigte keiner der Auszüge. UZP haftet nicht
  für die Inhalte der Bekanntmachungen. Quelle: PDFs oben (nur als Suchauszug gelesen).
- **Gesetz:** Ustawa z dnia 11 sierpnia 2021 r. o otwartych danych i ponownym wykorzystywaniu informacji sektora
  publicznego (Dz.U. 2021 poz. 1641, Tekst jednolity Dz.U. 2023 poz. 1524). Grundsatz: kostenlos und ohne Bedingungen.
  Zitat Art. 11 (laut Suchauszug aus dem Gesetzestext):
  > „Brak informacji o warunkach ponownego wykorzystywania informacji sektora publicznego udostępnianych w Biuletynie
  > Informacji Publicznej lub w portalu danych uważa się za udostępnianie informacji sektora publicznego w celu
  > ponownego wykorzystywania bez warunków.“

  und: Bedingungen, die eine Behörde festlegt, müssen „obiektywne, proporcjonalne, niedyskryminacyjne“ sein.
  Quellen: https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20210001641/T/D20211641L.pdf,
  https://orka.sejm.gov.pl/proc9.nsf/ustawy/1338_u.htm
- **Übliche Pflichten, wenn Bedingungen gelten** (so beschreiben es Behörden): Quelle sowie Zeitpunkt der Erstellung und
  des Abrufs nennen und angeben, dass die Daten verarbeitet wurden. Quellen:
  https://gliwice.so.gov.pl/ponowne-wykorzystywanie-informacji-sektora-publicznego,m,mg,172,173,
  https://www.gov.pl/web/mswia/ponowne-wykorzystywanie-informacji-sektora-publicznego
- **Ergebnis:** Geschäftliche Weiterverwendung ist nach Gesetz zulässig. Wir nennen trotzdem immer die Quelle, z. B.
  „Źródło: Biuletyn Zamówień Publicznych (UZP), pobrano DD.MM.RRRR, dane przetworzone“.
- **Datenschutz:** Die API-Regeln weisen darauf hin, dass Kontaktdaten in Bekanntmachungen personenbezogen sein können.
  Darum keine Kontaktpersonen speichern oder verschicken, nur Behörde und Link.

## 3. robots.txt

| Host | Ergebnis |
|---|---|
| ezamowienia.gov.pl/robots.txt | **nicht geprüft** (Host in der Sitzung gesperrt; die Suche fand die Datei nicht) |
| dane.gov.pl/robots.txt | **nicht geprüft** (Host gesperrt) |
| www.uzp.gov.pl/robots.txt | **nicht geprüft** (Host gesperrt) |

Vor dem Einbau muss jemand `https://ezamowienia.gov.pl/robots.txt` öffnen und prüfen, ob `/mo-board/` gesperrt ist.
Die API ist ausdrücklich für Maschinen gedacht, eine Sperre wäre also überraschend, aber unsere Regel verlangt die Prüfung.

## 4. Felder einer Bekanntmachung

Feldnamen laut Drittanbietern und einer Beispielantwort (MGBI, Apify); vor dem Einbau mit einer echten Antwort prüfen.

| Wir brauchen | Feld | Bemerkung |
|---|---|---|
| Titel | `orderObject` | Die Stichwortsuche der API läuft nur über dieses Feld |
| Auftraggeber | `organizationName`, `organizationNationalId` (NIP/REGON), `organizationId` | |
| Ort / Woiwodschaft | `organizationCity`, `organizationProvince` | Woiwodschaft als Code `PL02` bis `PL32` (z. B. `PL14` = Mazowieckie). PLZ des Auftraggebers wohl nur im HTML-Text |
| CPV | `cpvCode` | Text mit Code und Bezeichnung, evtl. mehrere |
| Abgabefrist | `submittingOffersDate` | Datum/Zeit |
| Art / Verfahren | `noticeType` (`ContractNotice`, `TenderResultNotice` …), `tenderType` (z. B. „1.1.2“, tryb podstawowy) | |
| Unter EU-Schwelle | `isTenderAmountBelowEU` | Typ in den Quellen widersprüchlich |
| Nummern / Datum | `bzpNumber` (z. B. „2026/BZP 00497408“), `noticeNumber`, `objectId`, `publicationDate`, `tenderId` | |
| Volltext | `htmlBody` | Bei `/notice` vorhanden, bei `Board/Search` immer `null` |
| Geschätzter Wert | kein eigenes Feld gefunden | steht, wenn überhaupt, im HTML-Text; Inhalt der Bekanntmachung regelt die Verordnung Dz.U. 2020 poz. 2439 |
| Link zu den Unterlagen | kein eigenes Feld gefunden | im HTML-Text steht die Adresse der Verfahrensseite (e-Zamówienia oder eine andere Plattform wie platformazakupowa.pl) |

Quellen: https://www.mgbi.pl/poradniki/jak-pobrac-przez-api-tresc-ogloszen-o-przetargach-z-bzp-dotyczacych-wskazanego-podmiotu/,
https://apify.com/mrarcode/bzp-scraper/output-schema, https://apify.com/galhali/ezamowienia-tenders-scraper,
https://przetargowa.pl/akty-prawne-i-komentarze/dz-u-2020-2439-z-dnia-2020-12-31-ogloszenia-zamieszczane-w-biuletynie-zamowien-publicznych/

## 5. Menge

- 2024: **129.975 Bekanntmachungen über Aufträge** („ogłoszenia o zamówieniu“) im BZP, von insgesamt 513.898
  BZP-Bekanntmachungen (25,3 %). Quelle: UZP, „Informacja o polskim rynku zamówień publicznych w roku 2024“,
  https://www.gov.pl/attachment/0976bbaa-4d6b-4399-91bf-a452352896a5
- Das sind rund **360 pro Kalendertag** oder rund **520 pro Werktag**. Bei 100 pro Seite also etwa 4 bis 6 Abrufe pro
  Tag, weit unter dem Limit.
- Zum Vergleich Frankreich (BOAMP): rund 120 bis 150 pro Tag. Polen ist also ungefähr dreimal so groß.

## 6. Empfehlung für den Einbau

1. Neues Modul `alarm/bzp.py` nach dem Muster von `alarm/boamp.py`:
   - Einmal täglich (früh morgens) die Bekanntmachungen vom Vortag holen:
     `GET https://ezamowienia.gov.pl/mo-board/api/v1/notice?NoticeType=ContractNotice&PublicationDateFrom=<Vortag>T00:00:00&PublicationDateTo=<Vortag>T23:59:59&PageSize=100`
     (Schreibweise der Parameter an einer echten Antwort prüfen).
   - Wenn eine Seite voll ist (100), das Zeitfenster teilen (z. B. stundenweise), statt auf Seitenzahlen zu vertrauen.
   - Höchstens 1 Anfrage alle 3 Sekunden (20/Minute), eigener User-Agent mit Kontaktadresse, bei 403 abbrechen und
     später neu versuchen.
2. Umwandlung in das Release-Format wie TED. Woiwodschaft aus `organizationProvince` als Filter für die Firma
   (wie die Départements in Frankreich). PLZ, geschätzten Wert und Link zur Verfahrensseite aus `htmlBody` lesen.
3. In `alarm/alarm.py`: Polen national aus BZP, über den Schwellen weiter aus TED. Doppelte über
   `isTenderAmountBelowEU` bzw. Abgleich der Nummern vermeiden.
4. CPV-Liste der Gewerke wie in Deutschland und Frankreich nutzen. Die KI muss polnische Texte lesen,
   Oberfläche und Mails auf Polnisch.
5. Quellenangabe in jeder Mail und auf der Seite: „Źródło: Biuletyn Zamówień Publicznych (UZP)“, mit Datum des Abrufs.
   Keine Kontaktpersonen übernehmen.
6. Vor dem Start einmal mit `edu.ezamowienia.gov.pl` (Testumgebung) prüfen, ob unser Code mit der neuen Grenze von
   100 Datensätzen ab 11.01.2027 läuft.

## 7. Offene Fragen

1. **Netzwerk:** Die Hosts `ezamowienia.gov.pl`, `media.ezamowienia.gov.pl`, `www.gov.pl`, `dane.gov.pl` und
   `uzp.gov.pl` müssen in den Netzwerkeinstellungen der Cloud-Umgebung erlaubt werden. Dann nachholen:
   robots.txt prüfen, aktuellen Wortlaut der API-Regeln lesen, eine kleine Beispielantwort ansehen.
2. Läuft der Abruf aus GitHub Actions? Das Limit gilt pro IP, und Actions-Runner teilen sich IPs mit anderen Nutzern.
   Möglicherweise vorher testen, ob 403 kommt.
3. Genaue Parameternamen und Seitenwechsel (`PageNumber`, `SearchAfter`?) erst mit einer echten Antwort festlegen.
4. Steht der geschätzte Wert bei den meisten Bekanntmachungen im Text? Erst nach einer Stichprobe bekannt.
5. Gibt es in den aktuellen API-Regeln (nach 2023) neue Bedingungen zur Weiterverwendung? Bisher nichts gefunden.
6. Zuschläge (`TenderResultNotice`) und Änderungen (Fristverlängerungen) später zusätzlich holen?
