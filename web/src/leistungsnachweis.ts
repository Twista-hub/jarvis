// T29: Leistungsnachweis. Approved hours per customer and month as a Word file for the customer's signature
// (basis for the invoice in temporary work), with night/Sunday/holiday hours (T30) and, with finance access, the amount.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { absatz, bild, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";
import type { Freigabe } from "./kundenlink.ts";
import { schluessel } from "./unterschrift.ts";
import { mitLand, einsatzLaender, dezimal, landDerFirma, minuten, naechsterMonat, stunden, vorMonat, type Eintrag } from "./stunden.ts";
import { summe, zuschlag, zuschlagText } from "./zuschlaege.ts";
import { adresse, type Kunde } from "./kunden.ts";

type Person = { id: string; vorname: string; nachname: string };
export type Gruppe = { schluessel: string; titel: string; kunde: Kunde | null; eintraege: Eintrag[]; offen: number };
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Group a month's entries by customer (assigned customer, else the assignment text). Rejected entries do not count. */
export function gruppieren(liste: Eintrag[], kunden: Kunde[]): Gruppe[] {
  const m = new Map<string, Gruppe>();
  for (const e of liste.filter((x) => x.status !== "abgelehnt")) {
    const k = e.kunde_id ? kunden.find((x) => x.id === e.kunde_id) ?? null : null;
    const schluessel = k ? `k:${k.id}` : `e:${(e.einsatz || "").trim().toLowerCase()}`;
    const g = m.get(schluessel) ?? { schluessel, titel: k?.name ?? (e.einsatz.trim() || "ohne Einsatz"), kunde: k, eintraege: [], offen: 0 };
    if (e.status === "freigegeben") g.eintraege.push(e); else g.offen++;
    m.set(schluessel, g);
  }
  return [...m.values()].sort((a, b) => Number(!a.kunde) - Number(!b.kunde) || a.titel.localeCompare(b.titel, "de"));
}

const link = (monat: string, g: Gruppe) => `/konto/leistungsnachweis.docx?monat=${monat}&${g.kunde ? `kunde=${g.kunde.id}` : `einsatz=${encodeURIComponent(g.titel)}`}`;

export function nachweisSeite(gruppen: Gruppe[], o: { monat: string; land: string; saetze: Record<string, number> | null; freigaben?: Freigabe[]; darfAendern?: boolean }): string {
  const freigabe = (g: Gruppe) => (o.freigaben ?? []).filter((x) => g.kunde ? x.kunde_id === g.kunde.id : !x.kunde_id && x.einsatz === g.titel.toLowerCase()).sort((a, b) => b.erstellt.localeCompare(a.erstellt))[0];
  const status = (g: Gruppe) => { const x = freigabe(g); if (!x) return ""; const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
    return `<span class="klein nachweis-status ${x.bestaetigt_am ? (x.rueckfrage ? "frage" : "ok") : ""}">${x.bestaetigt_am ? `${x.rueckfrage ? "❓ Rückfrage" : "✅ Bestätigt"} von ${escape(x.bestaetigt_name)} am ${zeit(x.bestaetigt_am)}${x.unterschrift ? " ✍️" : ""}${x.anmerkung ? `: „${escape(x.anmerkung)}“` : ""}` : Date.parse(x.gueltig_bis) < Date.now() ? "⌛ Link abgelaufen, nicht bestätigt" : `🔗 Link seit ${zeit(x.erstellt)} beim Kunden, noch nicht bestätigt`}</span>`; };
  const karte = (g: Gruppe) => {
    const min = g.eintraege.reduce((s, e) => s + minuten(e), 0), z = summe(g.eintraege.map((e) => zuschlag(e, o.land)));
    const satz = g.kunde && o.saetze ? o.saetze[g.kunde.id] : undefined;
    return `<li class="${g.offen ? "bald" : ""}"><div><strong>${g.kunde ? "🏢 " : ""}${escape(g.titel)}</strong><span class="klein">${stunden(min)} Std. freigegeben · ${new Set(g.eintraege.map((e) => e.personal_id)).size} ${new Set(g.eintraege.map((e) => e.personal_id)).size === 1 ? "Person" : "Personen"}${zuschlagText(z) ? ` · ${zuschlagText(z)}` : ""}${satz !== undefined ? ` · 💶 ${euro(dezimal(min) * satz)} netto` : ""}${g.offen ? ` · ⏳ ${g.offen} noch nicht freigegeben` : ""}${g.kunde ? "" : " · ohne Kundenzuordnung"}</span></div>${g.eintraege.length ? `<span class="nachweis-knoepfe"><a class="knopf zweit" href="${link(o.monat, g)}" download>📄 Word</a>${o.darfAendern ? `<form method="post" action="/konto/leistungsnachweis/link"><input type="hidden" name="monat" value="${o.monat}">${g.kunde ? `<input type="hidden" name="kunde" value="${g.kunde.id}">` : `<input type="hidden" name="einsatz" value="${escape(g.titel)}">`}<button class="zweit">🔗 Link</button></form>` : ""}${satz !== undefined && g.kunde ? `<form method="post" action="/konto/rechnungen"><input type="hidden" name="monat" value="${o.monat}"><input type="hidden" name="kunde" value="${g.kunde.id}"><button class="zweit">🧾 Rechnung</button></form>` : ""}</span>` : ""}${status(g)}</li>`;
  };
  return `<nav class="dispo-nav"><a class="knopf zweit" href="/konto/leistungsnachweis?monat=${vorMonat(o.monat)}" aria-label="Vormonat">‹</a><strong>${monatName(o.monat)}</strong><a class="knopf zweit" href="/konto/leistungsnachweis?monat=${naechsterMonat(o.monat)}" aria-label="Nächster Monat">›</a></nav>
<p class="klein">Pro Kunde ein Stundennachweis mit allen freigegebenen Stunden des Monats, Zuschlagsstunden und Unterschriftsfeld für den Kunden. Noch offene Stunden gib vorher unter <a href="/konto/stunden?monat=${o.monat}">Stundenzettel</a> frei.</p>
${gruppen.length ? `<ul class="kontakt-liste nachweis-liste">${gruppen.map(karte).join("")}</ul>` : `<p class="treffer-leer">Keine Stunden in diesem Monat.</p>`}
${gruppen.some((g) => !g.kunde) ? `<p class="klein">Einträge „ohne Kundenzuordnung“ ordnet Jarvis zu, sobald es unter <a href="/konto/kunden">Kunden &amp; Einsatzorte</a> einen Kunden oder Einsatzort mit genau diesem Namen gibt.</p>` : ""}`;
}

