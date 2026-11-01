// N5: Auftraggeber-Seiten. Every contracting authority the firm had hits or offers with, or watches: own tenders and
// results, further notices and awards in the catalog, the contact point published in the notice and own contacts.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

type KatalogKurz = { auftraggeber: string; auftraggeber_id: string; ort: string };
export type EigenerVorgang = { id: string; titel: string; status: string; frist: string | null; erstellt: string; katalog_id?: string | null; vergabekatalog: KatalogKurz | null };
export type Kontakt = { id: string; auftraggeber_schluessel: string; name: string; funktion: string; telefon: string; email: string; notiz: string };
export type Bekanntmachung = { id: string; titel: string; status: string; frist: string | null; quell_datum: string; link: string; laufzeit_ende: string | null;
  zuschlaege: { datum: string | null; gewinner: string[]; wert: number | null; waehrung: string }[]; kontakt?: { name?: string; email?: string; telephone?: string; url?: string } | null };
export type Eintrag = { id: string; name: string; ort: string; vorgaenge: EigenerVorgang[]; beobachtet: boolean; kontakte: number; zuletzt: string };

const ANGEBOT = ["angebot", "abgegeben", "gewonnen", "verloren"];
export const STATUS_TEXT: Record<string, string> = { neu: "Neu", pruefen: "In Prüfung", angebot: "Angebot in Arbeit", abgegeben: "Abgegeben", gewonnen: "🏆 Zuschlag", verloren: "❌ Absage", verworfen: "Verworfen" };
const datum = (d: string | null) => d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "–";
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const ortKurz = (o: string) => o.replace(/ \(Auftraggeberadresse; Einsatzort prüfen\)$/, "").split(" · ")[0];

/** One entry per contracting authority from the firm's tenders (via the catalog) and the watched ones. */
export function sammeln(vorgaenge: EigenerVorgang[], abos: { auftraggeber_id: string; name: string }[], kontakte: Pick<Kontakt, "auftraggeber_schluessel">[]): Eintrag[] {
  const m = new Map<string, Eintrag>();
  for (const v of vorgaenge) {
    const k = v.vergabekatalog;
    if (!k) continue;
    const e = m.get(k.auftraggeber_id) ?? { id: k.auftraggeber_id, name: k.auftraggeber, ort: ortKurz(k.ort), vorgaenge: [], beobachtet: false, kontakte: 0, zuletzt: "" };
    e.vorgaenge.push(v);
    if (v.erstellt > e.zuletzt) e.zuletzt = v.erstellt;
    m.set(k.auftraggeber_id, e);
  }
  for (const a of abos) {
    const e = m.get(a.auftraggeber_id) ?? { id: a.auftraggeber_id, name: a.name, ort: "", vorgaenge: [], beobachtet: false, kontakte: 0, zuletzt: "" };
    e.beobachtet = true;
    m.set(a.auftraggeber_id, e);
  }
  for (const k of kontakte) { const e = m.get(k.auftraggeber_schluessel); if (e) e.kontakte++; }
  return [...m.values()].sort((a, b) => b.zuletzt.localeCompare(a.zuletzt) || a.name.localeCompare(b.name, "de"));
}

export function zahlen(v: EigenerVorgang[]) {
  const gewonnen = v.filter((x) => x.status === "gewonnen").length, verloren = v.filter((x) => x.status === "verloren").length;
  return { treffer: v.length, angebote: v.filter((x) => ANGEBOT.includes(x.status)).length, gewonnen, verloren, quote: gewonnen + verloren ? Math.round((gewonnen / (gewonnen + verloren)) * 100) : null };
}

