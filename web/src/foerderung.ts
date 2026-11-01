// N2: funding programmes from the Förderdatenbank des Bundes, checked every morning against the firm's profile.
// Licence CC BY-ND 4.0 DE: only the original title and link plus Jarvis' own assessment, never a changed text.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type FoerderStand = "neu" | "gemerkt" | "erledigt" | "ausgeblendet";
export type Foerderung = {
  programm_id: string; punkte: number; grund: string; bewertet: string; stand: FoerderStand;
  foerderprogramme: { titel: string; link: string; veroeffentlicht: string | null } | null;
};
export const PASSEND_AB = 6;
export const QUELLE = `Quelle: <a href="https://www.foerderdatenbank.de" target="_blank" rel="noopener">Förderdatenbank des Bundes</a>, Lizenz <a href="https://creativecommons.org/licenses/by-nd/4.0/deed.de" target="_blank" rel="noopener">CC BY-ND 4.0 DE</a>. Titel unverändert; die Einschätzung stammt von Jarvis.`;

const ANSICHTEN = [["passend", "Passend"], ["gemerkt", "⭐ Gemerkt"], ["alle", "Alle"], ["ausgeblendet", "Ausgeblendet"]] as const;
type Ansicht = (typeof ANSICHTEN)[number][0];

export function filtern(liste: Foerderung[], ansicht: Ansicht): Foerderung[] {
  const sichtbar = liste.filter((f) => f.foerderprogramme);
  if (ansicht === "gemerkt") return sichtbar.filter((f) => f.stand === "gemerkt");
  if (ansicht === "ausgeblendet") return sichtbar.filter((f) => ["ausgeblendet", "erledigt"].includes(f.stand));
  if (ansicht === "alle") return sichtbar.filter((f) => f.stand !== "ausgeblendet");
  return sichtbar.filter((f) => ["neu", "gemerkt"].includes(f.stand) && f.punkte >= PASSEND_AB);
}

/** New suitable programmes for the overview tile (not yet marked, last 14 days). */
export function neuePassende(liste: Pick<Foerderung, "punkte" | "stand" | "bewertet">[], jetzt = Date.now()): number {
  return liste.filter((f) => f.stand === "neu" && f.punkte >= PASSEND_AB && jetzt - Date.parse(f.bewertet) < 14 * 86400_000).length;
}

const datum = (d: string | null) => d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "";

export function foerderSeite(liste: Foerderung[], o: { ansicht: string; darfAendern: boolean }): string {
  const ansicht: Ansicht = ANSICHTEN.some(([k]) => k === o.ansicht) ? o.ansicht as Ansicht : "passend";
  const zahl = (a: Ansicht) => filtern(liste, a).length;
  const chips = `<nav class="ordner-chips" aria-label="Ansicht">${ANSICHTEN.filter(([k]) => k === "passend" || k === "alle" || zahl(k)).map(([k, t]) => `<a href="/konto/foerderung${k === "passend" ? "" : `?ansicht=${k}`}"${k === ansicht ? ' aria-current="true"' : ""}>${t} <span>${zahl(k)}</span></a>`).join("")}</nav>`;
  const gezeigt = filtern(liste, ansicht).sort((a, b) => (b.stand === "gemerkt" ? 1 : 0) - (a.stand === "gemerkt" ? 1 : 0) || b.punkte - a.punkte || b.bewertet.localeCompare(a.bewertet));
  const knopf = (f: Foerderung, stand: FoerderStand, text: string) => `<form method="post" action="/konto/foerderung"><input type="hidden" name="id" value="${escape(f.programm_id)}"><input type="hidden" name="weiter" value="${ansicht}"><button name="stand" value="${stand}" class="zweit">${text}</button></form>`;
  const zeile = (f: Foerderung) => {
    const p = f.foerderprogramme!;
    const aktionen = !o.darfAendern ? "" : `<div class="foerder-aktionen">${f.stand === "gemerkt" ? knopf(f, "neu", "⭐ Gemerkt") : knopf(f, "gemerkt", "☆ Merken")}${["erledigt", "ausgeblendet"].includes(f.stand) ? knopf(f, "neu", "↩︎ Zurückholen") : `${knopf(f, "erledigt", "✓ Beantragt")}${knopf(f, "ausgeblendet", "Ausblenden")}`}</div>`;
    return `<li class="foerder-zeile${f.punkte >= 8 ? " stark" : f.punkte < PASSEND_AB ? " schwach" : ""}"><span class="foerder-punkte" title="Passung">${f.punkte}/10</span><div class="foerder-text"><a href="${escape(p.link)}" target="_blank" rel="noopener"><strong>${escape(p.titel)}</strong></a><span class="klein">🤖 ${escape(f.grund || "Ohne Begründung.")}</span><span class="klein">${p.veroeffentlicht ? `neu seit ${datum(p.veroeffentlicht)}` : `geprüft ${datum(f.bewertet)}`}${f.stand === "erledigt" ? " · ✓ beantragt" : ""}</span></div>${aktionen}</li>`;
  };
  const leer = !liste.length ? "Noch keine Förderprogramme geprüft. Jarvis prüft jeden Morgen die neuen Programme der Förderdatenbank des Bundes gegen dein Suchprofil."
    : ansicht === "passend" ? `Gerade kein neues Programm mit mindestens ${PASSEND_AB}/10. Unter „Alle“ stehen auch die schwächeren.` : "Hier ist gerade nichts.";
  return `<p class="klein">Jeden Morgen prüft Jarvis die neuen Programme der Förderdatenbank des Bundes gegen dein Suchprofil. Ab ${PASSEND_AB}/10 gilt ein Programm als passend.</p>${chips}${gezeigt.length ? `<ul class="foerder-liste">${gezeigt.map(zeile).join("")}</ul>` : `<p class="treffer-leer">${leer}</p>`}<p class="klein">Ob deine Firma antragsberechtigt ist, entscheidet der Fördergeber. Die Einschätzung ersetzt keine Beratung. ${QUELLE}</p>`;
}

export async function foerderLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Foerderung[]> {
  const r = await db<Foerderung[]>(s, env, `foerder_bewertungen?firma_id=eq.${firma}&select=programm_id,punkte,grund,bewertet,stand,foerderprogramme(titel,link,veroeffentlicht)&order=bewertet.desc&limit=400`);
  return r.ok ? r.daten : [];
}

export async function foerderung(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/foerderung") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Förderprogramme", text, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Förderprogramme sieht das Büroteam.</p>", 403);
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const id = String(form.get("id") ?? "").slice(0, 600), stand = String(form.get("stand") ?? "");
    const weiter = String(form.get("weiter") ?? "");
    const ziel = (h: string) => weiterleiten(`/konto/foerderung?${ANSICHTEN.some(([k]) => k === weiter) && weiter !== "passend" ? `ansicht=${weiter}&` : ""}hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern || !id || !["neu", "gemerkt", "erledigt", "ausgeblendet"].includes(stand)) return ziel("Das ging nicht.");
    const r = await db(f.s, env, `foerder_bewertungen?firma_id=eq.${f.m.firma_id}&programm_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ stand }) });
    return ziel(!r.ok ? "Speichern hat nicht geklappt." : ({ gemerkt: "Gemerkt.", erledigt: "Als beantragt markiert.", ausgeblendet: "Ausgeblendet.", neu: "Zurückgeholt." } as Record<string, string>)[stand]);
  }
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${foerderSeite(await foerderLaden(f.s, env, f.m.firma_id), { ansicht: url.searchParams.get("ansicht") ?? "", darfAendern })}`);
}
