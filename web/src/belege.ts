// Idea 21 (docs/ideen-arbeitsoberflaeche.md): company receipts by photo. The office photographs a receipt (fuel, material,
// rent …), enters date, supplier, gross amount and VAT rate; Jarvis sums per month and exports a CSV for the tax adviser.
// Jarvis gives no tax advice: category and VAT rate are what the firm enters. Finance access only (RLS on public.belege).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { naechsterMonat, vorMonat } from "./stunden.ts";
import { buchungenAus, buchungsstapel, cp1252, fehltDatev, LOHNARTEN, type DatevEinstellung, type Lohnarten } from "./datev.ts";
import type { Rechnung } from "./rechnungen.ts";
import { belegLesen, type Gelesen } from "./belegleser.ts";
import type { KiEnv } from "./api-budget.ts";

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

export type DatevTeil = { e: DatevEinstellung; lohnarten: Lohnarten; admin: boolean };
/** DATEV export and settings (settings only for admins; numbers come from the tax adviser and payroll office). */
export function datevTeil(d: DatevTeil, monat: string): string {
  const fehlt = fehltDatev(d.e);
  const form = d.admin ? `<details class="termin-neu"${fehlt.length ? " open" : ""}><summary>⚙️ DATEV-Einstellungen</summary><form method="post" action="/konto/belege"><input type="hidden" name="aktion" value="datev"><input type="hidden" name="monat" value="${monat}"><div class="aueg-form">
<label>Beraternummer<input name="berater" inputmode="numeric" pattern="\\d{4,7}" maxlength="7" value="${escape(d.e.berater)}"></label><label>Mandantennummer<input name="mandant" inputmode="numeric" pattern="\\d{1,5}" maxlength="5" value="${escape(d.e.mandant)}"></label>
<label>Kontenrahmen<select name="skr">${(["03", "04"] as const).map((k) => `<option value="${k}"${d.e.skr === k ? " selected" : ""}>SKR ${k}</option>`).join("")}</select></label><label>Wirtschaftsjahr beginnt im Monat<input name="wj" type="number" min="1" max="12" value="${d.e.wjBeginn}"></label>
${Object.entries(LOHNARTEN).map(([k, t]) => `<label>Lohnart ${t}<input name="la_${k}" inputmode="numeric" pattern="\\d{1,4}" maxlength="4" value="${escape(d.lohnarten[k as keyof Lohnarten] ?? "")}" placeholder="leer = nicht übertragen"></label>`).join("")}</div>
<button>Speichern</button><p class="klein">Berater- und Mandantennummer und die Lohnarten bekommst du vom Steuer- bzw. Lohnbüro.</p></form></details>` : "";
  return `<h2>📤 DATEV</h2>${fehlt.length ? `<p class="hinweis">Für den DATEV-Export fehlt: ${fehlt.join(", ")}${d.admin ? " (unten eintragen)" : " – trägt ein Admin unter „DATEV-Einstellungen“ ein"}.</p>` : `<p><a class="knopf" href="/konto/belege/datev.csv?monat=${monat}" download>📤 DATEV-Buchungsstapel (Rechnungen + Belege)</a></p>`}
<p class="klein">Buchungsstapel im DATEV-Format mit den Rechnungen und Belegen dieses Monats, SKR ${d.e.skr}. Die Konten sind ein <strong>Vorschlag</strong> (Sammeldebitor 10000, Sammelkreditor 70000, Erlöse ${d.e.skr === "03" ? "8400" : "4400"}); buchen und prüfen macht das Steuerbüro. Lohndaten für LODAS gibt es unter <a href="/konto/stunden">Stundenzettel</a>. <strong>Zugang fürs Steuerbüro:</strong> unter <a href="/konto/team">Firma &amp; Team</a> als „Leser“ mit Finanzfreigabe einladen (kostenlos) – dann sieht es Rechnungen und Belege und lädt alles selbst herunter, ändern kann es nichts.</p>${form}`;
}

