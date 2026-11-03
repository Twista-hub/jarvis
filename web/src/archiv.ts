// Rechtsprüfung 03.11.2026, Steuern S6 (docs/recht/pruefung-2026-11.md): invoices and receipts must be kept for 8 to 10
// years (§ 147 AO, § 14b UStG). Before a firm leaves Crewtender (account deletion) or whenever it wants, people with finance
// access download everything as one ZIP: issued invoices (Word, XRechnung where possible), receipt files, two CSV lists
// and a short note. Nothing is changed.
import { zipSync, strToU8 } from "fflate";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, weiterleiten, type KontoEnv } from "./konto.ts";
import { beteiligte, originalSchluessel, RECHNUNG_SPALTEN, rechnungDocx, ustVon, type Absender, type Rechnung } from "./rechnungen.ts";
import { xrechnungXml, fehlendFuerXRechnung } from "./xrechnung.ts";
import { dateiSchluessel, type Beleg } from "./belege.ts";
import type { Kunde } from "./kunden.ts";

const csvFeld = (v: unknown) => { const t = String(v ?? ""); const s = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (zeilen: unknown[][]) => "﻿" + zeilen.map((z) => z.map(csvFeld).join(";")).join("\r\n") + "\r\n";
const sicher = (t: string) => t.replace(/[^\wäöüÄÖÜß.-]+/g, "_").slice(0, 80);
const betrag = (n: number) => n.toFixed(2).replace(".", ",");

export const LIESMICH = `Archiv aus Crewtender\r\n\r\nRechnungen und Belege müssen in Deutschland in der Regel 8 Jahre (Buchungsbelege, Rechnungen) bzw. 10 Jahre (Bücher, Jahresabschlüsse) aufbewahrt werden (§ 147 AO, § 14b UStG). Bitte dieses Archiv sicher und unverändert aufbewahren und mit dem Steuerbüro klären, welche Fristen für euch gelten.\r\n\r\nInhalt:\r\n- rechnungen/: jede ausgestellte Rechnung und Stornorechnung als Word, dazu die E-Rechnung (XRechnung), wenn alle Pflichtangaben vorhanden waren\r\n- rechnungen.csv: Liste aller ausgestellten Rechnungen\r\n- belege/: die hochgeladenen Belegdateien\r\n- belege.csv: Liste aller Belege, auch stornierte (mit Grund)\r\n`;

export async function archiv(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/archiv.zip") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (!f.finanzen || !["inhaber", "admin", "bearbeiter", "leser"].includes(f.m.rolle)) return new Response("Nur mit Finanzfreigabe", { status: 403 });
  const firma = f.m.firma_id;
  const [re, be, ku, fi, pr] = await Promise.all([
    db<Rechnung[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&status=eq.ausgestellt&select=${RECHNUNG_SPALTEN}&order=datum,nummer&limit=20000`),
    db<(Beleg & { erstellt: string })[]>(f.s, env, `belege?firma_id=eq.${firma}&select=id,datum,lieferant,kategorie,brutto,ust_satz,notiz,beleg_mime,storniert_am,storno_grund,erstellt&order=datum&limit=20000`),
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz&limit=5000`),
    db<{ name: string; strasse: string | null; plz: string | null; ort: string | null; telefon: string | null }[]>(f.s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort,telefon`),
    db<{ email: string; ustid: string; steuernummer: string; kleinunternehmer: boolean; zahlungshinweis: string }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=email,ustid,steuernummer,kleinunternehmer,zahlungshinweis`),
  ]);
  const a0 = fi.ok ? fi.daten[0] : undefined, p0 = pr.ok ? pr.daten[0] : undefined;
  const absender: Absender = { name: a0?.name ?? "", strasse: a0?.strasse ?? "", plz: a0?.plz ?? "", ort: a0?.ort ?? "", telefon: a0?.telefon ?? "", email: p0?.email ?? "", ustid: p0?.ustid ?? "", steuernummer: p0?.steuernummer ?? "", kleinunternehmer: !!p0?.kleinunternehmer, zahlungshinweis: p0?.zahlungshinweis ?? "" };
  const kunden = ku.ok ? ku.daten : [];
  const dateien: Record<string, Uint8Array> = { "LIESMICH.txt": strToU8(LIESMICH) };
  const reZeilen: unknown[][] = [["Nummer", "Art", "Bezug", "Rechnungsdatum", "Leistungsmonat", "Kunde", "Netto", "USt", "Brutto", "Bezahlt am", "Storniert"]];
  for (const r of re.ok ? re.daten : []) {
    const kunde = kunden.find((k) => k.id === r.kunde_id) ?? null;
    const b = beteiligte(r, kunde, absender);
    const ust = ustVon(r, absender.kleinunternehmer);
    const original = await env.DATEN?.get(originalSchluessel(firma, r.id));
    dateien[`rechnungen/${sicher(r.nummer)}.docx`] = original ? new Uint8Array(await original.arrayBuffer()) : rechnungDocx(r, kunde, absender);
    if (r.art !== "storno" && !fehlendFuerXRechnung(b.a, b.kunde).length) dateien[`rechnungen/${sicher(r.nummer)}.xml`] = strToU8(xrechnungXml(r, b.kunde, b.a, r.empfaenger?.leitweg ?? ""));
    reZeilen.push([r.nummer, r.art === "storno" ? "Storno" : "Rechnung", r.bezug_nummer ?? "", r.datum, r.monat, b.kunde?.name ?? "", betrag(Number(r.netto)), betrag(ust), betrag(Number(r.netto) + ust), r.bezahlt_am ?? "", r.storniert_durch ? "ja" : ""]);
  }
  dateien["rechnungen.csv"] = strToU8(csv(reZeilen));
  const beZeilen: unknown[][] = [["Datum", "Lieferant", "Kategorie", "Brutto", "USt-Satz", "Notiz", "Datei", "Storniert am", "Storno-Grund", "Erfasst"]];
  for (const b of be.ok ? be.daten : []) {
    let datei = "";
    if (b.beleg_mime) {
      const obj = await env.DATEN?.get(dateiSchluessel(firma, b.id));
      if (obj) { datei = `belege/${b.datum}_${sicher(b.lieferant)}_${b.id.slice(0, 8)}.${b.beleg_mime === "application/pdf" ? "pdf" : b.beleg_mime === "image/png" ? "png" : "jpg"}`; dateien[datei] = new Uint8Array(await obj.arrayBuffer()); }
    }
    beZeilen.push([b.datum, b.lieferant, b.kategorie, betrag(Number(b.brutto)), Number(b.ust_satz), b.notiz, datei, b.storniert_am ?? "", b.storno_grund ?? "", b.erstellt]);
  }
  dateien["belege.csv"] = strToU8(csv(beZeilen));
  const zip = zipSync(dateien, { level: 6 });
  const h = new Headers({ "content-type": "application/zip", "content-disposition": `attachment; filename="Crewtender-Archiv-${sicher(absender.name || "Firma")}-${new Date().toISOString().slice(0, 10)}.zip"`, "cache-control": "private, no-store" });
  for (const c of f.s.cookies ?? []) h.append("set-cookie", c);
  return new Response(zip, { headers: h });
}

/** D13 / Data Act: all data of the firm as JSON files in one ZIP (owners and admins). Files (receipts, invoices) come
 *  with /konto/archiv.zip; company documents can be downloaded under Firmenunterlagen. */
export async function firmendaten(request: Request, env: KontoEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/konto/firmendaten.zip") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (!["inhaber", "admin"].includes(f.m.rolle)) return new Response("Nur für Inhaber und Admins", { status: 403 });
  const r = await db<Record<string, unknown[]>>(f.s, env, "rpc/firmendaten_export", { method: "POST", body: JSON.stringify({ f: f.m.firma_id }) });
  if (!r.ok) return new Response("Export fehlgeschlagen", { status: 502 });
  const dateien: Record<string, Uint8Array> = {
    "LIESMICH.txt": strToU8(`Alle Daten eurer Firma aus Crewtender (Art. 20 DSGVO, EU Data Act)\r\n\r\nJede Datei ist eine Tabelle im JSON-Format (UTF-8), eine Zeile pro Eintrag. Die Spaltennamen sind deutsch.\r\nRechnungen als Word/XRechnung und Belegfotos: /konto/archiv.zip (mit Finanzfreigabe). Firmenunterlagen: unter Firmenunterlagen als ZIP.\r\nFinanztabellen sind nur enthalten, wenn du eine Finanzfreigabe hast.\r\nExportiert am ${new Date().toISOString()}\r\n`),
  };
  for (const [tabelle, zeilen] of Object.entries(r.daten)) dateien[`${tabelle}.json`] = strToU8(JSON.stringify(zeilen, null, 1));
  const h = new Headers({ "content-type": "application/zip", "content-disposition": `attachment; filename="Crewtender-Firmendaten-${new Date().toISOString().slice(0, 10)}.zip"`, "cache-control": "private, no-store" });
  for (const c of f.s.cookies) h.append("set-cookie", c);
  return new Response(zipSync(dateien, { level: 6 }), { headers: h });
}
