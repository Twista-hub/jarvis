# GitHub-Actions-Minuten und privates Repo (Messung 03.11.2026, Claude Code)

## Befund 03.11.2026, ca. 21:45 Uhr
- Das Repo **Twista-hub/jarvis ist privat** (von Hand umgestellt zwischen 21:01 und 21:46 Uhr).
- Seitdem startet **kein** GitHub-Ablauf mehr. Meldung von GitHub: „The job was not started because recent account
  payments have failed or your spending limit needs to be increased.“
- Ursache sehr wahrscheinlich: Private Repos teilen sich **2.000 Gratis-Minuten pro Monat für das ganze Konto**. RestockHero
  ist ebenfalls privat und verbraucht Minuten; bei Ausgabenlimit 0 € blockiert GitHub dann alles.
- Folgen, solange das so bleibt: kein Ausschreibungs-Alarm (04:17/07:41 UTC), keine stündlichen Mails/Handy-Nachrichten,
  keine Datensicherung und Löschfristen (01:23 UTC), kein Ausrollen neuer Versionen, keine Datenbank-Migrationen.
  Die App selbst (Cloudflare) läuft weiter.

## Möglichkeiten
1. **Wieder öffentlich** (kostenlos, sofort): https://github.com/Twista-hub/jarvis/settings → ganz unten „Danger Zone“ →
   „Change visibility“ → „Change to public“. Öffentliche Repos haben unbegrenzte Minuten. Kundendaten liegen nicht mehr im
   Repo (privat in R2); der Code ist dann wieder für alle lesbar.
2. **Privat lassen und bezahlen:** https://github.com/settings/billing → Ausgabenlimit für Actions erhöhen (Linux-Minute
   ca. 0,006 $) oder GitHub Pro (3.000 Minuten). Kosten siehe unten.
3. Privat lassen und Abläufe zu Cloudflare (Cron-Trigger) verlagern: großer Umbau, erst später.

## Verbrauch (gemessen)
| Art | Minuten |
|---|---|
| Zeitgesteuert (Alarm 2×, Mail 16× stündlich, BOAMP 2×, Ausland 2×, Gewerk-Zahlen 4×, Sicherung 1×) | ca. 35 pro Tag ≈ **1.050 pro Monat** |
| Je Push mit Änderung an `web/` und `supabase/` (Prüfen, Ausrollen, Datenbank, Katalog) | ca. **8 pro Push** |
| Entwicklungstag 03.11.2026 (sehr viele Pushes, Klickprüfungen) | ca. **750 an einem Tag** |

Grob: Betrieb ohne Entwicklung ≈ 1.050 Min./Monat (passt in 2.000, wenn RestockHero nicht schon alles braucht).
Mit Entwicklung wie in den letzten Tagen ≈ 5.000–15.000 Min./Monat → 20–80 $ im Monat bei privatem Repo.
Die Abläufe filtern bereits nach geänderten Ordnern; Doku-Änderungen lösen nichts aus.

## Empfehlung
Bis zum ersten zahlenden Kunden **öffentlich** lassen (Entscheidung Benjamin 03.11.: kein Geld bis zum ersten Kunden).
Danach privat + Ausgabenlimit bzw. Abläufe zu Cloudflare verlagern.
