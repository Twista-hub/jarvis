import { escape } from "./seite.ts";
import type { Leistung } from "./einrichtung.ts";

export const MAX_ARBEITEN = 12;

// Explicitly chosen additions; these suggestions do not infer services for a firm.
const VORSCHLAEGE: Record<string, [string, string[]][]> = {
  "Bau & Handwerk": [
    ["Fliesenarbeiten", ["fliesen", "fliesenarbeiten", "fliesenverlegung"]],
    ["Mosaikarbeiten", ["mosaik", "mosaikarbeiten"]],
    ["Natursteinarbeiten", ["naturstein", "natursteinarbeiten"]],
    ["Malerarbeiten", ["malerarbeiten", "anstrich", "lackierarbeiten"]],
    ["Elektroinstallation", ["elektroinstallation", "elektroarbeiten"]],
    ["Sanitärarbeiten", ["sanitär", "sanitaer", "sanitärinstallation"]],
    ["Heizungsarbeiten", ["heizung", "heizungsarbeiten"]],
    ["Trockenbau", ["trockenbau", "innenausbau"]],
    ["Dacharbeiten", ["dacharbeiten", "dachdecker", "dachsanierung"]],
    ["Tischlerarbeiten", ["tischlerarbeiten", "schreinerarbeiten"]],
    ["Garten- und Landschaftsbau", ["landschaftsbau", "gartenbau", "grünpflege"]],
  ],
  "Dienstleistungen": [
    ["Gebäudereinigung", ["gebäudereinigung", "unterhaltsreinigung", "glasreinigung"]],
    ["Hausmeisterdienst", ["hausmeister", "objektbetreuung"]],
    ["Sicherheitsdienst", ["sicherheitsdienst", "bewachung", "objektschutz"]],
    ["Catering", ["catering", "verpflegung", "speisenversorgung"]],
    ["Transport und Logistik", ["transport", "logistik", "spedition"]],
    ["Arbeitnehmerüberlassung", ["arbeitnehmerüberlassung", "zeitarbeit", "leihpersonal"]],
  ],
  "Büro, IT & Betreuung": [
    ["Büroservice", ["büroservice", "bürodienstleistung", "sachbearbeitung"]],
    ["IT-Support", ["it-support", "it-betreuung", "helpdesk"]],
    ["Softwareentwicklung", ["softwareentwicklung", "programmierung"]],
    ["Pflegeleistungen", ["pflegeleistungen", "pflegepersonal"]],
    ["Betreuung", ["betreuung", "betreuungsleistungen"]],
    ["Schulungen", ["schulung", "weiterbildung", "seminare"]],
  ],
};

export function arbeitAusName(name: string): Leistung {
  const text = name.trim().slice(0, 120);
  const stop = new Set(["und", "oder", "für", "von", "der", "die", "das", "mit"]);
  const woerter = [...new Set([text.toLocaleLowerCase("de"), ...text.toLocaleLowerCase("de").split(/[^a-zäöüß0-9-]+/)].filter((w) => w.length >= 3 && w.length <= 60 && !stop.has(w)))];
  return { name: text, cpv: [], woerter };
}

function zeile(l: Leistung, index: string): string {
  const liste = (werte: string[]) => escape(werte.join(", "));
  return `<fieldset data-arbeit-zeile data-arbeit-index="${index}">
    <label class="zeile" data-arbeit-aktiv-label><input data-arbeit-aktiv type="checkbox" name="l${index}_an" value="1"${l.name ? " checked" : ""}>${l.name ? `${escape(l.name)} suchen` : "Weitere Arbeit hinzufügen"}</label>
    <details data-arbeit-editor><summary>Arbeit und Suchbegriffe ändern</summary>
      <label>Beruf oder Arbeit<input data-arbeit-name name="l${index}_name" maxlength="120" placeholder="z. B. Fliesen verlegen" value="${escape(l.name)}"></label>
      <label>Suchwörter<input data-arbeit-woerter name="l${index}_woerter" maxlength="1000" value="${liste(l.woerter)}"></label>
      <label>Vergabe-Kennziffern (CPV, optional)<input data-arbeit-cpv name="l${index}_cpv" maxlength="300" inputmode="numeric" value="${liste(l.cpv)}"></label>
    </details>
  </fieldset>`;
}

export function arbeitsAuswahl(leistungen: Leistung[]): string {
  const option = (l: Leistung, wert: string) => `<option value="${wert}" data-arbeit-name="${escape(l.name)}" data-arbeit-woerter="${escape(l.woerter.join(", "))}" data-arbeit-cpv="${escape(l.cpv.join(", "))}">${escape(l.name)}</option>`;
  const vorhanden = new Set(leistungen.map((l) => l.name.toLocaleLowerCase("de")));
  const blank: Leistung = { name: "", cpv: [], woerter: [] };
  return `<section class="arbeitsauswahl" data-arbeitsauswahl aria-label="Gesuchte Arbeiten">
    <ul class="arbeits-chips" data-arbeit-chips aria-label="Ausgewählte Arbeiten" hidden></ul>
    <div data-arbeit-auswahl hidden><label>Arbeit hinzufügen<select data-arbeit-dropdown>
      <option value="">Arbeit auswählen …</option>
      <optgroup label="Eure Arbeiten" data-arbeit-optionen>${leistungen.map((l, i) => option(l, `firma-${i}`)).join("")}</optgroup>
      ${Object.entries(VORSCHLAEGE).map(([gruppe, arbeiten], g) => `<optgroup label="${escape(gruppe)}">${arbeiten.filter(([name]) => !vorhanden.has(name.toLocaleLowerCase("de"))).map(([name, woerter], i) => option({ name, woerter, cpv: [] }, `vorschlag-${g}-${i}`)).join("")}</optgroup>`).join("")}
      <option value="__eigen">Eigene Arbeit eingeben …</option>
    </select></label></div>
    <div class="eigene-arbeit" data-arbeit-eigene hidden><label>Welche Arbeit?<input data-arbeit-eigener-name maxlength="120" placeholder="z. B. Küchenrückwände montieren"></label><button type="button" data-arbeit-eigene-anlegen>Hinzufügen</button></div>
    <p class="klein" data-arbeit-status role="status" aria-live="polite" hidden></p>
    <div class="arbeits-editor" data-arbeit-felder>${[...leistungen, blank].map((l, i) => zeile(l, String(i))).join("")}</div>
    <button type="button" class="zweit" data-arbeit-fertig hidden>Fertig</button>
    <template data-arbeit-vorlage>${zeile(blank, "__INDEX__")}</template>
  </section>`;
}
