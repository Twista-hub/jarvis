# Auftrag an den Browser-Chat: Crewtender bei Google Play zur Prüfung einreichen (10.11.2026)

Benjamin hat entschieden (10.11.2026): **ohne internen Test direkt zur Prüfung einreichen.** Play Console ist im
Chrome-Hauptprofil angemeldet (Konto WP Digital Ranger), App „Crewtender – Aufträge & Team“ (`eu.crewtender.app`,
App-ID 4972724087261729148). Keine Passwörter eingeben. Nichts kaufen, nichts bewerben.

1. **Produktions-Release anlegen:** Test und Veröffentlichung → **Produktion** → **Neuen Release erstellen** →
   **Aus Mediathek hinzufügen** → das vorhandene App-Bundle wählen (Versionscode 1, 1.0.0, Ziel-SDK 36).
   Kein neues Bundle hochladen.
   - Release-Name: `1.0.0`
   - Versionshinweise: `<de-DE>Erste Version.</de-DE>` und `<en-US>First version.</en-US>`
   - **Weiter** → Warnungen und Fehler im Wortlaut notieren → **Speichern**.
   - Meldet die Console, dass das Bundle noch im Entwurf des internen Tests steckt: dort den Entwurf **verwerfen**
     (Interner Test → Release-Entwurf → „Release verwerfen“) und Schritt 1 wiederholen.
2. **Länder prüfen:** Produktion → Länder/Regionen: Deutschland, Österreich, Schweiz müssen ausgewählt sein.
3. **Verwaltete Veröffentlichung:** muss **aus** bleiben (die App geht nach der Freigabe von selbst online).
4. **Einreichen:** Veröffentlichungsübersicht → **Änderungen zur Überprüfung senden** → bestätigen.
   - Verlangt die Console vorher noch eine Angabe (zum Beispiel eine Erklärung oder ein fehlendes Feld): nicht raten.
     Wortlaut und Link notieren und anhalten, außer die Antwort steht eindeutig in `android/STORE.md`.
5. **Rückmeldung** in `docs/browser/protokoll.md` („## Erledigt (Datum) – Crewtender zur Prüfung eingereicht“):
   Status der Veröffentlichungsübersicht im Wortlaut (zum Beispiel „Wird überprüft“), alle Warnungen, offene Punkte
   für Benjamin mit direktem Link. Keine Passwörter, keine Schlüssel.
