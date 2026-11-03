# Rechtsprüfung der App (03.11.2026, Claude)

> Auslöser: Benjamin 03.11.2026: „Wichtig ist, dass nachher die komplette App gesetzeskonform ist … nicht nur in
> Deutschland, sondern auch in den anderen Ländern.“ Anlass war die Notiz „Kind krank“ im Schichtplan der Beispielfirma.
>
> Fünf getrennte Prüfungen (nur lesend) des ganzen Codes: Steuern/Rechnungen, Arbeitsrecht/Lohn, Datenschutz,
> Rechtstexte/Länder, KI-Einsatz. Hier stehen alle Befunde, der Stand der Behebung und die Fragen für den Anwalt bzw.
> das Steuerbüro. **Keine Rechtsberatung**: Werte mit „(prüfen)“ stammen aus dem Gedächtnis der Prüfer und müssen gegen
> die Originalquelle geprüft werden. Die endgültige Freigabe der Rechtstexte und Grundsatzfragen gibt der Anwalt.
>
> Stand-Spalte: ✅ behoben · 🔧 in Arbeit · ⏳ offen · ⚖️ wartet auf Anwalt/Steuerbüro

## 0. Sofort behoben (03.11.2026)

| Befund | Stand |
|---|---|
| Schichtplan zeigte den Grund eines kurzfristigen Ausfalls („Kind krank“) allen Büro-Rollen | ✅ zeigt nur noch wer und wann |
| Beispieltext beim Ausfallmelden „z. B. Kind krank“ (lud zu Gesundheitsangaben ein) | ✅ „z. B. Auto kaputt, Zug fällt aus“, alle Sprachen |
| Beispielfirma enthielt „Kind krank“ | ✅ Seed und Live-Daten korrigiert |
| Bundesbank-Vergabeunterlagen (DTVP, „keine Weitergabe“) im öffentlichen Repo | ✅ privat in R2, Versionsgeschichte bereinigt |

## 1. Steuern und Rechnungen

### Hoch
| # | Befund | Norm | Stelle | Vorschlag | Stand |
|---|---|---|---|---|---|
| S1 | Alte Rechnungen ändern sich nachträglich: Absender, Kunde, Kleinunternehmer-Häkchen werden beim Download frisch gelesen; gelöschter Kunde → Empfänger fehlt | GoBD, § 14 Abs. 4 UStG | rechnungen.ts, datev.ts, umsatzsteuer.ts, kundenportal.ts | Beim Ausstellen alles einfrieren (Absender, Empfänger, Steuersatz, Steuerbetrag, Hinweis) | ✅ \|
| S2 | Ausgestellte Rechnungen lassen sich spurlos löschen, keine Stornorechnung | GoBD, § 146 Abs. 4 AO | rechnungen.ts:213, Migration 20261101200000 | Status Entwurf/ausgestellt, Löschen nur Entwurf (DB-Sperre), Storno mit eigener Nummer | ✅ \|
| S3 | Rechnungsnummer kann doppelt vergeben werden (höchste + 1; nach Löschen der letzten wieder dieselbe) | § 14 Abs. 4 Nr. 4 UStG | rechnungen.ts:32 | Zähler pro Firma und Jahr in der DB, Nummer erst beim Ausstellen | ✅ \|
| S4 | Keine Umkehr der Steuerschuld (§ 13b) für Reinigung an Gebäudereiniger und Bauleistungen | § 13b Abs. 2 Nr. 4/8, § 14a Abs. 5 UStG | rechnungen.ts, xrechnung.ts, datev.ts | Kunde als „§ 13b“ markieren → 0 %, Pflichthinweis, XRechnung AE, eigenes Erlöskonto | ✅ Kundenfeld mit USt-IdNr., Ausstellen setzt 0 % und friert ein (Migration `20261103190000`), Hinweis § 14a Abs. 5, XRechnung AE/VATEX-EU-AE + BT-48 (KoSIT-Beispiel), DATEV 8337/4337 (⚖️ Konten prüfen), USt-Übersicht Kz. 60 |
| S5 | Belege samt Datei löschbar | § 147 AO, GoBD | belege.ts:154 | Stornieren mit Grund statt Löschen, Datei behalten | ✅ DB sperrt Löschen, Storno mit Grund, zählt nicht für Vorsteuer/DATEV (Migration `20261103180000`) |
| S6 | Konto löschen vernichtet Rechnungen und Belege sofort, ohne Warnung und Export; Datenschutzerklärung verspricht Aufbewahrung | § 147 AO, § 14b UStG | kontoeinstellungen.ts:54, loeschen.ts | Warnung + Komplettexport (Rechnungen, Belege, DATEV) vor dem Löschen; Text anpassen | ✅ Warnung beim Konto löschen, `/konto/archiv.zip` (Rechnungen Word+XRechnung, Belegdateien, CSV, Hinweis) auch unter Rechnungen; ⏳ Text Datenschutzerklärung, Sperre statt Löschen (⚖️) |
| S7 | Rechnung, USt, DATEV laufen für Firmen in allen Ländern nach deutschem Recht (PL KSeF, IT SDI, ES Verifactu, FR, US Sales Tax) | jeweiliges Landesrecht | kein Länderfeld | Feld „Land der Firma“; Steuerfunktionen nur für DE | ✅ (L1) |

