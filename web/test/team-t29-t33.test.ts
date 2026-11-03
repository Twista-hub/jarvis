import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { feiertage, feiertag, landAusPlz, summe, zuschlag, zuschlagText } from "../src/zuschlaege.ts";
import { stundenExcel, stundenSeite, type Eintrag } from "../src/stunden.ts";
import { gruppieren, nachweisDocx, nachweisSeite } from "../src/leistungsnachweis.ts";
import { kartenLink, kundenSeite, ortInfo, type Einsatzort, type Kunde } from "../src/kunden.ts";
import { ersatzVorschlaege, meineSchichtenTeil, schichtenSeite, type Schicht } from "../src/schichten.ts";
import { ichSeite } from "../src/ich.ts";
import { teamKopfHtml } from "../src/teamkopf.ts";

const heute = "2026-11-04";
const e = (id: string, datum: string, beginn: string, ende: string, pause_min: number, extra: Partial<Eintrag> = {}): Eintrag => ({ id, personal_id: "p1", datum, beginn: `${beginn}:00`, ende: `${ende}:00`, pause_min, einsatz: "Messe Halle 3", notiz: "", status: "freigegeben", kunde_id: "k1", ...extra });

test("T30: Feiertage je Bundesland", () => {
  assert.equal(feiertag("2026-04-06", ""), "Ostermontag");
  assert.equal(feiertag("2026-06-04", "NW"), "Fronleichnam");
  assert.equal(feiertag("2026-06-04", "BE"), null);
  assert.equal(feiertag("2026-10-31", "NI"), "Reformationstag");
  assert.equal(feiertag("2026-11-01", "BY"), "Allerheiligen");
  assert.equal(feiertag("2026-11-18", "SN"), "Buß- und Bettag");
  assert.equal(feiertag("2027-11-17", "SN"), "Buß- und Bettag");
  assert.equal(feiertag("2026-03-08", "BE"), "Frauentag");
  assert.equal(feiertag("2026-09-20", "TH"), "Weltkindertag");
  assert.equal(feiertage(2026, "").size, 9);
  assert.deepEqual([landAusPlz("52531"), landAusPlz("10115"), landAusPlz("80331"), landAusPlz("20095"), landAusPlz("01067"), landAusPlz("x")], ["NW", "BE", "BY", "HH", "SN", ""]);
});

test("T30: Nacht-, Sonntags- und Feiertagsminuten mit anteiliger Pause", () => {
  assert.deepEqual(zuschlag({ datum: "2026-11-04", beginn: "07:00", ende: "15:30", pause_min: 30 }, "NW"), { nacht: 0, sonntag: 0, feiertag: 0 });
  assert.deepEqual(zuschlag({ datum: "2026-11-07", beginn: "22:00", ende: "06:00", pause_min: 0 }, "NW"), { nacht: 420, sonntag: 360, feiertag: 0 }, "Sa→So: 0–6 Uhr Sonntag");
  assert.deepEqual(zuschlag({ datum: "2026-12-24", beginn: "22:00", ende: "06:00", pause_min: 0 }, "NW"), { nacht: 420, sonntag: 0, feiertag: 360 });
  assert.deepEqual(zuschlag({ datum: "2026-11-01", beginn: "08:00", ende: "16:00", pause_min: 0 }, "NW"), { nacht: 0, sonntag: 0, feiertag: 480 }, "Allerheiligen am Sonntag zählt als Feiertag");
  assert.deepEqual(zuschlag({ datum: "2026-11-01", beginn: "08:00", ende: "16:00", pause_min: 0 }, "BE"), { nacht: 0, sonntag: 480, feiertag: 0 });
  assert.deepEqual(zuschlag({ datum: "2026-11-08", beginn: "06:00", ende: "16:00", pause_min: 60 }, ""), { nacht: 0, sonntag: 540, feiertag: 0 }, "Pause anteilig");
  assert.equal(zuschlagText({ nacht: 150, sonntag: 480, feiertag: 0 }), "🌙 2:30 · ☀️ So 8:00");
  assert.deepEqual(summe([{ nacht: 1, sonntag: 2, feiertag: 3 }, { nacht: 1, sonntag: 0, feiertag: 0 }]), { nacht: 2, sonntag: 2, feiertag: 3 });
});

test("T30: Zuschläge in Stundenzettel und Excel", () => {
  const liste = [e("a", "2026-11-07", "22:00", "06:00", 0, { status: "erfasst" })];
  const html = stundenSeite(liste, [{ id: "p1", vorname: "Eva", nachname: "M" }], { monat: "2026-11", heute, nurOffen: true, darfAendern: true, land: "NW" });
  assert.match(html, /class="klein zuschlag">🌙 7:00 · ☀️ So 6:00/);
  assert.match(html, /Nordrhein-Westfalen/);
  const x = unzipSync(stundenExcel(liste, [{ id: "p1", vorname: "Eva", nachname: "M" }], "2026-11", "NW"));
  const blatt = strFromU8(x["xl/worksheets/sheet1.xml"]);
  assert.match(blatt, /davon Nacht/);
  assert.match(blatt, /<v>7<\/v>.*<v>6<\/v>/);
});

