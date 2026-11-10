# Auftrag an den Browser-Chat: Crewtender in der Google Play Console anlegen (10.11.2026)

Ziel: Die Android-App „Crewtender“ (Paket `eu.crewtender.app`) in der Play Console anlegen, das App-Bundle in den
**internen Test** laden und Store-Eintrag sowie App-Inhalte ausfüllen. **Nichts veröffentlichen, keine Produktion
beantragen** – das entscheidet Benjamin am Ende. Keine Passwörter eingeben; wo ein Passwort oder ein Prüfkonto nötig
ist, anhalten und den Link notieren. Play Console ist im Chrome-Hauptprofil angemeldet (Konto WP Digital Ranger).

## 0. Dateien holen
1. https://github.com/Twista-hub/jarvis/actions/runs/42847685268 öffnen → ganz unten bei „Artifacts“ auf
   **crewtender-play-paket** klicken (lädt eine ZIP-Datei, 3,7 MB; GitHub muss angemeldet sein).
2. ZIP entpacken. Darin: `app-release-bundle.aab`, Ordner `store/` (Symbol, Vorstellungsgrafik, 6 Screenshots), `STORE.md`.
   Falls du keine Dateien herunterladen oder hochladen kannst: alle Text-Schritte trotzdem erledigen und im Protokoll
   genau notieren, welche Datei-Schritte für Benjamin offen sind.

## 1. App anlegen
https://play.google.com/console → **App erstellen**
- App-Name: `Crewtender – Aufträge & Team` · Standardsprache: Deutsch (Deutschland) – de-DE · **App** · **Kostenlos**
- Beide Erklärungen (Programmrichtlinien, US-Exportgesetze) nur ankreuzen, wenn Benjamin im Chat zugestimmt hat; sonst hier anhalten.

## 2. Interner Test
Test und Veröffentlichung → Test → **Interner Test** → **Neuen Release erstellen**
- Bei der Frage zur App-Signatur: **Play App Signing** verwenden (Standard, „Weiter“).
- `app-release-bundle.aab` hochladen. Erwartet: Paket eu.crewtender.app, Versionscode 1, Ziel-API 36.
- Release-Name: `1.0.0` · Versionshinweise (de-DE): `Erste Version.` → **Weiter** → **Speichern** (noch nicht einführen, falls die Console etwas bemängelt: Wortlaut notieren).
- Tester: Liste „Intern“ mit Benjamins Google-Adresse anlegen, falls noch keine existiert (Adresse fragt du Benjamin).
- Danach: Test und Veröffentlichung → **App-Integrität** → Reiter „App-Signatur“ → **SHA-256-Fingerabdruck des
  App-Signaturschlüssels** kopieren und ins Protokoll schreiben (das ist öffentlich, kein Geheimnis). Claude braucht ihn.

## 3. Store-Eintrag (Wachstum → Store-Präsenz → Haupteintrag im Store)
**Deutsch (de-DE)**
- App-Name: `Crewtender – Aufträge & Team`
- Kurzbeschreibung: `Öffentliche Ausschreibungen finden, mit Tariflohn kalkulieren, Team einplanen.`
- Vollständige Beschreibung:

```
Crewtender ist die App für Dienstleister und Handwerksbetriebe, die öffentliche Aufträge gewinnen und mit eigenem Personal erledigen: Gebäudereinigung, Sicherheitsdienst, Zeitarbeit, Gastronomie, Garten- und Landschaftsbau, Handwerk und viele weitere Branchen.

VOM AUFTRAG BIS ZUM TEAM
• Ausschreibungen finden: Crewtender liest jeden Tag die neuen öffentlichen Ausschreibungen aus amtlichen Quellen und zeigt dir die, die zu deiner Firma und deiner Region passen.
• Bewertung mit Begründung: Jede Ausschreibung bekommt 1 bis 10 Punkte und einen Satz, warum sie passt oder nicht.
• Steckbrief: Fristen, Lose, Mengen, geforderte Nachweise und Zuschlagskriterien auf einen Blick.
• Kalkulation: Mit deinen Löhnen, Tarifgruppen und Zuschlägen den Preis pro Stunde und pro Los rechnen.
• Fristen im Blick: Erinnerungen vor Abgabe- und Fragefristen, auf Wunsch als Handy-Nachricht.

WENN DER AUFTRAG DA IST
• Schichtplan mit Zusagen, offenen Schichten und Ersatz bei Ausfall.
• Stundenzettel und Stempeluhr auf dem Handy, Freigabe im Büro.
• Personalakte mit Nachweisen und Ablauf-Warnung, Urlaub und Abwesenheiten.
• Leistungsnachweis zum Unterschreiben und Rechnungen.

GUT ZU WISSEN
• Für Firmen: Du brauchst ein Crewtender-Konto deiner Firma. Einsatzkräfte werden von ihrer Firma eingeladen.
• Die Ausschreibungen stammen aus öffentlichen amtlichen Bekanntmachungen. Crewtender ist keine Behörde und kein Vergabeportal; Angebote reichst du beim jeweiligen Auftraggeber ein.
• KI-Texte (Bewertung, Steckbrief) sind gekennzeichnet und ersetzen nicht das Lesen der Vergabeunterlagen.
• Daten in der EU (Datenbank in Frankfurt). Keine Werbung in der App.
• In 6 Sprachen: Deutsch, Englisch, Französisch, Polnisch, Spanisch, Italienisch.

Fragen oder Wünsche? hello@crewtender.eu
```

