// T30: Zuschläge. From each time sheet Jarvis splits off night hours (23–6 Uhr, ArbZG § 2 and the temporary-work
// collective agreements), Sunday hours and public-holiday hours (per federal state). The break is deducted proportionally.

export const LAENDER: Record<string, string> = { BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern", NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen" };

// Federal state by the first two digits of the postal code (approximate at borders; can be changed in the company profile).
const PLZ: [number, number, string][] = [[1, 2, "SN"], [3, 3, "BB"], [4, 4, "SN"], [6, 6, "ST"], [7, 7, "TH"], [8, 9, "SN"], [10, 13, "BE"], [14, 16, "BB"], [17, 19, "MV"],
  [20, 22, "HH"], [23, 25, "SH"], [26, 27, "NI"], [28, 28, "HB"], [29, 31, "NI"], [32, 33, "NW"], [34, 36, "HE"], [37, 38, "NI"], [39, 39, "ST"], [40, 48, "NW"], [49, 49, "NI"],
  [50, 53, "NW"], [54, 56, "RP"], [57, 59, "NW"], [60, 65, "HE"], [66, 66, "SL"], [67, 67, "RP"], [68, 79, "BW"], [80, 87, "BY"], [88, 88, "BW"], [89, 97, "BY"], [98, 99, "TH"]];
export function landAusPlz(plz: string | null | undefined): string {
  const n = Number(String(plz ?? "").slice(0, 2));
  return /^\d{5}$/.test(String(plz ?? "")) ? PLZ.find(([a, b]) => n >= a && n <= b)?.[2] ?? "" : "";
}

const iso = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t)).toISOString().slice(0, 10);
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function ostern(j: number): string {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(j, monat, tag);
}
const cache = new Map<string, Map<string, string>>();
/** Public holidays of a year: nationwide plus those of the federal state (empty state = nationwide only). */
export function feiertage(jahr: number, land: string): Map<string, string> {
  const schluessel = `${jahr}${land}`;
  if (cache.has(schluessel)) return cache.get(schluessel)!;
  const o = ostern(jahr), m = new Map<string, string>([
    [iso(jahr, 1, 1), "Neujahr"], [plus(o, -2), "Karfreitag"], [plus(o, 1), "Ostermontag"], [iso(jahr, 5, 1), "Tag der Arbeit"], [plus(o, 39), "Christi Himmelfahrt"],
    [plus(o, 50), "Pfingstmontag"], [iso(jahr, 10, 3), "Tag der Deutschen Einheit"], [iso(jahr, 12, 25), "1. Weihnachtstag"], [iso(jahr, 12, 26), "2. Weihnachtstag"]]);
  const in_ = (...l: string[]) => l.includes(land);
  if (in_("BW", "BY", "ST")) m.set(iso(jahr, 1, 6), "Heilige Drei Könige");
  if (in_("BE", "MV")) m.set(iso(jahr, 3, 8), "Frauentag");
  if (in_("BB")) { m.set(o, "Ostersonntag"); m.set(plus(o, 49), "Pfingstsonntag"); }
  if (in_("BW", "BY", "HE", "NW", "RP", "SL")) m.set(plus(o, 60), "Fronleichnam");
  if (in_("SL")) m.set(iso(jahr, 8, 15), "Mariä Himmelfahrt");
  if (in_("TH")) m.set(iso(jahr, 9, 20), "Weltkindertag");
  if (in_("BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH")) m.set(iso(jahr, 10, 31), "Reformationstag");
  if (in_("BW", "BY", "NW", "RP", "SL")) m.set(iso(jahr, 11, 1), "Allerheiligen");
  if (in_("SN")) { const d = new Date(Date.UTC(jahr, 10, 22)); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 4) % 7)); m.set(d.toISOString().slice(0, 10), "Buß- und Bettag"); }
  cache.set(schluessel, m);
  return m;
}
export const feiertag = (d: string, land: string) => feiertage(Number(d.slice(0, 4)), land).get(d) ?? null;

