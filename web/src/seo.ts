// Search engines and link previews (SEO-Bestandsaufnahme des Browser-Chats, 04.11.2026): page title without the
// doubled brand, description, Open Graph/Twitter preview with an image, structured data for the start page.
const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const OG_PFAD = "/og-v1.jpg";

// Programs that load a page once to build the preview card of a shared link (WhatsApp, Messenger, Instagram and
// iMessage use facebookexternalhit; plus Telegram, X, LinkedIn, Slack, Discord, Mastodon, Bluesky). They send no
// language and mostly come from the USA, so they got our German pages half translated into English.
const VORSCHAU_ROBOTER = /facebookexternalhit|Facebot|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|Pinterest|vkShare|Viber|cardyb|Mastodon|http\.rb|Iframely|Embedly/i;
export const istVorschauRoboter = (request: Request): boolean => VORSCHAU_ROBOTER.test(request.headers.get("user-agent") ?? "");

/** Languages with an own preview picture (/og-<language>-v1.jpg); every other language shows the English one. */
export const OG_SPRACHEN = ["de", "fr", "pl", "es", "it"] as const;

/** Finished page: the preview picture follows the language of the page (`<html lang="…">`). */
export function vorschauBild(html: string): string {
  const sprache = /<html lang="([a-z]{2})"/.exec(html.slice(0, 200))?.[1] ?? "";
  return (OG_SPRACHEN as readonly string[]).includes(sprache) ? html.replace(`${ADRESSE}${OG_PFAD}"`, `${ADRESSE}/og-${sprache}-v1.jpg"`) : html;
}
const ADRESSE = "https://crewtender.eu";

/** Title as shown in the browser tab and in Google: the brand only once. */
export function seitenTitel(titel: string): string {
  return /crewtender/i.test(titel) ? titel : `${titel} · Crewtender`;
}

/** Tags every page gets (preview when a link is shared on WhatsApp, LinkedIn, Facebook …). */
export function grundTags(titel: string): string {
  return `<meta property="og:site_name" content="Crewtender"><meta property="og:type" content="website"><meta property="og:title" content="${escape(seitenTitel(titel))}"><meta property="og:image" content="${ADRESSE}${OG_PFAD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`;
}

/** Description, Open Graph description and URL, optional JSON-LD, for public pages. */
export function seoKopf(o: { beschreibung: string; url: string; jsonld?: unknown }): string {
  const b = escape(o.beschreibung.replace(/\s+/g, " ").trim().slice(0, 300));
  return `<meta name="description" content="${b}"><meta property="og:description" content="${b}"><meta property="og:url" content="${escape(o.url)}">${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, "\\u003c")}</script>` : ""}`;
}

/** Pages that already set a description (trade pages, legal pages) get the matching Open Graph description too. */
export function ogErgaenzen(html: string): string {
  if (html.includes('property="og:description"')) return html;
  const m = html.match(/<meta name="description" content="([^"]*)">/);
  return m ? html.replace(m[0], `${m[0]}<meta property="og:description" content="${m[1]}">`) : html;
}

/** Structured data for the start page: who offers the app and what it is. */
export const START_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${ADRESSE}/#org`, name: "Crewtender", url: `${ADRESSE}/`, logo: `${ADRESSE}/icon-v2-512.png`, email: "hello@crewtender.eu",
      sameAs: ["https://www.instagram.com/crew_tender/", "https://bsky.app/profile/crewtender.eu", "https://mastodon.social/@crewtender", "https://www.facebook.com/profile.php?id=61596423171638"],
      parentOrganization: { "@type": "Organization", name: "WP Digital Ranger" } },
    { "@type": "WebApplication", name: "Crewtender", url: `${ADRESSE}/`, applicationCategory: "BusinessApplication", operatingSystem: "Web, Android, iOS (Browser)",
      description: "Findet passende öffentliche Ausschreibungen, hilft beim Angebot und plant das Team.", publisher: { "@id": `${ADRESSE}/#org` } },
  ],
};

export const START_BESCHREIBUNG = "Crewtender findet jeden Morgen passende öffentliche Ausschreibungen, hilft beim Angebot und plant dein Team. Für Handwerk, Reinigung, Sicherheit, Personaldienstleister und viele weitere Branchen. 30 Tage Pro gratis testen.";
