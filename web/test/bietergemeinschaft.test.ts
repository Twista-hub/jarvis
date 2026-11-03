import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { bgeErklaerungDocx, bgeTeilHtml, passendePartner } from "../src/bietergemeinschaft.ts";
import { partnerTeilHtml, type Partner } from "../src/partner.ts";

const p = (id: string, name: string, gewerke: string[], bewertung: number | null = null): Partner => ({ id, name, gewerke, ansprechpartner: "", telefon: "", email: "", region: "Berlin", bewertung, notiz: "" });
const partner = [p("a", "Elektro Klein", ["Elektro"], 3), p("b", "Grün & Co", ["Garten- und Landschaftsbau"], 5), p("c", "Dach Meier", ["Dach"]), p("d", "Wache Nord", ["Sicherheitsdienst"]), p("e", "Spezial", ["Kältetechnik"])];

test("Bietergemeinschaft: passende eigene Partner", () => {
  const text = "Unterhaltsreinigung und Grünpflege Rathaus, Los 3 Objektschutz, Elektroprüfung DGUV V3. Kältetechnik-Wartung";
  const v = passendePartner(text, partner, [{ partner_id: "d" }]);
  assert.deepEqual(v.map((x) => [x.partner.name, x.gewerk]), [["Grün & Co", "Garten- und Landschaftsbau"], ["Elektro Klein", "Elektro"], ["Spezial", "Kältetechnik"]], "best bewertet zuerst, schon angefragt fehlt, Dach passt nicht");
  assert.equal(passendePartner("Neubau Kita", partner, []).length, 0);
  assert.equal(passendePartner("Bedachung", partner, []).length, 0, "nur Wortanfänge");
});

test("Bietergemeinschaft: Abschnitt und Word-Erklärung", () => {
  const vor = passendePartner("Elektroarbeiten", partner, []);
  const html = bgeTeilHtml({ id: "v1" }, vor, 0, true);
  assert.match(html, /name="partner" value="a"[\s\S]*name="los" value="Elektro"/);
  assert.doesNotMatch(html, /bietergemeinschaft\.docx/, "ohne Zusage keine Erklärung");
  assert.match(html, /§ 1 GWB/);
  assert.match(bgeTeilHtml({ id: "v1" }, [], 1, false), /href="\/konto\/vorgang\/v1\/bietergemeinschaft\.docx"/);
  assert.doesNotMatch(bgeTeilHtml({ id: "v1" }, vor, 1, false), /<form/, "Leser legen keine Anfragen an");
  const seite = partnerTeilHtml({ id: "v1", titel: "Elektroinstallation Schule", frist: null }, partner, [], { preise: null, darfAendern: true, firma: "Perlease" });
  assert.match(seite, /👥 Bietergemeinschaft[\s\S]*Elektro Klein/);
  const xml = strFromU8(unzipSync(bgeErklaerungDocx({ titel: "Schule <Nord>", link: null }, { name: "Perlease GmbH", anschrift: "Musterweg 1, 10115 Berlin", leistung: "" }, [{ name: "Elektro Klein", anschrift: "", leistung: "Los 2 Elektro" }]))["word/document.xml"]);
  assert.match(xml, /Erklärung der Bietergemeinschaft/);
  assert.match(xml, /Schule &lt;Nord&gt;/);
  assert.match(xml, /1 \(federführend\)[\s\S]*Perlease GmbH[\s\S]*Gesamtkoordination[\s\S]*Elektro Klein[\s\S]*Los 2 Elektro/);
  assert.match(xml, /gesamtschuldnerisch/);
});
