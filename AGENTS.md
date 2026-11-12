# Jarvis (Crewtender) – Anleitung für alle KI-Mitarbeiter

An Jarvis arbeiten Claude Code (programmiert) und ein Claude-Chat mit Browser-Steuerung (Browser-Arbeiten, Aufträge in
`docs/auftraege/`). Die App heißt nach außen **Crewtender**. Beide haben die gleichen Rechte und Pflichten. Wer an Jarvis
arbeitet, liest zuerst diese Datei und dann in `docs/stand.md` die Abschnitte „Aktueller Stand“ und „Offene Punkte“.

## 1. Pflicht: gemeinsames Gedächtnis
- **Zu Beginn jeder Sitzung:** `git pull`, dann diese Datei und in `docs/stand.md` die Abschnitte „Aktueller Stand“ und „Offene Punkte“ lesen. `docs/stand.md` ist rund 300 KB groß: Das Protokoll darunter ist das Archiv, darin gezielt nach Stichwort suchen. `docs/browser/protokoll.md` (Rückmeldungen des Browser-Chats, neueste Einträge) und `docs/app-fahrplan.md` lesen, wenn die Aufgabe sie berührt.
- **Am Ende jeder Sitzung (oder nach jedem größeren Schritt):** in `docs/stand.md`
  - „Aktueller Stand“ und „Offene Punkte“ anpassen,
  - oben im Protokoll einen Eintrag ergänzen: Datum, wer (Claude Code / Browser-Chat), was gemacht, was offen ist, was Benjamin tun muss.
  - Dann committen und pushen. Nichts Wichtiges nur im Chat lassen: der andere sieht den Chat nicht.
- Vor dem Push `git pull --rebase`, damit sich parallele Sitzungen nicht gegenseitig überschreiben.
- Neue dauerhafte Regeln oder Fakten (Konten, Adressen, Entscheidungen von Benjamin) gehören in diese Datei.

## 2. Benjamin (der Nutzer)
- Benjamin Schiffer, Firma „WP Digital Ranger“ (Einzelunternehmen, Nebenerwerb, Kleinunternehmer nach § 19 UStG,
  Steuernummer beantragt). Rochusstraße 19, 52531 Übach-Palenberg (NRW). Telefon nicht veröffentlichen.
- Schreibt Deutsch, schnell, oft vom Handy, mit Diktierfehlern. Antworten: Deutsch, kurz, Wichtigstes zuerst.
- Kein Konsolen-Fan. Für Schritte im Browser immer den **direkten Link** und den **genauen Buttontext**, Schritt für Schritt.
- Will, dass möglichst alles automatisch und ohne ihn läuft. Pull, Konflikte lösen, Tests, Push und die Ausroll-Prüfung übernimmt die KI selbst. Bei Netzwerkfehlern die vorgesehene Netzwerkfreigabe der Ausführungsumgebung prüfen; Benjamin soll keine Konsolenarbeit übernehmen.

