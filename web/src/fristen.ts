// "Fristen": traffic-light deadlines grouped by week, a small month calendar, calendar files and what is still open.
import { escape } from "./seite.ts";

export type FristVorgang = { id: string; titel: string; frist: string | null; status: string; kaufverantwortlich_id?: string | null; fragefrist?: string | null; art?: "fragen" | "eigen"; vorgang_id?: string | null };

const BERLIN = "Europe/Berlin";
const TAG = 86400_000;
const tagVon = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: BERLIN }); // YYYY-MM-DD
export const OFFEN = ["neu", "pruefen", "angebot"];

/** Whole days until the deadline (Berlin calendar days); negative when it has passed. */
export function tageBis(frist: string, jetzt = Date.now()): number {
  return Math.round((Date.parse(tagVon(frist)) - Date.parse(tagVon(new Date(jetzt).toISOString()))) / TAG);
}

/** Red below 3 days, orange below 7, green later; grey once done or passed. */
export function ampel(v: FristVorgang, jetzt = Date.now()): "rot" | "gelb" | "gruen" | "grau" {
  if (!v.frist || !OFFEN.includes(v.status)) return "grau";
  const t = tageBis(v.frist, jetzt);
  return t < 0 ? "grau" : t < 3 ? "rot" : t < 7 ? "gelb" : "gruen";
}

export function abstand(frist: string, jetzt = Date.now()): string {
  const t = tageBis(frist, jetzt);
  return t < 0 ? "abgelaufen" : t === 0 ? "heute" : t === 1 ? "morgen" : `in ${t} Tagen`;
}

/** Week groups the way people plan: this week, next week, later. */
export function gruppen<T extends FristVorgang>(liste: T[], jetzt = Date.now()): [string, T[]][] {
  const heute = new Date(tagVon(new Date(jetzt).toISOString()));
  const wochentag = (heute.getUTCDay() + 6) % 7; // Monday = 0
  const ende1 = heute.getTime() + (6 - wochentag) * TAG;
  const ende2 = ende1 + 7 * TAG;
  const zeit = (v: T) => Date.parse(tagVon(v.frist!));
  const g: [string, T[]][] = [
    ["Diese Woche", liste.filter((v) => zeit(v) <= ende1)],
    ["Nächste Woche", liste.filter((v) => zeit(v) > ende1 && zeit(v) <= ende2)],
    ["Später", liste.filter((v) => zeit(v) > ende2)],
  ];
  return g.filter(([, l]) => l.length);
}

