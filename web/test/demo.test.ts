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

import { demoKatalogSeite, demoSuchSeite, suchFormular } from "../src/demo.ts";
test("Demo: Suche in echten Bekanntmachungen und Beispiel-Steckbriefe, ohne Kundendaten", () => {
  const t = { id: "bks:abc/1", titel: "Unterhaltsreinigung <Rathaus>", auftraggeber: "Stadt Köln", ort: "Köln", frist: "2026-12-01T10:00:00Z", link: "https://x.test", status: "offen", quelle: "bks", steckbrief: true };
  const h = demoSuchSeite({ q: "Reinigung", ort: "Köln", alle: false, treffer: [t], beispiele: [] });
  assert.match(h, /href="\/demo\/katalog\/bks%3Aabc%2F1"/);
  assert.match(h, /Unterhaltsreinigung &#60;Rathaus&#62;/);
  assert.match(h, /Beispiel-Steckbrief/);
  assert.match(h, /Passt das zu deiner Firma\?/);
  assert.match(h, /data-demo-frei/, "Suchformular ist in der Demo erlaubt");
  assert.match(demoSuchSeite({ q: "x", ort: "", alle: false, treffer: [], beispiele: [] }), /Keine offenen Ausschreibungen gefunden/);
  assert.match(demoSuchSeite({ q: "", ort: "", alle: false, treffer: null, beispiele: [] }), /nicht erreichbar/);
  assert.match(suchFormular("a\"b", "", true), /value="a(&quot;|&#34;)b"[\s\S]*checked/);
  const d = demoKatalogSeite({ id: "bks:1", titel: "T", auftraggeber: "Stadt", ort: "Köln", frist: null, link: "https://x.test", steckbrief: "# Steckbrief\n\nAnsprechpartner Herr Max Mustermann, max.mustermann@stadt.de\n\n## Auf einen Blick\n\nReinigung" });
  assert.match(d, /Beispiel-Steckbrief/);
  assert.match(d, /Herr \[Name\]/, "Namen bleiben ausgeblendet");
  assert.doesNotMatch(d, /Mustermann/);
  const ohne = demoKatalogSeite({ id: "bks:2", titel: "T", frist: null, link: "", beschreibung: "Leistung\n\nKontakt Frau Erika Muster", lose: ["Los 1 Schule"], steckbrief: null });
  assert.match(ohne, /keinen Steckbrief/);
  assert.match(ohne, /Los 1 Schule/);
  assert.doesNotMatch(ohne, /Erika/);
});

test("Demo: neue Übersicht mit Kennzahlen, nächster Frist und Darstellung; Fristen-Seite", () => {
  const s = demoSeite("/demo", "2026-11-04", muster)!;
  assert.match(s.titel, /^Guten (Morgen|Tag|Abend), Eva$/);
  assert.match(s.inhalt, /class="kennzahlen"/);
  assert.match(s.inhalt, /Nächste Frist/);
  assert.match(s.inhalt, /data-darstellung="theme"/);
  assert.match(s.inhalt, /action="\/demo\/suche"/);
  const links = demoLinks(`<body>${s.inhalt}</body>`);
  assert.match(links, /href="\/demo\/fristen"/);
  assert.doesNotMatch(links, /href="\/konto/);
  assert.match(demoSeite("/demo/fristen", "2026-11-04", muster)!.inhalt, /Unterhaltsreinigung Schulen/);
});
