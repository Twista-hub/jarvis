import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { organigramm, rechteSeite, RECHTE, type Mitglied } from "../src/organisation.ts";
import { aktiv, vertretungHinweis, vertretungSeite, type Vertretung } from "../src/vertretung.ts";
import { aufgabenListe, aufgabeForm, sortieren, stufe, type Aufgabe } from "../src/aufgaben.ts";
import { ausstattungText, betriebsmittelSeite, pruefStufe, type Betriebsmittel } from "../src/betriebsmittel.ts";
import { benoetigt, kapazitaet, kapazitaetSeite, passtZuBeruf, reichtTeilHtml } from "../src/kapazitaet.ts";
import { ichSeite, naechsteUnterweisung } from "../src/ich.ts";
import { belegung, type Person } from "../src/disposition.ts";
import { teamKopfHtml } from "../src/teamkopf.ts";
import { eigenerklaerungDocx, type Firma } from "../src/firmenprofil.ts";
import { zugangPersonalForm } from "../src/konto.ts";
import type { Bereich } from "../src/konto.ts";

const heute = "2026-11-04"; // Wednesday
const m = (user_id: string, rolle: string, anzeigename: string, extra: Partial<Mitglied> = {}): Mitglied => ({ user_id, rolle, anzeigename, funktion: null, aktiv: true, finanzen: false, alle_bereiche: false, ...extra });