/** Compact month grid; days with deadlines are marked and link to the list entry. */
export function monatsKalender(liste: FristVorgang[], monat: string, jetzt = Date.now(), gewaehlt = ""): string {
  const [jahr, mon] = monat.split("-").map(Number);
  const erster = new Date(Date.UTC(jahr, mon - 1, 1));
  const tage = new Date(Date.UTC(jahr, mon, 0)).getUTCDate();
  const versatz = (erster.getUTCDay() + 6) % 7;
  const heute = tagVon(new Date(jetzt).toISOString());
  const proTag = new Map<string, FristVorgang[]>();
  for (const v of liste) if (v.frist) proTag.set(tagVon(v.frist), [...(proTag.get(tagVon(v.frist)) ?? []), v]);
  const zellen = [...Array(versatz).fill(`<span></span>`)];
  for (let d = 1; d <= tage; d++) {
    const key = `${monat}-${String(d).padStart(2, "0")}`;
    const f = proTag.get(key) ?? [];
    const farbe = f.length ? ampel(f[0], jetzt) : "";
    zellen.push(f.length
      ? `<a href="/konto/fristen?monat=${monat}&tag=${key}" class="tag mit-frist ${farbe}${key === heute ? " heute" : ""}${key === gewaehlt ? " gewaehlt" : ""}" title="${escape(f.map((x) => x.titel).join(" · "))}">${d}</a>`
      : `<span class="tag${key === heute ? " heute" : ""}">${d}</span>`);
  }
  const name = erster.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  const nachbar = (delta: number) => { const x = new Date(Date.UTC(jahr, mon - 1 + delta, 1)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };
  return `<section class="kalender" aria-label="Kalender ${escape(name)}">
  <div class="kalender-kopf"><a href="/konto/fristen?monat=${nachbar(-1)}" aria-label="Voriger Monat">‹</a><strong>${escape(name)}</strong><a href="/konto/fristen?monat=${nachbar(1)}" aria-label="Nächster Monat">›</a></div>
  <div class="kalender-raster">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((t) => `<span class="wtag">${t}</span>`).join("")}${zellen.join("")}</div>
</section>`;
}

/** Calendar file for one deadline, with reminders one day and two hours before. */
export function ics(v: FristVorgang, link: string, jetzt = new Date()): string {
  const stempel = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(v.frist!);
  const text = (x: string) => x.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WP Digital Ranger//Jarvis//DE", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:frist-${v.id}@app.wpdigitalranger.com`, `DTSTAMP:${stempel(jetzt)}`, `DTSTART:${stempel(start)}`, `DTEND:${stempel(new Date(start.getTime() + 30 * 60_000))}`,
    `SUMMARY:${text(`Abgabefrist: ${v.titel}`.slice(0, 200))}`, `DESCRIPTION:${text(`Ausschreibung in Jarvis: ${link}`)}`, `URL:${link}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Abgabefrist morgen", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Abgabefrist in 2 Stunden", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export type Kalendereintrag = { uid: string; titel: string; zeit: string; text: string; url: string };

/** One calendar file with many entries (subscription feed); reminders one day and two hours before. */
export function icsKalender(eintraege: Kalendereintrag[], jetzt = new Date()): string {
  const stempel = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (x: string) => x.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WP Digital Ranger//Jarvis//DE", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Jarvis Fristen", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
  for (const e of eintraege) {
    const start = new Date(e.zeit);
    if (!Number.isFinite(start.getTime())) continue;
    zeilen.push("BEGIN:VEVENT", `UID:${e.uid}@app.wpdigitalranger.com`, `DTSTAMP:${stempel(jetzt)}`, `DTSTART:${stempel(start)}`, `DTEND:${stempel(new Date(start.getTime() + 30 * 60_000))}`,
      `SUMMARY:${text(e.titel.slice(0, 200))}`, `DESCRIPTION:${text(e.text)}`, `URL:${e.url}`,
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${text(e.titel.slice(0, 120))}`, "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${text(e.titel.slice(0, 120))}`, "END:VALARM", "END:VEVENT");
  }
  zeilen.push("END:VCALENDAR", "");
  return zeilen.join("\r\n");
}

/** What is still missing before submission, from the procedure's state. */
export function offenePunkte(v: FristVorgang, hatKalkulation: boolean): string[] {
  if (!OFFEN.includes(v.status)) return [];
  const punkte: string[] = [];
  if (v.status !== "angebot") punkte.push("Entscheidung offen");
  if (!hatKalkulation) punkte.push("Kalkulation fehlt");
  if (!v.kaufverantwortlich_id) punkte.push("Niemand zuständig");
  return punkte;
}

