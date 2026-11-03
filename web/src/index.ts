// Jarvis upload page: customers upload tender documents, a Workflow writes the Steckbrief.
import kunden from "../kunden.json";
import { BRANCHEN_VORLAGEN, euro, FELDER, losStunden, felderHtml, fmt, kalkulationCsv, MINDESTLOHN, laufzeitFaktor, preisGrafik, rechnen, runden, vergleichsWorte, STANDARD, szenarien, tarifSchnellwahl, zahl, zuschlagVergleich, vorlageFuerBereich, type Boden, type Eingaben, type Los, type LosWerte, type Zuschlag } from "./kalkulation";
import profile from "../../alarm/profile.json";
import { CSP, statisch } from "./app";
import { unterlagenOhneTreffer } from "./unterlagen";
import { angebote } from "./angebote";
import { darfAuftrag } from "./auftragsrechte";
import { firmenunterlagen } from "./firmenunterlagen";
import { referenzen } from "./referenzen";
import { protokoll } from "./protokoll";
import { personalImport } from "./personalimport";
import { suchfilter } from "./suchfilter";
import { kontoEinstellungen } from "./kontoeinstellungen";
import { angebotsUebersicht } from "./angebotsuebersicht";
import { aueg } from "./aueg";
import { foerderung } from "./foerderung";
import { radar } from "./radar";
import { auftraege } from "./auftraege";
import { auftraggeberSeite } from "./auftraggeber";
import { auswertung } from "./auswertung";
import { leistungsverzeichnis } from "./lv";
import { textbausteineSeite } from "./textbausteine";
import { partnerVerwalten } from "./partner";
import { disposition } from "./disposition";
import { firmenprofil } from "./firmenprofil";
import { personalakte } from "./personalakte";
import { unterweisungen } from "./unterweisungen";
import { personalsuche } from "./personalsuche";
import { freigaben } from "./freigaben";
import { mitarbeiterVerwalten } from "./mitarbeiter";
import { einrichtung } from "./einrichtung";
import { personal } from "./personal";
import { organisation } from "./organisation.ts";
import { vertretung } from "./vertretung.ts";
import { aufgaben } from "./aufgaben.ts";
import { betriebsmittel } from "./betriebsmittel.ts";
import { kapazitaetSeiteRoute } from "./kapazitaet.ts";
import { ich } from "./ich.ts";
import { stundenRoute } from "./stunden.ts";
import { schichtenRoute } from "./schichten.ts";
import { brett } from "./brett.ts";
import { chat } from "./chat.ts";
import { personalfristen } from "./personalfristen.ts";
import { kunden as kundenSeiteRoute } from "./kunden.ts";
import { leistungsnachweis } from "./leistungsnachweis.ts";
import { psa } from "./psa.ts";
import { bewerber } from "./bewerber.ts";
import { checklisten } from "./checklisten.ts";
import { urlaub } from "./urlaub.ts";
import { bewertungen } from "./bewertungen.ts";
import { personalauswertung } from "./personalauswertung.ts";
import { markt } from "./markt.ts";
import { kundenlinkErstellen, kundenlinkOeffentlich } from "./kundenlink.ts";
import { rechnungen } from "./rechnungen.ts";
import { rundgaenge } from "./rundgang.ts";
import { belege } from "./belege.ts";
import { kundenportal } from "./kundenportal.ts";
import { boerse } from "./boerse.ts";
import { nachkalkulationRoute } from "./nachkalkulation.ts";
import { umsatzsteuer } from "./umsatzsteuer.ts";
import { lohn } from "./lohn.ts";
import { spesen } from "./spesen.ts";
import { zeitkontoRoute } from "./zeitkonto.ts";
import { kraefteEinladen } from "./kraefte.ts";
import { betreiber } from "./loeschen.ts";
import { demo } from "./demo.ts";
import { gewerke } from "./gewerke.ts";
import { metiers } from "./gewerke-fr.ts";
import { landGewerke } from "./gewerke-land.ts";
import { hinweisDeutsch, RECHT_FR } from "./rechtliches-fr.ts";
import { hinweisDeutschPl, RECHT_PL } from "./rechtliches-pl.ts";
import { hinweisDeutschEs, RECHT_ES } from "./rechtliches-es.ts";
import { hinweisDeutschIt, RECHT_IT } from "./rechtliches-it.ts";
import { fehlerMelden, fehlerText } from "./fehler.ts";
import { einsatzplan } from "./einsatzplan";
import { db, konto, sitzung, vorgangZugriff, type KontoEnv, type Sitzung } from "./konto";
import MUSTER from "./muster-steckbrief.md";
import { avv, datenschutz, impressum, nutzungsbedingungen, startseite } from "./rechtliches";
import { usProfil, usRadar } from "./usprofil.ts";
import { samAnleitungSeite } from "./samanleitung.ts";
import { APP_SPRACHEN, appSprache, sprachFuss, sprachWechsel, uebersetzen, type AppSprache } from "./englisch.ts";
import { ISO2, SPRACHEN_OEFFENTLICH, besucher, keineBehoerde, kopfZeile, landWahl, landesSeite, wahlCookies, type Sprache } from "./besucher.ts";
import { escape, markdown, seite, stapeln } from "./seite";
import { GVP, lohnAm, standardTarif, tariflohn, type TarifWahl } from "./tarife";
import { loseLesen } from "./lose";
import { apiClient, firmaVonProfil } from "./api-budget.ts";
import { datenbankPruefen as hyperdrivePruefen } from "./db-check.ts";

export { Steckbrief } from "./workflow";

export interface Env extends KontoEnv {
  WARTEN?: (p: Promise<unknown>) => void; // ctx.waitUntil, set per request in fetch()
  DATEN: R2Bucket;
  AI: Ai;
  STECKBRIEF: Workflow<Job>;
  ANTHROPIC_API_KEY: string;
  HYPERDRIVE?: { connectionString: string };
  ACTIONS_TOKEN?: string;
  TEST_CODE_HASH?: string;
  TAGES_LIMIT: string;
}

export type Job = { id: string; profil: string; kunde: string; titel: string; erstellt: string; vorgang?: string; sprache?: Exclude<AppSprache, "de"> };
/** Language of the AI fact sheet for an upload: only set when not German (German jobs stay exactly as before). */
function kiSprache(request: Request): { sprache?: Exclude<AppSprache, "de"> } {
  const s = appSprache(request);
  return s === "de" ? {} : { sprache: s };
}

