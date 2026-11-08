// E-invoices as receipts (Rechtsprüfung S11: since 2025 German firms must be able to receive e-invoices). Reads the two
// formats allowed by § 14 UStG / EN 16931 – XRechnung or Peppol in UBL syntax and XRechnung/ZUGFeRD/Factur-X in CII syntax –
// without AI: date, supplier, invoice number, gross total, VAT split and the lines. The XML file itself is stored as the
// receipt (it is the original; a PDF view is only a copy). Hybrid ZUGFeRD PDFs keep going through the normal PDF path.

export type XmlKnoten = { name: string; attr: Record<string, string>; kinder: XmlKnoten[]; text: string };

const ENTITAETEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const entschluesseln = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITAETEN[e] ?? ganz);
/** Local name without namespace prefix (cbc:IssueDate → IssueDate). */
const lokal = (n: string) => n.slice(n.indexOf(":") + 1);

/** Small XML reader: elements, attributes, text, CDATA; no DTDs (refused, so no entity tricks), namespaces dropped. */
export function xmlLesen(xml: string): XmlKnoten | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  const wurzel: XmlKnoten = { name: "#", attr: {}, kinder: [], text: "" };
  const stapel = [wurzel];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const oben = stapel[stapel.length - 1];
    if (m[1] !== undefined) oben.text += m[1];
    else if (m[2]) {
      if (lokal(m[2]) !== oben.name || stapel.length === 1) return null;
      stapel.pop();
    } else if (m[3]) {
      const attr: Record<string, string> = {};
      for (const a of (m[4] ?? "").matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attr[lokal(a[1])] = entschluesseln(a[2] ?? a[3] ?? "");
      const k: XmlKnoten = { name: lokal(m[3]), attr, kinder: [], text: "" };
      oben.kinder.push(k);
      if (!m[5]) stapel.push(k);
    } else if (m[6] !== undefined) oben.text += entschluesseln(m[6]);
    if (stapel.length > 64) return null;
  }
  return stapel.length === 1 && wurzel.kinder.length === 1 ? wurzel.kinder[0] : null;
}

/** First descendant along a path of local names (each step searches the direct children). */
function pfad(k: XmlKnoten | undefined, ...namen: string[]): XmlKnoten | undefined {
  let x = k;
  for (const n of namen) x = x?.kinder.find((c) => c.name === n);
  return x;
}
const alle = (k: XmlKnoten | undefined, name: string): XmlKnoten[] => k?.kinder.filter((c) => c.name === name) ?? [];
/** All descendants with this name, at any depth. */
function tief(k: XmlKnoten | undefined, name: string, aus: XmlKnoten[] = []): XmlKnoten[] {
  for (const c of k?.kinder ?? []) { if (c.name === name) aus.push(c); tief(c, name, aus); }
  return aus;
}
const text = (k: XmlKnoten | undefined) => (k?.text ?? "").replace(/\s+/g, " ").trim();
const zahl = (k: XmlKnoten | undefined) => { const n = Number(text(k)); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };

export type Steueranteil = { satz: number; netto: number; steuer: number };
export type ERechnung = {
  format: "UBL" | "CII";
  art: "rechnung" | "gutschrift";
  nummer: string;
  datum: string;
  lieferant: string;
  ustId: string;
  waehrung: string;
  brutto: number;
  netto: number;
  steuern: Steueranteil[];
  posten: { name: string; menge: string; netto: number }[];
};

const datumUbl = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");
const datumCii = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : datumUbl(s));

