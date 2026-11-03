// Idea 41 (docs/ideen-arbeitsoberflaeche.md): post-calculation per customer and month. Planned hours (shifts at the
// customer's sites) against approved hours, wage costs (wage per person or standard wage, surcharges, employer costs)
// against revenue (invoices of the month, otherwise estimated from the customer's hourly rate), contribution margin.
// Finance access only. It is a management view, not bookkeeping.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { landDerFirma, minuten, naechsterMonat, vorMonat, type Eintrag } from "./stunden.ts";
import { zuschlag } from "./zuschlaege.ts";

export type Werte = { lohn: number; nebenkosten: number; nacht: number; sonntag: number; feiertag: number };
export const STANDARD: Werte = { lohn: 15, nebenkosten: 23, nacht: 25, sonntag: 50, feiertag: 100 };
type Kunde = { id: string; name: string };
type Ort = { id: string; kunde_id: string | null };
type Schicht = { datum: string; beginn: string; ende: string; einsatzort_id: string | null; personal_id: string | null };
type Rechnung = { kunde_id: string | null; netto: number | string };
type Preis = { kunde_id: string; satz: number | string; zuschlag_nacht: number | string; zuschlag_sonntag: number | string; zuschlag_feiertag: number | string };
export type Zeile = { kunde_id: string | null; name: string; planMin: number; istMin: number; kosten: number; erloes: number | null; quelle: "rechnung" | "geschaetzt" | null; db: number | null; quote: number | null };

const rund = (n: number) => Math.round(n * 100) / 100;

export function nachkalkulation(d: { kunden: Kunde[]; orte: Ort[]; schichten: Schicht[]; stunden: Eintrag[]; rechnungen: Rechnung[]; preise: Preis[]; loehne: Map<string, number>; werte: Werte; land: string }): Zeile[] {
  const ortKunde = new Map(d.orte.map((o) => [o.id, o.kunde_id]));
  const w = d.werte;
  const ids = new Set<string | null>([...d.stunden.map((e) => e.kunde_id ?? null), ...d.rechnungen.map((r) => r.kunde_id), ...d.schichten.map((s) => (s.einsatzort_id ? ortKunde.get(s.einsatzort_id) ?? null : null)).filter((x) => x !== null)]);
  const zeilen = [...ids].map((kid): Zeile => {
    const plan = d.schichten.filter((s) => s.einsatzort_id && ortKunde.get(s.einsatzort_id) === kid && kid !== null).reduce((n, s) => n + minuten({ beginn: s.beginn, ende: s.ende, pause_min: 0 }), 0);
    const st = d.stunden.filter((e) => (e.kunde_id ?? null) === kid);
    let kosten = 0, zNacht = 0, zSonntag = 0, zFeiertag = 0, ist = 0;
    for (const e of st) {
      const lohn = d.loehne.get(e.personal_id) ?? w.lohn, m = minuten(e), z = zuschlag(e, d.land);
      ist += m; zNacht += z.nacht; zSonntag += z.sonntag; zFeiertag += z.feiertag;
      kosten += (m / 60 * lohn + (z.nacht * w.nacht + z.sonntag * w.sonntag + z.feiertag * w.feiertag) / 60 / 100 * lohn) * (1 + w.nebenkosten / 100);
    }
    const re = d.rechnungen.filter((r) => r.kunde_id === kid);
    const p = kid ? d.preise.find((x) => x.kunde_id === kid) : undefined;
    const satz = Number(p?.satz ?? 0);
    const erloes = re.length ? rund(re.reduce((n, r) => n + Number(r.netto), 0))
      : satz > 0 ? rund(ist / 60 * satz + (zNacht * Number(p!.zuschlag_nacht) + zSonntag * Number(p!.zuschlag_sonntag) + zFeiertag * Number(p!.zuschlag_feiertag)) / 60 / 100 * satz) : null;
    kosten = rund(kosten);
    const db = erloes === null ? null : rund(erloes - kosten);
    return { kunde_id: kid, name: kid ? d.kunden.find((k) => k.id === kid)?.name ?? "Kunde" : "Ohne Kunde (nicht zugeordnet)", planMin: plan, istMin: ist, kosten, erloes, quelle: re.length ? "rechnung" : erloes === null ? null : "geschaetzt", db, quote: db === null || !erloes ? null : Math.round(db / erloes * 1000) / 10 };
  });
  return zeilen.sort((a, b) => (a.kunde_id === null ? 1 : 0) - (b.kunde_id === null ? 1 : 0) || (a.quote ?? 999) - (b.quote ?? 999) || a.name.localeCompare(b.name, "de"));
}

