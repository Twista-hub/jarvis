# Protokoll des Browser-Chats

Neueste Einträge oben. Keine Passwörter oder Codes (öffentliches Repo).

## Konten-Übersicht Crewtender
| Dienst | Name / @ | Status | Link |
|---|---|---|---|
| Domain crewtender.eu | Namecheap → Cloudflare | gekauft 03.11.2026 (Benjamin), Cloudflare aktiv | |
| E-Mail hello@crewtender.eu | Cloudflare Email Routing → kontakt@wpdigitalranger.com | aktiv 03.11.2026 | |
| Instagram | @crew_tender (Unternehmenskonto, Kategorie Software; Anmeldung mit kontakt@wpdigitalranger.com, laut Benjamin 03.11.) | angelegt 03.11.2026 (Benjamin), eingerichtet | https://www.instagram.com/crew_tender/ |
| Facebook-Seite | Crewtender (Kategorie Software) | angelegt 03.11.2026 unter Benjamins persönlichem Profil | https://www.facebook.com/profile.php?id=61596423171638 |
| LinkedIn-Seite | – | gesperrt bis frühestens 04.11.2026 (neues Konto, LinkedIn verlangt 1 Tag Wartezeit) | |
| Bluesky | @crewtender.eu (Anmeldung kontakt@wpdigitalranger.com) | angelegt 03.11.2026 (Benjamin), eingerichtet, Domain-Handle verifiziert, E-Mail bestätigt | https://bsky.app/profile/crewtender.eu |
| Mastodon | @crewtender@mastodon.social (Anmeldung kontakt@wpdigitalranger.com) | angelegt 03.11.2026 (Benjamin), eingerichtet | https://mastodon.social/@crewtender |

## Regel für Anmeldungen (Benjamin, 03.11.2026)
- **Alle Crewtender-Konten werden mit kontakt@wpdigitalranger.com angemeldet** (eine Adresse, echtes Postfach).
- hello@crewtender.eu ist nur die **öffentliche** Kontaktadresse in Profilen und auf der Website (leitet an kontakt@ weiter).

## Einträge

### 03.11.2026 – Browser-Chat: Bluesky und Mastodon
- **Bluesky:** RestockHero war angemeldet, deshalb über „Weiteren Account hinzufügen“ gearbeitet, an RestockHero nichts geändert. Benjamin hat das Konto mit kontakt@wpdigitalranger.com angelegt (crewtender.bsky.social).
- Profil: Anzeigename „Crewtender“, Logo (profil.png), Banner (facebook-titel.png), Bio „Find public tenders, write bids, plan your crew – the app for trades and service companies. 🌐 crewtender.eu · ✉️ hello@crewtender.eu“.
- Handle auf **@crewtender.eu** umgestellt: Cloudflare-DNS TXT `_atproto` angelegt (Wert `did=did:plc:b3idabsinmfvxsddvyr4i23h`, öffentlich), Bluesky meldet „Domain verifiziert“. MX- und Mail-TXT-Einträge nicht angefasst. E-Mail von Benjamin bestätigt.
- **Mastodon:** Mit Benjamins OK RestockHero bei mastodon.social abgemeldet (Wiederanmeldung macht Benjamin). Benjamin hat **@crewtender@mastodon.social** mit kontakt@wpdigitalranger.com angelegt.
- Profil: Anzeigename „Crewtender“, Logo, Banner (beide mit Bildbeschreibung), gleiche Bio. Zusatzfelder: Website → https://crewtender.eu, Legal notice → https://crewtender.eu/impressum.
- Nichts gepostet, keine Nachrichten.

### 03.11.2026 – Claude Code: Umzug abgeschlossen
- Alle Links in App und Mails zeigen auf https://crewtender.eu, app.wpdigitalranger.com leitet weiter. Website-Felder in Facebook/LinkedIn/Instagram bleiben https://crewtender.eu.

### 03.11.2026 – Browser-Chat: Supabase umgestellt (Schritt 7)
- Mit Benjamins OK im Projekt jarvis → Authentication → URL Configuration: **Site URL** `https://crewtender.eu` gespeichert („Successfully updated site URL“).
- **Redirect URL** `https://crewtender.eu/**` hinzugefügt. Die Einträge `https://app.wpdigitalranger.com/**` und `https://jarvis-alarm.benschiffer79.workers.dev/**` bleiben stehen (jetzt 3 URLs).
- → Claude Code Bescheid geben: **Supabase umgestellt**.

### 03.11.2026 – Claude Code: crewtender.eu ist live
- https://crewtender.eu zeigt die App, https://crewtender.eu/impressum das Impressum, www leitet weiter. app.wpdigitalranger.com läuft parallel.
- Nächster Auftrag: Schritt 7 in `docs/auftraege/crewtender-domain.md` (Supabase URL-Konfiguration).

### 03.11.2026 – Browser-Chat: Instagram
- Benjamin hat das Konto mit hello@crewtender.eu angelegt. Benutzername **@crew_tender** („crewtender“ war vergeben), Name „crewtender“.
- Profilbild (Logo), Bio auf Englisch: „Find public tenders, write bids, plan your crew – for trades & service companies. 🌐 crewtender.eu · ✉️ hello@crewtender.eu“. Link crewtender.eu ist im Profil sichtbar.
- Auf Unternehmenskonto umgestellt, Kategorie Software (sichtbar). Öffentlicher Kontakt nur E-Mail hello@crewtender.eu, keine Telefonnummer, keine Adresse. Nicht mit RestockHero (@restockhero6) oder dessen Meta-Portfolio verknüpft, nichts gepostet.
- LinkedIn: Benjamin hat das Titelbild fürs persönliche Profil hochgeladen.

