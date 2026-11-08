import { test } from "node:test";
import assert from "node:assert/strict";
import { abgleichen, abgleichKasten, amtlichAusKatalog, datumIn, steckbriefFristen, steckbriefLose, uhrzeitIn } from "../src/abgleich.ts";

const MUSTER = `# Steckbrief: Personal Kantine

## ⏰ Fristen

| | |
|---|---|
| Rückfragen an die Vergabestelle | bis **13.11.2026, 11:00 Uhr** |
| Antworten auf Bieterfragen | bis 16.11.2026 |
| **Angebotsabgabe** | **27.11.2026, 11:00 Uhr**, nur elektronisch |
| Bindefrist | 31.12.2026 |

## Die Lose

| Los | Tätigkeit | Std./Jahr |
|---|---|---|
| 1 | Koch | 1.700 |
| 2 | Service | 2.100 |
| 3 | Spüle | 800 |
`;

test("Datum und Uhrzeit werden in verschiedenen Schreibweisen erkannt", () => {
  assert.equal(datumIn("bis 3.2.2027"), "2027-02-03");
  assert.equal(datumIn("27. November 2026"), "2026-11-27");
  assert.equal(datumIn("2026-11-27T10:00"), "2026-11-27");
  assert.equal(datumIn("nicht angegeben"), null);
  assert.equal(uhrzeitIn("27.11.2026, 11:00 Uhr"), "11:00");
  assert.equal(uhrzeitIn("bis 9 Uhr"), "09:00");
});

test("Fristen und Lose werden aus dem Steckbrief gelesen", () => {
  const f = steckbriefFristen(MUSTER);
  assert.deepEqual(f.frist, { tag: "2026-11-27", zeit: "11:00" });
  assert.deepEqual(f.fragefrist, { tag: "2026-11-13", zeit: "11:00" });
  assert.deepEqual(steckbriefLose(MUSTER).nummern, [1, 2, 3]);
  assert.equal(steckbriefFristen("**Frist:** 05.12.2026").frist?.tag, "2026-12-05");
});

test("Übereinstimmung, Abweichung und fehlende Angaben", () => {
  // 27.11.2026 11:00 Berlin = 10:00 UTC
  const gleich = abgleichen(MUSTER, { frist: "2026-11-27T10:00:00.000Z", fragefrist: "2026-11-13T10:00:00.000Z", lose: 3 });
  assert.deepEqual(gleich.map((p) => p.stufe), ["ok", "ok", "ok"]);
  const anders = abgleichen(MUSTER, { frist: "2026-11-30T10:00:00.000Z", fragefrist: null, lose: 4 });
  assert.deepEqual(anders.map((p) => [p.art, p.stufe]), [["frist", "abweichung"], ["lose", "abweichung"]]);
  assert.match(anders[0].text, /27\.11\.2026, 11:00 Uhr.*30\.11\.2026, 11:00 Uhr/);
  // Official deadline without a time (stored as 23:59): only the day counts.
  assert.equal(abgleichen(MUSTER, { frist: "2026-11-27T22:59:59.000Z", fragefrist: null, lose: 0 })[0].stufe, "ok");
  const ohne = abgleichen("## ⏰ Fristen\n\nRückfragen bis 7 Tage vor Ablauf.", { frist: "2026-11-27T10:00:00.000Z", fragefrist: null, lose: 2 });
  assert.deepEqual(ohne.map((p) => p.stufe), ["fehlt", "fehlt"]);
});

test("Kasten nur mit Daten; Text wird maskiert", () => {
  assert.equal(abgleichKasten([]), "");
  assert.equal(amtlichAusKatalog({ frist: null, lose: [{}], fragefrist: null }), null);
  assert.deepEqual(amtlichAusKatalog({ frist: "2026-11-27T10:00:00Z", lose: [{}, {}], fragefrist: "2026-11-13T10:00:00Z" }), { frist: "2026-11-27T10:00:00Z", fragefrist: "2026-11-13T10:00:00.000Z", lose: 2 });
  const html = abgleichKasten([{ art: "frist", stufe: "abweichung", text: "<b>x</b>" }]);
  assert.match(html, /abgleich-warnung/);
  assert.doesNotMatch(html, /<b>/);
});
