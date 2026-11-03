// T27: Einsatz-Bewertung. After an assignment the office notes how satisfied the customer was (1–5 stars) and whether the
// customer wants the person again. Only the office sees it; "not again" keeps the person out of replacement suggestions
// for that customer.
import { MITBESTIMMUNG } from "./mitbestimmung.ts";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Bewertung = { id: string; personal_id: string; kunde_id: string | null; einsatz: string; datum: string; sterne: number; wieder: string; notiz: string };
type Person = { id: string; vorname: string; nachname: string; status: string };
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const sterneText = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const name = (p: Pick<Person, "vorname" | "nachname">) => `${p.vorname} ${p.nachname}`.trim();

export type Schnitt = { schnitt: number; anzahl: number; nichtWieder: string[] };
/** Average stars and the customers that do not want the person again (latest rating per customer counts). */
export function schnitt(liste: Bewertung[], pid: string, kundenName: (id: string | null, einsatz: string) => string, heute = new Date().toISOString().slice(0, 10)): Schnitt | null {
  const l = liste.filter((b) => b.personal_id === pid);
  if (!l.length) return null;
  const letzte = new Map<string, Bewertung>();
  for (const b of [...l].sort((a, c) => a.datum.localeCompare(c.datum))) letzte.set(b.kunde_id ?? `e:${b.einsatz.toLowerCase()}`, b);
  return { schnitt: Math.round((l.reduce((s, b) => s + b.sterne, 0) / l.length) * 10) / 10, anzahl: l.length, nichtWieder: [...letzte.values()].filter((b) => nochGesperrt(b, heute)).map((b) => kundenName(b.kunde_id, b.einsatz)) };
}
export const schnittText = (s: Schnitt | null) => s ? `⭐ ${s.schnitt.toLocaleString("de-DE")} (${s.anzahl})${s.nichtWieder.length ? ` · 🚫 nicht wieder bei ${s.nichtWieder.join(", ")}` : ""}` : "";

/** People a customer does not want again (latest rating for that customer says "nein"). */
/** "Nicht wieder" expires after 12 months (data minimisation, Rechtsprüfung: low): older ratings no longer block. */
const SPERRE_TAGE = 365;
const nochGesperrt = (b: Bewertung, heute: string) => b.wieder === "nein" && Date.parse(`${b.datum}T12:00:00Z`) >= Date.parse(`${heute}T12:00:00Z`) - SPERRE_TAGE * 86400_000;
export function gesperrtFuer(liste: Bewertung[], kunde: string | null, heute = new Date().toISOString().slice(0, 10)): Set<string> {
  if (!kunde) return new Set();
  const letzte = new Map<string, Bewertung>();
  for (const b of liste.filter((x) => x.kunde_id === kunde).sort((a, c) => a.datum.localeCompare(c.datum))) letzte.set(b.personal_id, b);
  return new Set([...letzte.values()].filter((b) => nochGesperrt(b, heute)).map((b) => b.personal_id));
}

