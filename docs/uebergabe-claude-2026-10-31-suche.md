# Übergabe an Claude – Suche, 31.10.2026, ca. 17:49 UTC

Benjamin verlangt wegen des fast verbrauchten Fünf-Stunden-Kontingents jetzt den Abschluss und vollständige Dokumentation. Keine weiteren Umbauten in dieser Sitzung. Alles unten Genannte ist umgesetzt und gepusht; der letzte Hintergrundlauf ist separat noch nicht abgeschlossen.

## Sofort als Nächstes
1. Zuerst AGENTS.md, docs/stand.md und diese Übergabe lesen und den aktuellen Stand ziehen.
2. Bereits laufenden Alarm prüfen: https://github.com/Twista-hub/jarvis/actions/runs/41225815168 . Bei Übergabe `in_progress`, Schritt `python alarm/alarm.py`. **Nicht parallel neu starten.** Der Lauf speichert Treffer/Status und Bericht automatisch und meldet nur über eingeschaltete Kundenkanäle.
3. Nach Abschluss Bericht `alarm/berichte/erstlauf-efd5cfd1-2026-10-30.md` sowie Speicher-Logs und ggf. lesende `suchdiagnose.yml` prüfen. Endgültige Zahlen in docs/stand.md nachtragen. Falls Berichtsname abweicht, per `rg --files alarm/berichte` suchen. Die endgültige Trefferzahl wurde vor Übergabe nicht bestätigt.
4. Keine neue Firmenrecherche nötig. Tatsächliche Kundenfirma: `efd5cfd1-e576-4caa-a4c7-3d3c1932f23f` (Perlease), alle 16 Standorte und acht Leistungsbereiche aktiv.

## Gebaut
- `alarm/katalog.py`: kompletter offener Katalog über serverseitigen Cursor, Blöcke zu 250; kein LIMIT 10000 und kein Materialisieren des gesamten Rohbestands. Abbruch mitten im Cursor wird nicht als vollständiger Lauf gespeichert.
- `alarm/alarm.py`: Datenstrom statt großer Eingabeliste; 200er-Kandidaten- und 40er-Neubewertungsgrenzen entfernt. KI bewertet in Achterpaketen bis zur vorhandenen Kostenbremse. Bewertungen sofort im vorhandenen Cache sichern. Unbewertete Kandidaten bleiben ausstehend und werden nicht als fachlich abgelehnt archiviert. Auch bei vielen Kandidaten sämtliche bekannten Ergebnisse berücksichtigen.
- Ergebnis zählt durchsuchte Bekanntmachungen, Kandidaten, bewertete/offene Kandidaten und offene Importtage. Breites Aufräumen nur bei bestätigter vollständiger Abdeckung ohne offene Bewertungen; bearbeitete Angebote/Unterlagen bleiben geschützt.
- `alarm/speichern.py`: diese Suchzähler atomar mit den Treffern am Suchprofil speichern, bestehende Versions-/Firmenprüfung bleibt erhalten.
- `web/src/suchstatus.ts`: Zwischenstand, ausstehende Bewertungen und Importlücken sichtbar. Unbekannte Quellenabdeckung nicht als vollständig ausgeben. Bestehende automatische Statusaktualisierung bleibt.
- `web/src/katalog-plan.ts`, `katalog-worker.ts`: kleine JSON-Dateien eines Tages zu echten 40er-Blöcken bündeln; bestehende Datensätze in einer gebundenen IN-Abfrage lesen. Normale Nachholung sechs statt zwei Tage, neueste zuerst; ausdrücklicher Nachholmodus bis 60 Tage.
- Unnötige neue bereits erledigte/abgelaufene Verfahren überspringen; Änderungen bekannter Verfahren weiter berücksichtigen. Größenprüfung erst danach. Ein übergroßer benötigter Datensatz blockiert nicht mehr den Rest des Tages. Betroffener Tag bleibt unvollständig und wird ehrlich gemeldet.
- Teiländerungen desselben Verfahrens innerhalb eines Blocks sehen den zuvor normalisierten Grunddatensatz. Unvollständige Exporte auch bei gleicher Prüfsumme erneut verarbeiten; ETag nur für vollständige Tage verwenden.
- Nur abgeschlossene Kalendertage abrufen: heutiger Export lieferte HTTP 400, der alte Fehlversuch darf den morgigen Import nicht durch lange Pause blockieren. Nur dessen erfolglose operative Zukunftsmarkierung entfernen, erfolgreiche Exporte bewahren.
- `alarm/profile_db.py`: kurze GitHub-Jobs bevorzugen Transaktionspool 6543, `prepare_threshold=None`; vorhandene Transaktionen für Cursor/SET LOCAL bleiben. Sitzungspool 5432 war mit 15 Verbindungen ausgelastet.
- `web/scripts/hyperdrive.py`: bei EMAXCONNSESSION ausschließlich identische vorhandene Konfiguration wiederverwenden; Ziel, CA/SSL-Prüfung, deaktivierter Cache und Verbindungslimit prüfen. Andere Fehler weiter abbrechen. Keine Zugangsdaten protokollieren.
- `.github/workflows/katalog.yml`: Nachholung starten und deren tatsächliche Ausgabe prüfen. Manuell `wiederholen=true` erlaubt nach behobenem Verarbeitungsfehler einmalig die interne Pause zu überspringen. Normale Cronläufe beachten die Pause, Quellensperren/robots.txt bleiben wirksam.
- `.github/workflows/suchdiagnose.yml`: ausschließlich lesende Diagnose mit UUID-Prüfung, gebundenen Parametern und READ ONLY; Profil, Cache, Quellenlücken, Speicher und Wiederholzeiten. Keine KI-Aufrufe/Änderungen.

