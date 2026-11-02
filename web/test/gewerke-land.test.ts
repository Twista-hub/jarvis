import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brancheSeite, LAENDER, landGewerke, landUebersicht } from "../src/gewerke-land.ts";
import { METIERS } from "../src/gewerke-fr.ts";
import { GEWERKE, sitemap } from "../src/gewerke.ts";
import { alternativen, SLUGS } from "../src/gewerke-sprachen.ts";

const antwort = (h: string) => new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
const env = { SUPABASE_URL: "https://db.example", SUPABASE_KEY: "k" };

test("Sprachfassungen: Slug-Tabelle passt zu allen Gewerke-Seiten", () => {
  for (const m of METIERS) assert.equal(SLUGS[m.de]?.fr, m.slug, `fr: ${m.de}`);
  for (const de of Object.keys(SLUGS)) assert.ok(GEWERKE.some((g) => g.slug === de), `deutsches Gegenstück fehlt: ${de}`);
  for (const l of LAENDER) {
    assert.equal(l.branchen.length, 10);
    for (const b of l.branchen) assert.ok(SLUGS[b.de], `${l.code}: ${b.de}`);
  }
  const a = alternativen("https://x", "elektro");
  for (const p of ["/ausschreibungen/elektro", "/fr/appels-d-offres/electricite", "/pl/przetargi/elektryka", "/es/licitaciones/electricidad"]) assert.ok(a.includes(`href="https://x${p}"`), p);
  assert.equal(alternativen("https://x", "gibtsnicht"), "");
  const map = sitemap("https://x");
  assert.match(map, /<loc>https:\/\/x\/pl\/przetargi\/sprzatanie<\/loc>/);
  assert.match(map, /<loc>https:\/\/x\/es\/licitaciones\/trabajo-temporal<\/loc>/);
  // Same prefix lists as the background cache in the migration.
  const sql = readFileSync(new URL("../../supabase/migrations/20261102150000_ausland_bestand.sql", import.meta.url), "utf8");
  for (const b of LAENDER[0].branchen) assert.ok(sql.includes(`(array[${b.praefixe.map((p) => `'${p}'`).join(",")}])`), `Präfixe fehlen: ${b.de}`);
});

test("Polnische Gewerke-Seiten: Sprache, Zahlen, nur BZP-Links", async () => {
  const pl = LAENDER.find((l) => l.code === "pl")!;
  const html = brancheSeite(pl, pl.branchen[0]);
  assert.match(html, /"@type":"FAQPage","inLanguage":"pl"/);
  assert.match(html, /href="\/sprache\?zu=pl&amp;weiter=%2Fregistrieren"/);
  assert.doesNotMatch(html, /href="\/pl\/przetargi\/sprzatanie"/, "nicht auf sich selbst verlinken");
  assert.match(html, /Biuletyn Zamówień Publicznych/);
  assert.match(landUebersicht(pl), /href="\/pl\/przetargi\/praca-tymczasowa"/);
  const echt = globalThis.fetch;
  let gefragt: unknown = null;
  globalThis.fetch = (async (_u: string, init: RequestInit) => { gefragt = JSON.parse(String(init.body)); return Response.json({ monat: 1234, offen: 321, beispiele: [{ titel: "Sprzątanie urzędu", auftraggeber: "Gmina Kraków", ort: "woj. małopolskie", frist: "2026-11-20T11:00:00Z", link: "https://ezamowienia.gov.pl/mp-client/search/list/ocds-148610-1" }, { titel: "Inne", auftraggeber: "X", ort: "", frist: null, link: "https://boese.example/" }] }); }) as typeof fetch;
  const r = (await landGewerke(new Request("https://app.example/pl/przetargi/sprzatanie"), env, "https://app.example", antwort))!;
  globalThis.fetch = echt;
  assert.deepEqual(gefragt, { land: "pl", praefixe: ["9091", "90919"] });
  assert.equal(r.headers.get("x-jv-sprache"), "pl");
  assert.equal(r.headers.get("x-robots-tag"), null);
  const seite = await r.text();
  assert.match(seite, /<html lang="pl"/);
  assert.match(seite, /hreflang="fr" href="https:\/\/app.example\/fr\/appels-d-offres\/nettoyage"/);
  assert.match(seite, /rel="canonical" href="https:\/\/app.example\/pl\/przetargi\/sprzatanie"/);
  assert.match(seite, /<strong>1234<\/strong><span>przetargów w BZP w ostatnich 30 dniach/);
  assert.match(seite, /<a href="https:\/\/ezamowienia.gov.pl\/mp-client\/search\/list\/ocds-148610-1" rel="noopener nofollow">Sprzątanie urzędu<\/a>/);
  assert.match(seite, /Gmina Kraków · woj. małopolskie · termin 20\.11\.2026/);
  assert.doesNotMatch(seite, /boese\.example/, "nur e-Zamówienia-Links");
  assert.equal((await landGewerke(new Request("https://app.example/pl/przetargi/gibtsnicht"), env, "https://app.example", antwort))!.status, 301);
  assert.equal(await landGewerke(new Request("https://app.example/pl"), env, "https://app.example", antwort), null);
  assert.equal(await landGewerke(new Request("https://app.example/pl/przetargiX"), env, "https://app.example", antwort), null);
});

test("Spanische Gewerke-Seiten: Übersicht, Katalonien als Quelle, ohne Zahlen keine Box", async () => {
  const echt = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  const r = (await landGewerke(new Request("https://app.example/es/licitaciones/limpieza"), env, "https://app.example", antwort))!;
  globalThis.fetch = echt;
  const seite = await r.text();
  assert.match(seite, /<html lang="es"/);
  assert.doesNotMatch(seite, /class="gewerk-zahlen"/);
  assert.match(seite, /Generalitat de Catalunya/);
  assert.match(seite, /subrogación/);
  const u = (await landGewerke(new Request("https://app.example/es/licitaciones/"), env, "https://app.example", antwort))!;
  assert.equal(u.headers.get("x-jv-sprache"), "es");
  const ut = await u.text();
  assert.match(ut, /<h1>Licitaciones públicas por oficio<\/h1>/);
  assert.match(ut, /hreflang="pl" href="https:\/\/app.example\/pl\/przetargi"/);
});
