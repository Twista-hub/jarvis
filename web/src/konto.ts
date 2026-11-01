import { firmenInfos } from "./firmeninfos.ts";
import type { Firmenstandort, SuchgebietModus } from "./firmenstandorte.ts";
// Accounts: login (anmeldung.ts, Supabase Auth) and the firm pages
// (create a firm, areas, invitations). All data access runs with the user's token, so the database
// rules (row level security) decide what each person may see and change.
import { bereichOptionen as optionenFuerBereiche } from "./bereiche.ts";
import { funktionsListe, personFormular } from "./mitarbeiter.ts";
import { darfFinanzen, ZUGRIFFE } from "./rechte.ts";
import { ABSENDER, einladungsMail, senden } from "./mail.ts";
import { CSP } from "./app.ts";
import { FELDER, STANDARD, felderHtml, fmt, tarifSchnellwahl, zahl, type Eingaben } from "./kalkulation.ts";
import { GVP, lohnAm } from "./tarife.ts";
import { escape, hilfe, markdown, seite } from "./seite.ts";
import { nachweiseMarkieren } from "./nachweise.ts";
import { anmeldeFormular, anmeldung } from "./anmeldung.ts";
import { einsaetzeLaden, einsatzTeil, personalTeil, qualifikationenBlock, standortKacheln, standortleitungBlock, STATUS as PERSONAL_STATUS, tarifvertraegeBlock, tarifvertraegeLaden, type Kraft } from "./personal.ts";
import type { FirmenDatei } from "./firmenunterlagen.ts";
import { teilnahmeTeil } from "./markt.ts";
import { kurzberichte } from "./kurzberichte.ts";
import { sucheLaeuft, suchmeldung, zwischenstand, type Suchstand } from "./suchstatus.ts";
import { fristenSeite, ics } from "./fristen.ts";
import { suchgebietKarte, type Suchpunkt } from "./karte.ts";
import { bewertung, daumen, eckdaten, filterLeiste, sortieren, SORTIERUNGEN, suchbegriff } from "./treffer.ts";

export interface KontoEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable key, public by design
  SMTP_PASSWORD?: string; // kontakt@wpdigitalranger.com; without it invitations are shown as a link
  DATEN?: R2Bucket; // uploads at a Vorgang: auftraege/vorgaenge/<id>.json points to the Steckbrief job
}

export type Sitzung = { token: string; userId: string; email: string; cookies: string[] };
type Mitglied = { firma_id: string; rolle: string; aktiv?: boolean; erstellt: string; user_id: string; anzeigename?: string; funktion?: string; finanzen?: boolean; alle_bereiche?: boolean };
export type Bereich = { id: string; name: string; art: string; parent_id: string | null };
type Vorgang = { entfernung_km?: number | null; fragefrist?: string | null; id: string; titel: string; link: string | null; frist: string | null; status: string; punkte: number | null; erstellt: string; bereich_id?: string | null; kaufverantwortlich_id?: string | null; katalog_id?: string | null; katalog_version?: string | null; steckbrief?: string | null };
const STATUS: Record<string, string> = {
  neu: "neu",
  pruefen: "prüfen",
  angebot: "Angebot in Arbeit",
  abgegeben: "abgegeben",
  gewonnen: "gewonnen",
  verloren: "verloren",
  verworfen: "verworfen",
};
function bereichPfad(bereich: Bereich, alle: Bereich[]): string {
  const eltern = bereich.parent_id ? alle.find((x) => x.id === bereich.parent_id) : undefined;
  return eltern ? `${bereichPfad(eltern, alle)} · ${bereich.name}` : bereich.name;
}
type Einladung = { id: string; email: string; rolle: string; gueltig_bis: string; angenommen: string | null };

const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber",
  admin: "Admin",
  bearbeiter: "Bearbeiter",
  standortleitung: "Standortleitung",
  leser: "Leser (kostenlos)",
  mitarbeiter: "Mitarbeiter (nur Freigaben)",
};
const ARTEN: Record<string, string> = { standort: "Standort", abteilung: "Abteilung", team: "Team" };
export const COOKIE = "Path=/; HttpOnly; Secure; SameSite=Lax";

export function startSucheFormular(firma: string): string {
  return `<form method="post" data-suchaktion action="/konto/einrichtung/starten"><input type="hidden" name="firma" value="${escape(firma)}"><button type="submit">Ausschreibungen jetzt suchen</button></form>`;
}

