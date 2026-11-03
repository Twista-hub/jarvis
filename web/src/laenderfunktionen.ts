// Rechtsprüfung 03.11.2026 (docs/recht/pruefung-2026-11.md L1, A5, S7): staff planning, time recording, payroll,
// invoices, VAT and DATEV follow German law (ArbZG, MiLoG, § 3b EStG, BUrlG, AÜG, § 14 UStG, XRechnung, ELSTER, DATEV).
// For a firm in another country they would be wrong, so they are only offered for firms in Germany until there are
// rules for that country. Tenders, search, offers, staff list and chat work everywhere.
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";

/** Pages that apply German labour, payroll or tax law. */
export const NUR_DEUTSCHLAND = /^\/konto\/(schichten|stunden|lohn|zeitkonto|urlaub|aueg|rechnungen|umsatzsteuer|belege|nachkalkulation|spesen|disposition)(\/|\.|-|$)/;

export const LAND_NAMEN: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", FR: "Frankreich", BE: "Belgien", LU: "Luxemburg", NL: "Niederlande", PL: "Polen", ES: "Spanien", IT: "Italien", US: "USA", XX: "anderes Land" };
const SPRACHE_LAND: Record<string, string> = { de: "DE", fr: "FR", pl: "PL", es: "ES", it: "IT" };

/** Country of the firm: chosen in the firm profile, else guessed from the app language of the setup (German → DE). */
export async function landDerFirmaCode(s: Sitzung, env: KontoEnv, firma: string): Promise<string> {
  const [p, sp] = await Promise.all([
    db<{ land: string | null }[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=land`),
    db<{ einstellungen: { sprache?: string } | null }[]>(s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=einstellungen&limit=1`),
  ]);
  const gewaehlt = p.ok ? p.daten[0]?.land : null;
  if (gewaehlt) return gewaehlt;
  return SPRACHE_LAND[(sp.ok ? sp.daten[0]?.einstellungen?.sprache : undefined) ?? "de"] ?? "";
}

export function nurDeutschlandSeite(land: string): string {
  return `<h2>Nur für Firmen in Deutschland</h2><p>Diese Funktion rechnet nach deutschem Recht (z. B. Arbeitszeitgesetz, Mindestlohn, Zuschläge, Umsatzsteuer, E-Rechnung, DATEV). Für ${land ? `eine Firma in <strong>${escape(LAND_NAMEN[land] ?? land)}</strong>` : "eine Firma außerhalb Deutschlands"} wären die Ergebnisse falsch, deshalb ist sie hier abgeschaltet, bis es Regeln für dieses Land gibt.</p><p>Ausschreibungen, Angebote, Personal, Kunden und Chat funktionieren wie gewohnt. Sitzt deine Firma doch in Deutschland? Dann im <a href="/konto/firmenprofil">Firmenprofil</a> das Land ändern.</p>`;
}
