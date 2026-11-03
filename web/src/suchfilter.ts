// H2: after a 👎 ("does not fit") Crewtender offers words from the tender title to exclude with one tap. The words go into
// einstellungen.ausschluss_schnell: a pure display filter, so adding one never triggers a paid re-scoring.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape } from "./seite.ts";

/** H3: a further search profile (e.g. one per business area), stored in einstellungen.zusatzprofile. */
export type Zusatzprofil = { id: string; name: string; woerter: string[]; ausschluss: string[]; bereich_id?: string | null; min_punkte?: number; beschreibung?: string };

const STOPP = new Set(["rahmenvereinbarung", "rahmenvereinbarungen", "rahmenvertrag", "leistungen", "dienstleistungen", "dienstleistung", "erbringung",
  "vergabe", "ausschreibung", "beschaffung", "lieferung", "durchführung", "durchfuehrung", "verschiedene", "jahre", "jahren", "standort", "standorte",
  "gebäude", "gebaeude", "liegenschaft", "liegenschaften", "landkreis", "gemeinde", "verwaltung", "deutschen", "bundes", "zeitraum", "arbeiten",
  "maßnahme", "massnahme", "projekt", "objekt", "objekte", "bereich", "bereiche", "sowie", "einschließlich", "einschliesslich", "inklusive"]);
const norm = (w: string) => w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

/** Up to four distinctive words of the title that are not part of the firm's own search words. */
export function ausschlussWoerter(titel: string, eigene: string[], schon: string[] = []): string[] {
  const eigen = eigene.map(norm);
  const vorhanden = new Set(schon.map(norm));
  // Compounds also offer their first part ("hostessendienstleistungen" → "hostessen"); the search matches word starts.
  const teile = titel.split(/[^A-Za-zÄÖÜäöüß]+/).filter((w) => w.length >= 5).map((w) => w.toLowerCase())
    .flatMap((w) => { const stamm = w.replace(/(dienstleistungen|dienstleistung|leistungen|arbeiten|dienste|dienst|personal|service|services|maßnahmen|massnahmen|lieferung|lieferungen)$/, ""); return stamm !== w && stamm.length >= 7 ? [w, stamm] : [w]; });
  const kandidaten = [...new Set(teile)]
    .filter((w) => !STOPP.has(w) && !STOPP.has(norm(w)) && !vorhanden.has(norm(w)))
    // A word that contains or starts one of the firm's own search words would also hide good hits.
    .filter((w) => !eigen.some((e) => e.length >= 3 && (norm(w).includes(e) || e.includes(norm(w)))));
  return kandidaten.slice(0, 4);
}

/** Card shown after a 👎: tap a word to hide such tenders from now on. */
export function ausschlussKarte(v: { id: string; titel: string }, firma: string, eigene: string[], schon: string[], weiter: string): string {
  const woerter = ausschlussWoerter(v.titel, eigene, schon);
  if (!woerter.length) return "";
  return `<aside class="ausschluss-karte" role="status"><p><strong>👎 Danke, gespeichert.</strong> Solche Ausschreibungen künftig ausblenden? Tipp auf ein Wort:</p><div class="ausschluss-woerter">${woerter.map((w) => `<form method="post" action="/konto/suchprofil/ausschluss"><input type="hidden" name="firma" value="${firma}"><input type="hidden" name="wort" value="${escape(w)}"><input type="hidden" name="weiter" value="${escape(weiter)}"><button class="zweit">🚫 ${escape(w)}</button></form>`).join("")}</div><p class="klein">Kostet nichts extra. Unbearbeitete Treffer mit dem Wort wandern sofort ins Archiv. Rückgängig unter Suchprofil.</p></aside>`;
}

