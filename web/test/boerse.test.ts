import test from "node:test";
import assert from "node:assert/strict";
import { BOERSE_AKTIV, boerse, boerseSeite, type Job } from "../src/boerse.ts";

const job = (id: string, firma_id: string, extra: Partial<Job> = {}): Job => ({ id, firma_id, titel: "Glasreinigung <Bürohaus>", gewerk: "Reinigung", plz: "10115", ort: "Berlin", von: "2026-12-01", bis: "2026-12-02", beschreibung: "2 Leute", status: "offen", ablauf: "2026-12-03", erstellt: "2026-11-03", ...extra });

test("Auftragsbörse ist abgeschaltet, bis AGB geprüft sind und Benjamin zustimmt", async () => {
  assert.equal(BOERSE_AKTIV, false);
  assert.equal(await boerse(new Request("https://app.example/konto/boerse"), { SUPABASE_URL: "x", SUPABASE_KEY: "y" }), null);
});

test("Auftragsbörse: Seite", () => {
  const html = boerseSeite({ firma: "F1", heute: "2026-11-03", gewerk: "", darf: true,
    jobs: [job("j1", "F2"), job("j2", "F1", { titel: "Eigener Auftrag" }), job("j3", "F3", { gewerk: "Elektro" })],
    interessen: [{ id: "i1", auftrag_id: "j2", firma_id: "F2", nachricht: "Haben Zeit", status: "angenommen", erstellt: "2026-11-03" }, { id: "i2", auftrag_id: "j3", firma_id: "F1", nachricht: "", status: "offen", erstellt: "2026-11-03" }],
    namen: new Map([["F2", "Sauber GmbH"], ["F3", "Strom AG"]]), kontakte: new Map([["i1", { firma: "Sauber GmbH", ort: "10115 Berlin", telefon: "030 123", email: "info@sauber.test" }]]) });
  assert.match(html, /Glasreinigung &#60;Bürohaus&#62;/);
  assert.match(html, /Sauber GmbH[\s\S]*name="interesse" value="j1"/);
  assert.match(html, /name="zurueckziehen" value="i2"/);
  assert.match(html, /Eigener Auftrag[\s\S]*1 Interessent[\s\S]*📞 030 123/);
  assert.match(html, /§ 13 MiLoG/);
  assert.match(html, /name="melden" value="j1"/);
  assert.match(html, /gewerk=Elektro/);
  const leser = boerseSeite({ firma: "F1", heute: "2026-11-03", gewerk: "Elektro", darf: false, jobs: [job("j1", "F2"), job("j3", "F3", { gewerk: "Elektro" })], interessen: [], namen: new Map(), kontakte: new Map() });
  assert.doesNotMatch(leser, /Auftrag einstellen|name="interesse"/);
  assert.doesNotMatch(leser, /value="j1"/, "Filter nach Gewerk");
});
