// Idea 40 (docs/ideen-arbeitsoberflaeche.md): customer portal. One secret link per customer (only the hash is stored).
// The customer sees service records (sums only, no staff names), invoices if someone with finance access switched them
// on, patrol counts and incidents for their sites if switched on, and can report defects, wishes or praise.
// Jarvis sends nothing itself; the office passes the link on (WhatsApp/e-mail buttons open the own app).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { sha256hex, zufallsToken } from "./kundenlink.ts";
import { zahlstatus, type Rechnung } from "./rechnungen.ts";
import { escape, seite } from "./seite.ts";
import { euro } from "./spesen.ts";

export type PortalDaten = {
  firma: string; kunde: string; kleinunternehmer: boolean;
  nachweise: { monat: string; titel: string; summe: { std?: number } | null; bestaetigt_am: string | null; rueckfrage: boolean; abgelaufen: boolean }[];
  rechnungen: { nummer: string; datum: string; monat: string; netto: number | string; ust_satz: number | string; bezahlt_am: string | null; zahlungsziel_tage: number | null; ust_betrag?: number | string | null; kleinunternehmer?: boolean | null; art?: string; bezug_nummer?: string; storniert?: boolean }[] | null;
  orte: { name: string; scans: number; letzter: string | null }[] | null;
  vorfaelle: { zeit: string; ort: string }[] | null;
  meldungen: { art: string; text: string; erstellt: string; erledigt_am: string | null }[];
};
export const ARTEN: Record<string, string> = { mangel: "⚠️ Mangel", wunsch: "💬 Wunsch", lob: "👍 Lob" };
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const datum = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const zeitpunkt = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
const stunden = (n: number | undefined) => (n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Public page for the customer. */
export function portalSeite(d: PortalDaten, token: string, heute: string, hinweis = ""): string {
  const nachweise = d.nachweise.length ? `<ul class="kontakt-liste">${d.nachweise.map((n) => `<li><div><strong>${monatName(n.monat)} · ${escape(n.titel)}</strong><span class="klein">${stunden(n.summe?.std)} Std. · ${n.bestaetigt_am ? n.rueckfrage ? `❓ Rückfrage am ${datum(n.bestaetigt_am)}` : `✅ bestätigt am ${datum(n.bestaetigt_am)}` : n.abgelaufen ? "Link abgelaufen" : "⏳ wartet auf Ihre Bestätigung (Link per Nachricht)"}</span></div></li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Leistungsnachweise.</p>`;
  const rechnungen = d.rechnungen === null ? "" : `<h2>💶 Rechnungen</h2>${d.rechnungen.length ? `<ul class="kontakt-liste">${d.rechnungen.map((r) => {
    const satz = (r.kleinunternehmer ?? d.kleinunternehmer) ? 0 : Number(r.ust_satz);
    const brutto = r.ust_betrag !== null && r.ust_betrag !== undefined ? Number(r.netto) + Number(r.ust_betrag) : Math.round(Number(r.netto) * (100 + satz)) / 100;
    const z = zahlstatus({ datum: r.datum, bezahlt_am: r.bezahlt_am, zahlungsziel_tage: r.zahlungsziel_tage ?? 14, art: r.art === "storno" ? "storno" : "rechnung", storniert_durch: r.storniert ? "x" : null } as Rechnung, heute);
    const stand = r.art === "storno" ? `↩︎ Storno zu ${escape(r.bezug_nummer ?? "")}` : z.art === "storniert" ? "↩︎ storniert" : z.art === "bezahlt" ? "✅ bezahlt" : z.art === "ueberfaellig" ? `⏰ fällig seit ${datum(z.faellig)}` : `offen, fällig ${datum(z.faellig)}`;
    return `<li><div><strong>${escape(r.nummer)} · ${euro(brutto)}</strong><span class="klein">${datum(r.datum)} · ${monatName(r.monat)} · ${stand}</span></div></li>`;
  }).join("")}</ul><p class="klein">Rechnungen erhalten Sie weiterhin direkt von ${escape(d.firma)}.</p>` : `<p class="treffer-leer">Noch keine Rechnungen.</p>`}`;
  const berichte = d.orte === null ? "" : `<h2>🛡️ Kontrollgänge</h2>${d.orte.length ? `<table class="tabelle"><thead><tr><th>Objekt</th><th>Scans (14 Tage)</th><th>Letzter Kontrollgang</th></tr></thead><tbody>${d.orte.map((o) => `<tr><td>${escape(o.name)}</td><td>${o.scans}</td><td>${o.letzter ? zeitpunkt(o.letzter) : "–"}</td></tr>`).join("")}</tbody></table>` : `<p class="treffer-leer">Keine Objekte hinterlegt.</p>`}
${d.vorfaelle?.length ? `<h3>Vorfälle (30 Tage)</h3><ul class="kontakt-liste">${d.vorfaelle.map((v) => `<li><div><strong>${zeitpunkt(v.zeit)} · ${escape(v.ort)}</strong></div></li>`).join("")}</ul><p class="klein">Einzelheiten zu Vorfällen erhalten Sie direkt von ${escape(d.firma)}.</p>` : ""}`;
  return `${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}<p class="klein">Kundenbereich von <strong>${escape(d.firma)}</strong></p><h2>${escape(d.kunde)}</h2>
<h2>🧾 Leistungsnachweise</h2>${nachweise}${rechnungen}${berichte}
<h2>📣 Etwas melden</h2><form method="post" action="/portal/${encodeURIComponent(token)}"><div class="aueg-form"><label>Art<select name="art">${Object.entries(ARTEN).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label><label>Ihr Name (freiwillig)<input name="name" maxlength="120" autocomplete="name"></label>
<label class="ganz">Nachricht<textarea name="text" required minlength="3" maxlength="2000" rows="3" placeholder="z. B. Mülleimer in Halle 3 nicht geleert"></textarea></label></div><button>Senden</button>
<p class="klein">${escape(d.firma)} bekommt Ihre Nachricht sofort aufs Handy. Gespeichert werden Art, Text, Name und Zeitpunkt.</p></form>
${d.meldungen.length ? `<h3>Ihre letzten Meldungen</h3><ul class="kontakt-liste">${d.meldungen.map((m) => `<li><div><strong>${ARTEN[m.art] ?? ""} · ${zeitpunkt(m.erstellt)}</strong><span class="klein">${escape(m.text)} · ${m.erledigt_am ? `✅ erledigt am ${datum(m.erledigt_am)}` : "⏳ in Bearbeitung"}</span></div></li>`).join("")}</ul>` : ""}`;
}

type Portal = { id: string; kunde_id: string; aktiv: boolean; rechnungen_zeigen: boolean; berichte_zeigen: boolean; erstellt: string; gueltig_bis?: string };
type Meldung = { id: string; kunde_id: string; art: string; text: string; name: string; erstellt: string; erledigt_am: string | null };
type KundeKurz = { id: string; name: string };

/** Office page: portal per customer and the reports from customers. */
export function portalVerwaltung(kunden: KundeKurz[], portale: Portal[], meldungen: Meldung[], o: { darf: boolean; finanzen: boolean }): string {
  const name = (id: string) => kunden.find((k) => k.id === id)?.name ?? "?";
  const offen = meldungen.filter((m) => !m.erledigt_am);
  const schalter = (p: Portal, feld: "rechnungen" | "berichte", text: string, an: boolean, erlaubt: boolean) => erlaubt ? `<form method="post" action="/konto/kundenportal"><input type="hidden" name="portal" value="${p.id}"><input type="hidden" name="${feld}" value="${an ? "0" : "1"}"><button class="zweit" aria-pressed="${an}">${an ? "✓" : "○"} ${text}</button></form>` : `<span class="klein">${an ? "✓" : "○"} ${text}</span>`;
  const zeile = (k: KundeKurz) => {
    const p = portale.find((x) => x.kunde_id === k.id);
    const knoepfe = !o.darf ? "" : p ? `${schalter(p, "rechnungen", "Rechnungen", p.rechnungen_zeigen, o.finanzen)}${schalter(p, "berichte", "Kontrollgänge &amp; Vorfälle", p.berichte_zeigen, true)}<form method="post" action="/konto/kundenportal"><input type="hidden" name="neu" value="${k.id}"><button class="zweit" title="Neuer Link, der alte gilt dann nicht mehr">🔄 Neuer Link</button></form><form method="post" action="/konto/kundenportal"><input type="hidden" name="portal" value="${p.id}"><input type="hidden" name="aktiv" value="${p.aktiv ? "0" : "1"}"><button class="zweit">${p.aktiv ? "⛔ Sperren" : "✅ Freigeben"}</button></form>` : `<form method="post" action="/konto/kundenportal"><input type="hidden" name="neu" value="${k.id}"><button>🔗 Portal-Link erstellen</button></form>`;
    return `<li><div><strong>${escape(k.name)}</strong><span class="klein">${p ? p.aktiv ? `Portal aktiv seit ${datum(p.erstellt)}${p.gueltig_bis ? `, gültig bis ${datum(p.gueltig_bis)}` : ""}` : "⛔ gesperrt oder abgelaufen" : "kein Portal"}</span></div><span class="knopf-zeile">${knoepfe}</span></li>`;
  };
  return `<p class="klein">Jeder Kunde bekommt einen geheimen Link (ohne Anmeldung). Dort sieht er seine Leistungsnachweise (nur Summen, keine Namen), auf Wunsch Rechnungen und Kontrollgänge und kann Mängel, Wünsche oder Lob melden. Jarvis verschickt den Link nicht selbst. Bitte die Kundendaten-Verarbeitung im Vertrag mit dem Kunden regeln.</p>
<h2>📣 Meldungen von Kunden ${offen.length ? `<span class="klein">(${offen.length} offen)</span>` : ""}</h2>
${meldungen.length ? `<ul class="kontakt-liste">${meldungen.map((m) => `<li class="${m.erledigt_am ? "" : m.art === "mangel" ? "abgelaufen" : "bald"}"><div><strong>${ARTEN[m.art] ?? ""} · ${escape(name(m.kunde_id))}</strong><span class="klein">${zeitpunkt(m.erstellt)}${m.name ? ` · ${escape(m.name)}` : ""} · ${escape(m.text)}${m.erledigt_am ? ` · ✅ erledigt ${datum(m.erledigt_am)}` : ""}</span></div>${o.darf ? `<form method="post" action="/konto/kundenportal"><input type="hidden" name="${m.erledigt_am ? "wieder" : "erledigt"}" value="${m.id}"><button class="zweit">${m.erledigt_am ? "↩︎ Wieder offen" : "✓ Erledigt"}</button></form>` : ""}</li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Meldungen.</p>`}
<h2>🔗 Portale je Kunde</h2>${kunden.length ? `<ul class="kontakt-liste">${kunden.map(zeile).join("")}</ul>` : `<p class="treffer-leer">Lege zuerst unter <a href="/konto/kunden">Kunden &amp; Einsatzorte</a> Kunden an.</p>`}`;
}

const anon = (env: KontoEnv, fn: string, body: unknown) => fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });

export async function kundenportal(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/portal\/([A-Za-z0-9_-]{20,64})$/);
  if (m) return portalOeffentlich(request, env, m[1]);
  if (url.pathname !== "/konto/kundenportal") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Kunden-Portal", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich", f.s.cookies);
  const firma = f.m.firma_id;
  const darf = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const id = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    const zurueck = (h: string) => weiterleiten(`/konto/kundenportal?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darf) return zurueck("Ändern dürfen Bearbeiter und Admins.");
    if (id("neu")) {
      const kid = id("neu"), token = zufallsToken(), hash = await sha256hex(token);
      const k = await db<{ id: string; name: string; telefon: string; email: string }[]>(f.s, env, `kunden?id=eq.${kid}&firma_id=eq.${firma}&select=id,name,telefon,email`);
      const kunde = k.ok ? k.daten[0] : undefined;
      if (!kunde) return zurueck("Kunde nicht gefunden.");
      const r = await db(f.s, env, "kunden_portale?on_conflict=kunde_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ firma_id: firma, kunde_id: kid, token_hash: hash, aktiv: true, gueltig_bis: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10) }) });
      if (!r.ok) return zurueck("Link konnte nicht erstellt werden.");
      const link = new URL(`/portal/${token}`, request.url).toString();
      const text = `Ihr Kundenbereich bei ${f.m.firmen?.name || "uns"}: Leistungsnachweise ansehen und Anliegen melden: ${link}`;
      const tel = kunde.telefon.replace(/[^\d+]/g, "").replace(/^0/, "49").replace(/^\+/, "");
      return antwort(`<p>Portal-Link für <strong>${escape(kunde.name)}</strong>. Er wird nur jetzt angezeigt und gilt 12 Monate; ein früherer Link gilt nicht mehr.</p><label>Link<input readonly value="${escape(link)}"></label>
<div class="knopf-zeile teilen"><a class="knopf" href="https://wa.me/${tel}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="knopf zweit" href="mailto:${escape(kunde.email)}?subject=${encodeURIComponent("Ihr Kundenbereich")}&body=${encodeURIComponent(text)}">E-Mail</a></div>
<p class="klein">Jarvis verschickt den Link nicht selbst. Wer den Link hat, sieht den Kundenbereich; bitte nur an den Kunden geben. Bei Verdacht: „🔄 Neuer Link“ oder „⛔ Sperren“.</p><p><a href="/konto/kundenportal">← Zurück zur Übersicht</a></p>`);
    }
    const portal = id("portal");
    if (portal) {
      const daten: Record<string, boolean> = {};
      for (const [feld, spalte] of [["rechnungen", "rechnungen_zeigen"], ["berichte", "berichte_zeigen"], ["aktiv", "aktiv"]] as const) if (form.has(feld)) daten[spalte] = form.get(feld) === "1";
      if (daten.rechnungen_zeigen && !f.finanzen) return zurueck("Rechnungen freigeben dürfen Personen mit Finanzfreigabe.");
      if (!Object.keys(daten).length) return zurueck("Nichts geändert.");
      const r = await db<{ id: string }[]>(f.s, env, `kunden_portale?id=eq.${portal}&firma_id=eq.${firma}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(daten) });
      return zurueck(r.ok && r.daten.length ? "Gespeichert." : "Speichern hat nicht geklappt.");
    }
    for (const [feld, wert, text] of [["erledigt", new Date().toISOString(), "Als erledigt markiert."], ["wieder", null, "Wieder offen."]] as const) {
      const mid = id(feld);
      if (mid) { const r = await db<{ id: string }[]>(f.s, env, `kunden_meldungen?id=eq.${mid}&firma_id=eq.${firma}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ erledigt_am: wert }) }); return zurueck(r.ok && r.daten.length ? text : "Speichern hat nicht geklappt."); }
    }
    return zurueck("Nichts geändert.");
  }
  const [k, p, ml] = await Promise.all([
    db<KundeKurz[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&order=name&limit=1000`),
    db<Portal[]>(f.s, env, `kunden_portale?firma_id=eq.${firma}&select=id,kunde_id,aktiv,rechnungen_zeigen,berichte_zeigen,erstellt,gueltig_bis&limit=1000`),
    db<Meldung[]>(f.s, env, `kunden_meldungen?firma_id=eq.${firma}&select=id,kunde_id,art,text,name,erstellt,erledigt_am&order=erstellt.desc&limit=200`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${portalVerwaltung(k.ok ? k.daten : [], p.ok ? p.daten : [], ml.ok ? ml.daten : [], { darf, finanzen: !!f.finanzen })}`);
}

async function portalOeffentlich(request: Request, env: KontoEnv, token: string): Promise<Response> {
  const antwort = (t: string, status = 200) => { const r = html(seite("Kundenbereich", t), status); r.headers.set("x-robots-tag", "noindex, nofollow"); r.headers.set("referrer-policy", "no-referrer"); r.headers.set("cache-control", "private, no-store"); return r; };
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const laden = async () => { const r = await anon(env, "portal_abrufen", { token }); return r.ok ? (await r.json()) as PortalDaten | null : null; };
  const d = await laden();
  if (!d) return antwort("<p>Dieser Link ist ungültig oder wurde gesperrt. Bitte wenden Sie sich an Ihren Dienstleister.</p>", 404);
  if (request.method === "POST") {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim().slice(0, 2000);
    if (text.length < 3) return antwort(portalSeite(d, token, heute, "Bitte eine Nachricht eingeben."), 400);
    const r = await anon(env, "portal_melden", { token, art: String(form.get("art") ?? ""), text, name: String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 120) });
    const ok = r.ok && (await r.json()) === true;
    const neu = ok ? await laden() ?? d : d;
    return antwort(portalSeite(neu, token, heute, ok ? "Danke! Ihre Nachricht ist angekommen." : "Das ging gerade nicht (höchstens 10 Meldungen pro Tag)."), ok ? 200 : 429);
  }
  return antwort(portalSeite(d, token, heute));
}
