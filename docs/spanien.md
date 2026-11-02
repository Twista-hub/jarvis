# Spanien: Datenquelle PLACSP (Recherche 02.11.2026)

> **Stand 02.11.2026 (Lese-Tests `spanien-test.yml`, `spanien-regionen-test.yml`):**
> - `contrataciondelsectorpublico.gob.es/robots.txt` und `contrataciondelestado.es/robots.txt`: **`User-agent: * / Disallow: /`**.
>   Die PLACSP-Feeds wären technisch erreichbar (643: 25 Einträge/Seite, 0,8 MB; 1044: 350 Einträge, 4,5 MB) und die
>   Lizenz (Aviso legal Hacienda, live gelesen) erlaubt kommerzielle Nutzung mit „Origen de los datos: Ministerio de
>   Hacienda“. **Wegen der robots.txt nutzen wir PLACSP nicht automatisch**, bis das Ministerium es schriftlich erlaubt
>   (Entwurf: `docs/anfragen/placsp-anfrage.md`, Versand nur nach OK von Benjamin).
> - Bis dahin: Spanien nur über TED (Aufträge über den EU-Schwellen), Regionen über NUTS-2 (Comunidades Autónomas).
> - Regionalportale: datos.comunidad.madrid und contratosdegalicia.gal sperren alles; Euskadi und Andalucía sperren
>   nur Teilbereiche; Kataloniens Open-Data-Portal (analisi.transparenciacatalunya.cat, Socrata) sperrt nur
>   Such-/Listenseiten. **Katalonien eingebaut** (`alarm/katalonien.py`, Datensatz ybgg-dgi6, Phase „Anunci de licitació“,
>   ca. 120 neue Ausschreibungen pro Tag, alle Schwellen). Lizenz „Llicència oberta d'ús d'informació – Catalunya“
>   (live gelesen 02.11.2026): Weiterverwendung, Verbreitung, Bearbeitung weltweit; Quelle mit Aktualisierungsdatum
>   nennen, keine Logos. contractaciopublica.cat robots.txt: `Allow: /`, Crawl-delay 1, 60/min. TED-Kopien
>   katalanischer Aufträge (NUTS ES51) werden ausgefiltert.

Status: nur Recherche, noch nichts eingebaut. **Wichtig:** Aus dieser Cloud-Sitzung waren `contrataciondelestado.es`
und `hacienda.gob.es` gesperrt (Netzwerkfreigabe der Sitzung). robots.txt, Aviso legal und Feed konnte ich deshalb
**nicht selbst abrufen**. Die Angaben unten stammen aus der Websuche (Hacienda-, datos.gob.es-Seiten) und aus dem
öffentlichen Open-Source-Projekt BquantFinance/licitaciones-espana (Stand 02.11.2026), das die Feeds seit Jahren
verarbeitet und echte Beispiel-Einträge enthält. Alles mit „prüfen“ vor dem Einbau einmal live bestätigen.

## 1. Quelle und Zugang

**Plattform:** Plataforma de Contratación del Sector Público (PLACSP), neue Domain `contrataciondelsectorpublico.gob.es`,
alte `contrataciondelestado.es` funktioniert weiter. Offene Daten als **ATOM 1.0 (RFC 4287) mit CODICE-XML** (spanische
UBL-2-Ableitung) in jedem `<entry>`.
- Spezifikation: https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf und
  https://www.hacienda.gob.es/Documentacion/Publico/D.G.%20PATRIMONIO/Plataforma_Contratacion/especificacion-sindicacion-1-3.pdf
- Handbuch OpenPLACSP (Werkzeug des Ministeriums): https://contrataciondelestado.es/datosabiertos/DGPE_PLACSP_OpenPLACSP_v.2.1.pdf

