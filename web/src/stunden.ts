// T17: Stundenzettel. Staff enter start, end and break per day on the phone ("Meine Einsätze & Daten"); the office
// approves or rejects, enters hours itself if needed, and exports a month as Excel for payroll and invoicing.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { xlsxAntwort, xlsxDatei, type Zelle } from "./xlsx.ts";
import { landAusPlz, LAENDER, summe, zuschlag, zuschlagText } from "./zuschlaege.ts";
import type { Sitzung } from "./konto.ts";

export type Eintrag = { id: string; personal_id: string; datum: string; beginn: string; ende: string; pause_min: number; einsatz: string; notiz: string; status: string; kunde_id?: string | null; erstellt?: string; personal?: { vorname: string; nachname: string } | null };
export const STATUS: Record<string, [string, string]> = { erfasst: ["⏳", "offen"], freigegeben: ["✅", "freigegeben"], abgelehnt: ["❌", "abgelehnt"] };

const zuMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** Working minutes: end minus start (past midnight for night shifts) minus break, never below 0. */
export const minuten = (e: Pick<Eintrag, "beginn" | "ende" | "pause_min">) => { let d = zuMin(e.ende) - zuMin(e.beginn); if (d <= 0) d += 1440; return Math.max(0, d - (e.pause_min || 0)); };
export const stunden = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
export const dezimal = (min: number) => Math.round((min / 60) * 100) / 100;
const uhr = (t: string) => t.slice(0, 5);
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const naechsterMonat = (m: string) => { const [j, mo] = m.split("-").map(Number); return mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, "0")}`; };
export const vorMonat = (m: string) => { const [j, mo] = m.split("-").map(Number); return mo === 1 ? `${j - 1}-12` : `${j}-${String(mo - 1).padStart(2, "0")}`; };
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Federal state of the place of work per customer (Rechtsprüfung A4): the postal code of the customer's site if it has
 *  exactly one, else of the customer. Entries without customer keep the firm's state. */
export async function einsatzLaender(sz: Sitzung, env: KontoEnv, firma: string): Promise<Map<string, string>> {
  const [k, o] = await Promise.all([
    db<{ id: string; plz: string | null }[]>(sz, env, `kunden?firma_id=eq.${firma}&select=id,plz&limit=2000`),
    db<{ kunde_id: string | null; plz: string | null }[]>(sz, env, `einsatzorte?firma_id=eq.${firma}&select=kunde_id,plz&limit=5000`),
  ]);
  const m = new Map<string, string>();
  for (const x of k.ok ? k.daten : []) {
    const orte = (o.ok ? o.daten : []).filter((y) => y.kunde_id === x.id && landAusPlz(y.plz));
    const land = orte.length === 1 ? landAusPlz(orte[0].plz) : landAusPlz(x.plz);
    if (land) m.set(x.id, land);
  }
  return m;
}
/** Entries with the federal state of their place of work (for holidays and surcharges). */
export const mitLand = <T extends { kunde_id?: string | null }>(l: T[], laender: Map<string, string>): (T & { land?: string })[] =>
  l.map((e) => (e.kunde_id && laender.has(e.kunde_id) ? { ...e, land: laender.get(e.kunde_id) } : e));

/** Federal state for public holidays: chosen in the company profile, else from the firm's postal code. */
export async function landDerFirma(sz: Sitzung, env: KontoEnv, firma: string): Promise<string> {
  const [p, f] = await Promise.all([
    db<{ bundesland: string }[]>(sz, env, `firmenprofil?firma_id=eq.${firma}&select=bundesland`),
    db<{ plz: string | null }[]>(sz, env, `firmen?id=eq.${firma}&select=plz`),
  ]);
  return (p.ok && p.daten[0]?.bundesland) || landAusPlz(f.ok ? f.daten[0]?.plz : "");
}

/** Rechtsprüfung A4: federal state per person – the state set at the person's location (or a parent location), else the
 *  firm's. Used for public holidays in leave and the time account. */
export async function landJeBereich(sz: Sitzung, env: KontoEnv, firma: string): Promise<(bereich: string | null | undefined) => string> {
  const [firmenLand, b] = await Promise.all([landDerFirma(sz, env, firma), db<{ id: string; parent_id: string | null; bundesland: string }[]>(sz, env, `bereiche?firma_id=eq.${firma}&select=id,parent_id,bundesland&limit=2000`)]);
  return landResolver(b.ok ? b.daten : [], firmenLand);
}
export function landResolver(bereiche: { id: string; parent_id: string | null; bundesland: string }[], firmenLand: string): (bereich: string | null | undefined) => string {
  const nach = new Map(bereiche.map((x) => [x.id, x]));
  return (bereich) => {
    for (let x = bereich ? nach.get(bereich) : undefined, n = 0; x && n < 10; x = x.parent_id ? nach.get(x.parent_id) : undefined, n++) if (x.bundesland) return x.bundesland;
    return firmenLand;
  };
}

/** Working-time hints (ArbZG): more than 10 hours a day, too short a break after 6 or 9 hours. */
export function hinweise(liste: Eintrag[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (id: string, t: string) => m.set(id, [...(m.get(id) ?? []), t]);
  for (const e of liste) {
    const brutto = minuten({ ...e, pause_min: 0 });
    if (brutto > 540 && e.pause_min < 45) add(e.id, "Pause unter 45 Min. bei über 9 Std.");
    else if (brutto > 360 && e.pause_min < 30) add(e.id, "Pause unter 30 Min. bei über 6 Std.");
    // § 17 Abs. 1 MiLoG: hours must be recorded by the seventh day after the working day (A-M6).
    if (e.erstellt && Date.parse(e.erstellt) > Date.parse(`${e.datum}T23:59:59Z`) + 7 * 86400_000) add(e.id, "später als 7 Tage nach dem Arbeitstag erfasst (§ 17 MiLoG)");
  }
  const proTag = new Map<string, Eintrag[]>();
  for (const e of liste) proTag.set(`${e.personal_id}|${e.datum}`, [...(proTag.get(`${e.personal_id}|${e.datum}`) ?? []), e]);
  for (const l of proTag.values()) if (l.reduce((s, e) => s + minuten(e), 0) > 600) for (const e of l) add(e.id, "über 10 Std. am Tag");
  return m;
}

/** Form → entry (start, end, break, assignment); a text when something is missing. */
export function ausFormular(f: FormData, heute: string, eigen: boolean): { datum: string; beginn: string; ende: string; pause_min: number; einsatz: string; notiz: string } | string {
  const t = (k: string, max: number) => String(f.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const datum = t("datum", 10), beginn = t("beginn", 5), ende = t("ende", 5), pause = Number(t("pause", 4) || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !Number.isFinite(Date.parse(datum))) return "Bitte ein Datum wählen.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(beginn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(ende) || beginn === ende) return "Bitte Beginn und Ende angeben.";
  if (!Number.isInteger(pause) || pause < 0 || pause > 600) return "Pause in Minuten (0 bis 600).";
  if (datum > heute) return "Stunden erst am Tag selbst oder danach eintragen.";
  if (eigen && datum < plusTage(heute, -62)) return "Ältere Tage bitte im Büro nachtragen lassen.";
  if (minuten({ beginn, ende, pause_min: pause }) === 0) return "Die Pause ist länger als die Arbeitszeit.";
  return { datum, beginn, ende, pause_min: pause, einsatz: t("einsatz", 160), notiz: t("notiz", 300) };
}

const felder = (heute: string, vorschlaege: string[], eigen: boolean) => `<div class="aueg-form"><label>Datum<input type="date" name="datum" required value="${heute}" max="${heute}"${eigen ? ` min="${plusTage(heute, -62)}"` : ""}></label><label>Pause (Min.)<input type="number" name="pause" min="0" max="600" step="5" value="30" inputmode="numeric"></label>
<label>Beginn<input type="time" name="beginn" required value="07:00"></label><label>Ende<input type="time" name="ende" required value="15:30"></label>
<label class="ganz">Einsatz / Kunde<input name="einsatz" maxlength="160" list="einsatz-vorschlaege"${vorschlaege.length ? ` value="${escape(vorschlaege[0])}"` : ""}></label><datalist id="einsatz-vorschlaege">${vorschlaege.map((v) => `<option value="${escape(v)}">`).join("")}</datalist>
<label class="ganz">Notiz (freiwillig)<input name="notiz" maxlength="300"></label></div>`;

/** Section on the staff page: enter hours, own entries of this and last month. */
export function meineStundenTeil(liste: Eintrag[], vorschlaege: string[], heute: string): string {
  const monat = heute.slice(0, 7);
  const dieser = liste.filter((e) => e.datum.startsWith(monat));
  const summe = dieser.reduce((s, e) => s + minuten(e), 0), frei = dieser.filter((e) => e.status === "freigegeben").reduce((s, e) => s + minuten(e), 0);
  const h = hinweise(liste);
  const sortiert = [...liste].sort((a, b) => b.datum.localeCompare(a.datum) || b.beginn.localeCompare(a.beginn)).slice(0, 40);
  return `<section id="stunden"><h3>⏱️ Meine Stunden</h3><p class="klein">${monatName(monat)}: <strong>${stunden(summe)} Std.</strong>${summe ? ` · davon freigegeben ${stunden(frei)}` : ""}</p>
