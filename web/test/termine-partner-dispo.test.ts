import assert from "node:assert/strict";
import { test } from "node:test";
import { fragenText, termineSeite, type Frage, type Termin } from "../src/termine.ts";
import { anfrageMail, gewerkeAus, partnerSeite, partnerTeilHtml, type Anfrage, type Partner } from "../src/partner.ts";
import { belegung, dispositionSeite, kalenderwoche, montag, wochentage, type Person } from "../src/disposition.ts";
import { fristenSeite } from "../src/fristen.ts";

const frage = (id: string, status: Frage["status"], text: string, antwort = ""): Frage => ({ id, frage: text, status, gestellt_am: status === "offen" ? null : "2026-11-02", antwort, erstellt: "2026-11-01T10:00:00Z" });

test("N10: Termine mit Fristen, Bieterfragen und Text fürs Portal", () => {
  const jetzt = Date.parse("2026-11-01T10:00:00Z");
  const termine: Termin[] = [{ id: "t1000000-0000-4000-8000-000000000001", titel: "Ortsbesichtigung", zeit: "2026-11-03T08:00:00Z", art: "besichtigung", ort: "Pforte <Nord>", notiz: "Anmeldung nötig" }];
  const fragen = [frage("f1", "offen", "Sind Zuschläge enthalten?"), frage("f2", "beantwortet", "Gibt es Lose?", "Ja, zwei."), frage("f3", "offen", "Wer stellt Kleidung?")];
  const html = termineSeite({ id: "v1", frist: "2026-11-20T10:00:00Z", fragefrist: "2026-11-03T12:00:00Z" }, termine, fragen, { darfAendern: true, jetzt });
  assert.ok(html.indexOf("Ortsbesichtigung") < html.indexOf("Frist für Bieterfragen") && html.indexOf("Frist für Bieterfragen") < html.indexOf("Angebotsfrist"), "nach Zeit sortiert");
  assert.match(html, /🏗️/);
  assert.match(html, /Pforte &#60;Nord&#62;|Pforte &lt;Nord&gt;/);
  assert.match(html, /2 Fragen sind noch nicht gestellt/);
  assert.match(html, /↳ Ja, zwei\./);
  assert.match(html, /name="weiter" value="\/konto\/vorgang\/v1#termine"/);
  assert.equal(fragenText(fragen), "1. Sind Zuschläge enthalten?\n\n2. Wer stellt Kleidung?");
  assert.doesNotMatch(termineSeite({ id: "v1", frist: null }, termine, fragen, { darfAendern: false, jetzt }), /<form/);
  const fr = fristenSeite([{ id: "t1", titel: "Ortsbesichtigung", frist: "2026-11-03T08:00:00Z", status: "neu", art: "eigen", terminart: "besichtigung", ort: "Halle 7" }], { eigene: [], abo: "", terminForm: "", tag: "", erledigte: false, monat: "2026-11", zustaendig: () => "", kalkuliert: new Set() } as any);
  assert.match(fr, /🏗️ Ortsbesichtigung/);
  assert.match(fr, /📍 Halle 7/);
});

const partner = (id: string, name: string, gewerke: string[], extra: Partial<Partner> = {}): Partner => ({ id, name, gewerke, ansprechpartner: "", telefon: "", email: "", region: "", bewertung: null, notiz: "", ...extra });

test("N11: Partner, Gewerke, Anfragen mit Mail und Preisen nur mit Finanzfreigabe", () => {
  assert.deepEqual(gewerkeAus("Elektro, Sanitär;elektro ;  ;Heizung\nElektro"), ["Elektro", "Sanitär", "elektro", "Heizung"]);
  const liste = [partner("p1", "Elektro Kaya", ["Elektro"], { bewertung: 4, region: "Aachen", email: "info@kaya.de", ansprechpartner: "Herr Kaya" }), partner("p2", "Fliesen Schmitz", ["Fliesen", "Sanitär"])];
  const seite = partnerSeite(liste, { darfAendern: true, gewerk: "Fliesen", q: "", anzahl: new Map([["p1", 2]]) });
  assert.match(seite, /Fliesen Schmitz/);
  assert.doesNotMatch(seite, /<strong>Elektro Kaya/);
  assert.match(partnerSeite(liste, { darfAendern: true, gewerk: "", q: "aachen", anzahl: new Map([["p1", 2]]) }), /★★★★☆[\s\S]*2 Anfragen/);
  const mail = anfrageMail(liste[0], { titel: "Kita Sanierung", frist: "2026-11-20T10:00:00Z" }, "Los 2 Elektro", "Bau GmbH");
  assert.match(mail, /^mailto:info%40kaya\.de\?subject=Anfrage%20Nachunternehmerleistung/);
  assert.match(decodeURIComponent(mail), /Guten Tag Herr Kaya[\s\S]*Los 2 Elektro[\s\S]*20\.11\.2026[\s\S]*Bau GmbH/);
  const anfragen: Anfrage[] = [{ id: "a1", partner_id: "p1", los: "Los 2", status: "angefragt", notiz: "", erstellt: "" }, { id: "a2", partner_id: "p2", los: "", status: "zugesagt", notiz: "fest", erstellt: "" }];
  const v = { id: "v1", titel: "Kita", frist: null };
  const mitGeld = partnerTeilHtml(v, liste, anfragen, { preise: new Map([["a2", 12500]]), darfAendern: true, firma: "Bau GmbH" });
  assert.match(mitGeld, /2 angefragt · 1 zugesagt/);
  assert.match(mitGeld, /12\.500/);
  assert.match(mitGeld, /href="mailto:/);
  assert.match(mitGeld, /name="preis"/);
  const ohneGeld = partnerTeilHtml(v, liste, anfragen, { preise: null, darfAendern: true, firma: "Bau GmbH" });
  assert.doesNotMatch(ohneGeld, /12\.500|name="preis"/);
  assert.match(partnerTeilHtml(v, [], [], { preise: null, darfAendern: true, firma: "" }), /Partner eintragen/);
});

const person = (id: string, vorname: string, extra: Partial<Person> = {}): Person => ({ id, vorname, nachname: "", berufe: ["Servicekraft"], bereich_id: null, status: "verfuegbar", ...extra });

test("N12: Woche, Belegung und Tafel", () => {
  assert.equal(montag("2026-11-01"), "2026-10-26"); // Sonntag gehört zur Woche davor
  assert.equal(montag("2026-11-04"), "2026-11-02");
  assert.equal(kalenderwoche("2026-11-02"), 45);
  assert.equal(kalenderwoche("2027-01-01"), 53);
  const tage = wochentage("2026-11-02");
  assert.equal(tage[6], "2026-11-08");
  const leute = [person("a", "Eva"), person("b", "Max", { berufe: ["Koch"] }), person("c", "Lea"), person("d", "Tom", { status: "nicht" })];
  const b = belegung(leute, [{ id: "u1", personal_id: "a", entleiher: "Messe Frankfurt", von: "2026-11-03", bis: "2026-11-05" }],
    [{ personal_id: "a", von: "2026-11-05", bis: "2026-11-06", grund: "urlaub" }],
    [{ personal_id: "b", vorgang_id: "v", titel: "Kantine Bundesbank", beginn: "2026-11-04", ende: null }], tage);
  assert.deepEqual(b.get("a")!.map((z) => z.art), ["frei", "einsatz", "einsatz", "abwesend", "abwesend", "frei", "frei"]);
  assert.equal(b.get("a")![1].text, "Messe Frankfurt");
  assert.deepEqual(b.get("b")!.map((z) => z.art).slice(0, 4), ["frei", "frei", "einsatz", "einsatz"]);
  assert.ok(b.get("c")!.every((z) => z.art === "frei"));
  assert.ok(b.get("d")!.every((z) => z.art === "nicht"));
  const opts = { montag: "2026-11-02", heute: "2026-11-04", filter: "", beruf: "", standort: "", standorte: [], darfAendern: true, kunden: ["Messe Frankfurt"] };
  const html = dispositionSeite(leute, b, opts);
  assert.match(html, /KW 45/);
  assert.match(html, /<strong>2<\/strong><span>im Einsatz diese Woche/);
  assert.match(html, /<strong>1<\/strong><span>frei Mo–Fr<br>1 frei heute/);
  assert.match(html, /title="Di 2026-11-03: Messe Frankfurt">Messe</);
  assert.match(html, /woche=2026-10-26/);
  assert.match(html, /🟢 Lea/);
  const frei = dispositionSeite(leute, b, { ...opts, filter: "frei" });
  assert.match(frei, /<strong>Lea<\/strong>/);
  assert.doesNotMatch(frei, /<strong>Eva<\/strong>/);
  assert.doesNotMatch(dispositionSeite(leute, b, { ...opts, darfAendern: false }), /Einsatz eintragen/);
  assert.match(dispositionSeite([], new Map(), opts), /Noch kein Personal/);
});
