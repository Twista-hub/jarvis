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
