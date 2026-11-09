import { test } from "node:test";
import assert from "node:assert/strict";
import { datumLesen, kundenLesen, nachweiseLesen, programmFormular, uebersichtSeite, uploadSeite, vorschau } from "../src/datenimport.ts";
import { uebersetzen, wort } from "../src/englisch.ts";
import { csvLesen } from "../src/personalimport.ts";

test("Datum aus deutschen, ISO- und Excel-Werten", () => {
  assert.equal(datumLesen("31.12.2027"), "2027-12-31");
  assert.equal(datumLesen("1.3.27"), "2027-03-01");
  assert.equal(datumLesen("2027-12-31"), "2027-12-31");
  assert.equal(datumLesen("46387"), "2026-12-31");
  assert.equal(datumLesen("31.02.2027"), "");
  assert.equal(datumLesen("bald"), "");
});

test("Kunden aus einem Rechnungsprogramm-Export: Spalten erkannt, PLZ Ort getrennt, Objekte je Zeile, Doppelte übersprungen", () => {
  const t = csvLesen("Firmenname;Objekt;Straße;PLZ Ort;Ansprechpartner;E-Mail;USt-IdNr\nMuster Immobilien GmbH;Bürohaus Nord;Hauptstr. 1;50667 Köln;Frau Muster;rechnung@muster.example;de 123456789\nMuster Immobilien GmbH;Lager Süd;Werkstr. 5;4109 Leipzig;;;\nAlt GmbH;;Weg 1;12345 Berlin;;;\nOhne;;;;;kaputt;\n");
  const { zeilen, spalten } = kundenLesen(t, [{ name: "Alt GmbH" }], []);
  assert.equal(spalten.name, "Firmenname");
  assert.equal(spalten.einsatzort, "Objekt");
  assert.deepEqual(zeilen.map((z) => z.problem), ["", "", "Kunde schon eingetragen", "E-Mail ungültig"]);
  assert.equal(zeilen[0].plz, "50667");
  assert.equal(zeilen[0].ort, "Köln");
  assert.equal(zeilen[0].ustid, "DE123456789");
  assert.equal(zeilen[1].plz, "04109", "führende Null ergänzt");
  assert.equal(zeilen[0].neu, true);
  assert.equal(zeilen[1].neu, false, "zweites Objekt zum selben neuen Kunden");
  assert.match(vorschau("kunden", zeilen, spalten, "00000000-0000-0000-0000-000000000000", "kunden.csv"), /Gelesen: 4 · übernommen: 2 · übersprungen: 2/);
});

test("Nachweise: Person per Name, Daten gelesen, unbekannte Personen und Doppelte markiert", () => {
  const t = csvLesen("Name;Nachweis;Ausgestellt;Gültig bis\nMuster, Eva;Erste-Hilfe-Kurs;15.03.2025;15.03.2027\nTom Becker;Sachkunde § 34a;;\nUnbekannt Person;Stapler;;\nEva Muster;Erste-Hilfe-Kurs;15.03.2025;15.03.2027\nEva Muster;Hygiene;01.01.2026;31.12.2025\n");
  const personal = [{ id: "p1", vorname: "Eva", nachname: "Muster" }, { id: "p2", vorname: "Tom", nachname: "Becker" }];
  const { zeilen } = nachweiseLesen(t, personal, []);
  assert.deepEqual(zeilen.map((z) => z.problem), ["", "", "Person nicht im Personal", "Doppelt in der Datei", "Gültig bis vor dem Ausstellungsdatum"]);
  assert.equal(zeilen[0].personal_id, "p1");
  assert.equal(zeilen[0].gueltig_bis, "2027-03-15");
  assert.equal(nachweiseLesen(t, personal, [{ personal_id: "p2", bezeichnung: "Sachkunde § 34a", gueltig_bis: null }]).zeilen[1].problem, "Schon eingetragen");
});

test("Übersicht „Daten übernehmen“ zeigt alle Wege", () => {
  const h = uebersichtSeite();
  for (const l of ["/konto/personal/import", "/konto/import/kunden", "/konto/import/nachweise", "/konto/firmenunterlagen"]) assert.match(h, new RegExp(`href="${l}"`));
});

test("Daten übernehmen in allen Sprachen: feste Texte übersetzt, Kundendaten bleiben", () => {
  const b = [{ id: "s1", art: "standort", name: "Köln" }] as never;
  const t = csvLesen("Kunde;Objekt;PLZ Ort\nMuster GmbH;Nord;50667 Köln\nMuster GmbH;Süd;50667 Köln\n;;\n");
  const k = kundenLesen(t, [], []);
  const n = nachweiseLesen(csvLesen("Name;Nachweis;Ausgestellt;Gültig bis\nEva Muster;EH;15.03.2025;15.03.2027\nEva Muster;S;;\n"), [{ id: "p", vorname: "Eva", nachname: "Muster" }], []);
  const seiten = [uebersichtSeite(), uploadSeite("kunden", b, "Keine Spalte „Kunde“, „Firma“ oder „Name“ gefunden.", ["Spalte A"]), uploadSeite("nachweise", b), programmFormular(b, "Das Programm war nicht erreichbar."),
    vorschau("kunden", k.zeilen, k.spalten, "k", "a.csv"), vorschau("nachweise", n.zeilen, n.spalten, "k", "a.csv")].join("");
  for (const sp of ["en", "fr", "pl", "es", "it"] as const) {
    const x = uebersetzen(seiten, sp);
    for (const de of ["Vorschau anzeigen", "Erkannte Spalten", "Gelesen:", "übernehmen", "Rechnungsprogramm", "Einsatzort:", "ohne Ablauf", "gültig bis", "Kein Kundenname", "Gefunden:"]) assert.ok(!x.includes(de), `${sp}: „${de}“ nicht übersetzt`);
    assert.ok(x.includes("Muster GmbH") && x.includes("Spalte A"), "Daten bleiben unverändert");
  }
  for (const h of ["Übernommen: Kunden 3 · Einsatzorte 4 · nicht gespeichert: 1", "Übernommen: Nachweise 3 von 4", "Das Programm hat mit Fehler 500 geantwortet. Bitte später noch einmal versuchen."])
    for (const sp of ["en", "fr", "pl", "es", "it"] as const) assert.notEqual(wort(h, sp), null, `${sp}: ${h}`);
  assert.equal(wort("Übernommen: Kunden 3 · Einsatzorte 4", "en"), "Imported: customers 3 · sites 4");
});
