// Plans, shown like on other portals: everyone starts in Free and can upgrade on /konto/plan.
// Prices and what each plan includes are still to be decided by Benjamin; edit them here only.
// Until online payment (Stripe) is set up, "Upgrade" opens a prepared e-mail to WP Digital Ranger.
import { escape } from "./seite.ts";

export type Plan = { id: string; name: string; preis: string; fuer: string; punkte: string[] };

export const PLAENE: Plan[] = [
  { id: "kostenlos", name: "Free", preis: "0 €", fuer: "Zum Ausprobieren", punkte: ["Ausschreibungen passend zu deiner Firma", "Steckbrief zu jeder Ausschreibung"] },
  { id: "basis", name: "Basis", preis: "Preis folgt", fuer: "Für kleine Firmen", punkte: ["Alles aus Free", "Tägliche Nachricht per Mail und Handy", "Unterlagen prüfen und kalkulieren"] },
  { id: "pro", name: "Pro", preis: "Preis folgt", fuer: "Für Firmen mit mehreren Standorten", punkte: ["Alles aus Basis", "Standorte, Teams und Rechte", "Angebote vorbereiten und freigeben"] },
  { id: "erfolg", name: "Erfolg", preis: "Preis folgt", fuer: "Zahlen, wenn ihr gewinnt", punkte: ["Alles aus Pro", "Abrechnung nach gewonnenen Aufträgen"] },
];

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
