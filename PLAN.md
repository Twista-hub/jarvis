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

## Erstes Geschäft: Ausschreibungs- und Förder-Alarm

**Was:** Jarvis liest täglich öffentliche Ausschreibungen (TED, deutscher Bekanntmachungsservice, Länderportale) und Förderprogramme, filtert nach Kundenprofil, bewertet mit KI und schickt morgens eine Mail plus Push mit Zusammenfassung, Frist, Nachweisen und Punktzahl.

**Für wen:**
1. WP Digital Ranger selbst: IT, Webseiten, Apps, Barrierefreiheit.
2. Pilotkunde Perlease (Personal für Events, Messen, Hotels, Catering; 19 Standorte).
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
| 0 | Plan ins Repo. RestockHero-Deploys (Cloudflare, Supabase, Android) auf GitHub Actions | PC kann aus bleiben | offen |
| 1 | Ausschreibungs-Alarm per Mail: zuerst WP Digital Ranger, dann Perlease | echte Treffer prüfen | offen |
| 2 | Webseite: Login, Profil, Vertrag per Klick, Stripe, App-Ansicht mit 👍/👎 | erste zahlende Kunden | offen |
| 3 | Angebotsentwürfe, Zuschlags-Abgleich, Provisionsrechnung, Play-Store-App | volles Produkt | offen |
| 4 | Telegram-Briefing und Freigaben für alle Projekte, optional Hermes | Jarvis-Gefühl | offen |

## Offene Entscheidungen

- [ ] Name und Domain für den Alarm
- [ ] Freund bei Perlease fragen (Ausschreibungen? Hotel- und Event-Leads?)
- [ ] Wie mit Jarvis reden: nur Telegram-Knöpfe oder freier Chat (Hermes)?
- [ ] Rechte von Jarvis bestätigen: lesen, planen, programmieren, Entwürfe; Senden, Bezahlen und Veröffentlichen nur mit OK