## Live nachgewiesen
- Vorher: 11.685 offene/unbekannte Bekanntmachungen, nur 10.000 geprüft; 40 Importlücken; 80 bewertete Kandidaten, vier Treffer ab 6/10.
- Nachholung erfolgreich beendet: https://github.com/Twista-hub/jarvis/actions/runs/41224936444 . 36 von 40 Importlücken geschlossen. **32.272 offene/unbekannte**, 35.930 gesamte Katalogeinträge, rund 186 MB Datenbank.
- **Vier Tagesstände weiterhin unvollständig:** 14./12.10. dasselbe Verfahren „Facility Management – Regionalzentren“ (`bks:ocds-mnwr74-aa1f1a6e-6bfd-4d28-bae0-f1e0333bd364`, ca. 166–168k Rohzeichen); 08./02.10. „Rahmenvertrag Bauunterhaltsleistungen nach STLB“ (`bks:ocds-mnwr74-426b4856-6fb2-4195-a868-3b390b9beb2a`, ca. 119k). Jeweils Status/Frist unbekannt. Rest der Tagesexporte übernommen. Die 100.000-Zeichen-Grenze wurde bewusst nicht angehoben. Kein vollständiger Marktbestand behauptet.
- Letzter Zwischenstand aus lesender Diagnose 41226085951 während des Alarms: 129 Cachebewertungen, davon **16 ab 6/10**. Das ist noch keine abschließende App-Trefferzahl. App zeigte zu diesem Zeitpunkt noch den vorherigen gespeicherten Lauf mit vier Treffern.
- Katalog-Rollout nach zusätzlicher Tagesgrenzen-Korrektur: https://github.com/Twista-hub/jarvis/actions/runs/41225310853 erfolgreich.
- App-Rollout: https://github.com/Twista-hub/jarvis/actions/runs/41225310835 erfolgreich. Öffentliche Seite/ausgeliefertes app.js zusätzlich abgerufen und JS geparst.

