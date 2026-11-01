// H1: before saving, show how many notices of the last 7 days the edited profile would have found, next to the
// saved profile. Only the free pre-selection (words, codes, area, contract value, excluded buyers), no AI.
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import type { Vorschlag } from "./einrichtung.ts";

const NIE = "(?!x)x";

/** The same word pattern as the search (alarm/profile_db.py muster): word start, umlauts also as ae/oe/ue/ss. */
export function muster(woerter: string[]): string {
  const teile = woerter.map((w) => w.toLowerCase().trim()).filter(Boolean).map((w) => {
    let e = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const [a, b] of [["ä", "ae"], ["ö", "oe"], ["ü", "ue"], ["ß", "ss"]]) e = e.split(a).join(`(${a}|${b})`);
    return `(?<!\\w)${e}${w.length <= 3 ? "(?!\\w)" : ""}`;
  });
  return teile.join("|") || NIE;
}

/** CPV code → prefix as in the search: trailing zeros mark a parent class (at least two digits). */
export function cpvPraefix(code: string): string {
  return /^\d{2,8}$/.test(code) ? code.slice(0, Math.max(2, code.replace(/0+$/, "").length)) : code;
}

const namenNorm = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();

export type Fund = { id: string; titel: string; auftraggeber: string; ort: string; wert: number | null; quell_datum: string };

/** Notices of the last 7 days for a profile (at most 300) after excluding buyers. */
export async function vorschauZaehlen(s: Sitzung, env: KontoEnv, firma: string, v: Vorschlag, schnell: string[] = []): Promise<Fund[] | null> {
  const woerter = v.leistungen.flatMap((l) => l.woerter);
  const cpv = [...new Set(v.leistungen.flatMap((l) => l.cpv).map(cpvPraefix))];
  if (!woerter.length && !cpv.length) return [];
  const plz = [...new Set(v.standorte.flatMap((o) => o.plz_praefixe))];
  const r = await db<Fund[]>(s, env, "rpc/suchprofil_vorschau", { method: "POST", body: JSON.stringify({
    f: firma, muster: muster(woerter), ausschluss: [...v.ausschluss, ...schnell].length ? muster([...v.ausschluss, ...schnell]) : "", cpv, plz,
    wert_min: v.wert_min ?? null, wert_max: v.wert_max ?? null, wert_unbekannt: v.wert_unbekannt !== false, tage: 7,
  }) });
  if (!r.ok) return null;
  const aus = (v.auftraggeber_aus ?? []).map(namenNorm).filter((n) => n.length >= 3);
  return r.daten.filter((x) => !aus.some((n) => ` ${namenNorm(x.auftraggeber)} `.includes(` ${n} `) || (n.length >= 8 && namenNorm(x.auftraggeber).includes(n))));
}

/** Result box above the form: edited profile vs. saved one, with a few examples of what is new or gone. */
export function vorschauBox(neu: Fund[] | null, alt: Fund[] | null): string {
  if (neu === null) return `<p class="hinweis" role="status">Die Vorschau ist gerade nicht verfügbar. Bitte später noch einmal versuchen.</p>`;
  const zahl = (l: Fund[]) => (l.length >= 300 ? "über 300" : String(l.length));
  const altIds = new Set((alt ?? []).map((x) => x.id));
  const neuIds = new Set(neu.map((x) => x.id));
  const dazu = neu.filter((x) => !altIds.has(x.id));
  const weg = (alt ?? []).filter((x) => !neuIds.has(x.id));
  const beispiel = (l: Fund[]) => l.slice(0, 3).map((x) => `<li>${escape(x.titel.length > 80 ? `${x.titel.slice(0, 77)}…` : x.titel)}<span class="klein"> · ${escape(x.auftraggeber.slice(0, 50))}</span></li>`).join("");
  return `<section class="vorschau-box" role="status"><h2>🔍 Vorschau: letzte 7 Tage</h2>
<div class="vorschau-zahlen"><div><strong>${zahl(neu)}</strong><span>mit deinen Änderungen</span></div>${alt ? `<div><strong>${zahl(alt)}</strong><span>bisher gespeichert</span></div>` : ""}</div>
${alt && dazu.length ? `<p class="klein">➕ Neu dabei, z. B.:</p><ul>${beispiel(dazu)}</ul>` : ""}${alt && weg.length ? `<p class="klein">➖ Fällt weg, z. B.:</p><ul>${beispiel(weg)}</ul>` : ""}${!alt && neu.length ? `<ul>${beispiel(neu)}</ul>` : ""}
<p class="klein">Vorauswahl nach Wörtern, Kennziffern, Gebiet und Auftragswert. Die KI sortiert danach noch Unpassendes aus, daher werden es weniger Treffer. Die Vorschau kostet nichts; gespeichert ist noch nichts.</p></section>`;
}
