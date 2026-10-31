# Jarvis – Plan

Stand 29.10.2026. Besitzer: Benjamin Schiffer, WP Digital Ranger.

## Ziel

Ein KI-Gehirn, das komplett online läuft. Es plant, verteilt Aufgaben, programmiert und betreibt Projekte. Benjamin braucht nur Handy oder Browser und entscheidet über Geld, Verträge und Veröffentlichungen.

## Grundregeln

1. **Komplett online.** Kein Dienst, Deploy oder Datenbestand hängt an Benjamins PC.
2. **Strikte Trennung.** Jarvis, RestockHero und Demopin haben je eigene Repos, Datenbanken, Worker, Domains und Schlüssel. Jarvis greift auf andere Projekte nur über eng begrenzte Zugänge zu.
3. **Freigabe vor Außenwirkung.** Mails an Dritte, Posts, Veröffentlichungen, Rechnungen und Ausgaben nur nach OK von Benjamin (Telegram-Knopf).
4. **Keine Passwörter, Bank- oder Steuerdaten.** Die gibt Benjamin selbst ein.
5. **Abos nur für eigene Arbeit.** Claude-Code- und ChatGPT-Abo für Gehirn und Helfer. Alles, was zahlende Kunden bekommen, läuft über die offizielle API. Keine Werkzeuge, die Abos als API weiterreichen (z. B. OmniRoute).
6. **Agenten zum Denken, fester Code für das Produkt.** Tägliche Kundenabläufe sind normaler, geprüfter Code.
7. **Harte Kostengrenze** pro Tag und Monat im Code, dazu ein Not-Aus.
8. **Alles wird protokolliert** (Aufgaben, Entscheidungen, Kosten).

## Aufbau

| Teil | Womit | Kosten |
|---|---|---|
| Gehirn: planen, verteilen, programmieren, deployen | Claude Code (Abo): geplante Aufgaben und Cloud-Sitzungen | im Abo |
| Gedächtnis | dieses Repo (Pläne, Regeln, Protokoll), später Supabase-Projekt „jarvis“ (Frankfurt) | 0 € |
| Helfer: Recherche, Mails, Konten | Codex (ChatGPT-Abo), Cloud-Aufgaben | im Abo |
| Deploys | GitHub Actions | 0 € |
| Schlüssel | GitHub-, Cloudflare- und Supabase-Secrets; Sicherung in Bitwarden | 0 € |
| Freigaben, Briefing | Telegram-Bot | 0 € |
| Optional: frei mit Jarvis chatten | Hermes Agent, gehostet, mit günstigem API-Modell, nur lesen und Aufgaben anlegen | ca. 10–20 €/Monat |

Budget gesamt: höchstens 100 €/Monat ohne die bestehenden Abos.

### Wo Jarvis lebt

Kein eigener Server. Jarvis ist auf Clouddienste verteilt, die ohne Wartung laufen:
- **Gedächtnis und Code:** GitHub (dieses Repo), Daten in Supabase (Frankfurt).
- **Denken:** Claude-Code-Cloud-Sitzungen. Sie starten bei Bedarf oder nach Zeitplan, arbeiten und enden. Was bleibt, steht im Repo oder in der Datenbank.
- **Dauerdienste** (Alarm, Telegram-Bot, Cockpit): Cloudflare Workers, ohne Server und ohne Updates.
- **Hetzner o. Ä.** (ca. 5 €/Monat) nur, falls später etwas rund um die Uhr laufen muss, z. B. ein selbst gehosteter Hermes.

### Mit Jarvis reden

| Weg | Wofür | Reaktion |
|---|---|---|
| Claude-App (Repo `jarvis`), auch per Sprache | alles: planen, bauen, ändern | sofort |
| Telegram-Bot je Projekt (eigener Bot und eigenes Secret) | Briefing, OK/Nein-Knöpfe, `/status`, `/aufgabe …` | Knöpfe sofort, Aufgaben beim nächsten Lauf (höchstens ca. 1 Std.) |
| Cockpit-Webseite (PWA) | Überblick: Aufgaben, Freigaben, Kosten, Kunden | sofort |
| Mail an eigene Jarvis-Adresse | Mail weiterleiten → wird Aufgabe | beim nächsten Lauf |

