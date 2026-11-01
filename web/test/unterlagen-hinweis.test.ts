import assert from "node:assert/strict";
import { test } from "node:test";
import { unterlagenHinweis } from "../src/konto.ts";

test("Hinweis: Lose und Mengen stehen oft erst in den Vergabeunterlagen", () => {
  const h = unterlagenHinweis("**Umfang:** nicht angegeben\n\n**Laufzeit:** nicht angegeben", "https://portal.example/a?b=1", true);
  assert.match(h, /fehlen 2 Angaben/);
  assert.match(h, /auch zu den Losen/);
  assert.match(h, /href="https:\/\/portal.example\/a\?b=1"[^>]*>⬇️ Unterlagen beim Portal holen/);
  assert.match(h, /href="#unterlagen">📥 Hier hochladen/);
  const mitLosen = unterlagenHinweis("| Los | Leistung |\n|---|---|\n| 1 | Büro |", null, false);
  assert.doesNotMatch(mitLosen, /fehlen|keine Lose|Portal holen|Hier hochladen/);
  assert.match(unterlagenHinweis("## Kurzüberblick\n\nReinigung", null, true), /nennt keine Lose/);
});
