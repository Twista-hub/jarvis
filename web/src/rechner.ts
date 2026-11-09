// Public tools without login (09.11.2026, from the competitor analysis docs/wettbewerb.md):
//  /stundensatz-rechner – hourly rate from wage, ancillary costs, time off, surcharges, overhead and profit. Same formula
//    as the calculation in the app (kalkulation.ts), computed on the server from a GET form: no script, no storage,
//    no AI, nothing saved.
//  /vergleich – honest comparison by category (tender service + rota software vs. Crewtender), no competitor names,
//    only facts we can prove (§ 6 UWG); price ranges with the date of the check.
import { BRANCHEN_VORLAGEN, euro, fmt, mindestlohnHeute, preisGrafik, rechnen, STANDARD, zahl, type Eingaben } from "./kalkulation.ts";
import { escape, seite } from "./seite.ts";

type Feld = { key: keyof Eingaben; label: string; einheit: string; min: number; max: number; hilfe: string };
const FELDER: Feld[] = [
  { key: "lohn", label: "Stundenlohn brutto", einheit: "€", min: 0, max: 200, hilfe: "Tariflohn oder euer eigener Lohn" },
  { key: "nebenkosten", label: "Lohnnebenkosten", einheit: "%", min: 0, max: 60, hilfe: "Sozialversicherung, Umlagen, BG (meist 21–25 %)" },
  { key: "ausfall", label: "Ausfallzeiten", einheit: "%", min: 0, max: 60, hilfe: "Urlaub, Krankheit, Feiertage (meist 15–25 %)" },
  { key: "anteilNacht", label: "Anteil Nachtstunden", einheit: "%", min: 0, max: 100, hilfe: "mit 25 % Zuschlag gerechnet" },
  { key: "anteilSonntag", label: "Anteil Sonntagsstunden", einheit: "%", min: 0, max: 100, hilfe: "mit 50 % Zuschlag gerechnet" },
  { key: "fahrt", label: "Fahrtkosten pro Tag", einheit: "€", min: 0, max: 500, hilfe: "pro Kraft und Arbeitstag (8 Stunden)" },
  { key: "gemeinkosten", label: "Gemeinkosten", einheit: "%", min: 0, max: 100, hilfe: "Büro, Disposition, Versicherungen, Software" },
  { key: "gewinn", label: "Wagnis und Gewinn", einheit: "%", min: 0, max: 100, hilfe: "euer Aufschlag" },
];

/** Values from the query (the form sends GET); unknown or out-of-range values fall back to the sector template. */
export function rechnerWerte(url: URL): { branche: string; werte: Eingaben } {
  const b = url.searchParams.get("branche") ?? "";
  const branche = b in BRANCHEN_VORLAGEN ? b : "reinigung";
  const werte: Eingaben = { ...STANDARD, ...BRANCHEN_VORLAGEN[branche].werte, lohn: Math.max(STANDARD.lohn, mindestlohnHeute()) };
  for (const f of FELDER) {
    const roh = url.searchParams.get(f.key);
    if (roh === null || roh.trim() === "") continue;
    const v = zahl(roh, werte[f.key]);
    if (v >= f.min && v <= f.max) werte[f.key] = v;
  }
  return { branche, werte };
}

