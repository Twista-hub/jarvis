// T1–T8: head of "Firma & Team": company profile status and links to the personnel tools, plus what needs attention
// (expiring proofs and certificates, due instructions).
import { BOERSE_AKTIV } from "./boerse.ts";
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";
import { fristen, plusTage } from "./personalakte.ts";
import { aufraeumen } from "./bewerber.ts";
import { kontrollStaende, type FristPerson, type Kontrolle } from "./personalfristen.ts";
import { staende, type PersonKurz, type Teilnahme, type Unterweisung } from "./unterweisungen.ts";

export type Warnungen = { nachweiseAbgelaufen: number; nachweiseBald: number; zertifikate: number; unterweisungen: number; profilFehlt: boolean; pruefungen?: number; antraege?: number; stunden?: number; abgesagt?: number; personalfristen?: number; fuehrerschein?: number; ausfaelle?: number; psa?: number; bewerber?: number; checklisten?: number; spesen?: number; rueckfragen?: number; anlaesse?: Anlass[] };
export type Anlass = { name: string; art: "geburtstag" | "jubilaeum"; jahre: number; tag: string };

/** T45: birthdays and work anniversaries (1, 5, 10, 15 … years) from today up to `tage` days ahead. */
export function anlaesse(personen: { vorname: string; nachname: string; status?: string; geburtstag?: string | null; eintritt?: string | null }[], heute: string, tage = 7): Anlass[] {
  const jahr = Number(heute.slice(0, 4)), bis = plusTage(heute, tage);
  const schaltjahr = (j: number) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
  const naechster = (d: string) => {
    for (const j of [jahr, jahr + 1]) {
      const md = d.slice(5) === "02-29" && !schaltjahr(j) ? "02-28" : d.slice(5);
      const t = `${j}-${md}`;
      if (t >= heute) return { tag: t, jahre: j - Number(d.slice(0, 4)) };
    }
    return null;
  };
  const out: Anlass[] = [];
  for (const p of personen) {
    if (p.status === "nicht") continue;
    const name = `${p.vorname} ${p.nachname}`.trim();
    const g = p.geburtstag ? naechster(p.geburtstag) : null;
    if (g && g.tag <= bis) out.push({ name, art: "geburtstag", jahre: g.jahre, tag: g.tag });
    const e = p.eintritt && p.eintritt < heute ? naechster(p.eintritt) : null;
    if (e && e.tag <= bis && e.jahre >= 1 && (e.jahre === 1 || e.jahre % 5 === 0)) out.push({ name, art: "jubilaeum", jahre: e.jahre, tag: e.tag });
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag) || a.name.localeCompare(b.name));
}

