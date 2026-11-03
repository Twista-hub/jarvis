// T18: Schichtplan. The office plans shifts per day (also repeating over several weeks); the staff member gets a phone
// notification and confirms or cancels under "Meine Einsätze & Daten". Shifts count as work in the Disposition.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { kalenderwoche, montag, wochentage } from "./disposition.ts";
import { ortInfo, type Einsatzort } from "./kunden.ts";
import { gesperrtFuer, type Bewertung } from "./bewertungen.ts";

export type Schicht = { id: string; personal_id: string | null; bereich_id: string | null; datum: string; beginn: string; ende: string; ort: string; notiz: string; antwort: string; einsatzort_id?: string | null; einsatzorte?: Einsatzort | null; beruf?: string };
type Person = { id: string; vorname: string; nachname: string; bereich_id: string | null; status: string; berufe?: string[] };
type Abw = { personal_id: string; von: string; bis: string; status?: string; kurzfristig?: boolean };
type Ueb = { personal_id: string; von: string; bis: string | null };
export const ANTWORT: Record<string, [string, string]> = { offen: ["⏳", "wartet auf Antwort"], zugesagt: ["✅", "zugesagt"], abgesagt: ["❌", "abgesagt"] };
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const uhr = (t: string) => t.slice(0, 5);
const tagText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const zuMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** Do two shifts on the same day overlap (night shifts run past midnight)? */
export const ueberschneiden = (a: Pick<Schicht, "beginn" | "ende">, b: Pick<Schicht, "beginn" | "ende">) => {
  const s = (x: Pick<Schicht, "beginn" | "ende">): [number, number] => { const v = zuMin(x.beginn), e = zuMin(x.ende); return [v, e <= v ? e + 1440 : e]; };
  const [a1, a2] = s(a), [b1, b2] = s(b);
  return a1 < b2 && b1 < a2;
};

/** Dates for a new shift: the given day, plus the chosen weekdays, for 1 to 8 weeks; never before the given day, at most 60. */
export function termine(datum: string, wochentageWahl: number[], wochen: number): string[] {
  const mo = montag(datum), tage = wochentageWahl.length ? wochentageWahl : [(new Date(`${datum}T12:00:00Z`).getUTCDay() + 6) % 7];
  const liste: string[] = [];
  for (let w = 0; w < Math.min(8, Math.max(1, wochen)); w++) for (const t of [...new Set(tage)].sort()) { const d = plusTage(mo, w * 7 + t); if (d >= datum) liste.push(d); }
  return [...new Set([datum, ...liste])].sort().slice(0, 60);
}

/** Start and end of a shift in minutes since 1970 (night shifts end the next day). */
const zeitraum = (x: Pick<Schicht, "datum" | "beginn" | "ende">): [number, number] => {
  const t0 = Date.parse(`${x.datum}T00:00:00Z`) / 60000, v = zuMin(x.beginn), e = zuMin(x.ende);
  return [t0 + v, t0 + (e <= v ? e + 1440 : e)];
};
/** Working time without the statutory break (§ 4 ArbZG: 30 min over 6 h, 45 min over 9 h). */
const netto = (brutto: number) => brutto - (brutto > 540 ? 45 : brutto > 360 ? 30 : 0);
const std = (min: number) => String(Math.round(min / 6) / 10).replace(".", ",");

/** Rechtsprüfung 03.11.2026 (A1): Arbeitszeitgesetz for one shift against the person's other shifts. More than 10 hours
 *  of work on a day (§ 3), less than 11 hours rest between two shifts (§ 5), Sunday work (§ 9, only with an exception
 *  such as § 10 and a substitute rest day, § 11). Hints for the office, no legal advice. */
