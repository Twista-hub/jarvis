import test from "node:test";
import assert from "node:assert/strict";
import { avv, datenschutz, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";
import { avvIt, datenschutzIt, hinweisDeutschIt, impressumIt, nutzungsbedingungenIt, RECHT_IT } from "../src/rechtliches-it.ts";

const zahl = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("Rechtsseiten Italienisch: gleicher Aufbau wie die deutsche Fassung", () => {
  for (const [de, it] of [[impressum(), impressumIt()], [datenschutz(), datenschutzIt()], [nutzungsbedingungen(), nutzungsbedingungenIt()], [avv(), avvIt()]]) {
    for (const tag of ["h2", "li", "tr", "a"]) assert.equal(zahl(it, tag), zahl(de, tag), `${tag} weicht ab: ${it.slice(0, 60)}`);
  }
  assert.match(datenschutzIt(), /Garante/);
  assert.match(datenschutzIt(), /jv_einfuehrung/);
  assert.match(impressumIt(), /Generalitat de Catalunya/);
  assert.match(impressum(), /Generalitat de Catalunya/);
  assert.match(hinweisDeutschIt("/datenschutz"), /href="\/sprache\?zu=de&amp;weiter=%2Fdatenschutz"[^>]*>versione tedesca<\/a>/);
  assert.deepEqual(Object.keys(RECHT_IT).sort(), ["/avv", "/datenschutz", "/impressum", "/nutzungsbedingungen"]);
});
