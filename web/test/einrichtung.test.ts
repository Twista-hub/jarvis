import assert from "node:assert/strict";
import { test } from "node:test";
import { ausFormular, bereinigen, beschreibungFallback, FIRMEN_WEB_SUCHTOOL, hatProfiltext, profilFormular, profilZuFormular, startFormular, suchlaufLaeuft, vorschlagOderFallback, websiteFallback } from "../src/einrichtung.ts";

test("automatische Ergänzung bewahrt eigene Beschreibung, Suchgebiete, Länder und Quellen beim Speichern", () => {
  const v = bereinigen({ beschreibung: "Meine ursprüngliche Firmenbeschreibung.", recherche_version: 2, website_hinweis: "Website blockiert den direkten Abruf.", websuche_beschreibung: "Belegte Fliesenarbeiten aus öffentlicher Recherche.", websuche_quellen: [{ titel: "Quelle", url: "https://firma.example" }], leistungen: [{ name: "Fliesen", woerter: ["fliesen"], cpv: ["45431"] }], standorte: [{ name: "Aachen", plz_praefixe: ["52"], bereich_id: "11111111-1111-4111-8111-111111111111" }], laender: ["DEU", "NLD"] });
  const form = profilZuFormular(v, "https://firma.example");
  assert.equal(form.has("stunde"), false, "automatische Recherche ändert keine Benachrichtigungen");
  assert.deepEqual(ausFormular(form), v);
});

test("Firmenstandorte und bis zu vierzig Suchorte bleiben im Formular vollständig erhalten", () => {
  const v = bereinigen({ beschreibung: "Unsere Leistungen und Niederlassungen", suchgebiet_modus: "manuell", firmenstandorte: [{ name: "Köln", plz: "50667", quelle: "https://firma.example/standorte" }],
    standorte: Array.from({ length: 40 }, (_, i) => ({ name: `Ort ${i}`, plz_praefixe: ["50"] })) });
  assert.deepEqual(ausFormular(profilZuFormular(v, "https://firma.example")), v);
});

test("erlaubt eine neue Suche nach Abschluss des vorherigen Laufs", () => {
  const jetzt = Date.parse("2026-10-31T06:00:00Z");
  assert.equal(suchlaufLaeuft("2026-10-31T05:30:00Z", "2026-10-31T05:35:00Z", jetzt), false);
  assert.equal(suchlaufLaeuft("2026-10-31T05:59:00Z", "2026-10-31T05:58:00Z", jetzt), true);
  // A full catalog run takes longer than 20 minutes; only after an hour does it count as stuck.
  assert.equal(suchlaufLaeuft("2026-10-31T05:30:00Z", null, jetzt), true);
  assert.equal(suchlaufLaeuft("2026-10-31T04:50:00Z", null, jetzt), false);
});

test("cleans the proposal: digits only, lower-case words, no empty services", () => {
  const v = bereinigen({
    beschreibung: " Zeitarbeit für Events. ",
    leistungen: [{ name: "Service", cpv: ["79620000", "x", "7"], woerter: ["Servicekräfte", "ab", "servicekräfte"] }, { name: "", cpv: ["1"], woerter: [] }],
    ausschluss: ["Bau"],
    ausschluss_cpv: ["45"],
    standorte: [{ name: "Köln", plz_praefixe: ["50", "501", "51"] }],
  });
  assert.deepEqual(v.leistungen, [{ name: "Service", cpv: ["79620000"], woerter: ["servicekräfte"] }]);
  assert.deepEqual(v.standorte, [{ name: "Köln", plz_praefixe: ["50", "51"] }]);
  assert.equal(v.beschreibung, "Zeitarbeit für Events.");
});

test("KI-Fallback übernimmt selbst beschriebene Leistungen und Stadt, damit man trotzdem speichern kann", () => {
  const v = beschreibungFallback("Wir stellen Elektriker und Elektroniker für Wartung und Reparaturen in Berlin. Keine Gebäudereinigung.", "Berlin\nPotsdam");
  assert.equal(v.standorte.map((o) => o.name).join(", "), "Berlin, Potsdam");
  assert.ok(v.leistungen.length);
  assert.ok(v.leistungen[0].woerter.includes("elektriker"));
  assert.ok(v.leistungen[0].woerter.includes("wartung"));
  const html = profilFormular("firm", v, "Automatischer Vorschlag gerade nicht verfügbar.", "https://firma.example");
  assert.match(html, /value="https:\/\/firma\.example"/);
  assert.match(html, /name="o0_name"[^>]*value="Berlin"/);
});

