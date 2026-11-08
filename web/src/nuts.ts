// Federal states for the Google pages, from the NUTS code in catalogue locations (shared by gewerke.ts and seo-seiten.ts).
export type Bundesland = { slug: string; name: string; nuts: string; im: string };
/** NUTS level 1: the letter after "DE" (DEA23 → A = Nordrhein-Westfalen). */
export const BUNDESLAENDER: Bundesland[] = [
  { slug: "baden-wuerttemberg", name: "Baden-Württemberg", nuts: "1", im: "in Baden-Württemberg" },
  { slug: "bayern", name: "Bayern", nuts: "2", im: "in Bayern" },
  { slug: "berlin", name: "Berlin", nuts: "3", im: "in Berlin" },
  { slug: "brandenburg", name: "Brandenburg", nuts: "4", im: "in Brandenburg" },
  { slug: "bremen", name: "Bremen", nuts: "5", im: "in Bremen" },
  { slug: "hamburg", name: "Hamburg", nuts: "6", im: "in Hamburg" },
  { slug: "hessen", name: "Hessen", nuts: "7", im: "in Hessen" },
  { slug: "mecklenburg-vorpommern", name: "Mecklenburg-Vorpommern", nuts: "8", im: "in Mecklenburg-Vorpommern" },
  { slug: "niedersachsen", name: "Niedersachsen", nuts: "9", im: "in Niedersachsen" },
  { slug: "nordrhein-westfalen", name: "Nordrhein-Westfalen", nuts: "A", im: "in Nordrhein-Westfalen (NRW)" },
  { slug: "rheinland-pfalz", name: "Rheinland-Pfalz", nuts: "B", im: "in Rheinland-Pfalz" },
  { slug: "saarland", name: "Saarland", nuts: "C", im: "im Saarland" },
  { slug: "sachsen", name: "Sachsen", nuts: "D", im: "in Sachsen" },
  { slug: "sachsen-anhalt", name: "Sachsen-Anhalt", nuts: "E", im: "in Sachsen-Anhalt" },
  { slug: "schleswig-holstein", name: "Schleswig-Holstein", nuts: "F", im: "in Schleswig-Holstein" },
  { slug: "thueringen", name: "Thüringen", nuts: "G", im: "in Thüringen" },
];

/** Federal state of a catalogue location from its NUTS code ("47475 Kamp-Lintfort DEA1F" → NRW); same rule as the database. */
export function landAusOrt(ort: string | null | undefined): Bundesland | undefined {
  const m = (ort ?? "").match(/(?:^|[^0-9A-Za-z])DE([1-9A-G])[0-9A-Z]{0,3}(?![0-9A-Za-z])/);
  return m ? BUNDESLAENDER.find((l) => l.nuts === m[1]) : undefined;
}
