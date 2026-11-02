# Europa-Marktanalyse (TED), 03.09.–02.11.2026

Quelle: TED Search API v3 (Amt für Veröffentlichungen der EU, Weiterverwendung erlaubt), Auftragsbekanntmachungen
(cn-standard, cn-social, cn-desg, subco), gezählt mit `alarm/europa_markt.py` (Workflow „Europa-Marktanalyse“).
Gewerke = CPV-Präfixe wie auf den Gewerke-Seiten (`web/src/gewerke.ts`).

Wichtig: TED enthält nur Aufträge **oberhalb der EU-Schwellenwerte**. Unterhalb der Schwelle (die Mehrheit der
Handwerksaufträge) veröffentlicht jedes Land in eigenen Portalen. Beispiel Deutschland: TED 3.915 in unseren
Gewerken, Bekanntmachungsservice (alle Schwellen) im gleichen Zeitraum rund 36.700 Bekanntmachungen insgesamt.

| Land | alle | unsere 10 Gewerke | Elektro | SHK | Tischler | Reinigung | Maler/Trockenbau | Dach/Zimmerer | GaLaBau/Winterdienst | Sicherheit | Boden/Fliesen | Zeitarbeit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEU | 15251 | 3915 | 789 | 583 | 556 | 533 | 410 | 397 | 134 | 197 | 289 | 27 |
| POL | 13219 | 2477 | 747 | 404 | 134 | 271 | 151 | 178 | 390 | 125 | 76 | 1 |
| FRA | 10390 | 2379 | 400 | 315 | 298 | 373 | 205 | 240 | 212 | 138 | 152 | 46 |
| ESP | 4748 | 566 | 74 | 17 | 9 | 240 | 5 | 10 | 102 | 100 | 2 | 7 |
| CZE | 3099 | 421 | 200 | 69 | 14 | 67 | 1 | 17 | 36 | 15 | 0 | 2 |
| NLD | 2352 | 343 | 58 | 9 | 4 | 42 | 4 | 4 | 108 | 25 | 4 | 85 |
| ROU | 2567 | 266 | 112 | 44 | 14 | 19 | 7 | 19 | 25 | 20 | 6 | 0 |
| BEL | 2722 | 244 | 63 | 31 | 15 | 58 | 6 | 3 | 38 | 13 | 1 | 16 |
| SWE | 2603 | 220 | 48 | 30 | 8 | 41 | 13 | 9 | 51 | 8 | 3 | 9 |
| NOR | 1286 | 215 | 45 | 29 | 15 | 26 | 13 | 16 | 38 | 10 | 12 | 11 |
| ITA | 3009 | 197 | 18 | 9 | 0 | 66 | 0 | 2 | 73 | 14 | 0 | 15 |
| AUT | 1086 | 187 | 34 | 35 | 29 | 16 | 17 | 19 | 23 | 1 | 9 | 4 |
| LVA | 1047 | 149 | 42 | 15 | 14 | 27 | 2 | 2 | 40 | 7 | 0 | 0 |
| LUX | 404 | 147 | 33 | 7 | 25 | 18 | 20 | 16 | 2 | 8 | 18 | 0 |
| CHE | 1077 | 144 | 34 | 37 | 18 | 11 | 5 | 19 | 3 | 2 | 11 | 4 |
| BGR | 1280 | 109 | 21 | 5 | 4 | 0 | 11 | 6 | 47 | 15 | 0 | 0 |
| GRC | 1037 | 99 | 11 | 2 | 1 | 36 | 0 | 0 | 17 | 31 | 0 | 1 |
| SVK | 818 | 98 | 56 | 12 | 4 | 9 | 2 | 7 | 2 | 2 | 4 | 0 |
| PRT | 1409 | 95 | 7 | 0 | 0 | 35 | 0 | 3 | 13 | 33 | 1 | 3 |
| DNK | 714 | 89 | 24 | 7 | 2 | 25 | 2 | 3 | 17 | 3 | 4 | 2 |
| HUN | 786 | 86 | 34 | 4 | 0 | 14 | 4 | 4 | 15 | 7 | 0 | 4 |
| FIN | 1367 | 84 | 15 | 12 | 0 | 25 | 1 | 4 | 10 | 12 | 0 | 5 |
| IRL | 872 | 84 | 33 | 13 | 4 | 4 | 5 | 7 | 5 | 8 | 0 | 5 |
| SVN | 1152 | 58 | 3 | 1 | 0 | 16 | 1 | 0 | 18 | 18 | 0 | 1 |
| EST | 533 | 36 | 4 | 0 | 1 | 13 | 0 | 0 | 16 | 2 | 0 | 0 |
| LTU | 1341 | 35 | 11 | 1 | 0 | 4 | 0 | 0 | 13 | 5 | 0 | 1 |
| HRV | 1414 | 31 | 7 | 2 | 0 | 5 | 0 | 1 | 5 | 11 | 0 | 0 |
| MLT | 231 | 27 | 10 | 0 | 0 | 6 | 2 | 0 | 3 | 3 | 0 | 3 |
| ISL | 84 | 14 | 4 | 0 | 0 | 6 | 0 | 0 | 2 | 2 | 0 | 0 |
| CYP | 172 | 8 | 4 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | 0 |
| LIE | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Auffällig: Italien und Spanien haben viele Bekanntmachungen insgesamt, aber wenige in unseren CPV-Gewerken (vermutlich
Sammelbekanntmachungen / andere CPV-Nutzung; vor Ausbau prüfen). Albanien ist nicht auf TED (eigenes Portal APP).
