// Jarvis upload page: customers upload tender documents, a Workflow writes the Steckbrief.
import kunden from "../kunden.json";
import { marked } from "marked";
import { euro, FELDER, fmt, rechnen, STANDARD, zahl, type Eingaben, type Los } from "./kalkulation";
import { konto, type KontoEnv } from "./konto";
import { escape, seite } from "./seite";

export { Steckbrief } from "./workflow";

export interface Env extends KontoEnv {
  DATEN: R2Bucket;
  AI: Ai;
  STECKBRIEF: Workflow<Job>;
  ANTHROPIC_API_KEY: string;
  TEST_CODE_HASH?: string;
  TAGES_LIMIT: string;
}

export type Job = { id: string; profil: string; kunde: string; titel: string; erstellt: string };

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_FILES = 40;
const ID = /^[0-9a-f-]{36}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const k = await konto(request, env);
    if (k) return k;
    if (url.pathname === "/" && request.method === "GET") return html(formular("", url.searchParams.get("titel") ?? ""));
    if (url.pathname === "/hochladen" && request.method === "POST") return hochladen(request, env);
    const m = url.pathname.match(/^\/auftrag\/([^/]+)(\/kalkulation)?$/);
    if (m && ID.test(m[1]) && m[2] && request.method === "POST") return kalkulieren(m[1], request, env);
    if (m && ID.test(m[1]) && !m[2]) return auftrag(m[1], env);
    return html(seite("Nicht gefunden", "<p>Diese Seite gibt es nicht.</p>"), 404);
  },
};

async function hochladen(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const kunde = await kundeZuCode(String(form.get("code") ?? ""), env);
  if (!kunde) return html(formular("Der Zugangscode stimmt nicht."), 403);
  const dateien = form.getAll("dateien").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (!dateien.length) return html(formular("Bitte mindestens eine Datei auswählen."), 400);
  if (dateien.length > MAX_FILES || dateien.reduce((s, f) => s + f.size, 0) > MAX_BYTES) {
    return html(formular(`Zu viel auf einmal: höchstens ${MAX_FILES} Dateien und 60 MB.`), 413);
  }
  if (!(await zaehlen(env))) return html(formular("Heute sind keine Prüfungen mehr frei. Bitte morgen noch einmal versuchen."), 429);

  const job: Job = {
    id: crypto.randomUUID(),
    profil: kunde.profil,
    kunde: kunde.name,
    titel: String(form.get("titel") ?? "").slice(0, 300),
    erstellt: new Date().toISOString(),
  };
  const dir = `auftraege/${job.id}`;
  for (const f of dateien) {
    const name = f.name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(-120) || "datei";
    await env.DATEN.put(`${dir}/dateien/${name}`, f.stream());
  }
  await env.DATEN.put(`${dir}/auftrag.json`, JSON.stringify(job));
  await env.STECKBRIEF.create({ id: job.id, params: job });
  return Response.redirect(new URL(`/auftrag/${job.id}`, request.url).toString(), 303);
}

async function auftrag(id: string, env: Env): Promise<Response> {
  const meta = await env.DATEN.get(`auftraege/${id}/auftrag.json`);
  if (!meta) return html(seite("Nicht gefunden", "<p>Diesen Auftrag gibt es nicht (mehr). Unterlagen werden nach 30 Tagen gelöscht.</p>"), 404);
  const job = (await meta.json()) as Job;
  const ergebnis = await env.DATEN.get(`auftraege/${id}/ergebnis.md`);
  if (ergebnis) return html(seite(job.titel || "Steckbrief", markdown(await ergebnis.text()) + (await kalkulationsTeil(job, env))));
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
    <p>Das dauert meist 2 bis 5 Minuten. Diese Seite lädt sich von selbst neu. Du kannst sie auch schließen und den Link später öffnen.</p>`, 20));
}

async function jsonAus<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.DATEN.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

type Gespeichert = { eingaben: Eingaben; mengen: Record<string, number> };

/** Calculation form below the Steckbrief; remembers the customer's last inputs. */
async function kalkulationsTeil(job: Job, env: Env): Promise<string> {
  const lose = (await jsonAus<Los[]>(env, `auftraege/${job.id}/lose.json`)) ?? [];
  const eigene = await jsonAus<Gespeichert>(env, `auftraege/${job.id}/kalkulation.json`);
  const vorlage = eigene?.eingaben ?? (await jsonAus<Eingaben>(env, `kunden/${job.profil}/kalkulation.json`)) ?? STANDARD;
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

/** Model output may contain text from the documents: escape all HTML, allow only http(s) links. */
function markdown(md: string): string {
  const safe = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(safe, {
    async: false,
    walkTokens(token) {
      if (token.type === "link" && !/^https?:\/\//i.test(token.href)) token.href = "#";
    },
  }) as string;
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
}
