// N3: Neuausschreibungs-Radar. Awarded contracts in the firm's field whose term ends soon: the buyer usually
// re-tenders a few months before the end. Contract end from the award notice, the announced period, or estimated
// from award date plus duration. A forecast, not a promise of a new tender.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { bereinigen, type Vorschlag } from "./einrichtung.ts";
import type { Zusatzprofil } from "./suchfilter.ts";
import { cpvPraefix, muster } from "./vorschau.ts";
import { escape, seite } from "./seite.ts";

export type RadarEintrag = {
  id: string; titel: string; auftraggeber: string; auftraggeber_id: string; ort: string; link: string; ende: string;
  ende_art: "vertrag" | "bekanntmachung" | "geschaetzt"; verlaengerung_bis: string | null; gewinner: string; wert: number | string | null;
  neu_id: string | null; neu_titel: string | null;
};
export const VORLAUF_MONATE = 6;
export const ZEITRAEUME = [12, 24, 48] as const;
const ART: Record<RadarEintrag["ende_art"], string> = { vertrag: "laut Vertrag", bekanntmachung: "laut Bekanntmachung", geschaetzt: "geschätzt aus Zuschlag und Laufzeit" };

/** Search parameters from the saved profile (main profile plus the words of further profiles). */
export function radarParameter(v: Vorschlag, zusatz: Zusatzprofil[] = [], schnell: string[] = []) {
  const woerter = [...v.leistungen.flatMap((l) => l.woerter), ...zusatz.flatMap((z) => z.woerter ?? [])];
  const cpv = [...new Set(v.leistungen.flatMap((l) => l.cpv).map(cpvPraefix))];
  const plz = [...new Set(v.standorte.flatMap((o) => o.plz_praefixe))];
  const aus = [...v.ausschluss, ...schnell];
  return { muster: muster(woerter), ausschluss: aus.length ? muster(aus) : "", cpv, plz, leer: !woerter.length && !cpv.length };
}

export function plusMonate(d: string, n: number): string {
  const [j, m, t] = d.split("-").map(Number);
  const x = new Date(Date.UTC(j, m - 1 + n, 1));
  const letzter = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), Math.min(t, letzter))).toISOString().slice(0, 10);
}

/** When to start watching: some months before the contract ends, never in the past. */
export function vorbereitungAb(ende: string, heute: string): string {
  const ab = plusMonate(ende, -VORLAUF_MONATE);
  return ab < heute ? heute : ab;
}

/** Reminder day: the start of the preparation time, at the earliest tomorrow. */
export function erinnerungsTag(ende: string, heute: string): string {
  const ab = vorbereitungAb(ende, heute);
  if (ab > heute) return ab;
  const morgen = new Date(`${heute}T12:00:00Z`); morgen.setUTCDate(morgen.getUTCDate() + 1);
  return morgen.toISOString().slice(0, 10);
}

export const quartal = (d: string) => `${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}. Quartal ${d.slice(0, 4)}`;
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const erinnerungsTitel = (titel: string) => `🔮 Neuausschreibung erwartet: ${titel.replace(/\s+/g, " ").trim()}`.slice(0, 200);

