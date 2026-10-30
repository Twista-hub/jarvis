# Personal, Berufe und tarifliche Daten

## Begriffe, die getrennt bleiben

- **Organisationsbereich:** Firma, Region, Standort, Abteilung oder Team. Standortleitungen werden auf einen Bereich begrenzt.
- **App-Zugang:** Anmeldung und Datenrechte einer Person. Einsatzkräfte brauchen nicht automatisch ein Jarvis-Konto.
- **Funktion:** Aufgabe in der Organisation, zum Beispiel Disposition, Standortleitung oder Sachbearbeitung.
- **Beruf:** Tätigkeit, die eine Person ausüben kann, etwa Elektriker/in, Maler/in oder Sachbearbeiter/in.
- **Qualifikation:** Nachweis oder Fähigkeit für einen Einsatz, zum Beispiel Staplerschein, Ersthelfer-Ausbildung oder Schweißprüfung.
- **Tarifregel:** Gilt nur mit Tarifvertrag, Region, Entgeltgruppe und Datum. Sie ist keine allgemeine Berufs- oder Qualifikationsliste.

## Bereits umgesetzt

- Berufsgruppen für Büro, Bau/Ausbau, Technik/Metall, Logistik, Gastronomie, Reinigung, Pflege, Einzelhandel, Sicherheit/Veranstaltung und Garten/Agrar.
- Zusätzliche Berufe pro Person bleiben als Freitext möglich.
- Qualifikationen aus dem Grundkatalog sowie selbst angelegte Qualifikationen je Firma oder Standort.
- Filter nach Beruf, Qualifikation und Verfügbarkeit; Standortleitung mit Personal- und Einsatzrechten nur im zugeordneten Bereich.
- Firmenweite Kalkulation, Angebotsunterlagen und Mitgliedsverwaltung bleiben der Administration bzw. explizit finanzberechtigten Rollen vorbehalten.

## Nächster Datenbankschritt

Die gemeinsame Berufsdatenbank soll kanonische Berufe mit Synonymen und Herkunft enthalten. Treffer aus Ausschreibungen werden nicht ungeprüft zu Berufen erklärt: Jarvis schlägt eine Zuordnung mit Originaltext, Fundstelle und Vertrauenswert vor; ein Mensch bestätigt oder korrigiert sie. So können neue und branchenspezifische Tätigkeiten ergänzt werden, ohne ältere Datensätze umzubenennen.

Zielverknüpfungen: Ausschreibung ↔ Beruf ↔ Anforderungen; Einsatzkraft ↔ Berufe ↔ Qualifikationsnachweise; Qualifikationsnachweis ↔ Ablaufdatum; Tarifregel ↔ Vertrag/Region/Gültigkeitszeitraum/Entgeltgruppe. Tarifdaten müssen aus dem passenden Originalvertrag übernommen werden. Eine GVP/DGB-Tabelle darf zum Beispiel nicht auf Maler-, Elektro- oder andere Branchen übertragen werden.

Als erster Berufskatalog dient die [BERUFENET-Berufsfeldübersicht der Bundesagentur für Arbeit](https://web.arbeitsagentur.de/berufenet/berufsfelder). Sie ist eine strukturierende Referenz, kein Tarifkatalog. Die vorhandene Zeitarbeit-Kalkulation nutzt ausschließlich die Originalquellen des [DGB/GVP-Entgelttarifvertrags](https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf) und des [DGB/GVP-Entgeltrahmentarifvertrags](https://www.dgb.de/fileadmin/download_center/Uploads/2025-05-20_Entgeltrahmentarifvertrag.pdf).

## Recherche Tarifverträge (30.10.2026)

- Das [BMAS-Tarifregister](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Tarifvertraege/Tarifregister/tarifregister.html) führt einen sehr großen Bestand (über 90.000 gültige Verträge zu Jahresbeginn 2026), stellt aber keine vollständigen Verträge als offenen Gesamtdownload bereit. Die Tarifvertragsparteien sind für die konkrete Anwendung maßgeblich.
- Das [Tarifregister NRW](https://www.tarifregister.nrw.de/tarifinformationen/tarifdaten_branchen) verzeichnet eingereichte, in NRW gültige Verträge (durchschnittlich 1.800 pro Jahr) und veröffentlicht grundlegende Datenblätter für über 100 ausgewählte Branchen. Die öffentliche [Grundvergütungsdatenbank](https://www.tarifregister.nrw.de/tarifinformationen/grundverguetung_branchen) nennt Beruf, Branche, Qualifikation, Tätigkeit, Arbeitszeit, Grundvergütung und Gültigkeitszeitraum. Beide Seiten melden Stand Oktober 2026, schließen aber eine Gewähr für Richtigkeit/Aktualität aus. NRW ist eine wertvolle Startreferenz, keine bundesweit vollständige oder verbindliche Lohntabelle.
- Das [WSI-Tarifarchiv](https://www.wsi.de/de/tarifverguetungen-nach-branchen-15298.htm) deckt Tarifvergütungen für über 200 Berufe und rund 50 Branchen sowie ausgewählte regionale Tariftabellen ab. Laut WSI werden die Datenbanken laufend aktualisiert; einzelne Entgeltstände können trotzdem mehrere Jahre zurückliegen. Das WSI verschickt keine Verträge und erteilt keine Einzelauskünfte. Es ist die breiteste geprüfte bundesweite Recherchequelle, aber keine Gesamtliste sämtlicher Tarifverträge.
- Laut `robots.txt` des BMAS sind Query-String-URLs gesperrt (`Disallow: /*?*`, `Crawl-delay: 180`). Beim NRW-Register ist `/search/` gesperrt. Die gesperrten Pfade werden nicht automatisiert abgerufen. Details und geprüfte Grenzen stehen in `alarm/quellen.md`.

### Konsequenz für die App

Der Dropdown darf nicht so tun, als gäbe es bereits „alle Tarifverträge“. Die Auswahl verknüpft eine Einsatzkraft mit einem konkreten Vertrag ihrer Firma; die Entgeltgruppen werden ausschließlich aus diesem Vertrag angeboten. Als vorgegebener Vertrag ist nur GVP/DGB mit Originalquelle und den hinterlegten Gruppen verfügbar. Weitere Verträge erfassen Inhaber/Admins anhand des konkreten Vertrags mit Gruppenbezeichnungen und Quellenangabe. Für produktive Lohnkalkulationen müssen zusätzlich Tarifbereich, Region, Gültigkeitszeitraum und Originalquelle gespeichert und geprüft werden. WSI- und NRW-Tarifdaten sind als Recherchehinweise nützlich, dürfen ohne geklärte Nutzungsrechte und belastbaren Aktualisierungsweg aber nicht unbemerkt als vollständiger Vertragsbestand übernommen werden.
