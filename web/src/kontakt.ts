// Contact form (/kontakt): second fast electronic contact channel next to the e-mail address (§ 5 Abs. 1 Nr. 2 DDG,
// Rechtsprüfung R-M3). Messages go only to our own mailbox, with the visitor as reply-to. Nothing is stored in the
// database; R2 keeps only a daily counter. A hidden honeypot field catches simple bots.
import { escape } from "./seite.ts";
import { ABSENDER, senden, type Mail } from "./mail.ts";
import { FIRMA } from "./rechtliches.ts";

export const KONTAKT_TAGESLIMIT = 30;
const EMAIL = /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[a-z]{2,}$/i;

export type Kontakt = { name: string; email: string; nachricht: string };

export function kontaktFormular(w: Partial<Kontakt> = {}, fehler = ""): string {
  return `<p>Schreib uns eine Nachricht. Wir antworten in der Regel innerhalb von zwei Werktagen per E-Mail. Du erreichst uns auch direkt unter <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>.</p>
<form method="post" action="/kontakt">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  <label>Name <input name="name" required maxlength="100" autocomplete="name" value="${escape(w.name ?? "")}"></label>
  <label>E-Mail-Adresse für die Antwort <input name="email" type="email" required maxlength="200" autocomplete="email" value="${escape(w.email ?? "")}"></label>
  <label>Nachricht <textarea name="nachricht" required minlength="10" maxlength="5000" rows="7">${escape(w.nachricht ?? "")}</textarea></label>
  <label class="sr-only" aria-hidden="true">Bitte leer lassen <input name="webseite" tabindex="-1" autocomplete="off"></label>
  <p class="klein">Wir nutzen deine Angaben nur, um deine Anfrage zu beantworten. Mehr dazu in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
  <button>Nachricht senden</button>
</form>`;
}

export function kontaktPruefen(w: Kontakt): string {
  if (!w.name) return "Bitte deinen Namen angeben.";
  if (!EMAIL.test(w.email)) return "Bitte eine gültige E-Mail-Adresse angeben, damit wir antworten können.";
  if (w.nachricht.length < 10) return "Bitte schreib uns etwas mehr (mindestens 10 Zeichen).";
  return "";
}

/** Mail to our own mailbox; header fields without line breaks, the visitor only as reply-to. */
export function kontaktMail(w: Kontakt): Mail {
  const name = w.name.replace(/[\r\n"<>]+/g, " ").trim().slice(0, 100);
  return {
    from: ABSENDER,
    to: ABSENDER.email,
    reply: { name, email: w.email },
    subject: `Kontaktformular: ${name}`,
    text: `Nachricht über das Kontaktformular von Crewtender\n\nName: ${name}\nE-Mail: ${w.email}\n\n${w.nachricht}\n`,
  };
}

type KontaktEnv = { DATEN: R2Bucket; SMTP_PASSWORD?: string };

async function zaehlen(env: KontaktEnv): Promise<boolean> {
  const key = `kontakt/zaehler/${new Date().toISOString().slice(0, 10)}`;
  const n = Number((await (await env.DATEN.get(key))?.text()) ?? 0);
  if (n >= KONTAKT_TAGESLIMIT) return false;
  await env.DATEN.put(key, String(n + 1));
  return true;
}

/** Handles /kontakt; null for other paths. `seite` renders the page frame. */
export async function kontakt(request: Request, env: KontaktEnv, seite: (titel: string, inhalt: string) => string): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/kontakt") return null;
  const antwort = (inhalt: string, status = 200) => new Response(seite("Kontakt", inhalt), { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (request.method === "GET") return antwort(kontaktFormular());
  if (request.method !== "POST") return new Response("Methode nicht erlaubt", { status: 405, headers: { allow: "GET, POST" } });
  const form = await request.formData();
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const w: Kontakt = { name: text("name", 100).replace(/\s+/g, " "), email: text("email", 200), nachricht: text("nachricht", 5000) };
  const danke = `<p role="status">Danke, deine Nachricht ist angekommen. Wir melden uns per E-Mail.</p><p><a href="/">Zur Startseite</a></p>`;
  if (text("webseite", 200)) return antwort(danke); // honeypot: pretend success, send nothing
  const fehler = kontaktPruefen(w);
  if (fehler) return antwort(kontaktFormular(w, fehler), 400);
  if (!(await zaehlen(env))) return antwort(kontaktFormular(w, `Heute sind schon sehr viele Nachrichten eingegangen. Bitte schreib uns direkt an ${FIRMA.email}.`), 429);
  try { await senden(env, kontaktMail(w)); }
  catch { return antwort(kontaktFormular(w, `Die Nachricht konnte gerade nicht gesendet werden. Bitte schreib uns direkt an ${FIRMA.email}.`), 503); }
  return antwort(danke);
}
