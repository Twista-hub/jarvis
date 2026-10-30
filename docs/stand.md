# Jarvis – aktueller Stand (gemeinsames Gedächtnis von Claude und ChatGPT)

Regeln dazu stehen in `AGENTS.md` Abschnitt 1. Neueste Einträge oben.

## Aktueller Stand (30.10.2026)
- **Automationsprüfung 30.10., 18:26 Berlin (lesend):** jüngste CI-, Web- und Datenbankläufe erfolgreich; geplanter Alarm erfolgreich protokolliert. Automatische tägliche Mail separat nachweisen; Details und Prüfgrenzen im neuesten Protokolleintrag.
- **App online:** https://app.wpdigitalranger.com (seit 30.10.2026; die alte workers.dev-Adresse leitet weiter)
- **Logo in der Konto-Kopfzeile:** Kompasssymbol mit Jarvis und WP Digital Ranger. SVG-Wortmarke, helle/dunkle Vorschau sowie PNG unter `docs/design/`; Farblegende aus der Vorschau entfernt, Unterzeile „Digitale Lösungen“.
  - Startseite mit Erklärung und Beispiel-Steckbrief; Impressum, Datenschutz, Nutzungsbedingungen, AVV (Entwürfe, Benjamin prüft noch).
  - Registrierung mit Passwort, Passwort-Anmeldung/-Wiederherstellung und Mail-Link; bestätigte neue Firmen werden zunächst kostenlos angelegt. Firmen, Bereiche/Standorte, Rollen und Einladungen.
  - Ausschreibungen als Handy-Karten mit Punkten, Frist, Stand und Bereichsfilter; Treffer-Seite mit Steckbrief, Knopf „Hier runterladen“
    (zum Portal) und Upload, Jarvis schreibt daraus den ausführlichen Steckbrief (ergänzt den aus der Bekanntmachung) und die Kalkulation.
  - Einrichtungs-Assistent: Firma beschreiben → KI schlägt Suchprofil vor → speichern → Alarm sucht sofort die letzten 7 Tage.
  - Registrierung und Einrichtungs-Assistent nehmen optional die Firmenwebsite an. Jarvis liest ausschließlich die angegebene Startseite und beachtet robots.txt; bei KI-Ausfall werden Beschreibung und Standorte in einen bearbeitbaren Profilvorschlag übernommen. Scheitert der Sofortstart, bleibt das Profil gespeichert und ein direkter Wiederholungsstart wird angeboten.
  - Tägliche Nachricht pro Person: Uhrzeit 7–20 Uhr, per Mail, Handy oder beides; Fristen-Erinnerung 7 und 2 Tage vorher.
  - Handy-Nachrichten (Web-Push) und als App installierbar.
  - Profil-Icon oben rechts (/konto/profil), Firmenwechsel im Profil; Suchprofil als eigener Bereich (/konto/suchprofil). Keine E-Mail-Zeile oder Einrichtung auf der Übersicht.
  - Mitarbeiter: Name und Funktion (z. B. Abteilungsleitung, Sachbearbeitung, Serviceleitung/Facharbeiter) getrennt von Rollen, Bereichszuordnung und Finanzfreigabe; gezielte Textweitergabe mit Vorschau/Widerruf und eigener Mitarbeiteransicht.
  - Organisationsbaum Firma → Region → Standort, getrennte App-Zugänge und Einsatzpersonal, sichtbare Standortleitung mit auf einen einzelnen Standort beschränkten Rechten. Standortleitungen verwalten Personal und Einsätze, aber weder Firmenfinanzen noch globale Team-/Bereichsverwaltung.
  - Personalbestand mit branchenübergreifenden Berufsgruppen, Verfügbarkeit, Kontakt und Qualifikationen; eigene Qualifikationen pro Firma/Standort, Filter nach Beruf, Qualifikation und Status. Personen können Ausschreibungen mit Einsatzstatus zugeordnet werden.
  - Berufekatalog in `web/src/berufe.ts` um IT, Bildung/Betreuung, Fahrzeug/Verkehr sowie Gebäudetechnik/Energie erweitert. Ausschreibungsbegriffe werden über gepflegte Synonyme kanonischen Berufsbezeichnungen zugeordnet; der Originalwortlaut bleibt in der Fundstelle erhalten. Das ist ein kuratierter Startbestand, keine vollständige amtliche Berufedatenbank.
  - Tarifauswahl im Personalformular mit 11 quellgebundenen Tarifwerken/Mindestlohn-Einträgen: Zeitarbeit GVP/DGB, Elektrohandwerk, Gebäudereinigung, Bau, Groß-/Außenhandel, GaLaBau (je NRW), TVöD-VKA Allgemein/SuE/Pflege, TV-L und Maler-Gesellenmindestlohn. Auswahl zeigt Branche/Region; Gruppen hängen am gewählten Vertrag. Vertragsquelle, Berufsbezug, Prüfstand und Datenhinweise sind unter Firma & Team einsehbar. Gastgewerbe NRW ist mangels veröffentlichter aktueller Gruppen nur als Metadatum hinterlegt und nicht auswählbar.
  - Kalkulation pro Los mit Tarifentgeltgruppen, Laufzeit, Schicht- und Einsatzkosten, Gemeinkosten sowie Gewinn.
  - Firmenunterlagen und Word-/Textvorlagen; Angebotsmappe mit bearbeitbarem Entwurf, Chef-Freigabe vor Download, Ablaufprüfung, Ablauf-Erinnerungen und protokolliertem Eingangsbeleg nach manueller Portalabgabe.
  - Kompakte Info-Symbole statt sichtbarer Hilfsüberschriften; Kurzüberblicke auch für Treffer ohne ausführlichen KI-Steckbrief.
  - Mobile Formulare, größere Touchflächen und kurze einklappbare Erklärungen für Treffer, Rollen, Unterlagen, Suchprofil, Kalkulation und Personal.
  - PerLease-Filter zeigt alle 4 Regionen und 16 Standorte; live bestätigt.
  - Neue Konto-Übersicht mit Kacheln, Status-Reitern, Fristen, Unterlagen-Upload ohne Treffer, Firmen-Kalkulationswerten, Team und Einstellungen; Handy-Leiste und Zurück-Pfeil.
- **Firmen in der App:** „WP Digital Ranger“ (Benjamin) und „PerLease (Vorschau)“ mit 4 Regionen und 16 Standorten.
- **Tarifdatenbank (Code bereitgestellt):** gemeinsamer, nur lesbarer Quellenkatalog plus firmenbezogene Auswahlkopien; 11 aktuell gruppierte Einträge werden bei neuen Firmen vorbelegt. 30 GVP-Entgeltwerte über drei Stichtage und ein Maler-Mindestlohnwert sind explizit quellengebunden gespeichert. Das ist ein belegter Anfangsbestand, keine Vollständigkeit: BMAS veröffentlicht keinen vollständigen offenen Satz der rund 90.000 Verträge; mehrere Verträge enthalten nur Gruppenzahlen statt Tätigkeitsmerkmalen und Löhnen.
- **Zentraler Vergabekatalog (Code bereitgestellt):** eigener stündlicher Worker, gemeinsame offene Bekanntmachungen und neue Markt-/Teilnahmefunktionen. Aktivierung und Live-Datenstand über die Ausrollläufe prüfen; der Erstbestand wird schrittweise aufgebaut.
- **Alarm:** täglich, Quelle Bekanntmachungsservice (CC0) inkl. vollständiger eForms-Bekanntmachung, Förderdatenbank.

## In Arbeit
- (ChatGPT) Nutzerlöschung: Angebots-Eingangsbeleg muss bei gelöschtem Verfasser erhalten bleiben; referenzierende Datenbankbeziehung korrigieren und prüfen.

## Nächste Schritte (mit Benjamin am 30.10.2026 abgestimmt, in dieser Reihenfolge)
1. **Logo und Design:** Wortmarke mit Kompassmarke ist in der Kontonavigation eingebaut; HTML-/PNG-Vorschau unter `docs/design/`. Farblegende aus der Vorschau entfernt und Unterzeile auf „Digitale Lösungen“ gestellt.
2. ~~**Kalkulationsvorlagen pro Standort**~~: Auf `/konto/kalkulation` nach Firma oder Standort auswählen und Vorlagen speichern. Beim Rechnen gelten in Reihenfolge Standort → Region → Firma; eigene Angebotswerte behalten Vorrang. Keine Migration nötig, vorhandene Bereichs-/Finanzrechte bleiben maßgeblich.
3. ~~Mitarbeiter sperren/austreten lassen~~ (firmenbezogen umgesetzt).
4. ~~Kaufmännisch Verantwortlichen pro Ausschreibung zuweisen~~ (umgesetzt; Rechte und Finanzsicht bleiben rollenabhängig).
5. Tarifdatenbank ist mit einem quellengebundenen Startbestand ausgebaut. Weitere Tarifbereiche samt aktuellen Originalgruppen, Tätigkeitsmerkmalen und Entgelten schrittweise ergänzen; keine bundesweite Vollständigkeit behaupten (`docs/personalkatalog.md`, `alarm/quellen.md`).
6. Danach Quellen (Lücke Bayern/BW, SAM.gov-API-Bedingungen), dann Pläne/Stripe, Telegram-Jarvis.
- Benjamin testet noch: Anmeldung auf https://app.wpdigitalranger.com, Weiterleitung der alten Adresse, App am Handy neu installieren und Benachrichtigungen neu einschalten.

