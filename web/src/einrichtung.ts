// Setup assistant: the firm describes itself in a few sentences, Claude proposes the search profile
// (services with CPV codes and search words, exclusions, locations with postal code areas), the admin
// confirms or edits it. Saved in suchprofile (firm level); the daily alarm reads it from there.
import Anthropic from "@anthropic-ai/sdk";
import { db, html, mailZeitSetzen, sitzung, stundenOptionen, weiterleiten, type Bereich, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite as allgemeineSeite } from "./seite.ts";
const seite = (titel: string, inhalt: string) => allgemeineSeite(titel, inhalt, 0, "einstellungen");

export interface EinrichtungEnv extends KontoEnv {
  ANTHROPIC_API_KEY: string;
  ACTIONS_TOKEN?: string; // GitHub token (Actions: write on Twista-hub/jarvis) to start the first run right away
}

export type Leistung = { name: string; cpv: string[]; woerter: string[] };
export type Standort = { name: string; plz_praefixe: string[]; bereich_id?: string };
export type Vorschlag = { beschreibung: string; leistungen: Leistung[]; ausschluss: string[]; ausschluss_cpv: string[]; standorte: Standort[] };

// Once per firm, short text: Sonnet 5.5 is enough (half the price of Opus).
const MODEL = "claude-sonnet-5-5";
const ID = /^[0-9a-f-]{36}$/;

const SCHEMA = {
  type: "object",
  properties: {
    beschreibung: { type: "string" },
    leistungen: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, cpv: { type: "array", items: { type: "string" } }, woerter: { type: "array", items: { type: "string" } } },
        required: ["name", "cpv", "woerter"],
        additionalProperties: false,
      },
    },
    ausschluss: { type: "array", items: { type: "string" } },
    ausschluss_cpv: { type: "array", items: { type: "string" } },
    standorte: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, plz_praefixe: { type: "array", items: { type: "string" } } },
        required: ["name", "plz_praefixe"],
        additionalProperties: false,
      },
    },
  },
  required: ["beschreibung", "leistungen", "ausschluss", "ausschluss_cpv", "standorte"],
  additionalProperties: false,
};

const ANLEITUNG = `Du richtest für eine Firma die tägliche Suche nach öffentlichen Ausschreibungen in Deutschland ein.
Aus der Beschreibung der Firma erstellst du ein Suchprofil:
- beschreibung: 3 bis 5 sachliche Sätze: was die Firma anbietet, für welche Auftraggeber, welche Auftragsgrößen realistisch sind, was sie NICHT macht. Diese Beschreibung nutzt später eine KI, um jede Ausschreibung zu bewerten.
- leistungen: 2 bis 8 Leistungen der Firma. Je Leistung passende CPV-Codes als Präfix (2 bis 8 Ziffern, ohne Prüfziffer; je kürzer, desto breiter; lieber genau als zu breit) und 3 bis 12 Suchwörter auf Deutsch, klein geschrieben, so wie sie in Titeln von Ausschreibungen stehen (Wortstämme sind erlaubt, z. B. "servicekr" findet "Servicekräfte"). Keine allgemeinen Wörter wie "dienstleistung" oder "service".
- ausschluss: Wörter für Ausschreibungen, die ähnlich klingen, aber nicht passen (z. B. Bau, Software, Lieferungen), klein geschrieben.
- ausschluss_cpv: CPV-Hauptgruppen (2 Ziffern), die sicher nicht passen und sonst oft fälschlich auftauchen, z. B. 45 Bau, 71 Architektur und Ingenieure, 34 Fahrzeuge. Nie eine Gruppe, die eine der Leistungen enthält.
- standorte: jeder genannte Standort mit den zweistelligen Postleitzahl-Bereichen im Umkreis von etwa 50 km. Ohne Standorte: leere Liste (dann sucht Jarvis bundesweit).
Erfinde keine Leistungen, die die Firma nicht nennt.`;

