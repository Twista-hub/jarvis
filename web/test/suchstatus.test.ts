import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { sucheLaeuft, suchmeldung, SUCHSTATUS_JS } from "../src/suchstatus.ts";
import { konto } from "../src/konto.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const jetzt = Date.parse("2026-10-31T15:00:00Z");

test("Suchstand unterscheidet laufend, abgeschlossen, Zeitüberschreitung und Fehler", () => {
  const p = { erstlauf: "2026-10-31T14:59:00Z", fertig: "2026-10-31T14:55:00Z" };
  assert.equal(sucheLaeuft(p, jetzt), true);
  assert.match(suchmeldung(p, firma, jetzt), /Vorhandene Treffer bleiben/);
  assert.equal(sucheLaeuft({ ...p, fertig: "2026-10-31T15:00:00Z" }, jetzt), false);
  const html = suchmeldung({ ...p, fertig: "2026-10-31T15:00:00Z", ergebnis: { neu: 0, treffer: 12, ungeprueft: 2 } }, firma, jetzt);
  assert.match(html, /0 neu hinzugekommen · 12 passende Treffer/);
  assert.match(html, /2 angezeigte Treffer bisher nur anhand/);
  assert.doesNotMatch(html, /data-suchlauf=/);
  assert.match(suchmeldung({ erstlauf: "2026-10-31T14:00:00Z" }, firma, jetzt), /länger als erwartet/);
  assert.match(suchmeldung({ ...p, fertig: "2026-10-31T15:00:00Z", fehler: true }, firma, jetzt), /nicht abgeschlossen/);
  assert.equal(sucheLaeuft({ erstlauf: "ungültig" }, jetzt), false);
  assert.equal(sucheLaeuft({ erstlauf: "2099-01-01" }, jetzt), false);
});

test("Offene Bewertungen und Quellenlücken werden als Zwischenstand angezeigt", () => {
  const html = suchmeldung({ fertig: "2026-10-31T15:00:00Z", ergebnis: { neu: 4, treffer: 4, kandidaten: 148, bewertet: 80, ausstehend: 68, katalog_geprueft: 11685, importtage_offen: 40 } }, firma, jetzt);
  assert.match(html, /Zwischenstand/);
  assert.match(html, /80 von 148/);
  assert.match(html, /68 Bewertungen stehen noch aus/);
  assert.match(html, /40 Tage/);
  assert.doesNotMatch(html, /Letzte Suche abgeschlossen/);
});

test("Statusroute braucht Sitzung, nutzt deren RLS-Token und meldet fehlende Profile nicht als fertig", async (t) => {
  const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public" };
  const url = `https://jarvis.test/konto/suchstatus?firma=${firma}`;
  assert.equal((await konto(new Request(url), env))!.status, 401);
  const token = `h.${btoa(JSON.stringify({ sub: "user", exp: 4_000_000_000 }))}.s`;
  const headers = { cookie: `jv_at=${token}` };
  let daten: object[] = [];
  const mock = t.mock.method(globalThis, "fetch", async (_: unknown, options?: RequestInit) => {
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${token}`);
    return Response.json(daten);
  });
  assert.equal((await konto(new Request(url, { headers }), env))!.status, 404);
  daten = [{ erstlauf: new Date(Date.now() - 1000).toISOString(), fertig: new Date().toISOString() }];
  const r = (await konto(new Request(url, { headers }), env))!;
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), { laeuft: false });
  assert.equal(mock.mock.callCount(), 2);
});

test("automatische Statusabfrage aktualisiert nach Abschluss auch beim Zurückkehren in die App", async () => {
  const { document, window } = parseHTML(`<html><body><p data-suchlauf="${firma}"></p></body></html>`);
  const timers: (() => Promise<void>)[] = [];
  let pageshow: (e: { persisted: boolean }) => Promise<void> | void = () => {};
  let reload = 0;
  let fertig = false;
  runInNewContext(SUCHSTATUS_JS, { document, encodeURIComponent, fetch: async () => Response.json({ laeuft: !fertig }), window: {
    location: { reload: () => reload++ },
    setTimeout: (f: () => Promise<void>) => { timers.push(f); return timers.length; }, clearTimeout() {},
    addEventListener: (_: string, f: typeof pageshow) => { pageshow = f; },
  } });
  await timers.shift()!();
  assert.equal(reload, 0);
  fertig = true;
  pageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(reload, 1);
  assert.ok(window.document.querySelector("[data-suchlauf]"));
});
