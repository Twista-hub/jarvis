import assert from "node:assert/strict";
import { test } from "node:test";
import { bewertungsErklaerung, cookie, jwt, konto, sicherWeiter, sitzung, startSucheFormular } from "../src/konto.ts";

test("shows the AI match reason on the tender card", () => {
  assert.equal(bewertungsErklaerung("## Jarvis-Bewertung\n\n**Gesucht:** Fliesenarbeiten.\n\n**Warum passend:** Passt zur Firmenleistung.\n\n## Kurzüberblick"), "Gesucht: Fliesenarbeiten. Warum passend: Passt zur Firmenleistung.");
  assert.equal(bewertungsErklaerung("## Kurzüberblick\n\nNur Bekanntmachungsdaten."), "");
});

test("offers a direct search restart from the search profile", () => {
  const html = startSucheFormular("firm-id");
  assert.match(html, /method="post" action="\/konto\/einrichtung\/starten"/);
  assert.match(html, /Suche jetzt starten/);
  assert.match(html, /name="firma" value="firm-id"/);
});

test("new verified registration goes straight to automatic company research", async (t) => {
  const firma = "11111111-1111-4111-8111-111111111111";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const daten = url.pathname.endsWith("/rpc/registrierung_abschliessen") ? firma : [];
    return Response.json(daten);
  });
  const token = `h.${btoa(JSON.stringify({ sub: "user", email: "neu@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;
  const response = await konto(new Request("https://jarvis.test/konto", { headers: { cookie: `jv_at=${token}` } }), { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public" });
  assert.equal(response?.status, 303);
  assert.equal(response?.headers.get("location"), `/konto/einrichtung?firma=${firma}&automatisch=1`);
});

test("only local paths as redirect target", () => {
  assert.equal(sicherWeiter("/einladung?token=abc_DEF-123"), "/einladung?token=abc_DEF-123");
  assert.equal(sicherWeiter("//evil.example"), "/konto");
  assert.equal(sicherWeiter("https://evil.example"), "/konto");
  assert.equal(sicherWeiter("/\\evil.example"), "/konto");
  assert.equal(sicherWeiter(""), "/konto");
});

test("reads cookies and the token payload", () => {
  const r = new Request("https://x/", { headers: { cookie: "a=1; jv_at=x.y.z; b=2=3" } });
  assert.equal(cookie(r, "jv_at"), "x.y.z");
  assert.equal(cookie(r, "b"), "2=3");
  assert.equal(cookie(r, "fehlt"), null);
  const payload = btoa(JSON.stringify({ sub: "u1", email: "a@b.de", exp: 2000000000 })).replace(/=+$/, "");
  assert.deepEqual(jwt(`h.${payload}.s`), { sub: "u1", email: "a@b.de", exp: 2000000000 });
  assert.equal(jwt("kaputt"), null);
});



test("mehrere Rechteprüfungen erneuern denselben Login nur einmal",async(t)=>{
  const alt=`h.${btoa(JSON.stringify({sub:"user",exp:1}))}.s`;
  const neu=`h.${btoa(JSON.stringify({sub:"user",email:"test@example.de",exp:4000000000}))}.s`;
  const mock=t.mock.method(globalThis,"fetch",async()=>Response.json({access_token:neu,refresh_token:"test-refresh",expires_in:3600}));
  const request=new Request("https://x/",{headers:{cookie:`jv_at=${alt}; jv_rt=test-refresh-alt`}});
  const env={SUPABASE_URL:"https://db.test",SUPABASE_KEY:"public"};
  const [a,b]=await Promise.all([sitzung(request,env),sitzung(request,env)]);
  assert.equal(mock.mock.callCount(),1);assert.equal(a,b);assert.ok(a!.cookies.some((c)=>c.startsWith("jv_rt=test-refresh;")));
});