## Offene Punkte (Reihenfolge = Vorschlag)
- **Erster Suchlauf nach Registrierung:** `ACTIONS_TOKEN` wird beim App-Rollout erkannt und gesetzt. Die tatsächliche GitHub-Berechtigung (`actions:write`) und ein Live-Sofortlauf mit einem neu angemeldeten Nutzer sind noch nicht geprüft. Scheitert der Sofortstart, bleibt das Profil gespeichert und kann erneut gestartet werden. Keine öffentliche Firmendatenbank für Namensvorschläge eingebunden: beim Signup wird deshalb die Firmenwebsite optional abgefragt, statt private Kundenbestände oder unzuverlässige Trefferlisten offenzulegen.
- **USA:** Secret `SAM_API_KEY` ist seit 30.10.2026 gesetzt, Testlauf erfolgreich (637 Bundesausschreibungen am 29.10.). Offen: API-Bedingungen auf open.gsa.gov vollständig lesen, bevor USA beworben wird; Schlüssel läuft nach ca. 90 Tagen ab (Ende Januar 2027 erneuern). Mehr als 1.000 pro Tag würden abgeschnitten (bisher nicht nötig).
- **Automatische tägliche Mail:** Geplanter Lauf am 30.10. 18:31 UTC erfolgreich (Claude). Tatsächliche Zustellung beim Empfänger noch von Benjamin bestätigen lassen.
0. Ganz zum Schluss, wenn die App fertig ist: Pläne festlegen und Plan-Seite einschalten (Free/Basis/Pro/Erfolg in `web/src/plaene.ts`): Preise und was jeder Plan darf; danach Zahlung per Stripe und Sperren nach Plan. Bis dahin läuft der tägliche KI-Alarm für jede Firma mit Suchprofil, also auch für kostenlose (API-Kosten im Blick behalten).
1. Rechtstexte von Benjamin prüfen lassen.
2. Personal pro Ausschreibung mit geplant/angefragt/zugesagt und kaufmännische Zuständigkeit sind umgesetzt. Berufekatalog samt Ausschreibungssynonymen ist erweitert. Die bundesweite Tarifdatenbank bleibt offen: geprüfte Quellen decken nur ausgewählte Branchen/Berufe ab; Vollständigkeit, Nutzungsrechte und Aktualisierung für eine automatische Übernahme sind ungeklärt (docs/personalkatalog.md, alarm/quellen.md).
3. ~~Mitarbeiterzugänge sperren/austreten lassen~~ (firmenbezogen umgesetzt).
4. ~~Logo und Grundgestaltung in der Konto-Kopfzeile~~ (umgesetzt); übrige Seitensymbole/Farben können später vereinheitlicht werden.
5. Später: Stripe-Abrechnung; Benachrichtigung der Firmenleitung bei wartenden Angeboten und Portal-Schnittstellen erst nach Prüfung/Freigabe.
6. ~~Anthropic-Ausgabenlimit 20 $~~ (von Benjamin gesetzt).

## Protokoll

### 30.10.2026 – ChatGPT (Kontolöschung in Supabase)
- Supabase meldete beim Löschen eines Nutzers „Database error deleting user“. Im Jarvis-Schema war `angebotsabgaben.abgegeben_von` verpflichtend und ohne Löschregel an `auth.users` gebunden. Ein vorhandener Eingangsbeleg kann dadurch das Löschen blockieren.
- Neue Migration macht die Verfasserreferenz optional und setzt sie beim Löschen auf `NULL`; Angebotsbeleg und übrige Firmendaten bleiben erhalten. Rechte-Test ergänzt, der Löschung bei erhaltenem Beleg prüft.
- Offen: Datenbanktest und Migration laufen nach Push. Danach Löschversuch im Dashboard wiederholen. Falls der Fehler bleibt, kommt der Blocker aus einer anderen Live-Referenz (z. B. Supabase-Storage); dieser Zugriff kann die tatsächlichen Produktionsdaten hier nicht abfragen. Der Screenshot belegt den allgemeinen Fehler, aber nicht die konkrete betroffene Zeile.
- Benjamin muss jetzt nichts tun; nach erfolgreichem Datenbanklauf den Delete-Knopf im Supabase-Dialog erneut versuchen.

### 30.10.2026 – ChatGPT (Firmenwebsite und erster Suchlauf)
- Registrierung speichert optional die Firmenwebsite in den Anmeldedaten und übernimmt sie beim bestätigten Konto in `firmen.website`. Im Suchprofil kann der Inhaber sie später ändern.
- Jarvis liest bei Angabe nur die Startseite der genannten Domain, prüft zuerst `robots.txt`, folgt keinen Weiterleitungen und begrenzt Zeit und Datenmenge. Die Website ergänzt die selbst eingegebene Beschreibung; die Inhaberin oder der Inhaber prüft den Vorschlag weiterhin.
- Wenn der KI-Vorschlag nicht erreichbar ist, öffnet sich ein einfacher Vorschlag aus den eingegebenen Leistungen und Orten. Wenn der GitHub-Sofortstart fehlschlägt, wird das Profil nicht als „gestartet“ ausgegeben: es bleibt gespeichert und kann per Knopf erneut gestartet werden.
- `cd web && npm run check && npm test`: grün, 20 Testdateien. Datenbank-Rechte-/Migrationstest und Datenbankausrollung grün; Web-Rollout grün. Live-Registrierungsseite unter `https://app.wpdigitalranger.com/registrieren` zeigt das neue Website-Feld.
- Offen: Das beim Rollout vorhandene `ACTIONS_TOKEN` konnte nicht inhaltlich gelesen werden; ob es tatsächlich `actions:write` hat und ob eine Live-Erstanmeldung sofort einen Alarm startet, wurde nicht geprüft. Ein öffentliches, vollständiges Firmenverzeichnis für sichere Namensvorschläge wurde nicht gefunden/eingebunden. Benjamin muss nichts manuell migrieren.

### 30.10.2026 – ChatGPT (quellengebundener Tarifkatalog)
- Migration `20261031070000_tarifkatalog_branchen.sql`: gemeinsamer lesbarer Tarifkatalog mit Branche/Region, Gruppe, Berufsbezug, Quelle, Laufzeit, Prüfstand und Datenhinweis; Firmen erhalten RLS-geschützte Auswahlkopien, auch neu angelegte Firmen. In Mitarbeiterformular und Tarifverwaltung werden Verträge samt Branche, Gruppenart und Herkunft sichtbar.
- 11 gruppierte Einträge für Zeitarbeit GVP/DGB, Elektro, Gebäudereinigung, Bau, Groß-/Außenhandel, GaLaBau (je NRW), TVöD-VKA Allgemein/SuE/Pflege, TV-L sowie Maler-Gesellenmindestlohn; 30 GVP-Entgelte über drei Stichtage und der veröffentlichte Maler-Mindestlohn als gesonderte Werte. Gastgewerbe NRW 2026 ist nur als Metadatum gespeichert, weil die neue Gruppentabelle öffentlich nicht belegt war.
- Die NRW-Registerblätter nennen teils nur Gruppenanzahl; die Einträge weisen deshalb ausdrücklich darauf hin, dass Tätigkeitsmerkmale und genaue Entgelte im Original zu prüfen sind. Das BMAS führt über 90.000 gültige Verträge und bietet keinen offenen Komplettdatensatz. Keine Vollständigkeit behauptet.
- Tests ergänzt für Firmenvorbelegung, Quellen-/Berufsbezug, Tarifwerte und Schreibschutz. `cd web && npm run check && npm test`: grün (19 Testdateien). Lokales SQL-Testen ist in dieser Umgebung mangels Zugriff auf den Docker-Dienst nicht möglich; der GitHub-Datenbankworkflow prüft die Migration nach dem Push gegen PostgreSQL 16 und spielt sie gemäß Projektregel nach erfolgreicher Rechteprüfung ein.
- Der PostgreSQL-Workflow prüfte die Migration, die 38 GaLaBau-Lohn-/Gehaltsgruppen, 10 Tarifwerke plus den separaten Mindestlohn, Quellen/Entgeltwerte und Leseschutz; danach wurde die Migration auf Supabase eingespielt. Letzter erfolgreicher Datenbanklauf: https://github.com/Twista-hub/jarvis/actions/runs/41143648397. Web-/Alarm-/DB-Prüfungen: https://github.com/Twista-hub/jarvis/actions/runs/41143818882. Worker-Ausrollung und öffentlicher Seitentest: https://github.com/Twista-hub/jarvis/actions/runs/41143818938. Benjamin muss nichts einrichten oder hochladen.
- Offen: weitere Branchen/Regionen aus aktuellen Originalverträgen ergänzen, besonders Bayern/Baden-Württemberg und derzeit fehlende Tarifwerke; Nutzungsrechte und Aktualisierung je Quelle weiter prüfen. Eine vollständige bundesweite Tarifdatenbank ist mit den frei verfügbaren geprüften Quellen nicht erreichbar.

