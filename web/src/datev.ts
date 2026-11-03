// Ideas 3 and 22 (docs/ideen-arbeitsoberflaeche.md): exports for the tax adviser and the payroll office.
// 1) DATEV-Format "Buchungsstapel" (EXTF, version 700, category 21, format version 13) with the month's invoices and
//    receipts. Accounts are only a PROPOSAL for SKR03/SKR04 (booking and advice stay with the tax adviser, StBerG);
//    the tax adviser imports the file and can change everything. Rules and the 125 column headings follow DATEV's
//    format description as collected in the MIT-licensed validator github.com/seamless-engineering/datev-extf
//    (headings copied from there, © seamless.engineering, MIT); our output is checked against that validator.
// 2) LODAS ASCII import of the payroll list (hours, surcharges, leave, expenses) with the firm's own wage types
//    ("Lohnarten"), which the payroll office provides. Without a wage type a value is not exported.
// Berater- and Mandantennummer are entered by the firm; they are not secret.
import SPALTEN from "./datev-spalten.json" with { type: "json" };
import type { Beleg } from "./belege.ts";
import type { Zeile } from "./lohn.ts";
import type { Rechnung } from "./rechnungen.ts";

export type DatevEinstellung = { berater: string; mandant: string; skr: "03" | "04"; wjBeginn: number; kleinunternehmer: boolean };
export type Buchung = { cent: number; seite: "S" | "H"; konto: string; gegenkonto: string; bu?: string; datum: string; beleg1: string; text: string };

/** Proposed accounts (DATEV-Kontenrahmen SKR03 / SKR04). Revenue 8400/4400 are automatic accounts (no BU key). */
export const KONTEN = {
  "03": { debitor: "10000", kreditor: "70000", erloes: "8400", erloesKu: "8195", material: "3000", fahrzeug: "4530", buero: "4930", miete: "4210", versicherung: "4360", telefon: "4920", reise: "4670", personal: "3100", sonstiges: "4900" },
  "04": { debitor: "10000", kreditor: "70000", erloes: "4400", erloesKu: "4185", material: "5000", fahrzeug: "6530", buero: "6815", miete: "6310", versicherung: "6400", telefon: "6805", reise: "6670", personal: "5900", sonstiges: "6300" },
} as const;
/** Input tax keys: 9 = 19 % Vorsteuer, 8 = 7 % Vorsteuer. */
const BU_VORSTEUER: Record<number, string> = { 19: "9", 7: "8" };

const q = (t: string) => `"${t.replace(/"/g, '""')}"`;
const text = (t: string, max: number) => t.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const beleg1 = (t: string) => t.replace(/[^A-Za-z0-9$&%*+\-/]/g, "").slice(-36);
const betrag = (cent: number) => `${Math.floor(cent / 100)},${String(cent % 100).padStart(2, "0")}`;
const cent = (n: number | string) => Math.round(Number(n) * 100);
const ymd = (d: string) => d.replace(/-/g, "");

/** Postings for one month: outgoing invoices (gross, debtor to revenue) and receipts (expense to creditor, with input tax key). */
export function buchungenAus(rechnungen: (Pick<Rechnung, "nummer" | "datum" | "netto" | "ust_satz"> & Partial<Pick<Rechnung, "ust_betrag" | "kleinunternehmer" | "art" | "bezug_nummer">>)[], belege: Beleg[], e: DatevEinstellung, kundeName: (r: Pick<Rechnung, "nummer">) => string = () => ""): Buchung[] {
  const k = KONTEN[e.skr];
  const aus = rechnungen.map((r): Buchung => {
    // Issued invoices carry their frozen small-business status and VAT amount (GoBD); a cancellation is posted on the credit side.
    const ku = r.kleinunternehmer ?? e.kleinunternehmer;
    const brutto = r.ust_betrag !== null && r.ust_betrag !== undefined ? cent(r.netto) + cent(r.ust_betrag) : Math.round(cent(r.netto) * (100 + (ku ? 0 : Number(r.ust_satz))) / 100);
    const storno = r.art === "storno" || brutto < 0;
    return { cent: Math.abs(brutto), seite: storno ? "H" : "S", konto: k.debitor, gegenkonto: ku ? k.erloesKu : k.erloes, datum: r.datum, beleg1: r.nummer, text: `${storno ? `Storno ${r.bezug_nummer ?? ""}` : "Rechnung"} ${r.nummer} ${kundeName(r)}`.replace(/\s+/g, " ") };
  });
  const ein = belege.map((b): Buchung => ({ cent: cent(b.brutto), seite: "S", konto: (k as Record<string, string>)[b.kategorie] ?? k.sonstiges, gegenkonto: k.kreditor, bu: e.kleinunternehmer ? "" : BU_VORSTEUER[Number(b.ust_satz)] ?? "", datum: b.datum, beleg1: `B${ymd(b.datum).slice(2)}${b.id.slice(0, 6)}`, text: `${b.lieferant}${b.notiz ? ` ${b.notiz}` : ""}` }));
  return [...aus, ...ein].filter((b) => b.cent > 0).sort((a, b) => a.datum.localeCompare(b.datum));
}

