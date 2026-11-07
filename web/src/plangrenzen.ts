// Plan limits in the app (Benjamin 07.11.2026). The database enforces the counted limits (migration
// 20261107020000_plan_grenzen.sql: office users, field workers, locations, search profiles, Steckbriefe); this file
// gates the Pro workspace and shows friendly hints. Nothing is ever deleted: after a downgrade the pages stay readable
// (and downloadable), only changes are stopped.
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import { planName } from "./plaene.ts";

export type PlanArt = "suchprofile" | "laender" | "buero" | "einsatzkraefte" | "standorte" | "steckbriefe" | "arbeitsoberflaeche" | "unterlagen" | "taeglich";
export type PlanStand = {
  plan: string;
  paket: string;
  probe_bis: string | null;
  grenzen: Partial<Record<PlanArt, number | null>>;
  genutzt: { buero: number; buero_offen: number; einsatzkraefte: number; einsatzkraefte_offen: number; standorte: number; steckbriefe: number };
};

/** Plan, trial and usage of a firm; null when it cannot be read (then nothing is blocked in the app). */
export async function planStand(s: Sitzung, env: KontoEnv, firma: string): Promise<PlanStand | null> {
  const r = await db<PlanStand>(s, env, "rpc/plan_stand", { method: "POST", body: JSON.stringify({ f: firma }) });
  return r.ok && r.daten && typeof r.daten === "object" ? r.daten : null;
}

/** The limit of one kind; undefined when unknown (= not blocked), null = unlimited. */
export const grenzeVon = (p: PlanStand | null, art: PlanArt): number | null | undefined => (p ? p.grenzen[art] : undefined);
/** Switch-like limits (workspace, company documents, daily message). */
export const darf = (p: PlanStand | null, art: PlanArt) => grenzeVon(p, art) !== 0;
/** Room for one more (office user or field worker, counting open invitations). */
export function platzFuer(p: PlanStand | null, art: "buero" | "einsatzkraefte", neu = 1): boolean {
  const g = grenzeVon(p, art);
  if (g === undefined || g === null || !p) return true;
  return p.genutzt[art] + p.genutzt[`${art}_offen`] + neu <= g;
}

/** Name of the effective plan for messages ("probe" is the 30-day trial with Pro features). */
export const planAnzeige = (plan: string) => (plan === "probe" ? "Pro (Probezeit)" : planName(plan));

/** Pro workspace: staff, scheduling, time recording, billing, offers and approvals, organisation. */
export const ARBEITSOBERFLAECHE = /^\/konto\/(personal(\/|$)|personalsuche|personalfristen|personalauswertung|standort\/|tarifvertrag|qualifikation|einsatz\/|schichten|disposition|rundnachricht|kapazitaet|stunden|zeitkonto|urlaub|lohn|rechnungen|spesen|belege|nachkalkulation|umsatzsteuer|leistungsnachweis|kunden(\/|$)|kundenportal|angebotsmappe\/|angebotsabgabe\/|angebotsfreigaben|freigaben|freigabe\/|angebote$|organigramm|rechte$|vertretung|aufgaben|kraefte-einladen|ich(\/|$)|psa|bewerber|checklisten|bewertungen|betriebsmittel|unterweisungen|aueg|rundgaenge)|^\/konto\/vorgang\/[0-9a-f-]{36}\/(einsatz|einsatzplan|angebot|freigeben)(\/|$)/;
/** Company documents and certificates: from Basis. */
export const FIRMENUNTERLAGEN = /^\/konto\/firmenunterlage/;

/** Which plan switch a path needs, or null. */
export function planBereich(pfad: string): "arbeitsoberflaeche" | "unterlagen" | null {
  if (ARBEITSOBERFLAECHE.test(pfad)) return "arbeitsoberflaeche";
  if (FIRMENUNTERLAGEN.test(pfad)) return "unterlagen";
  return null;
}

