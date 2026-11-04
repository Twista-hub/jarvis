# Auftrag an den Browser-Chat: crewtender.eu in der Google Search Console anmelden

Stand 04.11.2026 (Claude Code). Bisher ist crewtender.eu dort **nicht** angemeldet. Die Seiten sind indexierbar
(robots.txt mit Sitemap-Zeile, keine noindex-Sperre auf öffentlichen Seiten).

## Regeln
- Neuer Tab. Google-Konto für Crewtender: **kontakt@wpdigitalranger.com** (Regel für alle Crewtender-Konten). Gibt es dafür noch
  kein Google-Konto: https://accounts.google.com/signup → „Konto erstellen“ → „Für meine Arbeit oder mein Unternehmen“ →
  „Stattdessen meine aktuelle E-Mail-Adresse verwenden“. Passwort, Codes und Bestätigungsmail macht Benjamin.
- **Nicht** das RestockHero-Konto (restockhero.contact@gmail.com) und nicht dessen Search Console verwenden.
- Nichts bezahlen, keine Google-Ads-Konten anlegen, an RestockHero nichts ändern.

## 1. Domain-Property anlegen
1. https://search.google.com/search-console/welcome → links **„Domain“** → `crewtender.eu` → „Weiter“.
2. Google zeigt einen **TXT-Eintrag** (`google-site-verification=…`). Bietet Google „Cloudflare“ zur automatischen Bestätigung an,
   diesen Weg nehmen (Anmeldung bei Cloudflare macht Benjamin). Sonst von Hand:
   https://dash.cloudflare.com/?to=/:account/crewtender.eu/dns/records → „Add record“ → Typ **TXT**, Name **@**,
   Inhalt genau wie angezeigt → „Save“. Bestehende MX-/TXT-Einträge (Mail, `_atproto` von Bluesky) **nicht** anfassen.
3. Zurück in der Search Console → „Bestätigen“. (DNS braucht manchmal ein paar Minuten; dann erneut „Bestätigen“.)

## 2. Sitemap und Startseite
1. In der neuen Property links „Sitemaps“ → `https://crewtender.eu/sitemap.xml` eintragen → „Senden“.
2. Oben in die Suchleiste („URL prüfen“) `https://crewtender.eu/` → „Indexierung beantragen“.
   Dasselbe für `https://crewtender.eu/ausschreibungen` und `https://crewtender.eu/hilfe`.

## 3. Optional: Bing
https://www.bing.com/webmasters → „Anmelden“ (Microsoft-Konto mit kontakt@wpdigitalranger.com) → „Aus der Google Search Console
importieren“ → crewtender.eu auswählen → „Importieren“. Nur wenn das ohne neue Zahlungsdaten geht.

## 4. Rückmeldung
https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → Konten-Übersicht um „Google Search Console“ (und ggf. Bing)
ergänzen, oben Eintrag „04.11.2026 – Browser-Chat: Search Console“ → „Commit changes…“. Keine Passwörter, keine Codes.
