// Demo without registration: the real pages of Crewtender with sample data of a fictitious firm. Nothing is read from or
// written to the database; forms are blocked in the browser (app.js, body[data-demo]) and every link into the app
// is rewritten to the demo. Lets interested firms look around before they register.
import { aboFormular } from "./suchabo.ts";
import { KI_KENNUNG } from "./ki-kennung.ts";
import { escape, markdown, seite } from "./seite.ts";
import { html, trefferListe, frageMarken, unterlagenHinweis } from "./konto.ts";
import { schichtenSeite, type Schicht } from "./schichten.ts";
import { stundenSeite, type Eintrag } from "./stunden.ts";
import { gruppieren, nachweisSeite } from "./leistungsnachweis.ts";
import { teamKopfHtml } from "./teamkopf.ts";
import { ichSeite } from "./ich.ts";
import { stempelTeil } from "./stempel.ts";
import { offeneSchichtenTeil } from "./schichten.ts";
import { meineSpesenTeil } from "./spesen.ts";
import { SPRACHEN, sprachWahl, uebersetzen } from "./sprache.ts";
import { appSprache } from "./englisch.ts";
import { leitstand, uebersichtKopf, uebersichtTitel } from "./uebersicht.ts";
import { fristenSeite } from "./fristen.ts";
import { personenMaskieren } from "./datensparsam.ts";

const FIRMA = "Muster Gebäudeservice GmbH";
const tag = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const montagVon = (heute: string) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

const PERSONEN = [["p1", "Eva", "Schneider", "Servicekraft"], ["p2", "Mehmet", "Kaya", "Reinigungskraft"], ["p3", "Anna", "Nowak", "Reinigungskraft"], ["p4", "Tom", "Becker", "Hausmeister"], ["p5", "Lena", "Wolf", "Servicekraft"]]
  .map(([id, vorname, nachname, beruf]) => ({ id, vorname, nachname, bereich_id: null, status: "verfuegbar", berufe: [beruf] }));

const bewertung = (gesucht: string, warum: string) => `## Crewtender-Bewertung\n\n**Gesucht:** ${gesucht}\n\n**Warum passend:** ${warum}\n\n`;
const KURZ = `## Auf einen Blick

| | |
|---|---|
| **Auftraggeber** | Stadtverwaltung Musterstadt, Zentrale Vergabestelle |
| **Was** | Unterhaltsreinigung von 4 Schulen und 2 Verwaltungsgebäuden, 2 Lose |
| **Laufzeit** | ab 01.02.2027, 24 Monate, Verlängerung um 2 × 12 Monate möglich |
| **Umfang** | geschätzter Gesamtwert laut Bekanntmachung 1.400.000 EUR; Mengen je Los nicht angegeben |
| **Zuschlag** | nicht angegeben |

## ⏰ Fristen

Angebotsabgabe elektronisch über das Vergabeportal; Rückfragen bis 10 Tage vor Ablauf, genaue Uhrzeit nicht angegeben. Vermutlich ist eine Ortsbesichtigung vorgesehen.

## Die Lose / Leistungen

| Los | Leistung | Ort | Menge |
|---|---|---|---|
| 1 | Unterhaltsreinigung Schulen | Musterstadt | nicht angegeben |
| 2 | Unterhalts- und Glasreinigung Verwaltung | Musterstadt | nicht angegeben |

## Passt das zum Kunden? 8/10

**Dafür spricht:** Kerngeschäft Unterhaltsreinigung, Leistungsort im Einzugsgebiet, lange Laufzeit.

**Worauf achten:** Mengen, Reinigungsintervalle und Eignungsnachweise stehen erst in den Vergabeunterlagen.
`;

