# Ideen: Jarvis als komplette Arbeitsoberfläche für kleine und mittlere Firmen

Stand 02.11.2026 (Claude). Nur Konzept, noch kein Code.
Zielgruppe: Reinigung, Sicherheitsdienst, Handwerk, Zeitarbeit. Zuerst DACH, danach FR, PL, ES, IT und USA.
Ziel: Eine Firma braucht neben Jarvis kein zweites Programm mehr für Planung, Personal, Kunden, Rechnungen und Vorbereitung der Buchhaltung.

## Gibt es schon (kurz)

- **Ausschreibungen:** täglicher Alarm mit KI-Punkten (DE, weitere EU-Länder über TED, FR, PL, Katalonien, USA), Steckbrief, Unterlagen-Upload, Fristen mit Kalender-Abo, Termine und Bieterfragen, Radar für Neuausschreibungen, Förderprogramme, Markt-Seite mit Zuschlägen und Auftraggebern, Auswertung (Trichter, Gewinnquote).
- **Angebote:** Kalkulation pro Los mit Tarifen und Zuschlägen, Vorlagen pro Standort, Preisuntergrenze, Zuschlagsvergleich, GAEB-Leistungsverzeichnis, Textbausteine, Angebotsmappe mit Chef-Freigabe, Angebote-Übersicht, laufende Aufträge (Verträge, Optionsfristen).
- **Firma & Dokumente:** Firmenprofil, Eigenerklärung als Word, Zertifikate und Präqualifikation mit Ablaufwarnung, Firmenunterlagen mit Ordnern und Ablaufdatum (KI liest es), Referenzen, Nachweise als Zip, Änderungsprotokoll, Organigramm, Rollen und Rechte, Vertretung, Aufgaben.
- **Personal:** Personalakte, Import aus Excel, Qualifikationen mit Nachweis, Personalfristen (Probezeit, Befristung, Aufenthalt), Führerscheinkontrolle, Unterweisungen (auch digital bestätigt), Schutzausrüstung, Bewerber, Einstieg/Austritt-Checklisten, Urlaub mit Teamkalender, Bewertungen, Personal-Auswertung, Personalsuche mit Umkreis, Tarifdatenbank (Startbestand).
- **Planung & Zeit:** Disposition, Kapazität, Schichtplan mit offenen Schichten, Einsatzplan, kurzfristiger Ausfall mit Ersatzvorschlag, Stundenzettel, Stempeluhr, Arbeitszeitkonto, Zuschläge (Nacht, Sonntag, Feiertag je Bundesland), AÜG-Wächter (Equal Pay, Höchstdauer, Branchenzuschläge).
- **Kunden & Abrechnung:** Kunden und Einsatzorte mit Infoblatt, Leistungsnachweis, Kunde bestätigt Stunden per Link, Rechnungsentwurf als Word (§ 14 UStG), Lohnliste als Excel/CSV, Spesen mit Belegfoto.
- **Kommunikation:** Schwarzes Brett mit Lesebestätigung, Rundnachricht über WhatsApp/SMS/Mail-Knöpfe, Handy-Nachrichten, Mitarbeiter-Ansicht in 7 Sprachen, Einladung per Link/QR.
- **Partner:** eigene Partnerbetriebe und Nachunternehmer-Anfragen je Los, freiwilliges Partnerprofil auf der Markt-Seite.
- **Plattform:** Oberfläche auf Deutsch, Englisch, Französisch, Polnisch, Spanisch; Demo ohne Anmeldung; Datensicherung; Pläne Free/Basis/Pro/Erfolg vorbereitet (`web/src/plaene.ts`, noch nicht aktiv).

**Was fehlt:** Mahnwesen, E-Rechnung, Buchhaltungs-Export, Belegerfassung, Zahlungseingang, Angebote für Privat- und Gewerbekunden ohne Ausschreibung, Kunden-Portal, Arbeiten mit Firmen untereinander (Börse) und Länderregeln außerhalb Deutschlands.

## Grundsätze für alle Ideen

- Jarvis verschickt nichts an Dritte ohne Freigabe durch die Firma.
- Steuer und Lohn: nur Vorbereitung und Export. Buchen, Beraten und Abgeben macht die Firma oder ihr Steuerberater (Steuerberatungsgesetz).
- Rechtshinweise sind Hinweise, keine Rechtsberatung (Rechtsdienstleistungsgesetz). Vorlagen vorher von Anwalt oder Kammer prüfen lassen.
- KI für Kunden läuft über die offizielle API mit Kostenbremse.
- DSGVO: Auftragsverarbeitung (AVV), Rechte je Rolle, Löschfristen. Bei Ortung oder Leistungskontrolle hat ein Betriebsrat Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG).
- Kassengesetz (KassenSichV) ist nicht betroffen, weil Jarvis keine Bargeldkasse ist.

