import assert from "node:assert/strict";
import { test } from "node:test";
import { auftragswert, bewertung, eckdaten, sortieren, suchbegriff } from "../src/treffer.ts";
import { abstand, ampel, gruppen, ics, offenePunkte } from "../src/fristen.ts";

const brief = "## Jarvis-Bewertung\n\n**Gesucht:** Servicekräfte\n\n**Warum passend:** Kerngeschäft.\n\n## Kurzüberblick\n\n**Ort:** Bonn\n\n**Lose:** 2 (Küche; Service)\n\n**Geschätzter Auftragswert:** 450.000 €\n\n**Laufzeit:** 730 Tage\n\n";

test("Trefferkarte liest Eckdaten und zweiteilige Bewertung", () => {
  assert.deepEqual(eckdaten(brief).map((e) => e.wert), ["2 Lose", "450.000 €", "730 Tage", "Bonn"]);
  assert.equal(auftragswert(brief), 450000);
  assert.deepEqual(bewertung(brief), { gesucht: "Servicekräfte", warum: "Kerngeschäft." });
  assert.equal(suchbegriff("küche*,(x)"), "küche x");
});

test("Sortierung nach Frist und Auftragswert", () => {
  const a = { punkte: 9, frist: "2026-12-01", erstellt: "1", steckbrief: "" };
  const b = { punkte: 6, frist: "2026-11-05", erstellt: "2", steckbrief: brief };
  assert.deepEqual(sortieren([a, b], "frist"), [b, a]);
  assert.deepEqual(sortieren([a, b], "wert"), [b, a]);
  assert.deepEqual(sortieren([b, a], "punkte"), [a, b]);
});

test("Fristen: Ampel, Abstand, Wochengruppen, Kalenderdatei", () => {
  const jetzt = Date.parse("2026-11-02T08:00:00Z"); // Monday
  const v = (id: string, frist: string, status = "neu") => ({ id, titel: `Auftrag ${id}`, frist, status });
  assert.equal(ampel(v("a", "2026-11-03T10:00:00Z"), jetzt), "rot");
  assert.equal(ampel(v("b", "2026-11-06T10:00:00Z"), jetzt), "gelb");
  assert.equal(ampel(v("c", "2026-11-20T10:00:00Z"), jetzt), "gruen");
  assert.equal(ampel(v("d", "2026-11-03T10:00:00Z", "abgegeben"), jetzt), "grau");
  assert.equal(abstand("2026-11-03T10:00:00Z", jetzt), "morgen");
  assert.deepEqual(gruppen([v("a", "2026-11-04T10:00:00Z"), v("b", "2026-11-10T10:00:00Z"), v("c", "2026-11-30T10:00:00Z")], jetzt).map(([t, l]) => [t, l.length]), [["Diese Woche", 1], ["Nächste Woche", 1], ["Später", 1]]);
  const datei = ics(v("a", "2026-11-03T10:00:00Z"), "https://app.test/konto/vorgang/a", new Date(jetzt));
  assert.match(datei, /DTSTART:20261103T100000Z/);
  assert.match(datei, /TRIGGER:-P1D/);
  assert.deepEqual(offenePunkte({ ...v("a", "2026-11-03"), kaufverantwortlich_id: "x" }, true), ["Entscheidung offen"]);
});
