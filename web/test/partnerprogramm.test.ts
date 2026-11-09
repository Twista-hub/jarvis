import { test } from "node:test";
import assert from "node:assert/strict";
import { antragPruefen, betreiberPartnerSeite, euro, freischaltMail, partnerBedingungen, partnerCode, partnerSeite, uebersichtSeite } from "../src/partnerprogramm.ts";
import { erstattungAusCharge, zahlungAusEreignis } from "../src/stripe.ts";
import { registrierFormular } from "../src/anmeldung.ts";

const K = { satz: 20, monate: 12 };

test("Partner-Code: nur Kleinbuchstaben, Ziffern und Bindestrich", () => {
  assert.equal(partnerCode("Vergabeberatung-Meier"), "vergabeberatung-meier");
  assert.equal(partnerCode(" ab "), "");
  assert.equal(partnerCode("x\"><script>"), "");
  assert.equal(partnerCode(null), "");
});

test("Partner-Antrag: Pflichtangaben und Zustimmung", () => {
  const a = { name: "Max Meier", firma: "", email: "max@meier.test", website: "", zielgruppe: "Reinigungsfirmen in NRW" };
  assert.equal(antragPruefen(a, true), "");
  assert.match(antragPruefen({ ...a, email: "kaputt" }, true), /E-Mail/);
  assert.match(antragPruefen({ ...a, zielgruppe: "kurz" }, true), /Firmen/);
  assert.match(antragPruefen(a, false), /Partnerbedingungen/);
});

