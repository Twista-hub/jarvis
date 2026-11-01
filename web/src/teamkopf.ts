// T1–T8: head of "Firma & Team": company profile status and links to the personnel tools, plus what needs attention
// (expiring proofs and certificates, due instructions).
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import { fristen, plusTage } from "./personalakte.ts";
import { kontrollStaende, type FristPerson, type Kontrolle } from "./personalfristen.ts";
import { staende, type PersonKurz, type Teilnahme, type Unterweisung } from "./unterweisungen.ts";

export type Warnungen = { nachweiseAbgelaufen: number; nachweiseBald: number; zertifikate: number; unterweisungen: number; profilFehlt: boolean; pruefungen?: number; antraege?: number; stunden?: number; abgesagt?: number; personalfristen?: number; fuehrerschein?: number };

export function teamKopfHtml(w: Warnungen, aueg: boolean, admin = false): string {
  const punkte = [
    w.nachweiseAbgelaufen ? `⚠️ ${w.nachweiseAbgelaufen} ${w.nachweiseAbgelaufen === 1 ? "Qualifikation abgelaufen" : "Qualifikationen abgelaufen"}` : "",
    w.nachweiseBald ? `⏳ ${w.nachweiseBald} ${w.nachweiseBald === 1 ? "läuft" : "laufen"} in 60 Tagen ab` : "",
    w.unterweisungen ? `📋 <a href="/konto/unterweisungen">${w.unterweisungen} ${w.unterweisungen === 1 ? "Unterweisung fällig" : "Unterweisungen fällig"}</a>` : "",
    w.zertifikate ? `🏅 <a href="/konto/firmenprofil">${w.zertifikate} ${w.zertifikate === 1 ? "Zertifikat läuft" : "Zertifikate laufen"} ab</a>` : "",
    w.antraege ? `🌴 ${w.antraege} ${w.antraege === 1 ? "Urlaubsantrag wartet" : "Urlaubsanträge warten"} (bei der Person unter ✏️ bestätigen)` : "",
    w.pruefungen ? `🚐 <a href="/konto/betriebsmittel">${w.pruefungen} ${w.pruefungen === 1 ? "Prüfung (TÜV, UVV …) fällig" : "Prüfungen (TÜV, UVV …) fällig"}</a>` : "",
    w.stunden ? `⏱️ <a href="/konto/stunden">${w.stunden} ${w.stunden === 1 ? "Stundenzettel wartet" : "Stundenzettel warten"} auf Freigabe</a>` : "",
    w.abgesagt ? `❌ <a href="/konto/schichten">${w.abgesagt} ${w.abgesagt === 1 ? "Schicht" : "Schichten"} abgesagt</a>` : "",
    w.personalfristen ? `⏳ <a href="/konto/personalfristen">${w.personalfristen} ${w.personalfristen === 1 ? "Personalfrist läuft" : "Personalfristen laufen"} bald ab</a>` : "",
    w.fuehrerschein ? `🚗 <a href="/konto/personalfristen">${w.fuehrerschein} ${w.fuehrerschein === 1 ? "Führerscheinkontrolle fällig" : "Führerscheinkontrollen fällig"}</a>` : "",
    w.profilFehlt ? `🏢 <a href="/konto/firmenprofil">Firmenprofil vervollständigen</a>` : "",
  ].filter(Boolean);
  const kachel = (href: string, icon: string, titel: string, text: string) => `<a class="konto-kachel" href="${href}" title="${escape(text)}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${text}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  return `${punkte.length ? `<aside class="team-warnungen" role="status">${punkte.map((p) => `<span>${p}</span>`).join("")}</aside>` : ""}<div class="konto-kacheln team-werkzeuge">
${kachel("/konto/firmenprofil", "🏢", "Firmenprofil", "Stammdaten, Umsatz, Zertifikate, Eigenerklärung")}
${kachel("/konto/personalsuche", "🔍", "Personalsuche", "Beruf, Qualifikation, frei, Umkreis")}
${kachel("/konto/disposition", "🗓️", "Disposition", "Wer ist wann wo")}
${kachel("/konto/unterweisungen", "📋", "Unterweisungen", "Arbeitsschutz, Hygiene, fällig")}
${kachel("/konto/schichten", "📅", "Schichtplan", "Schichten planen, Zusagen sehen")}
${kachel("/konto/stunden", "⏱️", "Stundenzettel", "Freigeben, Excel für Lohn")}
${kachel("/konto/brett", "📌", "Schwarzes Brett", "Mitteilungen mit Lesebestätigung")}
${kachel("/konto/personalfristen", "⏳", "Personalfristen", "Probezeit, Befristung, Führerschein")}
${kachel("/konto/kapazitaet", "📊", "Kapazität", "Frei in den nächsten 3 Monaten")}
${kachel("/konto/aufgaben", "✅", "Aufgaben", "Wer macht was bis wann")}
${kachel("/konto/vertretung", "🔁", "Vertretung", "Urlaub, Fristen weitergeben")}
${kachel("/konto/betriebsmittel", "🚐", "Fahrzeuge & Geräte", "TÜV, UVV, Wartung")}
${kachel("/konto/organigramm", "🧭", "Organigramm", "Aufbau der Firma")}
${admin ? kachel("/konto/rechte", "🔐", "Rechte", "Wer darf was") : ""}
${aueg ? kachel("/konto/aueg", "⚖️", "AÜG-Wächter", "Equal Pay, Höchstdauer") : ""}</div>`;
}

export async function teamKopf(s: Sitzung, env: KontoEnv, firma: string, heute: string, aueg: boolean, admin = false): Promise<string> {
  const [n, z, u, t, p, prof, bm, an, sz, sa, pf, fk] = await Promise.all([
    db<{ gueltig_bis: string }[]>(s, env, `personal_nachweise?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 60)}&select=gueltig_bis&limit=2000`),
    db<{ id: string }[]>(s, env, `firmen_zertifikate?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 90)}&select=id`),
    db<Unterweisung[]>(s, env, `unterweisungen?firma_id=eq.${firma}&select=id,titel,intervall_monate,beschreibung`),
    db<Teilnahme[]>(s, env, `unterweisung_teilnahmen?firma_id=eq.${firma}&select=unterweisung_id,personal_id,datum&limit=20000`),
    db<PersonKurz[]>(s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&limit=3000`),
    db<{ rechtsform: string; gruendungsjahr: number | null }[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=rechtsform,gruendungsjahr`),
    db<{ id: string }[]>(s, env, `betriebsmittel?firma_id=eq.${firma}&naechste_pruefung=lte.${plusTage(heute, 30)}&select=id&limit=1000`),
    db<{ id: string }[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&status=eq.beantragt&bis=gte.${heute}&select=id&limit=1000`),
    db<{ id: string }[]>(s, env, `stundenzettel?firma_id=eq.${firma}&status=eq.erfasst&datum=gte.${plusTage(heute, -62)}&select=id&limit=2000`),
    db<{ id: string }[]>(s, env, `schichten?firma_id=eq.${firma}&antwort=eq.abgesagt&datum=gte.${heute}&datum=lte.${plusTage(heute, 14)}&select=id&limit=500`),
    db<FristPerson[]>(s, env, `personal?firma_id=eq.${firma}&or=(probezeit_bis.not.is.null,befristet_bis.not.is.null,aufenthalt_bis.not.is.null,firmenwagen.is.true)&select=id,vorname,nachname,status,fuehrerschein,firmenwagen,probezeit_bis,befristet_bis,aufenthalt_bis&limit=3000`),
    db<Kontrolle[]>(s, env, `fuehrerschein_kontrollen?firma_id=eq.${firma}&datum=gte.${plusTage(heute, -200)}&select=id,personal_id,datum,klassen,notiz,geprueft_von&limit=5000`),
  ]);
  const fp = pf.ok ? pf.daten : [];
  const nachweise = n.ok ? n.daten : [];
  const w: Warnungen = {
    nachweiseAbgelaufen: nachweise.filter((x) => x.gueltig_bis < heute).length, nachweiseBald: nachweise.filter((x) => x.gueltig_bis >= heute).length,
    zertifikate: z.ok ? z.daten.length : 0,
    unterweisungen: (u.ok ? u.daten : []).reduce((sum, x) => sum + staende(x, p.ok ? p.daten : [], t.ok ? t.daten : [], heute).filter((st) => st.stufe === "rot").length, 0),
    profilFehlt: !(prof.ok && prof.daten[0]?.rechtsform && prof.daten[0]?.gruendungsjahr),
    pruefungen: bm.ok ? bm.daten.length : 0, antraege: an.ok ? an.daten.length : 0,
    stunden: sz.ok ? sz.daten.length : 0, abgesagt: sa.ok ? sa.daten.length : 0,
    personalfristen: fp.filter((x) => x.status !== "nicht").reduce((n, x) => n + fristen(x, heute).length, 0),
    fuehrerschein: kontrollStaende(fp, fk.ok ? fk.daten : [], heute).filter((x) => x.stufe !== "gruen").length,
  };
  return teamKopfHtml(w, aueg, admin);
}
