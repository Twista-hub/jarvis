// French départements as search area (instead of a radius in km, which only works with German postal codes). The list
// (alarm/departements.json: région → code → name, 101 départements incl. overseas) is shared with the alarm, which
// filters BOAMP notices by their publication département (profile_db.im_suchgebiet).
import DATEN from "../../alarm/departements.json" with { type: "json" };
import { escape } from "./seite.ts";

export const REGIONEN = DATEN as Record<string, Record<string, string>>;
const NAMEN = new Map(Object.values(REGIONEN).flatMap((r) => Object.entries(r)));
const REGION_VON = new Map(Object.entries(REGIONEN).flatMap(([region, d]) => Object.keys(d).map((c) => [c, region] as const)));

/** Département of a French postal code: 75011 → "75", 20000 → "2A", 20200 → "2B", 97400 → "974". */
export function departementAusPlz(plz: string): string | null {
  if (!/^\d{5}$/.test(plz)) return null;
  const code = plz.startsWith("20") ? (Number(plz.slice(2, 3)) <= 1 ? "2A" : "2B") : plz.startsWith("97") ? plz.slice(0, 3) : plz.slice(0, 2);
  return NAMEN.has(code) ? code : null;
}

export const departementName = (code: string): string => NAMEN.get(code) ?? code;
export const regionVon = (code: string): string | null => REGION_VON.get(code) ?? null;

/** Known codes only, without duplicates, in list order. */
export function departementsBereinigen(x: unknown): string[] {
  const gewaehlt = new Set((Array.isArray(x) ? x : []).map((c) => String(c).toUpperCase().trim()));
  return [...NAMEN.keys()].filter((c) => gewaehlt.has(c)).sort();
}

/** Default for a new French profile: all départements of the firm's région (from its postal code). Only when France is
 *  searched without Germany; otherwise nothing (= all of France). */
export function standardDepartements(laender: string[] | undefined, plz: string): string[] {
  if (!laender?.includes("FRA") || laender.includes("DEU")) return [];
  const region = regionVon(departementAusPlz(plz) ?? "");
  return region ? Object.keys(REGIONEN[region]).sort() : [];
}

/** Checkboxes grouped by région; the région of a selected département starts open. */
export function departementAuswahl(gewaehlt: string[]): string {
  const an = new Set(gewaehlt);
  const regionen = Object.entries(REGIONEN).map(([region, d]) => {
    const anzahl = Object.keys(d).filter((c) => an.has(c)).length;
    return `<details${anzahl ? " open" : ""}><summary>${escape(region)}${anzahl ? ` <span class="check-zahl">${anzahl} ausgewählt</span>` : ""}</summary><div class="chips">${Object.entries(d).map(([c, n]) => `<label><input type="checkbox" name="departements" value="${c}"${an.has(c) ? " checked" : ""}><span>${c} ${escape(n)}</span></label>`).join("")}</div></details>`;
  }).join("");
  return `<details${gewaehlt.length ? "" : " open"}><summary>Départements in Frankreich <span class="check-zahl">${gewaehlt.length ? `${gewaehlt.length} ausgewählt` : "ganz Frankreich"}</span></summary>
    <p class="klein">Crewtender zeigt nur Ausschreibungen aus den gewählten Départements. Keine Auswahl bedeutet ganz Frankreich. Ändern kostet nichts extra.</p>
    ${regionen}</details>`;
}