const std = (min: number) => (min / 60).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ampel = (q: number | null) => q === null ? "" : q < 0 ? "🔴" : q < 15 ? "🟡" : "🟢";

export function nachkalkulationSeite(z: Zeile[], o: { monat: string; werte: Werte; personen: { id: string; name: string; lohn: number | null }[]; darf: boolean; laufend?: boolean }): string {
  const summe = z.reduce((a, x) => ({ plan: a.plan + x.planMin, ist: a.ist + x.istMin, kosten: a.kosten + x.kosten, erloes: a.erloes + (x.erloes ?? 0) }), { plan: 0, ist: 0, kosten: 0, erloes: 0 });
  const sdb = rund(summe.erloes - summe.kosten);
  const zeile = (x: Zeile) => `<tr><td>${ampel(x.quote)} ${escape(x.name)}</td><td>${x.planMin ? std(x.planMin) : "–"}</td><td>${std(x.istMin)}</td><td>${x.planMin ? `${x.istMin - x.planMin >= 0 ? "+" : ""}${std(x.istMin - x.planMin)}` : "–"}</td><td>${euro(x.kosten)}</td><td>${x.erloes === null ? `<span class="klein">kein Satz</span>` : `${euro(x.erloes)}${x.quelle === "geschaetzt" ? ` <span class="klein">(geschätzt)</span>` : ""}`}</td><td>${x.db === null ? "–" : euro(x.db)}</td><td>${x.quote === null ? "–" : `${x.quote.toLocaleString("de-DE")} %`}</td></tr>`;
  const w = o.werte;
  const werteForm = o.darf ? `<details class="termin-neu"><summary>⚙️ Kostenwerte</summary><form method="post" action="/konto/nachkalkulation"><input type="hidden" name="aktion" value="werte"><input type="hidden" name="monat" value="${o.monat}"><div class="aueg-form">
${([["lohn", "Standard-Stundenlohn (€)", w.lohn], ["nebenkosten", "Lohnnebenkosten (%)", w.nebenkosten], ["nacht", "Nachtzuschlag (%)", w.nacht], ["sonntag", "Sonntagszuschlag (%)", w.sonntag], ["feiertag", "Feiertagszuschlag (%)", w.feiertag]] as const).map(([k, t, v]) => `<label>${t}<input name="${k}" inputmode="decimal" required value="${String(v).replace(".", ",")}"></label>`).join("")}</div><button>Speichern</button></form></details>` : "";
  const lohnForm = o.darf && o.personen.length ? `<details class="termin-neu"><summary>👷 Stundenlöhne (${o.personen.filter((p) => p.lohn !== null).length} von ${o.personen.length} eingetragen)</summary><form method="post" action="/konto/nachkalkulation"><input type="hidden" name="aktion" value="loehne"><input type="hidden" name="monat" value="${o.monat}"><div class="aueg-form">
${o.personen.map((p) => `<label>${escape(p.name)}<input name="lohn_${p.id}" inputmode="decimal" maxlength="7" value="${p.lohn === null ? "" : String(p.lohn).replace(".", ",")}" placeholder="Standard ${String(w.lohn).replace(".", ",")} €"></label>`).join("")}</div><button>Speichern</button><p class="klein">Leer = Standardlohn. Die Löhne sehen nur Personen mit Finanzfreigabe.</p></form></details>` : "";
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/nachkalkulation?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${new Date(`${o.monat}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><a class="knopf zweit" href="/konto/nachkalkulation?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
${o.laufend ? `<p class="klein">📅 Laufender Monat: geplante Stunden zählen nur bis gestern, damit noch kommende Schichten nicht als Lücke erscheinen.</p>` : ""}<p class="klein">Pro Kunde: geplante Stunden (Schichten an seinen Einsatzorten) gegen freigegebene Stunden, Lohnkosten (Stundenlohn + Zuschläge + ${String(w.nebenkosten).replace(".", ",")} % Lohnnebenkosten) gegen Erlös (Rechnungen des Monats, sonst geschätzt aus dem Verrechnungssatz). 🔴 Verlust · 🟡 unter 15 % · 🟢 ab 15 % Deckungsbeitrag. Gemeinkosten (Büro, Fahrzeuge, Versicherung) sind nicht abgezogen.</p>
${z.length ? `<p class="gewerk-zahlen"><span><strong>${euro(summe.erloes)}</strong> Erlös</span> <span><strong>${euro(summe.kosten)}</strong> Lohnkosten</span> <span><strong>${euro(sdb)}</strong> Deckungsbeitrag${summe.erloes ? ` (${(Math.round(sdb / summe.erloes * 1000) / 10).toLocaleString("de-DE")} %)` : ""}</span></p>
<div class="tabelle-rahmen"><table class="tabelle"><thead><tr><th>Kunde</th><th>Plan-Std.</th><th>Ist-Std.</th><th>Abw.</th><th>Lohnkosten</th><th>Erlös</th><th>DB</th><th>DB %</th></tr></thead><tbody>${z.map(zeile).join("")}</tbody></table></div>` : `<p class="treffer-leer">Keine freigegebenen Stunden, Schichten oder Rechnungen in diesem Monat.</p>`}
${werteForm}${lohnForm}`;
}

const zahl = (v: unknown) => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

export async function nachkalkulationRoute(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/nachkalkulation") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Nachkalkulation", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen) return antwort("<p>Die Nachkalkulation sehen Personen mit Finanzfreigabe.</p>", 403);
  const firma = f.m.firma_id, darf = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monatWahl = (v: string | null) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v ?? "") ? v! : heute.slice(0, 7);
  if (request.method === "POST") {
    const form = await request.formData();
    const monat = monatWahl(String(form.get("monat") ?? ""));
    const zurueck = (h: string) => weiterleiten(`/konto/nachkalkulation?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darf) return zurueck("Ändern dürfen Bearbeiter und Admins mit Finanzfreigabe.");
    if (form.get("aktion") === "werte") {
      const w = { lohn: zahl(form.get("lohn")), nebenkosten: zahl(form.get("nebenkosten")), nacht: zahl(form.get("nacht")), sonntag: zahl(form.get("sonntag")), feiertag: zahl(form.get("feiertag")) };
      if (!(w.lohn > 0 && w.lohn <= 500) || ![w.nebenkosten, w.nacht, w.sonntag, w.feiertag].every((x) => x >= 0 && x <= 300) || w.nebenkosten > 100) return zurueck("Bitte die Werte prüfen.");
      const r = await db(f.s, env, "nachkalkulation_werte?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ firma_id: firma, ...w }) });
      return zurueck(r.ok ? "Kostenwerte gespeichert." : "Speichern hat nicht geklappt.");
    }
    if (form.get("aktion") === "loehne") {
      const setzen: { personal_id: string; firma_id: string; stundenlohn: number; geaendert: string }[] = [], weg: string[] = [];
      for (const [k, v] of form.entries()) {
        const id = /^lohn_([0-9a-f-]{36})$/.exec(k)?.[1];
        if (!id) continue;
        const t = String(v).trim();
        if (!t) weg.push(id);
        else { const n = zahl(t); if (n > 0 && n <= 500) setzen.push({ personal_id: id, firma_id: firma, stundenlohn: Math.round(n * 100) / 100, geaendert: new Date().toISOString() }); }
      }
      const r = setzen.length ? await db(f.s, env, "personal_loehne?on_conflict=personal_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify(setzen.slice(0, 500)) }) : { ok: true };
      if (weg.length) await db(f.s, env, `personal_loehne?firma_id=eq.${firma}&personal_id=in.(${weg.slice(0, 500).join(",")})`, { method: "DELETE" });
      return zurueck(r.ok ? "Stundenlöhne gespeichert." : "Speichern hat nicht geklappt.");
    }
    return zurueck("Nichts geändert.");
  }
  const monat = monatWahl(url.searchParams.get("monat"));
  const von = `${monat}-01`, bis = `${naechsterMonat(monat)}-01`;
  // Running month: plan and actual hours only up to yesterday, otherwise every shift still ahead looks like a gap.
  const laufend = monat === heute.slice(0, 7);
  const planBis = laufend ? heute : bis;
  const [k, o, sch, st, re, pr, lo, we, pe, land] = await Promise.all([
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&limit=1000`),
    db<Ort[]>(f.s, env, `einsatzorte?firma_id=eq.${firma}&select=id,kunde_id&limit=3000`),
    db<Schicht[]>(f.s, env, `schichten?firma_id=eq.${firma}&datum=gte.${von}&datum=lt.${planBis}&einsatzort_id=not.is.null&antwort=neq.abgesagt&select=datum,beginn,ende,einsatzort_id,personal_id&limit=20000`),
    db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&status=eq.freigegeben&datum=gte.${von}&datum=lt.${bis}&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status,kunde_id&limit=20000`),
    db<(Rechnung & { monat: string })[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&monat=eq.${monat}&select=kunde_id,netto,monat&limit=2000`),
    db<Preis[]>(f.s, env, `kunden_preise?firma_id=eq.${firma}&select=kunde_id,satz,zuschlag_nacht,zuschlag_sonntag,zuschlag_feiertag&limit=1000`),
    db<{ personal_id: string; stundenlohn: number | string }[]>(f.s, env, `personal_loehne?firma_id=eq.${firma}&select=personal_id,stundenlohn&limit=5000`),
    db<Werte[]>(f.s, env, `nachkalkulation_werte?firma_id=eq.${firma}&select=lohn,nebenkosten,nacht,sonntag,feiertag`),
    db<{ id: string; vorname: string; nachname: string }[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=5000`),
    landDerFirma(f.s, env, firma),
  ]);
  const w0 = we.ok ? we.daten[0] : undefined;
  const werte: Werte = w0 ? { lohn: Number(w0.lohn), nebenkosten: Number(w0.nebenkosten), nacht: Number(w0.nacht), sonntag: Number(w0.sonntag), feiertag: Number(w0.feiertag) } : STANDARD;
  const loehne = new Map((lo.ok ? lo.daten : []).map((x) => [x.personal_id, Number(x.stundenlohn)]));
  const stunden = st.ok ? st.daten : [];
  const z = nachkalkulation({ kunden: k.ok ? k.daten : [], orte: o.ok ? o.daten : [], schichten: sch.ok ? sch.daten : [], stunden, rechnungen: re.ok ? re.daten : [], preise: pr.ok ? pr.daten : [], loehne, werte, land });
  const aktiv = new Set(stunden.map((e) => e.personal_id));
  const personen = (pe.ok ? pe.daten : []).filter((p) => aktiv.has(p.id) || loehne.has(p.id)).map((p) => ({ id: p.id, name: `${p.vorname} ${p.nachname}`.trim(), lohn: loehne.get(p.id) ?? null })).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${nachkalkulationSeite(z, { monat, werte, personen, darf, laufend })}`);
}
