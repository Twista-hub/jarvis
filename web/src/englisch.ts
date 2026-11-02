// English, French and Polish office interface: every HTML answer is translated after rendering, text node by text node,
// with a fixed dictionary per language (web/src/englisch, franzoesisch, polnisch/*.json: German key, one entry per
// visible text; `#` stands for a number or date and is carried over in order). Texts the dictionary does not know stay
// German (names, customer texts). Language: cookie jv_psprache ("de", "en" or "fr"), otherwise from the visitor's
// country and browser (besucher.ts). The footer offers the switch (/sprache?zu=fr&weiter=…).
import { escape } from "./seite.ts";
import { besucher } from "./besucher.ts";
import t00 from "./englisch/teil00.json" with { type: "json" };
import t01 from "./englisch/teil01.json" with { type: "json" };
import t02 from "./englisch/teil02.json" with { type: "json" };
import t03 from "./englisch/teil03.json" with { type: "json" };
import t04 from "./englisch/teil04.json" with { type: "json" };
import t05 from "./englisch/teil05.json" with { type: "json" };
import tZusatz from "./englisch/zusatz.json" with { type: "json" };
import tAttribute from "./englisch/attribute.json" with { type: "json" };
import tNachtrag from "./englisch/nachtrag.json" with { type: "json" };
import f00 from "./franzoesisch/teil00.json" with { type: "json" };
import f01 from "./franzoesisch/teil01.json" with { type: "json" };
import f02 from "./franzoesisch/teil02.json" with { type: "json" };
import f03 from "./franzoesisch/teil03.json" with { type: "json" };
import f04 from "./franzoesisch/teil04.json" with { type: "json" };
import f05 from "./franzoesisch/teil05.json" with { type: "json" };
import fZusatz from "./franzoesisch/zusatz.json" with { type: "json" };
import fAttribute from "./franzoesisch/attribute.json" with { type: "json" };
import fNachtrag from "./franzoesisch/nachtrag.json" with { type: "json" };
import p00 from "./polnisch/teil00.json" with { type: "json" };
import p01 from "./polnisch/teil01.json" with { type: "json" };
import p02 from "./polnisch/teil02.json" with { type: "json" };
import p03 from "./polnisch/teil03.json" with { type: "json" };
import p04 from "./polnisch/teil04.json" with { type: "json" };
import p05 from "./polnisch/teil05.json" with { type: "json" };
import pZusatz from "./polnisch/zusatz.json" with { type: "json" };
import pAttribute from "./polnisch/attribute.json" with { type: "json" };
import pNachtrag from "./polnisch/nachtrag.json" with { type: "json" };
import s00 from "./spanisch/teil00.json" with { type: "json" };
import s01 from "./spanisch/teil01.json" with { type: "json" };
import s02 from "./spanisch/teil02.json" with { type: "json" };
import s03 from "./spanisch/teil03.json" with { type: "json" };
import s04 from "./spanisch/teil04.json" with { type: "json" };
import s05 from "./spanisch/teil05.json" with { type: "json" };
import sZusatz from "./spanisch/zusatz.json" with { type: "json" };
import sAttribute from "./spanisch/attribute.json" with { type: "json" };
import sNachtrag from "./spanisch/nachtrag.json" with { type: "json" };

export type AppSprache = "de" | "en" | "fr" | "pl" | "es";
type Fremd = Exclude<AppSprache, "de">;