/** Reads an XRechnung/ZUGFeRD XML; null when it is not an invoice in UBL or CII syntax. */
export function eRechnungLesen(xml: string): ERechnung | null {
  const w = xmlLesen(xml.replace(/^﻿/, ""));
  if (!w) return null;
  if (w.name === "Invoice" || w.name === "CreditNote") {
    const gutschrift = w.name === "CreditNote";
    const lief = pfad(w, "AccountingSupplierParty", "Party");
    const summe = pfad(w, "LegalMonetaryTotal");
    const steuern = alle(pfad(w, "TaxTotal"), "TaxSubtotal").map((t) => ({ satz: zahl(pfad(t, "TaxCategory", "Percent")) || 0, netto: zahl(pfad(t, "TaxableAmount")), steuer: zahl(pfad(t, "TaxAmount")) }));
    return {
      format: "UBL", art: gutschrift ? "gutschrift" : "rechnung",
      nummer: text(pfad(w, "ID")), datum: datumUbl(text(pfad(w, "IssueDate"))),
      lieferant: text(pfad(lief, "PartyLegalEntity", "RegistrationName")) || text(pfad(lief, "PartyName", "Name")),
      ustId: text(alle(lief, "PartyTaxScheme").map((p) => pfad(p, "CompanyID"))[0]),
      waehrung: text(pfad(w, "DocumentCurrencyCode")) || "EUR",
      brutto: zahl(pfad(summe, "TaxInclusiveAmount")), netto: zahl(pfad(summe, "TaxExclusiveAmount")),
      steuern,
      posten: [...alle(w, gutschrift ? "CreditNoteLine" : "InvoiceLine")].slice(0, 200).map((p) => ({
        name: text(pfad(p, "Item", "Name")), menge: `${text(pfad(p, gutschrift ? "CreditedQuantity" : "InvoicedQuantity"))} ${pfad(p, gutschrift ? "CreditedQuantity" : "InvoicedQuantity")?.attr.unitCode ?? ""}`.trim(),
        netto: zahl(pfad(p, "LineExtensionAmount")),
      })),
    };
  }
  if (w.name === "CrossIndustryInvoice") {
    const dok = pfad(w, "ExchangedDocument");
    const handel = pfad(w, "SupplyChainTradeTransaction");
    const einigung = pfad(handel, "ApplicableHeaderTradeAgreement");
    const abrechnung = pfad(handel, "ApplicableHeaderTradeSettlement");
    const summe = pfad(abrechnung, "SpecifiedTradeSettlementHeaderMonetarySummation");
    const verkaeufer = pfad(einigung, "SellerTradeParty");
    const ust = alle(verkaeufer, "SpecifiedTaxRegistration").map((r) => pfad(r, "ID")).find((i) => i?.attr.schemeID === "VA");
    return {
      format: "CII", art: text(pfad(dok, "TypeCode")) === "381" ? "gutschrift" : "rechnung",
      nummer: text(pfad(dok, "ID")), datum: datumCii(text(pfad(dok, "IssueDateTime", "DateTimeString"))),
      lieferant: text(pfad(verkaeufer, "Name")), ustId: text(ust),
      waehrung: text(pfad(abrechnung, "InvoiceCurrencyCode")) || "EUR",
      brutto: zahl(pfad(summe, "GrandTotalAmount")), netto: zahl(pfad(summe, "TaxBasisTotalAmount")),
      steuern: alle(abrechnung, "ApplicableTradeTax").map((t) => ({ satz: zahl(pfad(t, "RateApplicablePercent")) || 0, netto: zahl(pfad(t, "BasisAmount")), steuer: zahl(pfad(t, "CalculatedAmount")) })),
      posten: tief(handel, "IncludedSupplyChainTradeLineItem").slice(0, 200).map((p) => {
        const menge = pfad(p, "SpecifiedLineTradeDelivery", "BilledQuantity");
        return { name: text(pfad(p, "SpecifiedTradeProduct", "Name")), menge: `${text(menge)} ${menge?.attr.unitCode ?? ""}`.trim(), netto: zahl(pfad(p, "SpecifiedLineTradeSettlement", "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount")) };
      }),
    };
  }
  return null;
}

/** Form values for the receipt: main rate 19/7/0 and the gross part at 7 % on a 19 %/7 % invoice. */
export function belegWerte(r: ERechnung): { datum: string; lieferant: string; brutto: number; ust_satz: 0 | 7 | 19; brutto_7: number | null; sicher: boolean; hinweise: string[] } {
  const saetze = [...new Set(r.steuern.filter((s) => Number.isFinite(s.netto)).map((s) => s.satz))];
  const anteil = (satz: number) => r.steuern.filter((s) => s.satz === satz).reduce((n, s) => n + s.netto + (Number.isFinite(s.steuer) ? s.steuer : 0), 0);
  const nurBekannte = saetze.every((s) => s === 19 || s === 7 || s === 0);
  const satz: 0 | 7 | 19 = saetze.includes(19) ? 19 : saetze.includes(7) ? 7 : 0;
  const gemischt19und7 = saetze.includes(19) && saetze.includes(7);
  const brutto = Number.isFinite(r.brutto) && r.brutto > 0 ? r.brutto : 0;
  const hinweise: string[] = [];
  if (r.art === "gutschrift") hinweise.push("Das ist eine Gutschrift. Bitte mit der Steuerberatung klären, wie sie gebucht wird.");
  if (r.waehrung !== "EUR") hinweise.push("Die Rechnung ist nicht in Euro. Bitte den Betrag in Euro eintragen.");
  if (!nurBekannte || saetze.filter((s) => s !== 0).length > 2) hinweise.push("Die Rechnung hat Steuersätze, die Crewtender nicht abbildet. Bitte die Beträge prüfen.");
  return {
    datum: r.datum, lieferant: r.lieferant.slice(0, 160), brutto, ust_satz: satz,
    brutto_7: gemischt19und7 ? Math.round(anteil(7) * 100) / 100 : null,
    sicher: !!(r.datum && r.lieferant && brutto && nurBekannte && r.waehrung === "EUR" && r.art === "rechnung"),
    hinweise,
  };
}

/** True when the bytes look like an XML document (optional BOM and whitespace, then "<"). */
export function istXml(b: Uint8Array): boolean {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09)) i++;
  return b[i] === 0x3c;
}