const RECHT: Record<string, [string, () => string]> = {
  "/impressum": ["Impressum", impressum],
  "/datenschutz": ["Datenschutzerklärung", datenschutz],
  "/nutzungsbedingungen": ["Nutzungsbedingungen", nutzungsbedingungen],
  "/avv": ["Vertrag zur Auftragsverarbeitung", avv],
};

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_FILES = 40;
const ID = /^[0-9a-f-]{36}$/;

export const ADRESSE = "https://app.wpdigitalranger.com";

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    // KI cost settlement may finish after the page has answered (time limit); keep it alive past the response.
    if (ctx) env = { ...env, WARTEN: (p: Promise<unknown>) => ctx.waitUntil(p) };
    // The app lives at app.wpdigitalranger.com; the old workers.dev address forwards there (links in older mails keep working).
    const alt = new URL(request.url);
    if (alt.hostname.endsWith(".workers.dev")) return Response.redirect(`${ADRESSE}${alt.pathname}${alt.search}`, request.method === "GET" || request.method === "HEAD" ? 301 : 308);
    let antwort: Response;
    try { antwort = await verarbeiten(request, env); }
    catch (e) {
      // Unexpected error: phone notification to the operator (path without query, no personal data) and a friendly page.
      console.error(e);
      await fehlerMelden(env, "app", `${request.method} ${alt.pathname.replace(/[0-9a-f-]{36}/g, ":id").slice(0, 80)} · ${fehlerText(e)}`);
      antwort = html(seite("Fehler", `<p>Da ist leider etwas schiefgegangen. Bitte versuche es gleich noch einmal.</p><p class="klein">Wir haben eine Nachricht bekommen und kümmern uns darum.</p><p><a href="/konto">Zur Übersicht</a></p>`), 500);
    }
    const r = darstellen(request, antwort);
    if (!new URL(request.url).pathname.startsWith("/auftrag/")) return r;
    const s = await sitzung(request,env);
    const headers = new Headers(r.headers);
    headers.set("cache-control","private, no-store");
    for (const c of s?.cookies ?? []) headers.append("set-cookie",c);
    return new Response(r.body,{status:r.status,statusText:r.statusText,headers});
  },
};

/** After rendering: display choice (cookie jv_darstellung, e.g. "dark-gross") onto <html>, office language (English
 *  dictionary, see englisch.ts) and the language switch in the footer. Non-HTML answers pass through untouched. */
function darstellen(request: Request, r: Response): Response {
  if (!(r.headers.get("content-type") ?? "").startsWith("text/html") || !r.body) return r;
  const wahl = /(?:^|;\s*)jv_darstellung=([a-z-]{1,20})/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "";
  const theme = wahl.includes("dark") ? "dark" : wahl.includes("light") ? "light" : "";
  const attribute = `${theme ? ` data-theme="${theme}"` : ""}${wahl.includes("gross") ? ' data-schrift="gross"' : ""}`;
  // Pages written in one language (foreign trade and legal pages) say so; everything else follows the visitor's choice.
  const fest = r.headers.get("x-jv-sprache");
  const sprache = (APP_SPRACHEN as readonly string[]).includes(fest ?? "") ? fest as AppSprache : appSprache(request);
  const url = new URL(request.url);
  const pfad = `${url.pathname}${url.search}`;
  const body = new Response(r.body).text();
  const h = new Headers(r.headers);
  h.append("vary", "cookie");
  return new Response(new ReadableStream({ async start(c) {
    let t = await body;
    t = uebersetzen(t, sprache);
    t = sprachFuss(t, sprache, pfad);
    if (attribute) t = t.replace(/<html lang="([a-z]{2})"/, `<html lang="$1"${attribute}`);
    c.enqueue(new TextEncoder().encode(t)); c.close();
  } }), { status: r.status, statusText: r.statusText, headers: h });
}