<details class="termin-neu"${liste.some((e) => e.datum === heute) ? "" : " open"}><summary>➕ Stunden eintragen</summary><form method="post" action="/konto/ich"><input type="hidden" name="aktion" value="stunden">${felder(heute, vorschlaege, true)}<button>Speichern</button></form></details>
${sortiert.length ? `<ul class="kontakt-liste ich-liste stunden-liste">${sortiert.map((e) => `<li class="${e.status === "abgelehnt" ? "abgelaufen" : e.status === "erfasst" ? "bald" : ""}"><div><strong>${tag(e.datum)} · ${uhr(e.beginn)}–${uhr(e.ende)} · ${stunden(minuten(e))} Std.</strong><span class="klein">${STATUS[e.status]?.[0] ?? ""} ${STATUS[e.status]?.[1] ?? ""}${e.pause_min ? ` · Pause ${e.pause_min} Min.` : ""}${e.einsatz ? ` · ${escape(e.einsatz)}` : ""}${(h.get(e.id) ?? []).map((x) => ` · ⚠️ ${x}`).join("")}</span></div>${e.status === "erfasst" ? `<form method="post" action="/konto/ich"><input type="hidden" name="stunde_loeschen" value="${e.id}"><button class="zweit" aria-label="Eintrag löschen">✕</button></form>` : ""}</li>`).join("")}</ul>` : ""}</section>`;
}

type Person = { id: string; vorname: string; nachname: string };
/** Office page: one month, grouped by person, approve or reject several at once. */
export function stundenSeite(liste: Eintrag[], personen: Person[], o: { monat: string; heute: string; nurOffen: boolean; darfAendern: boolean; land?: string }): string {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "?"; };
  const h = hinweise(liste);
  const gezeigt = o.nurOffen ? liste.filter((e) => e.status === "erfasst") : liste;
  const gruppen = [...new Set(gezeigt.map((e) => e.personal_id))].sort((a, b) => name(a).localeCompare(name(b), "de"));
  const offen = liste.filter((e) => e.status === "erfasst").length;
  const proEinsatz = new Map<string, number>();
  for (const e of liste.filter((x) => x.status !== "abgelehnt")) proEinsatz.set(e.einsatz || "ohne Angabe", (proEinsatz.get(e.einsatz || "ohne Angabe") ?? 0) + minuten(e));
  const kopf = `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/stunden?monat=${vorMonat(o.monat)}${o.nurOffen ? "" : "&alle=1"}" aria-label="Vormonat">‹</a><strong>${monatName(o.monat)}</strong><a class="knopf zweit" href="/konto/stunden?monat=${naechsterMonat(o.monat)}${o.nurOffen ? "" : "&alle=1"}" aria-label="Nächster Monat">›</a></nav>
