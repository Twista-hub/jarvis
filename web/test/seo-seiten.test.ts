import { test } from "node:test";
import assert from "node:assert/strict";
import { auftraggeberSeite, ausschreibungSeite, beschreibungMeta, sitemapAuftraggeber, BUNDESLAENDER, gewerkAusCpv, gewerkLandSeite, istOffen, landAusOrt, seoSeiten, sitemapAusschreibungen } from "../src/seo-seiten.ts";
import { GEWERKE, gewerkSeite, ROBOTS } from "../src/gewerke.ts";

const reinigung = GEWERKE.find((g) => g.slug === "gebaeudereinigung")!;
const nrw = BUNDESLAENDER.find((l) => l.slug === "nordrhein-westfalen")!;

test("Bundesland aus dem NUTS-Code, Gewerk aus dem CPV-Code", () => {
  assert.equal(BUNDESLAENDER.length, 16);
  assert.equal(landAusOrt("Kreis Wesel · 47475 Kamp-Lintfort DEA1F")?.slug, "nordrhein-westfalen");
  assert.equal(landAusOrt("90762 Fürth DE253")?.slug, "bayern");
  assert.equal(landAusOrt("D-02977 Hoyerswerda"), undefined);
  assert.equal(landAusOrt("Deggendorf"), undefined);
  assert.equal(gewerkAusCpv(["90911200-8"])?.slug, "gebaeudereinigung");
  assert.equal(gewerkAusCpv(["99999999"]), undefined);
});

