// E-Rechnung: the invoice draft (rechnungen.ts) as XRechnung 3.0 in UBL 2.1 syntax (EN 16931 with the German CIUS),
// the format German public buyers require and that becomes mandatory between businesses from 2027/2028. Nothing is
// sent: the firm downloads the XML and sends or uploads it itself. Checked with the official KoSIT validator in
// .github/workflows/xrechnung-pruefen.yml.
import type { Kunde } from "./kunden.ts";
import type { Absender, Rechnung } from "./rechnungen.ts";

/** A VAT ID starts with the two-letter country prefix (BR-CO-9; Greece uses EL). */
export const ustIdPasst = (u: string) => u === "" || /^[A-Z]{2}[0-9A-Z+*.]{2,13}$/.test(u);
const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const betrag = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const menge = (n: number) => (Math.round(n * 10000) / 10000).toString();
const EINHEIT: Record<string, string> = { "Std.": "HUR", "Stunden": "HUR", "Stk.": "H87", "Tag": "DAY", "Tage": "DAY", "Monat": "MON", "pauschal": "C62" };

/** IBAN and BIC from the free payment note in the firm profile ("IBAN DE.. BIC ..."), if present. */
export function bank(hinweis: string): { iban?: string; bic?: string } {
  const iban = /\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?)\b/.exec(hinweis.toUpperCase())?.[1]?.replace(/\s/g, "");
  const bic = /\bBIC:?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/i.exec(hinweis)?.[1]?.toUpperCase();
  return { ...(iban ? { iban } : {}), ...(bic ? { bic } : {}) };
}

/** What a complete XRechnung still needs from the firm profile or the customer (shown before the download). The
 *  buyer's electronic address (BT-49) is the Leitweg-ID for public buyers, otherwise the customer's e-mail; the seller
 *  contact needs a phone number (BR-DE-6); VAT IDs need their country prefix (BR-CO-9). */
export function fehlendFuerXRechnung(a: Absender, k: Kunde | null, leitweg = ""): string[] {
  return [
    !a.strasse || !a.plz || !a.ort ? "Anschrift der Firma" : "",
    !a.steuernummer && !a.ustid ? "Steuernummer oder USt-IdNr." : "",
    a.ustid && !ustIdPasst(a.ustid) ? "USt-IdNr. der Firma mit Ländercode (z. B. DE123456789)" : "",
    !a.email ? "E-Mail der Firma" : "",
    !a.telefon ? "Telefon der Firma (Pflichtangabe der XRechnung)" : "",
    !k ? "Kunde" : !k.strasse || !k.plz || !k.ort ? "Anschrift des Kunden" : "",
    k && !k.email && !leitweg ? "E-Mail oder Leitweg-ID des Kunden (Empfangsadresse der E-Rechnung)" : "",
    k?.ustid && !ustIdPasst(k.ustid) ? "USt-IdNr. des Kunden mit Ländercode" : "",
  ].filter(Boolean);
}

