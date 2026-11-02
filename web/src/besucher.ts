// Where a visitor comes from: country (Cloudflare geo, cookie jv_land or /xx in the address) and the matching language.
// Public start page per country: /de, /us, /fr … ; "/" shows the page of the detected country. The app inside stays German for now.
import { escape } from "./seite.ts";
import { LAENDER } from "./laender.ts";
import { symbol } from "./symbole.ts";

/** ISO 3166 alpha-2 → alpha-3 for every country we search (same list as laender.ts). */
export const ISO2: Record<string, string> = {
  DE: "DEU", AT: "AUT", CH: "CHE", FR: "FRA", LU: "LUX", BE: "BEL", NL: "NLD", DK: "DNK", PL: "POL", CZ: "CZE", BG: "BGR", HR: "HRV", CY: "CYP",
  EE: "EST", FI: "FIN", GR: "GRC", HU: "HUN", IE: "IRL", IT: "ITA", LV: "LVA", LT: "LTU", MT: "MLT", PT: "PRT", RO: "ROU", SK: "SVK", SI: "SVN",
  ES: "ESP", SE: "SWE", NO: "NOR", IS: "ISL", LI: "LIE", GB: "GBR", US: "USA",
};
export const SPRACHEN_OEFFENTLICH = ["de", "en", "fr", "es", "it", "nl", "pl", "pt"] as const;
export type Sprache = typeof SPRACHEN_OEFFENTLICH[number];

/** Main language per country; countries with several languages decide by the browser language. */
const HAUPTSPRACHE: Record<string, Sprache> = { DE: "de", AT: "de", LI: "de", CH: "de", LU: "fr", FR: "fr", BE: "fr", ES: "es", IT: "it", NL: "nl", PL: "pl", PT: "pt" };
const MEHRSPRACHIG: Record<string, Sprache[]> = { CH: ["de", "fr", "it"], BE: ["nl", "fr", "de"], LU: ["fr", "de"] };

export type Besucher = { land: string; iso3: string | null; sprache: Sprache };

function cookie(request: Request, name: string): string {
  return new RegExp(`(?:^|;\\s*)${name}=([A-Za-z]{2})`).exec(request.headers.get("cookie") ?? "")?.[1] ?? "";
}

/** Preferred browser language among ours (Accept-Language, in order of preference). */
export function browserSprache(request: Request, erlaubt: readonly string[] = SPRACHEN_OEFFENTLICH): Sprache | null {
  const teile = (request.headers.get("accept-language") ?? "").split(",").map((t) => {
    const [code, q] = t.trim().split(";q=");
    return { s: code.slice(0, 2).toLowerCase(), q: q === undefined ? 1 : Number(q) || 0 };
  }).filter((t) => t.s && t.q > 0).sort((a, b) => b.q - a.q);
  return (teile.find((t) => erlaubt.includes(t.s))?.s as Sprache | undefined) ?? null;
}

/** Country: address /xx → cookie jv_land → Cloudflare (cf.country / cf-ipcountry) → Germany. */
export function besucher(request: Request, ausAdresse?: string): Besucher {
  const cf = ((request as unknown as { cf?: { country?: string } }).cf?.country ?? request.headers.get("cf-ipcountry") ?? "").toUpperCase();
  const land = [ausAdresse?.toUpperCase(), cookie(request, "jv_land").toUpperCase(), cf].find((l) => l && /^[A-Z]{2}$/.test(l) && l !== "XX" && l !== "T1") ?? "DE";
  const gewaehlt = cookie(request, "jv_psprache").toLowerCase();
  const browser = browserSprache(request);
  const sprache: Sprache = (SPRACHEN_OEFFENTLICH as readonly string[]).includes(gewaehlt) ? gewaehlt as Sprache
    : MEHRSPRACHIG[land] ? (browser && MEHRSPRACHIG[land].includes(browser) ? browser : HAUPTSPRACHE[land])
    : HAUPTSPRACHE[land] ?? (ISO2[land] ? "en" : browser ?? "en");
  return { land, iso3: ISO2[land] ?? null, sprache };
}

/** Default countries for a new search profile: the visitor's country if we search there, else Germany. */
export function startLaender(request: Request): string[] {
  const l = cookie(request, "jv_land").toUpperCase() || ((request as unknown as { cf?: { country?: string } }).cf?.country ?? request.headers.get("cf-ipcountry") ?? "").toUpperCase();
  const iso3 = ISO2[l];
  return iso3 && iso3 in LAENDER ? [iso3] : ["DEU"];
}

