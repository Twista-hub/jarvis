// T37: Arbeitszeitkonto. Target hours from the weekly hours spread over the person's working days (Mon–Fri without an
// own setting; part-time from personal.arbeitstage, 09.11.2026), without public holidays and confirmed absences,
// against approved hours from the time sheets; plus/minus per month and the running balance from a start date.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { feiertag } from "./zuschlaege.ts";
import { landDerFirma, landJeBereich, minuten, type Eintrag } from "./stunden.ts";

export type ZPerson = { id: string; vorname: string; nachname: string; status: string; wochenstunden: number | string | null; eintritt: string | null; bereich_id?: string | null; arbeitstage?: number[] | null };
export type Start = { personal_id: string; ab: string; startsaldo_min: number };
type Abw = { personal_id: string; von: string; bis: string; status?: string };
type Std = Pick<Eintrag, "personal_id" | "datum" | "beginn" | "ende" | "pause_min" | "status">;
export type Monat = { monat: string; soll: number; ist: number; saldo: number; stand: number };
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const hm = (min: number) => `${min < 0 ? "−" : "+"}${Math.floor(Math.abs(min) / 60)}:${String(Math.abs(min) % 60).padStart(2, "0")}`;
const mName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Month by month from the start date to `bis` (inclusive): target, actual, plus/minus and running balance (minutes). */
export function zeitkonto(p: ZPerson, start: Start | undefined, stunden: Std[], abw: Abw[], land: string, bis: string): Monat[] {
  const woche = Number(p.wochenstunden ?? 0);
  // Without a start date: from the first time sheet in Crewtender (not from the joining date, which would count years
  // without recorded hours as minus hours).
  const erster = stunden.filter((s) => s.personal_id === p.id).map((s) => s.datum).sort()[0];
  const ab = start?.ab ?? (erster && p.eintritt && p.eintritt > erster ? p.eintritt : erster);
  if (!woche || !ab || ab > bis) return [];
  const tage = p.arbeitstage?.length ? p.arbeitstage : [1, 2, 3, 4, 5];
  const proTag = Math.round((woche * 60) / tage.length);
  const monate: Monat[] = [];
  let stand = start?.startsaldo_min ?? 0, soll = 0, ist = 0, monat = ab.slice(0, 7);
  const abschluss = () => { stand += ist - soll; monate.push({ monat, soll, ist, saldo: ist - soll, stand }); soll = 0; ist = 0; };
  for (let d = ab; d <= bis; d = plus(d, 1)) {
    if (d.slice(0, 7) !== monat) { abschluss(); monat = d.slice(0, 7); }
    const w = new Date(`${d}T12:00:00Z`).getUTCDay() || 7;
    if (tage.includes(w) && !feiertag(d, land) && !abw.some((a) => a.personal_id === p.id && a.status !== "beantragt" && a.von <= d && a.bis >= d)) soll += proTag;
  }
  ist = 0;
  for (const s of stunden) if (s.personal_id === p.id && s.status === "freigegeben" && s.datum >= ab && s.datum <= bis) {
    const i = monate.findIndex((x) => x.monat === s.datum.slice(0, 7));
    if (i >= 0) monate[i].ist += minuten(s); else ist += minuten(s);
  }
  abschluss();
  let lauf = start?.startsaldo_min ?? 0;
  for (const x of monate) { x.saldo = x.ist - x.soll; lauf += x.saldo; x.stand = lauf; }
  return monate;
}

