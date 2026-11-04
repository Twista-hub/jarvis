import assert from "node:assert/strict";
import { test } from "node:test";
import { OG_PFAD, START_JSONLD, ogErgaenzen, seitenTitel, seoKopf } from "../src/seo.ts";
import { seite } from "../src/seite.ts";
import { statisch } from "../src/app.ts";

test("SEO: Marke nur einmal im Titel, Vorschau-Tags auf jeder Seite", () => {
  assert.equal(seitenTitel("Impressum"), "Impressum · Crewtender");
  assert.equal(seitenTitel("Crewtender – Öffentliche Aufträge finden"), "Crewtender – Öffentliche Aufträge finden");
  const h = seite("Crewtender", "<p>x</p>");
  assert.match(h, /<title>Crewtender<\/title>/);
  assert.doesNotMatch(h, /Crewtender · Crewtender/);
  assert.match(h, /property="og:image" content="https:\/\/crewtender\.eu\/og-v1\.jpg"/);
  assert.match(h, /name="twitter:card" content="summary_large_image"/);
});

test("SEO: Beschreibung, og:description und JSON-LD", () => {
  const k = seoKopf({ beschreibung: 'Ausschreibungen "finden" & mehr', url: "https://crewtender.eu/de", jsonld: START_JSONLD });
  assert.match(k, /<meta name="description" content="Ausschreibungen &quot;finden&quot; &amp; mehr">/);
  assert.match(k, /property="og:url" content="https:\/\/crewtender\.eu\/de"/);
  const ld = JSON.parse(k.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1]);
  assert.equal(ld["@graph"][0].name, "Crewtender");
  assert.equal(ogErgaenzen('<head><meta name="description" content="Text"></head>'), '<head><meta name="description" content="Text"><meta property="og:description" content="Text"></head>');
  assert.equal(ogErgaenzen("<head></head>"), "<head></head>");
  const bild = statisch(OG_PFAD);
  assert.equal(bild?.headers.get("content-type"), "image/jpeg");
});
