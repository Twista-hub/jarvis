import test from "node:test";
import assert from "node:assert/strict";
import { portalSeite, portalVerwaltung, type PortalDaten } from "../src/kundenportal.ts";

const d: PortalDaten = {
  firma: "Perlease GmbH", kunde: "Messe <Berlin>", kleinunternehmer: false,
  nachweise: [{ monat: "2026-10", titel: "Messe Berlin", summe: { std: 12.5 }, bestaetigt_am: "2026-11-02T10:00:00Z", rueckfrage: false, abgelaufen: false }],
  rechnungen: [{ nummer: "RE-2026-0002", datum: "2026-10-01", monat: "2026-10", netto: "100.00", ust_satz: 19, bezahlt_am: null, zahlungsziel_tage: 14 }],
  orte: [{ name: "Halle 3", scans: 42, letzter: "2026-11-03T21:15:00Z" }],
  vorfaelle: [{ zeit: "2026-11-03T21:20:00Z", ort: "Halle 3", text: "Tür <3> offen" }],
  meldungen: [{ art: "mangel", text: "Mülleimer voll", erstellt: "2026-11-03T08:00:00Z", erledigt_am: null }],
};

test("Kunden-Portal: öffentliche Seite", () => {
  const html = portalSeite(d, "t".repeat(32), "2026-11-03");
  assert.match(html, /Messe &#60;Berlin&#62;/);
  assert.match(html, /12,50 Std\. · ✅ bestätigt am 02\.11\.2026/);
  assert.match(html, /RE-2026-0002 · 119,00\s€/);
  assert.match(html, /⏰ fällig seit 15\.10\.2026/);
  assert.match(html, /<td>Halle 3<\/td><td>42<\/td>/);
  assert.doesNotMatch(html, /Tür/, "Vorfall-Text geht nicht ins Kundenportal");
  assert.match(html, /Einzelheiten zu Vorfällen erhalten Sie direkt/);
  assert.match(html, /action="\/portal\/t{32}"/);
  assert.match(html, /⏳ in Bearbeitung/);
  const ohne = portalSeite({ ...d, rechnungen: null, orte: null, vorfaelle: null, kleinunternehmer: true }, "x".repeat(32), "2026-11-03");
  assert.doesNotMatch(ohne, /Rechnungen|Kontrollgänge/, "abgeschaltete Bereiche fehlen ganz");
  assert.match(portalSeite({ ...d, kleinunternehmer: true }, "x".repeat(32), "2026-11-03"), /RE-2026-0002 · 100,00\s€/, "Kleinunternehmer ohne USt");
});

test("Kunden-Portal: Verwaltung im Büro", () => {
  const kunden = [{ id: "k1", name: "Messe Berlin" }, { id: "k2", name: "Hotel Adlon" }];
  const portale = [{ id: "p1", kunde_id: "k1", aktiv: true, rechnungen_zeigen: false, berichte_zeigen: true, erstellt: "2026-11-03T08:00:00Z" }];
  const meldungen = [{ id: "m1", kunde_id: "k1", art: "mangel", text: "Mülleimer <voll>", name: "Frau Meier", erstellt: "2026-11-03T08:00:00Z", erledigt_am: null }];
  const html = portalVerwaltung(kunden, portale, meldungen, { darf: true, finanzen: false });
  assert.match(html, /\(1 offen\)/);
  assert.match(html, /Mülleimer &#60;voll&#62;/);
  assert.match(html, /name="erledigt" value="m1"/);
  assert.match(html, /<span class="klein">○ Rechnungen<\/span>/, "ohne Finanzfreigabe kein Rechnungs-Schalter");
  assert.match(html, /name="berichte" value="0"/);
  assert.match(html, /name="neu" value="k2"[\s\S]*Portal-Link erstellen/);
  assert.match(portalVerwaltung(kunden, portale, meldungen, { darf: true, finanzen: true }), /name="rechnungen" value="1"/);
  assert.doesNotMatch(portalVerwaltung(kunden, portale, meldungen, { darf: false, finanzen: false }), /<form/, "Leser ändern nichts");
});