/** Sample tenders (ids are fixed so the links lead to the demo detail pages). */
function vorgaenge(heute: string, muster: string) {
  const v = (n: number, titel: string, punkte: number, frist: number, status: string, steckbrief: string, km: number) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, titel, link: "https://www.evergabe-online.de", frist: `${tag(heute, frist)}T10:00:00Z`, status, punkte, erstellt: `${tag(heute, -n)}T06:00:00Z`, bereich_id: null, steckbrief, entfernung_km: km });
  return [
    v(1, "Rahmenvereinbarung Leihpersonal für die Gastronomie", 9, 18, "angebot", bewertung("Servicekräfte und Köche für Kantine und Bankett", "Arbeitnehmerüberlassung in der Gastronomie ist euer Kerngeschäft; Einsatzort im Umkreis.") + muster, 12),
    v(2, "Unterhaltsreinigung Schulen und Verwaltung Musterstadt", 8, 26, "pruefen", bewertung("Unterhalts- und Glasreinigung in 6 Gebäuden", "Reinigung öffentlicher Gebäude, passend zu euren Leistungen und Standorten.") + KURZ, 24),
    v(3, "Hausmeisterdienste für Kitas im Kreisgebiet", 7, 6, "neu", bewertung("Hausmeister- und Winterdienst für 11 Kitas", "Hausmeisterdienste gehören zu euren Leistungen; mehrere Lose möglich.") + "## Kurzüberblick\n\n**Lose:** 3 (Nord; Mitte; Süd)\n\n**Geschätzter Auftragswert:** 380.000 €\n\n**Laufzeit:** 36 Monate\n\nHausmeisterdienste einschließlich Winterdienst.", 31),
    v(4, "Glasreinigung Rathaus und Stadtbibliothek", 6, 40, "neu", bewertung("Glas- und Rahmenreinigung zweimal jährlich", "Kleiner, gut planbarer Auftrag in der Nähe.") + "## Kurzüberblick\n\n**Geschätzter Auftragswert:** 45.000 €\n\n**Laufzeit:** 24 Monate", 8),
  ];
}

function schichten(heute: string): Schicht[] {
  const m = montagVon(heute);
  const s = (id: string, p: string | null, d: number, b: string, e: string, ort: string, antwort: string, beruf = "") => ({ id, personal_id: p, bereich_id: null, datum: tag(m, d), beginn: `${b}:00`, ende: `${e}:00`, ort, notiz: "", antwort, beruf });
  return [s("s1", "p1", 0, "06:00", "14:30", "Kantine Rathaus", "zugesagt"), s("s2", "p2", 0, "17:00", "21:00", "Grundschule Nord", "zugesagt"), s("s3", "p3", 1, "17:00", "21:00", "Grundschule Nord", "offen"),
    s("s4", "p4", 1, "07:00", "15:30", "Kita Sonnenschein", "zugesagt"), s("s5", "p5", 2, "10:00", "18:00", "Messe Halle 3", "abgesagt"), s("s6", null, 3, "06:00", "14:30", "Kantine Rathaus", "", "Servicekraft"),
    s("s7", "p2", 3, "17:00", "21:00", "Verwaltung Am Markt", "zugesagt"), s("s8", "p1", 4, "06:00", "14:30", "Kantine Rathaus", "zugesagt")];
}

function stunden(heute: string): Eintrag[] {
  const e = (id: string, p: string, d: number, b: string, en: string, pause: number, einsatz: string, status: string, kunde: string | null) => ({ id, personal_id: p, datum: tag(heute, d), beginn: `${b}:00`, ende: `${en}:00`, pause_min: pause, einsatz, notiz: "", status, kunde_id: kunde });
  return [e("e1", "p1", -1, "06:00", "14:30", 30, "Kantine Rathaus", "erfasst", "k1"), e("e2", "p1", -2, "06:00", "14:30", 30, "Kantine Rathaus", "freigegeben", "k1"), e("e3", "p2", -1, "17:00", "21:00", 0, "Grundschule Nord", "erfasst", "k2"),
    e("e4", "p2", -2, "17:00", "21:00", 0, "Grundschule Nord", "freigegeben", "k2"), e("e5", "p4", -1, "07:00", "17:30", 30, "Kita Sonnenschein", "erfasst", "k2"), e("e6", "p5", -3, "22:00", "06:00", 30, "Messe Halle 3", "freigegeben", "k3")];
}
const KUNDEN = [{ id: "k1", name: "Stadt Musterstadt – Rathaus" }, { id: "k2", name: "Schulverband Nord" }, { id: "k3", name: "Messe Musterstadt GmbH" }] as never[];

