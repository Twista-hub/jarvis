// Polish voivodeships as search area (like the French départements). The list (alarm/woiwodschaften.json: slug → name,
// TERYT code of the BZP API, NUTS codes of TED) is shared with the alarm (bzp.woiwodschaften_der_bekanntmachung).
import DATEN from "../../alarm/woiwodschaften.json" with { type: "json" };
import { escape } from "./seite.ts";

const LISTE = DATEN as Record<string, { name: string; teryt: string; nuts: string[] }>;

/** Known slugs only, without duplicates, in list order. */
export function woiwodschaftenBereinigen(x: unknown): string[] {
  const gewaehlt = new Set((Array.isArray(x) ? x : []).map((w) => String(w).trim()));
  return Object.keys(LISTE).filter((w) => gewaehlt.has(w));
}

export const woiwodschaftName = (slug: string): string => LISTE[slug]?.name ?? slug;

/** Checkboxes of the 16 voivodeships. */
export function woiwodschaftAuswahl(gewaehlt: string[]): string {
  const an = new Set(gewaehlt);
  return `<details${gewaehlt.length ? "" : " open"}><summary>Woiwodschaften in Polen <span class="check-zahl">${gewaehlt.length ? `${gewaehlt.length} ausgewählt` : "ganz Polen"}</span></summary>
    <p class="klein">Crewtender zeigt nur Ausschreibungen aus den gewählten Woiwodschaften. Keine Auswahl bedeutet ganz Polen. Ändern kostet nichts extra.</p>
    <div class="chips">${Object.entries(LISTE).map(([slug, w]) => `<label><input type="checkbox" name="woiwodschaften" value="${slug}"${an.has(slug) ? " checked" : ""}><span>${escape(w.name)}</span></label>`).join("")}</div></details>`;
}
