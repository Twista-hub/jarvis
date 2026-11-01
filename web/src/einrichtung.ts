// Setup assistant: the firm describes itself in a few sentences, Claude proposes the search profile
// (services with CPV codes and search words, exclusions, locations with postal code areas), the admin
// confirms or edits it. Saved in suchprofile (firm level); the daily alarm reads it from there.
import { arbeitsAuswahl, arbeitAusName, MAX_ARBEITEN } from "./arbeitsauswahl.ts";
import { sucheLaeuft } from "./suchstatus.ts";
import { RADIEN } from "./karte.ts";
import { firmenInfos } from "./firmeninfos.ts";
import { rechercheProfil } from "./firmenrecherche.ts";
import { apiClient } from "./api-budget.ts";
import { kiFehlerart, kiFehlermeldung, type KiFehlerart } from "./ki-fehler.ts";
import { standorteBereinigen, standortSchluessel, suchorteAnStandorten, type Firmenstandort, type SuchgebietModus } from "./firmenstandorte.ts";
export { FIRMEN_WEB_SUCHTOOL } from "./firmenrecherche.ts";
import { db, html, mailZeitSetzen, sitzung, stundenOptionen, weiterleiten, type Bereich, type KontoEnv, type Sitzung } from "./konto.ts";
import { vorschauBox, vorschauZaehlen } from "./vorschau.ts";
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
export type WebQuelle = { titel: string; url: string };
export type Vorschlag = { radius_km?: number; min_punkte?: number; beschreibung: string; website_beschreibung: string; websuche_beschreibung: string; websuche_quellen: WebQuelle[]; leistungen: Leistung[]; ausschluss: string[]; ausschluss_cpv: string[]; standorte: Standort[]; firmenstandorte?: Firmenstandort[]; suchgebiet_modus?: SuchgebietModus; laender?: string[]; recherche_version?: number; website_hinweis?: string; recherchiert_am?: string; recherche_status?: "wartet"; recherche_wiederholen_ab?: string; recherche_fehler?: KiFehlerart; recherche_website?: string;
  /** H4/H5: preferred and excluded buyers, contract value range; filters only, no re-scoring. */
  auftraggeber_bevorzugt?: string[]; auftraggeber_aus?: string[]; wert_min?: number; wert_max?: number; wert_unbekannt?: boolean };

export function suchlaufLaeuft(start: string | null | undefined, fertig: string | null | undefined, jetzt = Date.now()): boolean {
  return sucheLaeuft({ erstlauf: start, fertig }, jetzt);
}

type EinrichtungDienste = { recherche: typeof rechercheProfil; website: typeof websiteKontext };
const DIENSTE: EinrichtungDienste = { recherche: rechercheProfil, website: websiteKontext };

type Laufstart = { gestartet: true } | { gestartet: false; hinweis: string };

const ID = /^[0-9a-f-]{36}$/;

/** vorlage: description of a firm whose profile was set up by hand (alarm/profile.json), else "". */
export async function einrichtung(request: Request, env: EinrichtungEnv, vorlage: (firma: string) => string, dienste: EinrichtungDienste = DIENSTE): Promise<Response | null> {
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
  if (url.pathname === "/konto/einrichtung" && !post) antwort = await anzeigen(s, env, firma, f.name, f.website, url.searchParams.get("neu") === "1", vorlage, url.searchParams.get("automatisch") === "1", f.plz, f.ort);
  else if (url.pathname === "/konto/einrichtung/automatisch" && post) antwort = await automatischEinrichten(s, env, firma, f.name, f.website, f.rolle, f.plz, f.ort, form!, dienste);
  else if (url.pathname === "/konto/einrichtung/vorschlag" && post) antwort = await vorschlagen(env, firma, f.name, form!);
  else if (url.pathname === "/konto/einrichtung/speichern" && post) antwort = await speichern(s, env, firma, f.name, f.website, f.rolle, form!);
  else if (url.pathname === "/konto/einrichtung/vorschau" && post) antwort = await vorschauZeigen(s, env, firma, f.name, f.website, form!);
  else if (url.pathname === "/konto/einrichtung/starten" && post) antwort = await gespeicherteSucheStarten(s, env, firma);
  else return null;
  for (const c of s.cookies) antwort.headers.append("set-cookie", c);
  return antwort;
}

async function adminVon(s: Sitzung, env: KontoEnv, firma: string): Promise<{ name: string; website: string; rolle: string; plz: string; ort: string } | null> {
  const r = await db<{ rolle: string; firmen: { name: string; website?: string; plz?: string; ort?: string } }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,firmen(name,website,plz,ort)`);
  if (r.ok) {
    const m = r.daten[0];
    return m && (m.rolle === "inhaber" || m.rolle === "admin") ? { name: m.firmen.name, website: m.firmen.website ?? "", rolle: m.rolle, plz: m.firmen.plz ?? "", ort: m.firmen.ort ?? "" } : null;
  }
  // Keep the setup page usable while the database migration and web deployment roll out.
  const alt = await db<{ rolle: string; firmen: { name: string } }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,firmen(name)`);
  const m = alt.ok ? alt.daten[0] : undefined;
  return m && (m.rolle === "inhaber" || m.rolle === "admin") ? { name: m.firmen.name, website: "", rolle: m.rolle, plz: "", ort: "" } : null;
}

