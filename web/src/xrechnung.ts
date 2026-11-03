// E-Rechnung: the invoice draft (rechnungen.ts) as XRechnung 3.0 in UBL 2.1 syntax (EN 16931 with the German CIUS),
// the format German public buyers require and that becomes mandatory between businesses from 2027/2028. Nothing is
// sent: the firm downloads the XML and sends or uploads it itself. Checked with the official KoSIT validator in
// .github/workflows/xrechnung-pruefen.yml.
import type { Kunde } from "./kunden.ts";
import type { Absender, Rechnung } from "./rechnungen.ts";

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

/** What a complete XRechnung still needs from the firm profile or the customer (shown before the download). */
export function fehlendFuerXRechnung(a: Absender, k: Kunde | null): string[] {
  return [
    !a.strasse || !a.plz || !a.ort ? "Anschrift der Firma" : "",
    !a.steuernummer && !a.ustid ? "Steuernummer oder USt-IdNr." : "",
    !a.email ? "E-Mail der Firma" : "",
    !k ? "Kunde" : !k.strasse || !k.plz || !k.ort ? "Anschrift des Kunden" : "",
  ].filter(Boolean);
}

export function xrechnungXml(r: Rechnung, k: Kunde | null, a: Absender, kaeuferReferenz = ""): string {
  const netto = Number(r.netto);
  const satz = a.kleinunternehmer ? 0 : Number(r.ust_satz);
  const ust = Math.round(netto * satz) / 100;
  const faellig = new Date(Date.parse(`${r.datum}T12:00:00Z`) + 14 * 86400_000).toISOString().slice(0, 10);
  const [jahr, monat] = r.monat.split("-").map(Number);
  const ende = new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10);
  const kategorie = a.kleinunternehmer ? "E" : "S";
  const steuer = (tag: string) => `<cac:${tag}><cbc:ID>${kategorie}</cbc:ID><cbc:Percent>${betrag(satz)}</cbc:Percent>${tag === "TaxCategory" && a.kleinunternehmer ? "<cbc:TaxExemptionReason>Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG</cbc:TaxExemptionReason>" : ""}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:${tag}>`;
  const b = bank(a.zahlungshinweis);
  const zahlung = b.iban
    ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${x(b.iban)}</cbc:ID><cbc:Name>${x(a.name)}</cbc:Name>${b.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${x(b.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
    : `<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode></cac:PaymentMeans>`;
  const adresse = (strasse: string, plz: string, ort: string) => `<cac:PostalAddress><cbc:StreetName>${x(strasse)}</cbc:StreetName><cbc:CityName>${x(ort)}</cbc:CityName><cbc:PostalZone>${x(plz)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
  const zeilen = r.positionen.map((p, i) => `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="${EINHEIT[p.einheit] ?? "C62"}">${menge(p.menge)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">${betrag(p.betrag)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${x(p.text)}</cbc:Name>${steuer("ClassifiedTaxCategory")}</cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${betrag(p.preis)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
<cbc:ID>${x(r.nummer)}</cbc:ID>
<cbc:IssueDate>${r.datum}</cbc:IssueDate>
<cbc:DueDate>${faellig}</cbc:DueDate>
<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${a.kleinunternehmer ? "<cbc:Note>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</cbc:Note>\n" : ""}<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
<cbc:BuyerReference>${x(kaeuferReferenz.trim() || r.nummer)}</cbc:BuyerReference>
<cac:InvoicePeriod><cbc:StartDate>${r.monat}-01</cbc:StartDate><cbc:EndDate>${ende}</cbc:EndDate></cac:InvoicePeriod>
<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="EM">${x(a.email)}</cbc:EndpointID><cac:PartyName><cbc:Name>${x(a.name)}</cbc:Name></cac:PartyName>${adresse(a.strasse, a.plz, a.ort)}${a.ustid ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(a.ustid)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}${a.steuernummer ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(a.steuernummer)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}<cac:PartyLegalEntity><cbc:RegistrationName>${x(a.name)}</cbc:RegistrationName></cac:PartyLegalEntity><cac:Contact><cbc:Name>${x(a.name)}</cbc:Name><cbc:Telephone>${x(a.telefon || "nicht angegeben")}</cbc:Telephone><cbc:ElectronicMail>${x(a.email)}</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="EM">${x(k?.email || a.email)}</cbc:EndpointID><cac:PartyName><cbc:Name>${x(k?.name ?? "")}</cbc:Name></cac:PartyName>${adresse(k?.strasse ?? "", k?.plz ?? "", k?.ort ?? "")}<cac:PartyLegalEntity><cbc:RegistrationName>${x(k?.name ?? "")}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
${zahlung}
<cac:PaymentTerms><cbc:Note>Zahlbar ohne Abzug bis ${faellig}.${a.zahlungshinweis ? ` ${x(a.zahlungshinweis)}` : ""}</cbc:Note></cac:PaymentTerms>
<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${betrag(ust)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${betrag(netto)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${betrag(ust)}</cbc:TaxAmount>${steuer("TaxCategory")}</cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${betrag(netto)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${betrag(netto)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${betrag(netto + ust)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${betrag(netto + ust)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
${zeilen}
</ubl:Invoice>
`;
}
