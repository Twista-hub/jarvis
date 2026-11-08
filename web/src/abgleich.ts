// Rechtsprüfung K9: the Steckbrief is written by an AI and can be wrong. Its tender deadline, question deadline and number
// of lots are compared automatically with the official notice (eForms/OCDS data in the catalog, no AI). The result is a
// hint above the Steckbrief; nothing is blocked and nothing in the Steckbrief is changed.
import { escape } from "./seite.ts";

export type Amtlich = { frist: string | null; fragefrist: string | null; lose: number };
export type Pruefpunkt = { art: "frist" | "fragefrist" | "lose"; stufe: "ok" | "abweichung" | "fehlt"; text: string };

const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const zwei = (n: number) => String(n).padStart(2, "0");

/** First date in a text as YYYY-MM-DD (12.11.2026, 12.11.26, 2026-11-12, 12. November 2026), else null. */
export function datumIn(text: string): string | null {
  const iso = text.match(/\b(20\d\d)-(\d\d)-(\d\d)(?!\d)/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = text.match(/\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})\b/);
  if (de) {
    const j = de[3].length === 2 ? `20${de[3]}` : de[3];
    const t = Number(de[1]), m = Number(de[2]);
    if (t >= 1 && t <= 31 && m >= 1 && m <= 12) return `${j}-${zwei(m)}-${zwei(t)}`;
  }
  const lang = text.toLowerCase().match(new RegExp(`\\b(\\d{1,2})\\.?\\s+(${MONATE.join("|")})\\s+(\\d{4})\\b`));
  if (lang) return `${lang[3]}-${zwei(MONATE.indexOf(lang[2]) + 1)}-${zwei(Number(lang[1]))}`;
  return null;
}

