import assert from "node:assert/strict";
import { test } from "node:test";
import { kiKosten, kiReserve, webSuchNutzung } from "../src/api-budget.ts";

test("Web-Suchläufe werden vorab mit Grundkosten und Ergebnistext reserviert", () => {
  assert.equal(webSuchNutzung([{ type: "web_search_20250305", max_uses: 3 }]), 3);
  assert.equal(webSuchNutzung([{ type: "web_search_20250305" }]), 0);
  assert.equal(webSuchNutzung([{ type: "web_search_20250305", max_uses: 99 }]), 10);
  assert.equal(webSuchNutzung([{ type: "web_fetch_20250910", max_uses: 5 }]), 0);
  assert.ok(Math.abs(kiReserve(1000, 1000, 5, 20, 3) - kiReserve(1000, 1000, 5, 20, 0) - 0.12) < 1e-9);
});

test("tatsächliche Web-Suchgebühren werden mit dem KI-Verbrauch abgerechnet", () => {
  assert.equal(kiKosten({ input_tokens: 1000, output_tokens: 500, server_tool_use: { web_search_requests: 3 } }, 5, 20), 0.045);
  assert.equal(kiKosten({ input_tokens: 1000, output_tokens: 500, server_tool_use: null }, 5, 20), 0.015);
});