export type Zuschlag = { nacht: number; sonntag: number; feiertag: number };
const NACHT: [number, number][] = [[0, 360], [1380, 1440]];
const ueberlapp = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const zuMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** Night, Sunday and holiday minutes of one entry (holiday on a Sunday counts as holiday only; night counts on top).
 *  Public holidays follow the place of work (e.land, from the customer's site; Rechtsprüfung 03.11.2026 A4), the
 *  firm's federal state only as fallback. */
export function zuschlag(e: { datum: string; beginn: string; ende: string; pause_min: number; land?: string }, landFirma: string): Zuschlag {
  const land = e.land || landFirma;
  const s = zuMin(e.beginn); let ende = zuMin(e.ende); if (ende <= s) ende += 1440;
  const brutto = ende - s, faktor = brutto > 0 ? Math.max(0, brutto - (e.pause_min || 0)) / brutto : 0;
  const z: Zuschlag = { nacht: 0, sonntag: 0, feiertag: 0 };
  for (const [tag, a, b] of [[e.datum, s, Math.min(ende, 1440)], [plus(e.datum, 1), 0, Math.max(0, ende - 1440)]] as [string, number, number][]) {
    if (b <= a) continue;
    z.nacht += NACHT.reduce((n, [c, d]) => n + ueberlapp(a, b, c, d), 0);
    if (feiertag(tag, land)) z.feiertag += b - a;
    else if (new Date(`${tag}T12:00:00Z`).getUTCDay() === 0) z.sonntag += b - a;
  }
  return { nacht: Math.round(z.nacht * faktor), sonntag: Math.round(z.sonntag * faktor), feiertag: Math.round(z.feiertag * faktor) };
}
export const summe = (l: Zuschlag[]): Zuschlag => l.reduce((a, b) => ({ nacht: a.nacht + b.nacht, sonntag: a.sonntag + b.sonntag, feiertag: a.feiertag + b.feiertag }), { nacht: 0, sonntag: 0, feiertag: 0 });
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
/** Short text, e.g. "🌙 2:30 · ☀️ So 8:00 · 🎉 Ftg 8:00" (empty when there is nothing). */
export const zuschlagText = (z: Zuschlag) => [z.nacht ? `🌙 ${hm(z.nacht)}` : "", z.sonntag ? `☀️ So ${hm(z.sonntag)}` : "", z.feiertag ? `🎉 Ftg ${hm(z.feiertag)}` : ""].filter(Boolean).join(" · ");

/** Rechtsprüfung 03.11.2026 (A6): minutes per tax-free surcharge window of § 3b EStG, for the payroll office.
 *  n25 night 20–6 h · n40 night 0–4 h when the work started before midnight · so50 Sunday · f125 public holiday and
 *  31.12. from 14 h · f150 24.12. from 14 h, 25./26.12. and 1.5. Night and Sunday/holiday add up; a holiday on a Sunday
 *  counts as holiday only. 0–4 h after a Sunday or holiday counts as that day when the work started before midnight
 *  (§ 3b Abs. 3 Nr. 2). Breaks are deducted proportionally. How much is really tax-free (e.g. base wage at most 50 €/h)
 *  decides the payroll office. */
export type Steuerfrei = { n25: number; n40: number; so50: number; f125: number; f150: number };
export function steuerfrei3b(e: { datum: string; beginn: string; ende: string; pause_min: number; land?: string }, landFirma: string): Steuerfrei {
  const land = e.land || landFirma;
  const s = zuMin(e.beginn); let ende = zuMin(e.ende); if (ende <= s) ende += 1440;
  const brutto = ende - s, faktor = brutto > 0 ? Math.max(0, brutto - (e.pause_min || 0)) / brutto : 0;
  const naechster = plus(e.datum, 1);
  const art = (d: string, t: number): "f150" | "f125" | "so50" | "" => {
    const md = d.slice(5);
    if (md === "12-25" || md === "12-26" || md === "05-01" || (md === "12-24" && t >= 840)) return "f150";
    if (feiertag(d, land) || (md === "12-31" && t >= 840)) return "f125";
    return new Date(`${d}T12:00:00Z`).getUTCDay() === 0 ? "so50" : "";
  };
  const z: Steuerfrei = { n25: 0, n40: 0, so50: 0, f125: 0, f150: 0 };
  for (let m = s; m < ende; m++) {
    const folgetag = m >= 1440, t = m % 1440, fortsetzung = folgetag && t < 240 && s < 1440;
    if (t >= 1200 || t < 360) { if (fortsetzung) z.n40++; else z.n25++; }
    const a = fortsetzung ? art(e.datum, 1439) || art(naechster, t) : art(folgetag ? naechster : e.datum, t);
    if (a) z[a]++;
  }
  return { n25: Math.round(z.n25 * faktor), n40: Math.round(z.n40 * faktor), so50: Math.round(z.so50 * faktor), f125: Math.round(z.f125 * faktor), f150: Math.round(z.f150 * faktor) };
}
export const summe3b = (l: Steuerfrei[]): Steuerfrei => l.reduce((a, b) => ({ n25: a.n25 + b.n25, n40: a.n40 + b.n40, so50: a.so50 + b.so50, f125: a.f125 + b.f125, f150: a.f150 + b.f150 }), { n25: 0, n40: 0, so50: 0, f125: 0, f150: 0 });
