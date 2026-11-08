// Idea 21 (docs/ideen-arbeitsoberflaeche.md): company receipts by photo. The office photographs a receipt (fuel, material,
// rent …), enters date, supplier, gross amount and VAT rate; Crewtender sums per month and exports a CSV for the tax adviser.
// Crewtender gives no tax advice: category and VAT rate are what the firm enters. Finance access only (RLS on public.belege).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";
import { naechsterMonat, vorMonat } from "./stunden.ts";
import { buchungenAus, buchungsstapel, cp1252, fehltDatev, LOHNARTEN, type DatevEinstellung, type Lohnarten } from "./datev.ts";
import type { Rechnung } from "./rechnungen.ts";
import { belegLesen, type Gelesen } from "./belegleser.ts";
import type { KiEnv } from "./api-budget.ts";
import { kiSperrText } from "./ki-fehler.ts";
import { belegWerte, eRechnungLesen, istXml, type ERechnung } from "./erechnung.ts";

export type Beleg = { id: string; datum: string; lieferant: string; kategorie: string; brutto: number | string; ust_satz: number | string; notiz: string; beleg_mime: string | null; storniert_am?: string | null; storno_grund?: string; brutto_7?: number | string | null; anlass?: string | null; teilnehmer?: string | null; zahlart?: string; reverse_charge?: boolean };
/** Cancelled receipts stay visible but count for nothing (GoBD, Rechtsprüfung 03.11.2026 S5). */
export const gueltig = (l: Beleg[]) => l.filter((b) => !b.storniert_am);
export const KATEGORIEN: Record<string, string> = { material: "🔩 Material & Waren", fahrzeug: "🚐 Fahrzeug & Tanken", buero: "🖇️ Büro & Software", miete: "🏠 Miete & Nebenkosten", versicherung: "🛡️ Versicherung", telefon: "📞 Telefon & Internet", reise: "🚆 Reise & Übernachtung", bewirtung: "🍽️ Bewirtung (Geschäftsessen)", arbeitskleidung: "👕 Arbeitskleidung & Schutzausrüstung", personal: "👷 Personal (Fremdleistung, Schulung)", sonstiges: "📦 Sonstiges" };
const SAETZE = [19, 7, 0];
const XML = "application/xml";
const TYPEN = ["application/pdf", "image/png", "image/jpeg", XML];
const passt = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : typ === XML ? istXml(b) : b[0] === 0xff && b[1] === 0xd8;
/** Upload type, with XML recognised by type or file name (browsers send text/xml, application/xml or nothing). */
export const dateiTyp = (b: { type: string; name?: string }) => /^(application|text)\/xml$/.test(b.type) || /\.xml$/i.test(b.name ?? "") ? XML : b.type;
const AUSWAHL = "image/jpeg,image/png,application/pdf,.xml,application/xml,text/xml";
/** Readable view of an e-invoice receipt (the XML stays the original; this is only a display). */
export function eRechnungAnsicht(r: ERechnung, id: string): string {
  const z = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2).replace(".", ",")} ${escape(r.waehrung)}` : "–");
  return `<h2><span>🧾 ${r.art === "gutschrift" ? "Gutschrift" : "E-Rechnung"}</span> <span>${escape(r.nummer)}</span></h2>
