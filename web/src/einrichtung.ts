// Setup assistant: the firm describes itself in a few sentences, Claude proposes the search profile
// (services with CPV codes and search words, exclusions, locations with postal code areas), the admin
// confirms or edits it. Saved in suchprofile (firm level); the daily alarm reads it from there.
import { apiClient } from "./api-budget.ts";
import { db, html, mailZeitSetzen, sitzung, stundenOptionen, weiterleiten, type Bereich, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, hilfe, seite as allgemeineSeite } from "./seite.ts";
import { AUSSERHALB, LAENDER, NACHBARN, WEITERE, laenderBereinigen } from "./laender.ts";
import { websiteKontext, websiteNormalisieren } from "./webseite.ts";
const seite = (titel: string, inhalt: string) => allgemeineSeite(titel, inhalt, 0, "einstellungen");

export interface EinrichtungEnv extends KontoEnv {
  ANTHROPIC_API_KEY: string;
  HYPERDRIVE?: { connectionString: string };
  ACTIONS_TOKEN?: string; // GitHub token (Actions: write on Twista-hub/jarvis) to start the first run right away
}

export type Leistung = { name: string; cpv: string[]; woerter: string[] };
export type Standort = { name: string; plz_praefixe: string[]; bereich_id?: string };
export type Vorschlag = { beschreibung: string; leistungen: Leistung[]; ausschluss: string[]; ausschluss_cpv: string[]; standorte: Standort[]; laender?: string[] };

export function suchlaufLaeuft(start: string | null | undefined, fertig: string | null | undefined, jetzt = Date.now()): boolean {
  const begonnen = start ? Date.parse(start) : NaN;
  const abgeschlossen = fertig ? Date.parse(fertig) : NaN;
  return Number.isFinite(begonnen) && jetzt - begonnen < 20 * 60_000 && (!Number.isFinite(abgeschlossen) || abgeschlossen < begonnen);
}

type Laufstart = { gestartet: true } | { gestartet: false; hinweis: string };

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
  if (url.pathname === "/konto/einrichtung" && !post) antwort = await anzeigen(s, env, firma, f.name, f.website, url.searchParams.get("neu") === "1", vorlage);
  else if (url.pathname === "/konto/einrichtung/vorschlag" && post) antwort = await vorschlagen(env, firma, f.name, form!);
  else if (url.pathname === "/konto/einrichtung/speichern" && post) antwort = await speichern(s, env, firma, f.name, f.website, f.rolle, form!);
  else if (url.pathname === "/konto/einrichtung/starten" && post) antwort = await gespeicherteSucheStarten(s, env, firma);
  else return null;
  for (const c of s.cookies) antwort.headers.append("set-cookie", c);
  return antwort;
}

async function adminVon(s: Sitzung, env: KontoEnv, firma: string): Promise<{ name: string; website: string; rolle: string } | null> {
  const r = await db<{ rolle: string; firmen: { name: string; website?: string } }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,firmen(name,website)`);
  if (r.ok) {
    const m = r.daten[0];
    return m && (m.rolle === "inhaber" || m.rolle === "admin") ? { name: m.firmen.name, website: m.firmen.website ?? "", rolle: m.rolle } : null;
  }
  // Keep the setup page usable while the database migration and web deployment roll out.
  const alt = await db<{ rolle: string; firmen: { name: string } }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,firmen(name)`);
  const m = alt.ok ? alt.daten[0] : undefined;
  return m && (m.rolle === "inhaber" || m.rolle === "admin") ? { name: m.firmen.name, website: "", rolle: m.rolle } : null;
}