test("KI-Fallback behält konkrete Suchwörter aus der Firmenwebsite bei", () => {
  const v = beschreibungFallback("Wir arbeiten regional für Unternehmen mit vielen verschiedenen Wünschen und Aufgaben rund um unsere zuverlässige Arbeit im gesamten Bereich.", "Baesweiler", "Fliesen Mosaik Badezimmer sanieren Naturstein verlegen Terrassenplatten");
  const woerter = v.leistungen.flatMap((l) => l.woerter);
  assert.ok(woerter.includes("fliesen"));
  assert.ok(woerter.includes("mosaik"));
  assert.ok(woerter.includes("naturstein"));
  assert.equal(woerter[0], "fliesen");
});

test("eigene und auf der Website gefundene Beschreibung bleiben getrennt", () => {
  const original = "Wir verlegen Fliesen in Baesweiler und Umgebung.";
  const website = "Team Effertz bietet Badplanung, Fliesen und Natursteinarbeiten an.";
  const v = vorschlagOderFallback({
    beschreibung: "Von der KI verfasste Beschreibung.", website_beschreibung: website,
    leistungen: [{ name: "Fliesenarbeiten", cpv: [], woerter: ["fliesen", "naturstein"] }],
  }, original, "Baesweiler");
  assert.equal(v.beschreibung, original);
  assert.equal(v.website_beschreibung, website);
  const html = profilFormular("firma", v, "");
  assert.match(html, /name="beschreibung"[^>]*>[\s\S]*Wir verlegen Fliesen in Baesweiler/);
  assert.match(html, /name="website_beschreibung"[^>]*>[\s\S]*Team Effertz bietet Badplanung/);
});

test("leerer oder unbrauchbarer KI-Vorschlag wird durch ein speicherbares Profil ersetzt", () => {
  const text = "Wir vermitteln Elektriker und Schweißer für Industrie und Wartung.";
  const leer = vorschlagOderFallback({ beschreibung: text, leistungen: [], standorte: [] }, text, "Essen");
  assert.equal(leer.leistungen.length, 1);
  assert.equal(leer.standorte[0].name, "Essen");

  const kaputt = vorschlagOderFallback({ beschreibung: "", leistungen: [{ name: "", cpv: [], woerter: [] }] }, text, "");
  assert.ok(kaputt.beschreibung.length >= 20);
  assert.ok(kaputt.leistungen.length);
});

test("automatischer Signup-Fallback baut das Profil aus Website-Funden ohne eigene Beschreibung", () => {
  const v = websiteFallback("Team Effertz GmbH", "Wir bieten Fliesen Mosaik Badplanung und Natursteinarbeiten für Terrassen.", "Baesweiler", "52499");
  assert.ok(v);
  assert.equal(v.beschreibung, "");
  assert.equal(v.website_beschreibung, "Wir bieten Fliesen Mosaik Badplanung und Natursteinarbeiten für Terrassen.");
  assert.equal(v.leistungen[0].name, "Leistungen von Team Effertz GmbH");
  assert.ok(v.leistungen[0].woerter.includes("fliesen"));
  assert.deepEqual(v.standorte, [{ name: "Baesweiler", plz_praefixe: ["52"] }]);
  assert.equal(websiteFallback("Firma", "Unsere Leistungen.", "", ""), null);
});

test("automatische Firmenrecherche macht öffentliche Websuche mit begrenzten Aufrufen", () => {
  assert.equal(FIRMEN_WEB_SUCHTOOL.type, "web_search_20250305");
  assert.equal(FIRMEN_WEB_SUCHTOOL.max_uses, 3);
});

test("öffentliche Suchzusammenfassung und sichere Quellen bleiben im Profil getrennt", () => {
  const v = bereinigen({
    beschreibung: "", website_beschreibung: "Website-Leistungen.", websuche_beschreibung: "Ein Branchenprofil nennt Fliesen- und Natursteinarbeiten.",
    websuche_quellen: [{ titel: "Firmenprofil", url: "https://branchen.example/firma" }, { titel: "Unsicher", url: "javascript:alert(1)" }],
    leistungen: [{ name: "Fliesenarbeiten", cpv: [], woerter: ["fliesen", "naturstein"] }],
  });
  assert.equal(v.websuche_beschreibung, "Ein Branchenprofil nennt Fliesen- und Natursteinarbeiten.");
  assert.deepEqual(v.websuche_quellen, [{ titel: "Firmenprofil", url: "https://branchen.example/firma" }]);
  const html = profilFormular("firma", v, "");
  assert.match(html, /name="websuche_beschreibung"[^>]*>Ein Branchenprofil/);
  assert.match(html, /href="https:\/\/branchen\.example\/firma"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.equal(hatProfiltext(v), true, "öffentliche Suchinfos reichen auch ohne Website und eigene Beschreibung");
  assert.equal(hatProfiltext(bereinigen({ leistungen: v.leistungen })), false);
});

test("Suchprofilvorschlag blockiert leere Eingabe nicht unsichtbar im Browser", () => {
  const html = startFormular("firma", "", "", "", "Bitte beschreib deine Firma in ein paar Sätzen.");
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Bitte beschreib deine Firma in ein paar Sätzen/);
  assert.doesNotMatch(html, /textarea name="beschreibung"[^>]*(required|minlength)/);
});