test("T9: Organigramm mit Leitung, Kontakt und Personenzahl inkl. Unterbereichen", () => {
  const bereiche = [
    { id: "b1", name: "NRW", art: "standort", parent_id: null, ansprechpartner: "Frau Kamp", telefon: "0241 1", email: "" },
    { id: "b2", name: "Aachen", art: "standort", parent_id: "b1", ansprechpartner: "", telefon: "", email: "" },
    { id: "b3", name: "Reinigung", art: "team", parent_id: "b2", ansprechpartner: "", telefon: "", email: "" },
  ] as unknown as Bereich[];
  const html = organigramm("Perlease <GmbH>", bereiche, [m("u1", "inhaber", "Max"), m("u2", "standortleitung", "Lea")], [{ user_id: "u2", bereich_id: "b2" }], [{ bereich_id: "b3" }, { bereich_id: "b2" }, { bereich_id: null }]);
  assert.match(html, /Perlease &#60;GmbH&#62;/);
  assert.match(html, /Max \(Inhaber\)/);
  assert.match(html, /NRW<\/a><\/strong><span class="klein org-fehlt">ohne Leitung/);
  assert.match(html, /Aachen<\/a><\/strong><span class="klein">👤 Lea/);
  assert.match(html, /☎️ Frau Kamp, 0241 1/);
  assert.match(html, /NRW[\s\S]*?2 Personen/); // b2 + b3 count for NRW
  assert.match(html, /1 Person ohne Standort/);
  assert.equal((html.match(/<ul>/g) ?? []).length, 4);
});

test("T10: Rechte-Matrix und Zugänge mit Bereich und Finanzen", () => {
  const html = rechteSeite([m("u3", "leser", "Tom", { finanzen: true }), m("u1", "inhaber", "Max"), m("u4", "bearbeiter", "Gesperrt", { aktiv: false })], [{ user_id: "u3", bereich_id: "b2" }], [{ id: "b2", name: "Aachen" } as Bereich]);
  assert.equal(RECHTE.length, (html.match(/<tr><td>/g) ?? []).length - 2);
  assert.ok(html.indexOf("Max") < html.indexOf("Tom"), "Inhaber zuerst");
  assert.match(html, /Tom<\/td><td>Leser<\/td><td>Aachen<\/td><td>💶/);
  assert.match(html, /class="gesperrt"><td>Gesperrt <span class="klein">\(gesperrt\)/);
});

test("T12: Vertretung aktiv, Hinweis und Formular", () => {
  const v: Vertretung = { id: "v1", user_id: "u1", vertreter_id: "u2", von: "2026-11-02", bis: "2026-11-06", notiz: "Urlaub" };
  assert.equal(aktiv(v, heute), true);
  assert.equal(aktiv(v, "2026-11-07"), false);
  const namen = { u1: "Max", u2: "Lea" };
  const fuerLea = vertretungHinweis([v], "u2", namen, heute, { u1: { aufgaben: 3, vorgaenge: 1 } });
  assert.match(fuerLea, /Du vertrittst <strong>Max<\/strong> bis 06\.11\.2026/);
  assert.match(fuerLea, /href="\/konto\/aufgaben\?fuer=u1">3 Aufgaben<\/a> · 1 Ausschreibung/);
  assert.match(vertretungHinweis([v], "u1", namen, heute, {}), /abwesend und wirst von <strong>Lea<\/strong> vertreten/);
  assert.equal(vertretungHinweis([v], "u3", namen, heute, {}), "");
  const personen = [{ user_id: "u1", anzeigename: "Max", funktion: null, rolle: "inhaber", aktiv: true }, { user_id: "u2", anzeigename: "Lea", funktion: null, rolle: "bearbeiter", aktiv: true }, { user_id: "u9", anzeigename: "Kraft", funktion: null, rolle: "mitarbeiter", aktiv: true }];
  const seite = vertretungSeite([v], personen, { ich: "u2", admin: false, heute });
  assert.match(seite, /läuft gerade/);
  assert.doesNotMatch(seite, /Kraft/, "Einsatzkräfte vertreten nicht");
  assert.doesNotMatch(seite, /name="loeschen"/, "fremde Vertretung nur für Admins löschbar");
  assert.match(seite, /<select name="person"><option value="u2" selected>Lea \(ich\)<\/option><\/select>/);
});

test("T13: Aufgaben sortiert, Ampel, nur Zuständige oder Bearbeiter haken ab", () => {
  const liste: Aufgabe[] = [
    { id: "a1", vorgang_id: null, titel: "Später", zustaendig_id: "u1", faellig: "2026-11-20", erledigt: null },
    { id: "a2", vorgang_id: "v1", titel: "Preisblatt <b>", zustaendig_id: "u2", faellig: "2026-11-03", erledigt: null, vorgaenge: { titel: "Reinigung Aachen" } },
    { id: "a3", vorgang_id: null, titel: "Fertig", zustaendig_id: "u2", faellig: "2026-11-01", erledigt: "2026-11-02T10:00:00Z" },
    { id: "a4", vorgang_id: null, titel: "Morgen", zustaendig_id: null, faellig: "2026-11-05", erledigt: null },
  ];
  assert.deepEqual(sortieren(liste).map((a) => a.id), ["a2", "a4", "a1", "a3"]);
  assert.equal(stufe(liste[1], heute), "rot");
  assert.equal(stufe(liste[3], heute), "gelb");
  assert.equal(stufe(liste[0], heute), "offen");
  assert.equal(stufe(liste[2], heute), "erledigt");
  const html = aufgabenListe(liste, { u1: "Max", u2: "Lea" }, { heute, darfAendern: false, ich: "u2", zurueck: "/konto/aufgaben", mitVorgang: true });
  assert.match(html, /Preisblatt &#60;b&#62;/);
  assert.match(html, /überfällig seit/);
  assert.equal((html.match(/<button name="aktion" value="(erledigt|offen)"/g) ?? []).length, 2, "Lea darf nur ihre eigenen abhaken");
  assert.doesNotMatch(html, /value="loeschen"/);
  const form = aufgabeForm([{ user_id: "u2", anzeigename: "Lea", funktion: null, rolle: "leser", aktiv: true }, { user_id: "u9", anzeigename: "Kraft", funktion: null, rolle: "mitarbeiter", aktiv: true }], { zurueck: "/konto/aufgaben", ich: "u2" });
  assert.match(form, /value="u2" selected>Lea/);
  assert.doesNotMatch(form, /Kraft/);
});

test("T14: Prüftermine und Ausstattung in der Eigenerklärung", () => {
  const liste: Betriebsmittel[] = [
    { id: "1", art: "fahrzeug", bezeichnung: "VW Crafter", kennung: "AC-JV 1", pruefart: "HU/AU (TÜV)", naechste_pruefung: "2026-10-30", notiz: "", bereich_id: null },
    { id: "2", art: "maschine", bezeichnung: "Scheuersaugmaschine", kennung: "", pruefart: "UVV-Prüfung", naechste_pruefung: "2026-11-20", notiz: "", bereich_id: null },
    { id: "3", art: "maschine", bezeichnung: "Hubsteiger", kennung: "", pruefart: "", naechste_pruefung: "2027-05-01", notiz: "", bereich_id: null },
    { id: "4", art: "geraet", bezeichnung: "Leiter", kennung: "", pruefart: "", naechste_pruefung: null, notiz: "", bereich_id: null },
  ];
  assert.deepEqual(liste.map((b) => pruefStufe(b, heute)), ["rot", "gelb", "gruen", "offen"]);
  assert.equal(ausstattungText(liste), "1 Fahrzeug, 2 Maschinen, 1 Gerät");
  const html = betriebsmittelSeite(liste, { heute, darfAendern: true });
  assert.match(html, /2 Prüfungen fällig oder bald fällig/);
  assert.match(html, /⚠️ fällig seit 30\.10\.2026 \(HU\/AU \(TÜV\)\)/);
  assert.ok(html.indexOf("Scheuersaugmaschine") < html.indexOf("Hubsteiger"), "nach Prüftermin sortiert");
  assert.doesNotMatch(betriebsmittelSeite(liste, { heute, darfAendern: false }), /Fahrzeug oder Gerät/);
  const doc = strFromU8(unzipSync(eigenerklaerungDocx("X GmbH", { name: "X", strasse: "", plz: "", ort: "", telefon: "" } as Firma, null, [], [], 0, heute, "1 Fahrzeug, 2 Maschinen"))["word/document.xml"]);
  assert.match(doc, /Technische Ausstattung/);
  assert.match(doc, /1 Fahrzeug, 2 Maschinen/);
  assert.doesNotMatch(strFromU8(unzipSync(eigenerklaerungDocx("X GmbH", { name: "X", strasse: "", plz: "", ort: "", telefon: "" } as Firma, null, [], [], 0, heute))["word/document.xml"]), /Technische Ausstattung/);
});

test("T15: Kapazität pro Beruf und „Reicht unser Personal?“", () => {
  const p = (id: string, berufe: string[], status = "verfuegbar"): Person => ({ id, vorname: id, nachname: "", berufe, bereich_id: null, status });
  const personen = [p("a", ["Reinigungskraft"]), p("b", ["Reinigungskraft"]), p("c", ["Reinigungskraft"], "nicht"), p("d", ["Koch"])];
  const ueb = [{ id: "u", personal_id: "a", entleiher: "Kunde", von: "2026-11-01", bis: "2026-11-30" }];
  const abw = [{ personal_id: "b", von: "2026-12-01", bis: "2026-12-04", grund: "urlaub", status: "beantragt" }];
  const z = kapazitaet(personen, ueb, abw, [], heute);
  assert.deepEqual(z, [{ beruf: "Koch", gesamt: 1, frei: [1, 1, 1, 1] }, { beruf: "Reinigungskraft", gesamt: 2, frei: [1, 0, 2, 2] }]);
  assert.match(kapazitaetSeite(z, heute), /ab 02\.11\.2026/);
  assert.equal(benoetigt({ menge: 3200, einheit: "Stunden", zeitraum: "pro Jahr" }), 2);
  assert.equal(benoetigt({ menge: 40, einheit: "Std.", zeitraum: "pro Woche" }), 2);
  assert.equal(benoetigt({ menge: 4, einheit: "Personen", zeitraum: "" }), 4);
  assert.equal(benoetigt({ menge: 100, einheit: "m²", zeitraum: "" }), null);
  assert.equal(passtZuBeruf("Unterhaltsreinigung (Reinigungskraft)", "Reinigungskraft"), true);
  assert.equal(passtZuBeruf("Köche", "Koch"), false);
  assert.equal(passtZuBeruf("Koch/Köchin", "Koch"), true);
  const lose = [{ nr: "1", name: "Reinigung", menge: 3200, einheit: "Stunden", zeitraum: "pro Jahr", hinweis: "", taetigkeit: "Reinigungskraft" }, { nr: "2", name: "Küche", menge: 2, einheit: "Personen", zeitraum: "", hinweis: "", taetigkeit: "Koch" }, { nr: "3", name: "Ohne", menge: 1, einheit: "Stück", zeitraum: "", hinweis: "" }];
  const html = reichtTeilHtml(lose, personen, new Set(["b", "d"]));
  assert.match(html, /<li class="knapp">.*Los 1: Reinigung.*benötigt ca\. 2 Personen.*🟡 1 frei von 2/);
  assert.match(html, /<li class="fehlt">.*Los 2: Küche.*⚠️ 1 frei von 1/);
  assert.doesNotMatch(html, /Los 3/);
  assert.equal(reichtTeilHtml([lose[2]], personen, new Set()), "");
});

test("T16: beantragter Urlaub in der Disposition mit Fragezeichen", () => {
  const b = belegung([{ id: "a", vorname: "A", nachname: "", berufe: [], bereich_id: null, status: "verfuegbar" }], [], [{ personal_id: "a", von: heute, bis: heute, grund: "urlaub", status: "beantragt" }], [], [heute]);
  assert.deepEqual(b.get("a"), [{ art: "abwesend", text: "Urlaub?" }]);
});

test("T16: Mitarbeiter-Seite mit Einsätzen, Anträgen, Nachweisen und Unterweisungen", () => {
  const html = ichSeite({
    ich: { id: "p1", firma_id: "f", vorname: "Ali", nachname: "K", berufe: ["Reinigungskraft"], qualifikationen: ["Staplerschein"], status: "verfuegbar" },
    auftraege: [{ titel: "Messe Berlin", beginn: "2026-10-01", ende: "2027-03-31" }, { titel: "Alt", beginn: "2025-01-01", ende: "2025-12-31" }],
    ueberlassungen: [{ entleiher: "Hotel <Adler>", von: "2026-12-01", bis: null }],
    abwesenheiten: [{ id: "x1", personal_id: "p1", von: "2026-12-22", bis: "2026-12-30", grund: "urlaub", notiz: "", status: "beantragt" }, { id: "x2", personal_id: "p1", von: "2026-11-10", bis: "2026-11-10", grund: "abwesend", notiz: "", status: "bestaetigt" }],
    nachweise: [{ id: "n1", personal_id: "p1", bezeichnung: "Erste Hilfe", erworben: null, gueltig_bis: "2026-12-01", datei_name: "eh.pdf", datei_mime: "application/pdf" }],
    unterweisungen: [{ titel: "Arbeitsschutz", intervall_monate: 12, letzte: "2025-10-01" }, { titel: "Hygiene", intervall_monate: 12, letzte: null }],
    heute,
  });
  assert.match(html, /Hallo Ali/);
  assert.match(html, /Messe Berlin.*läuft/);
  assert.doesNotMatch(html, /<strong>Alt<\/strong>/);
  assert.match(html, /Überlassung an Hotel &#60;Adler&#62;.*ab 01\.12\.2026/);
  assert.equal((html.match(/name="zurueckziehen"/g) ?? []).length, 1, "nur beantragte zurückziehbar");
  assert.match(html, /⏳ beantragt, wartet auf das Büro/);
  assert.match(html, /href="\/konto\/ich\/nachweis\/n1"/);
  assert.match(html, /⏳ gültig bis 01\.12\.2026/);
  assert.match(html, /noch nicht unterwiesen/);
  assert.match(html, /fällig seit 01\.10\.2026/);
  assert.match(html, /min="2026-11-04"/);
  assert.equal(naechsteUnterweisung({ titel: "", intervall_monate: 6, letzte: "2026-05-04" }, heute), "2026-11-04");
});

test("T16: Zugang mit Personalakte verknüpfen zeigt nur freie Akten", () => {
  const akten = [{ id: "p1", vorname: "Ali", nachname: "K", user_id: "u9" }, { id: "p2", vorname: "Bea", nachname: "L", user_id: null }, { id: "p3", vorname: "Cem", nachname: "M", user_id: "u8" }];
  const html = zugangPersonalForm("u9", akten);
  assert.match(html, /<option value="p1" selected>Ali K/);
  assert.match(html, /Bea L/);
  assert.doesNotMatch(html, /Cem/);
  assert.match(html, /Verknüpfung entfernen/);
  assert.match(zugangPersonalForm("u7", akten), /<option value="">nicht verknüpft/);
});

test("Team-Kopf: neue Kacheln, Prüfungen und Urlaubsanträge", () => {
  const w = { nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false, pruefungen: 2, antraege: 1 };
  const html = teamKopfHtml(w, false, true);
  assert.match(html, /1 Urlaubsantrag wartet/);
  assert.match(html, /2 Prüfungen \(TÜV, UVV …\) fällig/);
  for (const pfad of ["kapazitaet", "aufgaben", "vertretung", "betriebsmittel", "organigramm", "rechte"]) assert.match(html, new RegExp(`/konto/${pfad}"`));
  assert.doesNotMatch(teamKopfHtml(w, false, false), /\/konto\/rechte"/);
});
