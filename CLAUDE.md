# Jarvis – Hinweise für Claude

## Nutzer
- Benjamin Schiffer, Firma „WP Digital Ranger“ (Einzelunternehmen, Nebenerwerb). Schreibt Deutsch, locker und schnell, oft vom Handy; Tipp- und Diktierfehler sind normal.
- Firmendaten (Impressum): Rochusstraße 19, 52531 Übach-Palenberg (NRW). Kleinunternehmer nach § 19 UStG, Steuernummer über Elster beantragt (Stand 30.10.2026), USt-IdNr. DE466249844 (seit 03.11.2026, im Impressum und auf Kundenrechnungen). Telefon vorerst nicht veröffentlichen. Gespeichert in `web/src/rechtliches.ts` (`FIRMA`).
- Kein Konsolen-Fan. Für Schritte im Browser immer den direkten Link und den genauen Buttontext schicken.
- Aufträge für den Browser-Chat immer vollständig als Kopiertext direkt in die Antwort schreiben (nicht nur auf eine Datei verweisen); die Datei in `docs/auftraege/` zusätzlich pflegen.
- Antworten auf Deutsch, kurz, Wichtigstes zuerst.

## Arbeitsteilung
- Claude Code programmiert; ein eigener Claude-Chat mit Browser-Steuerung erledigt Arbeiten im Browser (Konten, Formulare). Aufträge dafür liegen in `docs/auftraege/`, seine Rückmeldungen in `docs/browser/protokoll.md` (öffentliches Repo, keine Passwörter). ChatGPT/Codex arbeitet nicht mehr mit; ältere Einträge mit „ChatGPT“ sind Geschichte.
- Gemeinsame Anleitung: `AGENTS.md`. Gemeinsames Gedächtnis: `docs/stand.md`.
- Zu Beginn einer Sitzung lesen: `AGENTS.md` und in `docs/stand.md` die Abschnitte „Aktueller Stand“ und „Offene Punkte“. Die Datei ist rund 300 KB groß; das Protokoll darunter ist das Archiv, darin gezielt nach Stichwort suchen statt alles zu lesen. `docs/browser/protokoll.md` (neueste Einträge) lesen, wenn ein Auftrag an den Browser-Chat offen ist oder die Aufgabe Konten und Formulare betrifft.
- Am Ende einer Sitzung oder nach einem größeren Schritt `docs/stand.md` (Stand, offene Punkte, Protokoll) aktualisieren, committen, pushen: der Browser-Chat und die nächste Sitzung sehen diesen Chat nicht.
- Anmeldungen für Crewtender-Konten immer mit **kontakt@wpdigitalranger.com**; hello@crewtender.eu ist nur die öffentliche Adresse (Weiterleitung an kontakt@).
- Die App heißt nach außen **Crewtender** (seit 03.11.2026); technische Namen (Repo, Datenbank `jarvis_*`, Worker, Bucket) bleiben „jarvis“.

## Projekt
- Dieses Repo ist das Produkt Crewtender: öffentliche Ausschreibungen finden, kalkulieren, Team einplanen (Aufbau in `AGENTS.md` Abschnitt 5). `PLAN.md` ist der ursprüngliche Plan vom 29.10.2026: Die Grundregeln dort gelten weiter, der Phasenstand ist überholt; aktuell ist `docs/stand.md`.
- Alles läuft komplett online (GitHub, GitHub Actions, Cloudflare, Supabase Frankfurt, Telegram). Nichts darf an Benjamins PC hängen.

## Regeln
- Strikte Trennung von RestockHero (Twista-hub/restockhero) und Demopin: eigene Repos, Datenbanken, Worker, Domains, Schlüssel.
- Dauererlaubnis (Benjamin 12.11.2026, auf seine ausdrückliche Anweisung eingetragen): Veröffentlichungen an eigenen Stellen (Website, App und App-Updates, Play-Store-Eintrag, Posts auf eigenen Kanälen) ohne einzelnes OK; danach kurz sagen, was live ist. Weiter nur mit OK von Benjamin: Ausgaben und kostenpflichtige Buchungen, Verträge und AGB, Rechnungen, Mails an Dritte.
- Keine Passwörter, Schlüssel, Bank- oder Steuerdaten eingeben; das macht Benjamin selbst.
- Claude- und ChatGPT-Abo nur für eigene Arbeit. Alles für zahlende Kunden läuft über die offizielle API. Keine Werkzeuge, die Abos als API weiterreichen.
- Datenquellen: Nutzungsbedingungen und robots.txt vor dem Abruf prüfen.