### 30.10.2026 – ChatGPT (Tarifauswahl im Mitarbeiterformular)
- Ursache bestätigt: Die Auswahlliste lädt firmeneigene Datensätze korrekt; pro Firma wird als Standard nur „Zeitarbeit GVP/DGB“ angelegt. Meine vorherige Änderung erweiterte ausschließlich Berufe/Synonyme und importierte keine weiteren Tarifverträge.
- Mitarbeiterformular zeigt nun ausdrücklich, wenn nur GVP/DGB hinterlegt ist, und verlinkt direkt zu „Tarifverträge & Entgeltgruppen verwalten“ unter Firma & Team. Der Direktlink öffnet den Abschnitt automatisch. Dort lassen sich weitere Originalverträge mit ihren Gruppen, Region, Laufzeit und Quelle ergänzen.
- Keine Tarifgruppen oder Löhne erfunden oder pauschal importiert. Typprüfung und alle 19 Web-Testdateien grün. Offen bleibt, weitere Verträge jeweils anhand konkreter, verlässlicher Originalquellen zu erfassen.

### 30.10.2026 – ChatGPT (Berufekatalog und Ausschreibungssynonyme)
- Berufekatalog (`web/src/berufe.ts`) um Tätigkeiten in IT/Kommunikation, Bildung/Betreuung, Fahrzeug/Verkehr sowie Gebäudetechnik/Energie erweitert; Agrar/Tierpflege um Landwirt, Tierpfleger und Forstwirt ergänzt.
- `web/src/katalog-daten.ts` ordnet zusätzliche Ausschreibungsbegriffe (z. B. Schreiner, Fachinformatiker Systemintegration, PV-Monteur) kanonischen Berufen zu. Der extrahierte Bedarf behält Originalfundstelle und Losbezug. Regressionstest ergänzt.
- `cd web && npm run check && npm test`: Typprüfung und alle 19 Testdateien erfolgreich.
- Keine Datenbank- oder Tarifmigration: die vorbefüllten Entgeltgruppen bleiben an die vorhandenen Originalverträge gebunden. Offen sind belegte weitere Berufsbezeichnungen samt Herkunft sowie vollständige, rechtmäßig nutzbare Tarifquellen und deren Aktualisierung; die App behauptet keine bundesweite Vollständigkeit. Benjamin muss hierfür nichts hochladen oder einrichten.

### 30.10.2026 – ChatGPT (Logo- und Designvorschlag)
- Main aktualisiert und Claudes neue Domain, Auslandsquellen und Einsatzplanung gelesen. Jüngste Web-/Prüfläufe sowie Datenbank- und Katalog-Ausrollläufe auf GitHub erfolgreich; kein erneuter Rollout ausgelöst.
- Eigenständiger Entwurf unter `docs/design/`: Kompasssymbol und Wort-Bildmarke als bearbeitbare SVG-Dateien, HTML-Vorschau und PNG-Gesamtansicht. Petrol/Türkis, einheitliche SVG-Linien-Symbole, Profil oben rechts und heller/dunkler Handyentwurf. WP Digital Ranger bleibt Unternehmensmarke, Jarvis Produktname.
- Vorschau verwendet nur fiktive Beispiele, Systemschrift und lokale Dateien; keine Kunden- oder Zugangsdaten. Chromium-Prüfung bei 320/390/768/1160 px ohne horizontalen Überlauf, alle Bilder geladen. Keine App-Funktionen oder Datenbankänderung; deshalb keine erneute Web-/SQL-Testausführung.
- Offen: Benjamin sieht den Entwurf gemäß vereinbartem nächsten Schritt vor der Integration. Nach Rückmeldung tatsächlichen Seitenrahmen/Kacheln/App-Symbole umsetzen und prüfen; Kalkulationsvorlagen je Standort bleiben danach der nächste Funktionsschritt. Benjamin muss nichts installieren oder hochladen.

### 30.10.2026 (Nacht, Teil 4) – Claude (eigene Adresse)
- App unter https://app.wpdigitalranger.com (Cloudflare Custom Domain in `web/wrangler.toml`). Alte Adresse `jarvis-alarm.benschiffer79.workers.dev` leitet mit 301/308 weiter (`ADRESSE` in `web/src/index.ts`). Links in Mails (`alarm/mail.py`), Berichten (`alarm/alarm.py`) und Seitentest (`web.yml`) umgestellt. Supabase „Site URL“ und „Redirect URLs“ hat Benjamin eingetragen. Handy-Benachrichtigungen müssen auf der neuen Adresse neu eingeschaltet werden.

### 30.10.2026 (Nacht, Teil 3) – Claude (Großbritannien und USA)
- `alarm/uk.py`: Find a Tender (OCDS, Open Government Licence v3, Quellenhinweis im Kurzüberblick); Contracts Finder noch nicht (Nutzungsbedingungen nicht gefunden).
- `alarm/usa.py`: SAM.gov Get Opportunities API v2 (Bundesbehörden, Ausschreibungsarten o,k), nur mit Secret `SAM_API_KEY`; ohne Schlüssel wird USA übersprungen. Anleitung für Benjamin: `docs/anleitung-sam-gov.md`. Nutzungsbedingungen von SAM.gov/api.data.gov noch prüfen, bevor USA für Kunden beworben wird.
- Länderauswahl: Großbritannien unter „Weitere Länder in Europa“, USA unter „Außerhalb Europas“. `alarm.yml` reicht `SAM_API_KEY` durch; Testworkflow `ted.yml` prüft TED, Großbritannien und (mit Schlüssel) USA.

### 30.10.2026 (Nacht, Teil 2) – Claude (Ausschreibungen aus anderen Ländern)
- Neu `alarm/ted.py`: TED-Such-API v3 (ohne Schlüssel, Weiterverwendung erlaubt) für Auftragsbekanntmachungen (cn-standard, cn-social, cn-desg, subco) eines Tages in den gewählten Ländern; wandelt sie in das gleiche Format wie die deutsche Quelle (ocid `ted-<nummer>`, Frist als Tagesende, Land in `_land`). Ausfall von TED stoppt den deutschen Alarm nicht.
- Suchprofil: Abschnitt „Länder“ (Deutschland Standard, Nachbarländer, weitere Länder in Europa) → `einstellungen.laender` (ISO3). `profile_db.py` liefert `laender`; `alarm.py` holt TED nur für gewählte Auslandsländer und bewertet Auslandstreffer nur für Firmen mit diesem Land. Kurzüberblick nennt Land und Quelle TED.
- Testlauf-Workflow `ted.yml` (Tag + Länder). Tests: `alarm/test_ted.py`, Länder-Test im Web.
- Später möglich: Großbritannien (Find a Tender), USA (SAM.gov, Schlüssel nötig, Benjamin beantragt selbst), Kalkulation mit Löhnen anderer Länder.

### 30.10.2026 (Nacht) – Claude (neue Ausschreibungsquellen geprüft)
- Abdeckung gemessen: Der Bekanntmachungsservice enthält schon fast alle Landes-/Kommunalplattformen (14 Tage, 7.038 Ausschreibungen). Neue Kandidaten in `alarm/quellen.md` (Abschnitt „Neue Kandidaten“). Erlaubt und sinnvoll: TED-API für Nachbarländer/EU-Institutionen. Offen: auftraege.bayern.de (Legalinfo lesen, Bayern/BW wirken unterrepräsentiert), NRW-Open-Data-ZIP (Kennung nötig, Anfrage nur mit Benjamins OK). Nicht: HAD-Suche (robots), Metropole Ruhr (blockt Skripte).

