// Jarvis upload page: customers upload tender documents, a Workflow writes the Steckbrief.
import kunden from "../kunden.json";
import { euro, FELDER, felderHtml, fmt, rechnen, STANDARD, zahl, vorlageFuerBereich, type Eingaben, type Los, type LosWerte } from "./kalkulation";
import profile from "../../alarm/profile.json";
import { CSP, statisch } from "./app";
import { unterlagenOhneTreffer } from "./unterlagen";
import { angebote } from "./angebote";
import { darfAuftrag } from "./auftragsrechte";
import { firmenunterlagen } from "./firmenunterlagen";
import { freigaben } from "./freigaben";
import { mitarbeiterVerwalten } from "./mitarbeiter";
import { einrichtung } from "./einrichtung";
import { personal } from "./personal";
import { markt } from "./markt.ts";
import { einsatzplan } from "./einsatzplan";
import { db, konto, sitzung, vorgangZugriff, type KontoEnv } from "./konto";
import MUSTER from "../../alarm/steckbriefe/muster-bundesbank-leihpersonal-gastronomie.md";
import { avv, datenschutz, impressum, nutzungsbedingungen, startseite } from "./rechtliches";
import { escape, markdown, seite, stapeln } from "./seite";
import { GVP, lohnAm, standardTarif, tariflohn, type TarifWahl } from "./tarife";
import { loseLesen } from "./lose";
import { apiClient } from "./api-budget.ts";

export { Steckbrief } from "./workflow";

export interface Env extends KontoEnv {
  DATEN: R2Bucket;
  AI: Ai;
  STECKBRIEF: Workflow<Job>;
  ANTHROPIC_API_KEY: string;
  HYPERDRIVE?: { connectionString: string };
  ACTIONS_TOKEN?: string;
  TEST_CODE_HASH?: string;
  TAGES_LIMIT: string;
}

export type Job = { id: string; profil: string; kunde: string; titel: string; erstellt: string; vorgang?: string };

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
  async fetch(request: Request, env: Env): Promise<Response> {
    // The app lives at app.wpdigitalranger.com; the old workers.dev address forwards there (links in older mails keep working).
    const alt = new URL(request.url);
    if (alt.hostname.endsWith(".workers.dev")) return Response.redirect(`${ADRESSE}${alt.pathname}${alt.search}`, request.method === "GET" || request.method === "HEAD" ? 301 : 308);
    const r = await verarbeiten(request,env);
    if (!new URL(request.url).pathname.startsWith("/auftrag/")) return r;
    const s = await sitzung(request,env);
    const headers = new Headers(r.headers);
    headers.set("cache-control","private, no-store");
    for (const c of s?.cookies ?? []) headers.append("set-cookie",c);
    return new Response(r.body,{status:r.status,statusText:r.statusText,headers});
  },
};

async function verarbeiten(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
        return starten(env, dateien, { profil: profil?.[0] ?? `firma-${kontext.firma}`, kunde: profil?.[1].name ?? "", titel: kontext.titel, vorgang: kontext.vorgang });
      },
      }, form);
    }
    const am = await angebote(request, env);
    if (am) return am;
    const fu = await firmenunterlagen(request, env);
    if (fu) return fu;
    const mv = await mitarbeiterVerwalten(request, env);
    if (mv) return mv;
    const fg = await freigaben(request, env);
    if (fg) return fg;
    const ma = await markt(request, env);
    if (ma) return ma;
    const ep = await einsatzplan(request, env);
    if (ep) return ep;
    const pe = await personal(request, env);
    if (pe) return pe;
    const e = await einrichtung(request, env, (firma) => Object.values(profile as Record<string, { firma_id?: string; beschreibung: string }>).find((p) => p.firma_id === firma)?.beschreibung ?? "");
    if (e) return e;
    const k = await konto(request, env, (firma) => Object.values(profile as Record<string, { firma_id?: string; beschreibung: string }>).find((p) => p.firma_id === firma));
    if (k) return k;
    if (request.method === "GET") {
      const titel = url.searchParams.get("titel");
      if (url.pathname === "/" && titel === null) return html(seite("Jarvis", startseite(markdown(MUSTER.replace(/^>.*\n/m, "")))));
      if (url.pathname === "/" || url.pathname === "/hochladen") return html(formular("", titel ?? ""));
      const recht = RECHT[url.pathname];
      if (recht) return html(seite(recht[0], recht[1]()));
    }
    if (url.pathname === "/hochladen" && request.method === "POST") return hochladen(request, env);
    const m = url.pathname.match(/^\/auftrag\/([^/]+)(\/kalkulation|\/arbeitskraefte)?$/);
    if (m && ID.test(m[1]) && m[2] === "/kalkulation" && request.method === "POST") return kalkulieren(m[1], request, env);
    if (m && ID.test(m[1]) && m[2] === "/arbeitskraefte" && request.method === "POST") return arbeitskraefte(m[1], request, env);
    if (m && ID.test(m[1]) && !m[2]) return auftrag(m[1], env, request);
    return html(seite("Nicht gefunden", "<p>Diese Seite gibt es nicht.</p>"), 404);
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

