import assert from "node:assert/strict";
import { test } from "node:test";
import { CSP, statisch } from "../src/app.ts";
import { datenbankPruefen } from "../src/db-check.ts";
import { Script } from "node:vm";

test("serves the app files with the right types", async () => {
  assert.equal(statisch("/sw.js")?.headers.get("content-type"), "text/javascript; charset=utf-8");
  const manifest = await statisch("/manifest.webmanifest")!.json();
  assert.equal(manifest.start_url, "/konto");
  const png = new Uint8Array(await statisch("/icon-192.png")!.arrayBuffer());
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]); // "PNG"
  const js = await statisch("/app.js")!.text();
  assert.doesNotThrow(() => new Script(js), "das tatsächlich ausgelieferte Skript muss gültig sein");
  assert.match(js, /Firma wird recherchiert/);
  assert.match(js, /data-einrichtung-status/);
  assert.match(js, /data-auto-einrichtung/);
  assert.match(js, /data-tarifgruppen/);
  assert.match(js, /option\.disabled = !!option\.value/);
  assert.match(js, /ziel\.tagName === "DETAILS"/);
  assert.match(js, /ziel\.open = true/);
  assert.match(js, /data-bereich-einzel/);
  assert.match(js, /istLeitung = rolle\.value === "standortleitung"/);
  assert.equal(statisch("/geheim"), null);
  assert.match(CSP, /script-src 'self'/);
});

test("interner Datenbanktest ist ohne den einmaligen Deployment-Code nicht erreichbar", async () => {
  const r = await datenbankPruefen("falscher-testcode-123456", "0".repeat(64), {});
  assert.equal(r.status, 404);
});

test("Android-App: assetlinks.json ist gültiges JSON mit Paketname und Fingerabdrücken im richtigen Format", async () => {
  const { APP_FINGERABDRUECKE, APP_PAKET } = await import("../src/app.ts");
  const r = statisch("/.well-known/assetlinks.json")!;
  assert.equal(r.headers.get("content-type"), "application/json");
  const liste = await r.json() as any[];
  assert.equal(APP_PAKET, "eu.crewtender.app");
  for (const f of APP_FINGERABDRUECKE) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, "SHA-256 in Großbuchstaben mit Doppelpunkten");
  if (APP_FINGERABDRUECKE.length) {
    assert.equal(liste[0].target.package_name, APP_PAKET);
    assert.deepEqual(liste[0].target.sha256_cert_fingerprints, APP_FINGERABDRUECKE);
    assert.deepEqual(liste[0].relation, ["delegate_permission/common.handle_all_urls"]);
  } else assert.deepEqual(liste, []);
});
