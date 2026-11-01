// T15: Kapazitätsblick. Staff per job and how many are free in the coming weeks (same rules as the Disposition), and on
// a tender with lots from the documents: "Reicht unser Personal?" (people needed per lot vs. free people of that job).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, unterlagenSteckbrief, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { belegung, montag, wochentage, type Abwesenheit, type EinsatzAuftrag, type Person, type Ueberlassung } from "./disposition.ts";
import type { Los } from "./kalkulation.ts";
import { alsEinsatz, type Schicht } from "./schichten.ts";

export const WOCHEN = [0, 4, 8, 12];
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const norm = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");

/** Monday of the planning week: from Saturday on, "this week" is already the coming one. */
export const ersterMontag = (heute: string, wochen = 0) => montag(plusTage(heute, wochen * 7 + 2));

export type Zeile = { beruf: string; gesamt: number; frei: number[] };
/** Per job: people (not "nicht verfügbar") and how many are free on all workdays of the week starting in 0/4/8/12 weeks. */
export function kapazitaet(personen: Person[], ueb: Ueberlassung[], abw: Abwesenheit[], auftraege: EinsatzAuftrag[], heute: string): Zeile[] {
  const wochen = WOCHEN.map((w) => wochentage(ersterMontag(heute, w)).slice(0, 5));
  const belegt = wochen.map((tage) => belegung(personen, ueb, abw, auftraege, tage));
  const berufe = [...new Set(personen.flatMap((p) => p.berufe))].sort((a, b) => a.localeCompare(b, "de"));
  return berufe.map((beruf) => {
    const leute = personen.filter((p) => p.berufe.includes(beruf) && p.status !== "nicht");
    return { beruf, gesamt: leute.length, frei: belegt.map((b) => leute.filter((p) => (b.get(p.id) ?? []).every((z) => z.art === "frei")).length) };
  }).filter((z) => z.gesamt);
}

/** People a lot needs: given as persons, or hours per year ÷ 1,600 working hours (rounded up). */
export function benoetigt(l: Pick<Los, "menge" | "einheit" | "zeitraum">): number | null {
  if (!l.menge || l.menge <= 0) return null;
  if (/person|kr(ae|ä)fte|mitarbeit|pers\./i.test(l.einheit)) return Math.ceil(l.menge);
  if (!/stund|std|^h$/i.test(l.einheit)) return null;
  const faktor = /woche/i.test(l.zeitraum) ? 52 : /monat/i.test(l.zeitraum) ? 12 : /tag/i.test(l.zeitraum) ? 220 : 1;
  return Math.max(1, Math.ceil((l.menge * faktor) / 1600));
}

export const passtZuBeruf = (taetigkeit: string, beruf: string) => { const a = norm(taetigkeit), b = norm(beruf); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); };

export function kapazitaetSeite(zeilen: Zeile[], heute: string): string {
  const kopf = WOCHEN.map((w) => w ? `in ${w} Wo.` : "diese Woche");
  return `<p class="klein">Wie viele Personen pro Beruf an allen Werktagen einer Woche frei sind („alle“ = Personen mit diesem Beruf, ohne „nicht verfügbar“), jetzt und in 4, 8 und 12 Wochen (ab ${new Date(`${ersterMontag(heute)}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}). Einsätze ohne Enddatum zählen dauerhaft.</p>
