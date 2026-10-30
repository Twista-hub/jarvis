import { escape } from "./seite.ts";
import type { Bereich } from "./konto.ts";

/** Full paths keep the regions and their individual locations distinguishable. */
export function bereichPfad(bereiche: Bereich[], bereich: Bereich): string {
  const teile = [bereich.name];
  const gesehen = new Set([bereich.id]);
  let parent = bereich.parent_id;
  while (parent && !gesehen.has(parent)) {
    gesehen.add(parent);
    const p = bereiche.find((b) => b.id === parent);
    if (!p) break;
    teile.unshift(p.name);
    parent = p.parent_id;
  }
  return teile.join(" › ");
}

export function bereichOptionen(bereiche: Bereich[], ausgewaehlt = ""): string {
  return bereiche.map((b) => ({ b, pfad: bereichPfad(bereiche, b) }))
    .sort((a, b) => a.pfad.localeCompare(b.pfad, "de"))
    .map(({ b, pfad }) => `<option value="${escape(b.id)}"${b.id === ausgewaehlt ? " selected" : ""}>${escape(pfad)}</option>`).join("");
}
