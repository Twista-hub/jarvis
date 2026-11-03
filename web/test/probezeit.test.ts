import assert from "node:assert/strict";
import { test } from "node:test";
import { probeHinweis } from "../src/konto.ts";

test("Probezeit-Schutz: Hinweis im Demo-Modus und bei aufgebrauchtem Kontingent", () => {
  assert.equal(probeHinweis(null), "");
  assert.equal(probeHinweis({ budget: null, verbraucht: 12 }), "", "Firmen ohne Grenze sehen nichts");
  assert.match(probeHinweis({ budget: 0, verbraucht: 0 }), /Demo-Modus.*Firmenwebsite/);
  assert.equal(probeHinweis({ budget: 5.5, verbraucht: 1.2 }), "");
  assert.match(probeHinweis({ budget: 5.5, verbraucht: 5.49 }), /aufgebraucht/);
});