### Mittel
| # | Befund | Stelle | Stand |
|---|---|---|---|
| S8 | USt-Übersicht ordnet nach Rechnungsdatum statt Leistungsmonat (Soll-Versteuerung, § 13 Abs. 1 Nr. 1a UStG) | umsatzsteuer.ts:19 | ✅ Leistungsmonat; Storno im Monat des Stornos (§ 17) |
| S9 | Vorsteuer auch aus Einträgen ohne Beleg; ab 250 € keine Prüfung der ordnungsgemäßen Rechnung | umsatzsteuer.ts:33, belege.ts:77 | ⏳ |
| S10 | Bewirtung als Reisekosten gebucht, Anlass/Teilnehmer fehlen (§ 4 Abs. 5 Nr. 2 EStG) | belegleser.json, datev.ts | ⏳ |
| S11 | E-Rechnungen (XML) lassen sich nicht als Beleg annehmen (Empfangspflicht seit 2025) | belege.ts:17 | ⏳ |
| S12 | Hinweis „E-Rechnung für Behörden“ ab 2027 irreführend (B2B-Pflicht 2027/2028) | rechnungen.ts:121 | ✅ Hinweistext |
| S13 | Kleinunternehmer-Wächter: Gründungsjahr, vereinnahmte Entgelte, Umsätze außerhalb Jarvis | umsatzsteuer.ts:42 | ⏳ ⚖️ |
| S14 | XRechnung: Prüffunktion nie aufgerufen, Land fest DE, BT-49/BT-48, Platzhalter-Telefon, nur Kategorie S/E | xrechnung.ts | ✅ Prüfung vor dem Download, nur ausgestellte Rechnungen; ⏳ Land, BT-48, weitere Kategorien, Storno als E-Rechnung |
| S15 | Zahlungsziel 14 Tage fest, Mahnung liest `zahlungsziel_tage` | rechnungen.ts:40, xrechnung.ts | ✅ |
| S16 | Leistungstext fest „Personalgestellung“ (sachlich falsch, Anschein von AÜG) | rechnungen.ts:25 | ✅ neutral „Leistungen <Monat> lt. Leistungsnachweis“; ⏳ je Kunde einstellbar |
| S17 | Hinweis auf Aufbewahrungspflicht bei Leistungen an Privatpersonen fehlt (§ 14 Abs. 4 Nr. 9 UStG) | rechnungen.ts | ⏳ |
| S18 | DATEV: alle Belege gegen Kreditor 70000 (auch bar), kein § 13b-Schlüssel für Auslandsbelege, Arbeitskleidung als Fremdleistung | datev.ts | ⏳ ⚖️ |
| S19 | Spesen als eine Lohnart; Pauschalen/Kilometergeld fehlen | spesen.ts, datev.ts | ⏳ |
| S20 | Belege mit mehreren Steuersätzen werden mit dem höchsten Satz gerechnet | belege.ts:71 | ⏳ |

