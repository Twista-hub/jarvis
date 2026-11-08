import assert from "node:assert/strict";
import { test } from "node:test";
import { arbzgHinweise, arbzgJahr, ersatzVorschlaege, konflikte, nurHinweis, type Schicht } from "../src/schichten.ts";

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

test("§ 3b EStG: Zeitfenster Nacht 25/40 %, Sonntag, Feiertag 125/150 %", async () => {
  const { steuerfrei3b } = await import("../src/zuschlaege.ts");
  // Saturday 2026-11-07 22:00 to Sunday 06:00: night 20–24 (2 h, 25 %), 0–4 (4 h, 40 %, started before midnight), 4–6 (2 h, 25 %);
  // Sunday 0–6 counts as Sunday (6 h).
  assert.deepEqual(steuerfrei3b({ datum: "2026-11-07", beginn: "22:00", ende: "06:00", pause_min: 0 }, "NW"), { n25: 240, n40: 240, so50: 360, f125: 0, f150: 0 });
  // Sunday 2026-11-08 20:00 to Monday 02:00: Sunday 4 h, Monday 0–2 counts as Sunday too (§ 3b Abs. 3 Nr. 2).
  assert.equal(steuerfrei3b({ datum: "2026-11-08", beginn: "20:00", ende: "02:00", pause_min: 0 }, "NW").so50, 360);
  // 24.12.2026 (Thursday) 12:00–18:00: from 14 h 150 %.
  assert.equal(steuerfrei3b({ datum: "2026-12-24", beginn: "12:00", ende: "18:00", pause_min: 0 }, "NW").f150, 240);
  // 1.5. = 150 %, Allerheiligen in NRW = 125 % (on a Sunday: holiday only)
  assert.equal(steuerfrei3b({ datum: "2026-05-01", beginn: "08:00", ende: "12:00", pause_min: 0 }, "NW").f150, 240);
  const ah = steuerfrei3b({ datum: "2026-11-01", beginn: "08:00", ende: "12:00", pause_min: 0 }, "NW");
  assert.deepEqual([ah.f125, ah.so50], [240, 0]);
  // a shift starting at 00:30 gets no 40 % (did not start before midnight)
  assert.equal(steuerfrei3b({ datum: "2026-11-03", beginn: "00:30", ende: "04:00", pause_min: 0 }, "NW").n40, 0);
});

test("A1: Feiertagsarbeit, 15 freie Sonntage, Ersatzruhetag", () => {
  const s = { id: "x", personal_id: "p", datum: "2026-12-25", beginn: "08:00", ende: "16:00" };
  const h = arbzgHinweise(s, [], "NW");
  assert.ok(h.some((x) => /^Feiertagsarbeit \(.+\): .*8 Wochen/.test(x)), h.join());
  assert.ok(nurHinweis(h[0]), "nur Hinweis, kein Konflikt im Plan");
  assert.deepEqual(arbzgHinweise(s, []), [], "ohne Land kein Feiertagshinweis (wie bisher)");
  // 38 Sundays worked in 2026 → only 14 free.
  const sonntage: string[] = [];
  for (let d = new Date(Date.UTC(2026, 0, 4)); sonntage.length < 38; d.setUTCDate(d.getUTCDate() + 7)) sonntage.push(d.toISOString().slice(0, 10));
  const jahr = sonntage.slice(0, 37).map((datum) => ({ datum, antwort: "zugesagt" }));
  assert.ok(arbzgJahr([{ datum: sonntage[37] }], jahr).some((x) => /^Freie Sonntage 2026: nur noch 14/.test(x)));
  assert.ok(!arbzgJahr([{ datum: sonntage[36] }], jahr.slice(0, 30)).some((x) => x.startsWith("Freie Sonntage")));
  // Every day around a Sunday planned → no compensatory rest day.
  const voll = Array.from({ length: 27 }, (_, i) => ({ datum: new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10), antwort: "zugesagt" }));
  assert.ok(arbzgJahr([{ datum: "2026-11-15" }], voll).some((x) => x.startsWith("Ersatzruhetag für den Sonntag 15.11.")));
  assert.ok(!arbzgJahr([{ datum: "2026-11-15" }], voll.filter((x) => x.datum !== "2026-11-18")).some((x) => x.startsWith("Ersatzruhetag")));
});
