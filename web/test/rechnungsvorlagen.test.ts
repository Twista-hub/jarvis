import test from "node:test";
import assert from "node:assert/strict";
import { offeneVorlagen, vorlagenBereich, vorlagePositionen, type Vorlage } from "../src/rechnungen.ts";
import type { Kunde } from "../src/kunden.ts";

const v = (x: Partial<Vorlage> = {}): Vorlage => ({ id: "11111111-1111-1111-1111-111111111111", kunde_id: "k", text: "Unterhaltsreinigung pauschal", betrag: "1200", aktiv: true, letzter_monat: null, ...x });

test("Wiederkehrende Rechnungen: einmal pro Monat, pausierte nicht, Pauschalposition", () => {
  assert.equal(offeneVorlagen([v(), v({ letzter_monat: "2026-11" }), v({ aktiv: false })], "2026-11").length, 1);
  assert.equal(offeneVorlagen([v({ letzter_monat: "2026-10" })], "2026-11").length, 1);
  assert.deepEqual(vorlagePositionen(v(), "2026-11"), [{ text: "Unterhaltsreinigung pauschal November 2026", menge: 1, einheit: "pauschal", preis: 1200, betrag: 1200 }]);
  const html = vorlagenBereich([v()], [{ id: "k", name: "Stadt X" } as unknown as Kunde], "2026-11");
  assert.match(html, /Rechnungen für November 2026 erstellen \(1\)/);
  assert.match(html, /name="vorlage_kunde"/);
  assert.match(vorlagenBereich([v({ letzter_monat: "2026-11" })], [], "2026-11"), /alle wiederkehrenden Rechnungen erstellt/);
});
