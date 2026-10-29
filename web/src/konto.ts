// Accounts: login by e-mail link (Supabase Auth, PKCE on the server, no scripts) and the firm pages
// (create a firm, areas, invitations). All data access runs with the user's token, so the database
// rules (row level security) decide what each person may see and change.
import { escape, seite } from "./seite.ts";

export interface KontoEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable key, public by design
}

type Sitzung = { token: string; userId: string; email: string; cookies: string[] };
type Mitglied = { firma_id: string; rolle: string; erstellt: string; user_id: string };
type Bereich = { id: string; name: string; art: string; parent_id: string | null };
type Einladung = { id: string; email: string; rolle: string; gueltig_bis: string; angenommen: string | null };

const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber",
  admin: "Admin",
  bearbeiter: "Bearbeiter",
  leser: "Leser (kostenlos)",
};
const ARTEN: Record<string, string> = { standort: "Standort", abteilung: "Abteilung", team: "Team" };
const COOKIE = "Path=/; HttpOnly; Secure; SameSite=Lax";

/** Handles /konto, /anmelden, /einladung and /abmelden; null for other paths. */
export async function konto(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const post = request.method === "POST";
  if (p === "/anmelden" && post) return anmelden(request, env);
  if (p === "/anmelden/fertig") return angemeldet(url, request, env);
  if (p === "/abmelden" && post) return abmelden(request, env);
  if (p === "/konto" && !post) return uebersicht(request, env, url.searchParams.get("hinweis") ?? "");
  if (p === "/konto/firma" && post) return mitSitzung(request, env, firmaAnlegen);
  if (p === "/konto/bereich" && post) return mitSitzung(request, env, bereichAnlegen);
  if (p === "/konto/einladen" && post) return mitSitzung(request, env, einladen);
  if (p === "/einladung") return post ? mitSitzung(request, env, einladungAnnehmen) : einladungZeigen(url, request, env);
  return null;
}

// ---------- Login ----------

function anmeldeFormular(fehler = "", weiter = "/konto", hinweis = ""): string {
  return `${hinweis ? `<p>${hinweis}</p>` : ""}
<form method="post" action="/anmelden">
  ${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
  <label>E-Mail-Adresse <input type="email" name="email" required autocomplete="email"></label>
  <input type="hidden" name="weiter" value="${escape(weiter)}">
  <button>Anmelde-Link schicken</button>
  <p class="klein">Du bekommst eine E-Mail mit einem Link. Ein Passwort brauchst du nicht.</p>
</form>`;
}

async function anmelden(request: Request, env: KontoEnv): Promise<Response> {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const weiter = sicherWeiter(String(form.get("weiter") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return html(seite("Anmelden", anmeldeFormular("Bitte eine gültige E-Mail-Adresse eingeben.", weiter)), 400);
  const verifier = zufall(48);
  const zurueck = new URL("/anmelden/fertig", request.url);
  zurueck.searchParams.set("weiter", weiter);
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(zurueck.toString())}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, create_user: true, code_challenge: await challenge(verifier), code_challenge_method: "s256" }),
  });
  if (!r.ok) {
    const zuViele = r.status === 429;
    return html(seite("Anmelden", anmeldeFormular(zuViele ? "Gerade wurden zu viele Links verschickt. Bitte in einer Stunde noch einmal versuchen." : "Der Link konnte nicht verschickt werden. Bitte später noch einmal versuchen.", weiter)), zuViele ? 429 : 502);
  }
  return html(
    seite("Link ist unterwegs", `<p>Wir haben einen Anmelde-Link an <strong>${escape(email)}</strong> geschickt. Öffne ihn auf diesem Gerät und in diesem Browser.</p><p class="klein">Keine Mail da? Schau im Spam-Ordner nach.</p>`),
    200,
    [`jv_pkce=${verifier}; ${COOKIE}; Max-Age=3600`],
  );
}

async function angemeldet(url: URL, request: Request, env: KontoEnv): Promise<Response> {
  const code = url.searchParams.get("code");
  const verifier = cookie(request, "jv_pkce");
  if (!code || !verifier) {
    const grund = url.searchParams.get("error_description") ?? "Der Link ist abgelaufen oder wurde in einem anderen Browser geöffnet.";
    return html(seite("Anmelden", anmeldeFormular(grund)), 400);
  }
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  if (!r.ok) return html(seite("Anmelden", anmeldeFormular("Der Link ist abgelaufen. Bitte einen neuen anfordern.")), 400);
  const t = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return weiterleiten(sicherWeiter(url.searchParams.get("weiter") ?? ""), [...tokenCookies(t), `jv_pkce=; ${COOKIE}; Max-Age=0`]);
}

