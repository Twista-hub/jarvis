// T9 Organigramm and T10 Rechte-Übersicht: the firm's structure as a tree (management, locations, departments,
// teams with their lead, contact and staff count) and a table of who may see and change what.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Mitglied = { user_id: string; rolle: string; anzeigename: string | null; funktion: string | null; aktiv: boolean; finanzen: boolean; alle_bereiche: boolean };
export type Zuordnung = { user_id: string; bereich_id: string };
const ART: Record<string, string> = { standort: "📍", abteilung: "🗂️", team: "👥" };
export const ROLLEN_TEXT: Record<string, string> = { inhaber: "Inhaber", admin: "Admin", bearbeiter: "Bearbeiter", standortleitung: "Standortleitung", leser: "Leser", mitarbeiter: "Einsatzkraft" };
const name = (m: Mitglied) => m.anzeigename || m.funktion || "Ohne Namen";

/** Tree of the areas below a parent with lead, contact and number of staff (incl. the areas below). */
export function organigramm(firma: string, bereiche: Bereich[], mitglieder: Mitglied[], zuordnungen: Zuordnung[], personal: { bereich_id: string | null }[]): string {
  const aktive = mitglieder.filter((m) => m.aktiv);
  const kinder = (id: string | null) => bereiche.filter((b) => b.parent_id === id).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const unter = (id: string): string[] => [id, ...kinder(id).flatMap((k) => unter(k.id))];
  const zahl = (id: string) => { const ids = unter(id); return personal.filter((p) => p.bereich_id && ids.includes(p.bereich_id)).length; };
  const leitung = (id: string) => aktive.filter((m) => m.rolle === "standortleitung" && zuordnungen.some((z) => z.user_id === m.user_id && z.bereich_id === id));
  const knoten = (b: Bereich): string => {
    const l = leitung(b.id), k = kinder(b.id), n = zahl(b.id);
    return `<li><div class="org-knoten org-${escape(b.art)}"><strong>${ART[b.art] ?? "📍"} <a href="/konto/standort/${b.id}">${escape(b.name)}</a></strong>${l.length ? `<span class="klein">👤 ${l.map((m) => escape(name(m))).join(", ")}</span>` : `<span class="klein org-fehlt">ohne Leitung</span>`}${b.ansprechpartner ? `<span class="klein">☎️ ${escape(b.ansprechpartner)}${b.telefon ? `, ${escape(b.telefon)}` : ""}</span>` : ""}<span class="klein">${n} ${n === 1 ? "Person" : "Personen"}</span></div>${k.length ? `<ul>${k.map(knoten).join("")}</ul>` : ""}</li>`;
  };
  const chefs = aktive.filter((m) => ["inhaber", "admin"].includes(m.rolle));
  const ohne = personal.filter((p) => !p.bereich_id).length;
  return `<div class="org-baum"><ul><li><div class="org-knoten org-firma"><strong>🏢 ${escape(firma)}</strong><span class="klein">${chefs.map((m) => `${escape(name(m))} (${ROLLEN_TEXT[m.rolle]})`).join(" · ") || "Leitung nicht eingetragen"}</span>${ohne ? `<span class="klein">${ohne} ${ohne === 1 ? "Person" : "Personen"} ohne Standort</span>` : ""}</div>${kinder(null).length ? `<ul>${kinder(null).map(knoten).join("")}</ul>` : ""}</li></ul></div>`;
}

// T10: what each role may do (mirrors the database rules; finance access is a separate switch).
export const RECHTE: [string, Record<string, string>][] = [
  ["Ausschreibungen sehen", { inhaber: "✅", admin: "✅", bearbeiter: "📍", standortleitung: "📍", leser: "📍", mitarbeiter: "🔗" }],
  ["Ausschreibungen bearbeiten, Angebot vorbereiten", { inhaber: "✅", admin: "✅", bearbeiter: "📍", standortleitung: "📍", leser: "–", mitarbeiter: "–" }],
  ["Kalkulation, Preise, Umsatz", { inhaber: "✅", admin: "✅", bearbeiter: "💶", standortleitung: "–", leser: "💶", mitarbeiter: "–" }],
  ["Angebot freigeben (Chef-Freigabe)", { inhaber: "✅", admin: "✅", bearbeiter: "–", standortleitung: "–", leser: "–", mitarbeiter: "–" }],
  ["Personal und Einsätze pflegen", { inhaber: "✅", admin: "✅", bearbeiter: "📍", standortleitung: "📍", leser: "👁️", mitarbeiter: "🙋" }],
  ["Suchprofil ändern", { inhaber: "✅", admin: "✅", bearbeiter: "–", standortleitung: "–", leser: "–", mitarbeiter: "–" }],
  ["Firmenprofil, Zugänge, Standorte verwalten", { inhaber: "✅", admin: "✅", bearbeiter: "–", standortleitung: "–", leser: "–", mitarbeiter: "–" }],
  ["Änderungsprotokoll", { inhaber: "✅", admin: "–", bearbeiter: "–", standortleitung: "–", leser: "–", mitarbeiter: "–" }],
];
const SPALTEN = ["inhaber", "admin", "bearbeiter", "standortleitung", "leser", "mitarbeiter"];

