// US price benchmark, previous contractors and recompete radar from USAspending.gov (official open data of the US
// Treasury, public domain, API without key: https://api.usaspending.gov). Read on demand in the worker and cached for
// a day per NAICS + state. Only contract awards (types A–D). Amounts are obligated amounts, not always the full value.
import { escape } from "./seite.ts";

export type Vertrag = { id: string; firma: string; betrag: number; beginn: string; ende: string; behoerde: string; unterbehoerde: string; beschreibung: string; link: string };

const API = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const FELDER = ["Award ID", "Recipient Name", "Award Amount", "Start Date", "End Date", "Awarding Agency", "Awarding Sub Agency", "Description", "generated_internal_id"];

const tag = (d: Date) => d.toISOString().slice(0, 10);
const plusMonate = (d: Date, m: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + m); return x; };

function anfrage(naics: string, staat: string, von: string, bis: string, sort: string, limit: number) {
  return { filters: { award_type_codes: ["A", "B", "C", "D"], naics_codes: { require: [naics] }, place_of_performance_locations: [{ country: "USA", state: staat }], time_period: [{ start_date: von, end_date: bis }] }, fields: FELDER, sort, order: "desc", limit, page: 1 };
}

export function auswerten(roh: unknown): Vertrag[] {
  const r = (roh as { results?: Record<string, unknown>[] })?.results ?? [];
  return r.map((x) => ({
    id: String(x["Award ID"] ?? ""), firma: String(x["Recipient Name"] ?? ""), betrag: Number(x["Award Amount"] ?? 0) || 0,
    beginn: String(x["Start Date"] ?? ""), ende: String(x["End Date"] ?? ""), behoerde: String(x["Awarding Agency"] ?? ""),
    unterbehoerde: String(x["Awarding Sub Agency"] ?? ""), beschreibung: String(x["Description"] ?? "").slice(0, 200),
    link: x.generated_internal_id ? `https://www.usaspending.gov/award/${encodeURIComponent(String(x.generated_internal_id))}` : "",
  })).filter((v) => v.id);
}

async function holen(schluessel: string, body: unknown, warten?: (p: Promise<unknown>) => void): Promise<Vertrag[] | null> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://cache.jarvis/usaspending/${schluessel}`);
  const alt = await cache?.match(key).catch(() => undefined);
  if (alt) return (await alt.json()) as Vertrag[];
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json", "user-agent": "CrewtenderApp/1.0 (WP Digital Ranger; kontakt@wpdigitalranger.com)" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const liste = auswerten(await r.json());
    if (cache) warten?.(cache.put(key, new Response(JSON.stringify(liste), { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } })).catch(() => undefined));
    return liste;
  } catch { return null; }
}

/** Largest contracts of the last 3 years for this NAICS and state (price benchmark, who wins here). */
export function vergleichbare(naics: string, staat: string, warten?: (p: Promise<unknown>) => void, jetzt = new Date()): Promise<Vertrag[] | null> {
  if (!/^\d{6}$/.test(naics) || !/^[A-Z]{2}$/.test(staat)) return Promise.resolve([]);
  return holen(`v/${naics}/${staat}/${tag(jetzt).slice(0, 7)}`, anfrage(naics, staat, tag(plusMonate(jetzt, -36)), tag(jetzt), "Award Amount", 10), warten);
}

/** Contracts that end in 6 to 18 months (recompete radar): the agency will tender them again soon. */
export async function auslaufend(naics: string, staat: string, warten?: (p: Promise<unknown>) => void, jetzt = new Date()): Promise<Vertrag[] | null> {
  if (!/^\d{6}$/.test(naics) || !/^[A-Z]{2}$/.test(staat)) return [];
  const alle = await holen(`a/${naics}/${staat}/${tag(jetzt).slice(0, 7)}`, anfrage(naics, staat, tag(plusMonate(jetzt, -72)), tag(jetzt), "End Date", 100), warten);
  if (!alle) return null;
  const von = tag(plusMonate(jetzt, 6)), bis = tag(plusMonate(jetzt, 18));
  return alle.filter((v) => v.ende >= von && v.ende <= bis).sort((a, b) => a.ende.localeCompare(b.ende)).slice(0, 15);
}

export function median(zahlen: number[]): number {
  const z = zahlen.filter((x) => x > 0).sort((a, b) => a - b);
  if (!z.length) return 0;
  const m = Math.floor(z.length / 2);
  return z.length % 2 ? z[m] : (z[m - 1] + z[m]) / 2;
}

const geld = (x: number, en: boolean) => x >= 1e6 ? `${en ? "$" : ""}${(x / 1e6).toLocaleString(en ? "en-US" : "de-DE", { maximumFractionDigits: 1 })}${en ? "M" : " Mio. $"}` : `${en ? "$" : ""}${Math.round(x).toLocaleString(en ? "en-US" : "de-DE")}${en ? "" : " $"}`;
const datum = (d: string, en: boolean) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(en ? "en-US" : "de-DE", { year: "numeric", month: "short", day: "numeric" }) : "";

