// N13 AÜG-Wächter: for every temporary worker and hirer the date from which equal pay applies (after 9 months,
// § 8 Abs. 4 AÜG) and the end of the maximum assignment period (18 months, § 1 Abs. 1b AÜG). Earlier assignments
// to the same hirer count when the gap between two assignments is not more than three months; the gaps themselves
// do not count. Collective agreements may set other limits; the page says so. No legal advice.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { avatar } from "./personal.ts";
import { escape, seite } from "./seite.ts";

export type Ueberlassung = { id: string; personal_id: string; entleiher: string; von: string; bis: string | null; notiz: string };
export type Frist = { personal_id: string; entleiher: string; beginn: string; equalPay: string; hoechst: string; aktiv: boolean; einsaetze: Ueberlassung[]; unterbrechungTage: number };

const tag = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const plusTage = (d: string, n: number) => iso(tag(d) + n * 86400_000);
/** Calendar months; a day that does not exist becomes the last day of the month (31.08. + 6 months = 28./29.02.). */
export function plusMonate(d: string, n: number): string {
  const [j, m, t] = d.split("-").map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), Math.min(t, letzter)));
}
export const entleiherSchluessel = (n: string) => n.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/\b(gmbh|ag|kg|e\.?\s?v|mbh|co)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The current chain of assignments per worker and hirer with its two key dates. */
/** tarif: false = the firm applies no collective agreement for temporary agency work → Equal Pay from day 1 (§ 8 Abs. 1, 2
 *  AÜG; Rechtsprüfung 03.11.2026 A3). true or unknown (null) = after 9 months (§ 8 Abs. 4); unknown is pointed out on the page. */