async function abmelden(request: Request, env: KontoEnv): Promise<Response> {
  const s = await sitzung(request, env);
  if (s) {
    await fetch(`${env.SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}` } });
  }
  return weiterleiten("/konto", [`jv_at=; ${COOKIE}; Max-Age=0`, `jv_rt=; ${COOKIE}; Max-Age=0`]);
}

/** The logged-in user from the cookies; refreshes an expired access token. */
async function sitzung(request: Request, env: KontoEnv): Promise<Sitzung | null> {
  let token = cookie(request, "jv_at");
  let cookies: string[] = [];
  let daten = token ? jwt(token) : null;
  if (!daten || daten.exp * 1000 < Date.now() + 30_000) {
    const refresh = cookie(request, "jv_rt");
    if (!refresh) return null;
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!r.ok) return null;
    const t = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number };
    token = t.access_token;
    cookies = tokenCookies(t);
    daten = jwt(token);
    if (!daten) return null;
  }
  return { token: token!, userId: daten.sub, email: daten.email ?? "", cookies };
}

async function mitSitzung(request: Request, env: KontoEnv, f: (s: Sitzung, form: FormData, request: Request, env: KontoEnv) => Promise<Response>) {
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const antwort = await f(s, await request.formData(), request, env);
  for (const c of s.cookies) antwort.headers.append("set-cookie", c);
  return antwort;
}

// ---------- Firm pages ----------

