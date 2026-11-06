# Auftrag an den Browser-Chat: Anthropic-Guthaben prüfen und Max-Guthaben verknüpfen (06.11.2026)

Hintergrund: Das API-Guthaben der Crewtender/Jarvis-Organisation ist leer (API meldet „credit balance is too low“, seit
06.11. ca. 10:25). Benjamin hat seit 31.10. Claude Max; damit gibt es monatlich API-Guthaben, sobald die Console-Organisation
in claude.ai verknüpft ist (laut Hinweis frühestens 7 Tage nach dem Wechsel, also ab ca. 07./08.11.).

## Regeln
- Nichts kaufen, keine Zahlungsdaten, kein „Buy credits“, kein Abo ändern. Anmeldungen, Passwörter, Codes macht Benjamin.
- Nur die Jarvis/Crewtender-Organisation. **Nie RestockHero** (Konto restockhero.contact@gmail.com bzw. dessen Organisation).
- Die Verknüpfung in claude.ai ist **nicht änderbar**: Vor dem letzten Klick Benjamin den Organisationsnamen zeigen und sein OK abwarten.

## 1. Console: Stand ansehen
1. https://console.anthropic.com/settings/billing öffnen (anmelden macht Benjamin).
2. Oben links die Organisation prüfen. Richtig ist die, in der der Jarvis-Schlüssel liegt:
   https://console.anthropic.com/settings/keys → Schlüssel mit „jarvis“ oder „crewtender“ im Namen. Den **Organisationsnamen** notieren.
   Gibt es mehrere Organisationen und keine eindeutige: abbrechen und Benjamin fragen.
3. Auf der Billing-Seite notieren: „Credit balance“, ob es „Promotional credits“ gibt (Betrag, Ablaufdatum).
4. https://console.anthropic.com/settings/limits → „Monthly spend limit“ notieren (nicht ändern).

## 2. claude.ai: Max-Guthaben verknüpfen
1. https://claude.ai/settings/billing öffnen (Benjamins Max-Konto).
2. Nach einem Bereich wie „Link organization“ / „Organisation verknüpfen“ / „API credits“ suchen.
   - Nicht vorhanden → nur Screenshot-Beschreibung notieren („noch nicht verfügbar“), fertig.
   - Vorhanden → die Organisation aus Schritt 1.2 auswählen, **Benjamin den Namen zeigen**, nach seinem OK bestätigen.
3. Danach in der Console (Schritt 1.3) prüfen, ob „Promotional credits“ erscheinen.

## 3. Rückmeldung
https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → oben Eintrag
„06.11.2026 – Browser-Chat: Anthropic-Guthaben“ mit: Organisationsname, Credit balance, Promotional credits (Betrag/Ablauf),
Monthly spend limit, ob die Verknüpfung möglich war und erledigt ist → „Commit changes…“. Keine Schlüssel, keine Passwörter.
