# Fahrplan: Jarvis-App bis zur Vorführung bei PerLease

Stand 30.10.2026. Ziel: Ein neuer Kunde kommt ohne Erklärung zurecht.

## Schon da
- Registrierung, Anmeldung mit Passwort oder Mail-Link, Passwort-Wiederherstellung; Mails über kontakt@wpdigitalranger.com
- Firma, Bereiche (Regionen/Standorte), Rollen, Einladungen per Mail
- Tägliche Treffer mit KI-Punkten, Frist, Stand, Filter nach Region, Umschalter zwischen Firmen
- Steckbrief aus Unterlagen, Kalkulation (auf der Upload-Seite)
- Vorschau „PerLease (Vorschau)“ mit 16 Standorten; Filter zeigt auch untergeordnete Standorte
- Mitarbeiter-Funktionen, Bereichsrechte, Finanzfreigaben und gezielte Textweitergabe mit Vorschau/Widerruf
- Personalbestand pro Standort und Einplanung von Kräften je Ausschreibung mit Status
- Standortleitung mit standortbegrenzten Rechten; Betriebspersonal getrennt von App-Zugängen
- Branchenübergreifender Berufekatalog samt Synonymzuordnung bei der Bekanntmachungserkennung; erkannte Textfundstelle bleibt erhalten. Firmenqualifikationen sind filterbar in der Personalplanung.
- Zeitarbeit-Kalkulation je Los mit Entgeltgruppe und Zuschlägen
- Firmenunterlagen und Angebotsvorlagen; Angebotsmappen mit Chef-Freigabe, Ablauf-Erinnerungen und Abgabenachweis
- Am Treffer: Direktlink zu den Unterlagen beim Portal und „Hochladen und prüfen“ (ohne Zugangscode); der Steckbrief aus den Unterlagen erscheint direkt am Treffer
- Kurz-Steckbrief aus der vollständigen Bekanntmachung (eForms) mit Fristen und Eignungskriterien, soweit veröffentlicht

## Vorschlag, was noch fehlt (Reihenfolge = Vorschlag)

### A. Pflicht, bevor ein Kunde es sieht
1. **Rechtliches**: Entwürfe online seit 30.10. (/impressum, /datenschutz, /nutzungsbedingungen, /avv; Daten in web/src/rechtliches.ts `FIRMA`). Daten eingetragen; Benjamin prüft die Texte.
2. ~~Startseite/Erklärseite~~ (erledigt 30.10.: 3 Schritte, Beispiel-Steckbrief zum Aufklappen).
3. **Aussehen**: mobile Touchflächen und Kernseiten verbessert; Logo WP Digital Ranger und abschließender Designabgleich noch offen.

### B. Einfacher für Neue
4. ~~Einrichtungs-Assistent~~ (erledigt 30.10.: /konto/einrichtung; Profil in suchprofile.einstellungen, der Alarm liest es über alarm/profile_db.py; ein gespeichertes Profil ersetzt das aus profile.json).
4a. **Automatische Firmenrecherche bei Neuanmeldung:** nach E-Mail-Bestätigung erstellt Jarvis das Suchprofil aus erlaubten Website-Inhalten und bis zu drei öffentlichen Web-Suchanfragen; danach startet die erste Suche. Recherche und JSON-Aufbereitung sind getrennt und live im App-Worker nachgewiesen (31.10., zwei Suchanfragen/fünf Quellen/sechs Leistungsbereiche). Alte unvollständige Profile werden beim nächsten Öffnen des Suchprofils automatisch ergänzt. API-Gebühren bleiben im gemeinsamen Budget. Vollständiger Live-Test mit neuem Registrierungskonto separat offen.
   Ergänzt: eigener verständlicher Prüfschritt; Website für bessere Ergebnisse empfohlen. Budgetursachen hinter SDK-Verbindungsfehlern werden erklärt, unterbrochene Ersteinrichtung kann mit gespeicherten Angaben fortgesetzt werden. Eigene belegte Niederlassungen mit Quellen werden getrennt vom Suchgebiet erfasst, im Profil gezeigt und ohne doppelte Standorte in „Firma & Team“ übernommen. Für Benjamins heutigen Registrierungstest gilt vorübergehend 5 USD/UTC-Tag, ab 01.11. wieder 3 USD; Monat unverändert 20 USD.
