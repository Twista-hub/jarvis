// Hit list on "Ausschreibungen": key facts on the card, the two-part rating, sorting, search and quick feedback.
import { escape } from "./seite.ts";

export type Eckdatum = { label: string; wert: string };

const ECKDATEN: [string, string][] = [["Lose", ""], ["Geschätzter Auftragswert", "Wert"], ["Laufzeit", "Laufzeit"], ["Ort", "Ort"]];

/** Key facts from the "Auf einen Blick" table of a detailed Steckbrief: lots, hours, value, term. */
function ausTabelle(steckbrief: string): Eckdatum[] {
  const zeile = (name: string) => steckbrief.match(new RegExp(`\\|\\s*\\*\\*${name}\\*\\*\\s*\\|\\s*([^|\\n]+)`))?.[1]?.trim() ?? "";
  const umfang = zeile("Umfang");
  const fakten: Eckdatum[] = [];
  const lose = umfang.match(/(\d+)\s+(?:Lose?|lots?)\b/i)?.[1];
  if (lose) fakten.push({ label: "", wert: `${lose} ${lose === "1" ? "Los" : "Lose"}` });
  const stunden = umfang.match(/(\d[\d.,\u00a0\u202f ]*?)\s*(?:Stunden|hours|heures)/i)?.[1]?.trim();
  if (stunden) fakten.push({ label: "Stunden", wert: `ca. ${stunden}` });
  const wert = umfang.match(/Auftragswert[^.;]*?([\d.,]+(?:[–-][\d.,]+)?\s*(?:Mio\.\s*)?€)/)?.[1] ?? umfang.match(/Schätzung:?\*?\*?\s*(?:ca\.\s*)?([\d.,]+(?:[–-][\d.,]+)?\s*(?:Mio\.\s*)?€)/)?.[1];
  const dollar = !wert ? umfang.match(/(?:value|amount|ceiling|estimate)[^;|]*?(\$\s?[\d.,]+(?:\s*(?:million|M|k))?)/i)?.[1] : undefined;
  if (dollar) fakten.push({ label: "Wert", wert: /estimat/i.test(umfang) ? `ca. ${dollar}` : dollar });
  // French fact sheets: "valeur estimée : 450 000 € HT", "montant maximum 1,2 M€".
  const euro = !wert && !dollar ? umfang.match(/(?:valeur|montant)[^;|]*?(\d[\d.,\u00a0\u202f ]*?(?:\s?[–-]\s?\d[\d.,\u00a0\u202f ]*?)?\s*(?:M€|k€|€|millions? d'euros))/i)?.[1] : undefined;
  if (euro) fakten.push({ label: "Wert", wert: /estim/i.test(umfang) ? `ca. ${euro}` : euro });
  if (wert) fakten.push({ label: "Wert", wert: /Schätzung/.test(umfang) && !/Auftragswert[^.;]*\d/.test(umfang) ? `ca. ${wert}` : wert });
  const laufzeit = zeile("Laufzeit").split(/[,;(]| je /)[0].trim();
  if (laufzeit && !/^(nicht angegeben|not specified|non précisé|non communiqué)/i.test(laufzeit)) fakten.push({ label: "Laufzeit", wert: laufzeit.slice(0, 40) });
  return fakten;
}

/** Key facts the short overview writes as "**Label:** value" lines (lots, estimated value, term, place). */
export function eckdaten(steckbrief?: string | null): Eckdatum[] {
  if (!steckbrief) return [];
  if (/## Auf einen Blick/.test(steckbrief)) {
    const fakten = ausTabelle(steckbrief);
    if (fakten.length) return fakten;
  }
  return ECKDATEN.flatMap(([quelle, label]) => {
    const wert = steckbrief.match(new RegExp(`\\*\\*${quelle}:\\*\\*\\s*([^\\n]+)`))?.[1]?.trim();
    if (!wert || /^nicht angegeben/i.test(wert)) return [];
    // "2 (Küche; Service)" becomes "2 Lose" on the card; the names stay in the Steckbrief.
    return [{ label, wert: quelle === "Lose" ? `${wert.split(" ")[0]} ${wert.startsWith("1 ") || wert === "1" ? "Los" : "Lose"}` : wert.slice(0, 60) }];
  });
}

/** Estimated value in euros for sorting; 0 when unknown. */
export function auftragswert(steckbrief?: string | null): number {
  const roh = steckbrief?.match(/\*\*Geschätzter Auftragswert:\*\*\s*([\d.]+)/)?.[1];
  return roh ? Number(roh.replace(/\./g, "")) || 0 : 0;
}

/** "Gesucht" and "Warum passend" from the AI rating at the top of the Steckbrief. */
export function bewertung(steckbrief?: string | null): { gesucht: string; warum: string } {
  const teil = (name: string) => steckbrief?.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([^\\n]+)`))?.[1]?.replace(/\*\*/g, "").trim().slice(0, 300) ?? "";
  return { gesucht: teil("Gesucht"), warum: teil("Warum passend") };
}

export const SORTIERUNGEN: Record<string, string> = { punkte: "Beste zuerst", frist: "Frist zuerst", wert: "Größter Auftrag", naehe: "Nächste zuerst", neu: "Neueste zuerst" };

type Sortierbar = { punkte: number | null; frist: string | null; erstellt: string; steckbrief?: string | null; entfernung_km?: number | null };

export function sortieren<T extends Sortierbar>(liste: T[], sortierung: string): T[] {
  const kopie = [...liste];
  if (sortierung === "frist") return kopie.sort((a, b) => (a.frist ?? "9999").localeCompare(b.frist ?? "9999"));
  if (sortierung === "wert") return kopie.sort((a, b) => auftragswert(b.steckbrief) - auftragswert(a.steckbrief) || (b.punkte ?? 0) - (a.punkte ?? 0));
  if (sortierung === "naehe") return kopie.sort((a, b) => (a.entfernung_km ?? 99999) - (b.entfernung_km ?? 99999) || (b.punkte ?? 0) - (a.punkte ?? 0));
  if (sortierung === "neu") return kopie.sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  return kopie.sort((a, b) => (b.punkte ?? -1) - (a.punkte ?? -1) || b.erstellt.localeCompare(a.erstellt));
}

/** Search text for the PostgREST title filter: no wildcards or filter syntax from the user. */
export function suchbegriff(roh: string | null): string {
  return (roh ?? "").replace(/[*,()%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** One compact filter bar: search, area and sorting apply right away (button only without JavaScript). */
export function filterLeiste(stand: string, q: string, sortierung: string, bereichOptionen: string): string {
  return `<form class="treffer-filter" method="get" action="/konto/treffer" role="search">
  <input type="hidden" name="stand" value="${escape(stand)}">
  <label class="treffer-suche"><span class="unsichtbar">Im Titel suchen</span><input type="search" name="q" value="${escape(q)}" placeholder="🔍 Im Titel suchen" enterkeyhint="search"></label>
  <div class="treffer-filter-zeile">
    ${bereichOptionen ? `<label><span class="unsichtbar">Bereich</span><select name="bereich" data-sofort-wahl><option value="">Alle Bereiche</option>${bereichOptionen}</select></label>` : ""}
    <label><span class="unsichtbar">Sortierung</span><select name="sortierung" data-sofort-wahl>${Object.entries(SORTIERUNGEN).map(([k, t]) => `<option value="${k}"${k === sortierung ? " selected" : ""}>${t}</option>`).join("")}</select></label>
  </div>
  <noscript><button>Anzeigen</button></noscript>
</form>`;
}

/** Thumbs up/down right on the card; the answer sharpens the search profile (treffer_feedback). */
export function daumen(id: string, grund: string | undefined, weiter: string): string {
  const knopf = (wert: string, zeichen: string, text: string) =>
    `<form method="post" action="/konto/vorgang/${id}/rueckmeldung" class="daumen-form"><input type="hidden" name="grund" value="${wert}"><input type="hidden" name="weiter" value="${escape(weiter)}"><button class="daumen${grund === wert ? " gewaehlt" : ""}" aria-label="${text}" aria-pressed="${grund === wert}" title="${text}">${zeichen}</button></form>`;
  return `<div class="daumen-leiste">${knopf("passt", "👍", "Passt gut")}${knopf("taetigkeit", "👎", "Passt nicht")}</div>`;
}
