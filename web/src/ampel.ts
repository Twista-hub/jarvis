// US tenders: "May I bid?" light and deadline tracker. Inputs: the SAM.gov fields stored with the hit (vorgaenge.us,
// written by alarm/usa.py) and the firm's US bidder profile (us_bieterprofil: SAM registration, NAICS, SBA
// certifications, size). Rules from docs/usa-recherche.md: set-aside codes of the Opportunities API, SBA size
// standards (2023 table, kept as data here because the SBA reform of Aug. 2026 is not in force yet), SAM registration
// must be active at the deadline. Red = may not bid / too late; yellow = something to check; green = nothing found.
// The texts come in German or English directly (the English dictionary leaves unknown English text alone).
import { escape } from "./seite.ts";

export type UsDaten = {
  notice_id?: string; behoerde?: string; solicitation?: string; art?: string; naics?: string; psc?: string; set_aside?: string; set_aside_text?: string;
  frist?: string; veroeffentlicht?: string; archiv?: string; staat?: string; stadt?: string; plz?: string;
  kontakt?: { name?: string; email?: string; telefon?: string };
  aenderungen?: { feld: string; alt: string; neu: string; gesehen: string }[];
};
export type UsProfil = {
  uei: string; cage: string; sam_gueltig_bis: string | null; naics: string[]; klein_naics: string[]; zertifikate: string[];
  umsatz_durchschnitt: number | null; mitarbeiter: number | null;
};
export type Farbe = "gruen" | "gelb" | "rot";
export type Grund = { farbe: Farbe; de: string; en: string };

export const ZERTIFIKATE: Record<string, { de: string; en: string }> = {
  "8a": { de: "8(a)", en: "8(a)" }, hubzone: { de: "HUBZone", en: "HUBZone" }, wosb: { de: "WOSB (frauengeführt)", en: "WOSB (women-owned)" },
  edwosb: { de: "EDWOSB", en: "EDWOSB" }, vosb: { de: "VOSB (Veteranen)", en: "VOSB (veteran-owned)" }, sdvosb: { de: "SDVOSB", en: "SDVOSB (service-disabled veteran)" },
  iee: { de: "Indian Economic Enterprise", en: "Indian Economic Enterprise" },
};

/** Set-aside code → name and what the bidder needs (any of the listed certifications; "klein" = small for the NAICS). */
const SET_ASIDES: Record<string, { name: string; klein: boolean; zert?: string[] }> = {
  SBA: { name: "Total Small Business", klein: true }, SBP: { name: "Partial Small Business", klein: true },
  "8A": { name: "8(a) Competitive", klein: true, zert: ["8a"] }, "8AN": { name: "8(a) Sole Source", klein: true, zert: ["8a"] },
  HZC: { name: "HUBZone", klein: true, zert: ["hubzone"] }, HZS: { name: "HUBZone Sole Source", klein: true, zert: ["hubzone"] },
  SDVOSBC: { name: "SDVOSB", klein: true, zert: ["sdvosb"] }, SDVOSBS: { name: "SDVOSB Sole Source", klein: true, zert: ["sdvosb"] },
  WOSB: { name: "WOSB", klein: true, zert: ["wosb", "edwosb"] }, WOSBSS: { name: "WOSB Sole Source", klein: true, zert: ["wosb", "edwosb"] },
  EDWOSB: { name: "EDWOSB", klein: true, zert: ["edwosb"] }, EDWOSBSS: { name: "EDWOSB Sole Source", klein: true, zert: ["edwosb"] },
  VSA: { name: "Veteran-Owned (VA)", klein: true, zert: ["vosb", "sdvosb"] }, VSS: { name: "Veteran-Owned Sole Source (VA)", klein: true, zert: ["vosb", "sdvosb"] },
  ISBEE: { name: "Indian Small Business Economic Enterprise", klein: true, zert: ["iee"] }, IEE: { name: "Indian Economic Enterprise", klein: false, zert: ["iee"] },
};

/** SBA size standards for the trades we serve (average annual revenue in $ million, or employees). Source: SBA table
 *  effective 17.03.2023 (docs/usa-recherche.md 2.2); values marked "(prüfen)" there except 238210. */
