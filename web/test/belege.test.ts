import test from "node:test";
import assert from "node:assert/strict";
import { anteil7, belegeCsv, belegeSeite, summen, ustAus, ustBeleg, type Beleg } from "../src/belege.ts";

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
  assert.equal(zeilen[0], "Datum;Lieferant;Kategorie;Brutto;USt-Satz;USt;Netto;Notiz;Beleg;davon Brutto zu 7 %;Anlass der Bewirtung;Teilnehmer der Bewirtung");
  assert.equal(zeilen[1], `01.11.2026;"'=HYPERLINK(""x"")";Material & Waren;10,70;7 %;0,70;10,00;"Schrauben; Dübel";nein;;;`, "Formeln entschärft, Semikolon gequotet");
  assert.equal(zeilen[2], "02.11.2026;Aral <Tankstelle>;Fahrzeug & Tanken;119,00;19 %;19,00;100,00;;ja;;;");
  assert.equal(zeilen.length, 4);
});

test("Belege: Seite mit Upload, Summen und Escaping", () => {
  const html = belegeSeite(liste, { monat: "2026-11", heute: "2026-11-03" });
  assert.doesNotMatch(html, /capture=/, "kein Kamera-Zwang, sonst lässt sich am Handy kein PDF oder XML wählen");
  assert.match(html, /accept="[^"]*\.xml/);
  assert.match(html, /Aral &#60;Tankstelle&#62;/);
  assert.match(html, /href="\/konto\/belege\.csv\?monat=2026-11"/);
  assert.match(html, /href="\/konto\/belege\/11111111-1111-1111-1111-111111111111"/);
  assert.match(html, /⚠️ ohne Beleg/);
  assert.match(html, /Nach Steuersatz/);
  assert.match(belegeSeite([], { monat: "2026-11", heute: "2026-11-03" }), /Keine Belege in diesem Monat[\s\S]*|<details class="termin-neu" open>/);
});

test("Belege S9: Vorsteuer nur aus Belegen mit Datei, Hinweis über 250 €", () => {
  const s = summen(liste);
  assert.equal(s.vorsteuer, 19, "nur der Beleg mit Datei zählt (Versicherung 0 %)");
  assert.equal(s.ohneBeleg, 0.7, "Eintrag ohne Datei getrennt");
  const storniert = summen([{ ...liste[0], storniert_am: "2026-11-04T10:00:00Z" }, liste[1]]);
  assert.deepEqual([storniert.vorsteuer, storniert.ohneBeleg], [0, 0.7], "storniert zählt nicht");
  const html = belegeSeite(liste, { monat: "2026-11", heute: "2026-11-03" });
  assert.match(html, /19,00\s€<\/strong> Vorsteuer laut Eingabe/);
  assert.match(html, /0,70\s€<\/strong> nicht als Vorsteuer gezählt \(kein Beleg hochgeladen\)/);
  assert.doesNotMatch(html, /Über 250 €/, "Kleinbeträge ohne Hinweis");
  const gross: Beleg = { ...liste[0], id: "44444444-4444-4444-4444-444444444444", brutto: 250.01 };
  assert.match(belegeSeite([gross], { monat: "2026-11", heute: "2026-11-03" }), /Über 250 €: Die Rechnung braucht[\s\S]*§ 14 Abs\. 4 UStG/);
  assert.doesNotMatch(belegeSeite([{ ...gross, brutto: 250 }], { monat: "2026-11", heute: "2026-11-03" }), /Über 250 €/, "genau 250 € ist Kleinbetrag");
  assert.doesNotMatch(belegeSeite([{ ...gross, storniert_am: "2026-11-04T10:00:00Z" }], { monat: "2026-11", heute: "2026-11-03" }), /Über 250 €/, "kein Hinweis bei Storno");
});

test("Belege S10: Bewirtung mit Anlass und Teilnehmern", () => {
  const essen: Beleg = { id: "55555555-5555-5555-5555-555555555555", datum: "2026-11-04", lieferant: "Gasthaus Linde", kategorie: "bewirtung", brutto: 119, ust_satz: 19, notiz: "", beleg_mime: "image/jpeg", anlass: "Angebot <Objekt> Süd", teilnehmer: "A. Kunde; ich" };
  const html = belegeSeite([essen], { monat: "2026-11", heute: "2026-11-05" });
  assert.match(html, /<option value="bewirtung">🍽️ Bewirtung \(Geschäftsessen\)<\/option>/);
  assert.match(html, /name="anlass" maxlength="300"/);
  assert.match(html, /name="teilnehmer" maxlength="500"/);
  assert.match(html, /<em>Anlass:<\/em> Angebot &#60;Objekt&#62; Süd · <em>Teilnehmer:<\/em> A\. Kunde; ich/);
  assert.equal(summen([essen]).kategorien[0].k, "bewirtung");
  const zeile = belegeCsv([essen]).replace(/^\uFEFF/, "").trim().split("\r\n")[1];
  assert.equal(zeile, `04.11.2026;Gasthaus Linde;Bewirtung (Geschäftsessen);119,00;19 %;19,00;100,00;;ja;;Angebot <Objekt> Süd;"A. Kunde; ich"`);
});

test("Belege S20: gemischter Beleg mit 19 % und 7 %", () => {
  const markt: Beleg = { id: "66666666-6666-6666-6666-666666666666", datum: "2026-11-04", lieferant: "Supermarkt", kategorie: "material", brutto: 226, ust_satz: 19, brutto_7: "107.00", notiz: "", beleg_mime: "application/pdf" };
  assert.equal(anteil7(markt), 107);
  assert.equal(ustBeleg(markt), 26, "19 aus 119 + 7 aus 107");
  assert.equal(ustBeleg({ ...markt, ust_satz: 7 }), ustAus(226, 7), "Anteil nur bei 19 %");
  assert.equal(ustBeleg({ ...markt, brutto_7: 300 }), ustAus(226, 19), "Anteil größer als Beleg wird ignoriert");
  const s = summen([markt]);
  assert.deepEqual(s.gesamt, { anzahl: 1, brutto: 226, ust: 26, netto: 200 });
  assert.deepEqual(s.saetze.map((x) => [x.s, x.anzahl, x.brutto, x.ust]), [[19, 1, 119, 19], [7, 1, 107, 7]]);
  assert.equal(s.vorsteuer, 26);
  const zeile = belegeCsv([markt]).replace(/^\uFEFF/, "").trim().split("\r\n")[1];
  assert.equal(zeile, "04.11.2026;Supermarkt;Material & Waren;226,00;19 %;26,00;200,00;;ja;107,00;;");
  const html = belegeSeite([markt], { monat: "2026-11", heute: "2026-11-05" });
  assert.match(html, /davon zu 7 % \(bei gemischten Belegen\)<input name="brutto_7"/);
  assert.match(html, /107,00\s€ davon zu 7 % USt/);
});
