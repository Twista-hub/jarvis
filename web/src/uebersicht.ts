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

/** Ten segments for the score (shown as a bar in the technical look, see themen.ts). */
export function punkteBalken(punkte: number): string {
  const n = Math.max(0, Math.min(10, Math.round(punkte)));
  return `<span class="punkte-balken" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i${i < n ? ' class="an"' : ""}></i>`).join("")}</span>`;
}

/** How much of the time between "found" and the deadline has passed (0–100 %). */
export function fristAnteil(erstellt: string, frist: string, jetzt = Date.now()): number {
  const a = Date.parse(erstellt), b = Date.parse(frist);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 100;
  return Math.max(0, Math.min(100, Math.round(((jetzt - a) / (b - a)) * 100)));
}

export function fristBalken(erstellt: string, frist: string, ampel: string, jetzt = Date.now()): string {
  return `<span class="frist-balken frist-${ampel}" aria-hidden="true"><i style="width:${fristAnteil(erstellt, frist, jetzt)}%"></i></span>`;
}

/** Technical look: new hits per day over the last 7 days (Berlin days, oldest first). */
export function siebenTage(erstellt: string[], jetzt: Date): { tag: string; anzahl: number }[] {
  const tagVon = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: BERLIN });
  const heute = Date.parse(tagVon(jetzt));
  const tage = Array.from({ length: 7 }, (_, i) => new Date(heute - (6 - i) * TAG).toISOString().slice(0, 10));
  return tage.map((tag) => ({ tag, anzahl: erstellt.filter((e) => tagVon(new Date(e)) === tag).length }));
}

const WOCHENTAG: Record<string, string[]> = { de: ["SO", "MO", "DI", "MI", "DO", "FR", "SA"], en: ["SU", "MO", "TU", "WE", "TH", "FR", "SA"], fr: ["DI", "LU", "MA", "ME", "JE", "VE", "SA"], pl: ["ND", "PN", "WT", "ŚR", "CZ", "PT", "SB"], es: ["DO", "LU", "MA", "MI", "JU", "VI", "SA"], it: ["DO", "LU", "MA", "ME", "GI", "VE", "SA"] };

/** Technical look only (hidden in the other two): 7-day bars of new hits and a 30-day deadline timeline. */
export function leitstand(o: { erstellt: string[]; fristen: { id: string; titel: string; frist: string }[]; jetzt: Date; sprache?: string }): string {
  const tage = siebenTage(o.erstellt, o.jetzt);
  const max = Math.max(1, ...tage.map((t) => t.anzahl));
  const wt = WOCHENTAG[o.sprache ?? "de"] ?? WOCHENTAG.de;
  const balken = tage.map((t, i) => `<span class="lb${i === 6 ? " heute" : ""}" title="${t.anzahl}"><i style="height:${Math.round((t.anzahl / max) * 100)}%"></i><b>${wt[new Date(`${t.tag}T12:00:00Z`).getUTCDay()]}</b></span>`).join("");
  const kommend = o.fristen.map((f) => ({ ...f, t: tageBisFrist(f.frist, o.jetzt) })).filter((f) => f.t >= 0 && f.t <= 30).slice(0, 4);
  const achse = kommend.map((f) => `<span class="lm${f.t <= 3 ? " knapp" : ""}" style="left:${Math.round((f.t / 30) * 100)}%"></span>`).join("");
  const liste = kommend.map((f) => `<a class="lz" href="/konto/vorgang/${escape(f.id)}"><span class="lp${f.t <= 3 ? " knapp" : ""}"></span><span class="ld">${new Date(f.frist).toLocaleDateString("de-DE", { timeZone: BERLIN, day: "2-digit", month: "2-digit" })}</span><span class="lt">${escape(f.titel)}</span><span class="lr">${f.t} T</span></a>`).join("");
  const summe = tage.reduce((n, t) => n + t.anzahl, 0);
  return `<section class="leitstand nur-technik"><div class="lpanel"><div class="lkopf"><span>Neue Treffer · 7 Tage</span><span>Σ ${summe}</span></div><div class="lbalken">${balken}</div></div>
<div class="lpanel"><div class="lkopf"><span>Fristen · 30 Tage</span><span>${kommend.length}</span></div><div class="lachse">${achse}</div>${liste || `<p class="klein">Keine Fristen in den nächsten 30 Tagen.</p>`}</div></section>`;
}
