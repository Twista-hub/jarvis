import assert from "node:assert/strict";
import { test } from "node:test";
import { darf, grenzMeldung, planBanner, planBereich, platzFuer, steckbriefMeldung, type PlanStand } from "../src/plangrenzen.ts";
import { nutzungTeil, planSeite } from "../src/plaene.ts";
import { uebersetzen } from "../src/englisch.ts";

const stand = (plan: string, grenzen: PlanStand["grenzen"], genutzt: Partial<PlanStand["genutzt"]> = {}): PlanStand => ({
  plan, paket: plan === "probe" ? "kostenlos" : plan, probe_bis: plan === "probe" ? "2026-12-07T10:00:00Z" : null, grenzen,
  genutzt: { buero: 1, buero_offen: 0, einsatzkraefte: 0, einsatzkraefte_offen: 0, standorte: 1, steckbriefe: 0, ...genutzt },
});
const FREE = stand("kostenlos", { buero: 1, einsatzkraefte: 0, standorte: 1, steckbriefe: 0, arbeitsoberflaeche: 0, unterlagen: 0, laender: 1 });
const BASIS = stand("basis", { buero: 3, einsatzkraefte: 0, standorte: 1, steckbriefe: 5, arbeitsoberflaeche: 0, unterlagen: 1, laender: 2 }, { buero: 2, buero_offen: 1 });
const TEST = stand("test", { buero: null, einsatzkraefte: null, standorte: null, steckbriefe: null, arbeitsoberflaeche: 1, unterlagen: 1, laender: null });

test("Pro-Bereiche und Firmenunterlagen werden erkannt", () => {
  for (const p of ["/konto/personal", "/konto/personal/0f0e0d0c-0000-4000-8000-000000000001", "/konto/schichten", "/konto/stunden.xlsx", "/konto/lohn.csv", "/konto/rechnungen", "/konto/kunden",
    "/konto/angebote", "/konto/freigaben", "/konto/ich", "/konto/vorgang/0f0e0d0c-0000-4000-8000-000000000001/einsatzplan", "/konto/vorgang/0f0e0d0c-0000-4000-8000-000000000001/angebot"]) {
    assert.equal(planBereich(p), "arbeitsoberflaeche", p);
  }
  assert.equal(planBereich("/konto/firmenunterlagen"), "unterlagen");
  for (const p of ["/konto", "/konto/team", "/konto/suchprofil", "/konto/plan", "/konto/vorgang/0f0e0d0c-0000-4000-8000-000000000001", "/konto/kalkulation", "/konto/chat", "/konto/archiv.zip", "/konto/personalakte-x"]) {
    assert.equal(planBereich(p), null, p);
  }
});

test("Schalter und freie Plätze nach Plan", () => {
  assert.equal(darf(FREE, "arbeitsoberflaeche"), false);
  assert.equal(darf(BASIS, "unterlagen"), true);
  assert.equal(darf(null, "arbeitsoberflaeche"), true, "Plan unbekannt: nichts sperren");
  assert.equal(platzFuer(FREE, "buero"), false);
  assert.equal(platzFuer(BASIS, "buero"), false, "2 Nutzer + 1 offene Einladung = 3 von 3");
  assert.equal(platzFuer(BASIS, "buero", 0), true, "Erneut senden ersetzt die offene Einladung");
  assert.equal(platzFuer(TEST, "einsatzkraefte", 500), true);
});

test("Meldungen aus der Datenbank und für Steckbriefe", () => {
  assert.match(grenzMeldung('{"message":"Plan-Grenze: Büro-Nutzer","hint":"plan_grenze_buero"}') ?? "", /keine weiteren Büro-Nutzer/);
  assert.match(grenzMeldung("Plan-Grenze: Standorte") ?? "", /keine weiteren Standorte/);
  assert.equal(grenzMeldung("duplicate key"), null);
  assert.match(steckbriefMeldung("plan", FREE), /ab dem Plan Basis/);
  assert.match(steckbriefMeldung("grenze", BASIS), /Die 5 Steckbriefe/);
  assert.match(steckbriefMeldung("grenze", stand("probe", { steckbriefe: 10 })), /Probezeit sind 10/);
});

test("Plan-Seite zeigt Probezeit und Verbrauch, alles übersetzt", () => {
  const probe = stand("probe", { buero: 5, einsatzkraefte: 25, standorte: 5, steckbriefe: 10 }, { steckbriefe: 3 });
  const html = planSeite("kostenlos", "M", true, "", { stand: probe });
  assert.match(html, /Probezeit: alle Pro-Funktionen bis 7\.12\.2026/);
  assert.match(html, /Steckbriefe aus Unterlagen in der Probezeit: 3 von 10/);
  assert.equal(nutzungTeil(TEST), "", "unbegrenzt: keine Zählerzeilen");
  const en = uebersetzen(html + planBanner("arbeitsoberflaeche", "basis") + `<p>${steckbriefMeldung("grenze", BASIS)}</p>`, "en");
  for (const t of ["Trial: all Pro features until 7.12.2026", "Office users: 1 of 5", "Fact sheets from documents in the trial: 3 of 10", "are part of the Pro plan", "The 5 fact sheets from documents for this month are used up"]) assert.ok(en.includes(t), t);
  for (const s of ["fr", "pl", "es", "it"] as const) assert.ok(!uebersetzen(planBanner("unterlagen", "kostenlos"), s).includes("gehören zum Plan"), s);
});
