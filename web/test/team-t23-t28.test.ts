import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { groessen, meinePsaTeil, psaDocx, psaSeite, stufe, type Psa } from "../src/psa.ts";
import { berlinOffset, bewerberSeite, type Bewerber } from "../src/bewerber.ts";
import { checklistenSeite, VORLAGEN, type Punkt } from "../src/checklisten.ts";
import { arbeitstage, kalenderSeite, kontoSeite, meinUrlaubText, stand } from "../src/urlaub.ts";
import { bewertungenSeite, gesperrtFuer, schnitt, schnittText, type Bewertung } from "../src/bewertungen.ts";
import { auswertungSeite } from "../src/personalauswertung.ts";
import { ersatzVorschlaege, type Schicht } from "../src/schichten.ts";
import { teamKopfHtml } from "../src/teamkopf.ts";

const heute = "2026-11-04";

test("T23: PSA mit Austausch-Ampel, Größen und Ausgabeprotokoll", () => {
  const l: Psa[] = [
    { id: "a", personal_id: "p1", artikel: "Sicherheitsschuhe S3", groesse: "42", menge: 1, ausgegeben: "2025-01-10", austausch: "2026-10-01", zurueck: null, notiz: "" },
    { id: "b", personal_id: "p1", artikel: "Sicherheitsschuhe S3", groesse: "43", menge: 1, ausgegeben: "2026-10-02", austausch: "2026-11-20", zurueck: null, notiz: "" },
    { id: "c", personal_id: "p1", artikel: "Warnweste", groesse: "L", menge: 2, ausgegeben: "2026-01-01", austausch: null, zurueck: "2026-06-01", notiz: "" },
  ];
  assert.deepEqual(l.map((x) => stufe(x, heute)), ["rot", "gelb", ""]);
  assert.deepEqual(groessen(l, "p1"), { "Sicherheitsschuhe S3": "43", Warnweste: "L" });
  const html = psaSeite(l, [{ id: "p1", vorname: "Eva", nachname: "Muster", status: "verfuegbar" }], { heute, darfAendern: true });
  assert.match(html, /⚠️ Austausch fällig/);
  assert.match(html, /Eva Muster · Sicherheitsschuhe S3/);
  assert.match(html, /2 Teile/, "Zurückgegebenes zählt nicht");
  assert.match(html, /\/konto\/psa\/p1\.docx/);
  assert.match(meinePsaTeil(l, heute), /Meine Schutzausrüstung.*Gr\. 43/s);
  assert.doesNotMatch(meinePsaTeil(l, heute), /Warnweste/);
  const doc = strFromU8(unzipSync(psaDocx("Perlease", { vorname: "Eva", nachname: "Muster" }, l.slice(0, 2), heute))["word/document.xml"]);
  assert.match(doc, /Ausgabeprotokoll Persönliche Schutzausrüstung/);
  assert.match(doc, /Unterschrift Mitarbeiter/);
});

const b = (id: string, status: string, extra: Partial<Bewerber> = {}): Bewerber => ({ id, bereich_id: null, vorname: "Bea", nachname: id, email: "bea@example.de", telefon: "0170 1", beruf: "Servicekraft", quelle: "Indeed", status, gespraech: null, notiz: "", loeschen_ab: null, personal_id: null, erstellt: "2026-10-20T08:00:00Z", ...extra });