export const DEMO_SEITEN: Record<string, string> = { treffer: "🔎 Ausschreibungen", suche: "🌐 Echte Ausschreibungen", fristen: "⏰ Fristen", team: "👥 Firma & Team", schichten: "📅 Schichtplan", stunden: "⏱️ Stundenzettel", leistungsnachweis: "🧾 Leistungsnachweis", app: "🙋 App der Einsatzkräfte" };

/** Links into the app lead to the demo; forms stay but are blocked in the browser. */
export function demoLinks(html: string): string {
  return html
    .replace(/href="\/konto\/vorgang\/(0{8}-0000-4000-8000-0{11}\d)[^"]*"/g, 'href="/demo/ausschreibung/$1"')
    .replace(/href="\/konto\/(treffer|fristen|schichten|stunden|leistungsnachweis|team|ich)\b[^"]*"/g, (_, s: string) => `href="/demo/${s === "ich" ? "app" : s}"`)
    .replace(/href="\/konto\/plan[^"]*"/g, 'href="/preise"')
    .replace(/href="\/konto[^"]*"/g, 'href="/demo"')
    .replace("<body", "<body data-demo");
}

const tageBis = (frist: string, heute: string) => Math.round((Date.parse(frist.slice(0, 10)) - Date.parse(heute)) / 86400_000);
const datumDe = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "");

/** Search form for the real public notices; data-demo-frei lets it through the demo's form block (app.js). */
export function suchFormular(q: string, ort: string, alle: boolean): string {
  return `<form method="get" action="/demo/suche" class="demo-suche" data-demo-frei><label>Stichwort<input name="q" value="${escape(q)}" maxlength="120" placeholder="z. B. Unterhaltsreinigung, Sicherheitsdienst, Maler"></label><label>Ort oder PLZ<input name="ort" value="${escape(ort)}" maxlength="60" placeholder="z. B. Köln oder 50"></label><label class="haken"><input type="checkbox" name="alle" value="1"${alle ? " checked" : ""}> auch abgelaufene (Archiv)</label><button>Suchen</button></form>`;
}

export type DemoTreffer = { id: string; titel: string; auftraggeber: string; ort: string; frist: string | null; link: string; status: string; quelle: string; steckbrief: boolean };
export type DemoBeispiel = { katalog_id: string; titel: string; auftraggeber: string; ort: string; frist: string | null; gewerk: string };
export type DemoEintrag = { id: string; titel: string; auftraggeber?: string; ort?: string; frist: string | null; link: string; status?: string; beschreibung?: string; lose?: string[]; steckbrief: string | null };

const ECHT_BANNER = `<aside class="demo-banner" role="note"><strong>📢 Echte öffentliche Ausschreibung</strong> aus amtlicher Quelle. Crewtender findet jeden Morgen die passenden Ausschreibungen für deine Firma. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>`;
const katalogLink = (id: string) => `/demo/katalog/${encodeURIComponent(id)}`;
const QUELLEN: Record<string, string> = { bks: "Bekanntmachungsservice des Bundes", ted: "TED (EU-Amtsblatt)", boamp: "BOAMP (Frankreich)" };
const KI_FENSTER = `<aside class="hinweis demo-ki">🤖 <strong>Passt das zu deiner Firma?</strong> Nach der Anmeldung bewertet die KI jede neue Ausschreibung für deine Firma (1–10 Punkte mit Begründung) und schreibt Steckbriefe zu den besten Treffern. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>`;

