import assert from "node:assert/strict";
import { test } from "node:test";
import { kiKosten, kiReserve, streamNutzung, webSuchNutzung } from "../src/api-budget.ts";

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

test("gestreamte Antworten werden mit dem echten Verbrauch abgerechnet", () => {
  const sse = [
    'event: message_start',
    'data: {"type":"message_start","message":{"id":"m","usage":{"input_tokens":40000,"cache_read_input_tokens":0,"output_tokens":1}}}',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Steckbrief"}}',
    'event: message_delta',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12000}}',
    'data: kaputt',
  ].join("\n");
  const n = streamNutzung(sse)!;
  assert.equal(n.input_tokens, 40000);
  assert.equal(n.output_tokens, 12000);
  assert.equal(kiKosten(n, 5, 20), 0.44);
  assert.equal(streamNutzung("event: ping\ndata: {\"type\":\"ping\"}"), null);
});
