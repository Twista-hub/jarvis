// Price calculation for a tender: the customer's wages and surcharges -> price per hour and per lot.

export type Eingaben = {
  lohn: number; // gross hourly wage, €
  nebenkosten: number; // employer social security, levies, BG, %
  ausfall: number; // paid time off (holiday, sickness, public holidays) on productive hours, %
  zuschlaege: number; // average surcharges for night/Sunday/holiday work, %
  gemeinkosten: number; // overhead (office, dispatch, insurance), %
  gewinn: number; // risk and profit, %
  sonstiges: number; // other costs per hour (travel, clothing), €
};

export type Los = { nr: string; name: string; menge: number; einheit: string; zeitraum: string; hinweis: string };

export const STANDARD: Eingaben = { lohn: 15, nebenkosten: 23, ausfall: 20, zuschlaege: 0, gemeinkosten: 15, gewinn: 8, sonstiges: 0 };
export const MINDESTLOHN_2026 = 13.9;
export const UST = 19;

export const FELDER: { key: keyof Eingaben; label: string; einheit: string; hilfe: string }[] = [
  { key: "lohn", label: "Stundenlohn brutto", einheit: "€", hilfe: "Was die Mitarbeitenden pro Stunde verdienen" },
  { key: "nebenkosten", label: "Lohnnebenkosten", einheit: "%", hilfe: "Arbeitgeberanteil Sozialversicherung, Umlagen, Berufsgenossenschaft (meist 21–25 %)" },
  { key: "ausfall", label: "Ausfallzeiten", einheit: "%", hilfe: "Bezahlter Urlaub, Krankheit, Feiertage (meist 15–25 %)" },
  { key: "zuschlaege", label: "Zuschläge im Schnitt", einheit: "%", hilfe: "Nacht, Sonntag, Feiertag auf alle Stunden gerechnet; 0, wenn extra abgerechnet" },
  { key: "gemeinkosten", label: "Gemeinkosten", einheit: "%", hilfe: "Büro, Disposition, Versicherungen, Software" },
  { key: "gewinn", label: "Wagnis und Gewinn", einheit: "%", hilfe: "Dein Aufschlag" },
  { key: "sonstiges", label: "Sonstiges pro Stunde", einheit: "€", hilfe: "Fahrtkosten, Dienstkleidung usw." },
];

export type Ergebnis = {
  schritte: { name: string; betrag: number }[];
  preisProStunde: number;
  lose: { los: Los; stunden: number; netto: number }[];
  netto: number;
  brutto: number;
  warnungen: string[];
};

const auf = (x: number, p: number) => x * (1 + p / 100);

export function rechnen(e: Eingaben, lose: Los[], mengen: Record<string, number>): Ergebnis {
  const personal = auf(auf(auf(e.lohn, e.nebenkosten), e.ausfall), e.zuschlaege);
  const selbstkosten = auf(personal, e.gemeinkosten) + e.sonstiges;
  const preis = auf(selbstkosten, e.gewinn);
  const zeilen = lose.map((los) => {
    const stunden = mengen[los.nr] ?? (stundenEinheit(los.einheit) ? los.menge : 0);
    return { los, stunden, netto: runden(stunden * preis) };
  });
  const netto = runden(zeilen.reduce((s, z) => s + z.netto, 0));
  const warnungen: string[] = [];
  if (e.lohn < MINDESTLOHN_2026) warnungen.push(`Der Stundenlohn liegt unter dem gesetzlichen Mindestlohn (${fmt(MINDESTLOHN_2026)} € ab 1.1.2026).`);
  if (e.gewinn <= 0) warnungen.push("Ohne Aufschlag für Wagnis und Gewinn arbeitest du zum Selbstkostenpreis.");
  if (lose.some((l) => !stundenEinheit(l.einheit))) warnungen.push("Manche Lose sind nicht in Stunden angegeben. Trag die Stunden dort selbst ein.");
  return {
    schritte: [
      { name: "Stundenlohn", betrag: runden(e.lohn) },
      { name: `+ Lohnnebenkosten ${fmt(e.nebenkosten)} %`, betrag: runden(auf(e.lohn, e.nebenkosten) - e.lohn) },
      { name: `+ Ausfallzeiten ${fmt(e.ausfall)} %`, betrag: runden(auf(auf(e.lohn, e.nebenkosten), e.ausfall) - auf(e.lohn, e.nebenkosten)) },
      { name: `+ Zuschläge ${fmt(e.zuschlaege)} %`, betrag: runden(personal - auf(auf(e.lohn, e.nebenkosten), e.ausfall)) },
      { name: `+ Gemeinkosten ${fmt(e.gemeinkosten)} %`, betrag: runden(auf(personal, e.gemeinkosten) - personal) },
      { name: "+ Sonstiges", betrag: runden(e.sonstiges) },
      { name: "= Selbstkosten pro Stunde", betrag: runden(selbstkosten) },
      { name: `+ Wagnis und Gewinn ${fmt(e.gewinn)} %`, betrag: runden(preis - selbstkosten) },
    ],
    preisProStunde: runden(preis),
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