### Niedrig
S21 Kleinunternehmer-Text nennt die Befreiung nicht ausdrücklich (✅) · S22 fehlende Steuernummer wird auf die Rechnung gedruckt statt zu sperren (✅ Ausstellen gesperrt) · S23 Verzugszinsen/40-€-Pauschale optional anbieten (⏳) · S24 Rechnungsdatum = Erstellung des Entwurfs (✅ Datum beim Ausstellen) · S25 Leitweg-ID-Feld je Kunde (✅ Migration `20261103230000`, eigenes Feld, wird beim Ausstellen eingefroren und als BT-10 in die XRechnung geschrieben) · S26 Belegdateien gelöschter Firmen bleiben in R2 (✅ Ordner belege/ und rechnungen/ werden beim Kontolöschen mit entfernt) · S27 Nachkalkulation ohne Ausfallzeiten (⏳) · S28 LODAS-Schlüssel vom Lohnbüro bestätigen (⚖️; § 3b-Spalten n25/n40/so50/f125/f150 jetzt als eigene Lohnarten im LODAS-Export)

## 2. Arbeitsrecht und Lohn

### Hoch
| # | Befund | Norm | Stelle | Vorschlag | Stand |
|---|---|---|---|---|---|
| A1 | Schichtplan prüft das ArbZG nicht (16 h am Tag, Ruhezeit < 11 h, Sonntage gehen durch), auch Ersatzvorschläge und Selbst-Übernahme offener Schichten | ArbZG §§ 3, 5, 9–11 | schichten.ts, Migration `schicht_uebernehmen` | Gemeinsame Prüfung, Warnung mit Bestätigung im Büro, Sperre bei Selbst-Übernahme | ✅ `arbzgHinweise` (§ 3 netto > 10 h, § 5 Ruhe < 11 h, Sonntag-Hinweis) im Plan und beim Speichern mit Bestätigung; Ersatzvorschläge ohne Verstoß; Selbst-Übernahme gesperrt (Migration `20261103160000`); ⏳ Feiertage, 15 freie Sonntage, Ersatzruhetag-Zähler |
| A2 | Person löschen vernichtet per Kaskade Stundenzettel, Stempel, AÜG-Einsätze, Unterweisungsnachweise | § 17 MiLoG, § 16 ArbZG, § 147 AO | personal.ts:509 | „Ausgeschieden“ statt Löschen, automatische Löschung nach Frist | ✅ DB sperrt das Löschen, solange Stunden/Stempel/Überlassungen jünger als 2 Jahre sind; Meldung mit Datum (Migration `20261103150000`); ⏳ automatische Löschung nach Frist, Unterweisungsnachweise |
| A3 | AÜG-Wächter zeigt immer „Equal Pay ab 9 Monaten“ – ohne Tarifvertrag Zeitarbeit gilt Equal Pay ab Tag 1 | § 8 AÜG | aueg.ts:54 | Feld „Tarifvertrag Zeitarbeit angewendet“ | ✅ Feld im Firmenprofil; „nein“ → Equal Pay ab Tag 1, ohne Angabe Hinweis (Migration `20261103170000`) |
| A4 | Feiertage nach Bundesland des Firmensitzes statt des Arbeitsorts (steuerfreie Zuschläge falsch) | § 3b EStG, Feiertagsgesetze | stunden.ts:26, zuschlaege.ts, lohn.ts, urlaub.ts | Bundesland aus PLZ des Einsatzorts | ✅ Zuschläge in Lohn, Stunden, Leistungsnachweis, Kundenlink, Rechnung, Nachkalkulation nach dem Bundesland des Kunden-Einsatzorts (eindeutiger Einsatzort, sonst Kundenadresse, sonst Firma); ⏳ Urlaub/Zeitkonto (Wohn-/Arbeitsort der Person), Gemeinde-Feiertage |
| A5 | Ausländische PLZ werden deutschen Ländern zugeordnet (Paris → BW); deutsche Feiertage, Mindestlohn, Zuschläge im Ausland | Landesrecht | zuschlaege.ts:7 | Personal-, Lohn- und Schichtfunktionen außerhalb DE sperren (siehe L1) | ✅ (L1) |
| A6 | § 3b-Zeitfenster unvollständig (20–23 Uhr, 0–4 Uhr 40 %, 150-%-Tage, 24./31.12. ab 14 Uhr) | § 3b EStG | zuschlaege.ts:47 | Getrennte Minutentöpfe | ✅ `steuerfrei3b` (Nacht 25/40 %, Sonntag 50 %, Feiertag 125/150 %, 0–4 Uhr Folgetag, 24./31.12. ab 14 Uhr) als eigene Spalten in Lohnliste Excel/CSV; tarifliche Nacht 23–6 bleibt; ⏳ LODAS-Lohnarten dafür |

