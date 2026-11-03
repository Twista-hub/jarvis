// T35: Lohnliste fürs Lohnbüro. Per person and month: approved hours, night/Sunday/holiday hours, leave, training and
// absence days, short-notice absences, approved expenses and the working time balance; as Excel and CSV (semicolon,
// for import into payroll software; the columns have to be mapped there once).
// T39: Stundennachweis per person as Word, with the staff member's signature when there is one for that month.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, weiterleiten, type KontoEnv } from "./konto.ts";
import { dezimal, landDerFirma, minuten, naechsterMonat, type Eintrag } from "./stunden.ts";
import { summe, zuschlag } from "./zuschlaege.ts";
import { arbeitstage } from "./urlaub.ts";
import { zeitkonto, type Start, type ZPerson } from "./zeitkonto.ts";
import { xlsxAntwort, xlsxDatei, type Zelle } from "./xlsx.ts";
import { absatz, bild, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";
import { schluessel } from "./unterschrift.ts";
import { cp1252, fehltDatev, lodasDatei, type Lohnarten } from "./datev.ts";

export type LPerson = ZPerson & { personalnummer: string };
type Abw = { personal_id: string; von: string; bis: string; grund: string; status?: string; kurzfristig?: boolean };
type Spese = { personal_id: string; betrag: number | string; status: string };
export type Zeile = { personalnummer: string; name: string; stunden: number; nacht: number; sonntag: number; feiertag: number; urlaub: number; schulung: number; abwesend: number; ausfaelle: number; spesen: number; saldo: number | null };

export function lohnZeilen(personen: LPerson[], stunden: Eintrag[], abw: Abw[], spesen: Spese[], starts: Start[], alleStunden: Eintrag[], alleAbw: Abw[], monat: string, land: string): Zeile[] {
  const von = `${monat}-01`, bis = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const tageIm = (a: Abw) => arbeitstage(a.von < von ? von : a.von, a.bis > bis ? bis : a.bis, land);
  return personen.map((p) => {
    const l = stunden.filter((s) => s.personal_id === p.id && s.status === "freigegeben" && s.datum >= von && s.datum <= bis);
    const z = summe(l.map((e) => zuschlag(e, land)));
    const a = abw.filter((x) => x.personal_id === p.id && x.status !== "beantragt" && x.von <= bis && x.bis >= von);
    const k = zeitkonto(p, starts.find((s) => s.personal_id === p.id), alleStunden, alleAbw, land, bis);
    return { personalnummer: p.personalnummer, name: `${p.nachname}, ${p.vorname}`.replace(/^, |, $/g, ""), stunden: l.reduce((n, e) => n + minuten(e), 0), nacht: z.nacht, sonntag: z.sonntag, feiertag: z.feiertag,
      urlaub: a.filter((x) => x.grund === "urlaub").reduce((n, x) => n + tageIm(x), 0), schulung: a.filter((x) => x.grund === "schulung").reduce((n, x) => n + tageIm(x), 0),
      abwesend: a.filter((x) => x.grund === "abwesend").reduce((n, x) => n + tageIm(x), 0), ausfaelle: a.filter((x) => x.kurzfristig).length,
      spesen: Math.round(spesen.filter((x) => x.personal_id === p.id && x.status === "freigegeben").reduce((n, x) => n + Number(x.betrag), 0) * 100) / 100,
      saldo: k.length ? k.at(-1)!.stand : null };
  }).filter((r) => r.stunden || r.urlaub || r.schulung || r.abwesend || r.spesen).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

const KOPF = ["Personalnummer", "Name", "Stunden", "davon Nacht", "davon Sonntag", "davon Feiertag", "Urlaubstage", "Schulungstage", "Abwesend (Tage)", "kurzfristige Ausfälle", "Spesen (€)", "Zeitkonto (Std.)"];
const werte = (r: Zeile): Zelle[] => [r.personalnummer, r.name, dezimal(r.stunden), dezimal(r.nacht), dezimal(r.sonntag), dezimal(r.feiertag), r.urlaub, r.schulung, r.abwesend, r.ausfaelle, r.spesen, r.saldo === null ? "" : dezimal(r.saldo)];
export const lohnExcel = (z: Zeile[], monat: string) => xlsxDatei([{ name: `Lohn ${monat}`, zeilen: [KOPF, ...z.map(werte)], breiten: [14, 26, 9, 11, 13, 13, 11, 13, 14, 18, 11, 15] }]);
/** CSV with semicolons and decimal comma (opens correctly in German Excel and payroll imports); cells starting with = + - @ get a leading apostrophe. */
export function lohnCsv(z: Zeile[]): string {
  const zelle = (v: Zelle) => { const s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? ""); const t = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s; return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return "﻿" + [KOPF, ...z.map(werte)].map((r) => r.map(zelle).join(";")).join("\r\n") + "\r\n";
}

export function stundennachweisDocx(firma: string, p: { vorname: string; nachname: string; personalnummer?: string }, l: Eintrag[], monat: string, land: string, unterschrift: { png: Uint8Array; am: string } | null): Uint8Array {
  const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const h = (m: number) => m ? dezimal(m).toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "";
  const sortiert = [...l].sort((a, b) => a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn));
  const z = summe(sortiert.map((e) => zuschlag(e, land)));
  return wordDokument(ueberschrift(`Stundennachweis ${new Date(`${monat}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })}`, 28) + absatz(firma, { fett: true }) + absatz(`Mitarbeiter/in: ${`${p.vorname} ${p.nachname}`.trim()}${p.personalnummer ? ` · Personalnummer ${p.personalnummer}` : ""}`, { abstand: 200 })
    + tabelle([["Datum", "Zeit", "Pause", "Std.", "Nacht", "Sonntag", "Feiertag", "Einsatz"], ...sortiert.map((e) => { const zz = zuschlag(e, land); return [tag(e.datum), `${e.beginn.slice(0, 5)}–${e.ende.slice(0, 5)}`, e.pause_min ? String(e.pause_min) : "", h(minuten(e)), h(zz.nacht), h(zz.sonntag), h(zz.feiertag), e.einsatz]; }),
      ["Summe", "", "", h(sortiert.reduce((n, e) => n + minuten(e), 0)), h(z.nacht), h(z.sonntag), h(z.feiertag), ""]], [1100, 1300, 700, 800, 800, 900, 900, 3100], true)
    + absatz("Ich bestätige die Richtigkeit der oben aufgeführten Arbeitszeiten.", { abstand: 200 })
    + (unterschrift ? bild(1, 6, 1.8) + absatz(`Digital unterschrieben am ${new Date(unterschrift.am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} Uhr`, { grau: true, groesse: 16 }) : absatz("______________________________\nUnterschrift Mitarbeiter/in", { abstand: 200 })),
    unterschrift ? [{ id: 1, png: unterschrift.png }] : []);
}

export async function lohn(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const nachweis = url.pathname.match(/^\/konto\/stunden\/([0-9a-f-]{36})\.docx$/);
  if (!["/konto/lohn.xlsx", "/konto/lohn.csv", "/konto/lohn-lodas.txt"].includes(url.pathname) && !nachweis) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (f.m.rolle === "mitarbeiter") return new Response("Nicht erlaubt", { status: 403 });
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("monat") ?? "") ? url.searchParams.get("monat")! : heute.slice(0, 7);
  const von = `${monat}-01`, bis = `${naechsterMonat(monat)}-01`;
  const land = await landDerFirma(f.s, env, firma);
  if (nachweis) {
    const [p, l, u, fn] = await Promise.all([
      db<LPerson[]>(f.s, env, `personal?id=eq.${nachweis[1]}&firma_id=eq.${firma}&select=id,vorname,nachname,personalnummer`),
      db<Eintrag[]>(f.s, env, `stundenzettel?personal_id=eq.${nachweis[1]}&firma_id=eq.${firma}&status=eq.freigegeben&datum=gte.${von}&datum=lt.${bis}&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status&limit=500`),
      db<{ id: string; erstellt: string }[]>(f.s, env, `unterschriften?personal_id=eq.${nachweis[1]}&firma_id=eq.${firma}&art=eq.stunden&bezug=eq.${monat}&select=id,erstellt&order=erstellt.desc&limit=1`),
      db<{ name: string }[]>(f.s, env, `firmen?id=eq.${firma}&select=name`),
    ]);
    const person = p.ok ? p.daten[0] : undefined;
    if (!person) return new Response("Nicht gefunden", { status: 404 });
    const ux = u.ok ? u.daten[0] : undefined, obj = ux ? await env.DATEN?.get(schluessel.person(firma, ux.id)) : null;
    const png = obj ? new Uint8Array(await obj.arrayBuffer()) : null;
    return wordAntwort(stundennachweisDocx(fn.ok ? fn.daten[0]?.name ?? "" : "", person, l.ok ? l.daten : [], monat, land, png && ux ? { png, am: ux.erstellt } : null), `Stundennachweis_${person.nachname || person.vorname}_${monat}.docx`.replace(/[^\wäöüÄÖÜß.-]+/g, "_"), f.s.cookies);
  }
  const jahr = `${Number(monat.slice(0, 4)) - 1}-01-01`;
  const [p, st, a, sp, zk] = await Promise.all([
    db<LPerson[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,personalnummer,status,wochenstunden,eintritt&limit=5000`),
    db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&status=eq.freigegeben&datum=gte.${jahr}&datum=lt.${bis}&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status&limit=100000`),
    db<Abw[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&status=eq.bestaetigt&bis=gte.${jahr}&von=lt.${bis}&select=personal_id,von,bis,grund,status,kurzfristig&limit=20000`),
    db<Spese[]>(f.s, env, `spesen?firma_id=eq.${firma}&status=eq.freigegeben&datum=gte.${von}&datum=lt.${bis}&select=personal_id,betrag,status&limit=10000`),
    db<Start[]>(f.s, env, `zeitkonten?firma_id=eq.${firma}&select=personal_id,ab,startsaldo_min&limit=5000`),
  ]);
  const stunden = st.ok ? st.daten : [], abw = a.ok ? a.daten : [];
  const z = lohnZeilen(p.ok ? p.daten : [], stunden, abw, sp.ok ? sp.daten : [], zk.ok ? zk.daten : [], stunden, abw, monat, land);
  if (url.pathname.endsWith(".txt")) {
    const e = await db<{ datev_berater: string; datev_mandant: string; lohnarten: Lohnarten }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=datev_berater,datev_mandant,lohnarten`);
    const x = e.ok ? e.daten[0] : undefined, ein = { berater: x?.datev_berater ?? "", mandant: x?.datev_mandant ?? "" };
    const la = x?.lohnarten ?? {};
    if (fehltDatev(ein).length || !Object.values(la).some(Boolean)) return weiterleiten(`/konto/stunden?monat=${monat}&hinweis=${encodeURIComponent("Für LODAS fehlen Berater-/Mandantennummer oder Lohnarten: ein Admin trägt sie unter Belege → DATEV-Einstellungen ein.")}`, f.s.cookies);
    const d = lodasDatei(ein, monat, z, la);
    const h = new Headers({ "content-type": "text/plain; charset=windows-1252", "content-disposition": `attachment; filename="LODAS_${monat}.txt"`, "cache-control": "private, no-store" });
    for (const c of f.s.cookies) h.append("set-cookie", c);
    if (d.ohneNummer.length) h.set("x-jarvis-ohne-personalnummer", String(d.ohneNummer.length));
    return new Response(cp1252(d.text), { headers: h });
  }
  if (url.pathname.endsWith(".csv")) {
    const h = new Headers({ "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="Lohn_${monat}.csv"`, "cache-control": "private, no-store" });
    for (const c of f.s.cookies) h.append("set-cookie", c);
    return new Response(lohnCsv(z), { headers: h });
  }
  return xlsxAntwort(lohnExcel(z, monat), `Lohn_${monat}.xlsx`, f.s.cookies);
}
