import assert from "node:assert/strict";
import { test } from "node:test";
import { gruss, tageBisFrist, uebersichtKopf, uebersichtTitel } from "../src/uebersicht.ts";
import { uebersetzen } from "../src/englisch.ts";
import { seite } from "../src/seite.ts";

test("Übersicht: Gruß nach Berliner Uhrzeit und Sprache", () => {
  assert.equal(gruss(new Date("2026-11-04T07:41:00Z")), "Guten Morgen");
  assert.equal(gruss(new Date("2026-11-04T12:00:00Z")), "Guten Tag");
  assert.equal(gruss(new Date("2026-11-04T18:30:00Z")), "Guten Abend");
  assert.equal(uebersichtTitel("Benjamin", new Date("2026-11-04T07:41:00Z"), "en"), "Good morning, Benjamin");
  assert.equal(uebersichtTitel("", new Date("2026-11-04T19:00:00Z"), "fr"), "Bonsoir");
  assert.equal(tageBisFrist("2026-11-07T10:00:00Z", new Date("2026-11-04T23:30:00Z")), 2, "nach Mitternacht in Berlin schon der 5.");
});

test("Übersicht: Kennzahlen, nächste Frist mit passendem Knopf, Übersetzung", () => {
  const jetzt = new Date("2026-11-04T07:41:00Z");
  const h = uebersichtKopf({ firma: "Muster <GmbH>", jetzt, neu: 3, bald: 2, angebote: 1, naechste: { id: "abc", titel: "Reinigung <Schule>", frist: "2026-11-07T10:00:00Z", punkte: 9, status: "angebot" } });
  assert.match(h, /Mittwoch, 4\. November · Muster &#60;GmbH&#62; · 3 neue passende Aufträge/);
  assert.match(h, /<strong>3<\/strong><span>neue Treffer<\/span>/);
  assert.match(h, /class="frist-pille knapp">.*in 3 Tagen/);
  assert.match(h, /Reinigung &#60;Schule&#62;/);
  assert.match(h, /href="\/konto\/vorgang\/abc">Angebot weiterschreiben/);
  assert.match(uebersichtKopf({ firma: "F", jetzt, neu: 0, bald: 0, angebote: 0, naechste: { id: "x", titel: "T", frist: "2026-11-30T10:00:00Z", punkte: null, status: "neu" } }), /Ausschreibung öffnen[\s\S]*Keine neuen Treffer|Keine neuen Treffer[\s\S]*Ausschreibung öffnen/);
  assert.doesNotMatch(uebersichtKopf({ firma: "F", jetzt, neu: 0, bald: 0, angebote: 0, naechste: null }), /naechste-frist/);
  const en = uebersetzen(seite("x", uebersichtKopf({ firma: "F", jetzt, neu: 3, bald: 2, angebote: 1, sprache: "en", naechste: { id: "a", titel: "T", frist: "2026-11-07T10:00:00Z", punkte: 9, status: "angebot" } })), "en");
  for (const t of ["Wednesday 4 November", "3 new matching tenders", "new matches", "deadlines in 7 days", "bids in progress", "Next deadline", "Continue the bid", "9/10 match"]) assert.ok(en.includes(t), t);
});

import { fristAnteil, fristBalken, leitstand, punkteBalken, siebenTage } from "../src/uebersicht.ts";
test("Schritt 3: Punkte-Balken, Fristen-Balken und Leitstand", () => {
  assert.equal((punkteBalken(7).match(/class="an"/g) ?? []).length, 7);
  assert.equal((punkteBalken(12).match(/<i/g) ?? []).length, 10);
  const jetzt = Date.parse("2026-11-04T12:00:00Z");
  assert.equal(fristAnteil("2026-11-01T12:00:00Z", "2026-11-07T12:00:00Z", jetzt), 50);
  assert.equal(fristAnteil("2026-11-01T12:00:00Z", "2026-11-02T12:00:00Z", jetzt), 100);
  assert.equal(fristAnteil("x", "y", jetzt), 100);
  assert.match(fristBalken("2026-11-01T12:00:00Z", "2026-11-07T12:00:00Z", "rot", jetzt), /frist-balken frist-rot.*width:50%/);
  const tage = siebenTage(["2026-11-04T06:00:00Z", "2026-11-04T07:00:00Z", "2026-11-01T10:00:00Z", "2026-10-20T10:00:00Z"], new Date(jetzt));
  assert.equal(tage.length, 7);
  assert.deepEqual(tage.map((t) => t.anzahl), [0, 0, 0, 1, 0, 0, 2]);
  const l = leitstand({ erstellt: ["2026-11-04T06:00:00Z"], fristen: [{ id: "a", titel: "Reinigung", frist: "2026-11-06T10:00:00Z" }, { id: "b", titel: "Später", frist: "2027-02-01T10:00:00Z" }], jetzt: new Date(jetzt) });
  assert.match(l, /nur-technik/);
  assert.match(l, /Σ 1/);
  assert.match(l, /href="\/konto\/vorgang\/a"[\s\S]*Reinigung[\s\S]*2 T/);
  assert.doesNotMatch(l, /Später/, "nur 30 Tage");
  assert.match(l, /<b>MI<\/b>/);
});

import { kachelSymbole, textSymbole } from "../src/symbole.ts";
test("Schritt 4: Emojis in Überschriften, Reitern und Listen werden Liniensymbole (nach der Übersetzung)", () => {
  assert.match(textSymbole("<h2>🎨 Appearance</h2>"), /<h2><span class="titel-symbol" aria-hidden="true"><svg[\s\S]*<\/span>Appearance<\/h2>/);
  assert.equal(textSymbole("<h2>Ohne Emoji</h2>"), "<h2>Ohne Emoji</h2>");
  assert.equal(textSymbole("<h2>🤖 KI</h2>"), "<h2>🤖 KI</h2>", "unbekannte Emojis bleiben");
  const chips = textSymbole('<nav class="ordner-chips" aria-label="Ansicht"><a href="/a">Urlaubskonto</a><a href="/b">📅 Teamkalender</a><a href="/c">🟢 Frei</a></nav><a href="/x">📅 außerhalb</a>');
  assert.match(chips, /<a href="\/b"><span class="chip-symbol"[\s\S]*<\/span>Teamkalender<\/a>/);
  assert.match(chips, /🟢 Frei/);
  assert.match(chips, /📅 außerhalb/, "nur in den Reitern");
  assert.match(kachelSymbole('<span class="standort-icon" aria-hidden="true">🏛️</span>'), /zeilen-symbol[\s\S]*<svg/);
});
