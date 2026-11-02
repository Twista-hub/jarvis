import test from "node:test";
import assert from "node:assert/strict";
import { avv, datenschutz, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";
import { avvFr, datenschutzFr, hinweisDeutsch, impressumFr, nutzungsbedingungenFr } from "../src/rechtliches-fr.ts";

const zahl = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("Rechtsseiten Französisch: gleicher Aufbau wie die deutsche Fassung", () => {
  for (const [de, fr] of [[impressum(), impressumFr()], [datenschutz(), datenschutzFr()], [nutzungsbedingungen(), nutzungsbedingungenFr()], [avv(), avvFr()]]) {
    for (const tag of ["h2", "li", "tr", "a"]) assert.equal(zahl(fr, tag), zahl(de, tag), `${tag} weicht ab: ${fr.slice(0, 60)}`);
  }
  assert.match(datenschutzFr(), /CNIL/);
  assert.match(datenschutzFr(), /jv_einfuehrung/);
  assert.match(datenschutz(), /jv_einfuehrung/);
  assert.match(impressumFr(), /BOAMP, DILA/);
  assert.match(impressum(), /BOAMP, DILA/);
  assert.match(hinweisDeutsch("/datenschutz"), /href="\/sprache\?zu=de&amp;weiter=%2Fdatenschutz"[^>]*>version allemande<\/a> fait foi/);
});
