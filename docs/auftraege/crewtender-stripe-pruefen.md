# Auftrag an den Browser-Chat: Stripe prüfen (09.11.2026)

Nur nachsehen und berichten. Nichts bezahlen, keine Schlüssel ansehen oder kopieren, keine Produkte, Preise oder Webhooks ändern.
Stripe ist im Chrome-Hauptprofil angemeldet (Konto „Crewtender“, Login kontakt@wpdigitalranger.com).

1. **Livebetrieb:** https://dashboard.stripe.com öffnen. Oben links Konto „Crewtender“ wählen. Prüfen, dass **kein** Hinweis
   „Testmodus“ / „Sandbox“ angezeigt wird. Falls doch: oben rechts den Schalter „Testmodus“ ausschalten.
2. **Rechnungs-Fußzeile:** https://dashboard.stripe.com/settings/billing/invoice öffnen → Abschnitt „Standard-Fußzeile“
   (englisch „Default footer“). Dort muss stehen (Wortlaut darf leicht abweichen):
   „Kleinunternehmer gemäß § 19 UStG, es wird keine Umsatzsteuer berechnet. WP Digital Ranger, Benjamin Schiffer,
   Rochusstraße 19, 52531 Übach-Palenberg · USt-IdNr. DE466249844“
   - Fehlt etwas: genau diesen Text eintragen → „Speichern“ → Seite neu laden und prüfen.
   - Auf derselben Seite: Sind Steuersätze („Tax rates“) hinterlegt? Es dürfen **keine** sein. Nur berichten, nichts löschen.
3. **Zahlungsmethoden:** https://dashboard.stripe.com/settings/payment_methods → aufschreiben, was „An“ ist
   (Karten, Apple Pay, Google Pay, SEPA-Lastschrift) und ob bei SEPA ein Hinweis wie „Verifizierung erforderlich“ steht.
4. **Offene Aufgaben:** https://dashboard.stripe.com/dashboard → Kasten „Aufgaben“ / „Action required“ oben.
   Alle offenen Punkte wörtlich notieren. **Bei Ausweis, Selfie oder Bankdaten anhalten** – das macht Benjamin selbst.
   Den direkten Link zu diesem Schritt notieren, damit Benjamin ihn öffnen kann.
5. **Rückmeldung** in `docs/browser/protokoll.md` („## Erledigt (Datum) – Stripe geprüft“): Livebetrieb ja/nein,
   Fußzeile (Wortlaut), Steuersätze, Zahlungsmethoden, offene Aufgaben mit Link. Keine Passwörter, keine Schlüssel.
