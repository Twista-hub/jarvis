# Gemeinsamer Vergabekatalog

Stand: 30.10.2026. Eigenständige Jarvis-Infrastruktur; keine Verbindung zu anderen Projekten.

## Verarbeitung

`jarvis-katalog` startet stündlich zur Minute 11 den Workflow `jarvis-katalog-sammeln`. Er liest ausschließlich den freigegebenen CC0-Tagesexport des Bekanntmachungsservice. Heute und gestern werden mit ETag/Inhaltshash geprüft; bis zu zwei fehlende historische Tage aus den letzten 60 Tagen werden zusätzlich aufgefüllt. Fehlgeschlagene Tage bleiben mit zeitlichem Rückoff in `jarvis_katalog.exporte`. Wiederholungen sind idempotent; ältere Meldungen überschreiben keine neueren.

Der Bestand umfasst öffentliche Titel, Beschreibungen, Auftraggeber, Orte, PLZ, CPV, Lose, Fristen, Quellversion, Änderungsverlauf und veröffentlichte Zuschläge/Vertragsenden. Lokale Organisationsnummern wie ORG-0001 sind keine globalen Auftraggeberschlüssel. Berufe/Qualifikationen/Nachweise werden regelbasiert mit Textfundstelle vorgeschlagen. Eine Bestätigung gehört zur jeweiligen Quellversion und wird nach Änderungen nicht als aktuelle Bestätigung angezeigt.

Die Bestandsanzeige behauptet keine Vollständigkeit: unbekannte Fristen sind gekennzeichnet; die Hauptfrist eines Verfahrens ist die späteste bekannte Losfrist, einzelne Lose müssen separat geprüft werden. Aufgehobene/vergebene/abgeschlossene Verfahren und bekannte abgelaufene Fristen erscheinen nicht in der offenen Suche. Ein unbekannter Einsatzort wird nicht aus der Auftraggeberadresse erfunden; diese ist ausdrücklich als Ersatzadresse markiert.

Grenzen: maximal vier Exporttage pro regulärem Lauf, 24 MB Download/entpackte Dateien pro Export, begrenzte Datensatzgröße, Sammlungspause ab 350 MB Datenbankgröße bzw. über 50.000 Datensätzen. Änderungen werden 90 Tage, Bewertungscaches 180 Tage gehalten. Die eigene Datenbank/Quellen-Seite zeigt Fehler und verbleibende Aufbautage. Sperren oder unbekannte Paketlizenzen führen zum Stopp, nie zur Umgehung.

## Nutzung

- `/konto/markt`: offene Aufträge suchen und in eigene Vorgänge übernehmen; Auftraggeber beobachten; veröffentlichte Zuschläge inklusive Herkunft und Gesamtwert ansehen.
- Marktbedarf: Berufs-/Regionalhäufigkeiten im erfassten offenen Bestand, keine behauptete Anzahl freier Stellen. Prognosen aus Vertragsende minus 90 Tagen sind als Prognosen gekennzeichnet. Wiederholungsmuster verlangen mehrere getrennte Meldungen über mindestens 180 Tage; im Startbestand kann diese Evidenz fehlen.
- Teilnahmecheck am Treffer: Los wählen, Textfundstellen prüfen/bestätigen, verfügbare passende Personen und gültige Firmennachweise abgleichen. Fehlende Daten bleiben offen. Kein automatisches Einplanen, Unterschreiben oder Abgeben.
- Partner: ausschließlich freiwillig freigegebene Leistungs-/Regional-/Kontaktprofile. Eine Suche kann aus einem erkannten Personalbedarf geöffnet werden. Keine automatische Kontaktaufnahme oder Weitergabe von Personal-/Firmenunterlagen.
- Eigene Ergebnisse: eigene Statusangaben, Ortsauswertung und freiwillige Ist-Beträge. Finanzangaben bleiben finanzberechtigten Mitgliedern vorbehalten. Öffentliche Gesamtwerte werden nicht als Stundenpreise oder eigene Umsätze übernommen.
- Rückmeldungen: Region, Tätigkeit, Größe, Frist oder passend; konkrete Hinweise zur Überprüfung des Suchprofils, keine ungefragte automatische Profiländerung.

Der tägliche Alarm nutzt den vorhandenen gemeinsamen offenen Bestand statt für jede Firma erneut Quellen abzurufen. Auftraggeber-Abos werden berücksichtigt. KI-Bewertungen sind nach Firma, Inhaltsversion, Suchprofilversion und Methode gespeichert. Je Firma höchstens 40 neue Bewertungen pro Lauf, maximal 200 automatisch gespeicherte Treffer; manuelle Bestandssuche liefert bis zu 60 Treffer pro gezielter Suche. Die KI-Eignungsbewertung bleibt firmenspezifisch; neutrale Fakten werden gemeinsam wiederverwendet.

## Kosten und Rechte

Der Sammler nutzt keine KI. Web und Alarm reservieren vor jeder offiziellen Anthropic-Anfrage konservativ deren Höchstpreis in einer gemeinsamen Transaktion: maximal 3 USD pro UTC-Tag und 20 USD pro Monat. Ist die Budgetprüfung nicht erreichbar, erfolgt keine Anfrage. Streaming-Reservierungen werden konservativ belegt; Nicht-Streaming-Abrechnungen können die Reservierung einmalig reduzieren. Der Zähler umfasst seit seiner Aktivierung erfasste Anfragen, nicht rückwirkend sämtliche Anbieterrechnungen. Bestehende Upload-/Dateigrenzen gelten weiter. Es werden keine zusätzlichen kostenpflichtigen Pläne gebucht; Infrastrukturanbieter-Rechnungen bleiben gesondert zu beobachten.

Katalogdaten sind für aktive Firmenmitglieder mit Zugriff auf vollständige Ausschreibungen lesbar, nicht anonym und nicht für eingeschränkte Mitarbeiter. Betriebsdaten bleiben durch die bestehenden Firmen-/Bereichsrechte geschützt. Private Budget-/Cache-/Importtabellen haben keine Kunden-Schreibrechte. Postgres-Zugang liegt nur als bestehendes serverseitiges Secret bei den Jarvis-Workern, nicht im Browser oder Repository.

## Bereitstellung und Prüfung

Migration: `supabase/migrations/20261030181644_vergabekatalog.sql`. Auf main-Push führt Datenbank zuerst den PostgreSQL-Rechte-Test, danach Dry-run und Migration aus. Der Katalog-Rollout wartet auf vorhandenes Schema, hinterlegt das vorhandene GitHub-Datenbanksecret und aktiviert erst dann den Cron; ein erster Workflow wird gestartet. Die Web-Ausrollung wartet ebenfalls auf das Budgetschema. Kein neues Secret muss manuell erstellt werden.

Prüfungen: `cd web && npm run check && npm test`; `python3 -m unittest alarm.test_kurzbrief alarm.test_katalog`; Rechte-Test gegen leeres Postgres 16; beide Wrangler-Konfigurationen mit `deploy --dry-run`. Live-Erfolg getrennt anhand Actions, `katalog_quellen.letzter_erfolg` und tatsächlichem Bestand bestätigen. Ein grüner Rollout allein belegt noch keinen vollständigen Erstimport.
