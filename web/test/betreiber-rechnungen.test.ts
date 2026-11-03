import assert from "node:assert/strict";
import { test } from "node:test";
import { positionenAusFormular, rechnungAnsicht, rechnungenSeite, vormonat, zahl, geld, type BetreiberRechnung } from "../src/betreiber-rechnungen.ts";

const form = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });

test("Kundenrechnung: Zahlen und Positionen aus dem Formular", () => {
  assert.equal(zahl("1.234,56"), 1234.56);
  assert.equal(zahl("149,00 €"), 149);
  assert.equal(zahl("149.5"), 149.5);
  assert.ok(Number.isNaN(zahl("")));
  assert.deepEqual(positionenAusFormular(form({ text0: "Crewtender Pro", preis0: "149,00", text1: "Zusatzpaket", menge1: "2", preis1: "15" })), [{ text: "Crewtender Pro", menge: 1, preis: 149 }, { text: "Zusatzpaket", menge: 2, preis: 15 }]);
  assert.equal(positionenAusFormular(form({})), null, "keine Position");
  assert.equal(positionenAusFormular(form({ text0: "Pro" })), null, "Preis fehlt");
  assert.equal(positionenAusFormular(form({ preis0: "10" })), null, "Text fehlt");
  assert.equal(positionenAusFormular(form({ text0: "Pro", menge0: "0", preis0: "10" })), null, "Menge 0");
  assert.equal(vormonat(new Date("2026-12-01T08:00:00Z")), "November 2026");
  assert.equal(vormonat(new Date("2027-01-05T08:00:00Z")), "Dezember 2026");
});

const R: BetreiberRechnung = {
  id: "11111111-1111-4111-8111-111111111111", nummer: "CT-2026-0001", firma_id: null, datum: "2026-12-01", leistungszeitraum: "November 2026", summe: 179, hinweis: "Zahlbar in 14 Tagen.\nIBAN DE00 0000",
  aussteller: { name: "Benjamin Schiffer", firma: "WP Digital Ranger", strasse: "Rochusstraße 19", ort: "52531 Übach-Palenberg", email: "kontakt@wpdigitalranger.com", steuernummer: "202/123/45678", ust_id: "", kleinunternehmer: true },
  empfaenger: { firma: "Weg <GmbH>", strasse: "Weg 1", plz: "12345", ort: "Wegstadt", land: "DE" },
  positionen: [{ text: "Crewtender Pro", menge: 1, preis: 149 }, { text: "Zusatzpaket", menge: 2, preis: 15 }], storno_von: null, storniert_durch: null,
};

test("Kundenrechnung: Pflichtangaben auf der Rechnung (§ 34a UStDV)", () => {
  const h = rechnungAnsicht(R);
  for (const muss of ["Benjamin Schiffer, WP Digital Ranger", "Rochusstraße 19", "52531 Übach-Palenberg", "Weg 1", "12345 Wegstadt", "Rechnung CT-2026-0001", "Rechnungsdatum: 01.12.2026", "Leistungszeitraum: November 2026", "Steuernummer: 202/123/45678", "Crewtender Pro", geld(149), geld(30), geld(179), "§ 19 Abs. 1 UStG", "IBAN DE00 0000"]) assert.ok(h.includes(muss), muss);
  assert.match(h, /Weg &lt;GmbH&gt;|Weg &#60;GmbH&#62;/);
  assert.match(h, /data-drucken/);
  assert.match(rechnungAnsicht({ ...R, storno_von: "x", summe: -179 }), /Stornorechnung CT-2026-0001/);
  assert.match(rechnungAnsicht({ ...R, storniert_durch: "y", storno_nummer: "CT-2026-0002" }), /storniert durch CT-2026-0002/);
  assert.doesNotMatch(rechnungAnsicht({ ...R, aussteller: { ...R.aussteller, kleinunternehmer: false } }), /§ 19/);
});

test("Kundenrechnung: Formular mit Kunde, Steuernummer-Hinweis und Liste", () => {
  const f = [{ id: "22222222-2222-4222-8222-222222222222", name: "Weg GmbH", erstellt: "", website: "", paket: "pro", ki_budget_usd: null, ki_verbraucht: 0, mitglieder: 1, inhaber: "a@weg.de", letzte_anmeldung: null }];
  const ohne = rechnungenSeite({ liste: [], firmen: f, steuernummer: "", zahlungshinweis: "Zahlbar", heute: new Date("2026-12-01T08:00:00Z") });
  assert.match(ohne, /Ohne Steuernummer darf noch keine Rechnung raus/);
  assert.match(ohne, /value="November 2026"/);
  assert.match(ohne, /Noch keine Rechnungen/);
  const mit = rechnungenSeite({ liste: [R, { ...R, id: "x", nummer: "CT-2026-0002", storno_von: R.id, summe: -179 }], firmen: f, firma: f[0].id, steuernummer: "202/123/45678", zahlungshinweis: "Zahlbar" });
  assert.doesNotMatch(mit, /Ohne Steuernummer/);
  assert.match(mit, /<option value="22222222-2222-4222-8222-222222222222" selected>Weg GmbH \(a@weg\.de\)/);
  assert.match(mit, /CT-2026-0001<\/a>[\s\S]*CT-2026-0002<\/a>[\s\S]*Stornorechnung/);
  assert.match(mit, /name="steuernummer"[^>]*value="202\/123\/45678"/);
});
