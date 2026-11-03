// N6: Auswertung. Hits per month, the way from hit to award, win rate per quarter, revenue (finance rights),
// reasons for 👎 and what Crewtender spent on AI for the firm (owners and admins).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { nettoAusText } from "./angebotsuebersicht.ts";
import { escape, seite } from "./seite.ts";

export type V = { id: string; status: string; erstellt: string; geaendert: string | null };
export type KiZeile = { monat: string; zweck: string; kosten: number | string; anfragen: number };
const STUFE: Record<string, number> = { neu: 0, verworfen: 0, pruefen: 1, angebot: 2, abgegeben: 3, gewonnen: 4, verloren: 4 };
export const GRUENDE: Record<string, string> = { region: "Falsche Region", taetigkeit: "Falsche Tätigkeit", groesse: "Zu groß oder zu klein", frist: "Frist zu knapp", passt: "Passt eigentlich" };
const ZWECK: Record<string, string> = { alarm: "Suche und Bewertung", web: "Steckbriefe, Recherche, Nachweise" };
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** The last 12 months (YYYY-MM), oldest first. */
export function monate(heute: string, n = 12): string[] {
  const [j, m] = heute.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(j, m - 1 - (n - 1 - i), 1)); return d.toISOString().slice(0, 7); });
}

export function proMonat(v: V[], heute: string) {
  const ms = monate(heute);
  return ms.map((m) => ({ monat: m, treffer: v.filter((x) => x.erstellt.slice(0, 7) === m).length, angebote: v.filter((x) => x.erstellt.slice(0, 7) === m && STUFE[x.status] >= 2).length }));
}

/** How many tenders reached each stage (hit, checked, offer, submitted, decided, won). */
export function trichter(v: V[]) {
  const ab = (n: number) => v.filter((x) => (STUFE[x.status] ?? 0) >= n).length;
  return [["Treffer", v.length], ["Geprüft", ab(1)], ["Angebot", ab(2)], ["Abgegeben", ab(3)], ["Gewonnen", v.filter((x) => x.status === "gewonnen").length]] as [string, number][];
}

