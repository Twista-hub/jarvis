import assert from "node:assert/strict";
import { test } from "node:test";
import { auftraegeSeite, fortschritt, lage, vorschlag, type Auftrag, type Vertrag } from "../src/auftraege.ts";
import { detailSeite, listeSeite, sammeln, zahlen, type EigenerVorgang } from "../src/auftraggeber.ts";
import { auswertungSeite, monate, proMonat, quoteProQuartal, trichter, type V } from "../src/auswertung.ts";
import { firmaVonProfil } from "../src/api-budget.ts";

const vertrag = (x: Partial<Vertrag>): Vertrag => ({ vorgang_id: "a", beginn: null, ende: null, verlaengerung_bis: null, option_frist: null, personen_soll: null, ansprechpartner: "", notiz: "", ...x });

test("N4: Lage eines Auftrags, Fortschritt und Vorschlag aus der Bekanntmachung", () => {
  const h = "2026-11-01";
  assert.equal(lage(undefined, 0, h).stufe, "grau");
  assert.match(lage(vertrag({ ende: "2028-01-01", option_frist: "2026-11-20" }), 0, h).text, /in 19 Tagen/);
  assert.equal(lage(vertrag({ ende: "2028-01-01", option_frist: "2027-01-15" }), 0, h).stufe, "gelb");
  assert.equal(lage(vertrag({ ende: "2026-12-01" }), 0, h).stufe, "rot");
  assert.match(lage(vertrag({ ende: "2028-01-01", personen_soll: 5 }), 3, h).text, /2 Personen fehlen/);
  assert.match(lage(vertrag({ ende: "2027-03-01" }), 0, h).text, /Neuausschreibung/);
  assert.equal(lage(vertrag({ ende: "2028-01-01", personen_soll: 2 }), 2, h).stufe, "gruen");
  assert.equal(lage(vertrag({ ende: "2026-10-01" }), 0, h).stufe, "grau");
  assert.equal(fortschritt(vertrag({ beginn: "2026-01-01", ende: "2027-01-01" }), "2026-07-02"), 50);
  assert.equal(fortschritt(vertrag({ ende: "2027-01-01" }), h), null);
  const a: Auftrag = { id: "a", titel: "T", link: null, katalog_id: "k", bereich_id: null, vergabekatalog: { auftraggeber: "Stadt", auftraggeber_id: "bks:x", laufzeit_ende: null, cp: { startDate: "2027-01-01T00:00:00Z", durationInDays: 365 } } };
  assert.deepEqual(vorschlag(a), { beginn: "2027-01-01", ende: "2028-01-01" });
});

