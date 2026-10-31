import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteKontext, websiteNormalisieren } from "../src/webseite.ts";

test("liest Firmenstartseite und passende Leistungs-Unterseite derselben Website", async () => {
  const abfragen: string[] = [];
  const result = await websiteKontext("https://firma.example", async (input) => {
    const url = String(input);
    abfragen.push(url);
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /intern", { status: 200 });
    if (url.endsWith("/leistungen/fliesen")) return new Response("<html><body><h1>Fliesen und Badsanierung</h1></body></html>", { headers: { "content-type": "text/html" } });
    return new Response("<html><head><title>Elektro Muster</title><meta name=\"description\" content=\"Elektroinstallation und Wartung\"></head><body><h1>Elektrofachbetrieb</h1><a href=\"/leistungen/fliesen\">Leistungen</a><a href=\"/intern/jobs\">Intern</a><a href=\"https://fremd.example/leistungen\">Fremdseite</a></body></html>", { headers: { "content-type": "text/html" } });
  });
  assert.equal(abfragen.length, 4); // homepage, one relevant page and the default sitemap probe
  assert.match(result.text, /Elektro Muster/);
  assert.match(result.text, /Elektroinstallation und Wartung/);
  assert.match(result.text, /Fliesen und Badsanierung/);
  assert.ok(!abfragen.some((url) => url.includes("/intern/")));
  assert.ok(!abfragen.some((url) => url.includes("fremd.example")));
  assert.match(result.hinweis, /1 passende Unterseite geprüft/);
});

test("nutzt Sitemap und findet damit bis zu zehn weitere passende Firmen-Unterseiten", async () => {
  const abfragen: string[] = [];
  const result = await websiteKontext("https://firma.example", async (input) => {
    const url = String(input);
    abfragen.push(url);
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\nSitemap: https://firma.example/sitemap.xml", { status: 200 });
    if (url.endsWith("/sitemap.xml")) {
      const locs = Array.from({ length: 14 }, (_, i) => `<loc>https://firma.example/leistungen/gewerk-${i}</loc>`).join("");
      return new Response(`<urlset>${locs}<loc>https://andere.example/leistungen/fremd</loc><loc>https://firma.example/intern/leistungen</loc></urlset>`, { headers: { "content-type": "application/xml" } });
    }
    if (url.endsWith("/intern/leistungen")) return new Response("Intern");
    return new Response(`<html><body><h1>Firma</h1><p>Leistung auf ${url}</p></body></html>`, { headers: { "content-type": "text/html" } });
  });
  const seiten = abfragen.filter((url) => /\/leistungen\/gewerk-\d+$/.test(url));
  assert.equal(seiten.length, 10);
  assert.ok(!abfragen.some((url) => url.includes("andere.example") || url.includes("/intern/")));
  assert.match(result.text, /Leistung auf https:\/\/firma\.example\/leistungen\/gewerk-0/);
  assert.match(result.hinweis, /10 passende Unterseiten/);
});

test("holt keine Sitemap ab, deren Pfad von robots.txt gesperrt ist", async () => {
  const abfragen: string[] = [];
  await websiteKontext("https://firma.example", async (input) => {
    const url = String(input);
    abfragen.push(url);
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /sitemap.xml");
    return new Response("<html><body><h1>Firma</h1></body></html>", { headers: { "content-type": "text/html" } });
  });
  assert.ok(!abfragen.some((url) => url.endsWith("/sitemap.xml")));
});

test("respektiert robots.txt und liest dann keine gesperrte Website", async () => {
  let seiteAbgerufen = false;
  const result = await websiteKontext("https://firma.example", async (input) => {
    if (String(input).endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /", { status: 200 });
    seiteAbgerufen = true;
    return new Response("soll nicht gelesen werden");
  });
  assert.equal(result.text, "");
  assert.equal(seiteAbgerufen, false);
  assert.match(result.hinweis, /untersagt automatisches Lesen/);
});

test("blockt private Hosts, Weiterleitungen und Nicht-HTML ohne Abbruch der Einrichtung", async () => {
  let anzahl = 0;
  const privat = await websiteKontext("https://127.0.0.1", async () => { anzahl++; return new Response(""); });
  assert.equal(anzahl, 0);
  assert.match(privat.hinweis, /sicheren öffentlichen Abruf/);
  const redirect = await websiteKontext("https://firma.example", async () => { anzahl++; return Response.redirect("https://woanders.example", 302); });
  assert.equal(redirect.text, "");
  assert.match(redirect.hinweis, /erlaubt gerade keinen Abruf/);
  assert.ok(websiteNormalisieren("firma.example"));
});