async function anzeigen(s: Sitzung, env: KontoEnv, firma: string, name: string, website: string, neu: boolean, vorlage: (firma: string) => string): Promise<Response> {
  const r = await db<{ beschreibung: string; einstellungen: Partial<Vorschlag> }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=beschreibung,einstellungen&limit=1`);
  const gespeichert = r.ok ? r.daten[0] : undefined;
  if (gespeichert?.einstellungen?.leistungen && !neu) {
    return html(seite(`Suchprofil: ${name}`, profilFormular(firma, { ...leer(), ...gespeichert.einstellungen, beschreibung: gespeichert.beschreibung }, "", website)));
  }
  const orte = (gespeichert?.einstellungen?.standorte ?? []).map((o) => o.name).join("\n");
  return html(seite(`Suche einrichten: ${name}`, startFormular(firma, gespeichert?.beschreibung || vorlage(firma), orte, website, "")));
}

export function startFormular(firma: string, beschreibung: string, orte: string, website: string, fehler: string): string {
  return `${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
${hilfe("Tipp für eine gute Suche", "Beschreibe in einfachen Worten, welche Arbeit ihr macht und wo ihr arbeitet. Fachbegriffe oder Vergabe-Kennziffern brauchst du nicht.")}
<p>Beschreibe kurz eure Arbeit und Einsatzorte. Jarvis macht daraus einen Vorschlag, den du prüfen und speichern kannst.</p>
<form method="post" action="/konto/einrichtung/vorschlag">
  <input type="hidden" name="firma" value="${firma}">
  <label>Firmenwebsite (freiwillig)<input name="website" type="text" inputmode="url" maxlength="300" autocomplete="url" placeholder="www.beispiel.de" value="${escape(website)}"></label>
  <p class="klein">Jarvis liest nur diese Startseite, falls robots.txt es erlaubt. Die Website ist ein zusätzlicher Hinweis und wird vor dem Speichern geprüft.</p>
  <label>Welche Arbeit macht ihr?
    <textarea name="beschreibung" maxlength="3000" placeholder="Zum Beispiel: Wir verlegen Fliesen und Mosaik in Badezimmern und Küchen.">${escape(beschreibung)}</textarea></label>
  <label>Standorte (eine Stadt pro Zeile, freiwillig)
    <textarea name="orte" maxlength="1000" placeholder="Köln&#10;Düsseldorf">${escape(orte)}</textarea>
    <span class="klein">Ohne Standorte sucht Jarvis in ganz Deutschland.</span></label>
  <button type="submit">Vorschlag machen lassen</button>
  <p class="klein" data-einrichtung-status role="status" aria-live="polite">Dauert etwa 30 Sekunden.</p>
</form>`;
}

async function vorschlagen(env: EinrichtungEnv, firma: string, name: string, form: FormData): Promise<Response> {
  const beschreibung = String(form.get("beschreibung") ?? "").trim().slice(0, 3000);
  const orte = String(form.get("orte") ?? "").trim().slice(0, 1000);
  const rohWebsite = String(form.get("website") ?? "").trim().slice(0, 300);
  const website = websiteNormalisieren(rohWebsite);
  if (rohWebsite && !website) return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, "", "Bitte eine gültige Website-Adresse angeben.")), 400);
  if (beschreibung.length < 20) return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, website, "Bitte beschreib deine Firma in ein paar Sätzen.")), 400);
  const websiteDaten = website ? await websiteKontext(website) : { text: "", hinweis: "" };
  let vorschlag: Vorschlag;
  try {
    // Hard limit for the whole step (budget check in the database plus KI request): the SDK timeout does not
    // cover a hanging database connection, and the page must always answer, at worst with the simple proposal.
    const message = await mitZeitlimit(40_000, apiClient(env).beta.messages.create({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: ANLEITUNG,
      messages: [{ role: "user", content: `Firma: ${name}\nWebsite: ${website || "keine angegeben"}\n\nVom Nutzer beschriebene Leistungen:\n${beschreibung}\n\nStandorte:\n${orte || "keine angegeben"}\n\nLesbare Angaben von der angegebenen Website (nur als Ergänzung, keine weiteren Leistungen erfinden):\n${websiteDaten.text || "keine Website-Informationen verfügbar"}` }],
    }, { timeout: 38_000 }));
    if (message.stop_reason === "refusal") throw new Error("abgelehnt");
    vorschlag = vorschlagOderFallback(JSON.parse(message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")), beschreibung, orte);
    if (!vorschlag.leistungen.length) throw new Error("leerer Vorschlag");
  } catch (e) {
    console.warn(`Einrichtung: ${e instanceof Error ? e.message : String(e)}`);
    vorschlag = beschreibungFallback(beschreibung, orte);
    const webHinweis = websiteDaten.text ? "Die Firmenwebsite wurde zusätzlich berücksichtigt." : website ? "Die Firmenwebsite konnte gerade nicht gelesen werden; deine Beschreibung reicht trotzdem." : "";
    return html(seite(`Vorschlag für ${name}`, profilFormular(firma, vorschlag, `Der automatische Vorschlag klappt gerade nicht. Aus deinen Angaben ist ein einfacher Vorschlag entstanden. Bitte prüfe kurz, ob Arbeit und Einsatzorte stimmen. ${webHinweis}`.trim(), website)));
  }
  const webHinweis = websiteDaten.text ? "Die Firmenwebsite wurde zusätzlich berücksichtigt." : website ? "Die Firmenwebsite konnte gerade nicht gelesen werden; deine Beschreibung reicht trotzdem." : "";
  return html(seite(`Vorschlag für ${name}`, profilFormular(firma, vorschlag, `Prüfe kurz, ob die vorgeschlagenen Arbeiten und Einsatzorte stimmen. Du kannst sie ändern oder entfernen. ${webHinweis}`.trim(), website)));
}

function mitZeitlimit<T>(ms: number, p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([p, new Promise<never>((_, nein) => { t = setTimeout(() => nein(new Error("Zeitlimit")), ms); })]).finally(() => { if (t !== null) clearTimeout(t); });
}

export function beschreibungFallback(beschreibung: string, orte: string): Vorschlag {
  const stop = new Set(["aber", "alle", "auch", "dass", "diese", "einer", "eines", "eine", "einem", "einen", "einer", "firma", "für", "haben", "hier", "ihre", "sind", "und", "uns", "von", "werden", "wir", "mit", "nicht", "sowie", "das", "der", "die", "den", "dem", "des"]);
  const woerter = [...new Set(beschreibung.toLocaleLowerCase("de").match(/[a-zäöüß]{4,}/g) ?? [])].filter((w) => !stop.has(w)).slice(0, 12);
  const ersterSatz = beschreibung.split(/[.!?\n]+/).map((s) => s.trim()).find(Boolean) ?? beschreibung;
  const standorte = orte.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20).map((name) => ({ name, plz_praefixe: [] }));
  return bereinigen({ beschreibung, leistungen: [{ name: ersterSatz.slice(0, 120) || "Leistung aus Firmenbeschreibung", cpv: [], woerter: woerter.length ? woerter : ["ausschreibung"] }], standorte });
}

/** A syntactically valid model answer can still contain no usable service; never show an unsaveable profile. */
export function vorschlagOderFallback(v: Partial<Vorschlag>, beschreibung: string, orte: string): Vorschlag {
  const bereinigt = bereinigen(v);
  return bereinigt.beschreibung.length >= 20 && bereinigt.leistungen.length
    ? bereinigt
    : beschreibungFallback(beschreibung, orte);
}

function leer(): Vorschlag {
  return { beschreibung: "", leistungen: [], ausschluss: [], ausschluss_cpv: [], standorte: [] };
}

const liste = (x: string[] | undefined) => escape((x ?? []).join(", "));

export function profilFormular(firma: string, v: Vorschlag, hinweis: string, website = ""): string {
  const leistungen = [...v.leistungen, { name: "", cpv: [], woerter: [] }].map((l, i) => `<fieldset>
  <label class="zeile"><input type="checkbox" name="l${i}_an" value="1"${l.name ? " checked" : ""}> ${l.name ? `${escape(l.name)} suchen` : "Weitere Arbeit hinzufügen"}</label>
  <label>Beruf oder Arbeit<input name="l${i}_name" maxlength="120" placeholder="z. B. Fliesen verlegen" value="${escape(l.name)}"></label>
  <details><summary>Suchdetails (optional)</summary>
    <label>Wörter, die in passenden Ausschreibungen vorkommen können<input name="l${i}_woerter" maxlength="1000" value="${liste(l.woerter)}"></label>
    <label>Vergabe-Kennziffern (CPV, optional)<input name="l${i}_cpv" maxlength="300" inputmode="numeric" value="${liste(l.cpv)}"></label>
  </details>
</fieldset>`).join("");
  const standorte = [...v.standorte, { name: "", plz_praefixe: [] }].map((o, i) => `<fieldset>
  <label class="zeile"><input type="checkbox" name="o${i}_an" value="1"${o.name ? " checked" : ""}> ${o.name ? `${escape(o.name)} als Einsatzort` : "Weiteren Einsatzort hinzufügen"}</label>
  <label>Stadt oder Gegend<input name="o${i}_name" maxlength="120" placeholder="z. B. Bad Wildungen" value="${escape(o.name)}"></label>
  <details><summary>Suchradius genauer einstellen (optional)</summary>
    <label>Postleitzahl-Anfänge, durch Komma getrennt<input name="o${i}_plz" maxlength="300" inputmode="numeric" value="${liste(o.plz_praefixe)}"></label>
  </details>
  ${o.bereich_id ? `<input type="hidden" name="o${i}_bereich" value="${escape(o.bereich_id)}">` : ""}
</fieldset>`).join("");
  return `${hinweis ? `<p role="status">${escape(hinweis)}</p>` : ""}
${hilfe("Was kann ich hier ändern?", "Prüfe, ob die genannten Arbeiten und Einsatzorte stimmen. Die zusätzlichen Suchdetails brauchst du nur, wenn du die Suche gezielt verfeinern möchtest.")}
<form method="post" action="/konto/einrichtung/speichern">
  <input type="hidden" name="firma" value="${firma}">
  <label>Firmenwebsite (freiwillig)<input name="website" type="text" inputmode="url" maxlength="300" autocomplete="url" value="${escape(website)}"></label>
  <label>Was macht eure Firma?
    <textarea name="beschreibung" required minlength="20" maxlength="3000">${escape(v.beschreibung)}</textarea></label>
  <h2>Welche Arbeiten soll Jarvis finden?</h2>
  ${leistungen}
  <details><summary>Unpassende Arbeiten ausschließen (optional)</summary>
    <label>Welche Aufträge soll Jarvis nicht anzeigen?<input name="ausschluss" maxlength="1500" placeholder="z. B. Neubau, wenn ihr nur renoviert" value="${liste(v.ausschluss)}"></label>
    <label>Vergabe-Kennziffern für Ausschlüsse (optional)<input name="ausschluss_cpv" maxlength="300" inputmode="numeric" value="${liste(v.ausschluss_cpv)}"></label>
  </details>
  <h2>Wo soll Jarvis suchen?</h2>
  ${standorte}
  <details><summary>In weiteren Ländern suchen (optional)</summary>
    <p class="klein">Deutschland ist standardmäßig ausgewählt. Jarvis kann zusätzlich Ausschreibungen aus europäischen Ländern und den USA suchen.</p>
    ${laenderAuswahl(laenderBereinigen(v.laender))}
  </details>
  <details><summary>Tägliche E-Mail einstellen (optional)</summary>
  <label>Neue Treffer per Mail an dich um<select name="stunde">${stundenOptionen(7)}</select>
    <span class="klein">Jeder im Team stellt seine Uhrzeit selbst ein.</span></label>
  </details>
  <button>Speichern und Suche starten</button>
</form>
<p class="klein"><a href="/konto/einrichtung?firma=${firma}&neu=1">Neu beschreiben</a> · <a href="/konto">Abbrechen</a></p>`;
}

function laenderAuswahl(gewaehlt: string[]): string {
  const chip = (code: string, name: string) => `<label><input type="checkbox" name="laender" value="${code}"${gewaehlt.includes(code) ? " checked" : ""}><span>${escape(name)}</span></label>`;
  const weitere = Object.keys(WEITERE).some((c) => gewaehlt.includes(c));
  return `<div class="chips">${chip("DEU", LAENDER.DEU)}</div>
  <details${Object.keys(NACHBARN).some((c) => gewaehlt.includes(c)) ? " open" : ""}><summary>Nachbarländer</summary><div class="chips">${Object.entries(NACHBARN).map(([c, n]) => chip(c, n)).join("")}</div></details>
  <details${weitere ? " open" : ""}><summary>Weitere Länder in Europa</summary><div class="chips">${Object.entries(WEITERE).map(([c, n]) => chip(c, n)).join("")}</div></details>
  <details${Object.keys(AUSSERHALB).some((c) => gewaehlt.includes(c)) ? " open" : ""}><summary>Außerhalb Europas</summary><div class="chips">${Object.entries(AUSSERHALB).map(([c, n]) => chip(c, n)).join("")}</div><p class="klein">USA: nur Ausschreibungen der Bundesbehörden (SAM.gov), auf Englisch.</p></details>`;
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
    laender: laenderBereinigen(v.laender),
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
  return bereinigen({ beschreibung: String(form.get("beschreibung") ?? ""), leistungen, ausschluss: teile("ausschluss"), ausschluss_cpv: teile("ausschluss_cpv"), standorte, laender: form.getAll("laender").map(String) });
}

async function speichern(s: Sitzung, env: EinrichtungEnv, firma: string, name: string, alteWebsite: string, rolle: string, form: FormData): Promise<Response> {
  const v = ausFormular(form);
  const roheWebsite = String(form.get("website") ?? "").trim().slice(0, 300);
  const website = websiteNormalisieren(roheWebsite);
  if (roheWebsite && !website) return html(seite("Suchprofil", profilFormular(firma, v, "Bitte eine gültige Website-Adresse angeben.", alteWebsite)), 400);
  if (website !== alteWebsite && rolle !== "inhaber") {
    return html(seite("Suchprofil", profilFormular(firma, v, "Nur der Inhaber kann die gemeinsame Firmenwebsite ändern.", alteWebsite)), 403);
  }
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
    einstellungen: { leistungen: v.leistungen, ausschluss: v.ausschluss, ausschluss_cpv: v.ausschluss_cpv, standorte: v.standorte, laender: v.laender },
  };
  const alt = await db<{ id: string; erstlauf: string | null; fertig: string | null }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=id,erstlauf:einstellungen->>erstlauf,fertig:einstellungen->>erstlauf_fertig&limit=1`);
  // A completed search can be rerun; only suppress duplicate concurrent runs.
  const zuletzt = alt.ok && alt.daten[0]?.erstlauf ? Date.parse(alt.daten[0].erstlauf) : 0;
  const fertig = alt.ok ? alt.daten[0]?.fertig : null;
  const sofort = !suchlaufLaeuft(zuletzt ? new Date(zuletzt).toISOString() : null, fertig);
  const einstellungen: Record<string, unknown> = zeile.einstellungen;
  if (zuletzt) einstellungen.erstlauf = new Date(zuletzt).toISOString();
  const r = alt.ok && alt.daten[0]
    ? await db(s, env, `suchprofile?id=eq.${alt.daten[0].id}`, { method: "PATCH", body: JSON.stringify(zeile) })
    : await db(s, env, "suchprofile", { method: "POST", body: JSON.stringify(zeile) });
  if (!r.ok) {
    const code = fehlerCode(r.fehler);
    console.error("Suchprofil konnte nicht gespeichert werden", { status: r.status, code });
    const meldung = r.status === 401 || r.status === 403
      ? "Jarvis hat keine Schreibberechtigung für dieses Suchprofil. Bitte melde dich erneut an oder lass die Firmenrechte prüfen."
      : r.status === 409 || code === "23505"
        ? "Für diese Firma wurde gleichzeitig ein Suchprofil angelegt. Lade die Seite neu und prüfe, ob es bereits gespeichert ist."
        : r.status === 400
          ? "Die Daten wurden von der Datenbank abgelehnt. Prüfe Beschreibung, Leistungen und Standorte und versuche es erneut."
          : "Das Suchprofil konnte gerade nicht gespeichert werden. Bitte versuche es erneut.";
    return html(seite("Suchprofil", profilFormular(firma, v, meldung)), 500);
  }
  if (rolle === "inhaber" && website !== alteWebsite) {
    const firmenseite = await db(s, env, `firmen?id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ website }) });
    if (!firmenseite.ok) return html(seite("Suchprofil", profilFormular(firma, v, "Das Suchprofil wurde gespeichert, aber die Website nicht. Bitte erneut speichern.", alteWebsite)), 500);
  }
  await mailZeitSetzen(s, env, firma, form.get("stunde"));
  const laufstart: Laufstart = sofort ? await ersterLauf(env, firma) : { gestartet: false, hinweis: "Jarvis durchsucht diese Firma gerade. Warte bitte, bis der laufende Suchlauf fertig ist." };
  const gestartet = laufstart.gestartet;
  if (gestartet) {
    // Remembered for the "Jarvis is searching" notice in the overview and the 2-hour limit.
    await db(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null`, { method: "PATCH", body: JSON.stringify({ einstellungen: { ...einstellungen, erstlauf: new Date().toISOString() } }) });
  }
  // While the first run is busy the overview shows its own notice with a spinner, which disappears when it is done.
  if (gestartet) return weiterleiten(`/konto?firma=${firma}`);
  const erneut = `<p class="fehler" role="status">${escape(laufstart.gestartet ? "Jarvis sucht jetzt." : `Dein Suchprofil ist gespeichert. ${laufstart.hinweis}`)}</p>${sofort ? `<form method="post" action="/konto/einrichtung/starten"><input type="hidden" name="firma" value="${firma}"><button>Gespeicherte Suche jetzt starten</button></form>` : ""}<p><a href="/konto?firma=${firma}">Zur Übersicht</a></p>`;
  return html(seite("Suchprofil gespeichert", erneut));
}

