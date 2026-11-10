// "Suche abonnieren" (10.11.2026): under the public search results a visitor leaves an e-mail address and gets the new
// public notices for that search once a week, without an account. Double opt-in (confirmation mail), unsubscribe link in
// every mail (deletes the address). No AI. The weekly mail is sent by alarm/mail.py (such_abos_senden).
//   POST /abo                       form under the results → confirmation mail
//   GET  /abo/bestaetigen/<token>   link in the confirmation mail
//   GET|POST /abo/abmelden/<token>  unsubscribe page / one click (also List-Unsubscribe-Post)
import { escape, seite } from "./seite.ts";
import { ABSENDER, senden, type Mail } from "./mail.ts";
import { FIRMA } from "./rechtliches.ts";
import { katalogDb, type DbEnv } from "./katalog-db.ts";

const EMAIL = /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[a-z]{2,}$/i;
const BASIS = "https://crewtender.eu";
/** The wording the visitor agrees to; stored with the subscription as proof of consent. */
export const EINWILLIGUNG = "Ich möchte einmal pro Woche neue öffentliche Ausschreibungen zu dieser Suche und Hinweise zu Crewtender per E-Mail erhalten. Abmelden kann ich mich jederzeit über den Link in jeder Mail.";

const kurz = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** "Gebäudereinigung in 52" – how a search is named in pages and mails. */
export const suchName = (q: string, ort: string) => [q && `„${q}“`, ort && `in ${ort}`].filter(Boolean).join(" ") || "alle Ausschreibungen";

/** Form under the search results; only when something was searched. data-demo-frei lets it through the demo's form block. */
export function aboFormular(q: string, ort: string): string {
  if (!q && !ort) return "";
  return `<section class="abo-kasten" aria-labelledby="abo-titel"><h2 id="abo-titel">📬 Neue Treffer per E-Mail</h2>
<p>Einmal pro Woche die neuen Ausschreibungen für ${escape(suchName(q, ort))} – kostenlos, ohne Konto.</p>
<form method="post" action="/abo" data-demo-frei><input type="hidden" name="q" value="${escape(q)}"><input type="hidden" name="ort" value="${escape(ort)}">
<label>E-Mail-Adresse<input name="email" type="email" required maxlength="200" autocomplete="email" placeholder="name@firma.de"></label>
<p class="abo-falle" aria-hidden="true"><label>Webseite<input name="webseite" tabindex="-1" autocomplete="off"></label></p>
<label class="haken"><input type="checkbox" name="zustimmung" value="ja" required> <span>${escape(EINWILLIGUNG)} <a href="/datenschutz">Datenschutz</a></span></label>
<button>Abonnieren</button></form></section>`;
}

export function bestaetigungsMail(an: string, q: string, ort: string, token: string): Mail {
  if (!EMAIL.test(an)) throw new Error("Ungültige Empfängeradresse");
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("Ungültiges Token");
  const name = suchName(kurz(q, 120), kurz(ort, 60));
  return {
    from: ABSENDER, to: an, reply: ABSENDER,
    subject: `Bitte bestätigen: neue Ausschreibungen für ${name}`.slice(0, 160),
    text: `Hallo,

auf crewtender.eu wurde diese Adresse für eine wöchentliche Mail mit neuen öffentlichen Ausschreibungen eingetragen:
${name}

Bitte bestätige das mit diesem Link:
${BASIS}/abo/bestaetigen/${token}

Erst danach bekommst du Mails. Wenn du das nicht warst, musst du nichts tun: Ohne Bestätigung löschen wir die Adresse nach 7 Tagen.

Viele Grüße
${FIRMA.name}
Crewtender · ${FIRMA.firma} · ${FIRMA.strasse}, ${FIRMA.ort}
${BASIS}/impressum
`,
  };
}

