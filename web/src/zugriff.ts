// Safe rights for the boss: area and access must be chosen on purpose, "?" pop-ups explain each choice, and before an
// invitation or a change of rights a confirmation page lists in plain words what the person can and cannot do.
import { escape } from "./seite.ts";
import { RECHTE, ROLLEN_TEXT } from "./organisation.ts";
import { ZUGRIFFE } from "./rechte.ts";

/** "?" button (goes inside a label) and its pop-up (goes outside of labels, e.g. at the end of the form). */
export function frage(id: string, titel: string, text: string): { knopf: string; popup: string } {
  return {
    knopf: `<button type="button" class="frage-mini kreis" popovertarget="${id}" aria-label="${escape(titel)}" title="${escape(titel)}">?</button>`,
    popup: `<div id="${id}" popover class="frage-popup"><p><strong>${escape(titel)}</strong></p>${text}<div class="knopf-zeile"><button type="button" class="zweit" popovertarget="${id}" popovertargetaction="hide">Schließen</button></div></div>`,
  };
}

export const HILFE_ZUGRIFF = `<p>Wähle, wie viel die Person sehen darf. Im Zweifel die kleinere Stufe; mehr freigeben geht jederzeit.</p><ul class="frage-liste">
<li><strong>Nur persönlich freigegebene Informationen (Einsatzkraft):</strong> sieht keine Ausschreibungen und Fristen, nur was du ihr einzeln freigibst, und ihre eigenen Schichten, Stunden, Urlaub, Spesen.</li>
<li><strong>Vollständige Steckbriefe lesen (Leser):</strong> sieht Ausschreibungen und Fristen im gewählten Bereich, kann nichts ändern.</li>
<li><strong>Vollständige Steckbriefe bearbeiten (Bearbeiter):</strong> sieht und bearbeitet Ausschreibungen, Personal und Einsätze im gewählten Bereich, bereitet Angebote vor. Freigeben kann nur der Chef.</li>
<li><strong>Standortleitung:</strong> wie Bearbeiter, aber nur an genau einem Standort und ohne Kalkulation.</li>
<li><strong>Administration:</strong> sieht und darf alles wie der Inhaber (außer Änderungsprotokoll), auch Zugänge und Suchprofil. Nur für enge Vertraute.</li></ul>`;
export const HILFE_BEREICH = `<p>Bestimmt, welche Ausschreibungen, Fristen und welches Personal die Person sieht.</p><ul class="frage-liste">
<li><strong>Ein Standort:</strong> nur dieser Standort und die Teams darunter.</li>
<li><strong>Ganze Firma:</strong> alles, an allen Standorten. Bitte nur wählen, wenn die Person wirklich alles sehen soll.</li></ul>
<p>Für Inhaber und Administration spielt der Bereich keine Rolle, sie sehen immer alles.</p>`;
export const HILFE_FINANZEN = `<p>Gibt zusätzlich Kalkulation, Preise, Umsatz, Firmenunterlagen und Angebotsmappen frei. Gilt nur für Leser und Bearbeiter. Ohne Haken sehen sie keine Zahlen.</p><p>Inhaber und Administration sehen Finanzen immer; Standortleitung und Einsatzkräfte nie.</p>`;

/** What a role can and cannot do, in words (from the rights table), for the chosen area and finance switch. */
export function zusammenfassung(rolle: string, bereich: string, finanzen: boolean): string {
  const kann: string[] = [], nicht: string[] = [];
  for (const [was, w] of RECHTE) {
    const z = w[rolle] ?? "–";
    if (z === "✅") kann.push(`${was} (ganze Firma)`);
    else if (z === "📍") kann.push(`${was} (${bereich})`);
    else if (z === "💶") (finanzen ? kann : nicht).push(finanzen ? `${was} (Finanzen freigegeben)` : `${was} (keine Finanzfreigabe)`);
    else if (z === "👁️") kann.push(`${was}: nur ansehen (${bereich})`);
    else if (z === "🔗") kann.push(`${was}: nur einzeln freigegebene`);
    else if (z === "🙋") kann.push(`${was}: nur die eigenen Daten`);
    else nicht.push(was);
  }
  return `<div class="zugriff-zusammenfassung"><p><strong>Kann:</strong></p><ul class="ja">${kann.map((k) => `<li>✅ ${escape(k)}</li>`).join("")}</ul>${nicht.length ? `<p><strong>Kann nicht:</strong></p><ul class="nein">${nicht.map((k) => `<li>🚫 ${escape(k)}</li>`).join("")}</ul>` : ""}</div>`;
}

/** Confirmation page: repeats every form field hidden and asks once more. */
export function bestaetigung(o: { action: string; form: FormData; titel: string; zeilen: [string, string][]; rolle: string; bereich: string; finanzen: boolean; zurueck: string; knopf: string }): string {
  const versteckt = [...o.form.entries()].filter(([k, v]) => k !== "bestaetigt" && typeof v === "string").map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(String(v))}">`).join("");
  const warnung = o.rolle === "admin" ? `<p class="hinweis">⚠️ Administration sieht und darf fast alles, auch Zugänge, Suchprofil und alle Zahlen.</p>` : o.bereich === "ganze Firma" && ["bearbeiter", "leser"].includes(o.rolle) ? `<p class="hinweis">⚠️ Ganze Firma: Die Person sieht alle Ausschreibungen, Fristen und das Personal an allen Standorten.</p>` : "";
  return `<p class="konto-zurueck"><a href="${escape(o.zurueck)}" aria-label="Zurück">←</a></p><p>Bitte prüfen, bevor du ${escape(o.titel)}:</p>
<table class="auswertung-tabelle zugriff-tabelle"><tbody>${o.zeilen.map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join("")}<tr><th>Zugriff</th><td>${escape(ZUGRIFFE[o.rolle] ?? ROLLEN_TEXT[o.rolle] ?? o.rolle)}</td></tr><tr><th>Bereich</th><td>${escape(["inhaber", "admin"].includes(o.rolle) ? "ganze Firma (immer bei dieser Stufe)" : o.bereich)}</td></tr><tr><th>Finanzen</th><td>${["inhaber", "admin"].includes(o.rolle) ? "ja (immer bei dieser Stufe)" : o.finanzen && ["bearbeiter", "leser"].includes(o.rolle) ? "ja" : "nein"}</td></tr></tbody></table>
${warnung}${zusammenfassung(o.rolle, ["inhaber", "admin"].includes(o.rolle) ? "ganze Firma" : o.bereich, ["inhaber", "admin"].includes(o.rolle) || (o.finanzen && ["bearbeiter", "leser"].includes(o.rolle)))}
<form method="post" action="${escape(o.action)}">${versteckt}<input type="hidden" name="bestaetigt" value="1"><div class="knopf-zeile"><button>${escape(o.knopf)}</button><a class="knopf zweit" href="${escape(o.zurueck)}">Ändern</a></div></form>`;
}
