// Empfehlungsprogramm (08.11.2026): public pages /partner (apply), /partner/bedingungen (terms), /partner/u/<token>
// (the partner's own numbers, no login) and the operator page /konto/betreiber/partner (approve, block, mark paid).
// Partner links are /registrieren?p=<code>; the code travels in the URL and the sign-up form, no cookie is set.
import { db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { ABSENDER, senden, type Mail } from "./mail.ts";
import { FIRMA } from "./rechtliches.ts";

const EMAIL = /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[a-z]{2,}$/i;
const BASIS = "https://crewtender.eu";

/** A partner code from a link or form (lower case, 3–30 characters of a–z, 0–9 and "-"), else "". */
export function partnerCode(roh: unknown): string {
  const c = String(roh ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(c) ? c : "";
}

export type Konditionen = { satz: number; monate: number };
export const STANDARD_KONDITIONEN: Konditionen = { satz: 20, monate: 12 };
const prozent = (x: number) => `${Number(x).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
export const euro = (cent: number) => `${(Number(cent || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type OeffEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; SMTP_PASSWORD?: string };
async function rpc<T>(env: OeffEnv, name: string, body: Record<string, unknown>): Promise<{ ok: boolean; daten: T | null; fehler: string }> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await r.text();
    return r.ok ? { ok: true, daten: (text ? JSON.parse(text) : null) as T, fehler: "" } : { ok: false, daten: null, fehler: text.slice(0, 300) };
  } catch (e) { return { ok: false, daten: null, fehler: String(e) }; }
}

/** Name of an active partner for the sign-up form ("Empfohlen von …"); null when the code is unknown. */
export async function partnerName(env: OeffEnv, code: string): Promise<string | null> {
  if (!partnerCode(code)) return null;
  const r = await rpc<string | null>(env, "partner_name", { code });
  return r.ok && typeof r.daten === "string" ? r.daten : null;
}

async function konditionen(env: OeffEnv): Promise<Konditionen> {
  const r = await rpc<Konditionen>(env, "empfehlung_konditionen", {});
  return r.ok && r.daten ? { satz: Number(r.daten.satz), monate: Number(r.daten.monate) } : STANDARD_KONDITIONEN;
}

export type Antrag = { name: string; firma: string; email: string; website: string; zielgruppe: string };

export function antragPruefen(a: Antrag, zustimmung: boolean): string {
  if (a.name.length < 2) return "Bitte deinen Namen angeben.";
  if (!EMAIL.test(a.email)) return "Bitte eine gültige E-Mail-Adresse angeben.";
  if (a.zielgruppe.length < 10) return "Bitte kurz beschreiben, welche Firmen du berätst oder erreichst.";
  if (!zustimmung) return "Bitte den Partnerbedingungen zustimmen.";
  return "";
}

export function partnerSeite(k: Konditionen, w: Partial<Antrag> = {}, fehler = ""): string {
  const feld = (name: keyof Antrag, label: string, extra: string) => `<label>${label} <input name="${name}" value="${escape(w[name] ?? "")}" ${extra}></label>`;
  return `<p><strong>Du berätst Dienstleister, die sich auf öffentliche Aufträge bewerben?</strong> Empfiehl Crewtender und erhalte <strong>${prozent(k.satz)}</strong> von allem, was die geworbene Firma in den ersten <strong>${k.monate} Monaten</strong> an Crewtender zahlt.</p>
<ul>
<li>Für Vergabeberater, Unternehmensberater, Ausschreibungs-Coaches, Verbände und alle, die Reinigungs-, Sicherheits-, Personal- oder Handwerksfirmen beraten.</li>
<li>Du bekommst einen eigenen Link. Wer sich darüber registriert, gehört zu dir – ohne Cookie und ohne Banner.</li>
<li>Eine eigene Übersicht zeigt dir geworbene Firmen und deine Provision. Ausgezahlt wird monatlich ab 25 € per Überweisung.</li>
</ul>
<form method="post" action="/partner">
  ${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}
  ${feld("name", "Dein Name", `required maxlength="100" autocomplete="name"`)}
  ${feld("firma", "Firma (freiwillig)", `maxlength="200" autocomplete="organization"`)}
  ${feld("email", "E-Mail-Adresse", `type="email" required maxlength="200" autocomplete="email"`)}
  ${feld("website", "Website oder LinkedIn (freiwillig)", `maxlength="300" inputmode="url"`)}
  <label>Wen berätst oder erreichst du? <textarea name="zielgruppe" required minlength="10" maxlength="1000" rows="4" placeholder="z. B. Vergabeberatung für Reinigungs- und Sicherheitsfirmen in NRW">${escape(w.zielgruppe ?? "")}</textarea></label>
  <label class="sr-only" aria-hidden="true">Bitte leer lassen <input name="webseite" tabindex="-1" autocomplete="off"></label>
  <label class="zeile"><input type="checkbox" name="zustimmung" value="ja" required> <span>Ich akzeptiere die <a href="/partner/bedingungen">Partnerbedingungen</a> und habe die <a href="/datenschutz">Datenschutzerklärung</a> gelesen.</span></label>
  <button>Partner werden</button>
</form>
<p class="klein">Wir prüfen jeden Antrag und melden uns per E-Mail. Fragen? <a href="/kontakt">Schreib uns</a>.</p>`;
}

export function partnerBedingungen(k: Konditionen): string {
  return `<p class="klein">Stand: 08.11.2026 · Anbieter: ${escape(FIRMA.firma)}, ${escape(FIRMA.name)}, ${escape(FIRMA.strasse)}, ${escape(FIRMA.ort)} („wir“)</p>
<h2>1. Gegenstand</h2><p>Partner empfehlen Crewtender an Unternehmen. Für Unternehmen, die sich über den persönlichen Partner-Link registrieren und Crewtender bezahlen, erhält der Partner eine Provision. Das Partnerprogramm richtet sich nur an Unternehmer.</p>
<h2>2. Zuordnung</h2><p>Ein Unternehmen gehört zu einem Partner, wenn das Konto, das die Firma anlegt, über den Partner-Link des Partners registriert wurde. Spätere Zuordnungen und Zuordnungen auf Zuruf gibt es nicht. Eigene Unternehmen des Partners und Unternehmen, die bereits Kunde sind, lösen keine Provision aus.</p>
<h2>3. Provision</h2><p>Die Provision beträgt ${prozent(k.satz)} der Beträge, die das geworbene Unternehmen in den ersten ${k.monate} Monaten ab seiner ersten Zahlung tatsächlich an uns zahlt (Abos und Zusatzkäufe). Für erstattete oder zurückgebuchte Zahlungen entfällt die Provision; bereits ausgezahlte Beträge werden verrechnet. Die Provision ist ein Bruttobetrag und enthält eine etwaige gesetzliche Umsatzsteuer. Für die Versteuerung seiner Einnahmen ist der Partner selbst verantwortlich.</p>
<h2>4. Auszahlung</h2><p>Wir zahlen offene Provisionen monatlich per Überweisung aus, sobald mindestens 25 € offen sind. Der Partner nennt dafür seine Bankverbindung und, falls er umsatzsteuerpflichtig ist, seine Steuernummer oder USt-IdNr.; auf Wunsch erstellen wir eine Gutschrift.</p>
<h2>5. Pflichten des Partners</h2><ul>
<li>Keine Werbung per E-Mail, Messenger, Kontaktformular, Telefon oder Fax ohne vorherige Einwilligung des Empfängers (§ 7 UWG).</li>
<li>Keine falschen oder übertriebenen Aussagen über Crewtender, keine Garantien für Zuschläge.</li>
<li>Keine bezahlte Suchmaschinenwerbung auf den Namen „Crewtender“ und keine Domains oder Profile, die mit Crewtender verwechselt werden können.</li>
<li>Berufsrecht beachten: Wer einem Berufsrecht unterliegt (z. B. Steuerberater, Rechtsanwälte), prüft selbst, ob und wie er eine Provision annehmen darf, und legt sie gegenüber seinen Mandanten offen, wenn das verlangt ist.</li>
</ul>
<h2>6. Stellung des Partners</h2><p>Der Partner handelt selbstständig und im eigenen Namen. Er ist nicht berechtigt, Verträge für uns zu schließen oder Zusagen in unserem Namen zu machen.</p>
<h2>7. Laufzeit und Kündigung</h2><p>Beide Seiten können die Teilnahme jederzeit per E-Mail mit sofortiger Wirkung beenden. Bis dahin verdiente Provisionen werden ausgezahlt. Bei einem Verstoß gegen Nummer 5 entfällt die Provision für die betroffenen Unternehmen, und wir können den Partner sperren.</p>
<h2>8. Änderungen</h2><p>Provisionssatz und Laufzeit können wir für künftige Zahlungen mit einer Ankündigung von vier Wochen per E-Mail ändern. Für bereits geworbene Unternehmen gilt der bisherige Satz bis zum Ende ihrer Laufzeit nach Nummer 3.</p>
<h2>9. Daten</h2><p>Wir speichern Name, Firma, E-Mail-Adresse, Website und Angaben zur Zielgruppe des Partners sowie, welche Unternehmen ihm zugeordnet sind und welche Zahlungen Provision ausgelöst haben. Der Partner sieht in seiner Übersicht nur Anzahl, Monat und Beträge, keine Namen der Unternehmen. Einzelheiten in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
<h2>10. Schluss</h2><p>Es gilt deutsches Recht.</p>`;
}

export type Uebersicht = { name: string; code: string | null; status: string; satz: number; monate: number; kunden: number; zahlende: number; offen_cent: number; bezahlt_cent: number; monatlich: { monat: string; zahlungen: number; provision_cent: number; offen_cent: number }[] };

export function uebersichtSeite(u: Uebersicht): string {
  const link = u.code ? `${BASIS}/registrieren?p=${u.code}` : "";
  const zeilen = u.monatlich.map((m) => `<tr><td>${escape(m.monat.slice(5, 7))}.${escape(m.monat.slice(0, 4))}</td><td>${m.zahlungen}</td><td>${euro(m.provision_cent)}</td><td>${m.offen_cent ? euro(m.offen_cent) : "ausgezahlt"}</td></tr>`).join("");
  return `<p>Partner: <strong>${escape(u.name)}</strong>${u.status === "aktiv" ? "" : u.status === "neu" ? " · <em>wird noch geprüft</em>" : " · <em>gesperrt</em>"}</p>
${link ? `<h2>Dein Partner-Link</h2><p><input readonly value="${escape(link)}" aria-label="Partner-Link" onfocus="this.select()"></p><p class="klein">Wer sich über diesen Link registriert und eine Firma anlegt, gehört zu dir. Provision: ${prozent(u.satz)} der Zahlungen in den ersten ${u.monate} Monaten.</p>` : ""}
<h2>Deine Zahlen</h2>
<ul class="kennzahlen"><li><strong>${u.kunden}</strong> geworbene Firmen</li><li><strong>${u.zahlende}</strong> davon zahlend</li><li><strong>${euro(u.offen_cent)}</strong> Provision offen</li><li><strong>${euro(u.bezahlt_cent)}</strong> ausgezahlt</li></ul>
${zeilen ? `<table><thead><tr><th>Monat</th><th>Zahlungen</th><th>Provision</th><th>Stand</th></tr></thead><tbody>${zeilen}</tbody></table>` : `<p class="klein">Noch keine Zahlungen.</p>`}
<p class="klein">Ausgezahlt wird monatlich ab 25 € offen. Bitte diesen Link nicht weitergeben – er zeigt deine Zahlen ohne Anmeldung. <a href="/partner/bedingungen">Partnerbedingungen</a></p>`;
}

const antwort = (titel: string, inhalt: string, status = 200, robots = false) => {
  const r = new Response(seite(titel, inhalt), { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (robots) r.headers.set("x-robots-tag", "noindex, nofollow");
  return r;
};

/** /partner, /partner/bedingungen, /partner/u/<token>; null for other paths. */
export async function partnerOeffentlich(request: Request, env: OeffEnv): Promise<Response | null> {
  const p = new URL(request.url).pathname;
  if (p === "/partner/bedingungen") return antwort("Partnerbedingungen", partnerBedingungen(await konditionen(env)));
  const u = p.match(/^\/partner\/u\/([0-9a-f]{64})$/);
  if (u) {
    const r = await rpc<Uebersicht | null>(env, "partner_uebersicht", { token: u[1] });
    if (!r.ok || !r.daten) return antwort("Nicht gefunden", "<p>Diesen Partner-Link gibt es nicht.</p>", 404, true);
    return antwort("Partner-Übersicht", uebersichtSeite(r.daten), 200, true);
  }
  if (p !== "/partner") return null;
  const k = await konditionen(env);
  if (request.method === "GET") return antwort("Partner werden", partnerSeite(k));
  if (request.method !== "POST") return new Response("Methode nicht erlaubt", { status: 405, headers: { allow: "GET, POST" } });
  const form = await request.formData();
  const text = (key: string, max: number) => String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const a: Antrag = { name: text("name", 100), firma: text("firma", 200), email: text("email", 200).toLowerCase(), website: text("website", 300), zielgruppe: text("zielgruppe", 1000) };
  const danke = `<p role="status">Danke! Dein Antrag ist angekommen. Wir prüfen ihn und schicken dir deinen Partner-Link per E-Mail.</p><p><a href="/">Zur Startseite</a></p>`;
  if (text("webseite", 200)) return antwort("Partner werden", danke);
  const fehler = antragPruefen(a, form.get("zustimmung") === "ja");
  if (fehler) return antwort("Partner werden", partnerSeite(k, a, fehler), 400);
  const r = await rpc(env, "partner_bewerben", a);
  if (!r.ok) return antwort("Partner werden", partnerSeite(k, a, /ZU_VIELE/.test(r.fehler) ? `Heute sind schon sehr viele Anträge eingegangen. Bitte schreib uns an ${FIRMA.email}.` : "Der Antrag konnte gerade nicht gespeichert werden. Bitte später noch einmal versuchen."), 503);
  return antwort("Partner werden", danke);
}

/** Mail to an approved partner with his link and his overview (he applied himself, so he expects it). */
export function freischaltMail(an: string, name: string, code: string, token: string, k: Konditionen): Mail {
  if (!EMAIL.test(an)) throw new Error("Ungültige Empfängeradresse");
  return {
    from: ABSENDER, to: an, reply: ABSENDER,
    subject: "Crewtender: dein Partner-Link ist freigeschaltet",
    text: `Hallo ${name.replace(/[\r\n]+/g, " ").slice(0, 100)},

danke für dein Interesse am Partnerprogramm von Crewtender. Du bist freigeschaltet.

Dein Partner-Link:
${BASIS}/registrieren?p=${code}

Wer sich über diesen Link registriert und eine Firma anlegt, gehört zu dir. Du erhältst ${prozent(k.satz)} von allem, was die Firma in den ersten ${k.monate} Monaten an Crewtender zahlt.

Deine Übersicht (geworbene Firmen und Provision, ohne Anmeldung – bitte nicht weitergeben):
${BASIS}/partner/u/${token}

Bitte beachte die Partnerbedingungen, vor allem: keine Werbung per E-Mail oder Telefon ohne Einwilligung des Empfängers.
${BASIS}/partner/bedingungen

Viele Grüße
Benjamin Schiffer
Crewtender · WP Digital Ranger
`,
  };
}

type BetreiberPartner = { id: string; name: string; firma: string | null; email: string; website: string | null; zielgruppe: string | null; code: string | null; token: string; status: string; satz: number | null; erstellt: string; freigeschaltet: string | null; firmen: { name: string; paket: string; seit: string }[]; umsatz_cent: number; offen_cent: number; bezahlt_cent: number };

export function betreiberPartnerSeite(d: { einstellungen: Konditionen; partner: BetreiberPartner[] }, hinweis = ""): string {
  const tag = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE") : "–");
  const karte = (p: BetreiberPartner) => `<li id="partner-${escape(p.id)}"><div><strong>${escape(p.firma || p.name)}</strong> <span class="klein">${p.status === "neu" ? "🆕 neu" : p.status === "aktiv" ? "✅ aktiv" : "⛔ gesperrt"} · seit ${tag(p.erstellt)}</span>
<span class="klein">${escape(p.name)} · <a href="mailto:${escape(p.email)}">${escape(p.email)}</a>${p.website ? ` · ${escape(p.website)}` : ""}</span>
${p.zielgruppe ? `<span class="klein">Zielgruppe: ${escape(p.zielgruppe)}</span>` : ""}
${p.code ? `<span class="klein">Link: ${escape(`${BASIS}/registrieren?p=${p.code}`)} · <a href="/partner/u/${escape(p.token)}" rel="noreferrer">Übersicht des Partners</a></span>` : ""}
<span class="klein">${p.firmen.length} Firmen${p.firmen.length ? ` (${p.firmen.slice(0, 5).map((f) => `${escape(f.name)}: ${escape(f.paket)}`).join(", ")}${p.firmen.length > 5 ? " …" : ""})` : ""} · Umsatz ${euro(p.umsatz_cent)} · Provision offen <strong>${euro(p.offen_cent)}</strong> · ausgezahlt ${euro(p.bezahlt_cent)}${p.satz !== null ? ` · eigener Satz ${prozent(p.satz)}` : ""}</span>
<form method="post" action="/konto/betreiber/partner" class="zeile-form"><input type="hidden" name="partner" value="${escape(p.id)}">
${p.status !== "aktiv" ? `<label>Code<input name="code" value="${escape(p.code ?? "")}" maxlength="30" placeholder="leer = aus dem Namen"></label><button name="aktion" value="freischalten">Freischalten${p.status === "neu" ? " und Mail schicken" : ""}</button>` : `<button name="aktion" value="sperren" class="zweit">Sperren</button>`}
${p.offen_cent > 0 ? `<button name="aktion" value="ausgezahlt" class="zweit">${euro(p.offen_cent)} als ausgezahlt abhaken</button>` : ""}
${p.status === "neu" && p.firmen.length === 0 ? `<button name="aktion" value="loeschen" class="zweit">Antrag löschen</button>` : ""}
</form></div></li>`;
  return `${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}<p><a href="/konto/betreiber">← Betreiber</a> · <a href="/partner">Öffentliche Partnerseite</a> · <a href="/partner/bedingungen">Partnerbedingungen</a></p>
<form method="post" action="/konto/betreiber/partner" class="zeile-form"><input type="hidden" name="aktion" value="einstellungen">
<label>Provision (%)<input type="number" name="satz" min="0" max="50" step="0.5" value="${d.einstellungen.satz}"></label><label>Monate ab erster Zahlung<input type="number" name="monate" min="1" max="60" value="${d.einstellungen.monate}"></label><button>Speichern</button></form>
<p class="klein">Gilt für künftige Zahlungen. Laut Partnerbedingungen Änderungen vier Wochen vorher per Mail ankündigen.</p>
<h2>Partner (${d.partner.length})</h2>${d.partner.length ? `<ul class="standort-liste">${d.partner.map(karte).join("")}</ul>` : `<p class="klein">Noch keine Anträge. Die öffentliche Seite ist <a href="/partner">crewtender.eu/partner</a>.</p>`}`;
}

/** /konto/betreiber/partner (operator only). */
export async function betreiberPartner(request: Request, env: KontoEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/konto/betreiber/partner") return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const ist = await db<boolean>(s, env, "rpc/ist_betreiber", { method: "POST", body: "{}" });
  if (!ist.ok || ist.daten !== true) return new Response("Nicht gefunden", { status: 404 });
  const zurueck = (h: string) => weiterleiten(`/konto/betreiber/partner?hinweis=${encodeURIComponent(h)}`, s.cookies);
  if (request.method === "POST") {
    const form = await request.formData();
    const aktion = String(form.get("aktion") ?? "");
    if (aktion === "einstellungen") {
      const satz = Number(form.get("satz")), monate = Math.floor(Number(form.get("monate")));
      if (!(satz >= 0 && satz <= 50) || !(monate >= 1 && monate <= 60)) return zurueck("Eingabe ungültig.");
      const r = await db(s, env, "rpc/betreiber_empfehlung_einstellen", { method: "POST", body: JSON.stringify({ satz, monate }) });
      return zurueck(r.ok ? "Gespeichert." : "Nicht gespeichert.");
    }
    const partner = String(form.get("partner") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(partner) || !["freischalten", "sperren", "ausgezahlt", "loeschen"].includes(aktion)) return zurueck("Eingabe ungültig.");
    const code = aktion === "freischalten" ? partnerCode(form.get("code")) || null : null;
    const r = await db<string | null>(s, env, "rpc/betreiber_partner_setzen", { method: "POST", body: JSON.stringify({ p: partner, aktion, code }) });
    if (!r.ok) return zurueck(/CODE_VERGEBEN/.test(r.fehler) ? "Dieser Code ist schon vergeben." : /CODE_UNGUELTIG/.test(r.fehler) ? "Code ungültig (3–30 Zeichen, a–z, 0–9, -)." : "Hat nicht geklappt.");
    if (aktion !== "freischalten") return zurueck(aktion === "sperren" ? "Partner gesperrt." : aktion === "ausgezahlt" ? "Als ausgezahlt abgehakt." : "Antrag gelöscht.");
    const liste = await db<{ einstellungen: Konditionen; partner: BetreiberPartner[] }>(s, env, "rpc/betreiber_partner", { method: "POST", body: "{}" });
    if (!liste.ok) return zurueck("Freigeschaltet.");
    const e = liste.daten.einstellungen;
    const p = liste.daten.partner.find((x) => x.id === partner);
    if (!p || !p.code) return zurueck("Freigeschaltet.");
    if (p.freigeschaltet && Date.now() - Date.parse(p.freigeschaltet) > 5 * 60_000) return zurueck(`Wieder freigeschaltet (Code ${p.code}). Keine neue Mail.`);
    try { await senden(env, freischaltMail(p.email, p.name, p.code, p.token, { satz: p.satz ?? e.satz, monate: e.monate })); }
    catch { return zurueck(`Freigeschaltet (Code ${p.code}). Die Mail ging nicht raus – Link bitte selbst schicken.`); }
    return zurueck(`Freigeschaltet (Code ${p.code}), Mail an ${p.email} ist raus.`);
  }
  const r = await db<{ einstellungen: Konditionen; partner: BetreiberPartner[] }>(s, env, "rpc/betreiber_partner", { method: "POST", body: "{}" });
  const inhalt = r.ok ? betreiberPartnerSeite(r.daten, new URL(request.url).searchParams.get("hinweis") ?? "") : `<p class="hinweis">Partnerliste konnte nicht geladen werden.</p>`;
  const a = html(seite("Partnerprogramm", inhalt, 0, ""), 200, s.cookies);
  a.headers.set("cache-control", "private, no-store");
  return a;
}