async function uebersicht(request: Request, env: KontoEnv, hinweis: string): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return html(seite("Anmelden", anmeldeFormular("", "/konto", "Melde dich an, um Ausschreibungen, Bereiche und Mitarbeiter deiner Firma zu verwalten.")));
  const meine = await db<(Mitglied & { firmen: { name: string; paket: string } })[]>(s, env, `mitglieder?user_id=eq.${s.userId}&aktiv=eq.true&select=firma_id,rolle,erstellt,user_id,firmen(name,paket)&order=erstellt`);
  const kopf = `<p class="klein">Angemeldet als ${escape(s.email)}</p>${hinweis ? `<p><strong>${escape(hinweis)}</strong></p>` : ""}`;
  const abmelden = `<form method="post" action="/abmelden"><button>Abmelden</button></form>`;
  if (!meine.ok || !meine.daten.length) {
    return html(seite("Deine Firma", `${kopf}
<p>Du gehörst noch zu keiner Firma. Lege deine Firma an oder öffne den Einladungs-Link, den du bekommen hast.</p>
<form method="post" action="/konto/firma">
  <label>Name der Firma <input name="name" required minlength="2" maxlength="200" placeholder="z. B. Muster GmbH"></label>
  <button>Firma anlegen</button>
  <p class="klein">Du wirst Inhaber und kannst danach Standorte anlegen und Mitarbeiter einladen.</p>
</form>
<h2>Konto</h2>${abmelden}`), 200, s.cookies);
  }
  const m = meine.daten[0];
  const admin = m.rolle === "inhaber" || m.rolle === "admin";
  const [bereiche, mitglieder, einladungen, anzahl] = await Promise.all([
    db<Bereich[]>(s, env, `bereiche?firma_id=eq.${m.firma_id}&select=id,name,art,parent_id&order=name`),
    db<Mitglied[]>(s, env, `mitglieder?firma_id=eq.${m.firma_id}&aktiv=eq.true&select=firma_id,rolle,erstellt,user_id&order=erstellt`),
    admin ? db<Einladung[]>(s, env, `einladungen?firma_id=eq.${m.firma_id}&angenommen=is.null&gueltig_bis=gt.${new Date().toISOString()}&select=id,email,rolle,gueltig_bis,angenommen&order=erstellt.desc`) : Promise.resolve({ ok: true, daten: [] as Einladung[] }),
    db<number>(s, env, "rpc/nutzer_zaehlen", { method: "POST", body: JSON.stringify({ f: m.firma_id }) }),
  ]);
  const b = bereiche.ok ? bereiche.daten : [];
  const name = (id: string | null) => b.find((x) => x.id === id)?.name ?? "";
  const bereichOptionen = b.map((x) => `<option value="${x.id}">${escape(x.name)}</option>`).join("");

  let inhalt = `${kopf}
<p>Deine Rolle: <strong>${ROLLEN[m.rolle] ?? m.rolle}</strong> · Paket: ${escape(m.firmen.paket)} · abgerechnete Nutzer: ${anzahl.ok ? anzahl.daten : "?"}</p>
<p><a href="/">Unterlagen prüfen lassen</a></p>
<h2>Bereiche (Standorte, Abteilungen, Teams)</h2>`;
  inhalt += b.length
    ? `<div class="tabelle"><table><tr><th>Name</th><th>Art</th><th>gehört zu</th></tr>${b.map((x) => `<tr><td>${escape(x.name)}</td><td>${ARTEN[x.art] ?? x.art}</td><td>${escape(name(x.parent_id))}</td></tr>`).join("")}</table></div>`
    : `<p class="klein">Noch keine Bereiche. Ohne Bereiche sieht jeder in der Firma alles.</p>`;
  if (admin) {
    inhalt += `<form method="post" action="/konto/bereich">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Neuer Bereich <input name="name" required maxlength="200" placeholder="z. B. Berlin"></label>
  <label>Art <select name="art"><option value="standort">Standort</option><option value="abteilung">Abteilung</option><option value="team">Team</option></select></label>
  ${b.length ? `<label>Gehört zu <select name="parent"><option value="">(oberste Ebene)</option>${bereichOptionen}</select></label>` : ""}
  <button>Bereich anlegen</button>
</form>`;
  }
  inhalt += `<h2>Mitarbeiter</h2>`;
  const ml = mitglieder.ok ? mitglieder.daten : [];
  inhalt += `<div class="tabelle"><table><tr><th>Wer</th><th>Rolle</th><th>seit</th></tr>${ml.map((x) => `<tr><td>${x.user_id === s.userId ? `du (${escape(s.email)})` : "Mitarbeiter"}</td><td>${ROLLEN[x.rolle] ?? x.rolle}</td><td>${datum(x.erstellt)}</td></tr>`).join("")}</table></div>`;
  if (admin) {
    const offen = einladungen.ok ? einladungen.daten : [];
    if (offen.length) {
      inhalt += `<p class="klein">Offene Einladungen: ${offen.map((e) => `${escape(e.email)} (${ROLLEN[e.rolle] ?? e.rolle}, bis ${datum(e.gueltig_bis)})`).join(", ")}</p>`;
    }
    inhalt += `<form method="post" action="/konto/einladen">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>E-Mail-Adresse <input type="email" name="email" required></label>
  <label>Rolle <select name="rolle"><option value="bearbeiter">Bearbeiter</option><option value="leser">Leser (kostenlos)</option><option value="admin">Admin</option></select></label>
  ${b.length ? `<label>Bereich <select name="bereich"><option value="">ganze Firma</option>${bereichOptionen}</select></label>` : ""}
  <button>Einladung erstellen</button>
  <p class="klein">Du bekommst einen Link, den du der Person schickst. Er gilt 14 Tage und nur für diese Adresse.</p>
</form>`;
  }
  inhalt += `<h2>Konto</h2>${abmelden}`;
  return html(seite(m.firmen.name, inhalt), 200, s.cookies);
}

async function firmaAnlegen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const name = String(form.get("name") ?? "").trim();
  const r = await db<string>(s, env, "rpc/firma_anlegen", { method: "POST", body: JSON.stringify({ name }) });
  return weiterleiten(`/konto?hinweis=${encodeURIComponent(r.ok ? "Firma angelegt." : "Die Firma konnte nicht angelegt werden.")}`);
}

async function bereichAnlegen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const art = String(form.get("art") ?? "standort");
  const parent = String(form.get("parent") ?? "");
  const r = await db(s, env, "bereiche", {
    method: "POST",
    body: JSON.stringify({ firma_id: String(form.get("firma") ?? ""), name: String(form.get("name") ?? "").trim(), art: ARTEN[art] ? art : "standort", parent_id: parent || null }),
  });
  return weiterleiten(`/konto?hinweis=${encodeURIComponent(r.ok ? "Bereich angelegt." : "Der Bereich konnte nicht angelegt werden.")}`);
}