**Aufwand:** S = klein (ein Arbeitsgang), M = mittel (einige Arbeitsgänge), L = groß (mehrere Wochen, oft mit Fremdanbieter oder rechtlicher Prüfung).
**Abo:** Free = zum Ausprobieren, Basis = kleine Firma, Pro = mehrere Standorte und Profi-Werkzeuge, Erfolg = Provision bei Erfolg.

## Ideen nach Bereichen

### 1. Personal & Lohnvorbereitung

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 1 | **Personalfragebogen im Handy**: neue Kraft trägt Steuer-ID, Sozialversicherungsnummer, Krankenkasse und Bankverbindung selbst ein | Das Lohnbüro bekommt vollständige Daten ohne Papier und Nachfragen. | M | Kräfte einladen (T43), Personalakte (T4), Checklisten (T25) | DSGVO; Konfession ist eine besondere Datenkategorie (Art. 9), nur für die Lohnsteuer, eigene Rechte und Verschlüsselung; Löschfristen | Basis |
| 2 | **Verträge aus Vorlage**: Arbeitsvertrag und Arbeitnehmerüberlassungsvertrag (AÜV) mit Daten aus Akte und Kunde | Ein Vertrag ist in zwei Minuten fertig und vollständig. | M | Word-Modul, Textbausteine, Tarife, Kunden, AÜG-Wächter | Nachweisgesetz: in Branchen nach § 2a SchwarzArbG (u. a. Bau, Gebäudereinigung, Sicherheit) weiter Papier mit Unterschrift; AÜV seit 2025 in Textform, Leiharbeitskraft vorher namentlich nennen, als Überlassung bezeichnen (§ 1, § 12 AÜG); Vorlagen anwaltlich prüfen | Pro |
| 3 | **Lohn-Export für DATEV und gängige Lohnprogramme**: fertige Importdatei statt freier CSV | Das Lohnbüro tippt nichts mehr ab. | M | Lohnliste (T35), Zuschläge (T30), Zeitkonto (T37), Spesen | Nur Export; Abrechnung macht Lohnbüro oder Steuerberater (StBerG); DATEV ohne Partnervertrag nur per Datei-Import | Basis |
| 4 | **Mindestlohn-, Minijob- und Aufzeichnungs-Wächter** | Warnt, bevor Strafen drohen: Satz unter Mindestlohn, Minijob-Grenze erreicht, Stunden nicht bis zum 7. Tag erfasst. | S | Tarifdatenbank, Stundenzettel, Stempeluhr, Lohnliste | MiLoG (§ 17 Aufzeichnung bis 7. Tag), Minijob-Grenze ist an den Mindestlohn gekoppelt und ändert sich jährlich | Basis |
| 5 | **Krankmeldung im Handy**: Kraft meldet sich krank, Büro sieht die Lücke und den Hinweis „eAU abrufen“ | Weniger Telefon am Morgen, schneller Ersatz. | S | Kurzfristiger Ausfall (T32), Abwesenheiten (G2), Schichtplan | Gesundheitsdaten (Art. 9 DSGVO): nur „krank ja/nein“, nie eine Diagnose; eAU-Abruf läuft über das Lohnprogramm | Basis |

