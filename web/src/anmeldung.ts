// Sign-up and login: registration with name, firm, address and password; login with password or with an
// e-mail link. Links use Supabase's implicit flow (tokens in the URL fragment, picked up by /app.js and handed
// to /anmelden/sitzung), so a link works in any browser and on any device, not only where it was requested.
// After the e-mail is confirmed, /konto creates the firm in the free plan (registrierung_abschliessen).
import { COOKIE, html, sicherWeiter, sitzung, tokenCookies, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { websiteNormalisieren } from "./webseite.ts";

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i;
const MIN_PASSWORT = 8;

/** Handles /anmelden…, /registrieren, /passwort-vergessen and /konto/passwort; null otherwise. */
export async function anmeldung(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const post = request.method === "POST";
  if (p === "/anmelden" && !post) return html(seite("Anmelden", anmeldeFormular("", sicherWeiter(url.searchParams.get("weiter") ?? ""))));
  if (p === "/anmelden" && post) return mitPasswort(request, env);
  if (p === "/anmelden/link" && post) return linkSchicken(request, env);
  if (p === "/anmelden/fertig") return url.searchParams.has("code") ? mitCode(url, request, env) : html(linkSeite(sicherWeiter(url.searchParams.get("weiter") ?? "")));
  if (p === "/anmelden/sitzung" && post) return sitzungUebernehmen(request, env);
  if (p === "/registrieren") return post ? registrieren(request, env) : html(seite("Registrieren", registrierFormular({}, "", sicherWeiter(url.searchParams.get("weiter") ?? ""))));
  if (p === "/passwort-vergessen") return post ? passwortVergessen(request, env) : html(seite("Passwort vergessen", vergessenFormular()));
  if (p === "/konto/passwort") return passwortSetzen(request, env, post);
  return null;
}

// ---------- Forms ----------

export function anmeldeFormular(fehler = "", weiter = "/konto", hinweis = "", email = ""): string {
  const w = `<input type="hidden" name="weiter" value="${escape(weiter)}">`;
  const neu = `/registrieren${weiter !== "/konto" ? `?weiter=${encodeURIComponent(weiter)}` : ""}`;
  return `${hinweis ? `<p>${hinweis}</p>` : ""}
<form method="post" action="/anmelden">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  <label>E-Mail-Adresse <input type="email" name="email" required autocomplete="email" value="${escape(email)}"></label>
  <label>Passwort <input type="password" name="passwort" required autocomplete="current-password"></label>
  ${w}
  <button>Anmelden</button>
  <p class="klein"><a href="/passwort-vergessen">Passwort vergessen?</a></p>
</form>
<p><a class="knopf" href="${escape(neu)}">Neu hier? Jetzt registrieren</a></p>
<details><summary>Ohne Passwort anmelden (Link per E-Mail)</summary>
<form method="post" action="/anmelden/link">
  <label>E-Mail-Adresse <input type="email" name="email" required autocomplete="email" value="${escape(email)}"></label>
  ${w}
  <button>Anmelde-Link schicken</button>
  <p class="klein">Der Link funktioniert auf jedem Gerät, auch wenn du ihn in einer anderen App öffnest.</p>
</form></details>`;
}

export type Registrierung = Partial<Record<"vorname" | "nachname" | "firma" | "website" | "strasse" | "plz" | "ort" | "telefon" | "email", string>>;

/** weiter=/einladung…: invited employees only need name, e-mail and password (the firm already exists). */
export function registrierFormular(w: Registrierung, fehler = "", weiter = "/konto"): string {
  const eingeladen = weiter.startsWith("/einladung");
  const feld = (name: keyof Registrierung, label: string, extra: string) =>
    `<label>${label} <input name="${name}" value="${escape(w[name] ?? "")}" ${extra}></label>`;
  return `<p>${eingeladen ? "Lege dein Konto an, danach nimmst du die Einladung an." : "Lege das Konto für deine Firma an. Du bist danach Inhaber und kannst Mitarbeiter einladen."}</p>
<form method="post" action="/registrieren">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  <fieldset><legend>Du</legend>
    ${feld("vorname", "Vorname", `required maxlength="100" autocomplete="given-name"`)}
    ${feld("nachname", "Nachname", `required maxlength="100" autocomplete="family-name"`)}
  </fieldset>
  ${eingeladen ? "" : `<fieldset><legend>Firma</legend>
    ${feld("firma", "Name der Firma", `required minlength="2" maxlength="200" autocomplete="organization" placeholder="z. B. Muster GmbH"`)}
    ${feld("website", "Firmenwebsite – für bessere Ergebnisse empfohlen", `type="text" inputmode="url" maxlength="300" autocomplete="url" placeholder="www.beispiel.de" aria-describedby="website-empfehlung"`)}
    <p class="klein" id="website-empfehlung">Mit eurer Website erkennt Jarvis eure Leistungen und Standorte genauer und findet passendere Ausschreibungen. Nach der E-Mail-Bestätigung startet die Firmenprüfung automatisch. Ohne Website ist die Registrierung auch möglich.</p>
    ${feld("strasse", "Straße und Hausnummer", `required maxlength="200" autocomplete="street-address"`)}
    ${feld("plz", "PLZ", `required pattern="[0-9]{5}" inputmode="numeric" maxlength="5" autocomplete="postal-code"`)}
    ${feld("ort", "Ort", `required maxlength="100" autocomplete="address-level2"`)}
    ${feld("telefon", "Telefon (freiwillig)", `type="tel" maxlength="40" autocomplete="tel"`)}
  </fieldset>`}
  <fieldset><legend>Zugang</legend>
    ${feld("email", "E-Mail-Adresse", `type="email" required autocomplete="email"`)}
    <label>Passwort (mindestens ${MIN_PASSWORT} Zeichen) <input type="password" name="passwort" required minlength="${MIN_PASSWORT}" autocomplete="new-password"></label>
  </fieldset>
  ${eingeladen ? "" : `<label class="zeile"><input type="checkbox" name="unternehmer" value="ja" required> <span>Ich handle für ein Unternehmen (gewerblich oder selbstständig beruflich), nicht als Verbraucher.</span></label>`}
  <label class="zeile"><input type="checkbox" name="zustimmung" value="ja" required> <span>Ich akzeptiere die <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> und habe die <a href="/datenschutz">Datenschutzerklärung</a> gelesen.</span></label>
  <input type="hidden" name="weiter" value="${escape(weiter)}">
  <button>Registrieren</button>
  <p class="klein">Schon ein Konto? <a href="/anmelden">Anmelden</a></p>
</form>`;
}

function vergessenFormular(fehler = ""): string {
  return `<p>Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du ein neues Passwort festlegst.</p>
<form method="post" action="/passwort-vergessen">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  <label>E-Mail-Adresse <input type="email" name="email" required autocomplete="email"></label>
  <button>Link schicken</button>
</form>`;
}

/** Landing page of every mail link; /app.js reads the fragment and finishes the login. */
function linkSeite(weiter: string): string {
  return seite("Anmeldung", `<p id="anmeldung" data-weiter="${escape(weiter)}" role="status">Einen Moment, du wirst angemeldet …</p>
<noscript><p class="fehler">Bitte JavaScript einschalten oder mit Passwort anmelden.</p></noscript>
<div id="anmeldung-fehler" hidden>${anmeldeFormular("Der Link ist abgelaufen oder wurde schon benutzt. Melde dich mit Passwort an oder fordere einen neuen Link an.", weiter)}</div>`);
}

// ---------- Login ----------

async function auth(env: KontoEnv, pfad: string, body: unknown, token?: string, method = "POST") {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/${pfad}`, {
    method,
    headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const daten = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, daten, code: String(daten.error_code ?? daten.code ?? daten.error ?? "") };
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

async function mitPasswort(request: Request, env: KontoEnv): Promise<Response> {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const passwort = String(form.get("passwort") ?? "");
  const weiter = sicherWeiter(String(form.get("weiter") ?? ""));
  if (!passwort) return linkSchicken(request, env, form); // older forms without a password field
  const r = await auth(env, "token?grant_type=password", { email, password: passwort });
  if (r.ok) return weiterleiten(weiter, tokenCookies(r.daten as unknown as Tokens));
  const fehler = r.code === "email_not_confirmed"
    ? "Bitte bestätige zuerst deine E-Mail-Adresse: Tippe auf den Link in der Mail, die wir dir nach der Registrierung geschickt haben."
    : r.status === 429 ? "Zu viele Versuche. Bitte warte ein paar Minuten."
    : "E-Mail-Adresse oder Passwort stimmen nicht.";
  return html(seite("Anmelden", anmeldeFormular(fehler, weiter, "", email)), r.status === 429 ? 429 : 400);
}

async function linkSchicken(request: Request, env: KontoEnv, form?: FormData): Promise<Response> {
  form ??= await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const weiter = sicherWeiter(String(form.get("weiter") ?? ""));
  if (!EMAIL.test(email)) return html(seite("Anmelden", anmeldeFormular("Bitte eine gültige E-Mail-Adresse eingeben.", weiter)), 400);
  const r = await auth(env, `otp?redirect_to=${encodeURIComponent(zurueck(request, weiter))}`, { email, create_user: true });
  if (!r.ok) return html(seite("Anmelden", anmeldeFormular(r.status === 429 ? "Gerade wurden zu viele Links verschickt. Bitte später noch einmal versuchen oder mit Passwort anmelden." : "Der Link konnte nicht verschickt werden. Bitte später noch einmal versuchen.", weiter, "", email)), r.status === 429 ? 429 : 502);
  return html(seite("Link ist unterwegs", `<p>Wir haben einen Anmelde-Link an <strong>${escape(email)}</strong> geschickt. Tippe in der Mail auf den Link, das klappt auf jedem Gerät.</p><p class="klein">Keine Mail da? Schau im Spam-Ordner nach. Es gilt immer nur der neueste Link.</p>`));
}

function zurueck(request: Request, weiter: string): string {
  const u = new URL("/anmelden/fertig", request.url);
  u.searchParams.set("weiter", weiter);
  return u.toString();
}

/** Links sent before the switch to the implicit flow (PKCE code plus verifier cookie). */
async function mitCode(url: URL, request: Request, env: KontoEnv): Promise<Response> {
  const verifier = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)jv_pkce=([^;]+)/)?.[1];
  const weiter = sicherWeiter(url.searchParams.get("weiter") ?? "");
  const r = verifier ? await auth(env, "token?grant_type=pkce", { auth_code: url.searchParams.get("code"), code_verifier: verifier }) : null;
  if (!r?.ok) return html(seite("Anmelden", anmeldeFormular("Dieser Link ist abgelaufen. Melde dich mit Passwort an oder fordere einen neuen Link an.", weiter)), 400, [`jv_pkce=; ${COOKIE}; Max-Age=0`]);
  return weiterleiten(weiter, [...tokenCookies(r.daten as unknown as Tokens), `jv_pkce=; ${COOKIE}; Max-Age=0`]);
}

/** Takes the tokens from a mail link (sent by /app.js), checks them with Supabase and sets the login cookies. */
async function sitzungUebernehmen(request: Request, env: KontoEnv): Promise<Response> {
  const url = new URL(request.url);
  // Same origin and JSON only, so no other site can log a visitor into a foreign account.
  if (request.headers.get("origin") !== url.origin || !(request.headers.get("content-type") ?? "").startsWith("application/json")) return new Response("Nicht erlaubt", { status: 403 });
  const d = (await request.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; typ?: string; weiter?: string } | null;
  if (!d?.access_token || !d.refresh_token) return new Response("Unvollständig", { status: 400 });
  const r = await auth(env, "user", undefined, d.access_token, "GET");
  if (!r.ok) return new Response("Abgelaufen", { status: 401 });
  const t: Tokens = { access_token: d.access_token, refresh_token: d.refresh_token, expires_in: Math.min(Math.max(Number(d.expires_in) || 3600, 60), 86400) };
  const weiter = d.typ === "recovery" ? "/konto/passwort" : sicherWeiter(d.weiter ?? "");
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const c of tokenCookies(t)) h.append("set-cookie", c);
  return new Response(JSON.stringify({ weiter }), { status: 200, headers: h });
}

// ---------- Registration ----------

export function registrierungPruefen(w: Registrierung, passwort: string, zustimmung: boolean, eingeladen: boolean, unternehmer = true): string {
  if (!w.vorname || !w.nachname) return "Bitte Vor- und Nachnamen angeben.";
  if (!eingeladen) {
    if (!w.firma || w.firma.length < 2) return "Bitte den Namen der Firma angeben.";
    if (!w.strasse || !w.ort) return "Bitte die Anschrift der Firma angeben.";
    if (!/^\d{5}$/.test(w.plz ?? "")) return "Bitte eine fünfstellige Postleitzahl angeben.";
    if (w.website?.trim() && !websiteNormalisieren(w.website)) return "Bitte eine gültige Website-Adresse mit https:// angeben.";
  }
  if (!EMAIL.test(w.email ?? "")) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (passwort.length < MIN_PASSWORT) return `Das Passwort braucht mindestens ${MIN_PASSWORT} Zeichen.`;
  // B2B only (terms § 1, § 14 BGB): the firm owner confirms acting as a business, not as a consumer.
  if (!eingeladen && !unternehmer) return "Jarvis ist nur für Unternehmen. Bitte bestätigen, dass du für ein Unternehmen handelst.";
  if (!zustimmung) return "Bitte den Nutzungsbedingungen zustimmen.";
  return "";
}

async function registrieren(request: Request, env: KontoEnv): Promise<Response> {
  const form = await request.formData();
  const text = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const weiter = sicherWeiter(String(form.get("weiter") ?? ""));
  const eingeladen = weiter.startsWith("/einladung");
  const w: Registrierung = {
    vorname: text("vorname", 100), nachname: text("nachname", 100), email: text("email", 200).toLowerCase(),
    ...(eingeladen ? {} : { firma: text("firma", 200), website: text("website", 300), strasse: text("strasse", 200), plz: text("plz", 10), ort: text("ort", 100), telefon: text("telefon", 40) }),
  };
  const passwort = String(form.get("passwort") ?? "");
  const fehler = registrierungPruefen(w, passwort, form.get("zustimmung") === "ja", eingeladen, form.get("unternehmer") === "ja");
  if (fehler) return html(seite("Registrieren", registrierFormular(w, fehler, weiter)), 400);
  if (!eingeladen) w.website = websiteNormalisieren(w.website ?? "");
  const { email, ...daten } = w;
  const r = await auth(env, `signup?redirect_to=${encodeURIComponent(zurueck(request, weiter))}`, { email, password: passwort, data: { ...daten, zustimmung: new Date().toISOString(), ...(eingeladen ? {} : { unternehmer: new Date().toISOString() }) } });
  if (!r.ok) {
    const grund = r.code === "weak_password" ? "Das Passwort ist zu einfach. Bitte ein längeres oder anderes wählen."
      : r.code === "user_already_exists" || r.code === "email_exists" ? "Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an oder nutze „Passwort vergessen“."
      : r.status === 429 ? "Gerade wurden zu viele Mails verschickt. Bitte in einer Stunde noch einmal versuchen."
      : "Die Registrierung hat nicht geklappt. Bitte später noch einmal versuchen.";
    return html(seite("Registrieren", registrierFormular(w, grund, weiter)), r.status === 429 ? 429 : 400);
  }
  if (typeof r.daten.access_token === "string") return weiterleiten(weiter, tokenCookies(r.daten as unknown as Tokens));
  return html(seite("Fast geschafft", `<p>Wir haben dir eine Mail an <strong>${escape(email!)}</strong> geschickt. Tippe auf den Link darin, um deine E-Mail-Adresse zu bestätigen. Danach bist du direkt angemeldet.</p>
<p class="klein">Keine Mail da? Schau im Spam-Ordner nach. Hast du schon ein Konto, <a href="/anmelden">melde dich an</a>.</p>`));
}

// ---------- Password ----------

async function passwortVergessen(request: Request, env: KontoEnv): Promise<Response> {
  const email = String((await request.formData()).get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return html(seite("Passwort vergessen", vergessenFormular("Bitte eine gültige E-Mail-Adresse eingeben.")), 400);
  const r = await auth(env, `recover?redirect_to=${encodeURIComponent(zurueck(request, "/konto/passwort"))}`, { email });
  if (!r.ok && r.status === 429) return html(seite("Passwort vergessen", vergessenFormular("Gerade wurden zu viele Mails verschickt. Bitte später noch einmal versuchen.")), 429);
  return html(seite("Mail ist unterwegs", `<p>Wenn es für <strong>${escape(email)}</strong> ein Konto gibt, kommt gleich eine Mail mit einem Link. Darüber legst du ein neues Passwort fest.</p>`));
}

async function passwortSetzen(request: Request, env: KontoEnv, post: boolean): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/anmelden?weiter=/konto/passwort");
  const formular = (fehler = "") => seite("Passwort festlegen", `<form method="post" action="/konto/passwort">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  <p>Angemeldet als ${escape(s.email)}.</p>
  <label>Neues Passwort (mindestens ${MIN_PASSWORT} Zeichen) <input type="password" name="passwort" required minlength="${MIN_PASSWORT}" autocomplete="new-password"></label>
  <label>Noch einmal <input type="password" name="wiederholung" required minlength="${MIN_PASSWORT}" autocomplete="new-password"></label>
  <button>Passwort speichern</button>
</form>`);
  if (!post) return html(formular(), 200, s.cookies);
  const form = await request.formData();
  const passwort = String(form.get("passwort") ?? "");
  if (passwort.length < MIN_PASSWORT) return html(formular(`Das Passwort braucht mindestens ${MIN_PASSWORT} Zeichen.`), 400, s.cookies);
  if (passwort !== String(form.get("wiederholung") ?? "")) return html(formular("Die beiden Passwörter sind nicht gleich."), 400, s.cookies);
  const r = await auth(env, "user", { password: passwort }, s.token, "PUT");
  if (!r.ok) return html(formular(r.code === "same_password" ? "Das ist schon dein Passwort." : r.code === "weak_password" ? "Das Passwort ist zu einfach." : "Das Passwort konnte nicht gespeichert werden."), 400, s.cookies);
  return weiterleiten(`/konto?hinweis=${encodeURIComponent("Neues Passwort gespeichert.")}`, s.cookies);
}
