import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_SEITEN, demoLinks, demoSeite } from "../src/demo.ts";

const muster = "## Auf einen Blick\n\n| | |\n|---|---|\n| **Umfang** | 2 Lose, ca. 10.000 Stunden |\n\n## Die Lose\n\n| Los | Leistung |\n|---|---|\n| 1 | Küche |";

test("Demo: alle Seiten mit Beispieldaten, keine Links in echte Konten", () => {
  for (const k of ["", ...Object.keys(DEMO_SEITEN), "ausschreibung/00000000-0000-4000-8000-000000000001", "ausschreibung/00000000-0000-4000-8000-000000000002"]) {
    const s = demoSeite(`/demo/${k}`, "2026-11-04", muster);
    assert.ok(s, k);
    assert.match(s!.inhalt, /Demo mit Beispieldaten/, k);
    const html = demoLinks(`<body>${s!.inhalt}</body>`);
    assert.doesNotMatch(html, /href="\/konto/, k);
    assert.match(html, /<body data-demo/);
  }
  assert.equal(demoSeite("/demo/gibtsnicht", "2026-11-04", muster), null);
  assert.equal(demoSeite("/demo/ausschreibung/00000000-0000-4000-8000-000000000009", "2026-11-04", muster), null);
  assert.match(demoSeite("/demo/treffer", "2026-11-04", muster)!.inhalt, /Muster|Unterhaltsreinigung/);
  assert.match(demoLinks('<a href="/konto/vorgang/00000000-0000-4000-8000-000000000002?x=1">'), /href="\/demo\/ausschreibung\/00000000-0000-4000-8000-000000000002"/);
  assert.match(demoLinks('<a href="/konto/ich">'), /href="\/demo\/app"/);
  assert.match(demoLinks('<a href="/konto/kalkulation">'), /href="\/demo"/);
  assert.match(demoSeite("/demo/ausschreibung/00000000-0000-4000-8000-000000000002", "2026-11-04", muster)!.inhalt, /class="frage-mini"/, "Download-Symbole ohne Unterlagen");
  assert.match(demoSeite("/demo/app", "2026-11-04", muster, "pl")!.inhalt, /sprache=pl/);
});
