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
  assert.deepEqual(fehlendFuerXRechnung({ ...a, email: "" }, null), ["E-Mail der Firma", "Telefon der Firma (Pflichtangabe der XRechnung)", "Kunde"]);
});

test("XRechnung: Länder, Empfangsadresse (BT-49), USt-IdNr. des Kunden (BT-48), keine Platzhalter", () => {
  const voll = { ...a, telefon: "02451 1", land: "DE" };
  const wien = { ...k, strasse: "Ring 5", plz: "1010", ort: "Wien", land: "AT", email: "re@wien.example", ustid: "ATU12345678" } as Kunde;
  const xml = xrechnungXml(r, wien, voll);
  assert.match(xml, /<cbc:CityName>Wien<\/cbc:CityName><cbc:PostalZone>1010<\/cbc:PostalZone><cac:Country><cbc:IdentificationCode>AT</);
  assert.match(xml, /<cbc:CityName>Übach<\/cbc:CityName><cbc:PostalZone>52531<\/cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</);
  assert.match(xml, /<cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="EM">re@wien\.example</);
  assert.match(xml, /<cbc:CompanyID>ATU12345678<\/cbc:CompanyID>/, "BT-48 auch ohne § 13b");
  assert.doesNotMatch(xml, /nicht angegeben/);
  assert.match(xrechnungXml(r, wien, voll, "05334-1-2"), /<cbc:EndpointID schemeID="0204">05334-1-2<\/cbc:EndpointID>/, "öffentliche Auftraggeber: Leitweg-ID");
  assert.deepEqual(fehlendFuerXRechnung(voll, wien), []);
  assert.deepEqual(fehlendFuerXRechnung(voll, { ...wien, email: "" }), ["E-Mail oder Leitweg-ID des Kunden (Empfangsadresse der E-Rechnung)"]);
  assert.deepEqual(fehlendFuerXRechnung(voll, { ...wien, email: "" }, "05334-1-2"), []);
  assert.deepEqual(fehlendFuerXRechnung({ ...voll, ustid: "123456789" }, { ...wien, ustid: "12345" }), ["USt-IdNr. der Firma mit Ländercode (z. B. DE123456789)", "USt-IdNr. des Kunden mit Ländercode"]);
});

test("XRechnung: Stornorechnung als Gutschrift 381 mit Bezug und positiven Beträgen", () => {
  const storno: Rechnung = { ...r, nummer: "RE-2026-0008", art: "storno", bezug_nummer: "RE-2026-0007", netto: -1000, ust_betrag: -190,
    positionen: r.positionen.map((p) => ({ ...p, menge: -p.menge, betrag: -p.betrag })) };
  const xml = xrechnungXml(storno, k, { ...a, telefon: "1" });
  assert.match(xml, /<cbc:InvoiceTypeCode>381<\/cbc:InvoiceTypeCode>/);
  assert.match(xml, /<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>RE-2026-0007<\/cbc:ID>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">1190\.00</);
  assert.match(xml, /<cbc:InvoicedQuantity unitCode="HUR">40</);
  assert.doesNotMatch(xml, />-\d/, "keine negativen Beträge");
  assert.doesNotMatch(xml, /DueDate/);
  assert.match(xrechnungXml(r, k, a), /<cbc:InvoiceTypeCode>380</);
});
