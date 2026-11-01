import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { eigenerklaerungDocx, fehlt, profilSeite, profilWerte, type Firma, type Profil, type Zertifikat } from "../src/firmenprofil.ts";
import { ausfuellen } from "../src/textbausteine.ts";
import { akteAusFormular, akteZeile, ampel, dabeiSeit, kurzprofilDocx, nachweisMarken, type Nachweis } from "../src/personalakte.ts";
import { plusMonate, staende, unterweisungenSeite, type Unterweisung } from "../src/unterweisungen.ts";
import { entfernungKm, suchen, sucheSeite, tageZwischen, type SuchPerson, type Suche } from "../src/personalsuche.ts";
import { teamKopfHtml } from "../src/teamkopf.ts";

const firma: Firma = { name: "Perlease GmbH", strasse: "Hauptstraße 1", plz: "52531", ort: "Übach-Palenberg", telefon: "02451 1234" };
const profil: Profil = { rechtsform: "GmbH", registergericht: "Amtsgericht Aachen", registernummer: "HRB 12345", gruendungsjahr: 2009, mitarbeiter: 400, website: "perlease.de", email: "info@perlease.de", ustid: "DE123456789", geschaeftsfuehrung: "Max Muster", taetigkeit: "Personaldienstleistungen", logo: null };
const zert: Zertifikat[] = [{ id: "z1", art: "pq_vob", bezeichnung: "Präqualifikation VOB", nummer: "010.123", aussteller: "PQ-Verein", gueltig_bis: "2027-06-30" }, { id: "z2", art: "iso9001", bezeichnung: "ISO 9001", nummer: "", aussteller: "", gueltig_bis: "2026-01-01" }];

test("T1/T2: fehlende Angaben, Platzhalter und Eigenerklärung", () => {
  const heute = "2026-11-01";
  assert.deepEqual(fehlt(firma, profil, [{ jahr: 2025, umsatz: 1, beschaeftigte: 1 }, { jahr: 2024, umsatz: 1, beschaeftigte: 1 }, { jahr: 2023, umsatz: 1, beschaeftigte: 1 }], zert, heute), ["Logo", "abgelaufenes Zertifikat erneuern"]);
  assert.ok(fehlt(firma, null, null, [], heute).includes("Rechtsform"));
  assert.ok(fehlt(firma, profil, [], [], heute).includes("Umsatz der letzten 3 Jahre"));
  const w = profilWerte(firma, profil, zert, heute);
  assert.equal(w.PQ, "Präqualifikation VOB (Nr. 010.123)");
  assert.equal(w.ANSCHRIFT, "Hauptstraße 1, 52531 Übach-Palenberg");
  assert.equal(ausfuellen("{{FIRMA}} ({{RECHTSFORM}}) seit {{GRUENDUNGSJAHR}} mit {{MITARBEITER}} Beschäftigten, {{REGISTER}}", { FIRMA: "Perlease", ...w }), "Perlease (GmbH) seit 2009 mit 400 Beschäftigten, Amtsgericht Aachen, HRB 12345");
  const doc = strFromU8(unzipSync(eigenerklaerungDocx("Perlease GmbH", firma, profil, [{ jahr: 2025, umsatz: 12500000, beschaeftigte: 390 }], zert, 7, heute))["word/document.xml"]);
  for (const t of ["Eigenerklärung zur Eignung", "HRB 12345", "DE123456789", "2025", "12.500.000", "390", "Präqualifikation VOB", "7 Referenzen", "Unterschrift"]) assert.ok(doc.includes(t), t);
  const seite = profilSeite("Perlease GmbH", firma, profil, null, zert, { admin: false, heute });
  assert.match(seite, /Finanzfreigabe/);
  assert.match(seite, /disabled/);
  assert.match(seite, /⚠️ abgelaufen am/);
  assert.match(profilSeite("Perlease GmbH", firma, profil, [], zert, { admin: true, heute }), /name="umsatz_2025"/);
});

