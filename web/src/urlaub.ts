// T26: Urlaubskonto und Teamkalender. Entitlement and carry-over per person and year, taken and requested leave days
// (workdays Monday to Friday without public holidays of the federal state), remaining days; a month calendar of the team
// shows who is away and warns when too many are away at the same time.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { feiertag } from "./zuschlaege.ts";
import { landDerFirma, landJeBereich } from "./stunden.ts";

export type Konto = { personal_id: string; jahr: number; anspruch: number | string; uebertrag: number | string };
export type Abw = { personal_id: string; von: string; bis: string; grund: string; status?: string; kurzfristig?: boolean };
type Person = { id: string; vorname: string; nachname: string; status: string; bereich_id: string | null; arbeitstage?: number[] | null };
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const name = (p: Pick<Person, "vorname" | "nachname">) => `${p.vorname} ${p.nachname}`.trim();

/** Workdays between two dates without public holidays, limited to one year. tage = the person's weekdays
 * (ISO 1 = Monday … 7 = Sunday); without it Monday to Friday. */
export function arbeitstage(von: string, bis: string, land: string, jahr?: number, tage?: number[] | null): number {
  let n = 0;
  const woche = tage?.length ? tage : [1, 2, 3, 4, 5];
  const a = jahr ? (von < `${jahr}-01-01` ? `${jahr}-01-01` : von) : von, b = jahr ? (bis > `${jahr}-12-31` ? `${jahr}-12-31` : bis) : bis;
  for (let d = a; d <= b; d = plus(d, 1)) { const w = new Date(`${d}T12:00:00Z`).getUTCDay() || 7; if (woche.includes(w) && !feiertag(d, land)) n++; }
  return n;
}

/** Statutory minimum leave per year: 24 working days on a 6-day week, i.e. 4 per weekly working day (§ 3 BUrlG). */
export const mindesturlaub = (tage?: number[] | null) => 4 * (tage?.length || 5);

/** Weekdays per person (tolerant: an older database without the column simply gives Monday to Friday). */
export async function arbeitstageLaden(s: Parameters<typeof db>[0], env: Parameters<typeof db>[1], firma: string, person?: string): Promise<Map<string, number[] | null>> {
  const r = await db<{ id: string; arbeitstage: number[] | null }[]>(s, env, `personal?firma_id=eq.${firma}${person ? `&id=eq.${person}` : ""}&arbeitstage=not.is.null&select=id,arbeitstage&limit=5000`);
  return new Map(r.ok ? r.daten.map((x) => [x.id, x.arbeitstage]) : []);
}

export type Stand = { anspruch: number; uebertrag: number; genommen: number; beantragt: number; rest: number; eingetragen: boolean };
export function stand(pid: string, jahr: number, konten: Konto[], abw: Abw[], land: string, tage?: number[] | null): Stand {
  const k = konten.find((x) => x.personal_id === pid && x.jahr === jahr);
  const u = abw.filter((a) => a.personal_id === pid && a.grund === "urlaub" && a.von <= `${jahr}-12-31` && a.bis >= `${jahr}-01-01`);
  const genommen = u.filter((a) => a.status !== "beantragt").reduce((s, a) => s + arbeitstage(a.von, a.bis, land, jahr, tage), 0);
  const beantragt = u.filter((a) => a.status === "beantragt").reduce((s, a) => s + arbeitstage(a.von, a.bis, land, jahr, tage), 0);
  const anspruch = Number(k?.anspruch ?? 0), uebertrag = Number(k?.uebertrag ?? 0);
  return { anspruch, uebertrag, genommen, beantragt, rest: anspruch + uebertrag - genommen - beantragt, eingetragen: !!k };
}

