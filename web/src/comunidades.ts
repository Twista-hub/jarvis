// Spanish autonomous communities (NUTS-2) as search area, like départements and voivodeships. The list
// (alarm/comunidades.json: NUTS code → name) is shared with the alarm (profile_db.nuts_der_bekanntmachung).
import DATEN from "../../alarm/comunidades.json" with { type: "json" };
import { escape } from "./seite.ts";

const LISTE = DATEN as Record<string, string>;

export function comunidadesBereinigen(x: unknown): string[] {
  const gewaehlt = new Set((Array.isArray(x) ? x : []).map((c) => String(c).toUpperCase().trim()));
  return Object.keys(LISTE).filter((c) => gewaehlt.has(c));
}

export const comunidadName = (c: string): string => LISTE[c] ?? c;

export function comunidadAuswahl(gewaehlt: string[]): string {
  const an = new Set(gewaehlt);
  return `<details${gewaehlt.length ? "" : " open"}><summary>Regionen in Spanien <span class="check-zahl">${gewaehlt.length ? `${gewaehlt.length} ausgewählt` : "ganz Spanien"}</span></summary>
    <p class="klein">Crewtender zeigt nur Ausschreibungen aus den gewählten Regionen (Comunidades Autónomas). Keine Auswahl bedeutet ganz Spanien. Ändern kostet nichts extra.</p>
    <div class="chips">${Object.entries(LISTE).map(([c, n]) => `<label><input type="checkbox" name="comunidades" value="${c}"${an.has(c) ? " checked" : ""}><span>${escape(n)}</span></label>`).join("")}</div></details>`;
}
