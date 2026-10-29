// Jarvis upload page: customers upload tender documents, a Workflow writes the Steckbrief.
import kunden from "../kunden.json";
import { marked } from "marked";
import { escape, seite } from "./seite";

export { Steckbrief } from "./workflow";

export interface Env {
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
    if (url.pathname === "/" && request.method === "GET") return html(formular());
    if (url.pathname === "/hochladen" && request.method === "POST") return hochladen(request, env);
    const m = url.pathname.match(/^\/auftrag\/([^/]+)$/);
    if (m && ID.test(m[1])) return auftrag(m[1], env);
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
  if (ergebnis) return html(seite(job.titel || "Steckbrief", markdown(await ergebnis.text())));
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

function formular(fehler = ""): string {
  return seite("Unterlagen prüfen lassen", `
    ${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
    <p>Lade die Vergabeunterlagen einer Ausschreibung hoch (PDF, Word, Excel oder ZIP). Jarvis schreibt daraus einen Steckbrief: Fristen, Leistungen, Nachweise und ob es zu dir passt.</p>
    <form method="post" action="/hochladen" enctype="multipart/form-data">
      <label>Zugangscode<input name="code" type="password" autocomplete="current-password" required minlength="8"></label>
      <label>Ausschreibung (Titel oder Link, freiwillig)<input name="titel" maxlength="300"></label>
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
