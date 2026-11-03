import assert from "node:assert/strict";
import { test } from "node:test";
import { csv, LIESMICH } from "../src/archiv.ts";

test("Archiv: CSV sicher gegen Formeln, Hinweis auf Aufbewahrung", () => {
  const t = csv([["Nummer", "Kunde"], ["RE-2026-0001", "=HYPERLINK(1)"], ["RE-2026-0002", "Müller; Söhne"]]);
  assert.ok(t.startsWith("﻿"));
  assert.match(t, /'=HYPERLINK\(1\)/);
  assert.match(t, /"Müller; Söhne"/);
  assert.match(LIESMICH, /§ 147 AO/);
});
