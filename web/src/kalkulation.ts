// Price calculation for a tender: the customer's wages and surcharges -> price per hour and per lot.
import { tarifHinweise, tariflohn, type TarifWahl } from "./tarife.ts";

export type Eingaben = {
  lohn: number; // gross hourly wage, € (default for all lots; a lot can have its own)
  nebenkosten: number; // employer social security, levies, BG, %
  ausfall: number; // paid time off (holiday, sickness, public holidays) on productive hours, %
  // Shift model: share of hours (%) and surcharge (%) for night, Sunday, public holiday and overtime.
  anteilNacht: number;
  zuschlagNacht: number;
  anteilSonntag: number;
  zuschlagSonntag: number;
  anteilFeiertag: number;
  zuschlagFeiertag: number;
  anteilUeber: number;
  zuschlagUeber: number;
  zuschlaege: number; // further surcharges on average, %
  // Costs of the assignment
  stundenTag: number; // working hours per day, to spread daily costs
  fahrt: number; // travel per working day, €
  verpflegung: number; // meal allowance per working day, €
  unterkunft: number; // accommodation per night, € (only lots marked "auswärts")
  einmalig: number; // once per worker: clothing, safety gear, health instruction, training, recruiting, €
  stundenKraft: number; // hours one worker works in the assignment, to spread one-off costs
  sonstiges: number; // other costs per hour, €
  gemeinkosten: number; // overhead (office, dispatch, insurance), %
  gewinn: number; // risk and profit, %
};

/** taetigkeit/eg/eg_grund: the workforce the lot needs and the suggested wage group (Steckbriefe since 30.10.2026). */
export type Los = { nr: string; name: string; menge: number; einheit: string; zeitraum: string; hinweis: string; taetigkeit?: string; eg?: string; eg_grund?: string };
/** Per lot: own hourly wage (e.g. cook vs. kitchen help) and whether workers stay overnight away from home. */
export type LosWerte = Record<string, { lohn?: number; auswaerts?: boolean; eg?: string }>;

/** Select nearest area template first, then walk up the area tree to company defaults. */
export function vorlageFuerBereich<T>(bereichId: string | null | undefined, bereiche: { id: string; parent_id: string | null }[], vorlagen: { bereich_id: string | null; eingaben: T }[]): T | undefined {
  const index = new Map(vorlagen.map((v) => [v.bereich_id, v.eingaben]));
  const gesehen = new Set<string>();
  let id = bereichId ?? null;
  while (id && !gesehen.has(id)) {
    gesehen.add(id);
    const werte = index.get(id);
    if (werte) return werte;
    id = bereiche.find((b) => b.id === id)?.parent_id ?? null;
  }
  return index.get(null);
}

export const STANDARD: Eingaben = {
  lohn: 15, nebenkosten: 23, ausfall: 20,
  anteilNacht: 0, zuschlagNacht: 25, anteilSonntag: 0, zuschlagSonntag: 50, anteilFeiertag: 0, zuschlagFeiertag: 100, anteilUeber: 0, zuschlagUeber: 25, zuschlaege: 0,
  stundenTag: 8, fahrt: 0, verpflegung: 0, unterkunft: 0, einmalig: 0, stundenKraft: 1000, sonstiges: 0,
  gemeinkosten: 15, gewinn: 8,
};
export const MINDESTLOHN_2026 = 13.9;
export const UST = 19;