const LANDNAME: Record<Sprache, Record<string, string>> = {
  de: {}, // German names come from laender.ts
  en: { DE: "Germany", AT: "Austria", CH: "Switzerland", FR: "France", LU: "Luxembourg", BE: "Belgium", NL: "the Netherlands", DK: "Denmark", PL: "Poland", CZ: "Czechia", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus", EE: "Estonia", FI: "Finland", GR: "Greece", HU: "Hungary", IE: "Ireland", IT: "Italy", LV: "Latvia", LT: "Lithuania", MT: "Malta", PT: "Portugal", RO: "Romania", SK: "Slovakia", SI: "Slovenia", ES: "Spain", SE: "Sweden", NO: "Norway", IS: "Iceland", LI: "Liechtenstein", GB: "the United Kingdom", US: "the United States" },
  fr: { DE: "Allemagne", AT: "Autriche", CH: "Suisse", FR: "France", LU: "Luxembourg", BE: "Belgique", NL: "Pays-Bas", ES: "Espagne", IT: "Italie", PT: "Portugal", GB: "Royaume-Uni", US: "États-Unis" },
  es: { DE: "Alemania", AT: "Austria", CH: "Suiza", FR: "Francia", ES: "España", IT: "Italia", PT: "Portugal", GB: "Reino Unido", US: "Estados Unidos" },
  it: { DE: "Germania", AT: "Austria", CH: "Svizzera", FR: "Francia", ES: "Spagna", IT: "Italia", PT: "Portogallo", GB: "Regno Unito", US: "Stati Uniti" },
  nl: { DE: "Duitsland", AT: "Oostenrijk", CH: "Zwitserland", FR: "Frankrijk", BE: "België", NL: "Nederland", LU: "Luxemburg", ES: "Spanje", IT: "Italië", GB: "Verenigd Koninkrijk", US: "Verenigde Staten" },
  pl: { DE: "Niemcy", AT: "Austria", CH: "Szwajcaria", FR: "Francja", PL: "Polska", ES: "Hiszpania", IT: "Włochy", GB: "Wielka Brytania", US: "Stany Zjednoczone" },
  pt: { DE: "Alemanha", AT: "Áustria", CH: "Suíça", FR: "França", ES: "Espanha", IT: "Itália", PT: "Portugal", GB: "Reino Unido", US: "Estados Unidos" },
};

export function landName(land: string, sprache: Sprache): string {
  if (sprache === "de") return (LAENDER[ISO2[land] ?? ""] ?? land).replace(" (Bundesbehörden)", "");
  return LANDNAME[sprache][land] ?? regionName(land, sprache) ?? LANDNAME.en[land] ?? land;
}

/** Country name from the runtime (Intl), without article; null if unavailable. */
function regionName(land: string, sprache: Sprache): string | null {
  try { return new Intl.DisplayNames([sprache], { type: "region" }).of(land) ?? null; } catch { return null; }
}

/** Where the tenders of a country come from (shown on the start page). */
function quelle(land: string): string {
  if (land === "DE") return "Bekanntmachungsservice (service.bund.de) + TED";
  if (land === "GB") return "Find a Tender Service";
  if (land === "US") return "SAM.gov";
  return "TED (Tenders Electronic Daily)";
}

type Texte = { titel: string; intro: (land: string) => string; schritte: [string, string][]; registrieren: string; demo: string; konto: string; anmelden: string; quelle: string; landWechseln: string; sprache: string; hinweisApp: string; keineBehoerde: string; nichtAbgedeckt: string };

const T: Record<Sprache, Texte> = {
  de: { titel: "Jarvis findet passende Ausschreibungen für deine Firma", intro: (l) => `Jeden Morgen liest Jarvis alle neuen öffentlichen Ausschreibungen in ${l} und zeigt dir nur die, die zu deiner Firma passen.`,
    schritte: [["Treffer jeden Morgen", "Jede Ausschreibung bekommt 1 bis 10 Punkte und einen Satz, warum sie passt oder nicht."], ["Steckbrief auf einen Blick", "Fristen, Lose, Mengen, geforderte Nachweise, Zuschlagskriterien und eine klare Empfehlung."], ["Unterlagen prüfen und kalkulieren", "Jarvis liest die Vergabeunterlagen und rechnet mit deinen Löhnen den Angebotspreis aus."]],
    registrieren: "Jetzt registrieren", demo: "🎬 Erst ansehen (Demo ohne Anmeldung)", konto: "Schon ein Konto?", anmelden: "Anmelden", quelle: "Quelle", landWechseln: "Land", sprache: "Sprache", hinweisApp: "", keineBehoerde: "Privater Dienst von WP Digital Ranger, keine Behörde.", nichtAbgedeckt: "In deinem Land suchen wir noch nicht. Wähle ein Land aus der Liste." },
  en: { titel: "Jarvis finds the right public tenders for your business", intro: (l) => `Every morning Jarvis reads all new public tenders in ${l} and shows you only the ones that fit your company.`,
    schritte: [["Matches every morning", "Each tender gets a score from 1 to 10 and one sentence on why it fits or not."], ["Fact sheet at a glance", "Deadlines, lots, quantities, required documents, award criteria and a clear recommendation."], ["Check documents and price your bid", "Jarvis reads the tender documents and calculates your bid price with your own wages."]],
    registrieren: "Sign up now", demo: "🎬 Try the demo first (no sign-up)", konto: "Already have an account?", anmelden: "Log in", quelle: "Source", landWechseln: "Country", sprache: "Language", hinweisApp: "", keineBehoerde: "Private service by WP Digital Ranger, not a government agency.", nichtAbgedeckt: "We don't cover your country yet. Please pick a country from the list." },
  fr: { titel: "Jarvis trouve les appels d'offres adaptés à votre entreprise", intro: (l) => `Chaque matin, Jarvis lit tous les nouveaux appels d'offres publics en ${l} et vous montre uniquement ceux qui correspondent à votre entreprise.`,
    schritte: [["Résultats chaque matin", "Chaque appel d'offres reçoit une note de 1 à 10 et une phrase qui explique pourquoi il convient ou non."], ["Fiche synthétique", "Délais, lots, quantités, pièces exigées, critères d'attribution et une recommandation claire."], ["Analyser les documents et chiffrer", "Jarvis lit le dossier de consultation et calcule votre prix avec vos propres salaires."]],
    registrieren: "S'inscrire", demo: "🎬 Voir la démo (sans inscription)", konto: "Déjà un compte ?", anmelden: "Se connecter", quelle: "Source", landWechseln: "Pays", sprache: "Langue", hinweisApp: "L'application est pour l'instant en allemand ; la version française est en préparation.", keineBehoerde: "Service privé de WP Digital Ranger, pas un organisme public.", nichtAbgedeckt: "Nous ne couvrons pas encore votre pays. Choisissez un pays dans la liste." },
  es: { titel: "Jarvis encuentra las licitaciones públicas adecuadas para tu empresa", intro: (l) => `Cada mañana Jarvis lee todas las nuevas licitaciones públicas de ${l} y te muestra solo las que encajan con tu empresa.`,
    schritte: [["Resultados cada mañana", "Cada licitación recibe de 1 a 10 puntos y una frase que explica por qué encaja o no."], ["Ficha resumida", "Plazos, lotes, cantidades, documentación exigida, criterios de adjudicación y una recomendación clara."], ["Revisar pliegos y calcular", "Jarvis lee los pliegos y calcula tu precio de oferta con tus propios salarios."]],
    registrieren: "Registrarse", demo: "🎬 Ver la demo (sin registro)", konto: "¿Ya tienes cuenta?", anmelden: "Iniciar sesión", quelle: "Fuente", landWechseln: "País", sprache: "Idioma", hinweisApp: "Por ahora la aplicación está en alemán; la versión en español está en camino.", keineBehoerde: "Servicio privado de WP Digital Ranger, no es un organismo público.", nichtAbgedeckt: "Todavía no cubrimos tu país. Elige un país de la lista." },
  it: { titel: "Jarvis trova le gare d'appalto adatte alla tua impresa", intro: (l) => `Ogni mattina Jarvis legge tutte le nuove gare pubbliche in ${l} e ti mostra solo quelle adatte alla tua impresa.`,
    schritte: [["Risultati ogni mattina", "Ogni gara riceve un punteggio da 1 a 10 e una frase che spiega perché è adatta o no."], ["Scheda sintetica", "Scadenze, lotti, quantità, documenti richiesti, criteri di aggiudicazione e una raccomandazione chiara."], ["Analizzare i documenti e calcolare", "Jarvis legge i documenti di gara e calcola il prezzo dell'offerta con i tuoi salari."]],
    registrieren: "Registrati", demo: "🎬 Guarda la demo (senza registrazione)", konto: "Hai già un account?", anmelden: "Accedi", quelle: "Fonte", landWechseln: "Paese", sprache: "Lingua", hinweisApp: "Per ora l'app è in tedesco; la versione italiana è in arrivo.", keineBehoerde: "Servizio privato di WP Digital Ranger, non un ente pubblico.", nichtAbgedeckt: "Non copriamo ancora il tuo paese. Scegli un paese dall'elenco." },
  nl: { titel: "Jarvis vindt de juiste aanbestedingen voor jouw bedrijf", intro: (l) => `Elke ochtend leest Jarvis alle nieuwe openbare aanbestedingen in ${l} en toont alleen de opdrachten die bij jouw bedrijf passen.`,
    schritte: [["Elke ochtend resultaten", "Elke aanbesteding krijgt 1 tot 10 punten en één zin waarom ze wel of niet past."], ["Overzicht in één oogopslag", "Termijnen, percelen, hoeveelheden, gevraagde documenten, gunningscriteria en een duidelijk advies."], ["Stukken controleren en calculeren", "Jarvis leest de aanbestedingsstukken en berekent je inschrijvingsprijs met je eigen lonen."]],
    registrieren: "Nu registreren", demo: "🎬 Eerst de demo bekijken (zonder account)", konto: "Al een account?", anmelden: "Inloggen", quelle: "Bron", landWechseln: "Land", sprache: "Taal", hinweisApp: "De app zelf is voorlopig in het Duits; de Nederlandse versie komt eraan.", keineBehoerde: "Particuliere dienst van WP Digital Ranger, geen overheidsinstantie.", nichtAbgedeckt: "Jouw land dekken we nog niet. Kies een land uit de lijst." },
  pl: { titel: "Jarvis znajduje przetargi pasujące do Twojej firmy", intro: (l) => `Każdego ranka Jarvis czyta wszystkie nowe przetargi publiczne w kraju: ${l} i pokazuje tylko te, które pasują do Twojej firmy.`,
    schritte: [["Wyniki każdego ranka", "Każdy przetarg dostaje od 1 do 10 punktów i jedno zdanie, dlaczego pasuje lub nie."], ["Karta przetargu", "Terminy, części, ilości, wymagane dokumenty, kryteria oceny i jasna rekomendacja."], ["Sprawdzanie dokumentów i wycena", "Jarvis czyta dokumentację przetargową i oblicza cenę oferty na podstawie Twoich stawek."]],
    registrieren: "Zarejestruj się", demo: "🎬 Zobacz demo (bez rejestracji)", konto: "Masz już konto?", anmelden: "Zaloguj się", quelle: "Źródło", landWechseln: "Kraj", sprache: "Język", hinweisApp: "Sama aplikacja jest na razie po niemiecku; wersja polska jest w przygotowaniu.", keineBehoerde: "Prywatna usługa WP Digital Ranger, nie urząd.", nichtAbgedeckt: "Twojego kraju jeszcze nie obsługujemy. Wybierz kraj z listy." },
  pt: { titel: "O Jarvis encontra os concursos públicos certos para a sua empresa", intro: (l) => `Todas as manhãs o Jarvis lê todos os novos concursos públicos em ${l} e mostra apenas os que se adequam à sua empresa.`,
    schritte: [["Resultados todas as manhãs", "Cada concurso recebe de 1 a 10 pontos e uma frase que explica porque serve ou não."], ["Ficha resumo", "Prazos, lotes, quantidades, documentos exigidos, critérios de adjudicação e uma recomendação clara."], ["Analisar peças e orçamentar", "O Jarvis lê as peças do procedimento e calcula o preço da proposta com os seus salários."]],
    registrieren: "Registar", demo: "🎬 Ver a demonstração (sem registo)", konto: "Já tem conta?", anmelden: "Entrar", quelle: "Fonte", landWechseln: "País", sprache: "Idioma", hinweisApp: "Por enquanto a aplicação está em alemão; a versão portuguesa está a caminho.", keineBehoerde: "Serviço privado da WP Digital Ranger, não é uma entidade pública.", nichtAbgedeckt: "Ainda não cobrimos o seu país. Escolha um país da lista." },
};


/** Texts of the new start page (design 2026-11): hero, three facts, example hit. */
type Held = { hero: string; cta: string; demo: string; fakten: [string, string][]; beispielH: string; wieH: string; gewerkeH: string; bsp: { titel: string; punkte: string; lose: string; wert: string; laufzeit: string; frist: string; neu: string } };
const HELD: Record<Sprache, Held> = {
  de: { hero: "Öffentliche Aufträge, die zu deiner Firma passen.", cta: "Kostenlos starten", demo: "Erst die Demo ansehen", fakten: [["1–10", "Punkte pro Treffer"], ["33", "Länder"], ["6 Uhr", "jeden Morgen"]], beispielH: "So sieht ein Treffer aus", wieH: "So funktioniert's", gewerkeH: "Ausschreibungen nach Gewerk",
    bsp: { titel: "Unterhaltsreinigung Schulen und Verwaltung, Stadt Musterstadt", punkte: "9/10 passt sehr gut", lose: "3 Lose", wert: "Wert 1,4 Mio. €", laufzeit: "48 Monate", frist: "Abgabe in 18 Tagen", neu: "neu" } },
  en: { hero: "Public contracts that fit your business.", cta: "Start for free", demo: "See the demo first", fakten: [["1–10", "score per match"], ["33", "countries"], ["6 am", "every morning"]], beispielH: "What a match looks like", wieH: "How it works", gewerkeH: "Tenders by trade",
    bsp: { titel: "Janitorial services for schools and offices", punkte: "9/10 great fit", lose: "3 lots", wert: "Value €1.4M", laufzeit: "48 months", frist: "Due in 18 days", neu: "new" } },
  fr: { hero: "Des marchés publics adaptés à votre entreprise.", cta: "Commencer gratuitement", demo: "Voir la démo", fakten: [["1–10", "points par résultat"], ["33", "pays"], ["6 h", "chaque matin"]], beispielH: "À quoi ressemble un résultat", wieH: "Comment ça marche", gewerkeH: "Appels d'offres par métier",
    bsp: { titel: "Nettoyage d'écoles et de bâtiments administratifs", punkte: "9/10 très adapté", lose: "3 lots", wert: "Valeur 1,4 M€", laufzeit: "48 mois", frist: "Remise dans 18 jours", neu: "nouveau" } },
  es: { hero: "Contratos públicos a la medida de tu empresa.", cta: "Empezar gratis", demo: "Ver la demo", fakten: [["1–10", "puntos por resultado"], ["33", "países"], ["6 h", "cada mañana"]], beispielH: "Así se ve un resultado", wieH: "Cómo funciona", gewerkeH: "Licitaciones por oficio",
    bsp: { titel: "Limpieza de colegios y edificios administrativos", punkte: "9/10 encaja muy bien", lose: "3 lotes", wert: "Valor 1,4 M€", laufzeit: "48 meses", frist: "Plazo en 18 días", neu: "nuevo" } },
  it: { hero: "Appalti pubblici adatti alla tua impresa.", cta: "Inizia gratis", demo: "Guarda la demo", fakten: [["1–10", "punti per risultato"], ["33", "paesi"], ["6:00", "ogni mattina"]], beispielH: "Ecco un risultato", wieH: "Come funziona", gewerkeH: "Gare per settore",
    bsp: { titel: "Pulizie di scuole e uffici pubblici", punkte: "9/10 molto adatta", lose: "3 lotti", wert: "Valore 1,4 mln €", laufzeit: "48 mesi", frist: "Scadenza tra 18 giorni", neu: "nuovo" } },
  nl: { hero: "Overheidsopdrachten die bij jouw bedrijf passen.", cta: "Gratis beginnen", demo: "Eerst de demo bekijken", fakten: [["1–10", "punten per match"], ["33", "landen"], ["6 uur", "elke ochtend"]], beispielH: "Zo ziet een match eruit", wieH: "Zo werkt het", gewerkeH: "Aanbestedingen per vak",
    bsp: { titel: "Schoonmaak van scholen en kantoren", punkte: "9/10 past heel goed", lose: "3 percelen", wert: "Waarde € 1,4 mln", laufzeit: "48 maanden", frist: "Inschrijven binnen 18 dagen", neu: "nieuw" } },
  pl: { hero: "Zamówienia publiczne dopasowane do Twojej firmy.", cta: "Zacznij za darmo", demo: "Zobacz demo", fakten: [["1–10", "punktów za wynik"], ["33", "kraje"], ["6:00", "każdego ranka"]], beispielH: "Tak wygląda wynik", wieH: "Jak to działa", gewerkeH: "Przetargi według branży",
    bsp: { titel: "Sprzątanie szkół i budynków urzędów", punkte: "9/10 bardzo pasuje", lose: "3 części", wert: "Wartość 1,4 mln €", laufzeit: "48 miesięcy", frist: "Termin za 18 dni", neu: "nowy" } },
  pt: { hero: "Contratos públicos à medida da sua empresa.", cta: "Começar grátis", demo: "Ver a demonstração", fakten: [["1–10", "pontos por resultado"], ["33", "países"], ["6h", "todas as manhãs"]], beispielH: "Assim é um resultado", wieH: "Como funciona", gewerkeH: "Concursos por setor",
    bsp: { titel: "Limpeza de escolas e edifícios públicos", punkte: "9/10 muito adequado", lose: "3 lotes", wert: "Valor 1,4 M€", laufzeit: "48 meses", frist: "Prazo em 18 dias", neu: "novo" } },
};
const US_BEISPIEL = { titel: "Janitorial Services – VA Medical Center", punkte: "9/10 great fit", lose: "Total Small Business set-aside", wert: "NAICS 561720", laufzeit: "Base + 4 option years", frist: "Due in 18 days", neu: "new" };

const LOGO_HELL = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect x="2" y="2" width="124" height="124" rx="30" fill="#fff"/><circle cx="64" cy="64" r="43" fill="none" stroke="#15324b" stroke-opacity=".3" stroke-width="2"/><circle cx="64" cy="64" r="4" fill="#15324b"/><path d="M64 18 77 62 64 56 51 62Z" fill="#ff6b35"/><path d="m64 110-13-44 13 6 13-6z" fill="#168aad"/><path d="m18 64 44-13-6 13 6 13zM110 64 66 77l6-13-6-13z" fill="#15324b"/></svg>';
const SCHRITT_SYMBOL = ["lupe", "dokument", "rechner"];

/** Extra lines for the US page: federal set-asides etc. (more once the US research is built in). */
const US_EXTRA = `<h2>Built for small businesses bidding on government contracts</h2>
<ul><li>Federal opportunities from SAM.gov every day: solicitations, combined synopsis/solicitations and sources sought.</li>
<li>See set-asides (small business, 8(a), HUBZone, WOSB, SDVOSB), NAICS code and response deadline at a glance.</li>
<li>Your team, shifts and timesheets in one place once you win.</li></ul>`;

/** Country and language links (shown at the bottom of the public start page). */
export function landWahl(b: Besucher): string {
  const t = T[b.sprache];
  const kurz = (l: string) => b.sprache === "de" ? landName(l, "de") : regionName(l, b.sprache) ?? landName(l, b.sprache).replace(/^the /, "");
  const laender = Object.keys(ISO2).sort((x, y) => kurz(x).localeCompare(kurz(y)));
  return `<nav class="land-wahl" aria-label="${escape(t.landWechseln)}">🌍 ${escape(t.landWechseln)}: ${laender.map((l) => `<a href="/${l.toLowerCase()}"${l === b.land ? ' aria-current="true"' : ""}>${escape(kurz(l))}</a>`).join(" · ")}</nav>
<nav class="land-wahl" aria-label="${escape(t.sprache)}">🌐 ${escape(t.sprache)}: ${SPRACHEN_OEFFENTLICH.map((s) => `<a href="/${b.iso3 ? b.land.toLowerCase() : ""}?sprache=${s}" lang="${s}"${s === b.sprache ? ' aria-current="true"' : ""}>${s.toUpperCase()}</a>`).join(" · ")}</nav>`;
}

export const keineBehoerde = (s: Sprache) => T[s].keineBehoerde;

const KOPF: Record<Sprache, [string, string]> = { de: ["Ausschreibungs-Alarm", "Konto"], en: ["Tender alerts", "Account"], fr: ["Alertes appels d'offres", "Compte"], es: ["Alertas de licitaciones", "Cuenta"], it: ["Avvisi gare", "Account"], nl: ["Aanbestedingsalarm", "Account"], pl: ["Alerty przetargowe", "Konto"], pt: ["Alertas de concursos", "Conta"] };
/** Translates the page header line of seite() for the public start page. */
export function kopfZeile(html: string, s: Sprache): string {
  return html.replace(' · Ausschreibungs-Alarm · <a href="/konto">Konto</a></header>', ` · ${escape(KOPF[s][0])} · <a href="/konto">${escape(KOPF[s][1])}</a></header>`);
}

export function landesSeite(b: Besucher, adresse: string, zusatzDe: string): { titel: string; inhalt: string; kopf: string } {
  const t = T[b.sprache];
  const abgedeckt = Boolean(b.iso3);
  const land = landName(b.land, b.sprache);
  const wahl = landWahl(b);
  const h = HELD[b.sprache];
  const bsp = b.land === "US" && b.sprache === "en" ? US_BEISPIEL : h.bsp;
  const inhalt = `<section class="start-hero">
<div class="start-marke">${LOGO_HELL}<span>Jarvis<small>WP Digital Ranger</small></span></div>
<h1>${escape(h.hero)}</h1>
${abgedeckt ? `<p>${escape(t.intro(land))}</p>` : `<p class="start-hinweis">${escape(t.nichtAbgedeckt)}</p>`}
<a class="start-cta" href="/registrieren">${escape(h.cta)} ${symbol("pfeil")}</a>
<a class="start-demo" href="/demo">${escape(h.demo)}</a>
<ul class="start-fakten">${h.fakten.map(([z, l]) => `<li><strong>${escape(z)}</strong><span>${escape(l)}</span></li>`).join("")}</ul>
</section>
<p class="start-konto">${escape(t.konto)} <a href="/anmelden">${escape(t.anmelden)}</a>${abgedeckt ? ` · <span>${escape(t.quelle)}: ${escape(quelle(b.land))}</span>` : ""}</p>
<h2>${escape(h.beispielH)}</h2>
<div class="start-beispiel"><div class="start-beispiel-kopf"><span class="start-punkte">${escape(bsp.punkte)}</span><span class="klein">${escape(bsp.neu)}</span></div>
<h3>${escape(bsp.titel)}</h3>
<ul class="start-chips"><li>${escape(bsp.lose)}</li><li>${escape(bsp.wert)}</li><li>${escape(bsp.laufzeit)}</li></ul>
<p class="start-frist">${symbol("uhr")} ${escape(bsp.frist)}</p></div>
<h2>${escape(h.wieH)}</h2>
<ol class="start-schritte">${t.schritte.map(([k, v], i) => `<li><span class="start-nr">${symbol(SCHRITT_SYMBOL[i] ?? "haken")}</span><div><strong>${escape(k)}</strong><span>${escape(v)}</span></div></li>`).join("")}</ol>
${b.land === "US" && b.sprache === "en" ? US_EXTRA : ""}
${t.hinweisApp ? `<p class="klein">${escape(t.hinweisApp)}</p>` : ""}
${b.land === "DE" && b.sprache === "de" ? zusatzDe : ""}
<details class="start-wahl"><summary>${symbol("globus")} <span>${escape(t.landWechseln)}: <b>${escape(landName(b.land, b.sprache).replace(/^the /, ""))}</b> · ${escape(t.sprache)}: <b>${b.sprache.toUpperCase()}</b></span></summary>${wahl}</details>
<p class="klein start-fuss">${escape(t.keineBehoerde)}</p>`;
  const alle = Object.keys(ISO2).map((l) => `<link rel="alternate" hreflang="${HAUPTSPRACHE[l] ?? "en"}-${l}" href="${adresse}/${l.toLowerCase()}">`).join("");
  const kopf = `<link rel="canonical" href="${adresse}/${b.iso3 ? b.land.toLowerCase() : ""}">${alle}<link rel="alternate" hreflang="x-default" href="${adresse}/">`;
  return { titel: h.hero, inhalt, kopf };
}

/** Cookies that remember an explicit choice (country from /xx, language from ?sprache=). One year. */
export function wahlCookies(land: string | null, sprache: string | null): string[] {
  const c: string[] = [];
  if (land && ISO2[land.toUpperCase()]) c.push(`jv_land=${land.toUpperCase()}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
  if (sprache && (SPRACHEN_OEFFENTLICH as readonly string[]).includes(sprache)) c.push(`jv_psprache=${sprache}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
  return c;
}

/** Sitemap entries for the country pages. */
export function landesUrls(adresse: string): string[] {
  return Object.keys(ISO2).map((l) => `${adresse}/${l.toLowerCase()}`);
}
