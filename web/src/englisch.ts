// English office interface: every HTML answer is translated after rendering, text node by text node, with a fixed
// German → English dictionary (web/src/englisch/*.json, one entry per visible text; `#` stands for a number or date and
// is carried over in order). Texts the dictionary does not know stay German (names, customer texts, AI fact sheets).
// Language: cookie jv_psprache ("de" or "en"), otherwise from the visitor's country (besucher.ts). The footer offers
// the switch (/sprache?zu=en&weiter=…).
import { escape } from "./seite.ts";
import { besucher } from "./besucher.ts";
import t00 from "./englisch/teil00.json" with { type: "json" };
import t01 from "./englisch/teil01.json" with { type: "json" };
import t02 from "./englisch/teil02.json" with { type: "json" };
import t03 from "./englisch/teil03.json" with { type: "json" };
import t04 from "./englisch/teil04.json" with { type: "json" };
import t05 from "./englisch/teil05.json" with { type: "json" };
import tZusatz from "./englisch/zusatz.json" with { type: "json" };

export type AppSprache = "de" | "en";

const ZAHL = "(\\d[\\d.,:]*)";
type Muster = { re: RegExp; ziel: string };
let genau: Map<string, string> | null = null;
let muster: Muster[] = [];

function laden(): Map<string, string> {
  if (genau) return genau;
  genau = new Map();
  for (const teil of [t00, t01, t02, t03, t04, t05, tZusatz] as Record<string, string>[]) {
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
  return genau;
}

/** How many dictionary entries are loaded (for tests and the diagnosis page). */
export function wortschatz(): { genau: number; muster: number } {
  const g = laden();
  return { genau: g.size, muster: muster.length };
}

const entschluesseln = (t: string) => t.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

/** Translates one plain text (already unescaped); null when the dictionary does not know it. */
export function wort(text: string): string | null {
  const g = laden();
  const direkt = g.get(text);
  if (direkt !== undefined) return direkt;
  if (!/\d/.test(text)) return null;
  for (const m of muster) {
    const t = m.re.exec(text);
    if (!t) continue;
    let i = 1;
    return m.ziel.replace(/#/g, () => t[i++] ?? "");
  }
  return null;
}

function textTauschen(roh: string): string {
  const kern = roh.trim();
  if (!kern || !/\p{L}/u.test(kern)) return roh;
  const en = wort(entschluesseln(kern));
  if (en === null) return roh;
  const vorne = roh.slice(0, roh.indexOf(kern)), hinten = roh.slice(roh.indexOf(kern) + kern.length);
  return `${vorne}${escape(en)}${hinten}`;
}

/** Translates the visible texts of a finished page (text nodes plus placeholder, aria-label, title and alt). */
export function englisch(seite: string): string {
  const teile = seite.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<textarea[\s\S]*?<\/textarea>|<code[\s\S]*?<\/code>|<[^>]+>)/);
  return teile.map((t, i) => {
    if (i % 2 === 0) return textTauschen(t);
    if (/^<(style|script|textarea|code)/.test(t)) return t;
    if (t.startsWith("<html")) return t.replace(/lang="de"/, 'lang="en"');
    return t.replace(/\b(placeholder|aria-label|title|alt)="([^"]*)"/g, (ganz, a: string, v: string) => {
      const en = wort(entschluesseln(v));
      return en === null ? ganz : `${a}="${escape(en)}"`;
    });
  }).join("");
}

/** Office language of this visitor: the cookie decides, otherwise the country. Only German and English exist. */
export function appSprache(request: Request): AppSprache {
  const c = /(?:^|;\s*)jv_psprache=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")?.[1];
  if (c) return c === "de" ? "de" : "en";
  return besucher(request).sprache === "de" ? "de" : "en";
}

const FUSS = '<p class="klein">WP Digital Ranger · ';
/** Adds the language switch to the page footer. */
export function sprachFuss(seite: string, sprache: AppSprache, pfad: string): string {
  const ziel = sprache === "de" ? "en" : "de";
  const text = sprache === "de" ? "English" : "Deutsch";
  const link = `<a href="/sprache?zu=${ziel}&amp;weiter=${encodeURIComponent(pfad)}" lang="${ziel}" hreflang="${ziel}">🌐 ${text}</a> · `;
  return seite.replace(FUSS, `${FUSS}${link}`);
}

/** GET /sprache?zu=en&weiter=/konto: remembers the choice for a year and goes back. */
export function sprachWechsel(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== "/sprache" || request.method !== "GET") return null;
  const zu = url.searchParams.get("zu") === "en" ? "en" : "de";
  const weiter = url.searchParams.get("weiter") ?? "/";
  const sicher = /^\/[^/\\][^\s]*$/.test(weiter) ? weiter : "/";
  return new Response(null, { status: 303, headers: { location: sicher, "set-cookie": `jv_psprache=${zu}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`, "cache-control": "no-store" } });
}
