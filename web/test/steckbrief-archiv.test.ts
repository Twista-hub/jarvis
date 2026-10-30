import assert from "node:assert/strict";
import { test } from "node:test";
import { konto } from "../src/konto.ts";

const id = "33333333-3333-4333-8333-333333333333";
const firma = "7e4a6c1e-5c2b-4f0a-9d3e-000000000001";
for (const [name, firm, text, erwartet] of [
  ["historischer Treffer ohne Steckbrief", firma, null, "Sach- und IT-Haushalt"],
  ["vorhandener Steckbrief hat Vorrang", firma, "Vollständig geprüft", "Vollständig geprüft"],
  ["Archiv ist an die Firma gebunden", "11111111-1111-4111-8111-111111111111", null, "Noch kein Steckbrief"],
] as const) {
  test(name, async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      const table = new URL(String(input)).pathname.split("/rest/v1/")[1];
      return Response.json(table === "vorgaenge" ? [{ id, firma_id: firm, titel: "Rahmenvertrag Beschaffung und Haushalt", link: "https://www.evergabe-online.de/tenderdocuments.html?id=890510", steckbrief: text, status: "neu", frist: null }] : table === "mitglieder" ? [{ rolle: "inhaber" }] : []);
    });
    const token = `h.${btoa(JSON.stringify({sub:"user",exp:4000000000}))}.s`;
    const r = await konto(new Request(`https://jarvis.test/konto/vorgang/${id}`, { headers: {cookie:`jv_at=${token}`} }), { SUPABASE_URL:"https://db.test", SUPABASE_KEY:"public" });
    assert.equal(r!.status, 200);
    const html = await r!.text();
    assert.ok(html.includes(erwartet));
    assert.match(html, /Prüfen lassen/);
    assert.doesNotMatch(html, /Treffer verstehen/);
    if (text) assert.doesNotMatch(html, /archivierte Zusammenfassung/);
  });
}
