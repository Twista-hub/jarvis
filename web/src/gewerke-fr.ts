// French trade pages for search engines: /fr/appels-d-offres and /fr/appels-d-offres/<métier>, the counterpart of the
// German /ausschreibungen pages (gewerke.ts, linked both ways with hreflang). French notices come from the BOAMP open
// data (DILA, Licence Ouverte 2.0, source named on every page). No live numbers yet: BOAMP notices are read by the daily
// alarm and are not kept in the shared catalogue. The pages are always French (header x-jv-sprache, see index.ts).
import { escape, seite } from "./seite.ts";

type Metier = { slug: string; de: string; name: string; h1: string; cpv: string[]; intro: string; vorteile: string[]; fragen: [string, string][] };

const ALLGEMEIN: [string, string][] = [
  ["Combien coûte Jarvis ?", "L'inscription est gratuite. Vous voyez tout de suite les appels d'offres adaptés à votre entreprise et pouvez tout tester tranquillement."],
  ["D'où viennent les appels d'offres ?", "Du BOAMP (Bulletin officiel des annonces des marchés publics), en données ouvertes de la DILA. Le BOAMP publie les marchés à procédure adaptée à partir de 90 000 € HT et les avis européens concernant la France. Jarvis lit chaque jour tous les nouveaux avis, soit 120 à 250 appels d'offres par jour ouvré."],
  ["Puis-je limiter la recherche à mes départements ?", "Oui. Vous choisissez vos départements, au départ toute votre région. Jarvis n'affiche que les appels d'offres publiés pour ces départements."],
  ["Jarvis est-il un service public ?", "Non. Jarvis est un service privé de WP Digital Ranger, pas un organisme public."],
];

