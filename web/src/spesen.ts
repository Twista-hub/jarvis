// T36: Spesen und Auslagen. Staff photograph the receipt and enter amount and type; the office approves; approved
// expenses go into the payroll list (T35). S19 (Rechtsprüfung): besides receipts the tax-free flat rates – Kilometergeld
// 0.30 €/km and Verpflegungspauschale 14/28 € with the meal reduction – computed here and checked by the database
// (migration 20261108110000); payroll and LODAS get three separate wage types.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { naechsterMonat, vorMonat } from "./stunden.ts";

export type Spese = { id: string; personal_id: string; datum: string; art: string; betrag: number | string; notiz: string; beleg_mime: string | null; status: string; km?: number | string | null; vma?: string | null; mahlzeiten?: number };
/** Types with a receipt (Auslagen) and the two flat rates. Old entries of type "verpflegung" stay readable. */
export const ARTEN: Record<string, string> = { tanken: "⛽ Tanken", parken: "🅿️ Parken", fahrkarte: "🚆 Fahrkarte", material: "🔩 Material", km: "🚗 Kilometergeld (eigenes Auto)", vma: "🍽️ Verpflegungspauschale", sonstiges: "📦 Sonstiges" };
const ANZEIGE: Record<string, string> = { ...ARTEN, verpflegung: "🍽️ Verpflegung (Beleg)" };
export const KM_SATZ = 0.3;
export const VMA: Record<string, [string, number]> = { "8h": ["mehr als 8 Stunden unterwegs", 14], an_ab: ["An- oder Abreisetag (mit Übernachtung)", 14], "24h": ["ganzer Tag (24 Stunden) auswärts", 28] };
/** Flat rate for meals (§ 9 Abs. 4a EStG): 14/28 € minus 5.60 € for a breakfast and 11.20 € each for lunch and dinner provided (bits 1, 2, 4). */
export function vmaBetrag(stufe: string, mahlzeiten: number): number {
  const basis = VMA[stufe]?.[1] ?? 0;
  return Math.max(0, Math.round((basis - (mahlzeiten & 1 ? 5.6 : 0) - (mahlzeiten & 2 ? 11.2 : 0) - (mahlzeiten & 4 ? 11.2 : 0)) * 100) / 100);
}
export const kmBetrag = (km: number) => Math.round(km * KM_SATZ * 100) / 100;
/** Payroll group of an expense: receipt (Auslagen), meal flat rate or mileage. */
export const spesenGruppe = (art: string): "auslagen" | "vma" | "km" => (art === "vma" ? "vma" : art === "km" ? "km" : "auslagen");
const STATUS: Record<string, string> = { erfasst: "⏳ offen", freigegeben: "✅ freigegeben", abgelehnt: "❌ abgelehnt" };
const TYPEN = ["application/pdf", "image/png", "image/jpeg"];
const passt = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;
export const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const belegSchluessel = (firma: string, id: string) => `spesen/${firma}/${id}`;

export function meineSpesenTeil(liste: Spese[], heute: string): string {
  const offen = liste.filter((s) => s.status === "erfasst").reduce((n, s) => n + Number(s.betrag), 0);
  return `<section id="spesen"><h3>🧾 Meine Spesen</h3>${offen ? `<p class="klein">Offen: <strong>${euro(offen)}</strong></p>` : ""}
<details class="termin-neu"><summary>➕ Beleg einreichen</summary><form method="post" action="/konto/ich" enctype="multipart/form-data"><input type="hidden" name="aktion" value="spese"><div class="aueg-form">
<label>Datum<input type="date" name="datum" required value="${heute}" max="${heute}" min="${plus(heute, -90)}"></label><label>Art<select name="art">${Object.entries(ARTEN).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
<label class="spese-beleg">Betrag (€)<input name="betrag" inputmode="decimal" maxlength="8" placeholder="z. B. 12,50"></label>
<label class="spese-km">Gefahrene Kilometer<input name="km" inputmode="decimal" maxlength="7" placeholder="z. B. 42"></label><p class="klein ganz spese-km">0,30 € pro km mit dem eigenen Auto auf Dienstfahrten (nicht der tägliche Weg zur ersten Tätigkeitsstätte). Bitte Strecke und Anlass in die Notiz.</p>
<label class="spese-vma">Abwesenheit<select name="vma">${Object.entries(VMA).map(([k, [t, b]]) => `<option value="${k}">${t} – ${euro(b)}</option>`).join("")}</select></label>
<fieldset class="ganz spese-vma"><legend>Vom Arbeitgeber gestellte Mahlzeiten (Kürzung)</legend><label class="zeile"><input type="checkbox" name="mahlzeit" value="1">Frühstück (− 5,60 €)</label><label class="zeile"><input type="checkbox" name="mahlzeit" value="2">Mittagessen (− 11,20 €)</label><label class="zeile"><input type="checkbox" name="mahlzeit" value="4">Abendessen (− 11,20 €)</label></fieldset>
<p class="klein ganz spese-vma">Für auswärtige Einsätze ohne Rückkehr in die Firma bzw. nach Hause. Höchstens eine Pauschale pro Tag, an derselben Einsatzstelle nur in den ersten 3 Monaten. Bitte Ort und Anlass in die Notiz.</p>
<label class="ganz">Notiz<input name="notiz" maxlength="300"></label>
<label class="ganz spese-beleg">Beleg (Foto oder PDF bis 5 MB)<input type="file" name="beleg" accept="image/jpeg,image/png,application/pdf"></label></div><button>Einreichen</button></form></details>
${liste.length ? `<ul class="kontakt-liste ich-liste">${liste.slice(0, 20).map((s) => `<li class="${s.status === "erfasst" ? "bald" : s.status === "abgelehnt" ? "abgelaufen" : ""}"><div><strong>${tag(s.datum)} · ${euro(Number(s.betrag))}</strong><span class="klein">${ANZEIGE[s.art] ?? s.art}${s.art === "km" && s.km ? ` (${Number(s.km).toLocaleString("de-DE")} km)` : ""} · ${STATUS[s.status]}${s.beleg_mime ? " · 📎" : ""}${s.notiz ? ` · ${escape(s.notiz)}` : ""}</span></div>${s.status === "erfasst" ? `<form method="post" action="/konto/ich"><input type="hidden" name="spese_weg" value="${s.id}"><button class="zweit" aria-label="Löschen">✕</button></form>` : ""}</li>`).join("")}</ul>` : ""}</section>`;
}