export function fristen(liste: Ueberlassung[], heute: string, tarif: boolean | null = null): Frist[] {
  const gruppen = new Map<string, Ueberlassung[]>();
  for (const u of liste) {
    const k = `${u.personal_id}|${entleiherSchluessel(u.entleiher)}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), u]);
  }
  const ergebnis: Frist[] = [];
  for (const einsaetze of gruppen.values()) {
    const sortiert = [...einsaetze].sort((a, b) => a.von.localeCompare(b.von));
    // A gap of more than three months starts a new count.
    let kette: Ueberlassung[] = [];
    for (const u of sortiert) {
      const vorher = kette[kette.length - 1];
      const ende = vorher ? vorher.bis ?? heute : null;
      if (vorher && u.von > plusMonate(ende!, 3)) kette = [];
      kette.push(u);
    }
    let luecken = 0;
    for (let i = 1; i < kette.length; i++) {
      const ende = kette[i - 1].bis ?? heute;
      luecken += Math.max(0, Math.round((tag(kette[i].von) - tag(ende)) / 86400_000) - 1);
    }
    const letzte = kette[kette.length - 1];
    const beginn = kette[0].von;
    // Still relevant while assigned, or until a new assignment within three months could continue the count.
    const aktiv = !letzte.bis || letzte.bis >= heute;
    if (!aktiv && plusMonate(letzte.bis!, 3) < heute) continue;
    ergebnis.push({ personal_id: letzte.personal_id, entleiher: letzte.entleiher, beginn, aktiv, einsaetze: kette, unterbrechungTage: luecken,
      equalPay: tarif === false ? beginn : plusTage(plusMonate(beginn, 9), luecken), hoechst: plusTage(plusMonate(beginn, 18), luecken - 1) });
  }
  return ergebnis.sort((a, b) => a.equalPay.localeCompare(b.equalPay));
}

const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" });
const tageBis = (d: string, heute: string) => Math.round((tag(d) - tag(heute)) / 86400_000);

// T38: sector surcharge steps (TV BZ): after 6 weeks, 3, 5, 7 and 9 months of uninterrupted assignment at the hirer.
export function bzStufe(f: Pick<Frist, "beginn" | "unterbrechungTage">, heute: string, prozente: number[]): { stufe: number; prozent: number; seit: string | null; naechste: { datum: string; prozent: number } | null } | null {
  if (!prozente.length || !prozente.some((x) => x > 0)) return null;
  const grenzen = [plusTage(f.beginn, 42), plusMonate(f.beginn, 3), plusMonate(f.beginn, 5), plusMonate(f.beginn, 7), plusMonate(f.beginn, 9)].map((d) => plusTage(d, f.unterbrechungTage));
  const stufe = grenzen.filter((d) => d <= heute).length;
  return { stufe, prozent: stufe ? prozente[stufe - 1] ?? 0 : 0, seit: stufe ? grenzen[stufe - 1] : null, naechste: stufe < 5 ? { datum: grenzen[stufe], prozent: prozente[stufe] ?? 0 } : null };
}
export function bzText(b: ReturnType<typeof bzStufe>): string {
  if (!b) return "";
  const z = (n: number) => `${String(n).replace(".", ",")} %`;
  return `💶 Branchenzuschlag ${b.stufe ? `${z(b.prozent)} seit ${datum(b.seit!)}` : "noch keiner"}${b.naechste ? ` · ${z(b.naechste.prozent)} ab ${datum(b.naechste.datum)}` : " (höchste Stufe)"}`;
}

/** Short status of one chain: what comes next and how urgent it is. */
export function fristStatus(f: Frist, heute: string): { stufe: "rot" | "gelb" | "gruen" | "grau"; text: string } {
  const ep = tageBis(f.equalPay, heute), hd = tageBis(f.hoechst, heute);
  if (hd < 0) return { stufe: "rot", text: f.aktiv ? `Höchstdauer seit ${datum(f.hoechst)} überschritten` : `Höchstdauer am ${datum(f.hoechst)} erreicht` };
  if (hd <= 60) return { stufe: hd <= 30 ? "rot" : "gelb", text: `Höchstdauer endet am ${datum(f.hoechst)} (in ${hd} ${hd === 1 ? "Tag" : "Tagen"})` };
  if (ep <= 0) return { stufe: "gruen", text: `Equal Pay seit ${datum(f.equalPay)} · Höchstdauer bis ${datum(f.hoechst)}` };
  if (ep <= 60) return { stufe: ep <= 30 ? "rot" : "gelb", text: `Equal Pay ab ${datum(f.equalPay)} (in ${ep} ${ep === 1 ? "Tag" : "Tagen"})` };
  return { stufe: f.aktiv ? "gruen" : "grau", text: `Equal Pay ab ${datum(f.equalPay)} · Höchstdauer bis ${datum(f.hoechst)}` };
}

/** Badge for a worker card: only when something is due within 60 days. */
export function personHinweise(liste: Frist[], heute: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const f of liste) {
    const s = fristStatus(f, heute);
    if (s.stufe === "rot" || s.stufe === "gelb") r[f.personal_id] = `⚖️ ${f.entleiher}: ${s.text}`;
  }
  return r;
}

export function auegSeite(liste: Frist[], personal: { id: string; vorname: string; nachname: string }[], o: { heute: string; darfAendern: boolean; entleiher: string[]; bz?: Record<string, number[]>; tarif?: boolean | null }): string {
  const name = (id: string) => { const p = personal.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "Unbekannt"; };
  const dringend = liste.filter((f) => ["rot", "gelb"].includes(fristStatus(f, o.heute).stufe));
  const karte = (f: Frist) => {
    const s = fristStatus(f, o.heute);
    const tageImEinsatz = Math.max(0, Math.round((tag(f.aktiv ? o.heute : f.einsaetze[f.einsaetze.length - 1].bis!) - tag(f.beginn)) / 86400_000) + 1 - f.unterbrechungTage);
    const anteil = Math.min(100, Math.round((tageImEinsatz / Math.max(1, Math.round((tag(f.hoechst) - tag(f.beginn)) / 86400_000) + 1 - f.unterbrechungTage)) * 100));
    const marke = Math.round((Math.max(1, Math.round((tag(f.equalPay) - tag(f.beginn)) / 86400_000) - f.unterbrechungTage) / Math.max(1, Math.round((tag(f.hoechst) - tag(f.beginn)) / 86400_000) + 1 - f.unterbrechungTage)) * 100);
    return `<li class="aueg-karte stufe-${s.stufe}">${avatar(name(f.personal_id), f.personal_id, undefined, "person-avatar klein-avatar")}<div class="aueg-text"><strong>${escape(name(f.personal_id))}</strong><span class="klein">bei ${escape(f.entleiher)} · seit ${datum(f.beginn)}${f.aktiv ? "" : " · zurzeit nicht im Einsatz"}${f.unterbrechungTage ? ` · ${f.unterbrechungTage} Tage Unterbrechung` : ""}</span>
<div class="aueg-leiste" aria-hidden="true"><span style="width:${anteil}%"></span><i style="left:${marke}%" title="Equal Pay"></i></div><span class="aueg-status">${escape(s.text)}</span>${f.aktiv && o.bz?.[entleiherSchluessel(f.entleiher)] ? `<span class="klein aueg-bz">${escape(bzText(bzStufe(f, o.heute, o.bz[entleiherSchluessel(f.entleiher)])))}</span>` : ""}
<details class="aueg-einsaetze"><summary>${f.einsaetze.length} ${f.einsaetze.length === 1 ? "Einsatz" : "Einsätze"}</summary><ul>${f.einsaetze.map((u) => `<li><span>${datum(u.von)} – ${u.bis ? datum(u.bis) : "laufend"}${u.notiz ? ` · ${escape(u.notiz)}` : ""}</span>${o.darfAendern ? `<span class="aueg-aktionen">${!u.bis ? `<form method="post" action="/konto/aueg"><input type="hidden" name="beenden" value="${u.id}"><input type="date" name="bis" value="${o.heute}" aria-label="Ende des Einsatzes"><button class="zweit">Beenden</button></form>` : ""}<form method="post" action="/konto/aueg"><input type="hidden" name="loeschen" value="${u.id}"><button class="zweit" aria-label="Einsatz löschen">✕</button></form></span>` : ""}</li>`).join("")}</ul></details></div></li>`;
  };
  const formular = o.darfAendern && personal.length ? `<details class="upload-neu"${liste.length ? "" : " open"}><summary>➕ Einsatz beim Kunden eintragen</summary><form method="post" action="/konto/aueg" class="aueg-form">
<label>Person<select name="personal" required><option value="">Bitte wählen …</option>${personal.map((p) => `<option value="${p.id}">${escape(`${p.vorname} ${p.nachname}`.trim())}</option>`).join("")}</select></label>
<label>Kunde (Entleiher)<input name="entleiher" required maxlength="200" list="entleiher-liste" placeholder="z. B. Messe Berlin GmbH"></label><datalist id="entleiher-liste">${o.entleiher.map((e) => `<option value="${escape(e)}">`).join("")}</datalist>
<label>Von<input type="date" name="von" required></label><label>Bis (leer = läuft noch)<input type="date" name="bis"></label>
<label class="ganz">Notiz (freiwillig)<input name="notiz" maxlength="300"></label><button class="ganz">Speichern</button></form></details>` : "";
  return `<p class="klein">Für jede Leiharbeitskraft und jeden Kunden: ab wann Equal Pay gilt (nach 9 Monaten) und wann die Höchstüberlassungsdauer (18 Monate) endet. Frühere Einsätze beim selben Kunden zählen mit, wenn dazwischen nicht mehr als 3 Monate liegen; die Unterbrechungen selbst zählen nicht.</p>
${dringend.length ? `<aside class="ablauf-warnung"><strong>⚠️ ${dringend.length} ${dringend.length === 1 ? "Frist" : "Fristen"} in den nächsten 60 Tagen</strong><ul>${dringend.map((f) => `<li><span>${escape(name(f.personal_id))} · ${escape(f.entleiher)}</span><span class="${fristStatus(f, o.heute).stufe === "rot" ? "abgelaufen" : "bald"}">${escape(fristStatus(f, o.heute).text.replace(/ \(in .*\)/, ""))}</span></li>`).join("")}</ul></aside>` : ""}
${o.tarif === false ? `<p class="hinweis">⚠️ Laut Firmenprofil wendet ihr <strong>keinen Tarifvertrag der Zeitarbeit</strong> an: Equal Pay gilt dann <strong>ab dem ersten Tag</strong> (§ 8 Abs. 1 AÜG).</p>` : o.tarif == null ? `<p class="hinweis">Equal Pay erst nach 9 Monaten gilt nur, wenn ihr einen Tarifvertrag der Zeitarbeit anwendet (z. B. GVP/BAP oder iGZ). Ohne Tarifvertrag gilt Equal Pay ab dem ersten Tag. Bitte im <a href="/konto/firmenprofil">Firmenprofil</a> angeben.</p>` : ""}
${formular}
${liste.length ? `<ul class="aueg-liste">${liste.map(karte).join("")}</ul>` : `<p class="treffer-leer">Noch keine Einsätze eingetragen.</p>`}
<p class="klein">Ohne Gewähr, keine Rechtsberatung. Tarifverträge der Einsatzbranche können eine andere Höchstdauer erlauben, Branchenzuschlagstarifverträge verschieben Equal Pay bis auf 15 Monate. Grundlage: § 1 Abs. 1b und § 8 Abs. 4 AÜG.</p>`;
}

export async function auegLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Ueberlassung[]> {
  const r = await db<Ueberlassung[]>(s, env, `ueberlassungen?firma_id=eq.${firma}&select=id,personal_id,entleiher,von,bis,notiz&order=von&limit=3000`);
  return r.ok ? r.daten : [];
}

export async function aueg(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/aueg") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("AÜG-Wächter", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma & Team">←</a></p>${text}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Den AÜG-Wächter sieht das Büroteam.</p>", 403);
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    if (!darfAendern) return antwort("<p>Nur Bearbeiter und Admins können Einsätze eintragen.</p>", 403);
    const form = await request.formData();
    const datumOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(tag(v)) === v;
    const id = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    let hinweis: string;
    if (id("loeschen")) {
      const r = await db(f.s, env, `ueberlassungen?id=eq.${id("loeschen")}&firma_id=eq.${f.m.firma_id}`, { method: "DELETE" });
      hinweis = r.ok ? "Einsatz gelöscht." : "Löschen hat nicht geklappt.";
    } else if (id("beenden")) {
      const bis = String(form.get("bis") ?? "");
      const r = datumOk(bis) ? await db(f.s, env, `ueberlassungen?id=eq.${id("beenden")}&firma_id=eq.${f.m.firma_id}`, { method: "PATCH", body: JSON.stringify({ bis }) }) : null;
      hinweis = r?.ok ? "Einsatz beendet." : "Bitte ein Enddatum ab dem Beginn eingeben.";
    } else {
      const von = String(form.get("von") ?? ""), bis = String(form.get("bis") ?? ""), entleiher = String(form.get("entleiher") ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!id("personal") || entleiher.length < 2 || !datumOk(von) || (bis && (!datumOk(bis) || bis < von))) hinweis = "Bitte Person, Kunde und Beginn angeben (Ende nicht vor dem Beginn).";
      else {
        const r = await db(f.s, env, "ueberlassungen", { method: "POST", body: JSON.stringify({ firma_id: f.m.firma_id, personal_id: id("personal"), entleiher, von, bis: bis || null, notiz: String(form.get("notiz") ?? "").trim().slice(0, 300) }) });
        hinweis = r.ok ? "Einsatz gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?";
      }
    }
    return weiterleiten(`/konto/aueg?hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
  }
  const [liste, personal, kunden, prof] = await Promise.all([
    auegLaden(f.s, env, f.m.firma_id),
    db<{ id: string; vorname: string; nachname: string }[]>(f.s, env, `personal?firma_id=eq.${f.m.firma_id}&select=id,vorname,nachname&order=vorname&limit=2000`),
    db<{ name: string; bz_prozente: (number | string)[] }[]>(f.s, env, `kunden?firma_id=eq.${f.m.firma_id}&select=name,bz_prozente&limit=1000`),
    db<{ zeitarbeit_tarif: boolean | null }[]>(f.s, env, `firmenprofil?firma_id=eq.${f.m.firma_id}&select=zeitarbeit_tarif`),
  ]);
  const tarif = prof.ok ? prof.daten[0]?.zeitarbeit_tarif ?? null : null;
  const entleiher = [...new Map(liste.map((u) => [entleiherSchluessel(u.entleiher), u.entleiher])).values()].sort((a, b) => a.localeCompare(b, "de"));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${auegSeite(fristen(liste, heute, tarif), personal.ok ? personal.daten : [], { heute, darfAendern, entleiher, tarif, bz: Object.fromEntries((kunden.ok ? kunden.daten : []).filter((k) => (k.bz_prozente ?? []).length).map((k) => [entleiherSchluessel(k.name), k.bz_prozente.map(Number)])) })}`);
}
