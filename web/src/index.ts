// Jarvis upload page: customers upload tender documents, a Workflow writes the Steckbrief.
import kunden from "../kunden.json";
import { euro, FELDER, fmt, rechnen, STANDARD, zahl, type Eingaben, type Los } from "./kalkulation";
import profile from "../../alarm/profile.json";
import { CSP, statisch } from "./app";
import { unterlagenOhneTreffer } from "./unterlagen";
import { einrichtung } from "./einrichtung";
import { db, konto, vorgangZugriff, type KontoEnv } from "./konto";
import MUSTER from "../../alarm/steckbriefe/muster-bundesbank-leihpersonal-gastronomie.md";
import { avv, datenschutz, impressum, nutzungsbedingungen, startseite } from "./rechtliches";
import { escape, markdown, seite } from "./seite";

export { Steckbrief } from "./workflow";

export interface Env extends KontoEnv {
  DATEN: R2Bucket;
  AI: Ai;
  STECKBRIEF: Workflow<Job>;
  ANTHROPIC_API_KEY: string;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const datei = request.method === "GET" ? statisch(url.pathname) : null;
    if (datei) return datei;
    const u = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/unterlagen$/);
    if (u && request.method === "POST") return unterlagenAmVorgang(u[1], request, env);
    if (url.pathname === "/konto/unterlagen" && request.method === "POST") return unterlagenOhneTreffer(request, env, {
      pruefen: (dateien) => pruefenUndZaehlen(dateien, env),
      starten: (dateien, kontext) => {
        const profil = Object.entries(profile as Record<string, { firma_id?: string; name: string }>).find(([, p]) => p.firma_id === kontext.firma);
        return starten(env, dateien, { profil: profil?.[0] ?? `firma-${kontext.firma}`, kunde: profil?.[1].name ?? "", titel: kontext.titel, vorgang: kontext.vorgang });
      },
    });
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
    const m = url.pathname.match(/^\/auftrag\/([^/]+)(\/kalkulation)?$/);
    if (m && ID.test(m[1]) && m[2] && request.method === "POST") return kalkulieren(m[1], request, env);
    if (m && ID.test(m[1]) && !m[2]) return auftrag(m[1], env, request);
    return html(seite("Nicht gefunden", "<p>Diese Seite gibt es nicht.</p>"), 404);
  },
};


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
async function unterlagenAmVorgang(id: string, request: Request, env: Env): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) return Response.redirect(new URL("/konto", request.url).toString(), 303);
  const zurueck = (fehler = "") => {
    const h = new Headers({ location: `/konto/vorgang/${id}${fehler ? `?fehler=${encodeURIComponent(fehler)}#unterlagen` : ""}` });
    for (const c of z.s.cookies) h.append("set-cookie", c);
    return new Response(null, { status: 303, headers: h });
  };
  if (z.rolle === "leser") return zurueck("Als Leser kannst du keine Unterlagen hochladen. Frag einen Admin deiner Firma.");
  const dateien = auswahl(await request.formData());
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

type Gespeichert = { eingaben: Eingaben; mengen: Record<string, number> };

/** Calculation form below the Steckbrief; remembers the customer's last inputs. */
async function kalkulationsTeil(job: Job, env: Env, request: Request): Promise<string> {
  const lose = (await jsonAus<Los[]>(env, `auftraege/${job.id}/lose.json`)) ?? [];
  const eigene = await jsonAus<Gespeichert>(env, `auftraege/${job.id}/kalkulation.json`);
  const zugriff = job.vorgang ? await vorgangZugriff(request, env, job.vorgang) : null;
  const firmendaten = zugriff ? await db<{ eingaben: Eingaben }[]>(zugriff.s, env, `kalkulationsvorlagen?firma_id=eq.${zugriff.v.firma_id}&bereich_id=is.null&select=eingaben`) : null;
  const firmenwerte = firmendaten?.ok ? firmendaten.daten[0]?.eingaben : undefined;
  const vorlage = { ...STANDARD, ...(eigene?.eingaben ?? firmenwerte ?? (await jsonAus<Eingaben>(env, `kunden/${job.profil}/kalkulation.json`))) };
  const mengen = eigene?.mengen ?? {};
  const felder = FELDER.map((f) => `<label>${f.label} (${f.einheit})<input name="${f.key}" inputmode="decimal" value="${fmt(vorlage[f.key])}"><span class="klein">${f.hilfe}</span></label>`).join("");
  const loseFelder = lose.map((l) => `<label>Los ${escape(l.nr)}: ${escape(l.name)} – Stunden${l.zeitraum ? ` (${escape(l.zeitraum)})` : ""}
      <input name="los_${escape(l.nr)}" inputmode="decimal" value="${fmt(mengen[l.nr] ?? (/stunde|std/i.test(l.einheit) ? l.menge : 0))}">
      ${l.hinweis ? `<span class="klein">${escape(l.hinweis)}</span>` : ""}</label>`).join("");
  let ergebnis = "";
  if (eigene) {
    const r = rechnen(eigene.eingaben, lose, eigene.mengen);
    ergebnis = `<h3>Ergebnis</h3>
      ${r.warnungen.map((w) => `<p class="fehler">⚠️ ${escape(w)}</p>`).join("")}
      <div class="tabelle"><table><tbody>
        ${r.schritte.map((s) => `<tr><td>${escape(s.name)}</td><td>${euro(s.betrag)}</td></tr>`).join("")}
        <tr><th>Angebotspreis pro Stunde (netto)</th><th>${euro(r.preisProStunde)}</th></tr>
      </tbody></table></div>
      ${r.lose.length ? `<div class="tabelle"><table><thead><tr><th>Los</th><th>Stunden</th><th>Netto</th></tr></thead><tbody>
        ${r.lose.map((z) => `<tr><td>${escape(z.los.nr)} ${escape(z.los.name)}</td><td>${fmt(z.stunden)}</td><td>${euro(z.netto)}</td></tr>`).join("")}
        <tr><th>Gesamt netto</th><th></th><th>${euro(r.netto)}</th></tr>
        <tr><td>Gesamt brutto (19 % USt)</td><td></td><td>${euro(r.brutto)}</td></tr>
      </tbody></table></div>` : ""}
      <p class="klein">Eine Rechenhilfe, keine Rechtsberatung. Bei Arbeitnehmerüberlassung Tarif bzw. Equal Pay und die Vorgaben im Preisblatt beachten.</p>`;
  }
  return `<h2 id="kalkulation">💶 Kalkulation</h2>
    <p>Trag deine Werte ein. Jarvis rechnet den Preis pro Stunde und pro Los aus und merkt sich deine Werte für die nächste Ausschreibung.</p>
    ${ergebnis}
    <form method="post" action="/auftrag/${job.id}/kalkulation">
      ${felder}
      ${loseFelder ? `<h3>Mengen</h3>${loseFelder}` : ""}
      <button>Berechnen</button>
    </form>`;
}

async function kalkulieren(id: string, request: Request, env: Env): Promise<Response> {
  const job = await jsonAus<Job>(env, `auftraege/${id}/auftrag.json`);
  if (!job) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr).</p>"), 404);
  const form = await request.formData();
  const eingaben = Object.fromEntries(FELDER.map((f) => [f.key, zahl(form.get(f.key), STANDARD[f.key])])) as Eingaben;
  const lose = (await jsonAus<Los[]>(env, `auftraege/${id}/lose.json`)) ?? [];
  const mengen = Object.fromEntries(lose.map((l) => [l.nr, zahl(form.get(`los_${l.nr}`), 0)]));
  await env.DATEN.put(`auftraege/${id}/kalkulation.json`, JSON.stringify({ eingaben, mengen }));
  await env.DATEN.put(`kunden/${job.profil}/kalkulation.json`, JSON.stringify(eingaben));
  return Response.redirect(new URL(`/auftrag/${id}#kalkulation`, request.url).toString(), 303);
}

async function kundeZuCode(code: string, env: Env): Promise<{ profil: string; name: string } | null> {
  const clean = code.trim();
  if (clean.length < 8) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clean));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (env.TEST_CODE_HASH && hash === env.TEST_CODE_HASH) return { profil: "perlease", name: "Test" };
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