test("Gewerk × Bundesland: Überschrift, Zahlen, Links zu Ausschreibungen, anderen Ländern und Gewerken, FAQ", () => {
  const html = gewerkLandSeite(reinigung, nrw, { monat: 12, offen: 7, beispiele: [{ id: "bks:x1", titel: "Unterhaltsreinigung Schulen", auftraggeber: "Stadt Köln", ort: "Köln", frist: "2026-12-01T10:00:00Z", link: "" }] });
  assert.ok(html.startsWith("<h1>Öffentliche Ausschreibungen Gebäudereinigung in Nordrhein-Westfalen (NRW)</h1>"));
  assert.match(html, /<strong>12<\/strong>/);
  assert.match(html, /href="\/ausschreibung\/bks%3Ax1"/);
  assert.match(html, /href="\/ausschreibungen\/gebaeudereinigung\/bayern"/);
  assert.match(html, /href="\/ausschreibungen\/sicherheitsdienst\/nordrhein-westfalen"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(gewerkLandSeite(reinigung, nrw, { monat: 0, offen: 0, beispiele: [] }), /Zurzeit gibt es in Nordrhein-Westfalen \(NRW\) keine neue Ausschreibung/);
  assert.match(gewerkSeite(reinigung, null), /href="\/ausschreibungen\/gebaeudereinigung\/thueringen"/);
});

test("Ausschreibungsseite: offen indexierbar, abgelaufen mit Hinweis, Personen maskiert, Wege zu Gewerk und Land", () => {
  const e = { id: "bks:x1", titel: "Unterhaltsreinigung Schulen", auftraggeber: "Stadt Köln", ort: "50667 Köln DEA23", frist: "2026-12-01T10:00:00Z", link: "https://example.test/n", status: "offen", quelle: "bks", quell_datum: "2026-11-05T08:00:00Z", beschreibung: "Ansprechpartnerin Frau Erika Mustermann, Tel.\n\nReinigung von 6 Schulen.", cpv: ["90911200"], lose: ["Los 1: Schule A"], steckbrief: null };
  const jetzt = Date.parse("2026-11-08T12:00:00Z");
  assert.equal(istOffen(e, jetzt), true);
  assert.equal(istOffen({ ...e, frist: "2026-11-01T10:00:00Z" }, jetzt), false);
  assert.equal(istOffen({ ...e, status: "vergeben" }, jetzt), false);
  const html = ausschreibungSeite(e, jetzt);
  assert.ok(html.startsWith("<h1>Unterhaltsreinigung Schulen</h1>"), "Überschrift zuerst (eine h1 auf der Seite)");
  assert.doesNotMatch(html, /Erika Mustermann/);
  assert.match(html, /href="\/ausschreibungen\/gebaeudereinigung\/nordrhein-westfalen"/);
  assert.match(html, /Lizenz CC0/);
  assert.doesNotMatch(html, /abgelaufen/);
  assert.match(ausschreibungSeite({ ...e, frist: "2026-11-01T10:00:00Z" }, jetzt), /Angebotsfrist dieser Ausschreibung ist abgelaufen/);
  assert.match(beschreibungMeta(e), /^Öffentliche Ausschreibung: Unterhaltsreinigung Schulen\. Stadt Köln · 50667 Köln · Frist 01\.12\.2026/);
});

test("Auftraggeber-Seite: offene und frühere Ausschreibungen, Zuschlagswert ohne Bieter, Wege zu Gewerk × Land", () => {
  const a = { id: "stadt-koeln", name: "Stadt Köln", ort: "50667 Köln DEA23", offen_anzahl: 1, jahr: 3, gesamt: 5,
    offen: [{ id: "bks:x1", titel: "Unterhaltsreinigung Schulen", frist: "2026-12-01T10:00:00Z" }],
    frueher: [{ id: "bks:x0", titel: "Glasreinigung Rathaus", datum: "2025-06-01", status: "vergeben", laufzeit_ende: "2027-05-31", zuschlag_wert: 120000 }],
    cpv: ["90911200", "79713000"] };
  const html = auftraggeberSeite(a);
  assert.ok(html.startsWith("<h1>Stadt Köln: öffentliche Ausschreibungen</h1>"));
  assert.match(html, /href="\/ausschreibung\/bks%3Ax1"/);
  assert.match(html, /Zuschlag 120\.000\s€/);
  assert.match(html, /Vertrag bis 31\.05\.2027/);
  assert.match(html, /href="\/ausschreibungen\/gebaeudereinigung\/nordrhein-westfalen"/);
  assert.match(html, /href="\/ausschreibungen\/sicherheitsdienst\/nordrhein-westfalen"/);
  assert.doesNotMatch(html, /DEA23/);
  assert.match(auftraggeberSeite({ ...a, offen: [], offen_anzahl: 0 }), /keine offene Ausschreibung/);
  assert.match(sitemapAuftraggeber("https://crewtender.eu", [["stadt-koeln", "2026-11-05"]]), /<loc>https:\/\/crewtender.eu\/auftraggeber\/stadt-koeln<\/loc><lastmod>2026-11-05<\/lastmod>/);
  assert.match(ausschreibungSeite({ id: "bks:x1", titel: "T", auftraggeber: "Stadt Köln", auftraggeber_seite: "stadt-koeln", frist: null, link: "", steckbrief: null }), /href="\/auftraggeber\/stadt-koeln">Stadt Köln<\/a>/);
});

test("Sitemap der Ausschreibungen und robots.txt", () => {
  const xml = sitemapAusschreibungen("https://crewtender.eu", [{ id: "bks:ocds-1", datum: "2026-11-05" }]);
  assert.match(xml, /<loc>https:\/\/crewtender.eu\/ausschreibung\/bks%3Aocds-1<\/loc><lastmod>2026-11-05<\/lastmod>/);
  assert.match(ROBOTS("https://crewtender.eu"), /Sitemap: https:\/\/crewtender.eu\/sitemap-ausschreibungen.xml/);
  assert.match(ROBOTS("https://crewtender.eu"), /Sitemap: https:\/\/crewtender.eu\/sitemap-auftraggeber.xml/);
});

test("Routen: Gewerk × Land, unbekanntes Land leitet um, Ausschreibung mit noindex nach Fristablauf", async () => {
  const echt = globalThis.fetch;
  const antworten: Record<string, unknown> = {
    gewerk_land_statistik: { monat: 3, offen: 2, beispiele: [] },
    auftraggeber_oeffentlich: { id: "gemeinde-ruhig", name: "Gemeinde Ruhig", ort: "", offen_anzahl: 0, jahr: 0, gesamt: 1, offen: [], frueher: [], cpv: [] },
    sitemap_auftraggeber_json: [["gemeinde-ruhig", "2026-11-01"]],
    sitemap_ausschreibungen_json: Array.from({ length: 1500 }, (_, i) => [`bks:n${i}`, "2026-11-05"]),
    demo_eintrag: { id: "bks:x2", titel: "Wachdienst Rathaus", auftraggeber: "Stadt", ort: "DE300", frist: "2000-01-01T00:00:00Z", link: "", status: "offen", quelle: "bks", cpv: ["79713000"], steckbrief: null },
  };
  globalThis.fetch = (async (u: string) => new Response(JSON.stringify(antworten[String(u).split("/rpc/")[1]] ?? null), { status: 200 })) as typeof fetch;
  try {
    const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "k" };
    const html = (h: string) => new Response(h, { headers: { "content-type": "text/html", "x-robots-tag": "noindex" } });
    const r = await seoSeiten(new Request("https://crewtender.eu/ausschreibungen/sicherheitsdienst/berlin"), env, "https://crewtender.eu", html);
    assert.equal(r?.status, 200);
    assert.equal(r?.headers.get("x-robots-tag"), null);
    const t = await r!.text();
    assert.match(t, /<link rel="canonical" href="https:\/\/crewtender.eu\/ausschreibungen\/sicherheitsdienst\/berlin">/);
    assert.doesNotMatch(t, /<meta name="robots"/);
    const um = await seoSeiten(new Request("https://crewtender.eu/ausschreibungen/sicherheitsdienst/atlantis"), env, "https://crewtender.eu", html);
    assert.equal(um?.status, 301);
    const a = await seoSeiten(new Request("https://crewtender.eu/ausschreibung/bks%3Ax2"), env, "https://crewtender.eu", html);
    assert.match(await a!.text(), /<meta name="robots" content="noindex, follow">/);
    assert.equal(await seoSeiten(new Request("https://crewtender.eu/ausschreibungen/sicherheitsdienst"), env, "https://crewtender.eu", html), null);
    const sm = await (await seoSeiten(new Request("https://crewtender.eu/sitemap-ausschreibungen.xml"), env, "https://crewtender.eu", html))!.text();
    assert.equal((sm.match(/<loc>/g) ?? []).length, 1500, "mehr als 1.000 Einträge");
    const ag = await seoSeiten(new Request("https://crewtender.eu/auftraggeber/gemeinde-ruhig"), env, "https://crewtender.eu", html);
    const agt = await ag!.text();
    assert.match(agt, /<link rel="canonical" href="https:\/\/crewtender.eu\/auftraggeber\/gemeinde-ruhig">/);
    assert.match(agt, /<meta name="robots" content="noindex, follow">/, "ohne Ausschreibung im letzten Jahr nicht indexieren");
    assert.match(await (await seoSeiten(new Request("https://crewtender.eu/sitemap-auftraggeber.xml"), env, "https://crewtender.eu", html))!.text(), /auftraggeber\/gemeinde-ruhig/);
    assert.equal((await seoSeiten(new Request("https://crewtender.eu/auftraggeber/bks%3Aalt"), env, "https://crewtender.eu", html))?.status, 404, "alte Kennungen: nicht gefunden");
  } finally { globalThis.fetch = echt; }
});

