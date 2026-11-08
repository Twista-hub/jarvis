// Idea 23 (docs/ideen-arbeitsoberflaeche.md): VAT overview per month or quarter from the firm's invoices (output VAT)
// and receipts (input VAT), plus a watch on the small-business limits (§ 19 UStG since 2025: previous year at most
// 25,000 €, current year at most 100,000 €). Only an overview for the tax adviser or for typing into ELSTER yourself:
// Crewtender transmits nothing and gives no tax advice. Finance access (readers with finance access may look).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { ustBeleg } from "./belege.ts";

export type ReZeile = { datum: string; netto: number | string; ust_satz: number | string; bezahlt_am?: string | null; monat?: string; art?: string; ust_betrag?: number | string | null; kleinunternehmer?: boolean | null; reverse_charge?: boolean; reverse_charge_eu?: boolean };
export type BeZeile = { datum: string; brutto: number | string; ust_satz: number | string; brutto_7?: number | string | null; beleg_mime?: string | null; reverse_charge?: boolean };
/** vorsteuer: only receipts with an uploaded file (Rechtsprüfung S9); ohneBeleg: VAT of entries without a file, not counted. */
export type Periode = { schluessel: string; name: string; umsatz19: number; umsatz7: number; umsatz0: number; umsatz13b?: number; umsatzEu?: number; ust: number; vorsteuer: number; ohneBeleg: number; zahllast: number; anzahl: number };
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
  const leer = Array.from({ length: anzahl }, (_, i): Periode => ({ schluessel: o.quartal ? `${o.jahr}-Q${i + 1}` : `${o.jahr}-${String(i + 1).padStart(2, "0")}`, name: o.quartal ? `${i + 1}. Quartal` : MONATE[i], umsatz19: 0, umsatz7: 0, umsatz0: 0, ust: 0, vorsteuer: 0, ohneBeleg: 0, zahllast: 0, anzahl: 0 }));
  for (const r of re) {
    const d = stichtag(r, o.ist);
    if (!d || Number(d.slice(0, 4)) !== o.jahr) continue;
    const ku = r.kleinunternehmer ?? o.kleinunternehmer;
    const p = leer[teil(d)], netto = Number(r.netto), satz = ku ? 0 : Number(r.ust_satz);
    if (r.reverse_charge_eu) p.umsatzEu = (p.umsatzEu ?? 0) + netto; else if (r.reverse_charge) p.umsatz13b = (p.umsatz13b ?? 0) + netto; else if (satz === 19) p.umsatz19 += netto; else if (satz === 7) p.umsatz7 += netto; else p.umsatz0 += netto;
    p.ust += r.ust_betrag !== null && r.ust_betrag !== undefined ? Number(r.ust_betrag) : netto * satz / 100;
    p.anzahl++;
  }
  if (!o.kleinunternehmer) for (const b of be) {
    if (Number(b.datum.slice(0, 4)) !== o.jahr) continue;
    const p = leer[teil(b.datum)];
    if (b.beleg_mime) p.vorsteuer += ustBeleg(b); else p.ohneBeleg += ustBeleg(b);
  }
  for (const p of leer) { p.umsatz19 = rund(p.umsatz19); p.umsatz7 = rund(p.umsatz7); p.umsatz0 = rund(p.umsatz0); p.umsatz13b = rund(p.umsatz13b ?? 0); p.umsatzEu = rund(p.umsatzEu ?? 0); p.ust = rund(p.ust); p.vorsteuer = rund(p.vorsteuer); p.ohneBeleg = rund(p.ohneBeleg); p.zahllast = rund(p.ust - p.vorsteuer); }
  return leer;
}

/** Turnover per calendar year (gross for small businesses = net, as no VAT is charged). */
export function jahresumsatz(re: ReZeile[], jahr: number, ist: boolean): number {
  return rund(re.filter((r) => { const d = umsatztag(r, ist); return d && Number(d.slice(0, 4)) === jahr; }).reduce((n, r) => n + Number(r.netto), 0));
}