### Mittel
A-M1 AÜG-Unterbrechung „> 3 Monate“ statt „≥“ (⏳ ⚖️) · A-M2 Kennzeichnung/Konkretisierung, Erlaubnis-Ablauf, Bauhauptgewerbe (⏳) · A-M3 Urlaub zählt stur Mo–Fr, keine Mindesturlaub-Warnung (✅ Warnung unter 20 Tagen; ⏳ Arbeitstage je Person für Teilzeit) · A-M4 Urlaubsverfall ohne dokumentierten Hinweis (🔧 Einsatzkräfte sehen Rest und Verfallhinweis in der App, Büro-Hinweis zur Pflicht; ⚖️ ob das als Hinweis nach BAG reicht, besser zusätzlich schriftlich) · A-M5 Krank/Kinderkrank/unbezahlt nicht getrennt für das Lohnbüro – ohne Diagnose (⏳) · A-M6 Nachträge > 7 Tage nicht als „verspätet“ markiert (✅ Hinweis „später als 7 Tage … (§ 17 MiLoG)“ im Stundenzettel) · A-M7 Stempeluhr: Schicht > 24 h springt über Mitternacht (✅ über 16 Std. kein automatischer Stundenzettel, Hinweis zum Nachtragen) · A-M8 Mindestlohn 2027 (14,60 € prüfen) fehlt in der Kalkulation (✅ Hinweis bis Jahresende, ab 1.1.2027 automatisch 14,60 €) · A-M9 Unterweisung löschen löscht Teilnahmenachweise (✅ Migration `20261103270000`: mit Teilnahmen der letzten 2 Jahre nur archivieren) · A-M10 Bewacher-ID, Sachkunde § 34a als Pflicht beim Einplanen (⏳) · A-M11 Bewertungs-Rangliste ohne Löschfrist, automatische Sperre auf Kundenwunsch (✅ Löschung nach 2 J., Sperre verfällt nach 12 Monaten; ⚖️)

### Niedrig
Pausenprüfung grob · Gemeinde-Feiertage (Mariä Himmelfahrt, Augsburg, Fronleichnam Teile SN/TH) · Zeitkonto-Soll Mo–Fr · Bewerber-Löschung nur beim Öffnen der Seite · Geburtstage ohne Einwilligung im Team · Pause anteilig bei Zuschlägen

## 3. Datenschutz

