import test from "node:test";
import assert from "node:assert/strict";
import { GRENZEN, grenzen, PLAENE, planName, planSeite } from "../src/plaene.ts";

test("Pläne: Struktur nach Vorschlag, Preise noch nicht festgelegt, nichts erzwungen", () => {
  assert.deepEqual(PLAENE.map((p) => p.id), ["kostenlos", "basis", "pro", "business"]);
  for (const p of PLAENE) assert.ok(GRENZEN[p.id], `Grenzen fehlen: ${p.id}`);
  assert.ok(PLAENE.filter((p) => p.id !== "kostenlos").every((p) => p.preis === "Preis folgt"), "Preise erst nach Benjamins OK");
  assert.doesNotMatch(planSeite("kostenlos", "F", true, "a@b.c"), /59 €|149 €|399 €/, "Vorschlagspreise werden nicht angezeigt");
  assert.equal(grenzen("erfolg").arbeitsoberflaeche, true, "alte Plan-IDs behalten vollen Zugang");
  assert.equal(grenzen("pro").einsatzkraefte, 25);
  assert.equal(planName("business"), "Business");
});
