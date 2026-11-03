// Idea 23 (docs/ideen-arbeitsoberflaeche.md): VAT overview per month or quarter from the firm's invoices (output VAT)
// and receipts (input VAT), plus a watch on the small-business limits (§ 19 UStG since 2025: previous year at most
// 25,000 €, current year at most 100,000 €). Only an overview for the tax adviser or for typing into ELSTER yourself:
// Jarvis transmits nothing and gives no tax advice. Finance access (readers with finance access may look).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { ustAus } from "./belege.ts";

export type ReZeile = { datum: string; netto: number | string; ust_satz: number | string; bezahlt_am?: string | null; monat?: string; art?: string; ust_betrag?: number | string | null; kleinunternehmer?: boolean | null; reverse_charge?: boolean };
export type BeZeile = { datum: string; brutto: number | string; ust_satz: number | string };
export type Periode = { schluessel: string; name: string; umsatz19: number; umsatz7: number; umsatz0: number; umsatz13b?: number; ust: number; vorsteuer: number; zahllast: number; anzahl: number };
export const GRENZE_VORJAHR = 25_000, GRENZE_LAUFEND = 100_000;
const rund = (n: number) => Math.round(n * 100) / 100;
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Date that counts for the VAT return: accrual basis = end of the month the service was performed (§ 13 Abs. 1 Nr. 1a
 *  UStG; a cancellation corrects the period in which it is issued, § 17 UStG); cash basis = payment date (unpaid
 *  invoices do not count yet). */
const stichtag = (r: ReZeile, ist: boolean) => ist ? r.bezahlt_am ?? null : r.monat && r.art !== "storno" ? `${r.monat}-01` : r.datum;
/** Turnover for the small-business limits: by invoice date or payment date as before. */
const umsatztag = (r: ReZeile, ist: boolean) => ist ? r.bezahlt_am ?? null : r.datum;

export function perioden(re: ReZeile[], be: BeZeile[], o: { jahr: number; quartal: boolean; ist: boolean; kleinunternehmer: boolean }): Periode[] {
  const anzahl = o.quartal ? 4 : 12;
  const teil = (d: string) => { const m = Number(d.slice(5, 7)) - 1; return o.quartal ? Math.floor(m / 3) : m; };
  const leer = Array.from({ length: anzahl }, (_, i): Periode => ({ schluessel: o.quartal ? `${o.jahr}-Q${i + 1}` : `${o.jahr}-${String(i + 1).padStart(2, "0")}`, name: o.quartal ? `${i + 1}. Quartal` : MONATE[i], umsatz19: 0, umsatz7: 0, umsatz0: 0, ust: 0, vorsteuer: 0, zahllast: 0, anzahl: 0 }));
  for (const r of re) {
    const d = stichtag(r, o.ist);
    if (!d || Number(d.slice(0, 4)) !== o.jahr) continue;
    const ku = r.kleinunternehmer ?? o.kleinunternehmer;
    const p = leer[teil(d)], netto = Number(r.netto), satz = ku ? 0 : Number(r.ust_satz);
    if (r.reverse_charge) p.umsatz13b = (p.umsatz13b ?? 0) + netto; else if (satz === 19) p.umsatz19 += netto; else if (satz === 7) p.umsatz7 += netto; else p.umsatz0 += netto;
    p.ust += r.ust_betrag !== null && r.ust_betrag !== undefined ? Number(r.ust_betrag) : netto * satz / 100;
    p.anzahl++;
  }
  if (!o.kleinunternehmer) for (const b of be) {
    if (Number(b.datum.slice(0, 4)) !== o.jahr) continue;
    leer[teil(b.datum)].vorsteuer += ustAus(Number(b.brutto), Number(b.ust_satz));
  }
  for (const p of leer) { p.umsatz19 = rund(p.umsatz19); p.umsatz7 = rund(p.umsatz7); p.umsatz0 = rund(p.umsatz0); p.umsatz13b = rund(p.umsatz13b ?? 0); p.ust = rund(p.ust); p.vorsteuer = rund(p.vorsteuer); p.zahllast = rund(p.ust - p.vorsteuer); }
  return leer;
}

/** Turnover per calendar year (gross for small businesses = net, as no VAT is charged). */
export function jahresumsatz(re: ReZeile[], jahr: number, ist: boolean): number {
  return rund(re.filter((r) => { const d = umsatztag(r, ist); return d && Number(d.slice(0, 4)) === jahr; }).reduce((n, r) => n + Number(r.netto), 0));
}

