# Deine nächsten Schritte (Stand 29.10.2026)

Reihenfolge nach Wichtigkeit. Schlüssel und Passwörter nie in den Chat, nur in GitHub oder beim Anbieter eintragen.

## 1. Cloudflare-Schlüssel für Jarvis (5 Min.) → Upload-Seite mit Kalkulation geht online
1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → unten bei „Custom token“ **Get started**
2. Name: `Jarvis Upload-Seite`
3. Permissions (jeweils links **Account**, weitere Zeilen mit **+ Add more**):
   Workers Scripts → Edit · Workers R2 Storage → Edit · Workers AI → Read · Account Settings → Read · (falls vorhanden) Workflows → Edit
4. Account Resources: **Include** → dein Konto
5. **Continue to summary** → **Create Token** → Schlüssel kopieren
6. https://github.com/Twista-hub/jarvis/settings/secrets/actions/new → Name `CLOUDFLARE_API_TOKEN` → einfügen → **Add secret**
7. Noch einmal den Link: Name `CLOUDFLARE_ACCOUNT_ID`, Wert von https://dash.cloudflare.com → **Workers & Pages** → rechts „Account ID“ → **Add secret**

## 2. Mail-Postfach für WP Digital Ranger (10 Min., ca. 1–2 €/Monat) → Anfragen an Portale, Login-Mails
1. https://www.namecheap.com/hosting/email/ → bei **Starter** auf **Get Started**
2. **Use a domain I own** → `wpdigitalranger.com` → bezahlen
3. Adresse anlegen, z. B. `info`, Passwort selbst vergeben
4. Claude Bescheid sagen. Danach kommen die Einträge für Cloudflare (MX, SPF, DKIM).

## 3. Supabase-Projekt „jarvis“ (5 Min., kostenlos) → Login, Firmen, Standorte, Mitarbeiter
1. https://supabase.com/dashboard/new
2. **Create a new organization** → Name `WP Digital Ranger` → Plan **Free**
3. Projektname `jarvis`, Region **Central EU (Frankfurt)**, Datenbank-Passwort selbst vergeben
4. **Create new project** → Claude den Link aus der Browserzeile schicken

## 4. Anthropic-Limit (2 Min.)
https://console.anthropic.com/settings/limits → Spend limit → **Change limit** → 20 $

## Danach erledigt Claude
- Upload-Seite online stellen und mit den Bundesbank-Unterlagen testen
- Anfragen an DTVP/cosinex schicken (nur nach deinem OK)
- Login, Einladungen, Trefferliste pro Standort, Verwaltung bauen
