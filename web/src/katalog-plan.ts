import { normalisieren, type Bekanntmachung } from "./katalog-daten.ts";
import { strFromU8 } from "fflate";
import type postgres from "postgres";

export async function bestehendeBekanntmachungen(sql: postgres.Sql | postgres.TransactionSql, ids: string[]) {
  if (!ids.length) return [];
  // fetch_types:false deliberately disables array discovery; bind individual text values.
  return sql`select id,roh,quell_datum from public.vergabekatalog where id in ${sql(ids)}`;
}

export function* releaseBloecke(dateien: Iterable<Uint8Array>): Generator<any[]> {
  let block: any[] = [];
  for (const datei of dateien) {
    const pkg = JSON.parse(strFromU8(datei));
    if (!/cc.?zero|creativecommons.org\/publicdomain\/zero/i.test(pkg.license ?? "")) throw new Error("CC0-Lizenz nicht bestätigt");
    for (const rel of pkg.releases ?? []) {
      block.push(rel);
      if (block.length === 40) { yield block; block = []; }
    }
  }
  if (block.length) yield block;
}

export function nachholLimit(payload: unknown): number {
  return payload && typeof payload === "object" && "nachholen" in payload && payload.nachholen === true ? 60 : 6;
}

export function wiederholen(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && "wiederholen" in payload && payload.wiederholen === true);
}

export function exportTage(heute: string, rueckstand: string[]): string[] {
  const gestern = new Date(Date.parse(`${heute}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return [...new Set([gestern, ...rueckstand.filter((tag) => tag < heute)])];
}

export function importierbar(n: Bekanntmachung, vorhanden: boolean, jetzt = Date.now()): boolean {
  // Amendments of known notices must still close/correct existing customer hits.
  return vorhanden || (["offen", "unbekannt"].includes(n.status) && (!n.frist || Date.parse(n.frist) > jetzt));
}

export async function normalisiereBlock(teil: any[], bestehend: Map<string, { roh: any; quell_datum: string | Date }>, tag: string, zuGross: string[] = []): Promise<Bekanntmachung[]> {
  const batch: Bekanntmachung[] = [];
  for (const rel of teil) {
    if (!(rel.tag ?? []).some((t: string) => /^(tender|award|contract|compiled)/.test(t))) continue;
    const id = `bks:${rel.ocid || rel.id}`;
    const current = bestehend.get(id);
    if (current && rel.date && new Date(current.quell_datum).getTime() > Date.parse(rel.date)) continue;
    const n = await normalisieren(rel, tag, current?.roh);
    if (n && importierbar(n, Boolean(current))) {
      if (JSON.stringify(n.roh).length >= 100000) { zuGross.push(id); continue; }
      batch.push(n);
      bestehend.set(id, { roh: n.roh, quell_datum: n.quell_datum });
    }
  }
  return batch;
}
