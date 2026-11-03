// Italian regions (NUTS-2) as search area, like départements, voivodeships and comunidades. The list
// (alarm/regioni.json: NUTS code → name) is shared with the alarm (profile_db.im_suchgebiet).
import DATEN from "../../alarm/regioni.json" with { type: "json" };
import { escape } from "./seite.ts";

const LISTE = DATEN as Record<string, string>;

export function regioniBereinigen(x: unknown): string[] {
  const gewaehlt = new Set((Array.isArray(x) ? x : []).map((c) => String(c).toUpperCase().trim()));
  return Object.keys(LISTE).filter((c) => gewaehlt.has(c));
}

export const regioneName = (c: string): string => LISTE[c] ?? c;

export function regioneAuswahl(gewaehlt: string[]): string {
  const an = new Set(gewaehlt);
  return `<details${gewaehlt.length ? "" : " open"}><summary>Regionen in Italien <span class="check-zahl">${gewaehlt.length ? `${gewaehlt.length} ausgewählt` : "ganz Italien"}</span></summary>
    <p class="klein">Crewtender zeigt nur Ausschreibungen aus den gewählten Regionen. Keine Auswahl bedeutet ganz Italien. Ändern kostet nichts extra.</p>
    <div class="chips">${Object.entries(LISTE).map(([c, n]) => `<label><input type="checkbox" name="regioni" value="${c}"${an.has(c) ? " checked" : ""}><span>${escape(n)}</span></label>`).join("")}</div></details>`;
}
