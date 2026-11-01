// Change log for owners (G5): who changed what and when. Written by database triggers, kept for twelve months.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { avatar } from "./personal.ts";
import { escape, seite } from "./seite.ts";

export type Eintrag = { id: number; user_id: string | null; wer: string; bereich: string; aktion: string; datensatz: string; aenderungen: { feld: string; alt: string | null; neu: string | null }[]; zeit: string };

export const BEREICHE: Record<string, string> = {
  personal: "👷 Personal", personal_abwesenheiten: "📅 Abwesenheit", mitglieder: "🔑 App-Zugang", mitglied_bereiche: "🔑 Standortzuordnung",
  einladungen: "✉️ Einladung", bereiche: "📍 Standort", vorgaenge: "📋 Ausschreibung", firmenunterlagen: "📁 Unterlage", referenzen: "🏅 Referenz",
  kalkulationsvorlagen: "💶 Standardwerte", kalkulationsprofile: "💾 Kalkulationsvorlage", angebotsmappen: "📝 Angebot", suchprofile: "🔎 Suchprofil",
  firmen_tarifvertraege: "⚖️ Tarifvertrag",
};
const AKTION: Record<string, string> = { INSERT: "angelegt", UPDATE: "geändert", DELETE: "gelöscht" };
const FELDER: Record<string, string> = {
  status: "Status", vorname: "Vorname", nachname: "Nachname", telefon: "Telefon", email: "E-Mail", berufe: "Berufe", qualifikationen: "Qualifikationen",
  eg: "Entgeltgruppe", tarifvertrag_id: "Tarifvertrag", notiz: "Notiz", bereich_id: "Standort", rolle: "Rolle", aktiv: "Zugang aktiv", finanzen: "Finanzfreigabe",
  alle_bereiche: "Alle Standorte", anzeigename: "Name", funktion: "Funktion", name: "Name", ansprechpartner: "Ansprechpartner", frist: "Frist", titel: "Titel",
  kaufverantwortlich_id: "Kaufmännisch zuständig", zustaendig: "Zuständig", freigabe_status: "Freigabe", freigabe_notiz: "Freigabe-Notiz", gueltig_bis: "Gültig bis", gueltig_ab: "Gültig ab",
  ordner: "Ordner", eingaben: "Werte", einstellungen: "Einstellungen", woerter: "Suchwörter", ausschluss: "Ausschlüsse", cpv: "Leistungscodes", plz_praefixe: "PLZ-Gebiete",
  beschreibung: "Beschreibung", foto: "Foto", von: "Von", bis: "Bis", grund: "Grund", zeitraum: "Zeitraum", auftraggeber: "Auftraggeber", leistung: "Leistung",
  auftragswert: "Auftragswert", art: "Art", parent_id: "Gehört zu", gruppen: "Gruppen", text: "Text", punkte: "Punkte", angenommen: "Angenommen", gueltig_erkannt: "Datum erkannt",
};
const WERTE: Record<string, string> = {
  verfuegbar: "verfügbar", einsatz: "im Einsatz", nicht: "nicht verfügbar", neu: "neu", pruefen: "prüfen", angebot: "Angebot in Arbeit", abgegeben: "abgegeben",
  gewonnen: "gewonnen", verloren: "verloren", verworfen: "archiviert", inhaber: "Inhaber", admin: "Administration", bearbeiter: "Bearbeiter", leser: "Leser",
  mitarbeiter: "Mitarbeiter", standortleitung: "Standortleitung", true: "ja", false: "nein", urlaub: "Urlaub", schulung: "Schulung", abwesend: "nicht verfügbar",
  wartet: "wartet", genehmigt: "freigegeben", abgelehnt: "abgelehnt",
};