/** First clock time in a text as HH:MM (11:00 Uhr, 11.00 Uhr, 9 Uhr), else null. */
export function uhrzeitIn(text: string): string | null {
  const m = text.match(/\b(\d{1,2})[:.](\d{2})\s*(?:Uhr|h)\b/i) ?? text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${zwei(Number(m[1]))}:${m[2]}`;
  const voll = text.match(/\b(\d{1,2})\s*Uhr\b/i);
  return voll && Number(voll[1]) < 24 ? `${zwei(Number(voll[1]))}:00` : null;
}

/** Date and time of an ISO timestamp in German time. */
function berlin(iso: string): { tag: string; zeit: string } {
  const d = new Date(iso);
  const tag = d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const zeit = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false });
  return { tag, zeit };
}
const anzeige = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;

/** The deadline lines of the Steckbrief: rows of the "Fristen" table, or "**Label:** value" lines of the short form. */
function fristZeilen(md: string): { label: string; wert: string }[] {
  const abschnitt = md.match(/^#+[^\n]*Fristen[^\n]*\n([\s\S]*?)(?=^#+\s|(?![\s\S]))/m)?.[1] ?? "";
  const zeilen: { label: string; wert: string }[] = [];
  for (const z of abschnitt.split("\n")) {
    const zellen = z.split("|").map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    if (zellen.length >= 2 && !/^:?-+:?$/.test(zellen[0])) zeilen.push({ label: zellen[0].replace(/\*/g, ""), wert: zellen.slice(1).join(" ") });
  }
  for (const m of md.matchAll(/\*\*([^*\n]{2,60}?):\*\*\s*([^\n]+)/g)) zeilen.push({ label: m[1], wert: m[2] });
  for (const m of abschnitt.matchAll(/^[-*]\s+\*{0,2}([^:*\n]{2,60}?)\*{0,2}:\*{0,2}\s*([^\n]+)/gm)) zeilen.push({ label: m[1], wert: m[2] });
  return zeilen;
}

const IST_ANGEBOT = /angebot|abgabe|einreichung|submission|schlusstermin|^frist$/i;
const IST_FRAGE = /rückfrage|bieterfrage|fragen|auskunft|klärung/i;
const NICHT = /binde|antwort|teilnahme|besichtigung|zuschlag|laufzeit|ausführung/i;

/** Which deadline the Steckbrief names for tenders and for questions (the first date in the matching line). */
export function steckbriefFristen(md: string): { frist: { tag: string; zeit: string | null } | null; fragefrist: { tag: string; zeit: string | null } | null } {
  let frist: { tag: string; zeit: string | null } | null = null;
  let fragefrist: { tag: string; zeit: string | null } | null = null;
  for (const { label, wert } of fristZeilen(md)) {
    if (NICHT.test(label)) continue;
    const tag = datumIn(wert);
    if (!tag) continue;
    if (!fragefrist && IST_FRAGE.test(label)) fragefrist = { tag, zeit: uhrzeitIn(wert) };
    else if (!frist && IST_ANGEBOT.test(label) && !IST_FRAGE.test(label)) frist = { tag, zeit: uhrzeitIn(wert) };
  }
  return { frist, fragefrist };
}

/** Lot numbers the Steckbrief names ("Los 3", rows of a table whose first column is "Los"), and a stated count. */
export function steckbriefLose(md: string): { nummern: number[]; anzahl: number | null } {
  const nummern = new Set<number>();
  for (const m of md.matchAll(/\bLos(?:e)?\s+(?:Nr\.\s*)?(\d{1,3})\b/g)) nummern.add(Number(m[1]));
  let losTabelle = false;
  for (const z of md.split("\n")) {
    const zellen = z.split("|").map((c) => c.replace(/\*/g, "").trim());
    if (zellen.length < 3) { losTabelle = false; continue; }
    if (/^los(-?nr\.?)?$/i.test(zellen[1])) { losTabelle = true; continue; }
    const n = zellen[1].match(/^(?:Los\s*)?(\d{1,3})\b/i);
    if (losTabelle && n) nummern.add(Number(n[1]));
  }
  const angabe = md.match(/\*\*Lose:\*\*\s*(\d{1,3})\b/)?.[1] ?? md.match(/\b(\d{1,3})\s+Lose\b/)?.[1];
  return { nummern: [...nummern].filter((n) => n > 0).sort((a, b) => a - b), anzahl: angabe ? Number(angabe) : null };
}

/** Compares the Steckbrief with the official notice. Points without official data are left out. */
export function abgleichen(md: string, amtlich: Amtlich): Pruefpunkt[] {
  const s = steckbriefFristen(md);
  const punkte: Pruefpunkt[] = [];
  const vergleich = (art: "frist" | "fragefrist", name: string, offiziell: string | null, genannt: { tag: string; zeit: string | null } | null) => {
    if (!offiziell) return;
    const o = berlin(offiziell);
    // eForms without a time is stored as 23:59; then only the day counts.
    const mitZeit = o.zeit !== "23:59";
    const amtlichText = `${anzeige(o.tag)}${mitZeit ? `, ${o.zeit} Uhr` : ""}`;
    if (!genannt) punkte.push({ art, stufe: "fehlt", text: `${name}: Der Steckbrief nennt kein Datum. Laut Bekanntmachung: ${amtlichText}.` });
    else if (genannt.tag !== o.tag || (mitZeit && genannt.zeit && genannt.zeit !== o.zeit))
      punkte.push({ art, stufe: "abweichung", text: `${name}: Der Steckbrief nennt ${anzeige(genannt.tag)}${genannt.zeit ? `, ${genannt.zeit} Uhr` : ""}, die Bekanntmachung ${amtlichText}. Bitte im Original prüfen (die Frist kann auch nachträglich geändert worden sein).` });
    else punkte.push({ art, stufe: "ok", text: `${name} ${amtlichText} stimmt mit der Bekanntmachung überein.` });
  };
  vergleich("frist", "Angebotsfrist", amtlich.frist, s.frist);
  vergleich("fragefrist", "Frist für Rückfragen", amtlich.fragefrist, s.fragefrist);
  if (amtlich.lose > 1) {
    const l = steckbriefLose(md);
    const hoechste = l.nummern.at(-1) ?? 0;
    const genannt = l.anzahl ?? (l.nummern.length ? hoechste : 0);
    if (!genannt) punkte.push({ art: "lose", stufe: "fehlt", text: `Lose: Die Bekanntmachung hat ${amtlich.lose} Lose, der Steckbrief nennt keine. Bitte im Original prüfen, welche Lose es gibt.` });
    else if (genannt !== amtlich.lose || hoechste > amtlich.lose)
      punkte.push({ art: "lose", stufe: "abweichung", text: `Lose: Die Bekanntmachung hat ${amtlich.lose} Lose, der Steckbrief nennt ${l.anzahl ?? `Los ${l.nummern.length > 1 ? `${l.nummern[0]} bis ${hoechste}` : hoechste}`}${l.anzahl ? " Lose" : ""}. Bitte im Original prüfen.` });
    else punkte.push({ art: "lose", stufe: "ok", text: `Lose: ${amtlich.lose} Lose wie in der Bekanntmachung.` });
  }
  return punkte;
}

/** Official deadlines and lot count from a catalog row (frist, lose, fragefrist = roh->tender->enquiryPeriod->>endDate). */
export function amtlichAusKatalog(k: { frist: string | null; lose?: unknown; fragefrist?: string | null } | null | undefined): Amtlich | null {
  if (!k) return null;
  const lose = Array.isArray(k.lose) ? k.lose.length : 0;
  const frage = k.fragefrist;
  const fragefrist = typeof frage === "string" && Number.isFinite(Date.parse(frage)) ? new Date(frage).toISOString() : null;
  if (!k.frist && !fragefrist && lose < 2) return null;
  return { frist: k.frist, fragefrist, lose };
}

/** The hint box above the Steckbrief. Empty when there is nothing to compare. */
export function abgleichKasten(punkte: Pruefpunkt[]): string {
  if (!punkte.length) return "";
  const offen = punkte.filter((p) => p.stufe !== "ok");
  const icon = { ok: "✅", abweichung: "⚠️", fehlt: "❔" } as const;
  return `<div class="abgleich${offen.length ? " abgleich-warnung" : ""}" role="${offen.length ? "alert" : "status"}"><p><strong>🔎 Abgleich mit der amtlichen Bekanntmachung</strong>${offen.length ? "" : " – keine Abweichung gefunden."}</p><ul>${punkte.map((p) => `<li>${icon[p.stufe]} ${escape(p.text)}</li>`).join("")}</ul><p class="klein">Automatisch, ohne KI, aus den Daten der Bekanntmachung. Ersetzt nicht den Blick in die Vergabeunterlagen.</p></div>`;
}