const wann = (tag: string, heute: string) => tag === heute ? "heute" : tag === plusTage(heute, 1) ? "morgen" : new Date(`${tag}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
export const anlassText = (a: Anlass, heute: string) => a.art === "geburtstag" ? `🎂 ${escape(a.name)} hat ${wann(a.tag, heute)} Geburtstag` : `🎉 ${escape(a.name)}: ${a.jahre} ${a.jahre === 1 ? "Jahr" : "Jahre"} dabei (${wann(a.tag, heute)})`;

export function teamKopfHtml(w: Warnungen, aueg: boolean, admin = false, o: { finanzen?: boolean; heute?: string; leser?: boolean } = {}): string {
  const heute = o.heute ?? new Date().toISOString().slice(0, 10);
  const punkte = [
    w.rueckfragen ? `❓ <a href="/konto/leistungsnachweis">${w.rueckfragen} ${w.rueckfragen === 1 ? "Rückfrage" : "Rückfragen"} von Kunden zum Leistungsnachweis</a>` : "",
    w.ausfaelle ? `🚨 <a href="/konto/schichten#ausfall">${w.ausfaelle} ${w.ausfaelle === 1 ? "kurzfristiger Ausfall" : "kurzfristige Ausfälle"} heute/morgen</a>` : "",
    w.nachweiseAbgelaufen ? `⚠️ ${w.nachweiseAbgelaufen} ${w.nachweiseAbgelaufen === 1 ? "Qualifikation abgelaufen" : "Qualifikationen abgelaufen"}` : "",
    w.nachweiseBald ? `⏳ ${w.nachweiseBald} ${w.nachweiseBald === 1 ? "läuft" : "laufen"} in 60 Tagen ab` : "",
    w.unterweisungen ? `📋 <a href="/konto/unterweisungen">${w.unterweisungen} ${w.unterweisungen === 1 ? "Unterweisung fällig" : "Unterweisungen fällig"}</a>` : "",
    w.zertifikate ? `🏅 <a href="/konto/firmenprofil">${w.zertifikate} ${w.zertifikate === 1 ? "Zertifikat läuft" : "Zertifikate laufen"} ab</a>` : "",
    w.antraege ? `🌴 ${w.antraege} ${w.antraege === 1 ? "Urlaubsantrag wartet" : "Urlaubsanträge warten"} (bei der Person unter ✏️ bestätigen)` : "",
    w.pruefungen ? `🚐 <a href="/konto/betriebsmittel">${w.pruefungen} ${w.pruefungen === 1 ? "Prüfung (TÜV, UVV …) fällig" : "Prüfungen (TÜV, UVV …) fällig"}</a>` : "",
    w.bewerber && !o.leser ? `📨 <a href="/konto/bewerber">${w.bewerber} ${w.bewerber === 1 ? "neue Bewerbung" : "neue Bewerbungen"}</a>` : "",
    w.checklisten ? `🚪 <a href="/konto/checklisten">${w.checklisten} offene ${w.checklisten === 1 ? "Checkliste" : "Checklisten"} (Einstieg/Austritt)</a>` : "",
    w.psa ? `🦺 <a href="/konto/psa">${w.psa} PSA-Austausch fällig</a>` : "",
    w.stunden ? `⏱️ <a href="/konto/stunden">${w.stunden} ${w.stunden === 1 ? "Stundenzettel wartet" : "Stundenzettel warten"} auf Freigabe</a>` : "",
    w.abgesagt ? `❌ <a href="/konto/schichten">${w.abgesagt} ${w.abgesagt === 1 ? "Schicht" : "Schichten"} abgesagt</a>` : "",
    w.personalfristen ? `⏳ <a href="/konto/personalfristen">${w.personalfristen} ${w.personalfristen === 1 ? "Personalfrist läuft" : "Personalfristen laufen"} bald ab</a>` : "",
    w.fuehrerschein ? `🚗 <a href="/konto/personalfristen">${w.fuehrerschein} ${w.fuehrerschein === 1 ? "Führerscheinkontrolle fällig" : "Führerscheinkontrollen fällig"}</a>` : "",
    w.spesen ? `🧾 <a href="/konto/spesen">${w.spesen} ${w.spesen === 1 ? "Spesenbeleg wartet" : "Spesenbelege warten"}</a>` : "",
    ...(w.anlaesse ?? []).slice(0, 4).map((a) => anlassText(a, heute)),
    w.profilFehlt ? `🏢 <a href="/konto/firmenprofil">Firmenprofil vervollständigen</a>` : "",
  ].filter(Boolean);
  const kachel = (href: string, icon: string, titel: string, text: string) => `<a class="konto-kachel" href="${href}" title="${escape(text)}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${text}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  const gruppe = (titel: string, k: string[]) => `<h3 class="werkzeug-gruppe">${titel}</h3><div class="konto-kacheln team-werkzeuge">${k.filter(Boolean).join("")}</div>`;
  return `${punkte.length ? `<aside class="team-warnungen" role="status">${punkte.slice(0, punkte.length > 6 ? 5 : 6).map((p) => `<span>${p}</span>`).join("")}${punkte.length > 6 ? `<details class="mehr-warnungen"><summary>+ ${punkte.length - 5} weitere Hinweise</summary><div class="mehr-liste">${punkte.slice(5).map((p) => `<span>${p}</span>`).join("")}</div></details>` : ""}</aside>` : ""}
${gruppe("Planung", [kachel("/konto/schichten", "📅", "Schichtplan", "Schichten planen, Zusagen sehen"), kachel("/konto/disposition", "🗓️", "Disposition", "Wer ist wann wo"), kachel("/konto/urlaub", "🌴", "Urlaub", "Urlaubskonto und Teamkalender"), kachel("/konto/kapazitaet", "📊", "Kapazität", "Frei in den nächsten 3 Monaten"), kachel("/konto/vertretung", "🔁", "Vertretung", "Urlaub, Fristen weitergeben"), kachel("/konto/aufgaben", "✅", "Aufgaben", "Wer macht was bis wann")])}
${gruppe("Personal", [kachel("/konto/personalsuche", "🔍", "Personalsuche", "Beruf, Qualifikation, frei, Umkreis"), o.leser ? "" : kachel("/konto/bewerber", "📨", "Bewerber", "Bewerbungen bis zur Einstellung"), kachel("/konto/checklisten", "🚪", "Einstieg & Austritt", "Checklisten pro Person"), kachel("/konto/personalfristen", "⏳", "Personalfristen", "Probezeit, Befristung, Führerschein"), kachel("/konto/unterweisungen", "📋", "Unterweisungen", "Arbeitsschutz, Hygiene, fällig"), kachel("/konto/psa", "🦺", "Schutzausrüstung", "Ausgabe, Größen, Austausch"), kachel("/konto/bewertungen", "⭐", "Bewertungen", "Rückmeldungen der Kunden"), admin ? kachel("/konto/kraefte-einladen", "📲", "Einsatzkräfte einladen", "Link per WhatsApp oder SMS") : "", kachel("/konto/personalauswertung", "📈", "Auswertung", "Köpfe, Stunden, Ein- und Austritte")])}
${gruppe("Abrechnung &amp; Kunden", [kachel("/konto/stunden", "⏱️", "Stundenzettel", "Freigeben, Lohnliste"), kachel("/konto/zeitkonto", "⚖️", "Arbeitszeitkonto", "Soll, Ist, Überstunden"), kachel("/konto/spesen", "🧾", "Spesen", "Belege prüfen und freigeben"), o.finanzen ? kachel("/konto/rechnungen", "💶", "Rechnungen", "Entwürfe aus dem Leistungsnachweis") : "", o.finanzen ? kachel("/konto/belege", "📸", "Belege", "Firmenbelege per Foto, CSV") : "", o.finanzen ? kachel("/konto/nachkalkulation", "🧮", "Nachkalkulation", "Deckungsbeitrag je Kunde") : "", o.finanzen ? kachel("/konto/umsatzsteuer", "🧾", "Umsatzsteuer", "Monat/Quartal, Kleinunternehmer-Grenze") : "", kachel("/konto/leistungsnachweis", "🧾", "Leistungsnachweis", "Stunden pro Kunde zum Unterschreiben"), kachel("/konto/kunden", "🏢", "Kunden & Einsatzorte", "Adressen, Treffpunkt, Verrechnungssatz"), kachel("/konto/kundenportal", "🔗", "Kunden-Portal", "Link für Kunden, Meldungen"), BOERSE_AKTIV ? kachel("/konto/boerse", "🔁", "Auftragsbörse", "Aufträge mit anderen Firmen teilen") : "", kachel("/konto/rundgaenge", "🛡️", "Rundgänge & Wachbuch", "QR-Kontrollpunkte, Vorfälle"), aueg ? kachel("/konto/aueg", "🛡️", "AÜG-Wächter", "Equal Pay, Höchstdauer") : ""])}
${gruppe("Firma", [kachel("/konto/firmenprofil", "🏛️", "Firmenprofil", "Stammdaten, Umsatz, Zertifikate, Eigenerklärung"), kachel("/konto/brett", "📌", "Schwarzes Brett", "Mitteilungen mit Lesebestätigung"), o.leser ? "" : kachel("/konto/chat", "💬", "Team-Chat", "Firma, Standorte, Einsatzorte"), kachel("/konto/organigramm", "🧭", "Organigramm", "Aufbau der Firma"), kachel("/konto/betriebsmittel", "🚐", "Fahrzeuge & Geräte", "TÜV, UVV, Wartung"), admin ? kachel("/konto/rechte", "🔐", "Rechte", "Wer darf was") : ""])}`;
}

