import { escape } from "./seite.ts";
import { firmenstandorteKarte, type Firmenstandort } from "./firmenstandorte.ts";

type Fund = { website_beschreibung?: string; websuche_beschreibung?: string; website_hinweis?: string; websuche_quellen?: { titel: string; url: string }[]; firmenstandorte?: Firmenstandort[] };

/** Plain text previews remain readable; the existing edit fields stay available inside the same form. */
export function firmenInfos(v: Fund, bearbeiten = false, eigeneBeschreibung = ""): string {
  const karte = (titel: string, text: string, feld?: string, hinweis = "") => `<article class="firmen-fund">
    <h3>${escape(titel)}</h3>
    ${text ? `<p class="firmen-fund-text">${escape(text)}</p>` : `<p class="klein">Hier liegen noch keine Informationen vor.</p>`}
    ${!text && hinweis ? `<p class="klein">${escape(hinweis)}</p>` : ""}
    ${bearbeiten && feld ? `<details class="fund-bearbeiten"><summary>Text bearbeiten</summary><label>Beschreibung<textarea name="${feld}" maxlength="1500">${escape(text)}</textarea></label></details>` : ""}
  </article>`;
  const quellen = (Array.isArray(v.websuche_quellen) ? v.websuche_quellen : []).filter((q) => {
    try { const u = new URL(q.url); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
  }).slice(0, 5);
  return `<details class="firmen-erkenntnisse" open><summary>Was Jarvis über die Firma gefunden hat</summary>
    <div class="firmen-fund-karten">${eigeneBeschreibung ? karte("Deine Beschreibung", eigeneBeschreibung) : ""}${karte("Von eurer Website", v.website_beschreibung ?? "", "website_beschreibung", v.website_hinweis)}${karte("Aus öffentlichen Quellen", v.websuche_beschreibung ?? "", "websuche_beschreibung")}${firmenstandorteKarte(v.firmenstandorte)}</div>
    ${quellen.length ? `<nav class="firmen-quellen" aria-label="Quellen der Firmenrecherche"><strong>Quellen</strong><ul>${quellen.map((q) => `<li><a href="${escape(q.url)}" target="_blank" rel="noopener noreferrer">${escape(q.titel || new URL(q.url).hostname)}</a></li>`).join("")}</ul></nav>` : ""}
  </details>`;
}