export type Vorschlag = { g: Gelesen | null; dateiId: string; mime: string };
export function belegeSeite(liste: Beleg[], o: { monat: string; heute: string; nurLesen?: boolean; datev?: DatevTeil; vorschlag?: Vorschlag; kiAn?: boolean }): string {
  const v = o.vorschlag, g = v?.g;
  const wert = (x: string | number | undefined) => x === undefined || x === "" || x === 0 ? "" : escape(String(x));
  const s = summen(liste);
  const tabelle = (titel: string, z: { name: string; anzahl: number; brutto: number; ust: number; netto: number }[]) => `<h3>${titel}</h3><table class="tabelle"><thead><tr><th></th><th>Belege</th><th>Brutto</th><th>USt</th><th>Netto</th></tr></thead><tbody>${z.map((x) => `<tr><td>${x.name}</td><td>${x.anzahl}</td><td>${euro(x.brutto)}</td><td>${euro(x.ust)}</td><td>${euro(x.netto)}</td></tr>`).join("")}</tbody></table>`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/belege?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${monatName(o.monat)}</strong><a class="knopf zweit" href="/konto/belege?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
<p class="klein">Firmenbelege (Tanken, Material, Miete …) per Foto erfassen. Am Monatsende die Liste als CSV an die Steuerberatung geben. Kategorie und Steuersatz trägst du ein; Jarvis gibt keine Steuerberatung. Mitarbeiter-Auslagen laufen weiter über <a href="/konto/spesen">Spesen</a>.</p>
${o.nurLesen ? "" : `<details class="termin-neu"${liste.length && !v ? "" : " open"}><summary>📸 Beleg erfassen</summary>
${o.kiAn && !v ? `<form method="post" action="/konto/belege" enctype="multipart/form-data" class="formular-zeile"><input type="hidden" name="aktion" value="lesen"><input type="hidden" name="monat" value="${o.monat}"><label>Foto oder PDF<input type="file" name="beleg" required accept="image/jpeg,image/png,application/pdf" capture="environment"></label><button>🤖 Auslesen lassen</button></form><p class="klein">Jarvis liest Datum, Lieferant, Betrag, Steuersatz und Kategorie vor, du prüfst und speicherst. Oder unten alles selbst eintragen.</p>` : ""}
${v ? `<p class="${g?.sicher ? "hinweis ok" : "hinweis"}">${g ? g.sicher ? "🤖 Vorschlag aus dem Foto – bitte kurz prüfen." : "🤖 Teilweise lesbar – bitte die leeren oder falschen Felder ergänzen." : "🤖 Das Foto konnte nicht gelesen werden – bitte selbst eintragen."}${g?.gemischt ? " Der Beleg hat mehrere Steuersätze; eingetragen ist der größte Anteil – ggf. als zwei Belege erfassen." : ""}</p>` : ""}
<form method="post" action="/konto/belege" enctype="multipart/form-data"><input type="hidden" name="monat" value="${o.monat}">${v ? `<input type="hidden" name="datei_id" value="${v.dateiId}"><input type="hidden" name="datei_mime" value="${escape(v.mime)}">` : ""}<div class="aueg-form">
<label>Datum<input type="date" name="datum" required value="${g?.datum || o.heute}" max="${o.heute}"></label><label>Lieferant<input name="lieferant" maxlength="160" required placeholder="z. B. Aral, Würth" value="${wert(g?.lieferant)}"></label>
<label>Betrag brutto (€)<input name="brutto" inputmode="decimal" required maxlength="12" placeholder="z. B. 59,90" value="${g?.brutto ? g.brutto.toFixed(2).replace(".", ",") : ""}"></label><label>USt-Satz<select name="ust_satz">${SAETZE.map((x) => `<option value="${x}"${g && g.ust_satz === x ? " selected" : ""}>${x} %</option>`).join("")}</select></label>
<label>Kategorie<select name="kategorie">${Object.entries(KATEGORIEN).map(([k, t]) => `<option value="${k}"${g?.kategorie === k ? " selected" : ""}>${t}</option>`).join("")}</select></label><label>Notiz<input name="notiz" maxlength="300"></label>
${v ? `<p class="klein ganz">📎 Foto ist angehängt.</p>` : `<label class="ganz">Beleg (Foto oder PDF bis 5 MB)<input type="file" name="beleg" accept="image/jpeg,image/png,application/pdf" capture="environment"></label>`}</div><button>Speichern</button></form></details>`}
${liste.length ? `<p class="gewerk-zahlen"><span><strong>${euro(s.gesamt.brutto)}</strong> brutto</span> <span><strong>${euro(s.gesamt.ust)}</strong> Vorsteuer laut Eingabe</span> <span><strong>${s.gesamt.anzahl}</strong> Belege</span></p>
<p><a class="knopf" href="/konto/belege.csv?monat=${o.monat}" download>📤 CSV für die Steuerberatung</a></p>
<ul class="kontakt-liste">${liste.map((b) => `<li><div><strong>${tag(b.datum)} · ${escape(b.lieferant)}</strong><span class="klein">${KATEGORIEN[b.kategorie] ?? escape(b.kategorie)} · ${Number(b.ust_satz)} % USt${b.notiz ? ` · ${escape(b.notiz)}` : ""} · ${b.beleg_mime ? `<a href="/konto/belege/${b.id}" target="_blank" rel="noopener">📎 Beleg</a>` : "⚠️ ohne Beleg"}</span></div><span class="knopf-zeile"><strong>${euro(Number(b.brutto))}</strong>${o.nurLesen ? "" : `<form method="post" action="/konto/belege"><input type="hidden" name="monat" value="${o.monat}"><input type="hidden" name="weg" value="${b.id}"><button class="zweit" aria-label="Beleg löschen">✕</button></form>`}</span></li>`).join("")}</ul>
${tabelle("Nach Kategorie", s.kategorien.map((x) => ({ ...x, name: KATEGORIEN[x.k] })))}${tabelle("Nach Steuersatz", s.saetze.map((x) => ({ ...x, name: `${x.s} %` })))}` : `<p class="treffer-leer">Keine Belege in diesem Monat.</p>`}${o.datev ? datevTeil(o.datev, o.monat) : ""}`;
}

export async function belege(request: Request, env: KontoEnv & Partial<KiEnv>): Promise<Response | null> {
  const url = new URL(request.url);
  const datei = url.pathname.match(/^\/konto\/belege\/([0-9a-f-]{36})$/);
  const csv = url.pathname === "/konto/belege.csv", datevCsv = url.pathname === "/konto/belege/datev.csv";
  if (url.pathname !== "/konto/belege" && !datei && !csv && !datevCsv) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Belege", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen || !["inhaber", "admin", "bearbeiter", "leser"].includes(f.m.rolle)) return antwort("<p>Belege sehen Personen mit Finanzfreigabe.</p>", 403);
  const nurLesen = f.m.rolle === "leser"; // tax adviser: read and download only
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
  const datevLaden = async (): Promise<{ e: DatevEinstellung; lohnarten: Lohnarten }> => {
    const r = await db<{ datev_berater: string; datev_mandant: string; datev_skr: "03" | "04"; datev_wj_beginn: number; kleinunternehmer: boolean; lohnarten: Lohnarten }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=datev_berater,datev_mandant,datev_skr,datev_wj_beginn,kleinunternehmer,lohnarten`);
    const x = r.ok ? r.daten[0] : undefined;
    return { e: { berater: x?.datev_berater ?? "", mandant: x?.datev_mandant ?? "", skr: x?.datev_skr ?? "03", wjBeginn: x?.datev_wj_beginn ?? 1, kleinunternehmer: !!x?.kleinunternehmer }, lohnarten: x?.lohnarten ?? {} };
  };
  if (datevCsv) {
    const monat = monatWahl(url.searchParams.get("monat"));
    const [d, l, r, k] = await Promise.all([
      datevLaden(), laden(monat),
      db<(Pick<Rechnung, "nummer" | "datum" | "netto" | "ust_satz" | "ust_betrag" | "kleinunternehmer" | "art" | "bezug_nummer"> & { kunde_id: string | null })[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&status=eq.ausgestellt&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=nummer,datum,netto,ust_satz,ust_betrag,kleinunternehmer,art,bezug_nummer,kunde_id&limit=5000`),
      db<{ id: string; name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&limit=1000`),
    ]);
    if (fehltDatev(d.e).length) return weiterleiten(`/konto/belege?monat=${monat}&hinweis=${encodeURIComponent("Bitte zuerst die DATEV-Einstellungen ausfüllen.")}`, f.s.cookies);
    const rechnungen = r.ok ? r.daten : [], kunden = k.ok ? k.daten : [];
    const kundeName = (x: Pick<Rechnung, "nummer">) => kunden.find((c) => c.id === rechnungen.find((y) => y.nummer === x.nummer)?.kunde_id)?.name ?? "";
    const text = buchungsstapel(d.e, monat, buchungenAus(rechnungen, l.ok ? l.daten : [], d.e, kundeName));
    return new Response(cp1252(text), { headers: kopf({ "content-type": "text/csv; charset=windows-1252", "content-disposition": `attachment; filename="EXTF_Buchungsstapel_${monat}.csv"`, "cache-control": "private, no-store" }) });
  }
  if (csv) {
    const monat = monatWahl(url.searchParams.get("monat"));
    const l = await laden(monat);
    return new Response(belegeCsv(l.ok ? l.daten : []), { headers: kopf({ "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="belege-${monat}.csv"`, "cache-control": "private, no-store" }) });
  }
  if (request.method === "POST" && nurLesen) return antwort("<p>Mit Leserechten kannst du Belege nur ansehen und herunterladen.</p>", 403);
  if (request.method === "POST") {
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const monat = monatWahl(t("monat", 7));
    const zurueck = (h: string) => weiterleiten(`/konto/belege?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (t("aktion", 10) === "datev") {
      if (!f.admin) return zurueck("DATEV-Einstellungen ändern Inhaber und Admins.");
      const lohnarten = Object.fromEntries(Object.keys(LOHNARTEN).map((k) => [k, t(`la_${k}`, 4)]).filter(([, v]) => /^\d{1,4}$/.test(v)));
      const daten = { firma_id: firma, datev_berater: t("berater", 7), datev_mandant: t("mandant", 5), datev_skr: t("skr", 2) === "04" ? "04" : "03", datev_wj_beginn: Math.min(12, Math.max(1, Number(t("wj", 2)) || 1)), lohnarten };
      if (!/^(\d{4,7})?$/.test(daten.datev_berater) || !/^(\d{1,5})?$/.test(daten.datev_mandant)) return zurueck("Beraternummer 4–7 Ziffern, Mandantennummer 1–5 Ziffern.");
      const r = await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify(daten) });
      return zurueck(r.ok ? "DATEV-Einstellungen gespeichert." : "Speichern hat nicht geklappt.");
    }
    const kiAn = !!(env.ANTHROPIC_API_KEY && env.HYPERDRIVE);
    if (t("aktion", 10) === "lesen") {
      const b = form.get("beleg");
      if (!b || typeof b === "string" || !b.size) return zurueck("Bitte ein Foto oder PDF auswählen.");
      const bytes = new Uint8Array(await b.arrayBuffer());
      if (b.size > 5 * 1024 * 1024 || !TYPEN.includes(b.type) || !passt(bytes, b.type)) return zurueck("Beleg bitte als Foto (JPG/PNG) oder PDF bis 5 MB.");
      const dateiId = crypto.randomUUID();
      await env.DATEN?.put(dateiSchluessel(firma, dateiId), bytes, { httpMetadata: { contentType: b.type } });
      const g = kiAn ? await belegLesen(env as KiEnv, bytes, b.type, firma, heute).catch(() => null) : null;
      const l = await laden(monat);
      return antwort(belegeSeite(l.ok ? l.daten : [], { monat, heute, kiAn, vorschlag: { g, dateiId, mime: b.type } }));
    }
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
    const dateiId = t("datei_id", 36), dateiMime = t("datei_mime", 20);
    const vorhanden = /^[0-9a-f-]{36}$/.test(dateiId) && TYPEN.includes(dateiMime) && !!(await env.DATEN?.head(dateiSchluessel(firma, dateiId)));
    const id = vorhanden ? dateiId : crypto.randomUUID();
    const b = form.get("beleg");
    let mime: string | null = vorhanden ? dateiMime : null, bytes: Uint8Array | null = null;
    if (!vorhanden && b && typeof b !== "string" && b.size) {
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
  const d = await datevLaden();
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${belegeSeite(l.ok ? l.daten : [], { monat, heute, nurLesen, kiAn: !!(env.ANTHROPIC_API_KEY && env.HYPERDRIVE), datev: { ...d, admin: f.admin } })}`);
}