export async function teamKopf(s: Sitzung, env: KontoEnv, firma: string, heute: string, aueg: boolean, admin = false, finanzen = false, leser = false): Promise<string> {
  const [n, z, u, t, p, prof, bm, an, sz, sa, pf, fk, af, ps, bw, cl, sp, rf, gb] = await Promise.all([
    db<{ gueltig_bis: string }[]>(s, env, `personal_nachweise?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 60)}&select=gueltig_bis&limit=2000`),
    db<{ id: string }[]>(s, env, `firmen_zertifikate?firma_id=eq.${firma}&gueltig_bis=lte.${plusTage(heute, 90)}&select=id`),
    db<Unterweisung[]>(s, env, `unterweisungen?firma_id=eq.${firma}&archiviert=eq.false&select=id,titel,intervall_monate,beschreibung`),
    db<Teilnahme[]>(s, env, `unterweisung_teilnahmen?firma_id=eq.${firma}&select=unterweisung_id,personal_id,datum&limit=20000`),
    db<PersonKurz[]>(s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&limit=3000`),
    db<{ rechtsform: string; gruendungsjahr: number | null }[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=rechtsform,gruendungsjahr`),
    db<{ id: string }[]>(s, env, `betriebsmittel?firma_id=eq.${firma}&naechste_pruefung=lte.${plusTage(heute, 30)}&select=id&limit=1000`),
    db<{ id: string }[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&status=eq.beantragt&bis=gte.${heute}&select=id&limit=1000`),
    db<{ id: string }[]>(s, env, `stundenzettel?firma_id=eq.${firma}&status=eq.erfasst&datum=gte.${plusTage(heute, -62)}&select=id&limit=2000`),
    db<{ id: string }[]>(s, env, `schichten?firma_id=eq.${firma}&antwort=eq.abgesagt&datum=gte.${heute}&datum=lte.${plusTage(heute, 14)}&select=id&limit=500`),
    db<FristPerson[]>(s, env, `rpc/personal_sicht?f=${firma}&or=(probezeit_bis.not.is.null,befristet_bis.not.is.null,aufenthalt_bis.not.is.null,firmenwagen.is.true)&select=id,vorname,nachname,status,fuehrerschein,firmenwagen,probezeit_bis,befristet_bis,aufenthalt_bis&limit=3000`),
    db<Kontrolle[]>(s, env, `fuehrerschein_kontrollen?firma_id=eq.${firma}&datum=gte.${plusTage(heute, -200)}&select=id,personal_id,datum,klassen,notiz,geprueft_von&limit=5000`),
    db<{ id: string }[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&kurzfristig=is.true&von=lte.${plusTage(heute, 1)}&bis=gte.${heute}&select=id&limit=500`),
    db<{ id: string }[]>(s, env, `psa_ausgaben?firma_id=eq.${firma}&zurueck=is.null&austausch=lte.${plusTage(heute, 30)}&select=id&limit=1000`),
    aufraeumen(s, env, firma, heute).then(() => db<{ id: string }[]>(s, env, `bewerber?firma_id=eq.${firma}&status=eq.neu&select=id&limit=500`)),
    db<{ personal_id: string }[]>(s, env, `checklisten_punkte?firma_id=eq.${firma}&erledigt=is.null&select=personal_id&limit=5000`),
    db<{ id: string }[]>(s, env, `spesen?firma_id=eq.${firma}&status=eq.erfasst&select=id&limit=2000`),
    db<{ id: string }[]>(s, env, `nachweis_freigaben?firma_id=eq.${firma}&rueckfrage=is.true&bestaetigt_am=gte.${plusTage(heute, -30)}&select=id&limit=200`),
    db<{ vorname: string; nachname: string; status: string; geburtstag: string | null; eintritt: string | null }[]>(s, env, `rpc/personal_sicht?f=${firma}&or=(geburtstag.not.is.null,eintritt.not.is.null)&select=vorname,nachname,status,geburtstag,eintritt&limit=3000`),
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
    spesen: sp.ok ? sp.daten.length : 0, rueckfragen: rf.ok ? rf.daten.length : 0, anlaesse: anlaesse(gb.ok ? gb.daten : [], heute),
    fuehrerschein: kontrollStaende(fp, fk.ok ? fk.daten : [], heute).filter((x) => x.stufe !== "gruen").length,
  };
  return teamKopfHtml(w, aueg, admin, { finanzen, heute, leser });
}