/** Table of contracts with recipient, agency, amount and end date. */
export function vertragsTabelle(liste: Vertrag[], sprache: "de" | "en", hervorheben = ""): string {
  const en = sprache === "en";
  return `<table class="auswertung-tabelle"><thead><tr><th>${en ? "Contractor" : "Auftragnehmer"}</th><th>${en ? "Agency" : "Behörde"}</th><th>${en ? "Amount" : "Betrag"}</th><th>${en ? "Ends" : "Endet"}</th></tr></thead><tbody>${liste.map((v) => `<tr${hervorheben && v.behoerde === hervorheben ? ' class="markiert"' : ""}><td>${v.link ? `<a href="${escape(v.link)}" rel="noopener" target="_blank">${escape(v.firma)}</a>` : escape(v.firma)}<br><span class="klein">${escape(v.beschreibung)}</span></td><td>${escape(v.unterbehoerde || v.behoerde)}</td><td>${escape(geld(v.betrag, en))}</td><td>${escape(datum(v.ende, en))}</td></tr>`).join("")}</tbody></table>`;
}

/** Same federal department? SAM.gov writes "VETERANS AFFAIRS, DEPARTMENT OF.…", USAspending "Department of Veterans
 *  Affairs": compare the significant words of the department name. */
export function gleicheBehoerde(usaspending: string, samPfad: string): boolean {
  const woerter = usaspending.toUpperCase().split(/[^A-Z]+/).filter((w) => w.length > 2 && !["DEPARTMENT", "THE", "AND", "FOR", "DEPT"].includes(w));
  const pfad = ` ${samPfad.toUpperCase().split(/[.›]/)[0].replace(/[^A-Z]+/g, " ")} `;
  return woerter.length > 0 && woerter.every((w) => pfad.includes(` ${w} `));
}

/** Box on a US tender page: benchmark + likely incumbents (same agency, ending soon). */
export function marktKasten(naics: string, staat: string, behoerdePfad: string, vergleich: Vertrag[] | null, sprache: "de" | "en"): string {
  const en = sprache === "en";
  const t = (de: string, e: string) => en ? e : de;
  if (vergleich === null) return `<section class="us-kasten"><h2>📊 ${t("Preisvergleich", "Price benchmark")}</h2><p class="klein">${t("USAspending.gov ist gerade nicht erreichbar. Später noch einmal öffnen.", "USAspending.gov is not reachable right now. Please try again later.")}</p></section>`;
  if (!vergleich.length) return `<section class="us-kasten"><h2>📊 ${t("Preisvergleich", "Price benchmark")}</h2><p class="klein">${t(`Keine Bundesverträge mit NAICS ${naics} in ${staat} in den letzten 3 Jahren gefunden.`, `No federal contracts with NAICS ${naics} in ${staat} in the last 3 years.`)}</p></section>`;
  const behoerde = vergleich.find((v) => gleicheBehoerde(v.behoerde, behoerdePfad))?.behoerde ?? "";
  const heute = new Date().toISOString().slice(0, 10);
  const vorgaenger = vergleich.filter((v) => behoerde && v.behoerde === behoerde && v.ende >= heute.slice(0, 4) + "-01-01");
  return `<section class="us-kasten"><h2>📊 ${t("Preisvergleich und Vorgänger", "Price benchmark and incumbents")}</h2>
<p>${t(`Größte Bundesverträge mit NAICS ${naics} in ${staat} (letzte 3 Jahre): Median`, `Largest federal contracts with NAICS ${naics} in ${staat} (last 3 years): median`)} <strong>${escape(geld(median(vergleich.map((v) => v.betrag)), en))}</strong>.</p>
${vorgaenger.length ? `<p class="hinweis">${t("Gleiche Behörde, Vertrag läuft noch oder endet bald: wahrscheinlich der bisherige Auftragnehmer.", "Same agency, contract still running or ending soon: likely the incumbent.")} <strong>${vorgaenger.map((v) => escape(v.firma)).join(", ")}</strong></p>` : ""}
${vertragsTabelle(vergleich, sprache, behoerde)}
<p class="klein">${t("Quelle: USAspending.gov (US-Finanzministerium, offene Daten). Beträge sind bisher gebundene Mittel, nicht immer der Gesamtwert; Verteidigungsdaten erscheinen mit bis zu 90 Tagen Verzug.", "Source: USAspending.gov (US Treasury, open data). Amounts are obligated funds, not always the total value; defense data appears with up to 90 days delay.")} <a href="/konto/us-radar?naics=${naics}&amp;staat=${staat}">${t("Auslaufende Verträge ansehen", "See contracts ending soon")}</a></p></section>`;
}