async function anzeigen(s: Sitzung, env: KontoEnv, firma: string, name: string, website: string, neu: boolean, vorlage: (firma: string) => string, automatisch: boolean, plz: string, ort: string): Promise<Response> {
  const r = await db<{ beschreibung: string; einstellungen: Partial<Vorschlag> }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=beschreibung,einstellungen&limit=1`);
  const gespeichert = r.ok ? r.daten[0] : undefined;
  if (gespeichert?.einstellungen?.recherche_status === "wartet" && !neu) {
    const e = gespeichert.einstellungen;
    const warten = Date.parse(e.recherche_wiederholen_ab || "") > Date.now();
    const meldung = warten ? kiFehlermeldung(new Error(e.recherche_fehler === "budget" ? "KI-Budget" : "Connection error")) : "";
    return html(seite(`Firma prüfen: ${name}`, automatischeSeite(firma, name, e.recherche_website ?? website, plz, ort, meldung, bereinigen({ ...e, beschreibung: gespeichert.beschreibung }))));
  }
  if (gespeichert?.einstellungen?.leistungen && !neu) {
    if (!gespeichert.einstellungen.websuche_beschreibung && gespeichert.einstellungen.recherche_version !== 2) return html(seite(`Firmenrecherche: ${name}`, automatischeSeite(firma, name, website, plz, ort)));
    return html(seite(`Suchprofil: ${name}`, profilFormular(firma, { ...leer(), ...gespeichert.einstellungen, beschreibung: gespeichert.beschreibung }, "", website)));
  }
  if (!neu && (automatisch || !gespeichert)) return html(seite(`Firma prüfen: ${name}`, automatischeSeite(firma, name, website, plz, ort)));
  const orte = (gespeichert?.einstellungen?.standorte ?? []).map((o) => o.name).join("\n");
  return html(seite(`Suche einrichten: ${name}`, startFormular(firma, gespeichert?.beschreibung || vorlage(firma), orte, website, "")));
}

function automatischeSeite(firma: string, name: string, website: string, plz: string, ort: string, fehler = "", basis = leer()): string {
  const verborgen = profilZuFormular(basis, website);
  return `<ol class="einrichtungs-schritte" aria-label="Einrichtung"><li aria-current="step">1. Firma prüfen</li><li>2. Suchprofil erstellen</li><li>3. Aufträge finden</li></ol>
<section class="firmenpruefung"><h2>Jarvis lernt deine Firma kennen</h2><p>Wir prüfen eure Website und öffentliche Quellen. Daraus erkennt Jarvis eure Arbeiten und Firmenstandorte und richtet die Suche nach passenden Ausschreibungen ein.</p>
${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : `<p class="klein">Die Prüfung startet automatisch. Du musst keine Suchwörter oder Standorte zusammensuchen.</p>`}
<form method="post" data-suchaktion action="/konto/einrichtung/automatisch"${fehler ? "" : " data-auto-einrichtung"}>
  <input type="hidden" name="firma" value="${escape(firma)}">
  ${[...verborgen].filter(([k]) => !["firma", "website", "beschreibung"].includes(k)).map(([k, w]) => `<input type="hidden" name="${escape(k)}" value="${escape(String(w))}">`).join("")}
  <p><strong>${escape(name)}</strong>${ort ? ` · ${escape(plz)} ${escape(ort)}` : ""}</p>
  <label>Eure Firmenwebsite (optional)<input name="website" inputmode="url" maxlength="300" autocomplete="url" placeholder="www.eure-firma.de" value="${escape(website)}"></label>
  ${!website ? `<p class="klein">Auch ohne Website sucht Jarvis mit Firmenname und Firmensitz.</p>` : ""}
  <details${basis.beschreibung ? " open" : ""}><summary>Eigene Hinweise ergänzen (optional)</summary><label>Was sollte Jarvis über euch wissen?<textarea name="beschreibung" maxlength="3000" placeholder="Zum Beispiel eure wichtigsten Arbeiten oder Besonderheiten.">${escape(basis.beschreibung)}</textarea></label></details>
  <button type="submit">${fehler ? "Firmenprüfung erneut versuchen" : "Firma prüfen und Suche einrichten"}</button>
  <p class="klein" data-einrichtung-status role="status" aria-live="polite">Jarvis recherchiert Leistungen und Standorte, erstellt das Suchprofil und startet die erste Ausschreibungssuche. Das kann einige Minuten dauern.</p>
</form></section>`;
}

async function automatischEinrichten(s: Sitzung, env: EinrichtungEnv, firma: string, name: string, alteWebsite: string, rolle: string, plz: string, ort: string, eingabe: FormData, dienste: EinrichtungDienste): Promise<Response> {
  const alt = await db<{ id: string; beschreibung: string; einstellungen: Partial<Vorschlag> }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=id,beschreibung,einstellungen&limit=1`);
  if (!alt.ok) return html(seite("Suchprofil", automatischeSeite(firma, name, alteWebsite, plz, ort, "Das vorhandene Suchprofil konnte nicht geladen werden. Bitte erneut versuchen.")), 503);
  const vorhanden = alt.daten[0];
  const eingerichtet = Boolean(vorhanden && vorhanden.einstellungen?.recherche_status !== "wartet");
  const basis = eingabe.has("beschreibung") ? ausFormular(eingabe) : bereinigen({ ...vorhanden?.einstellungen, beschreibung: vorhanden?.beschreibung ?? "" });
  const eigeneBeschreibung = basis.beschreibung;
  const roheWebsite = eingabe.has("website") ? String(eingabe.get("website") ?? "").trim().slice(0, 300) : alteWebsite;
  const website = websiteNormalisieren(roheWebsite);
  if (roheWebsite && !website) return html(seite("Suchprofil", profilFormular(firma, basis, "Bitte eine gültige Website-Adresse angeben.", roheWebsite)), 400);
  if (website !== alteWebsite && rolle !== "inhaber") return html(seite("Suchprofil", profilFormular(firma, basis, "Nur der Inhaber kann die gemeinsame Firmenwebsite ändern.", alteWebsite)), 403);
  const orte = basis.standorte.map((o) => o.name).join("\n") || (eingerichtet ? "Deutschlandweit, keine Ortseinschränkung" : `${plz} ${ort}`);
  const websiteDaten = website ? await dienste.website(website) : { text: "", hinweis: "Keine Firmenwebsite angegeben." };

  let v: Vorschlag;
  try {
    const { profil } = await dienste.recherche(env, { name, website, beschreibung: eigeneBeschreibung, orte, websiteText: websiteDaten.text });
    v = bereinigen({ ...profil, beschreibung: eigeneBeschreibung, recherche_version: 2, website_hinweis: websiteDaten.hinweis, recherchiert_am: new Date().toISOString() });
    if (eingerichtet || basis.standorte.length) { v.standorte = basis.standorte; v.ausschluss = basis.ausschluss; v.ausschluss_cpv = basis.ausschluss_cpv; v.laender = basis.laender; }
    if (!v.firmenstandorte?.length) v.firmenstandorte = basis.firmenstandorte;
    v.suchgebiet_modus = (eingabe.get("suchgebiet_modus") || vorhanden?.einstellungen?.suchgebiet_modus) === "manuell" ? "manuell" : undefined;
    if (!v.leistungen.length) throw new Error("keine belegten Leistungen erkannt");
  } catch (e) {
    console.warn(`Automatische Einrichtung: ${e instanceof Error ? e.message : String(e)}`);
    const meldung = `Die Firmenrecherche wurde nicht abgeschlossen. ${kiFehlermeldung(e)}`;
    if (!eingerichtet) {
      const art = kiFehlerart(e);
      const morgen = new Date(); morgen.setUTCHours(24, 0, 0, 0);
      const einstellungen = { ...basis, recherche_status: "wartet", recherche_website: website, recherche_fehler: art, recherche_fehler_text: (e instanceof Error ? e.message : String(e)).slice(0, 300),
        recherche_wiederholen_ab: art === "budget" ? morgen.toISOString() : new Date(Date.now() + 120000).toISOString() };
      const daten = { firma_id: firma, name, beschreibung: eigeneBeschreibung, einstellungen };
      const gemerkt = await db(s, env, vorhanden ? `suchprofile?id=eq.${vorhanden.id}` : "suchprofile", { method: vorhanden ? "PATCH" : "POST", body: JSON.stringify(daten) });
      if (!gemerkt.ok) return html(seite(`Firma prüfen: ${name}`, automatischeSeite(firma, name, website, plz, ort, "Die Firmenprüfung und das Speichern sind gerade nicht erreichbar. Deine Eingaben stehen weiterhin hier. Bitte erneut versuchen.", basis)), 503);
    }
    return eingerichtet
      ? html(seite(`Suchprofil: ${name}`, profilFormular(firma, basis, meldung, website)), 502)
      : html(seite(`Firma prüfen: ${name}`, automatischeSeite(firma, name, website, plz, ort, meldung, basis)), 502);

  }
  if (!eingerichtet && !basis.standorte.length && ort) {
    const amFirmensitz = v.standorte.find((o) => o.name.toLocaleLowerCase("de") === ort.toLocaleLowerCase("de"));
    v.standorte = [amFirmensitz ?? { name: ort, plz_praefixe: /^\d{5}$/.test(plz) ? [plz.slice(0, 2)] : [] }];
  }
  const form = profilZuFormular(bereinigen(v), website);
  if (eingabe.get("aktion") === "recherche") form.set("aktion", "recherche");
  return speichern(s, env, firma, name, alteWebsite, rolle, form);
}

