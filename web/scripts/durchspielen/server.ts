// End-to-end test server: the real app in Node against a throwaway database (PostgREST with row level security) and the
// real Claude API. Cloudflare-only services are replaced: R2 = memory, Workers AI (PDF/Word to text) = pdftotext/unzip,
// the Steckbrief workflow runs in-process. The signed-in user comes from the cookie test_nutzer (default: NUTZER).
// Env: PGRST, JWT_SECRET, DB_URL (budget bookings), ANTHROPIC_API_KEY, NUTZER, PORT.
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PGRST = process.env.PGRST ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? 8790);
const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");
const token = (sub: string) => {
  const kopf = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const last = b64(JSON.stringify({ sub, role: "authenticated", email: `${sub.slice(-4)}@test.invalid`, exp: Math.floor(Date.now() / 1000) + 6 * 3600 }));
  return `${kopf}.${last}.${b64(createHmac("sha256", process.env.JWT_SECRET ?? "").update(`${kopf}.${last}`).digest())}`;
};
const log = (...a: unknown[]) => process.stdout.write(a.map(String).join(" ") + "\n");
console.error = (...a: unknown[]) => { const e = a[0] as { stack?: string }; log("APPFEHLER", (e?.stack ?? a.map(String).join(" ")).split("\n").slice(0, 3).join(" | ")); };
console.warn = (...a: unknown[]) => log("WARNUNG", a.map(String).join(" ").slice(0, 300));

// Database requests of the app go to PostgREST; everything else (Claude API, websites for the research) stays real.
const echt = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  if (url.hostname !== "supabase.test") return echt(input as RequestInfo, init);
  if (!url.pathname.startsWith("/rest/v1/")) return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  const methode = (init?.method ?? req?.method ?? "GET").toUpperCase();
  const h = new Headers(init?.headers ?? req?.headers); h.delete("apikey");
  const r = await echt(`${PGRST}${url.pathname.replace("/rest/v1", "")}${url.search}`, { method: methode, headers: h, body: init?.body ?? (req && methode !== "GET" ? await req.text() : undefined) });
  if (r.status >= 400) log("DB", r.status, methode, url.pathname, (await r.clone().text()).slice(0, 200));
  return r;
}) as typeof fetch;

const r2 = new Map<string, { body: ArrayBuffer; meta?: unknown }>();
const puffer = (v: unknown): ArrayBuffer => typeof v === "string" ? new TextEncoder().encode(v).buffer as ArrayBuffer : v instanceof Uint8Array ? v.slice().buffer as ArrayBuffer : v as ArrayBuffer;
const DATEN = {
  get: async (k: string) => { const x = r2.get(k); return x ? { body: new Blob([x.body]).stream(), arrayBuffer: async () => x.body, text: async () => new TextDecoder().decode(x.body), json: async () => JSON.parse(new TextDecoder().decode(x.body)), httpMetadata: x.meta ?? {}, size: x.body.byteLength } : null; },
  put: async (k: string, v: unknown, o?: { httpMetadata?: unknown }) => {
    const body = v instanceof ReadableStream ? await new Response(v).arrayBuffer() : puffer(v);
    r2.set(k, { body, meta: o?.httpMetadata }); return {};
  },
  head: async (k: string) => r2.has(k) ? { size: r2.get(k)!.body.byteLength } : null,
  delete: async (k: string | string[]) => { for (const x of [k].flat()) r2.delete(x); },
  list: async (o?: { prefix?: string }) => ({ objects: [...r2.keys()].filter((k) => !o?.prefix || k.startsWith(o.prefix)).map((key) => ({ key, size: r2.get(key)!.body.byteLength })), truncated: false }),
};
// Workers AI toMarkdown stand-in: PDF via pdftotext, Word via its XML, everything else not readable.
const AI = {
  toMarkdown: async ({ name, blob }: { name: string; blob: Blob }) => {
    const dir = mkdtempSync(join(tmpdir(), "ai-")); const pfad = join(dir, "d");
    writeFileSync(pfad, Buffer.from(await blob.arrayBuffer()));
    try {
      if (/\.pdf$/i.test(name)) return { format: "markdown", data: execFileSync("pdftotext", ["-layout", pfad, "-"], { maxBuffer: 64e6 }).toString() };
      if (/\.docx$/i.test(name)) return { format: "markdown", data: execFileSync("unzip", ["-p", pfad, "word/document.xml"], { maxBuffer: 64e6 }).toString().replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "") };
    } catch { /* falls through */ }
    return { format: "error", error: "nicht lesbar" };
  },
};
const laufend: Promise<unknown>[] = [];
const mod = await import("../../src/index.ts");
const worker = mod.default as { fetch: (r: Request, e: unknown) => Promise<Response> };
const env: Record<string, unknown> = {
  SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public", TAGES_LIMIT: "50", DATEN, AI,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, HYPERDRIVE: { connectionString: process.env.DB_URL },
};
env.STECKBRIEF = {
  create: async ({ id, params }: { id: string; params: unknown }) => {
    const wf = new (mod as unknown as { Steckbrief: new () => { env: unknown; run: (e: unknown, s: unknown) => Promise<unknown> } }).Steckbrief();
    wf.env = env;
    const step = { do: async (_name: string, a: unknown, b?: unknown) => (typeof a === "function" ? a : b as () => Promise<unknown>)(), sleep: async () => {} };
    const t0 = Date.now();
    laufend.push(wf.run({ payload: params, instanceId: id }, step).then(() => log("STECKBRIEF fertig", Math.round((Date.now() - t0) / 1000), "s"), (e) => log("STECKBRIEF Fehler", String(e).slice(0, 300))));
    return { id };
  },
  get: async () => ({ status: async () => ({ status: "running" }) }),
};

createServer(async (q, s) => {
  if (q.url === "/__test/warten") { await Promise.all(laufend); s.end("ok"); return; }
  const teile: Buffer[] = []; for await (const c of q) teile.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(q.headers)) if (typeof v === "string") headers.set(k, v);
  const nutzer = /test_nutzer=([0-9a-f-]{36})/.exec(q.headers.cookie ?? "")?.[1] ?? process.env.NUTZER ?? "";
  headers.set("cookie", `jv_at=${token(nutzer)}` + (q.headers.cookie ? `; ${q.headers.cookie}` : ""));
  try {
    const r = await worker.fetch(new Request(`http://127.0.0.1:${PORT}${q.url}`, { method: q.method, headers, body: q.method === "GET" || q.method === "HEAD" ? undefined : Buffer.concat(teile), redirect: "manual" } as RequestInit), env);
    const h: Record<string, string | string[]> = {};
    r.headers.forEach((v, k) => { if (k !== "set-cookie") h[k] = v; });
    const jv = (r.headers.getSetCookie?.() ?? []).filter((c) => /^jv_(firma|sprache)=/.test(c)).map((c) => c.replace(/;\s*Secure/i, ""));
    if (jv.length) h["set-cookie"] = jv;
    s.writeHead(r.status, h); s.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { log("ABSTURZ", q.url, String(e).slice(0, 300)); s.writeHead(500); s.end(String(e)); }
}).listen(PORT, () => log("bereit"));
