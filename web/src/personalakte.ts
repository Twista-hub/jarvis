// T4, T5, T7: Personalakte. More fields per person (start, type of employment, hours, driving licence, languages, home
// postal code), qualification proofs with expiry and file, and a short profile as a Word file for offers.
import { db, weiterleiten, sitzung, type KontoEnv, type Sitzung } from "./konto.ts";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { escape } from "./seite.ts";
import { absatz, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";

export type Akte = { eintritt?: string | null; beschaeftigung?: string; wochenstunden?: number | string | null; fuehrerschein?: string[]; sprachen?: string[]; wohn_plz?: string };
export type Nachweis = { id: string; personal_id: string; bezeichnung: string; erworben: string | null; gueltig_bis: string | null; datei_name: string | null; datei_mime: string | null };
export const BESCHAEFTIGUNG: Record<string, string> = { vollzeit: "Vollzeit", teilzeit: "Teilzeit", minijob: "Minijob", aushilfe: "Aushilfe", azubi: "Auszubildende/r" };
export const FUEHRERSCHEINE = ["B", "BE", "C1", "C1E", "C", "CE", "D1", "D", "T", "L", "Stapler"];
export const NACHWEIS_VORSCHLAEGE = ["Staplerschein", "Erste Hilfe", "Hygieneschulung (§ 43 IfSG)", "Sachkunde § 34a GewO", "Unterrichtung § 34a GewO", "Brandschutzhelfer", "Ersthelfer", "Schweißerprüfung", "Höhentauglichkeit / Absturzsicherung", "Gabelstapler (DGUV 308-001)", "Hebebühne / PSA", "Elektrofachkraft", "SCC-Dokument", "Führungszeugnis", "Gesundheitszeugnis"];

const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE");
const monatJahr = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { month: "2-digit", year: "2-digit" });
export const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export type Ampel = "gruen" | "gelb" | "rot" | "offen";
/** Expired = red, within 60 days = yellow, otherwise green; without date: no expiry. */
export const ampel = (bis: string | null, heute: string): Ampel => !bis ? "offen" : bis < heute ? "rot" : bis <= plusTage(heute, 60) ? "gelb" : "gruen";
/** Valid on a day (for the search): no expiry, or expiry on or after the day. */
export const gueltigAm = (n: Pick<Nachweis, "gueltig_bis">, tag: string) => !n.gueltig_bis || n.gueltig_bis >= tag;

/** Years and months since joining, e.g. "seit 2019 (7 Jahre)". */
export function dabeiSeit(eintritt: string | null | undefined, heute: string): string {
  if (!eintritt) return "";
  const j = Number(heute.slice(0, 4)) - Number(eintritt.slice(0, 4)) - (heute.slice(5) < eintritt.slice(5) ? 1 : 0);
  return `seit ${eintritt.slice(0, 4)}${j >= 1 ? ` (${j} ${j === 1 ? "Jahr" : "Jahre"})` : ""}`;
}