async function verarbeiten(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/__intern/db-check" && request.method === "POST") return datenbankPruefen(request, env);
    const sw = sprachWechsel(request);
    if (sw) return sw;
    const datei = request.method === "GET" ? statisch(url.pathname) : null;
    if (datei) return datei;
    const u = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/unterlagen$/);
    if (u && request.method === "POST") return unterlagenAmVorgang(u[1], request, env);
    if (url.pathname === "/konto/unterlagen" && request.method === "POST") {
      const form = await request.formData();
      // Picked from the quick list: same as uploading at that tender (files are added to earlier ones).
      const vorgang = String(form.get("vorgang") ?? "");
      if (ID.test(vorgang)) return unterlagenAmVorgang(vorgang, request, env, form);
      return unterlagenOhneTreffer(request, env, {
      pruefen: (dateien) => pruefenUndZaehlen(dateien, env),
      starten: (dateien, kontext) => {
        const profil = Object.entries(profile as Record<string, { firma_id?: string; name: string }>).find(([, p]) => p.firma_id === kontext.firma);
        return starten(env, dateien, { profil: profil?.[0] ?? `firma-${kontext.firma}`, kunde: profil?.[1].name ?? "", titel: kontext.titel, vorgang: kontext.vorgang, ...kiSprache(request) });
      },
      }, form);
    }
    const gw = await gewerke(request, env, ADRESSE, (h) => html(h));
    if (gw) return gw;
    const fr = await metiers(request, env, ADRESSE, (h) => html(h));
    if (fr) return fr;
    const lg = await landGewerke(request, env, ADRESSE, (h) => html(h));
    if (lg) return lg;
    const sam = samAnleitungSeite(request, ADRESSE, (h) => html(h));
    if (sam) return sam;
    const dm = await demo(request, MUSTER.replace(/^>.*\n/m, ""));
    if (dm) return dm;
    const am = await angebote(request, env);
    if (am) return am;
    const fu = await firmenunterlagen(request, env);
    if (fu) return fu;
    const rf = await referenzen(request, env);
    if (rf) return rf;
    const pr = await protokoll(request, env);
    if (pr) return pr;
    const pi = await personalImport(request, env);
    if (pi) return pi;
    const sf = await suchfilter(request, env);
    if (sf) return sf;
    const ke = await kontoEinstellungen(request, env);
    if (ke) return ke;
    const au = await angebotsUebersicht(request, env);
    if (au) return au;
    const ag = await aueg(request, env);
    if (ag) return ag;
    const fp = await foerderung(request, env);
    if (fp) return fp;
    const ra = await radar(request, env);
    if (ra) return ra;
    const lf = await auftraege(request, env);
    if (lf) return lf;
    const ag2 = await auftraggeberSeite(request, env);
    if (ag2) return ag2;
    const aw = await auswertung(request, env);
    if (aw) return aw;
    const lvr = await leistungsverzeichnis(request, env);
    if (lvr) return lvr;
    const tb = await textbausteineSeite(request, env);
    if (tb) return tb;
    const pv = await partnerVerwalten(request, env);
    if (pv) return pv;
    const dp = await disposition(request, env);
    if (dp) return dp;
    const mv = await mitarbeiterVerwalten(request, env);
    if (mv) return mv;
    const fg = await freigaben(request, env);
    if (fg) return fg;
    const ma = await markt(request, env);
    if (ma) return ma;
    const ep = await einsatzplan(request, env);
    if (ep) return ep;
    const fp2 = await firmenprofil(request, env);
    if (fp2) return fp2;
    const pa = await personalakte(request, env);
    if (pa) return pa;
    const uw = await unterweisungen(request, env);
    if (uw) return uw;
    const ps = await personalsuche(request, env);
    if (ps) return ps;
    for (const route of [kundenlinkOeffentlich, kundenlinkErstellen, kundenportal, boerse, nachkalkulationRoute, umsatzsteuer, rechnungen, belege, rundgaenge, lohn, spesen, zeitkontoRoute, kraefteEinladen, betreiber, organisation, vertretung, aufgaben, betriebsmittel, kapazitaetSeiteRoute, ich, stundenRoute, schichtenRoute, brett, chat, personalfristen, kundenSeiteRoute, leistungsnachweis, psa, bewerber, checklisten, urlaub, bewertungen, personalauswertung]) {
      const r = await route(request, env);
      if (r) return r;
    }
    const usp = await usProfil(request, env);
    if (usp) return usp;
    const usr = await usRadar(request, env);
    if (usr) return usr;
    const pe = await personal(request, env);
    if (pe) return pe;
    const e = await einrichtung(request, env, (firma) => Object.values(profile as Record<string, { firma_id?: string; beschreibung: string }>).find((p) => p.firma_id === firma)?.beschreibung ?? "");
    if (e) return e;
    const k = await konto(request, env, (firma) => Object.values(profile as Record<string, { firma_id?: string; beschreibung: string }>).find((p) => p.firma_id === firma));
    if (k) return k;
    if (request.method === "GET") {
      const titel = url.searchParams.get("titel");
      const lp = url.pathname.match(/^\/([a-z]{2})\/?$/);
      if ((url.pathname === "/" && titel === null) || (lp && ISO2[lp[1].toUpperCase()])) return landesStart(request, url, lp?.[1]);
      if (url.pathname === "/" || url.pathname === "/hochladen") return html(formular("", titel ?? ""));
      const recht = RECHT[url.pathname];
      const rs = appSprache(request);
      const uebersetzt = rs === "fr" ? [RECHT_FR, hinweisDeutsch] as const : rs === "pl" ? [RECHT_PL, hinweisDeutschPl] as const : rs === "es" ? [RECHT_ES, hinweisDeutschEs] as const : rs === "it" ? [RECHT_IT, hinweisDeutschIt] as const : null;
      if (recht && uebersetzt) {
        // Translation (for information, the German text is binding); the page keeps its language.
        const [titel, inhalt] = uebersetzt[0][url.pathname];
        const r = html(seite(titel, uebersetzt[1](url.pathname) + inhalt()));
        r.headers.set("x-jv-sprache", rs);
        return r;
      }
      if (recht) return html(seite(recht[0], recht[1]()));
    }
    if (url.pathname === "/hochladen" && request.method === "POST") return hochladen(request, env);
    const m = url.pathname.match(/^\/auftrag\/([^/]+)(\/kalkulation|\/arbeitskraefte)?$/);
    if (m && ID.test(m[1]) && m[2] === "/kalkulation" && request.method === "POST") return kalkulieren(m[1], request, env);
    const csv = url.pathname.match(/^\/auftrag\/([^/]+)\/kalkulation\.csv$/);
    if (csv && ID.test(csv[1]) && request.method === "GET") return kalkulationHerunterladen(csv[1], request, env);
    if (m && ID.test(m[1]) && m[2] === "/arbeitskraefte" && request.method === "POST") return arbeitskraefte(m[1], request, env);
    if (m && ID.test(m[1]) && !m[2]) return auftrag(m[1], env, request);
    return html(seite("Nicht gefunden", "<p>Diese Seite gibt es nicht.</p>"), 404);
}

/** One-time deployment probe: the random upload-test code gates a non-writing Hyperdrive/API-budget check. */
async function datenbankPruefen(request: Request, env: Env): Promise<Response> {
  const form = await request.formData().catch(() => null);
  return hyperdrivePruefen(String(form?.get("code") ?? ""), env.TEST_CODE_HASH, env, form?.get("ki") === "1", form?.get("recherche") === "1", form?.get("standorte") === "1");
}

async function hochladen(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const kunde = await kundeZuCode(String(form.get("code") ?? ""), env);
  if (!kunde) return html(formular("Der Zugangscode stimmt nicht."), 403);
  const dateien = auswahl(form);
  const fehler = await pruefenUndZaehlen(dateien, env);
  if (fehler) return html(formular(fehler[0]), fehler[1]);
  const job = await starten(env, dateien, { profil: kunde.profil, kunde: kunde.name, titel: String(form.get("titel") ?? "") });
  return Response.redirect(new URL(`/auftrag/${job.id}`, request.url).toString(), 303);
}

