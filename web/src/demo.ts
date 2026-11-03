// Demo without registration: the real pages of Jarvis with sample data of a fictitious firm. Nothing is read from or
// written to the database; forms are blocked in the browser (app.js, body[data-demo]) and every link into the app
// is rewritten to the demo. Lets interested firms look around before they register.
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

const FIRMA = "Muster Gebäudeservice GmbH";
const tag = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const montagVon = (heute: string) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

const PERSONEN = [["p1", "Eva", "Schneider", "Servicekraft"], ["p2", "Mehmet", "Kaya", "Reinigungskraft"], ["p3", "Anna", "Nowak", "Reinigungskraft"], ["p4", "Tom", "Becker", "Hausmeister"], ["p5", "Lena", "Wolf", "Servicekraft"]]
  .map(([id, vorname, nachname, beruf]) => ({ id, vorname, nachname, bereich_id: null, status: "verfuegbar", berufe: [beruf] }));

const bewertung = (gesucht: string, warum: string) => `## Jarvis-Bewertung\n\n**Gesucht:** ${gesucht}\n\n**Warum passend:** ${warum}\n\n`;
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
    v(3, "Hausmeisterdienste für Kitas im Kreisgebiet", 7, 9, "neu", bewertung("Hausmeister- und Winterdienst für 11 Kitas", "Hausmeisterdienste gehören zu euren Leistungen; mehrere Lose möglich.") + "## Kurzüberblick\n\n**Lose:** 3 (Nord; Mitte; Süd)\n\n**Geschätzter Auftragswert:** 380.000 €\n\n**Laufzeit:** 36 Monate\n\nHausmeisterdienste einschließlich Winterdienst.", 31),
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

export const DEMO_SEITEN: Record<string, string> = { treffer: "🔎 Ausschreibungen", team: "👥 Firma & Team", schichten: "📅 Schichtplan", stunden: "⏱️ Stundenzettel", leistungsnachweis: "🧾 Leistungsnachweis", app: "🙋 App der Einsatzkräfte" };

/** Links into the app lead to the demo; forms stay but are blocked in the browser. */
export function demoLinks(html: string): string {
  return html
    .replace(/href="\/konto\/vorgang\/(0{8}-0000-4000-8000-0{11}\d)[^"]*"/g, 'href="/demo/ausschreibung/$1"')
    .replace(/href="\/konto\/(treffer|schichten|stunden|leistungsnachweis|team|ich)\b[^"]*"/g, (_, s: string) => `href="/demo/${s === "ich" ? "app" : s}"`)
    .replace(/href="\/konto[^"]*"/g, 'href="/demo"')
    .replace("<body", "<body data-demo");
}

const banner = `<aside class="demo-banner" role="note"><strong>🎬 Demo mit Beispieldaten</strong> – Firma, Personal und Ausschreibungen sind erfunden, nichts wird gespeichert. <a class="knopf" href="/registrieren">Kostenlos registrieren</a></aside>`;
const reiter = (aktiv: string) => `<nav class="ordner-chips demo-reiter" aria-label="Demo">${Object.entries(DEMO_SEITEN).map(([k, t]) => `<a href="/demo/${k}"${k === aktiv ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;

export function demoSeite(pfad: string, heute: string, muster: string, sprache = "de"): { titel: string; inhalt: string } | null {
  const v = vorgaenge(heute, muster);
  const teil = pfad.replace(/^\/demo\/?/, "");
  if (!teil) return { titel: "Jarvis ausprobieren", inhalt: `${banner}<p>So arbeitet <strong>${FIRMA}</strong> mit Jarvis: passende öffentliche Ausschreibungen jeden Morgen, Steckbriefe mit Losen und Stunden, Schichtplan, Stundenzettel und Leistungsnachweis – und eine App für die Einsatzkräfte.</p>
<div class="konto-kacheln team-werkzeuge">${Object.entries(DEMO_SEITEN).map(([k, t]) => `<a class="konto-kachel" href="/demo/${k}"><span class="konto-icon" aria-hidden="true">${t.split(" ")[0]}</span><strong>${escape(t.slice(t.indexOf(" ") + 1))}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
<p><a class="knopf" href="/registrieren">Jetzt kostenlos registrieren</a></p>` };
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

export async function demo(request: Request, muster: string): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/demo" && !url.pathname.startsWith("/demo/")) return null;
  if (request.method !== "GET") return new Response(null, { status: 303, headers: { location: url.pathname } });
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const sprache = SPRACHEN[url.searchParams.get("sprache") ?? ""] ? url.searchParams.get("sprache")! : "de";
  const s = demoSeite(url.pathname, heute, muster, sprache);
  if (!s) return new Response(null, { status: 303, headers: { location: "/demo" } });
  let body = demoLinks(seite(s.titel, s.inhalt));
  if (url.pathname === "/demo/app") body = uebersetzen(body, sprache);
  const r = html(body);
  r.headers.set("cache-control", "public, max-age=300");
  r.headers.set("x-robots-tag", "noindex");
  return r;
}