test("T24: Bewerber nach Status, Löschdatum und Übernahme", () => {
  const html = bewerberSeite([b("A", "neu"), b("B", "gespraech", { gespraech: "2026-11-06T09:30:00Z" }), b("C", "absage", { loeschen_ab: "2027-05-06" }), b("D", "eingestellt", { personal_id: "p9" })], [{ id: "d1", bewerber_id: "A", name: "Lebenslauf <x>.pdf", mime: "application/pdf", groesse: 1000 }], { heute, bereiche: [], berufe: ["Koch"] });
  assert.ok(html.indexOf("🆕 Neu") < html.indexOf("💬 Gespräch") && html.indexOf("💬 Gespräch") < html.indexOf("❌ Absage"));
  assert.match(html, /💬 Fr\., 06\.11\., 10:30/, "Gesprächstermin in Berliner Zeit");
  assert.match(html, /🗑️ wird am 06\.05\.2027 gelöscht/);
  assert.match(html, /Lebenslauf &#60;x&#62;\.pdf/);
  assert.match(html, /🎉 In der Personalakte/);
  assert.equal((html.match(/Personalakte anlegen/g) ?? []).length, 2, "nicht bei Absage oder schon eingestellt");
  assert.equal(berlinOffset("2026-07-01T10:00"), "+02:00");
  assert.equal(berlinOffset("2026-12-01T10:00"), "+01:00");
  assert.equal(berlinOffset("2026-03-29T03:30"), "+02:00");
});

test("T25: Checklisten mit Fortschritt", () => {
  const p: Punkt[] = VORLAGEN.einstieg.slice(0, 3).map((t, i) => ({ id: `x${i}`, personal_id: "p1", art: "einstieg", titel: t, reihenfolge: i, erledigt: i === 0 ? "2026-11-01T10:00:00Z" : null }));
  const fertig: Punkt[] = [{ id: "y", personal_id: "p2", art: "austritt", titel: "App-Zugang gesperrt", reihenfolge: 0, erledigt: "2026-10-01T10:00:00Z" }];
  const html = checklistenSeite([...p, ...fertig], [{ id: "p1", vorname: "Eva", nachname: "M", eintritt: "2026-11-01", austritt_am: null, status: "verfuegbar" }, { id: "p2", vorname: "Tom", nachname: "W", eintritt: null, austritt_am: "2026-10-31", status: "nicht" }], { darfAendern: true, heute });
  assert.match(html, /👋 Eva M<\/strong><span class="klein">Einstieg am 01\.11\.2026 · 1 von 3 erledigt/);
  assert.match(html, /width:33%/);
  assert.ok(html.indexOf("<h2>Offen</h2>") < html.indexOf("<h2>Erledigt</h2>"));
  assert.match(html, /🚪 Tom W<\/strong><span class="klein">Austritt am 31\.10\.2026 · 1 von 1/);
  assert.ok(VORLAGEN.austritt.includes("App-Zugang gesperrt"));
});

test("T26: Urlaubstage, Konto und Teamkalender", () => {
  assert.equal(arbeitstage("2026-12-21", "2027-01-08", "NW", 2026), 8, "21.–31.12. ohne Wochenende und 25./26.12.");
  assert.equal(arbeitstage("2026-12-21", "2027-01-08", "NW", 2027), 5, "4.–8.1.; 1.1. Feiertag");
  assert.equal(arbeitstage("2026-06-01", "2026-06-05", "NW"), 4, "Fronleichnam");
  assert.equal(arbeitstage("2026-06-01", "2026-06-05", "BE"), 5);
  const abw = [{ personal_id: "p1", von: "2026-08-03", bis: "2026-08-14", grund: "urlaub", status: "bestaetigt" }, { personal_id: "p1", von: "2026-12-28", bis: "2026-12-30", grund: "urlaub", status: "beantragt" }, { personal_id: "p1", von: "2026-11-04", bis: "2026-11-04", grund: "abwesend", status: "bestaetigt", kurzfristig: true }];
  const s = stand("p1", 2026, [{ personal_id: "p1", jahr: 2026, anspruch: "26", uebertrag: "3.5" }], abw, "NW");
  assert.deepEqual(s, { anspruch: 26, uebertrag: 3.5, genommen: 10, beantragt: 3, rest: 16.5, eingetragen: true });
  assert.match(meinUrlaubText(s, 2026), /26 \+ 3,5 aus dem Vorjahr Tage · genommen 10 · beantragt 3 · <strong>Rest 16,5/);
  const personen = [{ id: "p1", vorname: "Eva", nachname: "M", status: "verfuegbar", bereich_id: null }, { id: "p2", vorname: "Tom", nachname: "W", status: "verfuegbar", bereich_id: null }];
  const konto = kontoSeite(personen, [], abw, { jahr: 2026, land: "NW", darfAendern: true });
  assert.match(konto, /Für alle 2 ohne Eintrag/);
  assert.match(konto, /name="anspruch_p1"/);
  const kal = kalenderSeite(personen, [...abw, { personal_id: "p2", von: "2026-11-04", bis: "2026-11-05", grund: "urlaub", status: "bestaetigt" }], { monat: "2026-11", land: "NW", heute, standort: "", standorte: [] });
  assert.match(kal, /⚠️ An 1 Werktag fehlen 2 oder mehr Personen gleichzeitig: 4\./);
  assert.match(kal, /<th class="we ft">1<br>/, "Allerheiligen (Sonntag) grau");
  assert.equal((kal.match(/<td class="[^"]*urlaub">U<\/td>/g) ?? []).length, 2);
});

test("T27: Bewertungen, Schnitt und Sperre für Ersatzvorschläge", () => {
  const l: Bewertung[] = [
    { id: "1", personal_id: "p1", kunde_id: "k1", einsatz: "", datum: "2026-09-01", sterne: 5, wieder: "ja", notiz: "" },
    { id: "2", personal_id: "p1", kunde_id: "k2", einsatz: "", datum: "2026-10-01", sterne: 2, wieder: "nein", notiz: "zu spät" },
    { id: "3", personal_id: "p2", kunde_id: "k2", einsatz: "", datum: "2026-09-01", sterne: 2, wieder: "nein", notiz: "" },
    { id: "4", personal_id: "p2", kunde_id: "k2", einsatz: "", datum: "2026-10-15", sterne: 4, wieder: "ja", notiz: "" },
  ];
  const k = (id: string | null) => id === "k1" ? "Messe" : "Hotel Adlon";
  assert.equal(schnittText(schnitt(l, "p1", k, "2026-11-03")), "⭐ 3,5 (2) · 🚫 nicht wieder bei Hotel Adlon");
  assert.equal(schnittText(schnitt(l, "p2", k, "2026-11-03")), "⭐ 3 (2)", "neuere Bewertung hebt das Nein auf");
  assert.deepEqual([...gesperrtFuer(l, "k2", "2026-11-03")], ["p1"]);
  assert.deepEqual([...gesperrtFuer(l, null)], []);
  assert.deepEqual([...gesperrtFuer(l, "k2", "2030-01-01")], [], "\"nicht wieder\" expires after 12 months");
  const s: Schicht = { id: "s", personal_id: "p9", bereich_id: null, datum: heute, beginn: "06:00:00", ende: "14:00:00", ort: "", notiz: "", antwort: "abgesagt" };
  const leute = [{ id: "p1", vorname: "A", nachname: "", bereich_id: null, status: "verfuegbar" }, { id: "p2", vorname: "B", nachname: "", bereich_id: null, status: "verfuegbar" }];
  assert.deepEqual(ersatzVorschlaege(s, undefined, leute, [s], [], [], gesperrtFuer(l, "k2", "2026-11-03")).map((p) => p.id), ["p2"]);
  const html = bewertungenSeite(l, [{ id: "p1", vorname: "Eva", nachname: "M", status: "verfuegbar" }, { id: "p2", vorname: "Tom", nachname: "W", status: "verfuegbar" }], [{ id: "k1", name: "Messe" }, { id: "k2", name: "Hotel Adlon" }], { heute, darfAendern: true });
  assert.ok(html.indexOf("Eva M") < html.indexOf("Tom W"), "besserer Schnitt zuerst");
  assert.match(html, /🚫 nicht wieder · zu spät/);
});

test("T28: Personal-Auswertung", () => {
  const html = auswertungSeite({
    personen: [
      { id: "p1", bereich_id: "b1", berufe: ["Koch"], status: "verfuegbar", beschaeftigung: "vollzeit", eintritt: "2026-10-01", austritt_am: null },
      { id: "p2", bereich_id: "b1", berufe: ["Servicekraft", "Koch"], status: "verfuegbar", beschaeftigung: "minijob", eintritt: "2020-01-01", austritt_am: null },
      { id: "p3", bereich_id: "b2", berufe: [], status: "verfuegbar", beschaeftigung: null, eintritt: null, austritt_am: "2026-09-30" },
    ],
    bereiche: [{ id: "b1", name: "Berlin" }, { id: "b2", name: "Hamburg" }],
    stunden: [{ personal_id: "p1", datum: "2026-11-02", beginn: "07:00:00", ende: "15:30:00", pause_min: 30, status: "freigegeben" }, { personal_id: "p2", datum: "2026-10-02", beginn: "07:00:00", ende: "15:00:00", pause_min: 0, status: "abgelehnt" }],
    ausfaelle: [{ personal_id: "p1", von: "2026-11-03", kurzfristig: true }], nachweiseBald: 4, urlaub: { anspruch: 52, genommen: 10 },
  }, heute);
  assert.match(html, /<strong>2<\/strong><span class="klein">aktive Personen/, "Ausgetretene zählen nicht");
  assert.match(html, /<strong>1<\/strong><span class="klein">Eintritte \(3 Monate\)/);
  assert.match(html, /<strong>10 \/ 52<\/strong>/);
  assert.match(html, /<td>Koch<\/td><td>2<\/td><td><strong>2<\/strong>/);
  assert.match(html, /Vollzeit/);
  assert.match(html, /<strong>8 Std\.<\/strong> <span class="klein">1 Person/);
  assert.match(html, /<tr><td>Nov\. 26<\/td><td>1?<\/td><td><\/td><td>1<\/td><\/tr>/);
});

test("Team-Kopf: Gruppen und neue Warnungen", () => {
  const html = teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false, psa: 2, bewerber: 3, checklisten: 1 }, false, true);
  for (const g of ["Planung", "Personal", "Abrechnung &amp; Kunden", "Firma"]) assert.match(html, new RegExp(`werkzeug-gruppe">${g}`));
  assert.match(html, /3 neue Bewerbungen/);
  assert.match(html, /1 offene Checkliste/);
  assert.match(html, /2 PSA-Austausch fällig/);
  for (const p of ["psa", "bewerber", "checklisten", "urlaub", "bewertungen", "personalauswertung"]) assert.match(html, new RegExp(`/konto/${p}"`));
});