const ZAHL = "(\\d[\\d.,:]*)";
const TEILE: Record<Fremd, Record<string, string>[]> = {
  en: [t00, t01, t02, t03, t04, t05, tZusatz, tAttribute, tNachtrag],
  fr: [f00, f01, f02, f03, f04, f05, fZusatz, fAttribute, fNachtrag],
  pl: [p00, p01, p02, p03, p04, p05, pZusatz, pAttribute, pNachtrag],
  es: [s00, s01, s02, s03, s04, s05, sZusatz, sAttribute, sNachtrag],
};
/** Fixed labels in front of free text (AI fact sheet title, rating lines). */
const PRAEFIXE: Record<Fremd, [string, string][]> = {
  en: [["Steckbrief: ", "Fact sheet: "], ["Gesucht: ", "Wanted: "], ["Warum passend: ", "Why it fits: "], ["Empfehlung: ", "Recommendation: "]],
  fr: [["Steckbrief: ", "Fiche synthèse : "], ["Gesucht: ", "Objet : "], ["Warum passend: ", "Pourquoi c'est pertinent : "], ["Empfehlung: ", "Recommandation : "]],
  pl: [["Steckbrief: ", "Karta przetargu: "], ["Gesucht: ", "Przedmiot: "], ["Warum passend: ", "Dlaczego pasuje: "], ["Empfehlung: ", "Rekomendacja: "]],
  es: [["Steckbrief: ", "Ficha de la licitación: "], ["Gesucht: ", "Objeto: "], ["Warum passend: ", "Por qué encaja: "], ["Empfehlung: ", "Recomendación: "]],
};
/** Fixed labels after free text (a work or place name the firm typed). */
const SUFFIXE: Record<Fremd, [string, (frei: string) => string][]> = {
  en: [[" suchen", (f) => `Search for ${f}`], [" als Einsatzort", (f) => `${f} as place of work`]],
  fr: [[" suchen", (f) => `Rechercher : ${f}`], [" als Einsatzort", (f) => `${f} comme lieu d'intervention`]],
  pl: [[" suchen", (f) => `Szukaj: ${f}`], [" als Einsatzort", (f) => `${f} jako miejsce pracy`]],
  es: [[" suchen", (f) => `Buscar: ${f}`], [" als Einsatzort", (f) => `${f} como lugar de trabajo`]],
};
type Muster = { re: RegExp; ziel: string };
type Woerterbuch = { genau: Map<string, string>; muster: Muster[] };
const geladen: Partial<Record<Fremd, Woerterbuch>> = {};

function laden(sprache: Fremd): Woerterbuch {
  const da = geladen[sprache];
  if (da) return da;
  const genau = new Map<string, string>();
  const muster: Muster[] = [];
  for (const teil of TEILE[sprache]) {
    for (const [de, en] of Object.entries(teil)) {
      if (!de || typeof en !== "string" || !en) continue;
      if (de.includes("#")) {
        if ((de.match(/#/g) ?? []).length !== (en.match(/#/g) ?? []).length) continue;
        const re = new RegExp(`^${de.split("#").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(ZAHL)}$`, "u");
        muster.push({ re, ziel: en });
      } else genau.set(de, en);
    }
  }
  // Longer templates first, so "# von # Treffern" wins over "# Treffer".
  muster.sort((a, b) => b.re.source.length - a.re.source.length);
  return (geladen[sprache] = { genau, muster });
}

/** How many dictionary entries are loaded (for tests and the diagnosis page). */
export function wortschatz(sprache: Fremd = "en"): { genau: number; muster: number } {
  const w = laden(sprache);
  return { genau: w.genau.size, muster: w.muster.length };
}

const entschluesseln = (t: string) => t.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

/** Translates one plain text (already unescaped); null when the dictionary does not know it. */
export function wort(text: string, sprache: Fremd = "en"): string | null {
  // Numbers and amounts often carry non-breaking spaces ("1.341,00 €"); the dictionary is written with plain spaces.
  if (/[\u00a0\u202f]/.test(text)) return wortGenau(text, sprache) ?? wortGenau(text.replace(/[\u00a0\u202f]/g, " "), sprache);
  return wortGenau(text, sprache);
}

function wortGenau(text: string, sprache: Fremd): string | null {
  const w = laden(sprache);
  const direkt = w.genau.get(text);
  if (direkt !== undefined) return direkt;
  // Fixed labels in front of free text (AI fact sheet title, rating lines): translate only the label.
  for (const [de, ziel] of PRAEFIXE[sprache]) if (text.startsWith(de) && text.length > de.length) return ziel + text.slice(de.length);
  for (const [de, ziel] of SUFFIXE[sprache]) if (text.endsWith(de) && text.length > de.length && !/\d/.test(text)) return ziel(text.slice(0, -de.length));
  if (!/\d/.test(text)) return null;
  for (const m of w.muster) {
    const t = m.re.exec(text);
    if (!t) continue;
    let i = 1;
    return m.ziel.replace(/#/g, () => t[i++] ?? "");
  }
  return null;
}

function textTauschen(roh: string, sprache: Fremd): string {
  const kern = roh.trim();
  if (!kern || !/\p{L}/u.test(kern)) return roh;
  const neu = wort(entschluesseln(kern), sprache);
  if (neu === null) return roh;
  const vorne = roh.slice(0, roh.indexOf(kern)), hinten = roh.slice(roh.indexOf(kern) + kern.length);
  // A translation that is only a full stop or comma (sentence end after a link) sticks to the word before it.
  return `${/^[.,]$/.test(neu) ? vorne.trimEnd() : vorne}${escape(neu)}${hinten}`;
}

function attributeTauschen(tag: string, sprache: Fremd): string {
  return tag.replace(/\b(placeholder|aria-label|title|alt)="([^"]*)"/g, (ganz, a: string, v: string) => {
    const neu = wort(entschluesseln(v), sprache);
    return neu === null ? ganz : `${a}="${escape(neu)}"`;
  });
}

/** English page (kept for callers and tests). */
export const englisch = (seite: string): string => uebersetzen(seite, "en");

/** Translates the visible texts of a finished page (text nodes plus placeholder, aria-label, title and alt). */
export function uebersetzen(seite: string, sprache: AppSprache): string {
  if (sprache === "de") return seite;
  const teile = seite.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<textarea[\s\S]*?<\/textarea>|<code[\s\S]*?<\/code>|<[^>]+>)/);
  return teile.map((t, i) => {
    if (i % 2 === 0) return textTauschen(t, sprache);
    // Text areas: the content stays (customer text), the placeholder of the opening tag is translated.
    if (t.startsWith("<textarea")) { const ende = t.indexOf(">") + 1; return attributeTauschen(t.slice(0, ende), sprache) + t.slice(ende); }
    if (/^<(style|script|code)/.test(t)) return t;
    if (t.startsWith("<html")) return t.replace(/lang="de"/, `lang="${sprache}"`);
    return attributeTauschen(t, sprache);
  }).join("");
}

