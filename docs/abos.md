# Abo-Vorschlag für Jarvis (02.11.2026, Claude)

> **Nur ein Vorschlag.** Preise, Zahlungen und Stripe erst nach Benjamins OK. Nichts davon ist live
> (`web/src/plaene.ts` bleibt bis zur Entscheidung abgeschaltet).

## 1. Kurzfassung

| Plan | Monatlich | Jährlich (2 Monate geschenkt) | Für wen | Kern |
|---|---:|---:|---|---|
| **Free** | 0 € | – | Ausprobieren, Einzelbetrieb | 1 Suchprofil, 1 Land, 1 Nutzer, Treffer mit Kurzüberblick, Wochenmail |
| **Basis** | **59 €** | 590 € (≈ 49 €/Monat) | Kleiner Betrieb, 1 Standort, will Aufträge finden | Täglicher Alarm per Mail und Handy, 3 Suchprofile, 3 Nutzer, 5 Steckbriefe aus Unterlagen/Monat, Kalkulation |
| **Pro** | **149 €** | 1.490 € (≈ 124 €/Monat) | Reinigung, Sicherheit, Handwerk, Zeitarbeit mit 10–50 Kräften | Alles aus Basis + Angebotsmappe mit Freigabe + Arbeitsoberfläche (Personal, Einsatzplanung, Zeiterfassung, Abrechnung), 5 Büro-Nutzer, 25 Einsatzkräfte, alle Länder, 30 Steckbriefe |
| **Business** | **399 €** | 3.990 € (≈ 333 €/Monat) | Mehrere Standorte und Regionen (z. B. PerLease) | Alles aus Pro, Standorte unbegrenzt, 15 Büro-Nutzer, 100 Einsatzkräfte, 100 Steckbriefe, bevorzugter Support |
| *Erfolg (Option)* | *später* | – | Skeptische Firmen | Niedrige Grundgebühr + Anteil bei Zuschlag. Erst nach 6–12 Monaten prüfen (Abschnitt 5) |

- **Preis netto = Endpreis**, solange Benjamin Kleinunternehmer nach § 19 UStG ist. In AGB und Stripe trotzdem als
  **„zzgl. USt., soweit sie anfällt“** anlegen. Dann bleibt der Preis beim Wechsel zur Regelbesteuerung gleich (Abschnitt 6).
- **Test:** Jede neue Firma bekommt automatisch **14 Tage Pro**, ohne Karte. Danach Free, nichts wird gelöscht.
- **Zusatz:** weiterer Büro-Nutzer 12 € (Pro) bzw. 9 € (Business), weitere Einsatzkraft 2 € (Pro) bzw. 1,50 € (Business),
  10 zusätzliche Steckbriefe 15 €. Leser (nur lesen) bleiben kostenlos.
- **Warum eine neue Stufe „Business“ statt „Erfolg“:** Der größte Wert liegt bei Firmen mit vielen Standorten und viel
  Personal. Ein Erfolgshonorar ist rechtlich und praktisch aufwendig und passt schlecht zur Kleinunternehmergrenze.
  „Erfolg“ bleibt als Option.

## 2. Was jeder Plan darf

