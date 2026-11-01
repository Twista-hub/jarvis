import assert from "node:assert/strict";
import { test } from "node:test";
import { filtern, foerderSeite, neuePassende, type Foerderung } from "../src/foerderung.ts";
import { erinnerungsTag, erinnerungsTitel, plusMonate, quartal, radarParameter, radarSeite, vorbereitungAb, type RadarEintrag } from "../src/radar.ts";
import { bereinigen } from "../src/einrichtung.ts";

const programm = (id: string, punkte: number, stand: Foerderung["stand"], bewertet = "2026-10-31T06:00:00Z"): Foerderung => ({
  programm_id: id, punkte, grund: `Grund ${id}`, bewertet, stand,
  foerderprogramme: { titel: `Programm ${id} <b>`, link: `https://www.foerderdatenbank.de/${id}`, veroeffentlicht: "2026-10-30" },
});

test("N2: Ansichten der Förderprogramme und Zähler für die Kachel", () => {
  const liste = [programm("a", 9, "neu"), programm("b", 7, "gemerkt"), programm("c", 4, "neu"), programm("d", 8, "ausgeblendet"), programm("e", 8, "erledigt"), programm("f", 8, "neu", "2026-10-01T06:00:00Z")];
  assert.deepEqual(filtern(liste, "passend").map((f) => f.programm_id), ["a", "b", "f"]);
  assert.deepEqual(filtern(liste, "gemerkt").map((f) => f.programm_id), ["b"]);
  assert.deepEqual(filtern(liste, "alle").map((f) => f.programm_id), ["a", "b", "c", "e", "f"]);
  assert.deepEqual(filtern(liste, "ausgeblendet").map((f) => f.programm_id), ["d", "e"]);
  assert.deepEqual(filtern([{ ...programm("x", 9, "neu"), foerderprogramme: null }], "passend"), []);
  assert.equal(neuePassende(liste, Date.parse("2026-11-01T08:00:00Z")), 1); // a; f is older than 14 days, b is already marked
  const html = foerderSeite(liste, { ansicht: "", darfAendern: true });
  assert.ok(html.indexOf("<strong>Programm b") < html.indexOf("<strong>Programm a"), "Gemerkte stehen oben");
  assert.doesNotMatch(html, /Programm a <b>/);
  assert.match(html, /CC BY-ND 4\.0 DE/);
  assert.match(html, /value="erledigt"/);
  assert.doesNotMatch(foerderSeite(liste, { ansicht: "alle", darfAendern: false }), /<form/);
  assert.match(foerderSeite([], { ansicht: "", darfAendern: true }), /Noch keine Förderprogramme geprüft/);
});

const eintrag = (id: string, ende: string, mehr: Partial<RadarEintrag> = {}): RadarEintrag => ({
  id, titel: `Reinigung ${id}`, auftraggeber: "Stadt A", auftraggeber_id: "a", ort: "10115 Berlin (Auftraggeberadresse; Einsatzort prüfen)", link: "https://example.org",
  ende, ende_art: "geschaetzt", verlaengerung_bis: null, gewinner: "Blitz GmbH", wert: "240000", neu_id: null, neu_titel: null, ...mehr,
});

test("N3: Vorbereitungszeit, Erinnerung und Quartale", () => {
  assert.equal(plusMonate("2027-08-31", -6), "2027-02-28");
  assert.equal(vorbereitungAb("2027-12-31", "2026-11-01"), "2027-06-30");
  assert.equal(vorbereitungAb("2027-02-01", "2026-11-01"), "2026-11-01");
  assert.equal(erinnerungsTag("2027-12-31", "2026-11-01"), "2027-06-30");
  assert.equal(erinnerungsTag("2027-01-15", "2026-11-01"), "2026-11-02", "schon in der Vorbereitungszeit: morgen");
  assert.equal(quartal("2027-08-15"), "3. Quartal 2027");
  assert.ok(erinnerungsTitel("x".repeat(400)).length <= 200);
});

test("N3: Suchparameter aus dem Suchprofil samt weiterer Profile", () => {
  const v = bereinigen({ beschreibung: "", leistungen: [{ name: "Reinigung", woerter: ["reinigung"], cpv: ["90910000"] }], standorte: [{ name: "Berlin", plz_praefixe: ["10", "12"] }], ausschluss: ["glas"] } as any);
  const p = radarParameter(v, [{ id: "z", name: "Winterdienst", woerter: ["winterdienst"], ausschluss: [] }], ["fenster"]);
  assert.match("unterhalt reinigung", new RegExp(p.muster.replace(/\(\?<!\\w\)/g, "\\b")));
  assert.match(p.muster, /winterdienst/);
  assert.deepEqual(p.cpv, ["9091"]);
  assert.deepEqual(p.plz, ["10", "12"]);
  assert.match(p.ausschluss, /glas/); assert.match(p.ausschluss, /fenster/);
  assert.equal(p.leer, false);
  assert.equal(radarParameter(bereinigen({ beschreibung: "", leistungen: [], standorte: [] } as any)).leer, true);
});

test("N3: Radar-Seite gruppiert nach Quartal und zeigt Aktionen nach Rechten", () => {
  const opts = { heute: "2026-11-01", monate: 48, darfErinnern: true, admin: true, darfUebernehmen: true, beobachtet: new Set<string>(), erinnert: new Map<string, string>() };
  const liste = [eintrag("spaet", "2028-05-10", { ende_art: "vertrag", verlaengerung_bis: "2030-05-10" }), eintrag("bald", "2027-03-01"), eintrag("neu", "2027-01-15", { neu_id: "bks:n", neu_titel: "Reinigung 2027" })];
  const html = radarSeite(liste, opts);
  assert.ok(html.indexOf("1. Quartal 2027") < html.indexOf("2. Quartal 2028"));
  assert.match(html, /Schon neu ausgeschrieben/);
  assert.match(html, /action="\/konto\/markt\/uebernehmen"/);
  assert.match(html, /Jetzt vorbereiten/);
  assert.match(html, /Vorbereitung ab 10\.11\.2027/);
  assert.match(html, /mit Verlängerung bis 10\.5\.2030/);
  assert.match(html, /240\.000/);
  assert.doesNotMatch(html, /Auftraggeberadresse/);
  assert.match(html, /<strong>3<\/strong><span>Verträge enden/);
  const leser = radarSeite(liste, { ...opts, darfErinnern: false, admin: false, darfUebernehmen: false });
  assert.doesNotMatch(leser, /<form/);
  const markiert = radarSeite(liste, { ...opts, beobachtet: new Set(["a"]), erinnert: new Map([[erinnerungsTitel("Reinigung bald"), "2026-11-02T07:00:00Z"]]) });
  assert.match(markiert, /👁 beobachtet/);
  assert.match(markiert, /🔔 2\.11\.2026/);
  assert.match(radarSeite([], { ...opts, profilFehlt: true }), /Suchprofil/);
  assert.match(radarSeite([], { ...opts, monate: 12 }), /Auf 4 Jahre erweitern/);
});
