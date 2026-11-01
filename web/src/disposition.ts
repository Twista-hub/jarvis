// N12: Disposition. A week board of the firm's staff: who works where (assignments to customers, confirmed staff of
// won contracts), who is absent, who is free. New assignments entered here also count for the AÜG-Wächter.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { alsEinsatz, type Schicht } from "./schichten.ts";

export type Person = { id: string; vorname: string; nachname: string; berufe: string[]; bereich_id: string | null; status: string };
export type Ueberlassung = { id: string; personal_id: string; entleiher: string; von: string; bis: string | null };
export type Abwesenheit = { personal_id: string; von: string; bis: string; grund: string; status?: string };
export type EinsatzAuftrag = { personal_id: string; vorgang_id: string; titel: string; beginn: string | null; ende: string | null };
export type Zelle = { art: "einsatz" | "abwesend" | "frei" | "nicht"; text: string };

const ABW: Record<string, string> = { urlaub: "Urlaub", schulung: "Schulung", abwesend: "Abwesend" };
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** Monday of the week containing the day. */
export function montag(d: string): string { const x = new Date(`${d}T12:00:00Z`); return plusTage(d, -((x.getUTCDay() + 6) % 7)); }
export const wochentage = (mo: string) => Array.from({ length: 7 }, (_, i) => plusTage(mo, i));
/** ISO calendar week. */
export function kalenderwoche(d: string): number {
  const x = new Date(`${d}T12:00:00Z`); const tag = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - tag + 3);
  const erster = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((x.getTime() - erster.getTime()) / 86400_000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
}

/** What each person does on each day of the week. Absence wins over work; "nicht verfügbar" marks the whole week. */
export function belegung(personen: Person[], ueb: Ueberlassung[], abw: Abwesenheit[], auftraege: EinsatzAuftrag[], tage: string[]): Map<string, Zelle[]> {
  const m = new Map<string, Zelle[]>();
  for (const p of personen) m.set(p.id, tage.map((t) => {
    if (p.status === "nicht") return { art: "nicht", text: "nicht verfügbar" };
    const a = abw.find((x) => x.personal_id === p.id && x.von <= t && x.bis >= t);
    // T16: requested leave is planned around already, marked with "?" until the office confirms.
    if (a) return { art: "abwesend", text: `${ABW[a.grund] ?? "Abwesend"}${a.status === "beantragt" ? "?" : ""}` };
    const u = ueb.find((x) => x.personal_id === p.id && x.von <= t && (!x.bis || x.bis >= t));
    if (u) return { art: "einsatz", text: u.entleiher };
    const e = auftraege.find((x) => x.personal_id === p.id && (!x.beginn || x.beginn <= t) && (!x.ende || x.ende >= t));
    if (e) return { art: "einsatz", text: e.titel };
    return { art: "frei", text: "frei" };
  }));
  return m;
}

/** Short cell text: the first word of the customer (at most 8 letters), absences as one word. */
export const zellText = (z: Zelle) => z.art === "nicht" ? "–" : (z.text.split(/[\s,/-]+/).find((w) => w.length > 1) ?? z.text).slice(0, 8);
const name = (p: Person) => `${p.vorname} ${p.nachname}`.trim();

