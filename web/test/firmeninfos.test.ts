import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { firmenInfos } from "../src/firmeninfos.ts";

test("Firmenfunde sind direkt offen und lesbar; Bearbeitung und sichere Quellen bleiben verfügbar", () => {
  const { document } = parseHTML(firmenInfos({ website_beschreibung: "Fliesen und Mosaik.", websuche_beschreibung: "Öffentliche Recherche: Natursteinarbeiten.", websuche_quellen: [{ titel: "Leistungen", url: "https://firma.example/leistungen" }, { titel: "Unsicher", url: "javascript:alert(1)" }] }, true));
  assert.equal(document.querySelector("details.firmen-erkenntnisse")!.hasAttribute("open"), true);
  assert.equal(document.querySelectorAll("article.firmen-fund").length, 2);
  assert.match(document.querySelector(".firmen-fund-text")!.textContent!, /Fliesen und Mosaik/);
  assert.equal(document.querySelectorAll("textarea[name]").length, 2);
  assert.equal(document.querySelectorAll("nav a").length, 1);
  assert.equal(document.querySelector(".fund-bearbeiten")!.hasAttribute("open"), false);
});

test("belegte Firmenstandorte sind direkt sichtbar mit Quellen und Team-Link", () => {
  const { document } = parseHTML(firmenInfos({ firmenstandorte: [{ name: "Aachen", plz: "52062", quelle: "https://firma.example/standorte" }] }));
  assert.match(document.querySelector(".firmen-standorte")!.textContent!, /1 Firmenstandort gefunden/);
  assert.match(document.querySelector(".firmen-standorte")!.textContent!, /52062 Aachen/);
  assert.equal(document.querySelector('.firmen-standorte a[href="/konto/team"]')!.textContent, "Firma & Team öffnen");
  assert.match(document.querySelector(".firmen-standorte")!.textContent!, /Suchgebiet ändert sich dadurch nicht/);
});
