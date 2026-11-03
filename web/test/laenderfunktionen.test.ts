import assert from "node:assert/strict";
import { test } from "node:test";
import { NUR_DEUTSCHLAND, nurDeutschlandSeite } from "../src/laenderfunktionen.ts";

test("Funktionen nach deutschem Recht nur für Firmen in Deutschland", () => {
  for (const p of ["/konto/schichten", "/konto/stunden", "/konto/lohn.csv", "/konto/lohn-lodas.txt", "/konto/rechnungen/abc.xml", "/konto/umsatzsteuer", "/konto/belege/datev.csv", "/konto/urlaub", "/konto/aueg", "/konto/disposition", "/konto/zeitkonto", "/konto/spesen", "/konto/nachkalkulation"])
    assert.ok(NUR_DEUTSCHLAND.test(p), p);
  for (const p of ["/konto", "/konto/team", "/konto/vorgang/123", "/konto/chat", "/konto/kunden", "/konto/personal/1/nachweis", "/konto/schichtenplan-alt"])
    assert.ok(!NUR_DEUTSCHLAND.test(p), p);
  assert.match(nurDeutschlandSeite("FR"), /Frankreich/);
  assert.match(nurDeutschlandSeite(""), /außerhalb Deutschlands/);
});
