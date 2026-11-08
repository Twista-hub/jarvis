import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import type { Eintrag } from "../src/stunden.ts";
import { istPrivat, mahnungDocx, neueEntwurfsnummer, positionen, rechnungDocx, rechnungenSeite, type Absender, type Rechnung } from "../src/rechnungen.ts";
import { lohnCsv, lohnExcel, lohnZeilen, stundennachweisDocx } from "../src/lohn.ts";
import { hm, zeitkonto, zeitkontoSeite } from "../src/zeitkonto.ts";
import { kmBetrag, meineSpesenTeil, spesenSeite, vmaBetrag, type Spese } from "../src/spesen.ts";
import { bzStufe, bzText } from "../src/aueg.ts";
import { abstandKm, auswerten, laufend, stempelTeil, type Stempel } from "../src/stempel.ts";
import { inhaltAus, oeffentlicheSeite } from "../src/kundenlink.ts";
import { gruppieren } from "../src/leistungsnachweis.ts";
import { pngAusDataUrl, unterschriftFeld } from "../src/unterschrift.ts";
import { offeneSchichtenTeil, type Schicht } from "../src/schichten.ts";
import { bild, wordDokument } from "../src/word.ts";
import { qrMatrix, qrSvg, fehlerkorrektur } from "../src/qr.ts";
import { auswahlSeite, ergebnisSeite, telefonWa } from "../src/kraefte.ts";
import { sprachWahl, uebersetzen } from "../src/sprache.ts";
import { anlaesse, teamKopfHtml } from "../src/teamkopf.ts";
import { akteAusFormular } from "../src/personalakte.ts";

