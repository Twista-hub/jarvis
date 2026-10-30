// Accounts: login (anmeldung.ts, Supabase Auth) and the firm pages
// (create a firm, areas, invitations). All data access runs with the user's token, so the database
// rules (row level security) decide what each person may see and change.
import { bereichOptionen as optionenFuerBereiche } from "./bereiche.ts";
import { funktionsListe, personFormular } from "./mitarbeiter.ts";
import { darfFinanzen, ZUGRIFFE } from "./rechte.ts";
import { einladungsMail, senden } from "./mail.ts";
import { CSP } from "./app.ts";
import { FELDER, STANDARD, felderHtml, fmt, zahl, type Eingaben } from "./kalkulation.ts";
import { escape, hilfe, markdown, seite } from "./seite.ts";
import { nachweiseMarkieren } from "./nachweise.ts";
import { anmeldeFormular, anmeldung } from "./anmeldung.ts";
import { einsaetzeLaden, einsatzTeil, personalTeil, qualifikationenBlock, standortKacheln, standortleitungBlock, tarifvertraegeBlock, tarifvertraegeLaden, type Kraft } from "./personal.ts";
import type { FirmenDatei } from "./firmenunterlagen.ts";
import { teilnahmeTeil } from "./markt.ts";
import { kurzberichte } from "./kurzberichte.ts";

export interface KontoEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable key, public by design
  SMTP_PASSWORD?: string; // kontakt@wpdigitalranger.com; without it invitations are shown as a link
  DATEN?: R2Bucket; // uploads at a Vorgang: auftraege/vorgaenge/<id>.json points to the Steckbrief job
}

export type Sitzung = { token: string; userId: string; email: string; cookies: string[] };
type Mitglied = { firma_id: string; rolle: string; aktiv?: boolean; erstellt: string; user_id: string; anzeigename?: string; funktion?: string; finanzen?: boolean; alle_bereiche?: boolean };
export type Bereich = { id: string; name: string; art: string; parent_id: string | null };
type Vorgang = { id: string; titel: string; link: string | null; frist: string | null; status: string; punkte: number | null; erstellt: string; bereich_id?: string | null; katalog_id?: string | null; katalog_version?: string | null; steckbrief?: string | null };
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

/** Handles /konto, /anmelden, /einladung and /abmelden; null for other paths. */
export async function konto(request: Request, env: KontoEnv, dateiProfil: (firma: string) => { beschreibung: string } | undefined = () => undefined): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const post = request.method === "POST";
  const a = await anmeldung(request, env);
  if (a) return a;
  if (p === "/abmelden" && post) return abmelden(request, env);
  if (!post && ["/konto/ausschreibungen", "/konto/firma-team"].includes(p)) return weiterleiten(p === "/konto/ausschreibungen" ? "/konto/treffer" : "/konto/team");
  if (p === "/konto/kalkulation" && post) return mitSitzung(request, env, vorlageSpeichern);
  if (p === "/konto" && !post && (url.searchParams.has("bereich") || url.searchParams.has("alle"))) return weiterleiten(`/konto/treffer${url.search}`);
  if (p === "/konto" && !post) return uebersicht(request, env, url.searchParams.get("hinweis") ?? "", "", dateiProfil);
  const kontoSeite = p.match(/^\/konto\/(treffer|fristen|unterlagen|kalkulation|team|einstellungen|profil|suchprofil)$/);
  if (kontoSeite && !post) return uebersicht(request, env, url.searchParams.get("hinweis") ?? "", kontoSeite[1], dateiProfil);
  if (p === "/konto/firma" && post) return mitSitzung(request, env, firmaAnlegen);
  if (p === "/konto/bereich" && post) return mitSitzung(request, env, bereichAnlegen);
  if (p === "/konto/einladen" && post) return mitSitzung(request, env, einladen);
  if (p === "/konto/status" && post) return mitSitzung(request, env, statusSetzen);
  if (p === "/konto/mail" && post) return mitSitzung(request, env, mailSetzen);
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