### 30.10.2026 (spät) – Claude (Rundnachricht und Einsatzplan, Übernahme nach ChatGPT)
- Stand von ChatGPT geprüft: alle Läufe bis 2227233 (Vergabekatalog) grün, nichts hängt mehr in der Warteschlange. Geplanter Maillauf „Tägliche Mail“ am 30.10. 18:31 UTC per Zeitplan erfolgreich (erster Beleg für den automatischen Lauf; Zustellung selbst nicht geprüft).
- Neu `web/src/einsatzplan.ts`: `/konto/rundnachricht` (mehrere Personen anschreiben: Filter Standort/Beruf/Status, Ausschreibung wählen, Text änderbar; „In WhatsApp-Gruppe teilen“, „Eine SMS an alle“, „Text kopieren“, persönlich je Person WhatsApp/SMS/Mail; „alle als angefragt eintragen“) und `/konto/vorgang/<id>/einsatzplan` (Ort, Beginn/Ende, Treffpunkt, Kleidung, Ansprechpartner, Hinweise; Versand an Zugesagte oder alle Eingeplanten, Teamliste optional). Jarvis verschickt selbst nichts.
- Migration `20261031060000_einsatzplaene.sql`: Tabelle `einsatzplaene`; Einsätze-Policy um `standortleitung` erweitert (Standortleitungen sollten laut Stand Einsätze verwalten, die Policy ließ das bisher nicht zu). Rechtetest „ALLE TESTS OK“, 93 Web-Tests grün.

### 30.10.2026 – ChatGPT (zentraler Vergabekatalog und Markt-Funktionen)
- Eigenständiger Cloudflare-Worker `jarvis-katalog` mit stündlichem Cron und langlebigem Workflow: CC0-Bekanntmachungsservice, ETag/Inhaltshash, persistente Export-/Wiederholungswarteschlange, geordnete Aktualisierungen, Änderungen, Aufhebungen, Zuschläge und Lose. Startbestand schrittweise 60 Tage rückwirkend; höchstens zwei zusätzliche historische Tage je Lauf. Kein Abruf gesperrter Portale. Datenstand, Fehler und verbleibende Aufbautage sind sichtbar.
- Neue Markt-Seite `/konto/markt`: offene Bestandssuche (Fristen unbekannt gekennzeichnet), Auftraggeber beobachten, veröffentlichte Zuschläge/Gewinner/Gesamtwerte, Berufs-/Regionalbedarf, gekennzeichnete Prognosen aus Vertragsenden und Wiederholungsmuster bei ausreichender Historie. Auftraggeber-Beobachtungen fließen in den täglichen Alarm ein. Übernahme in eigene Ausschreibungen idempotent.
- Teilnahmeprüfung am Treffer je Los: Berufs-/Qualifikations-/Nachweisvorschläge mit Originalfundstelle, Bestätigung an die Quellversion gebunden, sichtbarer Personalbestand und gültige Nachweise unter bestehenden Finanzrechten. Partner-Suche bei Kapazitätslücken. Keine automatische Zusage oder Angebotseinreichung.
- Firmen können ausdrücklich ein Partnerprofil freigeben oder zurückziehen; keine automatische Veröffentlichung ihrer Stammdaten/Kontakte. Rückmeldegründe liefern Vorschläge zur Profilverbesserung. Eigene Ergebnisse nach Status/Ort und freiwillige wirtschaftliche Ist-Angaben bleiben firmengeschützt und finanzberechtigt.
- Tagesalarm liest den gemeinsamen offenen Bestand; Bewertungen sind nach Firma, Inhaltsversion, Suchprofilversion und Methode gecacht. Neue/neugeänderte Profile werden innerhalb der Limits neu bewertet. Nichtmitglieder/Mitarbeiter erhalten keine Katalogrechte. Firmenfeedback, Personal, Unterlagen und Ergebnisse werden nicht als gemeinsame Daten verwendet.
- Gemeinsames atomisches KI-Budgetledger: maximal 3 USD/UTC-Tag und 20 USD/Monat für neu erfasste offizielle API-Anfragen aus Alarm und Web. Vorabrereservierung vor jedem API-Aufruf; bei fehlender Budgetprüfung keine API-Anfrage. Streaming wird konservativ mit dem Höchstbetrag belegt. Sammler selbst verwendet keine KI. Grenzen für Datenmenge und Speicher; kein neuer kostenpflichtiger Plan gebucht. Anbieterrechnungen und bereits vor Ledger-Aktivierung angefallene Kosten sind davon nicht vollständig erfasst.
- Datenbankworkflow führt auf main-Push zuerst lokale Rechteprüfung, dann Probelauf und Migration aus; neue Worker-Ausrollung folgt nach bereitstehendem Schema. Bestehendes Jarvis-GitHub-Secret wird serverseitig verwendet, keine neuen Zugangsdaten nötig. Keine Konten/Schlüssel/Daten von RestockHero oder DemoPin verwendet. Die verfügbare Supabase-Verbindung listet Jarvis nicht; deshalb kein Zugriff auf fremde Projekte, Ausrollung über die vorhandenen Jarvis-Workflows.
- Prüfung: Typprüfung/Web-Suite, Python-Kurzbrief-/Katalogtests und Syntax; lokale PostgreSQL-16-Gesamtprüfung inklusive Quelländerungen, veralteter Exporte, Firmentrennung, Partner-Opt-in und Budgetledger mit „ALLE TESTS OK“. Beide Cloudflare-Worker erfolgreich trocken gebaut. Live-Bestandsaufbau erst nach erfolgreicher Migration/Worker-Ausrollung; noch keinen vollständigen offenen Gesamtmarkt behaupten. Konzept/Betrieb: docs/vergabekatalog.md.

### 30.10.2026 – ChatGPT (Standortleitung direkt zuordnen)
- Ursache der weiterhin nicht bedienbaren Standortleitung: Die vorherige Änderung erweiterte das Rechteformular unter App-Zugänge; die Zeile am Standort blieb statischer Text. Standortseiten und Ein-Standort-Ansicht unter Firma & Team haben jetzt direkt ein aufklappbares „Zuordnen“ mit Personenauswahl, Speichern und Link zur Einladung neuer App-Nutzer.
- Nur Inhaber/Administration dürfen zuordnen. Inhaber-/Admin-Konten werden dabei nicht umgestuft; Standortleitungen anderer Standorte werden nicht still verschoben. Zuordnung nutzt die vorhandene atomare Rechtefunktion, genau einen Standort und keine Finanzfreigabe. Keine neue Datenbankmigration erforderlich. Mehrere Leitungen werden sichtbar als solche aufgeführt; neue Personen ergänzen die Zuordnung.
- Person hinzufügen ohne vorderen Pfeil und ohne vorangestelltes Plus; nur ein Plus hinter dem Text. Qualifikationsauswahl ohne „Mehrfachauswahl mit Häkchen“, mit Öffnungspfeil rechts hinter dem Text. Standortleitungen können das Standortpersonal auch über die Web-Routen bearbeiten (Datenbankrechte gelten weiter).
- Typprüfung und alle 17 Web-Testdateien grün; neue Tests für erlaubte Zuordnung, verweigerte Bearbeiter-Zuordnung und Schutz von Inhaberkonten. Vorherige Rollouts waren zuletzt wegen der GitHub-Actions-Störung verzögert; Live-Stand nach neuem Push prüfen. Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT (Platzierung der Info-Symbole)
- Alle zentral erzeugten Kontexthilfen werden jetzt im Seitenrahmen gesammelt: maximal ein Info-Symbol neben der Seitenüberschrift statt separater Zeilen für Personal, Team, Ausschreibungen, Kalkulation, Suchprofil, Einrichtung und Nachrichten. Nur Hinweise, die im berechtigten Seiteninhalt enthalten sind, werden übernommen.
- Erklärung öffnet sich als Feld unterhalb der Überschrift über dem Inhalt; weder geschlossener Knopf noch geöffnetes Feld schieben die übrige Seite nach unten. 44-px-Tippfläche, Tastaturbedienung und barrierefreie Beschriftung bleiben erhalten.
- Typprüfung und alle 17 Web-Testdateien grün. Lokale Chromium-Layoutprüfung bei 320/390/768/1280 px: kein horizontaler Überlauf, keine Verschiebung beim Öffnen, Info-Feld innerhalb der Bildschirmbreite. Dauerhafte Gestaltungsregel in AGENTS.md ergänzt.
- Bereitstellung per main-Push; GitHub Actions war zuletzt wegen bestätigter Dienststörung verzögert. Live-Ausrollung gesondert prüfen; vorherige Tarifmigration weiterhin offen, solange kein erfolgreicher Lauf bestätigt ist. Benjamin muss für diese Änderung nichts tun.