### Hoch
| # | Befund | Norm | Stelle | Vorschlag | Stand |
|---|---|---|---|---|---|
| D1 | Leser (Steuerbüro) sehen fast die ganze Personalakte (Notizen, Geburtstag, Aufenthaltstitel, Bewertungen, Stempel, PSA, Checklisten) | Art. 5 Abs. 1 c, Art. 32 DSGVO, § 26 BDSG | darf_bereich, lesen-Policies, organisation.ts:35 | Leser: nur Name, Personalnummer, Stunden | ✅ Nachweise, PSA, Checklisten, Unterweisungen, Bewertungen, Stempel, Rundgänge, Wachbuch, Führerscheinkontrollen, Unterschriften, Überlassungen für Leser gesperrt (Migration `20261103140000`); ⏳ Spalten der Personalakte (Notiz, Geburtstag, Aufenthalt) |
| D2 | Führungszeugnis, Gesundheitszeugnis, Höhentauglichkeit als Upload-Vorschlag; Download für das ganze Büro inkl. Leser | Art. 9, 10 DSGVO, § 53 BZRG, ArbMedVV | personalakte.ts:12, 133, 155 | Nur „eingesehen am / gültig bis“, keine Kopie; Downloads nur Inhaber/Admin/Bearbeiter | ✅ keine Kopie (Datei wird verworfen), Hinweis, Download nur Inhaber/Admin/Bearbeiter/Standortleitung; ⏳ alte Kopien prüfen |
| D3 | Ausfall-Notiz wird weiter gespeichert und in der Personalakte gezeigt (auch Lesern) | Art. 9 DSGVO | ausfall_melden, personal.ts:95 | Notizfeld beim Ausfall streichen, alte Notizen leeren | ✅ Feld weg, DB-Trigger speichert nie einen Grund, alte geleert |
| D4 | Rundgänge und Wachbuch ohne Standortgrenze (Standortleitung und Leser sehen alles) | Art. 5, 32 DSGVO | Migration 20261103040000:38 | darf_bereich, Leser ausschließen | ✅ |
| D5 | Wachbuch-Vorfälle ungefiltert im Kundenportal, Portal-Link ohne Ablauf | Art. 5, 10, 32 DSGVO | Migration 20261103060000:72 | Freigabe pro Eintrag, Ablaufdatum | ✅ nur Zeit und Objekt, kein Text; ✅ Link gilt 12 Monate, nachts abgeschaltet (Migration `20261103240000`) |
| D6 | Person löschen: Dateien bleiben in R2, Pflichtunterlagen gehen verloren | Art. 17 DSGVO | personal.ts:508 | wie A2, R2-Ordner pro Person mitlöschen | 🔧 Pflichtunterlagen geschützt (A2); ✅ Foto und Nachweisdateien werden mit der Person aus R2 gelöscht |

### Mittel
D7 Keine Löschfristen für Abwesenheiten, Stunden, Stempel, Scans, Wachbuch, Bewertungen, Meldungen, Unterschriften, ausgeschiedenes Personal (✅ Migration `20261103220000`, nachts vor der Sicherung: Stempel/Scans/Bewertungen 2 J., Abwesenheiten/Wachbuch 3 J. ab Jahresende; ⏳ Stundenzettel/Unterschriften/Spesen nach steuerlicher Frist, erst ab 2032 relevant; ⚖️ Wachbuch-Frist nach BewachV prüfen) · D8 `push_nachrichten` wird nie gelöscht (Datenschutzerklärung sagt 30 Tage) (✅ 30 Tage) · D9 Bewerber-Löschung nicht zuverlässig, offene Bewerbungen ohne Frist (✅ Migration `20261103250000`: offene Bewerbungen 12 Monate nach letzter Änderung; nächtliche Löschung für inaktive Firmen 30 Tage nach Löschdatum; Datenschutzerklärung angepasst, AGG-Formulierung entschärft) · D10 Änderungsprotokoll speichert Notizen und Bewerbernamen 12 Monate (⏳) · D11 Kunden-Stundenlink zeigt nach Ablauf weiter Namen und Stunden (✅) · D12 Leistungs-/Verhaltenskontrolle (Rangliste, „nicht am Einsatzort“, Scan-Tabelle) ohne Mitbestimmungshinweis (✅ Hinweis auf Rundgängen, Bewertungen, Personal-Auswertung; DE/AT/FR/IT/NL) · D13 Auskunft/Export für Einsatzkräfte und Firmen fehlt (✅ Einsatzkräfte: „Meine Daten“ enthält jetzt eigene Personalakte, Stunden, Schichten, Stempel, Abwesenheiten, Spesen, Nachweise, Unterweisungen; 🔧 Firmen: ZIP-Archiv Rechnungen/Belege, ✅ Gesamtexport `/konto/firmendaten.zip`, RPC `firmendaten_export`, Migration `20261103260000`) · D14 AVV und Datenschutzerklärung veraltet (Einsatzkräfte, Bewerber, Chat, Rundgang, Wachbuch, Kundenportal fehlen) (✅ ⚖️)

### Niedrig
D15 Freitextfelder ohne Hinweis „keine Gesundheitsangaben“ · D16 Lesebestätigungen firmenweit · D17 Aufenthaltstitel/Geburtstag für alle Büro-Rollen · D18 „Ersatz für <Vorname>“ verrät der Ersatzkraft, wer fehlt (✅ „Ersatzschicht“) · D19 Länderregeln für Stempeluhr, Rundgänge, Bewertungen (IT Art. 4 Statuto, FR CSE/CNIL, AT § 96 ArbVG, NL Art. 27 WOR, PL Art. 22³ KP)

