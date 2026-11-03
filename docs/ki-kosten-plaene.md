# KI-Kosten je Firmengröße und was das für die Pläne heißt (03.11.2026, Claude)

> **Kurz:** Die tägliche Suche ist billig, sie kostet je nach Firmengröße 1–30 $ im Monat. Teuer sind die **Steckbriefe
> aus hochgeladenen Unterlagen** (Opus 5.5): **1,20–2,50 $ pro Stück** statt der bisher angenommenen 0,30 $. Mit den alten
> Kontingenten (5 / 30 / 100 im Monat) wären bei voller Nutzung nur noch 36 % (Pro) bzw. 27 % (Business) Marge übrig.
> **Vorschlag:** kleinere Kontingente (3 / 15 / 40), ein Zusatzpaket von 10 Steckbriefen für 35 € und ein internes
> KI-Budget pro Firma und Monat. Dann bleiben auch bei Volllast mindestens 62 % Marge.
> Alle Preise brauchen weiter Benjamins OK, nichts davon ist live.
>
> Rechnung zum Nachrechnen: `python3 alarm/kostenmodell.py` (Stückkosten oben im Skript anpassen, wenn sich Preise ändern).

## 1. Gemessene Stückkosten (03.11.2026)

Gemessen im KI-Test mit echter API (`durchspielen-ki.yml`), im echten Suchlauf der Beispielfirma und in der Auswertung
pro Firma (`ki-kosten-auswertung.yml`).

| Funktion | Modell | Kosten pro Stück | Wann |
|---|---|---:|---|
| Bewertung einer Ausschreibung | Haiku-Vorfilter + Sonnet, Batch | **0,002 $** (direkt 0,0037 $) | täglich, für jede neue passende Bekanntmachung |
| Kurz-Steckbrief aus der Bekanntmachung | Opus | **0,07 $** | täglich, höchstens 4 pro Firma und Tag (Erstlauf 10) |
| **Steckbrief aus Unterlagen** | Opus | **1,18 $** (3 PDFs) bis **2,45 $** (16 Dateien), Ø 1,80 $ | wenn jemand Vergabeunterlagen hochlädt |
| Beleg lesen (Spesen) | Haiku | 0,0003 $ | pro Foto |
| Nachweis lesen (Zertifikat, Schein) | Haiku | 0,0003 $ | pro Upload |
| Firmenrecherche bei der Anmeldung | Sonnet + Websuche | 0,24 $ | einmalig |
| Erstlauf (offener Bestand) | wie oben | ca. 0,96 $ | einmalig |

Beispiele aus dem Betrieb: Firma mit 1 Standort 0,98 $ in 3 Tagen (inkl. Erstlauf), Beispielfirma mit 20 Standorten
1,27 $ in 3 Tagen. Erstlauf der Beispielfirma: 33.067 Bekanntmachungen geprüft, 77 bewertet (0,28 $), 10 Kurz-Steckbriefe (0,68 $).

Umrechnung: 1 $ = 0,90 €, dazu 19 % (als Kleinunternehmer keine Vorsteuer, die API-Rechnung läuft über Reverse Charge).
**1 $ API = 1,07 € Kosten.**

## 2. Was eine Firma im Monat an KI kostet

Annahmen pro Monat. *Normal* = typischer Monat. *Volllast* = das Büro arbeitet jeden Tag mit der App, viele Angebote,
alle Belege und Nachweise laufen über Jarvis.

| Größe | Standorte | Bewertungen | Kurz-Steckbriefe | Steckbriefe aus Unterlagen | Belege | Nachweise |
|---|---:|---:|---:|---:|---:|---:|
| Kleinstbetrieb 1–5 MA | 1 | 300 / 900 | 20 / 60 | 2 / 5 | 20 / 60 | 5 / 15 |
| 10 MA | 1 | 600 / 1.500 | 40 / 100 | 4 / 10 | 60 / 150 | 20 / 40 |
| 100 MA | 4 | 2.000 / 5.000 | 90 / 120 | 12 / 35 | 300 / 1.000 | 120 / 300 |
| 1.000 MA | 20 | 6.000 / 15.000 | 120 / 120 | 30 / 100 | 2.000 / 6.000 | 800 / 2.000 |

(normal / Volllast; Kurz-Steckbriefe sind bei 120 im Monat gedeckelt, 4 pro Tag)

**Ergebnis (KI-Kosten pro Monat):**

| Größe | Normal | Volllast | davon Steckbriefe aus Unterlagen (Volllast) | passender Plan | Umsatz |
|---|---:|---:|---:|---|---:|
| 1–5 MA | 5,71 $ = **6 €** | 15,12 $ = **16 €** | 60 % | Basis | 59 € |
| 10 MA | 11,32 $ = **12 €** | 28,16 $ = **30 €** | 64 % | Pro | 149 € |
| 100 MA | 32,13 $ = **34 €** | 81,89 $ = **88 €** | 77 % | Business | 399 € |
| 1.000 MA | 75,34 $ = **81 €** | 220,90 $ = **237 €** | 81 % | Business + Zusatz-Einsatzkräfte | ca. 1.750 € (399 € + 900 × 1,50 €) |

Was auffällt:
- **Belege und Nachweise kosten praktisch nichts** (auch 6.000 Belege im Monat sind 1,80 $).
- **Die Suche wächst mit den Standorten**, bleibt aber klein (1.000 MA, 20 Standorte, Volllast: 30 $).
- **Steckbriefe aus Unterlagen machen 60–80 % der Kosten aus.** Sie hängen nicht an der Mitarbeiterzahl, sondern daran,
  wie viele Angebote eine Firma vorbereitet.