/** Summary on the search profile page: words excluded via 👎 (removable), buyers and contract value. */
export function filterUebersicht(e: { ausschluss_schnell?: string[]; auftraggeber_bevorzugt?: string[]; auftraggeber_aus?: string[]; wert_min?: number | null; wert_max?: number | null; wert_unbekannt?: boolean }, firma: string, admin: boolean): string {
  const euro = (n: number) => `${n.toLocaleString("de-DE")} €`;
  const zeilen = [
    e.auftraggeber_bevorzugt?.length ? `<li>⭐ Bevorzugt: ${e.auftraggeber_bevorzugt.map(escape).join(", ")}</li>` : "",
    e.auftraggeber_aus?.length ? `<li>🚫 Nie: ${e.auftraggeber_aus.map(escape).join(", ")}</li>` : "",
    e.wert_min || e.wert_max ? `<li>💶 Auftragswert ${e.wert_min ? `ab ${euro(e.wert_min)}` : ""}${e.wert_min && e.wert_max ? " " : ""}${e.wert_max ? `bis ${euro(e.wert_max)}` : ""}${e.wert_unbekannt === false ? ", nur mit Wertangabe" : ""}</li>` : "",
  ].join("");
  const schnell = e.ausschluss_schnell?.length ? `<div class="ausschluss-woerter">${e.ausschluss_schnell.map((w) => admin ? `<form method="post" action="/konto/suchprofil/ausschluss"><input type="hidden" name="firma" value="${firma}"><input type="hidden" name="wort" value="${escape(w)}"><input type="hidden" name="entfernen" value="1"><input type="hidden" name="weiter" value="/konto/suchprofil"><button class="zweit" aria-label="${escape(w)} wieder zulassen">${escape(w)} ✕</button></form>` : `<span class="marke">${escape(w)}</span>`).join("")}</div>` : "";
  if (!zeilen && !schnell) return "";
  return `<section class="filter-uebersicht"><h2>🎯 Filter</h2>${zeilen ? `<ul>${zeilen}</ul>` : ""}${schnell ? `<p class="klein">Per 👎 ausgeschlossen${admin ? " (✕ lässt das Wort wieder zu)" : ""}:</p>${schnell}` : ""}</section>`;
}

const liste = (x: unknown, max: number) => [...new Set(String(x ?? "").split(/[,;\n]/).map((w) => w.replace(/\s+/g, " ").trim().toLowerCase()).filter((w) => w.length >= 3 && w.length <= 60))].slice(0, max);

