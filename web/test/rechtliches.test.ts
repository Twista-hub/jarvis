import assert from "node:assert/strict";
import { test } from "node:test";
import { avv, datenschutz, FIRMA, impressum, nutzungsbedingungen } from "../src/rechtliches.ts";

test("legal pages name the provider and mark missing address data", () => {
  for (const seite of [impressum(), datenschutz(), nutzungsbedingungen(), avv()]) assert.match(seite, /Benjamin Schiffer/);
  if (!FIRMA.strasse) assert.match(impressum(), /Straße fehlt/);
  assert.match(datenschutz(), /Anthropic/);
});