/** vorlage: description of a firm whose profile was set up by hand (alarm/profile.json), else "". */
export async function einrichtung(request: Request, env: EinrichtungEnv, vorlage: (firma: string) => string): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/konto/einrichtung")) return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const post = request.method === "POST";
  const form = post ? await request.formData() : null;
  const firma = String(form?.get("firma") ?? url.searchParams.get("firma") ?? "");
  const f = ID.test(firma) ? await adminVon(s, env, firma) : null;
  if (!f) return html(seite("Suchprofil", `<p class="fehler">Das Suchprofil kann nur ein Inhaber oder Admin der Firma einrichten.</p><p><a href="/konto">Zur Übersicht</a></p>`), 403, s.cookies);

  let antwort: Response;
  if (url.pathname === "/konto/einrichtung" && !post) antwort = await anzeigen(s, env, firma, f.name, url.searchParams.get("neu") === "1", vorlage);
  else if (url.pathname === "/konto/einrichtung/vorschlag" && post) antwort = await vorschlagen(env, firma, f.name, form!);
  else if (url.pathname === "/konto/einrichtung/speichern" && post) antwort = await speichern(s, env, firma, f.name, form!);
  else return null;
  for (const c of s.cookies) antwort.headers.append("set-cookie", c);
  return antwort;
}

async function adminVon(s: Sitzung, env: KontoEnv, firma: string): Promise<{ name: string } | null> {
  const r = await db<{ rolle: string; firmen: { name: string } }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,firmen(name)`);
  const m = r.ok ? r.daten[0] : undefined;
  return m && (m.rolle === "inhaber" || m.rolle === "admin") ? { name: m.firmen.name } : null;
}

async function anzeigen(s: Sitzung, env: KontoEnv, firma: string, name: string, neu: boolean, vorlage: (firma: string) => string): Promise<Response> {
  const r = await db<{ beschreibung: string; einstellungen: Partial<Vorschlag> }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=beschreibung,einstellungen&limit=1`);
  const gespeichert = r.ok ? r.daten[0] : undefined;
  if (gespeichert?.einstellungen?.leistungen && !neu) {
    return html(seite(`Suchprofil: ${name}`, profilFormular(firma, { ...leer(), ...gespeichert.einstellungen, beschreibung: gespeichert.beschreibung }, "")));
  }
  const orte = (gespeichert?.einstellungen?.standorte ?? []).map((o) => o.name).join("\n");
  return html(seite(`Suche einrichten: ${name}`, startFormular(firma, gespeichert?.beschreibung || vorlage(firma), orte, "")));
}

function startFormular(firma: string, beschreibung: string, orte: string, fehler: string): string {
  return `${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
<p>In zwei Schritten: Du beschreibst deine Firma, Jarvis schlägt das Suchprofil vor, du prüfst es und speicherst.</p>
<form method="post" action="/konto/einrichtung/vorschlag">
  <input type="hidden" name="firma" value="${firma}">
  <label>Was macht deine Firma? (2 bis 5 Sätze)
    <textarea name="beschreibung" required minlength="20" maxlength="3000" placeholder="z. B. Wir sind eine Zeitarbeitsfirma für Gastronomie und Events. Wir stellen Servicekräfte, Köche und Hostessen für Messen und Kantinen. Keine Reinigung, keine Pflege.">${escape(beschreibung)}</textarea></label>
  <label>Standorte (eine Stadt pro Zeile, freiwillig)
    <textarea name="orte" maxlength="1000" placeholder="Köln&#10;Düsseldorf">${escape(orte)}</textarea>
    <span class="klein">Ohne Standorte sucht Jarvis in ganz Deutschland.</span></label>
  <button>Vorschlag machen lassen</button>
  <p class="klein">Dauert etwa 30 Sekunden.</p>
</form>`;
}