export function radarSeite(liste: RadarEintrag[], o: { heute: string; monate: number; darfErinnern: boolean; admin: boolean; darfUebernehmen: boolean;
  beobachtet: Set<string>; erinnert: Map<string, string>; profilFehlt?: boolean }): string {
  const chips = `<nav class="ordner-chips" aria-label="Zeitraum">${ZEITRAEUME.map((m) => `<a href="/konto/radar?monate=${m}"${m === o.monate ? ' aria-current="true"' : ""}>${m < 24 ? `${m} Monate` : `${m / 12} Jahre`}</a>`).join("")}</nav>`;
  const intro = `<p class="klein">Vergebene Aufträge aus deinem Bereich, deren Vertrag bald endet. Auftraggeber schreiben meist einige Monate vorher neu aus. Crewtender zeigt dir das ${VORLAUF_MONATE} Monate vor Vertragsende als „Vorbereitung ab“.</p>`;
  if (o.profilFehlt) return `${intro}<p class="treffer-leer">Lege zuerst dein <a href="/konto/suchprofil">Suchprofil</a> an. Der Radar nutzt dieselben Wörter, Kennziffern und dasselbe Gebiet.</p>`;
  const zeile = (e: RadarEintrag) => {
    const ab = vorbereitungAb(e.ende, o.heute), vorbei = e.ende < o.heute, bald = !vorbei && ab <= o.heute;
    const wert = e.wert === null ? null : Number(e.wert);
    const erinnert = o.erinnert.get(erinnerungsTitel(e.titel));
    const aktionen = [
      e.neu_id && o.darfUebernehmen ? `<form method="post" action="/konto/markt/uebernehmen"><input type="hidden" name="id" value="${escape(e.neu_id)}"><button>Übernehmen</button></form>` : "",
      o.darfErinnern && !e.neu_id ? (erinnert ? `<span class="radar-marke">🔔 ${datum(erinnert.slice(0, 10))}</span>` : `<form method="post" action="/konto/radar"><input type="hidden" name="erinnern" value="${escape(e.id)}"><input type="hidden" name="monate" value="${o.monate}"><button class="zweit">🔔 Erinnern</button></form>`) : "",
      o.admin ? (o.beobachtet.has(e.auftraggeber_id) ? `<span class="radar-marke">👁 beobachtet</span>` : `<form method="post" action="/konto/radar"><input type="hidden" name="beobachten" value="${escape(e.id)}"><input type="hidden" name="monate" value="${o.monate}"><button class="zweit">👁 Auftraggeber beobachten</button></form>`) : "",
    ].filter(Boolean).join("");
    return `<li class="radar-zeile${e.neu_id ? " neu" : bald || vorbei ? " bald" : ""}"><div class="radar-text"><a href="${escape(e.link)}" target="_blank" rel="noopener"><strong>${escape(e.titel)}</strong></a><span class="klein">${escape(e.auftraggeber)}${e.ort ? ` · ${escape(e.ort.replace(/ \(Auftraggeberadresse; Einsatzort prüfen\)$/, ""))}` : ""}</span>
<span class="radar-ende">${vorbei ? "Vertrag endete" : "Vertrag endet"} <strong>${datum(e.ende)}</strong> <span class="klein">(${ART[e.ende_art]}${e.verlaengerung_bis ? `, mit Verlängerung bis ${datum(e.verlaengerung_bis)}` : ""})</span></span>
<span class="klein">${e.neu_id ? `✅ <strong>Schon neu ausgeschrieben:</strong> ${escape(e.neu_titel ?? "")}` : vorbei || bald ? "⏳ <strong>Jetzt vorbereiten</strong>: Neuausschreibung kann jederzeit kommen" : `Vorbereitung ab ${datum(ab)}`}${e.gewinner ? ` · bisher: ${escape(e.gewinner)}` : ""}${wert && Number.isFinite(wert) ? ` · ${euro(wert)}` : ""}</span></div>${aktionen ? `<div class="radar-aktionen">${aktionen}</div>` : ""}</li>`;
  };
  const gruppen = new Map<string, RadarEintrag[]>();
  for (const e of [...liste].sort((a, b) => a.ende.localeCompare(b.ende))) {
    const k = e.ende < o.heute ? "Bereits ausgelaufen" : quartal(e.ende);
    gruppen.set(k, [...(gruppen.get(k) ?? []), e]);
  }
  const jetzt = liste.filter((e) => !e.neu_id && vorbereitungAb(e.ende, o.heute) <= o.heute).length;
  const kopf = liste.length ? `<div class="angebot-kennzahlen radar-kennzahlen"><div><strong>${liste.length}</strong><span>Verträge enden in ${o.monate < 24 ? `${o.monate} Monaten` : `${o.monate / 12} Jahren`}</span></div><div><strong>${jetzt}</strong><span>jetzt vorbereiten</span></div><div><strong>${liste.filter((e) => e.neu_id).length}</strong><span>schon neu ausgeschrieben</span></div></div>` : "";
  const inhalt = liste.length ? [...gruppen].map(([k, l]) => `<h2 class="radar-gruppe">${escape(k)} <span class="klein">${l.length}</span></h2><ul class="radar-liste">${l.map(zeile).join("")}</ul>`).join("")
    : `<p class="treffer-leer">Noch keine passenden Verträge mit bekanntem Ende in diesem Zeitraum.${o.monate < 48 ? ` <a href="/konto/radar?monate=48">Auf 4 Jahre erweitern</a>` : ""}</p>`;
  return `${intro}${chips}${kopf}${inhalt}<p class="klein">Grundlage sind die Zuschläge im gemeinsamen Vergabekatalog (Bekanntmachungsservice, CC0). Er wächst jeden Tag, deshalb füllt sich der Radar mit der Zeit. Ein Vertragsende ist eine Prognose: Verlängerungen, Kündigungen oder ein anderer Beschaffungsweg sind möglich. 🔔 Erinnern trägt einen Termin unter Fristen ein.</p>`;
}