/** Saves a receipt entered by a staff member (or the office); returns a message. */
export async function speseSpeichern(s: Sitzung, env: KontoEnv, form: FormData, firma: string, personal: string, heute: string): Promise<string> {
  const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const zahl = (k: string) => Number(t(k, 10).replace(/[^\d,.-]/g, "").replace(",", "."));
  const art = Object.hasOwn(ARTEN, t("art", 20)) ? t("art", 20) : "sonstiges", datum = t("datum", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum > heute || datum < plus(heute, -90)) return "Bitte ein Datum aus den letzten 90 Tagen wählen.";
  const km = art === "km" ? Math.round(zahl("km") * 10) / 10 : null;
  const vma = art === "vma" ? (Object.hasOwn(VMA, t("vma", 5)) ? t("vma", 5) : "") : null;
  const mahlzeiten = art === "vma" ? [...new Set(form.getAll("mahlzeit").map(Number))].filter((x) => [1, 2, 4].includes(x)).reduce((n, x) => n | x, 0) : 0;
  if (art === "km" && (!Number.isFinite(km) || km! <= 0 || km! > 5000)) return "Bitte die gefahrenen Kilometer angeben (bis 5.000 km).";
  if (vma === "") return "Bitte die Abwesenheit wählen.";
  if ((art === "km" || art === "vma") && t("notiz", 300).length < 3) return art === "km" ? "Bitte Strecke und Anlass in die Notiz schreiben." : "Bitte Ort und Anlass in die Notiz schreiben.";
  const betrag = art === "km" ? kmBetrag(km!) : art === "vma" ? vmaBetrag(vma!, mahlzeiten) : zahl("betrag");
  if (art === "vma" && betrag <= 0) return "Keine Pauschale: alle Mahlzeiten wurden gestellt.";
  if (!Number.isFinite(betrag) || betrag <= 0 || betrag > 5000) return "Bitte einen Betrag bis 5.000 € angeben.";
  const id = crypto.randomUUID();
  const b = form.get("beleg");
  let mime: string | null = null, bytes: Uint8Array | null = null;
  if (b && typeof b !== "string" && b.size && art !== "km" && art !== "vma") {
    bytes = new Uint8Array(await b.arrayBuffer());
    if (b.size > 5 * 1024 * 1024 || !TYPEN.includes(b.type) || !passt(bytes, b.type)) return "Beleg bitte als Foto (JPG/PNG) oder PDF bis 5 MB.";
    mime = b.type;
    await env.DATEN?.put(belegSchluessel(firma, id), bytes, { httpMetadata: { contentType: mime } });
  }
  const r = await db(s, env, "spesen", { method: "POST", body: JSON.stringify({ id, firma_id: firma, personal_id: personal, datum, betrag: Math.round(betrag * 100) / 100, art, km, vma, mahlzeiten, notiz: t("notiz", 300), beleg_mime: mime }) });
  if (!r.ok && bytes) await env.DATEN?.delete(belegSchluessel(firma, id));
  if (!r.ok && /spesen_vma_tag|23505/.test(r.fehler)) return "Für diesen Tag gibt es schon eine Verpflegungspauschale.";
  return r.ok ? `${euro(betrag)} eingereicht. Das Büro gibt frei.` : "Speichern hat nicht geklappt.";
}