export function websiteFallback(name: string, websiteText: string, ort: string, plz: string): Vorschlag | null {
  const v = beschreibungFallback(``, ort, websiteText);
  if (!v.leistungen[0]?.woerter || v.leistungen[0].woerter.length < 2) return null;
  v.beschreibung = "";
  v.leistungen[0].name = `Leistungen von ${name}`.slice(0, 120);
  v.website_beschreibung = websiteText.slice(0, 1200);
  v.websuche_beschreibung = "";
  v.websuche_quellen = [];
  if (ort) v.standorte = [{ name: ort, plz_praefixe: /^\d{5}$/.test(plz) ? [plz.slice(0, 2)] : [] }];
  return v;
}

export function hatProfiltext(v: Vorschlag): boolean {
  return [v.beschreibung, v.website_beschreibung, v.websuche_beschreibung].some((x) => x.trim().length >= 20) && v.leistungen.length > 0;
}

export function profilZuFormular(v: Vorschlag, website: string): FormData {
  v = bereinigen(v);
  const form = new FormData();
  form.set("firma", "");
  form.set("website", website);
  form.set("beschreibung", v.beschreibung);
  form.set("website_beschreibung", v.website_beschreibung);
  form.set("recherche_version", String(v.recherche_version ?? ""));
  form.set("website_hinweis", v.website_hinweis ?? "");
  form.set("recherchiert_am", v.recherchiert_am ?? "");
  form.set("firmenstandorte", JSON.stringify(v.firmenstandorte ?? []));
  if (v.suchgebiet_modus) form.set("suchgebiet_modus", v.suchgebiet_modus);
  form.set("websuche_beschreibung", v.websuche_beschreibung);
  for (const quelle of v.websuche_quellen) form.append("websuche_quellen", JSON.stringify(quelle));
  form.set("ausschluss", v.ausschluss.join(", "));
  form.set("ausschluss_cpv", v.ausschluss_cpv.join(", "));
  for (const land of v.laender ?? ["DEU"]) form.append("laender", land);
  v.leistungen.forEach((l, i) => { form.set(`l${i}_an`, "1"); form.set(`l${i}_name`, l.name); form.set(`l${i}_woerter`, l.woerter.join(", ")); form.set(`l${i}_cpv`, l.cpv.join(", ")); });
  v.standorte.forEach((o, i) => { form.set(`o${i}_an`, "1"); form.set(`o${i}_name`, o.name); form.set(`o${i}_plz`, o.plz_praefixe.join(", ")); if (o.bereich_id) form.set(`o${i}_bereich`, o.bereich_id); });
  return form;
}

export function startFormular(firma: string, beschreibung: string, orte: string, website: string, fehler: string): string {
  return `${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
${hilfe("Tipp für eine gute Suche", "Beschreibe in einfachen Worten, welche Arbeit ihr macht und wo ihr arbeitet. Fachbegriffe oder Vergabe-Kennziffern brauchst du nicht.")}
<p>Jarvis wertet Website und öffentliche Suchtreffer automatisch aus. Du kannst das Ergebnis prüfen oder die Firmenarbeit selbst ergänzen.</p>
<form method="post" data-suchaktion action="/konto/einrichtung/vorschlag">
  <input type="hidden" name="firma" value="${firma}">
  <label>Firmenwebsite (freiwillig)<input name="website" type="text" inputmode="url" maxlength="300" autocomplete="url" placeholder="www.beispiel.de" value="${escape(website)}"></label>
  <p class="klein">Jarvis prüft die Website und bis zu drei öffentliche Web-Suchergebnisse. Es übernimmt belegte Leistungen als Suchwörter und beachtet Website-Zugriffssperren.</p>
  <label>Welche Arbeit macht ihr?
    <textarea name="beschreibung" maxlength="3000" placeholder="Zum Beispiel: Wir verlegen Fliesen und Mosaik in Badezimmern und Küchen.">${escape(beschreibung)}</textarea></label>
  <label>Standorte (eine Stadt pro Zeile, freiwillig)
    <textarea name="orte" maxlength="1000" placeholder="Köln&#10;Düsseldorf">${escape(orte)}</textarea>
    <span class="klein">Ohne Standorte sucht Jarvis in ganz Deutschland.</span></label>
  <button type="submit">Suchprofil automatisch erstellen</button>
  <p class="klein" data-einrichtung-status role="status" aria-live="polite">Jarvis recherchiert die Firma und erstellt danach das Suchprofil. Das kann bis zu zwei Minuten dauern.</p>
</form><p><a href="/konto/suchprofil">← Zurück zum Suchprofil</a> · <a href="/konto">Zur Übersicht</a></p>`;
}

