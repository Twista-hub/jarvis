import assert from "node:assert/strict";
import { test } from "node:test";
import { rechnen, STANDARD, vorlageFuerBereich, zahl } from "../src/kalkulation.ts";

test("Standortvorlage schlägt Regions- und Firmenwerte; ohne Standortvorlage gilt die nächste vorhandene Ebene", () => {
  const bereiche = [{ id: "region", parent_id: null }, { id: "ort", parent_id: "region" }];
  const vorlagen = [
    { bereich_id: null, eingaben: { lohn: 10 } },
    { bereich_id: "region", eingaben: { lohn: 20 } },
    { bereich_id: "ort", eingaben: { lohn: 30 } },
  ];
  assert.equal(vorlageFuerBereich("ort", bereiche, vorlagen)?.lohn, 30);
  assert.equal(vorlageFuerBereich("anderer-ort", bereiche, vorlagen)?.lohn, 10);
  assert.equal(vorlageFuerBereich(null, bereiche, vorlagen)?.lohn, 10);
});

const lose = [
  { nr: "1", name: "Kantine", menge: 1000, einheit: "Stunden", zeitraum: "2027", hinweis: "" },
  { nr: "2", name: "Pauschale", menge: 1, einheit: "pauschal", zeitraum: "", hinweis: "" },
];

test("price per hour follows the surcharge chain", () => {
  const e = { ...STANDARD, lohn: 15, nebenkosten: 20, ausfall: 0, zuschlaege: 0, gemeinkosten: 10, gewinn: 10, sonstiges: 1 };
  const r = rechnen(e, lose, {});
  // 15 * 1.2 = 18; * 1.1 = 19.8; + 1 = 20.8; * 1.1 = 22.88
  assert.equal(r.preisProStunde, 22.88);
  assert.equal(r.lose[0].netto, 22880);
  assert.equal(r.lose[1].stunden, 0);
  assert.equal(r.netto, 22880);
  assert.equal(r.brutto, 27227.2);
  assert.ok(r.warnungen.some((w) => w.includes("nicht in Stunden")));
});

test("entered hours override, minimum wage warning", () => {
  const r = rechnen({ ...STANDARD, lohn: 12 }, lose, { "2": 10 });
  assert.equal(r.lose[1].stunden, 10);
  assert.ok(r.warnungen.some((w) => w.includes("Mindestlohn")));
});

test("german number input", () => {
  assert.equal(zahl("14,50", 0), 14.5);
  assert.equal(zahl("1.234,5", 0), 1234.5);
  assert.equal(zahl("23 %", 0), 23);
  assert.equal(zahl("10.800", 0), 10800);
  assert.equal(zahl("2.5", 0), 2.5);
  assert.equal(zahl("", 7), 7);
  assert.equal(zahl("abc", 7), 7);
  assert.equal(zahl("-3", 7), 7);
});

test("shift model: night, Sunday and overtime surcharges on their share of hours", () => {
  const e = { ...STANDARD, lohn: 20, nebenkosten: 0, ausfall: 0, gemeinkosten: 0, gewinn: 0, anteilNacht: 20, zuschlagNacht: 25, anteilSonntag: 10, zuschlagSonntag: 50 };
  // 0.2 * 25 % + 0.1 * 50 % = 10 % on average → 22 €
  assert.equal(rechnen(e, [], {}).preisProStunde, 22);
});

test("assignment costs per hour, accommodation only for lots away from home, own wage per lot", () => {
  const e = { ...STANDARD, lohn: 20, nebenkosten: 0, ausfall: 0, gemeinkosten: 0, gewinn: 0, stundenTag: 8, fahrt: 8, unterkunft: 40, einmalig: 100, stundenKraft: 100 };
  const r = rechnen(e, lose, {}, { "1": { lohn: 24, auswaerts: true } });
  // base: 20 + 8/8 + 100/100 = 22
  assert.equal(r.preisProStunde, 22);
  // lot 1: 24 + (8 + 40)/8 + 1 = 31
  assert.equal(r.lose[0].preisProStunde, 31);
  assert.equal(r.lose[0].netto, 31000);
});

test("old saved values without the new fields still calculate", () => {
  const alt = { lohn: 15, nebenkosten: 20, ausfall: 0, zuschlaege: 0, gemeinkosten: 10, gewinn: 10, sonstiges: 1 };
  assert.equal(rechnen(alt, [], {}).preisProStunde, 22.88);
});

test("Stunden je Los: aus der Menge oder aus dem Hinweis, passend zum Zeitraum", async () => {
  const { losStunden } = await import("../src/kalkulation.ts");
  assert.equal(losStunden({ menge: 1200, einheit: "Std.", zeitraum: "", hinweis: "" }), 1200);
  assert.equal(losStunden({ menge: 1, einheit: "Person", zeitraum: "pro Jahr", hinweis: "07:00–21:00, 8 h; Gesamt 500 Std. in 2 Jahren" }), 250);
  assert.equal(losStunden({ menge: 2, einheit: "Kräfte", zeitraum: "", hinweis: "Gesamt 1.600 Stunden" }), 1600);
  assert.equal(losStunden({ menge: 3, einheit: "Personen", zeitraum: "", hinweis: "nach Bedarf" }), 0);
});