const k1: Kunde = { id: "k1", bereich_id: null, name: "Messe Berlin GmbH", strasse: "Messedamm 22", plz: "14055", ort: "Berlin", ansprechpartner: "Frau Meier", telefon: "030 3038", email: "", notiz: "" };
const ort: Einsatzort = { id: "o1", kunde_id: "k1", name: "Messe Halle 3", strasse: "Messedamm 22", plz: "14055", ort: "Berlin", ansprechpartner: "Herr Kaya", telefon: "0170 123 45", treffpunkt: "Eingang Süd", kleidung: "Schwarz, S3-Schuhe", hinweise: "Parken P2\nAusweis mitbringen" };

test("T29: Gruppen pro Kunde und Leistungsnachweis als Word", () => {
  const liste = [e("a", "2026-11-03", "07:00", "15:30", 30), e("b", "2026-11-08", "08:00", "16:00", 0, { personal_id: "p2" }), e("c", "2026-11-04", "07:00", "15:00", 0, { status: "erfasst" }), e("d", "2026-11-04", "07:00", "15:00", 0, { kunde_id: null, einsatz: "Hotel Adlon" }), e("x", "2026-11-04", "07:00", "15:00", 0, { status: "abgelehnt" })];
  const g = gruppieren(liste, [k1]);
  assert.deepEqual(g.map((x) => [x.titel, x.eintraege.length, x.offen]), [["Messe Berlin GmbH", 2, 1], ["Hotel Adlon", 1, 0]]);
  const seite = nachweisSeite(g, { monat: "2026-11", land: "NW", saetze: { k1: 32.5 } });
  assert.match(seite, /16:00 Std\. freigegeben · 2 Personen · ☀️ So 8:00 · 💶 520,00\s€ netto · ⏳ 1 noch nicht freigegeben/);
  assert.match(seite, /leistungsnachweis\.docx\?monat=2026-11&kunde=k1/);
  assert.match(seite, /einsatz=Hotel%20Adlon/);
  assert.doesNotMatch(nachweisSeite(g, { monat: "2026-11", land: "NW", saetze: null }), /💶/, "ohne Finanzfreigabe kein Betrag");
  const doc = strFromU8(unzipSync(nachweisDocx(g[0], [{ id: "p1", vorname: "Eva", nachname: "Muster" }, { id: "p2", vorname: "Ali", nachname: "K" }], { monat: "2026-11", land: "NW", firma: { name: "Perlease GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg" }, satz: 32.5 }))["word/document.xml"]);
  assert.match(doc, /Leistungsnachweis November 2026/);
  assert.match(doc, /Messedamm 22, 14055 Berlin/);
  assert.match(doc, /Eva Muster/);
  assert.match(doc, /16,00 Std\. × 32,50\s€ = 520,00\s€ netto/);
  assert.match(doc, /Unterschrift Kunde/);
  assert.match(doc, /Summe pro Person/);
  assert.doesNotMatch(strFromU8(unzipSync(nachweisDocx(g[0], [], { monat: "2026-11", land: "NW", firma: { name: "X", strasse: "", plz: "", ort: "" } }))["word/document.xml"]), /Verrechnung/);
});

