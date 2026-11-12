import test from "node:test";
import assert from "node:assert/strict";
import { FRAGEN, fragen, frageSeite, fragenUebersicht } from "../src/fragen.ts";
import { GEWERKE, LLMS, sitemap } from "../src/gewerke.ts";
import { BUNDESLAENDER } from "../src/nuts.ts";

const antwort = (h: string) => new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
const zahlen = async () => ({ offen: 12345, woche: 2100 });
const holen = (pfad: string, z = zahlen) => fragen(new Request(`https://crewtender.eu${pfad}`), "https://crewtender.eu", antwort, z);

test("Fragen: zehn Seiten mit eindeutigen Adressen, Antwort und Quellen", () => {
  assert.equal(FRAGEN.length, 10);
  assert.equal(new Set(FRAGEN.map((f) => f.slug)).size, 10);
  for (const f of FRAGEN) {
    assert.match(f.slug, /^[a-z0-9-]+$/);
    assert.ok(f.frage.endsWith("?"), f.slug);
    assert.ok(f.kurz.length > 120 && f.kurz.length < 520, `${f.slug}: Antwort ${f.kurz.length} Zeichen`);
    assert.ok(f.quellen.length >= 1 && f.quellen.every(([n, u]) => n && u.startsWith("https://")), f.slug);
    const html = frageSeite(f, { zahlen: { offen: 12345, woche: 2100 } });
    assert.doesNotMatch(html, /undefined|NaN|\$\{/, f.slug);
    assert.match(html, /Kurz gesagt:/);
    assert.match(html, /keine Rechtsberatung/);
    assert.equal((html.match(/href="\/fragen\/[a-z0-9-]+"/g) ?? []).length, 9, `${f.slug}: Links zu den anderen neun Fragen`);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
    assert.equal(ld["@type"], "FAQPage");
    assert.equal(ld.mainEntity[0].name, f.frage);
    assert.equal(ld.mainEntity[0].acceptedAnswer.text, f.kurz);
  }
});

test("Fragen: interne Links zeigen auf vorhandene Gewerke und Bundesländer", () => {
  const gewerke = new Set(GEWERKE.map((g) => g.slug)), laender = new Set(BUNDESLAENDER.map((l) => l.slug));
  for (const f of FRAGEN) {
    const html = frageSeite(f, { zahlen: null });
    for (const m of html.matchAll(/href="\/ausschreibungen\/([a-z-]+)(?:\/([a-z-]+))?"/g)) {
      assert.ok(gewerke.has(m[1]), `${f.slug}: Gewerk ${m[1]}`);
      if (m[2]) assert.ok(laender.has(m[2]), `${f.slug}: Bundesland ${m[2]}`);
    }
  }
});

test("Fragen: geprüfte Zahlen (Stand 12.11.2026) und Rechenbeispiel aus dem Rechner", () => {
  const seite = (slug: string) => frageSeite(FRAGEN.find((f) => f.slug === slug)!, { zahlen: null });
  const wert = seite("ab-welchem-auftragswert");
  assert.match(wert, /5\.404\.000 €/);
  assert.match(wert, /216\.000 €/);
  assert.match(wert, /140\.000 €/);
  assert.match(wert, /bis 50\.000 € netto ohne Vergabeverfahren direkt/);
  assert.match(seite("unterlagen-nachweise"), /§ 122 Abs\. 3 GWB/);
  const satz = seite("stundenverrechnungssatz-kalkulieren");
  assert.match(satz, /13,90 € im Jahr 2026, 14,60 € ab 2027/);
  assert.match(satz, /= Verrechnungssatz<\/strong><\/td><td><strong>\d+,\d\d\s€/);
  assert.match(satz, /Die Selbstkosten liegen in diesem Beispiel bei \d+,\d\d\s€ pro Stunde/);
  assert.match(seite("ausschreibungsportale-und-kosten"), /Free 0 €, Basis 59 €, Pro 149 €, Business 399 €/);
});

test("Fragen: Katalogzahlen nur, wenn sie da sind", () => {
  const f = FRAGEN.find((x) => x.slug === "ausschreibungen-finden")!;
  assert.match(frageSeite(f, { zahlen: { offen: 12345, woche: 2100 } }), /<strong>12\.345 offene Ausschreibungen<\/strong> aus amtlichen Bekanntmachungen, 2\.100 davon/);
  assert.doesNotMatch(frageSeite(f, { zahlen: null }), /offene Ausschreibungen<\/strong>/);
});

test("Fragen: Auslieferung, Übersicht, Sitemap und llms.txt", async () => {
  const r = (await holen("/fragen/kosten-teilnahme"))!;
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-jv-sprache"), "de");
  assert.equal(r.headers.get("x-robots-tag"), null);
  const html = await r.text();
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, "genau eine Hauptüberschrift");
  assert.match(html, /<link rel="canonical" href="https:\/\/crewtender\.eu\/fragen\/kosten-teilnahme">/);
  assert.match(html, /<meta name="description" content="Die Teilnahme selbst kostet nichts/);
  let abrufe = 0;
  await holen("/fragen/kosten-teilnahme", async () => { abrufe++; return null; });
  assert.equal(abrufe, 0, "Seite ohne Katalogzahlen ruft keine Daten ab");
  await holen("/fragen/ausschreibungen-finden", async () => { abrufe++; return null; });
  assert.equal(abrufe, 1);
  const u = (await holen("/fragen"))!;
  assert.equal((await u.text()).match(/class="standort-zeile" href="\/fragen\//g)?.length, 10);
  assert.match(fragenUebersicht(), /Wie finde ich öffentliche Ausschreibungen für meine Firma\?/);
  assert.equal((await holen("/fragen/gibt-es-nicht"))!.status, 301);
  assert.equal(await holen("/preise"), null);
  assert.equal(await fragen(new Request("https://crewtender.eu/fragen", { method: "POST" }), "https://crewtender.eu", antwort, zahlen), null);
  const karte = sitemap("https://crewtender.eu");
  for (const f of FRAGEN) assert.ok(karte.includes(`<loc>https://crewtender.eu/fragen/${f.slug}</loc>`), f.slug);
  assert.match(LLMS("https://crewtender.eu"), /## Questions and answers \(German\)\n\n- \[Wie finde ich öffentliche Ausschreibungen für meine Firma\?\]\(https:\/\/crewtender\.eu\/fragen\/ausschreibungen-finden\)/);
});
