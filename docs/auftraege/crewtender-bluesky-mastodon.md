# Auftrag an den Browser-Chat: Bluesky und Mastodon für Crewtender

Stand 03.11.2026.

## Regeln
- Neue Tabs. **Getrennt von RestockHero:** eigene, neue Konten. Wenn RestockHero (@restockhero…) angemeldet ist,
  über „Konto hinzufügen“ bzw. abmelden arbeiten. Nichts an den RestockHero-Konten ändern.
- Passwörter, Codes und Bestätigungsklicks in Mails macht Benjamin. E-Mail: **hello@crewtender.eu** für die Anmeldung; Bestätigungsmails landen im Postfach **kontakt@wpdigitalranger.com** (Weiterleitung).
- Nichts posten, niemandem folgen außer nötig, keine Nachrichten.

## 1. Bluesky – Name @crewtender.eu
1. https://bsky.app → „Konto erstellen“ (Anbieter Bluesky Social), E-Mail hello@crewtender.eu, vorläufiger Name z. B. crewtender.bsky.social.
2. Profil: Anzeigename „Crewtender“, Bild `docs/design/crewtender/profil.png`, Banner `docs/design/crewtender/facebook-titel.png`,
   Beschreibung: „Find public tenders, write bids, plan your crew – the app for trades and service companies. 🌐 crewtender.eu · ✉️ hello@crewtender.eu“
3. Domain als Name: Einstellungen → „Konto“ → „Handle“ → „Ich habe meine eigene Domain“ → `crewtender.eu` → Bluesky zeigt einen
   **TXT-Eintrag** (Name `_atproto`, Wert `did=did:plc:…`).
4. Diesen Eintrag in Cloudflare anlegen: https://dash.cloudflare.com/?to=/:account/crewtender.eu/dns/records → „Add record“ →
   Typ **TXT**, Name **_atproto**, Inhalt **did=did:plc:…** (genau wie angezeigt) → „Save“. MX/TXT der Mail nicht anfassen.
5. Zurück in Bluesky „Verify DNS Record“ / „DNS-Eintrag prüfen“ → Handle **@crewtender.eu** übernehmen.

## 2. Mastodon
1. https://mastodon.social/auth/sign_up → Benutzername **crewtender** (falls belegt: crew_tender), E-Mail hello@crewtender.eu.
   (Eigenes Konto, nicht das RestockHero-Konto auf mastodon.social.)
2. Profil wie bei Bluesky (Bild, Banner, Beschreibung). Unter „Profil bearbeiten“ → „Zusätzliche Felder“: „Website“ → https://crewtender.eu,
   „Legal notice“ → https://crewtender.eu/impressum. Alle Profiltexte auf Englisch (Benjamin, 03.11.2026).
3. Optional „Verifiziert“-Haken: Den Link `rel="me"` meldet Claude Code ein, sobald der Kontoname feststeht.

## 3. Rückmeldung
https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → Konten-Übersicht ergänzen (Bluesky, Mastodon mit @Namen), Eintrag oben, „Commit changes…“.
Keine Passwörter oder Codes.
