// T40: Kunde bestätigt Stunden online. The office creates a secret link for one customer and month; the content is
// frozen at that moment. The customer opens the link without an account, checks the hours and confirms with name
// (and optionally a signature) or sends a query. Crewtender sends nothing itself; the firm passes the link on.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { mitLand, einsatzLaender, dezimal, landDerFirma, minuten, naechsterMonat, type Eintrag } from "./stunden.ts";
import { summe, zuschlag } from "./zuschlaege.ts";
import { gruppieren, type Gruppe } from "./leistungsnachweis.ts";
import type { Kunde } from "./kunden.ts";
import { pngAusDataUrl, schluessel, unterschriftFeld } from "./unterschrift.ts";

export type Inhalt = { kunde: string; monat: string; zeilen: { datum: string; name: string; zeit: string; pause: number; std: number; nacht: number; sonntag: number; feiertag: number }[]; summe: { std: number; nacht: number; sonntag: number; feiertag: number } };
export type Freigabe = { id: string; kunde_id: string | null; einsatz: string; monat: string; titel: string; bestaetigt_am: string | null; bestaetigt_name: string; anmerkung: string; rueckfrage: boolean; unterschrift: boolean; gueltig_bis: string; erstellt: string };
const zahl = (n: number) => n ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const zeitpunkt = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

export async function sha256hex(t: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function zufallsToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Frozen content for the link: one row per entry (only approved hours). */
export function inhaltAus(g: Gruppe, personen: { id: string; vorname: string; nachname: string }[], monat: string, land: string): Inhalt {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : ""; };
  const l = [...g.eintraege].sort((a, b) => a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn));
  const zeilen = l.map((e) => { const z = zuschlag(e, land); return { datum: e.datum, name: name(e.personal_id), zeit: `${e.beginn.slice(0, 5)}–${e.ende.slice(0, 5)}`, pause: e.pause_min, std: dezimal(minuten(e)), nacht: dezimal(z.nacht), sonntag: dezimal(z.sonntag), feiertag: dezimal(z.feiertag) }; });
  const z = summe(l.map((e) => zuschlag(e, land)));
  return { kunde: g.titel, monat, zeilen, summe: { std: dezimal(l.reduce((n, e) => n + minuten(e), 0)), nacht: dezimal(z.nacht), sonntag: dezimal(z.sonntag), feiertag: dezimal(z.feiertag) } };
}

export function tabelleHtml(i: Inhalt): string {
  return `<div class="tabelle-scroll"><table class="auswertung-tabelle nachweis-tabelle"><thead><tr><th>Datum</th><th>Mitarbeiter/in</th><th>Zeit</th><th>Pause</th><th>Std.</th><th>Nacht</th><th>So</th><th>Ftg</th></tr></thead><tbody>${i.zeilen.map((z) => `<tr><td>${tag(z.datum)}</td><td>${escape(z.name)}</td><td>${z.zeit}</td><td>${z.pause || ""}</td><td><strong>${zahl(z.std)}</strong></td><td>${zahl(z.nacht)}</td><td>${zahl(z.sonntag)}</td><td>${zahl(z.feiertag)}</td></tr>`).join("")}<tr class="summe"><td colspan="4"><strong>Summe</strong></td><td><strong>${zahl(i.summe.std)}</strong></td><td>${zahl(i.summe.nacht)}</td><td>${zahl(i.summe.sonntag)}</td><td>${zahl(i.summe.feiertag)}</td></tr></tbody></table></div>`;
}

/** Public page for the customer. */
export function oeffentlicheSeite(d: { firma: string; titel: string; monat: string; inhalt: Inhalt | null; bestaetigt_am: string | null; bestaetigt_name: string; rueckfrage: boolean; abgelaufen: boolean }, token: string, hinweis = ""): string {
  const status = d.bestaetigt_am ? `<p class="hinweis ok">${d.rueckfrage ? "❓ Rückfrage gesendet" : "✅ Bestätigt"} von <strong>${escape(d.bestaetigt_name)}</strong> am ${zeitpunkt(d.bestaetigt_am)} Uhr. Vielen Dank!</p>` : d.abgelaufen ? `<p class="hinweis">Dieser Link ist abgelaufen. Bitte wenden Sie sich an ${escape(d.firma)}.</p>` : "";
  const form = !d.bestaetigt_am && !d.abgelaufen ? `<form method="post" action="/nachweis/${encodeURIComponent(token)}" class="nachweis-bestaetigen"><label>Ihr Name<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label>
<label>Anmerkung (freiwillig)<textarea name="anmerkung" maxlength="1000" rows="2"></textarea></label>${unterschriftFeld("unterschrift", { text: "Unterschrift (freiwillig)" })}
<div class="knopf-zeile"><button name="aktion" value="ok">✅ Stunden bestätigen</button><button name="aktion" value="frage" class="zweit">❓ Rückfrage senden</button></div><p class="klein">Mit „Bestätigen“ bestätigen Sie die oben aufgeführten Stunden. Ihr Name, die Uhrzeit und ggf. Ihre Unterschrift werden für ${escape(d.firma)} gespeichert.</p></form>` : "";
  return `${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}<p class="klein">Leistungsnachweis von <strong>${escape(d.firma)}</strong></p><h2>${escape(d.titel)} · ${monatName(d.monat)}</h2>${status}${d.inhalt ? tabelleHtml(d.inhalt) : ""}<p class="klein">Std. = Arbeitsstunden (Pausen abgezogen). Nacht (23–6 Uhr), Sonntag und Feiertag sind in den Stunden enthalten.</p>${form}`;
}

const anon = (env: KontoEnv, fn: string, body: unknown) => fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });

