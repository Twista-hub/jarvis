// Import staff from Excel (.xlsx) or CSV (G1): Jarvis recognises the columns, shows a preview and only imports
// after confirmation. Duplicates (same name, and same phone when both have one) are skipped.
import { strFromU8, unzipSync } from "fflate";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { bereicheLaden, db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { BERUFE, QUALIFIKATIONEN } from "./personal.ts";
import { escape, seite } from "./seite.ts";

export type Zeile = { vorname: string; nachname: string; telefon: string; email: string; berufe: string[]; qualifikationen: string[]; status: string; notiz: string; standort: string };
export type Pruefung = Zeile & { bereich_id: string | null; problem: string };
const MAX_ZEILEN = 500;

/** CSV as Excel writes it (semicolon in Germany, also comma or tab), with quotes and BOM. */
export function csvLesen(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const ersteZeile = text.split(/\r?\n/, 1)[0] ?? "";
  const trenner = [";", ",", "\t"].sort((a, b) => ersteZeile.split(b).length - ersteZeile.split(a).length)[0];
  const zeilen: string[][] = [];
  let zeile: string[] = [], feld = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else feld += c;
    } else if (c === '"' && feld === "") inQuotes = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((x) => x.trim())) zeilen.push(zeile);
      zeile = [];
      if (zeilen.length > MAX_ZEILEN + 1) break;
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((x) => x.trim())) zeilen.push(zeile);
  return zeilen;
}

/** CSV from older Excel versions is Windows-1252, newer ones UTF-8. */
export function textAus(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes); } catch { return new TextDecoder("windows-1252").decode(bytes); }
}

const xmlText = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const spalteNr = (ref: string) => [...(ref.match(/^[A-Z]+/)?.[0] ?? "A")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** First worksheet of an .xlsx file as rows of text (shared strings, inline strings, numbers). */
export function xlsxLesen(daten: Uint8Array): string[][] {
  let gesamt = 0;
  const dateien = unzipSync(daten, { filter: (f) => {
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/.test(f.name)) return false;
    gesamt += f.originalSize;
    if (f.originalSize > 20 * 1024 * 1024 || gesamt > 40 * 1024 * 1024) throw new Error("Die Excel-Datei ist zu groß.");
    return true;
  } });
  const geteilt = [...strFromU8(dateien["xl/sharedStrings.xml"] ?? new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]));
  // The first sheet in the workbook's order (not necessarily sheet1.xml).
  const rid = strFromU8(dateien["xl/workbook.xml"] ?? new Uint8Array()).match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const ziel = rid ? strFromU8(dateien["xl/_rels/workbook.xml.rels"] ?? new Uint8Array()).match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"|<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`)) : null;
  const pfad = ziel ? `xl/${(ziel[1] ?? ziel[2]).replace(/^\/?xl\//, "")}` : "";
  const blatt = dateien[pfad] ?? dateien["xl/worksheets/sheet1.xml"];
  if (!blatt) throw new Error("In der Excel-Datei wurde keine Tabelle gefunden.");
  const zeilen: string[][] = [];
  for (const r of strFromU8(blatt).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const zeile: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attr = c[1], inhalt = c[2] ?? "";
      const nr = spalteNr(attr.match(/\br="([A-Z]+)\d+"/)?.[1] ?? String.fromCharCode(65 + Math.min(25, zeile.length)));
      const typ = attr.match(/\bt="(\w+)"/)?.[1] ?? "n";
      const v = inhalt.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      zeile[nr] = typ === "s" ? geteilt[Number(v)] ?? "" : typ === "inlineStr" ? xmlText(inhalt.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "") : xmlText(v);
    }
    const voll = Array.from(zeile, (x) => x ?? "");
    if (voll.some((x) => x.trim())) zeilen.push(voll);
    if (zeilen.length > MAX_ZEILEN + 1) break;
  }
  return zeilen;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z]/g, "");
