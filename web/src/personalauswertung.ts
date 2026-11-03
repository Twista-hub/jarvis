// T28: Personal-Auswertung. On one page: headcount per location and job, type of employment, hours per month, joiners and
// leavers, short-notice absences, expiring proofs and leave taken. Only reads existing data.
import { MITBESTIMMUNG } from "./mitbestimmung.ts";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { minuten, type Eintrag } from "./stunden.ts";
import { BESCHAEFTIGUNG } from "./personalakte.ts";

type Person = { id: string; bereich_id: string | null; berufe: string[]; status: string; beschaeftigung: string | null; eintritt: string | null; austritt_am: string | null };
type Abw = { personal_id: string; von: string; kurzfristig: boolean };
export type Daten = { personen: Person[]; bereiche: { id: string; name: string }[]; stunden: Pick<Eintrag, "personal_id" | "datum" | "beginn" | "ende" | "pause_min" | "status">[]; ausfaelle: Abw[]; nachweiseBald: number; urlaub: { anspruch: number; genommen: number } | null };
const MONATE = (heute: string, n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(`${heute.slice(0, 7)}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (n - 1 - i)); return d.toISOString().slice(0, 7); });
const mName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" });
const balken = (wert: number, max: number) => `<span class="balken"><span style="width:${max ? Math.round((wert / max) * 100) : 0}%"></span></span>`;

export function auswertungSeite(d: Daten, heute: string): string {
  const aktiv = d.personen.filter((p) => p.status !== "nicht" && (!p.austritt_am || p.austritt_am >= heute));
  const bname = (id: string | null) => id ? d.bereiche.find((b) => b.id === id)?.name ?? "?" : "ohne Standort";
  const standorte = [...new Set(aktiv.map((p) => p.bereich_id))].sort((a, b) => bname(a).localeCompare(bname(b), "de"));
  const berufe = [...new Set(aktiv.flatMap((p) => p.berufe.length ? p.berufe : ["ohne Beruf"]))].sort((a, b) => a.localeCompare(b, "de"));
  const zahl = (b: string | null, beruf: string) => aktiv.filter((p) => p.bereich_id === b && (beruf === "ohne Beruf" ? !p.berufe.length : p.berufe.includes(beruf))).length;
  const matrix = standorte.length > 1 || berufe.length > 1 ? `<div class="tabelle-scroll"><table class="auswertung-tabelle kapazitaet-tabelle"><thead><tr><th>Beruf</th>${standorte.map((s) => `<th>${escape(bname(s))}</th>`).join("")}<th>gesamt</th></tr></thead><tbody>${berufe.map((b) => `<tr><td>${escape(b)}</td>${standorte.map((s) => `<td>${zahl(s, b) || ""}</td>`).join("")}<td><strong>${standorte.reduce((n, s) => n + zahl(s, b), 0)}</strong></td></tr>`).join("")}<tr><td><strong>Personen</strong></td>${standorte.map((s) => `<td><strong>${aktiv.filter((p) => p.bereich_id === s).length}</strong></td>`).join("")}<td><strong>${aktiv.length}</strong></td></tr></tbody></table></div><p class="klein">Personen mit mehreren Berufen zählen in jeder Zeile.</p>` : "";
  const arten = Object.entries(BESCHAEFTIGUNG).map(([k, t]) => [t, aktiv.filter((p) => p.beschaeftigung === k).length] as const).filter(([, n]) => n);
  const ohneArt = aktiv.filter((p) => !p.beschaeftigung).length;
  const monate = MONATE(heute, 6);
  const proMonat = monate.map((m) => { const l = d.stunden.filter((s) => s.datum.startsWith(m) && s.status !== "abgelehnt"); return { m, min: l.reduce((s, e) => s + minuten(e), 0), leute: new Set(l.map((e) => e.personal_id)).size }; });
  const maxMin = Math.max(...proMonat.map((x) => x.min), 1);
  const jahr = MONATE(heute, 12);
  const zu = jahr.map((m) => ({ m, rein: d.personen.filter((p) => p.eintritt?.startsWith(m)).length, raus: d.personen.filter((p) => p.austritt_am?.startsWith(m)).length, ausfall: d.ausfaelle.filter((a) => a.kurzfristig && a.von.startsWith(m)).length }));
  const kachel = (wert: string, text: string) => `<div class="kennzahl"><strong>${wert}</strong><span class="klein">${text}</span></div>`;
  return `${MITBESTIMMUNG}<div class="kennzahlen">${kachel(String(aktiv.length), "aktive Personen")}${kachel(String(zu.slice(-3).reduce((n, x) => n + x.rein, 0)), "Eintritte (3 Monate)")}${kachel(String(zu.slice(-3).reduce((n, x) => n + x.raus, 0)), "Austritte (3 Monate)")}${kachel(String(d.nachweiseBald), "Nachweise laufen ab (60 Tage)")}${d.urlaub ? kachel(`${Math.round(d.urlaub.genommen)} / ${Math.round(d.urlaub.anspruch)}`, `Urlaubstage genommen ${heute.slice(0, 4)}`) : ""}</div>
${matrix ? `<h2>👥 Personal nach Standort und Beruf</h2>${matrix}` : ""}
${arten.length ? `<h2>📁 Beschäftigungsart</h2><ul class="kontakt-liste">${arten.map(([t, n]) => `<li><span>${t}</span><span>${balken(n, aktiv.length)} <strong>${n}</strong></span></li>`).join("")}${ohneArt ? `<li><span class="klein">nicht eingetragen</span><span class="klein">${ohneArt}</span></li>` : ""}</ul>` : ""}
<h2>⏱️ Stunden pro Monat</h2><ul class="kontakt-liste">${proMonat.map((x) => `<li><span>${mName(x.m)}</span><span>${balken(x.min, maxMin)} <strong>${Math.round(x.min / 60).toLocaleString("de-DE")} Std.</strong> <span class="klein">${x.leute} ${x.leute === 1 ? "Person" : "Personen"}${x.leute ? ` · Ø ${Math.round(x.min / 60 / x.leute)}` : ""}</span></span></li>`).join("")}</ul><p class="klein">Aus den Stundenzetteln (offen und freigegeben).</p>
<h2>🔄 Ein- und Austritte, kurzfristige Ausfälle</h2><table class="auswertung-tabelle zu-tabelle"><thead><tr><th>Monat</th><th>Eintritte</th><th>Austritte</th><th>Ausfälle</th></tr></thead><tbody>${[...zu].reverse().map((x) => `<tr><td>${mName(x.m)}</td><td>${x.rein || ""}</td><td>${x.raus || ""}</td><td>${x.ausfall || ""}</td></tr>`).join("")}</tbody></table>
<p class="klein">Eintritt und Austritt aus der Personalakte (Austritt über die Checkliste), Ausfälle aus „Ich falle kurzfristig aus“.</p>`;
}

export async function personalauswertung(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/personalauswertung") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Personal-Auswertung", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const vor = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n, 1); return d.toISOString().slice(0, 10); };
  const plus60 = new Date(Date.parse(`${heute}T12:00:00Z`) + 60 * 86400_000).toISOString().slice(0, 10);
  const [p, b, s, a, n, k, u] = await Promise.all([
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,bereich_id,berufe,status,beschaeftigung,eintritt,austritt_am&limit=5000`),
    db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`),
    db<Daten["stunden"]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&datum=gte.${vor(5)}&select=personal_id,datum,beginn,ende,pause_min,status&limit=50000`),
    db<Abw[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&kurzfristig=is.true&von=gte.${vor(11)}&select=personal_id,von,kurzfristig&limit=5000`),
    db<{ id: string }[]>(f.s, env, `personal_nachweise?firma_id=eq.${firma}&gueltig_bis=gte.${heute}&gueltig_bis=lte.${plus60}&select=id&limit=5000`),
    db<{ anspruch: number | string; uebertrag: number | string }[]>(f.s, env, `urlaubskonten?firma_id=eq.${firma}&jahr=eq.${heute.slice(0, 4)}&select=anspruch,uebertrag&limit=5000`),
    db<{ von: string; bis: string }[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&grund=eq.urlaub&status=eq.bestaetigt&von=lte.${heute.slice(0, 4)}-12-31&bis=gte.${heute.slice(0, 4)}-01-01&select=von,bis&limit=10000`),
  ]);
  const anspruch = (k.ok ? k.daten : []).reduce((x, y) => x + Number(y.anspruch) + Number(y.uebertrag), 0);
  const tage = (v: string, bis: string) => { let c = 0; const j = heute.slice(0, 4); for (let d = v < `${j}-01-01` ? `${j}-01-01` : v; d <= (bis > `${j}-12-31` ? `${j}-12-31` : bis); d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10)) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w && w !== 6) c++; } return c; };
  const genommen = (u.ok ? u.daten : []).reduce((x, y) => x + tage(y.von, y.bis), 0);
  return antwort(auswertungSeite({ personen: p.ok ? p.daten : [], bereiche: b.ok ? b.daten : [], stunden: s.ok ? s.daten : [], ausfaelle: a.ok ? a.daten : [], nachweiseBald: n.ok ? n.daten.length : 0, urlaub: anspruch ? { anspruch, genommen } : null }, heute));
}
