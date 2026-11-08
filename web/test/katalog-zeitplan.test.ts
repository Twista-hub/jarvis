import test from "node:test";
import assert from "node:assert/strict";
import { ablaeufeAnstossen } from "../src/katalog-zeitplan.ts";

test("Zeitplan: Cloudflare stößt Mail und Social an, nur mit Schlüssel und zu passenden Stunden", async () => {
  const aufrufe: { url: string; body: string; auth: string }[] = [];
  const holen = (async (url: string, init: RequestInit) => { aufrufe.push({ url, body: String(init.body), auth: (init.headers as Record<string, string>).authorization }); return new Response(null, { status: 204 }); }) as typeof fetch;
  assert.deepEqual(await ablaeufeAnstossen({}, new Date("2026-11-10T08:11:00Z"), holen), [], "ohne Schlüssel nichts");
  assert.equal(aufrufe.length, 0);
  // 09:11 Berlin (winter time): mail and social.
  assert.deepEqual(await ablaeufeAnstossen({ GH_DISPATCH_TOKEN: "t" }, new Date("2026-11-10T08:11:00Z"), holen), ["mail.yml", "social.yml"]);
  assert.match(aufrufe[0].url, /\/actions\/workflows\/mail\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(aufrufe[1].body), { ref: "main", inputs: { modus: "posten" } });
  assert.equal(aufrufe[0].auth, "Bearer t");
  // 07:11 Berlin: only the mail; 23:11 Berlin: nothing.
  assert.deepEqual(await ablaeufeAnstossen({ GH_DISPATCH_TOKEN: "t" }, new Date("2026-11-10T06:11:00Z"), holen), ["mail.yml"]);
  assert.deepEqual(await ablaeufeAnstossen({ GH_DISPATCH_TOKEN: "t" }, new Date("2026-11-10T22:11:00Z"), holen), []);
});
