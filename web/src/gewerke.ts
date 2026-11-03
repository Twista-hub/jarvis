// Public trade pages for search engines: /ausschreibungen and /ausschreibungen/<gewerk>. Each page shows live numbers
// and recent examples from the tender catalogue (public notice data via gewerk_statistik), what Jarvis does for this
// trade and links to the demo and registration. Plus robots.txt and sitemap.xml.
import { ISO2 } from "./besucher.ts";
import { escape, seite } from "./seite.ts";
import { FR_PFADE } from "./gewerke-fr.ts";
import { LAND_PFADE } from "./gewerke-land.ts";
import { alternativen } from "./gewerke-sprachen.ts";

type Gewerk = { slug: string; name: string; h1: string; cpv: string[]; intro: string; vorteile: string[]; fragen: [string, string][] };
export type Statistik = { monat: number; offen: number; beispiele: { titel: string; auftraggeber: string; ort: string; frist: string | null; link: string }[]; stand?: string };

const ALLGEMEIN: [string, string][] = [
  ["Was kostet Jarvis?", "Die Registrierung ist kostenlos. Du siehst sofort passende Ausschreibungen für deine Firma und kannst alles in Ruhe ausprobieren."],
  ["Woher kommen die Ausschreibungen?", "Aus den amtlichen Bekanntmachungen (Bekanntmachungsservice des Bundes, EU-Amtsblatt TED). Jarvis liest täglich alle neuen Ausschreibungen in Deutschland, rund 500 am Tag."],
];