### Selbstheilung (Wächter)

Probleme erkennt und behebt Jarvis selbst. Benjamin wird nur informiert oder gebraucht, wenn es nicht anders geht.

1. **Erkennen:** Ein Wächter (Cloudflare, alle 5–15 Min.) prüft feste Kennzahlen je Projekt, z. B. letzter Post, Alter des Katalogs, Worker-Fehler, Antworten von Make/Buffer, Morgenmail verschickt.
2. **Melden:** Störung wird in der Datenbank angelegt, Telegram: „Problem erkannt, ich kümmere mich.“
3. **Untersuchen:** Der nächste Jarvis-Lauf (spätestens nach ca. 1 Std.) liest Logs und findet die Ursache.
4. **Beheben, in drei Stufen:**
   - **A – ohne Rückfrage:** erneut senden, Cache neu bauen, Token automatisch erneuern, Shop bei Sperre/403 deaktivieren.
   - **B – Code-Fehler:** Fix schreiben, Tests laufen lassen, automatisch deployen, wenn Tests grün und Änderung klein. Prüft der Wächter danach wieder rot → automatisch zurückrollen. Größere Änderungen nur mit OK.
   - **C – braucht Benjamin:** Passwort, Kontosperre, Zahlung, rechtliche Fragen. Telegram mit direktem Link und Buttontext.
5. **Bericht:** Was war, was wurde gemacht, kurz per Telegram.

Am Anfang mehr Stufe B mit OK, mit wachsendem Vertrauen mehr ohne Rückfrage.

## Erstes Geschäft: Ausschreibungs- und Förder-Alarm

**Was:** Jarvis liest täglich öffentliche Ausschreibungen (TED, deutscher Bekanntmachungsservice, Länderportale) und Förderprogramme, filtert nach Kundenprofil, bewertet mit KI und schickt morgens eine Mail plus Push mit Zusammenfassung, Frist, Nachweisen und Punktzahl.

**Für wen:**
1. WP Digital Ranger selbst: IT, Webseiten, Apps, Barrierefreiheit.
2. Pilotkunde Perlease (Personal für Events, Messen, Hotels, Catering; 19 Standorte). Wird ohne Vorabfrage gebaut, als Überraschung: Benjamin zeigt fertige Morgenmails mit echten Treffern. Nichts geht ohne Benjamin an Perlease.
3. Danach weitere Personaldienstleister in Gastro und Events, später andere Branchen.

**Zusatz:** Vertriebs-Alarm mit neuen Hotels, Messen und Events an den Standorten des Kunden.

**Preise (Vorschlag):**

| Paket | Inhalt | Monatlich | Bei Zuschlag |
|---|---|---|---|
| Basis | Alarm, Zusammenfassungen, Fristen | 149–249 € | – |
| Pro | dazu Unterlagen-Analyse, Prüfliste, Angebotsentwurf | 399–699 € | 1–3 % |
| Erfolg | niedrige Grundgebühr | 99 € | 3–5 % |

Provision gedeckelt (z. B. erstes Vertragsjahr). Zuschläge erkennt Jarvis über veröffentlichte Vergabebekanntmachungen; zusätzlich Meldepflicht im Vertrag.
Perlease: 2 Monate kostenlos, danach z. B. 199 € + 1,5 %. Preis erst nennen, wenn die Treffer überzeugen.

**Technik:** Web-App (PWA) auf Cloudflare, später Play Store. Login und Daten in Supabase (Frankfurt). Vertrag per Klick (nur Firmen, USt-ID-Prüfung über VIES, Zustimmung mit Version und Zeitstempel gespeichert, PDF per Mail). Bezahlung über Stripe (SEPA, Karte). Provisionsrechnung als Entwurf, Freigabe per Telegram. Angebote reicht der Kunde selbst ein.