## Prüfungen
- Lokal: `cd web && npm ci --cache /tmp/jarvis-npm-cache && npm run check && npm test` (29 Testdateien grün; npm ci zu Beginn, danach Checks nach Änderungen erneut).
- 43 Python-Tests in alarm.test_mail, test_kurzbrief, test_katalog, test_ted, test_suchgebiet, test_suchqualitaet und `py_compile alarm/*.py` grün.
- `python3 -m unittest discover -s web/scripts -p 'test_*.py'`: zusätzlicher Hyperdrive-Test grün.
- CI https://github.com/Twista-hub/jarvis/actions/runs/41225310859 sowie 41224906283 grün: Web, Python, sämtliche Datenbankrechte, drei isolierte Python-SQL-Tests und neuer echter PostgreSQL-Test `web/test/katalog-sql.integration.ts`.
- Neue Regressionen: >10.000 Datensätze mit 250er-Cursor, >40 Bewertungen, Budgetstopp ohne falsches Archivieren, Quellen-Zwischenstände, 40er-Blöcke über Dateigrenzen, CC0, große geschlossene/weiterhin benötigte Datensätze, Teiländerungen im selben Block, UTC-Jahreswechsel, Parameterbindung ohne Typenerkennung einschließlich Sonderzeichen.
- Aufgetretene und behobene Rückschritte sind im Stand protokolliert: Array-Serialisierung der neuen Blockabfrage; erneuter Hyperdrive-Test bei ausgelastetem Sitzungspool. Nicht erneut die alten fehlgeschlagenen Ausrollungen als aktuellen Zustand behandeln.

## Grenzen und offene Arbeit
- Zwei übergroße Bekanntmachungen brauchen ein geeignetes begrenztes Speicherformat mit nachvollziehbaren Quellenbelegen. Kein pauschales Anheben von Größen-/Speichergrenzen; nichts still als vollständig markieren.
- Nach Ende des aktuellen Alarms tatsächliche Treffer, neu hinzugekommene, bewertete/ausstehende Kandidaten prüfen. Eventuell budgetbedingten Rest regulär aus dem Cache fortsetzen; keine alten ungeklärten Budgetreservierungen freigeben.
- Tagesbudget nur für 31.10. ausdrücklich auf 5 USD genehmigt, ab 01.11. automatisch 3 USD, Monat 20 USD. Python-Laufbremse unverändert. Keine weitere Budgetfreigabe. Plan zum späteren Max-Guthaben in docs/stand.md ist noch bedingt und nicht aktiviert.
- Standortfilter nutzt alle 16 Niederlassungen, aber grobe PLZ-Gebiete, keinen echten Radius. Spätere Bereichszuordnung benutzt teilweise Auftraggeber- statt Einsatz-PLZ; separat offen.
- Zertifikate: generischer Upload vorhanden, automatische Erkennung/Qualifikations-/Zulassungszuordnung weiterhin nur im Fahrplan 12a.
- Tägliche Benachrichtigungen: vorhandenen Erstbestand sofort zeigen; anschließend echte neue Funde. Anzeige in der App ist unabhängig vom letzten Nachrichtenversand. Bestehende Mail grenzt per letzte_mail ab und erinnert an Fristen; ohne Neuigkeiten keine leere Nachricht. Getrennte Kennzeichnung älterer Nachholfunde und Meldung wichtiger Änderungen sind **geplant, noch nicht implementiert**. docs/app-fahrplan.md und AGENTS.md ergänzt; keine Treffer künstlich zurückhalten.

## Git-Stand
Code-Commits dieser Arbeit: 440ef63, 8c56b00, 755030a, e82ea52, a8d7b8e, 8f72d3a, 91c7425, a394239. Alle auf main gepusht; danach kommt dieser Dokumentationsabschluss. Keine neue Datenbankmigration in dieser Suchreparatur, keine zusätzlichen Dienste/Abos. Keine parallelen Agenten eingesetzt. Benjamin muss keine Konsolen- oder GitHub-Handgriffe übernehmen.