### 2. Einsatzplanung

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 6 | **Planer zum Ziehen und Ablegen mit Konfliktprüfung**: Ruhezeit, Höchststunden, Urlaub, fehlender Nachweis, gesperrter Kunde, Streik beim Kunden | Fehler fallen beim Planen auf, nicht erst am Einsatztag. | M | Schichtplan (T18), Disposition (N12), Personalfristen, AÜG-Wächter | ArbZG (11 Std. Ruhezeit, höchstens 10 Std.); Leiharbeit nicht in bestreikten Betrieben (§ 11 Abs. 5 AÜG); Betriebsrat bei Schichtplänen | Basis |
| 7 | **Besetzungsvorschlag**: Jarvis schlägt für offene Schichten passende Leute vor (Beruf, gültiger Nachweis, Nähe, Stundensoll, „gern wieder“) | Die Woche ist in Minuten statt Stunden geplant. | L | Personalsuche (T8), Bewertungen (T27), Kapazität (T15) | Mensch entscheidet (Art. 22 DSGVO); KI zur Arbeitsverteilung gilt nach EU-KI-Verordnung als Hochrisiko, daher feste Regeln mit Begründung statt KI-Urteil | Pro |
| 8 | **Revier- und Objektplan (Reinigung)**: Leistungen je Objekt mit Turnus (täglich, 2× Woche, Glas monatlich), daraus Stunden und Schichten | Aus dem Vertrag entsteht automatisch der Plan, nichts wird vergessen. | M | Kunden & Einsatzorte (T33), Schichtplan, Leistungsverzeichnis | keine besonderen | Basis |
| 9 | **Touren planen**: Reihenfolge der Objekte und Fahrzeit je Team und Fahrzeug | Weniger Fahrzeit und Sprit, realistische Planung. | M | Einsatzorte, PLZ-Daten, Fahrzeuge (T14) | Nutzungsbedingungen und Kosten des Routen-Dienstes prüfen (OpenStreetMap-Lizenz) | Pro |

### 3. Zeiterfassung & Nachweise vor Ort

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 10 | **Stempeln per QR-Code oder NFC-Aufkleber im Objekt** | Beweist die Anwesenheit am Ort, ohne dauernde Ortung. | S | Stempeluhr (T41), QR-Erzeuger, Einsatzorte | Datensparsam statt GPS; Betriebsrat (§ 87 BetrVG) | Basis |
| 11 | **Kontrollrundgang und Wachbuch (Sicherheit)**: Kontrollpunkte abscannen, fehlender Punkt meldet sich bei der Einsatzleitung, Vorfälle mit Foto, Bericht für den Kunden | Ersetzt teure Wächterkontrollsysteme, Kunde sieht die Leistung schwarz auf weiß. | M | QR, Stempeluhr, Handy-Nachrichten, Kundenlink (T40) | Bewegungsdaten nur im Dienst (DSGVO); § 34a GewO und Bewachungsverordnung (Dokumentation) | Pro |
| 12 | **Regie- und Baustellenbericht (Handwerk)**: Stunden, Material und Fotos je Tag, Kunde zeichnet am Handy ab | Stundenlohnarbeiten werden sicher bezahlt, weniger Streit. | M | Stundenzettel (T17), Unterschrift (T39), Kundenlink (T40) | VOB/B § 15: Stundenzettel zeitnah einreichen; Fotos möglichst ohne Personen | Basis |

### 4. Kunden & CRM

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 13 | **Anfragen und Verkaufsliste**: Anfrage → Besichtigung → Angebot → Auftrag, mit Wiedervorlage; dazu ein kleines Anfrage-Formular für die eigene Website | Keine Anfrage geht mehr verloren, auch außerhalb von Ausschreibungen. | M | Kunden (T33), Aufgaben (T13), Angebote-Übersicht (N1) | DSGVO, AVV mit der Firma; Werbung per Mail nur mit Einwilligung (UWG § 7) | Basis |
| 14 | **Besichtigung per Handy → Angebot**: Räume, Flächen, Fotos und Notizen vor Ort, daraus Stunden und Preis | Das Angebot steht am selben Tag. | M | Kalkulation, Revierplan (Nr. 8), Angebot mit Positionen (Nr. 16) | keine besonderen | Pro |
| 15 | **Dienstleistungsverträge mit Kündigungsfrist und Preisanpassung**: auch private Verträge, Erinnerung vor Verlängerung und bei neuem Tariflohn | Höhere Löhne werden rechtzeitig an Kunden weitergegeben. | S | Laufende Aufträge (N4), Fristen, Tarifdatenbank | Preis nur anpassen, wenn eine Klausel im Vertrag steht | Basis |