| | Free | Basis | Pro | Business |
|---|---|---|---|---|
| Suchprofile (Leistung + Gebiet) | 1 | 3 | 10 | unbegrenzt (fair use) |
| Länder | 1 | 1 + 1 Nachbarland | alle (DE, AT, CH, FR, PL, ES, IT, US …) | alle |
| Standorte / Regionen | 1 | 1 | bis 5 | unbegrenzt, mit Regionen |
| Büro-Nutzer (Inhaber, Admin, Bearbeiter) | 1 | 3 | 5 inkl. (+12 €) | 15 inkl. (+9 €) |
| Einsatzkräfte mit eigenem Zugang | – | – | 25 inkl. (+2 €) | 100 inkl. (+1,50 €) |
| Leser | – | unbegrenzt | unbegrenzt | unbegrenzt |
| KI-Bewertung neuer Ausschreibungen | ja (bis 300/Monat) | ja | ja | ja |
| Benachrichtigung | Wochenmail | täglich Mail + Handy, Fristen-Erinnerung | wie Basis | wie Basis |
| Kurzüberblick aus der Bekanntmachung | ja | ja | ja | ja |
| Steckbrief aus hochgeladenen Unterlagen | – | 5 / Monat | 30 / Monat | 100 / Monat |
| Unterlagen-Upload | – | ja | ja | ja |
| Kalkulation pro Los, Tarifdatenbank | ansehen | ja | ja, Vorlagen pro Standort | ja |
| Angebotsmappe, Chef-Freigabe, Abgabe-Beleg | – | – | ja | ja |
| Firmenunterlagen, Nachweise, Präqualifikation | – | ja | ja | ja |
| **Personal** (Personalakte, Qualifikationen, Unterweisungen, PSA, Bewerber) | – | – | ja | ja |
| **Einsatzplanung** (Schichtplan, offene Schichten, Einsatzplan, Rundnachricht) | – | – | ja | ja |
| **Zeiterfassung** (Stempeluhr, Stundenzettel, Arbeitszeitkonto, Urlaub) | – | – | ja | ja |
| **Abrechnung** (Leistungsnachweis, Kundenbestätigung, Rechnungen, Lohnliste, Spesen) | – | – | ja | ja |
| Organigramm, Rechte, Vertretung | – | – | ja | ja, mit Regionen |
| Support | Hilfeseiten | Mail, 2 Werktage | Mail, 1 Werktag + 30 Min. Einrichtung per Video | Mail am selben Werktag, Einrichtung + Personal-Import |

Hinweise:
- Free-Konten ohne Anmeldung seit 30 Tagen: KI-Bewertung pausiert, bis sich jemand wieder anmeldet. Das begrenzt die Kosten.
- Free-Erstlauf nur über die letzten 30 Tage, nicht den ganzen offenen Bestand (spart bis zu 1 $ pro Anmeldung).
- Nach Ablauf eines Abos werden Daten der Arbeitsoberfläche 90 Tage **nur lesbar**, nicht gelöscht. Export bleibt möglich.
- Die Arbeitsoberfläche ist auf deutsches Arbeits- und Tarifrecht zugeschnitten. In FR, PL, ES, IT und US ist Pro
  zunächst vor allem „mehr Länder, mehr Steckbriefe, Angebotsmappe“.

## 3. Kosten und Marge

### Annahmen
- KI: 0,002 $ pro bewertete Ausschreibung (nach Vorfilter, `docs/ki-kosten.md`). Steckbrief aus Unterlagen 0,05–0,30 $.
  Firmenrecherche 0,05–0,15 $ und Erstlauf 0,5–1 $ einmalig (auf 12 Monate verteilt).
- Kurs 1 $ = 0,90 € (vorsichtig).
- **Als Kleinunternehmer gibt es keine Vorsteuer.** KI und Infrastruktur deshalb mit +19 % gerechnet (Reverse Charge
  nach § 13b gilt auch für Kleinunternehmer).
- Infrastruktur (Cloudflare, Supabase, GitHub) fest 50 € netto, ab vielen Kunden mehr (siehe Beispiele).
- Stripe: 1,5 % + 0,25 € (EU-Karte) plus ca. 0,7 % Stripe Billing für Abos (Billing-Satz **ungeprüft**). Gerechnet: 2,2 % + 0,25 €.
  SEPA-Lastschrift laut Drittquellen 0,35 € pauschal (günstiger bei großen Beträgen).
- Benjamins Arbeitszeit (Support) ist **nicht** eingerechnet.

### Pro Kunde und Monat (Obergrenze, 50 zahlende Kunden)