### 03.11.2026 – Browser-Chat: Links auf crewtender.eu umgestellt
- Auf Benjamins Wunsch überall https://crewtender.eu statt app.wpdigitalranger.com: Facebook-Link, LinkedIn-Kontaktinfo (Website, Geschäftlich).
- Facebook-Impressum jetzt ohne persönlichen Namen: „Crewtender ist ein Angebot von WP Digital Ranger. Impressum: https://crewtender.eu/impressum“. Der volle Name steht nur auf der Impressum-Seite selbst (Pflicht beim Einzelunternehmen).
- **Für Claude Code:** crewtender.eu zeigt noch die Namecheap-Weiterleitung (A-Record + www-CNAME), https antwortet nicht. Die App muss auf https://crewtender.eu laufen, und https://crewtender.eu/impressum muss das Impressum zeigen.

### 03.11.2026 – Browser-Chat: LinkedIn
- Benjamin hat ein persönliches LinkedIn-Konto angelegt (mit seiner geschäftlichen Adresse bei WP Digital Ranger).
- Profil eingerichtet (Englisch): Headline „Founder of Crewtender · Public tenders & crew planning for trades and service companies | WP Digital Ranger“, Branche Softwareentwicklung, Info-Text (Handwerk/Bau zuerst, dann Reinigung, Sicherheit, Personal, Catering), Website https://app.wpdigitalranger.com (Geschäftlich). Premium und Verifizierung nicht genutzt.
- Titelbild fürs persönliche Profil: `docs/design/crewtender/linkedin-profil-titel.png` (1584×396). Lädt Benjamin selbst hoch (LinkedIn öffnet nur den Datei-Dialog). Profilfoto: echtes Foto von Benjamin, nicht das Logo.
- Facebook-Bio auf Handwerk erweitert: „Find public tenders, write bids, plan your crew – the app for trades and service companies: construction, cleaning, security, staffing and catering.“
- Unternehmensseite noch nicht möglich: LinkedIn meldet „Funktion nicht verfügbar … warten Sie bitte mindestens einen Tag“. Ab 04.11.2026 erneut versuchen.

### 03.11.2026 – Browser-Chat: Bilder und Facebook-Seite
- Bilder erstellt (Farben der WP-Digital-Ranger-Marke, Zeichen: offenes „C“ mit Häkchen und zwei „Crew“-Punkten): `docs/design/crewtender/` → profil.png (1080×1080), facebook-titel.png (1640×624), linkedin-titel.png (1128×191), crewtender-zeichen.svg.
- Facebook-Seite „Crewtender“ angelegt, als Benjamin Schiffer (nicht unter Demopin oder RestockHero). Bio auf Englisch (Short bio aus dem Auftrag, Benjamins Wunsch: international), Website https://app.wpdigitalranger.com, E-Mail hello@crewtender.eu, Impressum-Text mit Link auf https://app.wpdigitalranger.com/impressum. Profil- und Titelbild hochgeladen. WhatsApp nicht verknüpft, keine Freunde eingeladen, keine Werbe-Mails, nichts gepostet.

### 03.11.2026 – Browser-Chat: crewtender.eu bei Cloudflare
- Cloudflare-Konto geprüft: „Benschiffer79@gmail.com's Account“ (darin liegen wpdigitalranger.com und der Worker jarvis-alarm).
- crewtender.eu hinzugefügt, Tarif Free, DNS-Scan bestätigt (Namecheap-Parkeinträge: 1 A, 1 CNAME, 5 MX, 1 TXT).
- Cloudflare-Nameserver: `hugh.ns.cloudflare.com`, `irma.ns.cloudflare.com`. Nächster Schritt: bei Namecheap eintragen.
- Namecheap: Nameserver auf Custom DNS (hugh/irma.ns.cloudflare.com) umgestellt.
- Cloudflare-Status: **Active** („Your domain is now protected by Cloudflare“), 03.11.2026. Nächster Schritt: Email Routing.
- Email Routing: Zieladresse kontakt@wpdigitalranger.com hinzugefügt, von Benjamin bestätigt.
- Regel **hello@crewtender.eu → kontakt@wpdigitalranger.com** angelegt, Status Active.
- Mit Benjamins OK die 6 vom DNS-Scan übernommenen Namecheap-Mail-Einträge gelöscht (MX eforward1–5.registrar-servers.com, TXT spf.efwd). Danach die Cloudflare-Einträge hinzugefügt: MX route1–3.mx.cloudflare.net, SPF, DKIM. A- und www-CNAME der Namecheap-Parkseite sind noch da, die räumt Claude Code auf.
- Catch-all bleibt vorerst aus (optional, nach Benjamins Entscheidung).
- **Stand Auftrag crewtender-domain: Domain gekauft 03.11.2026, Cloudflare-Konto Benschiffer79@gmail.com's Account, Status Active, hello@crewtender.eu aktiv.** → Claude Code Bescheid geben: Domain fertig.

### 03.11.2026 – Claude Code
- Ordner angelegt. Auftrag: `docs/auftraege/crewtender-konten.md`.
