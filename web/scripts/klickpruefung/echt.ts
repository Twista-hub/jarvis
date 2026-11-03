// Click check with a real account (read-only): the app runs here in Node, its database requests go to a local
// PostgREST that talks to the real database with the user's rights (row level security as in the app). PostgREST is
// started with db-tx-end=rollback, so every write is rolled back. Files (R2) and all other services are stubbed.
// Output: only paths (ids replaced) and status, never page contents.
// Env: PGRST=http://localhost:3000, JWT_SECRET=<PostgREST secret>, NUTZER=<user uuid>, FIRMEN=<uuid,uuid>
import { createHmac } from "node:crypto";

const PGRST = process.env.PGRST ?? "http://localhost:3000";
const nutzer = process.env.NUTZER ?? "";
const firmen = (process.env.FIRMEN ?? "").split(",").filter(Boolean);
const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");
const kopf = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const nutzlast = b64(JSON.stringify({ sub: nutzer, role: "authenticated", email: "pruefung@jarvis.test", exp: Math.floor(Date.now() / 1000) + 3 * 3600 }));
const token = `${kopf}.${nutzlast}.${b64(createHmac("sha256", process.env.JWT_SECRET ?? "").update(`${kopf}.${nutzlast}`).digest())}`;

const fehler: string[] = [];
console.error = (...a: unknown[]) => { const e = a[0] as { stack?: string }; fehler.push((e?.stack ?? String(e)).split("\n").slice(0, 3).join(" | ")); };
console.warn = () => {};
const schreibversuche: string[] = [];
const echt = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  if (url.hostname !== "supabase.test") return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  if (!url.pathname.startsWith("/rest/v1/")) return new Response("{}", { status: 404 });
  const methode = (init?.method ?? req?.method ?? "GET").toUpperCase();
  if (methode !== "GET" && !url.pathname.startsWith("/rest/v1/rpc/")) schreibversuche.push(`${methode} ${url.pathname.replace("/rest/v1/", "")}`);
  const ziel = `${PGRST}${url.pathname.replace("/rest/v1", "")}${url.search}`;
  const h = new Headers(init?.headers ?? req?.headers);
  h.delete("apikey");
  return echt(ziel, { method: methode, headers: h, body: init?.body ?? (req && methode !== "GET" ? await req.text() : undefined) });
}) as typeof fetch;

const { default: worker } = await import("../../src/index.ts");
const env = { SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public", TAGES_LIMIT: "10",
  DATEN: { get: async () => null, put: async () => {}, head: async () => null, delete: async () => {}, list: async () => ({ objects: [] }) } } as never;
const ohneIds = (p: string) => p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ":id").replace(/[A-Za-z0-9_-]{32,}/g, ":token");
const START = ["/konto", "/konto/team", "/konto/einstellungen", "/konto/treffer", "/konto/fristen", "/konto/unterlagen", "/konto/angebote", "/konto/kalkulation", "/konto/markt", "/konto/suchprofil", "/konto/profil", "/konto/ich", "/konto/hilfe"];
let gesamtProbleme = 0;
for (const firma of [...firmen, ""]) {
  const cookie = `jv_at=${token}${firma ? `; jv_firma=${firma}` : "; jv_firma=99999999-9999-4999-8999-999999999999"}`;
  const gesehen = new Map<string, { von: string; status: number; ziel: string; problem: string }>();
  const warte: [string, string][] = START.map((s) => [s, "(Start)"]);
  while (warte.length && gesehen.size < 800) {
    const [pfad, von] = warte.shift()!;
    if (gesehen.has(pfad)) continue;
    let status = 0, ziel = "", problem = "", text = "";
    try {
      const r = await worker.fetch(new Request(`https://jarvis.test${pfad}`, { headers: { cookie }, redirect: "manual" }), env);
      status = r.status; ziel = r.headers.get("location") ?? "";
      if ((r.headers.get("content-type") ?? "").startsWith("text/html")) text = await r.text();
      if (status >= 300 && status < 400) {
        const z = new URL(ziel, "https://jarvis.test");
        if ((z.pathname === "/konto" || z.pathname === "/") && !z.search && new URL(pfad, "https://jarvis.test").pathname !== "/konto") problem = "→ Startseite";
        else if (z.pathname.startsWith("/anmelden")) problem = "→ Anmeldung";
      } else if (status >= 400 && status !== 404) problem = `HTTP ${status}`;
      if (text.includes("Da ist leider etwas schiefgegangen")) problem = "Fehlerseite";
      if (status === 200 && /<form[^>]*action="\/anmelden/.test(text) && pfad.startsWith("/konto")) problem = "Anmeldeseite";
    } catch (e) { problem = `Absturz: ${String(e).slice(0, 120)}`; }
    gesehen.set(pfad, { von, status, ziel, problem });
    for (const m of text.matchAll(/<a\b[^>]*?href="([^"]*)"/g)) {
      const href = m[1].replace(/&amp;/g, "&");
      if (!href.startsWith("/konto") || /\.(docx|xlsx|csv|xml|txt|ics|zip|pdf)(\?|$)/.test(href)) continue;
      const u = new URL(href.split("#")[0], "https://jarvis.test");
      for (const k of ["monat", "woche", "datum", "tag", "jahr", "von", "bis", "hinweis", "q", "seite"]) u.searchParams.delete(k);
      const p = u.pathname + u.search;
      if (!gesehen.has(p)) warte.push([p, pfad]);
    }
  }
  const probleme = [...gesehen].filter(([, x]) => x.problem);
  gesamtProbleme += probleme.length;
  console.log(`\n=== ${firma ? `Firma ${firmen.indexOf(firma) + 1}` : "veraltetes Firmen-Cookie"}: ${gesehen.size} Seiten, ${probleme.length} Probleme, ${[...gesehen.values()].filter((x) => x.status === 404).length}× 404`);
  for (const [p, x] of probleme) console.log(`  ${x.problem.padEnd(14)} ${ohneIds(p)}  (von ${ohneIds(x.von)})${x.ziel ? `  → ${ohneIds(x.ziel)}` : ""}`);
  for (const [p, x] of [...gesehen].filter(([, x]) => x.status === 404)) console.log(`  404            ${ohneIds(p)}  (von ${ohneIds(x.von)})`);
}
const zaehl = new Map<string, number>();
for (const f of fehler) zaehl.set(f, (zaehl.get(f) ?? 0) + 1);
console.log(`\nFehlermeldungen der App: ${zaehl.size}`);
for (const [f, n] of zaehl) console.log(`  x${n} ${ohneIds(f).slice(0, 300)}`);
console.log(`Schreibversuche (alle zurückgerollt): ${[...new Set(schreibversuche)].join(", ") || "keine"}`);
process.exit(0);
