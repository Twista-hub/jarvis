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
5. ~~Suchprofile in der App ändern~~ (über „Suchprofil anpassen“; offen: Mindestpunkte, Profile pro Standort).
6. **Hilfetexte**: einklappende Erklärungen zu den Hauptabläufen ergänzt; auf den übrigen Seiten weiterführen.
7. ~~Tägliche Mail~~ (erledigt 30.10.: Uhrzeit 7–20 Uhr pro Person, alarm/mail.py stündlich über .github/workflows/mail.yml). Erste Trefferliste sofort nach der Einrichtung (letzte 7 Tage), braucht Secret ACTIONS_TOKEN. Handy-Nachrichten (Web-Push ohne Inhalt, alarm/push.py; Tipp öffnet die Ausschreibung), Jarvis lässt sich als App installieren (manifest).

### C. Arbeiten mit Ausschreibungen
8. ~~Unterlagen am Treffer hochladen~~ (erledigt 30.10.). Später: Portal-Mails an Jarvis weiterleiten (braucht Mail-Empfang).
9. ~~Personal je Ausschreibung einplanen~~ (erledigt 30.10.: Status geplant/angefragt/zugesagt und passende Personen zuerst). Kaufmännisch Verantwortliche Person pro Ausschreibung wird unter Inhaber-/Bereichsrechten zugewiesen. ~~Fristen-Erinnerung~~ 7 und 2 Tage vorher steht in der täglichen Mail.
10. ~~**Kalkulationsvorlagen pro Standort**~~ (umgesetzt: Standort → Region → Firma; Bearbeitung und Speicherung auf `/konto/kalkulation`).
11. **Mitarbeiterliste**: Namen, Funktion, Rechte, Bereiche und firmenspezifisches Sperren/Reaktivieren umgesetzt.
12. **Berufs- und Tarifdatenbank (teilweise umgesetzt)**: Branchen, kanonische Berufe und kuratierte Ausschreibungssynonyme vorhanden; Bedarfserkennung liefert Originalfundstellen. Mindestentgelte aus Rechtsnormen sind für Dachdecker, Pflege und Gebäudereinigung ergänzt und bleiben klar von vollständigen Tarifverträgen getrennt. Offen: katalogisierte Herkunft/Stand je Berufsbezeichnung und bestätigbarer Korrekturablauf. Tarifregeln bleiben separat und müssen je Vertrag, Branche/Region und Gültigkeitszeitraum aus Originalquellen erfasst werden. Keine Vollständigkeit behaupten. Konzept/Quellen: `docs/personalkatalog.md`.

### D. Später
13. Abrechnung (Stripe, pro Nutzer), Paketwahl.
14. **Angebotsmappe umgesetzt**: Ausgangsentwurf mit Angebotspreis, eigene Word-/Textvorlagen, ausgewählte Nachweise, Chef-Freigabe und ZIP-Export. Ablauf-Erinnerungen und Eingangsbeleg nach manueller Portalabgabe ergänzt. Später: weitere Automatisierung und erlaubte Portal-Schnittstellen.
15. Mehr Quellen (weitere Vergabeportale nach Freigabe).