export const METIERS: Metier[] = [
  { slug: "nettoyage", de: "gebaeudereinigung", name: "Nettoyage", h1: "Appels d'offres publics de nettoyage de locaux et de vitrerie", cpv: ["90910000", "90911200", "90911300", "90919200"],
    intro: "Écoles, mairies, hôpitaux et bailleurs sociaux confient régulièrement le nettoyage de leurs locaux, la vitrerie et la remise en état. Les marchés sont souvent divisés en lots par bâtiment, accessibles aussi aux petites entreprises de propreté. Jarvis repère ceux qui correspondent à votre entreprise et à vos départements.",
    vorteile: ["Nettoyage courant, vitrerie et remise en état reconnus séparément", "Fiche synthèse avec lots, surfaces, fréquences, durée du marché et visite obligatoire", "Planning des équipes, relevés d'heures et attestations de passage pour les sites remportés"],
    fragen: [["Les marchés de nettoyage sont-ils accessibles aux petites entreprises ?", "Souvent, oui. Beaucoup d'acheteurs découpent le marché en lots par site. Jarvis affiche les lots, la durée et la date limite pour décider vite."]] },
  { slug: "securite-gardiennage", de: "sicherheitsdienst", name: "Sécurité et gardiennage", h1: "Appels d'offres publics de sécurité, gardiennage et surveillance", cpv: ["79710000", "79713000", "79714000", "79715000"],
    intro: "Surveillance de bâtiments, accueil, rondes, sécurité événementielle et SSIAP pour les collectivités, hôpitaux et établissements publics. Jarvis trouve les appels d'offres et résume les exigences : agréments, cartes professionnelles, effectifs.",
    vorteile: ["Gardiennage, accueil, rondes et sécurité incendie reconnus", "Fiche synthèse avec horaires, effectifs et justificatifs demandés", "Planning des agents avec postes ouverts que l'équipe peut prendre elle-même"],
    fragen: [["Jarvis aide-t-il à organiser les agents ?", "Oui. Vous voyez qui est disponible et quels justificatifs sont valables, planifiez les postes et laissez les agents prendre les postes ouverts depuis l'application."]] },
  { slug: "espaces-verts", de: "garten-landschaftsbau-winterdienst", name: "Espaces verts", h1: "Appels d'offres publics d'entretien des espaces verts et d'élagage", cpv: ["77310000", "77311000", "77313000", "77314000", "77211400"],
    intro: "Entretien des espaces verts, élagage, tonte et déneigement : communes, départements et bailleurs publient ces marchés chaque année, souvent en lots. Jarvis vous montre ceux de vos départements.",
    vorteile: ["Entretien, élagage, création paysagère et viabilité hivernale reconnus", "Rappel des dates limites et des visites de site", "Planning et relevés d'heures pour les équipes"],
    fragen: [["Quand les communes publient-elles leurs marchés d'espaces verts ?", "Toute l'année, avec un pic en fin d'hiver pour la saison suivante. Jarvis vous prévient chaque matin des nouveaux avis."]] },
  { slug: "electricite", de: "elektro", name: "Électricité", h1: "Appels d'offres publics d'électricité et de courants faibles", cpv: ["45311000", "45315000", "45317000", "45310000"],
    intro: "Installations électriques, éclairage, photovoltaïque, courants faibles et maintenance dans les écoles, gymnases et bâtiments publics. Jarvis trouve le lot électricité, même dans un grand marché de travaux en corps d'état séparés.",
    vorteile: ["Lot électricité repéré dans les marchés tous corps d'état", "Fiche synthèse avec lots, quantités, délais et qualifications demandées (par ex. Qualifelec)", "Dates limites et questions aux acheteurs dans le calendrier"],
    fragen: [["Les marchés publics valent-ils la peine pour un petit électricien ?", "Oui. Beaucoup de marchés sont allotis ou concernent un seul bâtiment. Jarvis affiche taille, lieu et date limite d'un coup d'œil."]] },
  { slug: "plomberie-chauffage-cvc", de: "sanitaer-heizung-lueftung", name: "Plomberie, chauffage, CVC", h1: "Appels d'offres publics de plomberie, chauffage et ventilation", cpv: ["45330000", "45331000", "45332000"],
    intro: "Remplacement de chaudières, ventilation, sanitaires et maintenance CVC dans les bâtiments publics : un des corps d'état les plus souvent mis en concurrence. Jarvis trie les marchés selon vos départements.",
    vorteile: ["Lots plomberie et CVC repérés dans les marchés de construction et de rénovation", "Rappel avant chaque date limite", "Fiche synthèse avec périmètre, durée et justificatifs (par ex. RGE, Qualibat)"],
    fragen: [["Comment trouver des marchés CVC près de chez moi ?", "À l'inscription, Jarvis prend votre région comme zone de recherche. Vous pouvez ajouter ou retirer des départements à tout moment, sans frais."]] },
  { slug: "peinture-platrerie", de: "maler-trockenbau", name: "Peinture et plâtrerie", h1: "Appels d'offres publics de peinture, plâtrerie et cloisons", cpv: ["45442100", "45441000", "45410000", "45421141"],
    intro: "Peinture, plâtrerie, cloisons et faux plafonds font partie de presque toutes les rénovations de bâtiments publics. Jarvis repère ces lots, même quand ils font partie d'une grande opération.",
    vorteile: ["Lots peinture, plâtrerie et faux plafonds reconnus", "Lieu et date limite d'un coup d'œil", "Fiche synthèse avec quantités et période d'exécution"],
    fragen: [["Ne s'agit-il que de grands chantiers ?", "Non. Beaucoup de marchés concernent une école, une crèche ou quelques logements et sont accessibles à des entreprises de quelques salariés."]] },
  { slug: "menuiserie", de: "tischler-schreiner", name: "Menuiserie", h1: "Appels d'offres publics de menuiserie intérieure et extérieure", cpv: ["45421000", "45421100", "45421150"],
    intro: "Portes, fenêtres, agencement et mobilier sur mesure sont attribués en lots séparés dans presque chaque opération publique. Jarvis trouve les lots qui correspondent à votre atelier.",
    vorteile: ["Lots menuiserie repérés dans les grandes opérations", "Fiche synthèse avec références demandées et critères d'attribution", "Dates limites et visites dans le calendrier"],
    fragen: [["Dois-je lire tout le DCE pour chaque marché ?", "Non. Jarvis résume l'avis. Si vous déposez le DCE, Jarvis lit tous les documents et rédige une fiche synthèse détaillée."]] },
  { slug: "couverture-charpente", de: "dach-zimmerer", name: "Couverture et charpente", h1: "Appels d'offres publics de couverture, charpente et étanchéité", cpv: ["45261000", "45261210", "45422000"],
    intro: "Réfection de toitures, charpente, étanchéité et construction bois pour écoles et équipements publics : Jarvis trouve les appels d'offres de vos départements et indique délai, périmètre et justificatifs.",
    vorteile: ["Lots couverture, charpente et étanchéité reconnus", "Dates limites et questions aux acheteurs dans le calendrier", "Fiche synthèse avec critères d'attribution"],
    fragen: [["À quelle fréquence Jarvis cherche-t-il ?", "Chaque jour. Vous recevez les nouveaux appels d'offres par e-mail ou notification à l'heure que vous choisissez."]] },
  { slug: "sols-carrelage", de: "bodenbelaege-fliesen", name: "Sols et carrelage", h1: "Appels d'offres publics de revêtements de sols et de carrelage", cpv: ["45432000", "45431000", "45432100"],
    intro: "Sols souples, résines et carrelage sont attribués séparément lors des rénovations et constructions publiques. Jarvis trouve les lots adaptés dans vos départements.",
    vorteile: ["Lots sols et carrelage repérés dans les opérations de travaux", "Rappel des dates limites et des visites", "Fiche synthèse avec surfaces et délais"],
    fragen: [["En combien de temps vois-je les nouveaux appels d'offres ?", "Chaque matin, par e-mail ou notification sur le téléphone, à l'heure de votre choix."]] },
  { slug: "interim-travail-temporaire", de: "zeitarbeit-personaldienstleister", name: "Intérim et travail temporaire", h1: "Appels d'offres publics d'intérim et de mise à disposition de personnel", cpv: ["79620000", "79621000", "79622000", "79624000", "79625000"],
    intro: "Hôpitaux, collectivités et restaurants collectifs recherchent du personnel intérimaire pour la restauration, le nettoyage, l'administratif ou le soin, souvent sous forme d'accord-cadre pluriannuel. Beaucoup de ces marchés sont publiés sous le métier concerné plutôt que sous « intérim ». Jarvis les trouve quand même.",
    vorteile: ["Repère les besoins en personnel aussi dans les marchés de restauration, nettoyage et accueil", "Planning des missions et relevés d'heures", "Validation en ligne des relevés par le client"],
    fragen: [["Jarvis trouve-t-il les marchés qui ne mentionnent pas l'intérim ?", "Oui. Jarvis analyse le besoin réel décrit dans l'avis, par exemple du personnel de cantine, et pas seulement le mot-clé."]] },
];

