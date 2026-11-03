import assert from "node:assert/strict";
import { test } from "node:test";
import { ANLEITUNGEN, hilfecenter } from "../src/hilfecenter.ts";

const seite = (t: string, i: string) => `<h1>${t}</h1>${i}`;
const get = (p: string) => hilfecenter(new Request(`https://jarvis.test${p}`), seite);

test("help center: overview lists every guide, guides have steps and valid links, unknown slugs 404", async () => {
  const uebersicht = await get("/hilfe")!.text();
  for (const a of ANLEITUNGEN) assert.ok(uebersicht.includes(`href="/hilfe/${a.slug}"`), a.slug);
  assert.equal(new Set(ANLEITUNGEN.map((a) => a.slug)).size, ANLEITUNGEN.length, "slugs unique");
  for (const a of ANLEITUNGEN) {
    const html = await get(`/hilfe/${a.slug}`)!.text();
    assert.ok(a.schritte.length >= 3 && html.includes("<ol"), a.slug);
    for (const [, link] of a.schritte) if (link) assert.match(link, /^\/(konto\/[a-z/-]+|registrieren|avv|datenschutz)$/, link);
  }
  assert.equal(get("/hilfe/gibt-es-nicht")!.status, 404);
  assert.equal(get("/konto/hilfe"), null);
  assert.ok(ANLEITUNGEN.some((a) => a.slug === "ki" && /Art\. 4/.test(a.fuer)), "AI literacy guide");
});