type AboEnv = DbEnv & { SUPABASE_URL: string; SUPABASE_KEY: string; SMTP_PASSWORD?: string };
async function rpc<T>(env: AboEnv, name: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}
const antwort = (titel: string, inhalt: string, status = 200) => new Response(seite(titel, inhalt), { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
const zurueck = (q: string, ort: string) => `<p><a href="/demo/suche?${new URLSearchParams({ ...(q ? { q } : {}), ...(ort ? { ort } : {}) })}">← Zurück zur Suche</a></p>`;

export const aboSeiten = {
  // The same answer whether the address is new, waiting or already subscribed: the page tells nothing about other people.
  gesendet: (q: string, ort: string) => `<h1>Fast fertig</h1><p role="status">Wir haben dir eine Mail geschickt. Bitte öffne den Link darin – erst dann bekommst du die neuen Ausschreibungen für ${escape(suchName(q, ort))}.</p><p class="klein">Keine Mail da? Schau im Spam-Ordner nach. Ohne Bestätigung löschen wir die Adresse nach 7 Tagen.</p>${zurueck(q, ort)}`,
  fehler: (text: string, q: string, ort: string) => `<h1>Das hat nicht geklappt</h1><p class="fehler" role="alert">${escape(text)}</p>${aboFormular(q, ort)}${zurueck(q, ort)}`,
  bestaetigt: (q: string, ort: string) => `<h1>Abo bestätigt</h1><p role="status">Du bekommst ab jetzt einmal pro Woche die neuen öffentlichen Ausschreibungen für ${escape(suchName(q, ort))}. Die erste Mail kommt, sobald es neue Treffer gibt.</p>
<p>Crewtender kann mehr: Jede Ausschreibung bekommt 1 bis 10 Punkte für deine Firma, dazu Steckbrief, Kalkulation mit deinen Löhnen und Schichtplan.</p>
<p class="aktionsleiste"><a class="knopf" href="/registrieren">30 Tage Pro gratis testen</a> <a class="zweit" href="/demo">Demo ansehen</a></p>`,
  unbekannt: `<h1>Link nicht mehr gültig</h1><p>Dieses Abo gibt es nicht (mehr). Vielleicht wurde es schon abgemeldet, oder die Bestätigung kam später als 7 Tage.</p><p><a href="/demo/suche">Neue Suche starten</a></p>`,
  abmelden: (token: string, q: string, ort: string) => `<h1>Abo abmelden</h1><p>Wöchentliche Mail für ${escape(suchName(q, ort))} beenden? Deine Adresse wird dabei gelöscht.</p><form method="post" action="/abo/abmelden/${token}"><button>Abo beenden</button></form>`,
  abgemeldet: `<h1>Abgemeldet</h1><p role="status">Du bekommst keine Mails mehr zu dieser Suche. Deine Adresse ist gelöscht.</p><p><a href="/">Zur Startseite</a></p>`,
};

/** Routes under /abo; null for other paths. */
export async function suchAbo(request: Request, env: AboEnv): Promise<Response | null> {
  const p = new URL(request.url).pathname;
  if (p !== "/abo" && !p.startsWith("/abo/")) return null;
  const b = p.match(/^\/abo\/bestaetigen\/([0-9a-f]{64})$/);
  if (b && request.method === "GET") {
    const r = await rpc<{ suche: string; gebiet: string } | null>(env, "such_abo_bestaetigen", { token: b[1] });
    return r ? antwort("Abo bestätigt", aboSeiten.bestaetigt(r.suche, r.gebiet)) : antwort("Link nicht mehr gültig", aboSeiten.unbekannt, 404);
  }
  const a = p.match(/^\/abo\/abmelden\/([0-9a-f]{64})$/);
  if (a && request.method === "GET") {
    const r = await rpc<{ suche: string; gebiet: string } | null>(env, "such_abo_zeigen", { token: a[1] });
    return r ? antwort("Abo abmelden", aboSeiten.abmelden(a[1], r.suche, r.gebiet)) : antwort("Link nicht mehr gültig", aboSeiten.unbekannt, 404);
  }
  if (a && request.method === "POST") {
    await rpc<boolean>(env, "such_abo_abmelden", { token: a[1] });
    return antwort("Abgemeldet", aboSeiten.abgemeldet);
  }
  if (p !== "/abo") return antwort("Nicht gefunden", aboSeiten.unbekannt, 404);
  if (request.method !== "POST") return new Response(null, { status: 303, headers: { location: "/demo/suche" } });
  const form = await request.formData();
  const q = kurz(form.get("q"), 120), ort = kurz(form.get("ort"), 60), email = kurz(form.get("email"), 200).toLowerCase();
  if (kurz(form.get("webseite"), 200)) return antwort("Fast fertig", aboSeiten.gesendet(q, ort));  // filled only by robots
  if (!q && !ort) return new Response(null, { status: 303, headers: { location: "/demo/suche" } });
  if (!EMAIL.test(email)) return antwort("Abo", aboSeiten.fehler("Bitte eine gültige E-Mail-Adresse eintragen.", q, ort), 400);
  if (form.get("zustimmung") !== "ja") return antwort("Abo", aboSeiten.fehler("Bitte das Häkchen setzen, sonst dürfen wir dir keine Mails schicken.", q, ort), 400);
  let r: { status?: string; token?: string } | null = null;
  try { r = await katalogDb(env, async (sql) => (await sql`select jarvis_intern.such_abo_anlegen(${email}, ${q}, ${ort}, ${EINWILLIGUNG}) as r`)[0]?.r ?? null); }
  catch { return antwort("Abo", aboSeiten.fehler("Das Abo konnte gerade nicht gespeichert werden. Bitte später noch einmal versuchen.", q, ort), 503); }
  if (r?.status === "zu_viele") return antwort("Abo", aboSeiten.fehler(`Heute sind schon sehr viele Abos eingegangen. Bitte versuch es morgen noch einmal oder schreib an ${FIRMA.email}.`, q, ort), 429);
  if (r?.status === "neu" && r.token) {
    try { await senden(env, bestaetigungsMail(email, q, ort, r.token)); }
    catch { return antwort("Abo", aboSeiten.fehler("Die Bestätigungsmail konnte gerade nicht verschickt werden. Bitte in ein paar Minuten noch einmal versuchen.", q, ort), 503); }
  }
  return antwort("Fast fertig", aboSeiten.gesendet(q, ort));
}
