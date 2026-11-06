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
export function planKarten(o: { aktuell?: string; wahl?: boolean; firma?: string } = {}): string {
  return `<div class="plan-raster">${PLAENE.map((p) => {
    const istAktuell = p.id === o.aktuell;
    const bestellen = o.wahl && p.monat > 0 && !istAktuell
      ? `<form method="post" action="/konto/plan" class="plan-bestellen"><input type="hidden" name="plan" value="${p.id}"><fieldset><legend>Zahlweise</legend><label class="zeile"><input type="radio" name="zahlweise" value="monat" checked>${preisText(p)}, monatlich kündbar</label><label class="zeile"><input type="radio" name="zahlweise" value="jahr">${preisText(p, true)}, 2 Monate geschenkt</label></fieldset><button>${escape(p.name)} bestellen</button></form>`
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

/** In-app plan page: current plan, cards with order form for owners and admins. */
export function planSeite(aktuell: string, firma: string, darfAendern: boolean, hinweis = ""): string {
  return `${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}<p>Dein Plan: <strong>${escape(planName(aktuell))}</strong></p>${planKarten({ aktuell, wahl: darfAendern, firma })}${PREIS_HINWEISE}${darfAendern ? `<p class="klein">Nach der Bestellung schalten wir den Plan frei und schicken die Rechnung per E-Mail.</p>` : `<p class="klein">Den Plan ändert ein Inhaber oder Admin der Firma.</p>`}`;
}