async function einladen(s: Sitzung, form: FormData, request: Request, env: KontoEnv): Promise<Response> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const rolle = String(form.get("rolle") ?? "bearbeiter");
  const bereich = String(form.get("bereich") ?? "");
  const token = zufall(32);
  const r = await db(s, env, "einladungen", {
    method: "POST",
    body: JSON.stringify({
      firma_id: String(form.get("firma") ?? ""),
      email,
      rolle: ["admin", "bearbeiter", "leser"].includes(rolle) ? rolle : "bearbeiter",
      bereich_ids: bereich ? [bereich] : [],
      token_hash: await sha256(token),
      erstellt_von: s.userId,
    }),
  });
  if (!r.ok) return weiterleiten(`/konto?hinweis=${encodeURIComponent("Die Einladung konnte nicht erstellt werden.")}`);
  const link = new URL(`/einladung?token=${token}`, request.url).toString();
  return html(seite("Einladung erstellt", `<p>Schick diesen Link an <strong>${escape(email)}</strong>, zum Beispiel per Mail oder Messenger. Er gilt 14 Tage und nur für diese Adresse.</p>
<p><code style="word-break: break-all">${escape(link)}</code></p>
<p><a href="/konto">Zurück zur Übersicht</a></p>`));
}

async function einladungZeigen(url: URL, request: Request, env: KontoEnv): Promise<Response> {
  const token = url.searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return html(seite("Einladung", "<p>Dieser Einladungs-Link ist unvollständig.</p>"), 400);
  const s = await sitzung(request, env);
  if (!s) return html(seite("Einladung", anmeldeFormular("", `/einladung?token=${token}`, "Du wurdest zu Jarvis eingeladen. Melde dich mit der Adresse an, an die die Einladung ging.")));
  return html(seite("Einladung annehmen", `<form method="post" action="/einladung">
  <input type="hidden" name="token" value="${escape(token)}">
  <p>Angemeldet als ${escape(s.email)}.</p>
  <button>Einladung annehmen</button>
</form>`), 200, s.cookies);
}

async function einladungAnnehmen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const r = await db<string>(s, env, "rpc/einladung_annehmen", { method: "POST", body: JSON.stringify({ token: String(form.get("token") ?? "") }) });
  if (r.ok) return weiterleiten(`/konto?hinweis=${encodeURIComponent("Willkommen! Du bist jetzt dabei.")}`);
  const grund = /andere E-Mail/.test(r.fehler) ? "Die Einladung gilt für eine andere E-Mail-Adresse. Melde dich mit der eingeladenen Adresse an." : "Die Einladung ist ungültig oder abgelaufen.";
  return html(seite("Einladung", `<p class="fehler">${grund}</p><p><a href="/konto">Zur Übersicht</a></p>`), 400);
}

// ---------- Helpers ----------

async function db<T = unknown>(s: Sitzung, env: KontoEnv, pfad: string, init: RequestInit = {}): Promise<{ ok: true; daten: T } | { ok: false; fehler: string }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${pfad}`, {
    ...init,
    headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}`, "content-type": "application/json", prefer: "return=minimal" },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, fehler: text.slice(0, 500) };
  return { ok: true, daten: (text ? JSON.parse(text) : null) as T };
}

function tokenCookies(t: { access_token: string; refresh_token: string; expires_in: number }): string[] {
  return [`jv_at=${t.access_token}; ${COOKIE}; Max-Age=${t.expires_in}`, `jv_rt=${t.refresh_token}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 30}`];
}

export function jwt(token: string): { sub: string; email?: string; exp: number } | null {
  try {
    const teil = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const d = JSON.parse(atob(teil + "=".repeat((4 - (teil.length % 4)) % 4)));
    return typeof d.sub === "string" && typeof d.exp === "number" ? d : null;
  } catch {
    return null;
  }
}

export function sicherWeiter(pfad: string): string {
  return /^\/(?!\/)[\w\-/?=&.%]*$/.test(pfad) && !pfad.includes("\\") ? pfad : "/konto";
}

export function cookie(request: Request, name: string): string | null {
  for (const teil of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = teil.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

function zufall(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function challenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function base64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

function weiterleiten(ziel: string, cookies: string[] = []): Response {
  const h = new Headers({ location: ziel });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 303, headers: h });
}

function html(body: string, status = 200, cookies: string[] = []): Response {
  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(body, { status, headers: h });
}