/** Upload at a hit in the account: the logged-in user's firm decides the profile, no access code. */
async function unterlagenAmVorgang(id: string, request: Request, env: Env, form?: FormData): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) return Response.redirect(new URL("/konto", request.url).toString(), 303);
  const zurueck = (fehler = "") => {
    const h = new Headers({ location: `/konto/vorgang/${id}${fehler ? `?fehler=${encodeURIComponent(fehler)}#unterlagen` : ""}` });
    for (const c of z.s.cookies) h.append("set-cookie", c);
    return new Response(null, { status: 303, headers: h });
  };
  if (z.rolle === "leser") return zurueck("Als Leser kannst du keine Unterlagen hochladen. Frag einen Admin deiner Firma.");
  const dateien = auswahl(form ?? (await request.formData()));
  const fehler = await pruefenUndZaehlen(dateien, env);
  if (fehler) return zurueck(fehler[0]);
  const eintrag = Object.entries(profile as Record<string, { firma_id?: string; name: string }>).find(([, p]) => p.firma_id === z.v.firma_id);
  // Files sent later are added to the earlier ones, so the Steckbrief covers everything.
  const vorher = (await jsonAus<{ auftrag: string }>(env, `auftraege/vorgaenge/${id}.json`))?.auftrag;
  const job = await starten(env, dateien, {
    profil: eintrag?.[0] ?? `firma-${z.v.firma_id}`,
    kunde: eintrag?.[1].name ?? "",
    titel: [z.v.titel, z.v.link].filter(Boolean).join(" – "),
    vorgang: id,
    ...kiSprache(request),
  }, vorher, z.v.steckbrief ?? undefined);
  await env.DATEN.put(`auftraege/vorgaenge/${id}.json`, JSON.stringify({ auftrag: job.id, erstellt: job.erstellt }));
  return zurueck();
}

function auswahl(form: FormData): File[] {
  return form.getAll("dateien").filter((f): f is File => typeof f !== "string" && f.size > 0);
}

async function pruefenUndZaehlen(dateien: File[], env: Env): Promise<[string, number] | null> {
  if (!dateien.length) return ["Bitte mindestens eine Datei auswählen.", 400];
  if (dateien.length > MAX_FILES || dateien.reduce((s, f) => s + f.size, 0) > MAX_BYTES) {
    return [`Zu viel auf einmal: höchstens ${MAX_FILES} Dateien und 60 MB.`, 413];
  }
  if (!(await zaehlen(env))) return ["Heute sind keine Prüfungen mehr frei. Bitte morgen noch einmal versuchen.", 429];
  return null;
}

/** Stores the files in R2 and starts the Steckbrief workflow. */
async function starten(env: Env, dateien: File[], daten: Omit<Job, "id" | "erstellt">, vorher?: string, bekanntmachung?: string): Promise<Job> {
  const job: Job = { ...daten, titel: daten.titel.slice(0, 300), id: crypto.randomUUID(), erstellt: new Date().toISOString() };
  const dir = `auftraege/${job.id}`;
  const namen = new Set<string>();
  for (const f of dateien) {
    const name = f.name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(-120) || "datei";
    namen.add(name);
    await env.DATEN.put(`${dir}/dateien/${name}`, f.stream());
  }
  if (vorher && ID.test(vorher)) {
    const alt = `auftraege/${vorher}/dateien/`;
    for (const obj of (await env.DATEN.list({ prefix: alt })).objects) {
      const name = obj.key.slice(alt.length);
      if (namen.has(name)) continue; // a new upload with the same name replaces the old file
      const inhalt = await env.DATEN.get(obj.key);
      if (inhalt) await env.DATEN.put(`${dir}/dateien/${name}`, inhalt.body);
    }
  }
  // The Steckbrief from the public notice: the workflow merges it with the documents instead of dropping it.
  if (bekanntmachung) await env.DATEN.put(`${dir}/bekanntmachung.md`, bekanntmachung);
  await env.DATEN.put(`${dir}/auftrag.json`, JSON.stringify(job));
  await env.STECKBRIEF.create({ id: job.id, params: job });
  return job;
}

async function auftrag(id: string, env: Env, request: Request): Promise<Response> {
  const meta = await env.DATEN.get(`auftraege/${id}/auftrag.json`);
  if (!meta) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr). Unterlagen werden nach 30 Tagen gelöscht.</p>"), 404);
  const job = (await meta.json()) as Job;
  if (!(await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id))) return html(seite("Nicht erlaubt",`<p>Bitte mit einem Konto mit Finanzfreigabe anmelden.</p><p><a href="/konto">Zum Konto</a></p>`),403);
  const ergebnis = await env.DATEN.get(`auftraege/${id}/ergebnis.md`);
  if (ergebnis) return html(seite(job.titel || "Steckbrief", markdown(await ergebnis.text()) + (await kalkulationsTeil(job, env, request)), 0, job.vorgang ? "unterlagen" : undefined));
  let status = "running";
  try {
    status = (await (await env.STECKBRIEF.get(id)).status()).status;
  } catch {
    // instance not visible yet
  }
  if (["errored", "terminated"].includes(status)) {
    return html(seite("Fehler", "<p>Beim Lesen der Unterlagen ist etwas schiefgegangen. Jarvis meldet das an WP Digital Ranger.</p>"));
  }
  return html(seite("Wird geprüft …", `<p>Jarvis liest gerade die Unterlagen${job.titel ? ` zu <strong>${escape(job.titel)}</strong>` : ""}.</p>
    <p>Das dauert meist 2 bis 5 Minuten. Diese Seite lädt sich von selbst neu. Du kannst sie auch schließen und den Link später öffnen.</p>`, 20, job.vorgang ? "unterlagen" : undefined));
}

async function jsonAus<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.DATEN.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

type Gespeichert = { eingaben: Eingaben; mengen: Record<string, number>; proLos?: LosWerte; tarif?: TarifWahl };

/** Lowest wage for the firm: the lowest current sector minimum wage of its agreements (or temp work EG 1), at least the legal minimum. */
async function bodenLaden(s: Sitzung, env: Env, firma: string): Promise<Boden> {
  const vertraege = await db<{ name: string; tarifart: string; katalog_id: string | null; vorgegeben: boolean }[]>(s, env, `firmen_tarifvertraege?firma_id=eq.${firma}&select=name,tarifart,katalog_id,vorgegeben`);
  if (!vertraege.ok) return MINDESTLOHN;
  const heute = new Date().toISOString().slice(0, 10);
  const kandidaten: Boden[] = [];
  if (vertraege.daten.some((v) => v.name === GVP.name)) kandidaten.push({ lohn: lohnAm("1", heute, 0), name: "Zeitarbeitstarif (EG 1)" });
  const ids = vertraege.daten.filter((v) => v.tarifart === "Branchenmindestlohn" && v.katalog_id).map((v) => v.katalog_id!);
  if (ids.length) {
    const saetze = await db<{ tarif_id: string; gruppe: string; betrag: number; gueltig_ab: string }[]>(s, env, `tarifkatalog_saetze?tarif_id=in.(${ids.map(encodeURIComponent).join(",")})&einheit=eq.Stunde&gueltig_ab=lte.${heute}&or=(gueltig_bis.is.null,gueltig_bis.gte.${heute})&select=tarif_id,gruppe,betrag,gueltig_ab&order=gueltig_ab.desc`);
    const aktuell = new Map<string, number>();
    for (const r of saetze.ok ? saetze.daten : []) if (!aktuell.has(`${r.tarif_id}|${r.gruppe}`)) aktuell.set(`${r.tarif_id}|${r.gruppe}`, Number(r.betrag));
    for (const [key, betrag] of aktuell) {
      const v = vertraege.daten.find((x) => x.katalog_id === key.split("|")[0]);
      kandidaten.push({ lohn: betrag, name: `Branchenmindestlohn ${(v?.name ?? "").replace(/ – .*$/, "")}`.trim() });
    }
  }
  const boden = kandidaten.filter((k) => k.lohn > MINDESTLOHN.lohn).sort((a, b) => a.lohn - b.lohn)[0];
  return boden ?? MINDESTLOHN;
}

