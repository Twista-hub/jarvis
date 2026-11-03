import assert from "node:assert/strict";
import { test } from "node:test";
import { personenMaskieren } from "../src/datensparsam.ts";

test("K4: contact persons are masked before the AI, functional addresses stay", () => {
  const t = personenMaskieren("Ansprechpartner: Herr Dr. Max Mustermann, max.mustermann@stadt-aachen.de, Tel. 0241 123. Fragen an vergabe@stadt-aachen.de oder zentrale.vergabe@kreis.de. Frau Anna-Lena Schulz, m.mueller@bund.de, info@x.de");
  assert.ok(!/Mustermann|Schulz|max\.mustermann|m\.mueller/.test(t), t);
  for (const s of ["[Name]@stadt-aachen.de", "vergabe@stadt-aachen.de", "zentrale.vergabe@kreis.de", "info@x.de", "Herr [Name]", "Frau [Name]", "0241 123"]) assert.ok(t.includes(s), s);
});