export const SPALTEN: Record<keyof Zeile | "name", string[]> = {
  vorname: ["vorname", "firstname", "rufname"],
  nachname: ["nachname", "familienname", "lastname", "zuname"],
  name: ["name", "mitarbeiter", "mitarbeiterin", "mitarbeitername", "vollername", "person", "kraft"],
  telefon: ["telefon", "tel", "telefonnummer", "handy", "handynummer", "mobil", "mobilnummer", "mobiltelefon", "phone", "rufnummer"],
  email: ["email", "mail", "emailadresse", "mailadresse"],
  berufe: ["beruf", "berufe", "taetigkeit", "tatigkeit", "position", "funktion", "berufsbezeichnung", "einsatzbereich"],
  qualifikationen: ["qualifikation", "qualifikationen", "kenntnisse", "zertifikate", "scheine", "fuhrerschein", "fuehrerschein"],
  status: ["status", "verfugbarkeit", "verfuegbarkeit", "verfugbar", "verfuegbar"],
  notiz: ["notiz", "bemerkung", "bemerkungen", "kommentar", "hinweis", "anmerkung"],
  standort: ["standort", "niederlassung", "filiale", "einsatzort", "standortname", "ort"],
};

/** Which column holds what (by the header names); -1 when not found. */
export function spaltenErkennen(kopf: string[]): Record<keyof typeof SPALTEN, number> {
  const n = kopf.map(norm);
  return Object.fromEntries(Object.entries(SPALTEN).map(([k, namen]) => [k, n.findIndex((h) => namen.includes(h))])) as Record<keyof typeof SPALTEN, number>;
}

const ALLE_BERUFE = Object.values(BERUFE).flat();
/** "koch" or "Koch" → "Koch/Köchin" from the occupation list, so matching with tenders works; unknown ones stay. */
export function berufZuordnen(b: string): string {
  const n = norm(b);
  return ALLE_BERUFE.find((x) => norm(x) === n) ?? ALLE_BERUFE.find((x) => x.split("/").some((t) => norm(t) === n)) ?? b;
}

const STATUS_WERTE: [RegExp, string][] = [[/einsatz|gebucht|belegt/i, "einsatz"], [/nicht|nein|gesperrt|inaktiv|^0$/i, "nicht"]];
/** German mobile numbers lose their leading zero when Excel stores them as numbers (1701234567). */
export function telefonReparieren(t: string): string {
  const s = t.trim().replace(/\.0$/, "");
  return /^1[5-7]\d{8,9}$/.test(s) ? `0${s}` : s;
}