export function rechnerSeite(url: URL): string {
  const { branche, werte } = rechnerWerte(url);
  const gerechnet = url.searchParams.has("lohn");
  const r = rechnen(werte, [], {});
  const ml = mindestlohnHeute();
  return `<h1>Stundensatz-Rechner für Dienstleister und Handwerk</h1>
<p>Was muss eine Stunde kosten, damit sich der Auftrag rechnet? Lohn eintragen, Werte anpassen, rechnen. Kostenlos, ohne Anmeldung. Es wird nichts gespeichert.</p>
<form method="get" action="/stundensatz-rechner" class="upload-felder rechner-form">
<label class="ganz">Branche (Startwerte)<select name="branche">${Object.entries(BRANCHEN_VORLAGEN).map(([id, v]) => `<option value="${id}"${id === branche ? " selected" : ""}>${escape(v.name)}</option>`).join("")}</select></label>
${FELDER.map((f) => `<label>${f.label} (${f.einheit})<input name="${f.key}" inputmode="decimal" value="${fmt(werte[f.key])}"><span class="klein">${f.hilfe}</span></label>`).join("\n")}
<button class="ganz">Stundensatz berechnen</button></form>
<p class="klein">Beim Wechsel der Branche bitte erneut auf „Stundensatz berechnen“ tippen; dann gelten die Startwerte dieser Branche für die leeren Felder.</p>
<section class="rechner-ergebnis" aria-live="polite">
<h2>${gerechnet ? "Ergebnis" : "Beispiel mit Startwerten"}: <strong>${euro(r.preisProStunde)}</strong> pro Stunde (netto)</h2>
${preisGrafik(r.schritte, r.preisProStunde)}
<table class="rechner-tabelle"><tbody>${r.schritte.map((s) => `<tr><td>${escape(s.name)}</td><td>${euro(s.betrag)}</td></tr>`).join("")}<tr><td><strong>= Verrechnungssatz</strong></td><td><strong>${euro(r.preisProStunde)}</strong></td></tr></tbody></table>
<p>Untergrenze ohne Gewinn: <strong>${euro(r.untergrenze)}</strong> pro Stunde. Darunter verliert ihr mit jeder Stunde Geld.</p>
${r.warnungen.length ? `<ul class="hinweis">${r.warnungen.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>` : ""}
<p class="klein">Gesetzlicher Mindestlohn heute: ${fmt(ml)} €. Branchenmindestlöhne (z. B. Gebäudereinigung, Sicherheit) liegen höher und gelten für allgemeinverbindliche Tarifverträge. Ergebnis ohne Gewähr, Richtwerte für die Kalkulation.</p>
</section>
<section class="start-statt"><h2>In Crewtender geht es weiter</h2><p>In der App rechnet Crewtender genauso – aber pro Los einer echten Ausschreibung, mit hinterlegten Tariftabellen, Feiertags- und Überstundenzuschlägen, Unterkunft und Einmalkosten. Danach schreibst du das Angebot und planst nach dem Zuschlag die Schichten.</p>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">30 Tage Pro gratis testen</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div></section>
<h2>So rechnet der Rechner</h2>
<p>Lohn + Lohnnebenkosten + Ausfallzeiten + Zuschläge (Nacht 25 %, Sonntag 50 % auf den jeweiligen Anteil) = Personalkosten. Darauf die Gemeinkosten, dazu Fahrtkosten pro Stunde, ergibt die Selbstkosten. Darauf Wagnis und Gewinn = Verrechnungssatz.</p>`;
}

/** Category comparison; prices are ranges seen on public price pages on the given date. */
export const VERGLEICH_STAND = "09.11.2026";
const ZEILEN: [string, string, string, string][] = [
  ["Öffentliche Ausschreibungen finden", "✓", "–", "✓"],
  ["Bewertung, ob die Ausschreibung passt", "teils (KI-Tarife)", "–", "✓ 1–10 Punkte mit Begründung"],
  ["Unterlagen zusammenfassen (Steckbrief)", "teils", "–", "✓"],
  ["Preis mit Löhnen und Zuschlägen kalkulieren", "selten, meist nur im teuersten Tarif", "teils", "✓ pro Los, mit Tariftabellen"],
  ["Angebot vorbereiten und freigeben", "teils", "teils (eigene Angebote)", "✓"],
  ["Personal, Nachweise mit Ablauf-Warnung", "–", "✓", "✓"],
  ["Schichtplan, offene Schichten", "–", "✓", "✓"],
  ["Zeiterfassung per Handy", "–", "✓", "✓"],
  ["Lohnliste für DATEV, Rechnung, XRechnung", "–", "✓", "✓"],
  ["Ausschreibungen neben Personal und Lohn in einer App", "–", "–", "✓"],
];

export function vergleichSeite(): string {
  return `<h1>Ausschreibungsdienst plus Dienstplan-Software – oder Crewtender?</h1>
<p>Wer öffentliche Aufträge gewinnen und mit eigenem Personal erledigen will, braucht bisher zwei Programme: einen Ausschreibungsdienst für Suche und Angebot und eine Branchensoftware für Dienstplan, Zeiterfassung und Lohn. Crewtender macht beides in einer App, damit nichts doppelt eingetippt wird.</p>
<div class="tabelle-scroll"><table class="vergleich-tabelle"><thead><tr><th>Aufgabe</th><th>Ausschreibungsdienst</th><th>Dienstplan-/Branchensoftware</th><th>Crewtender</th></tr></thead>
<tbody>${ZEILEN.map(([a, b, c, d]) => `<tr><td>${escape(a)}</td><td>${escape(b)}</td><td>${escape(c)}</td><td><strong>${escape(d)}</strong></td></tr>`).join("")}</tbody></table></div>
<h2>Was kostet das?</h2>
<ul>
<li><strong>Ausschreibungsdienste:</strong> laut öffentlichen Preisseiten meist zwischen 0 € (Basis-Suche) und rund 500 € im Monat, KI-Funktionen oft erst in höheren Tarifen; manche nennen Preise nur auf Anfrage.</li>
<li><strong>Dienstplan- und Branchensoftware:</strong> je nach Anbieter pro Mitarbeiter oder als Pauschale, nach öffentlichen Angaben häufig ab rund 90 bis 200 € im Monat; viele Preise nur auf Anfrage.</li>
<li><strong>Crewtender:</strong> Free 0 €, Basis 59 €, Pro 149 € (mit Personal, Schichtplan, Zeiterfassung und Abrechnung für 25 Einsatzkräfte), Business 399 € im Monat. 30 Tage alle Pro-Funktionen gratis, ohne Kreditkarte, monatlich kündbar. <a href="/preise">Alle Preise</a></li>
</ul>
<p class="klein">Stand ${VERGLEICH_STAND}. Die Spannen beruhen auf öffentlich einsehbaren Preisseiten verschiedener Anbieter in Deutschland; Funktionen und Preise anderer Anbieter können sich ändern und unterscheiden sich je Anbieter. „teils“ heißt: bei einigen Anbietern oder Tarifen vorhanden.</p>
<h2>Für wen ist Crewtender gemacht?</h2>
<p>Für Firmen, die öffentliche Aufträge mit eigenem Personal ausführen: Gebäudereinigung, Sicherheitsdienst, Zeitarbeit, Gastronomie und Catering, Garten- und Landschaftsbau, Handwerk. Wer nur Ausschreibungen lesen will, kann den Free-Plan dauerhaft kostenlos nutzen.</p>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">30 Tage Pro gratis testen</a><a class="knopf zweit" href="/stundensatz-rechner">🧮 Stundensatz-Rechner</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>`;
}

const meta = (html: string, beschreibung: string, url: string) => html.replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">`);

/** GET /stundensatz-rechner and /vergleich; null for other paths. */
export function rechner(request: Request, adresse: string, antwort: (html: string) => Response): Response | null {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  const pfad = url.pathname.replace(/\/$/, "");
  let r: Response;
  if (pfad === "/stundensatz-rechner") {
    r = antwort(meta(seite("Stundensatz-Rechner", rechnerSeite(url)), "Kostenloser Stundensatz-Rechner für Gebäudereinigung, Sicherheitsdienst, Gastronomie und Handwerk: Verrechnungssatz aus Lohn, Lohnnebenkosten, Ausfallzeiten, Zuschlägen, Gemeinkosten und Gewinn.", `${adresse}/stundensatz-rechner`));
    // Calculated variants are not indexed (endless query combinations), the page itself is.
    if (url.search) r.headers.set("x-robots-tag", "noindex, follow"); else r.headers.delete("x-robots-tag");
  } else if (pfad === "/vergleich") {
    r = antwort(meta(seite("Ausschreibungsdienst plus Dienstplan-Software oder Crewtender?", vergleichSeite()), "Ausschreibungen finden, mit Tariflohn kalkulieren und das Team planen: Was ein Ausschreibungsdienst, was eine Dienstplan-Software und was Crewtender kann – mit Preisspannen.", `${adresse}/vergleich`));
    r.headers.delete("x-robots-tag");
  } else return null;
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.set("x-jv-sprache", "de"); // written in German only; no half-translated page
  return r;
}
