import assert from "node:assert/strict";
import { test } from "node:test";
import { einsatzkraefteZusatz } from "../src/plaene.ts";

test("Zusatzpreis je Einsatzkraft: Pro 3,50 €, Business 3 €, ab der 501. 2,50 €", () => {
  assert.equal(einsatzkraefteZusatz("pro", 25), 0);
  assert.equal(einsatzkraefteZusatz("pro", 35), 35);
  assert.equal(einsatzkraefteZusatz("business", 80), 0);
  assert.equal(einsatzkraefteZusatz("business", 300), 600);
  assert.equal(einsatzkraefteZusatz("business", 500), 1200);
  assert.equal(399 + einsatzkraefteZusatz("business", 1000), 2849);
  assert.equal(einsatzkraefteZusatz("basis", 10), 0);
});

import { PLAENE, jahrespreis, planKarten, planSeite, preisText } from "../src/plaene.ts";
import { bestellMail, preisSeiteInhalt } from "../src/preise.ts";
test("Preise: 59/149/399 €, Jahr = 10 Monate, Bestellung per Rechnung", () => {
  assert.deepEqual(PLAENE.map((p) => p.monat), [0, 59, 149, 399]);
  assert.equal(jahrespreis(149), 1490);
  assert.equal(preisText(PLAENE[2]), "149 € / Monat");
  assert.equal(preisText(PLAENE[3], true), "3.990 € / Jahr");
  const seite = preisSeiteInhalt();
  assert.match(seite, /Kleinunternehmer nach § 19 UStG/);
  assert.match(seite, /oder 1\.490 € \/ Jahr \(2 Monate geschenkt\)/);
  assert.match(seite, /Bezahlung per Rechnung und Überweisung/);
  assert.doesNotMatch(seite, /<form/, "öffentlich ohne Bestellformular");
  const plan = planSeite("basis", "Muster GmbH", true);
  assert.match(plan, /✓ Dein aktueller Plan/);
  assert.equal((plan.match(/<form method="post" action="\/konto\/plan"/g) ?? []).length, 2, "Pro und Business bestellbar, Basis ist aktuell");
  assert.match(plan, /name="zahlweise" value="jahr">1\.490 € \/ Jahr, 2 Monate geschenkt/);
  assert.doesNotMatch(planSeite("basis", "X", false), /<form/, "nur Inhaber/Admin bestellen");
  assert.match(planKarten(), /plan-empfohlen[\s\S]*Beliebt/);
  const m = bestellMail({ firma: "Muster\nGmbH", email: "chef@muster.de", plan: "pro", zahlweise: "jahr", firmaId: "f1" });
  assert.equal(m.to, "kontakt@wpdigitalranger.com");
  assert.equal(m.reply.email, "chef@muster.de");
  assert.match(m.subject, /^Bestellung: Pro \(jährlich\) – Muster GmbH$/);
  assert.match(m.text, /Betrag: 1490 € pro Jahr/);
  assert.match(m.text, /konto\/betreiber\/rechnungen/);
});
