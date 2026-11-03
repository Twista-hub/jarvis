import test from "node:test";
import assert from "node:assert/strict";
import { avv, datenschutz, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";
import { avvEn, datenschutzEn, hinweisDeutschEn, impressumEn, nutzungsbedingungenEn, RECHT_EN } from "../src/rechtliches-en.ts";
import { uebersetzen } from "../src/englisch.ts";

const zahl = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("Rechtsseiten Englisch: gleicher Aufbau wie die deutsche Fassung", () => {
  for (const [de, en] of [[impressum(), impressumEn()], [datenschutz(), datenschutzEn()], [nutzungsbedingungen(), nutzungsbedingungenEn()], [avv(), avvEn()]]) {
    for (const tag of ["h2", "li", "tr", "a"]) assert.equal(zahl(en, tag), zahl(de, tag), `${tag} weicht ab: ${en.slice(0, 60)}`);
    // The English office dictionary must leave the translated text as it is.
    assert.equal(uebersetzen(en, "en"), en);
  }
  assert.match(datenschutzEn(), /GDPR/);
  assert.doesNotMatch(datenschutzEn() + avvEn() + nutzungsbedingungenEn(), /DSGVO/);
  assert.match(datenschutzEn(), /jv_einfuehrung/);
  assert.match(nutzungsbedingungenEn(), /§ 14 BGB/);
  assert.match(impressumEn(), /Generalitat de Catalunya/);
  assert.match(impressum(), /Generalitat de Catalunya/);
  assert.match(hinweisDeutschEn("/datenschutz"), /href="\/sprache\?zu=de&amp;weiter=%2Fdatenschutz"[^>]*>German version<\/a>/);
  assert.deepEqual(Object.keys(RECHT_EN).sort(), ["/avv", "/datenschutz", "/impressum", "/nutzungsbedingungen"]);
});
