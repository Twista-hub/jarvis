import assert from "node:assert/strict";
import { test } from "node:test";
import { unterlagenOhneTreffer } from "../src/unterlagen.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const vorgang = "22222222-2222-4222-8222-222222222222";
const token = `h.${btoa(JSON.stringify({ sub: "user", exp: 4_000_000_000 }))}.s`;
function anfrage() {
  const form = new FormData();
  form.set("firma", firma);
  form.set("titel", "Eigene Ausschreibung");
  form.set("dateien", new File(["Unterlagen"], "unterlagen.txt"));
  return new Request("https://jarvis.test/konto/unterlagen", { method: "POST", headers: { cookie: `jv_at=${token}` }, body: form });
}

test("Upload ohne Treffer nutzt Sitzung und Zeilenrechte und verknüpft den Steckbrief", async (t) => {
  const schritte: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${token}`);
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body));
      assert.equal(body.firma_id, firma);
      assert.equal(body.titel, "Eigene Ausschreibung");
      assert.equal(body.status, "pruefen");
      schritte.push("vorgang");
      return Response.json([{ id: vorgang }]);
    }
    return Response.json([{ rolle: "bearbeiter" }]);
  });
  const put = t.mock.fn(async (key: string, value: string) => {
    assert.equal(key, `auftraege/vorgaenge/${vorgang}.json`);
    assert.equal(JSON.parse(value).auftrag, "auftrag");
  });
  const r = await unterlagenOhneTreffer(anfrage(), { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public", DATEN: { put } as any }, {
    pruefen: async () => { schritte.push("limit"); return null; },
    starten: async (dateien, kontext) => {
      assert.equal(dateien[0].name, "unterlagen.txt");
      assert.equal(kontext.vorgang, vorgang);
      schritte.push("workflow");
      return { id: "auftrag", erstellt: new Date().toISOString() };
    },
  });
  assert.equal(r.headers.get("location"), `/konto/vorgang/${vorgang}`);
  assert.deepEqual(schritte, ["limit", "vorgang", "workflow"]);
  assert.equal(put.mock.callCount(), 1);
});

test("Leser und überschrittenes Tageslimit starten keinen Upload", async (t) => {
  let rolle = "leser";
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json([{ rolle }]));
  const starten = t.mock.fn(async () => { throw new Error("Darf nicht starten"); });
  const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public", DATEN: {} as any };
  const dienste = { pruefen: async (): Promise<[string, number]> => ["Tageslimit erreicht", 429], starten };
  let r = await unterlagenOhneTreffer(anfrage(), env, dienste);
  assert.match(decodeURIComponent(r.headers.get("location")!), /keine Unterlagen hochladen/);
  rolle = "bearbeiter";
  r = await unterlagenOhneTreffer(anfrage(), env, dienste);
  assert.match(decodeURIComponent(r.headers.get("location")!), /Tageslimit erreicht/);
  assert.equal(starten.mock.callCount(), 0);
  assert.equal(fetchMock.mock.callCount(), 2);
});