const APP_SPRACHEN: readonly AppSprache[] = ["de", "en", "fr", "pl", "es"];
const zuApp = (s: string): AppSprache => (APP_SPRACHEN as readonly string[]).includes(s) ? s as AppSprache : "en";

/** Office language of this visitor: the cookie decides, otherwise country and browser (besucher.ts). German, English
 *  and French exist; every other language gets English. */
export function appSprache(request: Request): AppSprache {
  const c = /(?:^|;\s*)jv_psprache=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")?.[1];
  return zuApp(c ?? besucher(request).sprache);
}

const NAMEN: Record<AppSprache, string> = { de: "Deutsch", en: "English", fr: "Français", pl: "Polski", es: "Español" };
const FUSS = '<p class="klein">WP Digital Ranger · ';
/** Adds the language switch (the two other languages) to the page footer. */
export function sprachFuss(seite: string, sprache: AppSprache, pfad: string): string {
  const links = APP_SPRACHEN.filter((s) => s !== sprache)
    .map((s, i) => `<a href="/sprache?zu=${s}&amp;weiter=${encodeURIComponent(pfad)}" lang="${s}" hreflang="${s}">${i ? "" : "🌐 "}${NAMEN[s]}</a>`).join(" · ");
  return seite.replace(FUSS, `${FUSS}${links} · `);
}

/** GET /sprache?zu=fr&weiter=/konto: remembers the choice for a year and goes back. */
export function sprachWechsel(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== "/sprache" || request.method !== "GET") return null;
  const zu = (APP_SPRACHEN as readonly string[]).includes(url.searchParams.get("zu") ?? "") ? url.searchParams.get("zu") as AppSprache : "de";
  const weiter = url.searchParams.get("weiter") ?? "/";
  const sicher = /^\/[^/\\][^\s]*$/.test(weiter) ? weiter : "/";
  return new Response(null, { status: 303, headers: { location: sicher, "set-cookie": `jv_psprache=${zu}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`, "cache-control": "no-store" } });
}

/** Language of the US boxes (SAM.gov, USAspending), which exist only in German and English: French gets English. */
export const usSprache = (request: Request): "de" | "en" => appSprache(request) === "de" ? "de" : "en";
