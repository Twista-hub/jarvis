# KI-Kosten senken bei gleicher Qualität (03.11.2026, Claude)

> **Ergebnis:** Die tägliche Bewertung kostet ab sofort rund **40–45 % weniger**. Die Endbewertung macht weiterhin
> dasselbe Modell (Sonnet 5.5) mit demselben Text. Im Vergleich auf 285 echten, schon bewerteten Ausschreibungen
> blieben **alle 51 von 51 Treffern** erhalten.

## 1. Ist-Stand (gemessen, Workflow `ki-kosten-auswertung.yml`, Tabelle `jarvis_katalog.ki_kosten`)

| Zweck | Anfragen seit 31.10. | Kosten | Ø pro Anfrage |
|---|---:|---:|---:|
| Alarm (tägliche Bewertung, Steckbriefe, Förderprogramme) | 258 | 7,03 $ | 0,027 $ |
| App (Firmenrecherche mit Websuche, Steckbrief aus Unterlagen, Lose) | 114 | 5,86 $ | 0,051 $ |

31.10. war der große PerLease-Erstlauf (8,13 $ an einem Tag), danach 4,04 $ und 0,72 $ pro Tag.

Modelle: Bewertung Sonnet 5.5 (low effort, 8 Ausschreibungen pro Anfrage), Steckbrief Opus 5.5 (medium),
Firmenrecherche Sonnet 5.5 mit Websuche, kleine Helfer Haiku 5.5.

## 2. Umgesetzt

### a) Prompt-Caching der Firmenbeschreibung (kostenlos, keinerlei Qualitätsänderung)
Die Bewertung schickt pro Firma viele 8er-Pakete mit derselben Anleitung und Firmenbeschreibung. Dieser Teil steht
jetzt in einem eigenen, zwischengespeicherten Block (`ki.bewertung_inhalt`). Ab dem zweiten Paket kostet er nur noch
0,20 $ statt 2,00 $ pro Million Tokens. Der Text für die KI ist zeichengenau derselbe (Test `test_ki_kosten`).
Ersparnis: etwa 10 % der Bewertungskosten. Die Kostenrechnung berücksichtigt jetzt Cache-Preise; das Protokoll jedes
Laufs zeigt „Prompt-Cache: … Tokens gelesen, … geschrieben“.

### b) Vorfilter mit Haiku 5.5 (Haiku kostet 1/20 von Sonnet)
Haiku bewertet jedes Paket zuerst mit identischer Anleitung. Nur was Haiku mit **mindestens 3 Punkten** einschätzt,
geht an Sonnet; Sonnets Punkte sind die endgültigen. Eindeutig unpassende Ausschreibungen (Haiku 1–2) behalten
Haikus Bewertung (gespeichert mit `vorfilter: true`). Abschaltbar mit `KI_VORFILTER=0`.

**Qualitätsprüfung** (`alarm/ki_vergleich.py`, Workflow `ki-vergleich.yml`, nur lesen, 0,03 $):

| Vorfilter-Schwelle | Sonnet-Treffer behalten | Nicht-Treffer aussortiert |
|---|---:|---:|
| Haiku ≥ 2 | 51/51 | 45/234 (19 %) |
| **Haiku ≥ 3 (gewählt)** | **51/51** | **115/234 (49 %)** |
| Haiku ≥ 4 | 50/51 | 154/234 (66 %) |
| Haiku ≥ 5 | 49/51 | 184/234 (79 %) |

Grundlage: alle 51 gespeicherten Treffer (≥ 6/10) von PerLease und WP Digital Ranger plus 234 Nicht-Treffer. Bei
Schwelle 4 wäre ein Grenzfall verloren gegangen („Sicherheitsposten“ Bahn, Sonnet 7, Haiku 3), deshalb 3.
Haiku allein (ohne Sonnet) wäre nicht gleich gut: 33 von 234 Nicht-Treffern hätte Haiku fälschlich ≥ 6 gegeben.

**Rechnung pro bewerteter Ausschreibung** (Treffer sind im Alltag ca. 8 % der Kandidaten):
vorher 0,0034 $ (Sonnet) → jetzt 0,0001 $ (Haiku) + 55 % × 0,0034 $ (Sonnet) ≈ 0,0020 $ → **rund 40 % weniger**,
mit Caching zusammen 40–45 %.

## 3. Weitere Hebel (noch nicht umgesetzt, Entscheidung Benjamin)

| Hebel | Ersparnis | Qualität | Haken |
|---|---|---|---|
| **Batch-API** für den täglichen Alarm | weitere 50 % auf alle verbleibenden Bewertungen | identisch (gleiches Modell, gleicher Text) | Ergebnisse kommen verzögert (meist < 1 h, bis 24 h); der Lauf muss vor der Mailzeit fertig sein → Alarm früher starten (z. B. 03:00 statt 06:00). Die serverseitige Ersatzmodell-Regel bei Ablehnungen gibt es im Batch nicht; seltene Ablehnungen würden einzeln nachbewertet. |
| Steckbrief Opus → Sonnet | ca. 50 % beim Steckbrief | **nicht** ohne Vergleich: Steckbriefe lesen lange Unterlagen, Qualität entscheidend | erst mit Vergleich wie oben (5–10 echte Unterlagen) |
| Firmenrecherche: weniger Websuchen | gering | Risiko für die Profilqualität | lohnt sich bei wenigen Neuanmeldungen nicht |

Empfehlung: Batch-API als Nächstes, sobald der Alarm-Zeitplan angepasst werden darf. Steckbrief-Modell erst testen,
wenn das Max-Guthaben da ist (dann ist Opus ohnehin bezahlbar).