/** Calculation form below the Steckbrief; remembers the customer's last inputs. */
async function kalkulationsTeil(job: Job, env: Env, request: Request): Promise<string> {
  const lose = (await jsonAus<Los[]>(env, `auftraege/${job.id}/lose.json`)) ?? [];
  const eigene = await jsonAus<Gespeichert>(env, `auftraege/${job.id}/kalkulation.json`);
  const zugriff = job.vorgang ? await vorgangZugriff(request, env, job.vorgang) : null;
  const [firmendaten, bereichsdaten] = zugriff ? await Promise.all([
    db<{ bereich_id: string | null; eingaben: Eingaben }[]>(zugriff.s, env, `kalkulationsvorlagen?firma_id=eq.${zugriff.v.firma_id}&select=bereich_id,eingaben`),
    db<{ id: string; parent_id: string | null }[]>(zugriff.s, env, `bereiche?firma_id=eq.${zugriff.v.firma_id}&select=id,parent_id`),
  ]) : [null, null];
  // Wage group suggestion per lot from the firm's own staff: same occupation, preferably at the same location.
  const [personal, tarifliste] = zugriff ? await Promise.all([
    db<{ vorname: string; nachname: string; berufe: string[]; eg: string | null; tarifvertrag_id: string | null; bereich_id: string | null }[]>(zugriff.s, env, `personal?firma_id=eq.${zugriff.v.firma_id}&eg=not.is.null&select=vorname,nachname,berufe,eg,tarifvertrag_id,bereich_id&limit=500`),
    db<{ id: string; name: string }[]>(zugriff.s, env, `firmen_tarifvertraege?firma_id=eq.${zugriff.v.firma_id}&select=id,name`),
  ]) : [null, null];
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ausPersonal = (l: Los) => {
    const woerter = norm(`${l.taetigkeit ?? ""} ${l.name}`).split(/[^a-z]+/).filter((w) => w.length >= 4);
    const passend = (personal?.ok ? personal.daten : []).filter((k) => k.eg && GVP.gruppen.includes(k.eg) && k.berufe.some((b) => woerter.some((w) => norm(b).includes(w) || w.includes(norm(b).slice(0, 6)))));
    const k = passend.find((x) => x.bereich_id && x.bereich_id === zugriff?.v.bereich_id) ?? passend[0];
    return k ? { eg: k.eg!, wer: `${k.vorname} ${k.nachname}`.trim(), beruf: k.berufe[0], tarif: tarifliste?.ok ? tarifliste.daten.find((t) => t.id === k.tarifvertrag_id)?.name : undefined } : null;
  };
  const vorlagenWerte = firmendaten?.ok ? vorlageFuerBereich(zugriff?.v.bereich_id, bereichsdaten?.ok ? bereichsdaten.daten : [], firmendaten.daten) : undefined;
  // Templates (F4): sector starting values or the firm's saved templates, loaded with ?vorlage=… until "Berechnen".
  const [profile_, boden, katalog] = zugriff ? await Promise.all([
    db<{ id: string; name: string; eingaben: Partial<Eingaben> }[]>(zugriff.s, env, `kalkulationsprofile?firma_id=eq.${zugriff.v.firma_id}&select=id,name,eingaben&order=name`),
    bodenLaden(zugriff.s, env, zugriff.v.firma_id),
    zugriff.v.katalog_id ? db<{ cpv: string[] }[]>(zugriff.s, env, `vergabekatalog?id=eq.${encodeURIComponent(zugriff.v.katalog_id)}&select=cpv`) : Promise.resolve(null),
  ]) : [null, MINDESTLOHN, null];
  const eigeneVorlagen = profile_?.ok ? profile_.daten : [];
  const wahl = new URL(request.url).searchParams.get("vorlage") ?? "";
  const geladen = wahl.startsWith("b:") ? BRANCHEN_VORLAGEN[wahl.slice(2)] ? { name: BRANCHEN_VORLAGEN[wahl.slice(2)].name, werte: BRANCHEN_VORLAGEN[wahl.slice(2)].werte } : null
    : wahl.startsWith("p:") ? (() => { const p = eigeneVorlagen.find((x) => x.id === wahl.slice(2)); return p ? { name: p.name, werte: p.eingaben } : null; })() : null;
  const vorlage = { ...STANDARD, ...(vorlagenWerte ?? (await jsonAus<Eingaben>(env, `kunden/${job.profil}/kalkulation.json`)) ?? {}), ...(eigene?.eingaben ?? {}), ...(geladen?.werte ?? {}) };
  const mengen = eigene?.mengen ?? {};
  const proLos = eigene?.proLos ?? {};
  const tarif = eigene?.tarif ?? standardTarif();
  const heute = new Date().toISOString().slice(0, 10);
  const egOptionen = (gewaehlt?: string, vorschlag?: string) => `<option value="">eigener Stundenlohn</option>${GVP.gruppen.map((g) => `<option value="${g}"${g === gewaehlt ? " selected" : ""}>EG ${g} (heute ${fmt(lohnAm(g, heute, 0))} €)${g === vorschlag ? " – Vorschlag" : ""}</option>`).join("")}`;
  const ohneArbeitskraft = lose.length > 0 && lose.every((l) => l.taetigkeit === undefined);
  // Collective wages: lots with a wage group get the average tariff wage over the contract period.
  const tarifFelder = `<fieldset><legend>Tarif Zeitarbeit (${GVP.name})</legend>
      <span class="klein">Wähle unten pro Los eine Entgeltgruppe. Jarvis rechnet den Durchschnittslohn über die Laufzeit, mit den bekannten Erhöhungen. Quelle: ${GVP.quelle}.</span>
      <label>Vertragsbeginn<input type="date" name="tarif_beginn" value="${escape(tarif.beginn)}"></label>
      <label>Vertragslaufzeit (Monate)<input name="tarif_monate" inputmode="numeric" value="${tarif.monate}"></label>
      <label>Erwartete Erhöhung pro Jahr nach der letzten bekannten Tabelle (%)<input name="tarif_steigerung" inputmode="decimal" value="${fmt(tarif.steigerung)}"></label>
      <label class="zeile"><input type="checkbox" name="tarif_erfahrung" value="1"${tarif.erfahrung ? " checked" : ""}> Erfahrungszuschläge einrechnen (1,5 % nach 9, 3 % nach 12 Monaten beim selben Kunden)</label>
    </fieldset>`;
  const felder = felderHtml(vorlage, false, tarifSchnellwahl(GVP.gruppen.map((g) => ({ eg: g, lohn: lohnAm(g, heute, 0) })))) + tarifFelder;
  // Per lot: hours, own wage (empty = standard) and "away from home" for accommodation costs.
  // Lots: the workforce from the documents and the suggested wage group are filled in until the user changes them.
  const loseFelder = lose.map((l) => {
    const personalVorschlag = ausPersonal(l);
    const eg = eigene ? proLos[l.nr]?.eg : (proLos[l.nr]?.eg ?? l.eg ?? personalVorschlag?.eg) || undefined;
    const vorschlag = l.eg && GVP.merkmale[l.eg] ? `<p class="klein">📜 Vorschlag laut Tarifvertrag: <strong>EG ${escape(l.eg)}</strong>${l.eg_grund ? ` – ${escape(l.eg_grund)}` : ""}<br>Merkmal EG ${escape(l.eg)}: „${escape(GVP.merkmale[l.eg])}“</p>` : "";
    return `<fieldset data-los="${escape(l.nr)}"><legend>Los ${escape(l.nr)}: ${escape(l.name)}</legend>
      ${l.taetigkeit ? `<p>👷 <strong>Gebraucht:</strong> ${escape(l.taetigkeit)}</p>` : ""}${vorschlag}${personalVorschlag ? `<p class="klein">👥 Aus eurem Personal: <strong>EG ${escape(personalVorschlag.eg)}</strong> wie ${escape(personalVorschlag.wer)} (${escape(personalVorschlag.beruf)}${personalVorschlag.tarif ? `, ${escape(personalVorschlag.tarif)}` : ""})</p>` : ""}
      <label>Stunden${l.zeitraum ? ` (${escape(l.zeitraum)})` : ""}<input name="los_${escape(l.nr)}" inputmode="decimal" value="${fmt(mengen[l.nr] ?? losStunden(l))}"></label>
      <label>Entgeltgruppe<select name="eg_${escape(l.nr)}">${egOptionen(eg, l.eg)}</select></label>
      ${eg ? `<p class="klein">Tariflohn EG ${escape(eg)}: heute ${euro(lohnAm(eg, heute, 0))}, im Schnitt über ${tarif.monate} Monate ab ${escape(tarif.beginn)} ${euro(tariflohn(eg, tarif))} pro Stunde.</p>` : ""}
      <label>Eigener Stundenlohn (€, leer = Standard; gilt nur ohne Entgeltgruppe)<input name="lohn_${escape(l.nr)}" inputmode="decimal" value="${proLos[l.nr]?.lohn ? fmt(proLos[l.nr].lohn!) : ""}" placeholder="${fmt(vorlage.lohn)}"></label>
      <label class="zeile"><input type="checkbox" name="auswaerts_${escape(l.nr)}" value="1"${proLos[l.nr]?.auswaerts ? " checked" : ""}> Auswärts mit Unterkunft</label>
      ${l.hinweis ? `<span class="klein">${escape(l.hinweis)}</span>` : ""}</fieldset>`;
  }).join("");
  const losWahl = lose.length > 1 ? `<label>Los wählen<select data-los-wahl><option value="">Alle Lose</option>${lose.map((l) => `<option value="${escape(l.nr)}">Los ${escape(l.nr)}: ${escape(l.name.length > 60 ? `${l.name.slice(0, 57)}…` : l.name)}</option>`).join("")}</select></label>` : "";
  let ergebnis = "";
  if (eigene) {
    const r = rechnen(eigene.eingaben, lose, eigene.mengen, proLos, tarif, boden);
    // Award comparison (F1): similar tenders by CPV group or key words of the title.
    const zuschlaege = zugriff ? await db<Zuschlag[]>(zugriff.s, env, "rpc/zuschlag_vergleich", { method: "POST", body: JSON.stringify({ f: zugriff.v.firma_id, worte: vergleichsWorte(zugriff.v.titel), cpv: katalog?.ok ? katalog.daten[0]?.cpv ?? [] : [], ohne: zugriff.v.katalog_id ?? "" }) }) : null;
    // Awards are totals over the whole term: lots counted per year are scaled to the contract term.
    const faktor = laufzeitFaktor(lose, tarif.monate);
    const selbstkosten = rechnen({ ...eigene.eingaben, gewinn: 0 }, lose, eigene.mengen, proLos, tarif, boden).netto;
    const varianten = szenarien(eigene.eingaben, lose, eigene.mengen, proLos, tarif);
    ergebnis = `<h3>Ergebnis</h3>
      ${r.warnungen.map((w) => `<p class="fehler">⚠️ ${escape(w)}</p>`).join("")}
      <div class="szenarien">${varianten.map((v) => `<div class="szenario${v.name === "Normal" ? " normal" : ""}"><span>${v.name}</span><strong>${euro(v.preis)}</strong><small>pro Std. · Gewinn ${fmt(v.gewinn)} %${v.netto ? `<br>${euro(v.netto)} netto` : ""}</small></div>`).join("")}</div>
      <p class="untergrenze${r.preisProStunde < r.untergrenze ? " fehler" : ""}"><span>🛑 Preisuntergrenze <strong>${euro(r.untergrenze)}</strong> pro Std.</span><span class="klein">${escape(r.boden.name)} ${fmt(r.boden.lohn)} € mit euren Kosten, ohne Gewinn. Darunter verliert ihr mit jeder Stunde Geld.</span></p>
      ${preisGrafik(r.schritte, r.preisProStunde)}
      ${zuschlaege ? zuschlagVergleich(runden(r.netto * faktor), zuschlaege.ok ? zuschlaege.daten.map((z) => ({ ...z, wert: Number(z.wert) })) : [], runden(selbstkosten * faktor), faktor !== 1 ? `über ${tarif.monate} Monate Laufzeit` : "") : ""}
      ${job.vorgang && zugriff && zugriff.rolle !== "leser" && r.lose.length ? `<p class="angebot-uebernehmen"><a class="knopf" href="/konto/vorgang/${job.vorgang}/angebot?neu=1">➡️ Preise pro Los ins Angebot übernehmen</a></p>` : ""}
      <p class="export-leiste"><a class="knopf zweit" href="/auftrag/${job.id}/kalkulation.csv" download>📊 Als Excel (CSV)</a><button type="button" class="zweit" data-drucken>🖨️ Drucken / PDF</button></p>
      <div class="tabelle"><table><tbody>
        ${r.schritte.map((s) => `<tr><td>${escape(s.name)}</td><td>${euro(s.betrag)}</td></tr>`).join("")}
        <tr><th>Angebotspreis pro Stunde (netto)</th><th>${euro(r.preisProStunde)}</th></tr>
      </tbody></table></div>
      ${r.lose.length ? stapeln(`<table><thead><tr><th>Los</th><th>Lohn</th><th>Preis/Std</th><th>Stunden</th><th>Netto</th></tr></thead><tbody>
        ${r.lose.map((z) => `<tr><td>${escape(z.los.nr)} ${escape(z.los.name)}${z.auswaerts ? " (auswärts)" : ""}</td><td>${euro(z.lohn)}${z.eg ? ` (EG ${escape(z.eg)}, Schnitt)` : ""}</td><td>${euro(z.preisProStunde)}</td><td>${fmt(z.stunden)}</td><td>${euro(z.netto)}</td></tr>`).join("")}
        <tr><td><strong>Gesamt netto</strong></td><td></td><td></td><td></td><td><strong>${euro(r.netto)}</strong></td></tr>
        <tr><td>Gesamt brutto (19 % USt)</td><td></td><td></td><td></td><td>${euro(r.brutto)}</td></tr>
      </tbody></table>`) : ""}
      <p class="klein">Eine Rechenhilfe, keine Rechtsberatung. Bei Arbeitnehmerüberlassung Tarif bzw. Equal Pay und die Vorgaben im Preisblatt beachten.</p>`;
  }
  const vorlagenWahl = `<form method="get" action="/auftrag/${job.id}#kalkulation" class="vorlage-wahl"><label>Vorlage laden<select name="vorlage" data-sofort-wahl><option value="">Eigene letzte Werte</option><optgroup label="Branchen-Startwerte">${Object.entries(BRANCHEN_VORLAGEN).map(([k, v]) => `<option value="b:${k}"${wahl === `b:${k}` ? " selected" : ""}>${escape(v.name)}</option>`).join("")}</optgroup>${eigeneVorlagen.length ? `<optgroup label="Eure Vorlagen">${eigeneVorlagen.map((p) => `<option value="p:${p.id}"${wahl === `p:${p.id}` ? " selected" : ""}>${escape(p.name)}</option>`).join("")}</optgroup>` : ""}</select></label><noscript><button>Laden</button></noscript></form>${geladen ? `<p class="hinweis" role="status">Vorlage „${escape(geladen.name)}“ geladen${wahl.startsWith("b:") ? " (Erfahrungswerte, bitte prüfen; der Stundenlohn bleibt eurer)" : ""}. Erst „Berechnen“ übernimmt sie für diese Ausschreibung.</p>` : ""}`;
  const vorlageSpeichern = zugriff ? `<details class="vorlage-speichern"><summary>💾 Werte als Vorlage speichern</summary><div class="vorlage-speichern-zeile"><label>Name<input name="vorlage_name" maxlength="60" placeholder="z. B. Gastro Frankfurt"></label><button name="aktion" value="vorlage" class="zweit">Speichern</button></div><p class="klein">Speichert Kosten und Aufschläge (nicht die Stunden der Lose). Gleicher Name überschreibt.</p></details>` : "";
  const gespeichertHinweis = new URL(request.url).searchParams.get("vorlage_gespeichert");
  return `<h2 id="kalkulation">💶 Kalkulation</h2>${gespeichertHinweis ? `<p class="${gespeichertHinweis === "1" ? "erfolg" : "fehler"}" role="status">${gespeichertHinweis === "1" ? "💾 Vorlage gespeichert. Du findest sie oben unter „Vorlage laden“." : "Die Vorlage konnte nicht gespeichert werden (höchstens 30 je Firma)."}</p>` : ""}
    <p>Trag deine Werte ein. Jarvis rechnet den Preis pro Stunde und pro Los aus und merkt sich deine Werte für die nächste Ausschreibung.</p>
    ${ergebnis}
    ${ohneArbeitskraft ? `<form method="post" action="/auftrag/${job.id}/arbeitskraefte"><p class="klein">Diese Unterlagen wurden vor der Arbeitskräfte-Erkennung geprüft.</p><button>👷 Arbeitskräfte und Entgeltgruppen erkennen</button><span class="klein">Dauert etwa 20 Sekunden.</span></form>` : ""}
    ${await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true) ? `${vorlagenWahl}<form method="post" action="/auftrag/${job.id}/kalkulation">
      ${felder}
      ${loseFelder ? `<h3>Lose, Arbeitskräfte und Löhne</h3>${losWahl}${loseFelder}` : ""}
      ${vorlageSpeichern}
      <button>Berechnen</button>
    </form>` : `<p>Als Leser kannst du die Kalkulation ansehen, aber nicht ändern.</p>`}`;
}

