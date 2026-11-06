// Invoices from WP Digital Ranger to Crewtender customers (operator only): /konto/betreiber/rechnungen lists them and
// writes new ones, /konto/betreiber/rechnung/<id> shows one ready to print or save as PDF. Numbers, freezing and
// cancellation are handled in the database (supabase/migrations/20261103310000_betreiber_rechnungen.sql).
import { db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { FIRMA } from "./rechtliches.ts";
import { KU_HINWEIS } from "./rechnungen.ts";
import type { BetreiberFirma } from "./loeschen.ts";

export type Position = { text: string; menge: number; preis: number };
export type BetreiberRechnung = {
  id: string; nummer: string; firma_id: string | null; datum: string; leistungszeitraum: string; summe: number; hinweis: string;
  aussteller: { name?: string; firma?: string; strasse?: string; ort?: string; email?: string; steuernummer?: string; ust_id?: string; kleinunternehmer?: boolean };
  empfaenger: { firma?: string; strasse?: string; plz?: string; ort?: string; land?: string; inhaber?: string };
  positionen: Position[]; storno_von: string | null; storniert_durch: string | null; storno_nummer?: string | null;
};

export const STANDARD_HINWEIS = "Zahlbar innerhalb von 14 Tagen ohne Abzug per Überweisung.";
const ZEILEN = 3;

export const geld = (x: number) => `${Number(x).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const datumDe = (d: string) => d ? d.slice(0, 10).split("-").reverse().join(".") : "";
/** "1.234,56", "149,00" or "149.00" -> number (NaN when empty or invalid). */
export function zahl(x: unknown): number {
  let t = String(x ?? "").trim().replace(/\s|€/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

/** Reads the position rows of the form; empty rows are skipped. Returns null when a filled row is invalid. */
export function positionenAusFormular(form: { get(n: string): unknown }): Position[] | null {
  const liste: Position[] = [];
  for (let i = 0; i < ZEILEN; i++) {
    const text = String(form.get(`text${i}`) ?? "").trim();
    const mengeRoh = String(form.get(`menge${i}`) ?? "").trim(), preisRoh = String(form.get(`preis${i}`) ?? "").trim();
    if (!text && !preisRoh) continue;
    const menge = mengeRoh === "" ? 1 : zahl(mengeRoh), preis = zahl(preisRoh);
    if (!text || !Number.isFinite(menge) || menge <= 0 || !Number.isFinite(preis) || Math.abs(preis) > 1_000_000) return null;
    liste.push({ text: text.slice(0, 300), menge, preis: Math.round(preis * 100) / 100 });
  }
  return liste.length ? liste : null;
}

/** Previous month as "November 2026" (default service period on the 1st of the next month). */
export function vormonat(heute = new Date()): string {
  const d = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() - 1, 1));
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function rechnungenSeite(o: { liste: BetreiberRechnung[]; firmen: BetreiberFirma[]; firma?: string; hinweis?: string; steuernummer: string; zahlungshinweis: string; heute?: Date }): string {
  const firmenOpt = o.firmen.map((f) => `<option value="${escape(f.id)}"${f.id === o.firma ? " selected" : ""}>${escape(f.name)}${f.inhaber ? ` (${escape(f.inhaber)})` : ""}</option>`).join("");
  const zeilen = Array.from({ length: ZEILEN }, (_, i) => `<div class="zeile-form"><label>Leistung<input name="text${i}" maxlength="300"${i === 0 ? ` placeholder="Crewtender Pro, Monatsbeitrag"` : ""}></label><label style="flex:0 1 90px">Menge<input name="menge${i}" inputmode="decimal" placeholder="1"></label><label style="flex:0 1 130px">Einzelpreis €<input name="preis${i}" inputmode="decimal"></label></div>`).join("");
  const ohneNummer = !o.steuernummer && !FIRMA.ustId;
  const liste = o.liste.length
    ? `<ul class="kontakt-liste">${o.liste.map((r) => `<li><div><strong><a href="/konto/betreiber/rechnung/${escape(r.id)}">${escape(r.nummer)}</a> · ${escape(r.empfaenger.firma ?? "")}</strong><span class="klein">${datumDe(r.datum)} · ${escape(r.leistungszeitraum)} · ${geld(r.summe)}${r.storno_von ? " · Stornorechnung" : r.storniert_durch ? " · storniert" : ""}</span></div></li>`).join("")}</ul>`
    : `<p class="klein">Noch keine Rechnungen.</p>`;
  return `${o.hinweis ? `<p class="hinweis" role="status">${escape(o.hinweis)}</p>` : ""}<p><a href="/konto/betreiber">← Betreiber</a></p>
<h2>Neue Rechnung an einen Kunden</h2>
${ohneNummer ? `<p class="hinweis">Ohne Steuernummer darf noch keine Rechnung raus. Sobald das Finanzamt sie geschickt hat, unten eintragen.</p>` : ""}
<form method="post" action="/konto/betreiber/rechnungen"><input type="hidden" name="aktion" value="anlegen">
<label>Kunde<select name="firma" required><option value="">Bitte wählen</option>${firmenOpt}</select></label>
<label>Leistungszeitraum<input name="zeitraum" required maxlength="100" value="${escape(vormonat(o.heute))}"></label>
${zeilen}
<label>Deine Steuernummer${FIRMA.ustId ? ` (freiwillig, die USt-IdNr. ${escape(FIRMA.ustId)} steht schon auf jeder Rechnung)` : ""}<input name="steuernummer" maxlength="30" value="${escape(o.steuernummer)}" placeholder="z. B. 202/123/45678"></label>
<label>Zahlungshinweis (z. B. mit IBAN)<textarea name="hinweis" maxlength="500" rows="2">${escape(o.zahlungshinweis)}</textarea></label>
<p class="klein">${FIRMA.kleinunternehmer ? `Auf der Rechnung steht: „${escape(KU_HINWEIS)}“ ` : ""}Die Nummer vergibt Crewtender fortlaufend (CT-Jahr-0001). Ausgestellte Rechnungen lassen sich nicht ändern oder löschen, nur stornieren. Nur Kunden in Deutschland, bis eine USt-IdNr. da ist.</p>
<button>Rechnung ausstellen</button></form>
<h2>Ausgestellte Rechnungen</h2>${liste}`;
}

export function rechnungAnsicht(r: BetreiberRechnung): string {
  const a = r.aussteller, e = r.empfaenger;
  const storno = !!r.storno_von;
  const zeilen = r.positionen.map((p, i) => `<tr><td>${i + 1}</td><td>${escape(p.text)}</td><td style="text-align:right;white-space:nowrap">${String(p.menge).replace(".", ",")}</td><td style="text-align:right;white-space:nowrap">${geld(p.preis)}</td><td style="text-align:right;white-space:nowrap">${geld(Math.round(p.menge * p.preis * 100) / 100)}</td></tr>`).join("");
  return `<style>@media print{.seiten-titel,main>p.klein:last-of-type{display:none!important}main{padding-top:0}}</style><div>
<p class="nicht-drucken"><a href="/konto/betreiber/rechnungen">← Alle Rechnungen</a> · <button type="button" data-drucken>Drucken / als PDF speichern</button></p>
${r.storniert_durch ? `<p class="hinweis nicht-drucken">Diese Rechnung ist storniert durch ${escape(r.storno_nummer ?? "")}.</p>` : ""}
<p class="klein">${escape([a.name, a.firma].filter(Boolean).join(", "))} · ${escape(a.strasse ?? "")} · ${escape(a.ort ?? "")}</p>
<p>${escape(e.firma ?? "")}<br>${escape(e.strasse ?? "")}<br>${escape([e.plz, e.ort].filter(Boolean).join(" "))}${e.land && e.land !== "DE" ? `<br>${escape(e.land)}` : ""}</p>
<h2>${storno ? "Stornorechnung" : "Rechnung"} ${escape(r.nummer)}</h2>
<p>Rechnungsdatum: ${datumDe(r.datum)}<br>Leistungszeitraum: ${escape(r.leistungszeitraum)}<br>${[a.steuernummer ? `Steuernummer: ${escape(a.steuernummer)}` : "", a.ust_id ? `USt-IdNr.: ${escape(a.ust_id)}` : ""].filter(Boolean).join("<br>")}</p>
<table style="width:100%;border-collapse:collapse"><thead><tr><th>Pos.</th><th>Leistung</th><th style="text-align:right;white-space:nowrap">Menge</th><th style="text-align:right;white-space:nowrap">Einzelpreis</th><th style="text-align:right;white-space:nowrap">Gesamt</th></tr></thead><tbody>${zeilen}</tbody>
<tfoot><tr><th colspan="4">Gesamtbetrag</th><th style="text-align:right;white-space:nowrap">${geld(r.summe)}</th></tr></tfoot></table>
${a.kleinunternehmer ? `<p>${escape(KU_HINWEIS)}</p>` : ""}
${r.hinweis ? `<p>${escape(r.hinweis).replace(/\n/g, "<br>")}</p>` : ""}
<p class="klein">Crewtender ist ein Angebot von ${escape(a.firma ?? "")}, Inhaber ${escape(a.name ?? "")}${a.email ? ` · ${escape(a.email)}` : ""} · crewtender.eu</p>
</div>`;
}

function fehlerText(f: string): string {
  if (/STEUERNUMMER_FEHLT/.test(f)) return "Bitte zuerst deine Steuernummer eintragen.";
  if (/ANSCHRIFT_FEHLT/.test(f)) return "Beim Kunden fehlt die Anschrift (Straße und Ort). Er trägt sie unter Firmenprofil ein.";
  if (/AUSLAND/.test(f)) return "Kunden außerhalb Deutschlands erst, wenn du eine USt-IdNr. hast (Reverse Charge); vorher Steuerberater fragen.";
  if (/POSITION/.test(f)) return "Bitte jede Leistung mit Text und Preis ausfüllen.";
  if (/SCHON_STORNIERT/.test(f)) return "Diese Rechnung ist schon storniert.";
  if (/NICHT_GEFUNDEN/.test(f)) return "Nicht gefunden.";
  return "Hat nicht geklappt.";
}

export async function betreiberRechnungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const einzeln = url.pathname.match(/^\/konto\/betreiber\/rechnung\/([0-9a-f-]{36})$/);
  if (url.pathname !== "/konto/betreiber/rechnungen" && !einzeln) return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const ist = await db<boolean>(s, env, "rpc/ist_betreiber", { method: "POST", body: "{}" });
  if (!ist.ok || ist.daten !== true) return new Response("Nicht gefunden", { status: 404 });
  const antwort = (titel: string, t: string) => { const r = html(seite(titel, t, 0, ""), 200, s.cookies); r.headers.set("cache-control", "private, no-store"); return r; };
  const zurueck = (hinweis: string, ziel = "/konto/betreiber/rechnungen") => weiterleiten(`${ziel}?hinweis=${encodeURIComponent(hinweis)}`, s.cookies);

  if (einzeln) {
    if (request.method === "POST") {
      const r = await db<{ id: string; nummer: string }>(s, env, "rpc/betreiber_rechnung_stornieren", { method: "POST", body: JSON.stringify({ r: einzeln[1] }) });
      return r.ok ? weiterleiten(`/konto/betreiber/rechnung/${r.daten.id}`, s.cookies) : zurueck(fehlerText(r.fehler), url.pathname);
    }
    const r = await db<BetreiberRechnung | null>(s, env, "rpc/betreiber_rechnung", { method: "POST", body: JSON.stringify({ r: einzeln[1] }) });
    if (!r.ok || !r.daten) return new Response("Nicht gefunden", { status: 404 });
    const hinweis = url.searchParams.get("hinweis") ?? "";
    const stornoKnopf = !r.daten.storno_von && !r.daten.storniert_durch
      ? `<form method="post" class="nicht-drucken loeschen-form"><label class="zeile"><input type="checkbox" name="sicher" required>Rechnung ${escape(r.daten.nummer)} stornieren. Es entsteht eine Stornorechnung mit neuer Nummer und negativem Betrag.</label><button class="gefahr">Stornieren</button></form>` : "";
    return antwort(`${r.daten.storno_von ? "Stornorechnung" : "Rechnung"} ${r.daten.nummer}`, `${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}${rechnungAnsicht(r.daten)}${stornoKnopf}`);
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const firma = String(form.get("firma") ?? "");
    const pos = positionenAusFormular(form);
    if (!/^[0-9a-f-]{36}$/.test(firma)) return zurueck("Bitte einen Kunden wählen.");
    if (!pos) return zurueck(fehlerText("POSITION"));
    const aussteller = { name: FIRMA.name, firma: FIRMA.firma, strasse: FIRMA.strasse, ort: FIRMA.ort, email: FIRMA.email, steuernummer: String(form.get("steuernummer") ?? "").trim().slice(0, 30) || "", ust_id: FIRMA.ustId, kleinunternehmer: FIRMA.kleinunternehmer };
    const r = await db<{ id: string; nummer: string }>(s, env, "rpc/betreiber_rechnung_anlegen", { method: "POST", body: JSON.stringify({ f: firma, positionen: pos, zeitraum: String(form.get("zeitraum") ?? ""), aussteller, hinweis: String(form.get("hinweis") ?? "").trim().slice(0, 500) }) });
    return r.ok ? weiterleiten(`/konto/betreiber/rechnung/${r.daten.id}`, s.cookies) : zurueck(fehlerText(r.fehler));
  }

  const [liste, firmen] = await Promise.all([
    db<BetreiberRechnung[]>(s, env, "rpc/betreiber_rechnungen_liste", { method: "POST", body: "{}" }),
    db<BetreiberFirma[]>(s, env, "rpc/betreiber_firmen", { method: "POST", body: "{}" }),
  ]);
  const l = liste.ok ? liste.daten : [];
  const letzte = l.find((r) => !r.storno_von);
  return antwort("Kundenrechnungen", rechnungenSeite({
    liste: l, firmen: firmen.ok ? firmen.daten : [], firma: url.searchParams.get("firma") ?? "", hinweis: url.searchParams.get("hinweis") ?? "",
    steuernummer: letzte?.aussteller.steuernummer || FIRMA.steuernummer, zahlungshinweis: letzte?.hinweis || STANDARD_HINWEIS,
  }));
}
