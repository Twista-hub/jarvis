import assert from "node:assert/strict";
import { test } from "node:test";
import { konto } from "../src/konto.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const vorgang = "33333333-3333-4333-8333-333333333333";
const token = `h.${btoa(JSON.stringify({ sub: user, email: "test@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;

function mockKontoApi(t: Parameters<typeof test>[1] extends (t: infer T) => unknown ? T : never) {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const pfad = url.pathname.split("/rest/v1/")[1] ?? "";
    let daten: unknown = [];
    if (pfad === "mitglieder" && url.searchParams.has("user_id")) {
      daten = [{ firma_id: firma, rolle: "inhaber", erstellt: "2026-01-01T00:00:00Z", user_id: user, firmen: { name: "Musterfirma", paket: "kostenlos" } }];
    } else if (pfad === "mitglieder" && url.searchParams.has("firma_id")) {
      daten = [{ firma_id: firma, rolle: "inhaber", erstellt: "2026-01-01T00:00:00Z", user_id: user }];
    } else if (pfad === "vorgaenge" && url.searchParams.has("id")) {
      daten = [{ id: vorgang, firma_id: firma, titel: "Beispielauftrag", link: "https://portal.test/auftrag", frist: null, status: "neu", punkte: 8, erstellt: "2026-01-01T00:00:00Z", steckbrief: "Bekanntmachung" }];
    }
    return new Response(JSON.stringify(daten), { status: 200, headers: { "content-type": "application/json" } });
  });
}

async function seite(pfad: string): Promise<string> {
  const response = await konto(new Request(`https://jarvis.test${pfad}`, { headers: { cookie: `jv_at=${token}` } }), {
    SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public",
  });
  assert.ok(response);
  assert.equal(response.status, 200);
  return response.text();
}

test("Konto-Übersicht zeigt die sechs großen Bereiche und feste Mobilnavigation", async (t) => {
  mockKontoApi(t);
  const html = await seite("/konto");
  for (const titel of ["Ausschreibungen", "Fristen", "Unterlagen", "Kalkulation", "Firma & Team", "Einstellungen"]) {
    assert.ok(html.includes(titel), `Kachel fehlt: ${titel}`);
  }
  assert.match(html, /class="konto-kacheln"/);
  assert.match(html, /class="konto-nav"/);
  assert.match(html, /position: fixed/);
});

test("Unterseiten bieten Zurück und behalten Einstellungen mit Handy-Nachrichten", async (t) => {
  mockKontoApi(t);
  for (const [pfad, titel] of [
    ["/konto/ausschreibungen", "Ausschreibungen"], ["/konto/fristen", "Fristen"],
    ["/konto/unterlagen", "Unterlagen"], ["/konto/kalkulation", "Kalkulation"],
    ["/konto/firma-team", "Firma & Team"], ["/konto/einstellungen", "Einstellungen"],
  ]) {
    const html = await seite(pfad);
    assert.ok(html.includes(titel), `${pfad} zeigt Überschrift`);
    assert.ok(html.includes("← Zurück"), `${pfad} zeigt Zurück-Link`);
    assert.ok(html.includes("class=\"konto-nav\""), `${pfad} zeigt Mobilnavigation`);
  }
  const einstellungen = await seite("/konto/einstellungen");
  assert.match(einstellungen, /id="push-an"/);
  assert.match(einstellungen, /id="push-test"/);
  assert.match(einstellungen, /id="push-status"/);
});

test("Ausschreibungsdetail behält den Upload für Vergabeunterlagen", async (t) => {
  mockKontoApi(t);
  const html = await seite(`/konto/vorgang/${vorgang}`);
  assert.match(html, /action="\/konto\/vorgang\/33333333-3333-4333-8333-333333333333\/unterlagen"/);
  assert.match(html, /type="file" multiple required data-sofort/);
  assert.match(html, /Hier runterladen/);
});
