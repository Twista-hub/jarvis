import assert from "node:assert/strict";
import { test } from "node:test";
import { personDateienLoeschen } from "../src/personal.ts";

test("D6: deleting a person removes photo and certificate files, paged, only for that person", async () => {
  const alle = ["personal-fotos/f1/p1", "personal-fotos/f1/p2", ...Array.from({ length: 3 }, (_, i) => `personal_nachweise/f1/p1/n${i}`), "personal_nachweise/f1/p2/x", "personal_nachweise/f1/p10/y"];
  const da = new Set(alle);
  const r2 = {
    list: async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const treffer = [...da].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0, seite = treffer.slice(start, start + 2);
      return { objects: seite.map((key) => ({ key })), truncated: start + 2 < treffer.length, cursor: String(start + 2) };
    },
    delete: async (k: string | string[]) => { for (const x of [k].flat()) da.delete(x); },
  } as never;
  assert.equal(await personDateienLoeschen(r2, "f1", "p1"), 4);
  assert.deepEqual([...da].sort(), ["personal-fotos/f1/p2", "personal_nachweise/f1/p10/y", "personal_nachweise/f1/p2/x"]);
});
