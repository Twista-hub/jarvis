import assert from "node:assert/strict";
import { test } from "node:test";
import { bestaetigung, frage, zusammenfassung } from "../src/zugriff.ts";

test("Rechte: Zusammenfassung in Worten und Bestätigungsseite", () => {
  const ma = zusammenfassung("mitarbeiter", "nur Berlin", false);
  assert.match(ma, /Ausschreibungen sehen: nur einzeln freigegebene/);
  assert.match(ma, /🚫 Kalkulation, Preise, Umsatz/);
  const be = zusammenfassung("bearbeiter", "nur Berlin", false);
  assert.match(be, /✅ Ausschreibungen sehen \(nur Berlin\)/);
  assert.match(be, /🚫 Kalkulation, Preise, Umsatz \(keine Finanzfreigabe\)/);
  assert.match(be, /🚫 Angebot freigeben/);
  assert.match(zusammenfassung("leser", "ganze Firma", true), /✅ Kalkulation, Preise, Umsatz \(Finanzen freigegeben\)/);
  const f = new FormData(); f.set("rolle", "bearbeiter"); f.set("bereich", "firma"); f.set("email", "a@b.de"); f.set("bestaetigt", "0");
  const s = bestaetigung({ action: "/konto/einladen", form: f, titel: "einlädst", zeilen: [["E-Mail", "a@b.de"]], rolle: "bearbeiter", bereich: "ganze Firma", finanzen: false, zurueck: "/konto/team#einladen", knopf: "✅ Ja, so einladen" });
  assert.match(s, /⚠️ Ganze Firma/);
  assert.match(s, /name="bereich" value="firma"/);
  assert.match(s, /name="bestaetigt" value="1"/);
  assert.equal((s.match(/name="bestaetigt"/g) ?? []).length, 1);
  assert.match(s, /<th>Finanzen<\/th><td>nein/);
  assert.match(bestaetigung({ action: "/x", form: new FormData(), titel: "x", zeilen: [], rolle: "admin", bereich: "nur Berlin", finanzen: false, zurueck: "/", knopf: "ok" }), /<th>Bereich<\/th><td>ganze Firma \(immer[\s\S]*⚠️ Administration/);
  const q = frage("fz", "Welcher Zugriff?", "<p>x</p>");
  assert.match(q.knopf, /popovertarget="fz"[^>]*>\?<\/button>/);
  assert.match(q.popup, /id="fz" popover/);
});
