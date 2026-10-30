// Accounts: login by e-mail link (Supabase Auth, PKCE on the server, no scripts) and the firm pages
// (create a firm, areas, invitations). All data access runs with the user's token, so the database
// rules (row level security) decide what each person may see and change.
import { einladungsMail, senden } from "./mail.ts";
import { escape, markdown, seite } from "./seite.ts";

export interface KontoEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable key, public by design
  SMTP_PASSWORD?: string; // kontakt@wpdigitalranger.com; without it invitations are shown as a link
  DATEN?: R2Bucket; // uploads at a Vorgang: auftraege/vorgaenge/<id>.json points to the Steckbrief job
}

export type Sitzung = { token: string; userId: string; email: string; cookies: string[] };
type Mitglied = { firma_id: string; rolle: string; erstellt: string; user_id: string };
export type Bereich = { id: string; name: string; art: string; parent_id: string | null };
type Vorgang = { id: string; titel: string; link: string | null; frist: string | null; status: string; punkte: number | null; erstellt: string; bereich_id?: string | null; steckbrief?: string | null };
const STATUS: Record<string, string> = {
  neu: "neu",
  pruefen: "prüfen",
  angebot: "Angebot in Arbeit",
  abgegeben: "abgegeben",
  gewonnen: "gewonnen",
  verloren: "verloren",
  verworfen: "verworfen",
};
type Einladung = { id: string; email: string; rolle: string; gueltig_bis: string; angenommen: string | null };