type Feld = { key: keyof Eingaben; label: string; einheit: string; hilfe: string; gruppe: string };
export const GRUPPEN = ["Lohn", "Schichten und Zuschläge", "Einsatzkosten", "Aufschläge"];
export const FELDER: Feld[] = [
  { gruppe: "Lohn", key: "lohn", label: "Stundenlohn brutto", einheit: "€", hilfe: "Standard für alle Lose; pro Los änderbar (z. B. Koch höher als Küchenhilfe)" },
  { gruppe: "Lohn", key: "nebenkosten", label: "Lohnnebenkosten", einheit: "%", hilfe: "Arbeitgeberanteil Sozialversicherung, Umlagen U1–U3, Berufsgenossenschaft (meist 21–25 %)" },
  { gruppe: "Lohn", key: "ausfall", label: "Ausfallzeiten", einheit: "%", hilfe: "Bezahlter Urlaub, Krankheit, Feiertage (meist 15–25 %)" },
  { gruppe: "Schichten und Zuschläge", key: "anteilNacht", label: "Anteil Nachtstunden", einheit: "%", hilfe: "Wie viel Prozent der Stunden nachts anfallen" },
  { gruppe: "Schichten und Zuschläge", key: "zuschlagNacht", label: "Nachtzuschlag", einheit: "%", hilfe: "Zuschlag auf den Lohn für diese Stunden" },
  { gruppe: "Schichten und Zuschläge", key: "anteilSonntag", label: "Anteil Sonntagsstunden", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "zuschlagSonntag", label: "Sonntagszuschlag", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "anteilFeiertag", label: "Anteil Feiertagsstunden", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "zuschlagFeiertag", label: "Feiertagszuschlag", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "anteilUeber", label: "Anteil Überstunden", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "zuschlagUeber", label: "Überstundenzuschlag", einheit: "%", hilfe: "" },
  { gruppe: "Schichten und Zuschläge", key: "zuschlaege", label: "Weitere Zuschläge im Schnitt", einheit: "%", hilfe: "z. B. Branchenzuschlag; 0, wenn keine" },
  { gruppe: "Einsatzkosten", key: "stundenTag", label: "Arbeitsstunden pro Tag", einheit: "Std", hilfe: "Um Tageskosten auf Stunden umzurechnen" },
  { gruppe: "Einsatzkosten", key: "fahrt", label: "Fahrtkosten pro Tag", einheit: "€", hilfe: "Pro Kraft und Arbeitstag" },
  { gruppe: "Einsatzkosten", key: "verpflegung", label: "Verpflegung pro Tag", einheit: "€", hilfe: "Verpflegungsmehraufwand pro Kraft und Arbeitstag" },
  { gruppe: "Einsatzkosten", key: "unterkunft", label: "Unterkunft pro Nacht", einheit: "€", hilfe: "Nur für Lose, die du unten als „auswärts“ markierst" },
  { gruppe: "Einsatzkosten", key: "einmalig", label: "Einmalige Kosten pro Kraft", einheit: "€", hilfe: "Dienstkleidung, Arbeitsschutz, Gesundheitsbelehrung, Einarbeitung, Recruiting" },
  { gruppe: "Einsatzkosten", key: "stundenKraft", label: "Einsatzstunden pro Kraft", einheit: "Std", hilfe: "Auf so viele Stunden werden die einmaligen Kosten verteilt" },
  { gruppe: "Einsatzkosten", key: "sonstiges", label: "Sonstiges pro Stunde", einheit: "€", hilfe: "Alles andere, z. B. Bereitschaft/Disposition" },
  { gruppe: "Aufschläge", key: "gemeinkosten", label: "Gemeinkosten", einheit: "%", hilfe: "Büro, Disposition, Versicherungen, Software" },
  { gruppe: "Aufschläge", key: "gewinn", label: "Wagnis und Gewinn", einheit: "%", hilfe: "Dein Aufschlag" },
];

/** Form fields grouped in boxes (labels are fixed text, values numbers). */
/** Short line for a folded section, e.g. "15 € · 23 % · 20 %"; the page script keeps it current while typing. */
export function zusammenfassung(werte: Eingaben, gruppe: string): string {
  return FELDER.filter((f) => f.gruppe === gruppe && werte[f.key]).slice(0, 4).map((f) => `${fmt(werte[f.key])} ${f.einheit}`).join(" · ") || "keine Werte";
}

/** Price per hour for the standard wage, also computed live in the browser (same formula, see APP_JS). */
export function verrechnungssatz(werte: Eingaben): number {
  return runden(stundenpreis(werte, werte.lohn, false).preis);
}

/** Collective wages to take over into the standard wage field with one tap. */
export function tarifSchnellwahl(gruppen: { eg: string; lohn: number }[]): string {
  return gruppen.length ? `<label class="tarif-wahl">Lohn aus Tarif übernehmen<select data-lohn-aus-tarif><option value="">Tarifgruppe wählen …</option>${gruppen.map((g) => `<option value="${fmt(g.lohn)}">EG ${g.eg} · ${fmt(g.lohn)} €</option>`).join("")}</select></label>` : "";
}

