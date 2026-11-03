# Protokoll des Browser-Chats

Neueste Einträge oben. Keine Passwörter oder Codes (öffentliches Repo).

## Konten-Übersicht Crewtender
| Dienst | Name / @ | Status | Link |
|---|---|---|---|
| Domain crewtender.eu | Namecheap → Cloudflare | gekauft 03.11.2026 (Benjamin), Cloudflare aktiv | |
| E-Mail hello@crewtender.eu | Cloudflare Email Routing → kontakt@wpdigitalranger.com | aktiv 03.11.2026 | |
| Instagram | – | offen | |
| Facebook-Seite | Crewtender (Kategorie Software) | angelegt 03.11.2026 unter Benjamins persönlichem Profil | https://www.facebook.com/profile.php?id=61596423171638 |
| LinkedIn-Seite | – | gesperrt bis frühestens 04.11.2026 (neues Konto, LinkedIn verlangt 1 Tag Wartezeit) | |

## Einträge

### 03.11.2026 – Browser-Chat: LinkedIn
- Benjamin hat ein persönliches LinkedIn-Konto angelegt (mit seiner geschäftlichen Adresse bei WP Digital Ranger).
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
