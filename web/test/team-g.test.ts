import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { berufZuordnen, csvLesen, pruefen, telefonReparieren, textAus, xlsxLesen, zeilenLesen } from "../src/personalimport.ts";
import { abwesendAm, abwesenheitAusFormular, avatar, bildTyp, kontaktBlock, standortKacheln, type Abwesenheit } from "../src/personal.ts";
import { aenderungText, protokollSeite, wert, type Eintrag } from "../src/protokoll.ts";

test("G1: CSV mit Semikolon, Anführungszeichen, BOM und Windows-Umlauten", () => {
  const t = csvLesen('﻿Vorname;Nachname;Notiz\r\nEva;Muster;"nur ""Früh""; kein Nacht"\r\n\r\nMax;Koch;\r\n');
  assert.deepEqual(t, [["Vorname", "Nachname", "Notiz"], ["Eva", "Muster", 'nur "Früh"; kein Nacht'], ["Max", "Koch", ""]]);
  assert.equal(textAus(new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72])), "Müller");
  assert.equal(csvLesen("Name,Telefon\nEva Muster,0170")[1][1], "0170");
});

test("G1: Excel-Datei wird gelesen, Handynummer bekommt ihre 0 zurück", () => {
  const xlsx = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Personal" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8('<sst><si><t>Name</t></si><si><t>Handy</t></si><si><t>Tätigkeit</t></si><si><t>Müller, Jörg</t></si><si><r><t>Koch</t></r><r><t>, Servicekraft</t></r></si></sst>'),
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>1701234567</v></c><c r="C2" t="s"><v>4</v></c></row></sheetData></worksheet>'),
  });
  const tabelle = xlsxLesen(xlsx);
  assert.deepEqual(tabelle[1], ["Müller, Jörg", "1701234567", "Koch, Servicekraft"]);
  const { zeilen, spalten } = zeilenLesen(tabelle);
  assert.deepEqual(spalten, { name: "Name", telefon: "Handy", berufe: "Tätigkeit" });
  assert.equal(zeilen[0].vorname, "Jörg");
  assert.equal(zeilen[0].nachname, "Müller");
  assert.equal(zeilen[0].telefon, "01701234567");
  assert.deepEqual(zeilen[0].berufe, ["Koch/Köchin", "Servicekraft"]);
  assert.equal(telefonReparieren("030 123"), "030 123");
  assert.equal(berufZuordnen("Hausmeister"), "Hausmeister/in");
  assert.equal(berufZuordnen("Drohnenpilot"), "Drohnenpilot");
});

test("G1: Prüfung erkennt Doppelte, Bekannte und fehlende Vornamen, ordnet Standorte zu", () => {
  const z = (vorname: string, nachname: string, standort = "", telefon = "") => ({ vorname, nachname, telefon, email: "", berufe: [], qualifikationen: [], status: "verfuegbar", notiz: "", standort });
  const bereiche = [{ id: "b1", name: "Berlin", art: "standort", parent_id: null }];
  const p = pruefen([z("Eva", "Muster", "berlin"), z("Eva", "Muster"), z("", "X"), z("Max", "Koch", "", "0170 1"), z("Max", "Koch", "", "0170 2")].slice(0, 4).concat([z("Lea", "Neu", "Köln")]), bereiche, null, [{ vorname: "max", nachname: "koch", telefon: "01701" }]);
  assert.deepEqual(p.map((x) => x.problem), ["", "Doppelt in der Datei", "Kein Vorname", "Schon eingetragen", ""]);
  assert.equal(p[0].bereich_id, "b1");
  assert.equal(p[4].bereich_id, null); // unbekannter Standort: gewählter Standard
});