export const GEWERKE: Gewerk[] = [
  { slug: "elektro", name: "Elektro", h1: "Öffentliche Ausschreibungen für Elektroarbeiten", cpv: ["45311", "45315", "45317", "45310"],
    intro: "Schulen, Kitas, Rathäuser und Wohnungsbaugesellschaften vergeben laufend Elektroinstallation, Beleuchtung, PV-Anlagen und Wartung. Jarvis findet die Aufträge, die zu deinem Betrieb und Einzugsgebiet passen, und sagt in einem Satz, warum.",
    vorteile: ["Elektroinstallation, Sicherheitsbeleuchtung, PV und Wartung getrennt erkannt", "Steckbrief mit Losen, Mengen, Fristen und geforderten Nachweisen (z. B. Eintragung Installateurverzeichnis)", "Kalkulation pro Los mit deinen Stundensätzen"],
    fragen: [["Lohnen sich öffentliche Aufträge für kleine Elektrobetriebe?", "Ja. Viele Ausschreibungen sind in Lose geteilt oder betreffen einzelne Gebäude. Jarvis zeigt dir Größe, Entfernung und Frist auf einen Blick, damit du schnell entscheidest."]] },
  { slug: "sanitaer-heizung-lueftung", name: "Sanitär, Heizung, Lüftung", h1: "Öffentliche Ausschreibungen für Sanitär, Heizung und Lüftung", cpv: ["4533"],
    intro: "Heizungstausch, Lüftungsanlagen, Sanitärsanierung in Schulen und Verwaltungsgebäuden: SHK gehört zu den am häufigsten ausgeschriebenen Gewerken. Jarvis sortiert die passenden Aufträge nach deinem Standort.",
    vorteile: ["SHK-Leistungen aus Neubau und Sanierung, auch wenn sie in großen Bauvorhaben stecken", "Fristen im Kalender, Erinnerung vor Ablauf", "Steckbrief mit Leistungsumfang und Nachweisen"],
    fragen: [["Wie finde ich SHK-Aufträge in meiner Region?", "Bei der Einrichtung gibst du deinen Firmensitz und Umkreis an. Jarvis zeigt dann nur Ausschreibungen in diesem Gebiet, mit Entfernung in Kilometern."]] },
  { slug: "tischler-schreiner", name: "Tischler und Schreiner", h1: "Öffentliche Ausschreibungen für Tischler- und Schreinerarbeiten", cpv: ["45421"],
    intro: "Türen, Fenster, Innenausbau und Einbaumöbel werden bei fast jedem öffentlichen Bau einzeln vergeben. Jarvis findet die Lose, die zu deiner Werkstatt passen.",
    vorteile: ["Tischlerlose aus großen Bauvorhaben herausgefiltert", "Leistungsverzeichnis (GAEB) direkt einlesen und Einheitspreise eintragen", "Hinweis auf geforderte Referenzen"],
    fragen: [["Kann ich ein GAEB-Leistungsverzeichnis mit Jarvis bearbeiten?", "Ja. Jarvis liest GAEB-Dateien, du trägst die Einheitspreise ein und lädst die Datei für die Abgabe wieder herunter."]] },
  { slug: "gebaeudereinigung", name: "Gebäudereinigung", h1: "Öffentliche Ausschreibungen für Gebäudereinigung und Glasreinigung", cpv: ["90911", "90919", "90910"],
    intro: "Unterhaltsreinigung, Glasreinigung und Grundreinigung für Schulen, Kitas und Verwaltung werden oft in Lose aufgeteilt – ideal auch für kleinere Reinigungsfirmen. Jarvis zeigt dir passende Lose mit Flächen, Intervallen und Laufzeit.",
    vorteile: ["Unterhalts-, Glas- und Sonderreinigung getrennt erkannt", "Kalkulation mit Leistungswerten, Tariflohn Gebäudereinigung und Zuschlägen", "Schichtplan, Stundenzettel und Leistungsnachweis für die Objekte gleich mit dabei"],
    fragen: [["Rechnet Jarvis mit dem Branchenmindestlohn Gebäudereinigung?", "Ja. Die Lohngruppen des Rahmentarifvertrags sind hinterlegt; du kannst eigene Löhne und Zuschläge eintragen."]] },
  { slug: "maler-trockenbau", name: "Maler und Trockenbau", h1: "Öffentliche Ausschreibungen für Maler-, Putz- und Trockenbauarbeiten", cpv: ["45442", "45441", "45410", "45324"],
    intro: "Malerarbeiten, Putz und Trockenbau stecken in nahezu jeder Sanierung öffentlicher Gebäude. Jarvis findet die einzelnen Gewerke, auch wenn sie Teil eines großen Bauvorhabens sind.",
    vorteile: ["Maler-, Putz- und Trockenbaulose einzeln erkannt", "Entfernung und Frist auf einen Blick", "Steckbrief mit Mengen und Ausführungszeitraum"],
    fragen: [["Sind das nur große Bauprojekte?", "Nein. Viele Vergaben betreffen einzelne Schulen, Kitas oder Wohnungen und sind für Handwerksbetriebe mit wenigen Mitarbeitern machbar."]] },
  { slug: "dach-zimmerer", name: "Dach und Zimmerer", h1: "Öffentliche Ausschreibungen für Dachdecker- und Zimmererarbeiten", cpv: ["45261", "45422"],
    intro: "Dachsanierungen, Aufstockungen und Holzbau für Kitas und Schulen: Jarvis findet die passenden Ausschreibungen in deinem Umkreis und zeigt Frist, Umfang und Nachweise.",
    vorteile: ["Dach-, Zimmerer- und Holzbaulose erkannt", "Fristen und Bieterfragen im Kalender", "Steckbrief mit Zuschlagskriterien"],
    fragen: [["Muss ich für jede Ausschreibung die Unterlagen lesen?", "Nein. Jarvis fasst die Bekanntmachung zusammen. Wenn du Unterlagen hochlädst, liest Jarvis alle Dokumente und schreibt einen ausführlichen Steckbrief."]] },
  { slug: "garten-landschaftsbau-winterdienst", name: "Garten- und Landschaftsbau", h1: "Öffentliche Ausschreibungen für Grünpflege, Garten- und Landschaftsbau und Winterdienst", cpv: ["77310", "77311", "77313", "77314", "90620", "90630"],
    intro: "Grünflächenpflege, Baumpflege und Winterdienst werden von Kommunen und Wohnungsgesellschaften regelmäßig und oft in Losen vergeben. Jarvis zeigt dir die Aufträge in deinem Gebiet.",
    vorteile: ["Grünpflege, Baumpflege und Winterdienst getrennt erkannt", "Neuausschreibungs-Radar: Verträge, die bald auslaufen", "Schichtplan und Stundenzettel für die Kolonnen"],
    fragen: [["Was ist das Neuausschreibungs-Radar?", "Jarvis merkt sich, wann laufende Verträge enden, und erinnert dich rechtzeitig, bevor dieselbe Leistung neu ausgeschrieben wird."]] },
  { slug: "sicherheitsdienst", name: "Sicherheitsdienst", h1: "Öffentliche Ausschreibungen für Sicherheits- und Bewachungsdienste", cpv: ["79710", "79713", "79714", "79715"],
    intro: "Objektschutz, Empfangsdienst, Streifendienst und Veranstaltungsschutz für Behörden, Kliniken und Unterkünfte. Jarvis findet die Ausschreibungen und prüft die geforderten Nachweise wie Sachkunde § 34a GewO.",
    vorteile: ["Bewachung, Empfang und Veranstaltungsschutz erkannt", "Personalsuche nach Qualifikation (z. B. § 34a) für die Besetzung", "Schichtplan mit offenen Schichten zum Selbst-Übernehmen"],
    fragen: [["Hilft Jarvis bei der Personalplanung?", "Ja. Du siehst, wer frei ist und welche Nachweise gültig sind, planst Schichten und lässt Einsatzkräfte offene Schichten per App übernehmen."]] },
  { slug: "bodenbelaege-fliesen", name: "Bodenbeläge und Fliesen", h1: "Öffentliche Ausschreibungen für Bodenbelags- und Fliesenarbeiten", cpv: ["45432", "45431"],
    intro: "Bodenbeläge, Beschichtungen und Fliesenarbeiten werden bei Sanierungen und Neubauten einzeln vergeben. Jarvis findet die passenden Lose in deinem Umkreis.",
    vorteile: ["Boden- und Fliesenlose aus Bauvorhaben herausgefiltert", "Leistungsverzeichnis (GAEB) einlesen und bepreisen", "Erinnerung an Fristen und Bieterfragen"],
    fragen: [["Wie schnell sehe ich neue Ausschreibungen?", "Jeden Morgen. Auf Wunsch per Mail oder Handy-Nachricht zu deiner Uhrzeit."]] },
  { slug: "zeitarbeit-personaldienstleister", name: "Zeitarbeit und Personaldienstleister", h1: "Öffentliche Ausschreibungen für Zeitarbeit und Arbeitnehmerüberlassung", cpv: ["79620", "79621", "79622", "79624", "79625"],
    intro: "Behörden, Kliniken und Kantinen suchen Leihpersonal für Gastronomie, Reinigung, Büro und Pflege – oft als mehrjähriger Rahmenvertrag. Viele dieser Aufträge laufen nicht unter „Arbeitnehmerüberlassung“, sondern unter der eigentlichen Tätigkeit. Jarvis findet sie trotzdem.",
    vorteile: ["Erkennt Personalbedarf auch in Gastro-, Reinigungs- und Büroausschreibungen", "AÜG-Wächter: Equal Pay, Höchstüberlassungsdauer, Branchenzuschläge", "Stunden, Leistungsnachweis mit Online-Bestätigung durch den Kunden, Lohnliste"],
    fragen: [["Was macht der AÜG-Wächter?", "Er rechnet pro Leiharbeitskraft und Kunde, ab wann Equal Pay und welche Branchenzuschlagsstufe gilt und wann die Höchstüberlassungsdauer endet."]] },
];