### 5. Angebote, Rechnungen, Mahnwesen

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 16 | **Angebot mit Positionen und Online-Annahme**: für Privat- und Gewerbekunden, Kunde nimmt per Link an, daraus wird Auftrag und später Rechnung | Schneller unterschriebene Aufträge ohne Drucken und Scannen. | M | Angebotsmappe, Kundenlink (T40), Unterschrift (T39) | Verbraucher: Widerrufsbelehrung (§ 312g BGB), Endpreise mit Steuer (PAngV); einfache Unterschrift reicht nicht, wo das Gesetz Schriftform verlangt | Basis |
| 17 | **E-Rechnung erstellen und empfangen** (XRechnung, ZUGFeRD) | Erfüllt die Pflicht und spart Porto und Abtippen. | M | Rechnungen (T34), Firmenprofil | DE: Empfang seit 01.01.2025 Pflicht; Ausstellen ab 2027 bei mehr als 800.000 € Vorjahresumsatz, ab 2028 für alle; Kleinunternehmer und Kleinbeträge bis 250 € ausgenommen; Behörden brauchen XRechnung mit Leitweg-ID; GoBD | Basis |
| 18 | **Zahlungsstatus und Mahnwesen**: offen / bezahlt / überfällig, Erinnerung, 1. und 2. Mahnung als Entwurf, Zahlungslink und Überweisungs-QR (GiroCode) auf der Rechnung | Geld kommt schneller, niemand muss Listen führen. | M | Rechnungen (T34), Handy-Nachrichten, Stripe (geplant) | Verzug § 286 BGB; unter Firmen 9 Prozentpunkte über Basiszins und 40 € Pauschale (§ 288 BGB); Versand nur nach Freigabe; Inkasso nur über registrierte Inkassodienste (RDG); Kartenzahlung nur über lizenzierten Zahlungsdienst | Basis |
| 19 | **Wiederkehrende Rechnungen**: monatliche Pauschale für Unterhaltsreinigung oder Objektschutz als fertiger Entwurf | Monatsende ist in fünf Minuten erledigt. | S | Rechnungen, Verträge (Nr. 15) | Fortlaufende Nummern, unveränderbar nach Freigabe (GoBD) | Basis |
| 20 | **Abschlags-, Schluss- und Nachtragsrechnungen (Handwerk/Bau)** mit Sicherheitseinbehalt und automatischem Steuerhinweis | Bau-Abrechnung ohne Rechenfehler und mit allen Pflichtangaben. | M | Rechnungen, GAEB-Leistungsverzeichnis (N9) | VOB/B § 16, § 632a BGB; Reverse Charge (§ 13b UStG) bei Bauleistungen an Baufirmen und Gebäudereinigung an Gebäudereiniger; Bauabzugsteuer (§ 48 EStG), Freistellungsbescheinigung beilegen | Pro |

### 6. Buchhaltung & Steuer-Vorbereitung

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 21 | **Belege per Foto**: Beleg fotografieren, KI liest Betrag, Datum, Steuer und Lieferant, Büro bestätigt | Kein Schuhkarton mehr für den Steuerberater. | M | Spesen mit Belegfoto (T36), Upload und Dokumentleser | GoBD: unveränderbar speichern, Verfahrensdokumentation fürs ersetzende Scannen; Aufbewahrung Belege 8 Jahre, Bücher 10 Jahre; KI über offizielle API (Kosten je Beleg) | Basis |
| 22 | **DATEV-Export für die Buchhaltung** (Buchungsstapel mit Belegen) und **Steuerberater-Zugang** nur zum Lesen und Herunterladen | Der Steuerberater holt sich alles selbst, das spart Gebühren. | M | Rechnungen, Belege (Nr. 21), Rollen und Rechte | Kontierung nur als Vorschlag, Buchen und Beraten macht der Steuerberater (StBerG); Kontenrahmen SKR03/SKR04; AVV | Basis |
| 23 | ✅ (03.11.2026) **Umsatzsteuer-Voranmeldung vorbereiten**: Summen je Monat oder Quartal, dazu Wächter für die Kleinunternehmer-Grenze | Keine Überraschung beim Finanzamt. | M | E-Rechnung (Nr. 17), Belege (Nr. 21) | Nur Übersicht für Steuerberater oder zum selbst Eintragen in ELSTER; keine Übermittlung, keine Beratung; Kleinunternehmer: 25.000 € Vorjahr, 100.000 € laufendes Jahr | Pro |
| 24 | **GoBD-Archiv**: Rechnungen, Belege und Änderungen unveränderbar mit Aufbewahrungsfrist, Vorlage für die Verfahrensdokumentation | Ruhig schlafen bei der Betriebsprüfung. | M | Änderungsprotokoll (G5), Datenspeicher, Datensicherung | GoBD; Konflikt mit DSGVO-Löschung: sperren statt löschen bis Fristende | Pro |
| 25 | **Kontoabgleich über Open Banking**: Kontoumsätze holen, Zahlungen den Rechnungen automatisch zuordnen | Offene Posten stimmen ohne Handarbeit. | L | Mahnwesen (Nr. 18) | Kontozugriff nur über einen von der BaFin zugelassenen Anbieter (PSD2/ZAG, z. B. finAPI, Tink, GoCardless); Zustimmung alle 180 Tage erneuern; Bank-Zugangsdaten gibt nur der Kunde ein | Pro |

