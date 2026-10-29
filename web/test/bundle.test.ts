import assert from "node:assert/strict";
import { test } from "node:test";
import { bundle, wanted } from "../src/bundle.ts";

test("skips boilerplate and unreadable files", () => {
  assert.equal(wanted("B01_Leistungsbeschreibung.pdf"), true);
  assert.equal(wanted("Tarifvertrag_Gastro.pdf"), false);
  assert.equal(wanted("bild.png"), false);
  assert.equal(wanted("__MACOSX/x.pdf"), false);
});

test("puts the Leistungsbeschreibung first and respects the limit", () => {
  const { text, skipped } = bundle(
    [
      { name: "z_anlage.pdf", text: "Anlage" },
      { name: "ordner/Leistungsbeschreibung.pdf", text: "LB   mit\n\n\nLücken" },
      { name: "riesig.pdf", text: "x".repeat(100) },
    ],
    50,
  );
  assert.ok(text.startsWith("===== DATEI: ordner/Leistungsbeschreibung.pdf\nLB mit\nLücken"));
  assert.ok(text.includes("Anlage"));
  assert.deepEqual(skipped, ["riesig.pdf (zu lang)"]);
});
