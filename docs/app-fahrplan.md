# Fahrplan: Jarvis-App bis zur Vorführung bei PerLease

Stand 30.10.2026. Ziel: Ein neuer Kunde kommt ohne Erklärung zurecht.

## Schon da
- Anmelden per Link (ohne Passwort), Mails über kontakt@wpdigitalranger.com
- Firma, Bereiche (Regionen/Standorte), Rollen, Einladungen per Mail
- Tägliche Treffer mit KI-Punkten, Frist, Stand, Filter nach Region, Umschalter zwischen Firmen
- Steckbrief aus Unterlagen, Kalkulation (auf der Upload-Seite)
- Vorschau „PerLease (Vorschau)“ mit 16 Standorten; Filter zeigt auch untergeordnete Standorte
- Mitarbeiter-Funktionen, Bereichsrechte, Finanzfreigaben und gezielte Textweitergabe mit Vorschau/Widerruf
- Firmenunterlagen und Angebotsvorlagen; Angebotsmappen mit Chef-Freigabe, Ablauf-Erinnerungen und Abgabenachweis
- Am Treffer: Direktlink zu den Unterlagen beim Portal und „Hochladen und prüfen“ (ohne Zugangscode); der Steckbrief aus den Unterlagen erscheint direkt am Treffer
- Kurz-Steckbrief aus der vollständigen Bekanntmachung (eForms) mit Fristen und Eignungskriterien, soweit veröffentlicht

## Vorschlag, was noch fehlt (Reihenfolge = Vorschlag)

### A. Pflicht, bevor ein Kunde es sieht
1. **Rechtliches**: Entwürfe online seit 30.10. (/impressum, /datenschutz, /nutzungsbedingungen, /avv; Daten in web/src/rechtliches.ts `FIRMA`). Daten eingetragen; Benjamin prüft die Texte.
2. ~~Startseite/Erklärseite~~ (erledigt 30.10.: 3 Schritte, Beispiel-Steckbrief zum Aufklappen).
3. **Aussehen**: einheitliches Design mit Logo WP Digital Ranger, gut am Handy.

### B. Einfacher für Neue
4. ~~Einrichtungs-Assistent~~ (erledigt 30.10.: /konto/einrichtung; Profil in suchprofile.einstellungen, der Alarm liest es über alarm/profile_db.py; ein gespeichertes Profil ersetzt das aus profile.json).
5. ~~Suchprofile in der App ändern~~ (über „Suchprofil anpassen“; offen: Mindestpunkte, Profile pro Standort).
6. **Hilfetexte** an jeder Stelle („Was heißt Bearbeiter?“, „Was ist ein Steckbrief?“).
7. ~~Tägliche Mail~~ (erledigt 30.10.: Uhrzeit 7–20 Uhr pro Person, alarm/mail.py stündlich über .github/workflows/mail.yml). Erste Trefferliste sofort nach der Einrichtung (letzte 7 Tage), braucht Secret ACTIONS_TOKEN. Handy-Nachrichten (Web-Push ohne Inhalt, alarm/push.py; Tipp öffnet die Ausschreibung), Jarvis lässt sich als App installieren (manifest).

### C. Arbeiten mit Ausschreibungen
8. ~~Unterlagen am Treffer hochladen~~ (erledigt 30.10.). Später: Portal-Mails an Jarvis weiterleiten (braucht Mail-Empfang).
9. **Zuständige Person** zuweisen (offen). ~~Fristen-Erinnerung~~ 7 und 2 Tage vorher steht in der täglichen Mail.
10. **Kalkulationsvorlagen** pro Standort (Löhne je Stadt).
11. **Mitarbeiterliste**: Namen, Funktion, Rechte und Bereiche ändern umgesetzt; Sperren/Austritt als eigener Ablauf noch offen.

### D. Später
12. Abrechnung (Stripe, pro Nutzer), Paketwahl.
13. **Angebotsmappe umgesetzt**: Ausgangsentwurf mit Angebotspreis, eigene Word-/Textvorlagen, ausgewählte Nachweise, Chef-Freigabe und ZIP-Export. Ablauf-Erinnerungen und Eingangsbeleg nach manueller Portalabgabe ergänzt. Später: weitere Automatisierung und erlaubte Portal-Schnittstellen.
14. Mehr Quellen (weitere Vergabeportale nach Freigabe).
