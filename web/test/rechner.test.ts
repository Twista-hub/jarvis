import { test } from "node:test";
import assert from "node:assert/strict";
import { rechner, rechnerSeite, rechnerWerte, vergleichSeite } from "../src/rechner.ts";

test("Stundensatz-Rechner: Werte aus der Adresse, Grenzen, Ergebnis wie in der App", () => {
  const w = rechnerWerte(new URL("https://x/stundensatz-rechner?branche=sicherheit&lohn=15,50&gewinn=999&nebenkosten="));
  assert.equal(w.branche, "sicherheit");
  assert.equal(w.werte.lohn, 15.5);
  assert.equal(w.werte.gewinn, 7, "zu großer Wert fällt auf die Branchenvorlage zurück");
  assert.equal(w.werte.nebenkosten, 22, "leeres Feld nimmt die Vorlage");
  assert.equal(rechnerWerte(new URL("https://x/stundensatz-rechner?branche=<script>")).branche, "reinigung");
  const html = rechnerSeite(new URL("https://x/stundensatz-rechner?branche=reinigung&lohn=16"));
  assert.match(html, /Ergebnis: <strong>[\d.,]+\s€<\/strong> pro Stunde/);
  assert.match(html, /Untergrenze ohne Gewinn/);
  assert.ok(!html.includes("<script"), "kein Skript");
});

test("Vergleich: nur Kategorien, keine Anbieternamen, Stand angegeben", () => {
  const html = vergleichSeite();
  for (const name of ["DTAD", "subreport", "TendiGo", "PlanD", "Darkbird", "Auftrag One", "VergabePilot"]) assert.ok(!html.includes(name), name);
  assert.match(html, /Stand \d\d\.\d\d\.\d{4}/);
});

test("Routen: Rechner ohne Parameter indexierbar, berechnete Varianten noindex, Seiten nur deutsch", () => {
  const antwort = (h: string) => new Response(h, { headers: { "content-type": "text/html", "x-robots-tag": "noindex" } });
  const a = rechner(new Request("https://crewtender.eu/stundensatz-rechner"), "https://crewtender.eu", antwort)!;
  assert.equal(a.headers.get("x-robots-tag"), null);
  assert.equal(a.headers.get("x-jv-sprache"), "de");
  const b = rechner(new Request("https://crewtender.eu/stundensatz-rechner?lohn=16"), "https://crewtender.eu", antwort)!;
  assert.equal(b.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(rechner(new Request("https://crewtender.eu/vergleich"), "https://crewtender.eu", antwort));
  assert.equal(rechner(new Request("https://crewtender.eu/andere"), "https://crewtender.eu", antwort), null);
});
