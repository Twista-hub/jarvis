import test from "node:test";
import assert from "node:assert/strict";
import { belegeCsv, belegeSeite, summen, ustAus, type Beleg } from "../src/belege.ts";

const liste: Beleg[] = [
  { id: "11111111-1111-1111-1111-111111111111", datum: "2026-11-02", lieferant: "Aral <Tankstelle>", kategorie: "fahrzeug", brutto: "119.00", ust_satz: 19, notiz: "", beleg_mime: "image/jpeg" },
  { id: "22222222-2222-2222-2222-222222222222", datum: "2026-11-01", lieferant: "=HYPERLINK(\"x\")", kategorie: "material", brutto: 10.7, ust_satz: "7", notiz: "Schrauben; Dübel", beleg_mime: null },
  { id: "33333333-3333-3333-3333-333333333333", datum: "2026-11-03", lieferant: "Versicherung AG", kategorie: "versicherung", brutto: 50, ust_satz: 0, notiz: "", beleg_mime: "application/pdf" },
];

test("Belege: USt aus Brutto und Summen", () => {
  assert.equal(ustAus(119, 19), 19);
  assert.equal(ustAus(10.7, 7), 0.7);
  assert.equal(ustAus(50, 0), 0);
  const s = summen(liste);
  assert.deepEqual(s.gesamt, { anzahl: 3, brutto: 179.7, ust: 19.7, netto: 160 });
  assert.deepEqual(s.saetze.map((x) => [x.s, x.netto]), [[19, 100], [7, 10], [0, 50]]);
  assert.deepEqual(s.kategorien.map((x) => x.k), ["material", "fahrzeug", "versicherung"]);
});

test("Belege: CSV für die Steuerberatung", () => {
  const csv = belegeCsv(liste);
  const zeilen = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(zeilen[0], "Datum;Lieferant;Kategorie;Brutto;USt-Satz;USt;Netto;Notiz;Beleg");
  assert.equal(zeilen[1], `01.11.2026;"'=HYPERLINK(""x"")";Material & Waren;10,70;7 %;0,70;10,00;"Schrauben; Dübel";nein`, "Formeln entschärft, Semikolon gequotet");
  assert.equal(zeilen[2], "02.11.2026;Aral <Tankstelle>;Fahrzeug & Tanken;119,00;19 %;19,00;100,00;;ja");
  assert.equal(zeilen.length, 4);
});

test("Belege: Seite mit Upload, Summen und Escaping", () => {
  const html = belegeSeite(liste, { monat: "2026-11", heute: "2026-11-03" });
  assert.match(html, /capture="environment"/);
  assert.match(html, /Aral &#60;Tankstelle&#62;/);
  assert.match(html, /href="\/konto\/belege\.csv\?monat=2026-11"/);
  assert.match(html, /href="\/konto\/belege\/11111111-1111-1111-1111-111111111111"/);
  assert.match(html, /⚠️ ohne Beleg/);
  assert.match(html, /Nach Steuersatz/);
  assert.match(belegeSeite([], { monat: "2026-11", heute: "2026-11-03" }), /Keine Belege in diesem Monat[\s\S]*|<details class="termin-neu" open>/);
});
