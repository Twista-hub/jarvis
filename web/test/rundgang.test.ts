import test from "node:test";
import assert from "node:assert/strict";
import { qrBogen, rundgangSeite, scanLink, scanSeite } from "../src/rundgang.ts";

const orte = [{ id: "o1", name: "Messe Halle 3" }];
const punkte = [{ id: "p1", einsatzort_id: "o1", name: "Notausgang <Nord>", token: "a".repeat(32) }];

test("Rundgänge & Wachbuch: Büro-Seite, QR-Bogen, Scan-Seite", () => {
  const html = rundgangSeite(orte, punkte, [{ zeit: "2026-11-03T21:15:00Z", kontrollpunkt_id: "p1", personal_id: "x" }], [{ zeit: "2026-11-03T21:20:00Z", art: "vorfall", text: "Tür 3 offen", einsatzort_id: "o1", personal_id: "x" }], [{ id: "x", vorname: "Ali", nachname: "Kaya" }], true);
  assert.match(html, /Notausgang &#60;Nord&#62;/);
  assert.match(html, /1 Scans in 7 Tagen/);
  assert.match(html, /<td>03\.11\., 22:15<\/td><td>Notausgang &#60;Nord&#62;<\/td><td>Messe Halle 3<\/td><td>Ali Kaya<\/td>/);
  assert.match(html, /⚠️ Vorfall/);
  assert.match(html, /href="\/konto\/rundgaenge\/qr\?ort=o1"/);
  assert.doesNotMatch(rundgangSeite(orte, punkte, [], [], [], false), /name="weg"/, "Lesende können nichts löschen");
  assert.equal(scanLink("a".repeat(32)), `https://crewtender.eu/k/${"a".repeat(32)}`);
  assert.match(qrBogen(orte[0], punkte), /<svg class="qr"/);
  assert.match(scanSeite({ punkt: "Notausgang Nord", ort: "Messe Halle 3", zeit: "2026-11-03T21:15:00Z" }, "a".repeat(32)), /✅ Notausgang Nord[\s\S]*name="text"/);
  assert.match(scanSeite(null, "x"), /nicht erkannt/);
});