export function nachweisDocx(g: Gruppe, personen: Person[], o: { monat: string; land: string; firma: { name: string; strasse: string; plz: string; ort: string }; satz?: number; bestaetigung?: { name: string; am: string; anmerkung: string; png: Uint8Array | null } }): Uint8Array {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : ""; };
  const l = [...g.eintraege].sort((a, b) => a.datum.localeCompare(b.datum) || name(a.personal_id).localeCompare(name(b.personal_id), "de") || a.beginn.localeCompare(b.beginn));
  const h = (min: number) => min ? zahl(dezimal(min)) : "";
  const zeilen = l.map((e) => { const z = zuschlag(e, o.land); return [tag(e.datum), name(e.personal_id), `${e.beginn.slice(0, 5)}–${e.ende.slice(0, 5)}`, e.pause_min ? String(e.pause_min) : "", zahl(dezimal(minuten(e))), h(z.nacht), h(z.sonntag), h(z.feiertag)]; });
  const min = l.reduce((s, e) => s + minuten(e), 0), z = summe(l.map((e) => zuschlag(e, o.land)));
  const proPerson = [...new Set(l.map((e) => e.personal_id))].map((pid) => { const x = l.filter((e) => e.personal_id === pid); const zz = summe(x.map((e) => zuschlag(e, o.land))); return [name(pid), zahl(dezimal(x.reduce((s, e) => s + minuten(e), 0))), h(zz.nacht), h(zz.sonntag), h(zz.feiertag)]; });
  const kundeText = g.kunde ? [g.kunde.name, adresse(g.kunde), g.kunde.ansprechpartner ? `z. Hd. ${g.kunde.ansprechpartner}` : ""].filter(Boolean).join("\n") : g.titel;
  return wordDokument(ueberschrift(`Leistungsnachweis ${monatName(o.monat)}`, 30)
    + tabelle([["Auftragnehmer", "Kunde / Einsatz"], [[o.firma.name, adresse(o.firma)].filter(Boolean).join("\n"), kundeText]], [4800, 4800], true)
    + absatz("", { abstand: 120 })
    + tabelle([["Datum", "Mitarbeiter/in", "Zeit", "Pause (Min.)", "Std.", "Nacht", "Sonntag", "Feiertag"], ...zeilen, ["Summe", "", "", "", zahl(dezimal(min)), h(z.nacht), h(z.sonntag), h(z.feiertag)]], [1150, 2300, 1350, 950, 900, 950, 1000, 1000], true)
    + absatz("Nacht = 23–6 Uhr, Sonntag und gesetzliche Feiertage (bereits in den Stunden enthalten). Pausen sind abgezogen.", { grau: true, groesse: 16, abstand: 160 })
    + (proPerson.length > 1 ? ueberschrift("Summe pro Person", 22) + tabelle([["Mitarbeiter/in", "Std.", "Nacht", "Sonntag", "Feiertag"], ...proPerson], [3600, 1500, 1500, 1500, 1500], true) + absatz("", { abstand: 120 }) : "")
    + (o.satz !== undefined ? absatz(`Verrechnung: ${zahl(dezimal(min))} Std. × ${euro(o.satz)} = ${euro(dezimal(min) * o.satz)} netto (Zuschläge laut Vertrag zusätzlich)`, { fett: true, abstand: 200 }) : "")
    + absatz("Die oben aufgeführten Stunden wurden ordnungsgemäß erbracht.", { abstand: o.bestaetigung ? 200 : 500 })
    + (o.bestaetigung ? (o.bestaetigung.png ? bild(1, 6, 1.8) : "") + absatz(`Online bestätigt von ${o.bestaetigung.name} am ${new Date(o.bestaetigung.am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} Uhr${o.bestaetigung.anmerkung ? `\nAnmerkung: ${o.bestaetigung.anmerkung}` : ""}`, { fett: true, abstand: 200 })
      : absatz("______________________________          ______________________________\nOrt, Datum, Unterschrift Kunde                         Unterschrift Auftragnehmer", { abstand: 200 })),
    o.bestaetigung?.png ? [{ id: 1, png: o.bestaetigung.png }] : []);
}