export type Waechter = { stufe: "ok" | "gelb" | "rot"; text: string };
/** Small-business watch: previous year over 25,000 € → no small business this year; current year over 100,000 € →
 *  regular taxation from the invoice that crosses the limit (since 2025). In the year the business started the limit is
 *  25,000 € for that year (§ 19 Abs. 2 UStG). Warning from 80 %. Rechtsprüfung S13: counted cautiously by invoice date
 *  plus turnover outside Crewtender (the law counts the amounts received, which are at most this). */
export function kleinunternehmerWaechter(vorjahr: number, laufend: number, kleinunternehmer: boolean, gruendungsjahr = false): Waechter {
  if (!kleinunternehmer) return { stufe: "ok", text: "Die Firma ist nicht als Kleinunternehmer eingetragen (Firmenprofil); es gilt die Regelbesteuerung." };
  if (gruendungsjahr) {
    if (laufend > GRENZE_VORJAHR) return { stufe: "rot", text: `Gründungsjahr: Umsatz ${euro(laufend)} liegt über ${euro(GRENZE_VORJAHR)}. Im Jahr der Gründung gilt diese Grenze schon für das laufende Jahr: Ab der Rechnung, mit der sie überschritten wurde, gilt die Regelbesteuerung (mit Umsatzsteuer). Bitte sofort mit dem Steuerbüro klären.` };
    if (laufend > GRENZE_VORJAHR * 0.8) return { stufe: "gelb", text: `Gründungsjahr: Umsatz ${euro(laufend)}, das sind ${Math.round(laufend / GRENZE_VORJAHR * 100)} % der Grenze von ${euro(GRENZE_VORJAHR)}, die im Gründungsjahr schon für das laufende Jahr gilt.` };
    return { stufe: "ok", text: `Gründungsjahr: Umsatz ${euro(laufend)} (Grenze im Gründungsjahr ${euro(GRENZE_VORJAHR)}). Alles im Rahmen.` };
  }
  if (vorjahr > GRENZE_VORJAHR) return { stufe: "rot", text: `Vorjahresumsatz ${euro(vorjahr)} liegt über ${euro(GRENZE_VORJAHR)}: Die Kleinunternehmerregelung gilt in diesem Jahr voraussichtlich nicht. Bitte mit dem Steuerbüro klären.` };
  if (laufend > GRENZE_LAUFEND) return { stufe: "rot", text: `Umsatz dieses Jahr ${euro(laufend)} liegt über ${euro(GRENZE_LAUFEND)}: Ab der Rechnung, mit der die Grenze überschritten wurde, gilt die Regelbesteuerung (mit Umsatzsteuer). Bitte sofort mit dem Steuerbüro klären.` };
  if (laufend > GRENZE_LAUFEND * 0.8) return { stufe: "gelb", text: `Umsatz dieses Jahr ${euro(laufend)}, das sind ${Math.round(laufend / GRENZE_LAUFEND * 100)} % der Grenze von ${euro(GRENZE_LAUFEND)}.` };
  if (laufend > GRENZE_VORJAHR) return { stufe: "gelb", text: `Umsatz dieses Jahr ${euro(laufend)} liegt über ${euro(GRENZE_VORJAHR)}: Im nächsten Jahr gilt die Kleinunternehmerregelung dann voraussichtlich nicht mehr.` };
  return { stufe: "ok", text: `Umsatz dieses Jahr ${euro(laufend)} (Grenzen: Vorjahr ${euro(GRENZE_VORJAHR)}, laufendes Jahr ${euro(GRENZE_LAUFEND)}). Alles im Rahmen.` };
}