test("Partnerseite und Bedingungen nennen Satz, Laufzeit und das Werbeverbot ohne Einwilligung", () => {
  assert.match(partnerSeite(K), /20 %.*12 Monaten/s);
  assert.match(partnerSeite(K, { name: "<b>" }, "Fehler"), /&lt;b&gt;|&#60;b&#62;/);
  const b = partnerBedingungen({ satz: 15, monate: 6 });
  assert.match(b, /15 %/);
  assert.match(b, /6 Monaten/);
  assert.match(b, /§ 7 UWG/);
  assert.match(b, /Bruttobetrag/);
});

test("Übersicht des Partners: Link, Zahlen, keine Firmennamen", () => {
  const html = uebersichtSeite({ name: "Beratung Meier", code: "beratung-meier", status: "aktiv", satz: 20, monate: 12, kunden: 3, zahlende: 1, offen_cent: 2360, bezahlt_cent: 0,
    monatlich: [{ monat: "2026-11", zahlungen: 2, provision_cent: 2360, offen_cent: 2360 }] });
  assert.match(html, /registrieren\?p=beratung-meier/);
  assert.match(html, /23,60 €/);
  assert.match(html, /11\.2026/);
  assert.equal(euro(118), "1,18 €");
});

test("Freischalt-Mail mit Link, Übersicht und Hinweis auf § 7 UWG", () => {
  const m = freischaltMail("max@meier.test", "Max", "beratung-meier", "a".repeat(64), K);
  assert.match(m.text, /registrieren\?p=beratung-meier/);
  assert.match(m.text, /partner\/u\/a{64}/);
  assert.match(m.text, /ohne Einwilligung/);
  assert.throws(() => freischaltMail("kaputt", "Max", "x", "y", K));
});

test("Betreiber-Seite: neuer Antrag mit Freischalten, offene Provision zum Abhaken", () => {
  const html = betreiberPartnerSeite({ einstellungen: K, partner: [
    { id: "00000000-0000-0000-0000-000000000001", name: "Max", firma: "Beratung", email: "max@meier.test", website: null, zielgruppe: "Reinigung", code: null, token: "t", status: "neu", satz: null, erstellt: "2026-11-08T10:00:00Z", freigeschaltet: null, firmen: [], umsatz_cent: 0, offen_cent: 0, bezahlt_cent: 0 },
    { id: "00000000-0000-0000-0000-000000000002", name: "Eva", firma: null, email: "eva@x.test", website: null, zielgruppe: null, code: "eva", token: "u", status: "aktiv", satz: 25, erstellt: "2026-11-01T10:00:00Z", freigeschaltet: "2026-11-02T10:00:00Z", firmen: [{ name: "Kunde GmbH", paket: "basis", seit: "2026-11-03" }], umsatz_cent: 5900, offen_cent: 1475, bezahlt_cent: 0 },
  ] });
  assert.match(html, /Freischalten und Mail schicken/);
  assert.match(html, /14,75 € als ausgezahlt abhaken/);
  assert.match(html, /eigener Satz 25 %/);
  assert.match(html, /Kunde GmbH: basis/);
});

test("Registrierung über Partner-Link: Hinweis und verstecktes Feld, nicht bei Einladungen", () => {
  const f = registrierFormular({}, "", "/konto", { code: "beratung-meier", name: "Beratung Meier" });
  assert.match(f, /Empfohlen von Beratung Meier/);
  assert.match(f, /name="partner" value="beratung-meier"/);
  assert.doesNotMatch(registrierFormular({}, "", "/einladung/abc", { code: "beratung-meier", name: "X" }), /name="partner"/);
  assert.doesNotMatch(registrierFormular({}), /name="partner"/);
});

test("Webhook: bezahlte Rechnung für die Provision lesen", () => {
  const z = zahlungAusEreignis({ id: "evt_123456789", type: "invoice.paid", data: { object: { id: "in_123456789", currency: "eur", amount_paid: 5900, customer: "cus_123456789",
    parent: { subscription_details: { metadata: { firma: "11111111-2222-3333-4444-555555555555" } } }, status_transitions: { paid_at: 1762600000 } } } });
  assert.deepEqual(z, { ereignis: "evt_123456789", rechnung: "in_123456789", kunde: "cus_123456789", firma: "11111111-2222-3333-4444-555555555555", betrag_cent: 5900, gezahlt: new Date(1762600000 * 1000).toISOString() });
  const paket = zahlungAusEreignis({ id: "evt_2", type: "invoice.paid", data: { object: { id: "in_987654321", currency: "eur", amount_paid: 1500, customer: "cus_123456789", metadata: { firma: "11111111-2222-3333-4444-555555555555" } } } });
  assert.equal(paket?.firma, "11111111-2222-3333-4444-555555555555");
  assert.equal(zahlungAusEreignis({ id: "evt_3", type: "invoice.paid", data: { object: { id: "in_987654321", currency: "usd", amount_paid: 100 } } }), null);
  assert.equal(zahlungAusEreignis({ id: "evt_4", type: "customer.subscription.updated", data: { object: {} } }), null);
});

test("Erstattung: Charge mit Rechnung oder nur Kunde, ohne Betrag nichts", () => {
  const r = erstattungAusCharge("evt_123456789", { id: "ch_123456789", currency: "eur", amount_refunded: 2000, customer: "cus_123456789", invoice: "in_123456789", created: 1762000000 });
  assert.deepEqual(r, { ereignis: "evt_123456789", zahlung: "ch_123456789", rechnung: "in_123456789", kunde: "cus_123456789", erstattet_cent: 2000, zeit: new Date(1762000000 * 1000).toISOString() });
  assert.equal(erstattungAusCharge("evt_1", { id: "ch_123456789", currency: "eur", amount_refunded: 0 }), null);
  assert.equal(erstattungAusCharge("evt_1", { id: "ch_123456789", currency: "usd", amount_refunded: 100 }), null);
  assert.equal(erstattungAusCharge("evt_1", { id: "ch_123456789", currency: "eur", amount_refunded: 100 })?.rechnung, null);
  assert.equal(erstattungAusCharge("evt_1", { id: "ch_123456789", currency: "eur", amount_refunded: 0 }, 5900)?.erstattet_cent, 5900, "Rückbuchung mit eigenem Betrag");
});