export function fristenSeite(liste: FristVorgang[], opts: { erledigte: boolean; monat: string; zustaendig: (id?: string | null) => string; kalkuliert: Set<string>; jetzt?: number; tag?: string; eigene?: FristVorgang[]; abo?: string; terminForm?: string }): string {
  const jetzt = opts.jetzt ?? Date.now();
  // The deadline for bidder questions appears as its own entry ("Fragen bis"), before the submission deadline.
  liste = liste.flatMap((v) => [...(v.frist ? [v] : []), ...(v.fragefrist ? [{ ...v, frist: v.fragefrist, art: "fragen" as const }] : [])])
    .concat(opts.eigene ?? [])
    .sort((a, b) => (a.frist ?? "").localeCompare(b.frist ?? ""));
  const alleOffen = liste.filter((v) => v.frist && (v.art === "eigen" || OFFEN.includes(v.status)) && tageBis(v.frist, jetzt) >= 0);
  // Tapping a day in the calendar shows only that day.
  const offen = opts.tag ? alleOffen.filter((v) => tagVon(v.frist!) === opts.tag) : alleOffen;
  const erledigt = liste.filter((v) => v.frist && !alleOffen.includes(v));
  const eintrag = (v: FristVorgang) => {
    const fehlt = v.art ? [] : offenePunkte(v, opts.kalkuliert.has(v.id));
    // Time line: how much of the last 30 days before the deadline is left.
    const rest = Math.max(0, Math.min(30, tageBis(v.frist!, jetzt)));
    const wer = opts.zustaendig(v.kaufverantwortlich_id);
    return `<li id="frist-${v.id}${v.art ? `-${v.art}` : ""}" class="frist ${v.art === "eigen" ? (tageBis(v.frist!, jetzt) < 3 ? "rot" : tageBis(v.frist!, jetzt) < 7 ? "gelb" : "gruen") : ampel(v, jetzt)}">
  <div class="frist-kopf">${v.art === "fragen" ? `<span class="frist-art">❓ Fragen bis</span>` : v.art === "eigen" ? `<span class="frist-art">📌 Eigener Termin</span>` : ""}<time datetime="${escape(v.frist!)}">${new Date(v.frist!).toLocaleDateString("de-DE", { timeZone: BERLIN, weekday: "short", day: "2-digit", month: "2-digit" })}</time><span class="frist-abstand">${abstand(v.frist!, jetzt)}</span></div>
  ${v.art === "eigen" ? (v.vorgang_id ? `<a class="frist-titel" href="/konto/vorgang/${v.vorgang_id}">${escape(v.titel)}</a>` : `<span class="frist-titel">${escape(v.titel)}</span>`) : `<a class="frist-titel" href="/konto/vorgang/${v.id}">${escape(v.titel)}</a>`}
  <div class="zeitleiste" aria-hidden="true"><span style="width:${Math.round((rest / 30) * 100)}%"></span></div>
  <div class="frist-info">${wer ? `<span>👤 ${escape(wer)}</span>` : ""}${fehlt.map((x) => `<span class="fehlt">${escape(x)}</span>`).join("")}${v.art === "eigen" ? `<form method="post" action="/konto/termin" class="termin-weg"><input type="hidden" name="loeschen" value="${v.id}"><button class="zweit">Löschen</button></form>` : v.art === "fragen" ? "" : `<a class="frist-ics" href="/konto/frist/${v.id}.ics" download>📅 In Kalender</a>`}</div>
</li>`;
  };
  const listen = offen.length
    ? gruppen(offen, jetzt).map(([titel, l]) => `<h2 class="frist-gruppe">${titel}</h2><ul class="fristen-liste">${l.map(eintrag).join("")}</ul>`).join("")
    : `<p class="treffer-leer">Aktuell stehen keine offenen Fristen an.</p>`;
  const schalter = `<p class="frist-schalter"><a href="/konto/fristen${opts.erledigte ? "" : "?erledigte=1"}">${opts.erledigte ? "Erledigte ausblenden" : `Erledigte zeigen${erledigt.length ? ` (${erledigt.length})` : ""}`}</a></p>`;
  const alte = opts.erledigte && erledigt.length ? `<h2 class="frist-gruppe">Erledigt oder abgelaufen</h2><ul class="fristen-liste">${erledigt.map(eintrag).join("")}</ul>` : "";
  const filter = opts.tag ? `<p class="tag-filter">Nur ${new Date(opts.tag + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} <a href="/konto/fristen?monat=${opts.monat}" aria-label="Filter aufheben">✕ Alle zeigen</a></p>` : "";
  return `${monatsKalender(alleOffen, opts.monat, jetzt, opts.tag ?? "")}${filter}${opts.terminForm ?? ""}${listen}${alte}${schalter}${opts.abo ?? ""}<p class="klein">Jarvis erinnert dich zusätzlich 7 und 2 Tage vorher per täglicher Nachricht und am Morgen des Fristtags aufs Handy.</p>`;
}
