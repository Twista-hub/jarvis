import test from "node:test";
import assert from "node:assert/strict";
import { bank, fehlendFuerXRechnung, xrechnungXml } from "../src/xrechnung.ts";
import type { Absender, Rechnung } from "../src/rechnungen.ts";
import type { Kunde } from "../src/kunden.ts";

const r: Rechnung = { id: "x", kunde_id: "k", nummer: "RE-2026-0007", monat: "2026-02", datum: "2026-03-02", netto: 1000, ust_satz: 19, erstellt: "",
  positionen: [{ text: "Reinigung <Schule> & Halle", menge: 40, einheit: "Std.", preis: 25, betrag: 1000 }] };
const k = { id: "k", name: "Stadt X", strasse: "Markt 1", plz: "52062", ort: "Aachen", email: "", notiz: "" } as unknown as Kunde;
const a: Absender = { name: "Muster GmbH", strasse: "Weg 1", plz: "52531", ort: "Übach", telefon: "", email: "b@muster.example", steuernummer: "", ustid: "DE123456789", kleinunternehmer: false, zahlungshinweis: "IBAN DE89 3704 0044 0532 0130 00 BIC COBADEFFXXX" };

test("XRechnung: Pflichtfelder, Beträge, Zeitraum, Bank, Escaping", () => {
  const xml = xrechnungXml(r, k, a, "05334-1-2");
  assert.match(xml, /urn:xeinkauf\.de:kosit:xrechnung_3\.0/);
  assert.match(xml, /<cbc:BuyerReference>05334-1-2<\/cbc:BuyerReference>/);
  assert.match(xml, /<cbc:StartDate>2026-02-01<\/cbc:StartDate><cbc:EndDate>2026-02-28<\/cbc:EndDate>/);
  assert.match(xml, /<cbc:TaxAmount currencyID="EUR">190\.00<\/cbc:TaxAmount>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">1190\.00<\/cbc:PayableAmount>/);
  assert.match(xml, /<cbc:PaymentMeansCode>58<\/cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>DE89370400440532013000<\/cbc:ID>/);
  assert.match(xml, /unitCode="HUR">40</);
  assert.match(xml, /Reinigung &lt;Schule&gt; &amp; Halle/);
  assert.match(xml, /<cbc:DueDate>2026-03-16<\/cbc:DueDate>/);
  const klein = xrechnungXml(r, k, { ...a, ustid: "", steuernummer: "203/1/2", kleinunternehmer: true, zahlungshinweis: "" });
  assert.match(klein, /<cbc:ID>E<\/cbc:ID><cbc:Percent>0\.00<\/cbc:Percent><cbc:TaxExemptionReason>/);
  assert.match(klein, /<cbc:PayableAmount currencyID="EUR">1000\.00</);
  assert.match(klein, /<cbc:ID>FC<\/cbc:ID>/);
  assert.match(klein, /<cac:PartyIdentification><cbc:ID>203\/1\/2<\/cbc:ID><\/cac:PartyIdentification>/, "BR-CO-26: Kennung ohne USt-IdNr.");
  assert.doesNotMatch(xml, /PartyIdentification/, "mit USt-IdNr. nicht nötig");
  assert.match(klein, /<cbc:PaymentMeansCode>1</);
  assert.deepEqual(bank("Konto: IBAN DE89 3704 0044 0532 0130 00"), { iban: "DE89370400440532013000" });
  assert.deepEqual(fehlendFuerXRechnung({ ...a, email: "" }, null), ["E-Mail der Firma", "Kunde"]);
});