const zahl = (n: number) => n.toLocaleString("de-DE");
const datum = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "–";

export function gewerkSeite(g: Gewerk, s: Statistik | null): string {
  const fragen = [...g.fragen, ...ALLGEMEIN];
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fragen.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  return `<h1>${escape(g.h1)}</h1>
<p>${escape(g.intro)}</p>
${s ? `<div class="gewerk-zahlen"><div><strong>${zahl(s.monat)}</strong><span>Ausschreibungen in den letzten 30 Tagen</span></div>${s.offen ? `<div><strong>${zahl(s.offen)}</strong><span>davon noch offen</span></div>` : ""}</div>` : ""}
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos passende Aufträge finden</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>
${s?.beispiele.length ? `<h2>Aktuelle Ausschreibungen (Auswahl)</h2><ul class="kontakt-liste gewerk-beispiele">${s.beispiele.map((b) => `<li><div><strong>${escape(b.titel)}</strong><span class="klein">${escape([b.auftraggeber, b.ort].filter(Boolean).join(" · "))} ${b.frist ? ` · Frist ${datum(b.frist)}` : ""}</span></div></li>`).join("")}</ul><p class="klein">Quelle: amtliche Bekanntmachungen. In Jarvis bekommst du nur die Ausschreibungen, die zu deiner Firma und deinem Gebiet passen, mit Bewertung und Steckbrief.</p>` : ""}
<h2>So hilft Jarvis ${escape(g.name === "Elektro" ? "Elektrobetrieben" : `im Bereich ${g.name}`)}</h2>
<ul>${g.vorteile.map((v) => `<li>${escape(v)}</li>`).join("")}<li>Jeden Morgen die neuen Treffer mit Punkten von 1 bis 10 und einem Satz, warum sie passen</li></ul>
<h2>Häufige Fragen</h2>
${fragen.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>Weitere Gewerke</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Weitere Gewerke">${GEWERKE.filter((x) => x.slug !== g.slug).map((x) => `<a href="/ausschreibungen/${x.slug}">${escape(x.name)}</a>`).join("")}</nav>
<script type="application/ld+json">${jsonld}</script>`;
}

