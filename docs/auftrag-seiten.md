# Auftrag: Seiten-Umbau der App (Stand 30.10.2026)

Benjamin findet die Konto-Seite unübersichtlich („einfach nicht schön“). Ziel: eine aufgeräumte Übersicht mit großen
Kacheln, alles andere auf Unterseiten. Muss am Handy gut aussehen (die meisten Nutzer sind am Handy, App ist installierbar).

## Seiten
| Seite | Pfad | Inhalt |
|---|---|---|
| Übersicht | `/konto` | Firmenname, Firmen-Umschalter, eine Zeile „X neue Treffer · Y Fristen diese Woche“, große Kacheln mit Symbol und Zahl zu den Unterseiten. Bei Firma ohne Suchprofil zuerst die Kachel „🔎 Suche einrichten“. |
| Ausschreibungen | `/konto/treffer` | Trefferliste (heute in `uebersicht()`), Filter nach Bereich, Reiter „Neu · In Arbeit · Abgegeben · Archiv“ (Status neu/pruefen, angebot, abgegeben, gewonnen/verloren/verworfen). |
| Treffer | `/konto/vorgang/<id>` | bleibt wie es ist (Steckbrief, „Hier runterladen“, Upload, Kalkulation). |
| Fristen | `/konto/fristen` | laufende Vorgänge (neu, pruefen, angebot) nach Frist sortiert, nächste 7 Tage rot. |
| Unterlagen prüfen | `/konto/unterlagen` | Upload ohne Treffer (wie `/hochladen`, aber ohne Zugangscode, Firma aus Sitzung) und Liste der bisherigen Steckbriefe aus Unterlagen. |
| Kalkulation | `/konto/kalkulation` | Standardwerte der Firma (Tabelle `kalkulationsvorlagen`, bereich_id null), später pro Standort. |
| Firma & Team | `/konto/team` | Bereiche/Standorte, Mitarbeiter, Einladungen (heute in `uebersicht()`). Nur Admins dürfen ändern. |
| Einstellungen | `/konto/einstellungen` | Suchprofil anpassen (Link zu `/konto/einrichtung`), tägliche Nachricht (Uhrzeit, Mail/Handy, Knöpfe `push-an`/`push-test` und `push-status` müssen erhalten bleiben, siehe `web/src/app.ts`), Abmelden. |

## Überall
- Feste Leiste unten (Handy): 🏠 Übersicht · 🔎 Treffer · ⏰ Fristen · ⚙️ Mehr (Mehr = Einstellungen mit Links zu Team, Kalkulation, Unterlagen).
- Oben „← Zurück“ zur Übersicht.
- Gleiches Aussehen wie bisher (`web/src/seite.ts`, Farben, hell/dunkel), keine fremden Skripte oder Frameworks; die CSP erlaubt nur `/app.js`.
- Push-Ziele in `alarm/mail.py` (`handy()`) anpassen: mehrere neue → `/konto/treffer`, Frist → Treffer-Seite.
- Hinweis-Meldungen (`?hinweis=`) und Weiterleitungen nach dem Speichern auf die jeweils passende Unterseite.

## Technik
- Code in `web/src/konto.ts` (große Funktion `uebersicht()`), am besten in kleinere Funktionen pro Seite aufteilen
  (z. B. neue Datei `web/src/seiten.ts`).
- Alle Datenzugriffe bleiben über `db()` mit dem Token der Person (Zeilenrechte).
- Tests: `cd web && npm run check && npm test`; neue Tests für die Navigation/Seiten sind erwünscht.
- Nach dem Push rollt `web.yml` automatisch aus; Seitentest muss grün sein.