async function vorschlagen(env: EinrichtungEnv, firma: string, name: string, form: FormData): Promise<Response> {
  const beschreibung = String(form.get("beschreibung") ?? "").trim().slice(0, 3000);
  const orte = String(form.get("orte") ?? "").trim().slice(0, 1000);
  const rohWebsite = String(form.get("website") ?? "").trim().slice(0, 300);
  const website = websiteNormalisieren(rohWebsite);
  if (rohWebsite && !website) return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, "", "Bitte eine gültige Website-Adresse angeben.")), 400);
  if (beschreibung.length < 20 && !website) return html(seite("Suche einrichten", startFormular(firma, beschreibung, orte, website, "Bitte beschreib deine Firma in ein paar Sätzen.")), 400);
  const websiteDaten = website ? await websiteKontext(website) : { text: "", hinweis: "" };
  let vorschlag: Vorschlag;
  try {
    // The shared engine searches with citations before requesting the structured profile.
    const { profil } = await rechercheProfil(env, { name, website, beschreibung, orte, websiteText: websiteDaten.text }, apiClient(env, firma));
    vorschlag = bereinigen({ ...profil, recherche_version: 2, website_hinweis: websiteDaten.hinweis, recherchiert_am: new Date().toISOString() });
    if (!vorschlag.leistungen.length) throw new Error("leerer Vorschlag");
  } catch (e) {
    console.warn(`Einrichtung: ${e instanceof Error ? e.message : String(e)}`);
    vorschlag = beschreibungFallback(beschreibung, orte, websiteDaten.text);
    const webHinweis = websiteDaten.hinweis;
    return html(seite(`Vorschlag für ${name}`, profilFormular(firma, vorschlag, `Die Firmenrecherche ist fehlgeschlagen: ${rechercheFehler(e)} Bisher wurden nur deine Angaben übernommen. ${websiteDaten.hinweis || webHinweis}`.trim(), website)));
  }
  const webHinweis = websiteDaten.hinweis;
  return html(seite(`Vorschlag für ${name}`, profilFormular(firma, vorschlag, `Prüfe kurz, ob die vorgeschlagenen Arbeiten und Einsatzorte stimmen. Du kannst sie ändern oder entfernen. ${webHinweis}`.trim(), website)));
}

export function beschreibungFallback(beschreibung: string, orte: string, websiteText = ""): Vorschlag {
  const stop = new Set(["aber", "alle", "auch", "dass", "diese", "einer", "eines", "eine", "einem", "einen", "einer", "firma", "für", "haben", "hier", "ihre", "sind", "und", "uns", "von", "werden", "wir", "mit", "nicht", "sowie", "das", "der", "die", "den", "dem", "des", "team", "unsere", "leistungen"]);
  const extrahieren = (text: string) => (text.toLocaleLowerCase("de").match(/[a-zäöüß]{4,}/g) ?? []).filter((w) => !stop.has(w));
  // Website service pages are ranked first; a long plain-language description must not crowd them out.
  const woerter = [...new Set([...extrahieren(websiteText), ...extrahieren(beschreibung)])].slice(0, 20);
  const ersterSatz = beschreibung.split(/[.!?\n]+/).map((s) => s.trim()).find(Boolean) ?? beschreibung;
  const standorte = orte.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20).map((name) => ({ name, plz_praefixe: [] }));
  return bereinigen({ beschreibung, website_beschreibung: websiteText.slice(0, 1200), leistungen: [{ name: ersterSatz.slice(0, 120) || "Leistung aus Firmenbeschreibung", cpv: [], woerter: woerter.length ? woerter : ["ausschreibung"] }], standorte });
}

/** A syntactically valid model answer can still contain no usable service; never show an unsaveable profile. */
export function vorschlagOderFallback(v: Partial<Vorschlag>, beschreibung: string, orte: string, websiteText = ""): Vorschlag {
  const bereinigt = bereinigen({ ...v, beschreibung, website_beschreibung: v.website_beschreibung || websiteText.slice(0, 1200) });
  return hatProfiltext(bereinigt)
    ? bereinigt
    : beschreibungFallback(beschreibung, orte, websiteText);
}

function leer(): Vorschlag {
  return { beschreibung: "", website_beschreibung: "", websuche_beschreibung: "", websuche_quellen: [], leistungen: [], ausschluss: [], ausschluss_cpv: [], standorte: [] };
}

function rechercheFehler(e: unknown): string {
  return kiFehlermeldung(e);
}

const liste = (x: string[] | undefined) => escape((x ?? []).join(", "));