async function vorschlagen(env: EinrichtungEnv, firma: string, name: string, form: FormData): Promise<Response> {
  const beschreibung = String(form.get("beschreibung") ?? "").trim().slice(0, 3000);
  const orte = String(form.get("orte") ?? "").trim().slice(0, 1000);
  if (beschreibung.length < 20) return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, "Bitte beschreib deine Firma in ein paar Sätzen.")), 400);
  let vorschlag: Vorschlag;
  try {
    const message = await new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }).beta.messages.create({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: ANLEITUNG,
      messages: [{ role: "user", content: `Firma: ${name}\n\nBeschreibung der Firma:\n${beschreibung}\n\nStandorte:\n${orte || "keine angegeben"}` }],
    });
    if (message.stop_reason === "refusal") throw new Error("abgelehnt");
    vorschlag = bereinigen(JSON.parse(message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")));
  } catch (e) {
    console.warn(`Einrichtung: ${e instanceof Error ? e.message : String(e)}`);
    return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, "Der Vorschlag hat nicht geklappt. Bitte noch einmal versuchen.")), 502);
  }
  return html(seite(`Vorschlag für ${name}`, profilFormular(firma, vorschlag, "Das schlägt Jarvis vor. Nimm Haken weg, wo etwas nicht passt, und ändere Wörter nach Belieben.")));
}

function leer(): Vorschlag {
  return { beschreibung: "", leistungen: [], ausschluss: [], ausschluss_cpv: [], standorte: [] };
}

const liste = (x: string[] | undefined) => escape((x ?? []).join(", "));

export function profilFormular(firma: string, v: Vorschlag, hinweis: string): string {
  const leistungen = [...v.leistungen, { name: "", cpv: [], woerter: [] }].map((l, i) => `<fieldset>
  <label class="zeile"><input type="checkbox" name="l${i}_an" value="1"${l.name ? " checked" : ""}> ${l.name ? escape(l.name) : "Weitere Leistung"}</label>
  <label>Name<input name="l${i}_name" maxlength="120" value="${escape(l.name)}"></label>
  <label>Suchwörter (mit Komma getrennt)<input name="l${i}_woerter" maxlength="1000" value="${liste(l.woerter)}"></label>
  <label>CPV-Codes (Leistungsgruppen, mit Komma)<input name="l${i}_cpv" maxlength="300" inputmode="numeric" value="${liste(l.cpv)}"></label>
</fieldset>`).join("");
  const standorte = [...v.standorte, { name: "", plz_praefixe: [] }].map((o, i) => `<fieldset>
  <label class="zeile"><input type="checkbox" name="o${i}_an" value="1"${o.name ? " checked" : ""}> ${o.name ? escape(o.name) : "Weiterer Standort"}</label>
  <label>Name<input name="o${i}_name" maxlength="120" value="${escape(o.name)}"></label>
  <label>Postleitzahlen, die dazugehören (die ersten 2 Ziffern, mit Komma)<input name="o${i}_plz" maxlength="300" inputmode="numeric" value="${liste(o.plz_praefixe)}"></label>
  ${o.bereich_id ? `<input type="hidden" name="o${i}_bereich" value="${escape(o.bereich_id)}">` : ""}
</fieldset>`).join("");
  return `${hinweis ? `<p>${escape(hinweis)}</p>` : ""}
<form method="post" action="/konto/einrichtung/speichern">
  <input type="hidden" name="firma" value="${firma}">
  <label>Beschreibung (danach bewertet die KI jede Ausschreibung)
    <textarea name="beschreibung" required minlength="20" maxlength="3000">${escape(v.beschreibung)}</textarea></label>
  <h2>Leistungen</h2>
  <p class="klein">Jarvis meldet Ausschreibungen, die ein Suchwort enthalten oder zu einem CPV-Code gehören, und bewertet sie dann mit der Beschreibung.</p>
  ${leistungen}
  <h2>Ausschließen</h2>
  <label>Wörter, bei denen eine Ausschreibung nicht passt (mit Komma)<input name="ausschluss" maxlength="1500" value="${liste(v.ausschluss)}"></label>
  <label>CPV-Gruppen, die nicht passen (mit Komma)<input name="ausschluss_cpv" maxlength="300" inputmode="numeric" value="${liste(v.ausschluss_cpv)}"></label>
  <h2>Standorte</h2>
  <p class="klein">Treffer werden dem Standort zugeordnet, in dessen Postleitzahl-Bereich der Auftrag liegt. Jarvis legt die Standorte als Bereiche an.</p>
  ${standorte}
  <h2>Tägliche Mail</h2>
  <label>Neue Treffer per Mail an dich um<select name="stunde">${stundenOptionen(7)}</select>
    <span class="klein">Jeder im Team stellt seine Uhrzeit selbst ein (in der Übersicht unter „Tägliche Mail“).</span></label>
  <button>Speichern und Suche starten</button>
</form>
<p class="klein"><a href="/konto/einrichtung?firma=${firma}&neu=1">Neu beschreiben</a> · <a href="/konto">Abbrechen</a></p>`;
}

