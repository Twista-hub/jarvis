// Public English guide "How to register in SAM.gov" (/us/sam-registration): free help for US small businesses that
// want federal contracts, and a way for them to find Jarvis through search engines. Facts from docs/usa-recherche.md
// (2.1, 2.3, 2.12; checked November 2026). No fees, no affiliation with the US government.
import { escape, seite } from "./seite.ts";

export const SAM_PFAD = "/us/sam-registration";

const SCHRITTE: [string, string][] = [
  ["Create a Login.gov account", "Go to <a href=\"https://login.gov\" rel=\"noopener\">login.gov</a> and create an account with your business email. Set up two-factor authentication (an authenticator app is the most reliable). SAM.gov uses this login."],
  ["Sign in to SAM.gov", "Open <a href=\"https://sam.gov\" rel=\"noopener\">sam.gov</a>, choose <strong>Sign In</strong> and log in with Login.gov. Fill in your user profile."],
  ["Start the entity registration", "In your <strong>Workspace</strong>, start a new entity registration. When asked for the purpose, choose <strong>All Awards</strong> (contracts and grants). \"Financial assistance only\" will not let you bid on contracts."],
  ["Get your Unique Entity ID (UEI)", "SAM.gov validates your legal business name and physical address and then assigns your 12-character UEI. The UEI does not expire, but your registration does."],
  ["Enter your core data", "Legal name and address exactly as the IRS has them (EIN/TIN), business start date, fiscal year end, banking details for payments (EFT), and your points of contact."],
  ["Add your NAICS codes and size", "List every NAICS code for work you offer (for example 561720 janitorial, 561730 landscaping, 238210 electrical). SAM.gov shows for each code whether you count as a small business under the SBA size standards."],
  ["Complete Representations and Certifications", "Answer the reps and certs (FAR 52.212-3 and others) carefully. They are legal statements to the government and are reused for every offer you make."],
  ["Submit and watch your email", "After submission the Defense Logistics Agency assigns your CAGE code. Expect about 7 to 10 business days; mismatches in name, address or TIN can take much longer. SAM.gov may ask for a notarized letter confirming your entity administrator."],
];

const CHECKLISTE = [
  "EIN/TIN and your legal business name exactly as registered with the IRS",
  "Physical business address (no P.O. box) exactly as on file with USPS",
  "Bank account and routing number for electronic payments (EFT)",
  "Your NAICS codes and a short description of what you do",
  "Name, email and phone of the people who will manage the registration",
  "About one hour of uninterrupted time",
];

const DANACH: [string, string][] = [
  ["Renew every year", "Your registration expires after 365 days. Renew it early on sam.gov; if it lapses you cannot receive new awards. It is free."],
  ["Fill in your Small Business Search profile", "Contracting officers search SBA's Small Business Search (formerly DSBS) for capable firms. Add a clear capability narrative and keywords."],
  ["Apply for SBA certifications if you qualify", "WOSB/EDWOSB, HUBZone, VOSB/SDVOSB and 8(a) are free through MySBA Certifications and unlock set-aside contracts."],
  ["Get free local help", "APEX Accelerators (formerly PTACs) offer free one-on-one help with registration, bids and certifications."],
];

const FRAGEN: [string, string][] = [
  ["Does SAM.gov registration cost anything?", "No. Registration and renewal are always free. Companies that charge for it are private service providers, and emails demanding payment to keep your registration active are usually scams."],
  ["How long does it take?", "Usually 7 to 10 business days after you submit. Name, address or tax ID mismatches, or a requested notarized letter, can add several weeks."],
  ["Do I need a UEI to bid?", "Yes. Federal contracts require an active SAM.gov registration with a UEI at the time you submit your offer."],
  ["What is the difference between UEI and CAGE?", "The UEI identifies your entity across the federal government and is assigned by SAM.gov. The CAGE code is assigned by the Defense Logistics Agency after registration and is used on many contract documents."],
];

export function samAnleitung(adresse: string): string {
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FRAGEN.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return `<h1>How to register in SAM.gov (free): step by step</h1>
<p>To win federal contracts, your business needs an active registration in SAM.gov, the US government's System for Award Management. This guide walks you through it in plain language.</p>
<div class="hinweis"><p><strong>Key facts:</strong> free of charge · usually 7 to 10 business days · renew every 365 days · you get a UEI and a CAGE code.</p></div>
<h2>Before you start</h2>
<ul>${CHECKLISTE.map((c) => `<li>${escape(c)}</li>`).join("")}</ul>
<h2>Step by step</h2>
<ol class="sam-schritte">${SCHRITTE.map(([k, v]) => `<li><strong>${escape(k)}.</strong> ${v}</li>`).join("")}</ol>
<div class="hinweis"><p><strong>Watch out for scams.</strong> SAM.gov never charges a fee. After you register, your UEI and CAGE are public, and some companies send official-looking emails asking you to pay to "keep your SAM registration active". You don't have to pay anyone.</p></div>
<h2>After you are registered</h2>
<ul>${DANACH.map(([k, v]) => `<li><strong>${escape(k)}:</strong> ${escape(v)}</li>`).join("")}</ul>
<h2>Frequently asked questions</h2>
${FRAGEN.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>Find contracts that fit you</h2>
<p>Once you are registered, Jarvis checks new federal opportunities every morning and shows you only the ones that fit your trade and area, with a clear "May I bid?" check (set-aside, size, NAICS, registration) and a deadline tracker.</p>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Start for free</a><a class="knopf zweit" href="/us">How Jarvis works</a></div>
<p class="klein">Official sources: <a href="https://sam.gov/content/entity-registration" rel="noopener">SAM.gov entity registration</a> · <a href="https://www.fsd.gov" rel="noopener">Federal Service Desk</a> · <a href="https://certifications.sba.gov" rel="noopener">MySBA Certifications</a> · <a href="https://www.apexaccelerators.us" rel="noopener">APEX Accelerators</a>. Last checked November 2026.</p>
<p class="klein">Private service by WP Digital Ranger, Germany. Not affiliated with or endorsed by SAM.gov, GSA, SBA or any US government agency. This guide is general information, not legal advice.</p>
<script type="application/ld+json">${JSON.stringify(faq).replace(/</g, "\\u003c")}</script>`;
}

/** GET /us/sam-registration: the public guide (English, indexable). */
export function samAnleitungSeite(request: Request, adresse: string, antwort: (html: string) => Response): Response | null {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== SAM_PFAD) return null;
  const html = seite("How to register in SAM.gov (free)", samAnleitung(adresse))
    .replace('<html lang="de"', '<html lang="en"')
    .replace("</title>", `</title>\n<meta name="description" content="Free step-by-step guide to SAM.gov registration for small businesses: what you need, how long it takes, UEI and CAGE, renewal and how to avoid scams.">\n<link rel="canonical" href="${adresse}${SAM_PFAD}">`);
  const r = antwort(html);
  r.headers.delete("x-robots-tag");
  r.headers.set("cache-control", "public, max-age=3600");
  return r;
}