- Grafiken: App-Symbol `store/symbol-512.png` · Vorstellungsgrafik `store/vorstellungsgrafik-1024x500.png` ·
  Smartphone-Screenshots: alle 6 Dateien aus `store/screenshots-de/` in der Reihenfolge 1 bis 6.

**Englisch (en-US)** über „Übersetzungen verwalten“ hinzufügen
- App name: `Crewtender – Tenders & Team`
- Short description: `Find public tenders, calculate with real wages, plan your team – in one app.`
- Full description:

```
Crewtender is the app for service companies and trades that want to win public contracts and deliver them with their own staff: cleaning, security, temporary staffing, catering, landscaping, trades and many more.

FROM THE TENDER TO THE TEAM
• Find tenders: every day Crewtender reads the new public tenders from official sources and shows you the ones that fit your company and your region.
• Rating with a reason: every tender gets 1 to 10 points and one sentence on why it fits or not.
• Fact sheet: deadlines, lots, quantities, required certificates and award criteria at a glance.
• Calculation: work out the price per hour and per lot with your own wages, pay grades and surcharges.
• Deadlines in view: reminders before submission and question deadlines, as a phone notification if you like.

ONCE YOU HAVE THE CONTRACT
• Shift plan with confirmations, open shifts and cover when someone drops out.
• Timesheets and time clock on the phone, approval in the office.
• Staff files with certificates and expiry warnings, holidays and absences.
• Proof of service to sign, and invoices.

GOOD TO KNOW
• For companies: you need your company's Crewtender account. Workers are invited by their company.
• The tenders come from public official notices. Crewtender is not a government body or a tender portal; you submit bids to the contracting authority.
• AI texts (rating, fact sheet) are labelled and do not replace reading the tender documents.
• Data is stored in the EU (database in Frankfurt). No ads in the app.
• Available in 6 languages: German, English, French, Polish, Spanish, Italian.

Questions or requests? hello@crewtender.eu
```

- Screenshots und Grafik: dieselben Dateien.

**Store-Einstellungen:** Kategorie **Geschäftlich** · E-Mail `hello@crewtender.eu` · Website `https://crewtender.eu` · keine Telefonnummer.

## 4. App-Inhalte (Richtlinie → App-Inhalte)
- **Datenschutzerklärung:** `https://crewtender.eu/datenschutz`
- **App-Zugriff:** „Alle oder einige Funktionen sind eingeschränkt“. Anleitung (Feld für Hinweise):
  `The app can also be explored without an account at https://crewtender.eu/demo (sample data). Subscriptions are not sold inside the Android app.`
  **Nutzername und Passwort des Prüfkontos trägt Benjamin selbst ein – hier anhalten und den Link notieren.**
- **Werbung:** Nein, die App enthält keine Werbung.
- **Altersfreigabe:** Fragebogen starten, E-Mail `hello@crewtender.eu`, Kategorie „Dienstprogramm, Produktivität,
  Kommunikation oder Sonstiges“. Alle Fragen zu Gewalt, Sexualität, Sprache, Drogen, Glücksspiel: Nein. Können Nutzer
  miteinander kommunizieren: **Ja** (Team-Chat nur innerhalb der eigenen Firma). Standort mit anderen teilen: Nein.
  Digitale Käufe: Nein.
- **Zielgruppe:** nur **18 Jahre und älter**. App spricht Kinder nicht an.
- **Nachrichten-App:** Nein · **Gesundheit:** keine Gesundheitsfunktionen · **Finanzfunktionen:** keine ·
  **Behörden-App:** Nein · **Werbe-ID:** wird nicht verwendet.
- **Konto löschen:** App ermöglicht Kontoerstellung: Ja · Adresse: `https://crewtender.eu/konto-loeschen`
- **Datensicherheit:**
  - Erhebt oder teilt die App Nutzerdaten: **Ja** · Alle Daten bei der Übertragung verschlüsselt: **Ja** ·
    Nutzer können Löschung verlangen: **Ja**, Adresse `https://crewtender.eu/konto-loeschen`.
  - Bei jedem Datentyp: **erhoben**, **nicht geteilt**, Zweck **App-Funktionen** (bei Name, E-Mail, Nutzer-IDs zusätzlich **Kontoverwaltung**).
  - Personenbezogene Daten: Name (Pflicht) · E-Mail-Adresse (Pflicht) · Nutzer-IDs (Pflicht) · Telefonnummer (optional) · Sonstige Angaben (Pflicht).
  - Standort: ungefährer Standort (optional, **wird nur vorübergehend verarbeitet**: Ja).
  - Nachrichten: sonstige In-App-Nachrichten (optional).
  - Fotos und Videos: Fotos (optional). Dateien und Dokumente (optional).
  - Geräte- oder andere IDs (optional).
  - Alles andere (Finanzdaten, Gesundheit, Kontakte, Kalender, App-Aktivität, Web-Verlauf, App-Informationen und Leistung, Audio): **nicht erhoben**.

## 5. Länder
Test und Veröffentlichung → Produktion → Länder/Regionen: **Deutschland, Österreich, Schweiz** hinzufügen (nur vormerken, **keinen Produktions-Release anlegen**).

## 6. Rückmeldung
In `docs/browser/protokoll.md` („## Erledigt (Datum) – Play Console Crewtender“): was erledigt ist, SHA-256 des
App-Signaturschlüssels, jede Warnung der Console im Wortlaut, alle offenen Punkte für Benjamin mit direktem Link
(Prüfkonto, Dateien, Erklärungen). Keine Passwörter, keine Schlüssel.
