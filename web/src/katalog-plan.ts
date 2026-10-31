import type { Bekanntmachung } from "./katalog-daten.ts";
import { strFromU8 } from "fflate";

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

export function importierbar(n: Bekanntmachung, vorhanden: boolean, jetzt = Date.now()): boolean {
  // Amendments of known notices must still close/correct existing customer hits.
  return vorhanden || (["offen", "unbekannt"].includes(n.status) && (!n.frist || Date.parse(n.frist) > jetzt));
}