test("G2: Abwesenheiten mit Zeitraum, nur neutrale Gründe", () => {
  const f = new FormData();
  f.set("von", "2026-11-10"); f.set("bis", "2026-11-20"); f.set("grund", "krank");
  assert.deepEqual(abwesenheitAusFormular(f), { von: "2026-11-10", bis: "2026-11-20", grund: "urlaub", notiz: "" });
  f.set("bis", "2026-11-01");
  assert.equal(abwesenheitAusFormular(f), null);
  f.set("bis", "2028-01-01");
  assert.equal(abwesenheitAusFormular(f), null);
  const abw: Abwesenheit[] = [{ id: "a", personal_id: "p1", von: "2026-11-10", bis: "2026-11-20", grund: "urlaub", notiz: "" }];
  assert.ok(abwesendAm(abw, "p1", "2026-11-15"));
  assert.equal(abwesendAm(abw, "p1", "2026-11-21"), undefined);
  assert.match(standortKacheln([{ id: "b1", name: "Berlin", art: "standort", parent_id: null }], [{ id: "p1", bereich_id: "b1", status: "verfuegbar" }, { id: "p2", bereich_id: "b1", status: "verfuegbar" }], [], abw.map((a) => ({ ...a, von: "2000-01-01", bis: "2999-01-01" }))), /1 verfügbar · 1 abwesend · 2 gesamt/);
});

test("G3: Initialen in fester Farbe, Foto nur nach Bildprüfung", () => {
  const a = avatar("Eva Muster", "id-1");
  assert.match(a, />EM</);
  assert.equal(a, avatar("Eva Muster", "id-1"));
  assert.match(avatar("<b>", "x"), /&#60;/);
  assert.match(avatar("Eva", "id", "/konto/personal/x/foto"), /<img class="person-avatar foto"/);
  assert.equal(bildTyp(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(bildTyp(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), "image/png");
  assert.equal(bildTyp(strToU8("<svg onload=alert(1)>")), null);
});

test("G4: Ansprechpartner pro Standort, Bearbeiten nur für die Administration", () => {
  const b = { id: "b1", name: "Berlin", art: "standort", parent_id: null, ansprechpartner: "Anna Berg", telefon: "030 123-4", email: "a@b.de" };
  const leser = kontaktBlock(b, false);
  assert.match(leser, /href="tel:0301234"/);
  assert.match(leser, /mailto:a@b\.de/);
  assert.doesNotMatch(leser, /<form/);
  assert.match(kontaktBlock(b, true), /action="\/konto\/standort\/b1\/kontakt"/);
  assert.equal(kontaktBlock({ ...b, ansprechpartner: "", telefon: "", email: "" }, false), "");
});

test("G5: Protokoll in verständlichen Sätzen, ohne interne Kennungen", () => {
  const e = (x: Partial<Eintrag>): Eintrag => ({ id: 1, user_id: "u1", wer: "Benjamin", bereich: "personal", aktion: "UPDATE", datensatz: "Eva Muster", aenderungen: [], zeit: "2026-11-01T10:00:00Z", ...x });
  assert.equal(aenderungText(e({ aenderungen: [{ feld: "status", alt: "verfuegbar", neu: "einsatz" }, { feld: "bereich_id", alt: "11111111-1111-4111-8111-111111111111", neu: "22222222-2222-4222-8222-222222222222" }, { feld: "einstellungen", alt: null, neu: null }] })), "Status: verfügbar → im Einsatz · Standort · Einstellungen");
  assert.equal(wert("urlaub 2026-11-10 bis 2026-11-20"), "Urlaub 10.11.2026 bis 20.11.2026");
  assert.equal(wert("true"), "ja");
  const html = protokollSeite([e({}), e({ id: 2, zeit: "2026-10-31T10:00:00Z", aktion: "DELETE", wer: "<x>" })], { wer: "", bereich: "", tage: 30, personen: [], jetzt: Date.parse("2026-11-01T12:00:00Z") });
  assert.match(html, />Heute</);
  assert.match(html, />Gestern</);
  assert.match(html, /hat 👷 Personal „Eva Muster“ gelöscht/);
  assert.match(html, /&#60;x&#62;/);
});