export function dispositionSeite(personen: Person[], b: Map<string, Zelle[]>, o: { montag: string; heute: string; filter: string; beruf: string; standort: string; standorte: { id: string; name: string }[]; darfAendern: boolean; kunden: string[] }): string {
  const tage = wochentage(o.montag);
  const werktage = [0, 1, 2, 3, 4];
  const freiWoche = (id: string) => werktage.every((i) => b.get(id)?.[i]?.art === "frei");
  const imEinsatz = (id: string) => (b.get(id) ?? []).some((z) => z.art === "einsatz");
  const berufe = [...new Set(personen.flatMap((p) => p.berufe))].sort((x, y) => x.localeCompare(y, "de"));
  let liste = personen.filter((p) => (!o.beruf || p.berufe.includes(o.beruf)) && (!o.standort || p.bereich_id === o.standort));
  const basis = liste;
  if (o.filter === "frei") liste = liste.filter((p) => freiWoche(p.id));
  if (o.filter === "einsatz") liste = liste.filter((p) => imEinsatz(p.id));
  liste.sort((x, y) => name(x).localeCompare(name(y), "de"));
  const link = (aenderung: Record<string, string>) => { const q = new URLSearchParams({ woche: o.montag, ...(o.filter ? { filter: o.filter } : {}), ...(o.beruf ? { beruf: o.beruf } : {}), ...(o.standort ? { standort: o.standort } : {}), ...aenderung }); for (const [k, v] of [...q]) if (!v) q.delete(k); return `/konto/disposition?${q}`; };
  const heuteIndex = tage.indexOf(o.heute);
  const freiHeute = heuteIndex >= 0 ? basis.filter((p) => b.get(p.id)?.[heuteIndex]?.art === "frei").length : null;
  const kopf = `<div class="angebot-kennzahlen"><div><strong>${basis.length}</strong><span>Personen</span></div><div><strong>${basis.filter((p) => imEinsatz(p.id)).length}</strong><span>im Einsatz diese Woche</span></div><div><strong>${basis.filter((p) => freiWoche(p.id)).length}</strong><span>frei Mo–Fr${freiHeute !== null ? `<br>${freiHeute} frei heute` : ""}</span></div></div>`;
  const nav = `<div class="dispo-nav"><a class="knopf zweit" href="${link({ woche: plusTage(o.montag, -7) })}" aria-label="Vorige Woche">←</a><strong>KW ${kalenderwoche(o.montag)} · ${new Date(`${tage[0]}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}–${new Date(`${tage[6]}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</strong><a class="knopf zweit" href="${link({ woche: plusTage(o.montag, 7) })}" aria-label="Nächste Woche">→</a></div>`;
  const chips = `<nav class="ordner-chips" aria-label="Filter">${[["", "Alle"], ["frei", "🟢 Frei"], ["einsatz", "🔵 Im Einsatz"]].map(([k, t]) => `<a href="${link({ filter: k })}"${o.filter === k ? ' aria-current="true"' : ""}>${t}</a>`).join("")}</nav>`;
  const auswahl = berufe.length > 1 || o.standorte.length > 1 ? `<form method="get" class="dispo-filter"><input type="hidden" name="woche" value="${o.montag}">${o.filter ? `<input type="hidden" name="filter" value="${o.filter}">` : ""}${berufe.length > 1 ? `<select name="beruf" aria-label="Beruf"><option value="">Alle Berufe</option>${berufe.map((x) => `<option${x === o.beruf ? " selected" : ""}>${escape(x)}</option>`).join("")}</select>` : ""}${o.standorte.length > 1 ? `<select name="standort" aria-label="Standort"><option value="">Alle Standorte</option>${o.standorte.map((x) => `<option value="${x.id}"${x.id === o.standort ? " selected" : ""}>${escape(x.name)}</option>`).join("")}</select>` : ""}<button class="zweit">Filtern</button></form>` : "";
  const tabelle = liste.length ? `<div class="dispo-tafel" role="table" aria-label="Wochenplan"><div class="dispo-zeile dispo-kopf" role="row"><span role="columnheader">Person</span>${tage.map((t, i) => `<span role="columnheader" class="${t === o.heute ? "heute" : ""}${i > 4 ? " wochenende" : ""}">${WOCHENTAGE[i]}<br><small>${t.slice(8)}.</small></span>`).join("")}</div>
${liste.map((p) => `<div class="dispo-zeile" role="row"><span role="rowheader" class="dispo-name"><strong>${escape(name(p))}</strong><small>${escape(p.berufe.slice(0, 2).join(", "))}</small></span>${(b.get(p.id) ?? []).map((z, i) => `<span role="cell" class="dispo-zelle ${z.art}${tage[i] === o.heute ? " heute" : ""}${i > 4 ? " wochenende" : ""}" title="${escape(`${WOCHENTAGE[i]} ${tage[i]}: ${z.text}`)}">${z.art === "frei" ? "" : escape(zellText(z))}</span>`).join("")}</div>`).join("")}</div>
<p class="klein legende"><span class="punkt einsatz-punkt"></span>Einsatz <span class="punkt abwesend-punkt"></span>Urlaub, Schulung <span class="punkt frei-punkt"></span>frei</p>` : `<p class="treffer-leer">${personen.length ? "Niemand passt zum Filter." : "Noch kein Personal angelegt. Personal trägst du unter Firma &amp; Team ein."}</p>`;
  const freieZuerst = [...basis].sort((x, y) => Number(freiWoche(y.id)) - Number(freiWoche(x.id)) || name(x).localeCompare(name(y), "de"));
  const form = o.darfAendern && basis.length ? `<details class="termin-neu"><summary>➕ Einsatz eintragen</summary><form method="post" action="/konto/disposition"><input type="hidden" name="woche" value="${o.montag}"><div class="aueg-form">
<label class="ganz">Person<select name="personal" required>${freieZuerst.map((p) => `<option value="${p.id}">${freiWoche(p.id) ? "🟢 " : ""}${escape(name(p))}${p.berufe.length ? ` (${escape(p.berufe[0])})` : ""}</option>`).join("")}</select></label>
<label class="ganz">Kunde oder Baustelle<input name="kunde" required maxlength="200" list="dispo-kunden"></label><datalist id="dispo-kunden">${o.kunden.map((k) => `<option value="${escape(k)}">`).join("")}</datalist>
<label>Von<input name="von" type="date" required value="${tage[0]}"></label><label>Bis (leer = offen)<input name="bis" type="date" value="${tage[4]}"></label></div><button>Einsatz speichern</button></form><p class="klein">Einsätze zählen auch für den <a href="/konto/aueg">AÜG-Wächter</a>; dort lassen sie sich beenden oder löschen.</p></details>` : "";
  return `${kopf}${nav}${chips}${auswahl}${tabelle}${form}<p class="klein">Grundlage: Einsätze bei Kunden, zugesagte Personen gewonnener Aufträge (innerhalb der Vertragslaufzeit), Urlaub und Schulungen aus Firma &amp; Team. Personen mit Status „nicht verfügbar“ sind grau.</p>`;
}

export async function disposition(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/disposition") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Disposition", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Disposition sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const datumOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
  if (request.method === "POST") {
    const form = await request.formData();
    const woche = datumOk(String(form.get("woche") ?? "")) ? String(form.get("woche")) : montag(heute);
    const personal = String(form.get("personal") ?? ""), kunde = String(form.get("kunde") ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const von = String(form.get("von") ?? ""), bis = String(form.get("bis") ?? "");
    let hinweis: string;
    if (!darfAendern) hinweis = "Einsätze eintragen dürfen Bearbeiter, Standortleitungen und Admins.";
    else if (!/^[0-9a-f-]{36}$/.test(personal) || kunde.length < 2 || !datumOk(von) || (bis && (!datumOk(bis) || bis < von))) hinweis = "Bitte Person, Kunde und Beginn angeben (Ende nicht vor dem Beginn).";
    else {
      const r = await db(f.s, env, "ueberlassungen", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: personal, entleiher: kunde, von, bis: bis || null }) });
      hinweis = r.ok ? "Einsatz gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?";
    }
    return weiterleiten(`/konto/disposition?woche=${woche}&hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
  }
  const mo = montag(datumOk(url.searchParams.get("woche") ?? "") ? url.searchParams.get("woche")! : heute);
  const so = plusTage(mo, 6);
  const [personen, ueb, abw, eins, vt, bereiche, kunden, schichten] = await Promise.all([
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,berufe,bereich_id,status&order=vorname&limit=2000`),
    db<Ueberlassung[]>(f.s, env, `ueberlassungen?firma_id=eq.${firma}&von=lte.${so}&or=(bis.is.null,bis.gte.${mo})&select=id,personal_id,entleiher,von,bis&limit=5000`),
    db<Abwesenheit[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&von=lte.${so}&bis=gte.${mo}&select=personal_id,von,bis,grund,status&limit=5000`),
    db<{ personal_id: string; vorgang_id: string; vorgaenge: { titel: string; status: string } | null }[]>(f.s, env, `einsaetze?firma_id=eq.${firma}&status=eq.zugesagt&select=personal_id,vorgang_id,vorgaenge(titel,status)&limit=5000`),
    db<{ vorgang_id: string; beginn: string | null; ende: string | null }[]>(f.s, env, `vertraege?firma_id=eq.${firma}&select=vorgang_id,beginn,ende`),
    db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`),
    db<{ entleiher: string }[]>(f.s, env, `ueberlassungen?firma_id=eq.${firma}&select=entleiher&order=von.desc&limit=300`),
    db<Schicht[]>(f.s, env, `schichten?firma_id=eq.${firma}&datum=gte.${mo}&datum=lte.${so}&personal_id=not.is.null&select=id,personal_id,datum,beginn,ende,ort,antwort&limit=5000`),
  ]);
  if (!personen.ok) return antwort('<p class="fehler">Das Personal konnte nicht geladen werden.</p>', 502);
  const vertrag = new Map((vt.ok ? vt.daten : []).map((x) => [x.vorgang_id, x]));
  const auftraege: EinsatzAuftrag[] = (eins.ok ? eins.daten : []).filter((e) => e.vorgaenge?.status === "gewonnen").map((e) => ({ personal_id: e.personal_id, vorgang_id: e.vorgang_id, titel: e.vorgaenge!.titel, beginn: vertrag.get(e.vorgang_id)?.beginn ?? null, ende: vertrag.get(e.vorgang_id)?.ende ?? null }));
  // T18: planned shifts count as work (cancelled ones do not).
  const b = belegung(personen.daten, [...(ueb.ok ? ueb.daten : []), ...alsEinsatz(schichten.ok ? schichten.daten : [])], abw.ok ? abw.daten : [], auftraege, wochentage(mo));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${dispositionSeite(personen.daten, b, {
    montag: mo, heute, filter: ["frei", "einsatz"].includes(url.searchParams.get("filter") ?? "") ? url.searchParams.get("filter")! : "",
    beruf: url.searchParams.get("beruf") ?? "", standort: url.searchParams.get("standort") ?? "", standorte: bereiche.ok ? bereiche.daten : [], darfAendern,
    kunden: [...new Set((kunden.ok ? kunden.daten : []).map((k) => k.entleiher))].slice(0, 50),
  })}`);
}