test("Sitemap mit Reserve: Datenbank antwortet nicht → letzte gute Fassung, sonst 503 mit Retry-After", async () => {
  const echt = globalThis.fetch, cacheAlt = (globalThis as { caches?: unknown }).caches;
  const ablage = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = { default: { match: async (r: Request) => ablage.get(r.url)?.clone(), put: async (r: Request, a: Response) => { ablage.set(r.url, a.clone()); } } };
  let ok = true;
  globalThis.fetch = (async () => ok ? new Response(JSON.stringify([["stadt-koeln", "2026-11-05"]]), { status: 200 }) : new Response("timeout", { status: 500 })) as typeof fetch;
  try {
    const warten: Promise<unknown>[] = [];
    const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "k", WARTEN: (p: Promise<unknown>) => { warten.push(p); } };
    const html = (h: string) => new Response(h);
    const erst = await seoSeiten(new Request("https://crewtender.eu/sitemap-auftraggeber.xml"), env, "https://crewtender.eu", html);
    assert.equal(erst?.status, 200);
    await Promise.all(warten);
    ablage.delete("https://crewtender.eu/sitemap-auftraggeber.xml?v=3");
    ok = false;
    const reserve = await seoSeiten(new Request("https://crewtender.eu/sitemap-auftraggeber.xml"), env, "https://crewtender.eu", html);
    assert.equal(reserve?.status, 200);
    assert.match(await reserve!.text(), /auftraggeber\/stadt-koeln/);
    assert.equal(reserve?.headers.get("cache-control"), "public, max-age=300");
    ablage.clear();
    const leer = await seoSeiten(new Request("https://crewtender.eu/sitemap-auftraggeber.xml"), env, "https://crewtender.eu", html);
    assert.equal(leer?.status, 503);
    assert.equal(leer?.headers.get("retry-after"), "60");
  } finally { globalThis.fetch = echt; (globalThis as { caches?: unknown }).caches = cacheAlt; }
});