/** Form → further search profile; null when name or search words are missing. */
export function zusatzAusFormular(f: FormData, id: string, bereiche: { id: string }[]): Zusatzprofil | null {
  const name = String(f.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const woerter = liste(f.get("woerter"), 30);
  if (name.length < 2 || !woerter.length) return null;
  const bereich = String(f.get("bereich") ?? "");
  const punkte = Number(f.get("min_punkte"));
  return { id, name, woerter, ausschluss: liste(f.get("ausschluss"), 30), beschreibung: String(f.get("beschreibung") ?? "").trim().slice(0, 500),
    bereich_id: bereiche.some((b) => b.id === bereich) ? bereich : null, min_punkte: punkte >= 4 && punkte <= 8 ? punkte : 6 };
}

function zusatzFormular(z: Partial<Zusatzprofil>, firma: string, bereiche: { id: string; name: string }[], knopf: string): string {
  return `<form method="post" action="/konto/suchprofil/zusatz" class="zusatz-form"><input type="hidden" name="firma" value="${firma}">${z.id ? `<input type="hidden" name="id" value="${escape(z.id)}">` : ""}
<label>Name<input name="name" required maxlength="60" value="${escape(z.name ?? "")}" placeholder="z. B. Winterdienst"></label>
<label>Ergebnisse an<select name="bereich"><option value="">ganze Firma</option>${bereiche.map((b) => `<option value="${b.id}"${b.id === z.bereich_id ? " selected" : ""}>${escape(b.name)}</option>`).join("")}</select></label>
<label class="ganz">Suchwörter (mit Komma trennen)<input name="woerter" required maxlength="1500" value="${escape((z.woerter ?? []).join(", "))}" placeholder="z. B. winterdienst, schneeräumung, glättebekämpfung"></label>
<label class="ganz">Nicht anzeigen, wenn diese Wörter vorkommen<input name="ausschluss" maxlength="1500" value="${escape((z.ausschluss ?? []).join(", "))}" placeholder="optional"></label>
<label class="ganz">Kurz beschreiben, was ihr hier anbietet (hilft der KI-Bewertung)<textarea name="beschreibung" maxlength="500" rows="2">${escape(z.beschreibung ?? "")}</textarea></label>
<label>Zeigen ab<select name="min_punkte">${[4, 5, 6, 7, 8].map((n) => `<option value="${n}"${n === (z.min_punkte ?? 6) ? " selected" : ""}>${n}/10</option>`).join("")}</select></label>
<button>${knopf}</button></form>`;
}

/** H3 on the search profile page: up to three further search profiles, e.g. one per business area. */
export function zusatzBlock(liste: Zusatzprofil[], firma: string, bereiche: { id: string; name: string }[], admin: boolean): string {
  const ort = (id?: string | null) => id ? bereiche.find((b) => b.id === id)?.name ?? "" : "";
  const karten = liste.map((z) => `<li class="zusatz-profil"><div><strong>🔎 ${escape(z.name)}</strong><span class="klein">${escape(z.woerter.slice(0, 6).join(", "))}${z.woerter.length > 6 ? " …" : ""} · ab ${z.min_punkte ?? 6}/10${ort(z.bereich_id) ? ` · an ${escape(ort(z.bereich_id))}` : ""}</span></div>${admin ? `<details class="datei-menue"><summary aria-label="${escape(z.name)} bearbeiten">⋯</summary><div class="datei-menue-inhalt">${zusatzFormular(z, firma, bereiche, "Speichern")}<form method="post" action="/konto/suchprofil/zusatz"><input type="hidden" name="firma" value="${firma}"><input type="hidden" name="loeschen" value="${escape(z.id)}"><button class="zweit gefahr">Suchprofil löschen</button></form></div></details>` : ""}</li>`).join("");
  return `<section class="zusatz-profile"><h2>🗂️ Weitere Suchprofile</h2><p class="klein">Für weitere Geschäftsbereiche mit eigenen Suchwörtern, z. B. „Winterdienst“ neben der Gebäudereinigung. Suchgebiet und Filter gelten wie oben; Treffer erscheinen bei euren Ausschreibungen${bereiche.length ? " und auf Wunsch direkt beim gewählten Bereich" : ""}.</p>${liste.length ? `<ul class="zusatz-liste">${karten}</ul>` : ""}${admin && liste.length < 3 ? `<details class="upload-neu"><summary>➕ Suchprofil hinzufügen</summary>${zusatzFormular({}, firma, bereiche, "Suchprofil speichern")}<p class="klein">💡 Jedes weitere Profil lässt die KI beim ersten Suchlauf die passenden Ausschreibungen einmal bewerten (etwa 0,50–1 €), danach nur neue. Steckbriefe bleiben bei 4 pro Tag für die ganze Firma.</p></details>` : ""}${!liste.length && !admin ? `<p class="klein">Noch keine weiteren Suchprofile.</p>` : ""}</section>`;
}

export async function suchfilter(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/konto/suchprofil/zusatz" && request.method === "POST") return zusatzSpeichern(request, env);
  if (url.pathname !== "/konto/suchprofil/ausschluss" || request.method !== "POST") return null;
  const form = await request.formData();
  const f = await aktiveFirma(request, env, String(form.get("firma") ?? ""));
  if (!f) return weiterleiten("/konto");
  const roh = String(form.get("weiter") ?? "");
  const weiter = /^\/konto\/(treffer|suchprofil|vorgang\/[0-9a-f-]{36})(\?[^\r\n]*)?$/.test(roh) ? roh.replace(/([?&])vorschlag=[^&]*&?/, "$1").replace(/[?&]$/, "") : "/konto/suchprofil";
  const mit = (text: string) => `${weiter}${weiter.includes("?") ? "&" : "?"}hinweis=${encodeURIComponent(text)}`;
  if (!f.admin) return weiterleiten(mit("Nur Inhaber und Administration können das Suchprofil ändern."), f.s.cookies);
  const wort = String(form.get("wort") ?? "").trim().toLowerCase().slice(0, 60);
  const entfernen = form.get("entfernen") === "1";
  const r = await db(f.s, env, "rpc/suchprofil_ausschluss", { method: "POST", body: JSON.stringify({ f: f.m.firma_id, wort, entfernen }) });
  if (!r.ok) return weiterleiten(mit("Das Wort konnte nicht übernommen werden (höchstens 40)."), f.s.cookies);
  if (entfernen) return weiterleiten(mit(`„${wort}“ ist wieder zugelassen. Wirkt ab dem nächsten Suchlauf.`), f.s.cookies);
  // Untouched hits whose title contains the word go to the archive right away (the next run would do the same).
  const weg = await db<{ id: string }[]>(f.s, env, `vorgaenge?firma_id=eq.${f.m.firma_id}&status=eq.neu&titel=ilike.${encodeURIComponent(`*${wort.replace(/[*,()]/g, "")}*`)}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "verworfen" }) });
  const n = weg.ok ? weg.daten.length : 0;
  return weiterleiten(mit(`„${wort}“ wird künftig ausgeblendet.${n ? ` ${n} ${n === 1 ? "unbearbeiteter Treffer" : "unbearbeitete Treffer"} ins Archiv verschoben.` : ""}`), f.s.cookies);
}

async function zusatzSpeichern(request: Request, env: KontoEnv): Promise<Response> {
  const form = await request.formData();
  const f = await aktiveFirma(request, env, String(form.get("firma") ?? ""));
  if (!f) return weiterleiten("/konto");
  const zurueck = (text: string) => weiterleiten(`/konto/suchprofil?hinweis=${encodeURIComponent(text)}#weitere`, f.s.cookies);
  if (!f.admin) return zurueck("Nur Inhaber und Administration können Suchprofile ändern.");
  const [p, b] = await Promise.all([
    db<{ zusatzprofile?: Zusatzprofil[] | null }[]>(f.s, env, `suchprofile?firma_id=eq.${f.m.firma_id}&bereich_id=is.null&select=zusatzprofile:einstellungen->zusatzprofile&limit=1`),
    db<{ id: string }[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id`),
  ]);
  if (!p.ok || !p.daten[0]) return zurueck("Bitte zuerst das Haupt-Suchprofil einrichten.");
  let liste = Array.isArray(p.daten[0].zusatzprofile) ? p.daten[0].zusatzprofile : [];
  const weg = String(form.get("loeschen") ?? "");
  let text: string;
  if (weg) {
    liste = liste.filter((z) => z.id !== weg);
    text = "Suchprofil gelöscht. Bisherige Treffer bleiben erhalten.";
  } else {
    const id = /^[0-9a-f-]{36}$/.test(String(form.get("id") ?? "")) ? String(form.get("id")) : crypto.randomUUID();
    const z = zusatzAusFormular(form, id, b.ok ? b.daten : []);
    if (!z) return zurueck("Bitte einen Namen und mindestens ein Suchwort (ab 3 Buchstaben) eintragen.");
    if (!liste.some((x) => x.id === id) && liste.length >= 3) return zurueck("Es sind höchstens 3 weitere Suchprofile möglich.");
    liste = liste.some((x) => x.id === id) ? liste.map((x) => (x.id === id ? z : x)) : [...liste, z];
    text = `Suchprofil „${z.name}“ gespeichert. Es gilt ab dem nächsten Suchlauf.`;
  }
  const r = await db(f.s, env, "rpc/suchprofil_zusatz", { method: "POST", body: JSON.stringify({ f: f.m.firma_id, profile: liste }) });
  return zurueck(r.ok ? text : "Das Suchprofil konnte nicht gespeichert werden.");
}
