import assert from "node:assert/strict";
import postgres from "postgres";
import { bestehendeBekanntmachungen } from "../src/katalog-plan.ts";

const url = process.env.JARVIS_TEST_DATABASE_URL;
assert.ok(url, "Isolierte Testdatenbank erforderlich");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Kein Zugriff auf Kundendaten");
const sql = postgres(url, { max: 1, prepare: false, fetch_types: false });
try {
  await sql.begin(async (tx) => {
    await tx`create table public.vergabekatalog (id text primary key, roh jsonb, quell_datum timestamptz)`;
    const ids = ["bks:normal", "bks:Komma,Anführungszeichen'", "bks:Klammer{inhalt}"];
    for (const id of ids) await tx`insert into public.vergabekatalog values (${id}, '{}'::jsonb, now())`;
    assert.deepEqual((await bestehendeBekanntmachungen(tx, ids)).map((r) => r.id).sort(), ids.sort());
    assert.deepEqual(await bestehendeBekanntmachungen(tx, []), []);
    assert.equal((await bestehendeBekanntmachungen(tx, ["unbekannt"])).length, 0);
    await tx`drop table public.vergabekatalog`;
  });
  console.log("Katalog-Blockabfrage ohne Typenerkennung: OK");
} finally { await sql.end(); }
