import assert from "node:assert/strict";
import { test } from "node:test";
import { CSP, statisch } from "../src/app.ts";

test("serves the app files with the right types", async () => {
  assert.equal(statisch("/sw.js")?.headers.get("content-type"), "text/javascript; charset=utf-8");
  const manifest = await statisch("/manifest.webmanifest")!.json();
  assert.equal(manifest.start_url, "/konto");
  const png = new Uint8Array(await statisch("/icon-192.png")!.arrayBuffer());
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]); // "PNG"
  assert.equal(statisch("/geheim"), null);
  assert.match(CSP, /script-src 'self'/);
});