export async function leistungsnachweis(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/leistungsnachweis" && url.pathname !== "/konto/leistungsnachweis.docx") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Leistungsnachweis", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("monat") ?? "") ? url.searchParams.get("monat")! : heute.slice(0, 7);
  const [l, k, p, land, pr, fi, fg] = await Promise.all([
    db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status,kunde_id&order=datum,beginn&limit=10000`),
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz&limit=1000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=3000`),
    landDerFirma(f.s, env, firma),
    f.finanzen ? db<{ kunde_id: string; satz: number | string }[]>(f.s, env, `kunden_preise?firma_id=eq.${firma}&select=kunde_id,satz&limit=1000`) : Promise.resolve(null),
    db<{ name: string; strasse: string | null; plz: string | null; ort: string | null }[]>(f.s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort`),
    db<Freigabe[]>(f.s, env, `nachweis_freigaben?firma_id=eq.${firma}&monat=eq.${monat}&select=id,kunde_id,einsatz,monat,titel,bestaetigt_am,bestaetigt_name,anmerkung,rueckfrage,unterschrift,gueltig_bis,erstellt&order=erstellt.desc&limit=500`),
  ]);
  if (l.ok) l.daten = mitLand(l.daten, await einsatzLaender(f.s, env, firma));
  const freigaben = fg.ok ? fg.daten : [];
  const gruppen = gruppieren(l.ok ? l.daten : [], k.ok ? k.daten : []);
  const saetze = pr?.ok ? Object.fromEntries(pr.daten.map((x) => [x.kunde_id, Number(x.satz)])) : null;
  if (url.pathname.endsWith(".docx")) {
    const kid = url.searchParams.get("kunde"), einsatz = (url.searchParams.get("einsatz") ?? "").trim().toLowerCase();
    const g = gruppen.find((x) => kid ? x.kunde?.id === kid : x.schluessel === `e:${einsatz}`);
    if (!g || !g.eintraege.length) return antwort("<p>Für diesen Kunden gibt es in dem Monat keine freigegebenen Stunden.</p>", 404);
    const fr = fi.ok ? fi.daten[0] : undefined;
    const fx = freigaben.filter((x) => x.bestaetigt_am && !x.rueckfrage && (g.kunde ? x.kunde_id === g.kunde.id : !x.kunde_id && x.einsatz === g.titel.toLowerCase()))[0];
    const png = fx?.unterschrift ? await env.DATEN?.get(schluessel.kunde(firma, fx.id)).then((o) => o ? o.arrayBuffer() : null) : null;
    const datei = nachweisDocx(g, p.ok ? p.daten : [], { monat, land, firma: { name: fr?.name ?? "", strasse: fr?.strasse ?? "", plz: fr?.plz ?? "", ort: fr?.ort ?? "" }, satz: g.kunde && saetze ? saetze[g.kunde.id] : undefined, bestaetigung: fx ? { name: fx.bestaetigt_name, am: fx.bestaetigt_am!, anmerkung: fx.anmerkung, png: png ? new Uint8Array(png) : null } : undefined });
    return wordAntwort(datei, `Leistungsnachweis_${g.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 40)}_${monat}.docx`, f.s.cookies);
  }
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${nachweisSeite(gruppen, { monat, land, saetze, freigaben, darfAendern: ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle) })}`);
}
