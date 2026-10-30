/** One user-supplied company homepage; no search engine or site-wide crawl. */
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

function seitenText(html: string): string {
  const metadaten = [...html.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:title|og:description)["'][^>]*>/gi)]
    .map(([tag]) => tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const text = html.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|quot|lt|gt|apos);|&#39;/gi, " ").replace(/\s+/g, " ").trim();
  return [...new Set([entity(title), ...metadaten.map(entity), text].map((x) => x.trim()).filter(Boolean))].join(" · ").slice(0, 3500);
}

export async function websiteKontext(raw: string, abrufen: typeof fetch = fetch): Promise<{ text: string; hinweis: string }> {
  const normal = websiteNormalisieren(raw);
  if (!normal) return { text: "", hinweis: "" };
  const url = new URL(normal);
  if (!isPublicWebsite(url)) return { text: "", hinweis: "Die Website-Adresse ist nicht für einen sicheren öffentlichen Abruf geeignet. Du kannst mit deiner Beschreibung fortfahren." };
  const options: RequestInit = { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Jarvis/1.0 (Firmenprofil; kontakt@wpdigitalranger.com)", accept: "text/plain,text/html" } };
  try {
    const robots = await abrufen(new URL("/robots.txt", url.origin), options);
    if (robots.status !== 404 && robots.status !== 410) {
      if (!robots.ok) return { text: "", hinweis: "Die Website erlaubt gerade keinen Abruf ihrer Regeln. Du kannst mit deiner Beschreibung fortfahren." };
      const regeln = await begrenztLesen(robots, 16_000);
      if (!robotsErlaubt(regeln, `${url.pathname}${url.search}`)) return { text: "", hinweis: "Die Website untersagt automatisches Lesen. Du kannst ihre Leistungen unten selbst beschreiben." };
    }
    const seite = await abrufen(url, options);
    if (!seite.ok || (seite.headers.get("content-type") ?? "").toLowerCase().includes("text/html") === false) {
      return { text: "", hinweis: "Die Website ließ sich nicht als öffentliche HTML-Seite lesen. Du kannst mit deiner Beschreibung fortfahren." };
    }
    const text = seitenText(await begrenztLesen(seite, 100_000));
    return text
      ? { text, hinweis: "Jarvis hat die Startseite gelesen; bitte prüfe die daraus abgeleiteten Leistungen." }
      : { text: "", hinweis: "Die Website enthält keine lesbare Leistungsbeschreibung. Du kannst mit deiner Beschreibung fortfahren." };
  } catch {
    return { text: "", hinweis: "Die Website war gerade nicht erreichbar. Du kannst mit deiner Beschreibung fortfahren." };
  }
}
