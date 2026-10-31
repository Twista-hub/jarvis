import assert from "node:assert/strict";
import { test } from "node:test";
import { importierbar, nachholLimit, releaseBloecke, normalisiereBlock } from "../src/katalog-plan.ts";
import { normalisieren } from "../src/katalog-daten.ts";

test("Nachholung ist begrenzt und bekommt einen eigenen ausdrücklichen Modus", () => {
  assert.equal(nachholLimit({}), 6);
  assert.equal(nachholLimit({ nachholen: true }), 60);
  assert.equal(nachholLimit({ nachholen: "true" }), 6);
});

test("Einzeldateien eines Tages werden zu echten 40er-Datenbankblöcken gebündelt", () => {
  const dateien = Array.from({ length: 83 }, (_, i) => new TextEncoder().encode(JSON.stringify({ license: "https://creativecommons.org/publicdomain/zero/1.0/", releases: [{ id: i }] })));
  const blocks = [...releaseBloecke(dateien)];
  assert.deepEqual(blocks.map((b) => b.length), [40, 40, 3]);
  assert.deepEqual(blocks.flat().map((r) => r.id), Array.from({ length: 83 }, (_, i) => i));
  assert.throws(() => [...releaseBloecke([new TextEncoder().encode('{"license":"Unbekannt","releases":[]}')])], /CC0/);
});

test("Neue erledigte Verfahren verbrauchen keine Plätze; bekannte Verfahren erhalten Abschlussmeldungen", async () => {
  const n = (await normalisieren({ ocid: "test", tender: { title: "Test", status: "awarded" } }, "2026-10-31"))!;
  assert.equal(importierbar(n, false), false);
  assert.equal(importierbar(n, true), true);
  assert.equal(importierbar({ ...n, status: "offen", frist: "2100-01-01" }, false), true);
  assert.equal(importierbar({ ...n, status: "offen", frist: "2000-01-01" }, false), false);
});

test("Eine Teiländerung im gleichen Block sieht den zuvor normalisierten Grunddatensatz", async () => {
  const batch = await normalisiereBlock([
    { ocid: "gleich", date: "2026-10-30T10:00:00Z", tag: ["tender"], tender: { title: "Fliesenarbeiten", description: "Originale Leistungsbeschreibung" } },
    { ocid: "gleich", date: "2026-10-31T10:00:00Z", tag: ["tenderCancellation"] },
  ], new Map(), "2026-10-31");
  assert.equal(batch.length, 2);
  assert.equal(batch[1].status, "aufgehoben");
  assert.equal(batch[1].titel, "Fliesenarbeiten");
  assert.equal(batch[1].beschreibung, "Originale Leistungsbeschreibung");
});
