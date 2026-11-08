// Google pages (08.11.2026): /ausschreibungen/<gewerk>/<bundesland> (trade × federal state, live numbers from the
// background cache) and /ausschreibung/<id> (one open public notice, indexable while it is open) with its own sitemap
// /sitemap-ausschreibungen.xml, plus /auftraggeber/<id> (what an authority tenders, keyed by a slug of its name
// because the buyer ids in the notices are not unique; sitemap /sitemap-auftraggeber.xml).
// Facts only from the public notices (CC0); contact names are masked, winners are never named.
import { escape, markdown, seite } from "./seite.ts";
import { KI_KENNUNG } from "./ki-kennung.ts";
import { personenMaskieren } from "./datensparsam.ts";
import { GEWERKE, type Statistik } from "./gewerke.ts";
import { BUNDESLAENDER, landAusOrt, type Bundesland } from "./nuts.ts";
export { BUNDESLAENDER, landAusOrt };

/** Trade of a notice from its CPV codes (first match). */
export function gewerkAusCpv(cpv: string[] | null | undefined) {
  return GEWERKE.find((g) => (cpv ?? []).some((c) => g.cpv.some((p) => c.startsWith(p))));
}

export const ausschreibungLink = (id: string) => `/ausschreibung/${encodeURIComponent(id)}`;
export const auftraggeberLink = (id: string) => `/auftraggeber/${encodeURIComponent(id)}`;
const zahl = (n: number) => n.toLocaleString("de-DE");
const datum = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "–");

type Beispiel = { id?: string; titel: string; auftraggeber: string; ort: string; frist: string | null };

export function gewerkLandSeite(g: (typeof GEWERKE)[number], l: Bundesland, s: Statistik | null): string {
  const n = s?.monat ?? 0;
  const fragen: [string, string][] = [
    [`Wie viele öffentliche Ausschreibungen für ${g.name} gibt es ${l.im}?`, n ? `In den letzten 30 Tagen waren es ${zahl(n)}, davon ${zahl(s?.offen ?? 0)} mit noch offener Angebotsfrist. Die Zahl wird mehrmals täglich aus den amtlichen Bekanntmachungen aktualisiert.` : `In den letzten 30 Tagen gab es ${l.im} keine neue Ausschreibung in diesem Gewerk. Crewtender meldet dir die nächste, sobald sie erscheint.`],
    [`Wie bekomme ich die Ausschreibungen ${l.im} automatisch?`, `Registriere dich kostenlos und gib deinen Firmensitz und Umkreis an. Crewtender schickt dir jeden Morgen die neuen passenden Ausschreibungen, mit Bewertung und Frist.`],
  ];
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fragen.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  const beispiele = (s?.beispiele ?? []) as Beispiel[];
  return `<h1>Öffentliche Ausschreibungen ${escape(g.name)} ${escape(l.im)}</h1>
<p class="klein"><a href="/ausschreibungen">Ausschreibungen</a> › <a href="/ausschreibungen/${g.slug}">${escape(g.name)}</a> › ${escape(l.name)}</p>
<p>${escape(g.intro)}</p>
${n ? `<div class="gewerk-zahlen"><div><strong>${zahl(n)}</strong><span>Ausschreibungen ${escape(l.im)} in den letzten 30 Tagen</span></div>${s?.offen ? `<div><strong>${zahl(s.offen)}</strong><span>davon noch offen</span></div>` : ""}</div>` : `<p class="hinweis">Zurzeit gibt es ${escape(l.im)} keine neue Ausschreibung in diesem Gewerk. Crewtender meldet dir die nächste automatisch.</p>`}
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos passende Aufträge ${escape(l.im)} finden</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>
${beispiele.length ? `<h2>Aktuelle Ausschreibungen ${escape(l.im)}</h2><ul class="kontakt-liste gewerk-beispiele">${beispiele.map((b) => `<li><div>${b.id ? `<a href="${ausschreibungLink(b.id)}"><strong>${escape(b.titel)}</strong></a>` : `<strong>${escape(b.titel)}</strong>`}<span class="klein">${escape([b.auftraggeber, b.ort].filter(Boolean).join(" · "))}${b.frist ? ` · Frist ${datum(b.frist)}` : ""}</span></div></li>`).join("")}</ul><p class="klein">Quelle: amtliche Bekanntmachungen. In Crewtender bekommst du nur die Ausschreibungen, die zu deiner Firma und deinem Umkreis passen, mit Bewertung und Steckbrief.</p>` : ""}
<h2>So hilft Crewtender</h2>
<ul>${g.vorteile.map((v) => `<li>${escape(v)}</li>`).join("")}<li>Jeden Morgen die neuen Treffer mit Punkten von 1 bis 10 und einem Satz, warum sie passen</li></ul>
<h2>Häufige Fragen</h2>
${fragen.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>${escape(g.name)} in anderen Bundesländern</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Andere Bundesländer">${BUNDESLAENDER.filter((x) => x.slug !== l.slug).map((x) => `<a href="/ausschreibungen/${g.slug}/${x.slug}">${escape(x.name)}</a>`).join("")}</nav>
<h2>Andere Gewerke ${escape(l.im)}</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Andere Gewerke">${GEWERKE.filter((x) => x.slug !== g.slug).map((x) => `<a href="/ausschreibungen/${x.slug}/${l.slug}">${escape(x.name)}</a>`).join("")}</nav>
<script type="application/ld+json">${jsonld}</script>`;
}

