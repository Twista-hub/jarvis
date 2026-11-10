import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { anzahlJson, releasesDerTage, tageBis } from "../scripts/katalog-nachholen.ts";

test("Nachholen: Tage bis gestern, neueste zuerst", () => {
  assert.deepEqual(tageBis("2026-11-10", 3), ["2026-11-09", "2026-11-08", "2026-11-07"]);
  assert.deepEqual(tageBis("2026-03-01", 2), ["2026-02-28", "2026-02-27"]);
});

test("Nachholen: leerer Tagesexport wird erkannt, Monatsexport liefert nur die gesuchten Tage", () => {
  assert.equal(anzahlJson(zipSync({})), 0);
  const paket = (releases: unknown[]) => strToU8(JSON.stringify({ license: "https://creativecommons.org/publicdomain/zero/1.0/", releases }));
  const zip = zipSync({
    "a-01.json": paket([{ ocid: "ocds-mnwr74-1", id: "1", date: "2026-11-06T10:00:00Z" }]),
    "b-01.json": paket([{ ocid: "ocds-mnwr74-2", id: "2", date: "2026-11-05T10:00:00Z" }, { ocid: "ocds-mnwr74-3", id: "3", date: "2026-11-06T23:00:00Z" }]),
    "lies-mich.txt": strToU8("x"),
  });
  assert.equal(anzahlJson(zip), 2);
  const jeTag = releasesDerTage(zip, new Set(["2026-11-06", "2026-11-07"]));
  assert.deepEqual([...jeTag.keys()], ["2026-11-06"]);
  assert.deepEqual(jeTag.get("2026-11-06")!.map((r) => r.id), ["1", "3"]);
});

test("Nachholen: Datei ohne CC0-Lizenz bricht ab", () => {
  const zip = zipSync({ "a-01.json": strToU8(JSON.stringify({ license: "unbekannt", releases: [{ id: "1", date: "2026-11-06T10:00:00Z" }] })) });
  assert.throws(() => releasesDerTage(zip, new Set(["2026-11-06"])), /CC0/);
});