async function kalkulationHerunterladen(id: string, request: Request, env: Env): Promise<Response> {
  const job = await jsonAus<Job>(env, `auftraege/${id}/auftrag.json`);
  const eigene = await jsonAus<Gespeichert>(env, `auftraege/${id}/kalkulation.json`);
  if (!job || !eigene) return html(seite("Nicht gefunden", "<p>Für diesen Auftrag gibt es noch keine Kalkulation.</p>"), 404);
  if (!(await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true))) return html(seite("Nicht erlaubt","<p>Für die Kalkulation brauchst du eine Finanzfreigabe.</p>"),403);
  const lose = (await jsonAus<Los[]>(env, `auftraege/${id}/lose.json`)) ?? [];
  const r = rechnen(eigene.eingaben, lose, eigene.mengen, eigene.proLos ?? {}, eigene.tarif ?? standardTarif());
  return new Response(kalkulationCsv(r), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="kalkulation-${id.slice(0, 8)}.csv"`, "cache-control": "private, no-store" } });
}

async function kalkulieren(id: string, request: Request, env: Env): Promise<Response> {
  const job = await jsonAus<Job>(env, `auftraege/${id}/auftrag.json`);
  if (!job) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr).</p>"), 404);
  if (!(await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true))) return html(seite("Nicht erlaubt","<p>Für die Kalkulation brauchst du eine Finanzfreigabe.</p>"),403);
  const form = await request.formData();
  const eingaben = Object.fromEntries(FELDER.map((f) => [f.key, zahl(form.get(f.key), STANDARD[f.key])])) as Eingaben;
  const lose = (await jsonAus<Los[]>(env, `auftraege/${id}/lose.json`)) ?? [];
  const mengen = Object.fromEntries(lose.map((l) => [l.nr, zahl(form.get(`los_${l.nr}`), 0)]));
  const proLos: LosWerte = Object.fromEntries(lose.map((l) => {
    const eg = String(form.get(`eg_${l.nr}`) ?? "");
    return [l.nr, { lohn: zahl(form.get(`lohn_${l.nr}`), 0) || undefined, auswaerts: form.get(`auswaerts_${l.nr}`) === "1", eg: GVP.gruppen.includes(eg) ? eg : undefined }];
  }));
  const beginn = String(form.get("tarif_beginn") ?? "");
  const tarif: TarifWahl = {
    beginn: /^\d{4}-\d{2}-\d{2}$/.test(beginn) ? beginn : standardTarif().beginn,
    monate: Math.min(120, Math.max(1, Math.round(zahl(form.get("tarif_monate"), 24)))),
    steigerung: Math.min(20, zahl(form.get("tarif_steigerung"), 3)),
    erfahrung: form.get("tarif_erfahrung") === "1",
  };
  await env.DATEN.put(`auftraege/${id}/kalkulation.json`, JSON.stringify({ eingaben, mengen, proLos, tarif }));
  await env.DATEN.put(`kunden/${job.profil}/kalkulation.json`, JSON.stringify(eingaben));
  // "Als Vorlage speichern" (F4): costs and margins under a name, same name overwrites.
  const vorlageName = String(form.get("vorlage_name") ?? "").trim().slice(0, 60);
  if (form.get("aktion") === "vorlage" && vorlageName && job.vorgang) {
    const z = await vorgangZugriff(request, env, job.vorgang);
    const r = z ? await db(z.s, env, "kalkulationsprofile?on_conflict=firma_id,name", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: z.v.firma_id, name: vorlageName, eingaben }) }) : null;
    return Response.redirect(new URL(`/auftrag/${id}?vorlage_gespeichert=${r?.ok ? "1" : "0"}#kalkulation`, request.url).toString(), 303);
  }
  return Response.redirect(new URL(`/auftrag/${id}#kalkulation`, request.url).toString(), 303);
}

