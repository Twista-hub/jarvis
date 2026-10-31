/** User-supplied company site; read its homepage and a bounded set of relevant same-site pages. */
export function websiteNormalisieren(roh: string): string {
  const wert = roh.trim();
  if (!wert) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(wert) ? wert : `https://${wert}`);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return "";
    url.protocol = "https:";
    url.hash = "";
    const normal = url.toString().replace(/\/$/, "");
    return normal.length <= 300 ? normal : "";
  } catch { return ""; }
}

function isPublicWebsite(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || !host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) return false;
  return true;
}

async function begrenztLesen(response: Response, max: number): Promise<string> {
  if (!response.body) return "";
  const laenge = Number(response.headers.get("content-length") ?? 0);
  if (laenge > max) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "", gelesen = 0;
  while (gelesen < max) {
    const { done, value } = await reader.read();
    if (done) break;
    const rest = value.subarray(0, max - gelesen);
    text += decoder.decode(rest, { stream: true });
    gelesen += rest.length;
    if (rest.length !== value.length) { await reader.cancel(); break; }
  }
  return text + decoder.decode();
}

function robotsErlaubt(text: string, pfad: string): boolean {
  const zeilen = text.split(/\r?\n/).map((x) => x.replace(/#.*$/, "").trim()).filter(Boolean);
  const gruppen: { agenten: string[]; regeln: { erlaubt: boolean; pfad: string }[] }[] = [];
  let aktuell: { agenten: string[]; regeln: { erlaubt: boolean; pfad: string }[] } | undefined;
  for (const zeile of zeilen) {
    const [key, ...rest] = zeile.split(":");
    const wert = rest.join(":").trim();
    if (key.toLowerCase() === "user-agent") {
      if (!aktuell || aktuell.regeln.length) { aktuell = { agenten: [], regeln: [] }; gruppen.push(aktuell); }
      aktuell.agenten.push(wert.toLowerCase());
    } else if (aktuell && (key.toLowerCase() === "allow" || key.toLowerCase() === "disallow") && wert) {
      aktuell.regeln.push({ erlaubt: key.toLowerCase() === "allow", pfad: wert });
    }
  }
  const passend = gruppen.filter((g) => g.agenten.some((a) => a === "*" || "jarvis".startsWith(a)));
  const regeln = passend.flatMap((g) => g.regeln);
  const match = regeln.map((r) => ({ ...r, laenge: r.pfad.replace(/[/*$]/g, "").length }))
    .filter((r) => r.pfad === "/" || pfad.startsWith(r.pfad.replace(/\*.*$/, "")))
    .sort((a, b) => b.laenge - a.laenge)[0];
  return !match || match.erlaubt;
}

function entity(text: string): string {
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function seitenText(html: string, limit = 3500): string {
  const metadaten = [...html.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:title|og:description)["'][^>]*>/gi)]
    .map(([tag]) => tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map(([, value]) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const text = html.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|quot|lt|gt|apos);|&#39;/gi, " ").replace(/\s+/g, " ").trim();
  return [...new Set([entity(title), ...headings.map(entity), ...metadaten.map(entity), text].map((x) => x.trim()).filter(Boolean))].join(" · ").slice(0, limit);
}

const RELEVANTE_PFADE = /leistung|angebot|branche|referenz|handwerk|service|qualifikation|gewerk|portfolio|unternehmen|ueber-uns|über-uns|taetig|tätig|arbeitsbereich|spektrum|produkt|standort|einsatzgebiet|projekt|kompetenz|karriere|jobs?/i;
const UNINTERESSANT = /(?:^|\/)(?:login|logout|anmeld\w*|registr\w*|warenkorb|checkout|kontaktformular|datenschutz|impressum|cookie|newsletter|intern|admin|private)(?:\/|$|[-_])/i;
const MAX_UNTERSEITEN = 10;
const MAX_SITEMAPS = 3;

function seitenUrl(raw: string, start: URL): URL | null {
  try {
    const url = new URL(entity(raw.trim()), start);
    if (url.origin !== start.origin || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    let pfad: string;
    try { pfad = decodeURIComponent(url.pathname); } catch { return null; }
    if (!RELEVANTE_PFADE.test(pfad) || UNINTERESSANT.test(pfad)) return null;
    if (/\.(?:pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|pptx?|xml)$/i.test(pfad)) return null;
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (!url.pathname.replace(/\/$/, "") || url.pathname.replace(/\/$/, "") === start.pathname.replace(/\/$/, "")) return null;
    return url;
  } catch { return null; }
}

function relevance(pfad: string): number {
  let punkte = 0;
  if (/leistung|angebot|gewerk|arbeitsbereich|spektrum|kompetenz|portfolio|produkt|service/i.test(pfad)) punkte += 4;
  if (/branche|referenz|projekt|handwerk|einsatzgebiet/i.test(pfad)) punkte += 3;
  if (/unternehmen|ueber-uns|über-uns|taetig|tätig|standort/i.test(pfad)) punkte += 2;
  if (/karriere|jobs?/i.test(pfad)) punkte += 1;
  return punkte;
}

function passendeUnterseiten(html: string, start: URL): URL[] {
  const kandidaten = new Map<string, { url: URL; punkte: number }>();
  for (const [, , roh, anker] of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const url = seitenUrl(roh, start);
    if (!url) continue;
    const pfad = decodeURIComponent(url.pathname);
    const ankerRelevant = RELEVANTE_PFADE.test(entity(anker.replace(/<[^>]+>/g, " ")));
    const punkte = relevance(pfad) + (ankerRelevant ? 2 : 0);
    const schluessel = url.pathname.replace(/\/$/, "");
    const alt = kandidaten.get(schluessel);
    if (!alt || punkte > alt.punkte) kandidaten.set(schluessel, { url, punkte });
  }
  return [...kandidaten.values()].sort((a, b) => b.punkte - a.punkte || a.url.pathname.localeCompare(b.url.pathname)).slice(0, MAX_UNTERSEITEN).map((x) => x.url);
}

function sitemapAdressen(robots: string, start: URL): URL[] {
  const gefunden = [...robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
  gefunden.push(new URL("/sitemap.xml", start.origin).toString());
  const eindeutig = new Map<string, URL>();
  for (const raw of gefunden) {
    try {
      const url = new URL(raw, start.origin);
      if (url.origin === start.origin && url.protocol === "https:" && !url.search && !url.hash) eindeutig.set(url.toString(), url);
    } catch { /* Invalid sitemap URLs are ignored. */ }
  }
  return [...eindeutig.values()].slice(0, MAX_SITEMAPS);
}

function sitemapSeiten(xml: string, start: URL): { seiten: URL[]; unterSitemaps: URL[] } {
  const seiten = new Map<string, URL>(), unterSitemaps = new Map<string, URL>();
  for (const [, roh] of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)) {
    const rohUrl = entity(roh.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim());
    try {
      const url = new URL(rohUrl, start.origin);
      if (url.origin !== start.origin || url.protocol !== "https:" || url.search || url.hash) continue;
      if (/\.xml(?:\.gz)?$/i.test(url.pathname) || /sitemap/i.test(url.pathname)) {
        unterSitemaps.set(url.toString(), url);
        continue;
      }
      const seite = seitenUrl(url.toString(), start);
      if (seite) seiten.set(seite.pathname, seite);
    } catch { /* Invalid sitemap entries are ignored. */ }
  }
  return { seiten: [...seiten.values()], unterSitemaps: [...unterSitemaps.values()] };
}

async function sitemapUnterseiten(robots: string, start: URL, regeln: string, abrufen: typeof fetch, optionen: () => RequestInit): Promise<URL[]> {
  let adressen = sitemapAdressen(robots, start);
  const gefunden = new Map<string, URL>(), besucht = new Set<string>();
  let gelesen = 0;
  while (adressen.length && gelesen < MAX_SITEMAPS) {
    const stapel = adressen.splice(0, MAX_SITEMAPS - gelesen).filter((url) => {
      const key = url.toString();
      if (besucht.has(key) || !robotsErlaubt(regeln, `${url.pathname}${url.search}`)) return false;
      besucht.add(key);
      return true;
    });
    gelesen += stapel.length;
    const daten = await Promise.all(stapel.map(async (sitemap) => {
      try {
        const response = await abrufen(sitemap, optionen());
        if (!response.ok || !(response.headers.get("content-type") ?? "").toLowerCase().match(/xml|text\/plain/)) return null;
        return sitemapSeiten(await begrenztLesen(response, 100_000), start);
      } catch { return null; }
    }));
    for (const sitemapDaten of daten.filter((x): x is NonNullable<typeof x> => Boolean(x))) {
      for (const url of sitemapDaten.seiten) gefunden.set(url.pathname, url);
      for (const url of sitemapDaten.unterSitemaps) if (!besucht.has(url.toString()) && !adressen.some((a) => a.toString() === url.toString())) adressen.push(url);
    }
  }
  return [...gefunden.values()].sort((a, b) => relevance(decodeURIComponent(b.pathname)) - relevance(decodeURIComponent(a.pathname)) || a.pathname.localeCompare(b.pathname));
}

export async function websiteKontext(raw: string, abrufen: typeof fetch = fetch): Promise<{ text: string; hinweis: string }> {
  const normal = websiteNormalisieren(raw);
  if (!normal) return { text: "", hinweis: "" };
  const url = new URL(normal);
  if (!isPublicWebsite(url)) return { text: "", hinweis: "Die Website-Adresse ist nicht für einen sicheren öffentlichen Abruf geeignet. Du kannst mit deiner Beschreibung fortfahren." };
  const optionen = (): RequestInit => ({ redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Jarvis/1.0 (Firmenprofil; kontakt@wpdigitalranger.com)", accept: "text/plain,text/html" } });
  try {
    const robots = await abrufen(new URL("/robots.txt", url.origin), optionen());
    let regeln = "";
    if (robots.status !== 404 && robots.status !== 410) {
      if (!robots.ok) return { text: "", hinweis: "Die Website erlaubt gerade keinen Abruf ihrer Regeln. Du kannst mit deiner Beschreibung fortfahren." };
      regeln = await begrenztLesen(robots, 16_000);
      if (!robotsErlaubt(regeln, `${url.pathname}${url.search}`)) return { text: "", hinweis: "Die Website untersagt automatisches Lesen. Du kannst ihre Leistungen unten selbst beschreiben." };
    }
    const seite = await abrufen(url, optionen());
    if (!seite.ok || (seite.headers.get("content-type") ?? "").toLowerCase().includes("text/html") === false) {
      return { text: "", hinweis: "Die Website ließ sich nicht als öffentliche HTML-Seite lesen. Du kannst mit deiner Beschreibung fortfahren." };
    }
    const homepage = await begrenztLesen(seite, 100_000);
    const haupttext = seitenText(homepage, 3500);
    const verlinkt = passendeUnterseiten(homepage, url);
    const ausSitemap = await sitemapUnterseiten(regeln, url, regeln, abrufen, optionen);
    const kandidaten = [...new Map([...verlinkt, ...ausSitemap].filter((ziel) => robotsErlaubt(regeln, `${ziel.pathname}${ziel.search}`)).map((ziel) => [ziel.pathname, ziel])).values()]
      .sort((a, b) => relevance(decodeURIComponent(b.pathname)) - relevance(decodeURIComponent(a.pathname)) || a.pathname.localeCompare(b.pathname))
      .slice(0, MAX_UNTERSEITEN);
    const unterseiten = await Promise.all(kandidaten.map(async (ziel) => {
      try {
        const antwort = await abrufen(ziel, optionen());
        if (!antwort.ok || !(antwort.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return "";
        return `${ziel.pathname}: ${seitenText(await begrenztLesen(antwort, 80_000), 1200)}`;
      } catch { return ""; }
    }));
    // Put service pages first so a plain-text fallback sees their useful terms before home-page news.
    const text = [...unterseiten, haupttext].filter(Boolean).join("\n\n").slice(0, 15000);
    return text
      ? { text, hinweis: `Jarvis hat die Startseite und ${unterseiten.filter(Boolean).length} passende Unterseite${unterseiten.filter(Boolean).length === 1 ? "" : "n"} geprüft; bitte prüfe die daraus abgeleiteten Leistungen.` }
      : { text: "", hinweis: "Die Website enthält keine lesbare Leistungsbeschreibung. Du kannst mit deiner Beschreibung fortfahren." };
  } catch {
    return { text: "", hinweis: "Die Website war gerade nicht erreichbar. Du kannst mit deiner Beschreibung fortfahren." };
  }
}
