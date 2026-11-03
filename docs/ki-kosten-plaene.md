# KI-Kosten je Firmengröße und was das für die Pläne heißt (03.11.2026, Claude)

> **Kurz:** Eine Firma kostet an KI im Monat **3 € (Kleinstbetrieb) bis 39 € (1.000 Mitarbeiter)**, unter Volllast
> **9 € bis 97 €**. Das sind bei passendem Plan höchstens 10–16 % des Preises. Die Steckbrief-Kontingente aus dem
> Abo-Vorschlag (5 / 30 / 100 im Monat) können bleiben; auch im schlimmsten Fall bleiben **mindestens 70 % Marge**.
> Opus bleibt für die Steckbriefe (Test gegen Sonnet in Abschnitt 5). Alle Preise brauchen weiter Benjamins OK.
>
> **Korrektur 03.11.2026 nachmittags:** Die zuerst gemessenen 1,18–2,45 $ pro Steckbrief aus Unterlagen waren die
> vorab reservierten Höchstbeträge, nicht die echten Kosten. Gestreamte Anfragen wurden nie mit dem echten Verbrauch
> abgerechnet (behoben in `web/src/api-budget.ts`, `streamNutzung`). Echt kostet ein Steckbrief **0,41 $ (3 PDFs) bzw.
> 0,50 $ (6 PDFs)**, höchstens ca. 0,85 $ (die Unterlagen werden bei 350.000 Zeichen abgeschnitten). Damit war auch der
> Vorschlag, die Kontingente auf 3 / 15 / 40 zu senken, unnötig; er ist zurückgenommen.
>
> Rechnung zum Nachrechnen: `python3 alarm/kostenmodell.py` (Stückkosten oben im Skript anpassen, wenn sich Preise ändern).

## 1. Gemessene Stückkosten (03.11.2026)

| Funktion | Modell | Kosten pro Stück | Wann |
|---|---|---:|---|
| Bewertung einer Ausschreibung | Haiku-Vorfilter + Sonnet, Batch | **0,002 $** (direkt 0,0037 $) | täglich, für jede neue passende Bekanntmachung |
| Kurz-Steckbrief aus der Bekanntmachung | Opus | **0,04–0,08 $**, gerechnet 0,07 $ | täglich, höchstens 4 pro Firma und Tag (Erstlauf 10) |
| **Steckbrief aus Unterlagen** | Opus | **0,41 $** (3 PDFs), **0,50 $** (6 PDFs), höchstens ca. 0,85 $; gerechnet Ø 0,50 $ | wenn jemand Vergabeunterlagen hochlädt |
| Beleg lesen (Spesen) | Haiku | 0,0003 $ | pro Foto |
| Nachweis lesen (Zertifikat, Schein) | Haiku | 0,0003 $ | pro Upload |
| Firmenrecherche bei der Anmeldung | Sonnet + Websuche | 0,24 $ | einmalig |
| Erstlauf (offener Bestand) | wie oben | ca. 0,96 $ | einmalig |

Umrechnung: 1 $ = 0,90 €, dazu 19 % (als Kleinunternehmer keine Vorsteuer, die API-Rechnung läuft über Reverse Charge).
**1 $ API = 1,07 € Kosten.**

## 2. Was eine Firma im Monat an KI kostet

Annahmen pro Monat (normal / Volllast). *Volllast* = das Büro arbeitet jeden Tag mit der App, viele Angebote, alle Belege
und Nachweise laufen über Jarvis.

| Größe | Standorte | Bewertungen | Kurz-Steckbriefe | Steckbriefe aus Unterlagen | Belege | Nachweise |
|---|---:|---:|---:|---:|---:|---:|
| Kleinstbetrieb 1–5 MA | 1 | 300 / 900 | 20 / 60 | 2 / 5 | 20 / 60 | 5 / 15 |
| 10 MA | 1 | 600 / 1.500 | 40 / 100 | 4 / 10 | 60 / 150 | 20 / 40 |
| 100 MA | 4 | 2.000 / 5.000 | 90 / 120 | 12 / 35 | 300 / 1.000 | 120 / 300 |
| 1.000 MA | 20 | 6.000 / 15.000 | 120 / 120 | 30 / 100 | 2.000 / 6.000 | 800 / 2.000 |

**Ergebnis (KI-Kosten pro Monat):**