export type Waechter = { stufe: "ok" | "gelb" | "rot"; text: string };
/** Small-business watch: previous year over 25,000 € → no small business this year; current year over 100,000 € →
 *  regular taxation from the invoice that crosses the limit (since 2025). Warning from 80 %. */
export function kleinunternehmerWaechter(vorjahr: number, laufend: number, kleinunternehmer: boolean): Waechter {
  if (!kleinunternehmer) return { stufe: "ok", text: "Die Firma ist nicht als Kleinunternehmer eingetragen (Firmenprofil); es gilt die Regelbesteuerung." };
  if (vorjahr > GRENZE_VORJAHR) return { stufe: "rot", text: `Vorjahresumsatz ${euro(vorjahr)} liegt über ${euro(GRENZE_VORJAHR)}: Die Kleinunternehmerregelung gilt in diesem Jahr voraussichtlich nicht. Bitte mit dem Steuerbüro klären.` };
  if (laufend > GRENZE_LAUFEND) return { stufe: "rot", text: `Umsatz dieses Jahr ${euro(laufend)} liegt über ${euro(GRENZE_LAUFEND)}: Ab der Rechnung, mit der die Grenze überschritten wurde, gilt die Regelbesteuerung (mit Umsatzsteuer). Bitte sofort mit dem Steuerbüro klären.` };
  if (laufend > GRENZE_LAUFEND * 0.8) return { stufe: "gelb", text: `Umsatz dieses Jahr ${euro(laufend)}, das sind ${Math.round(laufend / GRENZE_LAUFEND * 100)} % der Grenze von ${euro(GRENZE_LAUFEND)}.` };
  if (laufend > GRENZE_VORJAHR) return { stufe: "gelb", text: `Umsatz dieses Jahr ${euro(laufend)} liegt über ${euro(GRENZE_VORJAHR)}: Im nächsten Jahr gilt die Kleinunternehmerregelung dann voraussichtlich nicht mehr.` };
  return { stufe: "ok", text: `Umsatz dieses Jahr ${euro(laufend)} (Grenzen: Vorjahr ${euro(GRENZE_VORJAHR)}, laufendes Jahr ${euro(GRENZE_LAUFEND)}). Alles im Rahmen.` };
}