export function arbzgHinweise(s: Pick<Schicht, "id" | "personal_id" | "datum" | "beginn" | "ende">, alle: Schicht[]): string[] {
  if (!s.personal_id) return [];
  const eigene = alle.filter((x) => x.personal_id === s.personal_id && x.id !== s.id && x.antwort !== "abgesagt");
  const [a, b] = zeitraum(s);
  const h: string[] = [];
  const amTag = netto(b - a) + eigene.filter((x) => x.datum === s.datum).reduce((n, x) => { const [p, q] = zeitraum(x); return n + netto(q - p); }, 0);
  if (amTag > 600) h.push(`${std(amTag)} Std. Arbeit am Tag, erlaubt sind höchstens 10 (§ 3 ArbZG)`);
  for (const x of eigene) {
    const [p, q] = zeitraum(x);
    const ruhe = q <= a ? a - q : b <= p ? p - b : null;
    if (ruhe !== null && ruhe < 660) { h.push(`nur ${std(ruhe)} Std. Ruhezeit zur Schicht am ${x.datum.slice(8, 10)}.${x.datum.slice(5, 7)}., mindestens 11 nötig (§ 5 ArbZG)`); break; }
  }
  if (new Date(`${s.datum}T12:00:00Z`).getUTCDay() === 0) h.push("Sonntagsarbeit: nur mit Ausnahme (§ 10 ArbZG) und Ersatzruhetag (§ 11)");
  return h;
}

/** Warnings per shift: person absent that day, two overlapping shifts, or a working-time rule (ArbZG). */
export function konflikte(schichten: Schicht[], abw: Abw[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of schichten) {
    if (!s.personal_id || s.antwort === "abgesagt") continue;
    if (abw.some((a) => a.personal_id === s.personal_id && a.von <= s.datum && a.bis >= s.datum)) m.set(s.id, "abwesend");
    else if (schichten.some((x) => x.id !== s.id && x.personal_id === s.personal_id && x.datum === s.datum && x.antwort !== "abgesagt" && ueberschneiden(x, s))) m.set(s.id, "doppelt eingeplant");
    else { const h = arbzgHinweise(s, schichten).filter((x) => !x.startsWith("Sonntag")); if (h.length) m.set(s.id, `Arbeitszeit: ${h[0]}`); }
  }
  return m;
}

/** T32: who can take over a shift: same job as the absent person (if known), available, not absent, no customer assignment
 *  and no overlapping shift that day. People with a matching job first, at most five. */
export function ersatzVorschlaege(schicht: Schicht, fuer: Person | undefined, personen: Person[], schichten: Schicht[], abw: Abw[], ueb: Ueb[], gesperrt: Set<string> = new Set()): Person[] {
  const frei = personen.filter((p) => p.id !== schicht.personal_id && p.status !== "nicht" && !gesperrt.has(p.id)
    && !abw.some((a) => a.personal_id === p.id && a.von <= schicht.datum && a.bis >= schicht.datum)
    && !ueb.some((u) => u.personal_id === p.id && u.von <= schicht.datum && (!u.bis || u.bis >= schicht.datum))
    && !schichten.some((x) => x.personal_id === p.id && x.datum === schicht.datum && x.antwort !== "abgesagt" && ueberschneiden(x, schicht)));
  const passt = (p: Person) => (fuer?.berufe ?? []).some((b) => (p.berufe ?? []).includes(b));
  // Nobody who would exceed 10 hours a day or get less than 11 hours rest (ArbZG §§ 3, 5).
  const arbzgOk = (p: Person) => !arbzgHinweise({ ...schicht, id: "neu", personal_id: p.id }, schichten).some((x) => !x.startsWith("Sonntag"));
  const ok = frei.filter(arbzgOk);
  return [...ok.filter(passt), ...ok.filter((p) => !passt(p))].slice(0, 5);
}

