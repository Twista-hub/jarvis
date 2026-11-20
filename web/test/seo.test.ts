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

test("Vorschau geteilter Links: deutsches Bild auf deutschen Seiten, Vorschau-Roboter erkannt", async () => {
  const { istVorschauRoboter, vorschauBild } = await import("../src/seo.ts");
  const de = seite("Preise", "<p>x</p>");
  assert.match(vorschauBild(de), /property="og:image" content="https:\/\/crewtender\.eu\/og-de-v1\.jpg"/);
  assert.match(vorschauBild(de.replace('<html lang="de"', '<html lang="en"')), /content="https:\/\/crewtender\.eu\/og-v1\.jpg"/);
  for (const k of ["fr", "pl", "es", "it"]) assert.match(vorschauBild(de.replace('<html lang="de"', `<html lang="${k}"`)), new RegExp(`content="https://crewtender\\.eu/og-${k}-v1\\.jpg"`), k);
  assert.match(vorschauBild(de.replace('<html lang="de"', '<html lang="nl"')), /content="https:\/\/crewtender\.eu\/og-v1\.jpg"/, "ohne eigenes Bild: englisch");
  const mit = (ua: string) => istVorschauRoboter(new Request("https://x/", { headers: { "user-agent": ua } }));
  for (const ua of ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "WhatsApp/2.23.20.0", "TelegramBot (like TwitterBot)", "LinkedInBot/1.0", "facebookexternalhit/1.1 Facebot Twitterbot/1.0"]) assert.ok(mit(ua), ua);
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Safari/604.1", "Mozilla/5.0 (compatible; meta-externalagent/1.1)"]) assert.ok(!mit(ua), ua);
});
