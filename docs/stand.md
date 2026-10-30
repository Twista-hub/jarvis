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
  - Firmenunterlagen und Word-/Textvorlagen; Angebotsmappe mit bearbeitbarem Entwurf, Angebotspreis aus Kalkulation, Nachweisauswahl, Ablaufprüfung und ZIP-Export. Abgabe weiterhin über das vorgeschriebene Vergabeportal.
  - PerLease-Filter zeigt alle 4 Regionen und 16 Standorte; live bestätigt.
  - Neue Konto-Übersicht mit Kacheln, Status-Reitern, Fristen, Unterlagen-Upload ohne Treffer, Firmen-Kalkulationswerten, Team und Einstellungen; Handy-Leiste und Zurück-Pfeil.
- **Firmen in der App:** „WP Digital Ranger“ (Benjamin) und „PerLease (Vorschau)“ mit 4 Regionen und 16 Standorten.
- **Alarm:** täglich, Quelle Bekanntmachungsservice (CC0) inkl. vollständiger eForms-Bekanntmachung, Förderdatenbank.

## In Arbeit

## Offene Punkte (Reihenfolge = Vorschlag)
1. Rechtstexte von Benjamin prüfen lassen.
2. Zuständige Person pro Ausschreibung zuweisen (Fahrplan Punkt 9).
3. Kalkulationsvorlagen pro Standort; eigener Ablauf zum Sperren/Austritt von Mitarbeitern (Namen, Funktionen und Rechte sind bearbeitbar).
4. Aussehen/Design mit Logo WP Digital Ranger.
5. Später: Stripe-Abrechnung, Nachweis-Erinnerungen, Chef-Freigabe und Eingangsbestätigung für Angebote; Portal-Schnittstellen erst nach Prüfung/Freigabe.
6. Benjamin: Anthropic-Ausgabenlimit 20 $ setzen (https://console.anthropic.com/settings/limits).

## Protokoll

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
