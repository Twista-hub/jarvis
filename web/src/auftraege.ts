// N4: Laufende Aufträge. After the award: term with progress, the date by which the extension option must be decided,
// staff needed vs. confirmed, contact at the buyer, revenue (finance rights only). Re-tender expected near the end.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { plusMonate } from "./radar.ts";

export type Vertrag = { vorgang_id: string; beginn: string | null; ende: string | null; verlaengerung_bis: string | null; option_frist: string | null; personen_soll: number | null; ansprechpartner: string; notiz: string };
export type Auftrag = { id: string; titel: string; link: string | null; katalog_id: string | null; bereich_id: string | null;
  vergabekatalog?: { auftraggeber: string; auftraggeber_id: string; laufzeit_ende: string | null; cp: { startDate?: string; endDate?: string; durationInDays?: number } | null } | null };
export type Stufe = "rot" | "gelb" | "gruen" | "grau";

const tageBis = (d: string, heute: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86400_000);
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
const tag = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/** Suggestion from the notice when nothing is entered yet: announced start/end, or start plus duration. */
export function vorschlag(a: Auftrag): Partial<Vertrag> {
  const cp = a.vergabekatalog?.cp ?? null;
  const beginn = tag(cp?.startDate);
  let ende = tag(cp?.endDate) ?? tag(a.vergabekatalog?.laufzeit_ende);
  if (!ende && beginn && cp?.durationInDays && cp.durationInDays > 0 && cp.durationInDays < 5000) {
    const d = new Date(`${beginn}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Math.round(cp.durationInDays)); ende = d.toISOString().slice(0, 10);
  }
  return { beginn, ende };
}

/** The most urgent point of a contract: option deadline, end, missing staff or missing data. */
export function lage(v: Vertrag | undefined, zugesagt: number, heute: string): { stufe: Stufe; text: string } {
  if (!v || !v.ende) return { stufe: "grau", text: "Laufzeit noch nicht eingetragen" };
  if (v.option_frist && v.option_frist >= heute) {
    const t = tageBis(v.option_frist, heute);
    if (t <= 30) return { stufe: "rot", text: `Verlängerung entscheidet sich in ${t} ${t === 1 ? "Tag" : "Tagen"} (${datum(v.option_frist)})` };
    if (t <= 90) return { stufe: "gelb", text: `Verlängerung entscheidet sich bis ${datum(v.option_frist)}` };
  }
  const ende = v.ende;
  if (ende < heute) return { stufe: "grau", text: `Vertrag beendet am ${datum(ende)}` };
  const t = tageBis(ende, heute);
  if (t <= 60) return { stufe: "rot", text: `Endet in ${t} ${t === 1 ? "Tag" : "Tagen"}` };
  if (v.personen_soll && zugesagt < v.personen_soll) return { stufe: "gelb", text: `${v.personen_soll - zugesagt} ${v.personen_soll - zugesagt === 1 ? "Person fehlt" : "Personen fehlen"}` };
  if (ende <= plusMonate(heute, 6)) return { stufe: "gelb", text: `Endet am ${datum(ende)}: Neuausschreibung wahrscheinlich bald` };
  return { stufe: "gruen", text: `Läuft bis ${datum(ende)}` };
}

/** Share of the term that has passed (0–100), null without both dates. */
export function fortschritt(v: Vertrag | undefined, heute: string): number | null {
  if (!v?.beginn || !v.ende || v.ende <= v.beginn) return null;
  const p = (Date.parse(heute) - Date.parse(v.beginn)) / (Date.parse(v.ende) - Date.parse(v.beginn));
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function auftraegeSeite(liste: Auftrag[], o: { heute: string; vertraege: Map<string, Vertrag>; zugesagt: Map<string, string[]>; umsatz: Map<string, number>; finanzen: boolean; darfAendern: boolean; offen?: string }): string {
  const zeilen = liste.map((a) => ({ a, v: o.vertraege.get(a.id), leute: o.zugesagt.get(a.id) ?? [] })).map((z) => ({ ...z, l: lage(z.v, z.leute.length, o.heute) }));
  const rang: Record<Stufe, number> = { rot: 0, gelb: 1, gruen: 2, grau: 3 };
  zeilen.sort((x, y) => rang[x.l.stufe] - rang[y.l.stufe] || (x.v?.ende ?? "9").localeCompare(y.v?.ende ?? "9"));
  const laufend = zeilen.filter((z) => !z.v?.ende || z.v.ende >= o.heute);
  const summe = o.finanzen ? laufend.reduce((s, z) => s + (o.umsatz.get(z.a.id) ?? 0), 0) : 0;
  const kopf = `<div class="angebot-kennzahlen"><div><strong>${laufend.length}</strong><span>laufende Aufträge</span></div><div><strong>${laufend.reduce((s, z) => s + z.leute.length, 0)}</strong><span>Personen im Einsatz</span></div><div><strong>${zeilen.filter((z) => z.l.stufe === "rot" || z.l.stufe === "gelb").length}</strong><span>brauchen Aufmerksamkeit${summe ? `<br>${euro(summe)} Umsatz` : ""}</span></div></div>`;
  const feld = (name: string, label: string, wert: string | number | null | undefined, typ = "date", extra = "") => `<label>${label}<input name="${name}" type="${typ}" value="${wert ?? ""}"${extra}></label>`;
  const karte = ({ a, v, leute, l }: (typeof zeilen)[number]) => {
    const p = fortschritt(v, o.heute), s = vorschlag(a);
    const werte = { ...s, ...Object.fromEntries(Object.entries(v ?? {}).filter(([, x]) => x !== null && x !== "")) } as Partial<Vertrag>;
    const ag = a.vergabekatalog;
    const form = o.darfAendern ? `<details class="vertrag-form"${o.offen === a.id ? " open" : ""}><summary>${v ? "Vertragsdaten ändern" : "Vertragsdaten eintragen"}</summary><form method="post" action="/konto/auftraege"><input type="hidden" name="vorgang" value="${a.id}"><div class="aueg-form">
${feld("beginn", "Beginn", werte.beginn)}${feld("ende", "Ende", werte.ende)}${feld("verlaengerung_bis", "Mit Verlängerung bis", werte.verlaengerung_bis)}${feld("option_frist", "Entscheidung Verlängerung bis", werte.option_frist)}
${feld("personen_soll", "Personen benötigt", werte.personen_soll, "number", ' min="0" max="10000" inputmode="numeric"')}${o.finanzen ? feld("umsatz", "Umsatz (€, gesamt)", o.umsatz.get(a.id) ?? "", "number", ' min="0" step="1" inputmode="numeric"') : ""}
<label class="ganz">Ansprechpartner beim Auftraggeber<input name="ansprechpartner" maxlength="300" value="${escape(werte.ansprechpartner ?? "")}" placeholder="z. B. Frau Meier, 030 1234-0"></label>
<label class="ganz">Notiz<input name="notiz" maxlength="1000" value="${escape(werte.notiz ?? "")}"></label></div>
${!v && (s.beginn || s.ende) ? `<p class="klein">Vorschlag aus der Bekanntmachung. Bitte mit dem Vertrag abgleichen.</p>` : ""}<button>Speichern</button></form></details>` : "";
    return `<li class="aueg-karte stufe-${l.stufe}"><div class="aueg-text"><a href="/konto/vorgang/${a.id}"><strong>${escape(a.titel)}</strong></a>
${ag ? `<span class="klein">🏛️ <a href="/konto/auftraggeber?id=${encodeURIComponent(ag.auftraggeber_id)}">${escape(ag.auftraggeber)}</a></span>` : ""}
<span class="aueg-status">${escape(l.text)}</span>
${p !== null ? `<div class="aueg-leiste" role="img" aria-label="${p} Prozent der Laufzeit vorbei"><span style="width:${p}%"></span></div><span class="klein">${datum(v!.beginn!)} – ${datum(v!.ende!)}${v!.verlaengerung_bis ? ` · mit Verlängerung bis ${datum(v!.verlaengerung_bis)}` : ""}</span>` : v?.ende ? `<span class="klein">bis ${datum(v.ende)}${v.verlaengerung_bis ? ` · mit Verlängerung bis ${datum(v.verlaengerung_bis)}` : ""}</span>` : ""}
<span class="klein">👷 ${leute.length}${v?.personen_soll ? ` von ${v.personen_soll}` : ""} ${leute.length === 1 ? "Person" : "Personen"} zugesagt${leute.length ? `: ${escape(leute.slice(0, 4).join(", "))}${leute.length > 4 ? " …" : ""}` : ""}${o.finanzen && o.umsatz.get(a.id) ? ` · ${euro(o.umsatz.get(a.id)!)}` : ""}</span>
${v?.ansprechpartner ? `<span class="klein">📞 ${escape(v.ansprechpartner)}</span>` : ""}${v?.notiz ? `<span class="klein">📝 ${escape(v.notiz)}</span>` : ""}
${form}</div></li>`;
  };
  if (!liste.length) return `<p class="treffer-leer">Noch keine gewonnenen Aufträge. Sobald du bei einem Angebot „🏆 Zuschlag“ einträgst, steht der Auftrag hier.</p>`;
  const beendet = zeilen.filter((z) => z.v?.ende && z.v.ende < o.heute);
  return `${kopf}<ul class="aueg-liste">${laufend.map(karte).join("")}</ul>${beendet.length ? `<details><summary>Beendete Aufträge (${beendet.length})</summary><ul class="aueg-liste">${beendet.map(karte).join("")}</ul></details>` : ""}<p class="klein">Personen kommen aus den zugesagten Einsätzen der Ausschreibung. Rot: Entscheidung über die Verlängerung in 30 Tagen oder Vertragsende in 60 Tagen. Gelb: Entscheidung in 90 Tagen, fehlende Personen oder Ende in 6 Monaten (dann kommt oft die Neuausschreibung).</p>`;
}

export async function auftraegeLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string) {
  const [v, vt] = await Promise.all([
    db<Auftrag[]>(s, env, `vorgaenge?firma_id=eq.${firma}&status=eq.gewonnen&select=id,titel,link,katalog_id,bereich_id,vergabekatalog(auftraggeber,auftraggeber_id,laufzeit_ende,cp:roh->tender->contractPeriod)&order=geaendert.desc&limit=300`),
    db<Vertrag[]>(s, env, `vertraege?firma_id=eq.${firma}&select=vorgang_id,beginn,ende,verlaengerung_bis,option_frist,personen_soll,ansprechpartner,notiz`),
  ]);
  return { liste: v.ok ? v.daten : [], vertraege: new Map((vt.ok ? vt.daten : []).map((x) => [x.vorgang_id, x])), ok: v.ok };
}

export async function auftraege(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/auftraege") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Laufende Aufträge", text, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die laufenden Aufträge sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const id = String(form.get("vorgang") ?? "");
    const d = (k: string) => { const x = String(form.get(k) ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) ? x : null; };
    const zahl = (k: string, max: number) => { const x = String(form.get(k) ?? "").trim(); if (!x) return null; const n = Number(x.replace(",", ".")); return Number.isFinite(n) && n >= 0 && n <= max ? n : NaN; };
    const zeile = { firma_id: firma, vorgang_id: id, beginn: d("beginn"), ende: d("ende"), verlaengerung_bis: d("verlaengerung_bis"), option_frist: d("option_frist"),
      personen_soll: zahl("personen_soll", 10000), ansprechpartner: String(form.get("ansprechpartner") ?? "").trim().slice(0, 300), notiz: String(form.get("notiz") ?? "").trim().slice(0, 1000), geaendert: new Date().toISOString() };
    let hinweis = "Gespeichert.";
    if (!darfAendern || !/^[0-9a-f-]{36}$/.test(id)) hinweis = "Das ging nicht.";
    else if (Number.isNaN(zeile.personen_soll) || (zeile.beginn && zeile.ende && zeile.ende < zeile.beginn) || (zeile.ende && zeile.verlaengerung_bis && zeile.verlaengerung_bis < zeile.ende)) hinweis = "Bitte die Angaben prüfen: Ende nicht vor dem Beginn, Verlängerung nicht vor dem Ende.";
    else {
      const r = await db(f.s, env, "vertraege?on_conflict=firma_id,vorgang_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ ...zeile, personen_soll: zeile.personen_soll === null ? null : Math.round(zeile.personen_soll) }) });
      const umsatz = zahl("umsatz", 1e11);
      if (r.ok && f.finanzen && form.has("umsatz") && !Number.isNaN(umsatz)) {
        await db(f.s, env, "angebotsergebnisse?on_conflict=firma_id,vorgang_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, vorgang_id: id, umsatz, aktualisiert: new Date().toISOString() }) });
      }
      hinweis = r.ok ? "Vertragsdaten gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für diesen Standort?";
    }
    return weiterleiten(`/konto/auftraege?hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
  }
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const [daten, einsaetze, ergebnisse] = await Promise.all([
    auftraegeLaden(f.s, env, firma),
    db<{ vorgang_id: string; personal: { vorname: string; nachname: string | null } | null }[]>(f.s, env, `einsaetze?firma_id=eq.${firma}&status=eq.zugesagt&select=vorgang_id,personal(vorname,nachname)&limit=5000`),
    f.finanzen ? db<{ vorgang_id: string; umsatz: number | string | null }[]>(f.s, env, `angebotsergebnisse?firma_id=eq.${firma}&select=vorgang_id,umsatz`) : Promise.resolve({ ok: true as const, daten: [] }),
  ]);
  if (!daten.ok) return antwort('<p class="fehler">Die Aufträge konnten nicht geladen werden.</p>', 502);
  const zugesagt = new Map<string, string[]>();
  for (const e of einsaetze.ok ? einsaetze.daten : []) zugesagt.set(e.vorgang_id, [...(zugesagt.get(e.vorgang_id) ?? []), [e.personal?.vorname, e.personal?.nachname].filter(Boolean).join(" ") || "Ohne Namen"]);
  const umsatz = new Map((ergebnisse.ok ? ergebnisse.daten : []).filter((x) => x.umsatz !== null).map((x) => [x.vorgang_id, Number(x.umsatz)]));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${auftraegeSeite(daten.liste, { heute, vertraege: daten.vertraege, zugesagt, umsatz, finanzen: f.finanzen, darfAendern, offen: url.searchParams.get("offen") ?? "" })}`);
}
