# USA-Recherche: Öffentliche Aufträge für kleine Handwerks- und Dienstleistungsfirmen

Stand: November 2026 (Recherche am 02.11.2026). Für Jarvis / künftig „GoGovJob“.
Zielgruppe: US-Kleinunternehmen aus Reinigung, Sicherheit, Elektro, HVAC, Sanitär, Maler, Dach, Garten-/Landschaftsbau, Boden, Schreiner/Zimmerer, Personaldienstleistung.

Hinweis zur Methode: Die Recherche lief über Websuche. Direkte Seitenabrufe von `open.gsa.gov` und `law.cornell.edu` waren in der Cloud-Sitzung gesperrt (Netzwerkfreigabe fehlt). Werte, die nur aus Sekundärquellen stammen oder die ich nicht gegen eine Primärquelle prüfen konnte, sind mit **(prüfen)** markiert. Vor dem US-Start bitte diese Stellen einmal gegen die verlinkte .gov-Quelle abgleichen.

---

## 1. Kurzfazit: Top 10 Funktionen (nach Kundennutzen / Aufwand)

Die wichtigste Erkenntnis vorweg: **Unser größter Engpass ist das SAM.gov-API-Kontingent.** Ein persönlicher Schlüssel ohne SAM-Rolle hat nur **10 Abrufe pro Tag**; mit Rolle oder Systemkonto **1.000 pro Tag** ([GSA Contract Awards API](https://open.gsa.gov/api/contract-awards/), [GSA-Ratenlimits, abgeleitet](https://raw.githubusercontent.com/api-evangelist/general-services-administration/refs/heads/main/rate-limits/general-services-administration-rate-limits.yml)). Mit 10 Abrufen/Tag gehen kein Anhang-Download und keine Beschreibungstexte. Wir brauchen ein **Non-Federal System Account** (setzt eine Entity-Registrierung von WP Digital Ranger in SAM.gov voraus, als ausländische Firma mit NCAGE-Code) oder mindestens eine Rolle. Das ist Schritt 0 vor allen Funktionen.

| # | Funktion | Nutzen für den Kunden | Aufwand | Datenquelle |
|---|---|---|---|---|
| 1 | **Gewerke-Treffer mit „Darf ich bieten?“-Ampel**: Feed nach NAICS/PSC, Ort (Umkreis), Set-Aside. Abgleich mit dem Kundenprofil: Größe (SBA Size Standard), Zertifikate (8(a), HUBZone, WOSB, SDVOSB), aktive SAM-Registrierung | Sehr hoch: spart die Hälfte der Lesezeit, verhindert Angebote, die sowieso ungültig wären | Niedrig–mittel | SAM.gov Opportunities API v2 (`naicsCode`, `classificationCode`, `typeOfSetAside`, `placeOfPerformance`), SAM.gov Entity API (Status, Ablaufdatum, NAICS, Zertifikate), SBA-Größentabelle |
| 2 | **Fristen- und Pflichtliste pro Ausschreibung**: Abgabefrist (`responseDeadLine`, mit Zeitzone), Frist für Rückfragen, Ortsbesichtigung (Site Visit), Amendments (SF 30 bestätigen!), Kalender-Export, Erinnerung per Mail/Telegram | Sehr hoch: verpasste Fristen und nicht bestätigte Amendments sind der häufigste K.-o.-Grund | Niedrig (Frist) / mittel (Fristen aus PDF per KI) | Opportunities API + Anhänge (KI-Extraktion) |
| 3 | **Anhänge laden + KI-Kurzfassung des SOW/PWS** und eine **Compliance-Matrix** aus Section L (Anweisungen) und Section M (Bewertung) bzw. bei RFQs aus den Angebotsanweisungen | Sehr hoch: Handwerker lesen keine 80-Seiten-PDFs | Mittel | Opportunities API `resourceLinks` (Download mit API-Key, kostet Abrufe) + Claude API |
| 4 | **Lohnkosten-Rechner mit Wage Determination**: zeigt die passende Service Contract Act- bzw. Davis-Bacon-Lohnliste (Stundenlohn + Fringe/H&W) für Ort und Tätigkeit, rechnet Mindest-Stundensatz inkl. Zuschläge | Hoch: Reinigung, Sicherheit, Garten und Bau verlieren sonst Geld oder bieten zu niedrig | Mittel | WD-Nummer steht meist im Anhang; WD-Texte auf sam.gov/wage-determinations (**keine öffentliche API gefunden**, nur Weblink/Handeingabe; Data-Services-Extrakt prüfen) |
| 5 | **Preis-Benchmark & Amtsinhaber (Incumbent)**: Wer hat den Vorgängervertrag, zu welchem Preis, wann läuft er aus | Hoch: realistischer Preis, Einschätzung der Gewinnchance | Mittel | USAspending.gov API (ohne Key), SAM.gov Contract Awards API (Nachfolger von FPDS) |
| 6 | **Recompete-Radar**: Verträge in NAICS + Region, deren Laufzeit in 6–18 Monaten endet → früh Kontakt zum Contracting Officer, Sources-Sought-Antworten vorbereiten | Hoch für Wiederholungsaufträge (Reinigung, Wachdienst, Grünpflege) | Mittel | USAspending `period_of_performance_current_end_date`, Contract Awards API |
| 7 | **Dokumentgenerator**: Capability Statement (1 Seite), Anschreiben, Past-Performance-Blatt, Preisblatt (CLIN-Struktur), vorausgefüllte Formulare SF 1449 / SF 18 / SF 33 / SF 1442 / SF 30 | Hoch | Mittel | Kundenprofil + Entity API (UEI, CAGE, NAICS) + GSA-Formularbibliothek (gemeinfreie PDF-Formulare) |
| 8 | **SAM-Registrierungs-Assistent**: Schritt für Schritt Login.gov → UEI → Entity Registration → Reps & Certs, Warnung vor Abzock-Dienstleistern, Erinnerung vor Ablauf (jährlich) | Hoch für Neulinge, starker Akquise-Hebel („kostenlos registrieren mit unserer Anleitung“) | Niedrig | Statische Anleitung + Entity API (`registrationExpirationDate`) |
| 9 | **Sources-Sought-Antwort in 10 Minuten**: Vorlage, die Fähigkeiten, Größe und Zertifikate zusammenfasst; erklärt dem Kunden, dass seine Antwort über einen Set-Aside entscheiden kann | Mittel–hoch (strategisch, wenig Konkurrenz) | Niedrig | Opportunities API (`ptype=r`), Kundenprofil |
| 10 | **Subunternehmer-Finder**: große Primes, die in NAICS und Region gewonnen haben (Subcontracting-Plan-Pflicht), plus SBA SubNet-Link und Profil-Tipps für SBA Small Business Search | Mittel: für Firmen ohne Past Performance oft der realistische Einstieg | Niedrig–mittel | USAspending API, SBA SubNet (nur Weblink, keine API), SBA SBS |

Danach (Phase 2): Ausschreibungen von Bundesstaaten und Städten, zuerst dort, wo es offene Daten gibt (NYC Open Data). Viele Staaten haben **keine** offizielle API; Scraping ist rechtlich und technisch riskant (siehe Kapitel 3.5).

---

## 2. Wie ein US-Kleinunternehmen an öffentliche Aufträge kommt – Schritt für Schritt

### 2.1 SAM.gov Entity Registration (Pflicht für Bundesaufträge)
- **Kosten: 0 $.** Registrierung und jährliche Verlängerung sind immer kostenlos. Wer Geld dafür verlangt, ist ein Dienstleister oder Betrüger ([Winvale: SAM-Scams](https://info.winvale.com/blog/how-avoid-sam.gov-registration-scams), [Crowell: SAM scams](https://crowell.com/en/insights/client-alerts/sam-scams-protect-your-company), [GSA-Warnung vor Phishing](https://content.govdelivery.com/accounts/USGSA/bulletins/358af1f)). Betrüger nutzen öffentlich sichtbare UEI/CAGE-Daten und schreiben neu registrierte Firmen an („Your SAM registration expires, pay $499“).
- **Ablauf:**
  1. Konto bei **Login.gov** (Zwei-Faktor) → Anmeldung auf sam.gov.
  2. **Unique Entity ID (UEI)**: 12-stellig, wird von SAM.gov vergeben (seit April 2022 Ersatz für DUNS). Die UEI läuft nicht ab, die Registrierung schon ([Texas: SAM-UEI](https://www.arts.texas.gov/wp-content/uploads/2022/04/SAM-UEI_after_April_4_2022.pdf)).
  3. **Entity Registration** (für Aufträge „All Awards“ wählen): Rechtsname und Adresse genau wie beim IRS (EIN/TIN), Bankverbindung für Zahlungen (EFT), NAICS-Codes, Points of Contact, **Representations & Certifications** (FAR 52.212-3 u. a.).
  4. **CAGE-Code**: wird automatisch von der DLA vergeben (Validierung).
  5. **Dauer:** typisch 7–10 Werktage, bei Abweichungen beim Abgleich (Name/Adresse/TIN) deutlich länger ([fed-spend Guide 2026](https://fed-spend.com/blog/sam-gov-registration-guide-2026)) **(prüfen)**. In Problemfällen fordert SAM.gov einen **notariell beglaubigten Brief** zur Bestätigung des Entity Administrators an (Vorlage auf sam.gov).
  6. **Verlängerung alle 365 Tage**. Läuft sie ab, ist die Firma nicht mehr vergabefähig. → Erinnerungsfunktion bauen.
- **Typische Fehler:** Firmenname/Adresse weicht von IRS- oder USPS-Daten ab; falscher Firmenverantwortlicher; NAICS fehlen; Reps & Certs nicht ausgefüllt; „Registration purpose: Financial Assistance only“ gewählt (dann keine Aufträge); Mails von gefälschten Absendern.
- **Neu 2026:** FPDS.gov ist seit **24.02.2026** abgeschaltet, Vergabedaten liegen nur noch in SAM.gov ([SAM.gov-Ankündigung](https://sam.gov/announcements/fpdsgov-decommissions-february-24-2026-0), [sam.gov/fpds](https://sam.gov/fpds)).

### 2.2 NAICS- und PSC-Codes – Zuordnung unserer Gewerke
NAICS beschreibt die Branche des Anbieters (und legt den Size Standard fest), PSC beschreibt, was der Staat kauft. Jede Ausschreibung hat genau einen NAICS-Code und einen PSC-Code (`naicsCode`, `classificationCode` in der API). PSC-Handbuch: [acquisition.gov/PSC_Manual](https://www.acquisition.gov/PSC_Manual).

Größengrenzen (Size Standards) laut SBA-Tabelle (gültige Fassung von 2023 mit Inflationsanpassung vom 17.11.2022; [SBA-Tabelle März 2023](https://www.sba.gov/sites/default/files/2023-03/Table%20of%20Size%20Standards_Effective%20March%2017%2C%202023%20%281%29%20%281%29_0.pdf), [13 CFR 121.201](https://www.ecfr.gov/current/title-13/chapter-I/part-121)). Durchschnittlicher Jahresumsatz der letzten 5 Jahre. Werte **(prüfen)**, außer 238210 (in zwei Quellen bestätigt).

| Gewerk | Haupt-NAICS (Size Standard) | Weitere NAICS | Typische PSC |
|---|---|---|---|
| Reinigung | 561720 Janitorial Services (22,0 Mio. $) | 561740 Carpet/Upholstery Cleaning; 561790 Other Services to Buildings; 562111 Waste Collection | S201 Housekeeping – Custodial Janitorial; S214 Carpet Laying/Cleaning; S205 Trash/Garbage Collection |
| Sicherheit | 561612 Security Guards & Patrol (29,0 Mio. $) | 561621 Security Systems Services (25,0 Mio. $) | S206 Housekeeping – Guard; R430 Physical Security/Badging; N063/J063 Installation/Wartung Alarm- und Sicherheitstechnik |
| Elektro | 238210 Electrical Contractors (19,0 Mio. $) | 236220 (bei Gesamtbau) | Z1xx Maintenance / Z2xx Repair-Alteration of Real Property; J061 / N061 elektrische Verteilung; Y1xx Neubau |
| HVAC | 238220 Plumbing, Heating & AC Contractors (19,0 Mio. $) | 811310 Commercial Machinery Repair | J041 Wartung Kälte-/Klima-/Lüftungstechnik; N041 Installation; Z1/Z2 |
| Sanitär | 238220 (19,0 Mio. $) | 237110 Water & Sewer Line Construction | J045 Wartung Sanitär-/Heizungsanlagen; N045; Z1/Z2 |
| Maler | 238320 Painting & Wall Covering (19,0 Mio. $) | 238990 | Z1xx / Z2xx (je nach Gebäudeart, z. B. Z2AA Bürogebäude) |
| Dach | 238160 Roofing Contractors (19,0 Mio. $) | 238170 Siding | Z2xx Repair/Alteration; Y1xx bei Neubau |
| Garten/Landschaft | 561730 Landscaping Services (9,5 Mio. $) | 238910 Site Preparation; 115310 Forestry Support | S208 Housekeeping – Landscaping/Groundskeeping; F0xx (Naturschutz, z. B. Gehölzpflege) |
| Boden | 238330 Flooring Contractors (19,0 Mio. $) | 238340 Tile & Terrazzo | Z2xx; S214 (Teppich) |
| Schreiner/Zimmerer | 238350 Finish Carpentry (19,0 Mio. $) | 238130 Framing Contractors (19,0 Mio. $); 337xxx (Möbel, Mitarbeitergrenze) | Z2xx; 71xx Möbel (Produkte) |
| Personal | 561320 Temporary Help Services (ca. 34,0 Mio. $) | 561311 Employment Placement; 561330 PEO | R699 Support – Administrative: Other; R6xx/R4xx je nach Tätigkeit |
| Allgemeiner Bau | 236220 Commercial & Institutional Building (45,0 Mio. $) | 238990 All Other Specialty Trade (19,0 Mio. $) | Y1xx, Z1xx, Z2xx |

Wichtig für unsere App: Viele Handwerksaufträge laufen als **Bau** (Z/Y-Codes) mit Bau-Regeln (Davis-Bacon, Bonds, SF 1442), Wartungs- und Reinigungsaufträge als **Dienstleistung** (S/J-Codes) mit Service Contract Act. Die App muss das automatisch erkennen.

**Size Standards ändern sich:** Die SBA hat am **20.08.2026** einen Vorschlag veröffentlicht, die rund 1.000 Größengrenzen auf 338 Gruppen zu reduzieren, erstmals auch an Produktivität anzupassen (Mindestgrenze laut Kanzleischätzung ca. 30,6 Mio. $) und Branchen auf Mitarbeitergrenzen umzustellen; Kommentarfrist bis 21.09.2026, **noch nicht in Kraft** ([Federal Register 2026-17042](https://www.federalregister.gov/documents/2026/08/20/2026-17042/small-business-size-standards), [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/08/sba-proposes-major-overhaul-of-small-business-size-standards-for-federal-contracts)). → Größentabelle in der DB als Daten pflegen, nicht im Code.

### 2.3 SBA-Zertifizierungen und Set-Asides
Alle Zertifizierungen laufen kostenlos über **MySBA Certifications** ([certifications.sba.gov](https://certifications.sba.gov)). Set-Aside-Codes in der API (Feld `typeOfSetAside`): `SBA` (Total Small Business), `SBP` (Partial), `8A`/`8AN` (8(a) Wettbewerb/Direktvergabe), `HZC`/`HZS` (HUBZone), `SDVOSBC`/`SDVOSBS`, `WOSB`/`WOSBSS`, `EDWOSB`/`EDWOSBSS`, `VSA`/`VSS` (nur VA), `ISBEE`/`IEE` (Indian Economic Enterprise), `LAS` (Local Area Set-Aside, z. B. Katastrophengebiete) **(Codeliste gegen open.gsa.gov prüfen)**.

| Programm | Voraussetzung (Kurzform) | Stand Nov. 2026 |
|---|---|---|
| **Small Business** (Selbsterklärung) | Unter dem Size Standard des NAICS der Ausschreibung | Keine Zertifizierung nötig; Selbsterklärung in SAM (FAR 52.219-1). Automatische Reservierung von Aufträgen zwischen Micro-Purchase- und Simplified-Acquisition-Grenze für Kleinunternehmen („Rule of Two“) |
| **8(a) Business Development** | Wirtschaftlich und sozial benachteiligte Inhaber, 9 Jahre Programm | Im Umbruch: Prüfung aller Teilnehmer seit Dez. 2025, **über 1.000 Firmen suspendiert** (SBA, 28.01.2026); seit 22.01.2026 keine Vermutung sozialer Benachteiligung nach Herkunft mehr; 2025 nur 65 Neuaufnahmen ([SBA-Pressemitteilung 26-26](https://www.sba.gov/article/2026/01/28/sba-suspends-over-1000-8a-firms-program-following-december-document-request), [Crowell](https://www.crowell.com/en/insights/client-alerts/8a-participants-and-the-8a-program-under-the-microscope-or-on-the-chopping-block)). Für unsere Zielgruppe nicht als Verkaufsargument nutzen |
| **HUBZone** | Hauptsitz in einer HUBZone, mind. 35 % der Mitarbeiter wohnen in einer HUBZone | Aktiv; HUBZone-Karte auf sba.gov. Zusätzlich 10 % Preisbewertungsvorteil in offenen Wettbewerben |
| **WOSB / EDWOSB** | Mind. 51 % im Besitz und unter Kontrolle von Frauen (EDWOSB zusätzlich wirtschaftlich benachteiligt); nur in NAICS, in denen Frauen unterrepräsentiert sind | Zertifizierung seit Okt. 2020 Pflicht (Selbsterklärung reicht nicht mehr für Set-Asides) |
| **VOSB / SDVOSB (VetCert)** | Mind. 51 % Veteranen bzw. dienstbeschädigte Veteranen | Seit 01.01.2023 bei der SBA; für SDVOSB-Set-Asides regierungsweit Zertifizierung nötig (Übergangsfrist endete 2024) |

Ziele der Bundesregierung (gesetzlich, regierungsweit): 23 % Kleinunternehmen, 5 % SDB, 5 % WOSB, 3 % HUBZone, 3 % SDVOSB ([CRS IN12018, Stand 30.06.2026](https://www.everycrsreport.com/files/2026-06-30_IN12018_6f51fa7436a86cc7af2612ae5a6aeea0ce180c18.html)). Agency-Ziele für FY2026 waren im Juni 2026 noch nicht veröffentlicht. (Der SDVOSB-Wert wurde per NDAA 2024 auf 5 % angehoben, **(prüfen, CRS-Tabelle war gekürzt)**.)

Verzeichnis: Die SBA hat **DSBS am 09.07.2025 durch „Small Business Search“ (SBS)** ersetzt ([search.certifications.sba.gov](https://search.certifications.sba.gov), [SmallGovCon](https://smallgovcon.com/federal-government-contracting/sba-introduces-its-new-small-business-search-system/), [iQuasar](https://iquasar.com/blog/sbs-replaces-dsbs-a-look-at-sbas-new-small-business-search-tool/)). Contracting Officer suchen dort nach Firmen, vor allem für Sources Sought und Marktrecherche. Daten kommen aus SAM; das Profil (Fähigkeiten, Stichworte) sollte der Kunde pflegen. Keine öffentliche API gefunden.

### 2.4 Schwellenwerte (Stand Nov. 2026, gültig seit 01.10.2025)
Quelle: FAR-Inflationsanpassung, [Federal Register 2025-16412 (90 FR 41872)](https://www.federalregister.gov/documents/2025/08/27/2025-16412/federal-acquisition-regulation-inflation-adjustment-of-acquisition-related-thresholds), [MRSC-Zusammenfassung](https://mrsc.org/stay-informed/mrsc-insight/november-2025/federal-thresholds).

| Schwelle | Wert | Bedeutung für Kunden |
|---|---|---|
| Micro-Purchase Threshold (MPT) | **15.000 $** (vorher 10.000 $) | Behörde kann ohne Wettbewerb kaufen, oft per Government Purchase Card. Kontakt zu lokalen Einrichtungen (Stützpunkte, VA-Kliniken) lohnt |
| MPT Bau mit Davis-Bacon | **2.000 $** | |
| MPT Dienstleistungen mit SCA | **2.500 $** | |
| Simplified Acquisition Threshold (SAT) | **350.000 $** (vorher 250.000 $) | Vereinfachtes Verfahren (RFQ, FAR Part 13); zwischen MPT und SAT grundsätzlich für Kleinunternehmen reserviert |
| Veröffentlichungspflicht auf SAM.gov | > 25.000 $ (FAR 5.101) | Darunter oft nur lokale Aushänge oder direkte Anfragen |
| Miller Act (Bürgschaften Bau) | **> 150.000 $**: Performance Bond + Payment Bond je 100 % | Seit NDAA 2022 von der Inflationsanpassung ausgenommen ([ASA](https://www.asaonline.com/2022/01/05/asa-secures-miller-act-exemption-from-inflationary-increases-in-the-fy22-ndaa/)). Zwischen 35.000 $ und 150.000 $ verlangt die Behörde eine alternative Zahlungssicherung (FAR 28.102-1(b)), **(prüfen)**. Bid Bond (meist 20 % des Angebots, SF 24) wenn Performance Bond nötig |
| Davis-Bacon Act | Bauaufträge > 2.000 $ | Ortsübliche Mindestlöhne + Fringe Benefits, wöchentliche Certified Payrolls (WH-347) |
| Service Contract Act | Dienstleistungsaufträge > 2.500 $ | Mindestlöhne + Health & Welfare je Stunde laut Wage Determination |
| Subcontracting Plan (für große Primes) | ab ca. 900.000 $ (Bau ca. 2 Mio. $) seit 01.10.2025 **(prüfen)** | Grund, warum Primes kleine Subunternehmer suchen |

Mindestlohn für Bundesauftragnehmer: EO 14026 (17,75 $) wurde am 14.03.2025 durch **EO 14236 aufgehoben**; das DOL setzt sie nicht mehr durch, es gilt wieder EO 13658 (2025: 13,30 $/Std.) ([SAM.gov-Hinweis](https://sam.gov/announcements/executive-order-14236-impacts-wage-determinations), [DOL](https://www.dol.gov/agencies/whd/government-contracts/minimum-wage)). Wert für 2026 **(prüfen)**.

**Regelwerk im Umbau:** Die „Revolutionary FAR Overhaul“ (RFO) schreibt die FAR neu. Seit Ende 2025 gelten Class Deviations (u. a. neue Part 19 Small Business ab Nov. 2025 / DoD ab 01.02.2026), am **23.06.2026** kamen Vorschläge für 20 FAR-Parts; Abschluss der Rechtsetzung ist bis Ende 2026 geplant ([acquisition.gov Model Deviation](https://acquisition.gov/node/64187), [Wiley-Tracker](https://www.wiley.law/far-and-dfars-overhaul), [Wolters Kluwer](https://www.wolterskluwer.com/en/expert-insights/the-revolutionary-far-overhaul-what-is-changing-and-what-to-do-next)). Folge für uns: FAR-Paragrafennummern in Texten und Vorlagen nicht hart codieren, sondern konfigurierbar halten; Kunden immer auf die Klauseln in **der konkreten Ausschreibung** verweisen.

### 2.5 Notice Types (SAM.gov, API-Parameter `ptype`)
| Typ | ptype | Was tun |
|---|---|---|
| **Sources Sought / RFI** | `r` | Marktrecherche der Behörde. Kurze Antwort (Fähigkeiten, Größe, Zertifikate, Interesse). Wenn ≥ 2 qualifizierte Kleinfirmen antworten, wird oft ein Set-Aside daraus → **hoher Hebel, wenig Aufwand** |
| **Presolicitation** | `p` | Vorankündigung; Ausschreibung folgt (meist ≥ 15 Tage später). Kalender setzen, Unterlagen vorbereiten |
| **Combined Synopsis/Solicitation** | `k` | Häufigster Typ für kommerzielle Leistungen (Reinigung, Grünpflege, Wartung): Ankündigung = Ausschreibung. Oft kurze Fristen (10–30 Tage) |
| **Solicitation** | `o` | Vollständige Ausschreibung (RFQ/RFP/IFB) |
| **Special Notice** | `s` | Infos, Industry Days, Vorabtermine |
| **Award Notice** | `a` | Zuschlag: Gewinner, Betrag → Preis-Benchmark, Teaming-Ansprache |
| Intent to Bundle / Justification | `i` / `u` | Für Kleinfirmen meist nur informativ |

### 2.6 RFQ vs. RFP vs. IFB
- **RFQ (Request for Quotation)**, meist unter SAT, Formular **SF 18** oder **SF 1449**: Angebot ist rechtlich nur ein „Quote“, oft Lowest Price Technically Acceptable (LPTA) oder Preis + einfache Kriterien. Ideal für Einsteiger.
- **RFP (Request for Proposal)**, FAR Part 15, Formular **SF 33** oder **SF 1449**: technischer Teil + Preis + Past Performance, Bewertung nach Section M (Best Value / Trade-off). Mehr Aufwand.
- **IFB (Invitation for Bids)**, Sealed Bidding, FAR Part 14, im Bau mit **SF 1442**: niedrigster Preis eines „responsive, responsible“ Bieters gewinnt, öffentliche Angebotsöffnung, kaum Verhandlung. Formfehler = Ausschluss (Bid Bond vergessen, Amendment nicht bestätigt).

### 2.7 Wie die Abgabe funktioniert
Die Ausschreibung bestimmt den Weg, typischerweise in Block 9/Section L („Offers due … submit to …“):
- **E-Mail an Contracting Officer/Specialist** (häufigster Weg bei kleinen Aufträgen; Größenlimit für Anhänge beachten, oft 10–25 MB).
- **PIEE Solicitation Module** (DoD; Zugang über piee.eb.mil, eigene Rolle „Proposal Manager“, Registrierung vorher erledigen).
- **Weitere Portale:** GSA **eBuy** (nur für MAS-Vertragsinhaber), **FedConnect** (u. a. DOE, HUD), Behördenportale (z. B. NASA, VA), selten Papier/Kurier (IFB im Bau).
- Spätere Angebote werden fast immer abgelehnt (FAR „late is late“). → Unsere App sollte mindestens 24 h Puffer empfehlen und die **Zeitzone** der Frist anzeigen (API liefert Offset).

### 2.8 FAR-Grundwissen für Kleinfirmen
- **Reps & Certs** in SAM (FAR 52.204-8, 52.212-3 „Offeror Representations and Certifications – Commercial Products and Commercial Services“): Größe, Status, Steuer, Verbote. Werden einmal jährlich in SAM gepflegt; in der Ausschreibung nur Abweichungen angeben.
- **52.212-1** (Anweisungen an Bieter, kommerziell), **52.212-2** (Bewertung), **52.212-4** (Vertragsbedingungen), **52.212-5** (gesetzliche Pflichtklauseln, u. a. SCA/DBA, Subunternehmer-Grenzen).
- **Limitations on Subcontracting** (FAR 52.219-14): Bei Set-Asides dürfen Kleinfirmen bei Dienstleistungen max. 50 %, bei Spezialbau max. 75 %, bei Gesamtbau max. 85 % des Auftragswerts an Nicht-Partner weitergeben (Weitergabe an ähnlich zertifizierte Firmen zählt nicht). Wichtig für Personal- und Reinigungsfirmen.
- **Section 889 / FAR 52.204-24/-25/-26** (keine Huawei/ZTE-Technik), **52.204-21** (Basis-Cybersicherheit), **52.232-33** (Zahlung per EFT), **52.222-41** (SCA), **52.222-6** (Davis-Bacon), **52.228-15** (Bonds).
- **Responsibility**: Behörde prüft Leistungsfähigkeit, Finanzen, Integrität (auch über SAM-Exclusions und FAPIIS).
- **Rechnungen** laufen über **Invoice Processing Platform (IPP)** oder **PIEE/WAWF** (DoD); Prompt Payment Act: Zahlung meist innerhalb 30 Tagen.

### 2.9 Past Performance / CPARS
- Bewertungen von Bundesaufträgen landen in **CPARS** (nicht öffentlich; Firma sieht eigene Bewertungen und kann Stellung nehmen). Contracting Officer sehen sie bei der Bewertung.
- Ohne Bundes-Referenzen: Aufträge von Bundesstaaten, Städten, Schulen und privaten Firmen zählen, meist als **Past Performance Questionnaire** (PPQ), das der Auftraggeber direkt an die Behörde schickt. „Neutral“-Bewertung ist erlaubt, wenn keine Referenz da ist (FAR 15.305).
- App-Funktion: Referenzen-Datenbank im Kundenprofil, PPQ-Versand an Referenzgeber mit Erinnerung.

### 2.10 Capability Statement
1 Seite PDF: Firmenname, UEI, CAGE, NAICS/PSC, Zertifikate, Kernkompetenzen, Alleinstellungsmerkmale, Referenzen (3), Kontakt, ggf. GSA-Vertragsnummer. Wird für Sources Sought, Industry Days und Erstkontakt mit Small Business Specialists (OSDBU) gebraucht. → perfekter KI-Generator-Fall.

### 2.11 Bonds im Bau
- Performance Bond und Payment Bond (SF 25 / SF 25A) ab 150.000 $, Bid Guarantee (SF 24) meist 20 % (max. 3 Mio. $). Bürgen müssen auf der **Treasury-Liste Circular 570** stehen.
- Kleinfirmen ohne Bürgschaftslinie: **SBA Surety Bond Guarantee Program** (SBA bürgt gegenüber dem Surety; Aufträge bis 9 Mio. $, bei Bundesaufträgen bis 14 Mio. $ **(prüfen)**). → Hinweis in der App, wenn ein Auftrag Bonds verlangt und der Kunde noch keine Bürgschaftslinie hat.

### 2.12 Davis-Bacon und Service Contract Act – Wage Determinations
- **Wo:** sam.gov/wage-determinations (seit 2019 Nachfolger von WDOL.gov) ([sam.gov/content/wage-determinations](https://sam.gov/content/wage-determinations), [DOL Prevailing Wage Resources](https://www.dol.gov/agencies/whd/government-contracts)). Die konkrete WD ist **Teil der Ausschreibung** (Nummer + Revision im Anhang, z. B. „WD 2015-4281 Rev. 32“).
- **SCA-WD**: Mindeststundenlohn je Berufsgruppe (z. B. Janitor, Guard I/II, Laborer Grounds Maintenance) + Health & Welfare (H&W) je Stunde + Urlaub/Feiertage. **DBA-WD**: Stundenlohn + Fringe je Gewerk (Electrician, Plumber, Painter …) und Bauart (Building/Heavy/Highway/Residential).
- **Öffentliche API: nicht gefunden.** Auf open.gsa.gov ist kein Wage-Determination-Endpunkt dokumentiert; Daten gibt es nur als Webseiten auf SAM.gov (Scraping verboten, siehe 3.1). Prüfen: Bulk-Extrakte unter [sam.gov/data-services](https://sam.gov/data-services) bzw. Nachfrage beim Federal Service Desk (fsd.gov). Bis dahin: WD-Nummer aus dem Ausschreibungsanhang lesen und dem Kunden den **Direktlink** geben; Kunde trägt die Sätze in unseren Rechner ein oder lädt das WD-PDF hoch.
- Datenqualität: SAM.gov meldete z. B., dass am 29.04.2026 veröffentlichte SCA-WDs teils unvollständige Ortsangaben hatten ([samsearch, Hinweise](https://samsearch.co/blog/wage-determination)).

### 2.13 GSA Multiple Award Schedule (MAS)
- Langfristiger Rahmenvertrag mit der GSA (Laufzeit bis 20 Jahre); Behörden bestellen direkt oder über eBuy-RFQs. Relevante Kategorien: Facilities (Reinigung, Grünpflege, Wartung), Security & Protection, Professional Services/Staffing (Human Capital).
- Voraussetzungen typischerweise: 2 Jahre Firmengeschichte (Ausnahme „Startup Springboard“), Finanzunterlagen, Past Performance, Preisliste mit Rabatten (Commercial Sales Practices). Aufwand mehrere Monate.
- Für Einsteiger **nicht der erste Schritt**, aber später ein Upsell („MAS-Readiness-Check“). GSA-Anwendungen werden seit 2025/26 schrittweise in SAM.gov integriert ([Taft](https://www.taftlaw.com/news-events/law-bulletins/gsa-applications-consolidate-into-sam-gov/)).

### 2.14 Subunternehmer bei großen Primes
- Große Primes über ca. 900.000 $ brauchen einen Subcontracting Plan mit Kleinfirmen-Quoten → aktive Suche nach Subs.
- **SBA SubNet**: Liste von Subcontracting-Angeboten der Primes, filterbar nach Staat/Stichwort ([SBA SubNet](https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities)). Neue Einträge können derzeit nicht über die Seite eingestellt werden (Primes sollen subcontracting@sba.gov schreiben); **keine API**.
- Zusätzlich: Small Business Liaison Officers der Primes, Mentor-Protégé-Programm der SBA (Joint Ventures).

---

## 3. Datenquellen & APIs

### 3.0 Übersicht – was wir legal nutzen dürfen
| Quelle | Nutzung erlaubt? | Bemerkung |
|---|---|---|
| SAM.gov Opportunities API (public) | **Ja** | Mit API-Key; öffentliche Daten dürfen angezeigt werden, wenn sie über die **öffentliche** API kommen |
| SAM.gov Entity Management API (public tier) | **Ja** | Nur öffentliche Felder; keine „FOUO/sensitive“-Daten in der App zeigen |
| SAM.gov Contract Awards API | **Ja** | Nachfolger von FPDS |
| SAM.gov Website (Suche, WD-Seiten) | **Nein (kein Scraping)** | ToS verbieten Bots und Scraping; nur Links setzen |
| USAspending.gov API | **Ja** | Ohne Key, offene Bundesdaten |
| Grants.gov API | Ja | Für Handwerk kaum relevant (Zuschüsse, keine Aufträge) |
| SBA SubNet, SBA SBS | Nur Link | Keine API |
| NYC Open Data (City Record Online) | **Ja** | Socrata-API, offene Daten |
| Andere Staaten (TX ESBD, Cal eProcure, FL VBS, NY Contract Reporter) | **Nur nach Einzelprüfung** | Keine offizielle API gefunden; ToS/robots.txt je Portal prüfen, Behörde um Datenzugang bitten |
| Aggregatoren (BidNet Direct, DemandStar, OpenGov/Bonfire, Periscope) | **Nein ohne Vertrag** | Kommerzielle Plattformen; nur über Partnerschaft |

### 3.1 SAM.gov – Nutzungsbedingungen
- **Automatisierte Datensammlung und Scraping auf sam.gov sind verboten**; Konten können über Login.gov gesperrt werden. Erlaubt ist der Zugriff über die APIs und Extrakte auf open.gsa.gov und [sam.gov/data-services](https://sam.gov/data-services). Für **öffentliche Anzeige** muss die **öffentliche** API-Variante genutzt werden; Daten aus „sensitive“-APIs dürfen nicht öffentlich gezeigt werden ([SAM.gov Terms of Use](https://sam.gov/content/about/terms-of-use)).
- Ausschreibungsdaten sind Werke der US-Regierung (in der Regel gemeinfrei, 17 U.S.C. § 105); eine ausdrückliche Lizenz für Opportunity-Daten habe ich nicht gefunden. Anhänge können urheberrechtlich geschützte Inhalte Dritter enthalten (z. B. Normen, Herstellerunterlagen) → **Anhänge nur für den eingeloggten Kunden laden, nicht öffentlich spiegeln.**
- API-Keys laufen nach **90 Tagen** ab ([pypi sam-gov-mcp](https://pypi.org/project/sam-gov-mcp/1.0.13/), deckt sich mit `docs/anleitung-sam-gov.md`).

### 3.2 SAM.gov Get Opportunities Public API v2
- **URL:** `https://api.sam.gov/opportunities/v2/search` ([Doku](https://open.gsa.gov/api/get-opportunities-public-api/)). Alpha/Test: `api-alpha.sam.gov`.
- **Auth:** `api_key` (persönlicher Key aus „Account Details“ oder Systemkonto).
- **Limits:** pro Key und Tag (Reset 00:00 UTC): Non-federal ohne Rolle **10**, mit Rolle **1.000**, Non-federal System Account **1.000**, Federal 1.000 / System 10.000 ([GSA-Ratenlimits](https://raw.githubusercontent.com/api-evangelist/general-services-administration/refs/heads/main/rate-limits/general-services-administration-rate-limits.yml), [Contract Awards API](https://open.gsa.gov/api/contract-awards/)). `limit` max. 1.000 Datensätze pro Seite; `postedFrom`/`postedTo` Pflicht, max. 1 Jahr Spanne.
- **Nützliche Felder:** `noticeId`, `title`, `solicitationNumber`, `type`/`baseType` (Notice Type), `postedDate`, `responseDeadLine`, `archiveDate`, `naicsCode`, `classificationCode` (PSC), `typeOfSetAside` + `typeOfSetAsideDescription`, `fullParentPathName` (Behörde), `officeAddress`, `placeOfPerformance` (Stadt, Staat, ZIP), `pointOfContact` (Name, E-Mail, Telefon des Contracting Officers), `description` (**Link** auf einen zweiten Endpunkt, Text kostet einen weiteren Abruf), `resourceLinks` (Liste der Anhang-URLs), `award` (bei Award Notices: Gewinner-UEI, Betrag, Datum), `uiLink`, `active`.
- **Anhänge per API:** Ja. `resourceLinks` enthält Download-URLs (Muster `…/opportunities/v3/resources/files/{id}/download`), Download mit API-Key. Jeder Download und jeder Beschreibungstext zählt **wahrscheinlich** gegen das Tageskontingent ([Apify-Doku, Sekundärquelle](https://apify.com/bridged/sam-gov-opportunities-api.md)) **(prüfen)**. Manche Anhänge sind „controlled“ (nur nach Freigabe/Login, z. B. Baupläne mit CUI); die bekommen wir nicht und müssen den Kunden auf die SAM.gov-Seite verweisen.
- **Strategie:** Einmal pro Tag eine Liste (1–3 Abrufe), Beschreibung + Anhänge **nur für Ausschreibungen, die ein Kunde öffnet oder die zu einem Profil passen**, Ergebnisse cachen (gemeinsam für alle Kunden).

### 3.3 SAM.gov Entity Management API (public)
- **URL:** `https://api.sam.gov/entity-information/v3/entities` ([Doku](https://open.gsa.gov/api/entity-api/)); gleiche Limits wie oben.
- **Öffentliche Felder:** UEI, CAGE, Rechtsname, DBA, Adresse, Registrierungsstatus, `registrationExpirationDate`, NAICS-Liste (inkl. „small“-Kennzeichen je NAICS), PSC, SBA-Zertifikate (8(a), HUBZone u. a.; WOSB/VetCert-Status teils über MySBA), Points of Contact (öffentlicher Teil).
- **Nutzung:** Onboarding („UEI eingeben → Profil füllt sich selbst“), tägliche Prüfung „Registrierung läuft in 30 Tagen ab“, Prüfung Gewinner-UEI aus Award Notices (Größe, Ort). Wettbewerber-Analyse: Kleinfirmen derselben NAICS in der Region.
- **Nicht nutzen:** sensitive/FOUO-Felder (TIN, Bank) – brauchen Systemkonto mit Sonderfreigabe und dürfen nicht öffentlich angezeigt werden.

### 3.4 Vergabedaten / Preise
**SAM.gov Contract Awards API** ([open.gsa.gov/api/contract-awards](https://open.gsa.gov/api/contract-awards/)): Nachfolger von FPDS (Website und ezSearch seit 24.02.2026 abgeschaltet; ATOM-Feed wird im FY2026 abgeschaltet, ein Anbieter nennt den 31.07.2026, **(prüfen)**) ([SAM.gov](https://sam.gov/announcements/fpdsgov-decommissions-february-24-2026-0), [GovSpend](https://support.govspend.com/fpds-sunset)). Gleiche Key/Limits wie oben, kann gelöschte Datensätze der letzten 6 Monate liefern. Parameter-Groß-/Kleinschreibung beachten (z. B. `piid`) ([pypi sam-gov-mcp 1.0.9](https://pypi.org/project/sam-gov-mcp/1.0.9/)). NASA-Daten noch nicht migriert.

**USAspending.gov API** (`https://api.usaspending.gov/api/v2/`, [Doku](https://api.usaspending.gov/docs/endpoints)):
- **Kein Key, keine Registrierung**, keine dokumentierten harten Limits (Wrapper nutzen freiwillig ca. 1.000 Abrufe / 5 Min.) ([pypi usaspending-orm](https://pypi.org/project/usaspending-orm/)). Daten gemeinfrei, Weiterverwendung erlaubt.
- Wichtige Endpunkte: `POST /search/spending_by_award/` (Filter: `naics_codes`, `psc_codes`, `place_of_performance_locations`, `agencies`, `time_period`, `award_type_codes` A–D für Verträge; Felder u. a. `Recipient Name`, `Award Amount`, `Start Date`, `End Date`), `/awards/{id}/` (Details inkl. `period_of_performance_current_end_date` und `potential_end_date` mit Optionen), `/search/spending_by_category/` (Top-Auftragnehmer je NAICS/Region), Bulk-Download.
- **Anwendung:** Preis-Benchmark (Median-Vertragswert für „Janitorial, VA-Kliniken, Texas“), Amtsinhaber, Recompete-Radar (Verträge mit Enddatum in 6–18 Monaten), Primes für Subunternehmer-Ansprache.
- Achtung: Daten mit Verzug (DoD-Verträge 90 Tage verzögert), Beträge sind „obligated“, nicht zwingend Gesamtwert.

### 3.5 SBA-Quellen
- **SBA Small Business Search (SBS)** (Nachfolger DSBS): nur Webanwendung, keine API gefunden. Nutzen: Kunde pflegt Profil; wir verlinken.
- **MySBA Certifications**: Zertifikatsstatus ist teilweise in der SAM Entity API sichtbar; sonst manuelle Angabe des Kunden mit Nachweis-Upload.
- **SubNet**: nur Web, keine API, kein Scraping (sba.gov-Seiten: robots.txt und Nutzungsbedingungen vor jeder Automatisierung prüfen). Nur verlinken.
- **Größentabelle**: als Excel/PDF auf sba.gov und [data.sba.gov](https://data.sba.gov/es/dataset/small-business-size-standards) → einmalig importieren, bei Änderungen aktualisieren.

### 3.6 Grants.gov
- REST-API `POST https://api.grants.gov/v1/api/search2` und `fetchOpportunity`, **ohne Authentifizierung** ([Grants.gov API Guide](https://grants.gov/api/api-guide)). Zuschüsse (Grants) sind keine Aufträge; für unsere Gewerke nur indirekt relevant (Städte/Schulen erhalten Fördergeld und schreiben dann lokal aus). Niedrige Priorität.

### 3.7 Bundesstaaten und Städte (State & Local, „SLED“)
Ergebnis: Kaum ein Staat bietet eine offizielle, dokumentierte Ausschreibungs-API. Die meisten Portale sind Webanwendungen (oft PeopleSoft, Periscope, Jaggaer, Bonfire).

| Portal | Offene Daten / API? | Einschätzung |
|---|---|---|
| **NYC City Record Online (CROL)** | **Ja**: NYC Open Data, Socrata, Datensatz `dg92-zbpx` (JSON/CSV/XML), Ausschreibungen, Zuschläge, Anhörungen; ca. 1 Mio. Zeilen ab 2003 ([data.gov](https://catalog.data.gov/dataset/city-record-online), [NYC DCAS Procurement Data Sets](https://www.nyc.gov/site/dcas/reports/procurement-data-sets.page)) | **Sofort nutzbar.** Offene Lizenz von NYC Open Data; Aktualität prüfen |
| **Texas ESBD** (txsmartbuy.gov/esbd) | Keine offizielle Export-/API-Doku gefunden; die Seite nutzt intern einen JSON-Dienst, den Drittanbieter abgreifen ([Apify-Beispiel](https://apify.com/j0401/sled-tx-procurement)) | Nicht ohne Erlaubnis automatisieren. Texas Comptroller nach offiziellem Datenzugang fragen |
| **California Cal eProcure** (CSCR) | Keine offizielle API gefunden ([DGS](https://www.dgs.ca.gov/PD/Resources/Page-Content/Procurement-Division-Resources-List-Folder/Cal-eProcure-Portal-to-Access-Bid-Opportunities)) | DGS (custserv@dgs.ca.gov) nach Feed fragen. Kalifornien hat offene Daten zu Vergaben (SCPRS) auf data.ca.gov **(prüfen)** |
| **New York State Contract Reporter** | Registrierung nötig, keine API gefunden. NY-Open-Data-Portale (data.ny.gov) sind Socrata-basiert | Datensätze auf data.ny.gov prüfen; Contract Reporter selbst nicht scrapen |
| **Florida MFMP / Vendor Bid System (VBS)** | Keine offizielle API gefunden | Nur nach ToS-Prüfung oder Anfrage beim DMS |
| Weitere Städte/Counties mit Socrata/CKAN | Teilweise (z. B. Chicago, Los Angeles, Seattle, Austin, Dallas haben Vergabe-/Vertragsdatensätze) **(je Datensatz prüfen)** | Guter Phase-2-Weg: nur offene Datensätze mit klarer Lizenz |

Vorgehen (analog zu unserer Shop-Regel bei RestockHero): je Portal Nutzungsbedingungen + robots.txt prüfen und dokumentieren, Sperren nie umgehen; bei Verbot schriftlich um Datenzugang bitten. Viele Staatsbehörden geben auf Anfrage CSV-Exporte oder RSS-Feeds heraus.

### 3.8 Aggregatoren
| Anbieter | Was | Automatischer Zugriff |
|---|---|---|
| **BidNet Direct** (mdf commerce) | Tausende lokale Einkaufsstellen, viele Gruppen-Portale (z. B. Rocky Mountain E-Purchasing) | AGB nicht im Detail prüfbar (Suche lieferte sie nicht); kommerzielle Plattform → nur per Partnervertrag |
| **DemandStar** | Lokale Behörden, Gebühren für Bieter | wie oben |
| **OpenGov Procurement (inkl. Bonfire)** | Beschaffungssoftware für Kommunen; Ausschreibungen auf behördeneigenen Portalen | Behörden sind Kunden von OpenGov; Daten gehören der Behörde. Partnerschaft/Integrationsanfrage möglich **(prüfen)** |
| **Periscope S2G** (Euna) | Großes SLED-Netz | Nur Vertrag |
| **GovSpend**, **Deltek GovWin** | Vergabe- und Kaufdaten | Wettbewerber, keine Datenquelle |

Fazit: **Kein Scraping von Aggregatoren.** Gerichte stützen Verbote zunehmend auf Vertragsrecht (Browsewrap/Clickwrap). Mittelfristig Partnerschaftsanfrage an OpenGov/Bonfire und BidNet (Daten-Lizenz oder Affiliate-Modell).

---

## 4. Was der Kunde für ein Angebot braucht – und wie unsere App es vorbereitet

### 4.1 Vor jeder Ausschreibung (einmalig, „Bieterakte“)
- [ ] SAM.gov aktiv, „All Awards“, Ablaufdatum > Abgabefrist + 30 Tage
- [ ] UEI, CAGE, EIN, NAICS (inkl. NAICS der Ausschreibung), Small-Status für diesen NAICS
- [ ] Zertifikate (MySBA) mit Ablaufdaten
- [ ] Versicherungen: General Liability, Workers' Comp, Auto (Mindestsummen oft in FAR 28.307 / Ausschreibung), bei Wachdienst Lizenzen des Staates
- [ ] Lizenzen: Contractor License des Staates (Elektro, Sanitär, HVAC, Dach), ggf. EPA Lead-Safe (Maler, Gebäude vor 1978), EPA 608 (Kältemittel)
- [ ] Bürgschaftslinie (Bau) – Name des Surety, Höchstbetrag
- [ ] Capability Statement, 3–5 Referenzen (PPQ-fähig), Lebensläufe Schlüsselpersonal
- [ ] Preisbasis: Stundenlohn je Kategorie, Gemeinkosten, Gewinn, Material
→ App: „Bieterakte“ im Profil mit Ablauf-Warnungen; aus der Entity API vorausgefüllt.

### 4.2 Checkliste je Notice Type
**Sources Sought / RFI (`r`)**
- [ ] Antwortfrist und Format (meist E-Mail, 2–5 Seiten)
- [ ] Antwort auf alle gestellten Fragen in deren Reihenfolge
- [ ] Größe für den genannten NAICS, Zertifikate, UEI/CAGE
- [ ] Vergleichbare Projekte (Umfang, Wert, Ort)
- [ ] Empfehlung zum Set-Aside, ggf. Hinweis auf falschen NAICS
→ App: Vorlage aus Profil + KI-Antwort auf die Fragen.

**Presolicitation (`p`)**
- [ ] Erwartetes Datum der Ausschreibung, Kalendereintrag
- [ ] Bieterakte prüfen (Lizenzen, Bonds)
- [ ] Teaming/Subunternehmer suchen, falls Teilleistungen fehlen

**Combined Synopsis/Solicitation & RFQ (`k`, `o` mit SF 18 / SF 1449)**
- [ ] Abgabefrist + Zeitzone, Frist für Fragen (oft 7–10 Tage vor Abgabe)
- [ ] Site Visit (Datum, Anmeldung, Ausweis für Militärgelände; manchmal Pflicht)
- [ ] Alle **Amendments** gelesen und im Angebot bestätigt (SF 30, Block 11/Feld „Acknowledgment of Amendments“ im SF 1449/SF 18/SF 33/SF 1442)
- [ ] SF 1449 Blöcke 12 (Zahlungsrabatt), 17a (Bieterdaten, UEI/CAGE), 30a–c (Unterschrift) ausgefüllt
- [ ] Preisblatt exakt nach CLIN-Struktur (Basisjahr + Optionsjahre), keine Positionen weglassen
- [ ] Technischer Teil nach Anweisungen (Seitenzahl, Schriftgröße, Dateiformat)
- [ ] Past Performance (Anzahl/Format laut Ausschreibung)
- [ ] Wage Determination eingepreist (SCA/DBA)
- [ ] Reps & Certs: Verweis auf SAM, ggf. 52.212-3-Ergänzungen, 52.204-24 Ausfüllen
- [ ] Gültigkeit des Angebots (z. B. 60/90 Tage)
- [ ] Übermittlungsweg + Dateigröße, Bestätigung des Eingangs anfordern
→ App: Compliance-Matrix (Anforderung → Fundstelle → erledigt), automatisch aus Section L/M bzw. den Angebotsanweisungen.

**RFP (`o`, SF 33 / SF 1449, FAR Part 15)**
- Zusätzlich: Gliederung nach Section L, Bewertungskriterien Section M als Prüfliste, Volumes (Technical, Management, Past Performance, Price), Subcontracting-Grenzen, Schlüsselpersonal, Quality Control Plan, ggf. Transition Plan (Reinigung/Wachdienst bei Recompete), Small Business Participation Plan.

**IFB im Bau (SF 1442, Sealed Bid)**
- [ ] Bid Guarantee (SF 24, meist 20 %) bei > 150.000 $
- [ ] Alle Bid Schedule-Positionen, Einheitspreise, Pläne & Spezifikationen (Divisionen nach CSI MasterFormat)
- [ ] Davis-Bacon-WD einkalkuliert, Certified Payroll später wöchentlich
- [ ] Angebotsöffnung: Ort/Zeit (öffentlich), späte Angebote ausgeschlossen
- [ ] Nach Zuschlag: Performance + Payment Bond (SF 25/25A), Versicherungsnachweise, Zeitplan, Safety Plan (oft EM 385-1-1 bei USACE)

**Award Notice (`a`)**
- [ ] Gewinner und Preis ins Benchmark-Archiv
- [ ] Bei Verlust: **Debriefing** anfordern (bei FAR 15 binnen 3 Tagen nach Mitteilung; bei FAR 13 „brief explanation“) → Lerneffekt
- [ ] Gewinner als möglichen Prime für Subunternehmer-Ansprache markieren

### 4.3 Vorlagen, die wir anbieten sollten
| Vorlage | Inhalt | Quelle der Daten |
|---|---|---|
| Capability Statement | 1 Seite, s. 2.10 | Profil + Entity API |
| Cover Letter | Bezug (Solicitation No.), Bestätigung Amendments, Gültigkeit, Kontakt, Unterschrift | Notice + Profil |
| Pricing Sheet | CLINs, Basis-/Optionsjahre, Stundensätze aus WD + Zuschläge, Material, Gewinn | Anhang + WD-Rechner |
| Past Performance | Auftraggeber, Vertragsnr., Wert, Laufzeit, Umfang, Ansprechpartner, Relevanz | Referenz-DB |
| Technical Approach (kurz) | Leistungsbeschreibung, Personal, Ausrüstung, Qualitätssicherung, Zeitplan | KI aus SOW/PWS + Profil |
| Quality Control Plan | Inspektionen, Checklisten, Korrekturmaßnahmen (Pflicht bei vielen Reinigungs-/Grünpflege-Aufträgen) | Branchenvorlage |
| Sources-Sought-Antwort | s. 4.2 | Profil |
| Formulare SF 1449, SF 18, SF 33, SF 1442, SF 30, SF 24 | Vorausfüllen der Bieterblöcke | GSA Forms Library (gemeinfrei) |

Wichtig: Wir erstellen **Entwürfe**; Unterschrift und Abgabe macht der Kunde (Haftung, False Claims Act-Risiko bei falschen Angaben in Reps & Certs).

---

## 5. Wettbewerb in den USA

| Tool | Fokus | Preis (Stand 2026, meist Schätzungen Dritter) | Lücke für uns |
|---|---|---|---|
| **SAM.gov Saved Searches / Alerts** | Kostenlos, Bundesebene | 0 $ | Unübersichtlich, keine Bewertung, keine Hilfe beim Angebot – unsere Basis-Konkurrenz |
| **Deltek GovWin IQ** | Enterprise, Vorab-Informationen, Analysten | ca. 13.000–119.000 $/Jahr, Ø ca. 29.000 $ ([prospeo/Vendr](https://prospeo.io/s/deltek-govwin-iq-pricing-reviews-pros-and-cons), [fed-spend](https://fed-spend.com/blog/govwin-iq-pricing-2026-what-40000-buys-and-what-it-cannot)) | Viel zu teuer und komplex für Handwerker |
| **GovSpend** | SLED-Einkaufsdaten, Kaufaufträge | ca. 7.300–24.500 $/Jahr ([samsearch](https://samsearch.co/blog/top-10-govwin-alternatives-complete-2025-guide)) | Vertriebsteams, nicht kleine Betriebe |
| **BidPrime** | Bund + SLED-Ausschreibungen, Alerts | ca. 3.000–10.000 $/Jahr (Schätzung) | Nur Suche, keine Angebotshilfe |
| **GovTribe** (Carahsoft) | Bund, Analytics, Pipeline | 1.200–2.100 $ je Nutzer/Jahr (Herstellerangabe) ([GovTribe](https://govtribe.com/compare/govtribe-vs-govwin)) | Für BD-Profis, kein Gewerke-Fokus |
| **HigherGov** | Bund + SLED, günstig, gute Daten | ab ca. 500 $/Jahr (Schätzung) | Datenlastig, wenig Anleitung |
| **BidNet Direct** | SLED-Portale, Registrierung kostenlos für viele Behörden, Bezahl-Abo für Alerts | ca. 200–600 $/Jahr **(prüfen)** | Nur Lokal, keine KI-Hilfe |
| Neue KI-Tools (z. B. Cleat, SamSearch, Govly, Pursuit, CivicIQ) | KI-Zusammenfassung, Proposal-Entwürfe | ca. 50–500 $/Monat **(prüfen)** | Meist IT/Beratung-Fokus |
| Berater (PTAC = **APEX Accelerators**) | Kostenlose staatlich geförderte Beratung | 0 $ | Begrenzte Kapazität; mögliche Partner für Empfehlungen |

**Unsere Lücke:** Ein einfaches, günstiges Tool (Richtwert 49–149 $/Monat) **nur für Gewerke**, das (1) nur passende und erlaubte Aufträge zeigt, (2) Fristen, Site Visits und Amendments sicher verfolgt, (3) Lohnlisten in einen Mindestpreis übersetzt, (4) Angebotsentwürfe und Formulare vorausfüllt und (5) Neulinge kostenlos durch die SAM-Registrierung führt. Handy-tauglich und mit SMS/Telegram-Alarm (Handwerker sitzen nicht am Schreibtisch). Spanische Oberfläche als späteres Plus (viele Reinigungs- und Landschaftsbaufirmen).

---

## 6. Recht und Organisation für uns als deutscher Anbieter (kurz)

- **Sales Tax auf SaaS:** In den USA gibt es keine Bundes-Umsatzsteuer; jeder Staat entscheidet selbst. **Economic Nexus** gilt seit „Wayfair“ (2018) auch für ausländische Anbieter ohne US-Präsenz. Übliche Schwelle **100.000 $ Umsatz** im Staat pro Jahr; Ausnahmen u. a. **CA, NY, TX: 500.000 $**, **AL, MS: 250.000 $**; einige Staaten zusätzlich 200 Transaktionen (Illinois hat die Transaktionsschwelle zum 01.01.2026 abgeschafft) ([Taxually](https://www.taxually.com/blog/economic-nexus-by-state), [Kintsugi](https://trykintsugi.com/sales-tax-guides/usa)). SaaS steuerpflichtig u. a. in **AZ, CT (ermäßigt), DC, HI, IA, KY, LA, MA, MD (3 % „Tech-Tax“ B2B seit 2025), NM, NY, OH (nur B2B), PA, RI, SC, SD, TN, TX (80 % des Preises), UT, WA, WV**; nicht steuerpflichtig u. a. in CA, FL, GA, IL (aber Chicago Lease Tax), VA **(Liste prüfen, Quellen widersprechen sich)** ([Fungies 2026](https://fungies.io/saas-sales-tax-by-state-2026), [Afternoon](https://www.afternoon.co/blog/SaaS-sales-tax-guide)). Praktisch: Bis 100.000 $ US-Umsatz je Staat entsteht meist keine Pflicht. **Stripe Tax** überwacht die Schwellen automatisch und rechnet ab; bei Erreichen in einem Staat registrieren (Anbieter wie Anrok/Avalara übernehmen Meldungen).
- **Deutsche Seite:** Leistung an US-Unternehmen = sonstige Leistung im Ausland (§ 3a Abs. 2 UStG), in Deutschland nicht umsatzsteuerbar; Kleinunternehmerregelung bleibt davon unberührt. Einkommensteuer in DE (DBA USA; keine US-Betriebsstätte, solange kein Personal/Büro in den USA). Mit Steuerberater bestätigen.
- **US-Formulare:** Für Stripe als ausländischer Verkäufer kein W-9; ggf. **W-8BEN-E** für US-Kunden, die nach der Steuernummer fragen.
- **Datenschutz:** **CCPA/CPRA** greift erst ab ca. 26,6 Mio. $ Jahresumsatz (Stand 2025 angepasst), Daten von ≥ 100.000 Kaliforniern oder ≥ 50 % Umsatz aus Datenhandel → für uns vorerst nicht, aber gleiche Grundsätze wie DSGVO leben (Privacy Policy auf Englisch, „Do Not Sell“ nicht nötig, solange wir nichts verkaufen). Weitere Staatsgesetze (VA, CO, TX u. a.) haben ähnliche hohe Schwellen. **CAN-SPAM** für Werbe-Mails (Abmeldelink, Absender-Adresse), **TCPA** für SMS (ausdrückliche Einwilligung!). Unsere DSGVO-Pflichten gelten weiter, da wir in der EU sitzen; Speicherung in Supabase Frankfurt ist für US-Kunden unkritisch.
- **Preise und Zahlung:** in **USD**, monatlich und jährlich, Stripe (Karten, ACH). Netto-Preise mit Hinweis „plus applicable sales tax“. Kündigung online (FTC „Click-to-Cancel“-Regel wurde 2025 gerichtlich gestoppt, mehrere Staaten wie CA haben aber eigene Auto-Renewal-Gesetze → einfache Online-Kündigung und Erinnerung vor Jahresverlängerung).
- **Englische AGB (Terms of Service):** Haftungsbegrenzung, „keine Rechts- oder Vergabeberatung, Kunde prüft und unterschreibt selbst“, keine Garantie auf Vollständigkeit der Ausschreibungsdaten, Rechtswahl (deutsches Recht ist möglich, US-Kunden erwarten aber oft US-Recht; Schiedsklausel überlegen), Hinweis „nicht mit der US-Regierung verbunden“ (wichtig, um nicht wie ein Abzock-SAM-Dienst zu wirken). Kein Logo von SAM.gov/GSA/SBA verwenden.
- **Marke:** „GoGovJob“ vor Start im USPTO-Register (TESS-Nachfolger „Trademark Search“) und bei DPMA/EUIPO prüfen; „Gov“ allein ist kein Problem, aber keine Anmutung einer Behörde.

---

## 7. Offene Fragen und Risiken

1. **API-Kontingent (kritisch):** Mit 10 Abrufen/Tag ist kein Produkt möglich. Klären: Entity-Registrierung von WP Digital Ranger in SAM.gov als ausländische Firma (braucht **NCAGE-Code**, kostenlos über NSPA; Dauer mehrere Wochen) → Rolle / Non-Federal System Account (1.000/Tag). Reicht 1.000/Tag für Anhänge? Zählen Datei-Downloads mit? Antrag beim Federal Service Desk (fsd.gov) stellen.
2. **Offizielle Doku verifizieren:** open.gsa.gov war in dieser Sitzung nicht abrufbar. Set-Aside-Codes, Feldnamen, Download-Regeln für `resourceLinks`, Contract Awards API-Felder gegen die Doku prüfen (Netzwerkfreigabe für open.gsa.gov in der Cloud-Umgebung nötig).
3. **Wage Determinations:** keine API gefunden → Anfrage an GSA/FSD, ob ein Daten-Extrakt (sam.gov/data-services) WDs enthält. Ohne das bleibt Funktion 4 halbautomatisch.
4. **FAR-Umbau (RFO):** Klauselnummern und Regeln (u. a. „Rule of Two“, Part 19) ändern sich 2026/27; Texte und Checklisten müssen leicht aktualisierbar sein. Auch die SBA-Größenreform (Vorschlag Aug. 2026) kann Größen-Ampeln verschieben.
5. **8(a)-Programm:** politisch unsicher; nicht als Kern-Feature bewerben.
6. **Haftung:** Fehlende Frist oder falsch erkannte Set-Aside → Kunde verliert Auftrag. ToS-Haftungsbegrenzung, klare Hinweise „Original-Ausschreibung ist maßgeblich“, Links zur Quelle bei jeder Angabe.
7. **KI-Fehler bei Compliance-Matrix und Preisen:** Ausgaben immer mit Fundstelle (Seite/Abschnitt) anzeigen; keine automatische Abgabe.
8. **False Claims Act / Reps & Certs:** Wir dürfen Kunden nicht zu falschen Größen- oder Statusangaben verleiten (z. B. „Small“ trotz zu hohem Umsatz). Größenprüfung als Warnung, nicht als Freigabe.
9. **State & Local:** ohne offizielle Feeds kein seriöses Wachstum über SLED. Anfragen an Texas Comptroller, CA DGS, NY OGS, FL DMS; Partnerschaft mit OpenGov/BidNet prüfen. Rechtsrahmen wie bei RestockHero: ToS + robots.txt je Quelle dokumentieren.
10. **Datenverzug:** USAspending/DoD-Daten 90 Tage verzögert; Contract Awards API neu und mit Kinderkrankheiten (Parameter-Schreibweise, NASA fehlt).
11. **Vertrauen:** Neue US-Firmen werden mit SAM-Betrugs-Mails überschwemmt. Unser Marketing darf nicht so aussehen (keine „Your SAM registration“-Betreffzeilen, keine Gebühren für Registrierungshilfe – Registrierungsanleitung kostenlos anbieten).
12. **Steuern/Recht:** Sales-Tax-Liste und deutsche Umsatzsteuerbehandlung mit Steuerberater bestätigen; englische ToS/Privacy Policy anwaltlich prüfen lassen (ggf. US-Anwalt für Arbitration-Klausel).
13. **Support-Zeitzonen:** US-Kunden erwarten Antworten zu US-Geschäftszeiten; Fristen liegen oft 14:00–17:00 Eastern = 20:00–23:00 MEZ → automatisierte Erinnerungen und ein Hilfe-Bot sind wichtiger als in DE.

---

### Wichtigste Quellen (Auswahl)
- SAM.gov Opportunities API: https://open.gsa.gov/api/get-opportunities-public-api/
- SAM.gov Entity API: https://open.gsa.gov/api/entity-api/
- SAM.gov Contract Awards API: https://open.gsa.gov/api/contract-awards/
- SAM.gov Terms of Use: https://sam.gov/content/about/terms-of-use
- FPDS-Abschaltung: https://sam.gov/announcements/fpdsgov-decommissions-february-24-2026-0
- FAR-Schwellen 2025: https://www.federalregister.gov/documents/2025/08/27/2025-16412/federal-acquisition-regulation-inflation-adjustment-of-acquisition-related-thresholds
- FAR Overhaul: https://acquisition.gov/node/64187
- SBA-Größentabelle: https://www.sba.gov/document/support-table-size-standards ; Reformvorschlag: https://www.federalregister.gov/documents/2026/08/20/2026-17042/small-business-size-standards
- SBA 8(a)-Suspendierungen: https://www.sba.gov/article/2026/01/28/sba-suspends-over-1000-8a-firms-program-following-december-document-request
- SBA SubNet: https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities
- Wage Determinations: https://sam.gov/content/wage-determinations
- USAspending API: https://api.usaspending.gov/docs/endpoints
- Grants.gov API: https://grants.gov/api/api-guide
- NYC City Record Online: https://catalog.data.gov/dataset/city-record-online
- EO 14236 / Mindestlohn: https://sam.gov/announcements/executive-order-14236-impacts-wage-determinations
- Kleinunternehmensziele: https://www.everycrsreport.com/files/2026-06-30_IN12018_6f51fa7436a86cc7af2612ae5a6aeea0ce180c18.html