export function akteFelder(k: Akte & { id?: string }): string {
  const fs = k.fuehrerschein ?? [];
  return `<details class="akte-felder"${k.eintritt || k.beschaeftigung || fs.length || (k.sprachen ?? []).length || k.wohn_plz ? " open" : ""}><summary>📁 Personalakte</summary>
<div class="zwei"><label>Eintritt<input name="eintritt" type="date" value="${escape(k.eintritt ?? "")}"></label>
<label>Beschäftigung<select name="beschaeftigung"><option value="">–</option>${Object.entries(BESCHAEFTIGUNG).map(([w, t]) => `<option value="${w}"${k.beschaeftigung === w ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
<div class="zwei"><label>Wochenstunden<input name="wochenstunden" inputmode="decimal" maxlength="5" value="${k.wochenstunden ?? ""}"></label>
<label>Wohnort-PLZ<input name="wohn_plz" inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${escape(k.wohn_plz ?? "")}" placeholder="für die Entfernung"></label></div>
<fieldset><legend>Führerschein</legend><div class="chips">${FUEHRERSCHEINE.map((f) => `<label><input type="checkbox" name="fuehrerschein" value="${f}"${fs.includes(f) ? " checked" : ""}><span>${f}</span></label>`).join("")}</div></fieldset>
<label>Sprachen (mit Komma)<input name="sprachen" maxlength="200" value="${escape((k.sprachen ?? []).join(", "))}" placeholder="z. B. Deutsch, Englisch, Türkisch"></label></details>`;
}

/** Form → personnel file fields (invalid values become empty). */
export function akteAusFormular(f: FormData): Required<Akte> {
  const t = (k: string, max: number) => String(f.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const e = t("eintritt", 10), plz = t("wohn_plz", 5), b = t("beschaeftigung", 20);
  const h = Number(t("wochenstunden", 6).replace(",", "."));
  return {
    eintritt: /^\d{4}-\d{2}-\d{2}$/.test(e) && Number.isFinite(Date.parse(e)) ? e : null,
    beschaeftigung: b in BESCHAEFTIGUNG ? b : "",
    wochenstunden: t("wochenstunden", 6) && Number.isFinite(h) && h >= 0 && h <= 60 ? Math.round(h * 10) / 10 : null,
    fuehrerschein: f.getAll("fuehrerschein").map(String).filter((x) => FUEHRERSCHEINE.includes(x)),
    sprachen: [...new Set(t("sprachen", 200).split(/[,;]/).map((x) => x.trim()).filter((x) => x.length >= 2).map((x) => x.slice(0, 40)))].slice(0, 12),
    wohn_plz: /^\d{5}$/.test(plz) ? plz : "",
  };
}

/** One line on the person card: employment, licence, languages. */
export function akteZeile(k: Akte, heute: string): string {
  const teile = [k.beschaeftigung ? `${BESCHAEFTIGUNG[k.beschaeftigung]}${k.wochenstunden ? ` ${String(k.wochenstunden).replace(".", ",")} h` : ""}` : "", dabeiSeit(k.eintritt, heute),
    (k.fuehrerschein ?? []).length ? `🚗 ${(k.fuehrerschein ?? []).join(", ")}` : "", (k.sprachen ?? []).length ? `🗣️ ${(k.sprachen ?? []).join(", ")}` : "", k.wohn_plz ? `📍 ${k.wohn_plz}` : ""].filter(Boolean);
  return teile.length ? `<p class="klein akte-zeile">${teile.map(escape).join(" · ")}</p>` : "";
}

/** Proof badges on the card: expired red, soon yellow. */
export function nachweisMarken(eigene: Nachweis[], heute: string): string {
  if (!eigene.length) return "";
  return `<p class="nachweis-marken">${eigene.map((n) => { const a = ampel(n.gueltig_bis, heute); return `<span class="nachweis-marke ${a}" title="${escape(n.bezeichnung)}${n.gueltig_bis ? ` · gültig bis ${datum(n.gueltig_bis)}` : ""}">${a === "rot" ? "⚠️ " : a === "gelb" ? "⏳ " : "🎓 "}${escape(n.bezeichnung)}${n.gueltig_bis ? ` ${monatJahr(n.gueltig_bis)}` : ""}</span>`; }).join("")}</p>`;
}

/** Inside "Bearbeiten": list with file links, upload form. */
export function nachweisTeil(personId: string, eigene: Nachweis[], heute: string): string {
  return `<div class="nachweis-teil"><h4>🎓 Qualifikationen mit Nachweis</h4>${eigene.length ? `<ul class="abwesenheit-liste">${eigene.map((n) => `<li><span class="${ampel(n.gueltig_bis, heute)}">${escape(n.bezeichnung)}${n.gueltig_bis ? ` · bis ${datum(n.gueltig_bis)}` : ""}${n.datei_name ? ` · <a href="/konto/personal/${personId}/nachweis/${n.id}">📎 Datei</a>` : ""}</span><form method="post" action="/konto/personal/${personId}/nachweis" class="termin-weg"><input type="hidden" name="loeschen" value="${n.id}"><button class="zweit" aria-label="Nachweis löschen">✕</button></form></li>`).join("")}</ul>` : ""}
<form method="post" action="/konto/personal/${personId}/nachweis" enctype="multipart/form-data" class="nachweis-form"><label class="ganz">Qualifikation<input name="bezeichnung" list="nachweis-vorschlaege" required maxlength="120"></label><datalist id="nachweis-vorschlaege">${NACHWEIS_VORSCHLAEGE.map((v) => `<option value="${v}">`).join("")}</datalist>
<label>Erworben<input name="erworben" type="date"></label><label>Gültig bis<input name="gueltig_bis" type="date"></label>
<label class="ganz">Nachweis (PDF/Foto, freiwillig, max. 5 MB)<input type="file" name="datei" accept="application/pdf,image/png,image/jpeg"></label><button class="zweit">Hinzufügen</button></form>
<p class="klein">Jarvis erinnert in Firma &amp; Team 60 Tage vor dem Ablauf. <a href="/konto/personal/${personId}/profil.docx">📄 Kurzprofil (Word)</a> für Angebote, nur mit Einverständnis der Person weitergeben.</p></div>`;
}

export async function nachweiseLaden(s: Sitzung, env: KontoEnv, firma: string): Promise<Nachweis[]> {
  const r = await db<Nachweis[]>(s, env, `personal_nachweise?firma_id=eq.${firma}&select=id,personal_id,bezeichnung,erworben,gueltig_bis,datei_name,datei_mime&order=gueltig_bis.nullslast&limit=5000`);
  return r.ok ? r.daten : [];
}

type PersonProfil = Akte & { vorname: string; nachname: string; berufe: string[]; qualifikationen: string[] };
/** T7: short profile for offers (key staff): no contact data, no address, only work-related facts. */
export function kurzprofilDocx(firma: string, p: PersonProfil, nachweise: Nachweis[], einsaetze: string[], heute: string): Uint8Array {
  const name = `${p.vorname} ${p.nachname}`.trim();
  const daten: [string, string][] = [
    ["Name", name], ["Tätigkeit", p.berufe.join(", ")], ["Im Unternehmen", dabeiSeit(p.eintritt, heute)], ["Beschäftigung", p.beschaeftigung ? BESCHAEFTIGUNG[p.beschaeftigung] : ""],
    ["Sprachen", (p.sprachen ?? []).join(", ")], ["Führerschein", (p.fuehrerschein ?? []).join(", ")], ["Weitere Qualifikationen", p.qualifikationen.join(", ")],
  ];
  const gueltig = nachweise.filter((n) => gueltigAm(n, heute));
  const body = ueberschrift("Personalprofil", 32) + absatz(`${firma} · Stand ${datum(heute)}`, { grau: true, groesse: 18, abstand: 200 })
    + tabelle(daten.filter(([, v]) => v).map(([a, b]) => [a, b]), [3000, 6600])
    + (gueltig.length ? ueberschrift("Nachweise") + tabelle([["Qualifikation", "erworben", "gültig bis"], ...gueltig.map((n) => [n.bezeichnung, n.erworben ? datum(n.erworben) : "—", n.gueltig_bis ? datum(n.gueltig_bis) : "unbefristet"])], [5000, 2300, 2300], true) : "")
    + (einsaetze.length ? ueberschrift("Erfahrung aus Einsätzen") + absatz(einsaetze.slice(0, 12).map((e) => `• ${e}`).join("\n"), { abstand: 200 }) : "")
    + absatz("Nachweise legen wir auf Anforderung vor.", { grau: true, groesse: 16 });
  return wordDokument(body);
}

const DATEI_TYPEN = ["application/pdf", "image/png", "image/jpeg"];
const passtZuTyp = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;

/** Routes: /konto/personal/<id>/nachweis (POST add/delete), /nachweis/<nid> (file), /profil.docx (short profile). */
export async function personalakte(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/konto\/personal\/([0-9a-f-]{36})\/(nachweis(?:\/([0-9a-f-]{36}))?|profil\.docx)$/);
  if (!m) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return (await sitzung(request, env)) ? new Response("Nicht erlaubt", { status: 403 }) : weiterleiten("/konto");
  if (f.m.rolle === "mitarbeiter") return new Response("Nicht erlaubt", { status: 403 });
  const pid = m[1];
  // The person must be visible with the user's location rights (RLS).
  const p = await db<(PersonProfil & { id: string; firma_id: string })[]>(f.s, env, `personal?id=eq.${pid}&select=id,firma_id,vorname,nachname,berufe,qualifikationen,eintritt,beschaeftigung,wochenstunden,fuehrerschein,sprachen`);
  const person = p.ok ? p.daten[0] : undefined;
  if (!person) return new Response("Nicht gefunden", { status: 404 });
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const herkunft = (() => { try { const r = new URL(request.headers.get("referer") ?? ""); return r.origin === url.origin && /^\/konto\/(team|standort\/[\w-]+)$/.test(r.pathname) ? r.pathname : "/konto/team"; } catch { return "/konto/team"; } })();
  const zurueck = (h: string) => weiterleiten(`${herkunft}?hinweis=${encodeURIComponent(h)}#bearbeiten-${pid}`, f.s.cookies);
  if (m[2] === "profil.docx") {
    const [n, e, u, fn] = await Promise.all([
      db<Nachweis[]>(f.s, env, `personal_nachweise?personal_id=eq.${pid}&select=id,personal_id,bezeichnung,erworben,gueltig_bis,datei_name,datei_mime&order=bezeichnung`),
      db<{ vorgaenge: { titel: string; status: string } | null }[]>(f.s, env, `einsaetze?personal_id=eq.${pid}&status=eq.zugesagt&select=vorgaenge(titel,status)&limit=50`),
      db<{ entleiher: string; von: string }[]>(f.s, env, `ueberlassungen?personal_id=eq.${pid}&select=entleiher,von&order=von.desc&limit=30`),
      db<{ name: string }[]>(f.s, env, `firmen?id=eq.${person.firma_id}&select=name`),
    ]);
    const einsaetze = [...new Set([...(e.ok ? e.daten : []).filter((x) => x.vorgaenge?.status === "gewonnen").map((x) => x.vorgaenge!.titel), ...(u.ok ? u.daten : []).map((x) => `${x.entleiher} (seit ${x.von.slice(0, 4)})`)])];
    return wordAntwort(kurzprofilDocx(fn.ok ? fn.daten[0]?.name ?? "" : "", person, n.ok ? n.daten : [], einsaetze, heute), `Profil_${person.vorname}_${person.nachname}.docx`.replace(/[^\wäöüÄÖÜß.-]+/g, "_"), f.s.cookies);
  }
  if (m[3] && request.method === "GET") {
    const n = await db<Nachweis[]>(f.s, env, `personal_nachweise?id=eq.${m[3]}&personal_id=eq.${pid}&select=id,personal_id,bezeichnung,erworben,gueltig_bis,datei_name,datei_mime`);
    const nw = n.ok ? n.daten[0] : undefined;
    const obj = nw?.datei_name ? await env.DATEN?.get(`personal_nachweise/${person.firma_id}/${pid}/${nw.id}`) : null;
    if (!nw || !obj) return new Response("Nicht gefunden", { status: 404 });
    const headers = new Headers({ "content-type": nw.datei_mime ?? "application/octet-stream", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(nw.datei_name!)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    for (const c of f.s.cookies) headers.append("set-cookie", c);
    return new Response(obj.body, { headers });
  }
  if (request.method !== "POST") return new Response("Methode nicht erlaubt", { status: 405 });
  const form = await request.formData();
  const loeschen = String(form.get("loeschen") ?? "");
  if (/^[0-9a-f-]{36}$/.test(loeschen)) {
    const r = await db<{ id: string }[]>(f.s, env, `personal_nachweise?id=eq.${loeschen}&personal_id=eq.${pid}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
    if (r.ok && r.daten.length) await env.DATEN?.delete(`personal_nachweise/${person.firma_id}/${pid}/${loeschen}`);
    return zurueck(r.ok && r.daten.length ? "Nachweis gelöscht." : "Löschen hat nicht geklappt.");
  }
  const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const d = (k: string) => { const v = t(k, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null; };
  const zeile = { id: crypto.randomUUID(), firma_id: person.firma_id, personal_id: pid, bezeichnung: t("bezeichnung", 120), erworben: d("erworben"), gueltig_bis: d("gueltig_bis"), datei_name: null as string | null, datei_mime: null as string | null, datei_groesse: null as number | null };
  if (zeile.bezeichnung.length < 2 || (zeile.erworben && zeile.gueltig_bis && zeile.gueltig_bis < zeile.erworben)) return zurueck("Bitte Qualifikation angeben (gültig bis nicht vor erworben).");
  const datei = form.get("datei");
  let bytes: Uint8Array | null = null;
  if (datei && typeof datei !== "string" && datei.size > 0) {
    bytes = new Uint8Array(await datei.arrayBuffer());
    if (datei.size > 5 * 1024 * 1024 || !DATEI_TYPEN.includes(datei.type) || !passtZuTyp(bytes, datei.type)) return zurueck("Bitte ein PDF, PNG oder JPG bis 5 MB wählen.");
    Object.assign(zeile, { datei_name: datei.name.replace(/[^\wäöüÄÖÜß.\- ]+/g, "_").slice(0, 200), datei_mime: datei.type, datei_groesse: datei.size });
  }
  if (bytes) await env.DATEN?.put(`personal_nachweise/${person.firma_id}/${pid}/${zeile.id}`, bytes, { httpMetadata: { contentType: zeile.datei_mime! } });
  const r = await db(f.s, env, "personal_nachweise", { method: "POST", body: JSON.stringify(zeile) });
  if (!r.ok && bytes) await env.DATEN?.delete(`personal_nachweise/${person.firma_id}/${pid}/${zeile.id}`);
  return zurueck(r.ok ? "Nachweis gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?");
}