<nav class="ordner-chips" aria-label="Ansicht"><a href="/konto/stunden?monat=${o.monat}"${o.nurOffen ? ' aria-current="page"' : ""}>Offen (${offen})</a><a href="/konto/stunden?monat=${o.monat}&alle=1"${o.nurOffen ? "" : ' aria-current="page"'}>Alle (${liste.length})</a><a href="/konto/stunden.xlsx?monat=${o.monat}" download>📊 Excel</a><a href="/konto/lohn.xlsx?monat=${o.monat}" download>💶 Lohnliste</a><a href="/konto/lohn.csv?monat=${o.monat}" download>CSV</a><a href="/konto/lohn-lodas.txt?monat=${o.monat}" download title="Bewegungsdaten für DATEV LODAS (Lohnarten unter Belege → DATEV-Einstellungen)">LODAS</a><a href="/konto/zeitkonto">⚖️ Zeitkonto</a></nav>`;
  const zeile = (e: Eintrag) => `<li class="stunden-zeile ${e.status}">${o.darfAendern && e.status === "erfasst" ? `<input type="checkbox" name="id" value="${e.id}" aria-label="Auswählen" checked>` : `<span aria-hidden="true">${STATUS[e.status]?.[0] ?? ""}</span>`}<div><span>${tag(e.datum)} · ${uhr(e.beginn)}–${uhr(e.ende)}${e.pause_min ? ` <span class="klein">−${e.pause_min}′</span>` : ""}</span><span class="klein">${escape(e.einsatz || "ohne Einsatz")}${e.notiz ? ` · ${escape(e.notiz)}` : ""}${(h.get(e.id) ?? []).map((x) => ` · <span class="warnung">⚠️ ${x}</span>`).join("")}</span></div><strong>${stunden(minuten(e))}</strong>${zuschlagText(zuschlag(e, o.land ?? "")) ? `<span class="klein zuschlag">${zuschlagText(zuschlag(e, o.land ?? ""))}</span>` : ""}</li>`;
  const karten = gruppen.map((pid) => {
    const l = gezeigt.filter((e) => e.personal_id === pid).sort((a, b) => a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn));
    const alle = liste.filter((e) => e.personal_id === pid && e.status !== "abgelehnt");
    return `<section class="stunden-person"><h3>${escape(name(pid))} <a class="klein" href="/konto/stunden/${pid}.docx?monat=${o.monat}" download title="Stundennachweis als Word, mit Unterschrift falls vorhanden">📄 Nachweis</a> <span class="klein">${stunden(alle.reduce((s, e) => s + minuten(e), 0))} Std. im Monat${zuschlagText(summe(alle.map((e) => zuschlag(e, o.land ?? "")))) ? ` · ${zuschlagText(summe(alle.map((e) => zuschlag(e, o.land ?? ""))))}` : ""}</span></h3><ul class="kontakt-liste stunden-buero">${l.map(zeile).join("")}</ul></section>`;
  }).join("");
  const knoepfe = o.darfAendern && gezeigt.some((e) => e.status === "erfasst") ? `<div class="stunden-knoepfe"><button name="aktion" value="freigeben">✓ Ausgewählte freigeben</button><button name="aktion" value="ablehnen" class="zweit">✕ Ablehnen</button></div>` : "";
  const neu = o.darfAendern && personen.length ? `<details class="termin-neu"><summary>➕ Stunden für eine Person eintragen</summary><form method="post" action="/konto/stunden"><input type="hidden" name="aktion" value="neu"><input type="hidden" name="monat" value="${o.monat}"><label>Person<select name="person" required>${personen.map((p) => `<option value="${p.id}">${escape(`${p.vorname} ${p.nachname}`.trim())}</option>`).join("")}</select></label>${felder(o.heute, [], false)}<button>Speichern (gleich freigegeben)</button></form></details>` : "";
  return `${kopf}<p class="klein">Einsatzkräfte tragen ihre Stunden unter „Meine Einsätze &amp; Daten“ ein. Hier gibst du sie frei; die Excel-Datei enthält alle Einträge des Monats mit Summen pro Person und Einsatz. Zuschläge: 🌙 Nacht 23–6 Uhr, ☀️ Sonntag, 🎉 Feiertag (${escape(LAENDER[o.land ?? ""] ?? "nur bundesweite")}${o.land ? "" : " Feiertage"}; Bundesland im Firmenprofil).</p>