### 30.10.2026 – ChatGPT (fehlende Steckbriefe und kompakte Hilfen)
- Ursache des fehlenden Texts für „Beschaffung und Haushalt“: der Alarm erstellt höchstens zwei neue ausführliche KI-Steckbriefe pro Lauf. Weitere Treffer hatten bisher keinen Text. Jeder neue Treffer erhält jetzt mindestens einen Kurzüberblick aus den Bekanntmachungsdaten, ohne zusätzliche KI-Kosten. Vorhandene ausführliche Texte werden nicht durch Kurztexte überschrieben. Bereits vorhandene Steckbriefdateien verbrauchen das Limit für neue KI-Steckbriefe nicht mehr.
- Historische Morgenbericht-Zusammenfassungen für 13 Treffer als Ersatzanzeige eingebunden, exakt an Firma und Portallink gebunden. Damit ist auch der betroffene ITZBund-Treffer abgedeckt. Archivierte Zusammenfassung ist als solche gekennzeichnet; sie ersetzt keine Prüfung der Vergabeunterlagen. Upload und vorhandene ausführliche Steckbriefe behalten Vorrang.
- „Treffer verstehen“ entfernt. Alle zentralen Kontexthilfen zeigen geschlossen nur noch ein kleines Info-Symbol mit 44-px-Tippfläche und barrierefreier Beschriftung. Text erscheint erst beim Öffnen. Dauerhafte Gestaltungsregel in AGENTS.md ergänzt.
- Typprüfung und alle 17 Web-Testdateien grün; zwei Python-Regressionstests für Kurzüberblicke sowie Python-Syntaxprüfung grün. Tests decken den konkreten Archivtreffer, Vorrang vorhandener Texte und Trennung zwischen Firmen ab.
- Auf main gepusht (de48cc2). GitHub-Prüfung https://github.com/Twista-hub/jarvis/actions/runs/41102105351 und Ausrollung https://github.com/Twista-hub/jarvis/actions/runs/41102105515 stehen noch auf queued; live deshalb noch nicht bestätigt. Die vorherige Tarifmigration und deren Probelauf bleiben bis zu einem erfolgreichen Workflow-Ergebnis offen. Benjamin muss für diese Änderungen nichts einrichten.

