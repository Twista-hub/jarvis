# Personal, Berufe und tarifliche Daten

## Begriffe, die getrennt bleiben

- **Organisationsbereich:** Firma, Region, Standort, Abteilung oder Team. Standortleitungen werden auf einen Bereich begrenzt.
- **App-Zugang:** Anmeldung und Datenrechte einer Person. Einsatzkräfte brauchen nicht automatisch ein Jarvis-Konto.
- **Funktion:** Aufgabe in der Organisation, zum Beispiel Disposition, Standortleitung oder Sachbearbeitung.
- **Beruf:** Tätigkeit, die eine Person ausüben kann, etwa Elektriker/in, Maler/in oder Sachbearbeiter/in.
- **Qualifikation:** Nachweis oder Fähigkeit für einen Einsatz, zum Beispiel Staplerschein, Ersthelfer-Ausbildung oder Schweißprüfung.
- **Tarifregel:** Gilt nur mit Tarifvertrag, Region, Entgeltgruppe und Datum. Sie ist keine allgemeine Berufs- oder Qualifikationsliste.

## Bereits umgesetzt

- Berufsgruppen für Büro/Verwaltung, Bau/Ausbau, Elektro/Metall/Technik, IT/Kommunikation, Logistik, Gastronomie/Hotel, Reinigung/Hauswirtschaft, Pflege/Soziales, Bildung/Betreuung, Einzelhandel, Sicherheit/Veranstaltung, Garten/Agrar/Tierpflege, Fahrzeug/Verkehr und Gebäudetechnik/Energie (`web/src/berufe.ts`).
- Ausschreibungs-Synonyme werden auf vorhandene kanonische Berufe abgebildet, z. B. Schreiner → Tischler/in, Fachinformatiker Systemintegration → Fachinformatiker/in und PV-Monteur → Solar-/Photovoltaikmonteur/in (`web/src/katalog-daten.ts`). Der erkannte Eintrag enthält weiterhin Originalfundstelle und Losbezug.
- Zusätzliche Berufe pro Person bleiben als Freitext möglich.
- Qualifikationen aus dem Grundkatalog sowie selbst angelegte Qualifikationen je Firma oder Standort.
- Filter nach Beruf, Qualifikation und Verfügbarkeit; Standortleitung mit Personal- und Einsatzrechten nur im zugeordneten Bereich.
- Firmenweite Kalkulation, Angebotsunterlagen und Mitgliedsverwaltung bleiben der Administration bzw. explizit finanzberechtigten Rollen vorbehalten.

### Tarifdatenbank (31.10.2026)

Die Migration `supabase/migrations/20261031070000_tarifkatalog_branchen.sql` ergänzt einen globalen, für angemeldete Nutzer nur lesbaren Quellenkatalog und legt die auswählbaren Einträge je Firma als geschützte Kopie an. Neue Firmen bekommen denselben Stand. Im Mitarbeiterformular stehen nun 14 gruppierte Tarif-/Mindestlohneinträge bereit: Zeitarbeit, Elektro, Gebäudereinigung NRW, Bau, Groß-/Außenhandel, GaLaBau, TVöD-VKA (Allgemein/SuE/Pflege), TV-L, Maler-, Dachdecker-, Pflege- und bundesweiter Gebäudereinigungsmindestlohn. Die drei neuen bundesweiten Rechtsnorm-Einträge haben gültige Gruppen und Stichtagswerte; DEHOGA NRW bleibt mit Laufzeit/Quelle ein Metadatum ohne Gruppenauswahl, bis eine vollständige aktuelle Tabelle belegt ist.

