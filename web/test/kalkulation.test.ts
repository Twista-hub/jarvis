import assert from "node:assert/strict";
import { test } from "node:test";
import { rechnen, STANDARD, zahl } from "../src/kalkulation.ts";

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