/** Calculation form below the Steckbrief; remembers the customer's last inputs. */
async function kalkulationsTeil(job: Job, env: Env, request: Request): Promise<string> {
  const lose = (await jsonAus<Los[]>(env, `auftraege/${job.id}/lose.json`)) ?? [];
  const eigene = await jsonAus<Gespeichert>(env, `auftraege/${job.id}/kalkulation.json`);
  const zugriff = job.vorgang ? await vorgangZugriff(request, env, job.vorgang) : null;
  const [firmendaten, bereichsdaten] = zugriff ? await Promise.all([
    db<{ bereich_id: string | null; eingaben: Eingaben }[]>(zugriff.s, env, `kalkulationsvorlagen?firma_id=eq.${zugriff.v.firma_id}&select=bereich_id,eingaben`),
    db<{ id: string; parent_id: string | null }[]>(zugriff.s, env, `bereiche?firma_id=eq.${zugriff.v.firma_id}&select=id,parent_id`),
  ]) : [null, null];
  const vorlagenWerte = firmendaten?.ok ? vorlageFuerBereich(zugriff?.v.bereich_id, bereichsdaten?.ok ? bereichsdaten.daten : [], firmendaten.daten) : undefined;
  const vorlage = { ...STANDARD, ...(vorlagenWerte ?? (await jsonAus<Eingaben>(env, `kunden/${job.profil}/kalkulation.json`)) ?? {}), ...(eigene?.eingaben ?? {}) };
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
      <label>Laufzeit (Monate)<input name="tarif_monate" inputmode="numeric" value="${tarif.monate}"></label>
      <label>Erwartete Erhöhung pro Jahr nach der letzten bekannten Tabelle (%)<input name="tarif_steigerung" inputmode="decimal" value="${fmt(tarif.steigerung)}"></label>
      <label class="zeile"><input type="checkbox" name="tarif_erfahrung" value="1"${tarif.erfahrung ? " checked" : ""}> Erfahrungszuschläge einrechnen (1,5 % nach 9, 3 % nach 12 Monaten beim selben Kunden)</label>
    </fieldset>`;
  const felder = felderHtml(vorlage) + tarifFelder;
  // Per lot: hours, own wage (empty = standard) and "away from home" for accommodation costs.
  // Lots: the workforce from the documents and the suggested wage group are filled in until the user changes them.
  const loseFelder = lose.map((l) => {
    const eg = eigene ? proLos[l.nr]?.eg : (proLos[l.nr]?.eg ?? l.eg) || undefined;
    const vorschlag = l.eg && GVP.merkmale[l.eg] ? `<p class="klein">📜 Vorschlag laut Tarifvertrag: <strong>EG ${escape(l.eg)}</strong>${l.eg_grund ? ` – ${escape(l.eg_grund)}` : ""}<br>Merkmal EG ${escape(l.eg)}: „${escape(GVP.merkmale[l.eg])}“</p>` : "";
    return `<fieldset data-los="${escape(l.nr)}"><legend>Los ${escape(l.nr)}: ${escape(l.name)}</legend>
      ${l.taetigkeit ? `<p>👷 <strong>Gebraucht:</strong> ${escape(l.taetigkeit)}</p>` : ""}${vorschlag}
      <label>Stunden${l.zeitraum ? ` (${escape(l.zeitraum)})` : ""}<input name="los_${escape(l.nr)}" inputmode="decimal" value="${fmt(mengen[l.nr] ?? (/stunde|std/i.test(l.einheit) ? l.menge : 0))}"></label>
      <label>Entgeltgruppe<select name="eg_${escape(l.nr)}">${egOptionen(eg, l.eg)}</select></label>
      ${eg ? `<p class="klein">Tariflohn EG ${escape(eg)}: heute ${euro(lohnAm(eg, heute, 0))}, im Schnitt über ${tarif.monate} Monate ab ${escape(tarif.beginn)} ${euro(tariflohn(eg, tarif))} pro Stunde.</p>` : ""}
      <label>Eigener Stundenlohn (€, leer = Standard; gilt nur ohne Entgeltgruppe)<input name="lohn_${escape(l.nr)}" inputmode="decimal" value="${proLos[l.nr]?.lohn ? fmt(proLos[l.nr].lohn!) : ""}" placeholder="${fmt(vorlage.lohn)}"></label>
      <label class="zeile"><input type="checkbox" name="auswaerts_${escape(l.nr)}" value="1"${proLos[l.nr]?.auswaerts ? " checked" : ""}> Auswärts mit Unterkunft</label>
      ${l.hinweis ? `<span class="klein">${escape(l.hinweis)}</span>` : ""}</fieldset>`;
  }).join("");
  const losWahl = lose.length > 1 ? `<label>Los wählen<select data-los-wahl><option value="">Alle Lose</option>${lose.map((l) => `<option value="${escape(l.nr)}">Los ${escape(l.nr)}: ${escape(l.name.length > 60 ? `${l.name.slice(0, 57)}…` : l.name)}</option>`).join("")}</select></label>` : "";
  let ergebnis = "";
  if (eigene) {
    const r = rechnen(eigene.eingaben, lose, eigene.mengen, proLos, tarif);
    ergebnis = `<h3>Ergebnis</h3>
      ${r.warnungen.map((w) => `<p class="fehler">⚠️ ${escape(w)}</p>`).join("")}
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
  return `<h2 id="kalkulation">💶 Kalkulation</h2>
    <p>Trag deine Werte ein. Jarvis rechnet den Preis pro Stunde und pro Los aus und merkt sich deine Werte für die nächste Ausschreibung.</p>
    ${ergebnis}
    ${ohneArbeitskraft ? `<form method="post" action="/auftrag/${job.id}/arbeitskraefte"><p class="klein">Diese Unterlagen wurden vor der Arbeitskräfte-Erkennung geprüft.</p><button>👷 Arbeitskräfte und Entgeltgruppen erkennen</button><span class="klein">Dauert etwa 20 Sekunden.</span></form>` : ""}
    ${await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true) ? `<form method="post" action="/auftrag/${job.id}/kalkulation">
      ${felder}
      ${loseFelder ? `<h3>Lose, Arbeitskräfte und Löhne</h3>${losWahl}${loseFelder}` : ""}
      <button>Berechnen</button>
    </form>` : `<p>Als Leser kannst du die Kalkulation ansehen, aber nicht ändern.</p>`}`;
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
  return Response.redirect(new URL(`/auftrag/${id}#kalkulation`, request.url).toString(), 303);
}

/** Older Steckbriefe: read workforce and wage group per lot once (cheap call on the finished Steckbrief). */
async function arbeitskraefte(id: string, request: Request, env: Env): Promise<Response> {
  const job = await jsonAus<Job>(env, `auftraege/${id}/auftrag.json`);
  if (!job) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr).</p>"), 404);
  if (!(await darfAuftrag(request,env,job,(key)=>(profile as Record<string,{firma_id?:string}>)[key]?.firma_id,true))) return html(seite("Nicht erlaubt","<p>Für die Kalkulation brauchst du eine Finanzfreigabe.</p>"),403);
  const ergebnis = await env.DATEN.get(`auftraege/${id}/ergebnis.md`);
  if (ergebnis) {
    const { lose } = await loseLesen(apiClient(env), await ergebnis.text());
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
