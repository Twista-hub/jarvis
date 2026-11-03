// Idea 21 (docs/ideen-arbeitsoberflaeche.md): company receipts by photo. The office photographs a receipt (fuel, material,
// rent …), enters date, supplier, gross amount and VAT rate; Jarvis sums per month and exports a CSV for the tax adviser.
// Jarvis gives no tax advice: category and VAT rate are what the firm enters. Finance access only (RLS on public.belege).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { naechsterMonat, vorMonat } from "./stunden.ts";

export type Beleg = { id: string; datum: string; lieferant: string; kategorie: string; brutto: number | string; ust_satz: number | string; notiz: string; beleg_mime: string | null };
export const KATEGORIEN: Record<string, string> = { material: "🔩 Material & Waren", fahrzeug: "🚐 Fahrzeug & Tanken", buero: "🖇️ Büro & Software", miete: "🏠 Miete & Nebenkosten", versicherung: "🛡️ Versicherung", telefon: "📞 Telefon & Internet", reise: "🚆 Reise & Übernachtung", personal: "👷 Personal (Fremdleistung, Schulung)", sonstiges: "📦 Sonstiges" };
const SAETZE = [19, 7, 0];
const TYPEN = ["application/pdf", "image/png", "image/jpeg"];
const passt = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;
export const dateiSchluessel = (firma: string, id: string) => `belege/${firma}/${id}`;
const rund = (n: number) => Math.round(n * 100) / 100;
/** VAT contained in a gross amount (e.g. 119 € at 19 % → 19 €). */
export const ustAus = (brutto: number, satz: number) => rund(brutto * satz / (100 + satz));
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Sums per category and per VAT rate (gross, VAT, net). */
export function summen(liste: Beleg[]) {
  const z = (l: Beleg[]) => { const brutto = rund(l.reduce((n, b) => n + Number(b.brutto), 0)), ust = rund(l.reduce((n, b) => n + ustAus(Number(b.brutto), Number(b.ust_satz)), 0)); return { anzahl: l.length, brutto, ust, netto: rund(brutto - ust) }; };
  return {
    gesamt: z(liste),
    kategorien: Object.keys(KATEGORIEN).map((k) => ({ k, ...z(liste.filter((b) => b.kategorie === k)) })).filter((x) => x.anzahl),
    saetze: SAETZE.map((s) => ({ s, ...z(liste.filter((b) => Number(b.ust_satz) === s)) })).filter((x) => x.anzahl),
  };
}