### Produktentscheidungen von Benjamin (gelten für die App)
- Konto-Übersicht: Profil-Icon oben rechts, keine „Angemeldet als“-Zeile; Firmenwechsel im Profil, Suche einrichten im Bereich „Suchprofil“. Zurück-Navigation als Pfeil ohne sichtbares „Zurück“. Ausschreibungen als Karten ohne seitliches Scrollen am Handy.
- Hilfen auf ein Minimum reduzieren: höchstens ein kleines Info-Symbol direkt neben der Seitenüberschrift, ohne eigene Zeile; Erklärungen gesammelt erst beim Öffnen als überlagerndes Feld. Keine ständig sichtbaren Hilfsüberschriften wie „Ausschreibungen sortieren“; „Treffer verstehen“ auf der Detailseite entfällt.
- Suchprofil: klare Aktionen „Ausschreibungen jetzt suchen“, „Suchprofil bearbeiten“ und „Firmeninfos neu recherchieren“. Suchaktionen zeigen sofort einen sichtbaren Wartezustand; erneute Firmenrecherche verwendet die aktuellen Formulareingaben und bestätigt die Aktualisierung mit Zeitpunkt. „Was Jarvis über die Firma gefunden hat“ ist standardmäßig geöffnet und als lesbare Karten dargestellt. Gesuchte Arbeiten kompakt als Kästchen, weitere per Dropdown oder eigener Eingabe; technische Suchfelder erst bei Bedarf bearbeiten.
- Ausschreibungssuche: offene Treffer sind nicht automatisch neu im letzten Lauf. Abschlusszeitpunkt und echte Neuzugänge getrennt anzeigen; Suchstatus automatisch aktualisieren, auch nach Rückkehr in die App. Arbeitsdropdown mit normaler Schrift, einheitlich linksbündigen Optionen und Suchfeld. KI-Treffer ab 6/10; ohne KI nur konkrete Leistungsbezüge, keine Treffer allein durch Ortsnamen oder allgemeine Wörter wie „Bad“. Aufräumen nur bei tatsächlich ausgewerteten Firmen und unbearbeiteten Treffern (`status=neu`); begonnene Angebote/Unterlagen bewahren. Budgetgrenzen bleiben unverändert.
- Registrierung: Firmenwebsite als „für bessere Ergebnisse empfohlen“ kennzeichnen, ohne Pflichtfeld. Nach E-Mail-Bestätigung direkt die automatische Firmenprüfung zeigen. Budgetfehler aus der SDK-Fehlerursache lesen, nie als bloßen „Connection error“ anzeigen. Unterbrochene Ersteinrichtung unter Firmenrechten merken und ohne neue Registrierung fortsetzen. Belegte eigene Niederlassungen mit Quellen getrennt von gewünschten Suchgebieten speichern, im Profil zeigen und ohne Dubletten im vorhandenen Organisationsbaum übernehmen; keine Kunden-/Projektorte als Firmenstandorte anlegen.
- **Suchgebiete, Entscheidung Benjamin 31.10.2026:** Standardmäßig alle belegten Firmenstandorte direkt als Suchorte aktivieren, auch bei bestehenden Profilen mit bisher nur dem Hauptsitz. Keine erneute Firmenrecherche nötig, wenn Standorte/PLZ bereits vorliegen. Nur eine ausdrücklich gewählte Einstellung „Nur ausgewählte Orte“ begrenzt die Suche. Bei überlappenden Standorten jeden Auftrag einmal zeigen. Standortmetadaten und Suchorte bleiben getrennte Felder, werden in der Automatik aber zusammengeführt.
- Erstbestand sofort vollständig sichtbar machen; danach täglich neue Funde melden. Keine Treffer künstlich zurückhalten, um spätere Nachrichten zu erzeugen. Neue Veröffentlichungen, nachträglich gefundene ältere Aufträge und wichtige Änderungen/Fristen getrennt benennen. Importlücken oder offene KI-Bewertungen als Zwischenstand zeigen, unbewertete Kandidaten nicht als fachlich abgelehnt archivieren. Tagesnachrichten bleiben an die vom Kunden eingeschalteten Kanäle gebunden.

## 3. Regeln
- **Strikte Trennung** von RestockHero (Repo Twista-hub/restockhero) und Demopin: eigene Repos, Datenbanken, Worker,
  Domains, Schlüssel, Mailadressen. Nichts davon in Jarvis verwenden.
- **Freigabe vor Außenwirkung, mit Dauererlaubnis für eigene Stellen (Benjamin 12.11.2026: „Du hast meine
  Dauererlaubnis“, danach ausdrücklich: „Trag die Dauererlaubnis so in die Regeln ein“):**
  - Ohne einzelnes OK: Website, App und App-Updates, Play-Store-Eintrag (Bilder, Texte) und Posts auf den eigenen
    Kanälen. Danach kurz sagen, was live ist.
  - Weiter nur mit OK von Benjamin: Geld ausgeben und kostenpflichtige Buchungen, Verträge und AGB annehmen,
    Rechnungen, Mails an Dritte.
  (Ausnahme wie bisher: die Benachrichtigungen, die Kunden in der App selbst eingeschaltet haben.)
