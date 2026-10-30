import assert from "node:assert/strict";
import { test } from "node:test";
import { berlinZuIso, einsatzplan, isoZuBerlin, planText } from "../src/einsatzplan.ts";

test("Berliner Uhrzeit: Sommer- und Winterzeit richtig umgerechnet", () => {
  assert.equal(berlinZuIso("2026-11-03T07:00"), "2026-11-03T06:00:00.000Z");
  assert.equal(berlinZuIso("2026-07-03T07:00"), "2026-07-03T05:00:00.000Z");
  assert.equal(isoZuBerlin("2026-11-03T06:00:00.000Z"), "2026-11-03T07:00");
  assert.equal(berlinZuIso("quatsch"), null);
});

test("Einsatzplan als Nachricht mit Ort, Beginn, Team und Gruß", () => {
  const t = planText({ titel: "Bankett Messe", firma: "PerLease", anrede: "Eva", team: [{ name: "Eva Muster", beruf: "Servicekraft" }],
    plan: { ort: "Halle 5", beginn: "2026-11-03T06:00:00.000Z", ende: null, treffpunkt: "", kleidung: "Komplett schwarz", ansprechpartner: "", hinweise: "" } });
  assert.match(t, /^Hallo Eva,/);
  assert.match(t, /📍 Ort: Halle 5/);
  assert.match(t, /🗓️ Beginn: Di\., 03\.11\.2026, 07:00 Uhr/);
  assert.match(t, /• Eva Muster \(Servicekraft\)/);
  assert.match(t, /PerLease$/);
  assert.doesNotMatch(t, /\n\n\n/);
});

test("Rundnachricht: Verfügbare mit SMS an alle und WhatsApp pro Person", async (t) => {
  const token = `h.${btoa(JSON.stringify({ sub: "u1", email: "c@t.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;
  const k = (id: string, vorname: string, status: string) => ({ id, firma_id: "f", bereich_id: null, vorname, nachname: "", berufe: ["Servicekraft"], qualifikationen: [], eg: "", telefon: "0170 111", email: "", status, notiz: "" });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const pfad = new URL(String(input)).pathname.split("/rest/v1/")[1];
    const daten = pfad === "mitglieder" ? [{ firma_id: "f", rolle: "inhaber", finanzen: true, firmen: { name: "PerLease" } }]
      : pfad === "personal" ? [k("a1111111-1111-4111-8111-111111111111", "Eva", "verfuegbar"), k("b2222222-2222-4222-8222-222222222222", "Tom", "einsatz")] : [];
    return new Response(JSON.stringify(daten), { status: 200 });
  });
  const r = await einsatzplan(new Request("https://jarvis.test/konto/rundnachricht", { headers: { cookie: `jv_at=${token}` } }), { SUPABASE_URL: "https://sb.test", SUPABASE_KEY: "pk" });
  const html = await r!.text();
  assert.match(html, /1 Person passt/);
  assert.match(html, /href="sms:0170111\?body=Hallo%20zusammen/);
  assert.match(html, /href="https:\/\/wa\.me\/49170111\?text=Hallo%20Eva/);
  assert.doesNotMatch(html, /Hallo%20Tom/);
});
