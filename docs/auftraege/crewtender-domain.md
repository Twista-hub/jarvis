# Auftrag an den Browser-Chat: crewtender.eu kaufen, zu Cloudflare holen, E-Mail-Weiterleitung

Stand 03.11.2026. Entscheidung Benjamin: Domain **crewtender.eu** (Namecheap, ca. 6,22 € erstes Jahr).

## Regeln
- In neuen Tabs arbeiten. Benjamins offene Tabs nicht schließen.
- **Einloggen, Passwörter, Zwei-Faktor-Codes und Bezahlen macht Benjamin selbst.** Dort anhalten und Bescheid sagen.
- Vor dem Bezahlen den Warenkorb mit Preis zeigen und auf OK warten. Keine Zusatzprodukte (Hosting, Email, SSL, VPN).
- Nichts an RestockHero ändern (restockhero.eu nicht anfassen).
- Nach jedem Schritt kurz in `docs/browser/protokoll.md` eintragen:
  https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → „Commit changes…“. Keine Passwörter oder Codes.

## 1. Domain kaufen (falls noch nicht gekauft)
- Prüfen unter https://ap.www.namecheap.com/domains/list/ , ob crewtender.eu schon im Konto ist.
- Falls nicht: https://www.namecheap.com/domains/registration/results/?domain=crewtender.eu → „Add to cart“ → Warenkorb →
  Zusatzangebote abwählen → Benjamin bezahlt.

## 2. Richtiges Cloudflare-Konto
- https://dash.cloudflare.com öffnen. Es muss das Konto sein, in dem **wpdigitalranger.com** und der Worker
  **jarvis-alarm** liegen (Domains bzw. „Workers & Pages“ prüfen). Sonst Konto oben links wechseln oder Benjamin fragen.

## 3. Domain zu Cloudflare hinzufügen
- https://dash.cloudflare.com/?to=/:account/add-site → „Connect a domain“ → `crewtender.eu` → „Continue“
  → Tarif **Free** → „Continue“. DNS-Scan einfach bestätigen.
- Die zwei angezeigten **Nameserver** notieren (z. B. `xxx.ns.cloudflare.com`).

## 4. Nameserver bei Namecheap umstellen
- https://ap.www.namecheap.com/domains/domaincontrolpanel/crewtender.eu/domain
- „Nameservers“ → **Custom DNS** → die zwei Cloudflare-Nameserver eintragen → grünes Häkchen.
- Zurück in Cloudflare „Check nameservers“ klicken. Aktivierung dauert Minuten bis Stunden (Cloudflare schickt eine Mail).

## 5. E-Mail-Weiterleitung (erst wenn die Domain in Cloudflare „Active“ ist)
- In Cloudflare crewtender.eu öffnen → links „Email“ → „Email Routing“ → „Get started“.
- Adresse **hello** (also hello@crewtender.eu) → Ziel **kontakt@wpdigitalranger.com**.
- Benjamin klickt den Bestätigungslink in der Mail an kontakt@wpdigitalranger.com.
- Dann „Add records and enable“.
- Zusätzlich „Catch-all“ auf dasselbe Ziel stellen, damit auch info@ usw. ankommen (optional).

## 6. Rückmeldung
In `docs/browser/protokoll.md`: Domain gekauft (Datum), Cloudflare-Konto, Status „Active“, hello@crewtender.eu aktiv.
Danach Benjamin sagen: „Claude Code Bescheid geben: Domain fertig“. Claude Code hängt die Domain dann an die App.
Keine DNS-Einträge für die App selbst anlegen – das macht Claude Code.