export function listeSeite(eintraege: Eintrag[], q: string): string {
  const such = q.trim().toLowerCase();
  const gezeigt = such ? eintraege.filter((e) => `${e.name} ${e.ort}`.toLowerCase().includes(such)) : eintraege;
  const zeile = (e: Eintrag) => {
    const z = zahlen(e.vorgaenge);
    return `<a class="standort-zeile" href="/konto/auftraggeber?id=${encodeURIComponent(e.id)}"><span class="standort-icon" aria-hidden="true">🏛️</span><span class="standort-text"><strong>${escape(e.name)}</strong><span class="klein">${[e.ort && escape(e.ort), `${z.treffer} ${z.treffer === 1 ? "Ausschreibung" : "Ausschreibungen"}`, z.angebote ? `${z.angebote} ${z.angebote === 1 ? "Angebot" : "Angebote"}` : "", z.gewonnen ? `🏆 ${z.gewonnen}` : "", e.beobachtet ? "👁 beobachtet" : "", e.kontakte ? `📞 ${e.kontakte}` : ""].filter(Boolean).join(" · ")}</span></span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  };
  return `<form method="get" class="such-zeile"><label class="sr-only" for="ag-suche">Auftraggeber suchen</label><input id="ag-suche" name="q" value="${escape(q)}" placeholder="Auftraggeber oder Ort suchen" maxlength="100"><button>Suchen</button></form>
${gezeigt.length ? `<div class="standort-liste">${gezeigt.map(zeile).join("")}</div>` : `<p class="treffer-leer">${eintraege.length ? "Kein Auftraggeber passt zur Suche." : "Noch keine Auftraggeber. Sie erscheinen hier, sobald Jarvis Ausschreibungen für euch gefunden hat."}</p>`}
<p class="klein">Alle Auftraggeber eurer Treffer und Angebote und die, die ihr beobachtet. Neueste zuerst.</p>`;
}

export function detailSeite(e: { id: string; name: string; ort: string }, o: { vorgaenge: EigenerVorgang[]; katalog: Bekanntmachung[]; kontakte: Kontakt[]; beobachtet: boolean; admin: boolean; darfAendern: boolean; darfUebernehmen: boolean }): string {
  const z = zahlen(o.vorgaenge);
  const eigeneKatalog = new Set(o.vorgaenge.map((v) => v.katalog_id ?? "").filter(Boolean));
  const kennzahlen = `<div class="angebot-kennzahlen"><div><strong>${z.treffer}</strong><span>Ausschreibungen bei euch</span></div><div><strong>${z.angebote}</strong><span>Angebote</span></div><div><strong>${z.quote === null ? "–" : `${z.quote} %`}</strong><span>gewonnen${z.gewonnen + z.verloren ? ` (${z.gewonnen} von ${z.gewonnen + z.verloren})` : ""}</span></div></div>`;
  const beobachten = o.admin ? `<form method="post" action="/konto/auftraggeber" class="inline-form"><input type="hidden" name="id" value="${escape(e.id)}"><input type="hidden" name="name" value="${escape(e.name)}"><button name="aktion" value="${o.beobachtet ? "nicht_beobachten" : "beobachten"}" class="zweit"${o.beobachtet ? ' title="Tippen beendet die Beobachtung" aria-label="Beobachtet. Tippen beendet die Beobachtung."' : ""}>${o.beobachtet ? "👁 Beobachtet ✓" : "👁 Beobachten"}</button></form>` : o.beobachtet ? `<span class="radar-marke">👁 beobachtet</span>` : "";
  const eigene = o.vorgaenge.length ? `<ul class="angebot-liste">${[...o.vorgaenge].sort((a, b) => b.erstellt.localeCompare(a.erstellt)).map((v) => `<li class="angebot-zeile"><a href="/konto/vorgang/${v.id}" class="angebot-titel"><strong>${escape(v.titel)}</strong><span class="klein"><span class="stand-marke">${escape(STATUS_TEXT[v.status] ?? v.status)}</span> · ${v.frist ? `Frist ${datum(v.frist)}` : `gefunden ${datum(v.erstellt)}`}</span></a></li>`).join("")}</ul>` : `<p class="klein">Noch keine Ausschreibung dieses Auftraggebers bei euch.</p>`;
  const offen = o.katalog.filter((k) => ["offen", "unbekannt"].includes(k.status) && (!k.frist || Date.parse(k.frist) > Date.now()));
  const vergeben = o.katalog.filter((k) => k.zuschlaege.length);
  const katalogZeile = (k: Bekanntmachung) => `<li class="angebot-zeile"><a href="${escape(k.link)}" target="_blank" rel="noopener" class="angebot-titel"><strong>${escape(k.titel)}</strong><span class="klein">${k.zuschlaege.length ? k.zuschlaege.slice(0, 2).map((x) => `Zuschlag ${datum(x.datum)}${x.gewinner.length ? ` an ${escape(x.gewinner.join(", "))}` : ""}${x.wert ? ` · ${euro(x.wert)}` : ""}`).join(" · ") : `veröffentlicht ${datum(k.quell_datum)}${k.frist ? ` · Frist ${datum(k.frist)}` : ""}`}${k.laufzeit_ende ? ` · Vertrag bis ${datum(k.laufzeit_ende)}` : ""}</span></a>${!k.zuschlaege.length && o.darfUebernehmen ? `<form method="post" action="/konto/markt/uebernehmen"><input type="hidden" name="id" value="${escape(k.id)}"><button class="zweit">Übernehmen</button></form>` : ""}</li>`;
  const veroeffentlicht = o.katalog.find((k) => k.kontakt && (k.kontakt.name || k.kontakt.email || k.kontakt.telephone))?.kontakt;
  const kontaktForm = o.darfAendern ? `<details class="termin-neu"><summary>➕ Ansprechpartner eintragen</summary><form method="post" action="/konto/auftraggeber"><input type="hidden" name="id" value="${escape(e.id)}"><input type="hidden" name="aktion" value="kontakt"><div class="aueg-form">
<label>Name<input name="kname" required maxlength="200"></label><label>Funktion<input name="funktion" maxlength="200" placeholder="z. B. Vergabestelle"></label>
<label>Telefon<input name="telefon" type="tel" maxlength="60"></label><label>E-Mail<input name="email" type="email" maxlength="200"></label>
<label class="ganz">Notiz<input name="notiz" maxlength="1000" placeholder="z. B. Bieterfragen nur schriftlich"></label></div><button>Speichern</button></form></details>` : "";
  const kontakte = `${o.kontakte.length ? `<ul class="kontakt-liste">${o.kontakte.map((k) => `<li><div><strong>${escape(k.name)}</strong>${k.funktion ? ` <span class="klein">${escape(k.funktion)}</span>` : ""}<span class="klein">${[k.telefon && `📞 <a href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">${escape(k.telefon)}</a>`, k.email && `✉️ <a href="mailto:${escape(k.email)}">${escape(k.email)}</a>`].filter(Boolean).join(" · ")}</span>${k.notiz ? `<span class="klein">📝 ${escape(k.notiz)}</span>` : ""}</div>${o.darfAendern ? `<form method="post" action="/konto/auftraggeber"><input type="hidden" name="id" value="${escape(e.id)}"><input type="hidden" name="loeschen" value="${k.id}"><button class="zweit" aria-label="${escape(k.name)} löschen">Löschen</button></form>` : ""}</li>`).join("")}</ul>` : ""}
${veroeffentlicht ? `<p class="klein">Aus der Bekanntmachung: ${[veroeffentlicht.name && escape(veroeffentlicht.name), veroeffentlicht.telephone && `📞 ${escape(veroeffentlicht.telephone)}`, veroeffentlicht.email && `✉️ <a href="mailto:${escape(veroeffentlicht.email)}">${escape(veroeffentlicht.email)}</a>`].filter(Boolean).join(" · ")}</p>` : ""}${kontaktForm}`;
  return `<div class="ag-kopf"><div><h2>${escape(e.name)}</h2>${e.ort ? `<p class="klein">📍 ${escape(e.ort)}</p>` : ""}</div>${beobachten}</div>
${kennzahlen}
<h2>Eure Ausschreibungen</h2>${eigene}
<h2>Ansprechpartner</h2>${kontakte || `<p class="klein">Noch keine Ansprechpartner.</p>`}
${offen.filter((k) => !eigeneKatalog.has(k.id)).length ? `<h2>Gerade offen</h2><ul class="angebot-liste">${offen.filter((k) => !eigeneKatalog.has(k.id)).map(katalogZeile).join("")}</ul>` : ""}
${vergeben.length ? `<h2>Vergeben</h2><ul class="angebot-liste">${vergeben.slice(0, 15).map(katalogZeile).join("")}</ul>` : ""}
<p class="klein">Bekanntmachungen und Zuschläge aus dem gemeinsamen Vergabekatalog (Bekanntmachungsservice, CC0). Ansprechpartner sieht nur eure Firma.</p>`;
}

export async function auftraggeberSeite(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/auftraggeber") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  const zurueck = `<p class="konto-zurueck"><a href="${url.searchParams.get("id") ? "/konto/auftraggeber" : "/konto/einstellungen"}" aria-label="Zurück">←</a></p>`;
  const antwort = (text: string, status = 200) => html(seite("Auftraggeber", `${zurueck}${text}`, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Auftraggeber sieht das Büroteam.</p>", 403);
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const id = String(form.get("id") ?? "").slice(0, 400), aktion = String(form.get("aktion") ?? "");
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    let hinweis = "Das ging nicht.";
    if (id.length >= 3 && (aktion === "beobachten" || aktion === "nicht_beobachten") && f.admin) {
      const r = aktion === "beobachten"
        ? await db(f.s, env, "auftraggeber_abos?on_conflict=firma_id,auftraggeber_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, auftraggeber_id: id, name: t("name", 500) || id }) })
        : await db(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&auftraggeber_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      hinweis = r.ok ? (aktion === "beobachten" ? "Wird beobachtet: neue Ausschreibungen landen bei euren Treffern." : "Beobachtung beendet.") : "Speichern hat nicht geklappt.";
    } else if (id.length >= 3 && aktion === "kontakt" && darfAendern) {
      const email = t("email", 200);
      if (t("kname", 200).length < 2 || (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) hinweis = "Bitte einen Namen und eine gültige E-Mail angeben.";
      else {
        const r = await db(f.s, env, "auftraggeber_kontakte", { method: "POST", body: JSON.stringify({ firma_id: firma, auftraggeber_schluessel: id, name: t("kname", 200), funktion: t("funktion", 200), telefon: t("telefon", 60), email, notiz: t("notiz", 1000) }) });
        hinweis = r.ok ? "Ansprechpartner gespeichert." : "Speichern hat nicht geklappt.";
      }
    } else if (/^[0-9a-f-]{36}$/.test(String(form.get("loeschen") ?? "")) && darfAendern) {
      const r = await db(f.s, env, `auftraggeber_kontakte?id=eq.${form.get("loeschen")}&firma_id=eq.${firma}`, { method: "DELETE" });
      hinweis = r.ok ? "Ansprechpartner gelöscht." : "Löschen hat nicht geklappt.";
    }
    return weiterleiten(`/konto/auftraggeber?id=${encodeURIComponent(id)}&hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
  }
  const hinweis = url.searchParams.get("hinweis");
  const kopf = hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : "";
  const id = (url.searchParams.get("id") ?? "").slice(0, 400);
  const sel = "id,titel,status,frist,erstellt,katalog_id,vergabekatalog(auftraggeber,auftraggeber_id,ort)";
  if (!id) {
    const [v, abos, kontakte] = await Promise.all([
      db<EigenerVorgang[]>(f.s, env, `vorgaenge?firma_id=eq.${firma}&katalog_id=not.is.null&select=${sel}&order=erstellt.desc&limit=2000`),
      db<{ auftraggeber_id: string; name: string }[]>(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&select=auftraggeber_id,name`),
      db<Kontakt[]>(f.s, env, `auftraggeber_kontakte?firma_id=eq.${firma}&select=auftraggeber_schluessel&limit=5000`),
    ]);
    if (!v.ok) return antwort(`${kopf}<p class="fehler">Die Auftraggeber konnten nicht geladen werden.</p>`, 502);
    return antwort(kopf + listeSeite(sammeln(v.daten, abos.ok ? abos.daten : [], kontakte.ok ? kontakte.daten : []), url.searchParams.get("q") ?? ""));
  }
  const enc = encodeURIComponent(id);
  const [katalog, v, kontakte, abo] = await Promise.all([
    db<(Bekanntmachung & { auftraggeber: string; ort: string })[]>(f.s, env, `vergabekatalog?auftraggeber_id=eq.${enc}&select=id,titel,status,frist,quell_datum,link,laufzeit_ende,zuschlaege,auftraggeber,ort,kontakt:roh->buyer->contactPoint&order=quell_datum.desc&limit=40`),
    db<EigenerVorgang[]>(f.s, env, `vorgaenge?firma_id=eq.${firma}&select=${sel.replace("vergabekatalog(", "vergabekatalog!inner(")}&vergabekatalog.auftraggeber_id=eq.${enc}&order=erstellt.desc&limit=300`),
    db<Kontakt[]>(f.s, env, `auftraggeber_kontakte?firma_id=eq.${firma}&auftraggeber_schluessel=eq.${enc}&select=id,auftraggeber_schluessel,name,funktion,telefon,email,notiz&order=erstellt`),
    db<{ name: string }[]>(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&auftraggeber_id=eq.${enc}&select=name`),
  ]);
  const k0 = katalog.ok ? katalog.daten[0] : undefined;
  const name = k0?.auftraggeber ?? (abo.ok ? abo.daten[0]?.name : undefined);
  if (!name) return antwort(`${kopf}<p class="treffer-leer">Diesen Auftraggeber gibt es im Katalog nicht (mehr).</p>`, 404);
  return antwort(kopf + detailSeite({ id, name, ort: k0 ? ortKurz(k0.ort) : "" }, {
    vorgaenge: v.ok ? v.daten : [], katalog: katalog.ok ? katalog.daten : [], kontakte: kontakte.ok ? kontakte.daten : [],
    beobachtet: abo.ok && abo.daten.length > 0, admin: f.admin, darfAendern, darfUebernehmen: ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle),
  }));
}
