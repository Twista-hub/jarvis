# Jarvis – Hinweise für Claude

## Nutzer
- Benjamin Schiffer, Firma „WP Digital Ranger“ (Einzelunternehmen, Nebenerwerb). Schreibt Deutsch, locker und schnell, oft vom Handy; Tipp- und Diktierfehler sind normal.
- Firmendaten (Impressum): Rochusstraße 19, 52531 Übach-Palenberg (NRW). Kleinunternehmer nach § 19 UStG, Steuernummer über Elster beantragt (Stand 30.10.2026), keine USt-IdNr. Telefon vorerst nicht veröffentlichen. Gespeichert in `web/src/rechtliches.ts` (`FIRMA`).
- Kein Konsolen-Fan. Für Schritte im Browser immer den direkten Link und den genauen Buttontext schicken.
- Antworten auf Deutsch, kurz, Wichtigstes zuerst.

## Arbeitsteilung (seit 03.11.2026, ChatGPT ist raus)
- ChatGPT/Codex wird nicht mehr genutzt. Claude Code programmiert; ein eigener Claude-Chat mit Browser-Steuerung erledigt Arbeiten im Browser (Konten, Formulare). Aufträge dafür liegen in `docs/auftraege/`.
- Gemeinsame Anleitung: `AGENTS.md`. Gemeinsames Gedächtnis: `docs/stand.md`. Zu Beginn jeder Sitzung beide lesen, am Ende `docs/stand.md` (Stand, offene Punkte, Protokoll) aktualisieren, committen, pushen.
- Die App heißt nach außen **Crewtender** (seit 03.11.2026); technische Namen (Repo, Datenbank `jarvis_*`, Worker, Bucket) bleiben „jarvis“.

## Projekt
- Jarvis ist das KI-Gehirn für Benjamins Firma. Plan, Regeln und Phasen stehen in `PLAN.md`. Zu Beginn jeder Sitzung lesen.
- Alles läuft komplett online (GitHub, GitHub Actions, Cloudflare, Supabase Frankfurt, Telegram). Nichts darf an Benjamins PC hängen.

## Regeln
- Strikte Trennung von RestockHero (Twista-hub/restockhero) und Demopin: eigene Repos, Datenbanken, Worker, Domains, Schlüssel.
- Mails an Dritte, Posts, Veröffentlichungen, Rechnungen und Ausgaben nur nach OK von Benjamin.
- Keine Passwörter, Schlüssel, Bank- oder Steuerdaten eingeben; das macht Benjamin selbst.
- Claude- und ChatGPT-Abo nur für eigene Arbeit. Alles für zahlende Kunden läuft über die offizielle API. Keine Werkzeuge, die Abos als API weiterreichen.
- Datenquellen: Nutzungsbedingungen und robots.txt vor dem Abruf prüfen.