export type Eintrag = { id: string; titel: string; auftraggeber?: string; auftraggeber_id?: string | null; auftraggeber_seite?: string | null; ort?: string; frist: string | null; link: string; status?: string; quelle?: string; quell_datum?: string; beschreibung?: string; cpv?: string[]; lose?: string[]; steckbrief: string | null };

/** Open while the deadline lies ahead (or is unknown for a fresh notice) and the status is open/unknown. */
export function istOffen(e: Pick<Eintrag, "frist" | "status" | "quell_datum">, jetzt = Date.now()): boolean {
  if (e.status && !["offen", "unbekannt"].includes(e.status)) return false;
  if (e.frist) return Date.parse(e.frist) > jetzt;
  return !!e.quell_datum && jetzt - Date.parse(e.quell_datum) < 60 * 86_400_000;
}

export function ausschreibungSeite(e: Eintrag, jetzt = Date.now()): string {
  const offen = istOffen(e, jetzt);
  const l = landAusOrt(e.ort), g = gewerkAusCpv(e.cpv);
  const fakten = [e.auftraggeber && `<li>🏛️ ${e.auftraggeber_seite ? `<a href="${auftraggeberLink(e.auftraggeber_seite)}">${escape(e.auftraggeber)}</a>` : escape(e.auftraggeber)}</li>`, e.ort && `<li>📍 ${escape(e.ort)}</li>`, e.frist && `<li>⏰ Angebotsfrist ${datum(e.frist)}</li>`, e.quell_datum && `<li>📅 veröffentlicht ${datum(e.quell_datum)}</li>`].filter(Boolean).join("");
  const lose = e.lose?.filter(Boolean).length ? `<h2>Lose</h2><ul>${e.lose.filter(Boolean).map((x) => `<li>${escape(personenMaskieren(x))}</li>`).join("")}</ul>` : "";
  const text = e.beschreibung ? `<h2>Beschreibung (aus der Bekanntmachung)</h2>${personenMaskieren(e.beschreibung).split(/\n{2,}/).slice(0, 8).map((x) => `<p>${escape(x)}</p>`).join("")}` : "";
  const brief = e.steckbrief ? `<h2>Steckbrief</h2><div class="steckbrief-karte" data-ki-erstellt="true" data-ki-anbieter="Anthropic Claude">${KI_KENNUNG}${markdown(personenMaskieren(e.steckbrief))}</div>` : "";
  const weiter = [g && `<a href="/ausschreibungen/${g.slug}">Alle Ausschreibungen ${escape(g.name)}</a>`, g && l && `<a href="/ausschreibungen/${g.slug}/${l.slug}">${escape(g.name)} ${escape(l.im)}</a>`].filter(Boolean).join("");
  return `<h1>${escape(e.titel)}</h1>
<p class="klein"><a href="/ausschreibungen">Ausschreibungen</a>${g ? ` › <a href="/ausschreibungen/${g.slug}">${escape(g.name)}</a>` : ""}${g && l ? ` › <a href="/ausschreibungen/${g.slug}/${l.slug}">${escape(l.name)}</a>` : ""}</p>
${offen ? "" : `<p class="hinweis">Die Angebotsfrist dieser Ausschreibung ist abgelaufen. Crewtender findet dir die nächsten passenden – <a href="/registrieren">kostenlos registrieren</a>.</p>`}
<ul class="kopf-chips">${fakten}</ul>
${e.link ? `<p><a class="knopf zweit" href="${escape(e.link)}" rel="noopener nofollow" target="_blank">Zur Bekanntmachung beim Auftraggeber ↗</a></p>` : ""}
${brief || text}${brief ? "" : lose}
<aside class="hinweis demo-ki">🤖 <strong>Passt das zu deiner Firma?</strong> Crewtender bewertet jeden Morgen alle neuen Ausschreibungen für deine Firma (1–10 Punkte mit Begründung), erinnert an Fristen und schreibt Steckbriefe aus den Vergabeunterlagen. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>
${weiter ? `<nav class="ordner-chips gewerk-liste" aria-label="Ähnliche Ausschreibungen">${weiter}</nav>` : ""}
<p class="klein">Quelle: ${e.quelle === "bks" ? "Bekanntmachungsservice des Bundes (oeffentlichevergabe.de), Lizenz CC0" : "amtliche Bekanntmachung"}. Namen von Ansprechpersonen blendet Crewtender aus. Maßgeblich sind allein die Unterlagen der Vergabestelle.</p>`;
}