/** CSV for the tax adviser: semicolons, decimal comma, BOM for German Excel; text cells starting with = + - @ get an apostrophe. */
export function belegeCsv(liste: Beleg[]): string {
  const zahl = (n: number) => n.toFixed(2).replace(".", ",");
  const text = (v: string) => { const t = /^[=+\-@]/.test(v) ? `'${v}` : v; return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const kopf = ["Datum", "Lieferant", "Kategorie", "Brutto", "USt-Satz", "USt", "Netto", "Notiz", "Beleg"];
  const zeilen = [...liste].sort((a, b) => a.datum.localeCompare(b.datum)).map((b) => {
    const brutto = Number(b.brutto), satz = Number(b.ust_satz), ust = ustAus(brutto, satz);
    return [tag(b.datum), text(b.lieferant), text((KATEGORIEN[b.kategorie] ?? b.kategorie).replace(/^\S+\s/, "")), zahl(brutto), `${satz} %`, zahl(ust), zahl(rund(brutto - ust)), text(b.notiz), b.beleg_mime ? "ja" : "nein"].join(";");
  });
  return "﻿" + [kopf.join(";"), ...zeilen].join("\r\n") + "\r\n";
}

export function belegeSeite(liste: Beleg[], o: { monat: string; heute: string }): string {
  const s = summen(liste);
  const tabelle = (titel: string, z: { name: string; anzahl: number; brutto: number; ust: number; netto: number }[]) => `<h3>${titel}</h3><table class="tabelle"><thead><tr><th></th><th>Belege</th><th>Brutto</th><th>USt</th><th>Netto</th></tr></thead><tbody>${z.map((x) => `<tr><td>${x.name}</td><td>${x.anzahl}</td><td>${euro(x.brutto)}</td><td>${euro(x.ust)}</td><td>${euro(x.netto)}</td></tr>`).join("")}</tbody></table>`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/belege?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${monatName(o.monat)}</strong><a class="knopf zweit" href="/konto/belege?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
<p class="klein">Firmenbelege (Tanken, Material, Miete …) per Foto erfassen. Am Monatsende die Liste als CSV an die Steuerberatung geben. Kategorie und Steuersatz trägst du ein; Jarvis gibt keine Steuerberatung. Mitarbeiter-Auslagen laufen weiter über <a href="/konto/spesen">Spesen</a>.</p>
<details class="termin-neu"${liste.length ? "" : " open"}><summary>📸 Beleg erfassen</summary><form method="post" action="/konto/belege" enctype="multipart/form-data"><input type="hidden" name="monat" value="${o.monat}"><div class="aueg-form">
<label>Datum<input type="date" name="datum" required value="${o.heute}" max="${o.heute}"></label><label>Lieferant<input name="lieferant" maxlength="160" required placeholder="z. B. Aral, Würth"></label>
<label>Betrag brutto (€)<input name="brutto" inputmode="decimal" required maxlength="12" placeholder="z. B. 59,90"></label><label>USt-Satz<select name="ust_satz">${SAETZE.map((x) => `<option value="${x}">${x} %</option>`).join("")}</select></label>
<label>Kategorie<select name="kategorie">${Object.entries(KATEGORIEN).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label><label>Notiz<input name="notiz" maxlength="300"></label>
<label class="ganz">Beleg (Foto oder PDF bis 5 MB)<input type="file" name="beleg" accept="image/jpeg,image/png,application/pdf" capture="environment"></label></div><button>Speichern</button></form></details>
${liste.length ? `<p class="gewerk-zahlen"><span><strong>${euro(s.gesamt.brutto)}</strong> brutto</span> <span><strong>${euro(s.gesamt.ust)}</strong> Vorsteuer laut Eingabe</span> <span><strong>${s.gesamt.anzahl}</strong> Belege</span></p>
<p><a class="knopf" href="/konto/belege.csv?monat=${o.monat}" download>📤 CSV für die Steuerberatung</a></p>
<ul class="kontakt-liste">${liste.map((b) => `<li><div><strong>${tag(b.datum)} · ${escape(b.lieferant)}</strong><span class="klein">${KATEGORIEN[b.kategorie] ?? escape(b.kategorie)} · ${Number(b.ust_satz)} % USt${b.notiz ? ` · ${escape(b.notiz)}` : ""} · ${b.beleg_mime ? `<a href="/konto/belege/${b.id}" target="_blank" rel="noopener">📎 Beleg</a>` : "⚠️ ohne Beleg"}</span></div><span class="knopf-zeile"><strong>${euro(Number(b.brutto))}</strong><form method="post" action="/konto/belege"><input type="hidden" name="monat" value="${o.monat}"><input type="hidden" name="weg" value="${b.id}"><button class="zweit" aria-label="Beleg löschen">✕</button></form></span></li>`).join("")}</ul>
${tabelle("Nach Kategorie", s.kategorien.map((x) => ({ ...x, name: KATEGORIEN[x.k] })))}${tabelle("Nach Steuersatz", s.saetze.map((x) => ({ ...x, name: `${x.s} %` })))}` : `<p class="treffer-leer">Keine Belege in diesem Monat.</p>`}`;
}

export async function belege(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const datei = url.pathname.match(/^\/konto\/belege\/([0-9a-f-]{36})$/);
  const csv = url.pathname === "/konto/belege.csv";
  if (url.pathname !== "/konto/belege" && !datei && !csv) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Belege", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen || !["inhaber", "admin", "bearbeiter"].includes(f.m.rolle)) return antwort("<p>Belege sehen Personen mit Finanzfreigabe.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monatWahl = (v: string | null) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v ?? "") ? v! : heute.slice(0, 7);
  const kopf = (h: Record<string, string>) => { const x = new Headers(h); for (const c of f.s.cookies) x.append("set-cookie", c); return x; };
  if (datei) {
    const r = await db<Beleg[]>(f.s, env, `belege?id=eq.${datei[1]}&firma_id=eq.${firma}&select=id,beleg_mime`);
    const x = r.ok ? r.daten[0] : undefined;
    const obj = x?.beleg_mime ? await env.DATEN?.get(dateiSchluessel(firma, x.id)) : null;
    if (!x || !obj) return new Response("Nicht gefunden", { status: 404 });
    return new Response(obj.body, { headers: kopf({ "content-type": x.beleg_mime!, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }) });
  }
  const laden = (monat: string) => db<Beleg[]>(f.s, env, `belege?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,datum,lieferant,kategorie,brutto,ust_satz,notiz,beleg_mime&order=datum.desc,erstellt.desc&limit=5000`);
  if (csv) {
    const monat = monatWahl(url.searchParams.get("monat"));
    const l = await laden(monat);
    return new Response(belegeCsv(l.ok ? l.daten : []), { headers: kopf({ "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="belege-${monat}.csv"`, "cache-control": "private, no-store" }) });
  }
  if (request.method === "POST") {
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const monat = monatWahl(t("monat", 7));
    const zurueck = (h: string) => weiterleiten(`/konto/belege?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const weg = t("weg", 36);
    if (/^[0-9a-f-]{36}$/.test(weg)) {
      const r = await db<{ id: string }[]>(f.s, env, `belege?id=eq.${weg}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      if (r.ok && r.daten.length) await env.DATEN?.delete(dateiSchluessel(firma, weg));
      return zurueck(r.ok && r.daten.length ? "Beleg gelöscht." : "Löschen hat nicht geklappt.");
    }
    const brutto = Number(t("brutto", 14).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const datum = t("datum", 10), satz = Number(t("ust_satz", 2)), lieferant = t("lieferant", 160);
    if (!Number.isFinite(brutto) || brutto <= 0 || brutto > 1_000_000) return zurueck("Bitte einen Betrag über 0 € angeben.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum > heute || datum < `${Number(heute.slice(0, 4)) - 2}-01-01`) return zurueck("Bitte ein Datum bis heute wählen (höchstens zwei Jahre zurück).");
    if (!lieferant) return zurueck("Bitte den Lieferanten angeben.");
    const id = crypto.randomUUID();
    const b = form.get("beleg");
    let mime: string | null = null, bytes: Uint8Array | null = null;
    if (b && typeof b !== "string" && b.size) {
      bytes = new Uint8Array(await b.arrayBuffer());
      if (b.size > 5 * 1024 * 1024 || !TYPEN.includes(b.type) || !passt(bytes, b.type)) return zurueck("Beleg bitte als Foto (JPG/PNG) oder PDF bis 5 MB.");
      mime = b.type;
      await env.DATEN?.put(dateiSchluessel(firma, id), bytes, { httpMetadata: { contentType: mime } });
    }
    const kategorie = t("kategorie", 20);
    const r = await db(f.s, env, "belege", { method: "POST", body: JSON.stringify({ id, firma_id: firma, datum, lieferant, kategorie: kategorie in KATEGORIEN ? kategorie : "sonstiges", brutto: rund(brutto), ust_satz: SAETZE.includes(satz) ? satz : 19, notiz: t("notiz", 300), beleg_mime: mime }) });
    if (!r.ok && bytes) await env.DATEN?.delete(dateiSchluessel(firma, id));
    return weiterleiten(`/konto/belege?monat=${datum.slice(0, 7)}&hinweis=${encodeURIComponent(r.ok ? `${euro(rund(brutto))} von ${lieferant} gespeichert.` : "Speichern hat nicht geklappt.")}`, f.s.cookies);
  }
  const monat = monatWahl(url.searchParams.get("monat"));
  const l = await laden(monat);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${belegeSeite(l.ok ? l.daten : [], { monat, heute })}`);
}