Die Vertragsdatensätze führen Branche, Region, Gruppenart, Berufsbezug, URL, Gültigkeit, Prüfdatum und einen Datenhinweis. Die NRW-Arbeitshilfen belegen teilweise Gruppenanzahl und Laufzeit, aber nicht die Tätigkeitsmerkmale jeder Gruppe oder deren Entgelt; das steht beim Eintrag ausdrücklich dabei. Gespeichert sind 30 GVP/DGB-Entgeltwerte (EG 1–9, drei Stichtage), Maler 16,13 €/Std. (Gesellen, ab 01.07.2026), Dachdecker (14,96 €/Std. ungelernt sowie 16,60 / 17,10 / 17,60 €/Std. gelernt ab 2026/2027/2028), Pflege (drei gesetzliche Qualifikationsstufen, Stichtage 2026 und 2027) und Gebäudereinigung bundesweit LG 1 (15,00 €/Std.) sowie LG 6 (18,40 €/Std.), jeweils ab 01.01.2026. Der Pflege-Mindestlohn gilt laut Verordnung bis 30.09.2028; die zwingende Gebäude-Arbeitsbedingungenverordnung endet 31.12.2026, weshalb Nachfolgesätze vor Jahreswechsel geprüft werden müssen. Diese Branchenwerte sind gesetzliche Untergrenzen, keine vollständigen Tarifverträge; sie werden nicht in die Angebotspreiskalkulation eingemischt. Andere Tarifentgelte werden nicht geschätzt. Die bestehende automatische Lohnkalkulation bleibt auf GVP/DGB begrenzt.

Das ist keine vollständige Liste aller deutschen Tarifverträge. Das BMAS nennt über 90.000 gültige Verträge, gibt aber keinen offenen vollständigen Datensatz aus. Weitere Einträge brauchen einen aktuellen Originalvertrag oder eine belastbare öffentliche Originalquelle sowie Prüfung von Tarifbindung, Region, Laufzeit und Nutzungsrecht. Fehlende Tätigkeitsmerkmale oder Werte bleiben als Lücke gekennzeichnet.

## Datenherkunft und nächste Schritte

Der aktuelle Berufekatalog ist ein kuratierter Startbestand im Anwendungscode, keine vollständige oder direkt importierte amtliche Berufedatenbank. Die Synonymliste wächst schrittweise. Der Trefferbedarf wird mit Originaltext/Fundstelle erkannt; fachliche Eignung und Zuordnung müssen weiter durch Nutzer geprüft werden. Für eine größere Berufedatenbank sind pro Eintrag Herkunft, Aktualisierungsdatum und Nutzungsrecht zu dokumentieren, bevor sie importiert wird.

Zielverknüpfungen: Ausschreibung ↔ Beruf ↔ Anforderungen; Einsatzkraft ↔ Berufe ↔ Qualifikationsnachweise; Qualifikationsnachweis ↔ Ablaufdatum; Tarifregel ↔ Vertrag/Region/Gültigkeitszeitraum/Entgeltgruppe. Tarifdaten müssen aus dem passenden Originalvertrag übernommen werden. Eine GVP/DGB-Tabelle darf zum Beispiel nicht auf Maler-, Elektro- oder andere Branchen übertragen werden.

