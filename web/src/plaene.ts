// Plans and prices (Benjamin, 06.11.2026: 59 / 149 / 399 € a month, yearly payment = 10 months, payment by invoice).
// Public price page /preise and the plan choice /konto/plan (preise.ts). The limits below are NOT enforced yet; the
// operator sets the plan on /konto/betreiber after the order and writes the invoice there.
import { escape } from "./seite.ts";

export type Plan = { id: string; name: string; monat: number; fuer: string; punkte: string[] };
/** Limits per plan from the proposal docs/abos.md and docs/ki-kosten-plaene.md (03.11.2026). NOT enforced yet: switched on only
 * after Benjamin's OK. ki_euro_monat: AI allowance per firm and month (fair use); above it ratings go on, Steckbriefe from
 * documents only with an extra pack. */
export type Grenzen = { suchprofile: number | null; laender: number | null; nutzer: number | null; einsatzkraefte: number | null; steckbriefe_monat: number | null; ki_euro_monat: number | null; arbeitsoberflaeche: boolean; taeglich: boolean };

export const PLAENE: Plan[] = [
  { id: "kostenlos", name: "Free", monat: 0, fuer: "Zum Ausprobieren", punkte: ["Ausschreibungen passend zu deiner Firma (1 Suchprofil, 1 Land)", "Kurzüberblick zu jeder Ausschreibung", "Wöchentliche Zusammenfassung"] },
  { id: "basis", name: "Basis", monat: 59, fuer: "Für kleine Firmen", punkte: ["Alles aus Free", "Tägliche Nachricht per Mail und Handy", "3 Suchprofile, 3 Nutzer", "5 Steckbriefe aus Unterlagen pro Monat, Kalkulation"] },
  { id: "pro", name: "Pro", monat: 149, fuer: "Für Dienstleister mit eigenem Personal", punkte: ["Alles aus Basis", "Angebote vorbereiten und freigeben", "Personal, Einsatzplanung, Zeiterfassung, Abrechnung", "5 Büro-Nutzer, 25 Einsatzkräfte, alle Länder, 30 Steckbriefe"] },
  { id: "business", name: "Business", monat: 399, fuer: "Für Firmen mit vielen Standorten", punkte: ["Alles aus Pro", "Standorte unbegrenzt", "15 Büro-Nutzer, 100 Einsatzkräfte, 100 Steckbriefe", "Bevorzugter Support"] },
];
/** Yearly payment: 12 months for the price of 10 (Benjamin, 06.11.2026). */
export const jahrespreis = (monat: number) => monat * 10;
export const ZUSATZ = { einsatzkraftPro: 3.5, einsatzkraftBusiness: 3, einsatzkraftAb501: 2.5, steckbriefPaket: { anzahl: 10, preis: 15 } } as const;
const euro = (x: number) => `${x.toLocaleString("de-DE", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
export const preisText = (p: Plan, jaehrlich = false) => p.monat === 0 ? "0 €" : jaehrlich ? `${euro(jahrespreis(p.monat))} / Jahr` : `${euro(p.monat)} / Monat`;

export const GRENZEN: Record<string, Grenzen> = {
  kostenlos: { suchprofile: 1, laender: 1, nutzer: 1, einsatzkraefte: 0, steckbriefe_monat: 0, ki_euro_monat: 1, arbeitsoberflaeche: false, taeglich: false },
  basis: { suchprofile: 3, laender: 2, nutzer: 3, einsatzkraefte: 0, steckbriefe_monat: 5, ki_euro_monat: 10, arbeitsoberflaeche: false, taeglich: true },
  pro: { suchprofile: 10, laender: null, nutzer: 5, einsatzkraefte: 25, steckbriefe_monat: 30, ki_euro_monat: 25, arbeitsoberflaeche: true, taeglich: true },
  business: { suchprofile: null, laender: null, nutzer: 15, einsatzkraefte: 100, steckbriefe_monat: 100, ki_euro_monat: 60, arbeitsoberflaeche: true, taeglich: true },
  test: { suchprofile: null, laender: null, nutzer: null, einsatzkraefte: null, steckbriefe_monat: null, ki_euro_monat: null, arbeitsoberflaeche: true, taeglich: true },
};

/** Trial (Benjamin, 03.11.2026; NOT active): every new firm gets Pro for 30 days without a card, once per firm (website
 * domain or VAT id), at most 10 Steckbriefe from documents; reminders on day 23 and 28, then Free (nothing deleted).
 * Same for all firm sizes, no video setup. */
export const PROBE = { plan: "pro", tage: 30, steckbriefe: 10, erinnerung_tage: [23, 28] } as const;

/** Monthly price per additional field worker (Benjamin, 03.11.2026; NOT active): Pro 3.50 €, Business 3 €, Business from
 * the 501st field worker 2.50 €. Free and Basis have no field-worker access. */
export function einsatzkraefteZusatz(plan: string, anzahl: number): number {
  const frei = GRENZEN[plan]?.einsatzkraefte ?? 0;
  const mehr = Math.max(0, anzahl - frei);
  if (plan === "pro") return mehr * 3.5;
  if (plan === "business") return Math.min(mehr, 500 - frei) * 3 + Math.max(0, anzahl - 500) * 2.5;
  return 0;
}

/** Limits of a stored plan id (unknown or old ids such as "erfolg" get the full preview access until plans go live). */
export const grenzen = (id: string): Grenzen => GRENZEN[id] ?? GRENZEN.test;

/** Name for a stored plan id; "test" is the full preview access. */
export function planName(id: string): string {
  return PLAENE.find((p) => p.id === id)?.name ?? (id === "test" ? "Test (voller Zugang)" : id);
}

/** Plan cards for the price page and the plan choice. With `wahl`, every paid plan gets an order form (payment by invoice). */
export function planKarten(o: { aktuell?: string; wahl?: boolean; firma?: string; stripe?: boolean; abo?: boolean } = {}): string {
  return `<div class="plan-raster">${PLAENE.map((p) => {
    const istAktuell = p.id === o.aktuell;
    // With Stripe: pay right away (card, direct debit, Apple/Google Pay) or still order by invoice. An existing Stripe
    // subscription is switched to the new plan instead of starting a second one.
    const knoepfe = o.stripe
      ? `<button name="weg" value="stripe">${o.abo ? `Zu ${escape(p.name)} wechseln` : `${escape(p.name)} jetzt bezahlen`}</button>${o.abo ? "" : `<button name="weg" value="rechnung" class="zweit">Per Rechnung bestellen</button>`}`
      : `<button>${escape(p.name)} bestellen</button>`;
    const bestellen = o.wahl && p.monat > 0 && !istAktuell
      ? `<form method="post" action="/konto/plan" class="plan-bestellen"><input type="hidden" name="plan" value="${p.id}"><fieldset><legend>Zahlweise</legend><label class="zeile"><input type="radio" name="zahlweise" value="monat" checked>${preisText(p)}, monatlich kündbar</label><label class="zeile"><input type="radio" name="zahlweise" value="jahr">${preisText(p, true)}, 2 Monate geschenkt</label></fieldset>${knoepfe}</form>`
      : "";
    return `<article class="plan-karte${p.id === "pro" ? " plan-empfohlen" : ""}${istAktuell ? " plan-aktuell" : ""}">${p.id === "pro" ? `<span class="plan-band">Beliebt</span>` : ""}<h3>${escape(p.name)}</h3><p class="plan-fuer">${escape(p.fuer)}</p>
<p class="plan-preis"><strong>${p.monat ? escape(`${p.monat} €`) : "0 €"}</strong><span>${p.monat ? " / Monat" : ""}</span></p>${p.monat ? `<p class="klein">oder ${escape(preisText(p, true))} (2 Monate geschenkt)</p>` : `<p class="klein">Für immer kostenlos</p>`}
<ul>${p.punkte.map((x) => `<li>${escape(x)}</li>`).join("")}</ul>${istAktuell ? `<p class="plan-dein"><strong>✓ Dein aktueller Plan</strong></p>` : ""}${bestellen}</article>`;
  }).join("")}</div>`;
}

export const PREIS_HINWEISE = `<ul class="plan-hinweise">
<li>Alle Preise netto. Als Kleinunternehmer nach § 19 UStG berechnet WP Digital Ranger derzeit keine Umsatzsteuer.</li>
<li>Weitere Einsatzkräfte: ${euro(ZUSATZ.einsatzkraftPro)} (Pro) bzw. ${euro(ZUSATZ.einsatzkraftBusiness)} (Business, ab der 501. ${euro(ZUSATZ.einsatzkraftAb501)}) pro Monat.</li>
<li>Zusatzpaket: ${ZUSATZ.steckbriefPaket.anzahl} Steckbriefe aus Unterlagen für ${euro(ZUSATZ.steckbriefPaket.preis)}.</li>
<li>Bezahlung per Rechnung und Überweisung, zahlbar in 14 Tagen. Monatlich: zum Monatsende kündbar. Jährlich: 12 Monate zum Preis von 10.</li>
</ul>`;
const STRIPE_HINWEIS = `<li>Bezahlen per Karte, SEPA-Lastschrift, Apple Pay oder Google Pay über Stripe: Der Plan ist sofort frei, die Rechnung kommt per E-Mail. Kündigen, Zahlungsart ändern und Rechnungen laden unter „Abo verwalten“. Oder per Rechnung und Überweisung.</li>`;
/** Price notes; with Stripe the payment line names the automatic payment as well. */
export const preisHinweise = (stripe = false) => (stripe ? PREIS_HINWEISE.replace(/<li>Bezahlung per Rechnung[^<]*<\/li>/, `${STRIPE_HINWEIS}<li>Monatlich: zum Monatsende kündbar. Jährlich: 12 Monate zum Preis von 10.</li>`) : PREIS_HINWEISE);
export type AboStand = { status: string | null; bis: string | null; kuendigt: boolean; zahlweise: string | null; kunde: boolean };

/** In-app plan page: current plan, cards with order form for owners and admins. */
/** Messages after a POST on /konto/plan, passed as a code in ?hinweis= (never free text from the URL). */
export const PLAN_HINWEISE: Record<string, string> = {
  portal: "Die Abo-Verwaltung ist gerade nicht erreichbar. Bitte später noch einmal.",
  plan: "Bitte einen Plan wählen.",
  bezahlseite: "Die Bezahlseite ist gerade nicht erreichbar. Bitte später noch einmal oder per Rechnung bestellen.",
  fehler: "Die Bestellung konnte nicht gesendet werden. Bitte schreib uns an kontakt@wpdigitalranger.com.",
};
/** Order confirmation (by invoice). Plan, price and email sit in their own elements, so the fixed sentences translate. */
export const bestellHinweis = (p: Plan, jaehrlich: boolean, email: string) =>
  `Danke! Deine Bestellung ist bei uns: <strong>${escape(p.name)}</strong> (<span>${escape(preisText(p, jaehrlich))}</span>).<br>Wir schalten den Plan frei und schicken die Rechnung an <strong>${escape(email)}</strong>.`;
/** Plan switch of a running Stripe subscription. */
export const wechselHinweis = (p: Plan) => `Plan gewechselt: <strong>${escape(p.name)}</strong>.<br>Der Unterschied wird anteilig verrechnet; der Plan ist in wenigen Sekunden frei.`;

export function planSeite(aktuell: string, firma: string, darfAendern: boolean, hinweis = "", o: { stripe?: boolean; abo?: AboStand | null; test?: boolean; hinweisHtml?: string } = {}): string {
  const a = o.abo;
  const datum = (x: string | null) => (x ? new Date(x).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");
  const aktiv = !!a?.status && ["active", "trialing", "past_due"].includes(a.status);
  const aboZeile = a?.status ? `<p class="klein">${aktiv ? (a.kuendigt ? `Gekündigt, läuft bis ${datum(a.bis)}. Danach Free.` : `Abo aktiv, ${a.zahlweise === "jahr" ? "jährlich" : "monatlich"}${a.bis ? `, nächste Abbuchung am ${datum(a.bis)}` : ""}.`) : a.status === "canceled" ? "Abo beendet." : `Abo-Status: ${escape(a.status)}.`}${a.status === "past_due" ? " <strong>⚠️ Die letzte Zahlung ist fehlgeschlagen. Bitte unter „Abo verwalten“ die Zahlungsart prüfen.</strong>" : ""}</p>` : "";
  const verwalten = darfAendern && o.stripe && a?.kunde ? `<form method="post" action="/konto/plan"><input type="hidden" name="weg" value="portal"><button class="zweit">Abo verwalten (kündigen, Zahlungsart, Rechnungen)</button></form>` : "";
  const test = o.test && o.stripe ? `<p class="hinweis">🧪 Stripe-Testmodus: nur du siehst die Bezahl-Knöpfe. Testkarte 4242 4242 4242 4242, beliebiges Datum in der Zukunft, beliebige Prüfziffer.</p>` : "";
  return `${hinweis || o.hinweisHtml ? `<p class="hinweis" role="status">${o.hinweisHtml ?? escape(hinweis)}</p>` : ""}${test}<p>Dein Plan: <strong>${escape(planName(aktuell))}</strong></p>${aboZeile}${verwalten}${planKarten({ aktuell, wahl: darfAendern, firma, stripe: o.stripe, abo: aktiv && !!a?.kunde })}${preisHinweise(o.stripe)}${darfAendern ? `<p class="klein">${o.stripe ? "Mit Karte oder Lastschrift ist der Plan sofort frei. Per Rechnung schalten wir ihn nach der Bestellung frei und schicken die Rechnung per E-Mail." : "Nach der Bestellung schalten wir den Plan frei und schicken die Rechnung per E-Mail."}</p>` : `<p class="klein">Den Plan ändert ein Inhaber oder Admin der Firma.</p>`}`;
}