export function profilFormular(firma: string, v: Vorschlag, hinweis: string, website = ""): string {
  v = bereinigen(v);
  const leistungen = arbeitsAuswahl(v.leistungen);
  const standorte = [...v.standorte, { name: "", plz_praefixe: [] }].map((o, i) => `<fieldset>
  <label class="zeile"><input type="checkbox" name="o${i}_an" value="1"${o.name ? " checked" : ""}> ${o.name ? `${escape(o.name)} als Einsatzort` : "Weiteren Einsatzort hinzufügen"}</label>
  <details><summary>${o.name ? "Suchgebiet ändern" : "Weiteren Einsatzort eintragen"}</summary>
  <label>Stadt oder Gegend<input name="o${i}_name" maxlength="120" placeholder="z. B. Bad Wildungen" value="${escape(o.name)}"></label>
    <label>Postleitzahl-Anfänge, durch Komma getrennt<input name="o${i}_plz" maxlength="300" inputmode="numeric" value="${liste(o.plz_praefixe)}"></label>
  </details>
  ${o.bereich_id ? `<input type="hidden" name="o${i}_bereich" value="${escape(o.bereich_id)}">` : ""}
</fieldset>`).join("");
  return `${hinweis ? `<p role="status">${escape(hinweis)}</p>` : ""}
${hilfe("Was kann ich hier ändern?", "Prüfe, ob die genannten Arbeiten und Einsatzorte stimmen. Die zusätzlichen Suchdetails brauchst du nur, wenn du die Suche gezielt verfeinern möchtest.")}
<form method="post" data-suchaktion data-kosten-warnung action="/konto/einrichtung/speichern">
  <input type="hidden" name="firma" value="${firma}">
  <input type="hidden" name="recherche_version" value="${v.recherche_version ?? ""}">
  <input type="hidden" name="website_hinweis" value="${escape(v.website_hinweis ?? "")}">
  <input type="hidden" name="recherchiert_am" value="${escape(v.recherchiert_am ?? "")}">
  <input type="hidden" name="firmenstandorte" value="${escape(JSON.stringify(v.firmenstandorte ?? []))}">
  <label>Firmenwebsite (freiwillig)<input name="website" type="text" inputmode="url" maxlength="300" autocomplete="url" value="${escape(website)}"></label>
  <label>Deine Beschreibung der Firma (optional)
    <textarea name="beschreibung" maxlength="3000">${escape(v.beschreibung)}</textarea></label>
  ${firmenInfos(v, true)}
  ${(v.websuche_quellen ?? []).map((q) => `<input type="hidden" name="websuche_quellen" value="${escape(JSON.stringify(q))}">`).join("")}
  <h2>Welche Arbeiten soll Jarvis für dich finden?</h2>
  ${leistungen}
  <details><summary>Unpassende Arbeiten ausschließen (optional)</summary>
    <label>Welche Aufträge soll Jarvis nicht anzeigen?<input name="ausschluss" maxlength="1500" placeholder="z. B. Neubau, wenn ihr nur renoviert" value="${liste(v.ausschluss)}"></label>
    <label>Vergabe-Kennziffern für Ausschlüsse (optional)<input name="ausschluss_cpv" maxlength="300" inputmode="numeric" value="${liste(v.ausschluss_cpv)}"></label>
  </details>
  <details${(v.auftraggeber_bevorzugt?.length || v.auftraggeber_aus?.length || v.wert_min || v.wert_max) ? " open" : ""}><summary>Auftraggeber und Auftragsgröße (optional)</summary>
    <label>Bevorzugte Auftraggeber<input name="auftraggeber_bevorzugt" maxlength="2000" placeholder="z. B. Stadt Aachen, Uniklinik Köln" value="${escape((v.auftraggeber_bevorzugt ?? []).join(", "))}"><span class="klein">Treffer dieser Auftraggeber erscheinen schon mit 2 Punkten weniger.</span></label>
    <label>Diese Auftraggeber nie zeigen<input name="auftraggeber_aus" maxlength="2000" placeholder="z. B. Bundeswehr" value="${escape((v.auftraggeber_aus ?? []).join(", "))}"></label>
    <div class="wert-felder"><label>Auftragswert ab (€)<input name="wert_min" inputmode="decimal" placeholder="z. B. 50.000" value="${v.wert_min ? v.wert_min.toLocaleString("de-DE") : ""}"></label>
    <label>bis (€)<input name="wert_max" inputmode="decimal" placeholder="ohne Grenze" value="${v.wert_max ? v.wert_max.toLocaleString("de-DE") : ""}"></label></div>
    <label class="zeile"><input type="checkbox" name="wert_unbekannt" value="1"${v.wert_unbekannt !== false ? " checked" : ""}> Ausschreibungen ohne Wertangabe trotzdem zeigen (empfohlen, viele nennen keinen Wert)</label>
    <span class="klein">Ändert nur, welche Treffer erscheinen. Kostet nichts extra.</span>
  </details>
  <h2>Wo soll Jarvis suchen?</h2>
  <label>Umkreis um jeden Standort<select name="radius_km">${RADIEN.map((km) => `<option value="${km}"${km === (v.radius_km ?? 50) ? " selected" : ""}>${km} km${km === 50 ? " (empfohlen)" : ""}</option>`).join("")}</select>
    <span class="klein">Ausschreibungen mit bekanntem Einsatzort weiter weg blendet Jarvis aus. Ändern kostet nichts extra.</span></label>
  ${v.firmenstandorte?.length ? `<label>Suchgebiet<select name="suchgebiet_modus"><option value="firmenstandorte"${v.suchgebiet_modus !== "manuell" ? " selected" : ""}>Alle ${v.firmenstandorte.length} Firmenstandorte</option><option value="manuell"${v.suchgebiet_modus === "manuell" ? " selected" : ""}>Nur ausgewählte Orte</option></select></label>
  <p class="klein">Die Ausschreibungssuche berücksichtigt jeden Firmenstandort. Mehrfach gefundene Ausschreibungen erscheinen einmal.</p>
  <details${v.suchgebiet_modus === "manuell" ? " open" : ""}><summary>Eigene Suchorte festlegen (optional)</summary><p class="klein">Wähle dafür oben „Nur ausgewählte Orte“. Ohne eigene Suchorte gilt ganz Deutschland.</p>${standorte}</details>` : standorte}
  <details><summary>In weiteren Ländern suchen (optional)</summary>
    <p class="klein">Deutschland ist standardmäßig ausgewählt. Jarvis kann zusätzlich Ausschreibungen aus europäischen Ländern und den USA suchen.</p>
    ${laenderAuswahl(laenderBereinigen(v.laender))}
  </details>
  <details><summary>Tägliche E-Mail einstellen (optional)</summary>
  <label>Neue Treffer per Mail an dich um<select name="stunde">${stundenOptionen(7)}</select>
    <span class="klein">Jeder im Team stellt seine Uhrzeit selbst ein.</span></label>
  </details>
  <details><summary>Ab welcher Punktzahl zeigen? <span class="check-zahl">ab ${v.min_punkte ?? 6}/10</span></summary>
  <label>Treffer anzeigen und melden ab<select name="min_punkte">${[4, 5, 6, 7, 8].map((n) => `<option value="${n}"${n === (v.min_punkte ?? 6) ? " selected" : ""}>${n}/10${n === 6 ? " (empfohlen)" : n < 6 ? " – mehr, auch unsichere Treffer" : " – nur sehr passende"}</option>`).join("")}</select></label>
  <span class="klein">Ändert nur, welche bewerteten Treffer erscheinen. Kostet nichts extra.</span>
  </details>
  <p class="kosten-hinweis" data-kosten-hinweis hidden>💡 Du hast Arbeiten, Suchwörter, Ausschlüsse oder Orte geändert. Beim nächsten Suchlauf bewertet Jarvis deshalb alle passenden Ausschreibungen neu. Das kostet einmalig etwa 0,50–1 € KI-Guthaben.</p>
  <button type="submit">Speichern und Ausschreibungen suchen</button>
  <button type="submit" class="zweit" name="aktion" value="vorschau" formaction="/konto/einrichtung/vorschau">🔍 Vorschau: Wie viele Treffer letzte Woche?</button>
  <button type="submit" class="zweit" name="aktion" value="recherche" formaction="/konto/einrichtung/automatisch" formnovalidate>Firmeninfos neu recherchieren</button>
  <p class="klein">Liest die Website und öffentliche Quellen neu und aktualisiert dein Firmenprofil.</p>
</form>
<p><a href="/konto/suchprofil">Suchprofil ansehen</a></p>`;
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
  const firmenstandorte = standorteBereinigen(v.firmenstandorte);
  const modus = firmenstandorte.length ? (v.suchgebiet_modus === "manuell" ? "manuell" : "firmenstandorte") : undefined;
  const suchorte = (v.standorte ?? []).map((o) => ({ name: String(o.name ?? "").trim().slice(0, 120), plz_praefixe: ziffern(o.plz_praefixe, 2, 2), ...(o.bereich_id && ID.test(o.bereich_id) ? { bereich_id: o.bereich_id } : {}) })).filter((o) => o.name).slice(0, 40);
  const mindest = Math.round(Number(v.min_punkte));
  const radius = Math.round(Number(v.radius_km));
  return {
    radius_km: radius >= 10 && radius <= 300 ? radius : undefined,
    min_punkte: mindest >= 3 && mindest <= 9 ? mindest : undefined,
    beschreibung: String(v.beschreibung ?? "").trim().slice(0, 3000),
    recherche_version: v.recherche_version === 2 ? 2 : undefined,
    recherchiert_am: v.recherchiert_am && Number.isFinite(Date.parse(v.recherchiert_am)) ? v.recherchiert_am : undefined,
    website_hinweis: String(v.website_hinweis ?? "").slice(0, 500),
    website_beschreibung: String(v.website_beschreibung ?? "").trim().slice(0, 1500),
    websuche_beschreibung: String(v.websuche_beschreibung ?? "").trim().slice(0, 1500),
    websuche_quellen: (Array.isArray(v.websuche_quellen) ? v.websuche_quellen : []).map((q) => ({ titel: String(q?.titel ?? "").trim().slice(0, 200), url: sichereQuellenUrl(q?.url) })).filter((q) => q.url).slice(0, 5),
    firmenstandorte,
    suchgebiet_modus: modus,
    leistungen: (v.leistungen ?? []).map((l) => ({ name: String(l.name ?? "").trim().slice(0, 120), cpv: ziffern(l.cpv, 2, 8), woerter: woerter(l.woerter) })).filter((l) => l.name && (l.cpv.length || l.woerter.length)).slice(0, MAX_ARBEITEN),
    ausschluss: woerter(v.ausschluss),
    ausschluss_cpv: ziffern(v.ausschluss_cpv, 2, 8),
    standorte: modus === "firmenstandorte" ? suchorteAnStandorten(firmenstandorte, suchorte) : suchorte,
    laender: laenderBereinigen(v.laender),
    auftraggeber_bevorzugt: auftraggeberListe(v.auftraggeber_bevorzugt),
    auftraggeber_aus: auftraggeberListe(v.auftraggeber_aus),
    wert_min: wertOderLeer(v.wert_min),
    wert_max: wertOderLeer(v.wert_max),
    wert_unbekannt: v.wert_unbekannt !== false,
  };
}