/** DATEV-Format Buchungsstapel as text (CRLF); encode with cp1252() for the download. */
export function buchungsstapel(e: DatevEinstellung, monat: string, buchungen: Buchung[], erstellt = new Date()): string {
  const [jahr, mon] = monat.split("-").map(Number);
  const wjJahr = mon >= e.wjBeginn ? jahr : jahr - 1;
  const zeit = erstellt.toISOString().replace(/\D/g, "").slice(0, 17);
  const ende = new Date(Date.UTC(jahr, mon, 0)).toISOString().slice(0, 10);
  const kopf = [q("EXTF"), "700", "21", q("Buchungsstapel"), "13", zeit, "", q("RE"), q("Jarvis"), q(""), e.berater, e.mandant,
    `${wjJahr}${String(e.wjBeginn).padStart(2, "0")}01`, "4", ymd(`${monat}-01`), ymd(ende), q(text(`Jarvis ${monat}`, 30)), q(""), "1", "0", "0", q("EUR"), "", q(""), "", "", q(e.skr), "", "", q(""), q("")];
  const zeilen = buchungen.map((b) => {
    const f: string[] = new Array(SPALTEN.length).fill("");
    f[0] = betrag(b.cent); f[1] = q(b.seite); f[2] = q("EUR"); f[6] = b.konto; f[7] = b.gegenkonto; f[8] = q(b.bu ?? "");
    f[9] = `${b.datum.slice(8, 10)}${b.datum.slice(5, 7)}`; f[10] = q(beleg1(b.beleg1)); f[13] = q(text(b.text, 60));
    return f.join(";");
  });
  return [kopf.join(";"), SPALTEN.join(";"), ...zeilen].join("\r\n") + "\r\n";
}

/** Bytes 0x80–0x9F of Windows-1252 (DATEV's default character set); everything else up to 0xFF is Latin-1. */
const CP1252: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
export function cp1252(t: string): Uint8Array {
  const b: number[] = [];
  for (const ch of t) { const c = ch.codePointAt(0) ?? 63; b.push(c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252[c] ?? 0x3f); }
  return Uint8Array.from(b);
}

/** Wage types of the payroll office per value; empty = not exported. */
export const LOHNARTEN = { stunden: "Arbeitsstunden", nacht: "Nachtstunden (Zuschlag)", sonntag: "Sonntagsstunden (Zuschlag)", feiertag: "Feiertagsstunden (Zuschlag)", urlaub: "Urlaubstage", spesen: "Spesen/Auslagen (€)" } as const;
export type Lohnarten = Partial<Record<keyof typeof LOHNARTEN, string>>;

/** LODAS ASCII import (Bewegungsdaten, standard table). Value keys: 1 = hours, 2 = amount, 10 = days. */
export function lodasDatei(e: Pick<DatevEinstellung, "berater" | "mandant">, monat: string, zeilen: Zeile[], la: Lohnarten): { text: string; ohneNummer: string[] } {
  const zeitraum = `01.${monat.slice(5, 7)}.${monat.slice(0, 4)}`;
  const zahl = (n: number) => n.toFixed(2).replace(".", ",");
  const werte: [keyof typeof LOHNARTEN, (z: Zeile) => number, number][] = [
    ["stunden", (z) => z.stunden / 60, 1], ["nacht", (z) => z.nacht / 60, 1], ["sonntag", (z) => z.sonntag / 60, 1], ["feiertag", (z) => z.feiertag / 60, 1], ["urlaub", (z) => z.urlaub, 10], ["spesen", (z) => z.spesen, 2],
  ];
  const ohneNummer = zeilen.filter((z) => !/^\d{1,5}$/.test(z.personalnummer)).map((z) => z.name);
  const daten = zeilen.filter((z) => /^\d{1,5}$/.test(z.personalnummer)).flatMap((z) => werte.flatMap(([k, wert, bs]) => {
    const lohnart = (la[k] ?? "").trim(), w = Math.round(wert(z) * 100) / 100;
    return /^\d{1,4}$/.test(lohnart) && w > 0 ? [`1;${z.personalnummer};${zeitraum};${zahl(w)};${bs};${lohnart};IMPORT Jarvis;`] : [];
  }));
  const text = ["[Allgemein]", "Ziel=LODAS", "Version_SST=1.0", `BeraterNr=${e.berater}`, `MandantenNr=${e.mandant}`, "Feldtrennzeichen=;", "Zahlenkomma=,", "Datumsformat=TT.MM.JJJJ", "",
    "[Satzbeschreibung]", "1;u_lod_bwd_buchung_standard;pnr#bwd;abrechnung_zeitraum#bwd;bs_wert_butab#bwd;bs_nr#bwd;la_eigene#bwd;bemerkung#bwd;", "", "[Bewegungsdaten]", ...daten].join("\r\n") + "\r\n";
  return { text, ohneNummer };
}

/** Settings check: what is missing before an export. */
export function fehltDatev(e: Partial<DatevEinstellung>): string[] {
  return [!/^\d{4,7}$/.test(e.berater ?? "") || Number(e.berater) < 1001 ? "Beraternummer (4–7 Ziffern, vom Steuerbüro)" : "", !/^\d{1,5}$/.test(e.mandant ?? "") || Number(e.mandant) < 1 ? "Mandantennummer (1–5 Ziffern, vom Steuerbüro)" : ""].filter(Boolean);
}
