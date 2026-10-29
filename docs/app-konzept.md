# App-Konzept: Firmen, Bereiche, Mitarbeiter

Stand 29.10.2026. Datenbank-Schema: `supabase/migrations/20261029120000_firmen_und_rechte.sql`, Tests: `supabase/tests/`.

## Aufbau (wie bei SAP: Mandant, Organisationseinheiten, Rollen)

```
Firma (z. B. Perlease GmbH)            ← Inhaber: Geschäftsführung, volles Konto inkl. Abrechnung
├── Bereich Berlin (Standort)          ← eigene Suchprofile, eigene Löhne für die Kalkulation
│   ├── Team Messe
│   └── Team Hotel
├── Bereich Hamburg (Standort)
└── Bereich Vertrieb (Abteilung)
```

- **Bereiche** sind beliebig verschachtelt: Standort, Abteilung, Team. Wer einem Bereich zugeordnet ist, sieht auch alle Unterbereiche.
- Ausschreibungen ohne Bereich gehören der ganzen Firma und sind für alle sichtbar.

## Rollen

| Rolle | Darf | Kostet |
|---|---|---|
| **Inhaber** | alles: Abrechnung, Paket, Inhaber ernennen, alle Bereiche | 1 Nutzer |
| **Admin** | Mitarbeiter einladen und sperren, Bereiche und Suchprofile anlegen, alle Bereiche sehen | 1 Nutzer |
| **Bearbeiter** | Ausschreibungen in seinen Bereichen bearbeiten: Status, Zuständige, Unterlagen hochladen, Kalkulation | 1 Nutzer |
| **Leser** | nur ansehen (z. B. Geschäftsführung, Buchhaltung) | kostenlos |

Schutzregeln (in der Datenbank erzwungen und getestet):
- Jede Firma sieht nur ihre eigenen Daten. Bearbeiter und Leser sehen nur ihre Bereiche.
- Nur Inhaber können Inhaber ernennen oder entfernen. Der letzte Inhaber lässt sich nicht entfernen.
- Einladungen gelten nur für die eingeladene E-Mail-Adresse, nur einmal und nur 14 Tage.
- Wichtige Aktionen landen im Protokoll, das nur Admins sehen.

## Ablauf einer Ausschreibung (Vorgang)

`neu` → `prüfen` → `Angebot in Arbeit` → `abgegeben` → `gewonnen` / `verloren` (oder `verworfen`)

Pro Vorgang: zuständige Person, Frist, Punkte (KI), Steckbrief, Kalkulationen (Verlauf), später Angebotsentwurf.
Kalkulationsvorlagen gibt es pro Firma und pro Bereich, weil die Löhne von Stadt zu Stadt verschieden sind.

## Abrechnung pro Nutzer (Vorschlag)

Abgerechnet werden aktive Nutzer mit den Rollen Inhaber, Admin oder Bearbeiter. Leser sind kostenlos. Die Zählung steckt in der Datenbankfunktion `nutzer_zaehlen`, die Abbuchung läuft später über Stripe (Abo mit Menge = Nutzer).

| Paket | Grundpreis/Monat | enthalten | jeder weitere Nutzer | dazu |
|---|---|---|---|---|
| Basis | 149 € | 2 Nutzer | 19 € | Alarm, Zusammenfassungen, Fristen |
| Pro | 399 € | 5 Nutzer | 39 € | Steckbriefe aus Unterlagen (30 pro Monat inklusive, danach 5 € je Stück), Kalkulation, später Angebotsentwurf; 1–3 % bei Zuschlag |
| Erfolg | 99 € | 2 Nutzer | 19 € | 3–5 % bei Zuschlag (gedeckelt) |

Ab 20 Nutzern Mengenrabatt nach Absprache.
Beispiel Perlease mit 15 Nutzern im Pro-Paket: 399 € + 10 × 39 € = 789 € im Monat. Für den Start gelten 2 Monate kostenlos, danach nach Absprache.

## Technik

- **Login:** Supabase Auth (Frankfurt) mit Magic Link per E-Mail. Admins laden Mitarbeiter per E-Mail ein.
- **Daten:** Supabase-Projekt „jarvis“ (Frankfurt), strikt getrennt von RestockHero und Demopin.
- **Unterlagen und Steckbriefe:** wie bisher über Cloudflare (R2 EU, Workers AI, Claude). Später hängen sie am Vorgang.
- **Oberfläche:** die Upload-Seite (`web/`) wird zur App: Anmelden, Treffer-Liste pro Bereich, Vorgang mit Steckbrief und Kalkulation, Verwaltung (Bereiche, Mitarbeiter, Abrechnung).