${gruppen.length ? `<form method="post" action="/konto/stunden" class="stunden-form"><input type="hidden" name="monat" value="${o.monat}">${knoepfe}${karten}${knoepfe}</form>` : `<p class="treffer-leer">${o.nurOffen ? "Nichts wartet auf Freigabe." : "Keine Stunden in diesem Monat."}</p>`}
${proEinsatz.size ? `<h2>Summe pro Einsatz</h2><ul class="kontakt-liste">${[...proEinsatz].sort((a, b) => b[1] - a[1]).map(([k, m]) => `<li><span>${escape(k)}</span><strong>${stunden(m)} Std.</strong></li>`).join("")}</ul>` : ""}${neu}`;
}

export function stundenExcel(liste: Eintrag[], personen: Person[], monat: string, land = ""): Uint8Array {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "?"; };
  const sortiert = [...liste].sort((a, b) => name(a.personal_id).localeCompare(name(b.personal_id), "de") || a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn));
  const h = hinweise(liste);
  const zeilen: Zelle[][] = [["Person", "Datum", "Beginn", "Ende", "Pause (Min.)", "Stunden", "davon Nacht", "davon Sonntag", "davon Feiertag", "Einsatz / Kunde", "Status", "Notiz", "Hinweis"],
    ...sortiert.map((e) => { const z = zuschlag(e, land); return [name(e.personal_id), e.datum.split("-").reverse().join("."), uhr(e.beginn), uhr(e.ende), e.pause_min, dezimal(minuten(e)), dezimal(z.nacht), dezimal(z.sonntag), dezimal(z.feiertag), e.einsatz, STATUS[e.status]?.[1] ?? e.status, e.notiz, (h.get(e.id) ?? []).join("; ")]; })];
  const personenSumme: Zelle[][] = [["Person", "Stunden gesamt", "freigegeben", "offen", "Nacht", "Sonntag", "Feiertag"], ...[...new Set(sortiert.map((e) => e.personal_id))].map((pid) => {
    const l = liste.filter((e) => e.personal_id === pid && e.status !== "abgelehnt");
    const z = summe(l.map((e) => zuschlag(e, land)));
    return [name(pid), dezimal(l.reduce((s, e) => s + minuten(e), 0)), dezimal(l.filter((e) => e.status === "freigegeben").reduce((s, e) => s + minuten(e), 0)), dezimal(l.filter((e) => e.status === "erfasst").reduce((s, e) => s + minuten(e), 0)), dezimal(z.nacht), dezimal(z.sonntag), dezimal(z.feiertag)];
  })];
  const einsatz = new Map<string, number>();
  for (const e of liste.filter((x) => x.status !== "abgelehnt")) einsatz.set(e.einsatz || "ohne Angabe", (einsatz.get(e.einsatz || "ohne Angabe") ?? 0) + minuten(e));
  return xlsxDatei([
    { name: `Stunden ${monat}`, zeilen, breiten: [22, 11, 8, 8, 11, 9, 11, 12, 12, 28, 12, 24, 30] },
    { name: "Summe Personen", zeilen: personenSumme, breiten: [24, 15, 13, 10, 10, 10, 10] },
    { name: "Summe Einsätze", zeilen: [["Einsatz / Kunde", "Stunden"], ...[...einsatz].sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, dezimal(m)])], breiten: [32, 12] },
  ]);
}

export async function stundenRoute(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/stunden" && url.pathname !== "/konto/stunden.xlsx") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Stundenzettel", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich#stunden", f.s.cookies);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monatWahl = (v: string | null) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v ?? "") ? v! : heute.slice(0, 7);
  if (request.method === "POST") {
    const form = await request.formData();
    const monat = monatWahl(String(form.get("monat") ?? ""));
    const zurueck = (h: string) => weiterleiten(`/konto/stunden?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Freigeben dürfen Bearbeiter, Standortleitungen und Admins.");
    const aktion = String(form.get("aktion") ?? "");
    if (aktion === "neu") {
      const pid = String(form.get("person") ?? "");
      const e = ausFormular(form, heute, false);
      if (!/^[0-9a-f-]{36}$/.test(pid)) return zurueck("Bitte eine Person wählen.");
      if (typeof e === "string") return zurueck(e);
      const r = await db(f.s, env, "stundenzettel", { method: "POST", body: JSON.stringify({ ...e, firma_id: firma, personal_id: pid, status: "freigegeben", freigegeben_von: f.s.userId, freigegeben_am: new Date().toISOString() }) });
      return weiterleiten(`/konto/stunden?monat=${e.datum.slice(0, 7)}&alle=1&hinweis=${encodeURIComponent(r.ok ? "Stunden eingetragen." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?")}`, f.s.cookies);
    }
    const ids = form.getAll("id").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
    if (!ids.length || !["freigeben", "ablehnen"].includes(aktion)) return zurueck("Bitte mindestens einen Eintrag auswählen.");
    const r = await db<{ id: string }[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&id=in.(${ids.join(",")})&status=eq.erfasst&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(aktion === "freigeben" ? { status: "freigegeben", freigegeben_von: f.s.userId, freigegeben_am: new Date().toISOString() } : { status: "abgelehnt", freigegeben_von: f.s.userId, freigegeben_am: new Date().toISOString() }) });
    const n = r.ok ? r.daten.length : 0;
    return zurueck(n ? `${n} ${n === 1 ? "Eintrag" : "Einträge"} ${aktion === "freigeben" ? "freigegeben" : "abgelehnt"}.` : "Nichts geändert. Hast du Rechte für den Standort dieser Personen?");
  }
  const monat = monatWahl(url.searchParams.get("monat"));
  const [l, p, land] = await Promise.all([
    db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status,kunde_id,erstellt&order=datum,beginn&limit=10000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&order=vorname&limit=3000`),
    landDerFirma(f.s, env, firma),
  ]);
  const liste = l.ok ? mitLand(l.daten, await einsatzLaender(f.s, env, firma)) : [], personen = p.ok ? p.daten : [];
  if (url.pathname.endsWith(".xlsx")) return xlsxAntwort(stundenExcel(liste, personen, monat, land), `Stunden_${monat}.xlsx`, f.s.cookies);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${stundenSeite(liste, personen, { monat, heute, nurOffen: !url.searchParams.has("alle"), darfAendern, land })}`);
}
