// Writes three sample XRechnungen (regular VAT with IBAN, small business § 19 without IBAN, reverse charge § 13b) for the
// KoSIT validator.
import { writeFileSync } from "node:fs";
import { xrechnungXml } from "../src/xrechnung.ts";
import type { Absender, Rechnung } from "../src/rechnungen.ts";
import type { Kunde } from "../src/kunden.ts";

const r: Rechnung = { id: "x", kunde_id: "k", nummer: "RE-2026-0007", monat: "2026-10", datum: "2026-11-03", netto: 4300, ust_satz: 19, erstellt: "",
  positionen: [{ text: "Personalgestellung Oktober 2026 lt. Leistungsnachweis", menge: 160, einheit: "Std.", preis: 25, betrag: 4000 },
    { text: "Nachtzuschlag 25 %", menge: 48, einheit: "Std.", preis: 6.25, betrag: 300 }] };
const k = { id: "k", bereich_id: null, name: "Stadt Aachen, Gebäudemanagement", strasse: "Markt 39", plz: "52062", ort: "Aachen", ansprechpartner: "", telefon: "", email: "rechnung@stadt-aachen.example", notiz: "" } as unknown as Kunde;
const a: Absender = { name: "Muster Reinigung GmbH", strasse: "Hauptstraße 1", plz: "52531", ort: "Übach-Palenberg", telefon: "02451 12345", email: "buchhaltung@muster.example",
  steuernummer: "", ustid: "DE123456789", kleinunternehmer: false, zahlungshinweis: "IBAN DE89 3704 0044 0532 0130 00, BIC COBADEFFXXX" };
writeFileSync(process.argv[2] ?? "regel.xml", xrechnungXml(r, k, a, "05334-12345-67"));
writeFileSync(process.argv[3] ?? "klein.xml", xrechnungXml({ ...r, nummer: "RE-2026-0008" }, k, { ...a, ustid: "", steuernummer: "203/123/45678", kleinunternehmer: true, zahlungshinweis: "Bitte überweisen Sie auf unser Konto." }));
writeFileSync(process.argv[4] ?? "13b.xml", xrechnungXml({ ...r, nummer: "RE-2026-0009", ust_satz: 0, ust_betrag: 0, reverse_charge: true, empfaenger: { name: k.name, strasse: k.strasse, plz: k.plz, ort: k.ort, ustid: "DE987654321" } }, k, a, "05334-12345-67"));
