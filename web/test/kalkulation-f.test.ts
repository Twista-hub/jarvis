import assert from "node:assert/strict";
import { test } from "node:test";
import { BRANCHEN_VORLAGEN, MINDESTLOHN, preisGrafik, rechnen, STANDARD, untergrenze, vergleichsWorte, zuschlagVergleich } from "../src/kalkulation.ts";
import { angebotsText } from "../src/angebotsauswahl.ts";


const lose = [{ nr: "1", name: "Küche", menge: 100, einheit: "Stunden", zeitraum: "", hinweis: "" }, { nr: "2", name: "Service", menge: 100, einheit: "Stunden", zeitraum: "", hinweis: "" }];

test("F1: Zuschlagsvergleich ordnet das eigene Angebot ein und maskiert Texte", () => {
  const html = zuschlagVergleich(300000, [
    { id: "a", titel: "Kantine <b>", auftraggeber: "Stadt", ort: "", datum: "2025-01-01T00:00:00Z", wert: 400000, gewinner: "", link: "https://x.test/1" },
    { id: "b", titel: "Service", auftraggeber: "Land", ort: "", datum: null, wert: 500000, gewinner: "", link: "javascript:alert(1)" },
  ], 250000);
  assert.match(html, /unter allen gefundenen Zuschlägen/);
  assert.match(html, /Mitte 450\.000,00/);
  assert.match(html, /Kantine &lt;b&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(zuschlagVergleich(0, []), /noch keine veröffentlichten Zuschlagswerte/);
  assert.deepEqual(vergleichsWorte("Rahmenvereinbarung Leihpersonal für die Gastronomie der Deutschen Bundesbank"), ["leihpersonal", "gastronomie", "bundesbank"]);
});

test("F2: Preisuntergrenze und Warnung unter dem Branchenmindestlohn", () => {
  const boden = { lohn: 14.8, name: "Branchenmindestlohn Gebäudereinigung" };
  const r = rechnen({ ...STANDARD, lohn: 15 }, lose, { "1": 100, "2": 100 }, { "2": { lohn: 14.2 } }, undefined, boden);
  assert.ok(r.warnungen.some((w) => /Los 2: Lohn unter dem Branchenmindestlohn Gebäudereinigung/.test(w)));
  assert.equal(r.untergrenze, untergrenze({ ...STANDARD, lohn: 15 }, 14.8));
  assert.ok(r.untergrenze < r.preisProStunde);
  assert.ok(rechnen({ ...STANDARD, nebenkosten: 10, ausfall: 5 }, [], {}).warnungen.some((w) => /Lohnnebenkosten/.test(w)));
  assert.equal(rechnen(STANDARD, [], {}).boden, MINDESTLOHN);
});

test("F3: Angebot nennt den Preis je Stunde pro Los", () => {
  const text = angebotsText({ titel: "Kantine", firma: "F", proStunde: 30, nachweise: [], zeilen: [{ nr: "1", name: "Küche", stunden: 100, netto: 3200, zeitraum: "", preis: 32 }, { nr: "2", name: "Service", stunden: 100, netto: 2800, zeitraum: "", preis: 28 }] });
  assert.match(text, /\| Los \| Leistung \| Menge \| Preis je Stunde netto \| Gesamt netto \|/);
  assert.match(text, /\| 1 \| Küche \| 100 Stunden \| 32,00\s€ \| 3\.200,00\s€ \|/);
  assert.match(text, /gelten je Los/);
});

test("F4: Branchen-Startwerte lassen den Lohn unverändert", () => {
  for (const v of Object.values(BRANCHEN_VORLAGEN)) assert.equal(v.werte.lohn, undefined);
  assert.equal(Object.keys(BRANCHEN_VORLAGEN).length, 5);
});

test("F5: Grafik zeigt die Bestandteile mit Anteilen", () => {
  const r = rechnen(STANDARD, [], {});
  const html = preisGrafik(r.schritte, r.preisProStunde);
  assert.match(html, /class="preis-balken"/);
  assert.match(html, /Stundenlohn<b>15,00/);
  assert.match(html, /Wagnis und Gewinn/);
  assert.doesNotMatch(html, /Selbstkosten/);
});

test("F1: Jahresstunden werden für den Vergleich auf die Laufzeit hochgerechnet", async () => {
  const { laufzeitFaktor } = await import("../src/kalkulation.ts");
  const proJahr = lose.map((l) => ({ ...l, zeitraum: "pro Jahr" }));
  assert.equal(laufzeitFaktor(proJahr, 24), 2);
  assert.equal(laufzeitFaktor(lose, 24), 1); // kein Jahresbezug: Stunden gelten für die ganze Laufzeit
  assert.equal(laufzeitFaktor([], 24), 1);
  const html = zuschlagVergleich(800000, [{ id: "a", titel: "x", auftraggeber: "y", ort: "", datum: null, wert: 700000, gewinner: "", link: "" }], 750000, "über 24 Monate Laufzeit");
  assert.match(html, /Euer Angebot über 24 Monate Laufzeit/);
  assert.match(html, /Selbstkosten ohne Gewinn: 750\.000,00\s€ – über der Mitte der Zuschläge/);
});
