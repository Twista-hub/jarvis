import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bereinigen, ausFormular, profilFormular, profilZuFormular } from "../src/einrichtung.ts";
import type { Firmenstandort } from "../src/firmenstandorte.ts";

const firmenstandorte: Firmenstandort[] = JSON.parse(readFileSync(new URL("../../alarm/testdaten/firmenstandorte.json", import.meta.url), "utf8"));
const vorher = { firmenstandorte, standorte: [{ name: "Berlin", plz_praefixe: ["10", "14"], bereich_id: firmenstandorte[0].bereich_id }] };

test("Bestandsprofil mit nur Berlin nimmt ohne neue Recherche alle 16 Niederlassungen in die Suche auf", () => {
  const v = bereinigen(vorher);
  assert.equal(v.suchgebiet_modus, "firmenstandorte");
  assert.equal(v.standorte.length, 16);
  assert.deepEqual(v.standorte[0].plz_praefixe, ["10", "14"]);
  assert.deepEqual(v.standorte.find((x) => x.name === "Aachen")!.plz_praefixe, ["52"]);
  assert.deepEqual(v.standorte.find((x) => x.name === "Hamburg")!.plz_praefixe, ["20"]);
  assert.deepEqual(v.standorte.map((x) => x.bereich_id), firmenstandorte.map((x) => x.bereich_id));
  assert.deepEqual(ausFormular(profilZuFormular(v, "https://firma.example")), v);
  const html = profilFormular("firma", v, "");
  assert.match(html, /value="firmenstandorte" selected>Alle 16 Firmenstandorte/);
});

test("eigene Suchorte bleiben ausdrücklich auswählbar und überstehen die Formularübertragung", () => {
  const v = bereinigen({ ...vorher, suchgebiet_modus: "manuell" });
  assert.equal(v.standorte.length, 1);
  assert.equal(v.standorte[0].name, "Berlin");
  assert.deepEqual(ausFormular(profilZuFormular(v, "https://firma.example")), v);
  assert.match(profilFormular("firma", v, ""), /value="manuell" selected>Nur ausgewählte Orte/);
});

test("Standorte ohne Postleitzahl bleiben als einzelne Suchorte erhalten", () => {
  const v = bereinigen({ firmenstandorte: firmenstandorte.map((o) => ({ ...o, plz: "" })) });
  assert.equal(v.standorte.length, 16);
  assert.deepEqual(v.standorte.find((o) => o.name === "Hamburg")!.plz_praefixe, []);
});
