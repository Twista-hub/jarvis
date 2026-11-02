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
- [ ] 1b. **KI-Kosten senken bei gleicher oder besserer Qualität** (Wunsch Benjamin 02.11. abends). Erst messen, dann ändern:
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
- [ ] 8. Morgenbericht für Benjamin: unten unter „Morgenbericht“, kurz, Wichtigstes zuerst, was er testen/entscheiden muss.

## Protokoll

## Morgenbericht