export const GROESSE: Record<string, { umsatz?: number; mitarbeiter?: number }> = {
  "561720": { umsatz: 22 }, "561740": { umsatz: 9.5 }, "561790": { umsatz: 9.5 }, "561612": { umsatz: 29 }, "561621": { umsatz: 25 },
  "561730": { umsatz: 9.5 }, "561320": { umsatz: 34 }, "561311": { umsatz: 34 }, "561210": { umsatz: 47 },
  "238210": { umsatz: 19 }, "238220": { umsatz: 19 }, "238320": { umsatz: 19 }, "238160": { umsatz: 19 }, "238330": { umsatz: 19 },
  "238340": { umsatz: 19 }, "238350": { umsatz: 19 }, "238130": { umsatz: 19 }, "238990": { umsatz: 19 }, "238910": { umsatz: 19 },
  "236220": { umsatz: 45 }, "236118": { umsatz: 45 }, "237110": { umsatz: 45 }, "811310": { umsatz: 12.5 },
};

/** Small for this NAICS? true/false, or null when we cannot tell (no statement, no size standard or no revenue). */
export function klein(naics: string, p: UsProfil | null): boolean | null {
  if (!p) return null;
  if (p.klein_naics.includes(naics)) return true;
  const g = GROESSE[naics];
  if (g?.umsatz && p.umsatz_durchschnitt != null) return p.umsatz_durchschnitt <= g.umsatz * 1e6;
  if (g?.mitarbeiter && p.mitarbeiter != null) return p.mitarbeiter <= g.mitarbeiter;
  return null;
}

const schlimmste = (g: Grund[]): Farbe => g.some((x) => x.farbe === "rot") ? "rot" : g.some((x) => x.farbe === "gelb") ? "gelb" : "gruen";

