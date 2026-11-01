// T1–T8: head of "Firma & Team": company profile status and links to the personnel tools, plus what needs attention
// (expiring proofs and certificates, due instructions).
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import { plusTage } from "./personalakte.ts";
import { staende, type PersonKurz, type Teilnahme, type Unterweisung } from "./unterweisungen.ts";

export type Warnungen = { nachweiseAbgelaufen: number; nachweiseBald: number; zertifikate: number; unterweisungen: number; profilFehlt: boolean };

export function teamKopfHtml(w: Warnungen, aueg: boolean): string {
  const punkte = [
    w.nachweiseAbgelaufen ? `⚠️ ${w.nachweiseAbgelaufen} ${w.nachweiseAbgelaufen === 1 ? "Qualifikation abgelaufen" : "Qualifikationen abgelaufen"}` : "",
    w.nachweiseBald ? `⏳ ${w.nachweiseBald} ${w.nachweiseBald === 1 ? "läuft" : "laufen"} in 60 Tagen ab` : "",
    w.unterweisungen ? `📋 <a href="/konto/unterweisungen">${w.unterweisungen} ${w.unterweisungen === 1 ? "Unterweisung fällig" : "Unterweisungen fällig"}</a>` : "",
    w.zertifikate ? `🏅 <a href="/konto/firmenprofil">${w.zertifikate} ${w.zertifikate === 1 ? "Zertifikat läuft" : "Zertifikate laufen"} ab</a>` : "",
    w.profilFehlt ? `🏢 <a href="/konto/firmenprofil">Firmenprofil vervollständigen</a>` : "",
  ].filter(Boolean);
  const kachel = (href: string, icon: string, titel: string, text: string) => `<a class="konto-kachel" href="${href}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${text}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  return `${punkte.length ? `<aside class="team-warnungen" role="status">${punkte.map((p) => `<span>${p}</span>`).join("")}</aside>` : ""}<div class="konto-kacheln team-werkzeuge">
${kachel("/konto/firmenprofil", "🏢", "Firmenprofil", "Stammdaten, Umsatz, Zertifikate, Eigenerklärung")}
${kachel("/konto/personalsuche", "🔍", "Personalsuche", "Beruf, Qualifikation, frei, Umkreis")}
${kachel("/konto/disposition", "🗓️", "Disposition", "Wer ist wann wo")}
${kachel("/konto/unterweisungen", "📋", "Unterweisungen", "Arbeitsschutz, Hygiene, fällig")}
${aueg ? kachel("/konto/aueg", "⚖️", "AÜG-Wächter", "Equal Pay, Höchstdauer") : ""}</div>`;
}

export async function teamKopf(s: Sitzung, env: KontoEnv, firma: string, heute: string, aueg: boolean): Promise<string> {
  const [n, z, u, t, p, prof] = await Promise.all([
    db<{ gueltig_bis: string }[]>(s, env, `personal_nachweise?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 60)}&select=gueltig_bis&limit=2000`),
    db<{ id: string }[]>(s, env, `firmen_zertifikate?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 90)}&select=id`),
    db<Unterweisung[]>(s, env, `unterweisungen?firma_id=eq.${firma}&select=id,titel,intervall_monate,beschreibung`),
    db<Teilnahme[]>(s, env, `unterweisung_teilnahmen?firma_id=eq.${firma}&select=unterweisung_id,personal_id,datum&limit=20000`),
    db<PersonKurz[]>(s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&limit=3000`),
    db<{ rechtsform: string; gruendungsjahr: number | null }[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=rechtsform,gruendungsjahr`),
  ]);
  const nachweise = n.ok ? n.daten : [];
  const w: Warnungen = {
    nachweiseAbgelaufen: nachweise.filter((x) => x.gueltig_bis < heute).length, nachweiseBald: nachweise.filter((x) => x.gueltig_bis >= heute).length,
    zertifikate: z.ok ? z.daten.length : 0,
    unterweisungen: (u.ok ? u.daten : []).reduce((sum, x) => sum + staende(x, p.ok ? p.daten : [], t.ok ? t.daten : [], heute).filter((st) => st.stufe === "rot").length, 0),
    profilFehlt: !(prof.ok && prof.daten[0]?.rechtsform && prof.daten[0]?.gruendungsjahr),
  };
  return teamKopfHtml(w, aueg);
}
