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