| Größe | Normal | Volllast | passender Plan | Umsatz | KI-Anteil (Volllast) |
|---|---:|---:|---|---:|---:|
| 1–5 MA | 3,11 $ = **3 €** | 8,62 $ = **9 €** | Basis | 59 € | 16 % |
| 10 MA | 6,12 $ = **7 €** | 15,16 $ = **16 €** | Pro | 149 € | 11 % |
| 100 MA | 16,53 $ = **18 €** | 36,39 $ = **39 €** | Business | 399 € | 10 % |
| 1.000 MA | 36,34 $ = **39 €** | 90,90 $ = **97 €** | Business + 900 Zusatz-Einsatzkräfte | ca. 1.750 € | 6 % |

Was auffällt:
- **Belege und Nachweise kosten praktisch nichts** (auch 6.000 Belege im Monat sind 1,80 $).
- Die Kosten verteilen sich jetzt auf Suche (Bewertung + Kurz-Steckbriefe) und Steckbriefe aus Unterlagen
  (30–55 % der Summe). Keine einzelne Funktion ist ein Kostenproblem.
- Große Firmen zahlen über die Zusatz-Einsatzkräfte deutlich mehr; ihr KI-Anteil ist am kleinsten.

## 3. Was das für die Pläne heißt

### Schlimmster Fall pro Plan
Alle Kontingente ausgeschöpft, jeder Steckbrief so groß wie möglich (0,85 $), dazu Stripe und Infrastruktur.

| Plan | Preis | Steckbriefe / Monat | KI höchstens | Rest | Marge |
|---|---:|---:|---:|---:|---:|
| Free | 0 € | 0 | 1 € | −1 € | – |
| Basis | 59 € | 5 | 10 € | 46 € | **77 %** |
| Pro | 149 € | 30 | 40 € | 104 € | **70 %** |
| Business | 399 € | 100 | 111 € | 278 € | **70 %** |

Im Alltag liegen die Margen bei 85–95 %.

### Vorschlag (in `web/src/plaene.ts` vorbereitet, nicht aktiv)
1. **Steckbrief-Kontingente wie im Abo-Vorschlag:** Basis 5, Pro 30, Business 100 im Monat.
2. **Zusatzpaket:** 10 Steckbriefe für **15 €** wie vorgeschlagen (Kosten Ø 5,35 €, höchstens 9,10 €).
3. **KI-Budget pro Firma und Monat (fair use, intern):** Free 1 €, Basis 10 €, Pro 25 €, Business 60 € (+5 € je 100
   zusätzliche Einsatzkräfte). Das deckt die Volllast der passenden Größe. Wird es erreicht: Suche und Bewertung laufen
   weiter, Steckbriefe aus Unterlagen nur noch über das Zusatzpaket, Inhaber und Admins bekommen einen Hinweis. Die
   Kosten pro Firma werden schon gebucht (`ki_kosten.firma_id`, Seite „Auswertung“, seit der Korrektur auch bei
   Steckbriefen mit echtem Verbrauch); die Sperre selbst kommt erst mit den Plänen.
4. **Großkunden (ab ca. 300 Einsatzkräften):** Business mit Zusatz-Einsatzkräften reicht. Wer keine Preise pro Kopf
   will, bekommt ein Einzelangebot.
5. **Opus bleibt für alle Steckbriefe** (Abschnitt 5).

### Was schon begrenzt ist
- Kurz-Steckbriefe: höchstens 4 pro Firma und Tag (`MAX_STECKBRIEFE`), Erstlauf 10.
- Erstlauf für Free nur über 30 Tage; Free-Konten ohne Anmeldung seit 30 Tagen pausieren (Vorschlag in `docs/abos.md`).
- Gesamtbudget: KI-Tages- und Monatslimit für alles zusammen (`jarvis_katalog.ki_budget`, 10 € pro Tag, 20 $ pro Monat).
  **Mit zahlenden Kunden muss dieses Limit mitwachsen.** Faustregel: Monatslimit ≈ 15 % der Monatsumsätze.

## 4. Hochrechnung auf mehrere Firmen (pro Monat)

Mischung Basis / Pro / Business = 60 / 30 / 10 % (Kleinstbetriebe in Basis, 10 MA in Pro, 100 MA in Business),
3 Free-Konten je zahlendem Kunden (je 0,75 €).