/** Handles /konto, /anmelden, /einladung and /abmelden; null for other paths. */
export async function konto(request: Request, env: KontoEnv, dateiProfil: (firma: string) => { beschreibung: string } | undefined = () => undefined): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const post = request.method === "POST";
  const a = await anmeldung(request, env);
  if (a) return a;
  if (p === "/abmelden" && post) return abmelden(request, env);
  if (p === "/konto/suchstatus" && request.method === "GET") return suchstatus(request, env);
  const fristDatei = p.match(/^\/konto\/frist\/([0-9a-f-]{36})\.ics$/);
  if (fristDatei && request.method === "GET") {
    const z = await vorgangZugriff(request, env, fristDatei[1]);
    if (!z || !z.v.frist) return html(seite("Nicht gefunden", "<p>Für diese Ausschreibung ist keine Frist bekannt.</p>"), 404);
    return new Response(ics(z.v, `${new URL(request.url).origin}/konto/vorgang/${z.v.id}`), { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="frist-${z.v.id.slice(0, 8)}.ics"`, "cache-control": "private, no-store" } });
  }
  if (!post && ["/konto/ausschreibungen", "/konto/firma-team"].includes(p)) return weiterleiten(p === "/konto/ausschreibungen" ? "/konto/treffer" : "/konto/team");
  if (p === "/konto/kalkulation" && post) return mitSitzung(request, env, vorlageSpeichern);
  if (p === "/konto/verantwortlich" && post) return mitSitzung(request, env, kaufverantwortlichSpeichern);
  if (p === "/konto" && !post && (url.searchParams.has("bereich") || url.searchParams.has("alle"))) return weiterleiten(`/konto/treffer${url.search}`);
  if (p === "/konto" && !post) return uebersicht(request, env, url.searchParams.get("hinweis") ?? "", "", dateiProfil);
  const kontoSeite = p.match(/^\/konto\/(treffer|fristen|unterlagen|kalkulation|team|einstellungen|profil|suchprofil)$/);
  if (kontoSeite && !post) return uebersicht(request, env, url.searchParams.get("hinweis") ?? "", kontoSeite[1], dateiProfil);
  if (p === "/konto/firma" && post) return mitSitzung(request, env, firmaAnlegen);
  if (p === "/konto/bereich" && post) return mitSitzung(request, env, bereichAnlegen);
  if (p === "/konto/einladen" && post) return mitSitzung(request, env, einladen);
  if (p === "/konto/einladung/zurueckziehen" && post) return mitSitzung(request, env, einladungZurueckziehen);
  if (p === "/konto/status" && post) return mitSitzung(request, env, statusSetzen);
  if (p === "/konto/mail" && post) return mitSitzung(request, env, mailSetzen);
  if (p === "/konto/mail/test" && post) return mitSitzung(request, env, probeMail);
  if (p === "/konto/push/schluessel") return pushSchluessel(env);
  if (p === "/konto/push/abo" && post) return pushAbo(request, env);
  if (p === "/konto/push/neu") return pushNeu(request, env);
  const v = p.match(/^\/konto\/vorgang\/([0-9a-f-]{36})$/);
  if (v && !post) return vorgangZeigen(v[1], request, env);
  if (p === "/einladung") return post ? mitSitzung(request, env, einladungAnnehmen) : einladungZeigen(url, request, env);
  return null;
}

/** Quick pick of the tenders the firm already has (newest first); "new" shows the title field instead. */
export function auswahlFeld(liste: { id: string; titel: string; frist: string | null; status: string; erstellt: string }[]): string {
  const offen = liste.filter((v) => !["verworfen", "verloren"].includes(v.status)).sort((a, b) => b.erstellt.localeCompare(a.erstellt)).slice(0, 60);
  if (!offen.length) return "";
  const kurz = (t: string) => (t.length > 70 ? `${t.slice(0, 67)}…` : t);
  return `<label>Ausschreibung<select name="vorgang" data-auswahl><option value="">➕ Neue Ausschreibung</option>${offen.map((v) => `<option value="${v.id}">${escape(kurz(v.titel))}${v.frist ? ` (Frist ${datum(v.frist)})` : ""}</option>`).join("")}</select></label>`;
}

// ---------- Login (pages in anmeldung.ts) ----------

async function abmelden(request: Request, env: KontoEnv): Promise<Response> {
  const s = await sitzung(request, env);
  if (s) {
    await fetch(`${env.SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}` } });
  }
  return weiterleiten("/konto", [`jv_at=; ${COOKIE}; Max-Age=0`, `jv_rt=; ${COOKIE}; Max-Age=0`]);
}

/** Refresh a session at most once per request, even when several permission checks need it. */
const sitzungen = new WeakMap<Request, Promise<Sitzung | null>>();
export function sitzung(request: Request, env: KontoEnv): Promise<Sitzung | null> {
  let s = sitzungen.get(request);
  if (!s) { s = sitzungLaden(request,env); sitzungen.set(request,s); }
  return s;
}
async function sitzungLaden(request: Request, env: KontoEnv): Promise<Sitzung | null> {
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

async function suchstatus(request: Request, env: KontoEnv): Promise<Response> {
  const s = await sitzung(request, env);
  const firma = new URL(request.url).searchParams.get("firma") || "";
  const headers = new Headers({ "cache-control": "no-store" });
  if (!s) return Response.json({ fehler: true }, { status: 401, headers });
  for (const c of s.cookies) headers.append("set-cookie", c);
  if (!/^[0-9a-f-]{36}$/.test(firma)) return Response.json({ fehler: true }, { status: 400, headers });
  const r = await db<Suchstand[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=erstlauf:einstellungen->>erstlauf,fertig:einstellungen->>erstlauf_fertig,zwischenstand:einstellungen->suchlauf_zwischenstand&limit=1`);
  if (!r.ok || !r.daten[0]) return Response.json({ fehler: true }, { status: r.ok ? 404 : 503, headers });
  return Response.json({ laeuft: sucheLaeuft(r.daten[0]), treffer: zwischenstand(r.daten[0])?.treffer ?? 0 }, { headers });
}

async function uebersicht(request: Request, env: KontoEnv, hinweis: string, unterseite = "", dateiProfil: (firma: string) => { beschreibung: string } | undefined = () => undefined): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return html(seite("Anmelden", anmeldeFormular("", new URL(request.url).pathname + new URL(request.url).search, "Melde dich an, um Ausschreibungen, Bereiche und Mitarbeiter deiner Firma zu verwalten.")));
  const meine = await db<(Mitglied & { firmen: { name: string; paket: string } })[]>(s, env, `mitglieder?user_id=eq.${s.userId}&aktiv=eq.true&select=firma_id,rolle,erstellt,user_id,anzeigename,funktion,finanzen,alle_bereiche,firmen(name,paket)&order=erstellt`);
  const kopf = hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : "";
  const abmelden = `<form method="post" action="/abmelden"><button>Abmelden</button></form>`;
  if (meine.ok && !meine.daten.length) {
    // Registered with firm data: create the firm now (free plan) and go straight to the setup assistant.
    const neu = await db<string | null>(s, env, "rpc/registrierung_abschliessen", { method: "POST", body: "{}" });
    if (neu.ok && typeof neu.daten === "string") return weiterleiten(`/konto/einrichtung?firma=${neu.daten}&automatisch=1`, [...s.cookies, `jv_firma=${neu.daten}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`]);
  }
  if (!meine.ok || !meine.daten.length) {
    return html(seite("Deine Firma", `${kopf}
<p>Du gehörst noch zu keiner Firma. Öffne den Einladungs-Link, den du bekommen hast, oder lege hier deine Firma an.</p>
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
  const finanzrecht = darfFinanzen(m.rolle, m.finanzen);
  const alle = url.searchParams.get("alle") === "1";
  const reiter = ["neu", "arbeit", "abgegeben", "archiv"].includes(url.searchParams.get("stand") ?? "") ? url.searchParams.get("stand")! : alle ? "archiv" : "neu";
  const gruppen: Record<string, string[]> = { neu: ["neu", "pruefen"], arbeit: ["angebot"], abgegeben: ["abgegeben"], archiv: ["gewonnen", "verloren", "verworfen"] };
  const statusFilter = unterseite === "treffer" ? `&status=in.(${gruppen[reiter].join(",")})` : unterseite === "fristen" ? (url.searchParams.get("erledigte") === "1" ? "&or=(frist.not.is.null,fragefrist.not.is.null)" : "&status=in.(neu,pruefen,angebot)&or=(frist.not.is.null,fragefrist.not.is.null)") : "";
  const q = suchbegriff(url.searchParams.get("q"));
  const sortierung = SORTIERUNGEN[url.searchParams.get("sortierung") ?? ""] ? url.searchParams.get("sortierung")! : "punkte";
  const titelFilter = unterseite === "treffer" && q ? `&titel=ilike.${encodeURIComponent(`*${q}*`)}` : "";
  const fristFilter = unterseite === "treffer" && ["neu", "arbeit"].includes(reiter)
    ? `&or=(frist.is.null,frist.gt.${new Date().toISOString()})` : "";
  const bereiche = await db<Bereich[]>(s, env, `bereiche?firma_id=eq.${m.firma_id}&select=id,name,art,parent_id&order=name`);
  const b = bereiche.ok ? bereiche.daten : [];
  // Filter by area, including its sub-areas.
  const filter = b.find((x) => x.id === url.searchParams.get("bereich"));
  const unter = (id: string): string[] => [id, ...b.filter((x) => x.parent_id === id).flatMap((x) => unter(x.id))];
  const bereichFilter = filter ? `&bereich_id=in.(${unter(filter.id).join(",")})` : "";
  const [vorgaenge, mitglieder, einladungen, anzahl] = await Promise.all([
    db<Vorgang[]>(s, env, `vorgaenge?firma_id=eq.${m.firma_id}${bereichFilter}${statusFilter}${fristFilter}${titelFilter}&select=id,titel,link,frist,status,punkte,erstellt,bereich_id,kaufverantwortlich_id,steckbrief,entfernung_km,fragefrist&order=${unterseite === "fristen" ? "frist.asc" : "punkte.desc.nullslast,erstellt.desc"}&limit=100`),
    db<Mitglied[]>(s, env, `mitglieder?firma_id=eq.${m.firma_id}&select=firma_id,rolle,aktiv,erstellt,user_id,anzeigename,funktion,finanzen,alle_bereiche&order=erstellt`),
    admin ? db<Einladung[]>(s, env, `einladungen?firma_id=eq.${m.firma_id}&angenommen=is.null&gueltig_bis=gt.${new Date().toISOString()}&select=id,email,rolle,gueltig_bis,angenommen&order=erstellt.desc`) : Promise.resolve({ ok: true, daten: [] as Einladung[] }),
    db<number>(s, env, "rpc/nutzer_zaehlen", { method: "POST", body: JSON.stringify({ f: m.firma_id }) }),
  ]);
  const [profil, mail] = await Promise.all([
    db<(Suchstand & { id: string; beschreibung: string; website_beschreibung?: string; websuche_beschreibung?: string; recherche_version?: string; recherchiert_am?: string; firmenstandorte?: Firmenstandort[]; suchgebiet_modus?: SuchgebietModus; websuche_quellen?: { titel: string; url: string }[]; website_hinweis?: string; leistungen?: { name: string; woerter: string[] }[]; suchpunkte?: Suchpunkt[]; radius_km?: number | null })[]>(s, env, `suchprofile?firma_id=eq.${m.firma_id}&bereich_id=is.null&aktiv=eq.true&select=id,beschreibung,website_beschreibung:einstellungen->>website_beschreibung,websuche_beschreibung:einstellungen->>websuche_beschreibung,recherche_version:einstellungen->>recherche_version,recherchiert_am:einstellungen->>recherchiert_am,websuche_quellen:einstellungen->websuche_quellen,firmenstandorte:einstellungen->firmenstandorte,suchgebiet_modus:einstellungen->>suchgebiet_modus,website_hinweis:einstellungen->>website_hinweis,leistungen:einstellungen->leistungen,suchpunkte:einstellungen->suchpunkte,radius_km:einstellungen->radius_km,erstlauf:einstellungen->>erstlauf,fertig:einstellungen->>erstlauf_fertig,ergebnis:einstellungen->suchlauf_ergebnis,fehler:einstellungen->suchlauf_fehler,zwischenstand:einstellungen->suchlauf_zwischenstand&limit=1`),
    db<{ stunde: number | null; kanal: string }[]>(s, env, `benachrichtigungen?firma_id=eq.${m.firma_id}&user_id=eq.${s.userId}&select=stunde,kanal`),
  ]);
  const hinterlegt = dateiProfil(m.firma_id);
  const sucheEingerichtet = (profil.ok && profil.daten.length > 0) || Boolean(hinterlegt);
  const suchstand: Suchstand = profil.ok ? profil.daten[0] || {} : {};
  const sucht = sucheLaeuft(suchstand);
  const stunde = mail.ok && mail.daten[0] ? mail.daten[0].stunde : null;
  const kanal = mail.ok && mail.daten[0] ? mail.daten[0].kanal : "mail";
  const name = (id: string | null | undefined) => b.find((x) => x.id === id)?.name ?? "";
  const bereichOptionen = optionenFuerBereiche(b);

  const wechsel = meine.daten.length > 1
    ? `<h2>Firma wechseln</h2><form class="profil-firmenwechsel" method="get" action="/konto/profil"><label>Aktive Firma<select name="firma">${meine.daten.map((x) => `<option value="${x.firma_id}"${x.firma_id === m.firma_id ? " selected" : ""}>${escape(x.firmen.name)}</option>`).join("")}</select></label><button>Wechseln</button></form>`
    : "";

  const link = (stand: string, bereich = filter?.id ?? "") => `/konto/treffer?stand=${stand}${bereich ? `&bereich=${bereich}` : ""}${sortierung !== "punkte" ? `&sortierung=${sortierung}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const bereichWahl = filterLeiste(reiter, q, sortierung, b.length ? optionenFuerBereiche(b, filter?.id) : "");
  const liste = vorgaenge.ok ? vorgaenge.daten : [];
  const heute = new Date().toISOString().slice(0, 10);
  const in7Tagen = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const fristen = liste.filter((v) => v.frist && ["neu", "pruefen", "angebot"].includes(v.status)).sort((a, b) => (a.frist ?? "").localeCompare(b.frist ?? ""));
  const bald = fristen.filter((v) => v.frist!.slice(0, 10) >= heute && v.frist!.slice(0, 10) <= in7Tagen).length;
  const neu = liste.filter((v) => ["neu", "pruefen"].includes(v.status) && (!v.frist || Date.parse(v.frist) > Date.now())).length;
  const labels: Record<string, string> = { treffer: "Ausschreibungen", fristen: "Fristen", unterlagen: "Unterlagen prüfen", kalkulation: "Kalkulation", team: "Firma & Team", einstellungen: "Einstellungen", profil: "Mein Profil", suchprofil: "Suchprofil" };
  const rahmen = (body: string) => `${kopf}${body}`;
  const meldungen = suchmeldung(suchstand, m.firma_id);
  // Real numbers for the remaining overview tiles (only on the overview itself).
  const [ablaufZahl, freigabeZahl, aboZahl] = !unterseite ? await Promise.all([
    finanzrecht ? db<{ id: string }[]>(s, env, `firmenunterlagen?firma_id=eq.${m.firma_id}&art=eq.nachweis&gueltig_bis=lte.${new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)}&select=id`).then((r) => r.ok ? r.daten.length : 0) : Promise.resolve(0),
    db<{ id: string }[]>(s, env, `vorgang_freigaben?empfaenger_id=eq.${s.userId}&firma_id=eq.${m.firma_id}&select=id`).then((r) => r.ok ? r.daten.length : 0),
    // New notices of watched contracting authorities in the last 7 days: only then the market tile appears.
    db<{ auftraggeber_id: string }[]>(s, env, `auftraggeber_abos?firma_id=eq.${m.firma_id}&select=auftraggeber_id`).then(async (r) => {
      const ids = r.ok ? r.daten.map((x) => x.auftraggeber_id).slice(0, 50) : [];
      if (!ids.length) return 0;
      const neu = await db<{ id: string }[]>(s, env, `vergabekatalog?auftraggeber_id=in.(${ids.map((x) => `"${x.replace(/["\\]/g, "")}"`).join(",")})&quell_datum=gte.${new Date(Date.now() - 7 * 86400_000).toISOString()}&select=id&limit=50`);
      return neu.ok ? neu.daten.length : 0;
    }),
  ]) : [0, 0, 0];
  const zugaenge = mitglieder.ok ? mitglieder.daten.filter((x) => x.aktiv !== false).length : 0;
  const cards = [
    ["treffer", "📋", "Ausschreibungen", `${neu} ${neu === 1 ? "offener Treffer" : "offene Treffer"}`],
    ["fristen", "⏰", "Fristen", `${bald} ${bald === 1 ? "Frist" : "Fristen"} diese Woche`],
    ["unterlagen", "📥", "Unterlagen", ablaufZahl ? `⚠️ ${ablaufZahl} ${ablaufZahl === 1 ? "Nachweis läuft" : "Nachweise laufen"} bald ab` : "Dateien hochladen und prüfen lassen"],
    ["kalkulation", "💶", "Kalkulation", "Preise pro Stunde und Los berechnen"],
    ["team", "👥", "Firma & Team", `${zugaenge} ${zugaenge === 1 ? "App-Zugang" : "App-Zugänge"} · ${b.length || 1} ${b.length === 1 || !b.length ? "Standort" : "Standorte"}`],
    ["markt", "🌐", "Markt & Chancen", `${aboZahl} ${aboZahl === 1 ? "neue Ausschreibung" : "neue Ausschreibungen"} beobachteter Auftraggeber`],
    ["suchprofil", "🔎", "Suchprofil", sucheEingerichtet ? (suchstand.ergebnis?.treffer !== undefined ? `Letzte Suche: ${suchstand.ergebnis.treffer} Treffer` : "Suche ansehen und anpassen") : "Passende Ausschreibungen finden"],
  ];
  cards.push(["freigaben", "📨", "Für mich freigegeben", freigabeZahl ? `${freigabeZahl} ${freigabeZahl === 1 ? "Freigabe" : "Freigaben"} vom Team` : "Noch nichts freigegeben"]);
  // "Markt & Chancen" only when there is something new there; otherwise it is reachable under Einstellungen ("Mehr").
  const sichtbareKarten = cards.filter(([path]) => m.rolle === "mitarbeiter" ? path === "freigaben" : (path !== "kalkulation" || finanzrecht) && (path !== "markt" || aboZahl > 0));
  const kacheln = `<div class="konto-kacheln">${sichtbareKarten.map(([path, icon, title, hint]) => `<a class="konto-kachel" href="/konto/${path}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(title)}</strong><span class="klein">${hint}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>`;
  let inhalt: string;
  if (!unterseite) {
    // "Heute wichtig": what needs attention today, each with a direct link.
    const wartend = admin && finanzrecht ? await db<{ id: string }[]>(s, env, `angebotsmappen?firma_id=eq.${m.firma_id}&freigabe_status=eq.wartet&select=id&limit=50`) : null;
    const freigaben = wartend?.ok ? wartend.daten.length : 0;
    const nachweise = ablaufZahl;
    const wichtig = [
      neu ? `<li><a href="/konto/treffer"><strong>${neu}</strong> ${neu === 1 ? "neuer Treffer" : "neue Treffer"}</a></li>` : "",
      bald ? `<li><a class="dringend" href="/konto/fristen"><strong>${bald}</strong> ${bald === 1 ? "Frist" : "Fristen"} in 7 Tagen</a></li>` : "",
      freigaben ? `<li><a href="/konto/angebotsfreigaben"><strong>${freigaben}</strong> ${freigaben === 1 ? "Angebot wartet" : "Angebote warten"} auf Freigabe</a></li>` : "",
      nachweise ? `<li><a class="dringend" href="/konto/unterlagen"><strong>${nachweise}</strong> ${nachweise === 1 ? "Nachweis läuft" : "Nachweise laufen"} ab</a></li>` : "",
    ].join("");
    const heuteWichtig = wichtig ? `<h2>Heute wichtig</h2><ul class="heute-wichtig">${wichtig}</ul>` : `<p class="klein">✅ Heute steht nichts Dringendes an.</p>`;
    const ids = zuletztAngesehen(request);
    const angesehen = ids.length ? await db<Vorgang[]>(s, env, `vorgaenge?firma_id=eq.${m.firma_id}&id=in.(${ids.join(",")})&select=id,titel,frist,punkte,status,erstellt,link`) : null;
    const zuletzt = angesehen?.ok && angesehen.daten.length ? `<h2>Zuletzt angesehen</h2><div class="standort-liste">${ids.map((id) => angesehen.daten.find((v) => v.id === id)).filter((v): v is Vorgang => !!v).map((v) => `<a class="standort-zeile" href="/konto/vorgang/${v.id}"><span class="standort-text"><strong>${escape(v.titel)}</strong><span class="klein">${v.punkte !== null ? `${v.punkte}/10 · ` : ""}${v.frist ? `Frist ${datum(v.frist)}` : "Frist unbekannt"}</span></span><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>` : "";
    // First steps for new firms, until all are done or the user hides them.
    const ausgeblendet = /(?:^|;\s*)jv_einfuehrung=aus/.test(request.headers.get("cookie") ?? "") || url.searchParams.get("einfuehrung") === "aus";
    if (url.searchParams.get("einfuehrung") === "aus") s.cookies.push(`jv_einfuehrung=aus; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`);
    const schritte = [
      { fertig: sucheEingerichtet, text: "Suchprofil prüfen", hinweis: "Stimmen Arbeiten und Orte?", href: "/konto/suchprofil" },
      { fertig: ids.length > 0, text: "Ersten Treffer ansehen", hinweis: "Steckbrief und Eckdaten lesen", href: "/konto/treffer" },
      { fertig: false, text: "Unterlagen hochladen", hinweis: "Jarvis schreibt daraus Steckbrief und Kalkulation", href: "/konto/unterlagen" },
    ];
    const einfuehrung = !ausgeblendet && admin && !(schritte[0].fertig && schritte[1].fertig) ? `<section class="einfuehrung"><h2>So startest du mit Jarvis</h2><ol>${schritte.map((x, i) => `<li class="${x.fertig ? "erledigt" : ""}"><span class="schritt-nr" aria-hidden="true">${x.fertig ? "✓" : i + 1}</span><a href="${x.href}"><strong>${x.text}</strong><span class="klein">${x.hinweis}</span></a></li>`).join("")}</ol><a class="klein" href="/konto?einfuehrung=aus">Ausblenden</a></section>` : "";
    inhalt = m.rolle === "mitarbeiter" ? rahmen(`<p>Hier findest du die Informationen, die dir dein Team persönlich freigegeben hat.</p>${kacheln}`) : rahmen(`${einfuehrung}${meldungen}${heuteWichtig}<h2>Was möchtest du tun?</h2>${kacheln}${zuletzt}`);
  } else if (unterseite === "treffer") {
    const fb = await db<{ vorgang_id: string; grund: string }[]>(s, env, `treffer_feedback?firma_id=eq.${m.firma_id}&select=vorgang_id,grund`);
    const rueckmeldungen = new Map((fb.ok ? fb.daten : []).map((x) => [x.vorgang_id, x.grund]));
    const tabs = `<nav class="reiter" aria-label="Stand der Ausschreibungen">${[["neu", "Neu"], ["arbeit", "In Arbeit"], ["abgegeben", "Abgegeben"], ["archiv", "Archiv"]].map(([key, label]) => `<a href="${link(key)}"${key === reiter ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
    inhalt = rahmen(`${hilfe("Ausschreibungen sortieren", "Neu zeigt frische Treffer, In Arbeit die Angebote, an denen ihr arbeitet, Abgegeben bereits eingereichte Angebote und Archiv abgeschlossene oder aussortierte Treffer. Tippe eine Karte an, um Steckbrief und Aktionen zu öffnen.")}${meldungen}${tabs}${trefferListe(sortieren(liste.filter((v) => gruppen[reiter].includes(v.status)), sortierung), name, bereichWahl, link(reiter), rueckmeldungen, q)}`);
  } else if (unterseite === "fristen") {
    const mitFrist = liste.filter((v) => v.frist || v.fragefrist);
    const kalk = mitFrist.length ? await db<{ vorgang_id: string }[]>(s, env, `kalkulationen?firma_id=eq.${m.firma_id}&vorgang_id=in.(${mitFrist.map((v) => v.id).join(",")})&select=vorgang_id`) : { ok: true as const, daten: [] };
    const personen = mitglieder.ok ? mitglieder.daten : [];
    const monat = /^\d{4}-\d{2}$/.test(url.searchParams.get("monat") ?? "") ? url.searchParams.get("monat")! : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7);
    inhalt = rahmen(fristenSeite(mitFrist, {
      erledigte: url.searchParams.get("erledigte") === "1", monat,
      zustaendig: (id) => personen.find((p) => p.user_id === id)?.anzeigename || "",
      kalkuliert: new Set(kalk.ok ? kalk.daten.map((k) => k.vorgang_id) : []),
    }));
  } else if (unterseite === "unterlagen") {
    const [unterlagen, nachweise] = await Promise.all([
      unterlagenListe(liste, env),
      finanzrecht ? db<{ name: string; gueltig_bis: string | null }[]>(s, env, `firmenunterlagen?firma_id=eq.${m.firma_id}&art=eq.nachweis&gueltig_bis=not.is.null&select=name,gueltig_bis&order=gueltig_bis`) : Promise.resolve(null),
    ]);
    const ablauf = (nachweise?.ok ? nachweise.daten : []).map((d) => ({ ...d, tage: Math.round((Date.parse(d.gueltig_bis!) - Date.parse(heute)) / 86400_000) })).filter((d) => d.tage <= 30);
    const warnung = ablauf.length ? `<aside class="ablauf-warnung"><strong>⚠️ ${ablauf.length === 1 ? "Ein Nachweis braucht" : `${ablauf.length} Nachweise brauchen`} bald Ersatz</strong><ul>${ablauf.map((d) => `<li><span>${escape(d.name)}</span><span class="${d.tage < 0 ? "abgelaufen" : "bald"}">${d.tage < 0 ? "abgelaufen" : d.tage === 0 ? "läuft heute ab" : `noch ${d.tage} ${d.tage === 1 ? "Tag" : "Tage"}`}</span></li>`).join("")}</ul><a href="/konto/firmenunterlagen?firma=${m.firma_id}">Neue Version hochladen →</a></aside>` : "";
    inhalt = rahmen(`${warnung}${finanzrecht ? `<p><a class="knopf zweit" href="/konto/firmenunterlagen?firma=${m.firma_id}">📁 Firmenunterlagen & Angebotsvorlagen</a></p>` : ""}<p>Lade Vergabeunterlagen auch ohne vorhandenen Treffer hoch. Jarvis erstellt daraus einen Steckbrief und eine Kalkulation.</p>${hilfe("Was passiert mit den Dateien?", "Jarvis liest sie nur, um die Ausschreibung zu prüfen und den Steckbrief zu erstellen. Vergabeunterlagen werden nach 30 Tagen gelöscht. Firmen-Nachweise und Angebotsvorlagen verwaltest du separat unter Firmenunterlagen.")}${["inhaber","admin","bearbeiter"].includes(m.rolle) ? `<form method="post" action="/konto/unterlagen" enctype="multipart/form-data"><input type="hidden" name="firma" value="${m.firma_id}">${auswahlFeld(liste)}<div data-neu><label>Titel oder Link der neuen Ausschreibung<input name="titel" maxlength="300"></label>${b.length ? `<label>Bereich<select name="bereich"><option value="">ganze Firma</option>${bereichOptionen}</select></label>` : ""}</div><label>Unterlagen<input name="dateien" type="file" multiple required accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label><button>Hochladen und prüfen</button></form>` : `<p class="klein">Als Leser kannst du vorhandene Steckbriefe ansehen.</p>`}<h2>Bisherige Steckbriefe aus Unterlagen</h2>${unterlagen ? `<input type="search" class="listen-filter" data-listenfilter="steckbrief-liste" placeholder="🔍 Steckbriefe durchsuchen" aria-label="Steckbriefe durchsuchen">${unterlagen}` : `<p>Noch keine Unterlagen geprüft.</p>`}<p><a href="/konto/treffer">Unterlagen bei einem Treffer nachreichen →</a></p>`);
  } else if (unterseite === "kalkulation" && !finanzrecht) {
    inhalt = rahmen(`<p>Für Kalkulationen brauchst du eine Finanzfreigabe. Frage einen Inhaber oder Administrator.</p>`);
  } else if (unterseite === "kalkulation") {
    const vorlagen = await db<{ bereich_id: string | null; eingaben: Eingaben }[]>(s, env, `kalkulationsvorlagen?firma_id=eq.${m.firma_id}&select=bereich_id,eingaben`);
    const gewaehlt = url.searchParams.get("bereich") ?? "";
    const standorte = b.filter((x) => x.art === "standort");
    const bereich = standorte.find((x) => x.id === gewaehlt);
    const firmendaten = vorlagen.ok ? vorlagen.daten.find((x) => x.bereich_id === null)?.eingaben : undefined;
    const lokaldaten = bereich && vorlagen.ok ? vorlagen.daten.find((x) => x.bereich_id === bereich.id)?.eingaben : undefined;
    const werte = { ...STANDARD, ...(lokaldaten ?? firmendaten ?? {}) };
    const ortWahl = `<form method="get" action="/konto/kalkulation"><label>Werte bearbeiten für<select name="bereich"><option value="">Ganze Firma</option>${standorte.map((x) => `<option value="${escape(x.id)}"${x.id === gewaehlt ? " selected" : ""}>${escape(bereichPfad(x, b))}</option>`).join("")}</select></label><button>Werte laden</button></form>`;
    inhalt = rahmen(`<h2>Ausschreibung kalkulieren</h2>${hilfe("So entsteht der Preis", "Die Kalkulation schätzt eure Selbstkosten je Stunde aus Bruttolohn, Nebenkosten, Ausfallzeit und Einsatzkosten. Gemeinkosten sowie Wagnis und Gewinn ergeben daraus den Angebotspreis. Prüfe die Werte pro Los, bevor du ein Angebot erstellst.")}${await kalkulationsAuswahl(liste, env)}<h2>Standardwerte</h2>${ortWahl}<p>${bereich ? `Diese Werte gelten für ${escape(bereichPfad(bereich, b))}. Fehlen eigene Standortwerte, dienen die Firmenwerte als Ausgangspunkt.` : "Diese Werte gelten für die ganze Firma. Standorte können eigene Werte haben."}</p>${!vorlagen.ok ? `<p class="fehler">Die gespeicherten Werte konnten nicht geladen werden. Bitte lade die Seite erneut.</p>` : `<form method="post" action="/konto/kalkulation"><input type="hidden" name="firma" value="${m.firma_id}"><input type="hidden" name="bereich" value="${bereich ? escape(bereich.id) : ""}">${felderHtml(werte, m.rolle === "leser", tarifSchnellwahl(GVP.gruppen.map((g) => ({ eg: g, lohn: lohnAm(g, heute, 0) }))))}${m.rolle !== "leser" ? `<button>${bereich ? "Standortwerte" : "Firmenwerte"} speichern</button>` : ""}</form>`}`);
  } else if (unterseite === "team") {
    let team: string;
    const tarife = await tarifvertraegeLaden(s, env, m.firma_id);
    const zuordnungen = await db<{user_id:string;bereich_id:string}[]>(s, env, `mitglied_bereiche?firma_id=eq.${m.firma_id}&select=user_id,bereich_id`);
    const leitungKacheln = mitglieder.ok ? mitglieder.daten.filter((x) => x.rolle === "standortleitung").flatMap((x) => (zuordnungen.ok ? zuordnungen.daten.filter((z) => z.user_id === x.user_id) : []).map((z) => ({ user_id: x.user_id, name: x.anzeigename || x.funktion || "Standortleitung", bereich_id: z.bereich_id }))) : [];
    if (b.length <= 1) {
      // Only one location: the personnel is shown right here, no extra page.
      const ort = b[0]?.id ?? null;
      const [pool, qualifikationen, einsaetze] = await Promise.all([
        db<Kraft[]>(s, env, `personal?firma_id=eq.${m.firma_id}&bereich_id=${ort ? `eq.${ort}` : "is.null"}&select=*&order=status,vorname`),
        db<{ id: string; name: string; bereich_id: string | null }[]>(s, env, `firmen_qualifikationen?firma_id=eq.${m.firma_id}&select=id,name,bereich_id&order=name`),
        einsaetzeLaden(s, env, m.firma_id),
      ]);
      const qs = qualifikationen.ok ? qualifikationen.daten.filter((q) => q.bereich_id === null || q.bereich_id === ort) : [];
      team = `<h2>Organisationsbaum · ${b[0] ? escape(b[0].name) : escape(m.firmen.name)}</h2>${ort ? standortleitungBlock(ort, (mitglieder.ok ? mitglieder.daten : []).map((x) => ({ user_id: x.user_id, rolle: x.rolle, anzeigename: x.anzeigename || "", funktion: x.funktion || "" })), zuordnungen.ok ? zuordnungen.daten : [], admin) : ""}<h3>Einsatzpersonal</h3>${personalTeil(pool.ok ? pool.daten : [], new URL(request.url), ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(m.rolle), `/konto/standort/${ort ?? "firma"}`, einsaetze, qs.map((q) => q.name), tarife)}${qualifikationenBlock(ort, qs, ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(m.rolle))}`;
    } else {
      const pool = await db<{ id: string; bereich_id: string | null; status: string; vorname: string; nachname: string; berufe: string[] }[]>(s, env, `personal?firma_id=eq.${m.firma_id}&select=id,bereich_id,status,vorname,nachname,berufe&order=vorname`);
      // Staff search across all locations, right at the top of the page.
      const kraefte = pool.ok ? pool.daten : [];
      const beruf = url.searchParams.get("beruf") ?? "";
      const st = PERSONAL_STATUS[url.searchParams.get("status") ?? ""] ? url.searchParams.get("status")! : "";
      const berufe = [...new Set(kraefte.flatMap((k) => k.berufe))].sort((x, y) => x.localeCompare(y, "de"));
      const gefunden = beruf || st ? kraefte.filter((k) => (!beruf || k.berufe.includes(beruf)) && (!st || k.status === st)) : [];
      team = kraefte.length ? `<form method="get" action="/konto/team" class="filter-leiste personal-suche"><label>Beruf<select name="beruf" data-sofort-wahl><option value="">Alle Berufe</option>${berufe.map((x) => `<option${x === beruf ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Status<select name="status" data-sofort-wahl><option value="">Alle</option>${Object.entries(PERSONAL_STATUS).map(([w, [i, t]]) => `<option value="${w}"${w === st ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label><noscript><button>Personal suchen</button></noscript></form>
${beruf || st ? `<ul class="standort-liste">${gefunden.map((k) => `<li><a class="standort-zeile" href="/konto/standort/${k.bereich_id ?? "firma"}"><span class="standort-icon" aria-hidden="true">${PERSONAL_STATUS[k.status]?.[0] ?? "⚪"}</span><span class="standort-text"><strong>${escape(`${k.vorname} ${k.nachname}`.trim())}</strong><span class="klein">${escape(k.berufe.slice(0, 3).join(", "))} · ${escape(name(k.bereich_id) || "ohne Standort")}</span></span><span class="konto-pfeil" aria-hidden="true">›</span></a></li>`).join("") || `<li class="standort-zeile">Niemand passt zu diesem Filter.</li>`}</ul>` : ""}` : "";
      team += `<h2>Standorte</h2>${hilfe("Organisationsbaum", "Firma → Region → Standort. Die Standortleitung erhält ihre Rechte über genau einen zugeordneten Standort. Einsatzpersonal und App-Zugänge werden getrennt verwaltet.")}`;
      team += standortKacheln(b, pool.ok ? pool.daten : [], leitungKacheln);
    }
    if (admin) {
    team += `<details><summary>➕ Standort oder Bereich anlegen</summary><form method="post" action="/konto/bereich">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Neuer Bereich <input name="name" required maxlength="200" placeholder="z. B. Berlin"></label>
  <label>Art <select name="art"><option value="standort">Standort</option><option value="abteilung">Abteilung</option><option value="team">Team</option></select></label>
  ${b.length ? `<label>Gehört zu <select name="parent"><option value="">(oberste Ebene)</option>${bereichOptionen}</select></label>` : ""}
  <button>Bereich anlegen</button>
</form></details>`;
    }
      team += `<h2 id="app-zugaenge">App-Zugänge</h2><p class="klein">Diese Personen melden sich bei Jarvis an. Einsatzkräfte stehen separat im Organisationsbaum.</p><p class="klein">Deine Rolle: <strong>${ROLLEN[m.rolle] ?? m.rolle}</strong> ${anzahl.ok && typeof anzahl.daten === "number" ? ` · ${anzahl.daten} ${anzahl.daten === 1 ? "Nutzer" : "Nutzer"}` : ""}</p>${hilfe("Funktion und Zugriff", "Die Funktion beschreibt die Aufgabe in der Firma. Der Zugriff legt getrennt davon fest, welche Daten die Person sehen und bearbeiten darf. Finanzfreigabe gibt zusätzlich Zugriff auf Kalkulation und Firmenunterlagen. Eine Standortleitung verwaltet Personal und Einsätze nur am zugeordneten Standort; Kalkulation und Firmenunterlagen bleiben für sie gesperrt.")}${tarifvertraegeBlock(tarife, admin)}`;
    const ml = mitglieder.ok ? mitglieder.daten : [];
    team += funktionsListe;
    team += `<div class="mitarbeiter-liste">${ml.map((x) => `<article class="treffer-karte"${x.aktiv === false ? ' style="opacity:.75"' : ""}><h3>${escape(x.anzeigename || (x.user_id === s.userId ? s.email : "Mitarbeiter"))}</h3><ul class="rechte-chips">${(x.funktion || "Mitarbeiter/in") !== (ROLLEN[x.rolle] ?? x.rolle) ? `<li>${escape(x.funktion || "Mitarbeiter/in")}</li>` : ""}<li class="stark">${escape(ROLLEN[x.rolle] ?? x.rolle)}</li>${x.finanzen || x.rolle === "inhaber" || x.rolle === "admin" ? "<li>💶 Finanzen</li>" : ""}${x.alle_bereiche || x.rolle === "inhaber" || x.rolle === "admin" ? "<li>Ganze Firma</li>" : (zuordnungen.ok ? zuordnungen.daten.filter((z) => z.user_id === x.user_id) : []).map((z) => `<li>📍 ${escape(name(z.bereich_id))}</li>`).join("")}${x.aktiv === false ? "<li>🔒 gesperrt</li>" : ""}</ul>${admin ? personFormular(x, m.firma_id, b, zuordnungen.ok ? zuordnungen.daten.filter((z) => z.user_id === x.user_id).map((z) => z.bereich_id) : [], m.rolle === "inhaber") : ""}</article>`).join("")}</div>`;
    if (admin) {
    const offen = einladungen.ok ? einladungen.daten : [];
    if (offen.length) {
      team += `<h3>Offene Einladungen</h3><ul class="einladungen-liste">${offen.map((e) => `<li><span><strong>${escape(e.email)}</strong> · ${escape(ROLLEN[e.rolle] ?? e.rolle)} · gültig bis ${datum(e.gueltig_bis)}</span><span class="knoepfe">
  <form method="post" action="/konto/einladen"><input type="hidden" name="firma" value="${m.firma_id}"><input type="hidden" name="email" value="${escape(e.email)}"><input type="hidden" name="rolle" value="${escape(e.rolle)}"><input type="hidden" name="funktion" value="Mitarbeiter/in"><input type="hidden" name="ersetzt" value="${e.id}"><button class="zweit">✉️ Erneut senden</button></form>
  <form method="post" action="/konto/einladung/zurueckziehen"><input type="hidden" name="id" value="${e.id}"><button class="zweit">Zurückziehen</button></form></span></li>`).join("")}</ul>`;
    }
    team += `<details class="einladen"><summary>➕ Person einladen</summary><form method="post" action="/konto/einladen">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Name<input name="name" maxlength="200"></label>
  <label>E-Mail-Adresse <input type="email" name="email" required></label>
  <label>Funktion im Betrieb<input name="funktion" list="funktionen" value="Mitarbeiter/in" required maxlength="100"></label>
      <label>Zugriff<select name="rolle">${Object.entries(ZUGRIFFE).filter(([r]) => r !== "inhaber").sort(([a],[b]) => Number(b === "mitarbeiter") - Number(a === "mitarbeiter")).map(([r,t]) => `<option value="${r}">${escape(t)}</option>`).join("")}</select></label>
  <label class="zeile"><input type="checkbox" name="finanzen">Finanzdaten zusätzlich freigeben (nur bei vollständigen Steckbriefen)</label><p class="klein">Funktion und Zugriffsrechte sind getrennt. „Nur persönlich freigegebene Informationen“ öffnet keine Originalunterlagen und keine Kalkulation. Inhaber und Administration sehen alle Daten.</p>
  ${b.length ? `<label>Bereich <select name="bereich"><option value="">ganze Firma</option>${bereichOptionen}</select></label><p class="klein">Für Standortleitung einen einzelnen Standort wählen, keine Region. Die Einladung gilt dort und in untergeordneten Teams.</p>` : ""}
  <button>Einladung erstellen</button>
  <p class="klein">Du bekommst einen Link, den du der Person schickst. Er gilt 14 Tage und nur für diese Adresse.</p>
</form></details>`;
    }
    inhalt = rahmen(team);
  } else if (unterseite === "profil") {
    inhalt = rahmen(`<h2>Dein Konto</h2><p>E-Mail-Adresse<br><strong>${escape(s.email)}</strong></p><p>Firma: ${escape(m.firmen.name)}<br>Rolle: ${ROLLEN[m.rolle] ?? escape(m.rolle)}</p><p><a href="/konto/passwort">Passwort ändern</a></p><p><a href="/konto/einstellungen">Nachrichten & Einstellungen</a></p><p><a href="/konto/suchprofil">Suchprofil der Firma</a></p>${wechsel}<h2>Abmelden</h2>${abmelden}`);
  } else if (unterseite === "suchprofil") {
    const letzte30 = await db<Vorgang[]>(s, env, `vorgaenge?firma_id=eq.${m.firma_id}&erstellt=gte.${new Date(Date.now() - 30 * 86400_000).toISOString()}&select=id,titel,link,frist,status,punkte,erstellt,steckbrief&limit=1000`);
    const aktuell = profil.ok ? profil.daten[0] : undefined;
    if (admin && aktuell && !aktuell.websuche_beschreibung && aktuell.recherche_version !== "2") return weiterleiten(`/konto/einrichtung?firma=${m.firma_id}&automatisch=1`, s.cookies);
    const beschreibung = (profil.ok ? profil.daten[0]?.beschreibung : "") || hinterlegt?.beschreibung || "";
    const websiteBeschreibung = profil.ok ? profil.daten[0]?.website_beschreibung ?? "" : "";
    const websucheBeschreibung = profil.ok ? profil.daten[0]?.websuche_beschreibung ?? "" : "";
    const datum = aktuell?.recherchiert_am && Number.isFinite(Date.parse(aktuell.recherchiert_am)) ? new Date(aktuell.recherchiert_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : "";
    inhalt = rahmen(`${!profil.ok ? `<p class="fehler">Das Suchprofil konnte nicht geladen werden. Bitte versuche es erneut.</p>` : sucheEingerichtet ? `<p><strong>Die Suche für ${escape(m.firmen.name)} ist eingerichtet.</strong></p>` : `<p>Für diese Firma ist noch keine Suche eingerichtet.</p>`}
${meldungen}
${admin && (profil.ok || sucheEingerichtet) ? `${sucheEingerichtet ? `${startSucheFormular(m.firma_id)}<p class="klein">Sucht mit deinem gespeicherten Firmenprofil nach passenden Aufträgen.</p>` : ""}
<p><a class="knopf zweit" href="/konto/einrichtung?firma=${m.firma_id}">${sucheEingerichtet ? "Suchprofil bearbeiten" : "Suchprofil erstellen"}</a></p>
${sucheEingerichtet ? `<form method="post" data-suchaktion action="/konto/einrichtung/automatisch"><input type="hidden" name="firma" value="${m.firma_id}"><input type="hidden" name="aktion" value="recherche"><button type="submit" class="zweit">Firmeninfos neu recherchieren</button></form><p class="klein">Prüft Website und öffentliche Quellen erneut und aktualisiert dein Firmenprofil.</p>` : ""}` : !admin ? `<p class="klein">Ein Inhaber oder Admin kann das Suchprofil bearbeiten.</p>` : ""}
${datum ? `<p class="klein" role="status">Firmeninfos zuletzt aktualisiert: ${escape(datum)} Uhr</p>` : ""}
${suchgebietKarte(aktuell?.suchpunkte ?? [], aktuell?.radius_km ?? null)}
${leistungsTreffer(aktuell?.leistungen ?? [], letzte30.ok ? letzte30.daten : [])}
${beschreibung || websiteBeschreibung || websucheBeschreibung || aktuell?.firmenstandorte?.length ? firmenInfos({ website_beschreibung: websiteBeschreibung, websuche_beschreibung: websucheBeschreibung, websuche_quellen: aktuell?.websuche_quellen, firmenstandorte: aktuell?.firmenstandorte, suchgebiet_modus: aktuell?.suchgebiet_modus, website_hinweis: aktuell?.website_hinweis }, false, beschreibung) : ""}`);
  } else {
    const zeile = (href: string, icon: string, titel: string, text: string) => `<a class="standort-zeile" href="${href}"><span class="standort-icon" aria-hidden="true">${icon}</span><span class="standort-text"><strong>${titel}</strong><span class="klein">${text}</span></span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
    inhalt = rahmen(`<div class="standort-liste einstellungs-liste">${zeile("/konto/profil", "👤", "Mein Profil", "E-Mail, Passwort, Firma wechseln")}${zeile("/konto/suchprofil", "🔎", "Suchprofil", "Was und wo Jarvis sucht")}${zeile("/konto/team", "👥", "Firma &amp; Team", "Standorte, Personal, Zugänge")}${finanzrecht ? zeile("/konto/kalkulation", "💶", "Kalkulation", "Standardwerte für Preise") : ""}${zeile("/konto/unterlagen", "📥", "Unterlagen", "Vergabe- und Firmenunterlagen")}${zeile("/konto/markt", "🌐", "Markt &amp; Chancen", "Offene Aufträge, Auftraggeber, Partner")}</div>${meldungen}<h2 id="mail">🔔 Tägliche Nachricht</h2>
<form method="post" action="/konto/mail">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Neue Treffer und Fristen-Erinnerungen (7 und 2 Tage vorher) um<select name="stunde">${stundenOptionen(stunde)}</select></label>
  <label>Per<select name="kanal">${KANAEL_LISTE.map(([k, t]) => `<option value="${k}"${k === kanal ? " selected" : ""}>${t}</option>`).join("")}</select></label>
  <button>Speichern</button>
  <p class="klein">Nur wenn es etwas Neues gibt. Mail an ${escape(s.email)}. Ein Tipp auf die Handy-Nachricht öffnet direkt die Ausschreibung. Jeder im Team stellt das für sich selbst ein.</p>
</form>
<form method="post" action="/konto/mail/test"><button class="zweit">✉️ Probe-Mail an mich senden</button></form>
<p><button type="button" id="push-an" hidden>📱 Nachrichten auf diesem Handy einschalten</button> <button type="button" id="push-test" hidden>🔔 Test auf diesem Handy</button></p>
<p class="klein" id="push-status"></p>
<h2>🎨 Darstellung</h2>
<div class="darstellung"><label>Farben<select data-darstellung="theme"><option value="">Wie am Gerät</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label><label>Schrift<select data-darstellung="schrift"><option value="">Normal</option><option value="gross">Groß</option></select></label></div>
<p class="klein">Gilt für dieses Gerät.</p>
<h2>Konto</h2>${abmelden}`);
  }
  return html(seite(unterseite ? labels[unterseite] : m.firmen.name, inhalt, sucht ? 30 : 0, unterseite), 200, s.cookies);
}

async function probeMail(s: Sitzung, _form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  let hinweis = "Probe-Mail verschickt. Schau in dein Postfach (auch im Spam-Ordner).";
  try {
    await senden(env, { from: ABSENDER, to: s.email, reply: ABSENDER, subject: "Jarvis: Probe-Mail", text: "Hallo,\n\ndiese Probe-Mail zeigt, dass Jarvis dich erreicht. So kommen auch neue Treffer und Fristen-Erinnerungen bei dir an.\n\nViele Grüße\nJarvis · WP Digital Ranger\n" });
  } catch (e) {
    console.warn(`Probe-Mail nicht verschickt: ${e instanceof Error ? e.message : String(e)}`);
    hinweis = "Die Probe-Mail konnte gerade nicht verschickt werden. Bitte später erneut versuchen.";
  }
  return weiterleiten(`/konto/einstellungen?hinweis=${encodeURIComponent(hinweis)}`);
}

async function firmaAnlegen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const name = String(form.get("name") ?? "").trim();
  const r = await db<string>(s, env, "rpc/firma_anlegen", { method: "POST", body: JSON.stringify({ name }) });
  const fehler = "Die Firma konnte nicht angelegt werden.";
  if (r.ok && typeof r.daten === "string") return weiterleiten(`/konto/einrichtung?firma=${r.daten}`, [`jv_firma=${r.daten}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`]);
  return weiterleiten(`/konto?hinweis=${encodeURIComponent(r.ok ? "Firma angelegt." : fehler)}`);
}

async function vorlageSpeichern(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const firma = String(form.get("firma") ?? "");
  const bereichId = String(form.get("bereich") ?? "") || null;
  // Missing fields (e.g. an older form) take the standard value; a field filled with nonsense is rejected.
  const eingaben = Object.fromEntries(FELDER.map((f) => {
    const roh = form.get(f.key);
    return [f.key, roh === null || String(roh).trim() === "" ? STANDARD[f.key] : zahl(roh, NaN)];
  })) as Eingaben;
  if (!/^[0-9a-f-]{36}$/.test(firma) || (bereichId !== null && !/^[0-9a-f-]{36}$/.test(bereichId)) || Object.values(eingaben).some((v) => !Number.isFinite(v) || v > 10000)) return weiterleiten("/konto/kalkulation?hinweis=Bitte%20gültige%20Werte%20zwischen%200%20und%2010000%20eingeben.");
  if (bereichId) {
    const ort = await db<{ id: string; art: string }[]>(s, env, `bereiche?id=eq.${bereichId}&firma_id=eq.${firma}&select=id,art`);
    if (!ort.ok || ort.daten[0]?.art !== "standort") return weiterleiten("/konto/kalkulation?hinweis=Der%20Standort%20ist%20ungültig.");
  }
  const r = await db(s, env, "kalkulationsvorlagen?on_conflict=firma_id,bereich_id", {
    method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ firma_id: firma, bereich_id: bereichId, eingaben }),
  });
  return weiterleiten(`/konto/kalkulation?firma=${firma}${bereichId ? `&bereich=${bereichId}` : ""}&hinweis=${encodeURIComponent(r.ok ? (bereichId ? "Standortwerte gespeichert." : "Firmenwerte gespeichert.") : "Die Werte konnten nicht gespeichert werden. Bitte prüfe deine Berechtigung.")}`);
}

/** Calculation page: all open tenders as tappable cards; with checked documents the calculation opens, otherwise the upload. */
async function kalkulationsAuswahl(liste: Vorgang[], env: KontoEnv): Promise<string> {
  const offen = liste.filter((v) => !["verworfen", "verloren"].includes(v.status));
  if (!offen.length) return `<p>Noch keine Ausschreibungen. Sie erscheinen hier, sobald Jarvis Treffer gefunden hat.</p>`;
  const mit = await Promise.all(offen.map(async (v) => ({ v, aus: await unterlagenSteckbrief(env, v.id) })));
  mit.sort((a, b) => Number(!!b.aus?.text) - Number(!!a.aus?.text) || (a.v.frist ?? "9999").localeCompare(b.v.frist ?? "9999"));
  return `<p>Tippe eine Ausschreibung an. Danach wählst du das Los, und Jarvis setzt Arbeitskraft und Tariflohn ein.</p><ul class="auswahl-liste">${mit.map(({ v, aus }) => {
    const bereit = !!aus?.text;
    const ziel = bereit ? `/auftrag/${aus!.auftrag}#kalkulation` : `/konto/vorgang/${v.id}#unterlagen`;
    const stand = bereit ? "✅ Unterlagen geprüft · Kalkulation öffnen" : aus ? "⏳ Unterlagen werden geprüft" : "📥 Erst Unterlagen hochladen";
    return `<li><a href="${ziel}"><strong>${escape(v.titel)}</strong><span class="klein">${v.frist ? `Frist ${datum(v.frist)} · ` : ""}${stand}</span><span class="konto-pfeil" aria-hidden="true">›</span></a></li>`;
  }).join("")}</ul>`;
}

async function unterlagenListe(liste: Vorgang[], env: KontoEnv): Promise<string> {
  const mitUnterlagen = (await Promise.all(liste.map(async (v) => ({ v, aus: await unterlagenSteckbrief(env, v.id) })))).filter((x) => x.aus);
  return mitUnterlagen.length ? `<ul class="konto-linkliste" id="steckbrief-liste">${mitUnterlagen.map(({ v, aus }) => `<li><a href="/konto/vorgang/${v.id}">${escape(v.titel)}</a><span class="klein">${aus!.text ? "Steckbrief ansehen / Dateien nachreichen" : "Unterlagen werden geprüft …"}</span></li>`).join("")}</ul>` : "";
}

async function bereichAnlegen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const art = String(form.get("art") ?? "standort");
  const parent = String(form.get("parent") ?? "");
  const r = await db(s, env, "bereiche", {
    method: "POST",
    body: JSON.stringify({ firma_id: String(form.get("firma") ?? ""), name: String(form.get("name") ?? "").trim(), art: ARTEN[art] ? art : "standort", parent_id: parent || null }),
  });
  return weiterleiten(`/konto/team?hinweis=${encodeURIComponent(r.ok ? "Bereich angelegt." : "Der Bereich konnte nicht angelegt werden.")}`);
}

async function einladen(s: Sitzung, form: FormData, request: Request, env: KontoEnv): Promise<Response> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const rolle = String(form.get("rolle") ?? "mitarbeiter");
  // "Erneut senden": the new invitation replaces the old one (same address and access).
  const ersetzt = String(form.get("ersetzt") ?? "");
  if (/^[0-9a-f-]{36}$/.test(ersetzt)) await db(s, env, `einladungen?id=eq.${ersetzt}&angenommen=is.null`, { method: "DELETE" });
  const bereich = String(form.get("bereich") ?? "");
  if (rolle === "standortleitung") {
    if (!/^[0-9a-f-]{36}$/i.test(bereich)) return weiterleiten(`/konto/team?hinweis=${encodeURIComponent("Für eine Standortleitung bitte genau einen Standort auswählen.")}`);
    const firmaId = String(form.get("firma") ?? "");
    const [standort, kinder] = await Promise.all([
      db<{ id: string }[]>(s, env, `bereiche?id=eq.${bereich}&firma_id=eq.${firmaId}&select=id`),
      db<{ id: string }[]>(s, env, `bereiche?parent_id=eq.${bereich}&firma_id=eq.${firmaId}&art=eq.standort&select=id&limit=1`),
    ]);
    if (!standort.ok || !standort.daten.length || !kinder.ok || kinder.daten.length) return weiterleiten(`/konto/team?hinweis=${encodeURIComponent("Bitte einen einzelnen Standort statt einer Region auswählen.")}`);
  }
  const token = zufall(32);
  const r = await db(s, env, "einladungen", {
    method: "POST",
    body: JSON.stringify({
      firma_id: String(form.get("firma") ?? ""),
      email,
      rolle: ["admin", "bearbeiter", "standortleitung", "leser", "mitarbeiter"].includes(rolle) ? rolle : "mitarbeiter",
      anzeigename: String(form.get("name") ?? "").trim().slice(0,200),
      funktion: String(form.get("funktion") ?? "Mitarbeiter/in").trim().slice(0,100) || "Mitarbeiter/in",
      finanzen: ["bearbeiter", "leser"].includes(rolle) && form.has("finanzen"),
      bereich_ids: bereich ? [bereich] : [],
      token_hash: await sha256(token),
      erstellt_von: s.userId,
    }),
  });
  if (!r.ok) return weiterleiten(`/konto/team?hinweis=${encodeURIComponent("Die Einladung konnte nicht erstellt werden.")}`);
  const link = new URL(`/einladung?token=${token}`, request.url).toString();
  if (env.SMTP_PASSWORD) {
    const firma = await db<{ name: string }[]>(s, env, `firmen?id=eq.${String(form.get("firma") ?? "")}&select=name`);
    try {
      await senden(env, einladungsMail(email, firma.ok && firma.daten[0] ? firma.daten[0].name : "deiner Firma", ROLLEN[rolle] ?? rolle, link));
      return weiterleiten(`/konto/team?hinweis=${encodeURIComponent(`Einladung an ${email} verschickt.`)}`);
    } catch (e) {
      console.warn(`Einladung nicht verschickt: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return html(seite("Einladung erstellt", `<p>Schick diesen Link an <strong>${escape(email)}</strong>, zum Beispiel per Mail oder Messenger. Er gilt 14 Tage und nur für diese Adresse.</p>
<p><code style="word-break: break-all">${escape(link)}</code></p>
<p><a href="/konto">Zurück zur Übersicht</a></p>`));
}

async function einladungZurueckziehen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const id = String(form.get("id") ?? "");
  const r = /^[0-9a-f-]{36}$/.test(id) ? await db<{ id: string }[]>(s, env, `einladungen?id=eq.${id}&angenommen=is.null&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } }) : null;
  return weiterleiten(`/konto/team?hinweis=${encodeURIComponent(r?.ok && r.daten.length ? "Einladung zurückgezogen." : "Die Einladung konnte nicht zurückgezogen werden.")}`);
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

/** IDs from the cookie jv_zuletzt (only well-formed UUIDs). */
function zuletztAngesehen(request: Request): string[] {
  const roh = /(?:^|;\s*)jv_zuletzt=([0-9a-f,-]{0,120})/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "";
  return roh.split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 3);
}

/** How many hits of the last 30 days mention each service; shows which search terms pay off. */
function leistungsTreffer(leistungen: { name: string; woerter: string[] }[], liste: Vorgang[]): string {
  if (!leistungen.length) return "";
  // Title and the AI's "Gesucht" line, not the whole Steckbrief: long texts mention almost every word.
  const neu = liste.map((v) => `${v.titel} ${bewertung(v.steckbrief).gesucht}`.toLowerCase());
  const zeilen = leistungen.slice(0, 12).map((l) => {
    const woerter = [...(l.woerter ?? []), ...l.name.split(/\s+/)].map((w) => w.toLowerCase()).filter((w) => w.length >= 4);
    const anzahl = neu.filter((t) => woerter.some((w) => t.includes(w))).length;
    return `<li${anzahl ? "" : ' class="leer"'}>${escape(l.name)} <span>${anzahl}</span></li>`;
  }).join("");
  return `<h3>Treffer je Arbeit (letzte 30 Tage)</h3><ul class="leistung-treffer">${zeilen}</ul><p class="klein">${liste.length} Treffer insgesamt; zugeordnet über die Suchwörter der Arbeit in Titel und Kurzbeschreibung.</p>`;
}

export function bewertungsErklaerung(steckbrief?: string | null): string {
  const inhalt = steckbrief?.match(/## Jarvis-Bewertung\s+([\s\S]*?)(?=\n## |\n---|$)/)?.[1];
  return inhalt?.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 420) ?? "";
}

function trefferListe(liste: Vorgang[], bereichName: (id: string | null | undefined) => string, bereichWahl: string, weiter: string, rueckmeldungen = new Map<string, string>(), q = ""): string {
  if (!liste.length) return `${bereichWahl}<div class="treffer-leer"><h2>${q ? "Nichts gefunden" : "Noch keine Ausschreibungen"}</h2><p>${q ? `Kein Treffer enthält „${escape(q)}“ im Titel.` : "In diesem Bereich gibt es aktuell keine Treffer. Wähle einen anderen Stand oder Bereich."}</p></div>`;
  const optionen = (aktuell: string) => Object.entries(STATUS).map(([k, t]) => `<option value="${k}"${k === aktuell ? " selected" : ""}>${t}</option>`).join("");
  const karten = liste.map((v) => {
    const { gesucht, warum } = bewertung(v.steckbrief);
    const fakten = [...eckdaten(v.steckbrief), ...(v.entfernung_km != null ? [{ label: "", wert: `📍 ${Math.round(v.entfernung_km)} km entfernt` }] : [])];
    return `<li><article class="treffer-karte">
  <div class="treffer-meta"><span class="treffer-punkte">${v.punkte !== null ? `${v.punkte}/10 Punkte` : "Noch ohne KI-Bewertung"}</span><span class="treffer-status">${escape(STATUS[v.status] ?? v.status)}</span></div>
  <h2><a href="/konto/vorgang/${v.id}"><span>${escape(v.titel)}</span><span aria-hidden="true">›</span></a></h2>
  ${fakten.length ? `<ul class="treffer-fakten">${fakten.map((f) => `<li>${f.label ? `<span>${escape(f.label)}</span>` : ""}${escape(f.wert)}</li>`).join("")}</ul>` : ""}
  ${gesucht ? `<p class="treffer-gesucht">${escape(gesucht)}</p>` : !warum && bewertungsErklaerung(v.steckbrief) ? `<p class="treffer-gesucht">${escape(bewertungsErklaerung(v.steckbrief))}</p>` : ""}
  ${warum ? `<p class="treffer-warum">${escape(warum)}</p>` : ""}
  <div class="treffer-unten">
    <p class="treffer-frist"><span>Abgabefrist</span>${v.frist ? `<time datetime="${escape(v.frist)}">${datum(v.frist)}</time>` : `<strong>Noch nicht bekannt</strong>`}${v.bereich_id ? `<small>${escape(bereichName(v.bereich_id))}</small>` : ""}</p>
    ${daumen(v.id, rueckmeldungen.get(v.id), weiter)}
  </div>
  <details class="treffer-stand"><summary>Stand ändern</summary><form method="post" action="/konto/status">
    <input type="hidden" name="weiter" value="${escape(weiter)}"><input type="hidden" name="id" value="${v.id}">
    <label>Bearbeitungsstand<select name="status">${optionen(v.status)}</select></label><button>Speichern</button>
  </form></details>
</article></li>`;
  }).join("");
  return `${bereichWahl}<ol class="treffer-liste" aria-label="Ausschreibungen">${karten}</ol>`;
}

async function statusSetzen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUS[status]) return weiterleiten("/konto");
  const r = await db(s, env, `vorgaenge?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  const weiter = sicherWeiter(String(form.get("weiter") ?? "/konto/treffer"));
  return weiterleiten(`${weiter}${weiter.includes("?") ? "&" : "?"}hinweis=${encodeURIComponent(r.ok ? `Stand: ${STATUS[status]}` : "Das darfst du für diese Ausschreibung nicht ändern.")}`);
}

async function kaufverantwortlichSpeichern(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const vorgang = String(form.get("vorgang") ?? "");
  const person = String(form.get("person") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(vorgang) || (person && !/^[0-9a-f-]{36}$/.test(person))) return weiterleiten("/konto/treffer?hinweis=Ungültige%20Auswahl.", s.cookies);
  const r = await db<{ id: string }[]>(s, env, `vorgaenge?id=eq.${vorgang}&select=id`, {
    method: "PATCH", headers: { prefer: "return=representation" },
    body: JSON.stringify({ kaufverantwortlich_id: person || null }),
  });
  const ok = r.ok && r.daten.length === 1;
  return weiterleiten(`/konto/vorgang/${vorgang}?hinweis=${encodeURIComponent(ok ? (person ? "Kaufmännisch verantwortliche Person gespeichert." : "Zuständigkeit aufgehoben.") : "Die Zuständigkeit konnte nicht geändert werden. Prüfe den Bereichszugriff.")}`, s.cookies);
}

/** The Vorgang with its firm and the user's role there, or null if the user may not see it. */
export async function vorgangZugriff(request: Request, env: KontoEnv, id: string): Promise<{ s: Sitzung; v: Vorgang & { firma_id: string }; rolle: string; finanzen: boolean } | null> {
  const s = await sitzung(request, env);
  if (!s || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await db<(Vorgang & { firma_id: string })[]>(s, env, `vorgaenge?id=eq.${id}&select=id,firma_id,titel,link,frist,status,punkte,erstellt,bereich_id,kaufverantwortlich_id,steckbrief,katalog_id,katalog_version`);
  const v = r.ok ? r.daten[0] : undefined;
  if (!v) return null;
  const m = await db<{ rolle: string; finanzen?: boolean }[]>(s, env, `mitglieder?firma_id=eq.${v.firma_id}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,finanzen`);
  if (!m.ok || !m.daten[0] || m.daten[0].rolle === "mitarbeiter") return null;
  return { s, v, rolle: m.daten[0].rolle, finanzen: darfFinanzen(m.daten[0].rolle, m.daten[0].finanzen) };
}

async function vorgangZeigen(id: string, request: Request, env: KontoEnv): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) {
    if (!(await sitzung(request, env))) return weiterleiten("/konto");
    return html(seite("Nicht gefunden", `<p>Diese Ausschreibung gibt es nicht oder du darfst sie nicht sehen.</p><p><a href="/konto">Zur Übersicht</a></p>`), 404);
  }
  const { s, v, rolle, finanzen } = z;
  // "Zuletzt angesehen" on the overview: the last three opened tenders, newest first.
  s.cookies.push(`jv_zuletzt=${[v.id, ...zuletztAngesehen(request).filter((x) => x !== v.id)].slice(0, 3).join(",")}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 90}`);
  // Recover summaries of historical hits saved before every hit received a short brief.
  if (!v.steckbrief?.trim() && v.link) {
    const archiv = (kurzberichte as Record<string, string>)[`${v.firma_id}|${v.link}`];
    if (archiv) v.steckbrief = `## Kurzüberblick aus dem Morgenbericht\n\n${archiv}\n\n_Dies ist die archivierte Zusammenfassung zur Bekanntmachung. Für eine ausführliche Prüfung bitte die Vergabeunterlagen hochladen._`;
  }
  const fehler = new URL(request.url).searchParams.get("fehler") ?? new URL(request.url).searchParams.get("hinweis") ?? "";
  const portal = v.link && /^https?:\/\//.test(v.link) ? v.link : "";
  const aus = await unterlagenSteckbrief(env, id);
  // Actions below the Steckbrief: first read, then act (two per row on the phone). Download and check sit in the upload section.
  const kalkulation = aus?.text ? `/auftrag/${aus.auftrag}#kalkulation` : "/konto/kalkulation";
  let kaufverantwortlich = "";
  if (["inhaber", "admin", "bearbeiter"].includes(rolle)) {
    const [mitglieder, zuordnungen, bereiche] = await Promise.all([
      db<{ user_id: string; rolle: string; anzeigename: string | null; funktion: string | null; alle_bereiche: boolean; aktiv: boolean }[]>(s, env, `mitglieder?firma_id=eq.${v.firma_id}&aktiv=eq.true&rolle=in.(inhaber,admin,bearbeiter)&select=user_id,rolle,anzeigename,funktion,alle_bereiche,aktiv&order=rolle,anzeigename`),
      db<{ user_id: string; bereich_id: string }[]>(s, env, `mitglied_bereiche?firma_id=eq.${v.firma_id}&select=user_id,bereich_id`),
      db<{ id: string; parent_id: string | null }[]>(s, env, `bereiche?firma_id=eq.${v.firma_id}&select=id,parent_id`),
    ]);
    if (mitglieder.ok && zuordnungen.ok && bereiche.ok) {
      const eltern: string[] = [];
      let b = v.bereich_id ?? null;
      while (b && !eltern.includes(b)) { eltern.push(b); b = bereiche.daten.find((x) => x.id === b)?.parent_id ?? null; }
      const kandidaten = mitglieder.daten.filter((x) => ["inhaber", "admin"].includes(x.rolle) || !v.bereich_id || x.alle_bereiche || zuordnungen.daten.some((z) => z.user_id === x.user_id && eltern.includes(z.bereich_id)));
      const aktueller = v.kaufverantwortlich_id ? await db<{ user_id: string; rolle: string; anzeigename: string | null; funktion: string | null; aktiv: boolean }[]>(s, env, `mitglieder?firma_id=eq.${v.firma_id}&user_id=eq.${v.kaufverantwortlich_id}&select=user_id,rolle,anzeigename,funktion,aktiv`) : null;
      const eingetragen = aktueller?.ok ? aktueller.daten[0] : undefined;
      const alle = eingetragen && !kandidaten.some((x) => x.user_id === eingetragen.user_id) ? [...kandidaten, eingetragen] : kandidaten;
      kaufverantwortlich = `<h2>Kaufmännische Zuständigkeit</h2>${eingetragen && !eingetragen.aktiv ? `<p class="klein">Bisher: ${escape(eingetragen.anzeigename || eingetragen.funktion || "Mitglied")} (Zugang gesperrt)</p>` : ""}<form method="post" action="/konto/verantwortlich"><input type="hidden" name="vorgang" value="${v.id}"><label>Verantwortliche Person<select name="person"><option value="">Nicht zugewiesen</option>${alle.map((x) => `<option value="${x.user_id}"${x.user_id === v.kaufverantwortlich_id ? " selected" : ""}${!x.aktiv ? " disabled" : ""}>${escape(x.anzeigename || x.funktion || "Mitglied")} · ${escape(ROLLEN[x.rolle] ?? x.rolle)}${!x.aktiv ? " (gesperrt)" : ""}</option>`).join("")}</select></label><button>Zuständigkeit speichern</button></form>`;
    }
  }
  const knoepfe = [
    ["inhaber", "admin"].includes(rolle) ? `<a href="/konto/vorgang/${v.id}/freigeben">👥 An Mitarbeiter weitergeben</a>` : "",
    finanzen ? `<a href="/konto/vorgang/${v.id}/angebot">📝 Angebot vorbereiten</a>` : "",
    finanzen ? `<a class="zweit" href="${kalkulation}">💶 Kalkulation</a>` : "",
  ].filter(Boolean).join("");
  const leiste = knoepfe ? `<h2>Was möchtest du tun?</h2><nav class="aktionsleiste" aria-label="Aktionen">${knoepfe}</nav>` : "";
  const kopf = `<p>${v.punkte ? `<strong>${v.punkte}/10</strong> · ` : ""}Frist: ${v.frist ? datum(v.frist) : "unbekannt"} · Stand: ${STATUS[v.status] ?? v.status}</p>
${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}`;
  // Required proofs the firm has not uploaded yet get a ⚠️ with an upload link (only for people with finance access).
  const unterlagen = finanzen ? await db<FirmenDatei[]>(s, env, `firmenunterlagen?firma_id=eq.${v.firma_id}&select=*`) : null;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const stichtag = v.frist && v.frist.slice(0, 10) > heute ? v.frist.slice(0, 10) : heute;
  const brief = (md: string) => `<div class="steckbrief-karte">${briefInhalt(md)}</div>`;
  const briefInhalt = (md: string) => nachweiseMarkieren(markdown(md), unterlagen?.ok ? unterlagen.daten : null, stichtag, `/konto/firmenunterlagen?firma=${v.firma_id}`);
  const hochladen = rolle === "leser" ? "" : `<h2 id="unterlagen">📥 Vergabeunterlagen</h2>
<p>Für Eignungskriterien, Nachweise, Referenzen und das Preisblatt braucht Jarvis die Unterlagen.</p>
${portal ? `<nav class="aktionsleiste"><a class="zweit" href="${escape(portal)}" rel="noopener" target="_blank">⬇️ Hier runterladen</a></nav>
<p class="klein">Öffnet das Vergabeportal. Dort „Alle herunterladen“ bzw. „Vergabeunterlagen“ tippen (meist eine ZIP-Datei; manche Portale wollen eine kostenlose Anmeldung).</p>` : `<p class="klein">Die Ausschreibung beim Vergabeportal öffnen und die Unterlagen herunterladen.</p>`}
<form method="post" action="/konto/vorgang/${v.id}/unterlagen" enctype="multipart/form-data">
  <label>Danach die heruntergeladenen Dateien hier auswählen (eine oder mehrere) – Jarvis legt sofort los<input name="dateien" type="file" multiple required data-sofort accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label>
  <button>Prüfen lassen</button>
</form>
<details><summary>Tipps zum Hochladen</summary><p class="klein"><strong>Mehrere Dateien:</strong> Im Auswahlfenster die erste Datei lange drücken, dann die anderen antippen und oben auf „Auswählen“ bzw. „Fertig“. Einfacher ist meist „Alle herunterladen“ beim Portal: Dann kommt eine ZIP-Datei mit allem, und die reicht. Vergessene Dateien kannst du später nachreichen, Jarvis liest dann alle zusammen.</p>
<p class="klein">Am Handy liegt die Datei unter „Downloads“. Jarvis schreibt daraus in 2 bis 5 Minuten einen ausführlichen Steckbrief und eine Kalkulation. Die Dateien werden nur dafür gelesen und nach 30 Tagen gelöscht.</p></details>`;
  let teil: string;
  if (aus?.text) {
    teil = `<h2>Steckbrief aus den Vergabeunterlagen</h2>${brief(aus.text)}
${leiste}${hochladen.replace("📥 Vergabeunterlagen", "📥 Dateien nachreichen")}
${v.steckbrief ? `<details><summary>Kurz-Steckbrief aus der Bekanntmachung</summary>${brief(v.steckbrief)}</details>` : ""}`;
  } else if (aus) {
    return html(seite(v.titel, `${kopf}${kaufverantwortlich}${await fortschritt(env, aus.auftrag)}
${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${brief(v.steckbrief)}` : ""}${leiste}`, 20, "treffer"), 200, s.cookies);
  } else {
    teil = `${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${brief(v.steckbrief)}` : `<p class="klein">Noch kein Steckbrief.</p>`}${leiste}${hochladen}`;
  }
  const teilnahme = await teilnahmeTeil(s, env, v, finanzen, ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(rolle), new URL(request.url).searchParams.get("los") ?? "");
  const personalBlock = rolle === "leser" || rolle === "mitarbeiter" ? "" : await einsatzTeil(s, env, v, ["inhaber", "admin", "bearbeiter"].includes(rolle));
  return html(seite(v.titel, kopf + kaufverantwortlich + teil + teilnahme + personalBlock, 0, "treffer"), 200, s.cookies);
}

/** Steckbrief written from documents uploaded at this Vorgang: null = none, text "" = still running. */
/** Waiting page: step x of 3 with what the Steckbrief workflow is doing right now. */
async function fortschritt(env: KontoEnv, auftrag: string): Promise<string> {
  const roh = env.DATEN ? await env.DATEN.get(`auftraege/${auftrag}/status.json`) : null;
  const st = roh ? (await roh.json().catch(() => null)) as { schritt?: number; text?: string } | null : null;
  const schritt = Math.min(3, Math.max(1, Number(st?.schritt) || 1));
  return `<div class="laedt" role="status"><span class="kreisel" aria-hidden="true"></span><span><strong>Schritt ${schritt} von 3: ${escape(st?.text || "Jarvis bereitet die Unterlagen vor")}</strong><br><span class="klein">Das dauert meist 2 bis 5 Minuten. Die Seite aktualisiert sich von selbst; du kannst sie auch schließen.</span><progress max="3" value="${schritt}" aria-hidden="true"></progress></span></div>`;
}

export async function unterlagenSteckbrief(env: KontoEnv, id: string): Promise<{ auftrag: string; text: string } | null> {
  if (!env.DATEN) return null;
  const zeiger = await env.DATEN.get(`auftraege/vorgaenge/${id}.json`);
  if (!zeiger) return null;
  const { auftrag, erstellt } = (await zeiger.json()) as { auftrag: string; erstellt: string };
  const ergebnis = await env.DATEN.get(`auftraege/${auftrag}/ergebnis.md`);
  if (ergebnis) return { auftrag, text: await ergebnis.text() };
  // Still no result after 30 minutes: the run failed, offer the upload again.
  return Date.now() - Date.parse(erstellt) > 30 * 60_000 ? null : { auftrag, text: "" };
}

// ---------- Daily mail ----------

export function stundenOptionen(aktuell: number | null): string {
  const stunden = Array.from({ length: 14 }, (_, i) => i + 7);
  return `<option value=""${aktuell === null ? " selected" : ""}>keine Mail</option>` +
    stunden.map((h) => `<option value="${h}"${h === aktuell ? " selected" : ""}>${h}:00 Uhr</option>`).join("");
}

/** Saves the person's own mail hour (null = no mail). */
export async function mailZeitSetzen(s: Sitzung, env: KontoEnv, firma: string, wert: unknown, kanalWert?: unknown): Promise<boolean> {
  // Without a channel (setup assistant) the existing choice stays; new rows start with mail.
  const kanal = ["mail", "push", "beides"].includes(String(kanalWert)) ? String(kanalWert) : undefined;
  const h = typeof wert === "string" && wert !== "" ? Number(wert) : null;
  const stunde = h !== null && Number.isInteger(h) && h >= 7 && h <= 20 ? h : null;
  const r = await db(s, env, "benachrichtigungen?on_conflict=firma_id,user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ firma_id: firma, user_id: s.userId, stunde, kanal }),
  });
  return r.ok;
}

async function mailSetzen(s: Sitzung, form: FormData, _r: Request, env: KontoEnv): Promise<Response> {
  const firma = String(form.get("firma") ?? "");
  const ok = /^[0-9a-f-]{36}$/.test(firma) && (await mailZeitSetzen(s, env, firma, form.get("stunde"), form.get("kanal")));
  const h = String(form.get("stunde") ?? "");
  const wie = KANAELE[String(form.get("kanal"))] ?? "Mail";
  return weiterleiten(`/konto/einstellungen?hinweis=${encodeURIComponent(!ok ? "Die Einstellung konnte nicht gespeichert werden." : h ? `Jeden Tag um ${h}:00 Uhr per ${wie}.` : "Keine tägliche Nachricht mehr.")}#mail`);
}

const KANAEL_LISTE: [string, string][] = [["mail", "Mail"], ["push", "Handy"], ["beides", "Mail und Handy"]];
const KANAELE: Record<string, string> = Object.fromEntries(KANAEL_LISTE);

/** Public VAPID key for registering a device (public by design). */
async function pushSchluessel(env: KontoEnv): Promise<Response> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/push_schluessel`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: "{}" });
  const k = r.ok ? ((await r.json()) as string | null) : null;
  return new Response(k ?? "", { status: k ? 200 : 503, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}

/** Saves this device's push subscription for the logged-in person. */
async function pushAbo(request: Request, env: KontoEnv): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return new Response("nicht angemeldet", { status: 401 });
  let abo: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    abo = await request.json();
  } catch {
    return new Response("ungültig", { status: 400 });
  }
  const endpoint = String(abo.endpoint ?? "");
  const p256dh = String(abo.keys?.p256dh ?? "");
  const auth = String(abo.keys?.auth ?? "");
  if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return new Response("ungültig", { status: 400 });
  const r = await db(s, env, "push_abos?on_conflict=endpoint", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint, p256dh, auth, user_id: s.userId }),
  });
  const antwort = new Response(r.ok ? "ok" : "fehler", { status: r.ok ? 200 : 500 });
  for (const c of s.cookies) antwort.headers.append("set-cookie", c);
  return antwort;
}

/** Text of the latest notification; the service worker fetches it when an (empty) push arrives. */
async function pushNeu(request: Request, env: KontoEnv): Promise<Response> {
  const s = await sitzung(request, env);
  const r = s ? await db<{ titel: string; text: string; url: string }[]>(s, env, "push_nachrichten?select=titel,text,url&order=erstellt.desc&limit=1") : null;
  const n = r?.ok ? r.daten[0] : undefined;
  const antwort = Response.json(n ? { ...n, url: sicherWeiter(n.url) } : { titel: "Jarvis", text: "Neue Ausschreibungen", url: "/konto" }, { headers: { "cache-control": "no-store" } });
  for (const c of s?.cookies ?? []) antwort.headers.append("set-cookie", c);
  return antwort;
}

// ---------- Helpers ----------

export async function db<T = unknown>(s: Sitzung, env: KontoEnv, pfad: string, init: RequestInit = {}): Promise<{ ok: true; daten: T } | { ok: false; status: number; fehler: string }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${pfad}`, {
    ...init,
    headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}`, "content-type": "application/json", prefer: "return=minimal", ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, fehler: text.slice(0, 500) };
  return { ok: true, daten: (text ? JSON.parse(text) : null) as T };
}

export function tokenCookies(t: { access_token: string; refresh_token: string; expires_in: number }): string[] {
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
    "content-security-policy": CSP,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(body, { status, headers: h });
}