/** Win rate per quarter by the date of the decision (last change of the tender). */
export function quoteProQuartal(v: V[]) {
  const m = new Map<string, { g: number; n: number }>();
  for (const x of v) {
    if (!["gewonnen", "verloren"].includes(x.status)) continue;
    const d = (x.geaendert ?? x.erstellt).slice(0, 7), q = `${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}/${d.slice(0, 4)}`;
    const e = m.get(q) ?? { g: 0, n: 0 }; e.n++; if (x.status === "gewonnen") e.g++; m.set(q, e);
  }
  return [...m].sort(([a], [b]) => a.slice(2).localeCompare(b.slice(2)) || a.localeCompare(b)).slice(-6).map(([q, e]) => ({ quartal: q, gewonnen: e.g, entschieden: e.n, quote: Math.round((e.g / e.n) * 100) }));
}

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const usd = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export function auswertungSeite(v: V[], o: { heute: string; finanzen: boolean; umsatz: number; angebotswert: number; gruende: Record<string, number>; ki: KiZeile[] | null }): string {
  const pm = proMonat(v, o.heute), max = Math.max(1, ...pm.map((x) => x.treffer));
  const jahr = v.filter((x) => x.erstellt >= `${monate(o.heute)[0]}-01`);
  const gewonnen = v.filter((x) => x.status === "gewonnen").length, verloren = v.filter((x) => x.status === "verloren").length;
  const kopf = `<div class="angebot-kennzahlen"><div><strong>${jahr.length}</strong><span>Treffer in 12 Monaten</span></div><div><strong>${v.filter((x) => STUFE[x.status] >= 3).length}</strong><span>Angebote abgegeben</span></div><div><strong>${gewonnen + verloren ? `${Math.round((gewonnen / (gewonnen + verloren)) * 100)} %` : "–"}</strong><span>gewonnen${gewonnen + verloren ? ` (${gewonnen} von ${gewonnen + verloren})` : ""}</span></div></div>`;
  const balken = `<div class="balken-diagramm" role="img" aria-label="Treffer pro Monat der letzten 12 Monate">${pm.map((x) => `<div class="balken-spalte" title="${MONATE[Number(x.monat.slice(5)) - 1]} ${x.monat.slice(0, 4)}: ${x.treffer} Treffer, ${x.angebote} mit Angebot"><span class="balken-zahl">${x.treffer || ""}</span><div class="balken" style="height:${Math.round((x.treffer / max) * 100)}%"><div class="balken-angebot" style="height:${x.treffer ? Math.round((x.angebote / x.treffer) * 100) : 0}%"></div></div><span class="balken-monat">${MONATE[Number(x.monat.slice(5)) - 1]}</span></div>`).join("")}</div><p class="klein legende"><span class="punkt treffer-punkt"></span>Treffer <span class="punkt angebot-punkt"></span>davon mit Angebot</p>`;
  const t = trichter(v), t0 = Math.max(1, t[0][1]);
  const trichterHtml = `<ul class="trichter">${t.map(([n, z]) => `<li><span class="trichter-name">${n}</span><span class="trichter-balken"><span style="width:${Math.max(z ? 2 : 0, Math.round((z / t0) * 100))}%"></span></span><strong>${z}</strong></li>`).join("")}</ul>`;
  const q = quoteProQuartal(v);
  const quote = q.length ? `<table class="auswertung-tabelle"><thead><tr><th>Quartal</th><th>Entschieden</th><th>Gewonnen</th><th>Quote</th></tr></thead><tbody>${q.map((x) => `<tr><td>${x.quartal}</td><td>${x.entschieden}</td><td>${x.gewonnen}</td><td><strong>${x.quote} %</strong></td></tr>`).join("")}</tbody></table>` : `<p class="klein">Noch keine Entscheidungen. Trag nach der Entscheidung des Auftraggebers „🏆 Zuschlag“ oder „❌ Absage“ ein.</p>`;
  const geld = o.finanzen ? `<h2>💶 Umsatz</h2><div class="angebot-kennzahlen zwei"><div><strong>${o.umsatz ? euro(o.umsatz) : "–"}</strong><span>eingetragener Umsatz gewonnener Aufträge</span></div><div><strong>${o.angebotswert ? euro(o.angebotswert) : "–"}</strong><span>Angebotssumme gewonnener Aufträge (netto)</span></div></div><p class="klein">Den Umsatz trägst du unter <a href="/konto/auftraege">Laufende Aufträge</a> ein, die Angebotssumme stammt aus der letzten Angebotsversion.</p>` : "";
  const gs = Object.entries(o.gruende).sort((a, b) => b[1] - a[1]);
  const gruende = gs.length ? `<h2>👎 Warum Treffer nicht passten</h2><ul class="trichter">${gs.map(([g, n]) => `<li><span class="trichter-name">${escape(GRUENDE[g] ?? g)}</span><span class="trichter-balken"><span style="width:${Math.round((n / gs[0][1]) * 100)}%"></span></span><strong>${n}</strong></li>`).join("")}</ul><p class="klein">Häufige Gründe verbessern das <a href="/konto/suchprofil">Suchprofil</a>, z. B. Gebiet oder Ausschlusswörter.</p>` : "";
  let ki = "";
  if (o.ki) {
    const monat = o.heute.slice(0, 7), vormonat = monate(o.heute, 2)[0];
    const summe = (m: string) => o.ki!.filter((x) => x.monat.slice(0, 7) === m).reduce((s, x) => s + Number(x.kosten), 0);
    const zwecke = [...new Set(o.ki.filter((x) => x.monat.slice(0, 7) === monat).map((x) => x.zweck))];
    ki = `<h2>🤖 KI-Kosten</h2><div class="angebot-kennzahlen zwei"><div><strong>${usd(summe(monat))}</strong><span>dieser Monat</span></div><div><strong>${usd(summe(vormonat))}</strong><span>Vormonat</span></div></div>${zwecke.length ? `<p class="klein">${zwecke.map((z) => { const r = o.ki!.filter((x) => x.zweck === z && x.monat.slice(0, 7) === monat); return `${escape(ZWECK[z] ?? z)}: ${usd(r.reduce((s, x) => s + Number(x.kosten), 0))} (${r.reduce((s, x) => s + Number(x.anfragen), 0)} Anfragen)`; }).join(" · ")}</p>` : ""}<p class="klein">Was Crewtender über die offizielle KI-Schnittstelle für eure Firma ausgegeben hat, in US-Dollar. Erfasst seit 01.11.2026; gemeinsame Arbeiten (z. B. der Katalog) sind nicht enthalten.</p>`;
  }
  if (!v.length) return `<p class="treffer-leer">Noch keine Daten. Die Auswertung füllt sich, sobald Crewtender Treffer für euch gefunden hat.</p>${ki}`;
  return `${kopf}<h2>📈 Treffer pro Monat</h2>${balken}<h2>🔻 Vom Treffer zum Zuschlag</h2>${trichterHtml}<h2>🏆 Gewinnquote</h2>${quote}${geld}${gruende}${ki}`;
}

