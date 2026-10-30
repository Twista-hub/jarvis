import assert from "node:assert/strict";
import { test } from "node:test";
import { ausFormular, bereinigen, profilFormular } from "../src/einrichtung.ts";

test("cleans the proposal: digits only, lower-case words, no empty services", () => {
  const v = bereinigen({
    beschreibung: " Zeitarbeit für Events. ",
    leistungen: [{ name: "Service", cpv: ["79620000", "x", "7"], woerter: ["Servicekräfte", "ab", "servicekräfte"] }, { name: "", cpv: ["1"], woerter: [] }],
    ausschluss: ["Bau"],
    ausschluss_cpv: ["45"],
    standorte: [{ name: "Köln", plz_praefixe: ["50", "501", "51"] }],
  });
  assert.deepEqual(v.leistungen, [{ name: "Service", cpv: ["79620000"], woerter: ["servicekräfte"] }]);
  assert.deepEqual(v.standorte, [{ name: "Köln", plz_praefixe: ["50", "51"] }]);
  assert.equal(v.beschreibung, "Zeitarbeit für Events.");
});

test("form round trip keeps checked services and locations only", () => {
  const html = profilFormular("00000000-0000-0000-0000-000000000000", bereinigen({
    beschreibung: "Wir stellen Servicepersonal für Messen.",
    leistungen: [{ name: "Messepersonal", cpv: ["79620"], woerter: ["messepersonal", "hostess"] }],
    standorte: [{ name: "Köln", plz_praefixe: ["50"] }],
  }), "");
  const form = new FormData();
  for (const [, k, v] of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/g)) if (!/_an$/.test(k)) form.set(k, v);
  form.set("beschreibung", "Wir stellen Servicepersonal für Messen.");
  form.set("l0_an", "1");
  form.set("l1_an", "1"); // the empty extra row is dropped
  const v = ausFormular(form);
  assert.deepEqual(v.leistungen, [{ name: "Messepersonal", cpv: ["79620"], woerter: ["messepersonal", "hostess"] }]);
  assert.deepEqual(v.standorte, []); // location not ticked
});

test("Länder im Suchprofil: Deutschland als Standard, nur bekannte Länder, Auswahl im Formular", async () => {
  const { bereinigen, ausFormular, profilFormular } = await import("../src/einrichtung.ts");
  assert.deepEqual(bereinigen({}).laender, ["DEU"]);
  assert.deepEqual(bereinigen({ laender: ["AUT", "XXX", "AUT", "NLD"] }).laender, ["AUT", "NLD"]);
  const f = new FormData();
  f.set("beschreibung", "Personaldienstleister für Gastronomie und Logistik");
  f.append("laender", "DEU");
  f.append("laender", "AUT");
  assert.deepEqual(ausFormular(f).laender, ["DEU", "AUT"]);
  const html = profilFormular("f", bereinigen({ laender: ["DEU", "AUT"] }), "");
  assert.match(html, /value="AUT" checked/);
  assert.match(html, /<details open><summary>Nachbarländer/);
});