## 4. Länder (übergreifend)

| # | Befund | Vorschlag | Stand |
|---|---|---|---|
| L1 | Es gibt kein Feld „Land der Firma“. Personal, Lohn, Schichten, Rechnungen, USt, DATEV laufen überall nach deutschem Recht | Feld anlegen; diese Funktionen außerhalb DE sperren mit Hinweis, bis es eigene Länderregeln gibt | ✅ Feld im Firmenprofil (bestehende Firmen nach App-Sprache vorbelegt); Schichtplan, Stunden, Lohn, Zeitkonto, Urlaub, AÜG, Rechnungen, USt, Belege/DATEV, Spesen, Nachkalkulation, Disposition nur für DE (`laenderfunktionen.ts`) |

## 5. Rechtstexte und Länderpflichten

### Hoch
| # | Befund | Norm | Stelle | Vorschlag | Stand |
|---|---|---|---|---|---|
| R1 | AVV deckt nur den „Ausschreibungs-Alarm“ ab, nicht Personal, Bewerber, Stunden, Stempel, Belege, Unterschriften, Kunden, Wachbuch, Chat; Pflichten aus Art. 28 Abs. 3 S. 3 und Abs. 4 fehlen; Nutzungsbedingungen § 4 „möglichst keine Mitarbeiterdaten“ widerspricht dem Produkt | Art. 28 DSGVO | rechtliches.ts:92–140 | AVV § 1/§ 2 neu, Pflichten ergänzen, AGB § 2/§ 4 anpassen | ✅ Entwurf live (Stand 03.11.2026, alle 5 Sprachen) ⚖️ Anwalt prüft |
| R2 | Alarm committete täglich Trefferlisten, Bewertungen und Suchprofile der Kundenfirmen ins öffentliche Repo | Art. 5 Abs. 1 f, 32 DSGVO | alarm.yml | Speicherung privat in R2, Versionsgeschichte bereinigt | ✅ (03.11.) ⚖️ Art. 33 bewerten |

### Mittel
R-M1 Datenschutzerklärung: Chat, Rundgang/Wachbuch, Kundenportal, Belegleser (KI), Betreiber-Meldung bei Anmeldung fehlen; Rechtsgrundlagen teils fehlend (✅ ergänzt, ⚖️) · R-M2 `push_nachrichten` nie gelöscht (= D8) (✅) · R-M3 Impressum ohne zweiten schnellen Kontaktweg (Kontaktformular reicht) (✅ `/kontakt`, Mail nur ans eigene Postfach, Honeypot, 30/Tag, in Impressum, Datenschutz und Fußzeile) · R-M4 keine englischen Rechtstexte (US/UK/NL) (✅ `rechtliches-en.ts`, Übersetzung, Deutsch verbindlich; ⚖️ für US-Kunden ggf. eigene Fassung) · R-M5 Haftungsklausel: Satz 3 ohne Vorbehalt Vorsatz/grobe Fahrlässigkeit, Deckel 0 € in der Testphase (✅ Entwurf: Satz 1 bleibt unberührt, kostenlose Nutzung nach §§ 521/599 BGB ⚖️) · R-M6 Änderungsfiktion zu weit, Abo-/Testphasen-Regeln fehlen, keine Unternehmer-Bestätigung bei der Registrierung (✅ Fiktion nur für unwesentliche Änderungen, Testphase endet von selbst; ✅ Pflicht-Häkchen „für ein Unternehmen, nicht als Verbraucher“, Zeitpunkt in den Kontodaten) · R-M7 Datenexport bei Vertragsende uneinheitlich (AGB/AVV/abos.md), Data Act (🔧 Gesamtexport JSON + Archiv vorhanden; ⚖️ AGB-Klausel zum Anbieterwechsel nach Data Act prüfen)

### Niedrig
Quellenangaben ANAC, data.gv.at, Find a Tender, USAspending, GeoNames im Impressum; Lizenzlinks · Download-Werkzeug ohne Portal-Liste · Komfort-Cookies kürzen · KI-Kennzeichnung („🤖 KI-Bewertung“) · DSA-Kontaktstelle · AVV-TOM zur Sicherung widersprüchlich · DPF-Status der Dienstleister prüfen · Wirtschafts-ID nachtragen

