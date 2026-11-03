import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { ausFormular, dezimal, hinweise, meineStundenTeil, minuten, naechsterMonat, stunden, stundenExcel, stundenSeite, vorMonat, type Eintrag } from "../src/stunden.ts";
import { alsEinsatz, konflikte, meineSchichtenTeil, schichtenSeite, termine, ueberschneiden, type Schicht } from "../src/schichten.ts";
import { brettSeite, empfaenger, imBereich, type Mitteilung } from "../src/brett.ts";
import { fristenSeite, kontrollDocx, kontrollStaende, type FristPerson, type Kontrolle } from "../src/personalfristen.ts";
import { akteAusFormular, akteZeile, fristen } from "../src/personalakte.ts";
import { ichSeite } from "../src/ich.ts";
import { staende } from "../src/unterweisungen.ts";
import { teamKopfHtml } from "../src/teamkopf.ts";
import { xlsxDatei } from "../src/xlsx.ts";

const heute = "2026-11-04"; // Wednesday
const e = (id: string, datum: string, beginn: string, ende: string, pause_min: number, extra: Partial<Eintrag> = {}): Eintrag => ({ id, personal_id: "p1", datum, beginn: `${beginn}:00`, ende: `${ende}:00`, pause_min, einsatz: "Messe Berlin", notiz: "", status: "erfasst", ...extra });

test("T17: Minuten, Nachtschicht, Monate", () => {
  assert.equal(minuten(e("a", heute, "07:00", "15:30", 30)), 480);
  assert.equal(minuten(e("b", heute, "22:00", "06:00", 30)), 450, "über Mitternacht");
  assert.equal(stunden(450), "7:30");
  assert.equal(dezimal(450), 7.5);
  assert.equal(naechsterMonat("2026-12"), "2027-01");
  assert.equal(vorMonat("2027-01"), "2026-12");
});

test("T17: Arbeitszeit-Hinweise nach ArbZG", () => {
  const h = hinweise([e("a", heute, "06:00", "16:00", 30), e("b", "2026-11-03", "07:00", "14:00", 15), e("c", "2026-11-02", "06:00", "12:00", 0), e("d", "2026-11-02", "13:00", "18:30", 30)]);
  assert.deepEqual(h.get("a"), ["Pause unter 45 Min. bei über 9 Std."]);
  assert.deepEqual(h.get("b"), ["Pause unter 30 Min. bei über 6 Std."]);
  assert.deepEqual(h.get("c"), ["über 10 Std. am Tag"], "6 + 5 Std. am selben Tag");
  // A-M6: recorded more than 7 days after the working day.
  const spaet = hinweise([{ ...e("x", "2026-10-01", "08:00", "12:00", 0), erstellt: "2026-10-09T10:00:00Z" }, { ...e("y", "2026-10-01", "08:00", "12:00", 0), erstellt: "2026-10-08T10:00:00Z" }]);
  assert.match(spaet.get("x")?.join() ?? "", /§ 17 MiLoG/);
  assert.equal(spaet.get("y"), undefined);
});

test("T17: Formular prüft Datum, Zeiten und Pause", () => {
  const f = (o: Record<string, string>) => { const x = new FormData(); for (const [k, v] of Object.entries(o)) x.set(k, v); return x; };
  assert.deepEqual(ausFormular(f({ datum: heute, beginn: "07:00", ende: "15:30", pause: "30", einsatz: " Messe  Berlin " }), heute, true), { datum: heute, beginn: "07:00", ende: "15:30", pause_min: 30, einsatz: "Messe Berlin", notiz: "" });
  assert.match(String(ausFormular(f({ datum: "2026-11-05", beginn: "07:00", ende: "15:00" }), heute, true)), /erst am Tag/);
  assert.match(String(ausFormular(f({ datum: "2026-08-01", beginn: "07:00", ende: "15:00" }), heute, true)), /Büro nachtragen/);
  assert.equal(typeof ausFormular(f({ datum: "2026-08-01", beginn: "07:00", ende: "15:00" }), heute, false), "object", "Büro darf ältere Tage");
  assert.match(String(ausFormular(f({ datum: heute, beginn: "07:00", ende: "07:00" }), heute, true)), /Beginn und Ende/);
  assert.match(String(ausFormular(f({ datum: heute, beginn: "07:00", ende: "08:00", pause: "90" }), heute, true)), /Pause ist länger/);
});