export function kontoSeite(personen: Person[], konten: Konto[], abw: Abw[], o: { jahr: number; land: string; darfAendern: boolean; landVon?: (bereich: string | null) => string }): string {
  const aktiv = personen.filter((p) => p.status !== "nicht");
  const zeilen = aktiv.map((p) => ({ p, s: stand(p.id, o.jahr, konten, abw, o.landVon ? o.landVon(p.bereich_id) : o.land, p.arbeitstage) }));
  const ohne = zeilen.filter((z) => !z.s.eingetragen).length;
  // A-M3: statutory minimum leave § 3 BUrlG = 24 working days on a 6-day week, i.e. 4 per weekly working day.
  const wenig = zeilen.filter((z) => z.s.eingetragen && z.s.anspruch < mindesturlaub(z.p.arbeitstage));
  const mindest = wenig.length ? `<p class="hinweis">⚠️ Weniger als der gesetzliche Mindesturlaub (§ 3 BUrlG: 4 Tage je wöchentlichem Arbeitstag, bei 5-Tage-Woche 20) bei ${wenig.map((z) => `${escape(name(z.p))} (${zahl(z.s.anspruch)} statt mindestens ${mindesturlaub(z.p.arbeitstage)})`).join(", ")}. Bitte prüfen. Arbeitstage stehen in der Personalakte.</p>` : "";
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/urlaub?jahr=${o.jahr - 1}" aria-label="Vorjahr">‹</a><strong>Urlaub ${o.jahr}</strong><a class="knopf zweit" href="/konto/urlaub?jahr=${o.jahr + 1}" aria-label="Nächstes Jahr">›</a></nav>
<nav class="ordner-chips" aria-label="Ansicht"><a href="/konto/urlaub?jahr=${o.jahr}" aria-current="page">Urlaubskonto</a><a href="/konto/urlaub?ansicht=kalender">📅 Teamkalender</a></nav>
<p class="klein">Gezählt werden die Arbeitstage der Person aus der Personalakte (sonst Mo–Fr) ohne Feiertage. Bestätigter Urlaub gilt als genommen, Anträge stehen extra. Anspruch und Übertrag aus dem Vorjahr trägst du hier ein.</p>
${mindest}<p class="klein">Resturlaub verfällt nur, wenn ihr die Beschäftigten rechtzeitig auf den Rest und den Verfall hingewiesen habt (BAG). Crewtender zeigt jeder Einsatzkraft mit App-Zugang ihren Rest mit diesem Hinweis; für Beschäftigte ohne App den Hinweis schriftlich geben.</p>
${aktiv.length ? `<form method="post" action="/konto/urlaub"><input type="hidden" name="jahr" value="${o.jahr}"><div class="tabelle-scroll"><table class="auswertung-tabelle urlaub-tabelle"><thead><tr><th>Person</th><th title="Anspruch">Anspr.</th><th title="Übertrag aus dem Vorjahr">Übertr.</th><th title="genommen">genom.</th><th title="beantragt">beantr.</th><th>Rest</th></tr></thead><tbody>${zeilen.map(({ p, s }) => `<tr${s.rest < 0 ? ' class="minus"' : ""}><td>${escape(name(p))}</td><td>${o.darfAendern ? `<input name="anspruch_${p.id}" inputmode="decimal" maxlength="5" value="${s.eingetragen ? zahl(s.anspruch) : ""}" aria-label="Anspruch ${escape(name(p))}">` : zahl(s.anspruch)}</td><td>${o.darfAendern ? `<input name="uebertrag_${p.id}" inputmode="decimal" maxlength="5" value="${s.eingetragen && s.uebertrag ? zahl(s.uebertrag) : ""}" aria-label="Übertrag ${escape(name(p))}">` : zahl(s.uebertrag)}</td><td>${zahl(s.genommen)}</td><td>${s.beantragt ? zahl(s.beantragt) : "–"}</td><td><strong>${s.eingetragen ? zahl(s.rest) : "–"}</strong></td></tr>`).join("")}</tbody></table></div>
${o.darfAendern ? `<div class="stunden-knoepfe"><button>Speichern</button>${ohne ? `<label class="zeile-inline">Für alle ${ohne} ohne Eintrag<input name="standard" inputmode="decimal" maxlength="5" placeholder="z. B. 24"> Tage</label>` : ""}</div>` : ""}</form>` : `<p class="treffer-leer">Noch kein Personal.</p>`}`;
}

export function kalenderSeite(personen: Person[], abw: Abw[], o: { monat: string; land: string; heute: string; standort: string; standorte: { id: string; name: string }[] }): string {
  const [j, m] = o.monat.split("-").map(Number);
  const tage = Array.from({ length: new Date(Date.UTC(j, m, 0)).getUTCDate() }, (_, i) => `${o.monat}-${String(i + 1).padStart(2, "0")}`);
  const leute = personen.filter((p) => p.status !== "nicht" && (!o.standort || p.bereich_id === o.standort));
  const grenze = Math.max(2, Math.ceil(leute.length * 0.25));
  const zelle = (p: Person, d: string) => { const a = abw.find((x) => x.personal_id === p.id && x.von <= d && x.bis >= d); return a ? (a.status === "beantragt" ? ["beantragt", "?"] : a.grund === "urlaub" ? ["urlaub", "U"] : a.grund === "schulung" ? ["schulung", "S"] : ["weg", "–"]) : null; };
  const zaehlen = (d: string) => leute.filter((p) => zelle(p, d)).length;
  const vor = m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, "0")}`, nach = m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, "0")}`;
  const art = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return [w === 0 || w === 6 ? "we" : "", feiertag(d, o.land) ? "ft" : "", d === o.heute ? "heute" : ""].filter(Boolean).join(" "); };
  const kritisch = tage.filter((d) => !/we|ft/.test(art(d)) && zaehlen(d) >= grenze);
  const q = (x: string) => `/konto/urlaub?ansicht=kalender&monat=${x}${o.standort ? `&standort=${o.standort}` : ""}`;
  return `<nav class="dispo-nav"><a class="knopf zweit" href="${q(vor)}" aria-label="Vormonat">‹</a><strong>${new Date(`${o.monat}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><a class="knopf zweit" href="${q(nach)}" aria-label="Nächster Monat">›</a></nav>
<nav class="ordner-chips" aria-label="Ansicht"><a href="/konto/urlaub?jahr=${j}">Urlaubskonto</a><a href="${q(o.monat)}" aria-current="page">📅 Teamkalender</a></nav>
${o.standorte.length ? `<form method="get" action="/konto/urlaub" class="dispo-filter"><input type="hidden" name="ansicht" value="kalender"><input type="hidden" name="monat" value="${o.monat}"><select name="standort" data-sofort-wahl aria-label="Standort"><option value="">Alle Standorte</option>${o.standorte.map((s) => `<option value="${s.id}"${s.id === o.standort ? " selected" : ""}>${escape(s.name)}</option>`).join("")}</select><noscript><button>Zeigen</button></noscript></form>` : ""}
${kritisch.length ? `<p class="hinweis">⚠️ An ${kritisch.length} ${kritisch.length === 1 ? "Werktag" : "Werktagen"} fehlen ${grenze} oder mehr Personen gleichzeitig: ${kritisch.map((d) => `${Number(d.slice(8))}.`).join(", ")}</p>` : ""}
<div class="tabelle-scroll kalender-scroll"><table class="team-kalender"><thead><tr><th class="name">Person</th>${tage.map((d) => `<th class="${art(d)}">${Number(d.slice(8))}<br><span>${["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(`${d}T12:00:00Z`).getUTCDay()]}</span></th>`).join("")}</tr>
<tr class="summe"><th class="name">weg</th>${tage.map((d) => { const n = zaehlen(d); return `<th class="${art(d)}${n >= grenze && !/we|ft/.test(art(d)) ? " zuviel" : ""}">${n || ""}</th>`; }).join("")}</tr></thead>
<tbody>${leute.map((p) => `<tr><td class="name">${escape(name(p))}</td>${tage.map((d) => { const z = zelle(p, d); return `<td class="${art(d)}${z ? ` ${z[0]}` : ""}">${z ? z[1] : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
<p class="klein">U Urlaub · ? beantragt · S Schulung · – nicht verfügbar · grau Wochenende/Feiertag. Rot: ${grenze} oder mehr gleichzeitig weg (ein Viertel des Teams, mindestens 2).</p>`;
}

export function meinUrlaubText(s: Stand, jahr: number): string {
  return s.eingetragen ? `<p class="klein urlaub-konto">Urlaub ${jahr}: ${zahl(s.anspruch)}${s.uebertrag ? ` + ${zahl(s.uebertrag)} aus dem Vorjahr` : ""} Tage · genommen ${zahl(s.genommen)}${s.beantragt ? ` · beantragt ${zahl(s.beantragt)}` : ""} · <strong>Rest ${zahl(s.rest)}</strong></p>${s.rest > 0 ? `<p class="klein">Bitte plane deinen Resturlaub rechtzeitig. Nicht genommener Urlaub verfällt in der Regel am 31.12.${jahr}, übertragener Urlaub am 31.03.${jahr + 1} (§ 7 Abs. 3 BUrlG).</p>` : ""}` : "";
}

export async function urlaub(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/urlaub") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Urlaub", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich", f.s.cookies);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const jahrWahl = (v: string | null) => /^20\d{2}$/.test(v ?? "") ? Number(v) : Number(heute.slice(0, 4));
  if (request.method === "POST") {
    const form = await request.formData();
    const jahr = jahrWahl(String(form.get("jahr") ?? ""));
    const zurueck = (h: string) => weiterleiten(`/konto/urlaub?jahr=${jahr}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter, Standortleitungen und Admins.");
    const z = (v: unknown) => { const s = String(v ?? "").trim().replace(",", "."); const n = Number(s); return s && Number.isFinite(n) ? Math.round(n * 2) / 2 : null; };
    const standard = z(form.get("standard"));
    const zeilen: { firma_id: string; personal_id: string; jahr: number; anspruch: number; uebertrag: number }[] = [];
    for (const [k, v] of form.entries()) {
      const m = k.match(/^anspruch_([0-9a-f-]{36})$/);
      if (!m) continue;
      const a = z(v) ?? standard, u = z(form.get(`uebertrag_${m[1]}`)) ?? 0;
      if (a === null || a < 0 || a > 100 || u < -100 || u > 100) continue;
      zeilen.push({ firma_id: firma, personal_id: m[1], jahr, anspruch: a, uebertrag: u });
    }
    if (!zeilen.length) return zurueck("Nichts zu speichern.");
    const r = await db(f.s, env, "urlaubskonten?on_conflict=personal_id,jahr", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(zeilen.slice(0, 3000)) });
    return zurueck(r.ok ? `${zeilen.length} ${zeilen.length === 1 ? "Urlaubskonto" : "Urlaubskonten"} gespeichert.` : "Speichern hat nicht geklappt. Hast du Rechte für alle Standorte dieser Personen?");
  }
  const kalender = url.searchParams.get("ansicht") === "kalender";
  const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("monat") ?? "") ? url.searchParams.get("monat")! : heute.slice(0, 7);
  const jahr = kalender ? Number(monat.slice(0, 4)) : jahrWahl(url.searchParams.get("jahr"));
  const von = kalender ? `${monat}-01` : `${jahr}-01-01`, bis = kalender ? new Date(Date.UTC(jahr, Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10) : `${jahr}-12-31`;
  const [p, k, a, land, b, at, landVon] = await Promise.all([
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status,bereich_id&order=vorname&limit=3000`),
    kalender ? Promise.resolve(null) : db<Konto[]>(f.s, env, `urlaubskonten?firma_id=eq.${firma}&jahr=eq.${jahr}&select=personal_id,jahr,anspruch,uebertrag&limit=3000`),
    db<Abw[]>(f.s, env, `personal_abwesenheiten?firma_id=eq.${firma}&von=lte.${bis}&bis=gte.${von}&select=personal_id,von,bis,grund,status&limit=10000`),
    landDerFirma(f.s, env, firma),
    kalender ? db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`) : Promise.resolve(null),
    kalender ? Promise.resolve(new Map<string, number[] | null>()) : arbeitstageLaden(f.s, env, firma),
    landJeBereich(f.s, env, firma),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  const kopf = hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : "";
  if (kalender) return antwort(kopf + kalenderSeite(p.ok ? p.daten : [], a.ok ? a.daten : [], { monat, land, heute, standort: /^[0-9a-f-]{36}$/.test(url.searchParams.get("standort") ?? "") ? url.searchParams.get("standort")! : "", standorte: b?.ok ? b.daten : [] }));
  return antwort(kopf + kontoSeite((p.ok ? p.daten : []).map((x) => ({ ...x, arbeitstage: at.get(x.id) ?? null })), k?.ok ? k.daten : [], a.ok ? a.daten : [], { jahr, land, darfAendern, landVon }));
}