export function beschreibungMeta(e: Eintrag): string {
  const teile = [e.auftraggeber, e.ort?.replace(/\s*DE[0-9A-G][0-9A-Z]{0,3}\b/g, "").replace(/\s*·\s*$/, "").trim(), e.frist ? `Frist ${datum(e.frist)}` : ""].filter(Boolean);
  return `Öffentliche Ausschreibung: ${e.titel}. ${teile.join(" · ")}. Mit Crewtender passende Ausschreibungen jeden Morgen erhalten.`.slice(0, 300);
}

export function sitemapAusschreibungen(adresse: string, zeilen: { id: string; datum: string }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${zeilen.map((z) => `<url><loc>${adresse}${escape(ausschreibungLink(z.id))}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(z.datum) ? `<lastmod>${z.datum}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

export type Auftraggeber = {
  id: string; name: string; ort: string | null; offen_anzahl: number; jahr: number; gesamt: number;
  offen: { id: string; titel: string; frist: string | null }[];
  frueher: { id: string; titel: string; datum: string; status: string | null; laufzeit_ende: string | null; zuschlag_wert: number | null }[];
  cpv: string[];
};
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const STATUS: Record<string, string> = { vergeben: "vergeben", aufgehoben: "aufgehoben", offen: "Frist abgelaufen", unbekannt: "Frist abgelaufen" };

/** Public page of a contracting authority: open and past tenders, no winners' names, no contact persons. */
export function auftraggeberSeite(a: Auftraggeber): string {
  const name = personenMaskieren(a.name);
  const l = landAusOrt(a.ort);
  const gewerke = [...new Map(a.cpv.map((c) => gewerkAusCpv([c])).filter((g): g is (typeof GEWERKE)[number] => !!g).map((g) => [g.slug, g])).values()];
  const ortText = a.ort?.replace(/\s*DE[0-9A-G][0-9A-Z]{0,3}\b/g, "").replace(/\s*\(Auftraggeberadresse; Einsatzort prüfen\)/, "").trim();
  const offen = a.offen.length ? `<h2>Aktuelle Ausschreibungen (${zahl(a.offen_anzahl)})</h2><ul class="kontakt-liste gewerk-beispiele">${a.offen.map((x) => `<li><div><a href="${ausschreibungLink(x.id)}"><strong>${escape(personenMaskieren(x.titel))}</strong></a>${x.frist ? `<span class="klein">Frist ${datum(x.frist)}</span>` : ""}</div></li>`).join("")}</ul>`
    : `<p class="hinweis">Zurzeit hat ${escape(name)} keine offene Ausschreibung. Crewtender meldet dir die nächste automatisch, wenn sie zu deiner Firma passt.</p>`;
  const frueher = a.frueher.length ? `<h2>Frühere Ausschreibungen</h2><ul class="kontakt-liste gewerk-beispiele">${a.frueher.map((x) => {
    const teile = [`veröffentlicht ${datum(x.datum)}`, x.status && STATUS[x.status], x.zuschlag_wert ? `Zuschlag ${euro(Number(x.zuschlag_wert))}` : "", x.laufzeit_ende ? `Vertrag bis ${datum(x.laufzeit_ende)}` : ""].filter(Boolean);
    return `<li><div><a href="${ausschreibungLink(x.id)}"><strong>${escape(personenMaskieren(x.titel))}</strong></a><span class="klein">${escape(teile.join(" · "))}</span></div></li>`;
  }).join("")}</ul><p class="klein">Läuft ein Vertrag aus, wird die Leistung oft neu ausgeschrieben. Crewtender erinnert dich rechtzeitig vor dem Vertragsende.</p>` : "";
  const weiter = gewerke.flatMap((g) => [`<a href="/ausschreibungen/${g.slug}">${escape(g.name)}</a>`, ...(l ? [`<a href="/ausschreibungen/${g.slug}/${l.slug}">${escape(g.name)} ${escape(l.im)}</a>`] : [])]).join("");
  return `<h1>${escape(name)}: öffentliche Ausschreibungen</h1>
<p class="klein"><a href="/ausschreibungen">Ausschreibungen</a> › Auftraggeber${ortText ? ` · ${escape(ortText)}` : ""}</p>
<div class="gewerk-zahlen"><div><strong>${zahl(a.offen_anzahl)}</strong><span>offene Ausschreibungen</span></div><div><strong>${zahl(a.jahr)}</strong><span>Ausschreibungen in den letzten 12 Monaten</span></div></div>
${offen}
<aside class="hinweis demo-ki">🏛️ <strong>Für ${escape(name)} arbeiten?</strong> Mit Crewtender folgst du einzelnen Auftraggebern: Jede neue Ausschreibung kommt am nächsten Morgen per Mail, mit Bewertung, Frist und Steckbrief. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>
${frueher}
${weiter ? `<h2>Passende Gewerke</h2><nav class="ordner-chips gewerk-liste" aria-label="Gewerke">${weiter}</nav>` : ""}
<p class="klein">Quelle: Bekanntmachungsservice des Bundes (oeffentlichevergabe.de), Lizenz CC0. Crewtender nennt keine Bieter und keine Ansprechpersonen. Maßgeblich sind allein die Unterlagen der Vergabestelle.</p>`;
}

export function sitemapAuftraggeber(adresse: string, zeilen: [string, string][]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${zeilen.map(([id, d]) => `<url><loc>${adresse}${escape(auftraggeberLink(id))}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(d) ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

type SeoEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; WARTEN?: (p: Promise<unknown>) => void };
async function rpc<T>(env: SeoEnv, name: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}
const meta = (html: string, beschreibung: string, url: string, robots = "") => html.replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">${robots ? `\n<meta name="robots" content="${robots}">` : ""}`);

/** /ausschreibungen/<gewerk>/<land>, /ausschreibung/<id>, /auftraggeber/<id> and their sitemaps; null for other paths. */
export async function seoSeiten(request: Request, env: SeoEnv, adresse: string, antwort: (html: string) => Response): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const gecacht = async (schluessel: string, bauen: () => Promise<Response | null>, sekunden: number) => {
    const k = new Request(`${adresse}${schluessel}`);
    const alt = await cache?.match(k).catch(() => undefined);
    if (alt) return alt;
    const r = await bauen();
    if (!r) return null;
    r.headers.set("cache-control", `public, max-age=${sekunden}`);
    if (cache && r.status === 200) env.WARTEN?.(cache.put(k, r.clone()).catch(() => undefined));
    return r;
  };
  if (url.pathname === "/sitemap-ausschreibungen.xml") {
    return gecacht("/sitemap-ausschreibungen.xml?v=2", async () => {
      const z = await rpc<[string, string][]>(env, "sitemap_ausschreibungen_json", {});
      if (!Array.isArray(z)) return new Response("nicht erreichbar", { status: 503 });
      return new Response(sitemapAusschreibungen(adresse, z.map(([id, datum]) => ({ id, datum }))), { headers: { "content-type": "application/xml; charset=utf-8" } });
    }, 21600);
  }
  if (url.pathname === "/sitemap-auftraggeber.xml") {
    return gecacht("/sitemap-auftraggeber.xml?v=2", async () => {
      const z = await rpc<[string, string][]>(env, "sitemap_auftraggeber_json", {});
      if (!Array.isArray(z)) return new Response("nicht erreichbar", { status: 503 });
      return new Response(sitemapAuftraggeber(adresse, z), { headers: { "content-type": "application/xml; charset=utf-8" } });
    }, 21600);
  }
  const gl = url.pathname.match(/^\/ausschreibungen\/([a-z-]+)\/([a-z-]+)\/?$/);
  if (gl) {
    const g = GEWERKE.find((x) => x.slug === gl[1]), l = BUNDESLAENDER.find((x) => x.slug === gl[2]);
    if (!g) return new Response(null, { status: 301, headers: { location: "/ausschreibungen" } });
    if (!l) return new Response(null, { status: 301, headers: { location: `/ausschreibungen/${g.slug}` } });
    return gecacht(`/ausschreibungen/${g.slug}/${l.slug}?v=2`, async () => {
      const s = await rpc<Statistik>(env, "gewerk_land_statistik", { praefixe: g.cpv, land: l.nuts });
      const titel = `Ausschreibungen ${g.name} ${l.name}`;
      const beschreibung = `Öffentliche Ausschreibungen ${g.name} ${l.im}: ${s?.monat ? `${zahl(s.monat)} in den letzten 30 Tagen, ${zahl(s.offen ?? 0)} offen. ` : ""}Crewtender findet täglich die passenden Aufträge für deinen Betrieb.`;
      const r = antwort(meta(seite(titel, gewerkLandSeite(g, l, s)), beschreibung, `${adresse}/ausschreibungen/${g.slug}/${l.slug}`, s?.monat ? "" : "noindex, follow"));
      r.headers.delete("x-robots-tag");
      return s ? r : null;
    }, 3600);
  }
  const ag = url.pathname.match(/^\/auftraggeber\/([^/]{1,600})$/);
  if (ag) {
    const id = ag[1];
    if (!/^[a-z0-9-]{1,150}$/.test(id)) return new Response(seite("Nicht gefunden", `<p>Diesen Auftraggeber kennt Crewtender nicht. <a href="/ausschreibungen">Aktuelle Ausschreibungen nach Gewerk</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
    return gecacht(`${auftraggeberLink(id)}?v=3`, async () => {
      const a = await rpc<Auftraggeber | null>(env, "auftraggeber_oeffentlich", { a: id });
      if (!a) return new Response(seite("Nicht gefunden", `<p>Diesen Auftraggeber kennt Crewtender nicht. <a href="/ausschreibungen">Aktuelle Ausschreibungen nach Gewerk</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
      const name = personenMaskieren(a.name);
      const beschreibung = `${name}: ${zahl(a.offen_anzahl)} offene und ${zahl(a.jahr)} Ausschreibungen in den letzten 12 Monaten. Frühere Aufträge, Zuschlagswerte und Vertragsenden. Neue Ausschreibungen mit Crewtender per Mail.`.slice(0, 300);
      const r = antwort(meta(seite(`Ausschreibungen ${name}`, auftraggeberSeite(a)), beschreibung, `${adresse}${auftraggeberLink(a.id)}`, a.jahr ? "" : "noindex, follow"));
      r.headers.delete("x-robots-tag");
      return r;
    }, 3600);
  }
  const a = url.pathname.match(/^\/ausschreibung\/([^/]{1,1200})$/);
  if (!a) return null;
  let id = "";
  try { id = decodeURIComponent(a[1]).slice(0, 400); } catch { return null; }
  return gecacht(`/ausschreibung/${encodeURIComponent(id)}?v=4`, async () => {
    const e = await rpc<Eintrag | null>(env, "demo_eintrag", { i: id });
    if (!e) return new Response(seite("Nicht gefunden", `<p>Diese Ausschreibung gibt es nicht mehr. <a href="/ausschreibungen">Aktuelle Ausschreibungen nach Gewerk</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
    const r = antwort(meta(seite(e.titel, ausschreibungSeite(e)), beschreibungMeta(e), `${adresse}${ausschreibungLink(e.id)}`, istOffen(e) ? "" : "noindex, follow"));
    r.headers.delete("x-robots-tag");
    return r;
  }, 3600);
}
