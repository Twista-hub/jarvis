// T14: Fahrzeuge & Geräte. Vehicles, machines and devices with the next inspection (TÜV, UVV, DGUV V3 …), warnings
// before it is due; the list also counts as technical equipment in the suitability declaration.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Betriebsmittel = { id: string; art: string; bezeichnung: string; kennung: string; pruefart: string; naechste_pruefung: string | null; notiz: string; bereich_id: string | null };
export const ARTEN: Record<string, [string, string]> = { fahrzeug: ["🚐", "Fahrzeuge"], maschine: ["🏗️", "Maschinen"], geraet: ["🔌", "Geräte"], werkzeug: ["🔧", "Werkzeug"], sonstiges: ["📦", "Sonstiges"] };
export const PRUEFARTEN = ["HU/AU (TÜV)", "UVV-Prüfung", "DGUV V3 (Elektro)", "Leiterprüfung", "Hebebühne", "Feuerlöscher", "Wartung"];
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const pruefStufe = (b: Pick<Betriebsmittel, "naechste_pruefung">, heute: string) => !b.naechste_pruefung ? "offen" : b.naechste_pruefung < heute ? "rot" : b.naechste_pruefung <= plusTage(heute, 30) ? "gelb" : "gruen";

/** "3 Fahrzeuge, 2 Maschinen" for the suitability declaration. */
const EINZAHL: Record<string, string> = { fahrzeug: "Fahrzeug", maschine: "Maschine", geraet: "Gerät", werkzeug: "Werkzeug", sonstiges: "Sonstiges" };
export const ausstattungText = (liste: Pick<Betriebsmittel, "art">[]) => Object.entries(ARTEN).map(([k, [, t]]) => { const n = liste.filter((b) => b.art === k).length; return n ? `${n} ${n === 1 ? EINZAHL[k] : t}` : ""; }).filter(Boolean).join(", ");

export function betriebsmittelSeite(liste: Betriebsmittel[], o: { heute: string; darfAendern: boolean }): string {
  const gruppen = Object.entries(ARTEN).map(([k, [i, t]]) => [k, i, t, liste.filter((b) => b.art === k).sort((a, b) => (a.naechste_pruefung ?? "9").localeCompare(b.naechste_pruefung ?? "9"))] as const).filter(([, , , l]) => l.length);
  const faellig = liste.filter((b) => ["rot", "gelb"].includes(pruefStufe(b, o.heute))).length;
  const zeile = (b: Betriebsmittel) => { const st = pruefStufe(b, o.heute); return `<li class="${st === "rot" ? "abgelaufen" : st === "gelb" ? "bald" : ""}"><div><strong>${escape(b.bezeichnung)}</strong>${b.kennung ? ` <span class="klein">${escape(b.kennung)}</span>` : ""}<span class="klein">${b.naechste_pruefung ? `${st === "rot" ? "⚠️ fällig seit" : st === "gelb" ? "⏳ fällig" : "nächste Prüfung"} ${datum(b.naechste_pruefung)}${b.pruefart ? ` (${escape(b.pruefart)})` : ""}` : "ohne Prüftermin"}${b.notiz ? ` · ${escape(b.notiz)}` : ""}</span></div>${o.darfAendern ? `<form method="post" action="/konto/betriebsmittel"><input type="hidden" name="loeschen" value="${b.id}"><button class="zweit" aria-label="Löschen">✕</button></form>` : ""}</li>`; };
  const form = o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Fahrzeug oder Gerät</summary><form method="post" action="/konto/betriebsmittel"><div class="aueg-form">
<label>Art<select name="art">${Object.entries(ARTEN).map(([k, [i]]) => `<option value="${k}">${i} ${EINZAHL[k]}</option>`).join("")}</select></label><label>Kennzeichen / Inventar-Nr.<input name="kennung" maxlength="60"></label>
<label class="ganz">Bezeichnung<input name="bezeichnung" required maxlength="200" placeholder="z. B. VW Crafter, Hubsteiger, Scheuersaugmaschine"></label>
<label>Prüfung<input name="pruefart" maxlength="60" list="pruefarten"></label><datalist id="pruefarten">${PRUEFARTEN.map((p) => `<option value="${p}">`).join("")}</datalist><label>Nächste Prüfung<input type="date" name="naechste_pruefung"></label>
<label class="ganz">Notiz<input name="notiz" maxlength="500"></label></div><button>Speichern</button></form></details>` : "";
  return `<p class="klein">Fuhrpark, Maschinen und prüfpflichtige Geräte mit dem nächsten Prüftermin. Crewtender warnt 30 Tage vorher; die Ausstattung steht auch in der Eigenerklärung.</p>
${liste.length ? `<p class="${faellig ? "hinweis" : "klein"}">${faellig ? `⚠️ ${faellig} ${faellig === 1 ? "Prüfung" : "Prüfungen"} fällig oder bald fällig` : `✅ Alle Prüfungen aktuell · ${liste.length} Einträge`}</p>${gruppen.map(([, i, t, l]) => `<h2>${i} ${t} <span class="klein">${l.length}</span></h2><ul class="kontakt-liste zert-liste">${l.map(zeile).join("")}</ul>`).join("")}` : `<p class="treffer-leer">Noch nichts eingetragen.</p>`}${form}`;
}

export async function betriebsmittel(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/betriebsmittel") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Fahrzeuge & Geräte", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/betriebsmittel?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter, Standortleitungen und Admins.");
    const loeschen = String(form.get("loeschen") ?? "");
    if (/^[0-9a-f-]{36}$/.test(loeschen)) { const r = await db(f.s, env, `betriebsmittel?id=eq.${loeschen}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck(r.ok ? "Gelöscht." : "Löschen hat nicht geklappt."); }
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const d = t("naechste_pruefung", 10);
    const zeile = { firma_id: firma, art: t("art", 20) in ARTEN ? t("art", 20) : "geraet", bezeichnung: t("bezeichnung", 200), kennung: t("kennung", 60), pruefart: t("pruefart", 60), naechste_pruefung: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null, notiz: t("notiz", 500) };
    if (zeile.bezeichnung.length < 2) return zurueck("Bitte eine Bezeichnung angeben.");
    const r = await db(f.s, env, "betriebsmittel", { method: "POST", body: JSON.stringify(zeile) });
    return zurueck(r.ok ? "Gespeichert." : "Speichern hat nicht geklappt.");
  }
  const r = await db<Betriebsmittel[]>(f.s, env, `betriebsmittel?firma_id=eq.${firma}&select=id,art,bezeichnung,kennung,pruefart,naechste_pruefung,notiz,bereich_id&limit=1000`);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${betriebsmittelSeite(r.ok ? r.daten : [], { heute, darfAendern })}`);
}
