# Auftrag an den Browser-Chat: Mails von kontakt@wpdigitalranger.com in Kopie an das verbundene Gmail

Stand 06.11.2026 (Claude Code). Ziel: Claude kann Crewtender-Mails lesen. kontakt@wpdigitalranger.com ist ein Namecheap-Private-Email-
Postfach; mit Claude verbunden ist nur das Gmail restockhero.contact@gmail.com. Benjamin hat entschieden, ein Konto für alle Projekte
zu nutzen. Die Originale bleiben in kontakt@, in Gmail bekommen die Kopien das Label „Crewtender“.

## Regeln
- Neuer Tab. Passwort, Codes und Bestätigungen macht Benjamin. Nichts löschen, keine bestehenden Regeln oder Weiterleitungen ändern,
  keine Mails verschicken.
- **Immer „Kopie behalten“** einschalten, damit alles auch in kontakt@ bleibt.

## 1. Weiterleitung in Namecheap Private Email
1. https://privateemail.com öffnen, als kontakt@wpdigitalranger.com anmelden (Benjamin).
2. Oben rechts das Zahnrad → „Settings“ / „Einstellungen“ → „Mail“ → „Auto forward“ / „Automatische Weiterleitung“.
3. Einschalten, Adresse: `restockhero.contact@gmail.com`, Haken **„Keep a copy of the message“ / „Kopie der Nachricht behalten“** setzen → „Apply“ / „Save“.
4. Gibt es „Auto forward“ dort nicht: „Mail“ → „Rules“ / „Filterregeln“ → neue Regel „Alle Nachrichten“ → Aktion „Weiterleiten an“
   `restockhero.contact@gmail.com` (**nicht** „Umleiten“/„Verschieben“) → speichern.

## 2. Label in Gmail
1. https://mail.google.com/mail/u/0/#settings/filters (Konto restockhero.contact@gmail.com) → „Neuen Filter erstellen“.
2. Feld „An“: `kontakt@wpdigitalranger.com OR hello@crewtender.eu` → „Filter erstellen“.
3. „Label anwenden“ → „Neues Label“ → `Crewtender` → Haken bei „Filter auch auf … übereinstimmende Unterhaltungen anwenden“ → „Filter erstellen“.

## 3. Test
Benjamin schickt von seinem Handy eine kurze Mail an kontakt@wpdigitalranger.com („Test Weiterleitung“). Prüfen: Sie liegt in kontakt@ **und**
in Gmail mit Label „Crewtender“.

## Rückmeldung
https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → oben Eintrag „06.11.2026 – Browser-Chat: Mail-Weiterleitung“
(was eingestellt, Test ok?) → „Commit changes…“. Keine Passwörter.