${zeilen.length ? `<div class="tabelle-scroll"><table class="auswertung-tabelle kapazitaet-tabelle"><thead><tr><th>Beruf</th><th>alle</th>${kopf.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${zeilen.map((z) => `<tr><td>${escape(z.beruf)}</td><td>${z.gesamt}</td>${z.frei.map((n) => `<td class="${n === 0 ? "kap-null" : n / z.gesamt < 0.25 ? "kap-wenig" : "kap-gut"}"><strong>${n}</strong></td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="treffer-leer">Noch kein Personal mit Beruf eingetragen.</p>`}
<p class="klein">Wer genau frei ist, zeigt die <a href="/konto/personalsuche">Personalsuche</a>; einplanen in der <a href="/konto/disposition">Disposition</a>.</p>`;
}

export function reichtTeilHtml(lose: Los[], personen: Person[], freiIds: Set<string>): string {
  const zeilen = lose.filter((l) => l.taetigkeit).map((l) => {
    const n = benoetigt(l);
    const leute = personen.filter((p) => p.status !== "nicht" && p.berufe.some((b) => passtZuBeruf(l.taetigkeit!, b)));
    const frei = leute.filter((p) => freiIds.has(p.id)).length;
    const ok = n === null ? null : frei >= n;
    return `<li class="${ok === null ? "" : ok ? "reicht" : leute.length >= (n ?? 0) ? "knapp" : "fehlt"}"><div><strong>Los ${escape(l.nr)}: ${escape(l.name)}</strong><span class="klein">${escape(l.taetigkeit!)}${n !== null ? ` · benötigt ca. ${n} ${n === 1 ? "Person" : "Personen"}${/stund|std/i.test(l.einheit) ? ` (${l.menge.toLocaleString("de-DE")} ${escape(l.einheit)} ${escape(l.zeitraum)})` : ""}` : ""}</span></div><span class="kap-wert">${ok === null ? "" : ok ? "✅" : leute.length >= (n ?? 0) ? "🟡" : "⚠️"} ${frei} frei von ${leute.length}</span></li>`;
  });
  return zeilen.length ? `<h2 id="kapazitaet">👷 Reicht unser Personal?</h2><ul class="frage-liste kapazitaet-liste">${zeilen.join("")}</ul><p class="klein">Frei = in der laufenden Arbeitswoche (ab Samstag: der nächsten) an allen Werktagen ohne Einsatz und Abwesenheit. Bedarf grob aus den Losen: Stunden pro Jahr ÷ 1.600. 🟡 genug Leute, aber gerade nicht alle frei.</p>` : "";
}

async function belegungDaten(s: Sitzung, env: KontoEnv, firma: string, von: string, bis: string) {
  const [p, u, a, e, v, sch] = await Promise.all([
    db<Person[]>(s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,berufe,bereich_id,status&limit=3000`),
    db<Ueberlassung[]>(s, env, `ueberlassungen?firma_id=eq.${firma}&von=lte.${bis}&or=(bis.is.null,bis.gte.${von})&select=id,personal_id,entleiher,von,bis&limit=5000`),
    db<Abwesenheit[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&von=lte.${bis}&bis=gte.${von}&select=personal_id,von,bis,grund,status&limit=5000`),
    db<{ personal_id: string; vorgang_id: string; vorgaenge: { titel: string; status: string } | null }[]>(s, env, `einsaetze?firma_id=eq.${firma}&status=eq.zugesagt&select=personal_id,vorgang_id,vorgaenge(titel,status)&limit=5000`),
    db<{ vorgang_id: string; beginn: string | null; ende: string | null }[]>(s, env, `vertraege?firma_id=eq.${firma}&select=vorgang_id,beginn,ende`),
    db<Schicht[]>(s, env, `schichten?firma_id=eq.${firma}&datum=gte.${von}&datum=lte.${bis}&personal_id=not.is.null&select=id,personal_id,datum,beginn,ende,ort,antwort&limit=5000`),
  ]);
  const vertrag = new Map((v.ok ? v.daten : []).map((x) => [x.vorgang_id, x]));
  const auftraege: EinsatzAuftrag[] = (e.ok ? e.daten : []).filter((x) => x.vorgaenge?.status === "gewonnen").map((x) => ({ personal_id: x.personal_id, vorgang_id: x.vorgang_id, titel: x.vorgaenge!.titel, beginn: vertrag.get(x.vorgang_id)?.beginn ?? null, ende: vertrag.get(x.vorgang_id)?.ende ?? null }));
  return { personen: p.ok ? p.daten : [], ueb: [...(u.ok ? u.daten : []), ...alsEinsatz(sch.ok ? sch.daten : [])], abw: a.ok ? a.daten : [], auftraege };
}

/** Section on the tender page, only when the documents gave lots with a job. */
export async function reichtTeil(s: Sitzung, env: KontoEnv, v: { id: string; firma_id: string }, rolle: string): Promise<string> {
  if (rolle === "mitarbeiter" || !env.DATEN) return "";
  const aus = await unterlagenSteckbrief(env, v.id);
  const o = aus ? await env.DATEN.get(`auftraege/${aus.auftrag}/lose.json`) : null;
  const lose = o ? ((await o.json()) as Los[]) : [];
  if (!lose.some((l) => l.taetigkeit)) return "";
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const tage = wochentage(ersterMontag(heute)).slice(0, 5);
  const d = await belegungDaten(s, env, v.firma_id, tage[0], tage[4]);
  const b = belegung(d.personen, d.ueb, d.abw, d.auftraege, tage);
  return reichtTeilHtml(lose, d.personen, new Set(d.personen.filter((p) => (b.get(p.id) ?? []).every((z) => z.art === "frei")).map((p) => p.id)));
}

export async function kapazitaetSeiteRoute(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/kapazitaet") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Kapazität", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const d = await belegungDaten(f.s, env, f.m.firma_id, ersterMontag(heute), plusTage(ersterMontag(heute), 12 * 7 + 6));
  return antwort(kapazitaetSeite(kapazitaet(d.personen, d.ueb, d.abw, d.auftraege, heute), heute));
}
