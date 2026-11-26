import { test } from "node:test";
import assert from "node:assert/strict";
import { socialBild, socialBildSchluessel } from "../src/social-bild.ts";

test("Post-Bilder: nur Namen unter social/ sind öffentlich", async () => {
  assert.equal(socialBildSchluessel("/social/bild/2026-11-27-zahl.jpg"), "social/2026-11-27-zahl.jpg");
  for (const p of ["/social/bild/../sicherung/x.jpg", "/social/bild/2026-11-27-zahl.png", "/social/bild/2026-11-27.jpg", "/social/bild/2026-11-27-zahl.jpg/x", "/social/bild/", "/sicherung/jarvis-2026-11-27.tar.enc"])
    assert.equal(socialBildSchluessel(p), null, p);
  const gelesen: string[] = [];
  const env = { DATEN: { get: async (k: string) => { gelesen.push(k); return k === "social/2026-11-27-zahl.jpg" ? { body: "JPEG" } : null; } } } as any;
  const da = await socialBild("/social/bild/2026-11-27-zahl.jpg", env);
  assert.equal(da?.status, 200);
  assert.equal(da?.headers.get("content-type"), "image/jpeg");
  assert.equal((await socialBild("/social/bild/2026-11-28-tipp.jpg", env))?.status, 404);
  assert.equal(await socialBild("/konto", env), null);
  assert.deepEqual(gelesen, ["social/2026-11-27-zahl.jpg", "social/2026-11-28-tipp.jpg"]);
});