const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber",
  admin: "Admin",
  bearbeiter: "Bearbeiter",
  leser: "Leser (kostenlos)",
};
const ARTEN: Record<string, string> = { standort: "Standort", abteilung: "Abteilung", team: "Team" };
const COOKIE = "Path=/; HttpOnly; Secure; SameSite=Lax";
// The only script: submits the upload as soon as a file is chosen. Allowed by its hash in the CSP below.
export const SOFORT_JS = 'document.querySelectorAll("input[data-sofort]").forEach(function(i){i.addEventListener("change",function(){if(i.files.length){i.form.querySelector("button").textContent="Wird hochgeladen …";i.form.requestSubmit();}});});';
export const SOFORT_HASH = "sha256-VNoEX8Z3tsR5/QCXrLw24nEJXrMXtx1IAc7BCP929eo=";

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
  if (p === "/konto/status" && post) return mitSitzung(request, env, statusSetzen);
  const v = p.match(/^\/konto\/vorgang\/([0-9a-f-]{36})$/);
  if (v && !post) return vorgangZeigen(v[1], request, env);
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
export async function sitzung(request: Request, env: KontoEnv): Promise<Sitzung | null> {
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
<p>Du gehörst noch zu keiner Firma. Öffne den Einladungs-Link, den du bekommen hast, oder lege deine Firma an, wenn WP Digital Ranger dein Konto freigeschaltet hat.</p>
<form method="post" action="/konto/firma">
  <label>Name der Firma <input name="name" required minlength="2" maxlength="200" placeholder="z. B. Muster GmbH"></label>
  <button>Firma anlegen</button>
  <p class="klein">Du wirst Inhaber und kannst danach Standorte anlegen und Mitarbeiter einladen.</p>
</form>
<h2>Konto</h2>${abmelden}`), 200, s.cookies);
  }
  // Several firms (e.g. a preview account): the choice is kept in a cookie.
  const url = new URL(request.url);
  const gewaehlt = url.searchParams.get("firma") ?? cookie(request, "jv_firma") ?? "";
  const m = meine.daten.find((x) => x.firma_id === gewaehlt) ?? meine.daten[0];
  if (url.searchParams.get("firma") === m.firma_id) s.cookies.push(`jv_firma=${m.firma_id}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`);
  const admin = m.rolle === "inhaber" || m.rolle === "admin";
  const alle = url.searchParams.get("alle") === "1";
  const bereiche = await db<Bereich[]>(s, env, `bereiche?firma_id=eq.${m.firma_id}&select=id,name,art,parent_id&order=name`);
  const b = bereiche.ok ? bereiche.daten : [];
  // Filter by area, including its sub-areas.
  const filter = b.find((x) => x.id === url.searchParams.get("bereich"));
  const unter = (id: string): string[] => [id, ...b.filter((x) => x.parent_id === id).flatMap((x) => unter(x.id))];
  const bereichFilter = filter ? `&bereich_id=in.(${unter(filter.id).join(",")})` : "";
  const [vorgaenge, mitglieder, einladungen, anzahl] = await Promise.all([
    db<Vorgang[]>(s, env, `vorgaenge?firma_id=eq.${m.firma_id}${alle ? "" : "&status=not.in.(verworfen,verloren)"}${bereichFilter}&select=id,titel,link,frist,status,punkte,erstellt,bereich_id&order=punkte.desc.nullslast,erstellt.desc&limit=100`),
    db<Mitglied[]>(s, env, `mitglieder?firma_id=eq.${m.firma_id}&aktiv=eq.true&select=firma_id,rolle,erstellt,user_id&order=erstellt`),
    admin ? db<Einladung[]>(s, env, `einladungen?firma_id=eq.${m.firma_id}&angenommen=is.null&gueltig_bis=gt.${new Date().toISOString()}&select=id,email,rolle,gueltig_bis,angenommen&order=erstellt.desc`) : Promise.resolve({ ok: true, daten: [] as Einladung[] }),
    db<number>(s, env, "rpc/nutzer_zaehlen", { method: "POST", body: JSON.stringify({ f: m.firma_id }) }),
  ]);
  const profil = admin ? await db<{ id: string }[]>(s, env, `suchprofile?firma_id=eq.${m.firma_id}&bereich_id=is.null&select=id&limit=1`) : null;
  const ohneProfil = !!profil?.ok && !profil.daten.length && !(vorgaenge.ok && vorgaenge.daten.length);
  const name = (id: string | null | undefined) => b.find((x) => x.id === id)?.name ?? "";
  const bereichOptionen = b.map((x) => `<option value="${x.id}">${escape(x.name)}</option>`).join("");

  const wechsel = meine.daten.length > 1
    ? `<form method="get" action="/konto" style="display:flex;gap:8px;align-items:end"><label style="flex:1">Firma <select name="firma">${meine.daten.map((x) => `<option value="${x.firma_id}"${x.firma_id === m.firma_id ? " selected" : ""}>${escape(x.firmen.name)}</option>`).join("")}</select></label><button>Wechseln</button></form>`
    : "";
  const regionen = b.filter((x) => !x.parent_id);
  const bereichWahl = regionen.length
    ? `<p class="klein">Bereich: ${[`<a href="/konto${alle ? "?alle=1" : ""}">${filter ? "alle" : "<strong>alle</strong>"}</a>`, ...regionen.map((x) => `<a href="/konto?bereich=${x.id}${alle ? "&alle=1" : ""}">${x.id === filter?.id ? `<strong>${escape(x.name)}</strong>` : escape(x.name)}</a>`)].join(" · ")}</p>`
    : "";
  let inhalt = `${kopf}${wechsel}
<p>Deine Rolle: <strong>${ROLLEN[m.rolle] ?? m.rolle}</strong> · Paket: ${escape(m.firmen.paket)} · abgerechnete Nutzer: ${anzahl.ok ? anzahl.daten : "?"}</p>
${ohneProfil ? `<p><a class="knopf" href="/konto/einrichtung?firma=${m.firma_id}">🔎 Suche einrichten (2 Minuten)</a></p><p class="klein">Beschreib kurz deine Firma, Jarvis schlägt Suchbegriffe und Standorte vor. Danach kommen jeden Morgen passende Ausschreibungen.</p>` : admin ? `<p class="klein"><a href="/konto/einrichtung?firma=${m.firma_id}">🔎 Suchprofil anpassen</a></p>` : ""}
${trefferListe(vorgaenge.ok ? vorgaenge.daten : [], alle, name, bereichWahl)}
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
  const fehler = !r.ok && r.fehler.includes("nicht freigeschaltet")
    ? "Firmen-Konten schaltet WP Digital Ranger frei. Schreib uns an kontakt@wpdigitalranger.com, oder öffne den Einladungs-Link deiner Firma."
    : "Die Firma konnte nicht angelegt werden.";
  if (r.ok && typeof r.daten === "string") return weiterleiten(`/konto/einrichtung?firma=${r.daten}`, [`jv_firma=${r.daten}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`]);
  return weiterleiten(`/konto?hinweis=${encodeURIComponent(r.ok ? "Firma angelegt." : fehler)}`);
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
  if (env.SMTP_PASSWORD) {
    const firma = await db<{ name: string }[]>(s, env, `firmen?id=eq.${String(form.get("firma") ?? "")}&select=name`);
    try {
      await senden(env, einladungsMail(email, firma.ok && firma.daten[0] ? firma.daten[0].name : "deiner Firma", ROLLEN[rolle] ?? rolle, link));
      return weiterleiten(`/konto?hinweis=${encodeURIComponent(`Einladung an ${email} verschickt.`)}`);
    } catch (e) {
      console.warn(`Einladung nicht verschickt: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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

function trefferListe(liste: Vorgang[], alle: boolean, bereichName: (id: string | null | undefined) => string, bereichWahl: string): string {
  const umschalten = alle ? `<a href="/konto">nur offene zeigen</a>` : `<a href="/konto?alle=1">auch verworfene zeigen</a>`;
  if (!liste.length) return `<h2>Ausschreibungen</h2>${bereichWahl}<p class="klein">Noch keine Treffer. Der Morgenbericht trägt passende Ausschreibungen jeden Tag hier ein. ${umschalten}</p>`;
  const optionen = (aktuell: string) => Object.entries(STATUS).map(([k, t]) => `<option value="${k}"${k === aktuell ? " selected" : ""}>${t}</option>`).join("");
  const zeilen = liste.map((v) => `<tr>
  <td>${v.punkte ? `<strong>${v.punkte}/10</strong>` : "–"}</td>
  <td><a href="/konto/vorgang/${v.id}">${escape(v.titel)}</a>${v.bereich_id ? `<br><span class="klein">${escape(bereichName(v.bereich_id))}</span>` : ""}</td>
  <td>${v.frist ? datum(v.frist) : "–"}</td>
  <td><form method="post" action="/konto/status" style="display:flex;gap:6px;padding:0;border:0;background:none">
    <input type="hidden" name="id" value="${v.id}"><select name="status">${optionen(v.status)}</select><button>OK</button></form></td>
</tr>`).join("");
  return `<h2>Ausschreibungen</h2>${bereichWahl}<div class="tabelle"><table><tr><th>Punkte</th><th>Titel</th><th>Frist</th><th>Stand</th></tr>${zeilen}</table></div><p class="klein">${umschalten}</p>`;
}

async function statusSetzen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUS[status]) return weiterleiten("/konto");
  const r = await db(s, env, `vorgaenge?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return weiterleiten(`/konto?hinweis=${encodeURIComponent(r.ok ? `Stand: ${STATUS[status]}` : "Das darfst du für diese Ausschreibung nicht ändern.")}`);
}

/** The Vorgang with its firm and the user's role there, or null if the user may not see it. */
export async function vorgangZugriff(request: Request, env: KontoEnv, id: string): Promise<{ s: Sitzung; v: Vorgang & { firma_id: string }; rolle: string } | null> {
  const s = await sitzung(request, env);
  if (!s || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await db<(Vorgang & { firma_id: string })[]>(s, env, `vorgaenge?id=eq.${id}&select=id,firma_id,titel,link,frist,status,punkte,erstellt,steckbrief`);
  const v = r.ok ? r.daten[0] : undefined;
  if (!v) return null;
  const m = await db<{ rolle: string }[]>(s, env, `mitglieder?firma_id=eq.${v.firma_id}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle`);
  return { s, v, rolle: m.ok && m.daten[0] ? m.daten[0].rolle : "leser" };
}

async function vorgangZeigen(id: string, request: Request, env: KontoEnv): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) {
    if (!(await sitzung(request, env))) return weiterleiten("/konto");
    return html(seite("Nicht gefunden", `<p>Diese Ausschreibung gibt es nicht oder du darfst sie nicht sehen.</p><p><a href="/konto">Zur Übersicht</a></p>`), 404);
  }
  const { s, v, rolle } = z;
  const fehler = new URL(request.url).searchParams.get("fehler") ?? "";
  const portal = v.link && /^https?:\/\//.test(v.link) ? v.link : "";
  const aus = await unterlagenSteckbrief(env, id);
  const kopf = `<p>${v.punkte ? `<strong>${v.punkte}/10</strong> · ` : ""}Frist: ${v.frist ? datum(v.frist) : "unbekannt"} · Stand: ${STATUS[v.status] ?? v.status} · <a href="/konto">Zur Übersicht</a></p>
${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}`;
  const hochladen = rolle === "leser" ? "" : `<h2 id="unterlagen">📥 Vergabeunterlagen</h2>
<p>Für Eignungskriterien, Nachweise, Referenzen und das Preisblatt braucht Jarvis die Unterlagen.</p>
${portal ? `<p><a class="knopf" href="${escape(portal)}" rel="noopener" target="_blank">⬇️ Hier runterladen</a></p>
<p class="klein">Öffnet das Vergabeportal. Dort „Alle herunterladen“ bzw. „Vergabeunterlagen“ tippen (meist eine ZIP-Datei; manche Portale wollen eine kostenlose Anmeldung).</p>` : `<p class="klein">Die Ausschreibung beim Vergabeportal öffnen und die Unterlagen herunterladen.</p>`}
<form method="post" action="/konto/vorgang/${v.id}/unterlagen" enctype="multipart/form-data">
  <label>Danach die heruntergeladenen Dateien hier auswählen (eine oder mehrere) – Jarvis legt sofort los<input name="dateien" type="file" multiple required data-sofort accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label>
  <button>Prüfen lassen</button>
</form>
<p class="klein"><strong>Mehrere Dateien:</strong> Im Auswahlfenster die erste Datei lange drücken, dann die anderen antippen und oben auf „Auswählen“ bzw. „Fertig“. Einfacher ist meist „Alle herunterladen“ beim Portal: Dann kommt eine ZIP-Datei mit allem, und die reicht. Vergessene Dateien kannst du später nachreichen, Jarvis liest dann alle zusammen.</p>
<p class="klein">Am Handy liegt die Datei unter „Downloads“. Jarvis schreibt daraus in 2 bis 5 Minuten einen ausführlichen Steckbrief und eine Kalkulation. Die Dateien werden nur dafür gelesen und nach 30 Tagen gelöscht.</p>
<script>${SOFORT_JS}</script>`;
  let teil: string;
  if (aus?.text) {
    teil = `<h2>Steckbrief aus den Vergabeunterlagen</h2>${markdown(aus.text)}
<p><a href="/auftrag/${aus.auftrag}#kalkulation"><strong>💶 Zur Kalkulation</strong></a></p>${hochladen.replace("📥 Vergabeunterlagen", "📥 Dateien nachreichen")}
${v.steckbrief ? `<details><summary>Kurz-Steckbrief aus der Bekanntmachung</summary>${markdown(v.steckbrief)}</details>` : ""}`;
  } else if (aus) {
    return html(seite(v.titel, `${kopf}<p><strong>Jarvis liest gerade die Unterlagen.</strong> Das dauert meist 2 bis 5 Minuten. Diese Seite lädt sich von selbst neu; du kannst sie auch schließen.</p>
${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${markdown(v.steckbrief)}` : ""}`, 20), 200, s.cookies);
  } else {
    teil = `${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${markdown(v.steckbrief)}` : `<p class="klein">Noch kein Steckbrief.</p>`}${hochladen}`;
  }
  return html(seite(v.titel, kopf + teil), 200, s.cookies);
}

/** Steckbrief written from documents uploaded at this Vorgang: null = none, text "" = still running. */
async function unterlagenSteckbrief(env: KontoEnv, id: string): Promise<{ auftrag: string; text: string } | null> {
  if (!env.DATEN) return null;
  const zeiger = await env.DATEN.get(`auftraege/vorgaenge/${id}.json`);
  if (!zeiger) return null;
  const { auftrag, erstellt } = (await zeiger.json()) as { auftrag: string; erstellt: string };
  const ergebnis = await env.DATEN.get(`auftraege/${auftrag}/ergebnis.md`);
  if (ergebnis) return { auftrag, text: await ergebnis.text() };
  // Still no result after 30 minutes: the run failed, offer the upload again.
  return Date.now() - Date.parse(erstellt) > 30 * 60_000 ? null : { auftrag, text: "" };
}

// ---------- Helpers ----------

export async function db<T = unknown>(s: Sitzung, env: KontoEnv, pfad: string, init: RequestInit = {}): Promise<{ ok: true; daten: T } | { ok: false; fehler: string }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${pfad}`, {
    ...init,
    headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}`, "content-type": "application/json", prefer: "return=minimal", ...(init.headers as Record<string, string> | undefined) },
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

export function weiterleiten(ziel: string, cookies: string[] = []): Response {
  const h = new Headers({ location: ziel });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 303, headers: h });
}

export function html(body: string, status = 200, cookies: string[] = []): Response {
  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; script-src '${SOFORT_HASH}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(body, { status, headers: h });
}
