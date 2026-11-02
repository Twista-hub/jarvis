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
  assert.equal((map.match(/<loc>/g) ?? []).length, 49);
  assert.match(ROBOTS("https://app.example"), /Disallow: \/konto[\s\S]*Sitemap: https:\/\/app.example\/sitemap.xml/);
});
