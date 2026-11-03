import assert from "node:assert/strict";
import { test } from "node:test";
import { arbzgHinweise, ersatzVorschlaege, konflikte, type Schicht } from "../src/schichten.ts";

const s = (id: string, datum: string, beginn: string, ende: string, personal_id: string | null = "p1"): Schicht => ({ id, personal_id, bereich_id: null, datum, beginn, ende, ort: "", notiz: "", antwort: "zugesagt" });

test("ArbZG: mehr als 10 Stunden am Tag, Ruhezeit unter 11 Stunden, Sonntag", () => {
  // Montag 2026-11-02: 06–14 and 15–23 (16 h gross, 15 h net) → § 3
  const tag = [s("a", "2026-11-02", "06:00", "14:00"), s("b", "2026-11-02", "15:00", "23:00")];
  assert.match(arbzgHinweise(tag[1], tag).join(), /höchstens 10 \(§ 3 ArbZG\)/);
  // 14–22 and next day 06–14: 8 h rest → § 5
  const ruhe = [s("a", "2026-11-03", "14:00", "22:00"), s("b", "2026-11-04", "06:00", "14:00")];
  assert.match(arbzgHinweise(ruhe[1], ruhe).join(), /nur 8 Std\. Ruhezeit.*§ 5/);
  // night shift 22–06 and the next day 18–02: 12 h rest → fine
  const nacht = [s("a", "2026-11-03", "22:00", "06:00"), s("b", "2026-11-04", "18:00", "02:00")];
  assert.deepEqual(arbzgHinweise(nacht[1], nacht), []);
  // 06–16:45 = 10:45 gross, 10 h net after 45 min break → allowed
  assert.deepEqual(arbzgHinweise(s("x", "2026-11-05", "06:00", "16:45"), []), []);
  assert.match(arbzgHinweise(s("so", "2026-11-08", "08:00", "12:00"), []).join(), /Sonntagsarbeit/);
  assert.match(konflikte(ruhe, []).get("b") ?? "", /^Arbeitszeit: .*Ruhezeit/);
});

test("Ersatzvorschläge ohne Verstoß gegen das Arbeitszeitgesetz", () => {
  const offen = s("o", "2026-11-04", "06:00", "14:00", "weg");
  const personen = [{ id: "p1", vorname: "Eva", nachname: "", bereich_id: null, status: "verfuegbar" }, { id: "p2", vorname: "Ali", nachname: "", bereich_id: null, status: "verfuegbar" }];
  const schichten = [offen, s("spaet", "2026-11-03", "14:00", "23:00", "p1")];
  assert.deepEqual(ersatzVorschlaege(offen, undefined, personen, schichten, [], []).map((p) => p.id), ["p2"], "Eva hätte nur 7 Std. Ruhe");
});

test("Feiertag nach dem Einsatzort: Allerheiligen in NRW, nicht in Hessen", async () => {
  const { zuschlag } = await import("../src/zuschlaege.ts");
  const { mitLand } = await import("../src/stunden.ts");
  const e = { datum: "2026-11-01", beginn: "08:00", ende: "16:00", pause_min: 0 };
  // 01.11.2026 is a Sunday; with a Hessian firm it counts as Sunday, at a site in NRW as public holiday.
  assert.equal(zuschlag(e, "HE").feiertag, 0);
  assert.equal(zuschlag({ ...e, land: "NW" }, "HE").feiertag, 480);
  const [x, y] = mitLand([{ ...e, kunde_id: "k1" }, { ...e, kunde_id: "k2" }], new Map([["k1", "NW"]]));
  assert.equal(x.land, "NW");
  assert.equal(y.land, undefined);
});