test("T33/T31: Kunden-Seite, Einsatzort-Infos und Kartenlink", () => {
  const html = kundenSeite([k1], [ort, { ...ort, id: "o2", kunde_id: null, name: "Lager <Nord>" }], [{ kunde_id: "k1", satz: "32.50" }], { darfAendern: true, finanzen: true, bereiche: [] });
  assert.match(html, /🏢 Messe Berlin GmbH/);
  assert.match(html, /💶 32,50\s€\/Std\./);
  assert.match(html, /name="satz" inputmode="decimal" maxlength="9" value="32,5"/);
  assert.match(html, /Einsatzorte ohne Kunde/);
  assert.match(html, /Lager &#60;Nord&#62;/);
  assert.doesNotMatch(kundenSeite([k1], [], [], { darfAendern: false, finanzen: false, bereiche: [] }), /💶|name="satz"|Kunde anlegen/);
  const info = ortInfo(ort);
  assert.match(info, /href="https:\/\/www\.openstreetmap\.org\/search\?query=Messedamm%2022%2C%2014055%20Berlin"/);
  assert.match(info, /href="tel:017012345"/);
  assert.match(info, /🚪 Eingang Süd/);
  assert.match(info, /Parken P2<br>Ausweis mitbringen/);
  assert.equal(kartenLink({ strasse: "", plz: "", ort: "", name: "Halle" }), "https://www.openstreetmap.org/search?query=Halle");
});

const s = (id: string, datum: string, beginn: string, ende: string, extra: Partial<Schicht> = {}): Schicht => ({ id, personal_id: "p1", bereich_id: null, datum, beginn: `${beginn}:00`, ende: `${ende}:00`, ort: "Messe Halle 3", notiz: "", antwort: "offen", ...extra });

test("T31: Infoblatt in den Schichten der Einsatzkraft", () => {
  const html = meineSchichtenTeil([s("a", heute, "06:00", "14:00", { einsatzorte: ort }), s("b", "2026-11-05", "06:00", "14:00")], heute);
  assert.match(html, /<details class="ort-details" open><summary class="klein">📋 Infos zum Einsatzort/, "heute aufgeklappt");
  assert.equal((html.match(/ort-details/g) ?? []).length, 1);
});

test("T32: Ausfall, Ersatzvorschläge und Meldeknopf", () => {
  const personen = [
    { id: "p1", vorname: "Eva", nachname: "M", bereich_id: null, status: "verfuegbar", berufe: ["Servicekraft"] },
    { id: "p2", vorname: "Ben", nachname: "R", bereich_id: null, status: "verfuegbar", berufe: ["Koch"] },
    { id: "p3", vorname: "Mia", nachname: "B", bereich_id: null, status: "verfuegbar", berufe: ["Servicekraft"] },
    { id: "p4", vorname: "Tom", nachname: "W", bereich_id: null, status: "verfuegbar", berufe: ["Servicekraft"] },
    { id: "p5", vorname: "Lea", nachname: "W", bereich_id: null, status: "nicht", berufe: ["Servicekraft"] },
    { id: "p6", vorname: "Jan", nachname: "S", bereich_id: null, status: "verfuegbar", berufe: ["Servicekraft"] },
  ];
  const ab = s("a", heute, "06:00", "14:00", { antwort: "abgesagt" });
  const liste = [ab, s("t", heute, "10:00", "18:00", { personal_id: "p4" })];
  const abw = [{ personal_id: "p1", von: heute, bis: heute, kurzfristig: true, notiz: "Auto kaputt" }, { personal_id: "p6", von: heute, bis: heute }];
  const v = ersatzVorschlaege(ab, personen[0], personen, liste, abw, []);
  assert.deepEqual(v.map((p) => p.id), ["p3", "p2"], "gleicher Beruf zuerst; Tom hat eine überlappende Schicht, Lea nicht verfügbar, Jan abwesend");
  assert.deepEqual(ersatzVorschlaege(ab, personen[0], personen, liste, abw, [{ personal_id: "p3", von: "2026-11-01", bis: null }]).map((p) => p.id), ["p2"], "Überlassung zählt");
  const html = schichtenSeite(liste, personen, abw, { montag: "2026-11-02", heute, darfAendern: true, bereiche: [], orte: [{ id: "o1", name: "Messe Halle 3" }], ueb: [] });
  assert.match(html, /🚨 Kurzfristig ausgefallen/);
  // The shift plan says who is out, never why: the note stays in the personnel file (03.11.2026, Benjamin).
  assert.match(html, /Eva M <span class="klein">heute<\/span>/);
  assert.doesNotMatch(html, /Auto kaputt/);
  assert.match(html, /name="person" value="p3"/);
  assert.match(html, /name="einsatzort"><option value="">– frei eingeben –<\/option><option value="o1">Messe Halle 3/);
  const ersetzt = schichtenSeite([...liste, s("n", heute, "06:00", "14:00", { personal_id: "p3", notiz: "Ersatzschicht" })], personen, abw, { montag: "2026-11-02", heute, darfAendern: true, bereiche: [], ueb: [] });
  assert.match(ersetzt, /Keine offene Schicht \(mehr\)/, "nach dem Ersatz keine Vorschläge mehr");
  const ich = ichSeite({ ich: { id: "p1", firma_id: "f", vorname: "Eva", nachname: "M", berufe: [], qualifikationen: [], status: "verfuegbar" }, auftraege: [], ueberlassungen: [], abwesenheiten: [], nachweise: [], unterweisungen: [], heute });
  assert.match(ich, /Ich falle kurzfristig aus/);
  assert.match(ich, /<option value="2026-11-04">heute<\/option><option value="2026-11-05">morgen<\/option>/);
});

test("Team-Kopf: Ausfälle, Leistungsnachweis und Kunden", () => {
  const html = teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false, ausfaelle: 2 }, false, false);
  assert.match(html, /2 kurzfristige Ausfälle heute\/morgen/);
  assert.match(html, /\/konto\/leistungsnachweis"/);
  assert.match(html, /\/konto\/kunden"/);
});
