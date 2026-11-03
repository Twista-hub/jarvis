// Austrian federal states (NUTS-2) as search area, like the Italian regions. The list
// (alarm/bundeslaender_at.json: NUTS code → name) is shared with the alarm (profile_db.im_suchgebiet).
import DATEN from "../../alarm/bundeslaender_at.json" with { type: "json" };
import { escape } from "./seite.ts";

const LISTE = DATEN as Record<string, string>;

export function bundeslaenderBereinigen(x: unknown): string[] {
  const gewaehlt = new Set((Array.isArray(x) ? x : []).map((c) => String(c).toUpperCase().trim()));
  return Object.keys(LISTE).filter((c) => gewaehlt.has(c));
}

export const bundeslandName = (c: string): string => LISTE[c] ?? c;

export function bundeslandAuswahl(gewaehlt: string[]): string {
  const an = new Set(gewaehlt);
  return `<details${gewaehlt.length ? "" : " open"}><summary>Bundesländer in Österreich <span class="check-zahl">${gewaehlt.length ? `${gewaehlt.length} ausgewählt` : "ganz Österreich"}</span></summary>
    <p class="klein">Crewtender zeigt nur Ausschreibungen aus den gewählten Bundesländern. Keine Auswahl bedeutet ganz Österreich. Ändern kostet nichts extra.</p>
    <div class="chips">${Object.entries(LISTE).map(([c, n]) => `<label><input type="checkbox" name="bundeslaender" value="${c}"${an.has(c) ? " checked" : ""}><span>${escape(n)}</span></label>`).join("")}</div></details>`;
}