export function demoSuchSeite(o: { q: string; ort: string; alle: boolean; treffer: DemoTreffer[] | null; beispiele: DemoBeispiel[] }): string {
  const gesucht = !!(o.q || o.ort || o.alle);
  const liste = o.treffer === null ? `<p class="fehler">Die Suche ist gerade nicht erreichbar. Bitte später noch einmal.</p>`
    : !o.treffer.length ? `<p>Keine ${o.alle ? "" : "offenen "}Ausschreibungen gefunden. Versuch ein anderes Stichwort${o.alle ? "" : " oder „auch abgelaufene“"}.</p>`
    : `<p class="klein">${o.treffer.length === 30 ? "Die 30 neuesten Treffer" : `${o.treffer.length} ${o.treffer.length === 1 ? "Treffer" : "Treffer"}`}${gesucht ? "" : " – die neuesten offenen Ausschreibungen"}.</p><ul class="kontakt-liste demo-katalog">${o.treffer.map((t) => `<li><div><a href="${katalogLink(t.id)}"><strong>${escape(t.titel)}</strong></a><span class="klein">${escape([t.auftraggeber, t.ort].filter(Boolean).join(" · "))}${t.frist ? ` · Frist ${datumDe(t.frist)}` : ""}${t.steckbrief ? " · 📄 Beispiel-Steckbrief" : ""}</span></div></li>`).join("")}</ul>`;
  const beispiele = o.beispiele.length ? `<h2>Beispiel-Steckbriefe zu echten Ausschreibungen</h2><p class="klein">Neutral, nur aus der öffentlichen Bekanntmachung geschrieben – so sieht ein Steckbrief in Crewtender aus.</p><ul class="kontakt-liste demo-katalog">${o.beispiele.map((b) => `<li><div><a href="${katalogLink(b.katalog_id)}"><strong>${escape(b.titel)}</strong></a><span class="klein">${escape([b.auftraggeber, b.ort].filter(Boolean).join(" · "))}${b.frist ? ` · Frist ${datumDe(b.frist)}` : ""}</span></div></li>`).join("")}</ul>` : "";
  return `${banner}${reiter("suche")}<p>Hier suchst du in den <strong>echten öffentlichen Ausschreibungen</strong> aus den amtlichen Quellen – mit deinen eigenen Stichwörtern und deiner Region. In der Demo ohne KI: Treffer nach Stichworten.</p>${suchFormular(o.q, o.ort, o.alle)}${liste}${o.treffer === null ? "" : aboFormular(o.q, o.ort)}${KI_FENSTER}${beispiele}<p class="klein">Quelle: amtliche Bekanntmachungen (u. a. Bekanntmachungsservice des Bundes, TED). Namen von Ansprechpersonen blendet Crewtender aus.</p>`;
}

export function demoKatalogSeite(e: DemoEintrag): string {
  const fakten = [e.auftraggeber && `<li>🏛️ ${escape(e.auftraggeber)}</li>`, e.ort && `<li>📍 ${escape(e.ort)}</li>`, e.frist && `<li>⏰ Frist ${datumDe(e.frist)}</li>`].filter(Boolean).join("");
  const lose = e.lose?.filter(Boolean).length ? `<h2>Lose</h2><ul>${e.lose.filter(Boolean).map((l) => `<li>${escape(personenMaskieren(l))}</li>`).join("")}</ul>` : "";
  const brief = e.steckbrief
    ? `<h2 id="steckbrief">Beispiel-Steckbrief</h2><p class="klein">Neutral, nur aus der öffentlichen Bekanntmachung geschrieben, ohne Bezug zu einer Firma. Nach der Anmeldung bekommst du Steckbriefe mit Bewertung für deine Firma – und aus hochgeladenen Vergabeunterlagen mit Losen, Mengen und Stunden.</p><div class="steckbrief-karte" data-ki-erstellt="true" data-ki-anbieter="Anthropic Claude">${KI_KENNUNG}${markdown(personenMaskieren(e.steckbrief))}</div>`
    : `${e.beschreibung ? `<h2>Beschreibung (aus der Bekanntmachung)</h2>${personenMaskieren(e.beschreibung).split(/\n{2,}/).slice(0, 8).map((x) => `<p>${escape(x)}</p>`).join("")}` : ""}${lose}<p class="klein">Zu dieser Ausschreibung gibt es in der Demo keinen Steckbrief. Nach der Anmeldung schreibt Crewtender Steckbriefe zu deinen besten Treffern. <a href="/demo/suche">Beispiel-Steckbriefe ansehen</a></p>`;
  return `${ECHT_BANNER}${reiter("suche")}<ul class="kopf-chips">${fakten}</ul>${e.link ? `<p><a class="knopf zweit" href="${escape(e.link)}" rel="noopener" target="_blank">Zur Bekanntmachung beim Auftraggeber ↗</a></p>` : ""}${brief}${KI_FENSTER}<p><a href="/demo/suche">← Zur Suche</a></p>`;
}

