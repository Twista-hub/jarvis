import { test } from "node:test";
import assert from "node:assert/strict";
import { herkunftAus, herkunftParsen, herkunftWeitergeben, linksMitHerkunft } from "../src/herkunft.ts";
import { registrierFormular } from "../src/anmeldung.ts";

test("Herkunft aus utm-Parametern oder fremder Website, eigene Seite zählt nicht", () => {
  assert.equal(herkunftAus(new URL("https://crewtender.eu/?utm_source=LinkedIn&utm_medium=social&utm_campaign=kw46<x>"), null), "linkedin~social~kw46x~");
  assert.equal(herkunftAus(new URL("https://crewtender.eu/ausschreibung/x"), "https://www.google.com/"), "~~~google.com");
  assert.equal(herkunftAus(new URL("https://crewtender.eu/ausschreibungen"), "https://crewtender.eu/"), "");
  assert.equal(herkunftAus(new URL("https://crewtender.eu/preise?h=g2~~~"), "https://crewtender.eu/"), "g2~~~");
  assert.equal(herkunftParsen("kaputt"), null);
  assert.deepEqual(herkunftParsen("omr~verzeichnis~~"), { quelle: "omr", medium: "verzeichnis", kampagne: "", verweis: "" });
});

test("Interne Links tragen die Herkunft weiter, Konto und Dateien nicht", () => {
  const html = linksMitHerkunft(`<a href="/registrieren">a</a><a href="/preise?x=1#y">b</a><a href="/konto">c</a><a href="/app.js">d</a><a href="https://example.test/">e</a>`, "g2~~~");
  assert.match(html, /href="\/registrieren\?h=g2~~~"/);
  assert.match(html, /href="\/preise\?x=1&amp;h=g2~~~#y"/);
  assert.match(html, /href="\/konto"/);
  assert.match(html, /href="\/app.js"/);
  assert.match(html, /href="https:\/\/example.test\/"/);
});

test("Seite von außen: Links mit Herkunft und nicht zwischengespeichert; ohne Herkunft unverändert", async () => {
  const seite = () => new Response(`<a href="/registrieren">x</a>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
  const mit = await herkunftWeitergeben(new Request("https://crewtender.eu/?utm_source=facebook"), seite());
  assert.match(await mit.text(), /\/registrieren\?h=facebook~~~/);
  assert.equal(mit.headers.get("cache-control"), "private, no-store");
  const ohne = await herkunftWeitergeben(new Request("https://crewtender.eu/"), seite());
  assert.equal(ohne.headers.get("cache-control"), "public, max-age=3600");
});

test("Registrierung: Herkunft als verstecktes Feld, nicht bei Einladungen", () => {
  assert.match(registrierFormular({}, "", "/konto", undefined, "linkedin~social~~"), /name="herkunft" value="linkedin~social~~"/);
  assert.doesNotMatch(registrierFormular({}, "", "/einladung/abc", undefined, "linkedin~social~~"), /name="herkunft"/);
});
