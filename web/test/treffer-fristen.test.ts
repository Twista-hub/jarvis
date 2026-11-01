import assert from "node:assert/strict";
import { test } from "node:test";
import { auftragswert, bewertung, eckdaten, sortieren, suchbegriff } from "../src/treffer.ts";
import { abstand, ampel, fristenSeite, gruppen, ics, icsKalender, offenePunkte } from "../src/fristen.ts";
import { berlinZuUtc } from "../src/konto.ts";

const brief = "## Jarvis-Bewertung\n\n**Gesucht:** Servicekräfte\n\n**Warum passend:** Kerngeschäft.\n\n## Kurzüberblick\n\n**Ort:** Bonn\n\n**Lose:** 2 (Küche; Service)\n\n**Geschätzter Auftragswert:** 450.000 €\n\n**Laufzeit:** 730 Tage\n\n";

test("Trefferkarte liest Eckdaten und zweiteilige Bewertung", () => {
  assert.deepEqual(eckdaten(brief).map((e) => e.wert), ["2 Lose", "450.000 €", "730 Tage", "Bonn"]);
  assert.equal(auftragswert(brief), 450000);
  assert.deepEqual(bewertung(brief), { gesucht: "Servicekräfte", warum: "Kerngeschäft." });
  assert.equal(suchbegriff("küche*,(x)"), "küche x");
});

test("Sortierung nach Frist und Auftragswert", () => {
  const a = { punkte: 9, frist: "2026-12-01", erstellt: "1", steckbrief: "" };
  const b = { punkte: 6, frist: "2026-11-05", erstellt: "2", steckbrief: brief };
  assert.deepEqual(sortieren([a, b], "frist"), [b, a]);
  assert.deepEqual(sortieren([a, b], "wert"), [b, a]);
  assert.deepEqual(sortieren([b, a], "punkte"), [a, b]);
});

test("Fristen: Ampel, Abstand, Wochengruppen, Kalenderdatei", () => {
  const jetzt = Date.parse("2026-11-02T08:00:00Z"); // Monday
  const v = (id: string, frist: string, status = "neu") => ({ id, titel: `Auftrag ${id}`, frist, status });
  assert.equal(ampel(v("a", "2026-11-03T10:00:00Z"), jetzt), "rot");
  assert.equal(ampel(v("b", "2026-11-06T10:00:00Z"), jetzt), "gelb");
  assert.equal(ampel(v("c", "2026-11-20T10:00:00Z"), jetzt), "gruen");
  assert.equal(ampel(v("d", "2026-11-03T10:00:00Z", "abgegeben"), jetzt), "grau");
  assert.equal(abstand("2026-11-03T10:00:00Z", jetzt), "morgen");
  assert.deepEqual(gruppen([v("a", "2026-11-04T10:00:00Z"), v("b", "2026-11-10T10:00:00Z"), v("c", "2026-11-30T10:00:00Z")], jetzt).map(([t, l]) => [t, l.length]), [["Diese Woche", 1], ["Nächste Woche", 1], ["Später", 1]]);
  const datei = ics(v("a", "2026-11-03T10:00:00Z"), "https://app.test/konto/vorgang/a", new Date(jetzt));
  assert.match(datei, /DTSTART:20261103T100000Z/);
  assert.match(datei, /TRIGGER:-P1D/);
  assert.deepEqual(offenePunkte({ ...v("a", "2026-11-03"), kaufverantwortlich_id: "x" }, true), ["Entscheidung offen"]);
});

import { kalkulationCsv, rechnen, STANDARD, szenarien, verrechnungssatz, zusammenfassung } from "../src/kalkulation.ts";

test("Kalkulation: Live-Satz, Kurzübersicht, Szenarien und CSV", () => {
  assert.equal(verrechnungssatz(STANDARD), rechnen(STANDARD, [], {}).preisProStunde);
  assert.match(zusammenfassung(STANDARD, "Lohn"), /€ · .* %/);
  const [knapp, normal, sicher] = szenarien(STANDARD, [], {}, {});
  assert.ok(knapp.preis < normal.preis && normal.preis < sicher.preis);
  const csv = kalkulationCsv(rechnen(STANDARD, [{ nr: "1", name: "Service", menge: 100, einheit: "Stunden", zeitraum: "", hinweis: "" }], { "1": 100 }));
  assert.match(csv, /"Angebotspreis pro Stunde netto";"\d+,\d\d"/);
  assert.match(csv, /"1";"Service"/);
});


test("Eckdaten aus ausführlichem Steckbrief, Nähe-Sortierung und Fragefristen", () => {
  const voll = "## Auf einen Blick\n\n| | |\n|---|---|\n| **Laufzeit** | 2 Jahre (730 Tage) je Los |\n| **Umfang** | 18 Lose, zusammen ca. 21.630 Stunden. **Eigene Schätzung:** ca. 0,7–1,0 Mio. € netto |\n";
  assert.deepEqual(eckdaten(voll).map((e) => e.wert), ["18 Lose", "ca. 21.630", "ca. 0,7–1,0 Mio. €", "2 Jahre"]);
  const nah = { punkte: 5, frist: null, erstellt: "1", entfernung_km: 12 };
  const fern = { punkte: 9, frist: null, erstellt: "2", entfernung_km: 140 };
  assert.deepEqual(sortieren([fern, nah], "naehe"), [nah, fern]);
  const html = fristenSeite([{ id: "a", titel: "Auftrag", frist: "2026-11-20T10:00:00Z", fragefrist: "2026-11-10T10:00:00Z", status: "neu" }],
    { erledigte: false, monat: "2026-11", zustaendig: () => "", kalkuliert: new Set(), jetzt: Date.parse("2026-11-02T08:00:00Z") });
  assert.match(html, /❓ Fragen bis/);
  assert.equal((html.match(/class="frist /g) ?? []).length, 2);
});

test("D1–D5: Tagesfilter, eigene Termine, Fragefristen, Zeitleiste und Kalender-Abo", () => {
  const jetzt = Date.parse("2026-11-01T08:00:00Z");
  const html = fristenSeite(
    [{ id: "v1", titel: "Rathaus reinigen", status: "neu", frist: "2026-11-10T10:00:00Z", fragefrist: "2026-11-05T10:00:00Z" } as never],
    { erledigte: false, monat: "2026-11", zustaendig: () => "", kalkuliert: new Set(), jetzt, tag: "2026-11-05",
      eigene: [{ id: "t1", titel: "Ortstermin", status: "neu", frist: "2026-11-05T13:00:00Z", art: "eigen" } as never] },
  );
  assert.match(html, /Fragen bis/);
  assert.match(html, /Eigener Termin/);
  assert.match(html, /✕ Alle zeigen/);
  assert.doesNotMatch(html, /frist-v1"/); // Abgabe am 10. ist am 5. ausgefiltert
  assert.match(html, /class="zeitleiste"/);
  assert.match(html, /tag=2026-11-05[^"]*"[^>]*class="[^"]*gewaehlt|gewaehlt[^>]*tag=2026-11-05/);
  const ics = icsKalender([{ uid: "a", titel: "Frist, Rathaus", zeit: "2026-11-10T10:00:00Z", text: "x", url: "https://x" }]);
  assert.match(ics, /X-WR-CALNAME:Jarvis Fristen/);
  assert.match(ics, /Frist\\, Rathaus/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.equal(berlinZuUtc("2026-11-05T14:00"), "2026-11-05T13:00:00.000Z");
  assert.equal(berlinZuUtc("2026-07-05T14:00"), "2026-07-05T12:00:00.000Z");
});
