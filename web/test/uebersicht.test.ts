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
