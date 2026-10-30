# Jarvis – aktueller Stand (gemeinsames Gedächtnis von Claude und ChatGPT)

Regeln dazu stehen in `AGENTS.md` Abschnitt 1. Neueste Einträge oben.

## Aktueller Stand (30.10.2026)
- **App online:** https://jarvis-alarm.benschiffer79.workers.dev
  - Startseite mit Erklärung und Beispiel-Steckbrief; Impressum, Datenschutz, Nutzungsbedingungen, AVV (Entwürfe, Benjamin prüft noch).
  - Login per Mail-Link, Firmen, Bereiche/Standorte, Rollen, Einladungen per Mail.
  - Trefferliste mit Punkten, Frist, Stand, Filter nach Bereich; Treffer-Seite mit Steckbrief, Knopf „Hier runterladen“
    (zum Portal) und Upload, Jarvis schreibt daraus den ausführlichen Steckbrief (ergänzt den aus der Bekanntmachung) und die Kalkulation.
  - Einrichtungs-Assistent: Firma beschreiben → KI schlägt Suchprofil vor → speichern → Alarm sucht sofort die letzten 7 Tage.
  - Tägliche Nachricht pro Person: Uhrzeit 7–20 Uhr, per Mail, Handy oder beides; Fristen-Erinnerung 7 und 2 Tage vorher.
  - Handy-Nachrichten (Web-Push) und als App installierbar.
- **Firmen in der App:** „WP Digital Ranger“ (Benjamin) und „PerLease (Vorschau)“ mit 4 Regionen und 16 Standorten.
- **Alarm:** täglich, Quelle Bekanntmachungsservice (CC0) inkl. vollständiger eForms-Bekanntmachung, Förderdatenbank.

## In Arbeit
- (Claude) Handy-Nachrichten: Server meldet „gesendet“, auf Benjamins Android kam noch nichts an. Ursache für fehlende
  Knöpfe gefunden (Skript-Variable `status` = window.status, behoben 30.10. 13:13). Benjamin testet mit „🔔 Test auf diesem
  Handy“; danach Server-Nachricht erneut senden (`mail.yml`, test = benschiffer79@gmail.com).

## Offene Punkte (Reihenfolge = Vorschlag)
1. Handy-Nachrichten auf Benjamins Handy zum Laufen bringen (siehe oben).
2. Rechtstexte von Benjamin prüfen lassen.
3. Zuständige Person pro Ausschreibung zuweisen (Fahrplan Punkt 9).
4. Kalkulationsvorlagen pro Standort, Mitarbeiterliste mit Namen (Fahrplan 10, 11).
5. Aussehen/Design mit Logo WP Digital Ranger.
6. Später: Stripe-Abrechnung, Angebotsentwurf, weitere Portale nach Freigabe.
7. Benjamin: Anthropic-Ausgabenlimit 20 $ setzen (https://console.anthropic.com/settings/limits).

## Protokoll

### 30.10.2026 – Claude
- Unterlagen am Treffer hochladen (Mehrfachauswahl, nachreichen), „Hier runterladen“-Knopf, Steckbrief aus Unterlagen ergänzt die Bekanntmachung.
- eForms-Abruf repariert (Fristen, Eignung, Referenzen jetzt im Kurz-Steckbrief). evergabe-online.de blockt Skripte → kein automatischer Download.
- Startseite, Rechtstexte (Anschrift, Kleinunternehmer, LDI NRW eingetragen).
- Einrichtungs-Assistent, Sofort-Lauf (Secret ACTIONS_TOKEN von Benjamin gesetzt), tägliche Mail mit Uhrzeitwahl, Handy-Nachrichten.
- User-Agent nennt jetzt kontakt@wpdigitalranger.com (vorher versehentlich RestockHero-Adresse).
- Offen für Benjamin: Handy-Test, Rechtstexte lesen, Anthropic-Limit.
