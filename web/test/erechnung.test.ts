import test from "node:test";
import assert from "node:assert/strict";
import { belegWerte, eRechnungLesen, istXml, xmlLesen } from "../src/erechnung.ts";
import { belegeSeite, dateiTyp, eRechnungAnsicht } from "../src/belege.ts";

const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>RE-2026-0042</cbc:ID>
  <cbc:IssueDate>2026-11-02</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Würth</cbc:Name></cac:PartyName>
    <cac:PartyTaxScheme><cbc:CompanyID>DE123456789</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>Adolf Würth GmbH &amp; Co. KG</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">20.70</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">24.30</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">1.70</cbc:TaxAmount><cac:TaxCategory><cbc:ID>AA</cbc:ID><cbc:Percent>7</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">124.30</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">124.30</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">145.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">145.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">4</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Schrauben &#60;M8&#62;</cbc:Name></cac:Item></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">24.30</cbc:LineExtensionAmount><cac:Item><cbc:Name><![CDATA[Fachbuch "Dübel"]]></cbc:Name></cac:Item></cac:InvoiceLine>
</ubl:Invoice>`;

const CII = `﻿<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument><ram:ID>2026-777</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">20261030</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:SpecifiedTradeProduct><ram:Name>Gerüstmiete Oktober</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="MON">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>500.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Gerüstbau Muster GmbH</ram:Name>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">201/123/45678</ram:ID></ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE987654321</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>95.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>500.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19.00</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>500.00</ram:LineTotalAmount><ram:TaxBasisTotalAmount>500.00</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">95.00</ram:TaxTotalAmount><ram:GrandTotalAmount>595.00</ram:GrandTotalAmount><ram:DuePayableAmount>595.00</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

test("E-Rechnung: XRechnung in UBL mit 19 % und 7 %", () => {
  const r = eRechnungLesen(UBL)!;
  assert.equal(r.format, "UBL");
  assert.equal(r.art, "rechnung");
  assert.deepEqual([r.nummer, r.datum, r.lieferant, r.ustId, r.waehrung, r.brutto, r.netto], ["RE-2026-0042", "2026-11-02", "Adolf Würth GmbH & Co. KG", "DE123456789", "EUR", 145, 124.3]);
  assert.deepEqual(r.steuern, [{ satz: 19, netto: 100, steuer: 19 }, { satz: 7, netto: 24.3, steuer: 1.7 }]);
  assert.deepEqual(r.posten, [{ name: "Schrauben <M8>", menge: "4 C62", netto: 100 }, { name: 'Fachbuch "Dübel"', menge: "1 C62", netto: 24.3 }]);
  const w = belegWerte(r);
  assert.deepEqual([w.datum, w.lieferant, w.brutto, w.ust_satz, w.brutto_7, w.sicher, w.hinweise], ["2026-11-02", "Adolf Würth GmbH & Co. KG", 145, 19, 26, true, []]);
});

test("E-Rechnung: ZUGFeRD/XRechnung in CII", () => {
  const r = eRechnungLesen(CII)!;
  assert.equal(r.format, "CII");
  assert.deepEqual([r.nummer, r.datum, r.lieferant, r.ustId, r.brutto, r.netto], ["2026-777", "2026-10-30", "Gerüstbau Muster GmbH", "DE987654321", 595, 500]);
  assert.deepEqual(r.steuern, [{ satz: 19, netto: 500, steuer: 95 }]);
  assert.deepEqual(r.posten, [{ name: "Gerüstmiete Oktober", menge: "1 MON", netto: 500 }]);
  const w = belegWerte(r);
  assert.deepEqual([w.ust_satz, w.brutto_7, w.sicher], [19, null, true]);
});

