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

import { probeHinweis } from "../src/konto.ts";
test("KI-Kostenbremse: Hinweis erst, wenn das Monatskontingent des Plans aufgebraucht ist", () => {
  assert.equal(probeHinweis({ budget: 25, verbraucht: 10, monatlich: true }), "");
  assert.match(probeHinweis({ budget: 25, verbraucht: 25, monatlich: true }), /für diesen Monat aufgebraucht[\s\S]*\/konto\/plan/);
  assert.match(probeHinweis({ budget: 0, verbraucht: 0 }), /Demo-Modus/);
  assert.equal(probeHinweis({ budget: null, verbraucht: 3 }), "", "ohne Grenze kein Hinweis");
});

import Anthropic from "@anthropic-ai/sdk";
import { KI_SPERRE, KiBudgetFehler, kiFehlerart, kiFehlermeldung, kiSperrText } from "../src/ki-fehler.ts";
import { belegeSeite } from "../src/belege.ts";
test("KI-Kostenbremse: Hinweis nennt den Grund (Gratis-Topf, Tages-/Monatsgrenze, Plan, Probezeit)", () => {
  assert.match(probeHinweis({ budget: 5.5, verbraucht: 1, sperre: "topf" }), /Gratis-Konten[\s\S]*\/konto\/plan/);
  assert.match(probeHinweis({ budget: 25, verbraucht: 3, monatlich: true, sperre: "tag" }), /für heute ausgelastet/);
  assert.doesNotMatch(probeHinweis({ budget: 25, verbraucht: 3, monatlich: true, sperre: "tag" }), /konto\/plan/, "Tagesgrenze ist nicht Sache des Kunden");
  assert.match(probeHinweis({ budget: null, verbraucht: 3, sperre: "monat" }), /für diesen Monat ausgelastet/, "auch Firmen ohne Grenze erfahren es");
  assert.match(probeHinweis({ budget: 25, verbraucht: 25, monatlich: true, sperre: "plan" }), /Plans[\s\S]*Plan wechseln/);
  assert.match(probeHinweis({ budget: 5.5, verbraucht: 5.5, sperre: "probe" }), /Probezeit[\s\S]*Pläne ansehen/);
  assert.match(probeHinweis({ budget: 0, verbraucht: 0, sperre: "demo" }), /Demo-Modus/);
  assert.equal(probeHinweis({ budget: 5.5, verbraucht: 1, sperre: null }), "");
  assert.equal(probeHinweis({ budget: 5.5, verbraucht: 1, sperre: "unsinn" }), "", "unbekannter Grund wird ignoriert");
});

test("KI-Kostenbremse: Fehlermeldung mit Grund kommt durch den SDK-Fehler hindurch", () => {
  const e = new Anthropic.APIConnectionError({ cause: new KiBudgetFehler("topf") });
  assert.equal(kiFehlerart(e), "budget");
  assert.equal(kiSperrText(e), KI_SPERRE.topf);
  assert.match(kiFehlermeldung(e), /Gratis-Konten.*Angaben bleiben erhalten/);
  assert.match(new KiBudgetFehler(null).message, /^KI-Budget: /);
  assert.equal(kiSperrText(new Error("Connection error")), null);
  assert.match(kiFehlermeldung(new Error("KI-Budget")), /Demo-Modus/, "gespeicherter Fehler ohne Grund: bisheriger Text");
});

test("Belege: Ist die KI pausiert, steht der Grund statt 'nicht lesbar'", () => {
  const h = belegeSeite([], { monat: "2026-11", heute: "2026-11-06", kiAn: true, vorschlag: { g: null, dateiId: "x", mime: "image/png", sperre: KI_SPERRE.tag } });
  assert.match(h, /für heute ausgelastet/);
  assert.doesNotMatch(h, /konnte nicht gelesen werden/);
});

import { GUTHABEN_TEXT, istGuthabenFehler } from "../src/ki-fehler.ts";
test("Guthaben beim KI-Anbieter leer: klare Meldung statt 'nicht abgeschlossen'", () => {
  const api = Object.assign(new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'), { status: 400 });
  assert.equal(istGuthabenFehler(api), true);
  assert.equal(kiFehlerart(api), "budget");
  assert.equal(kiSperrText(api), GUTHABEN_TEXT);
  assert.match(kiFehlermeldung(api), /gerade nicht verfügbar/);
  assert.match(kiFehlermeldung(new Error("KI-Budget Your credit balance is too low")), /gerade nicht verfügbar/, "gespeicherter Fehler beim Wiederaufruf");
  assert.equal(istGuthabenFehler(new Error("Connection error")), false);
});