- **Keine Passwörter, Schlüssel, Bank- oder Steuerdaten** eingeben, erzeugen lassen oder im Chat verlangen. Benjamin trägt
  sie selbst als GitHub-Secret oder beim Anbieter ein. Schlüssel nie in den Chat oder ins Repo.
- **Abos nur für eigene Arbeit.** Alles, was zahlende Kunden bekommen, läuft über die offizielle Anthropic-API
  (Secret ANTHROPIC_API_KEY). Keine Werkzeuge, die Abos als API weiterreichen.
- **Datenquellen:** Nutzungsbedingungen und robots.txt vor dem Abruf prüfen, Ergebnis in `alarm/quellen.md`.
  Sperren nie umgehen. DTVP und evergabe-online.de: kein automatischer Download (AGB bzw. Sperre), Kunden laden selbst.
- **Kosten:** harte Grenzen im Code (Tageslimit Uploads `TAGES_LIMIT`, Steckbriefe pro Lauf, KI-Budget je Firma und
  gesamt). API-Guthaben 100 $/Monat, unsere Bremse im Code liegt bei 90 $/Monat (`jarvis_katalog.ki_budget`) und
  11 $/Tag (`jarvis_katalog.ki_tageslimit`). Je Firma: Probe 5,50 $, alle kostenlosen Firmen zusammen 5 $/Monat,
  bezahlte Pläne 10/25/60 $. Nichts kaufen, keine bezahlte Werbung.
- **Kontingente schonen (Benjamin 10.11.2026):** keine Minuten oder Kontingente bei Supabase, Cloudflare oder anderen
  Diensten unnötig verbrauchen, also keine Abfrageschleifen gegen die Live-Datenbank. Das API-Guthaben ist für Kunden
  da: KI-Testläufe nur mit OK von Benjamin.
- **Kundengewinnung:** Geld kommt nur aus den Abos der Dienstleister; eine Seite für private Auftraggeber gibt es nicht.
  Keine Werbemails an Firmen ohne deren Einwilligung (§ 7 UWG). Benjamin ruft nicht an und verschickt keine Briefe.
  LinkedIn, OMR, G2 und GetApp sind abgehakt (Benjamin 08.11.2026): nicht wieder vorschlagen.
- Benjamins Telefonnummer kommt nicht ins Repo (öffentlich).
- Keine Modellnamen in Commits oder Code-Kommentaren nötig; Commits auf Deutsch, kurz, was und warum.

## 4. Was Jarvis ist
Ausschreibungs-Alarm für Firmen (erster Wunschkunde: PerLease GmbH, Zeitarbeit; Benjamin zeigt es als Überraschung, der
Kunde wird vorher nicht kontaktiert). Jeden Morgen öffentliche Ausschreibungen lesen, mit KI bewerten, Steckbriefe
schreiben, in die App eintragen, per Mail/Handy melden. Kunden laden Vergabeunterlagen hoch, Jarvis schreibt den
ausführlichen Steckbrief und rechnet den Angebotspreis.

## 5. Aufbau (alles online, nichts auf Benjamins PC)
| Teil | Wo | Datei/Ordner |
|---|---|---|
| Web-App (Konto, Treffer, Upload, Einrichtung, Rechtstexte, Handy-Nachrichten) | Cloudflare Worker `jarvis-alarm`: https://crewtender.eu (auch unter app.wpdigitalranger.com erreichbar) | `web/` (TypeScript, keine Frameworks, Seiten ohne fremde Skripte; nur `/app.js` und `/sw.js`) |
| Steckbrief aus Unterlagen | Cloudflare Workflow `jarvis-steckbrief`, Dateien in R2 `jarvis-auftraege` (EU, 30 Tage) | `web/src/workflow.ts` |
| Täglicher Alarm | GitHub Actions `alarm.yml` (04:17 und 07:41 UTC) | `alarm/alarm.py`, `ki.py`, `speichern.py`, `profile_db.py` |
| Tägliche Mail und Handy-Nachricht | GitHub Actions `mail.yml` (stündlich 7–20 Uhr) | `alarm/mail.py`, `alarm/push.py` |
| Datenbank, Login | Supabase-Projekt `jarvis`, Ref `juuuifrcxmitkqudqngq`, Frankfurt, Free | `supabase/migrations/`, Test `supabase/tests/rechte_test.sql` |
| Mail | kontakt@wpdigitalranger.com (Namecheap Private Email, SMTP mail.privateemail.com:465), DNS bei Cloudflare | `web/src/mail.ts` |
| Suchprofile | `alarm/profile.json` (von Hand) oder in der App gespeichert (Tabelle `suchprofile`, gewinnt) | |

