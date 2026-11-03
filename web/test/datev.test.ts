import test from "node:test";
import assert from "node:assert/strict";
import { buchungenAus, buchungsstapel, cp1252, fehltDatev, lodasDatei, type DatevEinstellung } from "../src/datev.ts";
import { datevTeil } from "../src/belege.ts";
import type { Beleg } from "../src/belege.ts";

const belege: Beleg[] = [
  { id: "11111111-aaaa", datum: "2026-11-03", lieferant: "Aral „Tankstelle“ – Süd", kategorie: "fahrzeug", brutto: "119.00", ust_satz: 19, notiz: "Diesel", beleg_mime: null },
  { id: "22222222-bbbb", datum: "2026-11-05", lieferant: "Würth", kategorie: "material", brutto: 10.7, ust_satz: 7, notiz: "", beleg_mime: null },
  { id: "33333333-cccc", datum: "2026-11-30", lieferant: "Versicherung; AG", kategorie: "versicherung", brutto: 50, ust_satz: 0, notiz: "", beleg_mime: null },
];
const rechnungen = [{ nummer: "RE-2026-0001", datum: "2026-11-02", netto: "1000.00", ust_satz: 19 }];
const e: DatevEinstellung = { berater: "1234567", mandant: "42", skr: "03", wjBeginn: 1, kleinunternehmer: false };

/** Simple CSV split for semicolons and quoted fields ("" escapes). */
const felder = (zeile: string) => { const out: { v: string; q: boolean }[] = []; let i = 0; while (i <= zeile.length) { if (zeile[i] === '"') { let v = ""; i++; while (i < zeile.length) { if (zeile[i] === '"' && zeile[i + 1] === '"') { v += '"'; i += 2; } else if (zeile[i] === '"') { i++; break; } else v += zeile[i++]; } out.push({ v, q: true }); i++; } else { const j = zeile.indexOf(";", i); const end = j < 0 ? zeile.length : j; out.push({ v: zeile.slice(i, end), q: false }); i = end + 1; } if (i > zeile.length) break; } return out; };

// Rules of the DATEV-Format (EXTF 700, Buchungsstapel 13) as listed in the MIT validator seamless-engineering/datev-extf.
function pruefe(text: string) {
  const [kopf, spalten, ...zeilen] = text.replace(/\r\n$/, "").split("\r\n");
  const h = felder(kopf);
  assert.equal(h.length, 31, "31 Kopffelder");
  assert.deepEqual([h[0].v, h[1].v, h[2].v, h[3].v, h[4].v], ["EXTF", "700", "21", "Buchungsstapel", "13"]);
  assert.match(h[5].v, /^20\d{15}$/, "Erzeugt am");
  assert.ok(/^\d{4,7}$/.test(h[10].v) && Number(h[10].v) >= 1001, "Berater");
  assert.ok(/^\d{1,5}$/.test(h[11].v) && Number(h[11].v) >= 1, "Mandant");
  assert.match(h[12].v, /^20\d{2}(0[1-9]|1[0-2])01$/, "WJ-Beginn");
  assert.match(h[13].v, /^[4-8]$/, "Sachkontenlänge");
  assert.ok(h[14].v <= h[15].v && h[14].v.slice(0, 4) === h[15].v.slice(0, 4) && h[14].v >= h[12].v, "Datum von/bis im Jahr und nach WJ-Beginn");
  assert.ok(["", "0", "1"].includes(h[20].v) && h[21].v === "EUR" && /^\d{2}$/.test(h[26].v));
  for (const i of [0, 3, 7, 8, 9, 16, 17, 21, 23, 26, 30]) assert.ok(h[i].q, `Kopffeld ${i + 1} in Anführungszeichen`);
  assert.equal(felder(spalten).length, 125);
  const skl = Number(h[13].v);
  return zeilen.map((z) => {
    const f = felder(z);
    assert.equal(f.length, 125, "125 Felder je Buchung");
    assert.match(f[0].v, /^\d{1,10},\d{2}$/); assert.notEqual(f[0].v, "0,00");
    assert.match(f[1].v, /^[SH]$/);
    for (const k of [f[6].v, f[7].v]) { assert.match(k, /^\d{1,9}$/); assert.ok(k.length <= skl + 1, "Kontolänge"); }
    assert.notEqual(f[6].v, f[7].v);
    assert.match(f[9].v, /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])$/, "Belegdatum TTMM");
    assert.ok(f[10].v.length <= 36 && !/[^A-Za-z0-9$&%*+\-/_]/.test(f[10].v), "Belegfeld 1");
    assert.ok(f[13].v.length <= 60 && f[13].q && !/[\r\n\t]/.test(f[13].v), "Buchungstext");
    return f;
  });
}