## 6. KI-Einsatz

Einordnung: Benjamin ist **Anbieter** der KI-Funktionen (nachgelagert auf Claude), die Kundenfirmen sind Betreiber. Alle KI-Funktionen betreffen Ausschreibungen, Belege, Firmennachweise und die Firmenrecherche: **kein Hochrisiko**. Die Personalfunktionen (Personalsuche, Ersatzvorschläge, Bewertungen, Auswertung, Bewerber) nutzen **keine KI**, sondern feste Regeln; Art. 22 DSGVO wird nicht ausgelöst (Mensch entscheidet per Klick).

### Hoch
K1 AVV veraltet (= R1) (⏳ ⚖️) · K2 Führungszeugnis geht automatisch zum Ablaufdatum-Lesen an Anthropic (Art. 10 DSGVO) → keine Automatik für Führungszeugnis/Gewerbezentralregister (✅) · K3 Datenschutzerklärung nennt nicht alle KI-Zwecke (Belege, Nachweise, Lose, Förderbewertung, Website-Text); DPF/SCC, Speicherdauer bei Anthropic (✅ Zwecke ergänzt; ⚖️ DPF/SCC, Speicherdauer)

### Mittel
K4 Steckbriefe mit Personennamen/Mailadressen lagen im Repo (✅ jetzt privat, 30 Tage) – zusätzlich Kontaktpersonen vor dem Prompt entfernen (✅ `datensparsam.ts`: „Herr/Frau Name“ und persönliche Mailadressen werden vor der KI maskiert, Funktionsadressen bleiben) · K5 Hinweis „geht an KI-Dienst in den USA“ direkt beim Hochladen (✅ Vergabeunterlagen, Belege) · K6 maschinenlesbare KI-Kennzeichnung (Art. 50 Abs. 2, gilt seit 02.08.2026) (✅ Steckbriefe sichtbar „🤖 Von KI erstellt“ und `data-ki-erstellt`; ✅ Treffer-Einschätzung „🤖“ mit `data-ki-erstellt`; Word-Exporte enthalten keine KI-Texte) · K7 Modell/Antwort-ID nicht protokolliert (✅ Migration `20261103280000`: Modell und request-id je Web-Aufruf in `jarvis_katalog.ki_kosten`, keine Inhalte; ⏳ Alarm-Lauf in Python) · K8 KI-Ablaufdatum wird ohne Bestätigung gespeichert und steuert Sperren (✅ Kennzeichen „🔍 KI-Datum, bitte prüfen“ bis zum Speichern von Hand) · K9 Steckbrief-Fehler: Abgleich Lose/Fristen mit eForms, Haken „mit Original geprüft“ vor Freigabe (⏳) · K10 Hinweis Mitbestimmung (§ 87 BetrVG) bei Personalfunktionen (✅ = D12) · K11 Länder ES (Art. 64.4 d ET: Algorithmen-Information), IT, AT, NL, FR, PL (⏳ ⚖️)

### Niedrig
US-Personalfunktionen erst nach US-Prüfung · künftige KI bei Personal wäre Hochrisiko → rote Linie in AGENTS.md · „nicht wieder“-Sperre nach 12 Monaten verfallen lassen (✅) · verwaiste Belegfotos löschen · Hilfeseite „Was die KI kann und nicht kann“ (Art. 4) (✅ `/hilfe/ki`)

## 7. Fragen für Anwalt / Steuerbüro

**Steuerbüro**
- Gesamtumsatz nach § 19 seit 2025: vereinnahmte Entgelte? Grenze im Gründungsjahr?
- § 13b: welche Nachweise (USt 1 TG) je Kunde, welche Konten und BU-Schlüssel (auch Bewirtung)?
- Kleinunternehmer in der XRechnung: Kategorie E mit Begründung ausreichend oder VATEX-Code?
- Rechnung als Word (änderbar) oder besser PDF?
- LODAS-Bearbeitungsschlüssel, DATEV-Kontenvorschläge bestätigen.