test("N4: Seite mit laufenden und beendeten Aufträgen, Umsatz nur mit Finanzfreigabe", () => {
  const a = (id: string): Auftrag => ({ id, titel: `Auftrag ${id}`, link: null, katalog_id: null, bereich_id: null, vergabekatalog: { auftraggeber: "Stadt <A>", auftraggeber_id: "bks:a", laufzeit_ende: null, cp: null } });
  const vertraege = new Map([["1", vertrag({ vorgang_id: "1", beginn: "2026-01-01", ende: "2027-12-31", option_frist: "2026-11-15", personen_soll: 4 })], ["2", vertrag({ vorgang_id: "2", ende: "2026-06-30" })]]);
  const opts = { heute: "2026-11-01", vertraege, zugesagt: new Map([["1", ["Eva", "Max"]]]), umsatz: new Map([["1", 250000]]), finanzen: true, darfAendern: true };
  const html = auftraegeSeite([a("2"), a("3"), a("1")], opts);
  assert.ok(html.indexOf("Auftrag 1") < html.indexOf("Auftrag 3"), "dringende zuerst");
  assert.match(html, /Beendete Aufträge \(1\)/);
  assert.match(html, /2 von 4 Personen zugesagt: Eva, Max/);
  assert.match(html, /250\.000/);
  assert.match(html, /Stadt &#60;A&#62;|Stadt &lt;A&gt;/);
  assert.match(html, /name="umsatz"/);
  const ohne = auftraegeSeite([a("1")], { ...opts, finanzen: false, darfAendern: false });
  assert.doesNotMatch(ohne, /250\.000|name="umsatz"|<form/);
  assert.match(auftraegeSeite([], opts), /Noch keine gewonnenen Aufträge/);
});

const ev = (id: string, status: string, ag: string | null, erstellt = "2026-10-01T00:00:00Z"): EigenerVorgang => ({ id, titel: `Ausschreibung ${id}`, status, frist: null, erstellt, katalog_id: `k${id}`, vergabekatalog: ag ? { auftraggeber: `Name ${ag}`, auftraggeber_id: ag, ort: "10115 Berlin (Auftraggeberadresse; Einsatzort prüfen)" } : null });

test("N5: Auftraggeber sammeln, Kennzahlen und Seiten", () => {
  const liste = sammeln([ev("1", "gewonnen", "bks:a"), ev("2", "verloren", "bks:a", "2026-10-20T00:00:00Z"), ev("3", "neu", "bks:b", "2026-09-01T00:00:00Z"), ev("4", "neu", null)], [{ auftraggeber_id: "bks:c", name: "Beobachtet" }, { auftraggeber_id: "bks:a", name: "x" }], [{ auftraggeber_schluessel: "bks:a" }]);
  assert.deepEqual(liste.map((e) => e.id), ["bks:a", "bks:b", "bks:c"]);
  assert.equal(liste[0].ort, "10115 Berlin");
  assert.equal(liste[0].beobachtet, true);
  assert.equal(liste[0].kontakte, 1);
  assert.deepEqual(zahlen(liste[0].vorgaenge), { treffer: 2, angebote: 2, gewonnen: 1, verloren: 1, quote: 50 });
  assert.match(listeSeite(liste, ""), /🏆 1/);
  assert.doesNotMatch(listeSeite(liste, "Beob"), /Name bks:a/);
  const d = detailSeite({ id: "bks:a", name: "Stadt A", ort: "Berlin" }, { vorgaenge: liste[0].vorgaenge, beobachtet: true, admin: true, darfAendern: true, darfUebernehmen: true,
    kontakte: [{ id: "c1000000-0000-4000-8000-000000000001", auftraggeber_schluessel: "bks:a", name: "Frau Meier", funktion: "Vergabestelle", telefon: "030 123-4", email: "m@stadt.de", notiz: "" }],
    katalog: [{ id: "kneu", titel: "Neue Reinigung", status: "offen", frist: "2099-01-01T00:00:00Z", quell_datum: "2026-10-30T00:00:00Z", link: "https://x", laufzeit_ende: null, zuschlaege: [], kontakt: { name: "Vergabestelle", email: "vergabe@stadt.de" } },
      { id: "k1", titel: "Eigene", status: "offen", frist: "2099-01-01T00:00:00Z", quell_datum: "2026-10-01T00:00:00Z", link: "https://x", laufzeit_ende: null, zuschlaege: [] },
      { id: "kalt", titel: "Alte Reinigung", status: "vergeben", frist: null, quell_datum: "2026-09-01T00:00:00Z", link: "https://x", laufzeit_ende: "2028-09-30", zuschlaege: [{ datum: "2026-09-01T00:00:00Z", gewinner: ["Blitz GmbH"], wert: 300000, waehrung: "EUR" }] }] });
  assert.match(d, /50 %/);
  assert.match(d, /value="nicht_beobachten"/);
  assert.match(d, /href="tel:030123-4"|href="tel:0301234"/);
  assert.match(d, /Aus der Bekanntmachung: Vergabestelle/);
  assert.match(d, /Gerade offen/); assert.match(d, /Neue Reinigung/); assert.doesNotMatch(d, /<strong>Eigene<\/strong>/);
  assert.match(d, /an Blitz GmbH · 300\.000/);
  assert.match(d, /Vertrag bis 30\.9\.2028/);
});

test("N6: Monate, Treffer pro Monat, Trichter und Quote je Quartal", () => {
  assert.deepEqual(monate("2026-11-15", 3), ["2026-09", "2026-10", "2026-11"]);
  const v: V[] = [
    { id: "1", status: "gewonnen", erstellt: "2026-10-02T00:00:00Z", geaendert: "2026-10-20T00:00:00Z" },
    { id: "2", status: "verloren", erstellt: "2026-10-05T00:00:00Z", geaendert: "2026-07-20T00:00:00Z" },
    { id: "3", status: "pruefen", erstellt: "2026-11-01T00:00:00Z", geaendert: null },
    { id: "4", status: "neu", erstellt: "2026-11-01T00:00:00Z", geaendert: null },
    { id: "5", status: "abgegeben", erstellt: "2026-09-01T00:00:00Z", geaendert: null },
  ];
  const pm = proMonat(v, "2026-11-01");
  assert.equal(pm.length, 12);
  assert.deepEqual(pm.at(-1), { monat: "2026-11", treffer: 2, angebote: 0 });
  assert.deepEqual(pm.at(-2), { monat: "2026-10", treffer: 2, angebote: 2 });
  assert.deepEqual(trichter(v).map(([, n]) => n), [5, 4, 3, 3, 1]);
  assert.deepEqual(quoteProQuartal(v), [{ quartal: "3/2026", gewonnen: 0, entschieden: 1, quote: 0 }, { quartal: "4/2026", gewonnen: 1, entschieden: 1, quote: 100 }]);
  const html = auswertungSeite(v, { heute: "2026-11-01", finanzen: true, umsatz: 250000, angebotswert: 240000, gruende: { region: 4, groesse: 1 }, ki: [{ monat: "2026-11-01", zweck: "alarm", kosten: "1.25", anfragen: 30 }, { monat: "2026-10-01", zweck: "web", kosten: 0.5, anfragen: 2 }] });
  assert.match(html, /50 %/);
  assert.match(html, /250\.000/);
  assert.match(html, /Falsche Region/);
  assert.match(html, /1,25 \$/); assert.match(html, /0,50 \$/);
  assert.match(html, /Suche und Bewertung: 1,25 \$ \(30 Anfragen\)/);
  const leser = auswertungSeite(v, { heute: "2026-11-01", finanzen: false, umsatz: 0, angebotswert: 0, gruende: {}, ki: null });
  assert.doesNotMatch(leser, /Umsatz|KI-Kosten/);
});

test("N6: Firma eines Upload-Auftrags für die KI-Buchung", () => {
  assert.equal(firmaVonProfil("firma-11111111-1111-4111-8111-111111111111"), "11111111-1111-4111-8111-111111111111");
  assert.equal(firmaVonProfil("perlease", { perlease: { firma_id: "f" } }), "f");
  assert.equal(firmaVonProfil("unbekannt"), null);
  assert.equal(firmaVonProfil(undefined), null);
});