Als erster Berufskatalog dient die [BERUFENET-Berufsfeldübersicht der Bundesagentur für Arbeit](https://web.arbeitsagentur.de/berufenet/berufsfelder). Sie ist eine strukturierende Referenz, kein Tarifkatalog. Die vorhandene Zeitarbeit-Kalkulation nutzt ausschließlich die Originalquellen des [DGB/GVP-Entgelttarifvertrags](https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf) und des [DGB/GVP-Entgeltrahmentarifvertrags](https://www.dgb.de/fileadmin/download_center/Uploads/2025-05-20_Entgeltrahmentarifvertrag.pdf).

## Recherche Tarifverträge (30.10.2026)

- Das [BMAS-Tarifregister](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Tarifvertraege/Tarifregister/tarifregister.html) führt einen sehr großen Bestand (über 90.000 gültige Verträge zu Jahresbeginn 2026), stellt aber keine vollständigen Verträge als offenen Gesamtdownload bereit. Die Tarifvertragsparteien sind für die konkrete Anwendung maßgeblich.
- Das [Tarifregister NRW](https://www.tarifregister.nrw.de/tarifinformationen/tarifdaten_branchen) verzeichnet eingereichte, in NRW gültige Verträge (durchschnittlich 1.800 pro Jahr) und veröffentlicht grundlegende Datenblätter für über 100 ausgewählte Branchen. Die öffentliche [Grundvergütungsdatenbank](https://www.tarifregister.nrw.de/tarifinformationen/grundverguetung_branchen) nennt Beruf, Branche, Qualifikation, Tätigkeit, Arbeitszeit, Grundvergütung und Gültigkeitszeitraum. Beide Seiten melden Stand Oktober 2026, schließen aber eine Gewähr für Richtigkeit/Aktualität aus. NRW ist eine wertvolle Startreferenz, keine bundesweit vollständige oder verbindliche Lohntabelle.
- Das [WSI-Tarifarchiv](https://www.wsi.de/de/tarifverguetungen-nach-branchen-15298.htm) deckt Tarifvergütungen für über 200 Berufe und rund 50 Branchen sowie ausgewählte regionale Tariftabellen ab. Laut WSI werden die Datenbanken laufend aktualisiert; einzelne Entgeltstände können trotzdem mehrere Jahre zurückliegen. Das WSI verschickt keine Verträge und erteilt keine Einzelauskünfte. Es ist die breiteste geprüfte bundesweite Recherchequelle, aber keine Gesamtliste sämtlicher Tarifverträge.
- Laut `robots.txt` des BMAS sind Query-String-URLs gesperrt (`Disallow: /*?*`, `Crawl-delay: 180`). Beim NRW-Register ist `/search/` gesperrt. Die gesperrten Pfade werden nicht automatisiert abgerufen. Details und geprüfte Grenzen stehen in `alarm/quellen.md`.

## Ergänzende Registerprüfung (31.10.2026)

- Das [Tarifregister Bayern](https://www.stmas.bayern.de/themen/arbeitsrecht-tarifrecht/) listet nach Angaben des Ministeriums in Bayern geltende Verträge (ohne öffentlichen Dienst). Zur Einsicht ist ein Termin nötig; das Register stellt keinen offenen Datensatz bereit und muss keine inhaltlichen Auskünfte erteilen. Die geprüfte `robots.txt`-Adresse lieferte 404.
- Das [elektronische Tarifregister Baden-Württemberg](https://tarifregister.baden-wuerttemberg.de/) hält eingereichte Verträge vor, ist jedoch passwortgeschützt. Die Seite schließt allgemeine Nutzung ausdrücklich aus und untersagt die Weitergabe an unberechtigte Dritte. Die Hilfeseite erklärt außerdem, dass Verträge nach Branche/Firma und räumlichem Geltungsbereich gesucht werden müssen. Auch hier lieferte `robots.txt` 404.
- Daher werden aus keinem der beiden Register automatisiert Daten extrahiert oder in Jarvis übernommen. Nächster zulässiger Weg: je Branche konkrete Originalverträge direkt bei Tarifparteien bzw. über eine frei veröffentlichte Originalquelle suchen und vor jeder Übernahme Rechte, Region, Laufzeit und Aktualität prüfen. Eine Anfrage an Behörden oder Tarifparteien wurde nicht versandt.

### Konsequenz für die App

Der Dropdown darf nicht so tun, als gäbe es bereits „alle Tarifverträge“. Die Auswahl verknüpft eine Einsatzkraft mit einem konkreten Vertrag ihrer Firma; die Entgeltgruppen werden ausschließlich aus diesem Vertrag angeboten. Als vorgegebener Vertrag ist nur GVP/DGB mit Originalquelle und den hinterlegten Gruppen verfügbar. Weitere Verträge erfassen Inhaber/Admins anhand des konkreten Vertrags mit Gruppenbezeichnungen und Quellenangabe. Für produktive Lohnkalkulationen müssen zusätzlich Tarifbereich, Region, Gültigkeitszeitraum und Originalquelle gespeichert und geprüft werden. WSI- und NRW-Tarifdaten sind als Recherchehinweise nützlich, dürfen ohne geklärte Nutzungsrechte und belastbaren Aktualisierungsweg aber nicht unbemerkt als vollständiger Vertragsbestand übernommen werden.