**Anwalt**
- GoBD-Aufbewahrung, wenn eine Kundenfirma ihr Konto löscht: Export mit Warnung oder gesperrtes Archiv?
- Spanien (Verifactu): gilt Jarvis als Rechnungssoftware mit Herstellerhaftung? Vor dem Start in ES klären.
- ArbZG: reicht Warnen, oder muss die Software bei Selbst-Übernahme sperren?
- Aufbewahrungsfristen nach Austritt (2 Jahre MiLoG/ArbZG oder 6/10 Jahre Lohnkonto/AO) – je Land?
- AÜG: Zählweise der 3-Monats-Unterbrechung und der 18 Monate (BA-Weisung); gilt sie auch für Branchenzuschläge?
- § 3b EStG: Feiertag am Einsatzort oder Betriebssitz? Gemeinde-Feiertage?
- Reicht für AT/FR/PL/ES/IT/NL/US die Sperre der Personalfunktionen, oder braucht es AGB-Hinweise schon für Ausschreibungskunden?
- Mitarbeiterbewertungen/Rangliste und automatische Sperre auf Kundenwunsch: Mitbestimmung, Einwilligung, AGG?
- Darf ein Steuerbüro als Leser Personaldaten sehen, welcher Umfang?
- Ist die Historie „kurzfristig ausgefallen“ je Person ein Gesundheitsdatum? Speicherdauer?
- Führungszeugnis/Gesundheitsnachweise: Kopie speichern oder nur Einsicht vermerken?
- Wachbuch-Vorfälle im Kundenportal: Art.-10-Daten? Wer ist verantwortlich?
- In-App-Hinweis zur Mitbestimmung ausreichend oder Funktionen ohne Betriebsvereinbarung sperren?
- AVV: besondere Kategorien und Beschäftigtendaten ausdrücklich nennen, TOMs dafür?
- Erfahrungszuschlag GVP (Monat 9: 1,5 %, Monat 12: 3 %) gegen Original prüfen.

## 8. Probezeit-Schutz (Benjamin 03.11.2026)

Migration `20261103200000`: neue Firmen starten im Demo-Modus ohne KI (`firmen.ki_budget_usd = 0`). Mit eigener
Website (Domain, die noch keine andere Firma nutzt, keine Freemail) gibt es 5,50 $ (≈ 5 €) KI-Kontingent.
`ki_reservieren_fuer` lehnt Anfragen über dem Kontingent ab (Alarm fällt auf Stichwort-Treffer zurück). Bestehende
Firmen, eigene Firmen und zahlende Kunden: `null` = ohne Grenze (setzt der Betreiber per SQL). Hinweis auf der Übersicht
(`probeHinweis`).

## 9. Rechnungsvorlage (03.11.2026)

Migration `20261103210000`: Einleitung und Schlusstext (je höchstens 1.000 Zeichen) im Firmenprofil, Logo in R2.
Pflichtangaben nach § 14 Abs. 4 UStG bleiben fest im Dokument und lassen sich über die Vorlage nicht entfernen.
Ausgestellte Rechnungen und Stornos werden beim Ausstellen als Word-Original abgelegt und danach unverändert
ausgeliefert, auch im ZIP-Archiv (GoBD Unveränderbarkeit). Das Original wird mit dem Firmenordner beim Kontolöschen
entfernt; vorher kommt die Warnung zum ZIP-Export.

## 10. Redaktionelle Korrekturen (03.11.2026)

- Haftung § 7 Satz 3 war widersprüchlich („bei einfacher Fahrlässigkeit nur … für Vorsatz und grobe Fahrlässigkeit“). Neu: Bei kostenloser Nutzung entsprechend §§ 521, 599 BGB nur Vorsatz und grobe Fahrlässigkeit, für einfache Fahrlässigkeit nicht. In allen 6 Sprachen. ⚖️ Anwalt prüft.
- Datenschutz Bewerber „6 Monate nach Absage (Frist nach dem AGG)“: Die Geltendmachungsfrist nach § 15 Abs. 4 AGG beträgt 2 Monate, plus Klagefrist (§ 61b ArbGG, 3 Monate); 6 Monate ist übliche Praxis. ⚖️ Formulierung mit Anwalt klären.
