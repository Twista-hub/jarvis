// Countries for the search profile (ISO 3166-1 alpha-3, same list as alarm/ted.py).
// Germany comes from the Bekanntmachungsservice, all others from TED (EU Publications Office).
export const NACHBARN: Record<string, string> = { AUT: "Österreich", CHE: "Schweiz", FRA: "Frankreich", LUX: "Luxemburg", BEL: "Belgien", NLD: "Niederlande", DNK: "Dänemark", POL: "Polen", CZE: "Tschechien" };
export const WEITERE: Record<string, string> = {
  BGR: "Bulgarien", HRV: "Kroatien", CYP: "Zypern", EST: "Estland", FIN: "Finnland", GRC: "Griechenland", HUN: "Ungarn", IRL: "Irland",
  ITA: "Italien", LVA: "Lettland", LTU: "Litauen", MLT: "Malta", PRT: "Portugal", ROU: "Rumänien", SVK: "Slowakei", SVN: "Slowenien",
  ESP: "Spanien", SWE: "Schweden", NOR: "Norwegen", ISL: "Island", LIE: "Liechtenstein",
};
export const LAENDER: Record<string, string> = { DEU: "Deutschland", ...NACHBARN, ...WEITERE };

/** Only known codes; Germany when nothing is chosen. */
export function laenderBereinigen(x: unknown): string[] {
  const l = [...new Set((Array.isArray(x) ? x : []).map(String).filter((c) => c in LAENDER))];
  return l.length ? l : ["DEU"];
}