| Plan | Preis | KI (Obergrenze) | Stripe | Infra-Anteil | Kosten | Deckungsbeitrag | Marge |
|---|---:|---:|---:|---:|---:|---:|---:|
| Free | 0 € | 0,75 € (≤ 300 Bewertungen + Erstlauf) | – | – | 0,75 € | −0,75 € | – |
| Basis | 59 € | 2,89 € (bis 600 Bewertungen, 5 Steckbriefe à 0,30 $) | 1,55 € | 1,43 € | 5,87 € | **53,13 €** | 90 % |
| Pro | 149 € | 11,78 € (bis 1.000 Bewertungen, 30 Steckbriefe à 0,30 $) | 3,53 € | 1,43 € | 16,74 € | **132,26 €** | 89 % |
| Business | 399 € | 38,56 € (bis 3.000 Bewertungen, 100 Steckbriefe à 0,30 $) | 9,03 € | 1,43 € | 49,02 € | **349,98 €** | 88 % |

Im Alltag liegt die KI eher bei einem Viertel bis einem Drittel der Obergrenze (meist 50–300 Kandidaten und wenige Steckbriefe).
Ein Basis-Kunde trägt die KI-Kosten von rund 70 Free-Konten.

### Beispielrechnung (Obergrenze, 3 Free-Konten je zahlendem Kunden)

| | 10 Kunden | 50 Kunden | 200 Kunden |
|---|---:|---:|---:|
| Mischung Basis / Pro / Business | 6 / 3 / 1 | 30 / 15 / 5 | 120 / 60 / 20 |
| Free-Konten | 30 | 150 | 600 |
| **Umsatz pro Monat** | **1.200 €** | **6.000 €** | **24.000 €** |
| KI (inkl. Free) | 114 € | 569 € | 2.275 € |
| Stripe | 29 € | 145 € | 578 € |
| Infrastruktur (brutto) | 60 € (50 € netto) | 71 € (60 € netto) | 143 € (120 € netto, größere Datenbank) |
| **Kosten gesamt** | 202 € | 785 € | 2.996 € |
| **Rohertrag pro Monat** | **998 € (83 %)** | **5.215 € (87 %)** | **21.004 € (88 %)** |
| Umsatz pro Jahr | 14.400 € | 72.000 € | 288.000 € |
| Kleinunternehmer? | ja | nur im 1. Jahr (Vorjahr > 25.000 €) | nein, Grenze 100.000 € im Jahr gerissen |

Bei 200 Kunden fällt § 19 weg. Dann kommt die USt oben drauf und die Vorsteuer auf Kosten zurück: die Marge steigt leicht.

## 4. Marktvergleich (Preise aus der Websuche am 02.11.2026)

Die Anbieterseiten ließen sich aus dieser Sitzung nicht direkt öffnen (Netzwerk gesperrt). Alle Werte stammen aus
Suchergebnissen und Drittseiten und sind **ungeprüft**. Vor einer Veröffentlichung selbst nachsehen.

### Ausschreibungsdienste

