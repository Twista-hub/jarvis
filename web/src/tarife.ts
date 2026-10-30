// Collective wage tables for temporary agency work. Values copied from the original document, never estimated:
// Entgelttarifvertrag DGB/GVP vom 12.09.2025, Anhang „Entgelttabellen mit Erfahrungszuschlag“, gültig ab 01.01.2026
// (https://www.dgb.de/fileadmin/download_center/Uploads/2025-09-12_Entgelttarifvertrag_DGB-GVP_ab_01012026.pdf,
// read on 30.10.2026). Earliest termination: 30.09.2027. When a new agreement is published, add a table below.

export const GVP = {
  name: "Zeitarbeit GVP/DGB",
  quelle: "Entgelttarifvertrag DGB/GVP vom 12.09.2025",
  gruppen: ["1", "2a", "2b", "3", "4", "5", "6", "7", "8", "9"],
  tabellen: [
    { ab: "2026-01-01", lohn: { "1": 14.96, "2a": 15.29, "2b": 15.69, "3": 16.69, "4": 17.65, "5": 19.78, "6": 21.97, "7": 25.56, "8": 27.36, "9": 28.7 } },
    { ab: "2026-09-01", lohn: { "1": 15.33, "2a": 15.67, "2b": 16.08, "3": 17.11, "4": 18.09, "5": 20.27, "6": 22.52, "7": 26.2, "8": 28.04, "9": 29.42 } },
    { ab: "2027-04-01", lohn: { "1": 15.87, "2a": 16.22, "2b": 16.64, "3": 17.71, "4": 18.72, "5": 20.98, "6": 23.31, "7": 27.12, "8": 29.02, "9": 30.45 } },
  ] as { ab: string; lohn: Record<string, number> }[],
  // § 3 ETV: experience surcharge for an uninterrupted assignment at the same customer.
  erfahrung: [{ abMonat: 9, prozent: 1.5 }, { abMonat: 12, prozent: 3 }],
};

export type TarifWahl = { beginn: string; monate: number; steigerung: number; erfahrung: boolean };

const monatPlus = (iso: string, m: number) => {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
};
const monateZwischen = (von: string, bis: string) =>
  (Number(bis.slice(0, 4)) - Number(von.slice(0, 4))) * 12 + Number(bis.slice(5, 7)) - Number(von.slice(5, 7));

/** Wage of a group on a given day (first table before its start; known increases; after the last table the expected yearly rise). */
export function lohnAm(eg: string, tag: string, steigerung: number): number {
  const t = GVP.tabellen;
  const tabelle = [...t].reverse().find((x) => x.ab <= tag) ?? t[0];
  const letzte = t[t.length - 1];
  const jahreDanach = tag >= letzte.ab ? Math.floor(monateZwischen(letzte.ab, tag) / 12) : 0;
  return (tabelle.lohn[eg] ?? 0) * (1 + steigerung / 100) ** jahreDanach;
}

/** Average hourly wage over the contract period, month by month (incl. experience surcharges if chosen). */
export function tariflohn(eg: string, w: TarifWahl): number {
  const monate = Math.max(1, Math.min(120, Math.round(w.monate)));
  let summe = 0;
  for (let m = 0; m < monate; m++) {
    const zuschlag = w.erfahrung ? [...GVP.erfahrung].reverse().find((e) => m >= e.abMonat)?.prozent ?? 0 : 0;
    summe += lohnAm(eg, monatPlus(w.beginn, m), w.steigerung) * (1 + zuschlag / 100);
  }
  return Math.round((summe / monate) * 100) / 100;
}

/** Notes for the result: unknown future wages and equal pay after nine months (§ 8 Abs. 4 AÜG). */
export function tarifHinweise(w: TarifWahl): string[] {
  const hinweise: string[] = [];
  const ende = monatPlus(w.beginn, Math.max(1, w.monate) - 1);
  const letzte = GVP.tabellen[GVP.tabellen.length - 1].ab;
  if (ende >= monatPlus(letzte, 12)) hinweise.push(`Tariflöhne sind bis ${letzte.slice(5, 7)}/${letzte.slice(0, 4)} bekannt; danach rechnet Jarvis mit ${w.steigerung.toLocaleString("de-DE")} % Erhöhung pro Jahr.`);
  if (w.monate > 9) hinweise.push("Bleibt dieselbe Kraft länger als 9 Monate beim Kunden, gilt grundsätzlich Equal Pay (§ 8 Abs. 4 AÜG), außer ein Branchenzuschlagstarif greift. Lohn des Kunden erfragen und ggf. als eigenen Stundenlohn eintragen.");
  return hinweise;
}

export function standardTarif(heute = new Date()): TarifWahl {
  const naechster = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  return { beginn: naechster, monate: 24, steigerung: 3, erfahrung: true };
}