export function zeitkontoSeite(personen: ZPerson[], starts: Start[], stunden: Std[], abw: Abw[], o: { land: string; heute: string; darfAendern: boolean; landVon?: (bereich: string | null | undefined) => string }): string {
  const aktiv = personen.filter((p) => p.status !== "nicht");
  const ohne = aktiv.filter((p) => !Number(p.wochenstunden ?? 0));
  const karten = aktiv.filter((p) => Number(p.wochenstunden ?? 0)).map((p) => {
    const st = starts.find((s) => s.personal_id === p.id), m = zeitkonto(p, st, stunden, abw, o.landVon ? o.landVon(p.bereich_id) : o.land, o.heute), jetzt = m.at(-1)?.stand ?? st?.startsaldo_min ?? 0;
    return `<details class="psa-person zeitkonto"><summary><strong>${escape(`${p.vorname} ${p.nachname}`.trim())}</strong><span class="klein">${String(p.wochenstunden).replace(".", ",")} Std./Woche · Saldo <strong class="${jetzt < 0 ? "minus" : "plus"}">${hm(jetzt)} Std.</strong></span></summary>
${m.length ? `<table class="auswertung-tabelle zu-tabelle"><thead><tr><th>Monat</th><th>Soll</th><th>Ist</th><th>+/−</th><th>Stand</th></tr></thead><tbody>${[...m].reverse().slice(0, 12).map((x) => `<tr><td>${mName(x.monat)}</td><td>${hm(x.soll).slice(1)}</td><td>${hm(x.ist).slice(1)}</td><td class="${x.saldo < 0 ? "minus" : ""}">${hm(x.saldo)}</td><td><strong>${hm(x.stand)}</strong></td></tr>`).join("")}</tbody></table>` : `<p class="klein">Noch kein Startdatum und keine Stunden.</p>`}
${o.darfAendern ? `<form method="post" action="/konto/zeitkonto" class="zeile-form"><input type="hidden" name="person" value="${p.id}"><label>Konto ab<input type="date" name="ab" value="${escape(st?.ab ?? o.heute.slice(0, 8) + "01")}"></label><label>Startsaldo (Std.)<input name="saldo" inputmode="decimal" maxlength="7" value="${st ? String(Math.round((st.startsaldo_min / 60) * 100) / 100).replace(".", ",") : "0"}"></label><button class="zweit">Speichern</button></form>` : ""}</details>`;
  }).join("");
  return `<p class="klein">Soll = Wochenstunden verteilt auf die Arbeitstage der Person (ohne Angabe Mo–Fr, bei Teilzeit in der Personalakte einstellbar), ohne Feiertage, Urlaub und andere bestätigte Abwesenheit. Ist = freigegebene Stunden; offene Stundenzettel zählen erst nach der Freigabe. Ohne eigenes Startdatum zählt das Konto ab dem ersten Stundenzettel in Crewtender. Überstunden aus der Zeit davor trägst du als Startsaldo ein.</p>
${karten || `<p class="treffer-leer">Noch niemand mit Wochenstunden.</p>`}${ohne.length ? `<p class="klein">Ohne Wochenstunden (in der Personalakte eintragen): ${ohne.map((p) => escape(`${p.vorname} ${p.nachname}`.trim())).join(", ")}</p>` : ""}`;
}

export async function zeitkontoDaten(s: Parameters<typeof db>[0], env: KontoEnv, firma: string, heute: string, person?: string) {
  const f = person ? `&personal_id=eq.${person}` : "";
  const [p, st, sz, a, land, landVon] = await Promise.all([
    db<ZPerson[]>(s, env, `personal?firma_id=eq.${firma}${person ? `&id=eq.${person}` : ""}&select=id,vorname,nachname,status,wochenstunden,eintritt,bereich_id,arbeitstage&order=vorname&limit=3000`),
    db<Start[]>(s, env, `zeitkonten?firma_id=eq.${firma}${f}&select=personal_id,ab,startsaldo_min&limit=3000`),
    db<Std[]>(s, env, `stundenzettel?firma_id=eq.${firma}${f}&status=eq.freigegeben&datum=gte.${Number(heute.slice(0, 4)) - 1}-01-01&select=personal_id,datum,beginn,ende,pause_min,status&limit=100000`),
    db<Abw[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}${f}&status=eq.bestaetigt&bis=gte.${Number(heute.slice(0, 4)) - 1}-01-01&select=personal_id,von,bis,status&limit=20000`),
    landDerFirma(s, env, firma),
    landJeBereich(s, env, firma),
  ]);
  return { personen: p.ok ? p.daten : [], starts: st.ok ? st.daten : [], stunden: sz.ok ? sz.daten : [], abw: a.ok ? a.daten : [], land, landVon };
}

export async function zeitkontoRoute(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/zeitkonto") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Arbeitszeitkonto", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich", f.s.cookies);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/zeitkonto?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter, Standortleitungen und Admins.");
    const pid = String(form.get("person") ?? ""), ab = String(form.get("ab") ?? ""), saldo = Number(String(form.get("saldo") ?? "0").replace(",", ".").replace("−", "-"));
    if (!/^[0-9a-f-]{36}$/.test(pid) || !/^\d{4}-\d{2}-\d{2}$/.test(ab) || !Number.isFinite(saldo) || Math.abs(saldo) > 1000) return zurueck("Bitte Datum und Startsaldo (Stunden) prüfen.");
    const r = await db(f.s, env, "zeitkonten?on_conflict=personal_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, personal_id: pid, ab, startsaldo_min: Math.round(saldo * 60) }) });
    return zurueck(r.ok ? "Zeitkonto gespeichert." : "Speichern hat nicht geklappt.");
  }
  const d = await zeitkontoDaten(f.s, env, firma, heute);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${zeitkontoSeite(d.personen, d.starts, d.stunden, d.abw, { land: d.land, heute, darfAendern, landVon: d.landVon })}`);
}