export function rechteSeite(mitglieder: Mitglied[], zuordnungen: Zuordnung[], bereiche: Bereich[]): string {
  const matrix = `<div class="tabelle-scroll"><table class="auswertung-tabelle rechte-tabelle"><thead><tr><th>Darf …</th>${SPALTEN.map((r) => `<th class="senkrecht"><span>${ROLLEN_TEXT[r]}</span></th>`).join("")}</tr></thead><tbody>${RECHTE.map(([t, w]) => `<tr><td>${escape(t)}</td>${SPALTEN.map((r) => `<td>${escape(w[r])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
<p class="klein">✅ ganze Firma · 📍 nur zugeordnete Standorte (oder ganze Firma, wenn so eingestellt) · 💶 nur mit Finanzfreigabe · 👁️ nur ansehen · 🔗 nur persönlich freigegebene · 🙋 nur eigene Daten · – nicht erlaubt. Die Datenbank prüft diese Regeln bei jedem Zugriff.</p>`;
  const bname = (id: string) => bereiche.find((b) => b.id === id)?.name ?? "?";
  const liste = [...mitglieder].sort((a, b) => SPALTEN.indexOf(a.rolle) - SPALTEN.indexOf(b.rolle) || name(a).localeCompare(name(b), "de"));
  const personen = `<table class="auswertung-tabelle zugang-tabelle"><thead><tr><th>Person</th><th>Rolle</th><th>Bereich</th><th>💶</th></tr></thead><tbody>${liste.map((m) => `<tr${m.aktiv ? "" : ' class="gesperrt"'}><td>${escape(name(m))}${m.aktiv ? "" : " <span class=\"klein\">(gesperrt)</span>"}</td><td>${ROLLEN_TEXT[m.rolle] ?? escape(m.rolle)}</td><td>${["inhaber", "admin"].includes(m.rolle) || m.alle_bereiche ? "ganze Firma" : escape(zuordnungen.filter((z) => z.user_id === m.user_id).map((z) => bname(z.bereich_id)).join(", ") || "–")}</td><td>${["inhaber", "admin"].includes(m.rolle) || m.finanzen ? "💶" : "–"}</td></tr>`).join("")}</tbody></table>`;
  return `<h2>Was darf welche Rolle?</h2>${matrix}<h2>Wer hat welchen Zugang?</h2>${personen}<p class="klein">Rollen und Bereiche änderst du unter <a href="/konto/team#app-zugaenge">Firma &amp; Team → App-Zugänge</a>.</p>`;
}

export async function organisation(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!["/konto/organigramm", "/konto/rechte"].includes(url.pathname)) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const titel = url.pathname.endsWith("rechte") ? "Rechte-Übersicht" : "Organigramm";
  const antwort = (t: string, status = 200) => html(seite(titel, `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const [b, m, z, p] = await Promise.all([
    db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name,art,parent_id,ansprechpartner,telefon,email&order=name`),
    db<Mitglied[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,rolle,anzeigename,funktion,aktiv,finanzen,alle_bereiche`),
    db<Zuordnung[]>(f.s, env, `mitglied_bereiche?firma_id=eq.${firma}&select=user_id,bereich_id`),
    db<{ bereich_id: string | null }[]>(f.s, env, `personal?firma_id=eq.${firma}&select=bereich_id&limit=5000`),
  ]);
  if (url.pathname.endsWith("rechte")) {
    if (!f.admin) return antwort("<p>Die Rechte-Übersicht sehen Inhaber und Admins.</p>", 403);
    return antwort(rechteSeite(m.ok ? m.daten : [], z.ok ? z.daten : [], b.ok ? b.daten : []));
  }
  return antwort(`${organigramm(f.m.firmen.name, b.ok ? b.daten : [], m.ok ? m.daten : [], z.ok ? z.daten : [], p.ok ? p.daten : [])}<p class="klein">Tippe auf einen Standort, um Personal und Leitung zu sehen. Standorte legst du unter <a href="/konto/team">Firma &amp; Team</a> an.</p>`);
}