/** A stored value in readable form; ids are not shown, dates in German. */
export function wert(roh: string | null): string {
  if (roh === null || roh === "") return "leer";
  if (/^[0-9a-f-]{36}$/.test(roh)) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(roh)) return new Date(roh).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(roh)) return new Date(`${roh}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" });
  if (/^(urlaub|schulung|abwesend) /.test(roh)) return roh.replace(/^(\w+) (\S+) bis (\S+)$/, (_m, g: string, v: string, b: string) => `${WERTE[g] ?? g} ${wert(v)} bis ${wert(b)}`);
  return WERTE[roh] ?? roh;
}

/** One line: "Status: verfügbar → im Einsatz"; ids and long objects only by name. */
export function aenderungText(e: Eintrag): string {
  return e.aenderungen.map((a) => {
    const feld = FELDER[a.feld] ?? a.feld;
    const alt = wert(a.alt), neu = wert(a.neu);
    if (a.alt === null && a.neu === null) return feld;
    if (e.aktion !== "UPDATE") return neu ? `${feld}: ${neu}` : feld;
    return alt || neu ? `${feld}: ${alt || "…"} → ${neu || "…"}` : feld;
  }).join(" · ");
}

export function protokollSeite(eintraege: Eintrag[], o: { wer: string; bereich: string; tage: number; personen: { id: string; name: string }[]; jetzt?: number }): string {
  const jetzt = o.jetzt ?? Date.now();
  const tag = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const heute = tag(new Date(jetzt).toISOString()), gestern = tag(new Date(jetzt - 86400_000).toISOString());
  const titel = (t: string) => t === heute ? "Heute" : t === gestern ? "Gestern" : new Date(`${t}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const filter = `<form method="get" action="/konto/protokoll" class="filter-leiste protokoll-filter"><label>Person<select name="wer" data-sofort-wahl><option value="">Alle</option>${o.personen.map((p) => `<option value="${p.id}"${p.id === o.wer ? " selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label><label>Bereich<select name="bereich" data-sofort-wahl><option value="">Alle</option>${Object.entries(BEREICHE).map(([k, t]) => `<option value="${k}"${k === o.bereich ? " selected" : ""}>${t}</option>`).join("")}</select></label><label>Zeitraum<select name="tage" data-sofort-wahl>${[[7, "7 Tage"], [30, "30 Tage"], [365, "12 Monate"]].map(([n, t]) => `<option value="${n}"${n === o.tage ? " selected" : ""}>${t}</option>`).join("")}</select></label><noscript><button>Anzeigen</button></noscript></form>`;
  if (!eintraege.length) return `${filter}<p class="treffer-leer">Keine Änderungen in diesem Zeitraum.</p>`;
  const gruppen = new Map<string, Eintrag[]>();
  for (const e of eintraege) gruppen.set(tag(e.zeit), [...(gruppen.get(tag(e.zeit)) ?? []), e]);
  return `${filter}${[...gruppen].map(([t, liste]) => `<h2 class="ordner-titel">${escape(titel(t))}</h2><ul class="protokoll-liste">${liste.map((e) => {
    const details = aenderungText(e);
    return `<li>${avatar(e.wer || "?", e.user_id ?? e.wer, undefined, "person-avatar klein-avatar")}<div><p><strong>${escape(e.wer || "Unbekannt")}</strong> hat ${BEREICHE[e.bereich] ?? escape(e.bereich)}${e.datensatz ? ` „${escape(e.datensatz)}“` : ""} ${AKTION[e.aktion] ?? ""}</p>${details ? `<p class="klein">${escape(details)}</p>` : ""}</div><time datetime="${escape(e.zeit)}">${new Date(e.zeit).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })}</time></li>`;
  }).join("")}</ul>`).join("")}${eintraege.length >= 300 ? `<p class="klein">Es werden die neuesten 300 Änderungen gezeigt. Grenze den Zeitraum oder die Person ein.</p>` : ""}`;
}

export async function protokoll(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/protokoll") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Änderungsprotokoll", `<p class="konto-zurueck"><a href="/konto/einstellungen" aria-label="Zurück zu den Einstellungen">←</a></p>${text}`, 0, "einstellungen"), status, f.s.cookies);
  if (f.m.rolle !== "inhaber") return antwort("<p>Das Änderungsprotokoll sehen nur Inhaber.</p>", 403);
  const wer = /^[0-9a-f-]{36}$/.test(url.searchParams.get("wer") ?? "") ? url.searchParams.get("wer")! : "";
  const bereich = BEREICHE[url.searchParams.get("bereich") ?? ""] ? url.searchParams.get("bereich")! : "";
  const tage = [7, 30, 365].includes(Number(url.searchParams.get("tage"))) ? Number(url.searchParams.get("tage")) : 30;
  const seit = new Date(Date.now() - tage * 86400_000).toISOString();
  const [r, m] = await Promise.all([
    db<Eintrag[]>(f.s, env, `aenderungsprotokoll?firma_id=eq.${f.m.firma_id}&zeit=gte.${seit}${wer ? `&user_id=eq.${wer}` : ""}${bereich ? `&bereich=eq.${bereich}` : ""}&select=id,user_id,wer,bereich,aktion,datensatz,aenderungen,zeit&order=zeit.desc&limit=300`),
    db<{ user_id: string; anzeigename: string }[]>(f.s, env, `mitglieder?firma_id=eq.${f.m.firma_id}&select=user_id,anzeigename&order=anzeigename`),
  ]);
  if (!r.ok) return antwort('<p class="fehler">Das Protokoll konnte nicht geladen werden.</p>', 502);
  const personen = (m.ok ? m.daten : []).map((x) => ({ id: x.user_id, name: x.anzeigename || "Ohne Namen" }));
  return antwort(`<p class="klein">Wer hat wann was in ${escape(f.m.firmen.name)} geändert. Nur Inhaber sehen diese Seite; Einträge werden nach 12 Monaten gelöscht.</p>${protokollSeite(r.daten, { wer, bereich, tage, personen })}`);
}