5. ~~Suchprofile in der App ändern~~ (über „Suchprofil anpassen“; offen: Mindestpunkte, Profile pro Standort).
   Bedienung vereinfacht (31.10.): „Ausschreibungen jetzt suchen“, „Suchprofil bearbeiten“, „Firmeninfos neu recherchieren“; letzte Aktion mit Ladeanzeige, neuen Editorwerten und sichtbarem Aktualisierungszeitpunkt. Firmenfunde standardmäßig offen als Karten; Arbeiten kompakt als Kästchen, Ergänzen per Dropdown/eigener Eingabe und Detailbearbeitung bei Bedarf.
6. **Hilfetexte**: einklappende Erklärungen zu den Hauptabläufen ergänzt; auf den übrigen Seiten weiterführen.
7. ~~Tägliche Mail~~ (erledigt 30.10.: Uhrzeit 7–20 Uhr pro Person, alarm/mail.py stündlich über .github/workflows/mail.yml). Erste Trefferliste sofort nach der Einrichtung (letzte 7 Tage), braucht Secret ACTIONS_TOKEN. Handy-Nachrichten (Web-Push ohne Inhalt, alarm/push.py; Tipp öffnet die Ausschreibung), Jarvis lässt sich als App installieren (manifest).

### C. Arbeiten mit Ausschreibungen
8. ~~Unterlagen am Treffer hochladen~~ (erledigt 30.10.). Später: Portal-Mails an Jarvis weiterleiten (braucht Mail-Empfang).
9. ~~Personal je Ausschreibung einplanen~~ (erledigt 30.10.: Status geplant/angefragt/zugesagt und passende Personen zuerst). Kaufmännisch Verantwortliche Person pro Ausschreibung wird unter Inhaber-/Bereichsrechten zugewiesen. ~~Fristen-Erinnerung~~ 7 und 2 Tage vorher steht in der täglichen Mail.
10. ~~**Kalkulationsvorlagen pro Standort**~~ (umgesetzt: Standort → Region → Firma; Bearbeitung und Speicherung auf `/konto/kalkulation`).
11. **Mitarbeiterliste**: Namen, Funktion, Rechte, Bereiche und firmenspezifisches Sperren/Reaktivieren umgesetzt.
12. **Berufs- und Tarifdatenbank (teilweise umgesetzt)**: Branchen, kanonische Berufe und kuratierte Ausschreibungssynonyme vorhanden; Bedarfserkennung liefert Originalfundstellen. Gesetzliche und allgemeinverbindliche Mindestentgelte sind für Dachdecker, Pflege, Gebäudereinigung, Gerüstbau, pädagogische Aus-/Weiterbildung, Luftsicherheit an Flughäfen, Elektrohandwerk und Flughafenbodenabfertigung ergänzt. Der allgemeine Mindestlohn und die gesetzliche AÜ-Untergrenze sind separat gekennzeichnet. Alle bleiben klar von vollständigen Tarifverträgen getrennt. Offen: katalogisierte Herkunft/Stand je Berufsbezeichnung und bestätigbarer Korrekturablauf. Tarifregeln bleiben separat und müssen je Vertrag, Branche/Region und Gültigkeitszeitraum aus Originalquellen erfasst werden. Keine Vollständigkeit behaupten. Konzept/Quellen: `docs/personalkatalog.md`.

### D. Später
13. Abrechnung (Stripe, pro Nutzer), Paketwahl.
14. **Angebotsmappe umgesetzt**: Ausgangsentwurf mit Angebotspreis, eigene Word-/Textvorlagen, ausgewählte Nachweise, Chef-Freigabe und ZIP-Export. Ablauf-Erinnerungen und Eingangsbeleg nach manueller Portalabgabe ergänzt. Später: weitere Automatisierung und erlaubte Portal-Schnittstellen.
15. Mehr Quellen (weitere Vergabeportale nach Freigabe).
