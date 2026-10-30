# Jarvis – Anleitung für alle KI-Mitarbeiter (Claude und ChatGPT/Codex)

Diese Datei gilt für Claude (Claude Code) und ChatGPT (Codex) gleichermaßen. Beide haben die gleichen Rechte und
Pflichten. Wer an Jarvis arbeitet, liest zuerst diese Datei und dann `docs/stand.md`.

## 1. Pflicht: gemeinsames Gedächtnis
- **Zu Beginn jeder Sitzung:** `AGENTS.md`, `docs/stand.md` und `docs/app-fahrplan.md` lesen. Vorher `git pull`.
- **Am Ende jeder Sitzung (oder nach jedem größeren Schritt):** in `docs/stand.md`
  - „Aktueller Stand“ und „Offene Punkte“ anpassen,
  - oben im Protokoll einen Eintrag ergänzen: Datum, wer (Claude/ChatGPT), was gemacht, was offen ist, was Benjamin tun muss.
  - Dann committen und pushen. Nichts Wichtiges nur im Chat lassen: der andere sieht den Chat nicht.
- Vor dem Push `git pull --rebase`, damit sich Claude und ChatGPT nicht gegenseitig überschreiben.
- Neue dauerhafte Regeln oder Fakten (Konten, Adressen, Entscheidungen von Benjamin) gehören in diese Datei.

## 2. Benjamin (der Nutzer)
- Benjamin Schiffer, Firma „WP Digital Ranger“ (Einzelunternehmen, Nebenerwerb, Kleinunternehmer nach § 19 UStG,
  Steuernummer beantragt). Rochusstraße 19, 52531 Übach-Palenberg (NRW). Telefon nicht veröffentlichen.
- Schreibt Deutsch, schnell, oft vom Handy, mit Diktierfehlern. Antworten: Deutsch, kurz, Wichtigstes zuerst.
- Konto-Übersicht: Profil-Icon oben rechts, keine „Angemeldet als“-Zeile; Firmenwechsel im Profil, Suche einrichten im Bereich „Suchprofil“. Zurück-Navigation als Pfeil ohne sichtbares „Zurück“. Ausschreibungen als Karten ohne seitliches Scrollen am Handy.
- Kein Konsolen-Fan. Für Schritte im Browser immer den **direkten Link** und den **genauen Buttontext**, Schritt für Schritt.
- Will, dass möglichst alles automatisch und ohne ihn läuft. Pull, Konflikte lösen, Tests, Push und die Ausroll-Prüfung übernimmt die KI selbst. Bei Netzwerkfehlern die vorgesehene Netzwerkfreigabe der Ausführungsumgebung prüfen; Benjamin soll keine Konsolenarbeit übernehmen.

## 3. Regeln (gelten ausnahmslos)
- **Strikte Trennung** von RestockHero (Repo Twista-hub/restockhero) und Demopin: eigene Repos, Datenbanken, Worker,
  Domains, Schlüssel, Mailadressen. Nichts davon in Jarvis verwenden.
- **Freigabe vor Außenwirkung:** Mails an Dritte, Posts, Veröffentlichungen, Rechnungen, Ausgaben nur nach OK von Benjamin.
  (Ausnahme: die Benachrichtigungen, die Kunden in der App selbst eingeschaltet haben.)
- **Keine Passwörter, Schlüssel, Bank- oder Steuerdaten** eingeben, erzeugen lassen oder im Chat verlangen. Benjamin trägt
  sie selbst als GitHub-Secret oder beim Anbieter ein. Schlüssel nie in den Chat oder ins Repo.
- **Abos nur für eigene Arbeit.** Alles, was zahlende Kunden bekommen, läuft über die offizielle Anthropic-API
  (Secret ANTHROPIC_API_KEY). Keine Werkzeuge, die Abos als API weiterreichen.
- **Datenquellen:** Nutzungsbedingungen und robots.txt vor dem Abruf prüfen, Ergebnis in `alarm/quellen.md`.
  Sperren nie umgehen. DTVP und evergabe-online.de: kein automatischer Download (AGB bzw. Sperre), Kunden laden selbst.
- **Kosten:** harte Grenzen im Code (Tageslimit Uploads `TAGES_LIMIT`, Steckbriefe pro Lauf). Budget gesamt höchstens
  100 €/Monat ohne Abos. Claude-API ca. 10–20 $/Monat.
- Keine Modellnamen in Commits oder Code-Kommentaren nötig; Commits auf Deutsch, kurz, was und warum.

## 4. Was Jarvis ist
Ausschreibungs-Alarm für Firmen (erster Wunschkunde: PerLease GmbH, Zeitarbeit; Benjamin zeigt es als Überraschung, der
Kunde wird vorher nicht kontaktiert). Jeden Morgen öffentliche Ausschreibungen lesen, mit KI bewerten, Steckbriefe
schreiben, in die App eintragen, per Mail/Handy melden. Kunden laden Vergabeunterlagen hoch, Jarvis schreibt den
ausführlichen Steckbrief und rechnet den Angebotspreis.

