# Nachtplan 02./03.11.2026 (Claude arbeitet allein, Benjamin schläft)

Ziel der Nacht: **Italien so weit bringen wie Polen und Spanien**, danach die Niederlande vorbereiten.
Jede Weckung: obersten offenen Punkt nehmen, fertig machen (Tests grün, committen, pushen, Ausrollen prüfen), abhaken,
Protokoll unten ergänzen. Ist ein Punkt blockiert, Grund notieren und zum nächsten springen.

## Regeln für die Nacht (aus CLAUDE.md)
- Nichts nach außen: keine Mails an Dritte, keine Posts, keine Anfragen an Behörden, keine Käufe, keine Konten.
- Keine Passwörter oder Schlüssel eingeben.
- Datenquellen: Nutzungsbedingungen/Lizenz und robots.txt **vor** dem ersten Abruf prüfen (erst nur Lese-Workflow). Gesperrt = nicht nutzen, nur dokumentieren.
- KI-Kosten klein halten: höchstens ein Länder-Durchlauf pro Land (ca. 0,07 $).
- Strikte Trennung von RestockHero und Demopin.

## Punkte
- [ ] 1. Italien recherchieren: nationale Quelle (ANAC, Banca Dati Nazionale dei Contratti Pubblici / Open Data, ggf. Pubblicità a valore legale), Lizenz, robots.txt, Schnittstelle, Mengen. Lese-Workflow `italien-test.yml`. Ergebnis in `docs/italien.md`.
- [x] 1b. **KI-Kosten senken bei gleicher oder besserer Qualität** (Wunsch Benjamin 02.11. abends). Erst messen, dann ändern:
  - Ist-Stand erfassen: welche Aufrufe (Suchprofil, Bewertung, Steckbrief, Kalkulation), welches Modell, Tokens und Kosten pro Lauf (`alarm/ki.py`, `web/src/workflow.ts`, Budgettabellen).
  - Kandidaten: Prompt-Caching für die langen festen Anleitungen; Batch-API (50 % günstiger) für die nächtliche Bewertung, die nicht sofort fertig sein muss; schärfere Vorfilter (CPV, Ort, Ausschlusswörter) vor der KI; Bewertung einer Bekanntmachung einmal zusammenfassen und für alle Firmen wiederverwenden; kürzere, strukturierte Antworten; günstiges Modell nur für die Vorauswahl, starkes Modell für die echten Kandidaten.
  - Qualität absichern: feste Vergleichsmenge (bekannte Treffer und Nicht-Treffer aus PerLease, Frankreich-, Polen-, Spanien-Durchlauf), alte und neue Variante gegeneinander, Abweichungen der Punkte notieren. Nur übernehmen, was gleich gut oder besser ist.
  - Ergebnis und Ersparnis in `docs/ki-kosten.md`; risikolose Änderungen (z. B. Caching) direkt einbauen, Modellwechsel nur mit Vergleich.
- [ ] 2. Italien Oberfläche: Wörterbuch `web/src/italienisch/` (per Agenten wie bei pl/es), App-Sprache `it`, Fuß mit Italiano, Land IT → it.
- [ ] 3. Italien KI und Mail: `alarm/sprache-it.txt`, `mail.T["it"]` (Zeitzone Rom), Sprache aus Land ITA → it, Tests.
- [ ] 4. Italien Suchgebiet: Regionen (NUTS-2, ITC1 … ITG2) wie Comunidades, Formular und Suchprofil.
- [ ] 5. Italien Datenquelle einbauen (nur wenn Punkt 1 grünes Licht gibt), sonst nur TED; Länder-Durchlauf `land=it` mit Testfirma, Ergebnis notieren.
- [ ] 6. Italien Gewerke-Seiten `/it/gare-d-appalto` und Rechtsseiten (Garante Privacy), wie pl/es.
- [ ] 7. Niederlande recherchieren (TenderNed Open Data, Lizenz, robots.txt), nur Lese-Workflow und `docs/niederlande.md`.
- [ ] 7b. **Ideen: Jarvis als komplette Arbeitsoberfläche für Firmen** (Wunsch Benjamin 02.11. nachts): 20–50 Funktionen sammeln (Personal, Buchhaltung/Steuer-Vorbereitung, Angebote und Aufträge anderer Firmen/Marktplatz, Kunden, Dokumente, Fuhrpark …). Erst Bestand prüfen (vieles gibt es schon: Personal, Kalkulation, Angebote, Abrechnung, Stempeluhr), dann Lücken. Pro Idee: Nutzen, Aufwand (S/M/L), Abhängigkeiten, rechtliche Hinweise (z. B. Steuer nur Vorbereitung/Export, keine Steuerberatung; GoBD). Priorisierte Liste in `docs/ideen-arbeitsoberflaeche.md`. Nur Konzept, nichts bauen.
- [ ] 7c. **Abo-Modelle** (Wunsch Benjamin, „wenn alles fertig ist“): Vorschlag in `docs/abos.md` auf Basis von `web/src/plaene.ts` (Free/Basis/Pro/Erfolg), KI-Kosten pro Firma (aus Punkt 1b), Wettbewerberpreise (öffentliche Preisseiten), Länder, Kleinunternehmerregelung § 19 UStG. Mit Rechenbeispiel Marge pro Plan. Nur Vorschlag, Entscheidung bei Benjamin.
- [ ] 8. Morgenbericht für Benjamin: unten unter „Morgenbericht“, kurz, Wichtigstes zuerst, was er testen/entscheiden muss.

## Protokoll
- 23:05 UTC 1b fertig: Prompt-Caching (gleicher Text) und Haiku-Vorfilter (Schwelle 3, Sonnet bewertet endgültig) live. Vergleich auf 285 bewerteten Ausschreibungen: 51/51 Treffer erhalten, ca. 40–45 % billiger. Details `docs/ki-kosten.md`. Batch-API vorgeschlagen (weitere 50 %), braucht früheren Alarm-Start → Entscheidung Benjamin.
- 23:10 UTC Punkt 1 Italien: Lese-Test (Run 41542963808) ok: ANAC-PVL-Schnittstelle erreichbar, robots.txt sperrt nichts (PVL liefert keine echte robots.txt, www.anticorruzione.it `Allow: /`), ca. 100 Ausschreibungen am 02.11. dati.anticorruzione.it sperrt GitHub-Rechenzentren (403). Lizenzwortlaut der „Note legali“ noch genauer lesen.
- Punkte 3 und 4 (Italien KI/Mail, Regionen) umgesetzt und gepusht (32c5759). Punkt 2 (Wörterbuch) läuft über 4 Helfer.

## Morgenbericht