/** The input sections fold up like the rest of the app; the live price stays visible above them. */
export function felderHtml(werte: Eingaben, nurLesen = false, schnellwahl = ""): string {
  const satz = `<p class="live-satz" data-live-satz>Verrechnungssatz <strong>${euro(verrechnungssatz(werte))}</strong> pro Stunde<span class="klein">mit dem Standardlohn, ohne Unterkunft</span></p>`;
  return satz + GRUPPEN.map((g, i) => `<details class="kalk-gruppe" data-gruppe="${g}"${i === 0 ? " open" : ""}><summary>${g}<span class="kalk-kurz">${zusammenfassung(werte, g)}</span></summary>${g === "Lohn" ? schnellwahl : ""}${FELDER.filter((f) => f.gruppe === g).map((f) => `<label>${f.label} (${f.einheit})<input name="${f.key}" inputmode="decimal" data-einheit="${f.einheit}" value="${fmt(werte[f.key])}"${nurLesen ? " readonly" : ""}>${f.hilfe ? `<span class="klein">${f.hilfe}</span>` : ""}</label>`).join("")}</details>`).join("");
}

/** Three prices with different profit margins, to choose how close to calculate. */
export function szenarien(eingaben: Partial<Eingaben>, lose: Los[], mengen: Record<string, number>, proLos: LosWerte, tarif?: TarifWahl) {
  const basis = zahl(eingaben.gewinn, STANDARD.gewinn);
  return [["Knapp", Math.max(0, basis - 4)], ["Normal", basis], ["Sicher", basis + 4]].map(([name, gewinn]) => {
    const r = rechnen({ ...eingaben, gewinn: gewinn as number }, lose, mengen, proLos, tarif);
    return { name: name as string, gewinn: gewinn as number, preis: r.preisProStunde, netto: r.netto };
  });
}

/** Excel-readable CSV (semicolon, German decimals) of the result per lot. */
export function kalkulationCsv(r: Ergebnis): string {
  const z = (x: number) => fmt(runden(x));
  const zelle = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const zeilen = [["Schritt", "Betrag pro Stunde (€)"], ...r.schritte.map((s) => [s.name, z(s.betrag)]), ["Angebotspreis pro Stunde netto", z(r.preisProStunde)], [], ["Los", "Bezeichnung", "Lohn (€)", "Preis pro Stunde (€)", "Stunden", "Netto (€)"],
    ...r.lose.map((l) => [l.los.nr, l.los.name, z(l.lohn), z(l.preisProStunde), z(l.stunden), z(l.netto)]), [], ["Gesamt netto", "", "", "", "", z(r.netto)], ["Gesamt brutto (19 % USt)", "", "", "", "", z(r.brutto)]];
  return "\ufeff" + zeilen.map((r) => r.map((x) => zelle(String(x))).join(";")).join("\r\n") + "\r\n";
}

export type Ergebnis = {
  schritte: { name: string; betrag: number }[];
  preisProStunde: number;
  lose: { los: Los; stunden: number; netto: number; lohn: number; auswaerts: boolean; preisProStunde: number; eg?: string }[];
  netto: number;
  brutto: number;
  warnungen: string[];
};

const auf = (x: number, p: number) => x * (1 + p / 100);