/** Cleans model or form input: only digits for CPV and postal codes, short lower-case words. */
export function bereinigen(v: Partial<Vorschlag>): Vorschlag {
  const woerter = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map((w) => String(w).toLowerCase().replace(/\s+/g, " ").trim()).filter((w) => w.length >= 3 && w.length <= 60))].slice(0, 40);
  const ziffern = (x: unknown, min: number, max: number) => [...new Set((Array.isArray(x) ? x : []).map((c) => String(c).replace(/\D/g, "")).filter((c) => c.length >= min && c.length <= max))].slice(0, 40);
  return {
    beschreibung: String(v.beschreibung ?? "").trim().slice(0, 3000),
    leistungen: (v.leistungen ?? []).map((l) => ({ name: String(l.name ?? "").trim().slice(0, 120), cpv: ziffern(l.cpv, 2, 8), woerter: woerter(l.woerter) })).filter((l) => l.name && (l.cpv.length || l.woerter.length)).slice(0, 12),
    ausschluss: woerter(v.ausschluss),
    ausschluss_cpv: ziffern(v.ausschluss_cpv, 2, 8),
    standorte: (v.standorte ?? []).map((o) => ({ name: String(o.name ?? "").trim().slice(0, 120), plz_praefixe: ziffern(o.plz_praefixe, 2, 2), ...(o.bereich_id && ID.test(o.bereich_id) ? { bereich_id: o.bereich_id } : {}) })).filter((o) => o.name).slice(0, 40),
  };
}

export function ausFormular(form: FormData): Vorschlag {
  const teile = (k: string) => String(form.get(k) ?? "").split(",");
  const leistungen: Leistung[] = [];
  const standorte: Standort[] = [];
  for (let i = 0; i < 20; i++) {
    if (form.get(`l${i}_an`)) leistungen.push({ name: String(form.get(`l${i}_name`) ?? ""), cpv: teile(`l${i}_cpv`), woerter: teile(`l${i}_woerter`) });
    if (form.get(`o${i}_an`)) standorte.push({ name: String(form.get(`o${i}_name`) ?? ""), plz_praefixe: teile(`o${i}_plz`), bereich_id: String(form.get(`o${i}_bereich`) ?? "") || undefined });
  }
  return bereinigen({ beschreibung: String(form.get("beschreibung") ?? ""), leistungen, ausschluss: teile("ausschluss"), ausschluss_cpv: teile("ausschluss_cpv"), standorte });
}

