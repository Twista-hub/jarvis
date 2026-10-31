import assert from "node:assert/strict";
import { test } from "node:test";
import { CSP, statisch } from "../src/app.ts";
import { datenbankPruefen } from "../src/db-check.ts";

test("serves the app files with the right types", async () => {
  assert.equal(statisch("/sw.js")?.headers.get("content-type"), "text/javascript; charset=utf-8");
  const manifest = await statisch("/manifest.webmanifest")!.json();
  assert.equal(manifest.start_url, "/konto");
  const png = new Uint8Array(await statisch("/icon-192.png")!.arrayBuffer());
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]); // "PNG"
  const js = await statisch("/app.js")!.text();
  assert.match(js, /Vorschlag wird erstellt/);
  assert.match(js, /data-einrichtung-status/);
  assert.match(js, /data-tarifgruppen/);
  assert.match(js, /option\.disabled = !!option\.value/);
  assert.match(js, /location\.hash === "#tarifvertraege"/);
  assert.match(js, /tarifverwaltung\.open = true/);
  assert.match(js, /data-bereich-einzel/);
  assert.match(js, /istLeitung = rolle\.value === "standortleitung"/);
  assert.equal(statisch("/geheim"), null);
  assert.match(CSP, /script-src 'self'/);
});

test("interner Datenbanktest ist ohne den einmaligen Deployment-Code nicht erreichbar", async () => {
  const r = await datenbankPruefen("falscher-testcode-123456", "0".repeat(64), {});
  assert.equal(r.status, 404);
});
