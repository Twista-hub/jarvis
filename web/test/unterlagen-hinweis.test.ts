import assert from "node:assert/strict";
import { test } from "node:test";
import { frageMarken, unterlagenHinweis } from "../src/konto.ts";

test("Fragezeichen hinter fehlenden oder vermuteten Angaben, Pop-up mit Holen und Hochladen", () => {
  const m = frageMarken(`<table><tr><td>Menge</td><td>nicht angegeben</td></tr></table><p>Vermutlich elektronisch. <a href="/x">nicht angegeben</a> Wochenende</p>`);
  assert.equal(m.anzahl, 2, "nicht im Link");
  assert.match(m.html, /<td>nicht angegeben<button type="button" class="frage-mini" popovertarget="unterlagen-frage"/);
  assert.match(m.html, /Vermutlich<button/);
  assert.equal(frageMarken("<p>Alles da, Lose 1 bis 3.</p>").anzahl, 0);
  const h = unterlagenHinweis("**Umfang:** nicht angegeben\n\n**Laufzeit:** nicht angegeben", "https://portal.example/a?b=1", true);
  assert.match(h, /id="unterlagen-frage" popover/);
  assert.match(h, /fehlen 2 Angaben, auch zu den Losen/);
  assert.match(h, /href="https:\/\/portal.example\/a\?b=1"[^>]*>⬇️ Unterlagen beim Portal holen/);
  assert.match(h, /href="#unterlagen">📥 Hier hochladen/);
  assert.match(h, /popovertargetaction="hide">Schließen/);
  const mitLosen = unterlagenHinweis("| Los | Leistung |\n|---|---|\n| 1 | Büro |", null, false);
  assert.doesNotMatch(mitLosen, /fehlen \d|fehlen eine|keine Lose|Portal holen|Hier hochladen/);
  assert.match(unterlagenHinweis("## Kurzüberblick\n\nReinigung", null, true), /nennt keine Lose/);
});
