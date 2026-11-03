import assert from "node:assert/strict";
import { test } from "node:test";
import { einsatzkraefteZusatz } from "../src/plaene.ts";

test("Zusatzpreis je Einsatzkraft: Pro 3,50 €, Business 3 €, ab der 501. 2,50 €", () => {
  assert.equal(einsatzkraefteZusatz("pro", 25), 0);
  assert.equal(einsatzkraefteZusatz("pro", 35), 35);
  assert.equal(einsatzkraefteZusatz("business", 80), 0);
  assert.equal(einsatzkraefteZusatz("business", 300), 600);
  assert.equal(einsatzkraefteZusatz("business", 500), 1200);
  assert.equal(399 + einsatzkraefteZusatz("business", 1000), 2849);
  assert.equal(einsatzkraefteZusatz("basis", 10), 0);
});