export function bewertungenSeite(liste: Bewertung[], personen: Person[], kunden: { id: string; name: string }[], o: { heute: string; darfAendern: boolean }): string {
  const kName = (id: string | null, einsatz: string) => (id ? kunden.find((k) => k.id === id)?.name : "") || einsatz || "ohne Kunde";
  const pName = (id: string) => { const p = personen.find((x) => x.id === id); return p ? name(p) : "?"; };
  const rangliste = personen.map((p) => ({ p, s: schnitt(liste, p.id, kName) })).filter((x) => x.s).sort((a, b) => b.s!.schnitt - a.s!.schnitt || b.s!.anzahl - a.s!.anzahl);
  const form = o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Einsatz bewerten</summary><form method="post" action="/konto/bewertungen"><div class="aueg-form">
<label class="ganz">Person<select name="person" required>${personen.filter((p) => p.status !== "nicht").map((p) => `<option value="${p.id}">${escape(name(p))}</option>`).join("")}</select></label>
${kunden.length ? `<label>Kunde<select name="kunde"><option value="">– anderer –</option>${kunden.map((k) => `<option value="${k.id}">${escape(k.name)}</option>`).join("")}</select></label>` : ""}<label${kunden.length ? "" : ' class="ganz"'}>Einsatz (freiwillig)<input name="einsatz" maxlength="160"></label>
<label>Datum<input type="date" name="datum" required value="${o.heute}" max="${o.heute}"></label><label>Zufriedenheit<select name="sterne">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${sterneText(n)}</option>`).join("")}</select></label>
<fieldset class="ganz"><legend>Will der Kunde die Person wieder?</legend><div class="chips"><label><input type="radio" name="wieder" value="ja"><span>👍 gern wieder</span></label><label><input type="radio" name="wieder" value="egal" checked><span>egal</span></label><label><input type="radio" name="wieder" value="nein"><span>🚫 nicht wieder</span></label></div></fieldset>
<label class="ganz">Notiz<input name="notiz" maxlength="500" placeholder="z. B. sehr zuverlässig, kam zweimal zu spät"></label></div><button>Speichern</button></form></details>` : "";
  return `${MITBESTIMMUNG}<p class="klein">Rückmeldungen der Kunden zu Einsätzen. Nur das Büro sieht sie. „Nicht wieder“ nimmt die Person bei diesem Kunden aus den Ersatzvorschlägen. Bitte sachlich bleiben, die Person hat ein Recht auf Auskunft.</p>${form}
${rangliste.length ? `<h2>Pro Person</h2><ul class="kontakt-liste">${rangliste.map(({ p, s }) => `<li><div><strong>${escape(name(p))}</strong><span class="klein">${escape(schnittText(s))}</span></div><span class="sterne">${sterneText(s!.schnitt)}</span></li>`).join("")}</ul>` : ""}
${liste.length ? `<h2>Zuletzt</h2><ul class="kontakt-liste">${liste.slice(0, 50).map((b) => `<li class="${b.wieder === "nein" ? "abgelaufen" : ""}"><div><strong>${escape(pName(b.personal_id))} · ${escape(kName(b.kunde_id, b.einsatz))}</strong><span class="klein">${datum(b.datum)} · ${sterneText(b.sterne)}${b.wieder === "ja" ? " · 👍 gern wieder" : b.wieder === "nein" ? " · 🚫 nicht wieder" : ""}${b.notiz ? ` · ${escape(b.notiz)}` : ""}</span></div>${o.darfAendern ? `<form method="post" action="/konto/bewertungen"><input type="hidden" name="loeschen" value="${b.id}"><button class="zweit" aria-label="Bewertung löschen">✕</button></form>` : ""}</li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Bewertungen.</p>`}`;
}

export async function bewertungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/bewertungen") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Einsatz-Bewertungen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/bewertungen?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Bewerten dürfen Bearbeiter, Standortleitungen und Admins.");
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    if (/^[0-9a-f-]{36}$/.test(t("loeschen", 36))) { const r = await db(f.s, env, `einsatz_bewertungen?id=eq.${t("loeschen", 36)}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck(r.ok ? "Bewertung gelöscht." : "Löschen hat nicht geklappt."); }
    const d = t("datum", 10), sterne = Math.round(Number(t("sterne", 1)));
    const zeile = { firma_id: firma, personal_id: t("person", 36), kunde_id: /^[0-9a-f-]{36}$/.test(t("kunde", 36)) ? t("kunde", 36) : null, einsatz: t("einsatz", 160), datum: /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= heute ? d : heute, sterne: sterne >= 1 && sterne <= 5 ? sterne : 3, wieder: ["ja", "nein"].includes(t("wieder", 4)) ? t("wieder", 4) : "egal", notiz: t("notiz", 500) };
    if (!/^[0-9a-f-]{36}$/.test(zeile.personal_id)) return zurueck("Bitte eine Person wählen.");
    const r = await db(f.s, env, "einsatz_bewertungen", { method: "POST", body: JSON.stringify(zeile) });
    return zurueck(r.ok ? "Bewertung gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?");
  }
  const [l, p, k] = await Promise.all([
    db<Bewertung[]>(f.s, env, `einsatz_bewertungen?firma_id=eq.${firma}&select=id,personal_id,kunde_id,einsatz,datum,sterne,wieder,notiz&order=datum.desc,erstellt.desc&limit=2000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&order=vorname&limit=3000`),
    db<{ id: string; name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&order=name&limit=1000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${bewertungenSeite(l.ok ? l.daten : [], p.ok ? p.daten : [], k.ok ? k.daten : [], { heute, darfAendern })}`);
}