export async function radar(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/radar") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Neuausschreibungs-Radar", `<p class="konto-zurueck"><a href="/konto/markt" aria-label="Zurück zu Markt &amp; Chancen">←</a></p>${text}`, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Den Radar sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfErinnern = !["leser", "mitarbeiter"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const monate = ZEITRAEUME.find((m) => String(m) === form.get("monate")) ?? 48;
    const id = String(form.get("erinnern") ?? form.get("beobachten") ?? "").slice(0, 400);
    const k = id ? await db<{ titel: string; auftraggeber: string; auftraggeber_id: string; laufzeit_ende: string | null }[]>(f.s, env, `vergabekatalog?id=eq.${encodeURIComponent(id)}&select=titel,auftraggeber,auftraggeber_id,laufzeit_ende&limit=1`) : null;
    const n = k?.ok ? k.daten[0] : undefined;
    let hinweis = "Das ging nicht.";
    if (n && form.has("erinnern") && darfErinnern && n.laufzeit_ende) {
      const tag = erinnerungsTag(n.laufzeit_ende, heute);
      const r = await db(f.s, env, "eigene_termine", { method: "POST", body: JSON.stringify({ firma_id: firma, titel: erinnerungsTitel(n.titel), zeit: `${tag}T07:00:00Z` }) });
      hinweis = r.ok ? `Erinnerung am ${datum(tag)} unter Fristen eingetragen.` : "Erinnerung konnte nicht gespeichert werden.";
    } else if (n && form.has("beobachten") && f.admin) {
      const r = await db(f.s, env, "auftraggeber_abos?on_conflict=firma_id,auftraggeber_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, auftraggeber_id: n.auftraggeber_id, name: n.auftraggeber.slice(0, 500) }) });
      hinweis = r.ok ? `${n.auftraggeber} wird beobachtet: neue Ausschreibungen landen bei deinen Treffern.` : "Beobachten hat nicht geklappt.";
    }
    return weiterleiten(`/konto/radar?monate=${monate}&hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
  }
  const monate = ZEITRAEUME.find((m) => String(m) === url.searchParams.get("monate")) ?? 48;
  const profil = await db<{ einstellungen: Partial<Vorschlag> & { ausschluss_schnell?: string[]; zusatzprofile?: Zusatzprofil[] } }[]>(f.s, env, `suchprofile?firma_id=eq.${firma}&bereich_id=is.null&select=einstellungen&limit=1`);
  const e = profil.ok ? profil.daten[0]?.einstellungen : undefined;
  const hinweis = url.searchParams.get("hinweis");
  const kopf = hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : "";
  const leerOpts = { heute, monate, darfErinnern, admin: f.admin, darfUebernehmen: false, beobachtet: new Set<string>(), erinnert: new Map<string, string>() };
  if (!e?.leistungen) return antwort(kopf + radarSeite([], { ...leerOpts, profilFehlt: true }));
  const p = radarParameter(bereinigen({ ...e, beschreibung: "" }), Array.isArray(e.zusatzprofile) ? e.zusatzprofile : [], e.ausschluss_schnell ?? []);
  if (p.leer) return antwort(kopf + radarSeite([], { ...leerOpts, profilFehlt: true }));
  const [r, abos, termine] = await Promise.all([
    db<RadarEintrag[]>(f.s, env, "rpc/neuausschreibung_radar", { method: "POST", body: JSON.stringify({ f: firma, muster: p.muster, ausschluss: p.ausschluss, cpv: p.cpv, plz: p.plz, monate }) }),
    db<{ auftraggeber_id: string }[]>(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&select=auftraggeber_id`),
    db<{ titel: string; zeit: string }[]>(f.s, env, `eigene_termine?firma_id=eq.${firma}&titel=like.${encodeURIComponent("🔮*")}&select=titel,zeit&limit=500`),
  ]);
  if (!r.ok) return antwort(`${kopf}<p class="fehler">Der Radar konnte gerade nicht geladen werden. Bitte später noch einmal versuchen.</p>`, 502);
  return antwort(kopf + radarSeite(r.daten, { ...leerOpts, darfUebernehmen: ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle),
    beobachtet: new Set((abos.ok ? abos.daten : []).map((a) => a.auftraggeber_id)),
    erinnert: new Map((termine.ok ? termine.daten : []).map((t) => [t.titel, t.zeit])) }));
}
