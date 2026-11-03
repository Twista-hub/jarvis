import test from "node:test";
import assert from "node:assert/strict";
import { menueGruppieren } from "../src/menue.ts";

const z = (href: string, t: string) => `<a class="standort-zeile" href="${href}"><span>${t}</span></a>`;

test("Mehr-Menü: Einträge nach Thema gruppiert, doppelte nur einmal, Unbekanntes unter Weitere", () => {
  const html = menueGruppieren(z("/konto/profil", "Profil") + z("/konto/rechnungen", "Rechnungen") + z("/konto/schichten", "Schichtplan") + z("/konto/brett", "Brett") + z("/konto/brett", "Brett") + z("/konto/neu-irgendwas", "Neu") + z("/konto/hilfe", "Hilfe"));
  const reihenfolge = [...html.matchAll(/<h3 class="werkzeug-gruppe">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(reihenfolge, ["Konto &#38; Suche", "Planung &#38; Personal", "Abrechnung &#38; Kunden", "Firma", "Hilfe", "Weitere"]);
  assert.equal((html.match(/href="\/konto\/brett"/g) ?? []).length, 1);
  assert.ok(html.indexOf("Schichtplan") < html.indexOf("Rechnungen"));
  assert.equal(menueGruppieren(""), "");
});