/** Older Steckbriefe: read workforce and wage group per lot once (cheap call on the finished Steckbrief). */
async function arbeitskraefte(id: string, request: Request, env: Env): Promise<Response> {
  const job = await jsonAus<Job>(env, `auftraege/${id}/auftrag.json`);
  if (!job) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr).</p>"), 404);
  if (!(await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true))) return html(seite("Nicht erlaubt","<p>Für die Kalkulation brauchst du eine Finanzfreigabe.</p>"),403);
  const ergebnis = await env.DATEN.get(`auftraege/${id}/ergebnis.md`);
  if (ergebnis) {
    const { lose } = await loseLesen(apiClient(env, firmaVonProfil(job.profil, profile as Record<string, { firma_id?: string }>)), await ergebnis.text());
    if (lose.length) await env.DATEN.put(`auftraege/${id}/lose.json`, JSON.stringify(lose));
  }
  return Response.redirect(new URL(`/auftrag/${id}#kalkulation`, request.url).toString(), 303);
}

async function kundeZuCode(code: string, env: Env): Promise<{ profil: string; name: string } | null> {
  const clean = code.trim();
  if (clean.length < 8) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clean));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (env.TEST_CODE_HASH && hash === env.TEST_CODE_HASH) return { profil: "jarvis-test", name: "Öffentlicher Funktionstest" };
  return (kunden as Record<string, { profil: string; name: string }>)[hash] ?? null;
}