### 7. Marktplatz & Subunternehmer-Börse

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 26 | **Auftragsbörse unter Firmen**: Auftrag oder Teil-Auftrag einstellen (Gewerk, Ort, Zeitraum), passende Firmen bekommen Bescheid und bieten | Aufträge, die man allein nicht schafft, werden trotzdem Umsatz. | L | Partnerprofile (Markt-Seite), Partner (N11), Handy-Nachrichten | Plattformpflichten nach Digital Services Act (Meldeweg, klare Regeln); Auftraggeber haftet für Mindestlohn und Sozialbeiträge der Subs (§ 14 AEntG, § 13 MiLoG, § 28e SGB IV im Bau) | Erfolg |
| 27 | **Personal-Kollegenhilfe**: Firmen bieten freie Kräfte für einzelne Tage an | Leerlauf wird Umsatz, Engpässe werden gedeckt. | L | Kapazität (T15), Disposition, AÜG-Wächter | Überlassung nur mit Erlaubnis der Arbeitsagentur (AÜG), Ausnahme gelegentliche Überlassung; Kettenverleih verboten; im Bauhauptgewerbe fast ganz verboten (§ 1b AÜG); Scheinwerkvertrag vermeiden; Jarvis fragt die Erlaubnis-Nummer ab | Erfolg |
| 28 | **Bietergemeinschaft finden**: zu einer Ausschreibung mit mehreren Losen oder Gewerken passende Partner vorschlagen, gemeinsame Mappe mit Bietergemeinschaftserklärung | Größere Ausschreibungen werden erreichbar. | M | Markt-Seite, Teilnahmeprüfung je Los, Angebotsmappe, Partner | Kartellrecht (§ 1 GWB): nur zulässig, wenn sachlich begründet (z. B. allein nicht leistungsfähig); keine Preisabsprache unter Firmen, die getrennt bieten | Erfolg |
| 29 | **Geprüftes Firmenprofil („Unterlagen aktuell“)**: zeigt, dass Freistellungsbescheinigung, Unbedenklichkeitsbescheinigungen (Krankenkasse, BG, SOKA-BAU), Versicherung und Gewerbe gültig hochgeladen sind | Mehr Vertrauen, schnellere Zusage als Nachunternehmer. | M | Firmenunterlagen mit Ablaufdatum, Zertifikate (T3) | Siegel heißt nur „hochgeladen und nicht abgelaufen“, keine Echtheitsgarantie, sonst irreführend (UWG) | Pro |
| 30 | **Nachunternehmer-Akte**: Pflichtnachweise der eigenen Subs (Freistellungsbescheinigung, Mindestlohnerklärung, A1 bei Firmen aus dem Ausland) mit Ablauf-Erinnerung, Gutschrift statt Rechnung | Haftungsrisiko wird kleiner. | M | Partner (N11), Fristen, Rechnungen | Ohne Freistellungsbescheinigung 15 % Bauabzugsteuer (§ 48 EStG); Generalunternehmerhaftung | Pro |

### 8. Dokumente & Fristen

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 31 | **Mail-Eingang je Firma** (eigene Adresse): Belege, Portal-Mails und Unterlagen weiterleiten, Jarvis sortiert sie ein | Alles landet an einer Stelle, ohne Hochladen. | M | Firmenunterlagen, Belege (Nr. 21), Upload-Seite | DSGVO, Virenprüfung; Mail mit Beleg aufbewahren (GoBD) | Basis |
| 32 | **Gewährleistung, Bürgschaften und Sicherheitseinbehalt** je Auftrag mit Erinnerung vor Ablauf | Einbehaltenes Geld und Bürgschaften kommen rechtzeitig zurück. | S | Laufende Aufträge (N4), Fristen | Verjährung (BGB 5 Jahre Bauwerk, VOB/B 4 Jahre); nur Erinnerung, keine Rechtsberatung | Pro |