type DemoEnv = { SUPABASE_URL: string; SUPABASE_KEY: string };
async function rpc<T>(env: DemoEnv, name: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

const banner = `<aside class="demo-banner" role="note"><strong>🎬 Demo mit Beispieldaten</strong> – Firma, Personal und Beispiel-Ausschreibungen sind erfunden, nichts wird gespeichert. Unter „Echte Ausschreibungen“ suchst du in den amtlichen Bekanntmachungen. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>`;
const reiter = (aktiv: string) => `<nav class="ordner-chips demo-reiter" aria-label="Demo">${Object.entries(DEMO_SEITEN).map(([k, t]) => `<a href="/demo/${k}"${k === aktiv ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;

/** `sprache`: language of the worker app preview (/demo/app); `seitenSprache`: language of the visitor (greeting and date of the overview). */
export function demoSeite(pfad: string, heute: string, muster: string, sprache = "de", seitenSprache = "de"): { titel: string; inhalt: string } | null {
  const v = vorgaenge(heute, muster);
  const teil = pfad.replace(/^\/demo\/?/, "");
  if (!teil) {
    const jetzt = new Date(`${heute}T07:30:00Z`);
    const naechste = v.find((x) => x.status === "neu") ?? v[0];
    const kopf = uebersichtKopf({ firma: FIRMA, jetzt, neu: 3, bald: v.filter((x) => tageBis(x.frist, heute) <= 7).length, angebote: v.filter((x) => x.status === "angebot").length,
      naechste: { id: naechste.id, titel: naechste.titel, frist: naechste.frist, punkte: naechste.punkte, status: naechste.status }, sprache: seitenSprache });
    const erstellt = [0, 0, -1, -2, -2, -2, -4, -5, -6].map((n) => `${tag(heute, n)}T06:00:00Z`);
    return { titel: uebersichtTitel("Eva", jetzt, seitenSprache), inhalt: `${banner}${kopf}${leitstand({ erstellt, fristen: v.map((x) => ({ id: x.id, titel: x.titel, frist: x.frist })), jetzt, sprache: seitenSprache })}
<h2>Echte Ausschreibungen durchsuchen</h2><p class="klein">Probiere es mit deinem Gewerk und deiner Region: Crewtender sucht in den amtlichen Bekanntmachungen, ohne Anmeldung.</p>${suchFormular("", "", false)}
<h2>Firma auf einen Blick</h2><p class="klein">So arbeitet <strong>${FIRMA}</strong> mit Crewtender: passende Ausschreibungen jeden Morgen, Steckbriefe mit Losen und Stunden, Fristen, Schichtplan, Stundenzettel und Leistungsnachweis – und eine App für die Einsatzkräfte.</p>
<div class="konto-kacheln team-werkzeuge">${Object.entries(DEMO_SEITEN).map(([k, t]) => `<a class="konto-kachel" href="/demo/${k}"><span class="konto-icon" aria-hidden="true">${t.split(" ")[0]}</span><strong>${escape(t.slice(t.indexOf(" ") + 1))}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
<h2>Darstellung</h2><p class="klein">Crewtender gibt es hell, dunkel und technisch. Probier es aus:</p>
<div class="darstellung"><label>Farben<select data-darstellung="theme"><option value="">Wie am Gerät (hell oder dunkel)</option><option value="light">Hell · Glas</option><option value="dark">Dunkel · Premium</option><option value="technik">Technisch</option></select></label><label>Schrift<select data-darstellung="schrift"><option value="">Normal</option><option value="gross">Groß</option></select></label></div>
<p><a class="knopf" href="/registrieren">Jetzt kostenlos registrieren</a> <a class="knopf zweit" href="/preise">Preise ansehen</a></p>` };
  }
  if (teil === "suche") return { titel: "Echte Ausschreibungen", inhalt: demoSuchSeite({ q: "", ort: "", alle: false, treffer: null, beispiele: [] }) };
  if (teil === "fristen") {
    const liste = v.map((x) => ({ id: x.id, titel: x.titel, frist: x.frist, status: x.status }));
    return { titel: "Fristen", inhalt: `${banner}${reiter("fristen")}${fristenSeite(liste, { erledigte: false, monat: heute.slice(0, 7), zustaendig: () => "", kalkuliert: new Set([v[0].id]), jetzt: Date.parse(`${heute}T07:30:00Z`) })}` };
  }
  if (teil === "treffer") return { titel: "Ausschreibungen", inhalt: `${banner}${reiter("treffer")}${trefferListe(v as never, () => "", "", "/demo/treffer")}` };
  const a = teil.match(/^ausschreibung\/(0{8}-0000-4000-8000-0{11}\d)$/);
  if (a) {
    const x = v.find((y) => y.id === a[1]);
    if (!x) return null;
    const ausUnterlagen = x.id.endsWith("1");
    const brief = `<div class="steckbrief-karte" data-ki-erstellt="true" data-ki-anbieter="Anthropic Claude">${KI_KENNUNG}${markdown(x.steckbrief)}</div>`;
    const marken = ausUnterlagen ? { html: brief, anzahl: 0 } : frageMarken(brief);
    return { titel: x.titel, inhalt: `${banner}${reiter("treffer")}<ul class="kopf-chips"><li class="punkte">${x.punkte}/10</li><li>⏰ Frist ${new Date(x.frist).toLocaleDateString("de-DE")}</li><li>📍 ${x.entfernung_km} km</li></ul>
<h2 id="steckbrief">${ausUnterlagen ? "Steckbrief aus den Vergabeunterlagen" : "Steckbrief aus der Bekanntmachung"}</h2>${ausUnterlagen ? `<p class="klein">So sieht ein Steckbrief aus, nachdem die Vergabeunterlagen hochgeladen wurden: Lose mit Mengen und Stunden, Personal je Los, Nachweise, Fristen.</p>` : `<p class="klein">Ohne hochgeladene Unterlagen: Angaben aus der öffentlichen Bekanntmachung. Das Symbol zeigt, was erst in den Unterlagen steht.</p>`}${marken.html}${ausUnterlagen ? "" : unterlagenHinweis(x.steckbrief, x.link, false)}` };
  }
  if (teil === "team") return { titel: "Firma & Team", inhalt: `${banner}${reiter("team")}${teamKopfHtml({ nachweiseAbgelaufen: 1, nachweiseBald: 2, zertifikate: 0, unterweisungen: 3, profilFehlt: false, stunden: 3, abgesagt: 1, psa: 1, bewerber: 2, spesen: 1, anlaesse: [{ name: "Mehmet Kaya", art: "geburtstag", jahre: 34, tag: tag(heute, 2) }, { name: "Eva Schneider", art: "jubilaeum", jahre: 5, tag: heute }] }, true, true, { finanzen: true, heute })}` };
  if (teil === "schichten") return { titel: "Schichtplan", inhalt: `${banner}${reiter("schichten")}${schichtenSeite(schichten(heute), PERSONEN, [], { montag: montagVon(heute), heute, darfAendern: true, bereiche: [] })}` };
  if (teil === "stunden") return { titel: "Stundenzettel", inhalt: `${banner}${reiter("stunden")}${stundenSeite(stunden(heute), PERSONEN, { monat: heute.slice(0, 7), heute, nurOffen: false, darfAendern: true, land: "NW" })}` };
  if (teil === "leistungsnachweis") return { titel: "Leistungsnachweis", inhalt: `${banner}${reiter("leistungsnachweis")}${nachweisSeite(gruppieren(stunden(heute), KUNDEN), { monat: heute.slice(0, 7), land: "NW", saetze: { k1: 31.5, k2: 28.9, k3: 34 }, darfAendern: true })}` };
  if (teil === "app") {
    const jetzt = new Date(`${heute}T07:15:00Z`).toISOString();
    const oben = stempelTeil([{ art: "kommen", zeit: new Date(`${heute}T05:02:00Z`).toISOString(), einsatz: "Kantine Rathaus", am_ort: true }], [], jetzt) + offeneSchichtenTeil([schichten(heute)[5]]);
    const html = ichSeite({ ich: { id: "p1", firma_id: "f", vorname: "Eva", nachname: "Schneider", berufe: ["Servicekraft"], qualifikationen: ["Hygieneschulung"], status: "verfuegbar" } as never, auftraege: [], ueberlassungen: [], abwesenheiten: [], nachweise: [], unterweisungen: [], heute,
      stunden: stunden(heute).filter((e) => e.personal_id === "p1"), schichten: schichten(heute).filter((s) => s.personal_id === "p1"), oben, unten: meineSpesenTeil([{ id: "x1", personal_id: "p1", datum: tag(heute, -2), art: "parken", betrag: 6, notiz: "", beleg_mime: "image/jpeg", status: "erfasst" }], heute), zeitkontoText: `<p class="klein urlaub-konto">⚖️ Zeitkonto: <strong>+4:30 Std.</strong> (Stand heute, freigegebene Stunden)</p>` });
    const wahl = sprachWahl(sprache).replace(/\/konto\/ich\?sprache=/g, "/demo/app?sprache=");
    return { titel: "Meine Einsätze & Daten", inhalt: `${banner}${reiter("app")}<p class="klein">So sieht die App für Einsatzkräfte aus – auch in ${Object.values(SPRACHEN).slice(1).map((s) => s.name).join(", ")}.</p>${wahl}${html}` };
  }
  return null;
}

/** Real public notices (search, one notice): read through the public demo functions, cached at the edge for 10 minutes. */
async function echteSeite(url: URL, env: DemoEnv): Promise<{ titel: string; inhalt: string } | null> {
  if (url.pathname === "/demo/suche") {
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120), ort = (url.searchParams.get("ort") ?? "").trim().slice(0, 60), alle = url.searchParams.get("alle") === "1";
    const [treffer, beispiele] = await Promise.all([rpc<DemoTreffer[]>(env, "demo_suche", { suche: q, gebiet: ort, zustand: alle ? "alle" : "offen" }), rpc<DemoBeispiel[]>(env, "demo_steckbriefe", {})]);
    return { titel: "Echte Ausschreibungen", inhalt: demoSuchSeite({ q, ort, alle, treffer, beispiele: q || ort ? [] : beispiele ?? [] }) };
  }
  const k = url.pathname.match(/^\/demo\/katalog\/([^/]{1,1200})$/);
  if (!k) return null;
  let id = "";
  try { id = decodeURIComponent(k[1]).slice(0, 400); } catch { return null; }
  const e = (await rpc<DemoEintrag | null>(env, "demo_eintrag", { i: id })) ?? (await rpc<DemoEintrag | null>(env, "demo_steckbrief", { i: id }));
  return e ? { titel: e.titel, inhalt: demoKatalogSeite(e) } : null;
}

export async function demo(request: Request, muster: string, env?: DemoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/demo" && !url.pathname.startsWith("/demo/")) return null;
  if (request.method !== "GET") return new Response(null, { status: 303, headers: { location: url.pathname } });
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const sprache = SPRACHEN[url.searchParams.get("sprache") ?? ""] ? url.searchParams.get("sprache")! : "de";
  if (env && (url.pathname === "/demo/suche" || url.pathname.startsWith("/demo/katalog/"))) {
    const cache = typeof caches === "undefined" ? null : (caches as unknown as { default: Cache }).default;
    const schluessel = new Request(url.toString(), { method: "GET" });
    const alt = await cache?.match(schluessel).catch(() => undefined);
    if (alt) return alt;
    const e = await echteSeite(url, env);
    if (!e) return new Response(null, { status: 303, headers: { location: "/demo/suche" } });
    const r = html(demoLinks(seite(e.titel, e.inhalt)));
    r.headers.set("cache-control", "public, max-age=600");
    r.headers.set("x-robots-tag", "noindex");
    if (cache && !e.inhalt.includes('class="fehler"')) await cache.put(schluessel, r.clone()).catch(() => undefined);
    return r;
  }
  const s = demoSeite(url.pathname, heute, muster, sprache, appSprache(request));
  if (!s) return new Response(null, { status: 303, headers: { location: "/demo" } });
  let body = demoLinks(seite(s.titel, s.inhalt));
  if (url.pathname === "/demo/app") body = uebersetzen(body, sprache);
  const r = html(body);
  r.headers.set("cache-control", "public, max-age=300");
  r.headers.set("x-robots-tag", "noindex");
  return r;
}
