import assert from "node:assert/strict";
import { test } from "node:test";
import { hilfe, seite } from "../src/seite.ts";

test("Kontexthilfe bleibt geschlossen, ist barrierearm und escaped Inhalte", () => {
  const block = hilfe('<img src=x>', "Preis & Daten < geheim");
  assert.match(block, /^<details class="hilfe"><summary>ℹ️ &#60;img src=x&#62;<\/summary>/);
  assert.match(block, /Preis &#38; Daten &#60; geheim/);
  assert.doesNotMatch(block, /<img/);
});

test("Seitenrahmen hat gut erreichbare Handy- und Tastaturbedienung", () => {
  const html = seite("Vorschau", "<p>Inhalt</p>", 0, "team");
  assert.match(html, /@media \(max-width: 600px\)/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /position: fixed/);
});
