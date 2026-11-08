# Auftrag an den Browser-Chat: Stripe-Einstellungen für den Livebetrieb (08.11.2026)

Benjamins OK liegt vor (Chat 08.11.2026). Stripe-Konto „Crewtender“ (Anmeldung kontakt@wpdigitalranger.com), Livebetrieb ist seit 07.11. freigeschaltet.
Alle Schritte mit **ausgeschaltetem Testmodus** (oben rechts „Testmodus“ aus). Ist eine Einstellung schon richtig, nur bestätigen.

## Regeln
- Nur Crewtender. Nichts an RestockHero oder Demopin.
- API-Schlüssel (sk_…, rk_…) nicht anzeigen, nicht kopieren, nicht erstellen. Passwort, Zwei-Faktor-Codes, Bank und Ausweis macht Benjamin.
- Nichts kaufen, keinen kostenpflichtigen Zusatz einschalten (z. B. Stripe Tax, Radar for Fraud Teams, Revenue Recovery-Zusatzpakete).
- Keine Produkte, Preise, Webhooks oder Abos anlegen oder ändern (macht Claude Code per Schnittstelle).

## 1. Öffentliche Angaben
https://dashboard.stripe.com/settings/public
- Öffentlicher Unternehmensname: Crewtender
- Support-E-Mail: hello@crewtender.eu
- Website: https://crewtender.eu
- Telefon leer lassen → „Speichern“

## 2. Branding
https://dashboard.stripe.com/settings/branding
- Icon/Logo: https://github.com/Twista-hub/jarvis/raw/main/docs/design/crewtender/profil.png
  (Repo privat: im Browser bei GitHub angemeldet sein, sonst Benjamin um die Datei bitten)
- Markenfarbe #1f6feb → „Speichern“

## 3. Rechnungs-Fußzeile
https://dashboard.stripe.com/settings/billing/invoice
- Standard-Fußzeile (Default footer):
  Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. WP Digital Ranger, Benjamin Schiffer, Rochusstraße 19, 52531 Übach-Palenberg · USt-IdNr. DE466249844
- Keine Steuersätze anlegen. → „Speichern“

## 4. Zahlungsbelege an Kunden
https://dashboard.stripe.com/settings/emails
- „Erfolgreiche Zahlungen“ (Successful payments): an
- „Rückerstattungen“ (Refunds): an → „Speichern“

## 5. Abo-Mails an Kunden
https://dashboard.stripe.com/settings/billing/automatic
- Abgeschlossene Rechnungen und Gutschriften an Kunden senden (Send finalized invoices and credit notes): an
- Erinnerung vor Verlängerung (Upcoming renewal reminders): an (falls wählbar: 7 Tage vorher)
- Mails bei fehlgeschlagenen Zahlungen (Failed payments / Smart Retries-Mails): an
- Mails bei ablaufenden Karten (Expiring cards): an
- Nur die kostenlosen Schalter. Falls etwas einen Aufpreis anzeigt: aus lassen und in der Rückmeldung nennen. → „Speichern“

## 6. Rückmeldung
In docs/browser/protokoll.md (oder als Kopiertext an Benjamin): „## Erledigt (Datum)“ mit jedem Punkt 1–5:
war schon richtig / geändert / ging nicht (warum). Keine Schlüssel, Passwörter oder Codes.