const e = (id: string, datum: string, beginn: string, ende: string, pause_min: number, extra: Partial<Eintrag> = {}): Eintrag => ({ id, personal_id: "p1", datum, beginn: `${beginn}:00`, ende: `${ende}:00`, pause_min, einsatz: "Messe Halle 3", notiz: "", status: "freigegeben", kunde_id: "k1", ...extra });
const docText = (b: Uint8Array) => strFromU8(unzipSync(b)["word/document.xml"]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
// Smallest valid PNG (1×1) with padding so it passes the size check.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const pngGross = new Uint8Array(200); pngGross.set(PNG);
const dataUrl = (b: Uint8Array) => `data:image/png;base64,${btoa(String.fromCharCode(...b))}`;

test("T34: Positionen mit Zuschlägen, Nummernkreis, Word-Rechnung", () => {
  const l = [e("1", "2026-10-03", "06:00", "14:30", 30), e("2", "2026-10-04", "22:00", "06:00", 30), e("3", "2026-10-05", "07:00", "15:30", 30)];
  const p = positionen(l, { satz: 30, nacht: 25, sonntag: 50, feiertag: 100 }, "", "2026-10");
  assert.equal(p[0].menge, 23.5);
  assert.equal(p[0].betrag, 705);
  assert.ok(p.some((x) => x.text.startsWith("Nachtzuschlag 25") && x.preis === 7.5));
  assert.ok(p.some((x) => x.text.startsWith("Feiertagszuschlag 100")), "3.10. Tag der Deutschen Einheit");
  assert.equal(positionen(l, { satz: 30, nacht: 0, sonntag: 0, feiertag: 0 }, "", "2026-10").length, 1);
  // Numbers come from the database counter when issuing (migration 20261103110000); drafts carry a placeholder.
  assert.match(neueEntwurfsnummer(), /^ENTWURF-[0-9a-f]{8}$/);
  const r: Rechnung = { id: "r", kunde_id: "k1", nummer: "RE-2026-0008", monat: "2026-10", datum: "2026-11-02", positionen: p, netto: p.reduce((n, x) => n + x.betrag, 0), ust_satz: 19, erstellt: "" };
  const a: Absender = { name: "Muster GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg", telefon: "", email: "", steuernummer: "202/123/45678", ustid: "", kleinunternehmer: false, zahlungshinweis: "IBAN DE00 1234" };
  const t = docText(rechnungDocx(r, { id: "k1", name: "Messe Berlin GmbH", strasse: "Messedamm 22", plz: "14055", ort: "Berlin" } as never, a));
  for (const s of ["Rechnung RE-2026-0008", "Leistungszeitraum", "Oktober 2026", "Messe Berlin GmbH", "19 % Umsatzsteuer", "Steuernummer: 202/123/45678", "IBAN DE00 1234", "16.11.2026"]) assert.ok(t.includes(s), s);
  const klein = docText(rechnungDocx(r, null, { ...a, kleinunternehmer: true }));
  assert.ok(klein.includes("Kleinunternehmerregelung nach § 19 Abs. 1 UStG") && !klein.includes("zzgl."));
  assert.match(rechnungenSeite([r], [], { fehlt: ["Steuernummer"] }), /Steuernummer[\s\S]*RE-2026-0008/);
  // GoBD: an issued invoice prints the frozen sender and VAT, not today's profile; a draft has no number and no XML.
  const frei: Rechnung = { ...r, status: "ausgestellt", absender: { ...a, name: "Alte Firma GmbH", steuernummer: "111/111/11111" }, kleinunternehmer: false, ust_betrag: 99.99, empfaenger: { name: "Kunde damals" } };
  const t2 = docText(rechnungDocx(frei, { id: "k1", name: "Kunde heute" } as never, { ...a, kleinunternehmer: true, name: "Neue Firma" }));
  for (const s of ["Alte Firma GmbH", "111/111/11111", "Kunde damals", "99,99"]) assert.ok(t2.includes(s), s);
  assert.ok(!t2.includes("Neue Firma") && !t2.includes("Kunde heute"));
  const entwurf: Rechnung = { ...r, nummer: "ENTWURF-1234abcd", status: "entwurf" };
  const t3 = docText(rechnungDocx(entwurf, null, a));
  assert.ok(t3.includes("Rechnungsentwurf – nicht versenden") && !t3.includes("ENTWURF-1234abcd"));
  // Invoice template: logo, intro, closing text and footer lines end up in the document.
  const mitVorlage = rechnungDocx(r, null, a, { logo: { bytes: PNG, typ: "png" }, einleitung: "Vielen Dank für Ihren Auftrag.", schluss: "Mit freundlichen Grüßen", fuss: ["Geschäftsführer: Max Muster"] });
  const tv = docText(mitVorlage);
  for (const s of ["Vielen Dank für Ihren Auftrag.", "Mit freundlichen Grüßen", "Geschäftsführer: Max Muster"]) assert.ok(tv.includes(s), s);
  assert.ok(Object.keys(unzipSync(mitVorlage)).some((n) => n.startsWith("word/media/")), "Logo eingebettet");
  const liste = rechnungenSeite([entwurf, { ...frei, id: "r2" }, { ...frei, id: "r3", nummer: "RE-2026-0009", art: "storno", bezug_nummer: "RE-2026-0008" }], [], { fehlt: [] });
  assert.match(liste, /name="ausstellen"/);
  assert.match(liste, /name="stornieren"/);
  assert.match(liste, /Stornorechnung zu RE-2026-0008/);
  assert.match(liste, /r3\.xml/, "Stornos gibt es auch als E-Rechnung (Gutschrift 381)");
  assert.equal((liste.match(/name="loeschen"/g) ?? []).length, 1, "nur der Entwurf ist löschbar");
});

test("T35: Lohnliste mit Zuschlägen, Spesen, Zeitkonto; CSV sicher", () => {
  const personen = [{ id: "p1", vorname: "Eva", nachname: "Muster", personalnummer: "1001", status: "verfuegbar", wochenstunden: 40, eintritt: null }, { id: "p2", vorname: "=HYPERLINK(1)", nachname: "", personalnummer: "", status: "verfuegbar", wochenstunden: null, eintritt: null }, { id: "p3", vorname: "Leer", nachname: "Ohne", personalnummer: "", status: "verfuegbar", wochenstunden: 20, eintritt: null }];
  const st = [e("1", "2026-10-04", "22:00", "06:00", 30), e("2", "2026-10-05", "07:00", "15:30", 30), e("3", "2026-10-06", "07:00", "15:30", 30, { status: "erfasst" }), e("4", "2026-10-07", "07:00", "15:30", 30, { personal_id: "p2" })];
  const abw = [{ personal_id: "p1", von: "2026-10-12", bis: "2026-10-16", grund: "urlaub", status: "bestaetigt", kurzfristig: false }];
  const sp = [{ personal_id: "p1", betrag: 12.5, status: "freigegeben" }, { personal_id: "p1", betrag: 99, status: "erfasst" }];
  const z = lohnZeilen(personen as never, st, abw as never, sp as never, [{ personal_id: "p1", ab: "2026-10-01", startsaldo_min: 600 }], st, abw as never, "2026-10", "");
  assert.equal(z.length, 2, "ohne Stunden und Abwesenheit nicht in der Liste");
  const eva = z.find((x) => x.personalnummer === "1001")!;
  assert.equal(eva.stunden, 15.5 * 60);
  assert.equal(eva.urlaub, 5);
  assert.equal(eva.spesen, 12.5);
  assert.ok(eva.nacht > 0 && eva.sonntag > 0);
  assert.notEqual(eva.saldo, null);
  const csv = lohnCsv(z);
  assert.ok(csv.startsWith("﻿Personalnummer;Name;Stunden"));
  assert.match(csv, /;'=HYPERLINK\(1\);/, "Formel wird entschärft");
  assert.match(csv, /1001;Muster, Eva;15,5;/);
  const xl = unzipSync(lohnExcel(z, "2026-10"));
  assert.ok(Object.keys(xl).some((k) => k.startsWith("xl/worksheets/")));
});

test("T35/T39: Stundennachweis mit Unterschriftsbild", () => {
  const b = stundennachweisDocx("Muster GmbH", { vorname: "Eva", nachname: "Muster", personalnummer: "1001" }, [e("1", "2026-10-05", "07:00", "15:30", 30)], "2026-10", "", { png: PNG, am: "2026-11-02T10:00:00Z" });
  const z = unzipSync(b);
  assert.ok(z["word/media/bild1.png"] || Object.keys(z).some((k) => k.startsWith("word/media/")), "Bild eingebettet");
  assert.ok(strFromU8(z["word/_rels/document.xml.rels"]).includes("media/"));
  assert.ok(strFromU8(z["[Content_Types].xml"]).includes("image/png"));
  assert.match(docText(b), /Stundennachweis Oktober 2026[\s\S]*Eva Muster[\s\S]*8,00/);
  const ohne = unzipSync(stundennachweisDocx("F", { vorname: "A", nachname: "B" }, [], "2026-10", "", null));
  assert.ok(!Object.keys(ohne).some((k) => k.startsWith("word/media/")));
  const w = unzipSync(wordDokument(bild(1, 5, 2), [{ id: 1, png: PNG }]));
  assert.match(strFromU8(w["word/document.xml"]), /r:embed="rIdBild1"|r:embed="[^"]+"/);
});

test("T36: Spesen für Einsatzkraft und Büro", () => {
  const l: Spese[] = [{ id: "s1", personal_id: "p1", datum: "2026-10-30", art: "tanken", betrag: "48.9", notiz: "Fahrt <b>", beleg_mime: "image/jpeg", status: "erfasst" }, { id: "s2", personal_id: "p1", datum: "2026-10-26", art: "parken", betrag: 12, notiz: "", beleg_mime: null, status: "freigegeben" }];
  const m = meineSpesenTeil(l, "2026-11-01");
  assert.match(m, /Meine Spesen[\s\S]*48,90/);
  assert.doesNotMatch(m, /capture=/, "kein Kamera-Zwang, damit am Handy auch PDFs wählbar sind");
  assert.match(m, /<option value="km">🚗 Kilometergeld[\s\S]*<option value="vma">🍽️ Verpflegungspauschale/);
  assert.doesNotMatch(m, /name="betrag"[^>]*required/, "Betrag nicht Pflicht (bei Pauschalen ausgeblendet)");
  assert.ok(!m.includes("<b>"), "Notiz wird escaped");
  const b = spesenSeite(l, [{ id: "p1", vorname: "Eva", nachname: "Muster" }] as never, { monat: "2026-10", darfAendern: true });
  assert.match(b, /name="id" value="s1"/);
  assert.doesNotMatch(b, /name="id" value="s2"/, "freigegebene nicht mehr auswählbar");
  assert.match(b, /ohne Beleg/);
});

test("T37: Arbeitszeitkonto Soll/Ist ohne Feiertage und Urlaub", () => {
  const p = { id: "p1", vorname: "Eva", nachname: "Muster", status: "verfuegbar", wochenstunden: 40, eintritt: "2020-01-01" };
  // Oktober 2026: 22 Arbeitstage Mo–Fr, 3.10. ist Samstag → 22 × 8 h Soll; 5 Tage Urlaub → 17 × 8 h.
  const m = zeitkonto(p, { personal_id: "p1", ab: "2026-10-01", startsaldo_min: 120 }, [e("1", "2026-10-05", "07:00", "15:30", 30), e("2", "2026-10-06", "07:00", "17:30", 30), e("3", "2026-10-07", "07:00", "15:30", 30, { status: "erfasst" })], [{ personal_id: "p1", von: "2026-10-12", bis: "2026-10-16", status: "bestaetigt" }], "", "2026-10-31");
  assert.equal(m.length, 1);
  assert.equal(m[0].soll, 17 * 480);
  assert.equal(m[0].ist, 18 * 60);
  assert.equal(m[0].stand, 120 + 18 * 60 - 17 * 480);
  assert.equal(hm(-135), "−2:15");
  assert.equal(hm(90), "+1:30");
  // Without a start date the account begins with the first time sheet, not with the joining date in 2020.
  const ohne = zeitkonto(p, undefined, [e("1", "2026-10-30", "07:00", "15:30", 30)], [], "", "2026-10-31");
  assert.equal(ohne[0].monat, "2026-10");
  assert.equal(ohne[0].soll, 480);
  assert.equal(zeitkonto({ ...p, wochenstunden: null }, undefined, [], [], "", "2026-10-31").length, 0);
  const html = zeitkontoSeite([p, { ...p, id: "p2", vorname: "Max", wochenstunden: null }], [], [], [], { land: "", heute: "2026-11-01", darfAendern: true });
  assert.match(html, /Ohne Wochenstunden[\s\S]*Max/);
  assert.doesNotMatch(html, /Werktag/);
});

test("T38: Branchenzuschlag-Stufen mit Unterbrechung", () => {
  const pr = [15, 20, 30, 45, 50];
  assert.equal(bzStufe({ beginn: "2026-01-01", unterbrechungTage: 0 }, "2026-02-11", pr)!.stufe, 0);
  const s1 = bzStufe({ beginn: "2026-01-01", unterbrechungTage: 0 }, "2026-02-12", pr)!;
  assert.deepEqual([s1.stufe, s1.prozent, s1.naechste?.datum], [1, 15, "2026-04-01"]);
  assert.equal(bzStufe({ beginn: "2026-01-01", unterbrechungTage: 10 }, "2026-02-12", pr)!.stufe, 0, "Unterbrechung verschiebt");
  const s5 = bzStufe({ beginn: "2025-01-01", unterbrechungTage: 0 }, "2026-11-01", pr)!;
  assert.deepEqual([s5.stufe, s5.prozent, s5.naechste], [5, 50, null]);
  assert.match(bzText(s5), /50 % seit 1\.10\.2025 \(höchste Stufe\)/);
  assert.equal(bzStufe({ beginn: "2026-01-01", unterbrechungTage: 0 }, "2026-11-01", []), null);
});

test("T39: Unterschrift nur als echtes, kleines PNG", () => {
  assert.ok(pngAusDataUrl(dataUrl(pngGross)));
  assert.equal(pngAusDataUrl(dataUrl(PNG.slice(0, 50))), null, "zu klein");
  assert.equal(pngAusDataUrl("data:image/png;base64," + btoa("GIF89a" + "x".repeat(200))), null);
  assert.equal(pngAusDataUrl("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(pngAusDataUrl("data:image/png;base64," + "A".repeat(400_004)), null);
  const f = unterschriftFeld("u", { pflicht: true });
  assert.match(f, /canvas data-unterschrift="u" data-pflicht/);
  assert.match(f, /type="hidden" name="u"/);
});

test("T40: eingefrorener Inhalt und Kundenseite", () => {
  const l = [e("1", "2026-10-03", "06:00", "14:30", 30), e("2", "2026-10-04", "07:00", "15:30", 30, { personal_id: "p2" }), e("3", "2026-10-05", "07:00", "15:30", 30, { status: "erfasst" })];
  const g = gruppieren(l, [{ id: "k1", name: "Messe Berlin GmbH" } as never])[0];
  const i = inhaltAus(g, [{ id: "p1", vorname: "Eva", nachname: "Muster" }, { id: "p2", vorname: "Max", nachname: "<Koch>" }], "2026-10", "");
  assert.equal(i.zeilen.length, 2, "nur freigegebene");
  assert.equal(i.summe.std, 16);
  assert.ok(i.summe.feiertag > 0 && i.summe.sonntag > 0);
  const d = { firma: "Perlease GmbH", titel: "Messe Berlin GmbH", monat: "2026-10", inhalt: i, bestaetigt_am: null, bestaetigt_name: "", rueckfrage: false, abgelaufen: false };
  const s = oeffentlicheSeite(d, "tok_123");
  assert.match(s, /action="\/nachweis\/tok_123"/);
  assert.match(s, /name="aktion" value="frage"/);
  assert.ok(s.includes("Koch") && !s.includes("<Koch>"));
  assert.doesNotMatch(oeffentlicheSeite({ ...d, bestaetigt_am: "2026-11-01T09:00:00Z", bestaetigt_name: "S. Meier" }, "tok_123"), /<form/);
  assert.match(oeffentlicheSeite({ ...d, abgelaufen: true }, "tok_123"), /abgelaufen/);
});

test("T41: Stempeluhr wertet Pausen aus", () => {
  const z = (art: string, iso: string): Stempel => ({ art, zeit: iso, einsatz: "Kantine", am_ort: true });
  const lauf = [z("kommen", "2026-11-02T06:00:00Z"), z("pause", "2026-11-02T09:00:00Z"), z("weiter", "2026-11-02T09:30:00Z")];
  assert.equal(laufend(lauf).length, 3);
  assert.equal(laufend([...lauf, z("gehen", "2026-11-02T14:00:00Z")]).length, 0);
  const r = auswerten(lauf, "2026-11-02T14:30:00Z")!;
  assert.deepEqual([r.datum, r.beginn, r.ende, r.pause_min, r.einsatz, r.am_ort], ["2026-11-02", "07:00", "15:30", 30, "Kantine", true]);
  assert.equal(auswerten([z("kommen", "2026-11-01T06:00:00Z")], "2026-11-02T07:00:00Z"), null, "A-M7: over 16 h is not turned into a time sheet");
  assert.equal(auswerten([z("kommen", "2026-11-02T06:00:00Z"), z("pause", "2026-11-02T10:00:00Z")], "2026-11-02T10:45:00Z")!.pause_min, 45, "offene Pause endet bei Gehen");
  assert.equal(auswerten([z("kommen", "2026-11-02T06:00:00Z")], "2026-11-02T06:00:30Z"), null);
  const km = abstandKm(52.52, 13.405, "10117");
  assert.ok(km !== null && km < 5, String(km));
  assert.equal(abstandKm(52.52, 13.405, "00000"), null);
  assert.match(stempelTeil([], ["Kantine"], "2026-11-02T06:00:00Z"), /value="kommen"[\s\S]*data-standort|data-standort[\s\S]*value="kommen"/);
  assert.match(stempelTeil(lauf, [], "2026-11-02T10:00:00Z"), /value="pause"[\s\S]*value="gehen"/);
  assert.match(stempelTeil([z("kommen", "2026-11-01T06:00:00Z")], [], "2026-11-02T10:00:00Z"), /nicht ausgestempelt[\s\S]*value="neu"/);
});

test("T42: Übersetzung der Mitarbeiter-Seite", () => {
  const s = `<!doctype html><html lang="de"><head><style>.Pause{}</style></head><body><h3>📅 Meine Schichten</h3><button name="stempel" value="pause">☕ Pause</button><input placeholder="z. B. Auto kaputt, Zug fällt aus"><p>Urlaub &amp; Abwesenheit · Wochenende</p><textarea>Pause</textarea></body></html>`;
  const en = uebersetzen(s, "en");
  assert.match(en, /<h3>📅 My shifts<\/h3>/);
  assert.match(en, /value="pause">☕ Break</, "Werte bleiben, Text wird übersetzt");
  assert.match(en, /placeholder="e.g. car broke down, train cancelled"/);
  assert.match(en, /Leave (&amp;|&#38;) absence · Wochenende/, "keine Teilwörter (Wochenende ≠ Ende)");
  assert.match(en, /<style>\.Pause\{\}<\/style>/);
  assert.match(en, /<textarea>Pause<\/textarea>/);
  assert.match(uebersetzen(s, "ar"), /<html lang="ar" dir="rtl">/);
  assert.equal(uebersetzen(s, "de"), s);
  assert.equal(uebersetzen(s, "xx"), s);
  assert.match(uebersetzen("<p>Meine Einsätze &#38; Daten</p>", "pl"), /Moje zlecenia i dane/);
  for (const l of ["en", "pl", "ro", "tr", "uk", "ar"]) assert.doesNotMatch(uebersetzen("<p>Meine Stunden</p>", l), /Meine Stunden/, l);
  assert.match(sprachWahl("tr"), /href="\/konto\/ich\?sprache=tr" lang="tr" aria-current="true"/);
});

test("T43: QR-Code, Telefonnummern, Einladungsseiten", () => {
  assert.deepEqual(fehlerkorrektur([0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11], 10), [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55], "Beispiel aus ISO 18004 (01234567, 1-M)");
  const m = qrMatrix("https://app.wpdigitalranger.com/einladung?token=" + "x".repeat(32))!;
  assert.equal(m.length, 37, "Version 5");
  assert.ok(m[0][0] && m[0][6] && !m[1][1] && m[2][2], "Finder oben links");
  assert.equal(m[m.length - 8][8], true, "dunkles Modul");
  assert.equal(qrMatrix("x".repeat(300)), null);
  assert.match(qrSvg("abc"), /^<svg class="qr"[^>]*viewBox="0 0 29 29"/);
  assert.equal(telefonWa("0171 123 45 67"), "491711234567");
  assert.equal(telefonWa("+49 (160) 555"), "49160555");
  assert.equal(telefonWa("0043 660 1"), "436601");
  assert.equal(telefonWa(""), "");
  const k = [{ id: "a", vorname: "Max", nachname: "Koch", telefon: "0171", email: "", bereich_id: null, status: "verfuegbar", user_id: null }, { id: "b", vorname: "Eva", nachname: "M", telefon: "", email: "", bereich_id: null, status: "verfuegbar", user_id: "u" }, { id: "c", vorname: "Ina", nachname: "Alt", telefon: "", email: "", bereich_id: null, status: "nicht", user_id: null }, { id: "d", vorname: "Tom", nachname: "W", telefon: "", email: "", bereich_id: null, status: "verfuegbar", user_id: null }];
  const a = auswahlSeite(k, [{ personal_id: "d", gueltig_bis: "2026-11-10T00:00:00Z" }]);
  assert.match(a, /value="a" checked/);
  assert.match(a, /value="d">/, "offener Link nicht vorausgewählt");
  assert.doesNotMatch(a, /value="b"|value="c"/, "mit Zugang oder ausgeschieden fehlt");
  const r = ergebnisSeite([{ name: "Max Koch", telefon: "0171 1234567", link: "https://x.test/einladung?token=abc" }], "Muster GmbH");
  assert.match(r, /https:\/\/wa\.me\/491711234567\?text=Hallo%20Max/);
  assert.match(r, /href="sms:\+491711234567\?&amp;body=|href="sms:\+491711234567\?&body=/);
  assert.match(r, /<svg class="qr"/);
  assert.match(r, /data-drucken/);
});

test("T44: offene Schichten zum Übernehmen", () => {
  assert.equal(offeneSchichtenTeil([]), "");
  const s = offeneSchichtenTeil([{ id: "s1", personal_id: null, bereich_id: null, datum: "2026-11-03", beginn: "06:00:00", ende: "14:30:00", ort: "Kantine", notiz: "", antwort: null, beruf: "Koch/Köchin" } as unknown as Schicht]);
  assert.match(s, /id="offen"[\s\S]*Kantine · Koch\/Köchin/);
  assert.match(s, /name="aktion" value="uebernehmen"><input type="hidden" name="id" value="s1">/);
});

test("T45: Geburtstage und Jubiläen, Personalnummer", () => {
  const p = [
    { vorname: "Max", nachname: "Koch", geburtstag: "1990-11-03", eintritt: null },
    { vorname: "Aylin", nachname: "Kaya", geburtstag: null, eintritt: "2021-11-01" },
    { vorname: "Tom", nachname: "W", geburtstag: null, eintritt: "2023-11-02" },
    { vorname: "Lea", nachname: "Wolf", geburtstag: "1988-02-29", eintritt: "2025-11-05" },
    { vorname: "Alt", nachname: "Weg", status: "nicht", geburtstag: "1970-11-02", eintritt: null },
    { vorname: "Neu", nachname: "Heute", geburtstag: null, eintritt: "2026-11-01" },
  ];
  const a = anlaesse(p, "2026-11-01");
  assert.deepEqual(a.map((x) => `${x.name}:${x.art}:${x.jahre}:${x.tag}`), ["Aylin Kaya:jubilaeum:5:2026-11-01", "Max Koch:geburtstag:36:2026-11-03", "Lea Wolf:jubilaeum:1:2026-11-05"], "3 Jahre ist kein Jubiläum; Eintritt heute zählt nicht");
  assert.deepEqual(anlaesse([{ vorname: "Lea", nachname: "W", geburtstag: "1988-02-29" }], "2027-02-25").map((x) => x.tag), ["2027-02-28"]);
  assert.deepEqual(anlaesse([{ vorname: "Sil", nachname: "V", geburtstag: "1990-01-02" }], "2026-12-30").map((x) => x.tag), ["2027-01-02"]);
  const h = teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false, spesen: 2, rueckfragen: 1, anlaesse: a }, false, true, { finanzen: true, heute: "2026-11-01" });
  assert.match(h, /🎉 Aylin Kaya: 5 Jahre dabei \(heute\)/);
  assert.match(h, /🎂 Max Koch hat Di\., 03\.11\. Geburtstag/);
  assert.match(h, /2 Spesenbelege warten/);
  assert.match(h, /1 Rückfrage von Kunden/);
  assert.match(h, /href="\/konto\/rechnungen"/);
  assert.match(h, /href="\/konto\/kraefte-einladen"/);
  assert.doesNotMatch(teamKopfHtml({ nachweiseAbgelaufen: 0, nachweiseBald: 0, zertifikate: 0, unterweisungen: 0, profilFehlt: false }, false, false, { finanzen: false }), /\/konto\/rechnungen|kraefte-einladen/);
  const f = new FormData(); f.set("personalnummer", "  P-0042  "); f.set("geburtstag", "1990-02-30");
  assert.deepEqual([akteAusFormular(f).personalnummer, akteAusFormular(f).geburtstag], ["P-0042", null]);
});

test("§ 13b: Rechnung ohne Umsatzsteuer mit Pflichthinweis, XRechnung Kategorie AE", async () => {
  const { xrechnungXml } = await import("../src/xrechnung.ts");
  const p = [{ text: "Unterhaltsreinigung", menge: 10, einheit: "Std.", preis: 30, betrag: 300 }];
  const a: Absender = { name: "Muster GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg", telefon: "", email: "info@muster.invalid", steuernummer: "202/123/45678", ustid: "", kleinunternehmer: false, zahlungshinweis: "IBAN DE00 1234" };
  const r: Rechnung = { id: "r", kunde_id: "k", nummer: "RE-2026-0010", monat: "2026-10", datum: "2026-11-02", positionen: p, netto: 300, ust_satz: 0, erstellt: "", status: "ausgestellt", absender: a, empfaenger: { name: "Reinigung Partner GmbH", strasse: "Weg 1", plz: "50667", ort: "Köln", ustid: "DE111222333" }, kleinunternehmer: false, ust_betrag: 0, reverse_charge: true };
  const t = docText(rechnungDocx(r, null, a));
  assert.ok(t.includes("Steuerschuldnerschaft des Leistungsempfängers") && t.includes("DE111222333") && !t.includes("Umsatzsteuer300"));
  assert.ok(!t.includes("zzgl."));
  const x = xrechnungXml(r, { id: "k", name: "Reinigung Partner GmbH", strasse: "Weg 1", plz: "50667", ort: "Köln" } as never, a);
  assert.match(x, /<cbc:ID>AE<\/cbc:ID>/);
  assert.match(x, /VATEX-EU-AE/);
  assert.match(x, /<cbc:CompanyID>DE111222333<\/cbc:CompanyID>/);
});

test("S17: Privatkunden – Aufbewahrungshinweis auf der Rechnung (eingefroren), Verbraucher-Verzugszins in der 2. Mahnung", () => {
  const a: Absender = { name: "Muster GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg", telefon: "", email: "", steuernummer: "202/123/45678", ustid: "", kleinunternehmer: false, zahlungshinweis: "" };
  const pos = [{ text: "Fensterreinigung", menge: 4, einheit: "Std.", preis: 30, betrag: 120 }];
  const entwurf: Rechnung = { id: "r", kunde_id: "k", nummer: "ENTWURF-1", monat: "2026-10", datum: "2026-11-02", positionen: pos, netto: 120, ust_satz: 19, erstellt: "", status: "entwurf" };
  const privat = { id: "k", name: "Erika Muster", strasse: "Weg 1", plz: "52062", ort: "Aachen", privat: true } as never;
  assert.match(docText(rechnungDocx(entwurf, privat, a)), /zwei Jahre lang aufzubewahren\..*§ 14b Abs\. 1 Satz 5 UStG/);
  assert.doesNotMatch(docText(rechnungDocx(entwurf, { ...(privat as object), privat: false } as never, a)), /aufzubewahren/);
  // Issued: the frozen recipient decides, not today's customer setting.
  const aus: Rechnung = { ...entwurf, status: "ausgestellt", nummer: "RE-2026-0009", absender: a, empfaenger: { name: "Erika Muster", privat: true }, ust_betrag: 22.8 };
  assert.match(docText(rechnungDocx(aus, { ...(privat as object), privat: false } as never, a)), /aufzubewahren/);
  assert.doesNotMatch(docText(rechnungDocx({ ...aus, empfaenger: { name: "Firma GmbH" } }, privat, a)), /aufzubewahren/);
  assert.equal(istPrivat({ ...aus, empfaenger: { name: "x", privat: true } }, null), true);
  const m2 = docText(mahnungDocx({ ...aus, mahnstufe: 3 }, privat, a, "2026-12-20"));
  assert.match(m2, /5 Prozentpunkten über dem Basiszinssatz \(§ 288 Abs\. 1 BGB\)/);
  assert.doesNotMatch(m2, /40 €/);
  assert.match(m2, /Guten Tag Erika Muster,/);
  const m2Firma = docText(mahnungDocx({ ...aus, mahnstufe: 3, empfaenger: { name: "Firma GmbH" } }, null, a, "2026-12-20"));
  assert.match(m2Firma, /9 Prozentpunkte .*40 €/);
});

test("S19: Kilometergeld und Verpflegungspauschale, getrennt in der Lohnliste", () => {
  assert.equal(kmBetrag(42), 12.6);
  assert.equal(kmBetrag(12.5), 3.75);
  assert.deepEqual([vmaBetrag("8h", 0), vmaBetrag("an_ab", 0), vmaBetrag("24h", 0)], [14, 14, 28]);
  assert.equal(vmaBetrag("24h", 1), 22.4, "Frühstück − 5,60");
  assert.equal(vmaBetrag("24h", 2 | 4), 5.6, "Mittag und Abend je − 11,20");
  assert.equal(vmaBetrag("8h", 1 | 2), 0, "nie unter 0");
  const personen = [{ id: "p1", vorname: "Eva", nachname: "Muster", personalnummer: "1001", status: "verfuegbar", wochenstunden: 40, eintritt: null }];
  const sp = [{ personal_id: "p1", betrag: 12.5, status: "freigegeben", art: "parken" }, { personal_id: "p1", betrag: 14, status: "freigegeben", art: "vma" },
    { personal_id: "p1", betrag: 12.6, status: "freigegeben", art: "km" }, { personal_id: "p1", betrag: 28, status: "erfasst", art: "vma" }];
  const z = lohnZeilen(personen as never, [], [], sp as never, [], [], [], "2026-10", "");
  assert.deepEqual([z[0].spesen, z[0].vma, z[0].km], [12.5, 14, 12.6], "nur freigegebene, je Lohnart getrennt");
  const csv = lohnCsv(z);
  assert.match(csv, /Auslagen mit Beleg \(€\);Verpflegungspauschale \(€\);Kilometergeld \(€\)/);
  assert.match(csv, /;12,5;14;12,6;/);
});

test("Reverse Charge EU auf der Rechnung: Hinweis und beide USt-IdNrn.", () => {
  const a: Absender = { name: "Muster GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg", telefon: "", email: "", steuernummer: "", ustid: "DE123456789", kleinunternehmer: false, zahlungshinweis: "" };
  const r: Rechnung = { id: "r", kunde_id: "k", nummer: "RE-2026-0010", monat: "2026-10", datum: "2026-11-02", positionen: [{ text: "Personal", menge: 10, einheit: "Std.", preis: 30, betrag: 300 }], netto: 300, ust_satz: 0, erstellt: "", status: "ausgestellt",
    absender: a, empfaenger: { name: "Wien GmbH", land: "AT", ustid: "ATU12345678" }, ust_betrag: 0, reverse_charge: true, reverse_charge_eu: true };
  const t = docText(rechnungDocx(r, null, a));
  assert.match(t, /Reverse charge \(Art\. 196 MwStSystRL\)\. USt-IdNr\. des Leistungsempfängers: ATU12345678 · Unsere USt-IdNr\.: DE123456789/);
  assert.match(t, /Österreich/);
  assert.doesNotMatch(t, /zzgl\. 19/);
});

test("S16: Leistungstext je Kunde mit Monat", () => {
  const l = [e("1", "2026-10-06", "07:00", "15:30", 30)];
  assert.equal(positionen(l, { satz: 30, nacht: 0, sonntag: 0, feiertag: 0, text: "Unterhaltsreinigung  Objekt Hauptstraße" }, "", "2026-10")[0].text, "Unterhaltsreinigung Objekt Hauptstraße Oktober 2026");
  assert.equal(positionen(l, { satz: 30, nacht: 0, sonntag: 0, feiertag: 0, text: "" }, "", "2026-10")[0].text, "Leistungen Oktober 2026 lt. Leistungsnachweis");
});
