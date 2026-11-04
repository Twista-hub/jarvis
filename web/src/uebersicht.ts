// Overview head (design step 2, Benjamin 04.11.2026): greeting, three key figures and the next deadline with a direct
// button, above "Heute wichtig" and the tiles "Firma auf einen Blick". Pure function, data comes from konto.ts.
import { escape } from "./seite.ts";
import { symbol } from "./symbole.ts";

export type NaechsteFrist = { id: string; titel: string; frist: string; punkte: number | null; status: string };

const BERLIN = "Europe/Berlin";
const TAG = 86400_000;

// Greeting and the date line are built here (they contain names and dates, so the page dictionaries cannot match them).
const TEXTE: Record<string, { gruss: [string, string, string]; locale: string; neu: (n: number) => string; keine: string }> = {
  de: { gruss: ["Guten Morgen", "Guten Tag", "Guten Abend"], locale: "de-DE", neu: (n) => `${n} ${n === 1 ? "neuer passender Auftrag" : "neue passende Aufträge"}`, keine: "Keine neuen Treffer" },
  en: { gruss: ["Good morning", "Good afternoon", "Good evening"], locale: "en-GB", neu: (n) => `${n} new matching ${n === 1 ? "tender" : "tenders"}`, keine: "No new matches" },
  fr: { gruss: ["Bonjour", "Bonjour", "Bonsoir"], locale: "fr-FR", neu: (n) => `${n} ${n === 1 ? "nouvel appel d'offres adapté" : "nouveaux appels d'offres adaptés"}`, keine: "Aucun nouveau résultat" },
  pl: { gruss: ["Dzień dobry", "Dzień dobry", "Dobry wieczór"], locale: "pl-PL", neu: (n) => `Nowe pasujące przetargi: ${n}`, keine: "Brak nowych wyników" },
  es: { gruss: ["Buenos días", "Buenas tardes", "Buenas noches"], locale: "es-ES", neu: (n) => `${n} ${n === 1 ? "nueva licitación adecuada" : "nuevas licitaciones adecuadas"}`, keine: "Sin resultados nuevos" },
  it: { gruss: ["Buongiorno", "Buon pomeriggio", "Buonasera"], locale: "it-IT", neu: (n) => `${n} ${n === 1 ? "nuova gara adatta" : "nuove gare adatte"}`, keine: "Nessun nuovo risultato" },
};
const texte = (sprache: string) => TEXTE[sprache] ?? TEXTE.de;

/** "Guten Morgen" (until 11), "Guten Tag" (until 17), "Guten Abend", in the app language. */
export function gruss(jetzt: Date, sprache = "de"): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: BERLIN, hour: "numeric", hourCycle: "h23" }).format(jetzt));
  return texte(sprache).gruss[h < 11 ? 0 : h < 17 ? 1 : 2];
}

/** Whole calendar days from today to the deadline (Berlin), 0 = today. */
export function tageBisFrist(frist: string, jetzt: Date): number {
  const tag = (d: Date) => Date.parse(d.toLocaleDateString("en-CA", { timeZone: BERLIN }));
  return Math.round((tag(new Date(frist)) - tag(jetzt)) / TAG);
}

const abstandText = (t: number) => (t <= 0 ? "heute" : t === 1 ? "morgen" : `in ${t} Tagen`);

/** Page title of the overview: the greeting ("Guten Morgen, Benjamin"). */
export const uebersichtTitel = (name: string, jetzt: Date, sprache = "de") => `${gruss(jetzt, sprache)}${name ? `, ${name}` : ""}`;

/** Below the greeting (the page title): date, firm and new hits; key figures; next deadline. */
export function uebersichtKopf(o: { firma: string; jetzt: Date; neu: number; bald: number; angebote: number; naechste: NaechsteFrist | null; sprache?: string }): string {
  const t = texte(o.sprache ?? "de");
  const datum = o.jetzt.toLocaleDateString(t.locale, { timeZone: BERLIN, weekday: "long", day: "numeric", month: "long" });
  const zeile = o.neu ? t.neu(o.neu) : t.keine;
  const zahl = (wert: number, text: string, href: string, akzent = false) =>
    `<a class="kennzahl${akzent && wert ? " akzent" : ""}" href="${href}"><strong>${wert}</strong><span>${text}</span></a>`;
  let karte = "";
  if (o.naechste) {
    const t = tageBisFrist(o.naechste.frist, o.jetzt);
    const knopf = o.naechste.status === "angebot" ? "Angebot weiterschreiben" : "Ausschreibung öffnen";
    karte = `<section class="naechste-frist" aria-label="Nächste Frist"><div class="naechste-kopf"><span>Nächste Frist</span><span class="frist-pille${t <= 3 ? " knapp" : ""}">${symbol("uhr", 14)} ${abstandText(t)}</span></div>
<h2>${escape(o.naechste.titel)}</h2>
<p class="naechste-fakten">${o.naechste.punkte ? `<span>${o.naechste.punkte}/10 passend</span>` : ""}<span>Abgabe ${new Date(o.naechste.frist).toLocaleDateString("de-DE", { timeZone: BERLIN, day: "2-digit", month: "2-digit", year: "numeric" })}</span></p>
<a class="knopf" href="/konto/vorgang/${escape(o.naechste.id)}">${knopf} ${symbol("pfeil", 18)}</a></section>`;
  }
  return `<p class="begruessung klein">${escape(datum)} · ${escape(o.firma)} · ${zeile}</p>
<div class="kennzahlen">${zahl(o.neu, o.neu === 1 ? "neuer Treffer" : "neue Treffer", "/konto/treffer", true)}${zahl(o.bald, "Fristen in 7 Tagen", "/konto/fristen")}${zahl(o.angebote, "Angebote in Arbeit", "/konto/angebote")}</div>${karte}`;
}