### 9. Fuhrpark & Geräte

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 33 | **Schlüssel und Zugangscodes**: Objektschlüssel, Transponder, Alarmcodes – wer hat was seit wann, Quittung per Unterschrift, Verlust melden | In Reinigung und Sicherheit ein täglicher Ärger weniger und Schutz vor teurem Schließanlagen-Tausch. | S | Fahrzeuge & Geräte (T14), Ausgabe Schutzausrüstung (T23), Unterschrift | Codes verschlüsselt und nur für Berechtigte (DSGVO, Kundenvertrag); Haftung bei Verlust im Vertrag regeln | Basis |
| 34 | **Digitales Fahrtenbuch und Schadensmeldung mit Foto** | Weniger Steuer auf Firmenwagen, Schäden sind sauber belegt. | M | Fahrzeuge (T14), Führerscheinkontrolle (T21) | Fahrtenbuch fürs Finanzamt zeitnah und unveränderbar, sonst gilt die 1-%-Regel; keine Dauerortung ohne Rechtsgrundlage und Betriebsrat | Pro |

### 10. Qualität & Arbeitsschutz

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 35 | **Qualitätskontrolle**: Prüfliste je Objekt mit Fotos und Punkten, Ergebnis an den Kunden, Nachbesserung als Aufgabe; dazu QR-Code im Objekt für Lob und Mängel ohne Anmeldung | Weniger Reklamationen, Kunde sieht die Qualität und verlängert. | M | Checklisten (T25), Aufgaben (T13), Kundenlink, QR | An DIN EN 13549 anlehnen (Norm kostenpflichtig, nicht abschreiben); Fotos ohne Personen; QR-Meldung ohne Pflicht-Personendaten | Pro |
| 36 | **Arbeitsschutz-Mappe**: Gefährdungsbeurteilung je Tätigkeit aus Vorlagen, Gefahrstoffverzeichnis (Reinigungsmittel mit Sicherheitsdatenblatt), Betriebsanweisung, daraus Unterweisung | Pflichten sind erfüllt, bevor die Berufsgenossenschaft fragt. | M | Unterweisungen (T6, T22), Firmenunterlagen | § 5 ArbSchG, Gefahrstoffverordnung; Jarvis liefert Entwurf, Verantwortung bleibt beim Arbeitgeber; Fachkraft für Arbeitssicherheit prüfen lassen | Pro |
| 37 | **Unfall- und Vorfallmeldung im Handy**: Unfall, Beinahe-Unfall, Sicherheitsvorfall; Unfallanzeige an die BG als vorausgefüllter Entwurf | Nichts wird vergessen, Fristen werden eingehalten. | S | Handy-Nachrichten, Kurzfristiger Ausfall, Brett | Unfallanzeige binnen 3 Tagen bei mehr als 3 Tagen Arbeitsunfähigkeit (§ 193 SGB VII); Gesundheitsdaten (Art. 9 DSGVO) | Basis |
| 38 | **Bewacherregister- und Sachkunde-Check (Sicherheit)**: Planung nur mit gemeldeten Wachleuten und gültiger Sachkunde/Unterrichtung | Kein Bußgeld, kein Einsatz ohne Erlaubnis. | S | Qualifikationen mit Nachweis (T5), Schichtplan | § 34a GewO, § 11b GewO (Bewacherregister); die Meldung im Register macht die Firma selbst | Basis |

### 11. Kommunikation

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 39 | ✅ (03.11., ohne Übersetzung) **Team-Chat je Einsatz und Standort mit automatischer Übersetzung** in die Sprache der Kraft | Firmen-Infos landen nicht mehr in privaten WhatsApp-Gruppen. | M | Brett (T19), Mitarbeiter-Sprachen (T42), Handy-Nachrichten | DSGVO: Firmendaten bleiben in der Firma; Löschfristen; Übersetzung über offizielle KI-API | Basis |
| 40 | **Kunden-Portal**: Kunde sieht Stunden, Leistungsnachweise, Berichte, Rechnungen und meldet Mängel | Weniger Anrufe, Kunde fühlt sich gut betreut und bleibt. | M | Kundenlink (T40), Leistungsnachweis (T29), Rechnungen | AVV mit der Firma; Kunde sieht nur seine Objekte; keine Personaldaten außer Vornamen | Pro |

### 12. Auswertungen & Dashboards

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 41 | ✅ (03.11.2026) **Nachkalkulation je Objekt und Auftrag**: geplante gegen echte Stunden, Lohnkosten gegen Rechnung, Deckungsbeitrag | Man sieht sofort, welcher Kunde Geld kostet. | M | Kalkulation, Stundenzettel, Rechnungen, Tarife | Nur mit Finanzfreigabe | Pro |
| 42 | **Chef-Cockpit**: Kontostand in 4/8/12 Wochen (offene Rechnungen, Löhne, feste Kosten) und Wochenbericht per Mail oder Handy | Der Chef weiß jeden Montag in einer Minute, wo die Firma steht. | M | Auswertung (N6), Mahnwesen (Nr. 18), Lohnliste | Nur Planungshilfe; anonyme Branchenvergleiche ohne Preise (Kartellrecht) | Pro |