export function schichtenSeite(liste: Schicht[], personen: Person[], abw: Abw[], o: { montag: string; heute: string; darfAendern: boolean; bereiche: { id: string; name: string }[]; orte?: { id: string; name: string }[]; ueb?: Ueb[]; gesperrt?: (s: Schicht) => Set<string> }): string {
  const name = (id: string | null) => { const p = id ? personen.find((x) => x.id === id) : null; return p ? `${p.vorname} ${p.nachname}`.trim() : ""; };
  const k = konflikte(liste, abw);
  const tage = wochentage(o.montag);
  const zeile = (s: Schicht) => `<li class="schicht ${s.personal_id ? s.antwort : "frei"}"><div><strong>${uhr(s.beginn)}–${uhr(s.ende)}${s.ort ? ` · ${escape(s.ort)}` : ""}</strong><span class="klein">${s.personal_id ? `👤 ${escape(name(s.personal_id))} · ${ANTWORT[s.antwort][0]} ${ANTWORT[s.antwort][1]}` : `🔓 offene Schicht${s.beruf ? ` für ${escape(s.beruf)}` : ""}, noch niemand`}${k.get(s.id) ? ` · <span class="warnung">⚠️ ${k.get(s.id)}</span>` : ""}${s.notiz ? ` · ${escape(s.notiz)}` : ""}</span></div>${o.darfAendern ? `<form method="post" action="/konto/schichten"><input type="hidden" name="loeschen" value="${s.id}"><input type="hidden" name="woche" value="${o.montag}"><button class="zweit" aria-label="Schicht löschen">✕</button></form>` : ""}</li>`;
  const tagBlock = (d: string) => { const l = liste.filter((s) => s.datum === d).sort((a, b) => a.beginn.localeCompare(b.beginn)); return `<section class="schicht-tag${d === o.heute ? " heute" : ""}${l.length ? "" : " leer"}"><h3>${tagText(d)} <span class="klein">${l.length ? l.length : "keine Schicht"}</span></h3>${l.length ? `<ul class="kontakt-liste schicht-liste">${l.map(zeile).join("")}</ul>` : ""}</section>`; };
  const offen = liste.filter((s) => s.personal_id && s.antwort === "offen").length, ab = liste.filter((s) => s.antwort === "abgesagt").length, frei = liste.filter((s) => !s.personal_id).length;
  const form = o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Schicht planen</summary><form method="post" action="/konto/schichten"><input type="hidden" name="woche" value="${o.montag}"><div class="aueg-form">
<label>Datum<input type="date" name="datum" required value="${o.heute > o.montag && o.heute <= tage[6] ? o.heute : o.montag}"></label><label>Person<select name="person"><option value="">🔓 offen (niemand)</option>${personen.filter((p) => p.status !== "nicht").map((p) => `<option value="${p.id}">${escape(`${p.vorname} ${p.nachname}`.trim())}</option>`).join("")}</select></label>
<label>Beginn<input type="time" name="beginn" required value="06:00"></label><label>Ende<input type="time" name="ende" required value="14:00"></label>
${o.orte?.length ? `<label class="ganz">Einsatzort (mit Infoblatt)<select name="einsatzort"><option value="">– frei eingeben –</option>${o.orte.map((x) => `<option value="${x.id}">${escape(x.name)}</option>`).join("")}</select></label>` : ""}
<label class="ganz">${o.orte?.length ? "oder Ort frei" : "Einsatzort / Kunde"}<input name="ort" maxlength="160" placeholder="z. B. Messe Halle 3, Baustelle Hauptstraße"></label>
<label class="ganz">Beruf (bei offener Schicht: nur diese Einsatzkräfte sehen sie)<select name="beruf"><option value="">alle Berufe</option>${[...new Set(personen.flatMap((p) => p.berufe ?? []))].sort((a, b) => a.localeCompare(b, "de")).map((b) => `<option>${escape(b)}</option>`).join("")}</select></label>
${o.bereiche.length ? `<label class="ganz">Standort (bei offener Schicht)<select name="bereich"><option value="">ganze Firma</option>${o.bereiche.map((b) => `<option value="${b.id}">${escape(b.name)}</option>`).join("")}</select></label>` : ""}
<fieldset class="ganz"><legend>Wiederholen an</legend><div class="chips">${TAGE.map((t, i) => `<label><input type="checkbox" name="tag" value="${i}"><span>${t}</span></label>`).join("")}</div></fieldset>
<label>für Wochen<input type="number" name="wochen" min="1" max="8" value="1"></label><label>Notiz<input name="notiz" maxlength="300"></label>
<label class="zeile ganz"><input type="checkbox" name="arbzg_ok" value="1">Hinweise zum Arbeitszeitgesetz gelesen, trotzdem speichern</label></div><button>Schicht speichern</button><p class="klein">Ohne Wochentage gilt nur das Datum. Die Person bekommt eine Handy-Nachricht und sagt in der App zu oder ab. Eine offene Schicht sehen passende Einsatzkräfte in der App; wer zuerst „Übernehmen“ tippt, bekommt sie.</p></form></details>` : "";
  // T32: short-notice absences from today with their cancelled shifts and suggestions for a replacement.
  const ausfaelle = abw.filter((a) => a.kurzfristig && a.bis >= o.heute);
  const ausfall = ausfaelle.length ? `<section id="ausfall" class="ausfall"><h2>🚨 Kurzfristig ausgefallen</h2>${ausfaelle.map((a) => {
    const p = personen.find((x) => x.id === a.personal_id);
    const offen = liste.filter((x) => x.personal_id === a.personal_id && x.datum >= a.von && x.datum <= a.bis && x.antwort === "abgesagt" && !liste.some((y) => y.id !== x.id && y.datum === x.datum && y.beginn === x.beginn && y.ort === x.ort && y.notiz.startsWith("Ersatz") && y.antwort !== "abgesagt"));
    return `<article class="ausfall-person"><h3>${escape(name(a.personal_id) || "?")} <span class="klein">${a.von === o.heute ? "heute" : tagText(a.von)}</span></h3>${offen.length ? offen.map((x) => { const v = ersatzVorschlaege(x, p, personen, liste, abw, o.ueb ?? [], o.gesperrt?.(x)); return `<div class="ersatz"><p><strong>${uhr(x.beginn)}–${uhr(x.ende)}${x.ort ? ` · ${escape(x.ort)}` : ""}</strong></p>${v.length ? `<form method="post" action="/konto/schichten" class="ersatz-wahl"><input type="hidden" name="aktion" value="ersatz"><input type="hidden" name="schicht" value="${x.id}"><input type="hidden" name="woche" value="${o.montag}"><span class="klein">Ersatz:</span>${v.map((e) => `<button name="person" value="${e.id}" class="zweit">${escape(`${e.vorname} ${e.nachname}`.trim())}${(e.berufe ?? []).length ? ` <span class="klein">${escape((e.berufe ?? [])[0])}</span>` : ""}</button>`).join("")}</form>` : `<p class="klein">Niemand frei. Schicht ist offen geblieben.</p>`}</div>`; }).join("") : `<p class="klein">Keine offene Schicht (mehr) an diesem Tag.</p>`}</article>`;
  }).join("")}<p class="klein">Ein Tipp auf einen Namen plant die Schicht für diese Person; sie bekommt eine Handy-Nachricht zum Zusagen.</p></section>` : "";
  return `${ausfall}<nav class="dispo-nav"><a class="knopf zweit" href="/konto/schichten?woche=${plusTage(o.montag, -7)}" aria-label="Vorige Woche">‹</a><strong>KW ${kalenderwoche(o.montag)} · ${tage[0].split("-").reverse().slice(0, 2).join(".")}.–${tage[6].split("-").reverse().slice(0, 2).join(".")}.</strong><a class="knopf zweit" href="/konto/schichten?woche=${plusTage(o.montag, 7)}" aria-label="Nächste Woche">›</a></nav>
${liste.length ? `<p class="klein">${liste.length} ${liste.length === 1 ? "Schicht" : "Schichten"}${offen ? ` · ⏳ ${offen} ohne Antwort` : ""}${ab ? ` · ❌ ${ab} abgesagt` : ""}${frei ? ` · 🔓 ${frei} offen` : ""}${k.size ? ` · ⚠️ ${k.size} ${k.size === 1 ? "Konflikt" : "Konflikte"}` : ""}</p>` : ""}${form}
<div class="schicht-woche">${tage.map(tagBlock).join("")}</div><p class="klein">Zugesagte und offene Schichten stehen auch in der <a href="/konto/disposition?woche=${o.montag}">Disposition</a>.</p>`;
}

/** Section on the staff page: own shifts from today, with confirm/cancel. */
export function meineSchichtenTeil(liste: Schicht[], heute: string): string {
  const l = liste.filter((s) => s.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn)).slice(0, 30);
  if (!l.length) return "";
  return `<section id="schichten"><h3>📅 Meine Schichten</h3><ul class="kontakt-liste ich-liste">${l.map((s) => `<li class="${s.antwort === "offen" ? "bald" : s.antwort === "abgesagt" ? "abgelaufen" : "aktiv"}"><div><strong>${tagText(s.datum)} · ${uhr(s.beginn)}–${uhr(s.ende)}</strong><span class="klein">${s.ort ? `${escape(s.ort)} · ` : ""}${ANTWORT[s.antwort][0]} ${ANTWORT[s.antwort][1]}${s.notiz ? ` · ${escape(s.notiz)}` : ""}</span></div><form method="post" action="/konto/ich" class="schicht-antwort"><input type="hidden" name="aktion" value="schicht"><input type="hidden" name="id" value="${s.id}">${s.antwort !== "zugesagt" ? `<button name="antwort" value="zugesagt">✓ Zusagen</button>` : ""}${s.antwort !== "abgesagt" ? `<button name="antwort" value="abgesagt" class="zweit">Absagen</button>` : ""}</form>${s.einsatzorte && ortInfo(s.einsatzorte) ? `<details class="ort-details"${s.datum === heute ? " open" : ""}><summary class="klein">📋 Infos zum Einsatzort</summary><div class="ort-info">${ortInfo(s.einsatzorte)}</div></details>` : ""}</li>`).join("")}</ul></section>`;
}

/** T44: open shifts this staff member may take (the database only returns matching ones). */
export function offeneSchichtenTeil(liste: Schicht[]): string {
  if (!liste.length) return "";
  return `<section id="offen"><h3>🔓 Offene Schichten</h3><ul class="kontakt-liste ich-liste">${liste.map((s) => `<li class="bald"><div><strong>${tagText(s.datum)} · ${uhr(s.beginn)}–${uhr(s.ende)}</strong><span class="klein">${s.ort ? escape(s.ort) : "Ort folgt"}${s.beruf ? ` · ${escape(s.beruf)}` : ""}${s.notiz ? ` · ${escape(s.notiz)}` : ""}</span></div><form method="post" action="/konto/ich" class="schicht-antwort"><input type="hidden" name="aktion" value="uebernehmen"><input type="hidden" name="id" value="${s.id}"><button>🙋 Übernehmen</button></form></li>`).join("")}</ul><p class="klein">Wer zuerst tippt, bekommt die Schicht. Das Büro wird benachrichtigt.</p></section>`;
}

export async function schichtenRoute(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/schichten") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Schichtplan", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich#schichten", f.s.cookies);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const datumOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d));
  if (request.method === "POST") {
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const woche = datumOk(t("woche", 10)) ? montag(t("woche", 10)) : montag(heute);
    const zurueck = (h: string, w = woche) => weiterleiten(`/konto/schichten?woche=${w}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Schichten planen Bearbeiter, Standortleitungen und Admins.");
    const weg = t("loeschen", 36);
    if (/^[0-9a-f-]{36}$/.test(weg)) {
      const r = await db<{ id: string }[]>(f.s, env, `schichten?id=eq.${weg}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return zurueck(r.ok && r.daten.length ? "Schicht gelöscht." : "Löschen hat nicht geklappt.");
    }
    if (t("aktion", 10) === "ersatz") {
      const sid = t("schicht", 36), pid = t("person", 36);
      if (!/^[0-9a-f-]{36}$/.test(sid) || !/^[0-9a-f-]{36}$/.test(pid)) return zurueck("Bitte eine Person wählen.");
      const [alt, neu] = await Promise.all([
        db<(Schicht & { personal: { vorname: string } | null })[]>(f.s, env, `schichten?id=eq.${sid}&firma_id=eq.${firma}&select=id,personal_id,bereich_id,datum,beginn,ende,ort,notiz,antwort,einsatzort_id,personal(vorname)`),
        db<{ bereich_id: string | null; vorname: string }[]>(f.s, env, `personal?id=eq.${pid}&firma_id=eq.${firma}&select=bereich_id,vorname`),
      ]);
      const x = alt.ok ? alt.daten[0] : undefined, n = neu.ok ? neu.daten[0] : undefined;
      if (!x || !n) return zurueck("Schicht oder Person nicht gefunden.");
      const r = await db(f.s, env, "schichten", { method: "POST", body: JSON.stringify({ firma_id: firma, bereich_id: n.bereich_id, personal_id: pid, einsatzort_id: x.einsatzort_id ?? null, datum: x.datum, beginn: x.beginn.slice(0, 5), ende: x.ende.slice(0, 5), ort: x.ort, notiz: "Ersatzschicht" }) });
      return zurueck(r.ok ? `${n.vorname} ist eingeplant und bekommt eine Handy-Nachricht.` : "Einplanen hat nicht geklappt. Hast du Rechte für den Standort dieser Person?", montag(x.datum));
    }
    const datum = t("datum", 10), beginn = t("beginn", 5), ende = t("ende", 5), person = t("person", 36);
    const zeit = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!datumOk(datum) || !zeit.test(beginn) || !zeit.test(ende) || beginn === ende) return zurueck("Bitte Datum, Beginn und Ende angeben.");
    if (person && !/^[0-9a-f-]{36}$/.test(person)) return zurueck("Bitte eine Person wählen.");
    let bereich: string | null = /^[0-9a-f-]{36}$/.test(t("bereich", 36)) ? t("bereich", 36) : null;
    if (person) {
      const p = await db<{ bereich_id: string | null }[]>(f.s, env, `personal?id=eq.${person}&firma_id=eq.${firma}&select=bereich_id`);
      if (!p.ok || !p.daten.length) return zurueck("Person nicht gefunden.");
      bereich = p.daten[0].bereich_id;
    }
    const tage = form.getAll("tag").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const liste = termine(datum, tage, Math.round(Number(t("wochen", 2)) || 1));
    const einsatzort = /^[0-9a-f-]{36}$/.test(t("einsatzort", 36)) ? t("einsatzort", 36) : null;
    let ort = t("ort", 160);
    if (einsatzort && !ort) { const eo = await db<{ name: string }[]>(f.s, env, `einsatzorte?id=eq.${einsatzort}&firma_id=eq.${firma}&select=name`); ort = eo.ok ? eo.daten[0]?.name ?? "" : ""; }
    const zeilen = liste.map((d) => ({ firma_id: firma, bereich_id: bereich, personal_id: person || null, einsatzort_id: einsatzort, datum: d, beginn, ende, ort, notiz: t("notiz", 300), beruf: person ? "" : t("beruf", 120) }));
    if (person && form.get("arbzg_ok") !== "1") {
      // ArbZG: check against the person's other shifts around these days; warn first, save only after confirmation.
      const vorhanden = await db<Schicht[]>(f.s, env, `schichten?firma_id=eq.${firma}&personal_id=eq.${person}&datum=gte.${plusTage(liste[0], -1)}&datum=lte.${plusTage(liste[liste.length - 1], 1)}&select=id,personal_id,bereich_id,datum,beginn,ende,ort,notiz,antwort&limit=2000`);
      const neu = zeilen.map((z, i) => ({ ...z, id: `neu-${i}`, antwort: "offen" }) as unknown as Schicht);
      const alle = [...(vorhanden.ok ? vorhanden.daten : []), ...neu];
      const hinweise = [...new Set(neu.flatMap((z) => arbzgHinweise(z, alle).map((h) => `${z.datum.slice(8, 10)}.${z.datum.slice(5, 7)}.: ${h}`)))];
      if (hinweise.length) return zurueck(`⚠️ Arbeitszeitgesetz: ${hinweise.slice(0, 4).join(" · ")}${hinweise.length > 4 ? " …" : ""}. Nichts gespeichert. Bitte Zeiten prüfen oder „Hinweise gelesen, trotzdem speichern“ ankreuzen.`, montag(datum));
    }
    const r = await db(f.s, env, "schichten", { method: "POST", body: JSON.stringify(zeilen) });
    return zurueck(r.ok ? `${zeilen.length} ${zeilen.length === 1 ? "Schicht" : "Schichten"} gespeichert.${person ? " Die Person bekommt eine Handy-Nachricht (wenn eingeschaltet)." : ""}` : "Speichern hat nicht geklappt. Hast du Rechte für diesen Standort?", montag(datum));
  }
  const mo = montag(datumOk(url.searchParams.get("woche") ?? "") ? url.searchParams.get("woche")! : heute);
  const so = plusTage(mo, 6);
  const [s, p, a, b, eo, u, nein] = await Promise.all([
    db<Schicht[]>(f.s, env, `schichten?firma_id=eq.${firma}&datum=gte.${mo}&datum=lte.${so}&select=id,personal_id,bereich_id,datum,beginn,ende,ort,notiz,antwort,einsatzort_id,beruf&order=datum,beginn&limit=2000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,bereich_id,status,berufe&order=vorname&limit=3000`),
    db<Abw[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&von=lte.${so}&bis=gte.${mo}&select=personal_id,von,bis,status,kurzfristig&limit=5000`),
    db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`),
    db<{ id: string; name: string; kunde_id: string | null; kunden: { name: string } | null }[]>(f.s, env, `einsatzorte?firma_id=eq.${firma}&select=id,name,kunde_id,kunden(name)&order=name&limit=1000`),
    db<Ueb[]>(f.s, env, `ueberlassungen?firma_id=eq.${firma}&von=lte.${so}&or=(bis.is.null,bis.gte.${mo})&select=personal_id,von,bis&limit=5000`),
    db<Bewertung[]>(f.s, env, `einsatz_bewertungen?firma_id=eq.${firma}&kunde_id=not.is.null&select=id,personal_id,kunde_id,einsatz,datum,sterne,wieder,notiz&limit=5000`),
  ]);
  // T27: people a customer does not want again are left out of the replacement suggestions for that customer's sites.
  const kundeVonOrt = new Map((eo.ok ? eo.daten : []).map((x) => [x.id, x.kunde_id]));
  const gesperrt = (x: Schicht) => gesperrtFuer(nein.ok ? nein.daten : [], x.einsatzort_id ? kundeVonOrt.get(x.einsatzort_id) ?? null : null);
  const orte = (eo.ok ? eo.daten : []).map((x) => ({ id: x.id, name: x.kunden?.name && !x.name.includes(x.kunden.name) ? `${x.name} (${x.kunden.name})` : x.name }));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${schichtenSeite(s.ok ? s.daten : [], p.ok ? p.daten : [], a.ok ? a.daten : [], { montag: mo, heute, darfAendern, bereiche: b.ok ? b.daten : [], orte, ueb: u.ok ? u.daten : [], gesperrt })}`);
}

/** Shifts as assignments for the Disposition (cancelled ones do not count). */
export const alsEinsatz = (l: Pick<Schicht, "id" | "personal_id" | "datum" | "beginn" | "ende" | "ort" | "antwort">[]) =>
  l.filter((s) => s.personal_id && s.antwort !== "abgesagt").map((s) => ({ id: s.id, personal_id: s.personal_id!, entleiher: `${s.ort || "Schicht"} ${uhr(s.beginn)}`, von: s.datum, bis: s.datum }));