async function speichern(s: Sitzung, env: EinrichtungEnv, firma: string, name: string, form: FormData): Promise<Response> {
  const v = ausFormular(form);
  if (v.beschreibung.length < 20 || !v.leistungen.length) {
    return html(seite("Suchprofil", profilFormular(firma, v, "Bitte eine Beschreibung und mindestens eine Leistung angeben.")), 400);
  }
  // Locations become top-level areas (reused by name), so hits can be filtered per location.
  const vorhanden = await db<Bereich[]>(s, env, `bereiche?firma_id=eq.${firma}&parent_id=is.null&select=id,name,art,parent_id`);
  const bereiche = vorhanden.ok ? vorhanden.daten : [];
  for (const o of v.standorte) {
    if (o.bereich_id && bereiche.some((b) => b.id === o.bereich_id)) continue;
    const gleich = bereiche.find((b) => b.name.toLowerCase() === o.name.toLowerCase());
    if (gleich) {
      o.bereich_id = gleich.id;
      continue;
    }
    const neu = await db<Bereich[]>(s, env, "bereiche", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, name: o.name, art: "standort" }) });
    if (neu.ok && neu.daten[0]) {
      o.bereich_id = neu.daten[0].id;
      bereiche.push(neu.daten[0]);
    }
  }
  const zeile = {
    firma_id: firma,
    name,
    beschreibung: v.beschreibung,
    cpv: [...new Set(v.leistungen.flatMap((l) => l.cpv))],
    woerter: [...new Set(v.leistungen.flatMap((l) => l.woerter))].join(", "),
    ausschluss: v.ausschluss.join(", "),
    plz_praefixe: [...new Set(v.standorte.flatMap((o) => o.plz_praefixe))],
    einstellungen: { leistungen: v.leistungen, ausschluss: v.ausschluss, ausschluss_cpv: v.ausschluss_cpv, standorte: v.standorte },
  };
  const alt = await db<{ id: string; erstlauf: string | null }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=id,erstlauf:einstellungen->>erstlauf&limit=1`);
  // First hit list right away (last 7 days) instead of waiting for tomorrow; at most every 2 hours (costs).
  const zuletzt = alt.ok && alt.daten[0]?.erstlauf ? Date.parse(alt.daten[0].erstlauf) : 0;
  const sofort = Date.now() - zuletzt > 2 * 3600_000;
  const einstellungen: Record<string, unknown> = zeile.einstellungen;
  if (zuletzt) einstellungen.erstlauf = new Date(zuletzt).toISOString();
  const r = alt.ok && alt.daten[0]
    ? await db(s, env, `suchprofile?id=eq.${alt.daten[0].id}`, { method: "PATCH", body: JSON.stringify(zeile) })
    : await db(s, env, "suchprofile", { method: "POST", body: JSON.stringify(zeile) });
  if (!r.ok) return html(seite("Suchprofil", profilFormular(firma, v, "Speichern hat nicht geklappt. Bitte noch einmal versuchen.")), 500);
  await mailZeitSetzen(s, env, firma, form.get("stunde"));
  const gestartet = sofort && (await ersterLauf(env, firma));
  if (gestartet) {
    // Remembered for the "Jarvis is searching" notice in the overview and the 2-hour limit.
    await db(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null`, { method: "PATCH", body: JSON.stringify({ einstellungen: { ...einstellungen, erstlauf: new Date().toISOString() } }) });
  }
  // While the first run is busy the overview shows its own notice with a spinner, which disappears when it is done.
  if (gestartet) return weiterleiten(`/konto?firma=${firma}`);
  return weiterleiten(`/konto?firma=${firma}&hinweis=${encodeURIComponent("Suchprofil gespeichert. Ab morgen früh sucht Jarvis damit nach Ausschreibungen.")}`);
}

/** Starts the alarm for this firm only (last 7 days) via GitHub Actions. */
async function ersterLauf(env: EinrichtungEnv, firma: string): Promise<boolean> {
  if (!env.ACTIONS_TOKEN) return false;
  const r = await fetch("https://api.github.com/repos/Twista-hub/jarvis/actions/workflows/alarm.yml/dispatches", {
    method: "POST",
    headers: { authorization: `Bearer ${env.ACTIONS_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "jarvis-alarm" },
    body: JSON.stringify({ ref: "main", inputs: { firma } }),
  });
  if (!r.ok) console.warn(`Erster Lauf nicht gestartet: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.ok;
}