### 13. KI-Assistent

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 43 | **„Frag Jarvis“**: Fragen in normaler Sprache zu den eigenen Daten („Wer hat nächste Woche frei und einen Staplerschein?“, „Welche Rechnungen sind überfällig?“) | Antworten ohne Suchen und ohne Schulung. | L | alle Module, Rechte je Rolle, KI-Budget | Antwortet nur mit Daten, die die Person sehen darf; als KI kennzeichnen (EU-KI-Verordnung); keine Personalentscheidungen durch KI; Kosten je Frage | Pro |
| 44 | **Sprechen statt tippen**: Sprachnotiz wird Stundenzettel, Aufgabe, Mangel oder Vorfallbericht | Für Leute auf der Baustelle oder im Objekt viel schneller. | M | Stundenzettel, Aufgaben, Vorfallmeldung (Nr. 37) | Sprachaufnahme nach Umwandlung löschen; Mensch bestätigt den Eintrag | Basis |

### 14. Integrationen

Bank (Nr. 25) und E-Rechnung (Nr. 17) stehen oben.

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 45 | **Kalender**: eigene Schichten als Abo im Handy-Kalender jeder Kraft, Termine in Google oder Outlook in beide Richtungen | Jeder hat seine Termine dort, wo er ohnehin schaut. | M | Kalender-Abo der Fristen (D2), Schichtplan, eigene Termine | Geheimer Link je Person; keine Kundendaten im Termintitel | Basis |
| 46 | **WhatsApp Business (offizielle Schnittstelle)**: Schichtangebote, Erinnerungen und Kundenlinks direkt aus Jarvis, Antworten kommen zurück | Kräfte reagieren schneller als auf Mail oder App. | L | Rundnachricht, offene Schichten (T44), Kundenlink | Nur offizielle Meta-Plattform; Einwilligung der Empfänger; Kosten je Nachricht; DSGVO-Prüfung; Versand nur durch die Firma | Pro |

### 15. Mobile & Offline

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 47 | **Offline-Modus und Apps im Play Store und App Store**: Stempeln, Fotos und Berichte ohne Netz, später senden | Funktioniert auch im Keller, in der Tiefgarage und auf dem Land. | M | Handy-App (Service Worker), Stempeluhr, Play-Store-Plan (Phase 3) | Gerätezeit und Serverzeit beide speichern und Abweichung zeigen (Schutz vor Manipulation); Datenschutzangaben in den Stores | Basis |

### 16. Internationalisierung

| Nr | Idee | Nutzen für die Firma | Aufwand | baut auf | Rechtliche Hinweise | Abo |
|---|---|---|---|---|---|---|
| 48 | **Länderpaket**: Feiertage und Zuschläge je Land und Kanton, Währung (CHF, PLN, USD), Steuersätze, Rechnungspflichten je Land, Oberfläche auch auf Italienisch | Jarvis passt in jedem Zielland ohne Umbau. | L | Zuschläge (T30), Rechnungen, Sprachdateien | E-Rechnung: FR Empfang seit 09/2026, Ausstellen für KMU ab 09/2027 über zugelassene Plattform; PL KSeF seit 2026 gestaffelt; IT über SdI seit 2019; ES Verifactu ab 2027; AT/CH ohne B2B-Pflicht. Stand vor dem Bau jeweils neu prüfen | Pro |
| 49 | **Entsende-Assistent**: Einsatz im Ausland mit Liste der Pflichten (A1-Bescheinigung, Meldung in AT, CH oder FR), Fristen und Mindestlohn vor Ort | Einsätze über die Grenze ohne Bußgeld. | M | Einsatzplan, Personalfristen, Tarifdatenbank | A1 nach EU-Verordnung 883/2004; Meldungen AT (ZKO), CH (Meldeverfahren, meist 8 Tage vorher), FR (SIPSI); nur Checkliste, Meldung macht die Firma | Pro |
| 50 | **US-Paket**: Lohnsätze für Bundesaufträge (Service Contract Act / Davis-Bacon) aus SAM.gov, Certified Payroll (WH-347), W-9 und 1099 für Subunternehmer | US-Firmen können Bundesaufträge sauber abrechnen. | L | SAM.gov-Anbindung, „Darf ich bieten?“-Ampel, Lohnliste | Nur öffentliche SAM.gov-API; Steuerformulare nur vorbereiten; Sales Tax je Bundesstaat verschieden | Pro |

