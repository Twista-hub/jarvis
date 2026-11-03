import test from "node:test";
import assert from "node:assert/strict";
import { aktiveFirma } from "../src/firmenunterlagen.ts";
import { angebotsUebersicht } from "../src/angebotsuebersicht.ts";

const firma = "11111111-1111-4111-8111-111111111111", user = "22222222-2222-4222-8222-222222222222", alt = "99999999-9999-4999-8999-999999999999";
const token = `h.${btoa(JSON.stringify({ sub: user, email: "t@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;
const env = { SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public" };
const anfrage = (pfad: string, cookie = "") => new Request(`https://jarvis.test${pfad}`, { headers: { cookie: `jv_at=${token}${cookie}` } });

test("Firmenwahl: veraltetes Firmen-Cookie fällt auf die erste aktive Firma zurück und wird repariert", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const daten = url.pathname.endsWith("/mitglieder") ? [{ firma_id: firma, rolle: "inhaber", finanzen: true, firmen: { name: "Musterfirma" } }] : [];
    return new Response(JSON.stringify(daten), { status: 200, headers: { "content-type": "application/json" } });
  });
  const f = await aktiveFirma(anfrage("/konto/angebote", `; jv_firma=${alt}`), env);
  assert.equal(f?.m.firma_id, firma);
  assert.ok(f?.s.cookies.some((c) => c.startsWith(`jv_firma=${firma}`)), "Cookie wird auf die gültige Firma gesetzt");
  assert.equal(await aktiveFirma(anfrage(`/konto/angebote?firma=${alt}`), env), null, "ausdrückliche fremde Firma bleibt gesperrt");
  const r = await angebotsUebersicht(anfrage("/konto/angebote", `; jv_firma=${alt}`), env);
  assert.equal(r?.status, 200, "Angebote öffnet sich statt zurück zur Startseite zu springen");
});