const BEREICH_TEXT: Record<"arbeitsoberflaeche" | "unterlagen", [string, string]> = {
  arbeitsoberflaeche: ["Personal, Einsatzplanung, Zeiterfassung, Abrechnung und Angebote gehören zum Plan Pro.", "Pro"],
  unterlagen: ["Firmenunterlagen und Nachweise gehören zum Plan Basis.", "Basis"],
};

/** Box above a page the plan does not include: everything stays readable, changes need the upgrade. */
export function planBanner(bereich: "arbeitsoberflaeche" | "unterlagen", plan: string): string {
  return `<div class="hinweis plan-sperre" role="status"><p><strong>🔒 ${BEREICH_TEXT[bereich][0]}</strong></p><p>Dein Plan: <strong>${escape(planAnzeige(plan))}</strong></p><p>Vorhandene Daten bleiben erhalten und lesbar; Ändern geht nach dem Upgrade.</p><p><a class="knopf" href="/konto/plan">Zu ${BEREICH_TEXT[bereich][1]} wechseln</a></p></div>`;
}

/** Page for a change the plan does not include. */
export function planSperre(bereich: "arbeitsoberflaeche" | "unterlagen", plan: string): string {
  return `<p class="konto-zurueck"><a href="/konto" aria-label="Zurück">←</a></p>${planBanner(bereich, plan)}`;
}

/** Message for a database refusal "Plan-Grenze: …" (or null when it is a different error). */
export function grenzMeldung(fehler: string): string | null {
  const m = /Plan-Grenze: ([^"\\]+)/.exec(fehler);
  if (!m) return null;
  const was = m[1].trim();
  if (was.startsWith("Büro")) return `Dein Plan enthält keine weiteren Büro-Nutzer. Leser sind immer kostenlos. Mehr Nutzer gibt es mit einem größeren Plan.`;
  if (was.startsWith("Einsatz")) return `Dein Plan enthält keine weiteren Einsatzkräfte mit eigenem Zugang. Mehr gibt es mit einem größeren Plan.`;
  if (was.startsWith("Standort")) return `Dein Plan enthält keine weiteren Standorte. Mehr Standorte gibt es mit einem größeren Plan.`;
  if (was.startsWith("Suchprofil")) return `Dein Plan enthält keine weiteren Suchprofile. Mehr Suchprofile gibt es mit einem größeren Plan.`;
  return `Das geht in deinem Plan nicht. Mehr gibt es mit einem größeren Plan.`;
}

/** Message when a Steckbrief from documents cannot start ('plan': not in the plan, 'grenze': monthly allowance used). */
export function steckbriefMeldung(grund: string, p: PlanStand | null): string {
  if (grund === "plan") return "Steckbriefe aus hochgeladenen Unterlagen gibt es ab dem Plan Basis. Den Kurzüberblick aus der Bekanntmachung hast du weiter bei jedem Treffer.";
  const g = grenzeVon(p, "steckbriefe");
  return p?.plan === "probe"
    ? `In der Probezeit sind ${g ?? 10} Steckbriefe aus Unterlagen enthalten, die sind aufgebraucht. Mit einem Plan geht es sofort weiter.`
    : `Die ${g ?? 0} Steckbriefe aus Unterlagen in diesem Monat sind aufgebraucht. Im nächsten Monat geht es weiter, oder sofort mit einem größeren Plan.`;
}

/** Books a Steckbrief from documents; null = may start, otherwise the message for the user. */
export async function steckbriefBuchen(s: Sitzung, env: KontoEnv, firma: string, vorgang: string | null): Promise<string | null> {
  const r = await db<string | null>(s, env, "rpc/steckbrief_buchen", { method: "POST", body: JSON.stringify({ f: firma, vorgang }) });
  if (!r.ok) return r.status === 404 ? null : "Die Unterlagen konnten gerade nicht angenommen werden. Bitte gleich noch einmal versuchen.";
  if (!r.daten) return null;
  return steckbriefMeldung(r.daten, await planStand(s, env, firma));
}