| Anbieter | Land | Preis (netto) | Quelle |
|---|---|---|---|
| TED, TenderNed, BOAMP-Alerts, SAM.gov, evergabe-online/cosinex-Plattformen (für Bieter) | EU, NL, FR, US, DE | 0 € (kostenlose Suche/Alerts, ohne Bewertung) | https://webwoordenboek.nl/kenniscentrum/wat-kost-tenderned, https://www.marche-public.fr/veille-marches-publics-appels-offres-pme-entreprises.htm, https://a.storyblok.com/f/328997/x/e9d3145f98/260901-preisliste-ag-evergabe-de.pdf |
| evergabe.de (Bieter) | DE | Basic 83 €/Monat bzw. 59 € bei Jahreszahlung; Pro 107 € bzw. 86 € (Stand 22.09.2026) | https://a.storyblok.com/f/328997/x/b7506f8103/260922-preisliste-an-evergabe-de.pdf |
| subreport | DE | 84–198 €/Monat, je weiteres Suchprofil 54–128 €, 12 Monate Laufzeit (laut Wettbewerber Jorpex) | https://jorpex.com/de/compare/subreport-alternative/ |
| DTAD | DE | keine öffentlichen Preise, Angebot über Vertrieb | https://www.ki-syndikat.de/tools/dtad/ |
| Tendit (KI) | DE | ca. 300 €/Monat Einstieg (laut Wettbewerber auftrag.ai) | https://auftrag.ai/en/alternativen/tendit |
| VergabePilot (KI) | DE | Free, 60 €/Monat (1 Nutzer), 125 €/Monat (5 Nutzer) | https://www.ki-syndikat.de/tools/vergabepilot/ |
| TenderWolf | EU | Free (1 Land), 79 €/Monat (1 Land), 149 €/Monat (ganz Europa) | https://tenderwolf.com/en/help-center/tenderwolf-pricing/ |
| auftrag.at | AT | „ab 33 €/Monat“ (alte, undatierte Angabe) | https://www.wko.at/service/wirtschaftsrecht-gewerberecht/Wo-werden-oeffentliche-Ausschreibungen-veroeffentlicht.html |
| Marchés Online, Veille Intégrale | FR | bis 200 € HT/Monat (ganz Frankreich), ab 25 € HT für Moniteur-Abonnenten | https://www.marchesonline.com/veille-integrale, https://www.marchesonline.com/vi_plaquette.pdf |
| France Marchés | FR | kein Preis gefunden | – |
| Tendios / Licitaciones365 / Gobierto | ES | 37–345 € / 9–69 € / 125–1.241 €/Monat | https://jorpex.com/es/compare/alertas-licitaciones-comparativa/, https://contratos.gobierto.es/empresas/planes |
| Tender Impulse | international | kein Preis gefunden | – |
| HigherGov / GovTribe / BidNet | US | ca. 500–5.000 $/Jahr / 1.200–2.100 $ je Nutzer/Jahr / 200–600 $/Jahr | https://prospeo.io/s/deltek-govwin-iq-pricing-reviews-pros-and-cons, `docs/usa-recherche.md` Abschnitt 5 |

**Einordnung:** Reine Alarme kosten 0–110 €/Monat. KI-Dienste liegen bei 60–300 €. Jarvis Basis (59 €) liegt am unteren
Rand, bietet aber KI-Bewertung und Steckbriefe. Das ist der Einstieg.

### Personal- und Einsatzwerkzeuge (Anker für Pro und Business)

| Anbieter | Preis (netto) | Quelle |
|---|---|---|
| Papershift | 4 € (Zeiterfassung), 6 € (mit Dienstplan), 9 € je Mitarbeiter/Monat, Jahresabo | https://www.fastlancer.org/fastlancer-blog/papershift-review/ |
| clockin | 3,99 / 6,99 / 9,99 € je Mitarbeiter/Monat | https://www.taxandbytes.de/tools/zeiterfassung/clockin/preise |
| Planday | 2,49 / 4,49 / 6,49 € je Nutzer/Monat (andere Quelle: 2,99 / 4,99 €) | https://www.capterra.com/p/145648/Planday/, https://www.ki-syndikat.de/tools/planday/ |
| ordio | 89 / 129 / 169 € je **Standort**/Monat | https://www.ordio.com/de/preise |
| ZEP | ab 1,50 € (Clock), ca. 7 € (Compact), ca. 18 € (Professional) je Nutzer/Monat | https://www.zep.de/en/price-calculator/, https://www.taxandbytes.de/tools/projektmanagement/zep/preise |
| Personio | keine öffentlichen Preise mehr; früher 2,88–4,43 € je Mitarbeiter, Dritte schätzen 5–15 € | https://www.usagepricing.com/blueprint/personio |

**Einordnung:** Eine Reinigungsfirma mit 25 Kräften zahlt bei Papershift (mit Dienstplan) rund 150 €/Monat, nur für
Planung und Zeiten. Jarvis Pro kostet dasselbe und bringt die Ausschreibungen mit. PerLease (16 Standorte) zahlt bei
ordio ab 1.424 €/Monat. Jarvis Business mit 300 Kräften: 399 € + 200 × 1,50 € = **699 €**.