### 30.10.2026 – ChatGPT (lesende Automationsprüfung, 18:26 Berlin)
- Auf Benjamins Wunsch aktuellen Automationsstand geprüft. AGENTS.md, gemeinsames Gedächtnis und App-Fahrplan gelesen; keine Code-, Datenbank-, Secret- oder Zeitplanänderung.
- CI/Web/DB-Läufe bis 18:10 Berlin erfolgreich. Geplanter Alarm [41048127589](https://github.com/Twista-hub/jarvis/actions/runs/41048127589) sowie späterer manueller Alarm [41085983339](https://github.com/Twista-hub/jarvis/actions/runs/41085983339) erfolgreich protokolliert.
- Fünf erfolgreiche manuelle „Tägliche Mail“-Läufe in den jüngsten 100 Actions-Läufen, zuletzt [41061677087](https://github.com/Twista-hub/jarvis/actions/runs/41061677087). Kein geplanter Maillauf in dieser Auswahl und der ergänzenden Schedule-Abfrage: automatische Ausführung/Zustellung bleibt zu bestätigen, kein Ausfall allein aus dieser Auswahl bewiesen.
- `mail.yml` enthält Stundencron `3 4-19 * * *` plus lokale Zeitprüfung im Code. `alarm.yml` hat 05:17 UTC und 07:41 UTC als Sicherung. Teilweise `continue-on-error`: gesamter grüner Lauf allein beweist nicht jeden Versand-/Datenschritt.
- Kein Workflow oder Testversand ausgelöst, keine Kunden kontaktiert, keine externen Veröffentlichungen und keine Ausgaben. Projektzugänge und Daten getrennt gehalten. Benjamin muss für diese Dokumentation nichts tun; Claude sollte den nächsten automatischen Maillauf samt Versandnachweis prüfen.

### 30.10.2026 – ChatGPT (Tarifrecherche und Personal-Auswahl)
- Tarifquellen zuerst geprüft: BMAS-Tarifregister (sehr großer Bestand, keine offene Gesamtdatenbank), WSI-Tarifarchiv (über 200 Berufe/rund 50 Branchen, regionale Tabellen ausgewählter Branchen) und Tarifregister NRW (über 100 ausgewählte Branchen). robots.txt beachtet; keine gesperrten Such- oder Query-Pfade automatisiert abgerufen. Nutzungs- und Aktualitätsgrenzen dokumentiert in `alarm/quellen.md` und `docs/personalkatalog.md`.
- Recherche zeigt: kein vollständiger, frei nutzbarer und verlässlich aktueller Bundesdatensatz mit sämtlichen Verträgen/Entgeltgruppen. Jarvis behauptet daher keine Vollständigkeit. Das vorhandene GVP/DGB-Tarifwerk bleibt der einzige vorbefüllte Vertrag; Admins können weitere Originalverträge mit Geltungsbereich, Gruppen, Laufzeit und Quellenangabe hinterlegen.
- Personalerfassung: Tarifvertrag zuerst auswählen, Entgeltgruppen sind abhängig davon auswählbar und werden serverseitig sowie in der Datenbank gegen den Vertrag geprüft. Qualifikationen können über eine Mehrfachauswahl mit Checkboxen gesetzt werden.
- Standortleitungs-Zuweisung verbessert: Beim Wählen der Rolle erscheint direkt die Auswahl genau eines zulässigen Standorts; Regionen werden nicht als Leitungssitz angeboten.
- Web-Typprüfung und sämtliche Web-Tests grün; PostgreSQL-Rechte-Test konnte lokal nicht ausgeführt werden, da `psql` in der Umgebung fehlt. Migration muss vor dem Ausrollen per Datenbank-Workflow geprüft und eingespielt werden.
- Offen: geprüfte Tarifdatenbank um weitere Verträge erweitern, sobald Nutzungsrechte und ein aktueller verlässlicher Datenweg feststehen. Separater Verantwortlicher für kaufmännische Bearbeitung bleibt ebenfalls offen. Benjamin muss nichts ausführen.

### 30.10.2026 – ChatGPT (Organisationsbaum und branchenübergreifendes Personal)
- Firma & Team klar getrennt: Organisationsbaum für Firma/Region/Standort; App-Zugänge separat vom Einsatzpersonal. Zuordnung und Name der Standortleitung sind direkt an Standortkacheln und Standortseiten sichtbar.
- Neue Rolle Standortleitung mit genau einem zugeordneten Standort (keine Region/firmenweiten Einträge), Personal- und Einsatzpflege im eigenen Bereich. SQL-Zeilenrechte sperren fremde und firmenweite Daten; Kalkulation/Finanzen bleiben auch bei angeforderter Freigabe gesperrt. Keine Rechte zur App-Team- oder Standortverwaltung.
- Berufsgruppen über Zeitarbeit hinaus für Büro, Bau/Ausbau, Technik/Metall, Lager/Logistik, Gastronomie, Reinigung, Pflege, Verkauf, Sicherheit/Veranstaltung und Garten/Agrar erweitert. Funktionen für App-Nutzer um Disposition, Objekt-/Projektleitung, Schichtleitung, Personal, Lohn, Qualität und Fachberufe ergänzt.
- Grundqualifikationen erweitert; Firmen können zusätzliche Qualifikationen anlegen und am Standort auswählen. Filter nach Beruf, Qualifikation und Verfügbarkeit/Status ergänzt.
- Konzept für einen zukünftigen kanonischen Berufekatalog und bestätigte Zuordnung von Ausschreibungsanforderungen dokumentiert. BERUFENET als branchenübergreifende Berufsfeldreferenz geprüft. Tarifdaten bleiben vertrags-, branchen- und zeitgebunden; die vorhandenen DGB/GVP-Tarifwerte werden nicht pauschal auf andere Gewerke übertragen.
- Typprüfung, sämtliche Web-Tests (16 Testdateien) und PostgreSQL-Rechte-Test („ALLE TESTS OK“) inklusive Standortleitungs-RLS grün.
- Auf `main` gepusht. CI grün: https://github.com/Twista-hub/jarvis/actions/runs/41096223711. Web-Rollout grün: https://github.com/Twista-hub/jarvis/actions/runs/41096223672. Datenbank-Migration erst im Probelauf geprüft und dann eingespielt: https://github.com/Twista-hub/jarvis/actions/runs/41096289355 und https://github.com/Twista-hub/jarvis/actions/runs/41096398846.
- Offen: zentrale Berufs-/Synonymdatenbank mit Ausschreibungszuordnungen; Qualifikationsnachweise mit Ablaufdatum/Erinnerungen; branchenspezifische Tarifregeln nur aus den jeweiligen Originalverträgen. Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT (Handy-Bedienung und Hilfen)
- Touchflächen für Formulare, Berufsauswahl-Chips und Personalaktionen auf mindestens 44 px gebracht; sehr schmale Ansichten mit angepassten Seitenrändern, Fokusrahmen für Tastatur und bestehender fixer Handy-Leiste.
- Einklappbare Kurz-Erklärungen zu Trefferstatus, Upload und Dateiaufbewahrung, Firmenrollen, Suchprofil, Kalkulation, Personaldaten und Einsatzstatus ergänzt.
- Typprüfung und alle 70 Web-Tests grün. Chromium ohne horizontalen Überlauf bei 320, 360, 390, 768 und 1280 px; Live-Seiten erreichbar.
- Auf `main` und online ausgerollt; Web-, Alarm- und Datenbanktests grün: https://github.com/Twista-hub/jarvis/actions/runs/41093529414. Rollout und Seitenerreichbarkeit grün: https://github.com/Twista-hub/jarvis/actions/runs/41093529364.
- Offen: Logo/Markenbild, Hilfen auf übrigen Seiten und separates Feld für die kaufmännisch verantwortliche Person. Benjamin muss nichts einrichten.

### 30.10.2026 (abends, Teil 8) – Claude
- Nur ein Standort: Personal steht direkt unter „Firma & Team“ (keine zweite Seite).
- Einsätze: Tabelle `einsaetze` (Migration `20261031030000_einsaetze.sql`, Status geplant/angefragt/zugesagt/abgesagt). Ausschreibungsseite: Abschnitt „👷 Personal für diesen Auftrag“ (Status-Dropdown, 📞, 💬 Nachricht, ✕ austragen, „Person einplanen“-Dropdown, ⭐ passender Beruf und Verfügbare zuerst). Personenkarte zeigt ihre Einsätze. Nachrichtenseite: „📨 als angefragt eintragen“.

### 30.10.2026 (abends, Teil 7) – Claude
- Firma & Team: Standorte als Kacheln (Regionen als Überschrift, Zahlen „verfügbar · gesamt“). Tippen → `/konto/standort/<id>` mit dem Personal als Karten (Initialen, Status 🟢/🔵/⚪, Berufe als Marken, EG, Qualifikationen, 📞 Anrufen, 💬 Nachricht, ✏️ Bearbeiten, 🗑️ Löschen), „➕ Person hinzufügen“, Filter nach Beruf und Status. Berufe und Qualifikationen als Auswahl-Chips, Entgeltgruppe mit Tariflohn.
- Nachricht: `/konto/personal/<id>/nachricht` mit Dropdown „Worum geht es?“ (⭐ = Ausschreibung passt zum Beruf), fertiger Text, Knöpfe WhatsApp/SMS/E-Mail (öffnen die Apps am Handy; Jarvis verschickt nichts).
- Migration `20261031020000_personal.sql` (Tabelle `personal`, RLS über darf_bereich/darf_bearbeiten), Test erweitert. Datenschutzerklärung ergänzt. Neues Modul `web/src/personal.ts`.
- Idee für später: mehrere Personen auf einmal anschreiben.

### 30.10.2026 (abends, Teil 6) – Claude
- Kalkulation: statt Dropdown jetzt Karten mit allen offenen Ausschreibungen (Titel zweizeilig, Frist, Stand). Mit geprüften Unterlagen öffnet die Kalkulation, sonst der Upload bei der Ausschreibung. Route `/konto/kalkulation/oeffnen` entfernt.

### 30.10.2026 (abends, Teil 5) – Claude
- KI-Kosten: Modell pro Aufgabe. Tägliche Bewertung + Förderprogramme (`alarm/ki.py`) und Einrichtungs-Assistent: Claude Sonnet 5.5 (2/10 $ pro Mio. Tokens, halber Opus-Preis, effort low). Lose/Arbeitskräfte/Entgeltgruppe (`web/src/lose.ts`): Claude Haiku 5.5 (0,10/0,50 $, ohne Server-Fallback). Steckbrief aus Vergabeunterlagen bleibt Claude Opus 5.5 (lange, schwierige Dokumente). Kostenzähler rechnen mit dem jeweiligen Preis.

### 30.10.2026 (abends, Teil 4) – Claude
- Kalkulation: Seite „Kalkulation“ hat oben „Ausschreibung wählen“ (öffnet sofort die Kalkulation), dort „Los wählen“. Pro Los: „👷 Gebraucht: …“ (Arbeitskraft aus den Unterlagen), „📜 Vorschlag laut Tarifvertrag: EG x – Grund“ mit dem wörtlichen Merkmal, Entgeltgruppe vorausgewählt, Tariflohn heute und im Schnitt über die Laufzeit.
- Merkmale EG 1–9 wörtlich aus dem Entgeltrahmentarifvertrag DGB/GVP vom 20.05.2025 (dgb.de, robots.txt geprüft, gelesen über erkunden.yml „pdf“) in `tarife.ts`. Neues Modul `web/src/lose.ts` (Lose + taetigkeit + eg + eg_grund), genutzt vom Steckbrief-Ablauf. Ältere Steckbriefe: Knopf „👷 Arbeitskräfte und Entgeltgruppen erkennen“ (`POST /auftrag/<id>/arbeitskraefte`). Angebot ohne eigene Kalkulation nimmt den Tariflohn der vorgeschlagenen EG.

### 30.10.2026 (abends, Teil 3) – Claude
- Firmenunterlagen: Dropdown „Was lädst du hoch?“ mit den üblichen Nachweisen (✅ = schon vorhanden und gültig), „Eigene Angebotsvorlage (Word)“ und „Sonstige Unterlage“ (nur dann erscheint das Feld Bezeichnung). Kategorie ergibt sich aus der Auswahl. CSS: `[hidden]` gilt jetzt auch für Labels (vorher blieb ausgeblendetes sichtbar).

### 30.10.2026 (abends, Teil 2) – Claude
- Unterlagen-Seite: Schnellauswahl „Ausschreibung“ (Dropdown mit den vorhandenen Ausschreibungen, neueste zuerst, ohne verworfene/verlorene). Gewählte Ausschreibung → Dateien werden dort ergänzt (wie „Nachreichen“); „➕ Neue Ausschreibung“ zeigt das Titelfeld (`/app.js` blendet es ein und aus).

### 30.10.2026 (abends) – Claude
- Erster Suchlauf: Ladekreisel statt Dauertext. `alarm.yml` markiert am Ende `einstellungen.erstlauf_fertig` (auch ohne Treffer), dann verschwindet der Hinweis; höchstens 20 Minuten. Der Text „Suchprofil gespeichert. Jarvis durchsucht …“ hängt nicht mehr in der Adresse.

### 30.10.2026 (spät, Teil 4) – Claude
- Auf Wunsch von Benjamin: keine manuelle Freischaltung mehr. Wer sich registriert und die E-Mail bestätigt, bekommt sofort seine Firma im Tarif `kostenlos` (Migration `20261031010000_selbst_freischalten.sql`; Freischalten-Seite, Betreiber-Mail und Tabellen `registrierungen`/`betreiber` entfernt; `firma_anlegen` ohne Freigabe). Was der kostenlose Tarif darf, legt Benjamin später fest (offener Punkt).
- Plan-Seite (auf Wunsch von Benjamin vorerst ABGESCHALTET, kein Link, keine Route; Pläne kommen ganz zum Schluss) wie bei anderen Portalen (Free, Basis, Pro, Erfolg; `web/src/plaene.ts`): aktueller Plan, „Upgrade auf …“ öffnet vorerst eine vorbereitete Mail, bis Stripe eingerichtet ist. Preise und Inhalte: „Preis folgt“, legt Benjamin fest. „kostenlos“ steht nicht mehr in Registrierung und Startseite.

### 30.10.2026 (spät, Teil 3) – Claude
- Login-Fehler „Link abgelaufen“ bei neuer Adresse: Ursache PKCE (Link ging nur im selben Browser, Mail-Apps öffnen oft einen anderen). Diagnose über `datenbank.yml` Aktion `anmeldungen` (flow_state: Code ausgestellt, nie eingelöst).
- Neu `web/src/anmeldung.ts`: Registrierung (Vorname, Nachname, Firma, Straße, PLZ, Ort, Telefon freiwillig, E-Mail, Passwort ≥ 8, Zustimmung Nutzungsbedingungen/Datenschutz), Anmeldung mit Passwort, „Passwort vergessen“, `/konto/passwort`, Link-Anmeldung jetzt per Implicit Flow (Tokens im #-Teil, `/app.js` gibt sie an `/anmelden/sitzung`, nur gleiche Herkunft). Eingeladene registrieren sich ohne Firmenfelder.
- Migration `20261031000000_registrierung.sql`: Firmen-Anschrift, Tabellen `betreiber` (Benjamin) und `registrierungen`, Funktionen `registrierung_abschliessen` (legt Firma an, sobald freigeschaltet), `registrierungen_offen`, `registrierung_freischalten`. Benjamin bekommt pro Registrierung eine Mail und schaltet auf `/konto/freischalten` frei; der Kunde bekommt dann eine Mail.
- Tests: `test/anmeldung.test.ts`, `rechte_test.sql` erweitert (ALLE TESTS OK).

### 30.10.2026 (spät, Teil 2) – Claude
- Tarif-Auswahl Zeitarbeit: Tabellen GVP/DGB (EG 1, 2a, 2b, 3–9; ab 01.01.2026, 01.09.2026, 01.04.2027) aus dem Original-PDF des Entgelttarifvertrags vom 12.09.2025 (dgb.de, robots.txt geprüft, gelesen über erkunden.yml „pdf“) in `web/src/tarife.ts`.
- Kalkulation: pro Los Entgeltgruppe wählbar → Durchschnittslohn über die Laufzeit (Vertragsbeginn, Monate, erwartete Erhöhung nach 04/2027, Erfahrungszuschläge 1,5 %/3 % nach 9/12 Monaten); Hinweis auf Equal Pay ab dem 10. Monat (§ 8 Abs. 4 AÜG).
- **Pflege:** Der Vertrag ist frühestens zum 30.09.2027 kündbar. Sobald ein neuer Entgelttarifvertrag erscheint, Tabelle in tarife.ts ergänzen (nur aus dem Original). Branchenzuschläge nicht als Tabelle (für Gastro/Event/Pflege meist keine), dafür Feld „Weitere Zuschläge“.

### 30.10.2026 (spät) – Claude
- Kalkulation erweitert (`web/src/kalkulation.ts`): Formular in Gruppen Lohn · Schichten und Zuschläge · Einsatzkosten · Aufschläge. Schichtmodell (Anteil und Zuschlag für Nacht, Sonntag, Feiertag, Überstunden), Einsatzkosten (Fahrt und Verpflegung pro Tag, Unterkunft pro Nacht nur für Lose „auswärts“, einmalige Kosten je Kraft verteilt auf Einsatzstunden).
- Pro Los eigener Stundenlohn und Haken „Auswärts mit Unterkunft“ (gespeichert als `proLos` in kalkulation.json); Ergebnis zeigt Lohn und Preis pro Stunde je Los. Alte gespeicherte Werte rechnen weiter (fehlende Felder = Standard).
- Offen (Schritt 2, mit Benjamin abgesprochen): Tarif-Auswahl Zeitarbeit (GVP/iGZ, Entgeltgruppen, Branchenzuschläge, Tariferhöhung über Laufzeit) – Tariftabellen nur aus aktueller Quelle übernehmen.

### 30.10.2026 – ChatGPT (Angebotsfreigabe und Nachweise)
- Angebotsversionen warten auf die Freigabe von Inhaber oder Administration; Ablehnung kann eine Notiz enthalten. Download und Einreichungsprotokoll sind bis zur Freigabe gesperrt.
- Nach manueller Abgabe im Vergabeportal kann der Nutzer Portalname und Eingangsbeleg speichern. Zeitpunkt/Person werden festgehalten; Belegdatei bleibt nur mit Finanzfreigabe abrufbar.
- Befristete Nachweise werden in der Unterlagen-Seite bis 30 Tage vor Ablauf hervorgehoben. Die tägliche Mail erinnert aktive finanzberechtigte Mitglieder, die Firmenmail gewählt haben, 30/14/7/2 Tage vorher, jeweils einmal.
- Typprüfung und 35 Web-Tests, eine Python-Mailformatprüfung, Python-Syntax und PostgreSQL-Test („ALLE TESTS OK“) grün; GitHub-Web-, Alarm- und Datenbanktests ebenfalls grün: https://github.com/Twista-hub/jarvis/actions/runs/41076480119.
- Migration dry-run/eingespielt: https://github.com/Twista-hub/jarvis/actions/runs/41075917631. Worker ausgerollt und Seitentest erfolgreich: https://github.com/Twista-hub/jarvis/actions/runs/41076066171. Live-Routen verlangen Anmeldung.
- Offen: automatische Benachrichtigung der Firmenleitung über wartende Angebote und erlaubte Portal-Schnittstellen. Benjamin muss nichts für Einrichtung tun.

### 30.10.2026 – ChatGPT (Mitarbeiter und Angebote)
- Alle Regionen und untergeordneten Standorte erscheinen mit vollständigem Pfad im Filter. Funktionen im Betrieb, Zugriffsrollen, Bereichszuordnungen und Finanzfreigabe getrennt; Name/Funktion/Rechte bestehender Mitglieder änderbar.
- Weitergabe ausgewählter Textabschnitte mit Empfängervorschau, gespeichertem Freigabestand und Widerruf; eingeschränkte Mitarbeiter erhalten keinen Zugriff auf Original-Steckbrief oder Finanzdaten. Direkte R2-Ergebnislinks und Kalkulations-POSTs werden zusätzlich geprüft.
- Firmenunterlagen und Word-/Textvorlagen wiederverwendbar in EU-Speicher; Angebotsentwurf mit vorhandenem Angebotspreis, Nachweisauswahl, Ablaufprüfung, Vorlagen-Platzhaltern und ZIP-Download. Keine automatische Abgabe im Vergabeportal. Bedienung und Grenzen: docs/angebot-und-freigabe.md.
- Datenbankrechte lokal gegen Postgres geprüft („ALLE TESTS OK“), 34 Web-Tests und Typprüfung grün; neue Team-, Freigabe-, Angebots- und Bibliotheksseiten bei 320/390/768 px ohne horizontalen Überlauf geprüft. Worker-Build erfolgreich.
- Migration nach Probelauf eingespielt: https://github.com/Twista-hub/jarvis/actions/runs/41072871419. Live bestätigt: PerLease hat 4 Regionen/16 Standorte, Zeilenrechte auf allen drei neuen Tabellen aktiv.
- Auf main gepusht und online ausgerollt: https://github.com/Twista-hub/jarvis/actions/runs/41073508971. Web- und SQL-Prüfungen auf GitHub grün: https://github.com/Twista-hub/jarvis/actions/runs/41073508968. Neue Kontopfade verlangen Anmeldung; anonyme REST-Abfragen liefern keine Finanz-, Unterlagen-, Angebots- oder Freigabedaten.
- Offen: weitere Portal-Automatisierung, Chef-Freigabestufe, Ablauf-Erinnerungen und Abgabeprotokoll. Keine automatische Abgabe/Unterschrift eingebaut. Benjamin muss nichts für Einrichtung oder Ausrollen tun.

### 30.10.2026 – ChatGPT (Ausschreibungen am Handy)
- Firmenwechsel ins Profil verschoben, sichtbares „Zurück“ durch einen beschrifteten Pfeil für Bildschirmleser ersetzt.
- Ausschreibungen als Karten statt breiter Tabelle: Punkte, Frist, Bereich, aktueller Stand, aufklappbares Formular zum Ändern. Statusauswahl als zusammenhängende Schaltflächen, am schmalen Handy in zwei Reihen; Bereich als kompakter Filter.
- Bestehende Tests an die neue Navigation und Karten angepasst. Chromium bei 320, 375, 390, 430, 768 und 1280 px geprüft: kein horizontaler Überlauf, auch bei geöffneten Formularen; lange Titel und helle/dunkle Handyansicht geprüft.
- Typprüfung und alle 25 Tests grün. Auf main gepusht, online ausgerollt und GitHub-Seitentest grün: https://github.com/Twista-hub/jarvis/actions/runs/41068272901. Neue Darstellung und Login-Schutz zusätzlich online geprüft.
- Offen bleiben die übrigen Fahrplanpunkte; Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT (Profil und Übersicht)
- Profil-Seite und Icon oben rechts ergänzt; E-Mail und Kontodaten von der Übersicht entfernt, Firmenwechsel als kompaktes Menü nach oben verschoben.
- Suchprofil ersetzt die Einstellungen-Kachel. Nachrichten/Einstellungen bleiben über Profil und „Mehr“ erreichbar. Einrichtung ausschließlich im Suchprofil-Bereich.
- Falschen Einrichtungshinweis korrigiert: bereits über alarm/profile.json hinterlegte Firmenprofile werden jetzt ebenso wie aktive Datenbankprofile erkannt.
- Typprüfung und alle 25 Tests grün; Regressionstests für Profil, Firmenwechsel und beide Suchprofil-Quellen ergänzt.
- Auf main gepusht und online ausgerollt; GitHub-Seitentest grün: https://github.com/Twista-hub/jarvis/actions/runs/41066866144. /konto/profil und /konto/suchprofil zusätzlich auf Erreichbarkeit, Login-Schutz und Rückkehrziel geprüft.
- Offen bleiben die bisherigen Fahrplanpunkte; Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT
- Erste Konto-Unterseiten mit Kacheln, Zurück-Link und Handy-Leiste erstellt; Tests grün.
- GitHub-Verbindung über die Netzwerkfreigabe der Ausführungsumgebung wiederhergestellt. Claudes Push-Korrektur und die jetzt vorhandene Auftragsdatei werden berücksichtigt.
- Vollständigen Auftrag umgesetzt: /konto/treffer mit Status-Reitern, /konto/team, Fristen sortiert und markiert, Upload ohne Treffer, bisherige Steckbriefe und Firmenwerte der Kalkulation. Push-Ziele und Weiterleitungen angepasst. Claudes Push-Reparatur bleibt erhalten.
- Netzwerkfreigabe und GitHub-Schreibrechte funktionieren; Benjamin braucht dafür nichts einzurichten. Routineablauf in AGENTS.md festgehalten.
- Typprüfung und alle 22 Tests grün (inkl. neuer Seiten, Rollen, Upload ohne Treffer, Tageslimit und Firmen-Kalkulationswerte); Python-Syntaxprüfung grün.
- Auf main gepusht, automatisch ausgerollt und Seitentest grün: https://github.com/Twista-hub/jarvis/actions/runs/41065293829. Alle neuen Kontopfade sind online und durch Login geschützt; Push-Skript erreichbar.
- Offen bleiben die übrigen Fahrplanpunkte (siehe oben). Benjamin muss für GitHub und das Ausrollen nichts tun; App ansehen ist freiwillig.

### 30.10.2026 (Nachmittag) – Claude
- Handy-Nachrichten funktionieren auf Benjamins Android (Test-Knopf und Server-Push kommen an, Tipp öffnet die Trefferliste). Fehler war die Skript-Variable `status` (= window.status).
- Auftrag Seiten-Umbau geschrieben (docs/auftrag-seiten.md), Benjamin hat den Vorschlag gesehen.

### 30.10.2026 – Claude
- Unterlagen am Treffer hochladen (Mehrfachauswahl, nachreichen), „Hier runterladen“-Knopf, Steckbrief aus Unterlagen ergänzt die Bekanntmachung.
- eForms-Abruf repariert (Fristen, Eignung, Referenzen jetzt im Kurz-Steckbrief). evergabe-online.de blockt Skripte → kein automatischer Download.
- Startseite, Rechtstexte (Anschrift, Kleinunternehmer, LDI NRW eingetragen).
- Einrichtungs-Assistent, Sofort-Lauf (Secret ACTIONS_TOKEN von Benjamin gesetzt), tägliche Mail mit Uhrzeitwahl, Handy-Nachrichten.
- User-Agent nennt jetzt kontakt@wpdigitalranger.com (vorher versehentlich RestockHero-Adresse).
- Offen für Benjamin: Handy-Test, Rechtstexte lesen, Anthropic-Limit.

### 30.10.2026 – ChatGPT (Logo-Kontrast nachgeschärft)
- Auf Benjamins Rückmeldung das Logo überarbeitet: nun klar erkennbare Kompassrose mit Ring, oranger Nordspitze und blauer Südspitze auf dunklem Petrol. Die Farbchips und hell/dunklen Handyansichten zeigen stärkere Orange-/Blau-Akzente.
- SVG-Logo und Wortmarke sowie HTML-/PNG-Vorschau aktualisiert. Noch kein Einbau in die App.


### 30.10.2026 – ChatGPT (Rückmeldung zum Design umgesetzt)
- Farbnamen und Farbmuster aus der Designvorschau entfernt. Kompassfarben im Logo bleiben. Untertitel in der Wortmarke lautet jetzt „Digitale Lösungen“.
- Das Kompasssymbol erscheint im Kopf der Konto-Unterseiten neben Jarvis und WP Digital Ranger.

### 30.10.2026 – ChatGPT (Fahrplan nach Logo-Überarbeitung)
- Gemeinsamem Stand entnommen: Logo ist in der Konto-Kopfzeile; Vorschau bereinigt. Als nächster Entwicklungsschritt folgt die standortbezogene Kalkulationsvorlage.

### 30.10.2026 – ChatGPT (Kalkulationsvorlagen je Standort)
- Auf `/konto/kalkulation` kann man Firmen- oder Standortwerte auswählen, bearbeiten und speichern. Ein Standort ohne eigene Vorlage übernimmt zuerst die Region und danach die Firmenwerte. Die Liste zeigt den vollständigen Bereichspfad.
- Bei einer Ausschreibung nehmen Berechnung und Angebotsmappe die nächste passende Vorlage im Bereichsbaum. Gespeicherte Vorgangswerte bleiben vorrangig. Das bestehende Bereichs-/Finanz-RLS wird genutzt; für die vorhandene eindeutige `(firma_id, bereich_id)`-Vorlage war keine DB-Migration nötig.
- Typprüfung und alle 19 Web-Testdateien grün; Regressionstest für Standort-/Regions-/Firmenpriorität. PostgreSQL-Rechte unverändert; kein Dockerzugriff in dieser Umgebung. Web-Rollout nach Push automatisch. Offen: Mitarbeiter sperren/austreten lassen. Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT (Mitarbeiterzugang sperren)
- In „Firma & Team“ kann Inhaber/Administration App-Zugänge für genau diese Firma sperren und wieder aktivieren. Gesperrte Konten bleiben sichtbar und sind beschriftet. Die Deaktivierung nutzt `mitglieder.aktiv`; Rollen, Standortzuordnungen und historische Daten werden nicht gelöscht.
- Inhaber können sich nicht über diesen Knopf selbst sperren; die Datenbank verhindert weiterhin das Sperren des letzten aktiven Inhabers. Ein alter Sitzungstoken gewährt wegen der aktiven Mitgliedschaftsprüfung keinen Zugriff auf die gesperrte Firma; Zugänge zu anderen Firmen und das Supabase-Konto bleiben bestehen.
- Typprüfung und alle 19 Web-Testdateien grün. Isolierter PostgreSQL-Rechtestest einschließlich Sperre, RLS-Zugriffsverlust, Reaktivierung und letztem Inhaber: „ALLE TESTS OK“. Keine Schemaänderung nötig.
- Als nächstes laut Fahrplan: kaufmännisch Verantwortliche Person je Ausschreibung. Benjamin muss nichts einrichten.

### 30.10.2026 – ChatGPT (Kaufmännische Zuständigkeit je Ausschreibung)
- Auf `/konto/vorgang/<id>` ergänzt: Inhaber, Administration oder Bearbeiter können eine kaufmännisch verantwortliche Person auswählen oder die Zuordnung entfernen. Auswahl zeigt aktive Inhaber/Admins sowie Bearbeiter mit Zugriff auf den Ausschreibungsbereich. Gesperrte bisherige Zuständigkeit bleibt lesbar und ist markiert.
- Migration `20261030224121_kaufverantwortung.sql`: optionale Vorgangsspalte mit firmengebundener Fremdschlüsselbeziehung. Trigger verlangt ein aktives Mitglied mit Rolle Inhaber/Admin/Bearbeiter; Bearbeiter müssen Bereichsrecht haben. Die Zuweisung vergibt selbst keine Rechte. Löschen des Mitglieds setzt nur die Zuständigkeit zurück. RLS der Vorgänge regelt, wer aktualisieren darf.
- Typprüfung und 19 Web-Testdateien grün. Vollständiger PostgreSQL-16-Rechtetest inklusive passendem/fremdem Bereich und gesperrtem Zielmitglied mit „ALLE TESTS OK“.
- Migration und Web-Änderung gepusht; automatische Datenbankprüfung/-migration und App-Rollout nach GitHub Actions prüfen. Keine manuelle Einrichtung für Benjamin. Nächster Fahrplanpunkt: Berufs- und Tarifdatenbank.