## Top 10 als Nächstes

Reihenfolge nach Nutzen zu Aufwand und nach Umsatzchance.

1. ✅ **E-Rechnung (Nr. 17)** – gebaut 03.11.2026 (XRechnung-Download, KoSIT-geprüft): Pflicht ab 2027/2028 für jede Firma, das ist der stärkste Grund, für Jarvis zu bezahlen.
2. ✅ **Zahlungsstatus und Mahnwesen (Nr. 18)** – gebaut 03.11.2026 (Status offen/überfällig/bezahlt, Summen, Mahnschreiben in 3 Stufen): Rechnungen gibt es schon, mit wenig Arbeit bringt Jarvis der Firma direkt Geld.
3. ✅ **Wiederkehrende Rechnungen (Nr. 19)** – gebaut 03.11.2026 (Vorlagen je Kunde, einmal pro Monat als Entwürfe): kleiner Aufwand und für Reinigung und Sicherheit jeden Monat spürbar.
4. ✅ **Lohn-Export für DATEV (Nr. 3)** – gebaut 03.11.2026 (LODAS-ASCII-Bewegungsdaten mit den Lohnarten des Lohnbüros, eingetragen unter Belege → DATEV-Einstellungen): Die Lohnliste ist schon da, es fehlt nur das passende Format, und das Lohnbüro spart jeden Monat Stunden.
5. ✅ **DATEV-Export und Steuerberater-Zugang (Nr. 22)** – gebaut 03.11.2026 (Buchungsstapel EXTF 700 mit Rechnungen und Belegen, SKR03/04-Kontenvorschlag; Steuerbüro als kostenloser Leser mit Finanzfreigabe, nur ansehen und herunterladen): Jede kleine Firma hat einen Steuerberater, und der empfiehlt Jarvis weiter, wenn die Daten sauber kommen.
6. ✅ **Belege per Foto (Nr. 21)** – gebaut 03.11.2026 (Foto/PDF erfassen, Summen je Kategorie und Steuersatz, CSV für die Steuerberatung; KI-Auslesen kommt erst mit Kosten-OK): Die Spesen mit Belegfoto gibt es schon, und damit wird Jarvis zum täglichen Werkzeug im Büro.
7. ✅ **Bietergemeinschaft finden (Nr. 28)** – gebaut 03.11.2026 (Vorschläge aus den eigenen Partnern je Gewerk, Bietergemeinschaftserklärung als Word, Hinweis § 1 GWB; Partner aus fremden Firmen erst mit der Börse): baut direkt auf dem Ausschreibungs-Kern auf und bringt Provision über den Erfolg-Plan.
8. ✅ **Kontrollrundgang und Wachbuch (Nr. 11)** – gebaut 03.11.2026 (QR-Kontrollpunkte, Scan per Handy-Kamera, Wachbuch): Sicherheitsfirmen zahlen dafür heute extra, QR und Stempeluhr sind schon da.
9. ✅ **Kunden-Portal (Nr. 40)** – gebaut 03.11.2026 (geheimer Link je Kunde: Leistungsnachweise als Summen, Rechnungen und Kontrollgänge zuschaltbar, Mängel melden mit Handy-Nachricht): Der Kundenlink steht schon, das Portal bindet Kunden und unterscheidet Jarvis von reinen Planungs-Apps.
10. 🔒 **Auftragsbörse unter Firmen (Nr. 26)** – gebaut 03.11.2026, aber **abgeschaltet** (`BOERSE_AKTIV = false` in `web/src/boerse.ts`) bis zur anwaltlichen Prüfung der Nutzungsbedingungen und Benjamins OK (Aufträge einstellen, Interesse, Kontakt erst nach Annahme, Meldeweg): Der Aufwand ist groß, aber jede neue Firma macht die Börse wertvoller, und die Provision läuft über den Erfolg-Plan.

Vorschlag zur Reihenfolge beim Bauen: zuerst die Geld-Strecke (Nr. 17, 18, 19), dann die Steuerberater-Strecke (Nr. 3, 22, 21), danach die Branchen-Extras (Nr. 11, 40) und zuletzt die Firmen-Netzwerke (Nr. 28, 26). Vor der Börse sollten die Rechtstexte (AGB, Plattformpflichten) anwaltlich geprüft sein.