export function umsatzsteuerSeite(p: Periode[], o: { jahr: number; quartal: boolean; ist: boolean; kleinunternehmer: boolean; waechter: Waechter; vorjahr: number; laufend: number; heuteJahr: number; extern?: { laufend: number; vorjahr: number }; bezahlt?: number; gruendungsjahr?: boolean; admin?: boolean; ausland13b?: number }): string {
  const q = (j: number, quartal: boolean, ist: boolean) => `/konto/umsatzsteuer?jahr=${j}${quartal ? "&zeitraum=quartal" : ""}${ist ? "&ist=1" : ""}`;
  const summe = p.reduce((a, x) => ({ u19: a.u19 + x.umsatz19, u7: a.u7 + x.umsatz7, u0: a.u0 + x.umsatz0, ust: a.ust + x.ust, vst: a.vst + x.vorsteuer, ohne: a.ohne + x.ohneBeleg }), { u19: 0, u7: 0, u0: 0, ust: 0, vst: 0, ohne: 0 });
  const balken = (wert: number, grenze: number) => `<div class="fortschritt" role="img" aria-label="${Math.round(wert / grenze * 100)} %"><span style="width:${Math.min(100, Math.round(wert / grenze * 100))}%"></span></div>`;
  const zeilen = p.map((x) => o.kleinunternehmer
    ? `<tr><td>${x.name}</td><td>${euro(x.umsatz0 + x.umsatz7 + x.umsatz19)}</td><td>${x.anzahl}</td></tr>`
    : `<tr><td>${x.name}</td><td>${euro(x.umsatz19)}</td><td>${euro(x.umsatz7)}</td><td>${euro(x.umsatz0)}${x.umsatz13b ? ` <span class="klein">+ ${euro(x.umsatz13b)} § 13b (Kz. 60)</span>` : ""}${x.umsatzEu ? ` <span class="klein">+ ${euro(x.umsatzEu)} EU Reverse Charge (Kz. 21)</span>` : ""}</td><td>${euro(x.ust)}</td><td>${euro(x.vorsteuer)}${x.ohneBeleg ? ` <span class="klein">(+ ${euro(x.ohneBeleg)} ohne Beleg, nicht gezählt)</span>` : ""}</td><td><strong>${euro(x.zahllast)}</strong></td></tr>`).join("");
  const tabelle = o.kleinunternehmer
    ? `<table class="tabelle"><thead><tr><th>${o.quartal ? "Quartal" : "Monat"}</th><th>Umsatz</th><th>Rechnungen</th></tr></thead><tbody>${zeilen}</tbody></table>`
    : `<table class="tabelle"><thead><tr><th>${o.quartal ? "Quartal" : "Monat"}</th><th>Umsatz 19 % (Kz. 81)</th><th>Umsatz 7 % (Kz. 86)</th><th>ohne USt</th><th>Umsatzsteuer</th><th>Vorsteuer (Kz. 66)</th><th>Zahllast</th></tr></thead><tbody>${zeilen}<tr><td><strong>Summe</strong></td><td>${euro(summe.u19)}</td><td>${euro(summe.u7)}</td><td>${euro(summe.u0)}</td><td>${euro(summe.ust)}</td><td>${euro(summe.vst)}</td><td><strong>${euro(summe.ust - summe.vst)}</strong></td></tr></tbody></table>`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="${q(o.jahr - 1, o.quartal, o.ist)}" aria-label="Vorjahr">‹</a><strong>${o.jahr}</strong><a class="knopf zweit" href="${q(o.jahr + 1, o.quartal, o.ist)}" aria-label="Nächstes Jahr">›</a></nav>
<section class="ust-waechter ${o.waechter.stufe}"><h2>${o.waechter.stufe === "rot" ? "🔴" : o.waechter.stufe === "gelb" ? "🟡" : "🟢"} Kleinunternehmer-Wächter</h2><p>${escape(o.waechter.text)}</p>
${o.kleinunternehmer ? `<p class="klein">Laufendes Jahr ${euro(o.laufend)} von ${euro(o.gruendungsjahr ? GRENZE_VORJAHR : GRENZE_LAUFEND)}</p>${balken(o.laufend, o.gruendungsjahr ? GRENZE_VORJAHR : GRENZE_LAUFEND)}${o.gruendungsjahr ? "" : `<p class="klein">Vorjahr ${euro(o.vorjahr)} von ${euro(GRENZE_VORJAHR)}</p>${balken(o.vorjahr, GRENZE_VORJAHR)}`}
<p class="klein">Gezählt vorsichtig nach Rechnungsdatum${o.extern?.laufend || o.extern?.vorjahr ? " samt Umsätzen außerhalb Crewtender" : ""}${o.bezahlt !== undefined ? `; davon dieses Jahr schon bezahlt: <span>${euro(o.bezahlt)}</span>` : ""}. Gesetzlich zählen die tatsächlich eingenommenen Beträge aller Umsätze der Firma, auch die außerhalb von Crewtender.</p>
${o.admin ? `<details class="termin-neu"><summary>➕ Umsätze außerhalb Crewtender</summary><form method="post" action="/konto/umsatzsteuer" class="aueg-form"><input type="hidden" name="aktion" value="extern"><input type="hidden" name="jahr" value="${o.jahr}">
<label>${o.jahr} (€)<input name="extern_laufend" inputmode="decimal" maxlength="12" value="${o.extern?.laufend ? String(o.extern.laufend).replace(".", ",") : ""}" placeholder="0"></label><label>${o.jahr - 1} (€)<input name="extern_vorjahr" inputmode="decimal" maxlength="12" value="${o.extern?.vorjahr ? String(o.extern.vorjahr).replace(".", ",") : ""}" placeholder="0"></label>
<p class="klein ganz">Z. B. Rechnungen aus einem anderen Programm oder Barverkäufe. Das Gründungsjahr steht im <a href="/konto/firmenprofil">Firmenprofil</a>.</p><button>Speichern</button></form></details>` : ""}` : ""}</section>
<nav class="ordner-chips" aria-label="Ansicht"><a href="${q(o.jahr, false, o.ist)}"${o.quartal ? "" : ' aria-current="page"'}>Monate</a><a href="${q(o.jahr, true, o.ist)}"${o.quartal ? ' aria-current="page"' : ""}>Quartale</a><a href="${q(o.jahr, o.quartal, false)}"${o.ist ? "" : ' aria-current="page"'}>nach Rechnungsdatum</a><a href="${q(o.jahr, o.quartal, true)}"${o.ist ? ' aria-current="page"' : ""}>nach Zahlungseingang</a></nav>
<div class="tabelle-rahmen">${tabelle}</div>
${p.some((x) => x.umsatzEu) ? `<p class="hinweis">🇪🇺 Rechnungen mit Reverse Charge an Unternehmen in anderen EU-Ländern: Dafür ist zusätzlich die <strong>Zusammenfassende Meldung</strong> beim Bundeszentralamt für Steuern nötig (über ELSTER, bis zum 25. des Folgemonats bzw. Folgequartals), mit USt-IdNr. des Kunden und Betrag. Vorschlag, bitte mit dem Steuerbüro prüfen.</p>` : ""}
${o.ausland13b ? `<p class="hinweis">🌍 Rechnungen von Lieferanten im Ausland ohne deutsche Umsatzsteuer (§ 13b UStG) in ${o.jahr}: <strong>${euro(o.ausland13b)}</strong> netto. Darauf schuldet die Firma <strong>${euro(rund(o.ausland13b * 0.19))}</strong> Umsatzsteuer (19 %; Kz. 46/47 bei Lieferanten in der EU, sonst Kz. 84/85)${o.kleinunternehmer ? ". <strong>Auch als Kleinunternehmer</strong> – ohne Vorsteuerabzug; dafür ist eine Umsatzsteuer-Voranmeldung nötig." : " und darf sie zugleich als Vorsteuer abziehen (Kz. 67), die Zahllast ändert sich also nicht."} Vorschlag, bitte mit dem Steuerbüro prüfen.</p>` : ""}
${!o.kleinunternehmer && rund(summe.ohne) > 0 ? `<p class="hinweis">⚠️ <strong>${euro(rund(summe.ohne))}</strong> nicht als Vorsteuer gezählt (kein Beleg hochgeladen)<br><span class="klein">Ohne hochgeladene Belegdatei zählt Crewtender keine Vorsteuer. Fehlt die Datei, den Eintrag unter <a href="/konto/belege">Belege</a> stornieren und mit Datei neu erfassen.</span></p>` : ""}
<p class="klein">Aus den Rechnungen in Crewtender${o.kleinunternehmer ? "" : " und den erfassten Belegen mit hochgeladener Datei (Vorsteuer laut Eingabe)"}. ${o.ist ? "Nach Zahlungseingang: nur als bezahlt markierte Rechnungen (Ist-Versteuerung)." : "Nach Rechnungsdatum (Soll-Versteuerung)."} Rechnungen außerhalb von Crewtender fehlen hier. Die Kennzahlen (Kz.) sind zur Orientierung für die Umsatzsteuer-Voranmeldung in ELSTER. Crewtender übermittelt nichts und ersetzt keine Steuerberatung.</p>`;
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
  if (request.method === "POST") {
    const form = await request.formData();
    const j = /^20\d{2}$/.test(String(form.get("jahr") ?? "")) ? Number(form.get("jahr")) : jahr;
    const zurueck = () => weiterleiten(`/konto/umsatzsteuer?jahr=${j}`, f.s.cookies);
    if (form.get("aktion") !== "extern" || !f.admin) return zurueck();
    const betrag = (k: string) => { const n = Number(String(form.get(k) ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 && n < 100_000_000 ? rund(n) : 0; };
    const alt = await db<{ umsatz_extern: Record<string, number> }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=umsatz_extern`);
    const neu = { ...(alt.ok ? alt.daten[0]?.umsatz_extern ?? {} : {}), [String(j)]: betrag("extern_laufend"), [String(j - 1)]: betrag("extern_vorjahr") };
    for (const k of Object.keys(neu)) if (!neu[k] || Number(k) < j - 3) delete neu[k];
    await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ firma_id: firma, umsatz_extern: neu }) });
    return zurueck();
  }
  const [re, be, pr] = await Promise.all([
    db<ReZeile[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&status=eq.ausgestellt&datum=gte.${jahr - 1}-01-01&select=datum,netto,ust_satz,bezahlt_am,monat,art,ust_betrag,kleinunternehmer,reverse_charge,reverse_charge_eu&limit=20000`),
    db<BeZeile[]>(f.s, env, `belege?firma_id=eq.${firma}&storniert_am=is.null&datum=gte.${jahr}-01-01&datum=lt.${jahr + 1}-01-01&select=datum,brutto,ust_satz,brutto_7,beleg_mime,reverse_charge&limit=20000`),
    db<{ kleinunternehmer: boolean; gruendungsjahr: number | null; umsatz_extern: Record<string, number> | null }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=kleinunternehmer,gruendungsjahr,umsatz_extern`),
  ]);
  const rechnungen = re.ok ? re.daten : [], ku = !!(pr.ok && pr.daten[0]?.kleinunternehmer);
  // S13: the watch counts cautiously by invoice date (whatever the page view) plus turnover outside Crewtender.
  const profil = pr.ok ? pr.daten[0] : undefined, extern = { laufend: Number(profil?.umsatz_extern?.[String(jahr)] ?? 0), vorjahr: Number(profil?.umsatz_extern?.[String(jahr - 1)] ?? 0) };
  const vorjahr = rund(jahresumsatz(rechnungen, jahr - 1, false) + extern.vorjahr), laufend = rund(jahresumsatz(rechnungen, jahr, false) + extern.laufend);
  const gruendung = profil?.gruendungsjahr === jahr;
  return antwort(umsatzsteuerSeite(perioden(rechnungen, be.ok ? be.daten : [], { jahr, quartal, ist, kleinunternehmer: ku }), { jahr, quartal, ist, kleinunternehmer: ku, waechter: kleinunternehmerWaechter(vorjahr, laufend, ku, gruendung), vorjahr, laufend, heuteJahr, extern, bezahlt: jahresumsatz(rechnungen, jahr, true), gruendungsjahr: gruendung, admin: f.admin,
    ausland13b: rund((be.ok ? be.daten : []).filter((b) => b.reverse_charge).reduce((n, b) => n + Number(b.brutto), 0)) }));
}