export function zeilenLesen(tabelle: string[][]): { zeilen: Zeile[]; spalten: Record<string, string> } {
  if (tabelle.length < 2) return { zeilen: [], spalten: {} };
  const kopf = tabelle[0].map((x) => x.trim());
  const sp = spaltenErkennen(kopf);
  const zelle = (z: string[], k: keyof typeof SPALTEN) => sp[k] >= 0 ? String(z[sp[k]] ?? "").replace(/\s+/g, " ").trim() : "";
  // Commas and semicolons separate; "Koch/Köchin" stays one occupation.
  const liste = (s: string) => [...new Set(s.split(/[,;|]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 20).map((x) => x.slice(0, 80));
  const zeilen = tabelle.slice(1, MAX_ZEILEN + 1).map((z) => {
    let vorname = zelle(z, "vorname"), nachname = zelle(z, "nachname");
    if (!vorname && zelle(z, "name")) {
      const voll = zelle(z, "name");
      // "Muster, Eva" or "Eva Muster"
      if (voll.includes(",")) [nachname, vorname] = voll.split(",").map((x) => x.trim());
      else { const t = voll.split(" "); vorname = t.length > 1 ? t.slice(0, -1).join(" ") : voll; nachname = t.length > 1 ? t[t.length - 1] : nachname; }
    } else if (!nachname && sp.vorname >= 0 && zelle(z, "name")) nachname = zelle(z, "name");
    const statusText = zelle(z, "status");
    const quals = liste(zelle(z, "qualifikationen")).map((q) => QUALIFIKATIONEN.find((x) => norm(x) === norm(q)) ?? q);
    return {
      vorname: vorname.slice(0, 100), nachname: (nachname ?? "").slice(0, 100), telefon: telefonReparieren(zelle(z, "telefon")).slice(0, 40), email: zelle(z, "email").slice(0, 200),
      berufe: [...new Set(liste(zelle(z, "berufe")).map(berufZuordnen))], qualifikationen: quals, status: STATUS_WERTE.find(([m]) => m.test(statusText))?.[1] ?? "verfuegbar",
      notiz: zelle(z, "notiz").slice(0, 500), standort: zelle(z, "standort").slice(0, 200),
    };
  });
  const spalten = Object.fromEntries(Object.entries(sp).filter(([, i]) => i >= 0).map(([k, i]) => [k, kopf[i]]));
  return { zeilen, spalten };
}

const schluessel = (v: string, n: string) => `${norm(v)}|${norm(n)}`;
/** Assigns the location by name and marks rows that cannot or need not be imported. */
export function pruefen(zeilen: Zeile[], bereiche: Bereich[], standard: string | null, vorhanden: { vorname: string; nachname: string; telefon: string }[]): Pruefung[] {
  const bekannt = new Map(vorhanden.map((k) => [schluessel(k.vorname, k.nachname), k.telefon.replace(/\D/g, "")]));
  const gesehen = new Set<string>();
  return zeilen.map((z) => {
    const ort = z.standort ? bereiche.find((b) => b.art === "standort" && norm(b.name) === norm(z.standort)) : undefined;
    const key = schluessel(z.vorname, z.nachname);
    const tel = z.telefon.replace(/\D/g, "");
    let problem = "";
    if (!z.vorname) problem = "Kein Vorname";
    else if (z.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(z.email)) problem = "E-Mail ungültig";
    else if (gesehen.has(key)) problem = "Doppelt in der Datei";
    else if (bekannt.has(key) && (!tel || !bekannt.get(key) || bekannt.get(key) === tel)) problem = "Schon eingetragen";
    gesehen.add(key);
    return { ...z, bereich_id: ort ? ort.id : standard, problem };
  });
}

const FELD_NAMEN: Record<string, string> = { vorname: "Vorname", nachname: "Nachname", name: "Name", telefon: "Telefon", email: "E-Mail", berufe: "Berufe", qualifikationen: "Qualifikationen", status: "Status", notiz: "Notiz", standort: "Standort" };

export function vorschauSeite(liste: Pruefung[], o: { spalten: Record<string, string>; schluessel: string; bereiche: Bereich[]; ziel: string; dateiname: string }): string {
  const gut = liste.filter((z) => !z.problem);
  const ortName = (id: string | null) => id ? o.bereiche.find((b) => b.id === id)?.name ?? "" : "ohne Standort";
  const ohneOrt = liste.filter((z) => z.standort && !o.bereiche.some((b) => b.art === "standort" && norm(b.name) === norm(z.standort)));
  return `<p><strong>${escape(o.dateiname)}</strong>: ${liste.length} ${liste.length === 1 ? "Zeile" : "Zeilen"} gelesen, <strong>${gut.length}</strong> ${gut.length === 1 ? "Person wird" : "Personen werden"} importiert${liste.length - gut.length ? `, ${liste.length - gut.length} übersprungen` : ""}.</p>
<p class="klein">Erkannte Spalten: ${Object.entries(o.spalten).map(([k, v]) => `${FELD_NAMEN[k] ?? k} ← „${escape(v)}“`).join(" · ") || "keine"}</p>
${ohneOrt.length ? `<p class="hinweis">📍 ${ohneOrt.length} ${ohneOrt.length === 1 ? "Zeile nennt einen Standort" : "Zeilen nennen Standorte"}, die es in Jarvis nicht gibt (${[...new Set(ohneOrt.map((z) => z.standort))].slice(0, 3).map(escape).join(", ")}). Sie landen am gewählten Standort.</p>` : ""}
<ul class="import-liste">${liste.slice(0, 200).map((z) => `<li class="${z.problem ? "uebersprungen" : ""}"><span aria-hidden="true">${z.problem ? "⚠️" : "✅"}</span><span><strong>${escape(`${z.vorname} ${z.nachname}`.trim() || "(ohne Namen)")}</strong><span class="klein">${escape([z.berufe.slice(0, 3).join(", "), z.telefon, ortName(z.bereich_id)].filter(Boolean).join(" · "))}${z.problem ? ` · <b>${escape(z.problem)}</b>` : ""}</span></span></li>`).join("")}</ul>
${liste.length > 200 ? `<p class="klein">Es werden die ersten 200 Zeilen gezeigt; importiert werden alle ${gut.length} gültigen.</p>` : ""}
${gut.length ? `<form method="post" action="/konto/personal/import/bestaetigen"><input type="hidden" name="schluessel" value="${escape(o.schluessel)}"><button>✅ ${gut.length} ${gut.length === 1 ? "Person" : "Personen"} importieren</button></form>` : `<p class="fehler">Keine Zeile kann importiert werden.</p>`}
<p><a href="${escape(o.ziel)}">Abbrechen</a></p>`;
}

export function uploadSeite(bereiche: Bereich[], bereich: string, fehler = ""): string {
  const orte = bereiche.filter((b) => b.art === "standort");
  return `${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}<p>Lade eine Excel-Datei (.xlsx) oder CSV mit deinem Personal hoch. Jarvis erkennt die Spalten selbst und zeigt dir vor dem Import eine Vorschau.</p>
<form method="post" action="/konto/personal/import" enctype="multipart/form-data" class="upload-felder">
${orte.length ? `<label class="ganz">Standort (wenn die Datei keinen nennt)<select name="bereich"><option value="firma"${bereich === "firma" ? " selected" : ""}>Ohne Standort</option>${orte.map((b) => `<option value="${b.id}"${b.id === bereich ? " selected" : ""}>${escape(b.name)}</option>`).join("")}</select></label>` : `<input type="hidden" name="bereich" value="firma">`}
<label class="ganz">Datei (.xlsx oder .csv, höchstens 2 MB und ${MAX_ZEILEN} Zeilen)<input type="file" name="datei" accept=".xlsx,.csv,text/csv" required></label>
<button class="ganz">Vorschau anzeigen</button></form>
<details class="klein-hilfe"><summary>Welche Spalten erkennt Jarvis?</summary><p>Vorname, Nachname (oder eine Spalte „Name“), Telefon/Handy, E-Mail, Beruf(e), Qualifikationen, Status, Standort und Notiz. Mehrere Berufe mit Komma trennen. Die erste Zeile muss die Spaltennamen enthalten.</p><p><a href="/konto/personal/import/vorlage.csv">⬇ Vorlage herunterladen</a></p></details>`;
}

export const VORLAGE_CSV = "﻿Vorname;Nachname;Telefon;E-Mail;Berufe;Qualifikationen;Status;Standort;Notiz\r\nEva;Muster;0170 1234567;eva@example.de;Servicekraft, Koch/Köchin;Gesundheitszeugnis (§ 43 IfSG), Führerschein B;verfügbar;Berlin;nur Frühschicht\r\n";

export async function personalImport(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/konto/personal/import")) return null;
  if (url.pathname === "/konto/personal/import/vorlage.csv") return new Response(VORLAGE_CSV, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="Personal-Vorlage.csv"' } });
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Personal importieren", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma & Team">←</a></p>${text}`, 0, "team"), status, f.s.cookies);
  if (!["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle)) return antwort("<p>Nur Bearbeiter und Admins können Personal importieren.</p>", 403);
  if (!env.DATEN) return antwort('<p class="fehler">Der Import ist gerade nicht verfügbar.</p>', 503);
  const bereicheR = await bereicheLaden(f.s, env, f.m.firma_id);
  const bereiche = bereicheR.ok ? bereicheR.daten : [];
  // Back to the location page when there are several locations, else to "Firma & Team".
  const zielFuer = (id: string | null) => bereiche.length > 1 && id ? `/konto/standort/${id}` : "/konto/team";

  if (url.pathname === "/konto/personal/import/bestaetigen" && request.method === "POST") {
    const key = String((await request.formData()).get("schluessel") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(key)) return antwort('<p class="fehler">Der Import ist abgelaufen. Bitte die Datei erneut hochladen.</p>', 400);
    const obj = await env.DATEN.get(`importe/${f.m.firma_id}/${key}.json`);
    const gespeichert = obj ? (await obj.json()) as { user: string; erstellt: number; zeilen: Pruefung[]; standard: string | null } : null;
    if (!gespeichert || gespeichert.user !== f.s.userId || Date.now() - gespeichert.erstellt > 3600_000) {
      if (obj) await env.DATEN.delete(`importe/${f.m.firma_id}/${key}.json`);
      return antwort('<p class="fehler">Der Import ist abgelaufen. Bitte die Datei erneut hochladen.</p>', 400);
    }
    const neu = gespeichert.zeilen.filter((z) => !z.problem).map((z) => ({ firma_id: f.m.firma_id, bereich_id: z.bereich_id, vorname: z.vorname, nachname: z.nachname, telefon: z.telefon, email: z.email, berufe: z.berufe, qualifikationen: z.qualifikationen, status: z.status, notiz: z.notiz }));
    let ok = 0;
    for (let i = 0; i < neu.length; i += 100) {
      const r = await db(f.s, env, "personal", { method: "POST", body: JSON.stringify(neu.slice(i, i + 100)) });
      if (r.ok) ok += Math.min(100, neu.length - i);
    }
    await env.DATEN.delete(`importe/${f.m.firma_id}/${key}.json`);
    return weiterleiten(`${zielFuer(gespeichert.standard)}?hinweis=${encodeURIComponent(ok === neu.length ? `${ok} ${ok === 1 ? "Person" : "Personen"} importiert.` : `${ok} von ${neu.length} importiert. Für manche Standorte fehlen dir vielleicht die Rechte.`)}`, f.s.cookies);
  }
  const bereich = url.searchParams.get("bereich") ?? "firma";
  if (request.method !== "POST") return antwort(uploadSeite(bereiche, bereich));
  const form = await request.formData();
  const wahl = String(form.get("bereich") ?? "firma");
  const standard = bereiche.some((b) => b.id === wahl) ? wahl : null;
  const datei = form.get("datei");
  if (!datei || typeof datei === "string" || datei.size < 1 || datei.size > 2 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(datei.name)) return antwort(uploadSeite(bereiche, wahl, "Bitte eine .xlsx- oder .csv-Datei mit höchstens 2 MB wählen."), 400);
  let tabelle: string[][];
  try {
    const bytes = new Uint8Array(await datei.arrayBuffer());
    tabelle = /\.xlsx$/i.test(datei.name) ? xlsxLesen(bytes) : csvLesen(textAus(bytes));
  } catch (e) {
    return antwort(uploadSeite(bereiche, wahl, e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden."), 400);
  }
  const { zeilen, spalten } = zeilenLesen(tabelle);
  if (!zeilen.length) return antwort(uploadSeite(bereiche, wahl, "In der Datei stehen keine Personen. Die erste Zeile muss die Spaltennamen enthalten."), 400);
  if (!spalten.vorname && !spalten.name) return antwort(uploadSeite(bereiche, wahl, `Keine Spalte „Vorname“ oder „Name“ gefunden. Gefunden: ${tabelle[0].filter(Boolean).slice(0, 8).join(", ")}.`), 400);
  const vorhanden = await db<{ vorname: string; nachname: string; telefon: string }[]>(f.s, env, `personal?firma_id=eq.${f.m.firma_id}&select=vorname,nachname,telefon&limit=5000`);
  const liste = pruefen(zeilen, bereiche, standard, vorhanden.ok ? vorhanden.daten : []);
  // Previews nobody confirmed are not kept: older than an hour, they are deleted with the next import.
  const alt = await env.DATEN.list({ prefix: `importe/${f.m.firma_id}/` });
  await Promise.all(alt.objects.filter((o) => Date.now() - o.uploaded.getTime() > 3600_000).map((o) => env.DATEN!.delete(o.key)));
  const key = crypto.randomUUID();
  await env.DATEN.put(`importe/${f.m.firma_id}/${key}.json`, JSON.stringify({ user: f.s.userId, erstellt: Date.now(), zeilen: liste, standard }));
  return antwort(vorschauSeite(liste, { spalten, schluessel: key, bereiche, ziel: zielFuer(standard), dateiname: datei.name }));
}
