import test from "node:test";
import assert from "node:assert/strict";
import { samAnleitung, samAnleitungSeite } from "../src/samanleitung.ts";

test("SAM-Anleitung: englisch, kostenlos, Betrugswarnung, FAQ-Daten, keine Behörde, indexierbar", () => {
  const t = samAnleitung("https://a");
  assert.match(t, /How to register in SAM\.gov \(free\)/);
  assert.match(t, /never charges a fee/);
  assert.match(t, /All Awards/);
  assert.match(t, /"@type":"FAQPage"/);
  assert.match(t, /Not affiliated with or endorsed by SAM\.gov/);
  const r = samAnleitungSeite(new Request("https://a/us/sam-registration"), "https://a", (h) => new Response(h, { headers: { "x-robots-tag": "noindex" } }))!;
  assert.equal(r.headers.get("x-robots-tag"), null);
  assert.equal(samAnleitungSeite(new Request("https://a/us"), "https://a", (h) => new Response(h)), null);
});