export function uebersichtGewerke(): string {
  return `<h1>Öffentliche Ausschreibungen nach Gewerk</h1><p>Jarvis liest jeden Tag alle neuen öffentlichen Ausschreibungen in Deutschland und zeigt Handwerksbetrieben, Dienstleistern und Personaldienstleistern die passenden. Wähle dein Gewerk:</p>
<div class="konto-kacheln team-werkzeuge">${GEWERKE.map((g) => `<a class="konto-kachel" href="/ausschreibungen/${g.slug}"><strong>${escape(g.name)}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos registrieren</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>`;
}

const meta = (html: string, beschreibung: string, url: string, paar = "") => html.replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">${paar ? `\n${paar}` : ""}`);

export function sitemap(adresse: string): string {
  const pfade = ["/", ...Object.keys(ISO2).map((l) => `/${l.toLowerCase()}`), "/ausschreibungen", ...GEWERKE.map((g) => `/ausschreibungen/${g.slug}`), ...FR_PFADE, ...LAND_PFADE, "/demo", "/us/sam-registration", "/datenschutz", "/impressum"];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pfade.map((p) => `<url><loc>${adresse}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
}
export const ROBOTS = (adresse: string) => `User-agent: *\nAllow: /\nDisallow: /konto\nDisallow: /nachweis/\nDisallow: /portal/\nDisallow: /einladung\nDisallow: /auftrag/\nSitemap: ${adresse}/sitemap.xml\n`;

type GewerkEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; WARTEN?: (p: Promise<unknown>) => void };

export async function gewerke(request: Request, env: GewerkEnv, adresse: string, antwort: (html: string) => Response): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/robots.txt") return new Response(ROBOTS(adresse), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
  if (url.pathname === "/sitemap.xml") return new Response(sitemap(adresse), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
  if (url.pathname === "/ausschreibungen" || url.pathname === "/ausschreibungen/") {
    const r = antwort(meta(seite("Ausschreibungen nach Gewerk", uebersichtGewerke()), "Öffentliche Ausschreibungen für Handwerk, Reinigung, Sicherheitsdienst und Zeitarbeit: Jarvis findet täglich die passenden Aufträge für deine Firma.", `${adresse}/ausschreibungen`, alternativen(adresse, null)));
    r.headers.set("cache-control", "public, max-age=3600");
    r.headers.delete("x-robots-tag");
    return r;
  }
  const m = url.pathname.match(/^\/ausschreibungen\/([a-z-]+)\/?$/);
  const g = m ? GEWERKE.find((x) => x.slug === m[1]) : undefined;
  if (!m) return null;
  if (!g) return new Response(null, { status: 301, headers: { location: "/ausschreibungen" } });
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const schluessel = new Request(`${adresse}/ausschreibungen/${g.slug}?cache=4`);
  const alt = await cache?.match(schluessel).catch(() => undefined);
  if (alt) return alt;
  let s: Statistik | null = null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/gewerk_statistik`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ praefixe: g.cpv }) });
    if (r.ok) s = (await r.json()) as Statistik | null;
  } catch { s = null; }
  const r = antwort(meta(seite(g.h1, gewerkSeite(g, s)), `${g.h1}: ${s ? `${zahl(s.monat)} Ausschreibungen in den letzten 30 Tagen. ` : ""}Jarvis findet täglich die passenden Aufträge für deinen Betrieb – kostenlos registrieren.`, `${adresse}/ausschreibungen/${g.slug}`, alternativen(adresse, g.slug)));
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.delete("x-robots-tag");
  if (cache && s) env.WARTEN?.(cache.put(schluessel, r.clone()).catch(() => undefined));
  return r;
}
