import assert from "node:assert/strict";
import { test } from "node:test";
import { nettoAusText, staende, uebersichtSeite } from "../src/angebotsuebersicht.ts";
import { angebotsText } from "../src/angebotsauswahl.ts";
import { entleiherSchluessel, fristen, fristStatus, personHinweise, plusMonate, type Ueberlassung } from "../src/aueg.ts";

test("N1: Stand je Ausschreibung aus Status, letzter Angebotsversion und Abgabe", () => {
  const v = (id: string, status: string) => ({ id, titel: id, frist: null, status, kaufverantwortlich_id: null });
  const m = (id: string, vorgang_id: string, erstellt: string, freigabe_status: string) => ({ id, vorgang_id, erstellt, freigabe_status });
  const z = staende([v("a", "angebot"), v("b", "angebot"), v("c", "angebot"), v("d", "angebot"), v("e", "abgegeben"), v("f", "gewonnen"), v("g", "verloren")],
    [m("m1", "b", "2026-10-01", "genehmigt"), m("m2", "b", "2026-10-02", "wartet"), m("m3", "c", "2026-10-01", "genehmigt"), m("m4", "d", "2026-10-01", "abgelehnt"), m("m5", "a", "2026-10-01", "genehmigt")],
    [{ mappe_id: "m5", abgegeben_am: "2026-10-05", portal: "DTVP" }]);
  assert.deepEqual(z.map((x) => x.stand), ["abgegeben", "chef", "freigegeben", "arbeit", "abgegeben", "zuschlag", "absage"]);
  assert.equal(z[3].ueberarbeiten, true);
  const text = angebotsText({ titel: "T", firma: "F", proStunde: 30, nachweise: [], zeilen: [{ nr: "1", name: "L", stunden: 10, netto: 12345, zeitraum: "", preis: 30 }] });
  assert.equal(nettoAusText(text), 12345);
  assert.equal(nettoAusText("ohne Tabelle"), null);
  const html = uebersichtSeite(z, { filter: "", finanzen: false, darfAendern: true, personen: {} });
  assert.match(html, /50 %/); // 1 von 2 entschiedenen gewonnen
  assert.match(html, /value="gewonnen"/);
  assert.doesNotMatch(html, /€/); // ohne Finanzfreigabe keine Summen
  assert.match(uebersichtSeite(z, { filter: "chef", finanzen: true, darfAendern: false, personen: {} }), /Wartet auf Chef/);
});

const u = (von: string, bis: string | null, entleiher = "Messe Berlin GmbH", personal_id = "p1"): Ueberlassung => ({ id: von, personal_id, entleiher, von, bis, notiz: "" });

test("N13: Equal Pay nach 9 und Höchstdauer nach 18 Monaten", () => {
  const [f] = fristen([u("2026-03-01", null)], "2026-11-01");
  assert.deepEqual([f.equalPay, f.hoechst], ["2026-12-01", "2027-08-31"]);
  assert.equal(plusMonate("2026-08-31", 6), "2027-02-28");
  assert.equal(plusMonate("2027-08-31", 6), "2028-02-29");
});

test("N13: Unterbrechung bis 3 Monate zählt weiter (ohne die Pause), länger beginnt neu", () => {
  const [f] = fristen([u("2026-01-01", "2026-03-31"), u("2026-06-01", null, "Messe Berlin")], "2026-11-01");
  assert.equal(f.unterbrechungTage, 61);
  assert.equal(f.equalPay, "2026-12-01"); // 3 Monate Jan–Mär + 6 Monate ab Juni
  assert.equal(f.beginn, "2026-01-01");
  const [neu] = fristen([u("2026-01-01", "2026-01-31"), u("2026-06-01", null)], "2026-11-01");
  assert.equal(neu.beginn, "2026-06-01");
  assert.equal(neu.equalPay, "2027-03-01");
  assert.equal(fristen([u("2025-01-01", "2026-05-31")], "2026-11-01").length, 0); // seit über 3 Monaten beendet
  assert.equal(fristen([u("2026-01-01", null, "Messe Berlin"), u("2026-01-01", null, "Hafen AG")], "2026-11-01").length, 2);
  assert.equal(entleiherSchluessel("Messe Berlin GmbH"), entleiherSchluessel("messe  berlin"));
});

test("N13: Dringlichkeit und Hinweis auf der Personalkarte", () => {
  const [bald] = fristen([u("2026-02-15", null)], "2026-11-01"); // Equal Pay 15.11.2026
  assert.deepEqual(fristStatus(bald, "2026-11-01"), { stufe: "rot", text: "Equal Pay ab 15.11.2026 (in 14 Tagen)" });
  const [lang] = fristen([u("2025-05-01", null)], "2026-11-01"); // Höchstdauer 31.10.2026
  assert.equal(fristStatus(lang, "2026-11-01").text, "Höchstdauer seit 31.10.2026 überschritten");
  const [ruhig] = fristen([u("2026-10-01", null)], "2026-11-01");
  assert.equal(fristStatus(ruhig, "2026-11-01").stufe, "gruen");
  assert.deepEqual(Object.keys(personHinweise([bald, ruhig], "2026-11-01")), ["p1"]);
});
