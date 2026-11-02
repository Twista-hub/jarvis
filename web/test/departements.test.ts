import test from "node:test";
import assert from "node:assert/strict";
import { departementAusPlz, departementAuswahl, departementsBereinigen, standardDepartements } from "../src/departements.ts";
import { ausFormular, profilFormular } from "../src/einrichtung.ts";

test("Départements: PLZ, Bereinigung, Standard aus der Region", () => {
  assert.equal(departementAusPlz("75011"), "75");
  assert.equal(departementAusPlz("20090"), "2A");
  assert.equal(departementAusPlz("20600"), "2B");
  assert.equal(departementAusPlz("97200"), "972");
  assert.equal(departementAusPlz("98000"), null);
  assert.deepEqual(departementsBereinigen(["92", "75", "2a", "xx", "75"]), ["2A", "75", "92"]);
  assert.deepEqual(standardDepartements(["FRA"], "69003"), ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"]);
  assert.deepEqual(standardDepartements(["FRA", "DEU"], "69003"), [], "mit Deutschland kein Standard");
  assert.deepEqual(standardDepartements(["DEU"], "75011"), []);
  const html = departementAuswahl(["75"]);
  assert.match(html, /value="75" checked/);
  assert.match(html, /<details open><summary>Île-de-France <span class="check-zahl">1 ausgewählt/);
  assert.match(departementAuswahl([]), /ganz Frankreich/);
});

test("Départements: Formular nur mit Frankreich, Radius nur mit Deutschland, Speichern", () => {
  const leer = { beschreibung: "", website_beschreibung: "", websuche_beschreibung: "", websuche_quellen: [], leistungen: [], ausschluss: [], ausschluss_cpv: [], standorte: [] };
  const fr = profilFormular("f", { ...leer, laender: ["FRA"], departements: ["13"] }, "");
  assert.match(fr, /name="departements" value="13" checked/);
  assert.doesNotMatch(fr, /<select name="radius_km">/);
  assert.doesNotMatch(fr, /name="o0_name"/, "keine deutschen Suchorte bei reiner Frankreich-Suche");
  const de = profilFormular("f", { ...leer, laender: ["DEU"] }, "");
  assert.doesNotMatch(de, /name="departements"/);
  assert.match(de, /<select name="radius_km">/);
  const form = new FormData();
  form.append("laender", "FRA"); form.append("departements", "13"); form.append("departements", "84"); form.append("departements", "zz");
  assert.deepEqual(ausFormular(form).departements, ["13", "84"]);
});

test("Woiwodschaften: Formular mit Polen, Speichern", async () => {
  const { woiwodschaftenBereinigen } = await import("../src/woiwodschaften.ts");
  assert.deepEqual(woiwodschaftenBereinigen(["slaskie", "mazowieckie", "xx"]), ["mazowieckie", "slaskie"]);
  const leer = { beschreibung: "", website_beschreibung: "", websuche_beschreibung: "", websuche_quellen: [], leistungen: [], ausschluss: [], ausschluss_cpv: [], standorte: [] };
  const pl = profilFormular("f", { ...leer, laender: ["POL"], woiwodschaften: ["mazowieckie"] }, "");
  assert.match(pl, /name="woiwodschaften" value="mazowieckie" checked/);
  assert.doesNotMatch(pl, /name="departements"/);
  assert.doesNotMatch(pl, /name="o0_name"/);
  const form = new FormData();
  form.append("laender", "POL"); form.append("woiwodschaften", "lodzkie");
  assert.deepEqual(ausFormular(form).woiwodschaften, ["lodzkie"]);
});