type Person = { id: string; vorname: string; nachname: string };
export function spesenSeite(liste: Spese[], personen: Person[], o: { monat: string; darfAendern: boolean }): string {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "?"; };
  const offen = liste.filter((s) => s.status === "erfasst"), summe = (l: Spese[]) => l.reduce((n, s) => n + Number(s.betrag), 0);
  const leute = [...new Set(liste.map((s) => s.personal_id))].sort((a, b) => name(a).localeCompare(name(b), "de"));
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/spesen?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${new Date(`${o.monat}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><a class="knopf zweit" href="/konto/spesen?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
<p class="klein">Belege der Einsatzkräfte aus „Meine Einsätze &amp; Daten“. Freigegebene Spesen stehen in der Lohnliste. ${offen.length ? `<strong>${offen.length} offen (${euro(summe(offen))})</strong>` : "Nichts offen."}</p>
${leute.length ? `<form method="post" action="/konto/spesen" class="stunden-form"><input type="hidden" name="monat" value="${o.monat}">${leute.map((pid) => { const l = liste.filter((s) => s.personal_id === pid); return `<section class="stunden-person"><h3>${escape(name(pid))} <span class="klein">${euro(summe(l.filter((s) => s.status !== "abgelehnt")))}</span></h3><ul class="kontakt-liste stunden-buero">${l.map((s) => `<li class="stunden-zeile ${s.status}">${o.darfAendern && s.status === "erfasst" ? `<input type="checkbox" name="id" value="${s.id}" checked aria-label="Auswählen">` : `<span>${STATUS[s.status].slice(0, 2)}</span>`}<div><span>${tag(s.datum)} · ${ANZEIGE[s.art] ?? s.art}${s.art === "km" && s.km ? ` (${Number(s.km).toLocaleString("de-DE")} km)` : ""}</span><span class="klein">${s.beleg_mime ? `<a href="/konto/spesen/beleg/${s.id}" target="_blank" rel="noopener">📎 Beleg</a>` : "⚠️ ohne Beleg"}${s.notiz ? ` · ${escape(s.notiz)}` : ""}</span></div><strong>${euro(Number(s.betrag))}</strong></li>`).join("")}</ul></section>`; }).join("")}
${o.darfAendern && offen.length ? `<div class="stunden-knoepfe"><button name="aktion" value="freigeben">✓ Ausgewählte freigeben</button><button name="aktion" value="ablehnen" class="zweit">✕ Ablehnen</button></div>` : ""}</form>` : `<p class="treffer-leer">Keine Spesen in diesem Monat.</p>`}`;
}

export async function spesen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const beleg = url.pathname.match(/^\/konto\/spesen\/beleg\/([0-9a-f-]{36})$/);
  if (url.pathname !== "/konto/spesen" && !beleg) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  if (beleg) {
    // Office or the staff member themselves (RLS decides whether the row is visible).
    const r = await db<Spese[]>(f.s, env, `spesen?id=eq.${beleg[1]}&firma_id=eq.${firma}&select=id,beleg_mime`);
    const x = r.ok ? r.daten[0] : undefined;
    const obj = x?.beleg_mime ? await env.DATEN?.get(belegSchluessel(firma, x.id)) : null;
    if (!x || !obj) return new Response("Nicht gefunden", { status: 404 });
    const h = new Headers({ "content-type": x.beleg_mime!, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    for (const c of f.s.cookies) h.append("set-cookie", c);
    return new Response(obj.body, { headers: h });
  }
  const antwort = (t: string, status = 200) => html(seite("Spesen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich#spesen", f.s.cookies);
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monatWahl = (v: string | null) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v ?? "") ? v! : heute.slice(0, 7);
  if (request.method === "POST") {
    const form = await request.formData();
    const monat = monatWahl(String(form.get("monat") ?? ""));
    const zurueck = (h: string) => weiterleiten(`/konto/spesen?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Freigeben dürfen Bearbeiter, Standortleitungen und Admins.");
    const ids = form.getAll("id").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500), aktion = String(form.get("aktion") ?? "");
    if (!ids.length || !["freigeben", "ablehnen"].includes(aktion)) return zurueck("Bitte mindestens einen Beleg auswählen.");
    const r = await db<{ id: string }[]>(f.s, env, `spesen?firma_id=eq.${firma}&id=in.(${ids.join(",")})&status=eq.erfasst&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: aktion === "freigeben" ? "freigegeben" : "abgelehnt", freigegeben_von: f.s.userId, freigegeben_am: new Date().toISOString() }) });
    return zurueck(r.ok && r.daten.length ? `${r.daten.length} ${r.daten.length === 1 ? "Beleg" : "Belege"} ${aktion === "freigeben" ? "freigegeben" : "abgelehnt"}.` : "Nichts geändert.");
  }
  const monat = monatWahl(url.searchParams.get("monat"));
  const [l, p] = await Promise.all([
    db<Spese[]>(f.s, env, `spesen?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,art,betrag,km,vma,mahlzeiten,notiz,beleg_mime,status&order=datum&limit=5000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=3000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${spesenSeite(l.ok ? l.daten : [], p.ok ? p.daten : [], { monat, darfAendern })}`);
}
