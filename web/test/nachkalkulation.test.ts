import test from "node:test";
import assert from "node:assert/strict";
import { nachkalkulation, nachkalkulationSeite, STANDARD } from "../src/nachkalkulation.ts";

const e = (id: string, personal_id: string, datum: string, beginn: string, ende: string, kunde_id: string | null) => ({ id, personal_id, datum, beginn, ende, pause_min: 0, einsatz: "", notiz: "", status: "freigegeben", kunde_id });

test("Nachkalkulation: Kosten, Erlös, Deckungsbeitrag", () => {
  const z = nachkalkulation({
    kunden: [{ id: "k1", name: "Messe" }, { id: "k2", name: "Hotel" }],
    orte: [{ id: "o1", kunde_id: "k1" }, { id: "o2", kunde_id: "k2" }],
    schichten: [{ datum: "2026-11-02", beginn: "08:00", ende: "18:00", einsatzort_id: "o1", personal_id: "p1" }],
    // Mon 2.11. 8–16 (8 h), p1 own wage 20 €; Sun 8.11. 8–12 (4 h Sunday), p2 standard 15 €
    stunden: [e("s1", "p1", "2026-11-02", "08:00", "16:00", "k1"), e("s2", "p2", "2026-11-08", "08:00", "12:00", "k2"), e("s3", "p2", "2026-11-03", "08:00", "10:00", null)],
    rechnungen: [{ kunde_id: "k1", netto: 150 }],
    preise: [{ kunde_id: "k2", satz: 30, zuschlag_nacht: 0, zuschlag_sonntag: 50, zuschlag_feiertag: 0 }],
    loehne: new Map([["p1", 20]]), werte: STANDARD, land: "NW",
  });
  const messe = z.find((x) => x.kunde_id === "k1")!, hotel = z.find((x) => x.kunde_id === "k2")!, ohne = z.find((x) => x.kunde_id === null)!;
  assert.equal(messe.planMin, 600);
  assert.equal(messe.istMin, 480);
  assert.equal(messe.kosten, 196.8, "8 h × 20 € × 1,23");
  assert.deepEqual([messe.erloes, messe.quelle, messe.db, messe.quote], [150, "rechnung", -46.8, -31.2]);
  assert.equal(hotel.kosten, 110.7, "(4 h × 15 € + 4 h × 50 % × 15 €) × 1,23");
  assert.deepEqual([hotel.erloes, hotel.quelle, hotel.db], [180, "geschaetzt", 69.3], "4 h × 30 € + 50 % Sonntag");
  assert.deepEqual([ohne.erloes, ohne.kosten, ohne.name.startsWith("Ohne Kunde")], [null, 36.9, true]);
  assert.equal(z[0].kunde_id, "k1", "Verlust zuerst, ohne Kunde zuletzt");
  assert.equal(z.at(-1)!.kunde_id, null);

  const html = nachkalkulationSeite(z, { monat: "2026-11", werte: STANDARD, personen: [{ id: "p1", name: "Ali <K>", lohn: 20 }], darf: true });
  assert.match(html, /🔴 Messe/);
  assert.match(html, /🟢 Hotel/);
  assert.match(html, /\(geschätzt\)/);
  assert.match(html, /Ali &#60;K&#62;[\s\S]*value="20"/);
  assert.match(html, /330,00\s€<\/strong> Erlös/);
  assert.doesNotMatch(nachkalkulationSeite(z, { monat: "2026-11", werte: STANDARD, personen: [], darf: false }), /<form/);
});
