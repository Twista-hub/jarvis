import test from "node:test";
import assert from "node:assert/strict";
import { jahresumsatz, kleinunternehmerWaechter, perioden, umsatzsteuerSeite } from "../src/umsatzsteuer.ts";

const re = [
  { datum: "2026-01-15", netto: 1000, ust_satz: 19, bezahlt_am: "2026-02-03" },
  { datum: "2026-02-10", netto: 200, ust_satz: 7, bezahlt_am: null },
  { datum: "2026-04-01", netto: 500, ust_satz: 19, bezahlt_am: "2026-04-10" },
  { datum: "2025-06-01", netto: 30000, ust_satz: 19, bezahlt_am: "2025-06-20" },
];
const be = [{ datum: "2026-01-20", brutto: 119, ust_satz: 19, beleg_mime: "image/jpeg" }, { datum: "2026-02-05", brutto: 10.7, ust_satz: 7, beleg_mime: "application/pdf" }];

test("Umsatzsteuer: Monate, Quartale, Soll und Ist", () => {
  const m = perioden(re, be, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false });
  assert.equal(m.length, 12);
  assert.deepEqual([m[0].umsatz19, m[0].ust, m[0].vorsteuer, m[0].zahllast], [1000, 190, 19, 171]);
  assert.deepEqual([m[1].umsatz7, m[1].ust, m[1].vorsteuer, m[1].zahllast], [200, 14, 0.7, 13.3]);
  const q = perioden(re, be, { jahr: 2026, quartal: true, ist: false, kleinunternehmer: false });
  assert.deepEqual(q.map((x) => x.umsatz19), [1000, 500, 0, 0]);
  const ist = perioden(re, be, { jahr: 2026, quartal: false, ist: true, kleinunternehmer: false });
  assert.deepEqual([ist[0].umsatz19, ist[1].umsatz19, ist[1].umsatz7], [0, 1000, 0], "Ist: Zahlungseingang zählt, unbezahlt fehlt");
  const ku = perioden(re, be, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: true });
  assert.deepEqual([ku[0].umsatz0, ku[0].ust, ku[0].vorsteuer], [1000, 0, 0], "Kleinunternehmer ohne USt und Vorsteuer");
});

test("Kleinunternehmer-Wächter", () => {
  assert.equal(jahresumsatz(re, 2025, false), 30000);
  assert.equal(jahresumsatz(re, 2026, true), 1500);
  assert.equal(kleinunternehmerWaechter(30000, 1700, true).stufe, "rot", "Vorjahr über 25.000 €");
  assert.equal(kleinunternehmerWaechter(10000, 101000, true).stufe, "rot", "laufendes Jahr über 100.000 €");
  assert.equal(kleinunternehmerWaechter(10000, 85000, true).stufe, "gelb");
  assert.equal(kleinunternehmerWaechter(10000, 26000, true).stufe, "gelb", "über 25.000 € → nächstes Jahr nicht mehr");
  assert.equal(kleinunternehmerWaechter(10000, 5000, true).stufe, "ok");
  assert.equal(kleinunternehmerWaechter(90000, 500000, false).stufe, "ok", "Regelbesteuerung: kein Wächter");
});

test("Umsatzsteuer: Seite", () => {
  const p = perioden(re, be, { jahr: 2026, quartal: true, ist: false, kleinunternehmer: false });
  const html = umsatzsteuerSeite(p, { jahr: 2026, quartal: true, ist: false, kleinunternehmer: false, waechter: kleinunternehmerWaechter(0, 0, false), vorjahr: 30000, laufend: 1700, heuteJahr: 2026 });
  assert.match(html, /Kz\. 81/);
  assert.match(html, /1\. Quartal/);
  assert.match(html, /übermittelt nichts/);
  const ku = umsatzsteuerSeite(perioden(re, be, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: true }), { jahr: 2026, quartal: false, ist: false, kleinunternehmer: true, waechter: kleinunternehmerWaechter(10000, 85000, true), vorjahr: 10000, laufend: 85000, heuteJahr: 2026 });
  assert.match(ku, /🟡 Kleinunternehmer-Wächter/);
  assert.match(ku, /width:85%/);
  assert.doesNotMatch(ku, /Kz\. 81/);
});

