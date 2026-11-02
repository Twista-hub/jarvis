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
  assert.equal((map.match(/<loc>/g) ?? []).length, 60); // 49 + 11 französische Seiten
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
  const r = metiers(new Request("https://app.example/fr/appels-d-offres/nettoyage"), "https://app.example", antwort)!;
  assert.equal(r.headers.get("x-jv-sprache"), "fr");
  assert.equal(r.headers.get("x-robots-tag"), null);
  const seite = await r.text();
  assert.match(seite, /<html lang="fr"/);
  assert.match(seite, /hreflang="de" href="https:\/\/app.example\/ausschreibungen\/gebaeudereinigung"/);
  assert.match(seite, /rel="canonical" href="https:\/\/app.example\/fr\/appels-d-offres\/nettoyage"/);
  assert.equal(metiers(new Request("https://app.example/fr/appels-d-offres/gibtsnicht"), "https://app.example", antwort)!.status, 301);
  assert.equal(metiers(new Request("https://app.example/fr"), "https://app.example", antwort), null);
  assert.match(sitemap("https://app.example"), /<loc>https:\/\/app.example\/fr\/appels-d-offres\/securite-gardiennage<\/loc>/);
});