## 5. Aufbau (alles online, nichts auf Benjamins PC)
| Teil | Wo | Datei/Ordner |
|---|---|---|
| Web-App (Konto, Treffer, Upload, Einrichtung, Rechtstexte, Handy-Nachrichten) | Cloudflare Worker `jarvis-alarm`: https://jarvis-alarm.benschiffer79.workers.dev | `web/` (TypeScript, keine Frameworks, Seiten ohne fremde Skripte; nur `/app.js` und `/sw.js`) |
| Steckbrief aus Unterlagen | Cloudflare Workflow `jarvis-steckbrief`, Dateien in R2 `jarvis-auftraege` (EU, 30 Tage) | `web/src/workflow.ts` |
| Täglicher Alarm | GitHub Actions `alarm.yml` (05:17 und 07:41 UTC) | `alarm/alarm.py`, `ki.py`, `speichern.py`, `profile_db.py` |
| Tägliche Mail und Handy-Nachricht | GitHub Actions `mail.yml` (stündlich 7–20 Uhr) | `alarm/mail.py`, `alarm/push.py` |
| Datenbank, Login | Supabase-Projekt `jarvis`, Ref `juuuifrcxmitkqudqngq`, Frankfurt, Free | `supabase/migrations/`, Test `supabase/tests/rechte_test.sql` |
| Mail | kontakt@wpdigitalranger.com (Namecheap Private Email, SMTP mail.privateemail.com:465), DNS bei Cloudflare | `web/src/mail.ts` |
| Suchprofile | `alarm/profile.json` (von Hand) oder in der App gespeichert (Tabelle `suchprofile`, gewinnt) | |

Wichtige Daten-Regeln: Alle App-Zugriffe laufen mit dem Token der Person (Zeilenrechte/RLS). Firmen anlegen nur nach
Freischaltung (Tabelle `freigaben`). Rollen: inhaber, admin, bearbeiter, leser (kostenlos), mitarbeiter (nur persönlich freigegebene Texte). Funktionen wie Abteilungsleitung oder Facharbeiter sind unabhängig von Zugriffsrechten. Finanzdaten nur für Inhaber/Administration oder ausdrücklich berechtigte Leser/Bearbeiter. Mitarbeiter-Freigaben sind ausgewählte Textkopien mit Vorschau und Widerruf, keine Zugriffe auf Originalunterlagen/Kalkulation.
Firmenunterlagen/Vorlagen liegen unter `bibliothek/` in R2 (EU) bis zur Löschung, getrennt von den 30-Tage-Vergabeunterlagen. Angebotsmappen werden als Entwurf vorbereitet und heruntergeladen; die Abgabe erfolgt über den vorgeschriebenen Portalweg. Keine automatische Unterschrift oder Übermittlung ohne erlaubte Schnittstelle und Freigabe.

## 6. Wie man arbeitet (ohne PC, über GitHub)
- Code ändern, testen, auf `main` pushen. Ein Push auf `web/**` rollt die App automatisch aus (`web.yml`, mit Typprüfung,
  Tests und Seitentest).
- Prüfen vor dem Push: `cd web && npm ci && npm run check && npm test`; Python: `python3 -m py_compile alarm/*.py`;
  Datenbank-Regeln: `psql -f supabase/tests/rechte_test.sql` gegen ein leeres Postgres (muss „ALLE TESTS OK“ zeigen).
- **GitHub Actions (von Hand starten):**
  - `datenbank.yml`: Migrationen anzeigen bzw. einspielen (Eingabe `EINSPIELEN`)
  - `alarm.yml`: Alarm für bestimmte Tage (`tage`) oder nur eine Firma (`firma`)
  - `mail.yml`: Testmail/-Nachricht an eine Adresse (`test`)
  - `web.yml`: App neu ausrollen
  - `erkunden.yml`: Quellen prüfen (robots.txt, AGB), TED-Recherche, Zuschläge
  - `dns.yml`, `mailtest.yml`: Mail-DNS und SMTP prüfen
- Ergebnisse stehen in den Logs der Actions.
- **Secrets (nur Benjamin trägt ein):** CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ANTHROPIC_API_KEY, SMTP_PASSWORD,
  SUPABASE_DB_PASSWORD, ACTIONS_TOKEN (startet den Alarm aus der App). Der Supabase-Publishable-Key steht absichtlich
  in `web/wrangler.toml`.

## 7. Arbeitsteilung
Beide dürfen alles in diesem Repo. Damit es keine Doppelarbeit gibt: Wer eine Aufgabe anfängt, trägt sie in
`docs/stand.md` unter „In Arbeit“ mit Namen ein und nimmt sie nach Abschluss wieder heraus.