const n = (id: string, pid: string, bez: string, bis: string | null): Nachweis => ({ id, personal_id: pid, bezeichnung: bez, erworben: null, gueltig_bis: bis, datei_name: null, datei_mime: null });

test("T4/T5/T7: Personalakte, Nachweise mit Ampel und Kurzprofil", () => {
  const f = new FormData();
  for (const [k, v] of [["eintritt", "2019-04-01"], ["beschaeftigung", "teilzeit"], ["wochenstunden", "20,5"], ["wohn_plz", "10115"], ["sprachen", "Deutsch, Türkisch; deutsch"], ["fuehrerschein", "B"], ["fuehrerschein", "XY"]]) f.append(k, v);
  assert.deepEqual(akteAusFormular(f), { eintritt: "2019-04-01", beschaeftigung: "teilzeit", wochenstunden: 20.5, fuehrerschein: ["B"], sprachen: ["Deutsch", "Türkisch", "deutsch"], wohn_plz: "10115", probezeit_bis: null, befristet_bis: null, aufenthalt_bis: null, firmenwagen: false, personalnummer: "", geburtstag: null });
  const g = new FormData(); g.append("wohn_plz", "1011"); g.append("beschaeftigung", "chef"); g.append("wochenstunden", "99");
  assert.deepEqual([akteAusFormular(g).wohn_plz, akteAusFormular(g).beschaeftigung, akteAusFormular(g).wochenstunden], ["", "", null]);
  assert.equal(dabeiSeit("2019-04-01", "2026-03-31"), "seit 2019 (6 Jahre)");
  assert.match(akteZeile({ beschaeftigung: "teilzeit", wochenstunden: 20.5, fuehrerschein: ["B"] }, "2026-11-01"), /Teilzeit 20,5 h · 🚗 B/);
  assert.deepEqual(["2026-10-01", "2026-12-01", "2027-06-01", null].map((b) => ampel(b, "2026-11-01")), ["rot", "gelb", "gruen", "offen"]);
  const marken = nachweisMarken([n("1", "p", "Erste Hilfe", "2026-10-01"), n("2", "p", "Staplerschein", "2028-01-31")], "2026-11-01");
  assert.match(marken, /nachweis-marke rot.*⚠️ Erste Hilfe 10\/26/);
  assert.match(marken, /🎓 Staplerschein 01\/28/);
  const doc = strFromU8(unzipSync(kurzprofilDocx("Perlease", { vorname: "Eva", nachname: "Muster", berufe: ["Servicekraft"], qualifikationen: ["Barista"], eintritt: "2019-04-01", sprachen: ["Englisch"], fuehrerschein: ["B"] },
    [n("1", "p", "Erste Hilfe", "2026-10-01"), n("2", "p", "Hygieneschulung", null)], ["Messe Berlin GmbH (seit 2025)"], "2026-11-01"))["word/document.xml"]);
  assert.ok(doc.includes("Eva Muster") && doc.includes("Hygieneschulung") && doc.includes("Messe Berlin"));
  assert.ok(!doc.includes("Erste Hilfe"), "abgelaufene Nachweise stehen nicht im Profil");
});