test("T17: Mitarbeiter-Teil, Büro-Seite und Excel", () => {
  const liste = [e("a", heute, "07:00", "15:30", 30), e("b", "2026-11-03", "07:00", "15:30", 30, { status: "freigegeben" }), e("c", "2026-11-02", "08:00", "12:00", 0, { personal_id: "p2", einsatz: "Hotel <Adler>", status: "abgelehnt" })];
  const mein = meineStundenTeil(liste.slice(0, 2), ["Messe Berlin"], heute);
  assert.match(mein, /November 2026: <strong>16:00 Std\.<\/strong> · davon freigegeben 8:00/);
  assert.equal((mein.match(/name="stunde_loeschen"/g) ?? []).length, 1, "nur offene löschbar");
  assert.match(mein, /value="Messe Berlin"/);
  const personen = [{ id: "p1", vorname: "Eva", nachname: "Muster" }, { id: "p2", vorname: "Ali", nachname: "K" }];
  const seite = stundenSeite(liste, personen, { monat: "2026-11", heute, nurOffen: true, darfAendern: true });
  assert.match(seite, /Offen \(1\)/);
  assert.equal((seite.match(/name="id"/g) ?? []).length, 1);
  assert.doesNotMatch(seite, /<h3>Ali K/, "nur Offene");
  const alle = stundenSeite(liste, personen, { monat: "2026-11", heute, nurOffen: false, darfAendern: false });
  assert.match(alle, /Hotel &#60;Adler&#62;/);
  assert.doesNotMatch(alle, /Ausgewählte freigeben/);
  assert.match(alle, /Messe Berlin<\/span><strong>16:00 Std\./, "Summe pro Einsatz ohne Abgelehnte");
  const x = unzipSync(stundenExcel(liste, personen, "2026-11"));
  const blatt = strFromU8(x["xl/worksheets/sheet1.xml"]);
  assert.match(blatt, /Eva Muster/);
  assert.match(blatt, /<v>8<\/v>/);
  assert.match(blatt, /Hotel &lt;Adler&gt;/);
  assert.match(strFromU8(x["xl/workbook.xml"]), /Summe Personen/);
});

test("xlsx: Text mit = bleibt Text, keine Formel", () => {
  const x = strFromU8(unzipSync(xlsxDatei([{ name: "A/B", zeilen: [["Kopf"], ["=HYPERLINK(\"x\")", 3]] }]))["xl/worksheets/sheet1.xml"]);
  assert.doesNotMatch(x, /<f>/);
  assert.match(x, /t="inlineStr"[^>]*><is><t xml:space="preserve">=HYPERLINK/);
});

const s = (id: string, datum: string, beginn: string, ende: string, extra: Partial<Schicht> = {}): Schicht => ({ id, personal_id: "p1", bereich_id: null, datum, beginn: `${beginn}:00`, ende: `${ende}:00`, ort: "Messe Halle 3", notiz: "", antwort: "offen", ...extra });

test("T18: Termine, Überschneidung, Konflikte", () => {
  assert.deepEqual(termine("2026-11-04", [], 1), ["2026-11-04"]);
  assert.deepEqual(termine("2026-11-04", [0, 2, 4], 2), ["2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13"], "Mo vor dem Start fällt weg");
  assert.equal(termine("2026-11-02", [0, 1, 2, 3, 4, 5, 6], 8).length, 56);
  assert.equal(ueberschneiden(s("a", heute, "06:00", "14:00"), s("b", heute, "13:00", "20:00")), true);
  assert.equal(ueberschneiden(s("a", heute, "06:00", "14:00"), s("b", heute, "14:00", "22:00")), false);
  assert.equal(ueberschneiden(s("a", heute, "22:00", "06:00"), s("b", heute, "05:00", "07:00")), false, "nächster Morgen ist ein anderer Tag");
  const k = konflikte([s("a", heute, "06:00", "14:00"), s("b", heute, "12:00", "20:00"), s("c", "2026-11-05", "06:00", "14:00"), s("d", heute, "12:00", "20:00", { antwort: "abgesagt", personal_id: "p2" })], [{ personal_id: "p1", von: "2026-11-05", bis: "2026-11-06" }]);
  assert.equal(k.get("a"), "doppelt eingeplant");
  assert.equal(k.get("c"), "abwesend");
  assert.equal(k.has("d"), false);
});

test("T18: Schichtplan, Mitarbeiter-Antwort und Disposition", () => {
  const personen = [{ id: "p1", vorname: "Eva", nachname: "Muster", bereich_id: null, status: "verfuegbar" }, { id: "p9", vorname: "Weg", nachname: "", bereich_id: null, status: "nicht" }];
  const liste = [s("a", heute, "06:00", "14:00", { antwort: "zugesagt" }), s("b", "2026-11-05", "14:00", "22:00", { personal_id: null }), s("c", "2026-11-06", "06:00", "14:00", { antwort: "abgesagt" })];
  const html = schichtenSeite(liste, personen, [], { montag: "2026-11-02", heute, darfAendern: true, bereiche: [] });
  assert.match(html, /KW 45 · 02\.11\.–08\.11\./);
  assert.match(html, /✅ zugesagt/);
  assert.match(html, /offene Schicht, noch niemand/);
  assert.match(html, /❌ 1 abgesagt · 🔓 1 offen/);
  assert.doesNotMatch(html, /Weg/, "nicht verfügbare Personen nicht wählbar");
  assert.match(html, /name="tag" value="6"/);
  const mein = meineSchichtenTeil([...liste, s("x", "2026-11-01", "06:00", "14:00")], heute);
  assert.doesNotMatch(mein, /value="x"/, "vergangene Schichten nicht");
  assert.match(mein, /value="a">.*value="abgesagt"/s);
  assert.doesNotMatch(mein.split('value="a"')[1].split("</li>")[0], /value="zugesagt"/, "schon zugesagt: nur Absagen");
  assert.deepEqual(alsEinsatz(liste).map((x) => [x.personal_id, x.von, x.entleiher]), [["p1", heute, "Messe Halle 3 06:00"]]);
});

test("T19: Empfänger, Bereiche und Schwarzes Brett", () => {
  const bereiche = [{ id: "nrw", name: "NRW", parent_id: null }, { id: "ac", name: "Aachen", parent_id: "nrw" }, { id: "be", name: "Berlin", parent_id: null }];
  assert.equal(imBereich(bereiche, "ac", "nrw"), true);
  assert.equal(imBereich(bereiche, "be", "nrw"), false);
  const mitglieder = [
    { user_id: "chef", rolle: "inhaber", anzeigename: "Chef", funktion: null, aktiv: true },
    { user_id: "k1", rolle: "mitarbeiter", anzeigename: "Kraft Aachen", funktion: null, aktiv: true },
    { user_id: "k2", rolle: "mitarbeiter", anzeigename: "Kraft Berlin", funktion: null, aktiv: true },
    { user_id: "k3", rolle: "mitarbeiter", anzeigename: "Gesperrt", funktion: null, aktiv: false },
    { user_id: "b1", rolle: "bearbeiter", anzeigename: "Büro", funktion: null, aktiv: true },
  ];
  const personal = [{ user_id: "k1", bereich_id: "ac" }, { user_id: "k2", bereich_id: "be" }];
  assert.deepEqual(empfaenger({ bereich_id: "nrw", erstellt_von: "chef" }, mitglieder, personal, bereiche).map((x) => x.user_id), ["k1", "b1"]);
  assert.deepEqual(empfaenger({ bereich_id: null, erstellt_von: "chef" }, mitglieder, personal, bereiche).map((x) => x.user_id), ["k1", "k2", "b1"]);
  const m: Mitteilung[] = [{ id: "m1", bereich_id: null, titel: "Betriebsversammlung", text: "Freitag 14 Uhr\nKantine <oben>", gueltig_bis: null, erstellt_von: "chef", erstellt: "2026-11-03T08:00:00Z" }];
  const buero = brettSeite(m, { ich: "chef", buero: true, darfSchreiben: true, admin: true, gelesen: [{ mitteilung_id: "m1", user_id: "k1", gelesen: "" }], mitglieder, personal, bereiche, heute });
  assert.match(buero, /👁 1 von 3 gelesen/);
  assert.match(buero, /Noch nicht gelesen: Kraft Berlin, Büro/);
  assert.match(buero, /Freitag 14 Uhr<br>Kantine &#60;oben&#62;/);
  assert.match(buero, /Mitteilung schreiben/);
  const kraft = brettSeite(m, { ich: "k2", buero: false, darfSchreiben: false, admin: false, gelesen: [], mitglieder, personal: [], bereiche, heute });
  assert.match(kraft, /name="gelesen" value="m1"/);
  assert.match(kraft, /class="mitteilung neu"/);
  assert.doesNotMatch(kraft, /gelesen<\/summary>|Mitteilung schreiben|name="loeschen"/);
});

const p = (id: string, extra: Partial<FristPerson> = {}): FristPerson => ({ id, vorname: id, nachname: "Test", status: "verfuegbar", fuehrerschein: ["B"], firmenwagen: false, probezeit_bis: null, befristet_bis: null, aufenthalt_bis: null, ...extra });

test("T20: Personalfristen mit Vorwarnzeit", () => {
  assert.deepEqual(fristen({ probezeit_bis: "2026-11-30", befristet_bis: "2027-02-01", aufenthalt_bis: "2027-01-20" }, heute).map((x) => [x.feld, x.stufe]), [["probezeit_bis", "gelb"], ["aufenthalt_bis", "gelb"]]);
  assert.deepEqual(fristen({ probezeit_bis: "2026-11-10", befristet_bis: "2026-10-01", aufenthalt_bis: null }, heute).map((x) => x.stufe), ["rot"], "über 30 Tage abgelaufen zählt nicht mehr");
  const f = new FormData(); f.set("probezeit_bis", "2027-01-31"); f.set("aufenthalt_bis", "kaputt"); f.set("firmenwagen", "on");
  const a = akteAusFormular(f);
  assert.deepEqual([a.probezeit_bis, a.aufenthalt_bis, a.firmenwagen], ["2027-01-31", null, true]);
  assert.match(akteZeile({ befristet_bis: "2026-12-15" }, heute), /📄 befristet bis 15\.12\.2026/);
});

test("T21: Führerscheinkontrolle alle 6 Monate", () => {
  const personen = [p("Anna", { firmenwagen: true }), p("Ben", { firmenwagen: true }), p("Cem", { firmenwagen: true }), p("Dora"), p("Emil", { firmenwagen: true, status: "nicht" })];
  const k: Kontrolle[] = [{ id: "1", personal_id: "Ben", datum: "2026-05-20", klassen: ["B", "C1"], notiz: "", geprueft_von: "u1" }, { id: "2", personal_id: "Cem", datum: "2026-10-01", klassen: [], notiz: "", geprueft_von: null }, { id: "3", personal_id: "Ben", datum: "2025-11-01", klassen: [], notiz: "", geprueft_von: null }];
  const st = kontrollStaende(personen, k, heute);
  assert.deepEqual(st.map((x) => [x.person.id, x.stufe, x.faellig]), [["Anna", "rot", null], ["Ben", "gelb", "2026-11-20"], ["Cem", "gruen", "2027-04-01"]]);
  const html = fristenSeite([...personen, p("Fritz", { probezeit_bis: "2026-11-20" })], k, { heute, darfAendern: true, pruefer: { u1: "Lisa" } });
  assert.match(html, /Fritz Test<\/strong><span class="klein">⏳ Probezeit bis 20\.11\.2026/);
  assert.match(html, /noch nie kontrolliert/);
  assert.match(html, /zuletzt 20\.05\.2026 von Lisa · nächste 20\.11\.2026/);
  assert.equal((html.match(/name="person"/g) ?? []).length, 3);
  const doc = strFromU8(unzipSync(kontrollDocx("Perlease", st, k, { u1: "Lisa" }, heute))["word/document.xml"]);
  assert.match(doc, /Nachweis Führerscheinkontrolle/);
  assert.match(doc, /B, C1/);
  assert.match(doc, /noch nie/);
});

test("T22: Unterweisung im Handy lesen und bestätigen, 📱 im Büro", () => {
  const ich = { id: "p1", firma_id: "f", vorname: "Eva", nachname: "M", berufe: [], qualifikationen: [], status: "verfuegbar" };
  const html = ichSeite({ ich, auftraege: [], ueberlassungen: [], abwesenheiten: [], nachweise: [], heute,
    unterweisungen: [{ id: "u1", titel: "Arbeitsschutz", intervall_monate: 12, letzte: "2025-10-01", beschreibung: "Helm tragen.\nNotausgang kennen.", digital: false }, { id: "u2", titel: "Hygiene", intervall_monate: 24, letzte: "2026-06-01", beschreibung: "Hände waschen", digital: true }],
    stunden: [], schichten: [s("a", "2026-11-05", "06:00", "14:00")] });
  assert.match(html, /<details open><summary class="klein">Inhalt lesen<\/summary><p class="klein">Helm tragen\.<br>Notausgang kennen\./);
  assert.equal((html.match(/Gelesen und verstanden<\/button>/g) ?? []).length, 1, "nur die fällige");
  assert.match(html, /zuletzt 01\.06\.2026 📱/);
  assert.match(html, /id="schichten"/);
  assert.match(html, /id="stunden"/);
  const st = staende({ id: "u1", titel: "", intervall_monate: 12, beschreibung: "" }, [{ id: "p1", vorname: "", nachname: "", status: "verfuegbar" }], [{ unterweisung_id: "u1", personal_id: "p1", datum: "2026-01-01" }, { unterweisung_id: "u1", personal_id: "p1", datum: "2026-11-04", digital: true }], heute);
  assert.deepEqual([st[0].letzte, st[0].digital], ["2026-11-04", true]);
});

test("Team-Kopf: Stunden, Schichten, Fristen, Führerschein", () => {
  const html = teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false, stunden: 4, abgesagt: 1, personalfristen: 2, fuehrerschein: 1 }, false, false);
  assert.match(html, /4 Stundenzettel warten auf Freigabe/);
  assert.match(html, /1 Schicht abgesagt/);
  assert.match(html, /2 Personalfristen laufen bald ab/);
  assert.match(html, /1 Führerscheinkontrolle fällig/);
  for (const pfad of ["schichten", "stunden", "brett", "personalfristen"]) assert.match(html, new RegExp(`/konto/${pfad}"`));
});