async function uebersicht(request: Request, env: KontoEnv, hinweis: string, unterseite = "", dateiProfil: (firma: string) => { beschreibung: string } | undefined = () => undefined): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return html(seite("Anmelden", anmeldeFormular("", new URL(request.url).pathname + new URL(request.url).search, "Melde dich an, um Ausschreibungen, Bereiche und Mitarbeiter deiner Firma zu verwalten.")));
  const meine = await db<(Mitglied & { firmen: { name: string; paket: string } })[]>(s, env, `mitglieder?user_id=eq.${s.userId}&aktiv=eq.true&select=firma_id,rolle,erstellt,user_id,anzeigename,funktion,finanzen,alle_bereiche,firmen(name,paket)&order=erstellt`);
  const kopf = hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : "";
  const abmelden = `<form method="post" action="/abmelden"><button>Abmelden</button></form>`;
  if (meine.ok && !meine.daten.length) {
    // Registered with firm data: create the firm now (free plan) and go straight to the setup assistant.
    const neu = await db<string | null>(s, env, "rpc/registrierung_abschliessen", { method: "POST", body: "{}" });
    if (neu.ok && typeof neu.daten === "string") return weiterleiten(`/konto/einrichtung?firma=${neu.daten}`, [...s.cookies, `jv_firma=${neu.daten}; ${COOKIE}; Max-Age=${60 * 60 * 24 * 365}`]);
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
  const statusFilter = unterseite === "treffer" ? `&status=in.(${gruppen[reiter].join(",")})` : unterseite === "fristen" ? "&status=in.(neu,pruefen,angebot)&frist=not.is.null" : "";
  const bereiche = await db<Bereich[]>(s, env, `bereiche?firma_id=eq.${m.firma_id}&select=id,name,art,parent_id&order=name`);
  const b = bereiche.ok ? bereiche.daten : [];
  // Filter by area, including its sub-areas.
  const filter = b.find((x) => x.id === url.searchParams.get("bereich"));
  const unter = (id: string): string[] => [id, ...b.filter((x) => x.parent_id === id).flatMap((x) => unter(x.id))];
  const bereichFilter = filter ? `&bereich_id=in.(${unter(filter.id).join(",")})` : "";
  const [vorgaenge, mitglieder, einladungen, anzahl] = await Promise.all([
    db<Vorgang[]>(s, env, `vorgaenge?firma_id=eq.${m.firma_id}${bereichFilter}${statusFilter}&select=id,titel,link,frist,status,punkte,erstellt,bereich_id&order=${unterseite === "fristen" ? "frist.asc" : "punkte.desc.nullslast,erstellt.desc"}&limit=100`),
    db<Mitglied[]>(s, env, `mitglieder?firma_id=eq.${m.firma_id}&select=firma_id,rolle,aktiv,erstellt,user_id,anzeigename,funktion,finanzen,alle_bereiche&order=erstellt`),
    admin ? db<Einladung[]>(s, env, `einladungen?firma_id=eq.${m.firma_id}&angenommen=is.null&gueltig_bis=gt.${new Date().toISOString()}&select=id,email,rolle,gueltig_bis,angenommen&order=erstellt.desc`) : Promise.resolve({ ok: true, daten: [] as Einladung[] }),
    db<number>(s, env, "rpc/nutzer_zaehlen", { method: "POST", body: JSON.stringify({ f: m.firma_id }) }),
  ]);
  const [profil, mail] = await Promise.all([
    db<{ id: string; beschreibung: string; erstlauf: string | null; fertig: string | null }[]>(s, env, `suchprofile?firma_id=eq.${m.firma_id}&bereich_id=is.null&aktiv=eq.true&select=id,beschreibung,erstlauf:einstellungen->>erstlauf,fertig:einstellungen->>erstlauf_fertig&limit=1`),
    db<{ stunde: number | null; kanal: string }[]>(s, env, `benachrichtigungen?firma_id=eq.${m.firma_id}&user_id=eq.${s.userId}&select=stunde,kanal`),
  ]);
  const hinterlegt = dateiProfil(m.firma_id);
  const sucheEingerichtet = (profil.ok && profil.daten.length > 0) || Boolean(hinterlegt);
  // First run after the setup assistant: about 5 minutes; the page reloads until then.
  const erstlauf = profil.ok && profil.daten[0]?.erstlauf ? Date.now() - Date.parse(profil.daten[0].erstlauf) : Infinity;
  const start = Date.now() - erstlauf;
  // Searching until the run marks itself done (alarm.yml "Erster Lauf fertig"); at most 20 minutes.
  const fertig = profil.ok && profil.daten[0]?.fertig ? Date.parse(profil.daten[0].fertig) : 0;
  const sucht = erstlauf < 20 * 60_000 && fertig < start;
  const stunde = mail.ok && mail.daten[0] ? mail.daten[0].stunde : null;
  const kanal = mail.ok && mail.daten[0] ? mail.daten[0].kanal : "mail";
  const name = (id: string | null | undefined) => b.find((x) => x.id === id)?.name ?? "";
  const bereichOptionen = optionenFuerBereiche(b);

  const wechsel = meine.daten.length > 1
    ? `<h2>Firma wechseln</h2><form class="profil-firmenwechsel" method="get" action="/konto/profil"><label>Aktive Firma<select name="firma">${meine.daten.map((x) => `<option value="${x.firma_id}"${x.firma_id === m.firma_id ? " selected" : ""}>${escape(x.firmen.name)}</option>`).join("")}</select></label><button>Wechseln</button></form>`
    : "";

  const link = (stand: string, bereich = filter?.id ?? "") => `/konto/treffer?stand=${stand}${bereich ? `&bereich=${bereich}` : ""}`;
  const bereichWahl = b.length ? `<form class="treffer-filter" method="get" action="/konto/treffer"><input type="hidden" name="stand" value="${reiter}"><label>Bereich / Standort<select name="bereich"><option value="">Alle Bereiche</option>${optionenFuerBereiche(b, filter?.id)}</select></label><button>Anzeigen</button></form>` : "";
  const liste = vorgaenge.ok ? vorgaenge.daten : [];
  const heute = new Date().toISOString().slice(0, 10);
  const in7Tagen = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const fristen = liste.filter((v) => v.frist && ["neu", "pruefen", "angebot"].includes(v.status)).sort((a, b) => (a.frist ?? "").localeCompare(b.frist ?? ""));
  const bald = fristen.filter((v) => v.frist!.slice(0, 10) >= heute && v.frist!.slice(0, 10) <= in7Tagen).length;
  const neu = liste.filter((v) => ["neu", "pruefen"].includes(v.status)).length;
  const labels: Record<string, string> = { treffer: "Ausschreibungen", fristen: "Fristen", unterlagen: "Unterlagen prüfen", kalkulation: "Kalkulation", team: "Firma & Team", einstellungen: "Einstellungen", profil: "Mein Profil", suchprofil: "Suchprofil" };
  const rahmen = (body: string) => `${kopf}${body}`;
  const meldungen = sucht ? `<p class="laedt" role="status"><span class="kreisel" aria-hidden="true"></span><span><strong>Jarvis durchsucht gerade die Ausschreibungen der letzten 7 Tage.</strong><br><span class="klein">Das dauert etwa 5 bis 10 Minuten. Du kannst die App ruhig schließen. Die Treffer stehen danach hier, diese Seite aktualisiert sich von selbst.</span></span></p>` : "";
  const cards = [
    ["treffer", "📋", "Ausschreibungen", `${neu} neue Treffer`],
    ["fristen", "⏰", "Fristen", `${bald} Fristen diese Woche`],
    ["unterlagen", "📥", "Unterlagen", "Dateien hochladen und prüfen lassen"],
    ["kalkulation", "💶", "Kalkulation", "Ergebnisse aus Unterlagen ansehen"],
    ["team", "👥", "Firma & Team", "Standorte und Einladungen verwalten"],
    ["markt", "🌐", "Markt & Chancen", "Offene Aufträge, Bedarf und Partner"],
    ["suchprofil", "🔎", "Suchprofil", sucheEingerichtet ? "Suche ansehen und anpassen" : "Passende Ausschreibungen finden"],
  ];
  cards.push(["freigaben", "📨", "Für mich freigegeben", "Ausgewählte Informationen vom Team"]);
  const sichtbareKarten = cards.filter(([path]) => m.rolle === "mitarbeiter" ? path === "freigaben" : path !== "kalkulation" || finanzrecht);
  const kacheln = `<div class="konto-kacheln">${sichtbareKarten.map(([path, icon, title, hint]) => `<a class="konto-kachel" href="/konto/${path}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(title)}</strong><span class="klein">${hint}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>`;
  let inhalt: string;
  if (!unterseite) {
    inhalt = m.rolle === "mitarbeiter" ? rahmen(`<p>Hier findest du die Informationen, die dir dein Team persönlich freigegeben hat.</p>${kacheln}`) : rahmen(`${meldungen}<h2>Was möchtest du tun?</h2><p>${neu} neue Treffer · ${bald} Fristen diese Woche</p>${kacheln}${admin && finanzrecht ? `<p><a href="/konto/angebotsfreigaben">Angebote zur Chef-Freigabe prüfen →</a></p>` : ""}`);
  } else if (unterseite === "treffer") {
    const tabs = `<nav class="reiter" aria-label="Stand der Ausschreibungen">${[["neu", "Neu"], ["arbeit", "In Arbeit"], ["abgegeben", "Abgegeben"], ["archiv", "Archiv"]].map(([key, label]) => `<a href="${link(key)}"${key === reiter ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
    inhalt = rahmen(`${hilfe("Ausschreibungen sortieren", "Neu zeigt frische Treffer, In Arbeit die Angebote, an denen ihr arbeitet, Abgegeben bereits eingereichte Angebote und Archiv abgeschlossene oder aussortierte Treffer. Tippe eine Karte an, um Steckbrief und Aktionen zu öffnen.")}${meldungen}${tabs}${trefferListe(liste.filter((v) => gruppen[reiter].includes(v.status)), name, bereichWahl, link(reiter))}`);
  } else if (unterseite === "fristen") {
    inhalt = rahmen(`<h2>Nächste Fristen</h2>${fristen.length ? `<ul class="fristen-liste">${fristen.map((v) => `<li${v.frist!.slice(0, 10) <= in7Tagen ? ' class="frist-bald"' : ""}><time datetime="${escape(v.frist!)}">${datum(v.frist!)}</time><a href="/konto/vorgang/${v.id}">${escape(v.titel)}</a></li>`).join("")}</ul>` : `<p>Aktuell stehen keine offenen Fristen an.</p>`}<p class="klein">Jarvis erinnert dich zusätzlich 7 und 2 Tage vorher per täglicher Nachricht.</p>`);
  } else if (unterseite === "unterlagen") {
    const unterlagen = await unterlagenListe(liste, env);
    inhalt = rahmen(`${finanzrecht ? `<p><a class="knopf" href="/konto/firmenunterlagen?firma=${m.firma_id}">Firmenunterlagen & Angebotsvorlagen</a></p>` : ""}<p>Lade Vergabeunterlagen auch ohne vorhandenen Treffer hoch. Jarvis erstellt daraus einen Steckbrief und eine Kalkulation.</p>${hilfe("Was passiert mit den Dateien?", "Jarvis liest sie nur, um die Ausschreibung zu prüfen und den Steckbrief zu erstellen. Vergabeunterlagen werden nach 30 Tagen gelöscht. Firmen-Nachweise und Angebotsvorlagen verwaltest du separat unter Firmenunterlagen.")}${["inhaber","admin","bearbeiter"].includes(m.rolle) ? `<form method="post" action="/konto/unterlagen" enctype="multipart/form-data"><input type="hidden" name="firma" value="${m.firma_id}">${auswahlFeld(liste)}<div data-neu><label>Titel oder Link der neuen Ausschreibung<input name="titel" maxlength="300"></label>${b.length ? `<label>Bereich<select name="bereich"><option value="">ganze Firma</option>${bereichOptionen}</select></label>` : ""}</div><label>Unterlagen<input name="dateien" type="file" multiple required accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label><button>Hochladen und prüfen</button></form>` : `<p class="klein">Als Leser kannst du vorhandene Steckbriefe ansehen.</p>`}<h2>Bisherige Steckbriefe aus Unterlagen</h2>${unterlagen || `<p>Noch keine Unterlagen geprüft.</p>`}<p><a href="/konto/treffer">Unterlagen bei einem Treffer nachreichen →</a></p>`);
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
    inhalt = rahmen(`<h2>Ausschreibung kalkulieren</h2>${hilfe("So entsteht der Preis", "Die Kalkulation schätzt eure Selbstkosten je Stunde aus Bruttolohn, Nebenkosten, Ausfallzeit und Einsatzkosten. Gemeinkosten sowie Wagnis und Gewinn ergeben daraus den Angebotspreis. Prüfe die Werte pro Los, bevor du ein Angebot erstellst.")}${await kalkulationsAuswahl(liste, env)}<h2>Standardwerte</h2>${ortWahl}<p>${bereich ? `Diese Werte gelten für ${escape(bereichPfad(bereich, b))}. Fehlen eigene Standortwerte, dienen die Firmenwerte als Ausgangspunkt.` : "Diese Werte gelten für die ganze Firma. Standorte können eigene Werte haben."}</p>${!vorlagen.ok ? `<p class="fehler">Die gespeicherten Werte konnten nicht geladen werden. Bitte lade die Seite erneut.</p>` : `<form method="post" action="/konto/kalkulation"><input type="hidden" name="firma" value="${m.firma_id}"><input type="hidden" name="bereich" value="${bereich ? escape(bereich.id) : ""}">${felderHtml(werte, m.rolle === "leser")}${m.rolle !== "leser" ? `<button>${bereich ? "Standortwerte" : "Firmenwerte"} speichern</button>` : ""}</form>`}`);
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
      const pool = await db<{ bereich_id: string | null; status: string }[]>(s, env, `personal?firma_id=eq.${m.firma_id}&select=bereich_id,status`);
      team = `<h2>Organisationsbaum</h2><p class="klein">Firma → Region → Standort. Die Standortleitung erhält ihre Rechte über genau einen zugeordneten Standort. Einsatzpersonal und App-Zugänge werden getrennt verwaltet.</p>`;
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
      team += `<h2 id="app-zugaenge">App-Zugänge</h2><p class="klein">Diese Personen melden sich bei Jarvis an. Einsatzkräfte stehen separat im Organisationsbaum.</p><p class="klein">Deine Rolle: <strong>${ROLLEN[m.rolle] ?? m.rolle}</strong> · Nutzer: ${anzahl.ok ? anzahl.daten : "?"}. Standortleitung darf Personal und Einsätze nur am zugeordneten Standort verwalten; Kalkulation und Firmenunterlagen bleiben gesperrt.</p>${hilfe("Funktion und Zugriff", "Die Funktion beschreibt die Aufgabe in der Firma. Der Zugriff legt getrennt davon fest, welche Daten die Person sehen und bearbeiten darf. Finanzfreigabe gibt zusätzlich Zugriff auf Kalkulation und Firmenunterlagen.")}${tarifvertraegeBlock(tarife, admin)}`;
    const ml = mitglieder.ok ? mitglieder.daten : [];
    team += funktionsListe;
    team += `<div class="mitarbeiter-liste">${ml.map((x) => `<article class="treffer-karte"${x.aktiv === false ? ' style="opacity:.75"' : ""}><h3>${escape(x.anzeigename || (x.user_id === s.userId ? s.email : "Mitarbeiter"))}</h3><p>${escape(x.funktion || "Mitarbeiter/in")} · ${escape(ROLLEN[x.rolle] ?? x.rolle)}${x.aktiv === false ? " · Zugang gesperrt" : ""}</p>${admin ? personFormular(x, m.firma_id, b, zuordnungen.ok ? zuordnungen.daten.filter((z) => z.user_id === x.user_id).map((z) => z.bereich_id) : [], m.rolle === "inhaber") : ""}</article>`).join("")}</div>`;
    if (admin) {
    const offen = einladungen.ok ? einladungen.daten : [];
    if (offen.length) {
      team += `<p class="klein">Offene Einladungen: ${offen.map((e) => `${escape(e.email)} (${ROLLEN[e.rolle] ?? e.rolle}, bis ${datum(e.gueltig_bis)})`).join(", ")}</p>`;
    }
    team += `<form method="post" action="/konto/einladen">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Name<input name="name" maxlength="200"></label>
  <label>E-Mail-Adresse <input type="email" name="email" required></label>
  <label>Funktion im Betrieb<input name="funktion" list="funktionen" value="Mitarbeiter/in" required maxlength="100"></label>
      <label>Zugriff<select name="rolle">${Object.entries(ZUGRIFFE).filter(([r]) => r !== "inhaber").sort(([a],[b]) => Number(b === "mitarbeiter") - Number(a === "mitarbeiter")).map(([r,t]) => `<option value="${r}">${escape(t)}</option>`).join("")}</select></label>
  <label class="zeile"><input type="checkbox" name="finanzen">Finanzdaten zusätzlich freigeben (nur bei vollständigen Steckbriefen)</label><p class="klein">Funktion und Zugriffsrechte sind getrennt. „Nur persönlich freigegebene Informationen“ öffnet keine Originalunterlagen und keine Kalkulation. Inhaber und Administration sehen alle Daten.</p>
  ${b.length ? `<label>Bereich <select name="bereich"><option value="">ganze Firma</option>${bereichOptionen}</select></label><p class="klein">Für Standortleitung einen einzelnen Standort wählen, keine Region. Die Einladung gilt dort und in untergeordneten Teams.</p>` : ""}
  <button>Einladung erstellen</button>
  <p class="klein">Du bekommst einen Link, den du der Person schickst. Er gilt 14 Tage und nur für diese Adresse.</p>
</form>`;
    }
    inhalt = rahmen(team);
  } else if (unterseite === "profil") {
    inhalt = rahmen(`<h2>Dein Konto</h2><p>E-Mail-Adresse<br><strong>${escape(s.email)}</strong></p><p>Firma: ${escape(m.firmen.name)}<br>Rolle: ${ROLLEN[m.rolle] ?? escape(m.rolle)}</p><p><a href="/konto/passwort">Passwort ändern</a></p><p><a href="/konto/einstellungen">Nachrichten & Einstellungen</a></p><p><a href="/konto/suchprofil">Suchprofil der Firma</a></p>${wechsel}<h2>Abmelden</h2>${abmelden}`);
  } else if (unterseite === "suchprofil") {
    const beschreibung = (profil.ok ? profil.daten[0]?.beschreibung : "") || hinterlegt?.beschreibung || "";
    inhalt = rahmen(`${hilfe("Wie verbessert das Suchprofil die Treffer?", "Jarvis sucht mit den Leistungen, Suchwörtern, CPV-Codes, Standorten und Ausschlüssen. Du kannst den Vorschlag anpassen. Je genauer die Angaben, desto passender werden die Treffer.")}${!profil.ok ? `<p class="fehler">Der aktuelle Stand des Suchprofils konnte nicht geladen werden. Bitte versuche es erneut.</p>` : sucheEingerichtet ? `<p><strong>Die Suche für ${escape(m.firmen.name)} ist eingerichtet.</strong></p>` : `<p>Für diese Firma ist noch keine Suche eingerichtet.</p>`}${beschreibung ? `<p>${escape(beschreibung)}</p>` : ""}${admin && (profil.ok || sucheEingerichtet) ? `<p><a class="knopf" href="/konto/einrichtung?firma=${m.firma_id}">${sucheEingerichtet ? "Suchprofil anpassen" : "Suche einrichten"}</a></p>` : !admin ? `<p class="klein">Ein Inhaber oder Admin kann das Suchprofil anpassen.</p>` : ""}`);
  } else {
    inhalt = rahmen(`<p><a href="/konto/suchprofil">Suchprofil</a> · <a href="/konto/profil">Mein Profil</a> · <a href="/konto/team">Firma & Team</a> · <a href="/konto/kalkulation">Kalkulation</a> · <a href="/konto/unterlagen">Unterlagen prüfen</a></p>${meldungen}<h2 id="mail">🔔 Tägliche Nachricht</h2>
<form method="post" action="/konto/mail">
  <input type="hidden" name="firma" value="${m.firma_id}">
  <label>Neue Treffer und Fristen-Erinnerungen (7 und 2 Tage vorher) um<select name="stunde">${stundenOptionen(stunde)}</select></label>
  <label>Per<select name="kanal">${KANAEL_LISTE.map(([k, t]) => `<option value="${k}"${k === kanal ? " selected" : ""}>${t}</option>`).join("")}</select></label>
  <button>Speichern</button>
  <p class="klein">Nur wenn es etwas Neues gibt. Mail an ${escape(s.email)}. Ein Tipp auf die Handy-Nachricht öffnet direkt die Ausschreibung. Jeder im Team stellt das für sich selbst ein.</p>
</form>
<p><button type="button" id="push-an" hidden>📱 Nachrichten auf diesem Handy einschalten</button> <button type="button" id="push-test" hidden>🔔 Test auf diesem Handy</button></p>
<p class="klein" id="push-status"></p>
<h2>Konto</h2>${abmelden}`);
  }
  return html(seite(unterseite ? labels[unterseite] : m.firmen.name, inhalt, sucht ? 30 : 0, unterseite), 200, s.cookies);
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
  return mitUnterlagen.length ? `<ul class="konto-linkliste">${mitUnterlagen.map(({ v, aus }) => `<li><a href="/konto/vorgang/${v.id}">${escape(v.titel)}</a><span class="klein">${aus!.text ? "Steckbrief ansehen / Dateien nachreichen" : "Unterlagen werden geprüft …"}</span></li>`).join("")}</ul>` : "";
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

function trefferListe(liste: Vorgang[], bereichName: (id: string | null | undefined) => string, bereichWahl: string, weiter: string): string {
  if (!liste.length) return `${bereichWahl}<div class="treffer-leer"><h2>Noch keine Ausschreibungen</h2><p>In diesem Bereich gibt es aktuell keine Treffer. Wähle einen anderen Stand oder Bereich.</p></div>`;
  const optionen = (aktuell: string) => Object.entries(STATUS).map(([k, t]) => `<option value="${k}"${k === aktuell ? " selected" : ""}>${t}</option>`).join("");
  const karten = liste.map((v) => `<li><article class="treffer-karte">
  <div class="treffer-meta"><span class="treffer-punkte">${v.punkte !== null ? `${v.punkte}/10 Punkte` : "Ohne Bewertung"}</span><span class="treffer-status">${escape(STATUS[v.status] ?? v.status)}</span></div>
  <h2><a href="/konto/vorgang/${v.id}"><span>${escape(v.titel)}</span><span aria-hidden="true">›</span></a></h2>
  ${v.bereich_id ? `<p class="treffer-bereich">${escape(bereichName(v.bereich_id))}</p>` : ""}
  <p class="treffer-frist"><span>Abgabefrist</span>${v.frist ? `<time datetime="${escape(v.frist)}">${datum(v.frist)}</time>` : `<strong>Noch nicht bekannt</strong>`}</p>
  <details class="treffer-stand"><summary>Stand ändern</summary><form method="post" action="/konto/status">
    <input type="hidden" name="weiter" value="${escape(weiter)}"><input type="hidden" name="id" value="${v.id}">
    <label>Bearbeitungsstand<select name="status">${optionen(v.status)}</select></label><button>Speichern</button>
  </form></details>
</article></li>`).join("");
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

/** The Vorgang with its firm and the user's role there, or null if the user may not see it. */
export async function vorgangZugriff(request: Request, env: KontoEnv, id: string): Promise<{ s: Sitzung; v: Vorgang & { firma_id: string }; rolle: string; finanzen: boolean } | null> {
  const s = await sitzung(request, env);
  if (!s || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await db<(Vorgang & { firma_id: string })[]>(s, env, `vorgaenge?id=eq.${id}&select=id,firma_id,titel,link,frist,status,punkte,erstellt,bereich_id,steckbrief,katalog_id,katalog_version`);
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
  // Recover summaries of historical hits saved before every hit received a short brief.
  if (!v.steckbrief?.trim() && v.link) {
    const archiv = (kurzberichte as Record<string, string>)[`${v.firma_id}|${v.link}`];
    if (archiv) v.steckbrief = `## Kurzüberblick aus dem Morgenbericht\n\n${archiv}\n\n_Dies ist die archivierte Zusammenfassung zur Bekanntmachung. Für eine ausführliche Prüfung bitte die Vergabeunterlagen hochladen._`;
  }
  const fehler = new URL(request.url).searchParams.get("fehler") ?? "";
  const portal = v.link && /^https?:\/\//.test(v.link) ? v.link : "";
  const aus = await unterlagenSteckbrief(env, id);
  // Actions below the Steckbrief: first read, then act (two per row on the phone). Download and check sit in the upload section.
  const kalkulation = aus?.text ? `/auftrag/${aus.auftrag}#kalkulation` : "/konto/kalkulation";
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
  const brief = (md: string) => nachweiseMarkieren(markdown(md), unterlagen?.ok ? unterlagen.daten : null, stichtag, `/konto/firmenunterlagen?firma=${v.firma_id}`);
  const hochladen = rolle === "leser" ? "" : `<h2 id="unterlagen">📥 Vergabeunterlagen</h2>
<p>Für Eignungskriterien, Nachweise, Referenzen und das Preisblatt braucht Jarvis die Unterlagen.</p>
${portal ? `<nav class="aktionsleiste"><a class="zweit" href="${escape(portal)}" rel="noopener" target="_blank">⬇️ Hier runterladen</a></nav>
<p class="klein">Öffnet das Vergabeportal. Dort „Alle herunterladen“ bzw. „Vergabeunterlagen“ tippen (meist eine ZIP-Datei; manche Portale wollen eine kostenlose Anmeldung).</p>` : `<p class="klein">Die Ausschreibung beim Vergabeportal öffnen und die Unterlagen herunterladen.</p>`}
<form method="post" action="/konto/vorgang/${v.id}/unterlagen" enctype="multipart/form-data">
  <label>Danach die heruntergeladenen Dateien hier auswählen (eine oder mehrere) – Jarvis legt sofort los<input name="dateien" type="file" multiple required data-sofort accept=".pdf,.docx,.xlsx,.xls,.odt,.ods,.csv,.txt,.zip"></label>
  <button>Prüfen lassen</button>
</form>
<p class="klein"><strong>Mehrere Dateien:</strong> Im Auswahlfenster die erste Datei lange drücken, dann die anderen antippen und oben auf „Auswählen“ bzw. „Fertig“. Einfacher ist meist „Alle herunterladen“ beim Portal: Dann kommt eine ZIP-Datei mit allem, und die reicht. Vergessene Dateien kannst du später nachreichen, Jarvis liest dann alle zusammen.</p>
<p class="klein">Am Handy liegt die Datei unter „Downloads“. Jarvis schreibt daraus in 2 bis 5 Minuten einen ausführlichen Steckbrief und eine Kalkulation. Die Dateien werden nur dafür gelesen und nach 30 Tagen gelöscht.</p>`;
  let teil: string;
  if (aus?.text) {
    teil = `<h2>Steckbrief aus den Vergabeunterlagen</h2>${brief(aus.text)}
${leiste}${hochladen.replace("📥 Vergabeunterlagen", "📥 Dateien nachreichen")}
${v.steckbrief ? `<details><summary>Kurz-Steckbrief aus der Bekanntmachung</summary>${brief(v.steckbrief)}</details>` : ""}`;
  } else if (aus) {
    return html(seite(v.titel, `${kopf}<p><strong>Jarvis liest gerade die Unterlagen.</strong> Das dauert meist 2 bis 5 Minuten. Diese Seite lädt sich von selbst neu; du kannst sie auch schließen.</p>
${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${brief(v.steckbrief)}` : ""}${leiste}`, 20, "treffer"), 200, s.cookies);
  } else {
    teil = `${v.steckbrief ? `<h2>Steckbrief aus der Bekanntmachung</h2>${brief(v.steckbrief)}` : `<p class="klein">Noch kein Steckbrief.</p>`}${leiste}${hochladen}`;
  }
  const teilnahme = await teilnahmeTeil(s, env, v, finanzen, ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(rolle), new URL(request.url).searchParams.get("los") ?? "");
  const personalBlock = rolle === "leser" || rolle === "mitarbeiter" ? "" : await einsatzTeil(s, env, v, ["inhaber", "admin", "bearbeiter"].includes(rolle));
  return html(seite(v.titel, kopf + teil + teilnahme + personalBlock, 0, "treffer"), 200, s.cookies);
}

/** Steckbrief written from documents uploaded at this Vorgang: null = none, text "" = still running. */
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

export async function db<T = unknown>(s: Sitzung, env: KontoEnv, pfad: string, init: RequestInit = {}): Promise<{ ok: true; daten: T } | { ok: false; fehler: string }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${pfad}`, {
    ...init,
    headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${s.token}`, "content-type": "application/json", prefer: "return=minimal", ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, fehler: text.slice(0, 500) };
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