Wichtige Daten-Regeln: Alle App-Zugriffe laufen mit dem Token der Person (Zeilenrechte/RLS). Firmen anlegen nur nach
Freischaltung (Tabelle `freigaben`). Rollen: inhaber, admin, bearbeiter, leser (kostenlos), mitarbeiter (nur persönlich freigegebene Texte). Funktionen wie Abteilungsleitung oder Facharbeiter sind unabhängig von Zugriffsrechten. Finanzdaten nur für Inhaber/Administration oder ausdrücklich berechtigte Leser/Bearbeiter. Mitarbeiter-Freigaben sind ausgewählte Textkopien mit Vorschau und Widerruf, keine Zugriffe auf Originalunterlagen/Kalkulation.
Firmenunterlagen/Vorlagen liegen unter `bibliothek/` in R2 (EU) bis zur Löschung, getrennt von den 30-Tage-Vergabeunterlagen. Angebotsmappen werden als Entwurf vorbereitet und heruntergeladen; die Abgabe erfolgt über den vorgeschriebenen Portalweg. Keine automatische Unterschrift oder Übermittlung ohne erlaubte Schnittstelle und Freigabe.
Jede neue Angebotsversion braucht vor dem Paketdownload die Freigabe durch Inhaber/Administration. Nach der manuellen Portalabgabe kann der Kunde Portalname und Eingangsbeleg in Jarvis protokollieren; das ist kein automatischer Abgabenachweis des Portals. Befristete Firmennachweise: Erinnerungen 30/14/7/2 Tage vorher nur an aktive Mitglieder mit Finanzzugriff und eingeschalteter Firmenmail.

Zentraler Vergabekatalog: eigener Worker `jarvis-katalog`, Workflow `jarvis-katalog-sammeln`, stündlich Minute 11 UTC; Code `web/src/katalog-*`, Konfiguration `web/wrangler-katalog.toml`. Öffentliche Bekanntmachungen gemeinsam, Firmenbewertungen/Feedback/Personal/Unterlagen/Ist-Ergebnisse getrennt. Partnerprofile ausschließlich mit Opt-in. Gemeinsames KI-Budgetledger in privatem Schema `jarvis_katalog` (Grenzen siehe Abschnitt 3, Kosten), bei nicht erreichbarer Budgetprüfung keine Kunden-API-Anfragen. Quellen-/Speicher-/Importgrenzen einhalten; keine kostenpflichtigen Pläne automatisch buchen. Datenbankmigrationen auf main werden nach erfolgreicher Rechteprüfung und Probelauf automatisch eingespielt (Benjamins Auftrag, alles autonom auszurollen); manuelle Datenbankläufe behalten die Bestätigung EINSPIELEN. Neue Worker-/Web-Ausrollungen prüfen das benötigte Schema vor Aktivierung.

GitHub-Hintergrundjobs verwenden bevorzugt den Supabase-Transaktionspool (6543, ohne vorbereitete Statements); Cursor und `SET LOCAL` bleiben in ihren Transaktionen. Der Sitzungspool (5432) ist für Hyperdrive knapp (15 Plätze). Scheitert beim Ausrollen nur die erneute Prüfung mit `EMAXCONNSESSION`, darf eine vorhandene Konfiguration ausschließlich bei unverändertem Ziel, verifiziertem CA-Zertifikat, deaktiviertem Cache und gleichem Verbindungslimit wiederverwendet werden. Keine Zugangsdaten ausgeben, keine andere Datenbank als Ersatz verwenden.

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
