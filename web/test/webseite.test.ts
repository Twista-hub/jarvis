import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteKontext, websiteNormalisieren } from "../src/webseite.ts";

test("liest nur eine vom Nutzer angegebene Seite und ergänzt Titel/Beschreibung", async () => {
  const abfragen: string[] = [];
  const result = await websiteKontext("https://firma.example", async (input) => {
    const url = String(input);
    abfragen.push(url);
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /intern", { status: 200 });
    return new Response("<html><head><title>Elektro Muster</title><meta name=\"description\" content=\"Elektroinstallation und Wartung\"></head><body><h1>Elektrofachbetrieb</h1></body></html>", { headers: { "content-type": "text/html" } });
  });
  assert.equal(abfragen.length, 2);
  assert.match(result.text, /Elektro Muster/);
  assert.match(result.text, /Elektroinstallation und Wartung/);
  assert.match(result.hinweis, /Startseite gelesen/);
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
