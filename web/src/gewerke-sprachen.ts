// Language versions of the public trade pages: one list path per language and the slug of each trade per language,
// keyed by the German slug. Used for hreflang on every trade page (all versions point to each other) and the sitemap.
// gewerke-fr.ts and gewerke-land.ts check in tests that their slugs match this table.
export const LISTEN = { de: "/ausschreibungen", fr: "/fr/appels-d-offres", pl: "/pl/przetargi", es: "/es/licitaciones", it: "/it/gare-d-appalto" } as const;
export type GewerkSprache = keyof typeof LISTEN;

export const SLUGS: Record<string, Record<Exclude<GewerkSprache, "de">, string>> = {
  "gebaeudereinigung": { fr: "nettoyage", pl: "sprzatanie", es: "limpieza", it: "pulizie" },
  "sicherheitsdienst": { fr: "securite-gardiennage", pl: "ochrona", es: "seguridad-vigilancia", it: "vigilanza" },
  "garten-landschaftsbau-winterdienst": { fr: "espaces-verts", pl: "tereny-zielone", es: "jardineria", it: "manutenzione-verde" },
  "elektro": { fr: "electricite", pl: "elektryka", es: "electricidad", it: "impianti-elettrici" },
  "sanitaer-heizung-lueftung": { fr: "plomberie-chauffage-cvc", pl: "instalacje-sanitarne-grzewcze", es: "fontaneria-climatizacion", it: "idraulica-riscaldamento" },
  "maler-trockenbau": { fr: "peinture-platrerie", pl: "malowanie-sucha-zabudowa", es: "pintura-pladur", it: "tinteggiatura-cartongesso" },
  "tischler-schreiner": { fr: "menuiserie", pl: "stolarka", es: "carpinteria", it: "falegnameria" },
  "dach-zimmerer": { fr: "couverture-charpente", pl: "dachy-ciesielstwo", es: "cubiertas", it: "coperture" },
  "bodenbelaege-fliesen": { fr: "sols-carrelage", pl: "posadzki-plytki", es: "suelos-alicatado", it: "pavimenti-piastrelle" },
  "zeitarbeit-personaldienstleister": { fr: "interim-travail-temporaire", pl: "praca-tymczasowa", es: "trabajo-temporal", it: "somministrazione-lavoro" },
};

/** hreflang links to every language version of a trade page (deSlug) or of the overview (null). */
export function alternativen(adresse: string, deSlug: string | null): string {
  if (deSlug !== null && !SLUGS[deSlug]) return "";
  return (Object.keys(LISTEN) as GewerkSprache[]).map((s) => {
    const pfad = deSlug === null ? LISTEN[s] : `${LISTEN[s]}/${s === "de" ? deSlug : SLUGS[deSlug][s]}`;
    return `<link rel="alternate" hreflang="${s}" href="${adresse}${pfad}">`;
  }).join("\n");
}