/** The light for one US tender. */
export function pruefen(us: UsDaten, p: UsProfil | null, jetzt = new Date()): { farbe: Farbe; gruende: Grund[] } {
  const g: Grund[] = [];
  const frist = us.frist ? new Date(us.frist) : null;
  if (frist && !isNaN(+frist) && frist <= jetzt) g.push({ farbe: "rot", de: "Die Abgabefrist ist vorbei.", en: "The response deadline has passed." });
  // SAM registration: active and valid on the deadline day (FAR 4.1102: registered at the time of the offer).
  if (!p || !p.uei) g.push({ farbe: "gelb", de: "SAM.gov-Registrierung (UEI) im US-Bieterprofil eintragen. Ohne aktive Registrierung kein Bundesauftrag.", en: "Add your SAM.gov registration (UEI) to your US bidder profile. No federal award without an active registration." });
  else if (!p.sam_gueltig_bis) g.push({ farbe: "gelb", de: "Ablaufdatum der SAM.gov-Registrierung eintragen.", en: "Add the expiration date of your SAM.gov registration." });
  else if (new Date(`${p.sam_gueltig_bis}T23:59:59Z`) < jetzt) g.push({ farbe: "rot", de: "Eure SAM.gov-Registrierung ist abgelaufen. Erst verlängern (kostenlos auf sam.gov).", en: "Your SAM.gov registration has expired. Renew it first (free on sam.gov)." });
  else if (frist && new Date(`${p.sam_gueltig_bis}T23:59:59Z`) < frist) g.push({ farbe: "rot", de: "Die SAM.gov-Registrierung läuft vor der Abgabefrist ab. Rechtzeitig verlängern.", en: "Your SAM.gov registration expires before the deadline. Renew it in time." });
  else g.push({ farbe: "gruen", de: "SAM.gov-Registrierung aktiv bis zur Frist.", en: "SAM.gov registration active through the deadline." });
  // NAICS: the firm should list the tender's NAICS in SAM (can be added, so only yellow).
  if (us.naics) {
    if (p && p.naics.includes(us.naics)) g.push({ farbe: "gruen", de: `NAICS ${us.naics} steht in eurem Profil.`, en: `NAICS ${us.naics} is in your profile.` });
    else g.push({ farbe: "gelb", de: `NAICS ${us.naics} fehlt in eurem Profil. In SAM.gov ergänzen, wenn ihr diese Leistung anbietet.`, en: `NAICS ${us.naics} is not in your profile. Add it in SAM.gov if you offer this work.` });
  }
  // Set-aside: who may bid.
  const code = (us.set_aside ?? "").toUpperCase();
  const sa = SET_ASIDES[code];
  if (!code || code === "NONE") g.push({ farbe: "gruen", de: "Kein Set-aside: alle Firmen dürfen bieten (Full and Open).", en: "No set-aside: open to all businesses (full and open competition)." });
  else if (!sa) g.push({ farbe: "gelb", de: `Set-aside „${us.set_aside_text || code}“: Bedingungen in der Ausschreibung prüfen.`, en: `Set-aside "${us.set_aside_text || code}": check the eligibility rules in the solicitation.` });
  else {
    if (sa.zert) {
      const hat = sa.zert.some((z) => p?.zertifikate.includes(z));
      const name = sa.zert.map((z) => ZERTIFIKATE[z]);
      g.push(hat
        ? { farbe: "gruen", de: `Set-aside ${sa.name}: Zertifizierung vorhanden.`, en: `Set-aside ${sa.name}: you hold the certification.` }
        : { farbe: "rot", de: `Nur für ${name.map((n) => n.de).join(" oder ")}. Diese Zertifizierung fehlt in eurem Profil.`, en: `Reserved for ${name.map((n) => n.en).join(" or ")}. Your profile does not list this certification.` });
    }
    if (sa.klein) {
      const k = us.naics ? klein(us.naics, p) : null;
      const grenze = us.naics && GROESSE[us.naics]?.umsatz ? ` (Grenze ${GROESSE[us.naics].umsatz} Mio. $ Umsatz)` : "";
      const limit = us.naics && GROESSE[us.naics]?.umsatz ? ` (limit $${GROESSE[us.naics].umsatz}M revenue)` : "";
      if (k === true) g.push({ farbe: "gruen", de: `Kleinunternehmen für NAICS ${us.naics}.`, en: `Small business for NAICS ${us.naics}.` });
      else if (k === false) g.push({ farbe: "rot", de: `Für NAICS ${us.naics} seid ihr laut Umsatz kein Kleinunternehmen${grenze}.`, en: `Based on revenue you are not small for NAICS ${us.naics}${limit}.` });
      else g.push({ farbe: "gelb", de: `Nur für Kleinunternehmen. Prüfen, ob ihr für NAICS ${us.naics || "?"} als „small“ geltet${grenze}.`, en: `Small businesses only. Check that you are small for NAICS ${us.naics || "?"}${limit}.` });
    }
  }
  if (code === "LAS") g.push({ farbe: "gelb", de: "Local Area Set-aside: nur Firmen aus dem genannten Gebiet.", en: "Local area set-aside: only businesses from the named area." });
  return { farbe: schlimmste(g), gruende: g };
}

const FARBE_TEXT: Record<Farbe, { de: string; en: string; icon: string }> = {
  gruen: { de: "Ihr dürft bieten", en: "You may bid", icon: "🟢" },
  gelb: { de: "Bitte prüfen", en: "Please check", icon: "🟡" },
  rot: { de: "Nicht bieten (so)", en: "Do not bid (as is)", icon: "🔴" },
};

/** Small chip for the hit card: light + set-aside. */
export function ampelChip(us: UsDaten | null | undefined, p: UsProfil | null, sprache: "de" | "en"): string {
  if (!us) return "";
  const { farbe } = pruefen(us, p);
  const sa = us.set_aside ? (SET_ASIDES[us.set_aside.toUpperCase()]?.name ?? us.set_aside) : (sprache === "en" ? "Full and open" : "offen für alle");
  return `<li class="us-ampel ${farbe}" title="${escape(FARBE_TEXT[farbe][sprache])}">${FARBE_TEXT[farbe].icon} ${escape(sa)}</li>`;
}

