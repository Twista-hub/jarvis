import test from "node:test";
import assert from "node:assert/strict";
import { avv, datenschutz, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";
import { avvPl, datenschutzPl, hinweisDeutschPl, impressumPl, nutzungsbedingungenPl, RECHT_PL } from "../src/rechtliches-pl.ts";

const zahl = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("Rechtsseiten Polnisch: gleicher Aufbau wie die deutsche Fassung", () => {
  for (const [de, pl] of [[impressum(), impressumPl()], [datenschutz(), datenschutzPl()], [nutzungsbedingungen(), nutzungsbedingungenPl()], [avv(), avvPl()]]) {
    for (const tag of ["h2", "li", "tr", "a"]) assert.equal(zahl(pl, tag), zahl(de, tag), `${tag} weicht ab: ${pl.slice(0, 60)}`);
  }
  assert.match(datenschutzPl(), /UODO/);
  assert.match(datenschutzPl(), /jv_einfuehrung/);
  assert.match(impressumPl(), /Biuletyn Zamówień Publicznych/);
  assert.match(impressum(), /Biuletyn Zamówień Publicznych/);
  assert.match(hinweisDeutschPl("/datenschutz"), /href="\/sprache\?zu=de&amp;weiter=%2Fdatenschutz"[^>]*>wersja niemiecka<\/a>/);
  assert.deepEqual(Object.keys(RECHT_PL).sort(), ["/avv", "/datenschutz", "/impressum", "/nutzungsbedingungen"]);
});