## 5. Option „Erfolg“ (Anteil bei Zuschlag)

**Idee:** 29 € Grundgebühr (Umfang wie Basis) plus 1,5–3 % vom Auftragswert des ersten Vertragsjahres,
höchstens 2.500 € pro Zuschlag. Gilt nur für Ausschreibungen, die die Firma in Jarvis bearbeitet und als „abgegeben“ markiert hat.

| Vorteile | Nachteile und Risiken |
|---|---|
| Kaum Einstiegshürde, gut für skeptische Firmen | **Zuschlag nachweisen:** Unterhalb der EU-Schwelle wird der Gewinner oft nicht veröffentlicht. Es bleibt nur die Meldepflicht des Kunden plus Prüfrecht. Streit ist absehbar |
| Wir verdienen mit, wenn Jarvis wirklich hilft | **Ursächlichkeit:** „Die Ausschreibung hätten wir auch so gefunden.“ Vertrag muss klar regeln, wann die Gebühr fällt |
| Hohe Einnahmen bei großen Aufträgen | **Spät:** Zuschlag 2–6 Monate nach dem Fund, Zahlung oft noch später. Lange kein Geld |
| | **Kleinunternehmergrenze:** Eine große Provision kann die 100.000 € im laufenden Jahr auf einen Schlag reißen |
| | **Rechtliches:** Provisionsvereinbarung muss von Anwalt oder IHK geprüft werden (AGB-Kontrolle, keine Rechtsberatung, Abgrenzung zum Makler). Manche Auftraggeber fragen nach Vermittlern oder Provisionen |
| | **Aufwand:** Rechnungen von Hand, Mahnungen, Nachweise. Für einen Nebenerwerb schwer |

**Empfehlung:** Nicht zum Start. Erst prüfen, wenn es 20–30 zahlende Kunden gibt und die Zuschlagsquote messbar ist.
Dann nur für Business-Kunden und gedeckelt.

## 6. Länder, Testphase, Kleinunternehmergrenze

### Länderpreise

| Markt | Währung | Basis | Pro | Business | Begründung |
|---|---|---:|---:|---:|---|
| DE, AT, FR | EUR | 59 € | 149 € | 399 € | Ähnliche Kaufkraft und Marktpreise |
| CH | CHF | 59 CHF | 149 CHF | 399 CHF | Gleiche Zahl, CHF ist etwas mehr wert. B2B-Leistung: Steuer zahlt der Kunde (Bezugsteuer), **mit Steuerberater prüfen** |
| ES, IT | EUR | 49 € | 129 € | 349 € | Marktpreise in Spanien deutlich niedriger (Licitaciones365 9–69 €) |
| PL | PLN | 149 zł | 399 zł | 999 zł | Rund 40 % günstiger (≈ 35 / 94 / 235 €, Kurs ungeprüft) |
| US | USD | 69 $ | 179 $ | 449 $ | „plus applicable sales tax“; neben HigherGov ab ca. 500 $/Jahr. Sales Tax erst ab 100.000 $ pro Staat (`docs/usa-recherche.md`) |

Das Land richtet sich nach dem Firmensitz. Die Arbeitsoberfläche bleibt in allen Ländern dieselbe.

### Testphase
- 14 Tage Pro automatisch nach der E-Mail-Bestätigung, ohne Karte. Einmal pro Firma (Website-Domain bzw. USt-IdNr).
- Erinnerung an Tag 10 und Tag 13: „Plan wählen“. Danach Free. Daten bleiben, Pro-Bereiche 90 Tage nur lesbar.
- Kosten der Testphase: höchstens ca. 1 $ Erstlauf + 5 $ KI. Vertretbar.
- PerLease: wie besprochen 2 Monate kostenlos (`PLAN.md`), danach Business.

