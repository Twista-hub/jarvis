import test from "node:test";
import assert from "node:assert/strict";
import { avv, datenschutz, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";
import { avvEs, datenschutzEs, hinweisDeutschEs, impressumEs, nutzungsbedingungenEs, RECHT_ES } from "../src/rechtliches-es.ts";

const zahl = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("Rechtsseiten Spanisch: gleicher Aufbau wie die deutsche Fassung", () => {
  for (const [de, es] of [[impressum(), impressumEs()], [datenschutz(), datenschutzEs()], [nutzungsbedingungen(), nutzungsbedingungenEs()], [avv(), avvEs()]]) {
    for (const tag of ["h2", "li", "tr", "a"]) assert.equal(zahl(es, tag), zahl(de, tag), `${tag} weicht ab: ${es.slice(0, 60)}`);
  }
  assert.match(datenschutzEs(), /AEPD/);
  assert.match(datenschutzEs(), /jv_einfuehrung/);
  assert.match(impressumEs(), /Generalitat de Catalunya/);
  assert.match(impressum(), /Generalitat de Catalunya/);
  assert.match(hinweisDeutschEs("/datenschutz"), /href="\/sprache\?zu=de&amp;weiter=%2Fdatenschutz"[^>]*>versión alemana<\/a>/);
  assert.deepEqual(Object.keys(RECHT_ES).sort(), ["/avv", "/datenschutz", "/impressum", "/nutzungsbedingungen"]);
});
