// Origin of a sign-up (08.11.2026): where a visitor came from (utm_source/medium/campaign of the landing address or the
// domain of the referring site). Nothing is stored on the visitor's device (no cookie, no localStorage): the worker reads
// the request, writes the origin as parameter h into the internal links of that page, and the registration form carries
// it as a hidden field into the sign-up data; the database copies it to the firm (column firmen.herkunft).

export type Herkunft = { quelle: string; medium: string; kampagne: string; verweis: string };

const teil = (v: string | null | undefined, max: number) => String(v ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, max);

/** "quelle~medium~kampagne~verweis" from h, the utm parameters or an external referrer; "" when there is nothing. */
export function herkunftAus(url: URL, referer: string | null, eigeneDomain = url.hostname): string {
  const h = url.searchParams.get("h");
  if (h) return herkunftParsen(h) ? herkunftText(herkunftParsen(h)!) : "";
  let verweis = "";
  try { verweis = referer ? new URL(referer).hostname.replace(/^www\./, "") : ""; } catch { verweis = ""; }
  if (verweis === eigeneDomain.replace(/^www\./, "") || verweis.endsWith(".workers.dev")) verweis = "";
  const x = { quelle: teil(url.searchParams.get("utm_source"), 40), medium: teil(url.searchParams.get("utm_medium"), 40), kampagne: teil(url.searchParams.get("utm_campaign"), 60), verweis: teil(verweis, 80) };
  return x.quelle || x.verweis ? herkunftText(x) : "";
}

export const herkunftText = (x: Herkunft) => [x.quelle, x.medium, x.kampagne, x.verweis].join("~");

export function herkunftParsen(h: unknown): Herkunft | null {
  const t = String(h ?? "").slice(0, 240).split("~");
  if (t.length !== 4) return null;
  const x = { quelle: teil(t[0], 40), medium: teil(t[1], 40), kampagne: teil(t[2], 60), verweis: teil(t[3], 80) };
  return x.quelle || x.verweis ? x : null;
}

// Internal pages whose links carry the origin; never the account area, files or the API.
const OHNE = /^\/(konto|abmelden|anmelden\/|api|nachweis|portal|einladung|auftrag\/|partner\/u\/|[^"?#]*\.(css|js|png|jpe?g|svg|ico|webmanifest|xml|txt|pdf))/;

/** Writes h into the internal links of an HTML page. */
export function linksMitHerkunft(htmlText: string, h: string): string {
  return htmlText.replace(/href="(\/[^"]*)"/g, (ganz, pfad: string) => {
    if (pfad.startsWith("//") || OHNE.test(pfad) || /[?&]h=/.test(pfad)) return ganz;
    const [vor, anker] = pfad.split("#", 2);
    return `href="${vor}${vor.includes("?") ? "&amp;" : "?"}h=${h}${anker !== undefined ? `#${anker}` : ""}"`;
  });
}

/** For a public HTML page reached from outside (utm, referrer or h): the same page with the origin in its links, not cached. */
export async function herkunftWeitergeben(request: Request, r: Response): Promise<Response> {
  if (request.method !== "GET" || r.status !== 200 || !(r.headers.get("content-type") ?? "").startsWith("text/html")) return r;
  const url = new URL(request.url);
  if (OHNE.test(url.pathname)) return r;
  const h = herkunftAus(url, request.headers.get("referer"));
  if (!h) return r;
  const headers = new Headers(r.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("content-length");
  return new Response(linksMitHerkunft(await r.text(), h), { status: r.status, statusText: r.statusText, headers });
}