test("Suchprofil zeigt einfache Berufs- und Ortsfelder; technische Suchwerte sind eingeklappt", () => {
  const html = profilFormular("firma", bereinigen({
    beschreibung: "Wir verlegen Fliesen in Badezimmern und Küchen.",
    leistungen: [{ name: "Fliesen verlegen", cpv: ["45431000"], woerter: ["fliesenarbeiten"] }],
    standorte: [{ name: "Bad Wildungen", plz_praefixe: ["34"] }],
  }), "Prüfe kurz, ob die Arbeiten und Einsatzorte stimmen.");
  assert.match(html, /Welche Arbeiten soll Jarvis für dich finden\?/);
  assert.match(html, /Beruf oder Arbeit/);
  assert.match(html, /Stadt oder Gegend/);
  assert.match(html, /<details data-arbeit-editor><summary>Arbeit und Suchbegriffe ändern<\/summary>/);
  assert.match(html, /formaction="\/konto\/einrichtung\/automatisch"/);
  assert.match(html, /Firmeninfos neu recherchieren/);
  assert.match(html, /Vergabe-Kennziffern \(CPV, optional\)/);
  assert.match(html, /Welche Aufträge soll Jarvis nicht anzeigen/);
});

test("ein Website-basiertes Suchprofil verlangt keine manuell eingetragene Firmenbeschreibung", () => {
  const html = profilFormular("firma", bereinigen({ website_beschreibung: "Fliesen, Badplanung, Naturstein", leistungen: [{ name: "Fliesenarbeiten", cpv: [], woerter: ["fliesen", "badplanung"] }] }), "");
  assert.match(html, /name="beschreibung"/);
  assert.doesNotMatch(html, /name="beschreibung"[^>]*(required|minlength)/);
  assert.match(html, /name="website_beschreibung"/);
});

test("form round trip keeps checked services and locations only", () => {
  const html = profilFormular("00000000-0000-0000-0000-000000000000", bereinigen({
    beschreibung: "Wir stellen Servicepersonal für Messen.",
    leistungen: [{ name: "Messepersonal", cpv: ["79620"], woerter: ["messepersonal", "hostess"] }],
    standorte: [{ name: "Köln", plz_praefixe: ["50"] }],
  }), "");
  const form = new FormData();
  for (const [, k, v] of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/g)) if (!/_an$/.test(k)) form.set(k, v);
  form.set("beschreibung", "Wir stellen Servicepersonal für Messen.");
  form.set("website_beschreibung", "Auf der Website: Messepersonal und Veranstaltungsschutz.");
  form.set("websuche_beschreibung", "Ein Branchenprofil nennt Messepersonal.");
  form.append("websuche_quellen", JSON.stringify({ titel: "Branchenprofil", url: "https://branchen.example/profil" }));
  form.set("l0_an", "1");
  form.set("l1_an", "1"); // the empty extra row is dropped
  const v = ausFormular(form);
  assert.deepEqual(v.leistungen, [{ name: "Messepersonal", cpv: ["79620"], woerter: ["messepersonal", "hostess"] }]);
  assert.deepEqual(v.standorte, []); // location not ticked
  assert.equal(v.website_beschreibung, "Auf der Website: Messepersonal und Veranstaltungsschutz.");
  assert.equal(v.websuche_beschreibung, "Ein Branchenprofil nennt Messepersonal.");
  assert.deepEqual(v.websuche_quellen, [{ titel: "Branchenprofil", url: "https://branchen.example/profil" }]);
});

test("Länder im Suchprofil: Deutschland als Standard, nur bekannte Länder, Auswahl im Formular", async () => {
  const { bereinigen, ausFormular, profilFormular } = await import("../src/einrichtung.ts");
  assert.deepEqual(bereinigen({}).laender, ["DEU"]);
  assert.deepEqual(bereinigen({ laender: ["AUT", "XXX", "AUT", "NLD"] }).laender, ["AUT", "NLD"]);
  const f = new FormData();
  f.set("beschreibung", "Personaldienstleister für Gastronomie und Logistik");
  f.append("laender", "DEU");
  f.append("laender", "AUT");
  assert.deepEqual(ausFormular(f).laender, ["DEU", "AUT"]);
  const html = profilFormular("f", bereinigen({ laender: ["DEU", "AUT"] }), "");
  assert.match(html, /value="AUT" checked/);
  assert.match(html, /<details open><summary>Nachbarländer/);
});
