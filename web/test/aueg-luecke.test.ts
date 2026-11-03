import assert from "node:assert/strict";
import { test } from "node:test";
import { fristen } from "../src/aueg.ts";

const u = (von: string, bis: string | null) => ({ personal_id: "p", entleiher: "Kunde", von, bis }) as never;

test("A-M1: a gap of exactly three months continues the count, one day more starts anew", () => {
  const weiter = fristen([u("2025-06-01", "2026-01-31"), u("2026-05-01", null)], "2026-06-01");
  assert.equal(weiter[0].beginn, "2025-06-01", "Feb–Apr = 3 months gap, still counted");
  const neu = fristen([u("2025-06-01", "2026-01-31"), u("2026-05-02", null)], "2026-06-01");
  assert.equal(neu[0].beginn, "2026-05-02", "more than 3 months gap starts a new count");
});

test("A-M2: AÜG permit missing, expiring or expired is shown", async () => {
  const { erlaubnisHinweis } = await import("../src/aueg.ts");
  assert.match(erlaubnisHinweis(null, "2026-11-03"), /Keine Erlaubnis/);
  assert.match(erlaubnisHinweis({ bis: "2026-12-31" }, "2026-11-03"), /läuft am 31\.12\.2026 ab/);
  assert.match(erlaubnisHinweis({ bis: "2026-10-01" }, "2026-11-03"), /abgelaufen/);
  assert.equal(erlaubnisHinweis({ bis: null }, "2026-11-03"), "", "unlimited permit");
  assert.equal(erlaubnisHinweis(undefined, "2026-11-03"), "", "could not be read");
});