test("T6: Unterweisungen fällig, bald, aktuell", () => {
  assert.equal(plusMonate("2025-08-31", 6), "2026-02-28");
  const u: Unterweisung = { id: "u1", titel: "Arbeitsschutz", intervall_monate: 12, beschreibung: "" };
  const leute = [{ id: "a", vorname: "Eva", nachname: "", status: "verfuegbar" }, { id: "b", vorname: "Max", nachname: "", status: "verfuegbar" }, { id: "c", vorname: "Lea", nachname: "", status: "verfuegbar" }, { id: "d", vorname: "Tom", nachname: "", status: "nicht" }];
  const t = [{ unterweisung_id: "u1", personal_id: "a", datum: "2025-10-01" }, { unterweisung_id: "u1", personal_id: "b", datum: "2025-11-20" }, { unterweisung_id: "u1", personal_id: "b", datum: "2024-11-20" }];
  assert.deepEqual(staende(u, leute, t, "2026-11-01").map((s) => [s.personal_id, s.stufe, s.faellig]), [["a", "rot", "2026-10-01"], ["b", "gelb", "2026-11-20"], ["c", "rot", null]]);
  const html = unterweisungenSeite([u], leute, t, { heute: "2026-11-01", darfAendern: true });
  assert.match(html, /⚠️ 2 fällig · ⏳ 1 bald/);
  assert.match(html, /noch nie unterwiesen/);
  assert.match(html, /value="a" checked/);
  assert.doesNotMatch(html, /Tom/);
  assert.match(unterweisungenSeite([], leute, [], { heute: "2026-11-01", darfAendern: true }), /Die üblichen 3 anlegen/);
});

const person = (id: string, vorname: string, extra: Partial<SuchPerson> = {}): SuchPerson => ({ id, vorname, nachname: "", berufe: ["Servicekraft"], qualifikationen: [], bereich_id: null, status: "verfuegbar", telefon: "", fuehrerschein: [], sprachen: [], wohn_plz: "", ...extra });

test("T8: Personalsuche nach Qualifikation, Zeitraum und Umkreis", () => {
  assert.ok(Math.abs(entfernungKm("52531", "52062")! - 16) <= 3);
  assert.equal(entfernungKm("52531", "00000"), null);
  assert.equal(tageZwischen("2026-11-02", "2026-11-06").length, 5);
  const leute = [person("a", "Eva", { wohn_plz: "52062", fuehrerschein: ["B"] }), person("b", "Max", { wohn_plz: "10115" }), person("c", "Lea", { wohn_plz: "52511", qualifikationen: ["Staplerschein"] }), person("d", "Tom", { berufe: ["Koch"] })];
  const nachweise = [n("1", "a", "Staplerschein", "2027-01-01"), n("2", "b", "Staplerschein", "2026-11-03")];
  const s: Suche = { beruf: "Servicekraft", quali: "stapler", von: "2026-11-02", bis: "2026-11-06", plz: "52531", km: 30, fuehrerschein: "", sprache: "" };
  const e = suchen(leute, nachweise, [{ id: "u", personal_id: "a", entleiher: "Messe", von: "2026-11-05", bis: null }], [], [], s);
  assert.deepEqual(e.map((x) => x.p.id), ["c", "a"], "Lea ganz frei zuerst, Max abgelaufen und zu weit, Tom anderer Beruf");
  assert.equal(e[1].freiTage, 3);
  assert.match(e[0].nachweis, /ohne Nachweis/);
  assert.deepEqual(suchen(leute, nachweise, [], [], [], { ...s, quali: "", fuehrerschein: "B", plz: "", km: 0 }).map((x) => x.p.id), ["a"]);
  const html = sucheSeite(e, s, { berufe: ["Koch", "Servicekraft"], plzBekannt: true });
  assert.match(html, /<strong>2<\/strong> Personen passen, 1 ganz frei/);
  assert.match(html, /🟡 3 von 5 Tagen frei/);
  assert.match(sucheSeite(null, s, { berufe: [], plzBekannt: true }), /Filter wählen/);
});

test("T1–T8: Kopf von Firma & Team mit Warnungen", () => {
  const html = teamKopfHtml({ nachweiseAbgelaufen: 2, nachweiseBald: 1, zertifikate: 1, unterweisungen: 3, profilFehlt: true }, true);
  for (const t of ["2 Qualifikationen abgelaufen", "1 läuft in 60 Tagen ab", "3 Unterweisungen fällig", "1 Zertifikat läuft ab", "Firmenprofil vervollständigen", "/konto/personalsuche", "/konto/aueg"]) assert.ok(html.includes(t), t);
  assert.doesNotMatch(teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false }, false), /team-warnungen|AÜG/);
});