const LISTE = "/fr/appels-d-offres";
const QUELLE = `<p class="klein">Source : BOAMP, DILA (Licence Ouverte 2.0). Jarvis est un service privé de WP Digital Ranger, pas un organisme public.</p>`;
const KNOEPFE = `<div class="knopf-zeile"><a class="knopf" href="/sprache?zu=fr&amp;weiter=%2Fregistrieren">Trouver gratuitement des marchés adaptés</a><a class="knopf zweit" href="/sprache?zu=fr&amp;weiter=%2Fdemo">🎬 Voir la démo</a></div>`;

export function metierSeite(m: Metier): string {
  const fragen = [...m.fragen, ...ALLGEMEIN];
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "fr", mainEntity: fragen.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  return `<h1>${escape(m.h1)}</h1>
<p>${escape(m.intro)}</p>
${KNOEPFE}
<h2>Comment Jarvis aide les entreprises : ${escape(m.name.toLowerCase())}</h2>
<ul>${m.vorteile.map((v) => `<li>${escape(v)}</li>`).join("")}<li>Chaque matin, les nouveaux appels d'offres notés de 1 à 10, avec une phrase qui explique pourquoi ils vous correspondent</li><li>Recherche par départements, au départ toute votre région</li></ul>
<p class="klein">Codes CPV suivis notamment : ${m.cpv.map(escape).join(", ")}.</p>
<h2>Questions fréquentes</h2>
${fragen.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>Autres métiers</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Autres métiers">${METIERS.filter((x) => x.slug !== m.slug).map((x) => `<a href="${LISTE}/${x.slug}">${escape(x.name)}</a>`).join("")}</nav>
${QUELLE}
<script type="application/ld+json">${jsonld}</script>`;
}

export function uebersichtMetiers(): string {
  return `<h1>Appels d'offres publics par métier</h1><p>Jarvis lit chaque jour tous les nouveaux avis de marchés publics publiés au BOAMP et montre aux artisans, entreprises de services et agences d'intérim ceux qui leur correspondent, dans leurs départements. Choisissez votre métier :</p>
<div class="konto-kacheln team-werkzeuge">${METIERS.map((m) => `<a class="konto-kachel" href="${LISTE}/${m.slug}"><strong>${escape(m.name)}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
${KNOEPFE}
${QUELLE}`;
}

/** hreflang pair: German page ↔ French page (also used by the German pages). */
export function sprachPaar(adresse: string, de: string, fr: string): string {
  return `<link rel="alternate" hreflang="de" href="${adresse}${de}">\n<link rel="alternate" hreflang="fr" href="${adresse}${fr}">`;
}
export const frZuDe = (deSlug: string): string | null => METIERS.find((m) => m.de === deSlug)?.slug ?? null;

export const FR_PFADE = [LISTE, ...METIERS.map((m) => `${LISTE}/${m.slug}`)];

const kopf = (html: string, beschreibung: string, url: string, paar: string) =>
  html.replace('<html lang="de"', '<html lang="fr"').replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">\n${paar}`);

export function metiers(request: Request, adresse: string, antwort: (html: string) => Response): Response | null {
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.pathname.startsWith(LISTE)) return null;
  let r: Response;
  if (url.pathname === LISTE || url.pathname === `${LISTE}/`) {
    r = antwort(kopf(seite("Appels d'offres publics par métier", uebersichtMetiers()), "Appels d'offres publics pour le BTP, le nettoyage, la sécurité et l'intérim : Jarvis trouve chaque jour au BOAMP les marchés adaptés à votre entreprise, dans vos départements.", `${adresse}${LISTE}`, sprachPaar(adresse, "/ausschreibungen", LISTE)));
  } else {
    const slug = url.pathname.slice(LISTE.length + 1).replace(/\/$/, "");
    const m = METIERS.find((x) => x.slug === slug);
    if (!m) return new Response(null, { status: 301, headers: { location: LISTE } });
    r = antwort(kopf(seite(m.h1, metierSeite(m)), `${m.h1} : Jarvis lit chaque jour le BOAMP et vous envoie les marchés adaptés à votre entreprise, dans vos départements. Inscription gratuite.`, `${adresse}${LISTE}/${m.slug}`, sprachPaar(adresse, `/ausschreibungen/${m.de}`, `${LISTE}/${m.slug}`)));
  }
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.set("x-jv-sprache", "fr");
  r.headers.delete("x-robots-tag");
  return r;
}