/** Deadline as stated (with the notice's own UTC offset) plus the reader's time zone. */
function fristText(iso: string, sprache: "de" | "en"): { angegeben: string; lokal: string; rest: string } {
  const d = new Date(iso);
  const offset = /([+-]\d{2}):?(\d{2})$/.exec(iso);
  const zone = offset ? ({ "-05:00": "America/New_York", "-04:00": "America/New_York", "-06:00": "America/Chicago", "-07:00": "America/Denver", "-08:00": "America/Los_Angeles", "-09:00": "America/Anchorage", "-10:00": "Pacific/Honolulu" } as Record<string, string>)[`${offset[1]}:${offset[2]}`] : undefined;
  const fmt = (tz: string, loc: string) => d.toLocaleString(loc, { timeZone: tz, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const angegeben = zone ? fmt(zone, sprache === "en" ? "en-US" : "de-DE") : iso;
  const lokal = sprache === "en" ? fmt("America/New_York", "en-US") : fmt("Europe/Berlin", "de-DE");
  const ms = +d - Date.now();
  const tage = Math.floor(ms / 86400_000), stunden = Math.floor((ms % 86400_000) / 3600_000);
  const rest = ms <= 0 ? (sprache === "en" ? "closed" : "abgelaufen") : sprache === "en" ? `${tage} days ${stunden} hours left` : `noch ${tage} Tage ${stunden} Std.`;
  return { angegeben, lokal, rest };
}

/** Box on the tender page: light with reasons, deadline tracker, amendments, contact and next steps. */
export function usKasten(v: { id: string; fragefrist?: string | null; link: string | null }, us: UsDaten, p: UsProfil | null, sprache: "de" | "en", darfProfil: boolean): string {
  const t = (de: string, en: string) => sprache === "en" ? en : de;
  const { farbe, gruende } = pruefen(us, p);
  const reihenfolge = { rot: 0, gelb: 1, gruen: 2 };
  const liste = [...gruende].sort((a, b) => reihenfolge[a.farbe] - reihenfolge[b.farbe])
    .map((g) => `<li class="${g.farbe}">${FARBE_TEXT[g.farbe].icon} ${escape(g[sprache])}</li>`).join("");
  const f = us.frist ? fristText(us.frist, sprache) : null;
  const aenderungen = (us.aenderungen ?? []).filter((a) => a.feld === "frist" || a.feld === "set_aside" || a.feld === "art");
  const feldName = (x: string) => x === "frist" ? t("Frist", "Deadline") : x === "set_aside" ? "Set-aside" : t("Art", "Notice type");
  const wert = (feld: string, x: string) => feld === "frist" ? (fristText(x, sprache).angegeben) : x;
  const sam = us.notice_id ? `https://sam.gov/opp/${encodeURIComponent(us.notice_id)}/view` : v.link ?? "";
  const kontakt = us.kontakt && (us.kontakt.name || us.kontakt.email) ? `<p class="klein">${t("Ansprechpartner (Contracting Officer)", "Point of contact (contracting officer)")}: ${escape(us.kontakt.name ?? "")}${us.kontakt.email ? ` · <a href="mailto:${escape(us.kontakt.email)}">${escape(us.kontakt.email)}</a>` : ""}${us.kontakt.telefon ? ` · ${escape(us.kontakt.telefon)}` : ""}</p>` : "";
  const fakten = [
    us.solicitation ? [t("Ausschreibungs-Nr.", "Solicitation no."), us.solicitation] : null,
    us.art ? [t("Art", "Notice type"), us.art] : null,
    us.set_aside || us.set_aside_text ? ["Set-aside", us.set_aside_text || us.set_aside!] : ["Set-aside", t("keins (offen für alle)", "none (full and open)")],
    us.naics ? ["NAICS", us.naics + (GROESSE[us.naics]?.umsatz ? t(` · Größengrenze ${GROESSE[us.naics].umsatz} Mio. $`, ` · size standard $${GROESSE[us.naics].umsatz}M`) : "")] : null,
    us.psc ? ["PSC", us.psc] : null,
    us.stadt || us.staat ? [t("Ort", "Place of performance"), [us.stadt, us.staat, us.plz].filter(Boolean).join(", ")] : null,
  ].filter(Boolean) as [string, string][];
  return `<section class="us-kasten" aria-labelledby="us-ampel-titel">
<h2 id="us-ampel-titel">${FARBE_TEXT[farbe].icon} ${escape(t("Darf ich bieten?", "May I bid?"))} <span class="us-ampel-wort ${farbe}">${escape(FARBE_TEXT[farbe][sprache])}</span></h2>
<ul class="us-gruende">${liste}</ul>
${darfProfil ? `<p class="klein"><a href="/konto/us-profil">${escape(p ? t("US-Bieterprofil ändern", "Edit your US bidder profile") : t("US-Bieterprofil ausfüllen (2 Minuten)", "Fill in your US bidder profile (2 minutes)"))}</a></p>` : ""}
<h3>⏰ ${escape(t("Fristen-Tracker", "Deadline tracker"))}</h3>
<table class="auswertung-tabelle us-fristen"><tbody>
${f ? `<tr><th>${escape(t("Abgabefrist (laut Ausschreibung)", "Response deadline (as stated)"))}</th><td><strong>${escape(f.angegeben)}</strong><br><span class="klein">${escape(t("Bei euch", "Your time"))}: ${escape(f.lokal)} · ${escape(f.rest)}</span></td></tr>` : `<tr><th>${escape(t("Abgabefrist", "Response deadline"))}</th><td>${escape(t("nicht angegeben", "not stated"))}</td></tr>`}
${v.fragefrist ? `<tr><th>${escape(t("Frist für Rückfragen", "Questions deadline"))}</th><td>${escape(fristText(v.fragefrist, sprache).angegeben)}</td></tr>` : `<tr><th>${escape(t("Rückfragen, Ortsbesichtigung", "Questions, site visit"))}</th><td>${escape(t("Stehen meist in den Anhängen (Section L oder Instructions). Unterlagen hochladen, dann trägt Jarvis sie ein.", "Usually in the attachments (Section L or instructions). Upload the documents and Jarvis adds them."))}</td></tr>`}
${fakten.map(([k, w]) => `<tr><th>${escape(k)}</th><td>${escape(w)}</td></tr>`).join("")}
</tbody></table>
${aenderungen.length ? `<div class="hinweis"><p><strong>📝 ${escape(t(`${aenderungen.length} Änderung(en) seit dem ersten Abruf (Amendments)`, `${aenderungen.length} change(s) since first seen (amendments)`))}</strong></p><ul>${aenderungen.map((a) => `<li>${escape(a.gesehen)}: ${escape(feldName(a.feld))} ${escape(wert(a.feld, a.alt))} → <strong>${escape(wert(a.feld, a.neu))}</strong></li>`).join("")}</ul><p class="klein">${escape(t("Jedes Amendment im Angebot bestätigen (SF 30 unterschreiben oder im Formular SF 1449/SF 33 eintragen). Fehlt die Bestätigung, wird das Angebot oft ausgeschlossen.", "Acknowledge every amendment in your offer (sign the SF 30 or list it on the SF 1449/SF 33). Missing acknowledgments often get offers rejected."))}</p></div>` : `<p class="klein">${escape(t("Noch keine Änderungen gesehen. Jarvis meldet verschobene Fristen und geänderte Set-asides.", "No changes seen yet. Jarvis flags moved deadlines and changed set-asides."))}</p>`}
${kontakt}
${sam ? `<nav class="aktionsleiste"><a class="zweit" href="${escape(sam)}" rel="noopener" target="_blank">🌐 ${escape(t("Auf SAM.gov öffnen (Anhänge, Amendments)", "Open on SAM.gov (attachments, amendments)"))}</a></nav>` : ""}
<p class="klein">${escape(t("Ohne Gewähr. Maßgeblich ist die Ausschreibung auf SAM.gov; Größe und Zertifikate prüft am Ende die Behörde.", "No guarantee. The solicitation on SAM.gov governs; the agency makes the final size and eligibility determination."))}</p>
</section>`;
}
