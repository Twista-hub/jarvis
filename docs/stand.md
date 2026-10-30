# Jarvis – aktueller Stand (gemeinsames Gedächtnis von Claude und ChatGPT)

Regeln dazu stehen in `AGENTS.md` Abschnitt 1. Neueste Einträge oben.

## Aktueller Stand (30.10.2026)
- **App online:** https://jarvis-alarm.benschiffer79.workers.dev
  - Startseite mit Erklärung und Beispiel-Steckbrief; Impressum, Datenschutz, Nutzungsbedingungen, AVV (Entwürfe, Benjamin prüft noch).
  - Login per Mail-Link, Firmen, Bereiche/Standorte, Rollen, Einladungen per Mail.
  - Ausschreibungen als Handy-Karten mit Punkten, Frist, Stand und Bereichsfilter; Treffer-Seite mit Steckbrief, Knopf „Hier runterladen“
    (zum Portal) und Upload, Jarvis schreibt daraus den ausführlichen Steckbrief (ergänzt den aus der Bekanntmachung) und die Kalkulation.
  - Einrichtungs-Assistent: Firma beschreiben → KI schlägt Suchprofil vor → speichern → Alarm sucht sofort die letzten 7 Tage.
  - Tägliche Nachricht pro Person: Uhrzeit 7–20 Uhr, per Mail, Handy oder beides; Fristen-Erinnerung 7 und 2 Tage vorher.
  - Handy-Nachrichten (Web-Push) und als App installierbar.
  - Profil-Icon oben rechts (/konto/profil), Firmenwechsel im Profil; Suchprofil als eigener Bereich (/konto/suchprofil). Keine E-Mail-Zeile oder Einrichtung auf der Übersicht.
  - Mitarbeiter: Name und Funktion (z. B. Serviceleitung/Facharbeiter) unabhängig von Rollen, Bereichszuordnung und Finanzfreigabe; gezielte Textweitergabe mit Vorschau/Widerruf und eigener Mitarbeiteransicht.
  - Firmenunterlagen und Word-/Textvorlagen; Angebotsmappe mit bearbeitbarem Entwurf, Chef-Freigabe vor Download, Ablaufprüfung, Ablauf-Erinnerungen und protokolliertem Eingangsbeleg nach manueller Portalabgabe.
  - PerLease-Filter zeigt alle 4 Regionen und 16 Standorte; live bestätigt.
  - Neue Konto-Übersicht mit Kacheln, Status-Reitern, Fristen, Unterlagen-Upload ohne Treffer, Firmen-Kalkulationswerten, Team und Einstellungen; Handy-Leiste und Zurück-Pfeil.
- **Firmen in der App:** „WP Digital Ranger“ (Benjamin) und „PerLease (Vorschau)“ mit 4 Regionen und 16 Standorten.
- **Alarm:** täglich, Quelle Bekanntmachungsservice (CC0) inkl. vollständiger eForms-Bekanntmachung, Förderdatenbank.

## In Arbeit
- (niemand)

## Offene Punkte (Reihenfolge = Vorschlag)
0. Ganz zum Schluss, wenn die App fertig ist: Pläne festlegen und Plan-Seite einschalten (Free/Basis/Pro/Erfolg in `web/src/plaene.ts`): Preise und was jeder Plan darf; danach Zahlung per Stripe und Sperren nach Plan. Bis dahin läuft der tägliche KI-Alarm für jede Firma mit Suchprofil, also auch für kostenlose (API-Kosten im Blick behalten).
1. Rechtstexte von Benjamin prüfen lassen.
2. Zuständige Person pro Ausschreibung zuweisen (Fahrplan Punkt 9).
3. Kalkulationsvorlagen pro Standort; eigener Ablauf zum Sperren/Austritt von Mitarbeitern (Namen, Funktionen und Rechte sind bearbeitbar).
4. Aussehen/Design mit Logo WP Digital Ranger.
5. Später: Stripe-Abrechnung; Benachrichtigung der Firmenleitung bei wartenden Angeboten und Portal-Schnittstellen erst nach Prüfung/Freigabe.
6. Benjamin: Anthropic-Ausgabenlimit 20 $ setzen (https://console.anthropic.com/settings/limits).

## Protokoll

### 30.10.2026 (abends, Teil 7) – Claude
- Firma & Team: Standorte als Kacheln (Regionen als Überschrift, Zahlen „verfügbar · gesamt“). Tippen → `/konto/standort/<id>` mit dem Personal als Karten (Initialen, Status 🟢/🔵/⚪, Berufe als Marken, EG, Qualifikationen, 📞 Anrufen, 💬 Nachricht, ✏️ Bearbeiten, 🗑️ Löschen), „➕ Person hinzufügen“, Filter nach Beruf und Status. Berufe und Qualifikationen als Auswahl-Chips, Entgeltgruppe mit Tariflohn.
- Nachricht: `/konto/personal/<id>/nachricht` mit Dropdown „Worum geht es?“ (⭐ = Ausschreibung passt zum Beruf), fertiger Text, Knöpfe WhatsApp/SMS/E-Mail (öffnen die Apps am Handy; Jarvis verschickt nichts).
- Migration `20261031020000_personal.sql` (Tabelle `personal`, RLS über darf_bereich/darf_bearbeiten), Test erweitert. Datenschutzerklärung ergänzt. Neues Modul `web/src/personal.ts`.
- Idee für später: mehrere Personen auf einmal anschreiben, Einsatz einer Person einer Ausschreibung zuordnen.

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
