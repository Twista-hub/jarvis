import assert from "node:assert/strict";
import { test } from "node:test";
import { cpvPraefix, muster, vorschauBox } from "../src/vorschau.ts";
import { ausschlussKarte, ausschlussWoerter, filterUebersicht, zusatzAusFormular, zusatzBlock } from "../src/suchfilter.ts";
import { auftraggeberListe, ausFormular, bereinigen, euroEingabe, profilFormular } from "../src/einrichtung.ts";

test("H1: Vorschau nutzt dasselbe Wortmuster wie die Suche und vergleicht mit dem gespeicherten Profil", () => {
  assert.equal(muster(["Schön", "IT"]), "(?<!\\w)sch(ö|oe)n|(?<!\\w)it(?!\\w)");
  assert.equal(muster([]), "(?!x)x");
  assert.equal(cpvPraefix("90910000"), "9091");
  assert.equal(cpvPraefix("79000000"), "79");
  const f = (id: string, titel: string) => ({ id, titel, auftraggeber: "Stadt", ort: "", wert: null, quell_datum: "" });
  const html = vorschauBox([f("a", "Hostessen Messe"), f("b", "Garderobe")], [f("b", "Garderobe"), f("c", "Lagerhelfer")]);
  assert.match(html, /<strong>2<\/strong><span>mit deinen Änderungen/);
  assert.match(html, /Neu dabei[\s\S]*Hostessen Messe/);
  assert.match(html, /Fällt weg[\s\S]*Lagerhelfer/);
  assert.match(vorschauBox(Array.from({ length: 300 }, (_, i) => f(String(i), "x")), null), /über 300/);
  assert.match(vorschauBox(null, null), /nicht verfügbar/);
  assert.match(profilFormular("f", bereinigen({ leistungen: [{ name: "Reinigung", cpv: [], woerter: ["reinigung"] }] }), ""), /formaction="\/konto\/einrichtung\/vorschau"/);
});

test("H2: Wörter aus dem 👎-Treffer, ohne eigene Suchwörter und Allerweltswörter", () => {
  assert.deepEqual(ausschlussWoerter("Rahmenvereinbarung Winterdienst und Fensterreinigung Rathaus", ["reinigung"]), ["winterdienst", "rathaus"]);
  assert.deepEqual(ausschlussWoerter("Hostessendienstleistungen", []), ["hostessendienstleistungen", "hostessen"]);
  assert.deepEqual(ausschlussWoerter("Winterdienst Schulen", [], ["winterdienst"]), ["schulen"]);
  assert.equal(ausschlussKarte({ id: "v", titel: "Reinigung" }, "f", ["reinigung"], [], "/konto/treffer"), "");
  const karte = ausschlussKarte({ id: "v", titel: "Winterdienst <x>" }, "f", [], [], "/konto/treffer?stand=neu");
  assert.match(karte, /action="\/konto\/suchprofil\/ausschluss"/);
  assert.match(karte, /value="winterdienst"/);
  assert.match(filterUebersicht({ ausschluss_schnell: ["winterdienst"] }, "f", true), /name="entfernen" value="1"/);
  assert.doesNotMatch(filterUebersicht({ ausschluss_schnell: ["winterdienst"] }, "f", false), /<form/);
  assert.equal(filterUebersicht({}, "f", true), "");
});

test("H3: Weiteres Suchprofil aus dem Formular, höchstens drei, nur Admins bearbeiten", () => {
  const f = new FormData();
  f.set("name", "Winterdienst"); f.set("woerter", "Winterdienst, Schneeräumung, ab"); f.set("bereich", "b1"); f.set("min_punkte", "5"); f.set("ausschluss", "Streusalz");
  assert.deepEqual(zusatzAusFormular(f, "id1", [{ id: "b1" }]), { id: "id1", name: "Winterdienst", woerter: ["winterdienst", "schneeräumung"], ausschluss: ["streusalz"], beschreibung: "", bereich_id: "b1", min_punkte: 5 });
  f.set("bereich", "fremd");
  assert.equal(zusatzAusFormular(f, "id1", [{ id: "b1" }])!.bereich_id, null);
  f.set("woerter", "ab");
  assert.equal(zusatzAusFormular(f, "id1", []), null);
  const z = { id: "z", name: "Winterdienst", woerter: ["winterdienst"], ausschluss: [] };
  assert.match(zusatzBlock([z], "f", [], true), /Suchprofil hinzufügen/);
  assert.doesNotMatch(zusatzBlock([z, { ...z, id: "y" }, { ...z, id: "x" }], "f", [], true), /Suchprofil hinzufügen/);
  assert.doesNotMatch(zusatzBlock([z], "f", [], false), /<form/);
});

test("H4/H5: Auftraggeber und Auftragswert im Formular", () => {
  assert.deepEqual([euroEingabe("50.000"), euroEingabe("1,5 Mio"), euroEingabe("1.250.000 €"), euroEingabe("")], [50000, 1500000, 1250000, undefined]);
  assert.deepEqual(auftraggeberListe(["Stadt Aachen", " ", "Stadt  Aachen", "ab"]), ["Stadt Aachen"]);
  const f = new FormData();
  f.set("auftraggeber_bevorzugt", "Stadt Aachen, Uniklinik Köln"); f.set("auftraggeber_aus", "Bundeswehr"); f.set("wert_min", "50.000"); f.set("wert_max", "");
  const v = ausFormular(f);
  assert.deepEqual([v.auftraggeber_bevorzugt, v.auftraggeber_aus, v.wert_min, v.wert_max, v.wert_unbekannt], [["Stadt Aachen", "Uniklinik Köln"], ["Bundeswehr"], 50000, undefined, false]);
  f.set("wert_unbekannt", "1");
  assert.equal(ausFormular(f).wert_unbekannt, true);
  assert.equal(bereinigen({}).wert_unbekannt, true);
});
