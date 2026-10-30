import assert from "node:assert/strict";
import { test } from "node:test";
import { hilfe, seite } from "../src/seite.ts";

test("Kontexthilfe bleibt geschlossen, ist barrierearm und escaped Inhalte", () => {
  const block = hilfe('<img src=x>', "Preis & Daten < geheim");
  assert.match(block, /^<details class="hilfe"><summary aria-label="&#60;img src=x&#62;" title="&#60;img src=x&#62;"><span aria-hidden="true">ℹ️<\/span><\/summary>/);
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

test("Mehrere Kontexthilfen teilen ein Symbol neben der Seitenüberschrift", () => {
  const html = seite("Firma & Team", `<h2>Personal</h2>${hilfe("Personal", "Kräfte eintragen")}<form></form><h2>Zugänge</h2>${hilfe("Rechte", "Zugriff auswählen")}`);
  assert.equal((html.match(/<details class="seiten-hilfe">/g) ?? []).length, 1);
  assert.match(html, /<div class="seiten-titel"><h1>Firma &#38; Team<\/h1><details/);
  assert.match(html, /<strong>Personal<\/strong><br>Kräfte eintragen/);
  assert.match(html, /<strong>Rechte<\/strong><br>Zugriff auswählen/);
  assert.doesNotMatch(html, /<details class="hilfe">/);
  assert.match(html, /width: min\(360px, 100%\)/);
});

test("Bestehende Seitenüberschrift erhält das Symbol ohne zweite Überschrift", () => {
  const html = seite("Standort", `<h1>Hamburg</h1><p>Personal</p>${hilfe("Einplanung", "Status ändern")}`);
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  assert.match(html, /<div class="seiten-titel"><h1>Hamburg<\/h1><details/);
  assert.match(html, /<summary aria-label="Hinweise zu Standort"/);
});