**Feeds** (Basis-URL `https://contrataciondelsectorpublico.gob.es/sindicacion/…`, Quelle:
[licitaciones.py, CONJUNTOS](https://github.com/BquantFinance/licitaciones-espana/blob/main/nacional/licitaciones.py),
[Apify-Beispiel mit 643-Feed](https://apify.com/flets_sv/licitaciones-placsp/api/python)):

| Datensatz | Einstieg (ATOM) | Archiv-ZIP | Für uns |
|---|---|---|---|
| Ausschreibungen der Profile auf PLACSP, ohne Kleinaufträge | `sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom` | `…Completo3_JJJJ.zip` / `_JJJJMM.zip` | **Ja, Hauptquelle** |
| Regionalplattformen per Agregación, ohne Kleinaufträge | `sindicacion_1044/PlataformasAgregadasSinMenores.atom` | `PlataformasAgregadasSinMenores_JJJJ(MM).zip` | **Ja** |
| Kleinaufträge (contratos menores, meist schon vergeben) | `sindicacion_1143/contratosMenoresPerfilesContratantes.atom` | `…_JJJJ.zip` | Nein (keine Ausschreibung) |
| Encargos a medios propios / Markterkundungen | `sindicacion_1383/…`, `sindicacion_1403/…` | `EMP_…`, `CPM_…` | Nein |

Datensatz-Seiten: [Hacienda 643](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx),
[Hacienda 1044](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesAgregacion.aspx),
[datos.gob.es 643](https://datos.gob.es/es/catalogo/e05250001-licitaciones-publicadas-en-los-perfiles-del-contratante-ubicados-en-la-plataforma-de-contratacion-del-sector-publico-excluyendo-los-contratos-menores),
[datos.gob.es 1044](https://datos.gob.es/es/catalogo/e05250001-licitaciones-publicadas-en-la-plataforma-mediante-mecanismos-de-agregacion-excluyendo-los-contratos-menores).
Exakte Dateinamen der ATOM-Einstiege vor dem Einbau live prüfen (der 1044-Name stammt aus Hacienda-Seite und Suchergebnis).

**Aktualisierung:** laut Hacienda **täglich**; „diariamente se publican las actualizaciones producidas durante el día
anterior, por lo que una misma licitación puede aparecer tantas veces como modificaciones se hayan producido“ (Hacienda-
Seite 643, über die Websuche). Ein echter Dateiname `PlataformasAgregadasSinMenores_20260106_040115.atom`
([Testdatei](https://github.com/BquantFinance/licitaciones-espana/blob/main/tests/fixtures/entry_agregacion_real.xml))
deutet auf einen nächtlichen Lauf gegen 04:00 Uhr. Der ZIP des laufenden Jahres wird täglich neu erzeugt
([COBERTURA.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/COBERTURA.md)).

**Nur Neues holen:** Jede ATOM-Datei hat höchstens **500 Einträge**, neueste zuerst; ältere stehen in der Datei hinter
`<link rel="next">` (Hacienda-Seite 643; [OpenPLACSP-Handbuch](https://contrataciondelestado.es/datosabiertos/DGPE_PLACSP_OpenPLACSP_v.1.3.pdf)).
Also: Einstiegsdatei lesen, `next` folgen, bis `<updated>` älter ist als der letzte Lauf. Jede Änderung (Veröffentlichung,
Fristverlängerung, Zuschlag …) ist ein neuer Eintrag mit gleicher `<id>` und neuem `<updated>`; Löschungen kommen als
`<at:deleted-entry>` (Namensraum `http://purl.org/atompub/tombstones/1.0`, [licitaciones.py](https://github.com/BquantFinance/licitaciones-espana/blob/main/nacional/licitaciones.py)).

**Dateigröße:** 500 Einträge pro Datei; MB-Größe nicht gemessen (prüfen). ZIPs werden ohne `Content-Length`/`Range`
mit 0,4–1 MB/s ausgeliefert ([COBERTURA.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/COBERTURA.md)),
für den Tagesbetrieb also nur die ATOM-Kette, keine ZIPs.

**Zuverlässigkeit:** Nutzerkommentare auf datos.gob.es melden Ausfälle (1044: Lücke Mitte Oktober 2025, belegt auch als
„hueco de agregacion del 17 al 22 de octubre de 2025“ in [COBERTURA.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/COBERTURA.md);
643: Stillstand ab 23.07.2026, später laut Ministerium behoben). → Überwachung „letzter Eintrag älter als 48 h“ einbauen.

**Regionalplattformen („datos agregados“):** Der Feed 1044 enthält die Ausschreibungen der Regionen mit eigener
Plattform; der Link im Eintrag zeigt dann auf die Regionalplattform (Beispiel Navarra:
`hacienda.navarra.es/sicpportal/…`, [Testdatei](https://github.com/BquantFinance/licitaciones-espana/blob/main/tests/fixtures/entry_agregacion_real.xml)).
Belegt: Navarra (nur über Agregación), La Rioja (Regierung über Agregación), Galicia (99,95 % deckungsgleich mit 1044),
Murcia bis 2020 ([COBERTURA.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/COBERTURA.md)).
Katalonien, Baskenland, Madrid, Andalusien laut Sekundärquellen ebenfalls angebunden
([tendios.com](https://tendios.com/blog/datos-abiertos-en-contratacion-publica-placsp-y-bdns),
[gobierto.es](https://www.gobierto.es/blog/plataforma-de-contratacion-del-sector-publico-placsp)). Das Ministerium selbst
nannte die Agregación-Daten 2018–2020 „insuficientes“ ([Informe Trienal 2021](https://www.hacienda.gob.es/DGPatrimonio/junta%20consultiva/trienal2021.pdf)).
Die Agregación-Einträge sind dünner (keine Eignungs-/Garantiedaten, [placsp.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/fuentes/placsp.md)).
Eigene Regionalquellen (z. B. Katalonien Socrata `ybgg-dgi6`, Euskadi-API) erst später und nur bei Lücken; deren
Lizenzen sind teils abweichend (Madrid-Portal widersprüchlich, Katalonien eigene Lizenz, [DATA_LICENSE.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/DATA_LICENSE.md)).

## 2. Lizenz

Datensätze von PLACSP unterliegen den **allgemeinen Weiterverwendungsbedingungen des Ministerio de Hacienda**
(Ley 37/2007, RD 1495/2011, Grundmodalität ohne Anmeldung), verlinkt von datos.gob.es
([Aviso legal Hacienda](https://www.hacienda.gob.es/es-ES/Paginas/Avisolegal.aspx); ebenso
[DATA_LICENSE.md](https://github.com/BquantFinance/licitaciones-espana/blob/main/DATA_LICENSE.md), Eintrag PLACSP:
„uso comercial y no comercial. «Origen de los datos: Ministerio de Hacienda»“). Zusätzlich gibt es ein eigenes
[Aviso legal der PLACSP](https://contrataciondelestado.es/wps/portal/info/aviso_legal) (nicht abrufbar, prüfen).

Zitat (Aviso legal Hacienda, laut Websuche; Wortlaut live prüfen):
> „Las presentes condiciones generales permiten la reutilización de los documentos sometidos a ellas para fines
> comerciales y no comerciales.“ … Cita: „Origen de los datos: Ministerio de Hacienda“.

Pflichten nach RD 1495/2011 / Ley 37/2007 ([BOE Ley 37/2007](https://www.boe.es/eli/es/l/2007/11/16/37/con)):
Quelle nennen, Inhalt nicht verfälschen, Datum der letzten Aktualisierung angeben, nicht den Eindruck einer amtlichen
Beteiligung erwecken; Nutzung auf eigenes Risiko. **Geschäftliche Nutzung ist erlaubt.**
→ In Mail und App: „Origen de los datos: Ministerio de Hacienda – Plataforma de Contratación del Sector Público
(actualizado: <Datum>)“ plus unser Hinweis „keine Behörde“.

## 3. robots.txt

**Nicht selbst geprüft** (Host aus dieser Sitzung gesperrt). Einzige Angabe: Ein Skript des genannten Projekts
(Oktober 2026) notiert „robots.txt de contrataciondelestado.es: no prohíbe /wps/ ni /FileSystem/“
([melilla_menores.py](https://github.com/BquantFinance/licitaciones-espana/blob/main/melilla/melilla_menores.py)).
Ob `/sindicacion/` erlaubt ist und wie robots.txt auf `contrataciondelsectorpublico.gob.es` aussieht, ist offen.
**Vor dem Einbau Pflicht:** beide `…/robots.txt` im GitHub-Workflow abrufen und ins Log schreiben; bei Sperre von
`/sindicacion/` nicht einbauen (Regel: robots.txt beachten).

## 4. Felder pro Eintrag (CODICE)

Pfade unter `cac-place-ext:ContractFolderStatus`, belegt durch echte Einträge und Parser
([licitaciones.py](https://github.com/BquantFinance/licitaciones-espana/blob/main/nacional/licitaciones.py),
[Testdateien](https://github.com/BquantFinance/licitaciones-espana/tree/main/tests/fixtures)):

| Feld | Element |
|---|---|
| Titel | `atom:title` bzw. `cac:ProcurementProject/cbc:Name`; Kurztext in `atom:summary` („Id licitación; Órgano; Importe; Estado“) |
| Aktenzeichen | `cbc:ContractFolderID` |
| Auftraggeber | `cac-place-ext:LocatedContractingParty/cac:Party/cac:PartyName/cbc:Name`, Adresse `cac:PostalAddress/cbc:CityName`, `cbc:PostalZone` (PLZ des Auftraggebers, nicht des Einsatzorts) |
| Ort der Ausführung | `cac:ProcurementProject/cac:RealizedLocation/cbc:CountrySubentityCode` (**NUTS-3**, z. B. ES220 = Navarra) und `cbc:CountrySubentity` (Name) |
| CPV | `cac:RequiredCommodityClassification/cbc:ItemClassificationCode` (mehrere möglich) |
| Art | `cbc:TypeCode`: 1 Lieferung, 2 Dienstleistung, 3 Bau … |
| Verfahren | `cac:TenderingProcess/cbc:ProcedureCode`: 1 offen, 9 offen vereinfacht, 2 nicht offen, 3 Verhandlung ohne Bekanntmachung, 7 Abruf aus Rahmenvertrag … |
| Abgabefrist | `cac:TenderingProcess/cac:TenderSubmissionDeadlinePeriod/cbc:EndDate` + `cbc:EndTime` |
| Wert | `cac:BudgetAmount/cbc:EstimatedOverallContractAmount` (geschätzter Wert), `cbc:TaxExclusiveAmount` (Budget ohne MwSt.), `cbc:TotalAmount` (mit MwSt.) |
| Status | `cbc-place-ext:ContractFolderStatusCode`: PRE Vorinformation, **PUB veröffentlicht (en plazo)**, EV in Bewertung, ADJ vergeben, RES abgeschlossen, ANUL aufgehoben, DES ohne Zuschlag |
| Lose | `cac:ProcurementProjectLot` (eigener Name, CPV, Budget) |
| Link | `atom:link@href`: `https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=…`; bei 1044 Link zur Regionalplattform |
| Bekanntmachungen | `cac-place-ext:ValidNoticeInfo` (Typ, Datum, Medium z. B. DOUE/BOE) – damit TED-Doppelte erkennbar |
| Unterlagen | `cac:LegalDocumentReference`, `cac:TechnicalDocumentReference` mit `cac:Attachment/cac:ExternalReference/cbc:URI` (Pliegos) |

Hinweis: Seit 2025/26 stellt PLACSP auf eForms um; neue Zusatzfelder beschreibt
[DGPE_PLACSP_eFormsB2B_nuevosDatos_v1.4.pdf](https://contrataciondelestado.es/b2b/DGPE_PLACSP_eFormsB2B_nuevosDatos_v1.4.pdf).
Der ATOM bleibt CODICE (Testdateien aus 2026).

## 5. Menge

- Feed 643: **169.326** Ausschreibungen mit Bekanntmachung 2025, 131.097 im Jahr 2026 bis Oktober
  ([placsp.md, Tabelle Cobertura](https://github.com/BquantFinance/licitaciones-espana/blob/main/docs/fuentes/placsp.md))
  → rund **460 pro Kalendertag, ca. 650–700 pro Werktag**.
- Feed 1044: 434.000 Ausschreibungen 2016 bis Feb. 2026 (im Mittel rund 120/Tag); 2025 waren es 250.652 Einträge
  inklusive Änderungen (gleiche Quelle).
- Darin stecken alle Verfahren und Gewerke (auch Abrufe aus Rahmenverträgen, Verhandlungen ohne Bekanntmachung).
  Offen und in unseren 10 Gewerken wird es nur ein Teil sein; zum Vergleich TED Spanien: 566 in 60 Tagen in unseren
  Gewerken (`docs/europa-markt.md`). Pro Tag kommen zusätzlich mehrere Hundert Änderungs-Einträge.

## 6. Empfehlung zum Einbau

1. **Erst freischalten:** `contrataciondelsectorpublico.gob.es` und `contrataciondelestado.es` müssen aus GitHub Actions
   erreichbar sein; erster Workflow nur lesen: beide robots.txt, Aviso legal, Kopf der zwei ATOM-Einstiege (eine Datei,
   500 Einträge) loggen. Ergebnis hier nachtragen.
2. **`alarm/placsp.py`** nach Muster `alarm/boamp.py`: täglich ca. 07:00 Madrid die Ketten 643 und 1044 lesen, `next`
   folgen bis zum letzten `updated` (Merkpunkt in der DB), höchstens z. B. 20 Dateien pro Lauf, Pause zwischen Abrufen,
   eigener User-Agent mit Kontaktadresse.
3. **Filter:** nur `ContractFolderStatusCode = PUB`, Abgabefrist in der Zukunft, Verfahren offen/vereinfacht/nicht
   offen/mit Verhandlung (1, 2, 4, 5, 9, 13); `deleted-entry` und ANUL entfernen; pro `id` nur der neueste Eintrag.
   Fristverlängerung = Update eines vorhandenen Treffers, kein neuer Alarm.
4. **Doppelte mit TED:** Spanien künftig aus PLACSP statt TED (wie Frankreich mit BOAMP) oder Einträge mit DOUE-Bekanntmachung
   in `ValidNoticeInfo` gegen TED abgleichen.
5. **Gebiet:** Firmen wählen Provinzen; Zuordnung über NUTS-3 (`RealizedLocation`), sonst PLZ-Präfix (2 Ziffern = Provinz)
   des Auftraggebers.
6. **Umwandlung** in das vorhandene Release-Format (wie TED/BOAMP), Sprache Spanisch (`sprache-es.txt`), Quellenhinweis
   aus Abschnitt 2 in Mail und Detailseite.
7. **Wächter:** Warnung an Benjamin/Telegram, wenn ein Feed länger als 48 h nichts Neues liefert (bekannte Ausfälle).

## 7. Offene Fragen

- robots.txt beider Domains, insbesondere `/sindicacion/` (nicht prüfbar, siehe oben).
- Genauer Wortlaut des PLACSP-Aviso-legal und des Hacienda-Aviso-legal (nur aus der Websuche bekannt).
- Dateigröße einer ATOM-Datei und genaue Uhrzeit der Aktualisierung (messen).
- Exakter Dateiname des 1044-Einstiegs (`PlataformasAgregadasSinMenores.atom`) live bestätigen.
- Welche Regionen 2026 vollständig über 1044 kommen (v. a. Katalonien, Madrid, Andalusien, Baskenland); Stichprobe nach
  NUTS (ES51, ES30, ES61, ES21) zählen.
- Erreichbarkeit spanischer Behördenseiten aus GitHub-Actions-Rechenzentren (Sperren für Nicht-EU-IPs möglich).
- Echter Anteil unserer Gewerke pro Tag (nach dem ersten Lese-Workflow per CPV zählen).