| | 10 Kunden | 50 Kunden | 200 Kunden |
|---|---:|---:|---:|
| Umsatz | 1.200 € | 6.000 € | 24.000 € |
| KI normal / Volllast | 80 € / 166 € | 399 € / 828 € | 1.597 € / 3.312 € |
| Stripe | 29 € | 144 € | 578 € |
| Infrastruktur | 60 € | 71 € | 143 € |
| **Rohertrag normal** | **1.031 € (86 %)** | **5.385 € (90 %)** | **21.682 € (90 %)** |
| **Rohertrag Volllast** | **946 € (79 %)** | **4.957 € (83 %)** | **19.967 € (83 %)** |

KI-Anteil am Umsatz: 7 % normal, 14 % Volllast. Benjamins Arbeitszeit ist nicht eingerechnet.

## 5. Test Sonnet 5.5 gegen Opus 5.5 beim Steckbrief (03.11.2026, Benjamins OK)

Workflow `steckbrief-vergleich.yml`, Skript `alarm/steckbrief_vergleich.py`. Beide Modelle bekommen genau dieselbe
Anleitung und denselben Text wie im Betrieb. Ein dritter Aufruf (Opus) prüft beide Steckbriefe **blind** (zufällig als
A und B) gegen die Quelle: falsche oder erfundene Angaben, wichtige Lücken, Punkte 1–10.
Testkosten insgesamt **4,03 $** (4 Läufe, Runs 41639239068, 41639794369, 41640293814, 41643076668).

| Fall | Opus Punkte | Sonnet Punkte | falsche Angaben Opus / Sonnet | besser | Kosten Opus / Sonnet |
|---|---:|---:|---:|---|---:|
| Bundesbank-Unterlagen, 3 PDFs (111.000 Zeichen), Lauf 1 | 8 | 6 | 1 / 3 | Opus | 0,41 $ / 0,17 $ |
| dieselben Unterlagen, Lauf 2 | 9 | 7 | 1 / 3 | Opus | 0,41 $ / 0,17 $ |
| alle 6 Bundesbank-PDFs (158.000 Zeichen) | 8 | 6 | 2 / 3 (1 schwer) | Opus | 0,50 $ / 0,23 $ |
| 8 Bekanntmachungen (Reinigung, Bewachung, AÜG, Hausmeister, Winterdienst, Catering, Grünpflege, Empfang) | Ø 7,6 | Ø 7,2 | 2 / 5 | Opus 2×, gleich 6×, Sonnet 0× | 0,49 $ / 0,18 $ (zusammen) |

**Was Sonnet bei den Unterlagen falsch machte (alle drei Läufe ähnlich):** 17 statt 18 Lose, rund 8.800 statt 7.965 Stunden
pro Jahr bzw. 2.400 Stunden zu wenig im Gesamtbedarf (und damit eine falsche Einschätzung der Passung), eine Sicherheitsüberprüfung, die die Unterlagen nicht
verlangen. Opus nannte Lose und Stunden richtig und wies zusätzlich auf Widersprüche in den Unterlagen hin
(Verfügbarkeitsfristen, abweichende Vergabenummer) – genau das, was für Bieterfragen und die Kalkulation zählt.

**Ergebnis:**
- **Steckbrief aus Unterlagen bleibt bei Opus.** Sonnet kostet dort 42–46 % von Opus, macht aber bei langen Unterlagen
  Fehler, die zu einer falschen Kalkulation führen können. Die Ersparnis wäre den Qualitätsverlust nicht wert.
- **Kurz-Steckbrief aus der Bekanntmachung:** meist gleich gut, Sonnet nie besser, aber mehr kleine Fehler
  (z. B. 310.000 statt 300.000 € für ein Los). Ersparnis höchstens ca. 4,50 $ pro Firma und Monat. Empfehlung: vorerst
  ebenfalls Opus lassen.

**Grenzen des Tests:**
- Nur ein einziger Satz echter Vergabeunterlagen. Andere Portale (DTVP, evergabe.de usw.) verbieten das
  automatische Abrufen der Unterlagen oder sind nicht geprüft.
- Die Prüfung macht Opus; trotz Blindtest ist eine leichte Vorliebe für den eigenen Stil nicht ausgeschlossen. Die
  gefundenen Fehler von Sonnet sind aber nachprüfbar (Lose und Stunden zählen).
- Bei den Bekanntmachungen lud die vollständige eForms-Fassung nicht (HTTP 404, siehe unten). Beide Modelle sahen nur die
  kurze OCDS-Fassung. Dasselbe passiert im täglichen Alarm: **8 von 8 Kurz-Steckbriefen am 03.11. ohne eForms.** Das ist
  ein eigener Fehler und muss behoben werden.
