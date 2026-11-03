// NOT ACTIVE YET (Benjamin, 30.10.2026: plans come last, when the app is finished). Not linked or routed.
// Plans, shown like on other portals: everyone starts in Free and can upgrade on /konto/plan.
// Prices and what each plan includes are still to be decided by Benjamin; edit them here only. The structure follows
// the proposal docs/abos.md; "vorschlag" is not shown anywhere and nothing is enforced until Benjamin's OK.
// Until online payment (Stripe) is set up, "Upgrade" opens a prepared e-mail to WP Digital Ranger.
import { escape } from "./seite.ts";

export type Plan = { id: string; name: string; preis: string; fuer: string; punkte: string[]; vorschlag?: string };
/** Limits per plan from the proposal docs/abos.md and docs/ki-kosten-plaene.md (03.11.2026). NOT enforced yet: switched on only
 * after Benjamin's OK. ki_euro_monat: AI allowance per firm and month (fair use); above it ratings go on, Steckbriefe from
 * documents only with an extra pack. */
export type Grenzen = { suchprofile: number | null; laender: number | null; nutzer: number | null; einsatzkraefte: number | null; steckbriefe_monat: number | null; ki_euro_monat: number | null; arbeitsoberflaeche: boolean; taeglich: boolean };

export const PLAENE: Plan[] = [
  { id: "kostenlos", name: "Free", preis: "0 €", fuer: "Zum Ausprobieren", punkte: ["Ausschreibungen passend zu deiner Firma (1 Suchprofil, 1 Land)", "Kurzüberblick zu jeder Ausschreibung", "Wöchentliche Zusammenfassung"] },
  { id: "basis", name: "Basis", preis: "Preis folgt", vorschlag: "59 € / Monat", fuer: "Für kleine Firmen", punkte: ["Alles aus Free", "Tägliche Nachricht per Mail und Handy", "3 Suchprofile, 3 Nutzer", "5 Steckbriefe aus Unterlagen pro Monat, Kalkulation"] },
  { id: "pro", name: "Pro", preis: "Preis folgt", vorschlag: "149 € / Monat", fuer: "Für Reinigung, Sicherheit, Handwerk und Zeitarbeit", punkte: ["Alles aus Basis", "Angebote vorbereiten und freigeben", "Personal, Einsatzplanung, Zeiterfassung, Abrechnung", "5 Büro-Nutzer, 25 Einsatzkräfte, alle Länder, 30 Steckbriefe"] },
  { id: "business", name: "Business", preis: "Preis folgt", vorschlag: "399 € / Monat", fuer: "Für Firmen mit vielen Standorten", punkte: ["Alles aus Pro", "Standorte unbegrenzt", "15 Büro-Nutzer, 100 Einsatzkräfte, 100 Steckbriefe", "Bevorzugter Support"] },
];

export const GRENZEN: Record<string, Grenzen> = {
  kostenlos: { suchprofile: 1, laender: 1, nutzer: 1, einsatzkraefte: 0, steckbriefe_monat: 0, ki_euro_monat: 1, arbeitsoberflaeche: false, taeglich: false },
  basis: { suchprofile: 3, laender: 2, nutzer: 3, einsatzkraefte: 0, steckbriefe_monat: 5, ki_euro_monat: 10, arbeitsoberflaeche: false, taeglich: true },
  pro: { suchprofile: 10, laender: null, nutzer: 5, einsatzkraefte: 25, steckbriefe_monat: 30, ki_euro_monat: 25, arbeitsoberflaeche: true, taeglich: true },
  business: { suchprofile: null, laender: null, nutzer: 15, einsatzkraefte: 100, steckbriefe_monat: 100, ki_euro_monat: 60, arbeitsoberflaeche: true, taeglich: true },
  test: { suchprofile: null, laender: null, nutzer: null, einsatzkraefte: null, steckbriefe_monat: null, ki_euro_monat: null, arbeitsoberflaeche: true, taeglich: true },
};

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

export function planSeite(aktuell: string, firma: string, darfAendern: boolean, kontakt: string): string {
  const karten = PLAENE.map((p) => {
    const istAktuell = p.id === aktuell;
    const knopf = istAktuell
      ? `<p><strong>✓ Dein aktueller Plan</strong></p>`
      : p.id === "kostenlos" || !darfAendern
        ? ""
        : `<p><a class="knopf" href="mailto:${kontakt}?subject=${encodeURIComponent(`Jarvis: Upgrade auf ${p.name}`)}&body=${encodeURIComponent(`Hallo,\n\nwir möchten für ${firma} auf den Plan ${p.name} wechseln.\n\nViele Grüße`)}">Upgrade auf ${escape(p.name)}</a></p>`;
    return `<article class="treffer-karte${istAktuell ? " plan-aktuell" : ""}"><h3>${escape(p.name)}</h3><p><strong>${escape(p.preis)}</strong> · ${escape(p.fuer)}</p><ul>${p.punkte.map((x) => `<li>${escape(x)}</li>`).join("")}</ul>${knopf}</article>`;
  }).join("");
  return `<h2>Dein Plan: ${escape(planName(aktuell))}</h2>${karten}${darfAendern ? "" : `<p class="klein">Den Plan ändert ein Inhaber oder Admin der Firma.</p>`}`;
}