function fehlerCode(text: string): string | undefined {
  try {
    const code = (JSON.parse(text) as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

async function gespeicherteSucheStarten(s: Sitzung, env: EinrichtungEnv, firma: string): Promise<Response> {
  const profil = await db<{ id: string; einstellungen: Record<string, unknown> }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=id,einstellungen&limit=1`);
  if (!profil.ok || !profil.daten[0]) return weiterleiten(`/konto/einrichtung?firma=${firma}`);
  const alt = profil.daten[0];
  const zuletzt = alt.einstellungen?.erstlauf ? String(alt.einstellungen.erstlauf) : null;
  const fertig = alt.einstellungen?.erstlauf_fertig ? String(alt.einstellungen.erstlauf_fertig) : null;
  if (suchlaufLaeuft(zuletzt, fertig)) return weiterleiten(`/konto?firma=${firma}&hinweis=${encodeURIComponent("Jarvis sucht für diese Firma bereits. Die Treffer erscheinen nach Abschluss.")}`);
  const laufstart = await ersterLauf(env, firma);
  if (!laufstart.gestartet) {
    const retry = `<p class="fehler" role="alert">${escape(`Der Suchlauf wurde nicht gestartet. ${laufstart.hinweis} Deine Suche bleibt gespeichert.`)}</p><form method="post" action="/konto/einrichtung/starten"><input type="hidden" name="firma" value="${firma}"><button>Erneut versuchen</button></form><p><a href="/konto?firma=${firma}">Zur Übersicht</a></p>`;
    return html(seite("Suche gespeichert", retry), 503);
  }
  const einstellungen = { ...alt.einstellungen, erstlauf: new Date().toISOString() };
  await db(s, env, `suchprofile?id=eq.${alt.id}`, { method: "PATCH", body: JSON.stringify({ einstellungen }) });
  return weiterleiten(`/konto?firma=${firma}`);
}

/** Starts the alarm for this firm only (last 7 days) via GitHub Actions. */
async function ersterLauf(env: EinrichtungEnv, firma: string): Promise<Laufstart> {
  if (!env.ACTIONS_TOKEN) return { gestartet: false, hinweis: "Der App fehlt die GitHub-Berechtigung für den Suchstart." };
  try {
    const r = await fetch("https://api.github.com/repos/Twista-hub/jarvis/actions/workflows/alarm.yml/dispatches", {
      method: "POST",
      headers: { authorization: `Bearer ${env.ACTIONS_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "jarvis-alarm" },
      body: JSON.stringify({ ref: "main", inputs: { firma } }),
    });
    if (!r.ok) {
      console.warn(`Erster Lauf nicht gestartet: ${r.status} ${(await r.text()).slice(0, 200)}`);
      const grund = r.status === 401 || r.status === 403 ? "GitHub hat den App-Zugriff abgelehnt." : `GitHub antwortet mit Fehler ${r.status}.`;
      return { gestartet: false, hinweis: `${grund} Bitte später erneut versuchen.` };
    }
    return { gestartet: true };
  } catch (error) {
    console.warn(`Erster Lauf nicht gestartet: ${error instanceof Error ? error.name : "Netzwerkfehler"}`);
    return { gestartet: false, hinweis: "GitHub ist gerade nicht erreichbar. Bitte später erneut versuchen." };
  }
}