/** Without a VAT ID (e.g. small businesses, § 19 UStG) the tax number is also the seller identifier BT-29 (BR-CO-26). */
export function xrechnungXml(r: Rechnung, k: Kunde | null, a: Absender, kaeuferReferenz = ""): string {
  // A cancellation (Stornorechnung) is stored with negative amounts; as e-invoice it is a credit note (381) with positive
  // amounts and a reference to the cancelled invoice (BT-25).
  const storno = r.art === "storno", v = storno ? -1 : 1;
  const netto = v * Number(r.netto);
  const rc = !!r.reverse_charge; // § 13b: category AE, the buyer owes the VAT
  const satz = a.kleinunternehmer || rc ? 0 : Number(r.ust_satz);
  const ust = r.ust_betrag !== null && r.ust_betrag !== undefined ? v * Number(r.ust_betrag) : Math.round(netto * satz) / 100;
  const faellig = new Date(Date.parse(`${r.datum}T12:00:00Z`) + (r.zahlungsziel_tage ?? 14) * 86400_000).toISOString().slice(0, 10);
  const [jahr, monat] = r.monat.split("-").map(Number);
  const ende = new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10);
  const kategorie = rc ? "AE" : a.kleinunternehmer ? "E" : "S";
  const grund = rc ? "<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)</cbc:TaxExemptionReason>"
    : a.kleinunternehmer ? "<cbc:TaxExemptionReason>Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG</cbc:TaxExemptionReason>" : "";
  const steuer = (tag: string) => `<cac:${tag}><cbc:ID>${kategorie}</cbc:ID><cbc:Percent>${betrag(satz)}</cbc:Percent>${tag === "TaxCategory" ? grund : ""}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:${tag}>`;
  const b = bank(a.zahlungshinweis);
  const zahlung = b.iban
    ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${x(b.iban)}</cbc:ID><cbc:Name>${x(a.name)}</cbc:Name>${b.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${x(b.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
    : `<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode></cac:PaymentMeans>`;
  const land = (c: string | undefined) => (/^[A-Z]{2}$/.test(c ?? "") && c !== "XX" ? c! : "DE");
  const adresse = (strasse: string, plz: string, ort: string, c: string | undefined) => `<cac:PostalAddress><cbc:StreetName>${x(strasse)}</cbc:StreetName><cbc:CityName>${x(ort)}</cbc:CityName><cbc:PostalZone>${x(plz)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${land(c)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
  const zeilen = r.positionen.map((p, i) => `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="${EINHEIT[p.einheit] ?? "C62"}">${menge(v * p.menge)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">${betrag(v * p.betrag)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${x(p.text)}</cbc:Name>${steuer("ClassifiedTaxCategory")}</cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${betrag(Math.abs(p.preis))}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join("");
  // BT-49: public buyers receive via their Leitweg-ID (scheme 0204), everyone else by e-mail.
  const leitweg = kaeuferReferenz.trim();
  const kaeuferAdresse = /^[0-9A-Za-z-]{5,46}$/.test(leitweg) && /^\d/.test(leitweg) ? `<cbc:EndpointID schemeID="0204">${x(leitweg)}</cbc:EndpointID>` : `<cbc:EndpointID schemeID="EM">${x(k?.email ?? "")}</cbc:EndpointID>`;
  const kaeuferUst = r.empfaenger?.ustid || k?.ustid || "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
<cbc:ID>${x(r.nummer)}</cbc:ID>
<cbc:IssueDate>${r.datum}</cbc:IssueDate>
${storno ? "" : `<cbc:DueDate>${faellig}</cbc:DueDate>\n`}<cbc:InvoiceTypeCode>${storno ? "381" : "380"}</cbc:InvoiceTypeCode>
${storno ? `<cbc:Note>Stornorechnung: hebt die Rechnung ${x(r.bezug_nummer ?? "")} vollständig auf.</cbc:Note>\n` : ""}${a.kleinunternehmer ? "<cbc:Note>Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung nach § 19 Abs. 1 UStG.</cbc:Note>\n" : ""}${rc ? "<cbc:Note>Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).</cbc:Note>\n" : ""}<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
<cbc:BuyerReference>${x(kaeuferReferenz.trim() || r.nummer)}</cbc:BuyerReference>
<cac:InvoicePeriod><cbc:StartDate>${r.monat}-01</cbc:StartDate><cbc:EndDate>${ende}</cbc:EndDate></cac:InvoicePeriod>${storno && r.bezug_nummer ? `\n<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${x(r.bezug_nummer)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>\n` : ""}
<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="EM">${x(a.email)}</cbc:EndpointID>${!a.ustid && a.steuernummer ? `<cac:PartyIdentification><cbc:ID>${x(a.steuernummer)}</cbc:ID></cac:PartyIdentification>` : ""}<cac:PartyName><cbc:Name>${x(a.name)}</cbc:Name></cac:PartyName>${adresse(a.strasse, a.plz, a.ort, a.land)}${a.ustid ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(a.ustid)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}${a.steuernummer ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(a.steuernummer)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}<cac:PartyLegalEntity><cbc:RegistrationName>${x(a.name)}</cbc:RegistrationName></cac:PartyLegalEntity><cac:Contact><cbc:Name>${x(a.name)}</cbc:Name><cbc:Telephone>${x(a.telefon)}</cbc:Telephone><cbc:ElectronicMail>${x(a.email)}</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party>${kaeuferAdresse}<cac:PartyName><cbc:Name>${x(k?.name ?? "")}</cbc:Name></cac:PartyName>${adresse(k?.strasse ?? "", k?.plz ?? "", k?.ort ?? "", k?.land)}${kaeuferUst ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(kaeuferUst)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}<cac:PartyLegalEntity><cbc:RegistrationName>${x(k?.name ?? "")}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
${zahlung}
<cac:PaymentTerms><cbc:Note>${storno ? `Gutschrift zur Rechnung ${x(r.bezug_nummer ?? "")}: wird verrechnet oder erstattet.` : `Zahlbar ohne Abzug bis ${faellig}.${a.zahlungshinweis ? ` ${x(a.zahlungshinweis)}` : ""}`}</cbc:Note></cac:PaymentTerms>
<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${betrag(ust)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${betrag(netto)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${betrag(ust)}</cbc:TaxAmount>${steuer("TaxCategory")}</cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${betrag(netto)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${betrag(netto)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${betrag(netto + ust)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${betrag(netto + ust)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
${zeilen}
</ubl:Invoice>
`;
}