/** Price per hour for one wage; the steps explain the way there. */
function stundenpreis(e: Eingaben, lohn: number, auswaerts: boolean) {
  const zuschlag = e.zuschlaege + (e.anteilNacht * e.zuschlagNacht + e.anteilSonntag * e.zuschlagSonntag + e.anteilFeiertag * e.zuschlagFeiertag + e.anteilUeber * e.zuschlagUeber) / 100;
  const mitNk = auf(lohn, e.nebenkosten);
  const mitAusfall = auf(mitNk, e.ausfall);
  const personal = auf(mitAusfall, zuschlag);
  const proTag = e.fahrt + e.verpflegung + (auswaerts ? e.unterkunft : 0);
  const einsatz = (e.stundenTag > 0 ? proTag / e.stundenTag : 0) + (e.stundenKraft > 0 ? e.einmalig / e.stundenKraft : 0) + e.sonstiges;
  const gemein = auf(personal, e.gemeinkosten);
  const selbstkosten = gemein + einsatz;
  const preis = auf(selbstkosten, e.gewinn);
  return {
    preis,
    schritte: [
      { name: "Stundenlohn", betrag: runden(lohn) },
      { name: `+ Lohnnebenkosten ${fmt(e.nebenkosten)} %`, betrag: runden(mitNk - lohn) },
      { name: `+ Ausfallzeiten ${fmt(e.ausfall)} %`, betrag: runden(mitAusfall - mitNk) },
      { name: `+ Zuschläge im Schnitt ${fmt(runden(zuschlag))} %`, betrag: runden(personal - mitAusfall) },
      { name: `+ Gemeinkosten ${fmt(e.gemeinkosten)} %`, betrag: runden(gemein - personal) },
      { name: `+ Einsatzkosten${auswaerts ? " mit Unterkunft" : ""}`, betrag: runden(einsatz) },
      { name: "= Selbstkosten pro Stunde", betrag: runden(selbstkosten) },
      { name: `+ Wagnis und Gewinn ${fmt(e.gewinn)} %`, betrag: runden(preis - selbstkosten) },
    ],
  };
}

/** tarif: contract start and length for lots paid by a collective wage group (eg) instead of an own wage. */
export function rechnen(eingaben: Partial<Eingaben>, lose: Los[], mengen: Record<string, number>, proLos: LosWerte = {}, tarif?: TarifWahl): Ergebnis {
  const e = { ...STANDARD, ...eingaben }; // values saved before new fields existed
  const basis = stundenpreis(e, e.lohn, false);
  const zeilen = lose.map((los) => {
    const eg = tarif ? proLos[los.nr]?.eg : undefined;
    const lohn = eg ? tariflohn(eg, tarif!) : proLos[los.nr]?.lohn || e.lohn;
    const auswaerts = !!proLos[los.nr]?.auswaerts;
    const preis = runden(stundenpreis(e, lohn, auswaerts).preis);
    const stunden = mengen[los.nr] ?? (stundenEinheit(los.einheit) ? los.menge : 0);
    return { los, stunden, netto: runden(stunden * preis), lohn, auswaerts, preisProStunde: preis, eg };
  });
  const netto = runden(zeilen.reduce((s, z) => s + z.netto, 0));
  const warnungen: string[] = [];
  if ([e.lohn, ...zeilen.map((z) => z.lohn)].some((l) => l < MINDESTLOHN_2026)) warnungen.push(`Ein Stundenlohn liegt unter dem gesetzlichen Mindestlohn (${fmt(MINDESTLOHN_2026)} € ab 1.1.2026).`);
  if (e.gewinn <= 0) warnungen.push("Ohne Aufschlag für Wagnis und Gewinn arbeitest du zum Selbstkostenpreis.");
  if (e.anteilNacht + e.anteilSonntag + e.anteilFeiertag > 100) warnungen.push("Nacht-, Sonntags- und Feiertagsanteil zusammen über 100 %. Bitte prüfen.");
  if (tarif && zeilen.some((z) => z.eg)) warnungen.push(...tarifHinweise(tarif));
  if (lose.some((l) => !stundenEinheit(l.einheit))) warnungen.push("Manche Lose sind nicht in Stunden angegeben. Trag die Stunden dort selbst ein.");
  return {
    schritte: basis.schritte,
    preisProStunde: runden(basis.preis),
    lose: zeilen,
    netto,
    brutto: runden(auf(netto, UST)),
    warnungen,
  };
}

export function stundenEinheit(einheit: string): boolean {
  return /stunde|std|^h$/i.test(einheit);
}

/** German number input: "14,50" or "1.234,5" -> number; empty or invalid -> fallback. */
export function zahl(wert: unknown, fallback: number): number {
  const s = String(wert ?? "").trim().replace(/\s|€|%/g, "");
  if (!s) return fallback;
  const deutsch = s.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(s); // "1.234" is a thousand, not 1.234
  const n = Number(deutsch ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function runden(x: number): number {
  return Math.round(x * 100) / 100;
}

export function fmt(x: number): string {
  return x.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 });
}

export function euro(x: number): string {
  return x.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
