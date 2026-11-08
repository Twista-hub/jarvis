import { ANLEITUNGEN } from "../src/hilfecenter.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GEWERKE, gewerkSeite, ROBOTS, sitemap, uebersichtGewerke } from "../src/gewerke.ts";

test("Gewerke-Seiten: 10 Gewerke, Zahlen, Beispiele, FAQ, Sitemap", () => {
  assert.equal(GEWERKE.length, 10);
  assert.equal(new Set(GEWERKE.map((g) => g.slug)).size, 10);
  for (const g of GEWERKE) assert.ok(g.cpv.every((c) => /^\d{2,8}$/.test(c)) && g.cpv.length <= 12, g.slug);
  const s = gewerkSeite(GEWERKE[0], { monat: 512, offen: 140, beispiele: [{ titel: "Elektro <Schule>", auftraggeber: "Stadt X", ort: "Aachen", frist: "2026-11-20T10:00:00Z", link: "https://x" }] });
  assert.match(s, /<h1>Öffentliche Ausschreibungen für Elektroarbeiten<\/h1>/);
  assert.match(s, /<strong>512<\/strong><span>Ausschreibungen in den letzten 30 Tagen/);
  assert.ok(!s.includes("<Schule>"));
  assert.match(s, /"@type":"FAQPage"/);
  assert.match(s, /href="\/registrieren"[\s\S]*href="\/demo"/);
  assert.doesNotMatch(s, /href="\/ausschreibungen\/elektro"/, "keine Verlinkung auf sich selbst");
  assert.doesNotMatch(gewerkSeite(GEWERKE[0], null), /gewerk-zahlen/, "ohne Zahlen keine leere Box");
  assert.equal((uebersichtGewerke().match(/href="\/ausschreibungen\//g) ?? []).length, 10);
  const map = sitemap("https://app.example");
  assert.equal((map.match(/<loc>/g) ?? []).length, 93 + 5 + 160 + ANLEITUNGEN.length); // + 10 Gewerke × 16 Bundesländer; 49 + je 11 französische, polnische, spanische, italienische Seiten + Preise, Kontakt, Partner, Partnerbedingungen, Hilfe-Center und Anleitungen
  assert.match(ROBOTS("https://app.example"), /Disallow: \/konto[\s\S]*Sitemap: https:\/\/app.example\/sitemap.xml/);
});

test("Französische Gewerke-Seiten: Inhalt, Quelle, hreflang, Sitemap, immer Französisch", async () => {
  const { METIERS, metiers, metierSeite, uebersichtMetiers } = await import("../src/gewerke-fr.ts");
  assert.equal(METIERS.length, 10);
  for (const m of METIERS) assert.ok(GEWERKE.some((g) => g.slug === m.de), `deutsches Gegenstück fehlt: ${m.de}`);
  const nett = METIERS.find((m) => m.slug === "nettoyage")!;
  const html = metierSeite(nett);
  assert.match(html, /<h1>Appels d&#39;offres publics de nettoyage/);
  assert.match(html, /Source : BOAMP, DILA \(Licence Ouverte 2\.0\)/);
  assert.match(html, /"@type":"FAQPage","inLanguage":"fr"/);
  assert.match(html, /href="\/sprache\?zu=fr&amp;weiter=%2Fregistrieren"/);
  assert.doesNotMatch(html, /href="\/fr\/appels-d-offres\/nettoyage"/, "nicht auf sich selbst verlinken");
  assert.match(uebersichtMetiers(), /href="\/fr\/appels-d-offres\/interim-travail-temporaire"/);
  const antwort = (h: string) => new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
  const env = { SUPABASE_URL: "https://db.example", SUPABASE_KEY: "k" };
  const echt = globalThis.fetch;
  let gefragt: unknown = null;
  globalThis.fetch = (async (_u: string, init: RequestInit) => { gefragt = JSON.parse(String(init.body)); return Response.json({ monat: 1234, offen: 321, beispiele: [{ titel: "Nettoyage mairie", auftraggeber: "Ville de Lyon", ort: "Département 69", frist: "2026-11-20T11:00:00Z", link: "https://www.boamp.fr/pages/avis/?q=idweb:26-1" }, { titel: "Autre", auftraggeber: "X", ort: "", frist: null, link: "javascript:alert(1)" }] }); }) as typeof fetch;
  const r = (await metiers(new Request("https://app.example/fr/appels-d-offres/nettoyage"), env, "https://app.example", antwort))!;
  globalThis.fetch = echt;
  assert.deepEqual(gefragt, { praefixe: ["9091", "90919"] });
  assert.equal(r.headers.get("x-jv-sprache"), "fr");
  assert.equal(r.headers.get("x-robots-tag"), null);
  const seite = await r.text();
  assert.match(seite, /<html lang="fr"/);
  assert.match(seite, /hreflang="de" href="https:\/\/app.example\/ausschreibungen\/gebaeudereinigung"/);
  assert.match(seite, /rel="canonical" href="https:\/\/app.example\/fr\/appels-d-offres\/nettoyage"/);
  assert.match(seite, /<strong>1\u202f234<\/strong><span>appels d'offres sur les 30 derniers jours/);
  assert.match(seite, /<a href="https:\/\/www.boamp.fr\/pages\/avis\/\?q=idweb:26-1" rel="noopener nofollow">Nettoyage mairie<\/a>/);
  assert.match(seite, /Ville de Lyon · Département 69 · date limite 20\/11\/2026/);
  assert.doesNotMatch(seite, /javascript:/, "nur BOAMP-Links");
  assert.match(seite, /content="Appels d&#39;offres publics de nettoyage[^"]*1\u202f234 appels d&#39;offres sur les 30 derniers jours/);
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  const ohne = await (await metiers(new Request("https://app.example/fr/appels-d-offres/menuiserie"), env, "https://app.example", antwort))!.text();
  globalThis.fetch = echt;
  assert.doesNotMatch(ohne, /class="gewerk-zahlen"/, "ohne Zahlen keine leere Box");
  assert.equal((await metiers(new Request("https://app.example/fr/appels-d-offres/gibtsnicht"), env, "https://app.example", antwort))!.status, 301);
  assert.equal(await metiers(new Request("https://app.example/fr"), env, "https://app.example", antwort), null);
  // Same prefix lists as the background cache in the migration.
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../../supabase/migrations/20261102130000_boamp_bestand.sql", import.meta.url), "utf8");
  for (const m of METIERS) assert.ok(sql.includes(`('fr:${m.praefixe.join(",")}'`), `Cache-Schlüssel fehlt: ${m.slug}`);
  assert.match(sitemap("https://app.example"), /<loc>https:\/\/app.example\/fr\/appels-d-offres\/securite-gardiennage<\/loc>/);
});
