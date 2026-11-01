import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { ablaufDatum, ablaufLesbar, ordnerVon, unterlagenSeite, vorschauTyp, type FirmenDatei } from "../src/firmenunterlagen.ts";
import { referenzAusFormular, referenzlisteDocx, zeitraum, type Referenz } from "../src/referenzen.ts";
import { mitReferenzen, teilnahmeCheck } from "../src/markt.ts";

const datei = (name: string, extra: Partial<FirmenDatei & { ordner: string | null }> = {}) => ({ id: crypto.randomUUID(), firma_id: "f", name, art: "nachweis", dateiname: `${name}.pdf`, mime: "application/pdf", groesse: 1000, gueltig_bis: null, ...extra });

test("E1: Unterlagen landen ohne eigenen Ordner im passenden Ordner", () => {
  assert.equal(ordnerVon(datei("Betriebshaftpflichtversicherung")), "Versicherungen");
  assert.equal(ordnerVon(datei("Unbedenklichkeitsbescheinigung Krankenkasse")), "Steuern & Sozialversicherung");
  assert.equal(ordnerVon(datei("Angebotsvorlage", { art: "vorlage" })), "Angebotsvorlagen");
  assert.equal(ordnerVon(datei("Speisekarte")), "Sonstiges");
  assert.equal(ordnerVon(datei("Haftpflicht", { ordner: "Mein Ordner" })), "Mein Ordner");
  const html = unterlagenSeite([datei("Haftpflicht", { gueltig_bis: "2027-01-01" }), datei("Handelsregisterauszug")], { firma: "f", firmenname: "F", admin: true, heute: "2026-11-01", ordner: "Versicherungen", name: "", erkannt: "", fehler: "", referenzen: 0 });
  assert.match(html, /class="ordner-chips"/);
  assert.match(html, /aria-current="true">Versicherungen/);
  assert.doesNotMatch(html, /📁 Register/); // gefiltert
  assert.match(html, /Ordner als Zip/);
});

test("E2: Ablaufdatum wird geprüft und der Hinweis angezeigt", () => {
  assert.equal(ablaufDatum("2027-03-31"), "2027-03-31");
  assert.equal(ablaufDatum("2027-02-30"), null);
  assert.equal(ablaufDatum("1999-01-01"), null);
  assert.equal(ablaufDatum(""), null);
  assert.ok(ablaufLesbar("a.PDF", 1000) && ablaufLesbar("foto.jpg", 1000));
  assert.ok(!ablaufLesbar("a.docx", 1000) && !ablaufLesbar("a.pdf", 6 * 1024 * 1024));
  const o = { firma: "f", firmenname: "F", admin: true, heute: "2026-11-01", ordner: "", name: "", fehler: "", referenzen: 0 };
  assert.match(unterlagenSeite([], { ...o, erkannt: "2027-03-31" }), /gültig bis 31\.3\.2027/);
  assert.match(unterlagenSeite([], { ...o, erkannt: "0" }), /kein Ablaufdatum gefunden/);
});

test("E3: Vorschau nur für Dateien, die der Browser zeigen kann", () => {
  assert.equal(vorschauTyp("x.pdf"), "application/pdf");
  assert.equal(vorschauTyp("x.JPG"), "image/jpeg");
  assert.equal(vorschauTyp("x.docx"), null);
  const html = unterlagenSeite([datei("Haftpflicht"), datei("Vorlage", { art: "vorlage", dateiname: "v.docx" })], { firma: "f", firmenname: "F", admin: false, heute: "2026-11-01", ordner: "", name: "", erkannt: "", fehler: "", referenzen: 0 });
  assert.equal((html.match(/\/ansehen\?/g) ?? []).length, 1);
  assert.doesNotMatch(html, /datei-menue/); // ohne Adminrechte kein ⋯
});

test("E4: Referenzformular und Word-Referenzliste", () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ auftraggeber: "Stadt Aachen", leistung: "Reinigung Rathaus", von: "2024-01", bis: "2025-06", auftragswert: "120.000", personal: "6" })) f.set(k, v);
  const r = referenzAusFormular(f)!;
  assert.equal(r.von, "2024-01-01");
  assert.equal(r.auftragswert, 120000);
  assert.equal(zeitraum(r), "01/2024 – 06/2025");
  f.set("bis", "2023-01");
  assert.equal(referenzAusFormular(f), null);
  f.delete("auftraggeber");
  assert.equal(referenzAusFormular(new FormData()), null);
  const docx = unzipSync(referenzlisteDocx("Perlease <GmbH>", [{ ...r, id: "1", firma_id: "f" } as Referenz]));
  const xml = strFromU8(docx["word/document.xml"]);
  assert.match(xml, /Perlease &lt;GmbH&gt;/);
  assert.match(xml, /Stadt Aachen/);
  assert.match(xml, /120\.000 €/);
  assert.ok(docx["[Content_Types].xml"] && docx["_rels/.rels"]);
});

test("E5: Referenzen zählen als vorhandener Nachweis", () => {
  const refs = [{ id: "1" } as Referenz];
  const checks = teilnahmeCheck([{ art: "nachweis", name: "Referenzen", los: "" } as never], [], mitReferenzen([], refs, "f"), null);
  assert.equal(checks[0].gefunden, true);
  assert.equal(teilnahmeCheck([{ art: "nachweis", name: "Referenzen", los: "" } as never], [], mitReferenzen([], [], "f"), null)[0].gefunden, false);
});