- Große Firmen zahlen über die Zusatz-Einsatzkräfte ohnehin deutlich mehr; dort ist die KI kein Problem.
  Gefährlich ist eine **Business-Firma mit wenig Personal, die sehr viele Ausschreibungen hochlädt**.

## 3. Was das für die Pläne heißt

### Schlimmster Fall pro Plan
Alle Kontingente ausgeschöpft, jeder Steckbrief so groß wie der größte gemessene (2,45 $), dazu Stripe und Infrastruktur.

| Plan | Preis | Steckbriefe bisher → neu | KI höchstens (bisher) | Rest (bisher) | KI höchstens (neu) | Rest (neu) |
|---|---:|---|---:|---:|---:|---:|
| Free | 0 € | 0 → 0 | 1 € | −1 € | 1 € | −1 € |
| Basis | 59 € | 5 → **3** | 19 € | 37 € (63 %) | 14 € | 42 € (**72 %**) |
| Pro | 149 € | 30 → **15** | 91 € | 53 € (36 %) | 52 € | 92 € (**62 %**) |
| Business | 399 € | 100 → **40** | 282 € | 106 € (27 %) | 125 € | 264 € (**66 %**) |

Im Alltag (Normal-Spalte oben) liegen die Margen weiter bei 85–90 %.

### Vorschlag (alles in `web/src/plaene.ts` vorbereitet, nicht aktiv)
1. **Steckbrief-Kontingente:** Basis 3, Pro 15, Business 40 im Monat. Das deckt die Volllast der passenden Größe
   (10 MA: 10 im Monat, 100 MA: 35 im Monat). Der Kurz-Steckbrief aus der Bekanntmachung bleibt in allen Plänen frei.
2. **Zusatzpaket:** 10 Steckbriefe für **35 €** (Kosten Ø 19 €, höchstens 26 €). Statt bisher 15 € – das hätte bei großen
   Unterlagen Verlust gemacht.
3. **KI-Budget pro Firma und Monat (fair use, intern):** Free 1 €, Basis 15 €, Pro 40 €, Business 120 € (+10 € je 100
   zusätzliche Einsatzkräfte). Wird es erreicht: Suche und Bewertung laufen weiter (billig), Steckbriefe aus Unterlagen
   nur noch über das Zusatzpaket, Inhaber und Admins bekommen einen Hinweis. Die Kosten pro Firma werden schon heute
   gebucht (`ki_kosten.firma_id`, Seite „Auswertung“); die Sperre selbst wird erst mit den Plänen eingebaut.
4. **Großkunden (ab ca. 300 Einsatzkräften):** Business mit Zusatz-Einsatzkräften reicht rechnerisch. Wer keine
   Preise pro Kopf will, bekommt ein Einzelangebot (Richtwert ab 990 € im Monat, 100 Steckbriefe, KI-Budget 300 €).
5. **Sonnet statt Opus für Steckbriefe testen.** Halbiert die größte Kostenposition (1.000 MA Volllast: 237 € → 140 €).
   Das geht aber nur mit einem Qualitätsvergleich auf 5–10 echten Unterlagen, so wie beim Vorfilter (`docs/ki-kosten.md`).
   Kosten des Tests: ca. 25 $. **Braucht Benjamins OK.** Fällt der Test gut aus, können die Kontingente wieder steigen
   (z. B. Pro 25, Business 70).

### Was schon begrenzt ist
- Kurz-Steckbriefe: höchstens 4 pro Firma und Tag (`MAX_STECKBRIEFE`), Erstlauf 10.
- Erstlauf für Free nur über 30 Tage; Free-Konten ohne Anmeldung seit 30 Tagen pausieren (Vorschlag in `docs/abos.md`).
- Gesamtbudget: KI-Tages- und Monatslimit für alles zusammen (`jarvis_katalog.ki_budget`, 10 € pro Tag).
  **Mit vielen zahlenden Kunden muss dieses Limit mitwachsen**, sonst blockiert ein großer Upload-Tag alle Firmen.
  Faustregel: Tageslimit ≈ 2 % der Monatsumsätze.

## 4. Hochrechnung auf mehrere Firmen (KI pro Monat)

Mischung wie in `docs/abos.md` (Basis / Pro / Business = 60 / 30 / 10 %), Kleinstbetriebe in Basis, 10 MA in Pro,
100 MA in Business, dazu 3 Free-Konten je zahlendem Kunden (je 0,75 €).

| | 10 Kunden | 50 Kunden | 200 Kunden |
|---|---:|---:|---:|
| KI normal | 130 € | 650 € | 2.600 € |
| KI Volllast (alle gleichzeitig) | 298 € | 1.489 € | 5.957 € |
| Umsatz | 1.200 € | 6.000 € | 24.000 € |
| KI-Anteil am Umsatz | 11–25 % | 11–25 % | 11–25 % |

(normal: 6 × 6,11 € + 3 × 12,13 € + 1 × 34,41 € + 30 × 0,75 € ≈ 130 €; Volllast: 6 × 16,20 € + 3 × 30,16 € + 1 × 87,70 € + 30 × 0,75 € ≈ 298 €.
Der KI-Anteil steht in allen Spalten gleich da, weil Mischung und Kosten pro Kunde gleich sind.)

Bisher standen in `docs/abos.md` für 10 Kunden 114 € KI als *Obergrenze*. Das ist in Wahrheit der *Normalfall*;
die Volllast ist gut doppelt so hoch. Der Rohertrag (nach KI, Stripe und Infrastruktur) liegt dann bei 68–72 % (Volllast)
bzw. 82–86 % (normal), siehe Abschnitt 3 in `docs/abos.md`.