test("Umsatzsteuer S9/S20: Vorsteuer nur mit Belegdatei, gemischte Belege je Satz", () => {
  const belege = [...be,
    { datum: "2026-01-25", brutto: 238, ust_satz: 19, beleg_mime: null },
    { datum: "2026-01-28", brutto: 226, ust_satz: 19, brutto_7: "107.00", beleg_mime: "image/png" }];
  const m = perioden(re, belege, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false });
  assert.deepEqual([m[0].vorsteuer, m[0].ohneBeleg, m[0].zahllast], [45, 38, 145], "19 + (19 + 7); 38 € ohne Datei nicht gezählt");
  const html = umsatzsteuerSeite(m, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false, waechter: kleinunternehmerWaechter(0, 0, false), vorjahr: 0, laufend: 0, heuteJahr: 2026 });
  assert.match(html, /\(\+ 38,00\s€ ohne Beleg, nicht gezählt\)/);
  assert.match(html, /38,00\s€<\/strong> nicht als Vorsteuer gezählt \(kein Beleg hochgeladen\)/);
  const ohne = umsatzsteuerSeite(perioden(re, be, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false }), { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false, waechter: kleinunternehmerWaechter(0, 0, false), vorjahr: 0, laufend: 0, heuteJahr: 2026 });
  assert.doesNotMatch(ohne, /nicht als Vorsteuer gezählt/, "alle Belege mit Datei: kein Hinweis");
});

test("S13: Gründungsjahr, Umsätze außerhalb Crewtender, vorsichtige Zählung", () => {
  // Founding year: 25,000 € already for the current year.
  assert.equal(kleinunternehmerWaechter(0, 26_000, true, true).stufe, "rot");
  assert.equal(kleinunternehmerWaechter(0, 21_000, true, true).stufe, "gelb");
  assert.equal(kleinunternehmerWaechter(0, 10_000, true, true).stufe, "ok");
  assert.equal(kleinunternehmerWaechter(0, 26_000, true, false).stufe, "gelb", "sonst nur Hinweis fürs nächste Jahr");
  const html = umsatzsteuerSeite([], { jahr: 2026, quartal: false, ist: false, kleinunternehmer: true, waechter: kleinunternehmerWaechter(0, 26_000, true, true), vorjahr: 0, laufend: 26_000, heuteJahr: 2026, extern: { laufend: 1000, vorjahr: 0 }, bezahlt: 20_000, gruendungsjahr: true, admin: true });
  assert.match(html, /Gründungsjahr/);
  assert.match(html, /samt Umsätzen außerhalb Crewtender/);
  assert.match(html, /name="extern_laufend"[^>]*value="1000"/);
  assert.doesNotMatch(umsatzsteuerSeite([], { jahr: 2026, quartal: false, ist: false, kleinunternehmer: true, waechter: kleinunternehmerWaechter(0, 0, true), vorjahr: 0, laufend: 0, heuteJahr: 2026 }), /extern_laufend/, "nur Inhaber/Admin pflegen");
});

test("Reverse Charge EU in der USt-Übersicht: Kz. 21 und Zusammenfassende Meldung", () => {
  const p = perioden([{ datum: "2026-11-03", monat: "2026-11", netto: 1000, ust_satz: 0, ust_betrag: 0, reverse_charge: true, reverse_charge_eu: true }], [], { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false });
  const nov = p.find((x) => x.umsatzEu)!;
  assert.deepEqual([nov.umsatzEu, nov.umsatz13b, nov.ust], [1000, 0, 0]);
  const html = umsatzsteuerSeite(p, { jahr: 2026, quartal: false, ist: false, kleinunternehmer: false, waechter: kleinunternehmerWaechter(0, 0, false), vorjahr: 0, laufend: 0, heuteJahr: 2026 });
  assert.match(html, /EU Reverse Charge \(Kz\. 21\)/);
  assert.match(html, /Zusammenfassende Meldung/);
});