/** Daily cap on processed uploads (cost brake). */
async function zaehlen(env: Env): Promise<boolean> {
  const key = `zaehler/${new Date().toISOString().slice(0, 10)}`;
  const n = Number((await (await env.DATEN.get(key))?.text()) ?? 0);
  if (n >= Number(env.TAGES_LIMIT)) return false;
  await env.DATEN.put(key, String(n + 1));
  return true;
}

function formular(fehler = "", titel = ""): string {
  return seite("Unterlagen prüfen lassen", `
    ${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
    <p>Lade die Vergabeunterlagen einer Ausschreibung hoch (PDF, Word, Excel oder ZIP). Jarvis schreibt daraus einen Steckbrief: Fristen, Leistungen, Nachweise, ob es zu dir passt, und rechnet mit deinen Löhnen den Angebotspreis aus.</p>
    <p class="klein">So kommst du an die Unterlagen: In der Ausschreibung auf „Zur Ausschreibung“ tippen, beim Portal „Vergabeunterlagen“ öffnen und „Alle herunterladen“ wählen (meist eine ZIP-Datei). Die Datei hier hochladen.</p>
    <form method="post" action="/hochladen" enctype="multipart/form-data">
      <label>Zugangscode<input name="code" type="password" autocomplete="current-password" required minlength="8"></label>
      <label>Ausschreibung (Titel oder Link, freiwillig)<input name="titel" maxlength="300" value="${escape(titel.slice(0, 300))}"></label>
      <label>Unterlagen<input name="dateien" type="file" multiple required accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label>
      <button>Prüfen lassen</button>
    </form>
    <p class="klein">Die Unterlagen werden nur für diesen Steckbrief gelesen und nach 30 Tagen gelöscht.</p>`);
}

/** Public start page for the visitor's country and language (see besucher.ts). */
function landesStart(request: Request, url: URL, ausAdresse?: string): Response {
  const b = besucher(request, ausAdresse);
  const gewaehlt = url.searchParams.get("sprache");
  if (gewaehlt && (SPRACHEN_OEFFENTLICH as readonly string[]).includes(gewaehlt)) b.sprache = gewaehlt as Sprache;
  const deutsch = b.land === "DE" && b.sprache === "de";
  const zusatz = startseite(markdown(MUSTER.replace(/^>.*\n/m, "")));
  const l = landesSeite(b, ADRESSE, "");
  const body = deutsch ? `${zusatz}${landWahl(b)}<p class="klein">${keineBehoerde("de")}</p>` : l.inhalt;
  const r = html(kopfZeile(seite(deutsch ? "Jarvis" : l.titel, body), b.sprache).replace('<html lang="de"', `<html lang="${b.sprache}"`).replace("</title>", `</title>${l.kopf}`));
  r.headers.delete("x-robots-tag");
  r.headers.set("vary", "cookie, accept-language");
  r.headers.set("cache-control", "private, no-store");
  for (const c of wahlCookies(ausAdresse ?? null, gewaehlt)) r.headers.append("set-cookie", c);
  return r;
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
}