export async function kundenlinkOeffentlich(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/nachweis\/([A-Za-z0-9_-]{20,64})$/);
  if (!m) return null;
  const token = m[1];
  const antwort = (t: string, status = 200) => { const r = html(seite("Leistungsnachweis bestätigen", t), status); r.headers.set("x-robots-tag", "noindex, nofollow"); r.headers.set("referrer-policy", "no-referrer"); return r; };
  const r = await anon(env, "nachweis_abrufen", { token });
  const d = r.ok ? ((await r.json()) as { id: string; firma_id: string; firma: string; titel: string; monat: string; inhalt: Inhalt | null; bestaetigt_am: string | null; bestaetigt_name: string; rueckfrage: boolean; abgelaufen: boolean }[])[0] : undefined;
  if (!d) return antwort("<p>Dieser Link ist ungültig.</p>", 404);
  if (request.method === "POST") {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (name.length < 2) return antwort(oeffentlicheSeite(d, token, "Bitte Ihren Namen angeben."), 400);
    const png = pngAusDataUrl(String(form.get("unterschrift") ?? ""));
    if (png && !d.bestaetigt_am && !d.abgelaufen) await env.DATEN?.put(schluessel.kunde(d.firma_id, d.id), png, { httpMetadata: { contentType: "image/png" } });
    const ok = await anon(env, "nachweis_bestaetigen", { token, name, anmerkung: String(form.get("anmerkung") ?? "").slice(0, 1000), rueckfrage: form.get("aktion") === "frage", unterschrift: !!png });
    const id = ok.ok ? await ok.json() : null;
    if (!id) { if (png) await env.DATEN?.delete(schluessel.kunde(d.firma_id, d.id)); return antwort(oeffentlicheSeite(d, token, "Das ging nicht (schon bestätigt oder abgelaufen)."), 409); }
    const neu = await anon(env, "nachweis_abrufen", { token });
    const d2 = neu.ok ? ((await neu.json()) as typeof d[])[0] ?? d : d;
    return antwort(oeffentlicheSeite(d2, token));
  }
  return antwort(oeffentlicheSeite(d, token));
}

/** Office: create a link for one customer group and month. */
export async function kundenlinkErstellen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/leistungsnachweis/link" || request.method !== "POST") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (!["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle)) return new Response("Nicht erlaubt", { status: 403 });
  const firma = f.m.firma_id;
  const form = await request.formData();
  const monat = String(form.get("monat") ?? ""), kid = String(form.get("kunde") ?? ""), einsatz = String(form.get("einsatz") ?? "").trim().toLowerCase().slice(0, 160);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat) || (!/^[0-9a-f-]{36}$/.test(kid) && !einsatz)) return weiterleiten("/konto/leistungsnachweis", f.s.cookies);
  const [l, k, p, land] = await Promise.all([
    db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status,kunde_id&limit=10000`),
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz&limit=1000`),
    db<{ id: string; vorname: string; nachname: string }[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=3000`),
    landDerFirma(f.s, env, firma),
  ]);
  if (l.ok) l.daten = mitLand(l.daten, await einsatzLaender(f.s, env, firma));
  const g = gruppieren(l.ok ? l.daten : [], k.ok ? k.daten : []).find((x) => kid ? x.kunde?.id === kid : x.schluessel === `e:${einsatz}`);
  const zurueck = (h: string) => weiterleiten(`/konto/leistungsnachweis?monat=${monat}&hinweis=${encodeURIComponent(h)}`, f.s.cookies);
  if (!g || !g.eintraege.length) return zurueck("Keine freigegebenen Stunden für diesen Kunden.");
  const token = zufallsToken();
  const r = await db(f.s, env, "nachweis_freigaben", { method: "POST", body: JSON.stringify({ firma_id: firma, kunde_id: g.kunde?.id ?? null, einsatz: g.kunde ? "" : einsatz, monat, titel: g.titel, inhalt: inhaltAus(g, p.ok ? p.daten : [], monat, land), token_hash: await sha256hex(token) }) });
  if (!r.ok) return zurueck("Link konnte nicht erstellt werden.");
  const link = new URL(`/nachweis/${token}`, request.url).toString();
  const text = `Bitte bestätigen Sie die Stunden ${monatName(monat)}: ${link}`;
  const tel = (g.kunde?.telefon ?? "").replace(/[^\d+]/g, "").replace(/^0/, "49").replace(/^\+/, "");
  return html(seite("Link für den Kunden", `<p class="konto-zurueck"><a href="/konto/leistungsnachweis?monat=${monat}" aria-label="Zurück">←</a></p><p>Link für <strong>${escape(g.titel)}</strong> (${monatName(monat)}), 30 Tage gültig. Der Inhalt ist jetzt eingefroren; spätere Änderungen an Stunden erscheinen dort nicht.</p>
<label>Link<input readonly value="${escape(link)}"></label>
<div class="knopf-zeile teilen"><a class="knopf" href="https://wa.me/${tel}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="knopf zweit" href="mailto:${escape(g.kunde?.email ?? "")}?subject=${encodeURIComponent(`Leistungsnachweis ${monatName(monat)}`)}&body=${encodeURIComponent(text)}">E-Mail</a></div>
<p class="klein">Crewtender verschickt den Link nicht selbst. Die Knöpfe öffnen WhatsApp bzw. dein Mailprogramm mit fertigem Text. Wer den Link hat, kann die Stunden sehen und bestätigen; bitte nur an den Kunden geben. Du bekommst eine Handy-Nachricht, sobald bestätigt ist.</p>`, 0, "team"), 200, f.s.cookies);
}
