// T8: Personalsuche. Who has the right job and qualification, is free in a period, lives near a place?
// Free = no assignment, no confirmed won contract, no absence on any day of the period (same rules as the Disposition).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { belegung, type Abwesenheit, type EinsatzAuftrag, type Ueberlassung } from "./disposition.ts";
import { FUEHRERSCHEINE, gueltigAm, plusTage, type Nachweis } from "./personalakte.ts";
import plz from "../../alarm/geo/plz.json" with { type: "json" };

export type SuchPerson = { id: string; vorname: string; nachname: string; berufe: string[]; qualifikationen: string[]; bereich_id: string | null; status: string; telefon: string; fuehrerschein: string[]; sprachen: string[]; wohn_plz: string };
export type Suche = { beruf: string; quali: string; von: string; bis: string; plz: string; km: number; fuehrerschein: string; sprache: string };
const KOORD = plz as unknown as Record<string, [number, number]>;

/** Distance between two German postal codes in km (great circle), null if one is unknown. */
export function entfernungKm(a: string, b: string): number | null {
  const p = KOORD[a], q = KOORD[b];
  if (!p || !q) return null;
  const r = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(r(q[0] - p[0]) / 2) ** 2 + Math.cos(r(p[0])) * Math.cos(r(q[0])) * Math.sin(r(q[1] - p[1]) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

export const tageZwischen = (von: string, bis: string) => { const t: string[] = []; for (let d = von; d <= bis && t.length < 62; d = plusTage(d, 1)) t.push(d); return t; };
const norm = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

export type Ergebnis = { p: SuchPerson; freiTage: number; tage: number; km: number | null; nachweis: string };
export function suchen(personen: SuchPerson[], nachweise: Nachweis[], ueb: Ueberlassung[], abw: Abwesenheit[], auftraege: EinsatzAuftrag[], s: Suche): Ergebnis[] {
  const tage = tageZwischen(s.von, s.bis);
  const b = belegung(personen.map((p) => ({ id: p.id, vorname: p.vorname, nachname: p.nachname, berufe: p.berufe, bereich_id: p.bereich_id, status: p.status })), ueb, abw, auftraege, tage);
  const q = norm(s.quali.trim());
  return personen.flatMap((p) => {
    if (s.beruf && !p.berufe.includes(s.beruf)) return [];
    if (s.fuehrerschein && !p.fuehrerschein.includes(s.fuehrerschein)) return [];
    if (s.sprache && !p.sprachen.some((x) => norm(x).includes(norm(s.sprache)))) return [];
    let nachweis = "";
    if (q) {
      const n = nachweise.find((x) => x.personal_id === p.id && norm(x.bezeichnung).includes(q) && gueltigAm(x, s.bis));
      const ohne = p.qualifikationen.find((x) => norm(x).includes(q));
      if (!n && !ohne) return [];
      nachweis = n ? `${n.bezeichnung}${n.gueltig_bis ? ` bis ${new Date(`${n.gueltig_bis}T12:00:00Z`).toLocaleDateString("de-DE")}` : ""}` : `${ohne} (ohne Nachweis)`;
    }
    const km = s.plz ? (p.wohn_plz ? entfernungKm(s.plz, p.wohn_plz) : null) : null;
    if (s.plz && s.km && (km === null || km > s.km)) return [];
    const freiTage = (b.get(p.id) ?? []).filter((z) => z.art === "frei").length;
    return [{ p, freiTage, tage: tage.length, km, nachweis }];
  }).sort((x, y) => (y.freiTage === y.tage ? 1 : 0) - (x.freiTage === x.tage ? 1 : 0) || y.freiTage - x.freiTage || (x.km ?? 9999) - (y.km ?? 9999) || x.p.vorname.localeCompare(y.p.vorname, "de"));
}

export function sucheSeite(ergebnisse: Ergebnis[] | null, s: Suche, o: { berufe: string[]; plzBekannt: boolean }): string {
  const sel = (n: string, leer: string, liste: string[], wert: string) => `<select name="${n}"><option value="">${leer}</option>${liste.map((x) => `<option${x === wert ? " selected" : ""}>${escape(x)}</option>`).join("")}</select>`;
  const form = `<form method="get" class="such-form"><div class="aueg-form">
<label>Beruf${sel("beruf", "alle", o.berufe, s.beruf)}</label><label>Qualifikation<input name="quali" value="${escape(s.quali)}" maxlength="80" placeholder="z. B. Stapler, 34a"></label>
<label>Frei von<input type="date" name="von" value="${s.von}"></label><label>bis<input type="date" name="bis" value="${s.bis}"></label>
<label>Einsatzort PLZ<input name="plz" value="${escape(s.plz)}" inputmode="numeric" maxlength="5" pattern="\\d{5}"></label><label>Umkreis<select name="km">${[0, 10, 20, 30, 50, 100].map((k) => `<option value="${k}"${k === s.km ? " selected" : ""}>${k ? `${k} km` : "egal"}</option>`).join("")}</select></label>
<label>Führerschein${sel("fuehrerschein", "egal", FUEHRERSCHEINE, s.fuehrerschein)}</label><label>Sprache<input name="sprache" value="${escape(s.sprache)}" maxlength="40" placeholder="z. B. Englisch"></label></div><button>Suchen</button></form>`;
  if (!ergebnisse) return `${form}<p class="klein">Filter wählen und suchen. Die Entfernung rechnet Jarvis von der Wohnort-PLZ der Personalakte (Luftlinie).</p>`;
  const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const voll = ergebnisse.filter((e) => e.freiTage === e.tage).length;
  const zeile = (e: Ergebnis) => `<li class="such-treffer ${e.freiTage === e.tage ? "frei" : e.freiTage ? "teils" : "belegt"}"><div><strong>${escape(`${e.p.vorname} ${e.p.nachname}`.trim())}</strong><span class="klein">${escape(e.p.berufe.slice(0, 2).join(", "))}${e.nachweis ? ` · 🎓 ${escape(e.nachweis)}` : ""}${e.p.fuehrerschein.length ? ` · 🚗 ${escape(e.p.fuehrerschein.join(", "))}` : ""}</span></div>
<div class="such-werte"><span>${e.freiTage === e.tage ? "🟢 ganz frei" : e.freiTage ? `🟡 ${e.freiTage} von ${e.tage} Tagen frei` : "🔴 belegt"}</span>${e.km !== null ? `<span class="klein">📍 ${e.km} km</span>` : s.plz ? '<span class="klein">PLZ fehlt</span>' : ""}${e.p.telefon ? `<a class="anfrage-mail" href="tel:${escape(e.p.telefon.replace(/[^\d+]/g, ""))}">📞</a>` : ""}</div></li>`;
  return `${form}<p class="klein"><strong>${ergebnisse.length}</strong> ${ergebnisse.length === 1 ? "Person passt" : "Personen passen"}, ${voll} ganz frei vom ${datum(s.von)} bis ${datum(s.bis)}.${s.plz && !o.plzBekannt ? " ⚠️ Diese PLZ kennt Jarvis nicht." : ""}</p>
${ergebnisse.length ? `<ul class="frage-liste">${ergebnisse.slice(0, 200).map(zeile).join("")}</ul>` : `<p class="treffer-leer">Niemand passt. Filter lockern, z. B. Umkreis oder Zeitraum.</p>`}
<p class="klein">Grundlage: Einsätze, zugesagte Personen gewonnener Aufträge, Urlaub und Schulungen. Einsatz eintragen in der <a href="/konto/disposition?woche=${s.von}">Disposition</a>.</p>`;
}

export async function personalsuche(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/personalsuche") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Personalsuche", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Personalsuche sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const q = url.searchParams;
  const datumOk = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
  let von = datumOk(q.get("von")) ? q.get("von")! : heute, bis = datumOk(q.get("bis")) ? q.get("bis")! : plusTage(von, 4);
  if (bis < von) [von, bis] = [bis, von];
  if (tageZwischen(von, bis).length >= 62) bis = plusTage(von, 61);
  const s: Suche = { beruf: (q.get("beruf") ?? "").slice(0, 80), quali: (q.get("quali") ?? "").slice(0, 80), von, bis, plz: /^\d{5}$/.test(q.get("plz") ?? "") ? q.get("plz")! : "", km: [10, 20, 30, 50, 100].includes(Number(q.get("km"))) ? Number(q.get("km")) : 0, fuehrerschein: FUEHRERSCHEINE.includes(q.get("fuehrerschein") ?? "") ? q.get("fuehrerschein")! : "", sprache: (q.get("sprache") ?? "").slice(0, 40) };
  const gesucht = [...q.keys()].some((k) => ["beruf", "quali", "von", "bis", "plz", "fuehrerschein", "sprache"].includes(k));
  const [personen, nachweise, ueb, abw, eins, vt] = await Promise.all([
    db<SuchPerson[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,berufe,qualifikationen,bereich_id,status,telefon,fuehrerschein,sprachen,wohn_plz&order=vorname&limit=3000`),
    gesucht ? db<Nachweis[]>(f.s, env, `personal_nachweise?firma_id=eq.${firma}&select=id,personal_id,bezeichnung,erworben,gueltig_bis,datei_name,datei_mime&limit=10000`) : Promise.resolve({ ok: true as const, daten: [] as Nachweis[] }),
    gesucht ? db<Ueberlassung[]>(f.s, env, `ueberlassungen?firma_id=eq.${firma}&von=lte.${bis}&or=(bis.is.null,bis.gte.${von})&select=id,personal_id,entleiher,von,bis&limit=5000`) : Promise.resolve({ ok: true as const, daten: [] as Ueberlassung[] }),
    gesucht ? db<Abwesenheit[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&von=lte.${bis}&bis=gte.${von}&select=personal_id,von,bis,grund,status&limit=5000`) : Promise.resolve({ ok: true as const, daten: [] as Abwesenheit[] }),
    gesucht ? db<{ personal_id: string; vorgang_id: string; vorgaenge: { titel: string; status: string } | null }[]>(f.s, env, `einsaetze?firma_id=eq.${firma}&status=eq.zugesagt&select=personal_id,vorgang_id,vorgaenge(titel,status)&limit=5000`) : Promise.resolve({ ok: true as const, daten: [] }),
    gesucht ? db<{ vorgang_id: string; beginn: string | null; ende: string | null }[]>(f.s, env, `vertraege?firma_id=eq.${firma}&select=vorgang_id,beginn,ende`) : Promise.resolve({ ok: true as const, daten: [] }),
  ]);
  if (!personen.ok) return antwort('<p class="fehler">Das Personal konnte nicht geladen werden.</p>', 502);
  const vertrag = new Map((vt.ok ? vt.daten : []).map((x) => [x.vorgang_id, x]));
  const auftraege: EinsatzAuftrag[] = (eins.ok ? eins.daten : []).filter((e) => e.vorgaenge?.status === "gewonnen").map((e) => ({ personal_id: e.personal_id, vorgang_id: e.vorgang_id, titel: e.vorgaenge!.titel, beginn: vertrag.get(e.vorgang_id)?.beginn ?? null, ende: vertrag.get(e.vorgang_id)?.ende ?? null }));
  const berufe = [...new Set(personen.daten.flatMap((p) => p.berufe))].sort((a, b) => a.localeCompare(b, "de"));
  return antwort(sucheSeite(gesucht ? suchen(personen.daten, nachweise.ok ? nachweise.daten : [], ueb.ok ? ueb.daten : [], abw.ok ? abw.daten : [], auftraege, s) : null, s, { berufe, plzBekannt: !s.plz || !!KOORD[s.plz] }));
}