### Kleinunternehmergrenze (§ 19 UStG, seit 2025)
- Grenzen: Vorjahr höchstens **25.000 €**, laufendes Jahr höchstens **100.000 €**. Wird 100.000 € im laufenden Jahr
  überschritten, gilt die Regelbesteuerung **ab genau diesem Umsatz**. Wird 25.000 € überschritten, ab dem Folgejahr.
- **Alle** Umsätze von WP Digital Ranger zählen zusammen, auch RestockHero-Provisionen und Webaufträge.
- 25.000 € im Jahr sind rund 2.080 € im Monat: etwa 35 Basis- oder 14 Pro-Kunden.
- Leistungen an Firmen im Ausland sind nach § 3a Abs. 2 UStG in Deutschland nicht steuerbar. Ob und wie sie zur Grenze
  zählen, **mit Steuerberater klären**. Ebenso: USt-IdNr beantragen (für EU-Kunden mit Reverse-Charge-Hinweis) und ob eine
  Zusammenfassende Meldung nötig ist.

**So bleibt der Wechsel schmerzlos:**
1. Preise von Anfang an als **Nettopreise** anlegen: AGB „zzgl. USt., soweit sie anfällt; derzeit nach § 19 UStG keine“.
   In Stripe Preise mit Steuerverhalten „exklusiv“.
2. Umsatz monatlich im Blick behalten (Stripe-Bericht plus übrige Einnahmen). Warnung ab 20.000 € im Jahr.
3. Beim Wechsel: Stripe Tax einschalten, 19 % kommen oben drauf. Kunden sind Firmen und ziehen die Vorsteuer ab:
   für sie ändert sich nichts. 4–6 Wochen vorher per Mail informieren.
4. Alternative: freiwillig früher auf § 19 verzichten (bindet 5 Jahre). Vorteil: Vorsteuer auf Anthropic, Cloudflare,
   Supabase zurück, kein Wechsel mitten im Jahr. Nachteil: Umsatzsteuer-Voranmeldungen. **Mit Steuerberater entscheiden.**
5. Begrenzen ist **nicht** empfohlen (z. B. Kundenstopp). Bei B2B kostet die Regelbesteuerung die Kunden nichts.

## 7. Nächste Schritte für Benjamin

**Entscheidungen (in dieser Reihenfolge):**
1. Stufen: Free / Basis / Pro / Business so übernehmen? „Erfolg“ vorerst nur als Option?
2. Preise: 59 / 149 / 399 € und Jahresrabatt „2 Monate geschenkt“?
3. Grenzen aus Abschnitt 2 (Nutzer, Einsatzkräfte, Steckbriefe, Länder) und Zusatzpreise.
4. Länderpreise: PL in Złoty, ES/IT günstiger, US in Dollar, CH in Franken?
5. 14 Tage Pro als Test für alle, PerLease 2 Monate frei?
6. Termin mit Steuerberater: Grenze, USt-IdNr, Auslandskunden, freiwilliger Verzicht auf § 19.

**Danach (erst nach OK, Claude baut, Benjamin richtet Konten ein):**
1. Benjamin legt ein Stripe-Konto für WP Digital Ranger an (eigenes Konto, **nicht** RestockHero). Bank- und Steuerdaten gibt er selbst ein.
2. Claude legt Produkte und Preise in Stripe an (Testmodus zuerst), Kundenportal für Kündigung und Planwechsel, SEPA und Karte.
3. Claude baut: Planprüfung in der App (Grenzen aus Abschnitt 2), Testphase mit Erinnerungen, Plan-Seite `/konto/plan`
   mit Stripe-Checkout statt Mail, Stripe-Webhook setzt `firmen.paket` (heute vor Inhabern geschützt), Free-Pause nach 30 Tagen.
4. AGB und Preisseite anpassen (Nettopreise, Kündigung, Laufzeit, Testphase). Anwalt oder IHK prüft.
5. Erst nach Test im Stripe-Testmodus und Benjamins OK live schalten.