<p><strong>${escape(r.lieferant)}</strong>${r.ustId ? `<br><span class="klein"><span>USt-IdNr.</span> <span>${escape(r.ustId)}</span></span>` : ""}<br><span class="klein">${r.datum ? `Rechnungsdatum: ${tag(r.datum)}` : "Rechnungsdatum fehlt"}</span><br><span class="klein">${r.format === "UBL" ? "Format: XRechnung/Peppol (UBL)" : "Format: XRechnung/ZUGFeRD (CII)"}</span></p>
${r.posten.length ? `<table class="tabelle"><thead><tr><th>Position</th><th>Menge</th><th>Netto</th></tr></thead><tbody>${r.posten.map((p) => `<tr><td>${escape(p.name)}</td><td>${escape(p.menge)}</td><td>${z(p.netto)}</td></tr>`).join("")}</tbody></table>` : ""}
<table class="tabelle"><thead><tr><th>USt-Satz</th><th>Netto</th><th>USt</th></tr></thead><tbody>${r.steuern.map((t) => `<tr><td>${t.satz} %</td><td>${z(t.netto)}</td><td>${z(t.steuer)}</td></tr>`).join("")}</tbody></table>
<p class="gewerk-zahlen"><span><strong>${z(r.netto)}</strong> netto</span> <span><strong>${z(r.brutto)}</strong> brutto</span></p>
<p><a class="knopf zweit" href="/konto/belege/${id}?roh=1" download>⬇️ Original-XML herunterladen</a></p>
<p class="klein">Das Original ist die XML-Datei; diese Ansicht ist nur zum Lesen. Aufbewahrt wird die XML-Datei (GoBD).</p>`;
}
export const dateiSchluessel = (firma: string, id: string) => `belege/${firma}/${id}`;
const rund = (n: number) => Math.round(n * 100) / 100;
/** VAT contained in a gross amount (e.g. 119 € at 19 % → 19 €). */
export const ustAus = (brutto: number, satz: number) => rund(brutto * satz / (100 + satz));
type Saetze = Pick<Beleg, "brutto" | "ust_satz" | "brutto_7">;
/** Gross amount at 7 % contained in a mixed receipt (19 % and 7 %, Rechtsprüfung S20); 0 for a single-rate receipt. */
export const anteil7 = (b: Saetze) => { const brutto = Number(b.brutto), b7 = Number(b.brutto_7 ?? 0); return Number(b.ust_satz) === 19 && b7 > 0 && b7 <= brutto ? rund(b7) : 0; };
/** Parts of a receipt per VAT rate: one part, or 19 % and 7 % for a mixed receipt. */
export function teile(b: Saetze): { satz: number; brutto: number }[] {
  const brutto = Number(b.brutto), b7 = anteil7(b);
  return b7 ? [{ satz: 19, brutto: rund(brutto - b7) }, { satz: 7, brutto: b7 }].filter((x) => x.brutto > 0) : [{ satz: Number(b.ust_satz), brutto }];
}
/** VAT contained in a receipt, per rate for mixed receipts. */
export const ustBeleg = (b: Saetze) => rund(teile(b).reduce((n, x) => n + ustAus(x.brutto, x.satz), 0));
/** Simplified invoices (Kleinbetragsrechnung, § 33 UStDV) go up to 250 € gross; above that the full details of § 14 Abs. 4 UStG apply. */
export const KLEINBETRAG = 250;
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Sums per category and per VAT rate (gross, VAT, net). Input VAT counts only receipts with an uploaded file
 *  (Rechtsprüfung S9); the VAT of entries without a file is shown separately as not counted. */
export function summen(alle: Beleg[]) {
  const liste = gueltig(alle);
  const z = (l: Beleg[]) => { const brutto = rund(l.reduce((n, b) => n + Number(b.brutto), 0)), ust = rund(l.reduce((n, b) => n + ustBeleg(b), 0)); return { anzahl: l.length, brutto, ust, netto: rund(brutto - ust) }; };
  const satz = (s: number) => {
    const t = liste.map((b) => teile(b).find((x) => x.satz === s)).filter((x) => x !== undefined);
    const brutto = rund(t.reduce((n, x) => n + x.brutto, 0)), ust = rund(t.reduce((n, x) => n + ustAus(x.brutto, s), 0));
    return { anzahl: t.length, brutto, ust, netto: rund(brutto - ust) };
  };
  return {
    gesamt: z(liste),
    vorsteuer: rund(liste.filter((b) => b.beleg_mime).reduce((n, b) => n + ustBeleg(b), 0)),
    ohneBeleg: rund(liste.filter((b) => !b.beleg_mime).reduce((n, b) => n + ustBeleg(b), 0)),
    kategorien: Object.keys(KATEGORIEN).map((k) => ({ k, ...z(liste.filter((b) => b.kategorie === k)) })).filter((x) => x.anzahl),
    saetze: SAETZE.map((s) => ({ s, ...satz(s) })).filter((x) => x.anzahl),
  };
}

/** CSV for the tax adviser: semicolons, decimal comma, BOM for German Excel; text cells starting with = + - @ get an apostrophe. */
export function belegeCsv(liste: Beleg[]): string {
  const zahl = (n: number) => n.toFixed(2).replace(".", ",");
  const text = (v: string) => { const t = /^[=+\-@]/.test(v) ? `'${v}` : v; return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const kopf = ["Datum", "Lieferant", "Kategorie", "Brutto", "USt-Satz", "USt", "Netto", "Notiz", "Beleg", "davon Brutto zu 7 %", "Anlass der Bewirtung", "Teilnehmer der Bewirtung"];
  const zeilen = [...liste].sort((a, b) => a.datum.localeCompare(b.datum)).map((b) => {
    const brutto = Number(b.brutto), satz = Number(b.ust_satz), ust = ustBeleg(b), b7 = anteil7(b);
    return [tag(b.datum), text(b.lieferant), text((KATEGORIEN[b.kategorie] ?? b.kategorie).replace(/^\S+\s/, "")), zahl(brutto), `${satz} %`, zahl(ust), zahl(rund(brutto - ust)), text(b.notiz), b.beleg_mime ? "ja" : "nein", b7 ? zahl(b7) : "", text(b.anlass ?? ""), text(b.teilnehmer ?? "")].join(";");
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

export type Vorschlag = { g: Gelesen | null; dateiId: string; mime: string; sperre?: string | null; xml?: { nummer: string; brutto7: number | null; hinweise: string[] } };
export function belegeSeite(liste: Beleg[], o: { monat: string; heute: string; nurLesen?: boolean; datev?: DatevTeil; vorschlag?: Vorschlag; kiAn?: boolean }): string {
  const v = o.vorschlag, g = v?.g;
  const wert = (x: string | number | undefined) => x === undefined || x === "" || x === 0 ? "" : escape(String(x));
  const s = summen(liste);
  const tabelle = (titel: string, z: { name: string; anzahl: number; brutto: number; ust: number; netto: number }[]) => `<h3>${titel}</h3><table class="tabelle"><thead><tr><th></th><th>Belege</th><th>Brutto</th><th>USt</th><th>Netto</th></tr></thead><tbody>${z.map((x) => `<tr><td>${x.name}</td><td>${x.anzahl}</td><td>${euro(x.brutto)}</td><td>${euro(x.ust)}</td><td>${euro(x.netto)}</td></tr>`).join("")}</tbody></table>`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/belege?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${monatName(o.monat)}</strong><a class="knopf zweit" href="/konto/belege?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
<p class="klein">Firmenbelege (Tanken, Material, Miete …) per Foto erfassen. Am Monatsende die Liste als CSV an die Steuerberatung geben. Kategorie und Steuersatz trägst du ein; Crewtender gibt keine Steuerberatung. Mitarbeiter-Auslagen laufen weiter über <a href="/konto/spesen">Spesen</a>.</p>
${o.nurLesen ? "" : `<details class="termin-neu"${liste.length && !v ? "" : " open"}><summary>📸 Beleg erfassen</summary>
${!v ? `<form method="post" action="/konto/belege" enctype="multipart/form-data" class="formular-zeile"><input type="hidden" name="aktion" value="lesen"><input type="hidden" name="monat" value="${o.monat}"><label>${o.kiAn ? "Foto, PDF oder E-Rechnung (XML)" : "E-Rechnung (XML)"}<input type="file" name="beleg" required accept="${o.kiAn ? AUSWAHL : ".xml,application/xml,text/xml"}"></label><button>${o.kiAn ? "🤖 Auslesen lassen" : "🧾 E-Rechnung einlesen"}</button></form><p class="klein">${o.kiAn ? "Crewtender liest Datum, Lieferant, Betrag, Steuersatz und Kategorie vor, du prüfst und speicherst. Das Foto geht dafür an den KI-Dienst Claude (Anthropic, USA), der es nicht zum Training nutzt. " : ""}E-Rechnungen (XRechnung, ZUGFeRD, Factur-X als XML) liest Crewtender ohne KI direkt aus und bewahrt die XML-Datei als Beleg auf. Oder unten alles selbst eintragen.</p>` : ""}
${v?.xml ? `<p class="${g?.sicher ? "hinweis ok" : "hinweis"}">🧾 E-Rechnung gelesen – bitte Kategorie wählen und kurz prüfen.${v.xml.hinweise.map((h) => ` <span>${escape(h)}</span>`).join("")}</p>` : v ? `<p class="${g?.sicher ? "hinweis ok" : "hinweis"}">${g ? g.sicher ? "🤖 Vorschlag aus dem Foto – bitte kurz prüfen." : "🤖 Teilweise lesbar – bitte die leeren oder falschen Felder ergänzen." : v.sperre ? `🤖 ${escape(v.sperre)} Bitte den Beleg selbst eintragen.` : "🤖 Das Foto konnte nicht gelesen werden – bitte selbst eintragen."}${g?.gemischt ? ` <span>Der Beleg hat mehrere Steuersätze: Bei 19 % und 7 % bitte 19 % wählen und den Bruttoanteil zu 7 % unter „davon zu 7 %“ eintragen.</span>` : ""}</p>` : ""}
<form method="post" action="/konto/belege" enctype="multipart/form-data"><input type="hidden" name="monat" value="${o.monat}">${v ? `<input type="hidden" name="datei_id" value="${v.dateiId}"><input type="hidden" name="datei_mime" value="${escape(v.mime)}">` : ""}<div class="aueg-form">
<label>Datum<input type="date" name="datum" required value="${g?.datum || o.heute}" max="${o.heute}"></label><label>Lieferant<input name="lieferant" maxlength="160" required placeholder="z. B. Aral, Würth" value="${wert(g?.lieferant)}"></label>
<label>Betrag brutto (€)<input name="brutto" inputmode="decimal" required maxlength="12" placeholder="z. B. 59,90" value="${g?.brutto ? g.brutto.toFixed(2).replace(".", ",") : ""}"></label><label>USt-Satz<select name="ust_satz">${SAETZE.map((x) => `<option value="${x}"${g && g.ust_satz === x ? " selected" : ""}>${x} %</option>`).join("")}</select></label>
<label>davon zu 7 % (bei gemischten Belegen)<input name="brutto_7" inputmode="decimal" maxlength="12" placeholder="nur bei 19 % und 7 % auf einem Beleg" value="${v?.xml?.brutto7 ? v.xml.brutto7.toFixed(2).replace(".", ",") : ""}"></label><label>Kategorie<select name="kategorie">${Object.entries(KATEGORIEN).map(([k, t]) => `<option value="${k}"${g?.kategorie === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
<label class="beleg-bewirtung">Anlass der Bewirtung<input name="anlass" maxlength="300" placeholder="z. B. Angebotsbesprechung Objekt Hauptstraße"></label><label class="beleg-bewirtung">Teilnehmer (alle, auch Gastgeber)<input name="teilnehmer" maxlength="500" placeholder="z. B. A. Beispiel (Kunde GmbH), ich"></label>
<p class="klein ganz beleg-bewirtung">🍽️ Bei „Bewirtung“ sind Anlass und Teilnehmer Pflichtfelder.</p>
<label>Bezahlt<select name="zahlart"><option value="unbar">Überweisung, Karte, Lastschrift</option><option value="bar">Bar (Kasse)</option></select></label>
<label class="zeile ganz"><input type="checkbox" name="reverse_charge">Rechnung eines Lieferanten im Ausland ohne deutsche Umsatzsteuer (z. B. Software, Werbung): Steuerschuld geht auf uns über (§ 13b UStG). Dann USt-Satz 0 % wählen.</label><label class="ganz">Notiz<input name="notiz" maxlength="300" value="${v?.xml?.nummer ? escape(`Rechnung ${v.xml.nummer}`.slice(0, 300)) : ""}"></label>
${v ? `<p class="klein ganz">📎 ${v.mime === XML ? "E-Rechnung (XML) ist angehängt." : "Foto ist angehängt."}</p>` : `<label class="ganz">Beleg (Foto, PDF oder E-Rechnung bis 5 MB)<input type="file" name="beleg" accept="${AUSWAHL}"></label>`}</div><button>Speichern</button></form></details>`}
${liste.length ? `<p class="gewerk-zahlen"><span><strong>${euro(s.gesamt.brutto)}</strong> brutto</span> <span><strong>${euro(s.vorsteuer)}</strong> Vorsteuer laut Eingabe</span>${s.ohneBeleg ? ` <span><strong>${euro(s.ohneBeleg)}</strong> nicht als Vorsteuer gezählt (kein Beleg hochgeladen)</span>` : ""} <span><strong>${s.gesamt.anzahl}</strong> Belege</span></p>
<p><a class="knopf" href="/konto/belege.csv?monat=${o.monat}" download>📤 CSV für die Steuerberatung</a></p>
<ul class="kontakt-liste">${liste.map((b) => `<li><div><strong>${tag(b.datum)} · ${escape(b.lieferant)}</strong><span class="klein">${KATEGORIEN[b.kategorie] ?? escape(b.kategorie)} · ${Number(b.ust_satz)} % USt${b.reverse_charge ? " (§ 13b)" : ""}${b.zahlart === "bar" ? " · 💶 bar" : ""}${b.notiz ? ` · ${escape(b.notiz)}` : ""} · ${b.beleg_mime ? `<a href="/konto/belege/${b.id}" target="_blank" rel="noopener">📎 Beleg</a>` : "⚠️ ohne Beleg"}</span>${anteil7(b) ? `<span class="klein">${euro(anteil7(b))} davon zu 7 % USt</span>` : ""}${b.kategorie === "bewirtung" ? `<span class="klein">🍽️ <em>Anlass:</em> ${escape(b.anlass ?? "")} · <em>Teilnehmer:</em> ${escape(b.teilnehmer ?? "")}</span>` : ""}${!b.storniert_am && Number(b.brutto) > KLEINBETRAG ? `<span class="klein">⚠️ Über 250 €: Die Rechnung braucht u. a. Name und Anschrift des Empfängers, Steuernummer oder USt-IdNr. des Lieferanten und eine Rechnungsnummer (§ 14 Abs. 4 UStG) – bitte prüfen.</span>` : ""}</div><span class="knopf-zeile">${b.storniert_am ? `<s>${euro(Number(b.brutto))}</s> <span class="klein">↩︎ storniert${b.storno_grund ? `: ${escape(b.storno_grund)}` : ""}</span>` : `<strong>${euro(Number(b.brutto))}</strong>${o.nurLesen ? "" : `<details class="storno"><summary class="knopf zweit" aria-label="Beleg stornieren">↩︎</summary><form method="post" action="/konto/belege"><input type="hidden" name="monat" value="${o.monat}"><input type="hidden" name="storno" value="${b.id}"><label>Grund<input name="grund" required minlength="3" maxlength="300" placeholder="z. B. doppelt erfasst"></label><button class="zweit">Beleg stornieren</button><p class="klein">Belege werden nicht gelöscht (GoBD): Der Beleg bleibt mit Grund sichtbar, zählt aber nicht mehr für Vorsteuer und DATEV.</p></form></details>`}`}</span></li>`).join("")}</ul>
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
    if (x.beleg_mime === XML) {
      const roh = await obj.text();
      const e = url.searchParams.get("roh") ? null : eRechnungLesen(roh);
      if (e) return antwort(eRechnungAnsicht(e, x.id));
      return new Response(roh, { headers: kopf({ "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="e-rechnung-${x.id.slice(0, 8)}.xml"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" }) });
    }
    return new Response(obj.body, { headers: kopf({ "content-type": x.beleg_mime!, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }) });
  }
  const laden = (monat: string) => db<Beleg[]>(f.s, env, `belege?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,datum,lieferant,kategorie,brutto,ust_satz,brutto_7,anlass,teilnehmer,notiz,beleg_mime,storniert_am,storno_grund,zahlart,reverse_charge&order=datum.desc,erstellt.desc&limit=5000`);
  const datevLaden = async (): Promise<{ e: DatevEinstellung; lohnarten: Lohnarten }> => {
    const r = await db<{ datev_berater: string; datev_mandant: string; datev_skr: "03" | "04"; datev_wj_beginn: number; kleinunternehmer: boolean; lohnarten: Lohnarten }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=datev_berater,datev_mandant,datev_skr,datev_wj_beginn,kleinunternehmer,lohnarten`);
    const x = r.ok ? r.daten[0] : undefined;
    return { e: { berater: x?.datev_berater ?? "", mandant: x?.datev_mandant ?? "", skr: x?.datev_skr ?? "03", wjBeginn: x?.datev_wj_beginn ?? 1, kleinunternehmer: !!x?.kleinunternehmer }, lohnarten: x?.lohnarten ?? {} };
  };
  if (datevCsv) {
    const monat = monatWahl(url.searchParams.get("monat"));
    const [d, l, r, k] = await Promise.all([
      datevLaden(), laden(monat),
      db<(Pick<Rechnung, "nummer" | "datum" | "netto" | "ust_satz" | "ust_betrag" | "kleinunternehmer" | "art" | "bezug_nummer" | "reverse_charge"> & { kunde_id: string | null })[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&status=eq.ausgestellt&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=nummer,datum,netto,ust_satz,ust_betrag,kleinunternehmer,art,bezug_nummer,reverse_charge,kunde_id&limit=5000`),
      db<{ id: string; name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&limit=1000`),
    ]);
    if (fehltDatev(d.e).length) return weiterleiten(`/konto/belege?monat=${monat}&hinweis=${encodeURIComponent("Bitte zuerst die DATEV-Einstellungen ausfüllen.")}`, f.s.cookies);
    const rechnungen = r.ok ? r.daten : [], kunden = k.ok ? k.daten : [];
    const kundeName = (x: Pick<Rechnung, "nummer">) => kunden.find((c) => c.id === rechnungen.find((y) => y.nummer === x.nummer)?.kunde_id)?.name ?? "";
    const text = buchungsstapel(d.e, monat, buchungenAus(rechnungen, l.ok ? gueltig(l.daten) : [], d.e, kundeName));
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
      if (!b || typeof b === "string" || !b.size) return zurueck("Bitte ein Foto, PDF oder eine E-Rechnung auswählen.");
      const bytes = new Uint8Array(await b.arrayBuffer()), typ = dateiTyp(b);
      if (b.size > 5 * 1024 * 1024 || !TYPEN.includes(typ) || !passt(bytes, typ)) return zurueck("Beleg bitte als Foto (JPG/PNG), PDF oder E-Rechnung (XML) bis 5 MB.");
      // S11: e-invoices are read without AI; the XML file itself is the receipt.
      const e = typ === XML ? eRechnungLesen(new TextDecoder().decode(bytes)) : null;
      if (typ === XML && !e) return zurueck("Die XML-Datei ist keine lesbare E-Rechnung (XRechnung, ZUGFeRD oder Factur-X).");
      if (!e && !kiAn) return zurueck("Fotos und PDFs kann Crewtender gerade nicht auslesen. Bitte unten selbst eintragen.");
      const dateiId = crypto.randomUUID();
      await env.DATEN?.put(dateiSchluessel(firma, dateiId), bytes, { httpMetadata: { contentType: typ } });
      if (e) {
        const w = belegWerte(e);
        const l = await laden(monat);
        const g: Gelesen = { datum: w.datum, lieferant: w.lieferant, brutto: w.brutto, ust_satz: w.ust_satz, gemischt: false, kategorie: "", sicher: w.sicher };
        return antwort(belegeSeite(l.ok ? l.daten : [], { monat, heute, kiAn, vorschlag: { g, dateiId, mime: XML, xml: { nummer: e.nummer.slice(0, 80), brutto7: w.brutto_7, hinweise: w.hinweise } } }));
      }
      let sperre: string | null = null;
      const g = kiAn ? await belegLesen(env as KiEnv, bytes, b.type, firma, heute).catch((e) => { sperre = kiSperrText(e); return null; }) : null;
      const l = await laden(monat);
      return antwort(belegeSeite(l.ok ? l.daten : [], { monat, heute, kiAn, vorschlag: { g, dateiId, mime: b.type, sperre } }));
    }
    const storno = t("storno", 36);
    if (/^[0-9a-f-]{36}$/.test(storno)) {
      const r = await db<boolean>(f.s, env, "rpc/beleg_stornieren", { method: "POST", body: JSON.stringify({ b: storno, grund: t("grund", 300) }) });
      return zurueck(r.ok ? (r.daten ? "Beleg storniert." : "Der Beleg war schon storniert.") : /"message":"([^"]+)"/.exec(r.fehler)?.[1] ?? "Stornieren hat nicht geklappt.");
    }
    const betrag = (k: string) => Number(t(k, 14).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const brutto = betrag("brutto");
    const datum = t("datum", 10), satzRoh = Number(t("ust_satz", 2)), lieferant = t("lieferant", 160);
    const satz = SAETZE.includes(satzRoh) ? satzRoh : 19;
    if (!Number.isFinite(brutto) || brutto <= 0 || brutto > 1_000_000) return zurueck("Bitte einen Betrag über 0 € angeben.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum > heute || datum < `${Number(heute.slice(0, 4)) - 2}-01-01`) return zurueck("Bitte ein Datum bis heute wählen (höchstens zwei Jahre zurück).");
    if (!lieferant) return zurueck("Bitte den Lieferanten angeben.");
    // S20: optional gross part at 7 % on a mixed receipt (only together with 19 %).
    const brutto7 = t("brutto_7", 14) ? rund(betrag("brutto_7")) : null;
    if (brutto7 !== null && satz !== 19) return zurueck("Den Anteil zu 7 % bitte nur bei USt-Satz 19 % eintragen.");
    if (brutto7 !== null && (!Number.isFinite(brutto7) || brutto7 <= 0 || brutto7 > rund(brutto))) return zurueck("Der Anteil zu 7 % muss über 0 € liegen und darf den Gesamtbetrag nicht übersteigen.");
    // S10: business meals need occasion and participants (§ 4 Abs. 5 Nr. 2 EStG); the database checks this too.
    const kategorieRoh = t("kategorie", 20), kategorie = Object.hasOwn(KATEGORIEN, kategorieRoh) ? kategorieRoh : "sonstiges";
    const bewirtung = kategorie === "bewirtung", anlass = bewirtung ? t("anlass", 300) : "", teilnehmer = bewirtung ? t("teilnehmer", 500) : "";
    if (bewirtung && (!anlass || !teilnehmer)) return zurueck("Bei Bewirtung bitte Anlass und Teilnehmer angeben.");
    const dateiId = t("datei_id", 36), dateiMime = t("datei_mime", 20);
    const vorhanden = /^[0-9a-f-]{36}$/.test(dateiId) && TYPEN.includes(dateiMime) && !!(await env.DATEN?.head(dateiSchluessel(firma, dateiId)));
    const id = vorhanden ? dateiId : crypto.randomUUID();
    const b = form.get("beleg");
    let mime: string | null = vorhanden ? dateiMime : null, bytes: Uint8Array | null = null;
    if (!vorhanden && b && typeof b !== "string" && b.size) {
      bytes = new Uint8Array(await b.arrayBuffer());
      const typ = dateiTyp(b);
      if (b.size > 5 * 1024 * 1024 || !TYPEN.includes(typ) || !passt(bytes, typ)) return zurueck("Beleg bitte als Foto (JPG/PNG), PDF oder E-Rechnung (XML) bis 5 MB.");
      if (typ === XML && !eRechnungLesen(new TextDecoder().decode(bytes))) return zurueck("Die XML-Datei ist keine lesbare E-Rechnung (XRechnung, ZUGFeRD oder Factur-X).");
      mime = typ;
      await env.DATEN?.put(dateiSchluessel(firma, id), bytes, { httpMetadata: { contentType: mime } });
    }
    const reverseCharge = form.get("reverse_charge") === "on";
    if (reverseCharge && (satz !== 0 || brutto7 !== null)) return zurueck("Bei einer Rechnung aus dem Ausland (§ 13b) bitte USt-Satz 0 % wählen: Die Umsatzsteuer berechnet das Steuerbüro bzw. DATEV.");
    const r = await db(f.s, env, "belege", { method: "POST", body: JSON.stringify({ id, firma_id: firma, datum, lieferant, kategorie, brutto: rund(brutto), ust_satz: satz, brutto_7: brutto7, zahlart: t("zahlart", 5) === "bar" ? "bar" : "unbar", reverse_charge: reverseCharge, anlass: bewirtung ? anlass : null, teilnehmer: bewirtung ? teilnehmer : null, notiz: t("notiz", 300), beleg_mime: mime }) });
    if (!r.ok && bytes) await env.DATEN?.delete(dateiSchluessel(firma, id));
    return weiterleiten(`/konto/belege?monat=${datum.slice(0, 7)}&hinweis=${encodeURIComponent(r.ok ? `${euro(rund(brutto))} von ${lieferant} gespeichert.` : "Speichern hat nicht geklappt.")}`, f.s.cookies);
  }
  const monat = monatWahl(url.searchParams.get("monat"));
  const l = await laden(monat);
  const hinweis = url.searchParams.get("hinweis");
  const d = await datevLaden();
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${belegeSeite(l.ok ? l.daten : [], { monat, heute, nurLesen, kiAn: !!(env.ANTHROPIC_API_KEY && env.HYPERDRIVE), datev: { ...d, admin: f.admin } })}`);
}
