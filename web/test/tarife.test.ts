import assert from "node:assert/strict";
import { test } from "node:test";
import { rechnen, STANDARD } from "../src/kalkulation.ts";
import { lohnAm, tariflohn } from "../src/tarife.ts";

test("wage on a day follows the tables of the DGB/GVP agreement", () => {
  assert.equal(lohnAm("1", "2026-08-31", 0), 14.96);
  assert.equal(lohnAm("1", "2026-09-01", 0), 15.33);
  assert.equal(lohnAm("2b", "2027-04-01", 0), 16.64);
  assert.equal(lohnAm("9", "2027-12-01", 0), 30.45);
});

test("average wage over the contract period includes known increases", () => {
  // Nov 2026 – Oct 2028: 5 months × 15,33 + 19 months × 15,87 → 15,76
  assert.equal(tariflohn("1", { beginn: "2026-11-01", monate: 24, steigerung: 0, erfahrung: false }), 15.76);
  // with 3 % per year after 04/2027 (from 04/2028 on) → 15,90
  assert.equal(tariflohn("1", { beginn: "2026-11-01", monate: 24, steigerung: 3, erfahrung: false }), 15.9);
});

test("experience surcharges after 9 and 12 months raise the average", () => {
  const ohne = tariflohn("3", { beginn: "2027-04-01", monate: 24, steigerung: 0, erfahrung: false });
  const mit = tariflohn("3", { beginn: "2027-04-01", monate: 24, steigerung: 0, erfahrung: true });
  assert.equal(ohne, 17.71);
  // 9 months base, 3 months +1,5 %, 12 months +3 %
  assert.equal(mit, Math.round(((9 * 17.71 + 3 * 17.71 * 1.015 + 12 * 17.71 * 1.03) / 24) * 100) / 100);
});

test("lots with a wage group use the tariff wage and warn about equal pay", () => {
  const lose = [{ nr: "1", name: "Koch", menge: 100, einheit: "Stunden", zeitraum: "", hinweis: "" }];
  const tarif = { beginn: "2026-11-01", monate: 24, steigerung: 0, erfahrung: false };
  const r = rechnen({ ...STANDARD }, lose, {}, { "1": { eg: "1", lohn: 30 } }, tarif);
  assert.equal(r.lose[0].lohn, 15.76);
  assert.equal(r.lose[0].eg, "1");
  assert.ok(r.warnungen.some((w) => w.includes("Equal Pay")));
  // without a tariff choice the own wage counts
  assert.equal(rechnen({ ...STANDARD }, lose, {}, { "1": { eg: "1", lohn: 30 } }).lose[0].lohn, 30);
});
