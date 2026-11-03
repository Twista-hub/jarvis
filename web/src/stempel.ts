// T41: Stempeluhr. Staff tap "Kommen", "Pause", "Weiter" and "Gehen"; the server's clock counts (no back-dating). On
// "Gehen" Jarvis writes the time sheet (start, end, break) by itself. Optionally the phone's position is compared once
// with the postcode of the site; only "at the site yes/no" is stored, never the coordinates.
import plz from "../../alarm/geo/plz.json" with { type: "json" };
import { db, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";

export type Stempel = { art: string; zeit: string; einsatz: string; am_ort: boolean | null };
const PLZ = plz as unknown as Record<string, [number, number]>;
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const berlinDatum = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });

/** Distance in km between a position and the centre of a postcode area (null if unknown). */
export function abstandKm(lat: number, lon: number, postleitzahl: string): number | null {
  const z = PLZ[postleitzahl];
  if (!z) return null;
  const r = Math.PI / 180, dLat = (z[0] - lat) * r, dLon = (z[1] - lon) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(z[0] * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Current shift of stamps: the entries since the last "kommen" (empty when the last one was "gehen"). */
export function laufend(liste: Stempel[]): Stempel[] {
  const s = [...liste].sort((a, b) => a.zeit.localeCompare(b.zeit));
  const i = s.map((x) => x.art).lastIndexOf("kommen");
  if (i < 0 || s.slice(i).some((x) => x.art === "gehen")) return [];
  return s.slice(i);
}

/** Time sheet from one run of stamps: start, end, break minutes (sum of pause→weiter, an open pause ends at "gehen"). */
export function auswerten(lauf: Stempel[], gehen: string): { datum: string; beginn: string; ende: string; pause_min: number; einsatz: string; am_ort: boolean | null } | null {
  const kommen = lauf.find((x) => x.art === "kommen");
  if (!kommen) return null;
  let pause = 0, seit: string | null = null;
  for (const x of lauf) { if (x.art === "pause") seit = x.zeit; else if (x.art === "weiter" && seit) { pause += Date.parse(x.zeit) - Date.parse(seit); seit = null; } }
  if (seit) pause += Date.parse(gehen) - Date.parse(seit);
  const beginn = uhr(kommen.zeit), ende = uhr(gehen);
  if (Date.parse(gehen) - Date.parse(kommen.zeit) < 60_000 || beginn === ende) return null;
  // A-M7: more than 16 hours means "Gehen" was forgotten; a time sheet with clock times only would wrap over midnight.
  if (Date.parse(gehen) - Date.parse(kommen.zeit) > 16 * 3600_000) return null;
  const orte = lauf.map((x) => x.am_ort).filter((x) => x !== null);
  return { datum: berlinDatum(kommen.zeit), beginn, ende, pause_min: Math.round(pause / 60000), einsatz: kommen.einsatz, am_ort: orte.length ? orte.every(Boolean) : null };
}

export function stempelTeil(liste: Stempel[], vorschlaege: string[], jetzt: string): string {
  const lauf = laufend(liste), letzte = lauf.at(-1);
  const alt = lauf.length && berlinDatum(lauf[0].zeit) < berlinDatum(jetzt);
  const status = !letzte ? "Nicht eingestempelt." : letzte.art === "pause" ? `☕ Pause seit ${uhr(letzte.zeit)}` : `🟢 Eingestempelt seit ${uhr(lauf[0].zeit)}${lauf[0].einsatz ? ` · ${escape(lauf[0].einsatz)}` : ""}`;
  const knopf = (art: string, text: string, zweit = false) => `<button name="stempel" value="${art}"${zweit ? ' class="zweit"' : ""}>${text}</button>`;
  return `<section id="stempeluhr" class="stempeluhr"><h3>⏱️ Stempeluhr</h3><p class="stempel-status">${status}</p>${alt ? `<p class="hinweis">⚠️ Seit ${uhr(lauf[0].zeit)} am ${new Date(lauf[0].zeit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} nicht ausgestempelt. „Gehen“ beendet die Schicht jetzt; trag sonst die richtige Zeit unter „Meine Stunden“ ein und tippe „Neu beginnen“.</p>` : ""}
<form method="post" action="/konto/ich" data-standort><input type="hidden" name="aktion" value="stempel"><input type="hidden" name="lat"><input type="hidden" name="lon">
${!letzte ? `<label>Einsatz<input name="einsatz" maxlength="160" list="einsatz-vorschlaege"${vorschlaege[0] ? ` value="${escape(vorschlaege[0])}"` : ""}></label><div class="knopf-zeile">${knopf("kommen", "▶️ Kommen")}</div>`
  : `<div class="knopf-zeile">${letzte.art === "pause" ? knopf("weiter", "▶️ Weiter") : knopf("pause", "☕ Pause", true)}${knopf("gehen", "⏹️ Gehen")}${alt ? knopf("neu", "Neu beginnen", true) : ""}</div>`}</form>
<p class="klein">Es zählt die Uhrzeit des Servers. Beim Tippen fragt das Handy einmal nach dem Standort: Jarvis prüft nur, ob du in der Nähe des Einsatzorts bist, und speichert keine Koordinaten. Ablehnen geht auch.</p></section>`;
}

/** Saves a stamp; on "gehen" also the time sheet. Returns a message for the page. */
export async function stempeln(s: Sitzung, env: KontoEnv, form: FormData, firma: string, personal: string, orte: { name: string; plz: string }[]): Promise<string> {
  const art = String(form.get("stempel") ?? "");
  if (!["kommen", "pause", "weiter", "gehen", "neu"].includes(art)) return "Unbekannte Aktion.";
  const r = await db<Stempel[]>(s, env, `stempel?personal_id=eq.${personal}&zeit=gte.${new Date(Date.now() - 3 * 86400_000).toISOString()}&select=art,zeit,einsatz,am_ort&order=zeit&limit=200`);
  const lauf = laufend(r.ok ? r.daten : []);
  const lat = Number(form.get("lat")), lon = Number(form.get("lon"));
  const einsatz = art === "kommen" ? String(form.get("einsatz") ?? "").replace(/\s+/g, " ").trim().slice(0, 160) : lauf[0]?.einsatz ?? "";
  const ort = orte.find((o) => o.name.toLowerCase() === einsatz.toLowerCase() && o.plz);
  const km = ort && Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? abstandKm(lat, lon, ort.plz) : null;
  const amOrt = km === null ? null : km <= 5;
  if (art === "neu") {
    // Abandon a forgotten run: a "gehen" without time sheet closes it.
    const x = await db(s, env, "stempel", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: personal, art: "gehen", einsatz }) });
    return x.ok ? "Alte Schicht ohne Stundenzettel beendet. Bitte die Zeiten unter „Meine Stunden“ eintragen." : "Das hat nicht geklappt.";
  }
  if (art === "kommen" && lauf.length) return "Du bist schon eingestempelt.";
  if (art !== "kommen" && !lauf.length) return "Bitte zuerst „Kommen“ tippen.";
  if ((art === "pause" && lauf.at(-1)?.art === "pause") || (art === "weiter" && lauf.at(-1)?.art !== "pause")) return "Das passt gerade nicht.";
  const neu = await db<Stempel[]>(s, env, "stempel?select=art,zeit,einsatz,am_ort", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, personal_id: personal, art, einsatz, am_ort: amOrt }) });
  if (!neu.ok || !neu.daten.length) return "Stempeln hat nicht geklappt.";
  const z = neu.daten[0];
  if (art !== "gehen") return `${art === "kommen" ? "Eingestempelt" : art === "pause" ? "Pause gestartet" : "Weiter geht's"} um ${uhr(z.zeit)}.${amOrt === false ? " Hinweis: Du scheinst nicht am Einsatzort zu sein." : ""}`;
  const e = auswerten([...lauf, z], z.zeit);
  if (!e) return Date.parse(z.zeit) - Date.parse(lauf.find((x) => x.art === "kommen")?.zeit ?? z.zeit) > 16 * 3600_000
    ? "Ausgestempelt. Zwischen Kommen und Gehen liegen über 16 Stunden – wahrscheinlich wurde das Ausstempeln vergessen. Bitte die Stunden von Hand eintragen."
    : "Ausgestempelt. Die Zeit war zu kurz für einen Stundenzettel.";
  const notiz = `gestempelt${e.am_ort === false ? ", nicht am Einsatzort" : e.am_ort ? ", am Einsatzort" : ""}`;
  const sz = await db(s, env, "stundenzettel", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: personal, datum: e.datum, beginn: e.beginn, ende: e.ende, pause_min: e.pause_min, einsatz: e.einsatz, notiz }) });
  return sz.ok ? `Ausgestempelt um ${uhr(z.zeit)}. Stundenzettel ${e.beginn}–${e.ende}${e.pause_min ? `, ${e.pause_min} Min. Pause` : ""} ist angelegt.` : "Ausgestempelt, aber der Stundenzettel konnte nicht angelegt werden. Bitte von Hand eintragen.";
}
