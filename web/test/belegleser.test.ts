import test from "node:test";
import assert from "node:assert/strict";
import { gelesenPruefen } from "../src/belegleser.ts";
import { belegeSeite } from "../src/belege.ts";
import LESER from "../src/belegleser.json" with { type: "json" };

test("Belegleser: Antwort prüfen", () => {
  assert.equal(LESER.modell, "claude-haiku-5-5");
  assert.deepEqual(gelesenPruefen({ datum: "2026-10-30", lieferant: "  Aral   Station ", brutto: 59.899, ust_satz: 19, gemischt: false, kategorie: "fahrzeug", sicher: true }, "2026-11-03"),
    { datum: "2026-10-30", lieferant: "Aral Station", brutto: 59.9, ust_satz: 19, gemischt: false, kategorie: "fahrzeug", sicher: true });
  const schlecht = gelesenPruefen({ datum: "2027-01-01", lieferant: "", brutto: -3, ust_satz: 16, gemischt: true, kategorie: "quatsch", sicher: true }, "2026-11-03")!;
  assert.deepEqual([schlecht.datum, schlecht.brutto, schlecht.ust_satz, schlecht.kategorie, schlecht.sicher], ["", 0, 19, "sonstiges", false], "Zukunft, negativ, falscher Satz → leer bzw. unsicher");
  assert.equal(gelesenPruefen({ datum: "2020-01-01", brutto: 5, ust_satz: 7, kategorie: "buero", sicher: true }, "2026-11-03")!.datum, "", "älter als 2 Jahre");
  assert.equal(gelesenPruefen(null, "2026-11-03"), null);
});

test("Belegleser: Formular mit Vorschlag", () => {
  const html = belegeSeite([], { monat: "2026-11", heute: "2026-11-03", kiAn: true, vorschlag: { g: { datum: "2026-11-02", lieferant: "Würth <Filiale>", brutto: 10.7, ust_satz: 7, gemischt: true, kategorie: "material", sicher: true }, dateiId: "a".repeat(8) + "-0000-0000-0000-000000000000", mime: "image/jpeg" } });
  assert.match(html, /value="2026-11-02"/);
  assert.match(html, /value="Würth &#60;Filiale&#62;"/);
  assert.match(html, /value="10,70"/);
  assert.match(html, /<option value="7" selected>/);
  assert.match(html, /<option value="material" selected>/);
  assert.match(html, /mehrere Steuersätze/);
  assert.match(html, /name="datei_id" value="aaaaaaaa-0000/);
  assert.doesNotMatch(html, /Auslesen lassen/, "beim Vorschlag kein zweiter Upload");
  assert.match(belegeSeite([], { monat: "2026-11", heute: "2026-11-03", kiAn: true }), /🤖 Auslesen lassen/);
  assert.doesNotMatch(belegeSeite([], { monat: "2026-11", heute: "2026-11-03", kiAn: false }), /Auslesen lassen/);
  assert.match(belegeSeite([], { monat: "2026-11", heute: "2026-11-03", vorschlag: { g: null, dateiId: "b".repeat(8) + "-0000-0000-0000-000000000000", mime: "image/png" } }), /nicht gelesen werden/);
});