export function umsatzsteuerSeite(p: Periode[], o: { jahr: number; quartal: boolean; ist: boolean; kleinunternehmer: boolean; waechter: Waechter; vorjahr: number; laufend: number; heuteJahr: number }): string {
  const q = (j: number, quartal: boolean, ist: boolean) => `/konto/umsatzsteuer?jahr=${j}${quartal ? "&zeitraum=quartal" : ""}${ist ? "&ist=1" : ""}`;
  const summe = p.reduce((a, x) => ({ u19: a.u19 + x.umsatz19, u7: a.u7 + x.umsatz7, u0: a.u0 + x.umsatz0, ust: a.ust + x.ust, vst: a.vst + x.vorsteuer }), { u19: 0, u7: 0, u0: 0, ust: 0, vst: 0 });
  const balken = (wert: number, grenze: number) => `<div class="fortschritt" role="img" aria-label="${Math.round(wert / grenze * 100)} %"><span style="width:${Math.min(100, Math.round(wert / grenze * 100))}%"></span></div>`;
  const zeilen = p.map((x) => o.kleinunternehmer
    ? `<tr><td>${x.name}</td><td>${euro(x.umsatz0 + x.umsatz7 + x.umsatz19)}</td><td>${x.anzahl}</td></tr>`
    : `<tr><td>${x.name}</td><td>${euro(x.umsatz19)}</td><td>${euro(x.umsatz7)}</td><td>${euro(x.umsatz0)}${x.umsatz13b ? ` <span class="klein">+ ${euro(x.umsatz13b)} § 13b (Kz. 60)</span>` : ""}</td><td>${euro(x.ust)}</td><td>${euro(x.vorsteuer)}</td><td><strong>${euro(x.zahllast)}</strong></td></tr>`).join("");
  const tabelle = o.kleinunternehmer
    ? `<table class="tabelle"><thead><tr><th>${o.quartal ? "Quartal" : "Monat"}</th><th>Umsatz</th><th>Rechnungen</th></tr></thead><tbody>${zeilen}</tbody></table>`
    : `<table class="tabelle"><thead><tr><th>${o.quartal ? "Quartal" : "Monat"}</th><th>Umsatz 19 % (Kz. 81)</th><th>Umsatz 7 % (Kz. 86)</th><th>ohne USt</th><th>Umsatzsteuer</th><th>Vorsteuer (Kz. 66)</th><th>Zahllast</th></tr></thead><tbody>${zeilen}<tr><td><strong>Summe</strong></td><td>${euro(summe.u19)}</td><td>${euro(summe.u7)}</td><td>${euro(summe.u0)}</td><td>${euro(summe.ust)}</td><td>${euro(summe.vst)}</td><td><strong>${euro(summe.ust - summe.vst)}</strong></td></tr></tbody></table>`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="${q(o.jahr - 1, o.quartal, o.ist)}" aria-label="Vorjahr">‹</a><strong>${o.jahr}</strong><a class="knopf zweit" href="${q(o.jahr + 1, o.quartal, o.ist)}" aria-label="Nächstes Jahr">›</a></nav>
<section class="ust-waechter ${o.waechter.stufe}"><h2>${o.waechter.stufe === "rot" ? "🔴" : o.waechter.stufe === "gelb" ? "🟡" : "🟢"} Kleinunternehmer-Wächter</h2><p>${escape(o.waechter.text)}</p>
${o.kleinunternehmer ? `<p class="klein">Laufendes Jahr ${euro(o.laufend)} von ${euro(GRENZE_LAUFEND)}</p>${balken(o.laufend, GRENZE_LAUFEND)}<p class="klein">Vorjahr ${euro(o.vorjahr)} von ${euro(GRENZE_VORJAHR)}</p>${balken(o.vorjahr, GRENZE_VORJAHR)}` : ""}</section>
<nav class="ordner-chips" aria-label="Ansicht"><a href="${q(o.jahr, false, o.ist)}"${o.quartal ? "" : ' aria-current="page"'}>Monate</a><a href="${q(o.jahr, true, o.ist)}"${o.quartal ? ' aria-current="page"' : ""}>Quartale</a><a href="${q(o.jahr, o.quartal, false)}"${o.ist ? "" : ' aria-current="page"'}>nach Rechnungsdatum</a><a href="${q(o.jahr, o.quartal, true)}"${o.ist ? ' aria-current="page"' : ""}>nach Zahlungseingang</a></nav>
<div class="tabelle-rahmen">${tabelle}</div>
<p class="klein">Aus den Rechnungen in Jarvis${o.kleinunternehmer ? "" : " und den erfassten Belegen (Vorsteuer laut Eingabe)"}. ${o.ist ? "Nach Zahlungseingang: nur als bezahlt markierte Rechnungen (Ist-Versteuerung)." : "Nach Rechnungsdatum (Soll-Versteuerung)."} Rechnungen außerhalb von Jarvis fehlen hier. Die Kennzahlen (Kz.) sind zur Orientierung für die Umsatzsteuer-Voranmeldung in ELSTER. Jarvis übermittelt nichts und ersetzt keine Steuerberatung.</p>`;
}

export async function umsatzsteuer(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/umsatzsteuer") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Umsatzsteuer", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen) return antwort("<p>Die Umsatzsteuer-Übersicht sehen Personen mit Finanzfreigabe.</p>", 403);
  const firma = f.m.firma_id;
  const heuteJahr = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }).slice(0, 4));
  const jahr = /^20\d{2}$/.test(url.searchParams.get("jahr") ?? "") ? Number(url.searchParams.get("jahr")) : heuteJahr;
  const quartal = url.searchParams.get("zeitraum") === "quartal", ist = url.searchParams.get("ist") === "1";
  const [re, be, pr] = await Promise.all([
    db<ReZeile[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&status=eq.ausgestellt&datum=gte.${jahr - 1}-01-01&select=datum,netto,ust_satz,bezahlt_am,monat,art,ust_betrag,kleinunternehmer,reverse_charge&limit=20000`),
    db<BeZeile[]>(f.s, env, `belege?firma_id=eq.${firma}&storniert_am=is.null&datum=gte.${jahr}-01-01&datum=lt.${jahr + 1}-01-01&select=datum,brutto,ust_satz&limit=20000`),
    db<{ kleinunternehmer: boolean }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=kleinunternehmer`),
  ]);
  const rechnungen = re.ok ? re.daten : [], ku = !!(pr.ok && pr.daten[0]?.kleinunternehmer);
  const vorjahr = jahresumsatz(rechnungen, jahr - 1, ist), laufend = jahresumsatz(rechnungen, jahr, ist);
  return antwort(umsatzsteuerSeite(perioden(rechnungen, be.ok ? be.daten : [], { jahr, quartal, ist, kleinunternehmer: ku }), { jahr, quartal, ist, kleinunternehmer: ku, waechter: kleinunternehmerWaechter(vorjahr, laufend, ku), vorjahr, laufend, heuteJahr }));
}
