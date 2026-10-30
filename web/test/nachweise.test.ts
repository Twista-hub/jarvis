import assert from "node:assert/strict";
import { test } from "node:test";
import { angebotsText, passendeNachweise, preise } from "../src/angebotsauswahl.ts";
import type { FirmenDatei } from "../src/firmenunterlagen.ts";
import { nachweiseMarkieren } from "../src/nachweise.ts";
import { markdown } from "../src/seite.ts";

const datei = (name: string, gueltig: string | null = null): FirmenDatei => ({ id: crypto.randomUUID(), firma_id: "f", name, art: "nachweis", dateiname: "x.pdf", mime: "application/pdf", groesse: 1, gueltig_bis: gueltig });
const brief = `## Was man vorweisen muss\n\n- Gültige Erlaubnis zur Arbeitnehmerüberlassung\n- 3 Referenzen über ANÜ\n- Betriebshaftpflicht: nicht angegeben\n\n## Passt das?\n\n- Referenzen sind gut`;

test("marks missing proofs with a pop-up and present ones with a tick, only in the proof section", () => {
  const html = nachweiseMarkieren(markdown(brief), [datei("AÜG-Erlaubnis")], "2026-11-01", "/konto/firmenunterlagen?firma=f");
  assert.match(html, /Arbeitnehmerüberlassung <span class="nachweis-ok"/);
  assert.match(html, /Referenzen<\/strong> ist noch nicht in deinen Firmenunterlagen/);
  assert.match(html, /name=Referenzen/);
  assert.doesNotMatch(html, /Betriebshaftpflicht: nicht angegeben <details/);
  assert.equal((html.match(/nachweis-fehlt/g) ?? []).length, 1); // the "Passt das?" section stays untouched
});

test("expired proofs count as missing", () => {
  const html = nachweiseMarkieren(markdown(brief), [datei("AÜG Erlaubnis", "2026-01-01")], "2026-11-01", "/u");
  assert.match(html, /Erlaubnis zur Arbeitnehmerüberlassung<\/strong> ist noch nicht/);
});

test("tables get column labels so the phone can stack them", () => {
  const html = markdown("| Los | Funktion |\n|---|---|\n| 1 | Koch |");
  assert.match(html, /<table class="stapel">/);
  assert.match(html, /<td data-label="Los">1<\/td>/);
  assert.match(html, /<td data-label="Funktion">Koch<\/td>/);
});

test("offer text from chosen lots has prices and no placeholders", () => {
  const p = preise([{ nr: "1", name: "Koch", menge: 100, einheit: "Stunden", zeitraum: "", hinweis: "" }], null, null);
  const text = angebotsText({ titel: "Gastro", firma: "PerLease", zeilen: p.zeilen, proStunde: p.proStunde, nachweise: ["AÜG-Erlaubnis"] });
  assert.match(text, /\| 1 \| Koch \| 100 Stunden \|/);
  assert.match(text, /Gesamt netto/);
  assert.match(text, /Beigefügte Nachweise: AÜG-Erlaubnis/);
  assert.doesNotMatch(text, /\[\[|\{\{/);
  const n = passendeNachweise(brief, [datei("AÜG-Erlaubnis")], "2026-11-01");
  assert.equal(n.ids.length, 1);
  assert.deepEqual(n.fehlen, ["Referenzen"]);
});
