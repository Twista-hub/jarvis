// Visits from outside, counted per day and source (11.11.2026): how many people arrive from an AI assistant, a search
// engine, a social network or another site, and how often an assistant fetches a page for one of its users. Only a number
// per day, channel and source is stored (jarvis_intern.besuche_tag); nothing about the visitor, no cookie, no IP address.
// Cloudflare's free plan does not show referring sites, and crawlers are in Cloudflare's statistics already (Ablauf
// „Zugriffe“), so this counts only arrivals with a browser and the fetchers that act for a person.
import { katalogDb, type DbEnv } from "./katalog-db.ts";

export type Kanal = "ki" | "ki-abruf" | "suche" | "social" | "verzeichnis" | "sonstige";
export type Zaehlung = { kanal: Kanal; quelle: string };

// Name of the source by the referring host or the utm_source value (our short links use plain names like "instagram").
const QUELLEN: [RegExp, Kanal, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|^chatgpt$|^openai$/, "ki", "chatgpt"],
  [/(^|\.)perplexity\.ai$|^perplexity$/, "ki", "perplexity"],
  [/(^|\.)claude\.ai$|^claude$/, "ki", "claude"],
  [/^copilot\.microsoft\.com$|^copilot$/, "ki", "copilot"],
  [/^gemini\.google\.com$|^gemini$/, "ki", "gemini"],
  [/(^|\.)(you|phind|poe|deepseek|grok)\.com$|(^|\.)(mistral|x|meta)\.ai$/, "ki", "andere-ki"],
  [/(^|\.)google\.[a-z.]{2,6}$|^google$/, "suche", "google"],
  [/(^|\.)bing\.com$|^bing$/, "suche", "bing"],
  [/(^|\.)duckduckgo\.com$/, "suche", "duckduckgo"],
  [/(^|\.)(ecosia\.org|startpage\.com|qwant\.com|kagi\.com|baidu\.com)$|(^|\.)search\.brave\.com$|(^|\.)yahoo\.[a-z.]{2,6}$|(^|\.)yandex\.[a-z.]{2,6}$/, "suche", "andere-suche"],
  [/(^|\.)facebook\.com$|^facebook$/, "social", "facebook"],
  [/(^|\.)instagram\.com$|^instagram$/, "social", "instagram"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$|^linkedin$/, "social", "linkedin"],
  [/^bsky\.app$|^bluesky$/, "social", "bluesky"],
  [/^mastodon$|(^|\.)mastodon\.[a-z.]{2,12}$/, "social", "mastodon"],
  [/^t\.co$|(^|\.)(x|twitter|youtube|tiktok|reddit|whatsapp|xing|threads|pinterest)\.(com|net)$|^t\.me$/, "social", "andere-social"],
];

// Fetchers that load a page because a person asked their assistant (not the crawlers that read the whole site).
const KI_ABRUF: [RegExp, string][] = [[/ChatGPT-User/i, "chatgpt"], [/Perplexity-User/i, "perplexity"], [/Claude-User/i, "claude"], [/MistralAI-User/i, "mistral"], [/DuckAssistBot/i, "duckduckgo"]];
const ROBOTER = /bot\b|bot\/|crawler|spider|headless|preview|scanner|facebookexternalhit|curl\/|python|go-http|okhttp|java\/|wget|linkcheck|monitor/i;
// The account area, files and the API are not public pages.
const OHNE = /^\/(konto|abmelden|anmelden\/|api|nachweis|portal|einladung|auftrag\/|partner\/u\/|sprache|abo\/|[^?#]*\.(css|js|png|jpe?g|webp|svg|ico|webmanifest|xml|txt|pdf))/;
const sauber = (v: string | null | undefined, max: number) => String(v ?? "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9._-]/g, "").slice(0, max);

/** Channel and source of a name (host without www. or utm_source); unknown hosts count under their own name. */
export function quelleVon(name: string, medium = ""): Zaehlung | null {
  const n = sauber(name, 60);
  if (!n) return null;
  for (const [muster, kanal, quelle] of QUELLEN) if (muster.test(n)) return { kanal, quelle };
  return { kanal: medium === "verzeichnis" ? "verzeichnis" : "sonstige", quelle: n };
}

/** What to count for this request, or null: a public HTML page delivered to an arrival from outside. */
export function zaehlung(request: Request, antwort: Response): Zaehlung | null {
  if (request.method !== "GET" || antwort.status !== 200 || !(antwort.headers.get("content-type") ?? "").startsWith("text/html")) return null;
  if (request.headers.has("purpose") || request.headers.has("sec-purpose")) return null;
  const url = new URL(request.url);
  if (OHNE.test(url.pathname)) return null;
  const ua = request.headers.get("user-agent") ?? "";
  for (const [muster, quelle] of KI_ABRUF) if (muster.test(ua)) return { kanal: "ki-abruf", quelle };
  if (!ua || ROBOTER.test(ua)) return null;
  // h marks a click inside our own pages (herkunft.ts): the arrival was counted already.
  if (url.searchParams.has("h")) return null;
  const utm = sauber(url.searchParams.get("utm_source"), 60);
  if (utm) return quelleVon(utm, sauber(url.searchParams.get("utm_medium"), 40));
  let verweis = "";
  try { verweis = sauber(new URL(request.headers.get("referer") ?? "").hostname, 60); } catch { return null; }
  if (!verweis || verweis === sauber(url.hostname, 60) || verweis.endsWith(".workers.dev")) return null;
  return quelleVon(verweis);
}

// At most 30 database calls a minute per running instance: a flood of requests with invented referrers must not use up
// the few database connections of the app.
let minute = 0, inMinute = 0;
export function darfZaehlen(jetzt = Date.now()): boolean {
  const m = Math.floor(jetzt / 60000);
  if (m !== minute) { minute = m; inMinute = 0; }
  return ++inMinute <= 30;
}

/** Adds one to today's counter; never throws (counting must not disturb the page). */
export async function besuchZaehlen(env: DbEnv, z: Zaehlung): Promise<void> {
  try { await katalogDb(env, (sql) => sql`select jarvis_intern.besuch_zaehlen(${z.kanal}, ${z.quelle})`); } catch { /* the counter is not worth an error */ }
}