export async function auswertung(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/auswertung") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Auswertung", text, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Auswertung sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const leer = Promise.resolve({ ok: true as const, daten: [] as never[] });
  const [v, feedback, ergebnisse, mappen, ki] = await Promise.all([
    db<V[]>(f.s, env, `vorgaenge?firma_id=eq.${firma}&select=id,status,erstellt,geaendert&limit=20000`),
    db<{ grund: string }[]>(f.s, env, `treffer_feedback?firma_id=eq.${firma}&grund=neq.passt&select=grund&limit=20000`),
    f.finanzen ? db<{ vorgang_id: string; umsatz: number | string | null }[]>(f.s, env, `angebotsergebnisse?firma_id=eq.${firma}&select=vorgang_id,umsatz`) : leer,
    f.finanzen ? db<{ vorgang_id: string; erstellt: string; text: string }[]>(f.s, env, `angebotsmappen?firma_id=eq.${firma}&select=vorgang_id,erstellt,text&order=erstellt.desc&limit=1000`) : leer,
    f.admin ? db<KiZeile[]>(f.s, env, "rpc/ki_kosten_firma", { method: "POST", body: JSON.stringify({ f: firma }) }) : Promise.resolve(null),
  ]);
  if (!v.ok) return antwort('<p class="fehler">Die Auswertung konnte nicht geladen werden.</p>', 502);
  const gewonnen = new Set(v.daten.filter((x) => x.status === "gewonnen").map((x) => x.id));
  const umsatz = (ergebnisse.ok ? ergebnisse.daten : []).filter((x) => gewonnen.has(x.vorgang_id)).reduce((s, x) => s + Number(x.umsatz ?? 0), 0);
  const letzte = new Map<string, string>();
  for (const m of mappen.ok ? mappen.daten : []) if (!letzte.has(m.vorgang_id)) letzte.set(m.vorgang_id, m.text);
  const angebotswert = [...letzte].filter(([id]) => gewonnen.has(id)).reduce((s, [, t]) => s + (nettoAusText(t) ?? 0), 0);
  const gruende: Record<string, number> = {};
  for (const x of feedback.ok ? feedback.daten : []) gruende[x.grund] = (gruende[x.grund] ?? 0) + 1;
  return antwort(auswertungSeite(v.daten, { heute, finanzen: f.finanzen, umsatz, angebotswert, gruende, ki: ki && ki.ok ? ki.daten : null }));
}