test("DATEV-Buchungsstapel: Format und Kontenvorschlag", () => {
  for (const skr of ["03", "04"] as const) {
    const b = pruefe(buchungsstapel({ ...e, skr }, "2026-11", buchungenAus(rechnungen, belege, { ...e, skr }, () => "Messe Berlin"), new Date("2026-11-03T21:15:00.123Z")));
    assert.equal(b.length, 4);
    assert.deepEqual(b.map((f) => [f[0].v, f[1].v, f[6].v, f[7].v, f[8].v, f[9].v]), skr === "03"
      ? [["1190,00", "S", "10000", "8400", "", "0211"], ["119,00", "S", "4530", "70000", "9", "0311"], ["10,70", "S", "3000", "70000", "8", "0511"], ["50,00", "S", "4360", "70000", "", "3011"]]
      : [["1190,00", "S", "10000", "4400", "", "0211"], ["119,00", "S", "6530", "70000", "9", "0311"], ["10,70", "S", "5000", "70000", "8", "0511"], ["50,00", "S", "6400", "70000", "", "3011"]]);
    assert.equal(b[0][10].v, "RE-2026-0001");
    assert.equal(b[0][13].v, "Rechnung RE-2026-0001 Messe Berlin");
  }
  const ku = pruefe(buchungsstapel({ ...e, kleinunternehmer: true }, "2026-11", buchungenAus(rechnungen, belege, { ...e, kleinunternehmer: true })));
  assert.deepEqual(ku.map((f) => [f[0].v, f[7].v, f[8].v]).slice(0, 2), [["1000,00", "8195", ""], ["119,00", "70000", ""]], "Kleinunternehmer: ohne USt und ohne Vorsteuer");
  const wj = felder(buchungsstapel({ ...e, wjBeginn: 7 }, "2027-02", []).split("\r\n")[0]);
  assert.equal(wj[12].v, "20260701", "abweichendes Wirtschaftsjahr");
});

test("DATEV: Zeichensatz Windows-1252 und Einstellungen", () => {
  assert.deepEqual([...cp1252("€ä„–")], [0x80, 0xe4, 0x84, 0x96]);
  assert.deepEqual([...cp1252("✓")], [0x3f]);
  assert.deepEqual(fehltDatev({ berater: "12", mandant: "" }).length, 2);
  assert.deepEqual(fehltDatev(e), []);
  const ohne = datevTeil({ e: { ...e, berater: "" }, lohnarten: {}, admin: false }, "2026-11");
  assert.match(ohne, /fehlt: Beraternummer/); assert.doesNotMatch(ohne, /<form|datev\.csv/);
  const admin = datevTeil({ e, lohnarten: { stunden: "1000" }, admin: true }, "2026-11");
  assert.match(admin, /href="\/konto\/belege\/datev\.csv\?monat=2026-11"/);
  assert.match(admin, /name="la_stunden"[^>]*value="1000"/);
});

test("LODAS: Bewegungsdaten mit eigenen Lohnarten", () => {
  const z = [
    { personalnummer: "17", name: "Kaya, Ali", stunden: 9630, nacht: 120, sonntag: 0, feiertag: 0, urlaub: 2, schulung: 0, abwesend: 0, ausfaelle: 0, spesen: 12.5, saldo: null },
    { personalnummer: "", name: "Ohne, Nummer", stunden: 600, nacht: 0, sonntag: 0, feiertag: 0, urlaub: 0, schulung: 0, abwesend: 0, ausfaelle: 0, spesen: 0, saldo: null },
  ];
  const d = lodasDatei({ berater: "1234567", mandant: "42" }, "2026-11", z, { stunden: "1000", urlaub: "1100", spesen: "7000", nacht: "" });
  const zeilen = d.text.split("\r\n");
  assert.ok(zeilen.includes("Ziel=LODAS") && zeilen.includes("BeraterNr=1234567") && zeilen.includes("MandantenNr=42"));
  assert.ok(zeilen.includes("1;u_lod_bwd_buchung_standard;pnr#bwd;abrechnung_zeitraum#bwd;bs_wert_butab#bwd;bs_nr#bwd;la_eigene#bwd;bemerkung#bwd;"));
  const daten = zeilen.slice(zeilen.indexOf("[Bewegungsdaten]") + 1).filter(Boolean);
  assert.deepEqual(daten, ["1;17;01.11.2026;160,50;1;1000;IMPORT Crewtender;", "1;17;01.11.2026;2,00;10;1100;IMPORT Crewtender;", "1;17;01.11.2026;12,50;2;7000;IMPORT Crewtender;"], "Nacht ohne Lohnart fehlt");
  assert.deepEqual(d.ohneNummer, ["Ohne, Nummer"]);
  // § 3b windows go out as their own wage types (hours).
  const sf = lodasDatei({ berater: "1234567", mandant: "42" }, "2026-11", [{ ...z[0], sf: { n25: 90, n40: 30, so50: 0, f125: 0, f150: 0 } } as never], { n25: "2001", n40: "2002", so50: "2003" });
  assert.ok(sf.text.includes("1;17;01.11.2026;1,50;1;2001;IMPORT Crewtender;") && sf.text.includes("1;17;01.11.2026;0,50;1;2002;IMPORT Crewtender;") && !sf.text.includes(";2003;"));
});

test("Steuerbüro-Zugang: nur ansehen und herunterladen", async () => {
  const { ohneFormulare, rechnungenSeite } = await import("../src/rechnungen.ts");
  const { belegeSeite } = await import("../src/belege.ts");
  const r = [{ id: "a".repeat(8) + "-0000-0000-0000-000000000000", kunde_id: null, nummer: "RE-1", monat: "2026-11", datum: "2026-11-01", positionen: [], netto: 100, ust_satz: 19, erstellt: "2026-11-01" }];
  const html = ohneFormulare(rechnungenSeite(r, [], { fehlt: [], heute: "2026-11-03" }));
  assert.doesNotMatch(html, /<form|<button/);
  assert.match(html, /\.docx"[^>]*download/);
  assert.match(html, /\.xml"[^>]*download/);
  const b = belegeSeite(belege, { monat: "2026-11", heute: "2026-11-03", nurLesen: true });
  assert.doesNotMatch(b, /<form|Beleg erfassen/);
  assert.match(b, /belege\.csv\?monat=2026-11/);
});