/** Buyer names as typed (e.g. "Stadt Köln"), at most 30. */
export function auftraggeberListe(x: unknown): string[] {
  return [...new Set((Array.isArray(x) ? x : []).map((n) => String(n).replace(/\s+/g, " ").trim()).filter((n) => n.length >= 3 && n.length <= 120))].slice(0, 30);
}
/** Contract value in euros; empty or 0 = no limit. */
export function wertOderLeer(x: unknown): number | undefined {
  const n = Math.round(Number(x));
  return Number.isFinite(n) && n > 0 && n <= 1e10 ? n : undefined;
}

function sichereQuellenUrl(wert: unknown): string {
  try {
    const u = new URL(String(wert ?? ""));
    return u.protocol === "https:" && !u.username && !u.password ? u.toString().slice(0, 500) : "";
  } catch { return ""; }
}

/** "50.000", "50000 €" or "1,5 Mio" → euros. */
export function euroEingabe(x: unknown): number | undefined {
  const t = String(x ?? "").toLowerCase().replace(/\s|€|eur/g, "");
  if (!t) return undefined;
  const mio = /mio/.test(t);
  const zahl = Number(t.replace(/mio\.?|millionen/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(zahl) ? Math.round(zahl * (mio ? 1e6 : 1)) : undefined;
}

export function ausFormular(form: FormData): Vorschlag {
  const teile = (k: string) => String(form.get(k) ?? "").split(",");
  const leistungen: Leistung[] = [];
  const standorte: Standort[] = [];
  for (let i = 0; i < 40; i++) {
    if (form.get(`l${i}_an`)) {
      const name = String(form.get(`l${i}_name`) ?? "");
      const cpv = teile(`l${i}_cpv`).filter((w) => w.trim());
      const woerter = teile(`l${i}_woerter`).filter((w) => w.trim());
      leistungen.push({ name, cpv, woerter: !cpv.length && !woerter.length ? arbeitAusName(name).woerter : woerter });
    }
    if (form.get(`o${i}_an`)) standorte.push({ name: String(form.get(`o${i}_name`) ?? ""), plz_praefixe: teile(`o${i}_plz`), bereich_id: String(form.get(`o${i}_bereich`) ?? "") || undefined });
  }
  let quellen: WebQuelle[] = [];
  try { quellen = form.getAll("websuche_quellen").map(String).map((x) => JSON.parse(x) as WebQuelle); } catch { quellen = []; }
  let firmenstandorte: Firmenstandort[] = [];
  try { firmenstandorte = standorteBereinigen(JSON.parse(String(form.get("firmenstandorte") ?? "[]").slice(0, 40000))); } catch { /* Keep invalid client input out of the profile. */ }
  return bereinigen({ radius_km: Number(form.get("radius_km")) || undefined, min_punkte: Number(form.get("min_punkte")) || undefined, recherchiert_am: String(form.get("recherchiert_am") ?? ""), recherche_version: Number(form.get("recherche_version")), website_hinweis: String(form.get("website_hinweis") ?? ""), beschreibung: String(form.get("beschreibung") ?? ""), website_beschreibung: String(form.get("website_beschreibung") ?? ""), websuche_beschreibung: String(form.get("websuche_beschreibung") ?? ""), websuche_quellen: quellen, firmenstandorte, suchgebiet_modus: form.get("suchgebiet_modus") === "manuell" ? "manuell" : undefined, leistungen, ausschluss: teile("ausschluss"), ausschluss_cpv: teile("ausschluss_cpv"), standorte, laender: form.getAll("laender").map(String),
    auftraggeber_bevorzugt: String(form.get("auftraggeber_bevorzugt") ?? "").split(/[,;\n]/), auftraggeber_aus: String(form.get("auftraggeber_aus") ?? "").split(/[,;\n]/),
    wert_min: euroEingabe(form.get("wert_min")), wert_max: euroEingabe(form.get("wert_max")), wert_unbekannt: form.has("wert_min") || form.has("wert_max") ? form.get("wert_unbekannt") === "1" : undefined });
}

/** H1: the edited profile next to the saved one, counted over the last 7 days; nothing is saved. */
async function vorschauZeigen(s: Sitzung, env: EinrichtungEnv, firma: string, name: string, website: string, form: FormData): Promise<Response> {
  const v = ausFormular(form);
  const r = await db<{ einstellungen: Partial<Vorschlag> & { ausschluss_schnell?: string[] } }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=einstellungen&limit=1`);
  const gespeichert = r.ok && r.daten[0]?.einstellungen?.leistungen ? r.daten[0].einstellungen : null;
  const schnell = gespeichert?.ausschluss_schnell ?? [];
  const [neu, alt] = await Promise.all([
    vorschauZaehlen(s, env, firma, v, schnell),
    gespeichert ? vorschauZaehlen(s, env, firma, bereinigen({ ...gespeichert, beschreibung: "" }), schnell) : Promise.resolve(null),
  ]);
  return html(seite(`Suchprofil: ${name}`, vorschauBox(neu, alt) + profilFormular(firma, v, "", String(form.get("website") ?? website))));
}

async function speichern(s: Sitzung, env: EinrichtungEnv, firma: string, name: string, alteWebsite: string, rolle: string, form: FormData): Promise<Response> {
  const v = ausFormular(form);
  const roheWebsite = String(form.get("website") ?? "").trim().slice(0, 300);
  const website = websiteNormalisieren(roheWebsite);
  if (roheWebsite && !website) return html(seite("Suchprofil", profilFormular(firma, v, "Bitte eine gültige Website-Adresse angeben.", roheWebsite)), 400);
  if (website !== alteWebsite && rolle !== "inhaber") {
    return html(seite("Suchprofil", profilFormular(firma, v, "Nur der Inhaber kann die gemeinsame Firmenwebsite ändern.", alteWebsite)), 403);
  }
  if (!hatProfiltext(v)) {
    return html(seite("Suchprofil", profilFormular(firma, v, "Bitte eine Beschreibung oder genügend Website-Informationen und mindestens eine Leistung angeben.", website || alteWebsite)), 400);
  }
  // Reuse existing branches throughout the organisation tree, including below regions.
  const vorhanden = await db<Bereich[]>(s, env, `bereiche?firma_id=eq.${firma}&select=id,name,art,parent_id`);
  if (!vorhanden.ok) return html(seite("Suchprofil", profilFormular(firma, v, "Die Firmenstandorte konnten nicht geladen werden. Deine Recherche ist hier erhalten; bitte erneut speichern.", website)), 503);
  const bereiche = vorhanden.ok ? vorhanden.daten : [];
  for (const o of [...(v.firmenstandorte ?? []), ...v.standorte]) {
    if (o.bereich_id && bereiche.some((b) => b.id === o.bereich_id && b.art === "standort")) continue;
    const gleich = bereiche.find((b) => b.art === "standort" && standortSchluessel(b.name) === standortSchluessel(o.name));
    if (gleich) {
      o.bereich_id = gleich.id;
      continue;
    }
    const neu = await db<Bereich[]>(s, env, "bereiche", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, name: o.name, art: "standort" }) });
    if (neu.ok && neu.daten[0]) {
      o.bereich_id = neu.daten[0].id;
      bereiche.push(neu.daten[0]);
    } else return html(seite("Suchprofil", profilFormular(firma, v, `Der Standort „${o.name}“ konnte noch nicht übernommen werden. Deine Recherche ist hier erhalten; bitte erneut speichern.`, website)), 503);
  }
  const zeile = {
    firma_id: firma,
    name,
    beschreibung: v.beschreibung,
    cpv: [...new Set(v.leistungen.flatMap((l) => l.cpv))],
    woerter: [...new Set(v.leistungen.flatMap((l) => l.woerter))].join(", "),
    ausschluss: v.ausschluss.join(", "),
    plz_praefixe: [...new Set(v.standorte.flatMap((o) => o.plz_praefixe))],
    einstellungen: { radius_km: v.radius_km ?? 50, min_punkte: v.min_punkte, recherchiert_am: v.recherchiert_am, recherche_version: v.recherche_version, website_hinweis: v.website_hinweis, leistungen: v.leistungen, website_beschreibung: v.website_beschreibung, websuche_beschreibung: v.websuche_beschreibung, websuche_quellen: v.websuche_quellen, firmenstandorte: v.firmenstandorte, suchgebiet_modus: v.suchgebiet_modus, ausschluss: v.ausschluss, ausschluss_cpv: v.ausschluss_cpv, standorte: v.standorte, laender: v.laender, auftraggeber_bevorzugt: v.auftraggeber_bevorzugt, auftraggeber_aus: v.auftraggeber_aus, wert_min: v.wert_min ?? null, wert_max: v.wert_max ?? null, wert_unbekannt: v.wert_unbekannt } as Record<string, unknown>,
  };
  const alt = await db<{ id: string; erstlauf: string | null; fertig: string | null; ergebnis?: unknown; fehler?: boolean; zusatzprofile?: unknown; ausschluss_schnell?: unknown }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=id,erstlauf:einstellungen->>erstlauf,fertig:einstellungen->>erstlauf_fertig,ergebnis:einstellungen->suchlauf_ergebnis,fehler:einstellungen->suchlauf_fehler,zusatzprofile:einstellungen->zusatzprofile,ausschluss_schnell:einstellungen->ausschluss_schnell&limit=1`);
  // A completed search can be rerun; only suppress duplicate concurrent runs.
  const zuletzt = alt.ok && alt.daten[0]?.erstlauf ? Date.parse(alt.daten[0].erstlauf) : 0;
  const fertig = alt.ok ? alt.daten[0]?.fertig : null;
  const sofort = !suchlaufLaeuft(zuletzt ? new Date(zuletzt).toISOString() : null, fertig);
  const einstellungen: Record<string, unknown> = zeile.einstellungen;
  if (zuletzt) einstellungen.erstlauf = new Date(zuletzt).toISOString();
  if (fertig) einstellungen.erstlauf_fertig = fertig;
  if (alt.ok && alt.daten[0]?.ergebnis) einstellungen.suchlauf_ergebnis = alt.daten[0].ergebnis;
  if (alt.ok && alt.daten[0]?.fehler !== undefined) einstellungen.suchlauf_fehler = alt.daten[0].fehler;
  // Kept from the saved profile: further search profiles (H3) and exclusions added via 👎 (H2) are edited elsewhere.
  if (alt.ok && Array.isArray(alt.daten[0]?.zusatzprofile)) einstellungen.zusatzprofile = alt.daten[0].zusatzprofile;
  if (alt.ok && Array.isArray(alt.daten[0]?.ausschluss_schnell)) einstellungen.ausschluss_schnell = alt.daten[0].ausschluss_schnell;
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
    return html(seite("Suchprofil", profilFormular(firma, v, meldung, website || alteWebsite)), 500);
  }
  if (rolle === "inhaber" && website !== alteWebsite) {
    const firmenseite = await db(s, env, `firmen?id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ website }) });
    if (!firmenseite.ok) return html(seite("Suchprofil", profilFormular(firma, v, "Das Suchprofil wurde gespeichert, aber die Website nicht. Bitte erneut speichern.", website)), 500);
  }
  if (form.get("aktion") === "recherche") return weiterleiten(`/konto/suchprofil?firma=${firma}&hinweis=${encodeURIComponent(`Firmeninfos aktualisiert: ${v.leistungen.length} Arbeitsbereiche. Du kannst jetzt nach Ausschreibungen suchen.`)}`, s.cookies);
  if (form.has("stunde")) await mailZeitSetzen(s, env, firma, form.get("stunde"));
  const laufstart: Laufstart = sofort ? await ersterLauf(env, firma) : { gestartet: false, hinweis: "Jarvis durchsucht diese Firma gerade. Warte bitte, bis der laufende Suchlauf fertig ist." };
  const gestartet = laufstart.gestartet;
  if (gestartet) {
    // Remembered for the "Jarvis is searching" notice in the overview and the 2-hour limit.
    await db(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null`, { method: "PATCH", body: JSON.stringify({ einstellungen: { ...einstellungen, erstlauf: new Date().toISOString() } }) });
  }
  // While the first run is busy the overview shows its own notice with a spinner, which disappears when it is done.
  if (gestartet) return weiterleiten(`/konto?firma=${firma}`);
  const hinweis = sofort ? `Dein Suchprofil ist gespeichert. ${laufstart.hinweis}` : "Jarvis durchsucht diese Firma bereits. Warte bitte, bis der laufende Suchlauf fertig ist.";
  return weiterleiten(`/konto/suchprofil?firma=${firma}&hinweis=${encodeURIComponent(hinweis)}`, s.cookies);
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
  if (!alt.einstellungen?.websuche_beschreibung && alt.einstellungen?.recherche_version !== 2) return weiterleiten(`/konto/einrichtung?firma=${firma}&automatisch=1`, s.cookies);
  const zuletzt = alt.einstellungen?.erstlauf ? String(alt.einstellungen.erstlauf) : null;
  const fertig = alt.einstellungen?.erstlauf_fertig ? String(alt.einstellungen.erstlauf_fertig) : null;
  if (suchlaufLaeuft(zuletzt, fertig)) return weiterleiten(`/konto/suchprofil?firma=${firma}&hinweis=${encodeURIComponent("Jarvis sucht für diese Firma bereits. Die Treffer erscheinen nach Abschluss.")}`, s.cookies);
  const laufstart = await ersterLauf(env, firma);
  if (!laufstart.gestartet) {
    const hinweis = `Der Suchlauf wurde nicht gestartet. ${laufstart.hinweis} Deine Suche bleibt gespeichert.`;
    return weiterleiten(`/konto/suchprofil?firma=${firma}&hinweis=${encodeURIComponent(hinweis)}`, s.cookies);
  }
  const normal = bereinigen(alt.einstellungen);
  const einstellungen = { ...alt.einstellungen, standorte: normal.standorte, suchgebiet_modus: normal.suchgebiet_modus, erstlauf: new Date().toISOString() };
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
