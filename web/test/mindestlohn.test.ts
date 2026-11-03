import assert from "node:assert/strict";
import { test } from "node:test";
import { mindestlohnHeute, MINDESTLOHN_2026, MINDESTLOHN_2027 } from "../src/kalkulation.ts";

test("A-M8: statutory minimum wage switches on 1.1.2027", () => {
  assert.equal(mindestlohnHeute(new Date("2026-12-31T22:59:00Z")), MINDESTLOHN_2026);
  assert.equal(mindestlohnHeute(new Date("2027-01-01T00:00:00Z")), MINDESTLOHN_2027);
  assert.equal(MINDESTLOHN_2027, 14.6);
});
