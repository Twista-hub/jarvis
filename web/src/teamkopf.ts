// T1–T8: head of "Firma & Team": company profile status and links to the personnel tools, plus what needs attention
// (expiring proofs and certificates, due instructions).
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import { fristen, plusTage } from "./personalakte.ts";
import { aufraeumen } from "./bewerber.ts";
import { kontrollStaende, type FristPerson, type Kontrolle } from "./personalfristen.ts";
import { staende, type PersonKurz, type Teilnahme, type Unterweisung } from "./unterweisungen.ts";

export type Warnungen = { nachweiseAbgelaufen: number; nachweiseBald: number; zertifikate: number; unterweisungen: number; profilFehlt: boolean; pruefungen?: number; antraege?: number; stunden?: number; abgesagt?: number; personalfristen?: number; fuehrerschein?: number; ausfaelle?: number; psa?: number; bewerber?: number; checklisten?: number };

export function teamKopfHtml(w: Warnungen, aueg: boolean, admin = false): string {
  const punkte = [
    w.ausfaelle ? `🚨 <a href="/konto/schichten#ausfall">${w.ausfaelle} ${w.ausfaelle === 1 ? "kurzfristiger Ausfall" : "kurzfristige Ausfälle"} heute/morgen</a>` : "",
    w.nachweiseAbgelaufen ? `⚠️ ${w.nachweiseAbgelaufen} ${w.nachweiseAbgelaufen === 1 ? "Qualifikation abgelaufen" : "Qualifikationen abgelaufen"}` : "",
    w.nachweiseBald ? `⏳ ${w.nachweiseBald} ${w.nachweiseBald === 1 ? "läuft" : "laufen"} in 60 Tagen ab` : "",
    w.unterweisungen ? `📋 <a href="/konto/unterweisungen">${w.unterweisungen} ${w.unterweisungen === 1 ? "Unterweisung fällig" : "Unterweisungen fällig"}</a>` : "",
    w.zertifikate ? `🏅 <a href="/konto/firmenprofil">${w.zertifikate} ${w.zertifikate === 1 ? "Zertifikat läuft" : "Zertifikate laufen"} ab</a>` : "",
    w.antraege ? `🌴 ${w.antraege} ${w.antraege === 1 ? "Urlaubsantrag wartet" : "Urlaubsanträge warten"} (bei der Person unter ✏️ bestätigen)` : "",
    w.pruefungen ? `🚐 <a href="/konto/betriebsmittel">${w.pruefungen} ${w.pruefungen === 1 ? "Prüfung (TÜV, UVV …) fällig" : "Prüfungen (TÜV, UVV …) fällig"}</a>` : "",
    w.bewerber ? `📨 <a href="/konto/bewerber">${w.bewerber} ${w.bewerber === 1 ? "neue Bewerbung" : "neue Bewerbungen"}</a>` : "",
    w.checklisten ? `🚪 <a href="/konto/checklisten">${w.checklisten} offene ${w.checklisten === 1 ? "Checkliste" : "Checklisten"} (Einstieg/Austritt)</a>` : "",
    w.psa ? `🦺 <a href="/konto/psa">${w.psa} PSA-Austausch fällig</a>` : "",
    w.stunden ? `⏱️ <a href="/konto/stunden">${w.stunden} ${w.stunden === 1 ? "Stundenzettel wartet" : "Stundenzettel warten"} auf Freigabe</a>` : "",
    w.abgesagt ? `❌ <a href="/konto/schichten">${w.abgesagt} ${w.abgesagt === 1 ? "Schicht" : "Schichten"} abgesagt</a>` : "",
    w.personalfristen ? `⏳ <a href="/konto/personalfristen">${w.personalfristen} ${w.personalfristen === 1 ? "Personalfrist läuft" : "Personalfristen laufen"} bald ab</a>` : "",
    w.fuehrerschein ? `🚗 <a href="/konto/personalfristen">${w.fuehrerschein} ${w.fuehrerschein === 1 ? "Führerscheinkontrolle fällig" : "Führerscheinkontrollen fällig"}</a>` : "",
    w.profilFehlt ? `🏢 <a href="/konto/firmenprofil">Firmenprofil vervollständigen</a>` : "",
  ].filter(Boolean);
  const kachel = (href: string, icon: string, titel: string, text: string) => `<a class="konto-kachel" href="${href}" title="${escape(text)}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${text}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  const gruppe = (titel: string, k: string[]) => `<h3 class="werkzeug-gruppe">${titel}</h3><div class="konto-kacheln team-werkzeuge">${k.filter(Boolean).join("")}</div>`;
  return `${punkte.length ? `<aside class="team-warnungen" role="status">${punkte.slice(0, punkte.length > 6 ? 5 : 6).map((p) => `<span>${p}</span>`).join("")}${punkte.length > 6 ? `<details class="mehr-warnungen"><summary>+ ${punkte.length - 5} weitere Hinweise</summary>${punkte.slice(5).map((p) => `<span>${p}</span>`).join("")}</details>` : ""}</aside>` : ""}
${gruppe("Planung", [kachel("/konto/schichten", "📅", "Schichtplan", "Schichten planen, Zusagen sehen"), kachel("/konto/disposition", "🗓️", "Disposition", "Wer ist wann wo"), kachel("/konto/urlaub", "🌴", "Urlaub", "Urlaubskonto und Teamkalender"), kachel("/konto/kapazitaet", "📊", "Kapazität", "Frei in den nächsten 3 Monaten"), kachel("/konto/vertretung", "🔁", "Vertretung", "Urlaub, Fristen weitergeben"), kachel("/konto/aufgaben", "✅", "Aufgaben", "Wer macht was bis wann")])}
${gruppe("Personal", [kachel("/konto/personalsuche", "🔍", "Personalsuche", "Beruf, Qualifikation, frei, Umkreis"), kachel("/konto/bewerber", "📨", "Bewerber", "Bewerbungen bis zur Einstellung"), kachel("/konto/checklisten", "🚪", "Einstieg & Austritt", "Checklisten pro Person"), kachel("/konto/personalfristen", "⏳", "Personalfristen", "Probezeit, Befristung, Führerschein"), kachel("/konto/unterweisungen", "📋", "Unterweisungen", "Arbeitsschutz, Hygiene, fällig"), kachel("/konto/psa", "🦺", "Schutzausrüstung", "Ausgabe, Größen, Austausch"), kachel("/konto/bewertungen", "⭐", "Bewertungen", "Rückmeldungen der Kunden"), kachel("/konto/personalauswertung", "📈", "Auswertung", "Köpfe, Stunden, Ein- und Austritte")])}
${gruppe("Abrechnung &amp; Kunden", [kachel("/konto/stunden", "⏱️", "Stundenzettel", "Freigeben, Excel für Lohn"), kachel("/konto/leistungsnachweis", "🧾", "Leistungsnachweis", "Stunden pro Kunde zum Unterschreiben"), kachel("/konto/kunden", "🏢", "Kunden & Einsatzorte", "Adressen, Treffpunkt, Verrechnungssatz"), aueg ? kachel("/konto/aueg", "⚖️", "AÜG-Wächter", "Equal Pay, Höchstdauer") : ""])}
${gruppe("Firma", [kachel("/konto/firmenprofil", "🏛️", "Firmenprofil", "Stammdaten, Umsatz, Zertifikate, Eigenerklärung"), kachel("/konto/brett", "📌", "Schwarzes Brett", "Mitteilungen mit Lesebestätigung"), kachel("/konto/organigramm", "🧭", "Organigramm", "Aufbau der Firma"), kachel("/konto/betriebsmittel", "🚐", "Fahrzeuge & Geräte", "TÜV, UVV, Wartung"), admin ? kachel("/konto/rechte", "🔐", "Rechte", "Wer darf was") : ""])}`;
}

export async function teamKopf(s: Sitzung, env: KontoEnv, firma: string, heute: string, aueg: boolean, admin = false): Promise<string> {
  const [n, z, u, t, p, prof, bm, an, sz, sa, pf, fk, af, ps, bw, cl] = await Promise.all([
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
    db<{ id: string }[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&kurzfristig=is.true&von=lte.${plusTage(heute, 1)}&bis=gte.${heute}&select=id&limit=500`),
    db<{ id: string }[]>(s, env, `psa_ausgaben?firma_id=eq.${firma}&zurueck=is.null&austausch=lte.${plusTage(heute, 30)}&select=id&limit=1000`),
    aufraeumen(s, env, firma, heute).then(() => db<{ id: string }[]>(s, env, `bewerber?firma_id=eq.${firma}&status=eq.neu&select=id&limit=500`)),
    db<{ personal_id: string }[]>(s, env, `checklisten_punkte?firma_id=eq.${firma}&erledigt=is.null&select=personal_id&limit=5000`),
  ]);
  const fp = pf.ok ? pf.daten : [];
  const nachweise = n.ok ? n.daten : [];
  const w: Warnungen = {
    nachweiseAbgelaufen: nachweise.filter((x) => x.gueltig_bis < heute).length, nachweiseBald: nachweise.filter((x) => x.gueltig_bis >= heute).length,
    zertifikate: z.ok ? z.daten.length : 0,
    unterweisungen: (u.ok ? u.daten : []).reduce((sum, x) => sum + staende(x, p.ok ? p.daten : [], t.ok ? t.daten : [], heute).filter((st) => st.stufe === "rot").length, 0),
    profilFehlt: !(prof.ok && prof.daten[0]?.rechtsform && prof.daten[0]?.gruendungsjahr),
    pruefungen: bm.ok ? bm.daten.length : 0, antraege: an.ok ? an.daten.length : 0,
    ausfaelle: af.ok ? af.daten.length : 0, psa: ps.ok ? ps.daten.length : 0, bewerber: bw.ok ? bw.daten.length : 0, checklisten: cl.ok ? new Set(cl.daten.map((x) => x.personal_id)).size : 0, stunden: sz.ok ? sz.daten.length : 0, abgesagt: sa.ok ? sa.daten.length : 0,
    personalfristen: fp.filter((x) => x.status !== "nicht").reduce((n, x) => n + fristen(x, heute).length, 0),
    fuehrerschein: kontrollStaende(fp, fk.ok ? fk.daten : [], heute).filter((x) => x.stufe !== "gruen").length,
  };
  return teamKopfHtml(w, aueg, admin);
}