**Rechtlich:** keine Werbe-Mails ohne Einwilligung (UWG §7), Kunden über Landingpage, SEO und Empfehlungen. AGB, Provisionsvereinbarung, Datenschutz und Impressum: Claude entwirft, Anwalt oder IHK prüft. Für jede Datenquelle Nutzungsbedingungen und robots.txt prüfen. Umsatzgrenze der Kleinunternehmerregelung beobachten.

## Phasen

| Phase | Was | Ergebnis | Status |
|---|---|---|---|
| 0 | Plan ins Repo. RestockHero-Deploys (Cloudflare, Supabase, Android) auf GitHub Actions. Wächter für RestockHero | PC kann aus bleiben, Störungen werden erkannt | läuft: Abläufe Prüfen/Ausrollen/Zurückrollen/Datenbank in RestockHero (#56, #57), Secrets gesetzt 29.10. Migrations-Historie bereinigt 29.10. (#58), Regeln für Codex in AGENTS.md. Live-Abgleich: live = main, erstes Ausrollen über GitHub 29.10. mit Seitentest und Auto-Rückweg (#60, #61). Seit 29.10.: automatisches Ausrollen bei Merge, Wächter `restockhero-waechter` läuft alle 10 Min. (#62, #63). Selbstheilung läuft: Wächter-Runde (Claude, alle 3 Std., Regelwerk restockhero `docs/automation/selbstheilung.md`). Offen: Telegram-Bot verbinden, Android |
| 1 | Ausschreibungs-Alarm per Mail: zuerst WP Digital Ranger, dann Perlease | echte Treffer prüfen | läuft: täglicher Bericht `alarm/berichte/` seit 29.10. (Quelle Bekanntmachungsservice, CC0), KI-Bewertung 1–10 und bis zu 2 Steckbriefe pro Tag mit Claude Opus (`alarm/steckbriefe/`, Kostenbremse 3 $/Lauf). DTVP-Unterlagen nicht automatisch laden (AGB, siehe `alarm/quellen.md`). Upload-Seite für Kunden-Unterlagen (`web/`, Worker jarvis-alarm: R2 EU, Workers AI liest PDFs, Claude schreibt den Steckbrief, Löschung nach 30 Tagen). Offen: Fristen (eForms), Zustellung per Mail/Telegram, Anwaltsfrage Kunden-Unterlagen |
| 2 | Webseite: Login, Firmen mit Bereichen (Standorte/Abteilungen) und Rollen, Abrechnung pro Nutzer, Vertrag per Klick, Stripe, App-Ansicht mit 👍/👎 | erste zahlende Kunden | begonnen: Rechte-Schema getestet (`docs/app-konzept.md`). Offen: Supabase-Projekt „jarvis“ (Frankfurt), Login, Oberfläche |
| 3 | Angebotsentwürfe, Zuschlags-Abgleich, Provisionsrechnung, Play-Store-App | volles Produkt | offen |
| 4 | Telegram-Briefings und Freigaben je Projekt mit eigenem Bot und eigenen Zugangsdaten; optional Hermes | Jarvis-Gefühl | offen |

## Offene Entscheidungen

- [ ] Name und Domain für den Alarm
- [x] Perlease nicht vorab fragen, Überraschung (29.10.)
- [ ] Wie mit Jarvis reden: nur Telegram-Knöpfe oder freier Chat (Hermes)?
- [ ] Eigenständigen Telegram-Bot „Jarvis“ anlegen; sein Token kommt ausschließlich in ein Jarvis-eigenes Cloudflare-Worker-Secret (`JARVIS_TELEGRAM_TOKEN`). Kein Bot-Token oder Konto aus RestockHero oder Demopin verwenden. Benjamin legt den Bot später an.
- [ ] Rechte von Jarvis bestätigen: lesen, planen, programmieren, Entwürfe; Senden, Bezahlen und Veröffentlichen nur mit OK