test("E-Rechnung: Gutschrift, Fremdwährung und unbekannte Sätze sind unsicher", () => {
  const gut = belegWerte(eRechnungLesen(CII.replace("<ram:TypeCode>380", "<ram:TypeCode>381"))!);
  assert.equal(gut.sicher, false);
  assert.match(gut.hinweise.join(" "), /Gutschrift/);
  const usd = belegWerte(eRechnungLesen(CII.replace("<ram:InvoiceCurrencyCode>EUR", "<ram:InvoiceCurrencyCode>USD"))!);
  assert.equal(usd.sicher, false);
  assert.match(usd.hinweise.join(" "), /nicht in Euro/);
  const satz = belegWerte(eRechnungLesen(CII.replace("19.00</ram:RateApplicablePercent>", "16.00</ram:RateApplicablePercent>"))!);
  assert.equal(satz.sicher, false);
  assert.match(satz.hinweise.join(" "), /Steuersätze/);
  const credit = eRechnungLesen(UBL.replace(/ubl:Invoice/g, "ubl:CreditNote").replace(/InvoiceLine/g, "CreditNoteLine").replace(/InvoicedQuantity/g, "CreditedQuantity"))!;
  assert.equal(credit.art, "gutschrift");
  assert.equal(credit.posten.length, 2);
});

test("E-Rechnung: DTD, kaputtes und fremdes XML werden abgelehnt", () => {
  assert.equal(eRechnungLesen(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><Invoice><ID>&a;</ID></Invoice>`), null);
  assert.equal(eRechnungLesen("<Invoice><ID>1</Invoice>"), null);
  assert.equal(eRechnungLesen("<Invoice/><Invoice/>"), null);
  assert.equal(eRechnungLesen("<html><body>hallo</body></html>"), null);
  assert.equal(eRechnungLesen("kein xml"), null);
  assert.equal(xmlLesen("<a>" + "<b>".repeat(70) + "</b>".repeat(70) + "</a>"), null, "zu tief verschachtelt");
  assert.equal(xmlLesen(`<a x="1 &amp; 2">&#x41;&#66;</a>`)?.attr.x, "1 & 2");
  assert.equal(xmlLesen(`<a>&#x41;&#66;</a>`)?.text, "AB");
});

test("E-Rechnung: Dateityp erkennen", () => {
  const enc = new TextEncoder();
  assert.equal(istXml(enc.encode("﻿  \n<?xml")), true);
  assert.equal(istXml(enc.encode("%PDF-1.7")), false);
  assert.equal(dateiTyp({ type: "text/xml" }), "application/xml");
  assert.equal(dateiTyp({ type: "", name: "RE-42.XML" }), "application/xml");
  assert.equal(dateiTyp({ type: "image/png", name: "foto.png" }), "image/png");
});

test("E-Rechnung: Vorschlag im Formular und lesbare Ansicht", () => {
  const html = belegeSeite([], { monat: "2026-11", heute: "2026-11-08", kiAn: false, vorschlag: { g: { datum: "2026-11-02", lieferant: "Würth", brutto: 145, ust_satz: 19, gemischt: false, kategorie: "", sicher: true }, dateiId: "11111111-1111-1111-1111-111111111111", mime: "application/xml", xml: { nummer: "RE-<42>", brutto7: 26, hinweise: ["Das ist eine Gutschrift."] } } });
  assert.match(html, /E-Rechnung gelesen – bitte Kategorie wählen und kurz prüfen\. <span>Das ist eine Gutschrift\.<\/span>/);
  assert.match(html, /name="brutto_7"[^>]*value="26,00"/);
  assert.match(html, /name="notiz"[^>]*value="Rechnung RE-&#60;42&#62;"/);
  assert.match(html, /name="datei_mime" value="application\/xml"/);
  assert.match(html, /E-Rechnung \(XML\) ist angehängt/);
  const ohneKi = belegeSeite([], { monat: "2026-11", heute: "2026-11-08", kiAn: false });
  assert.match(ohneKi, /🧾 E-Rechnung einlesen/);
  assert.doesNotMatch(ohneKi, /Auslesen lassen/);
  assert.match(belegeSeite([], { monat: "2026-11", heute: "2026-11-08", kiAn: true }), /Foto, PDF oder E-Rechnung \(XML\)/);
  const ansicht = eRechnungAnsicht(eRechnungLesen(UBL)!, "11111111-1111-1111-1111-111111111111");
  assert.match(ansicht, /Adolf Würth GmbH &#38; Co\. KG/);
  assert.match(ansicht, /Schrauben &#60;M8&#62;/);
  assert.match(ansicht, /145,00 EUR/);
  assert.match(ansicht, /\?roh=1/);
});
