# Auftrag an den Browser-Chat: Stripe für Crewtender einrichten (Testmodus) (07.11.2026)

Ziel: Automatische Abos für Crewtender (Karte, SEPA-Lastschrift, Apple/Google Pay). Erst **nur Testmodus**, kein echtes Geld.
Produkte, Preise und Webhooks legt Claude Code später per Schnittstelle an; hier nur Konto und Einstellungen.

## Regeln
- Nur Crewtender. Nichts an RestockHero oder Demopin. Kein bestehendes Stripe-Konto anderer Projekte verwenden.
- Anmelde-E-Mail: **kontakt@wpdigitalranger.com**.
- **Passwort, Bestätigungsmail, Bankverbindung, Ausweis, Steuerdaten und API-Schlüssel macht Benjamin selbst.** Den geheimen Schlüssel
  (`sk_…`) nicht kopieren, nicht anzeigen lassen, nicht irgendwo eintragen.
- Nichts kaufen, keinen kostenpflichtigen Zusatz (z. B. Stripe Tax, Radar for Fraud Teams) einschalten. Den Livebetrieb nicht freischalten.

## 1. Konto anlegen
1. https://dashboard.stripe.com/register → E-Mail kontakt@wpdigitalranger.com, Name „Benjamin Schiffer“, Land **Deutschland** →
   Passwort tippt Benjamin → „Konto erstellen“. Bestätigungsmail klickt Benjamin.
2. Falls nach dem Firmennamen gefragt wird: Kontoname **„Crewtender“** (Firma: WP Digital Ranger, Einzelunternehmen).
3. Fragen zum Aktivieren des Livebetriebs (Bank, Ausweis, Steuer) **überspringen** („Später“ / „Skip for now“).

## 2. Testmodus
Oben rechts **Testmodus / „Test mode“** einschalten und für alle folgenden Schritte anlassen.

## 3. Einstellungen (alles im Testmodus)
1. **Öffentliche Angaben:** https://dashboard.stripe.com/settings/public → Name „Crewtender“, Website https://crewtender.eu,
   Support-E-Mail kontakt@wpdigitalranger.com (Telefon leer lassen) → „Speichern“.
2. **Branding:** https://dashboard.stripe.com/settings/branding → Logo/Icon: https://github.com/Twista-hub/jarvis/raw/main/docs/design/crewtender/profil.png,
   Markenfarbe #1f6feb → „Speichern“.
3. **Rechnungen:** https://dashboard.stripe.com/settings/billing/invoice → Standard-Fußzeile:
   „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. WP Digital Ranger, Benjamin Schiffer, Rochusstraße 19, 52531 Übach-Palenberg. USt-IdNr. DE466249844.“
   → „Speichern“. Rechnungs-PDFs und E-Mails an Kunden **einschalten**, falls es einen Schalter gibt.
4. **Kunden-E-Mails:** https://dashboard.stripe.com/settings/emails → „Erfolgreiche Zahlungen“ und „Erstattungen“ an Kunden schicken: **an**.
5. **Fehlgeschlagene Zahlungen:** https://dashboard.stripe.com/settings/billing/automatic → Intelligente Wiederholungen („Smart Retries“) **an**;
   wenn alle Versuche fehlschlagen: **Abo kündigen**. E-Mail an Kunden bei fehlgeschlagener Zahlung **an**.
6. **Zahlungsmethoden:** https://dashboard.stripe.com/test/settings/payment_methods → **Karten**, **SEPA-Lastschrift**, **Apple Pay**, **Google Pay** an.
   Andere kostenlose lokale Methoden dürfen aus bleiben. Nichts Kostenpflichtiges.
7. **Kundenportal:** https://dashboard.stripe.com/test/settings/billing/portal → „Aktivieren“; erlauben: Zahlungsmethode ändern,
   Rechnungsadresse ändern, Rechnungen ansehen, **Abo kündigen (zum Ende des Zeitraums)**; Planwechsel **nicht** erlauben (macht die App).
   Link zu Nutzungsbedingungen: https://crewtender.eu/nutzungsbedingungen, Datenschutz: https://crewtender.eu/datenschutz → „Speichern“.

## 4. Schlüssel (macht Benjamin)
https://dashboard.stripe.com/test/apikeys öffnen und Benjamin sagen: „Hier beim **Secret key** auf **Reveal test key** klicken, den Wert
(beginnt mit `sk_test_`) kopieren und unter https://github.com/Twista-hub/jarvis/settings/secrets/actions → „New repository secret“,
Name `STRIPE_SECRET_KEY` eintragen.“ Selbst nichts kopieren.

## 5. Rückmeldung
https://github.com/Twista-hub/jarvis/edit/main/docs/browser/protokoll.md → oben Eintrag „07.11.2026 – Browser-Chat: Stripe (Test)“:
Kontoname, was eingestellt ist (Abschnitt 3, je Punkt erledigt/nicht möglich), Kunden-Portal aktiv?, ob Benjamin den Schlüssel als Secret
eingetragen hat (nur ja/nein, **kein Schlüssel**) → „Commit changes…“.
