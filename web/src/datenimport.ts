// Taking over existing data (09.11.2026): customers with their sites and staff certificates from Excel (.xlsx) or CSV,
// like the staff import (personalimport.ts): Crewtender recognises the columns by their names (fixed rules, no AI),
// shows a preview and only imports after confirmation. Plus the overview page /konto/daten-uebernehmen.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { bereicheLaden, db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { csvLesen, textAus, xlsxLesen } from "./personalimport.ts";
import { escape, seite } from "./seite.ts";
import { PROGRAMME, type Programm } from "./programmimport.ts";

const MAX_ZEILEN = 500;
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");

/** Index of the first header that matches one of the names; -1 when none. */
export function spalte(kopf: string[], namen: string[]): number {
  const n = kopf.map(norm);
  return n.findIndex((h) => namen.includes(h));
}
const zelle = (z: string[], i: number, max: number) => (i >= 0 ? String(z[i] ?? "").replace(/\s+/g, " ").trim() : "").slice(0, max);

/** "31.12.2027", "31.12.27", "2027-12-31" or an Excel day number (46387) → "2027-12-31"; "" when not a date. */
export function datumLesen(s: string): string {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const j = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return gueltig(j, Number(m[2]), Number(m[1]));
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return gueltig(Number(m[1]), Number(m[2]), Number(m[3]));
  if (/^\d{5}(\.0+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86_400_000);
    return d.getUTCFullYear() > 1990 && d.getUTCFullYear() < 2100 ? d.toISOString().slice(0, 10) : "";
  }
  return "";
}
function gueltig(j: number, mo: number, t: number): string {
  const d = new Date(Date.UTC(j, mo - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === mo - 1 && d.getUTCDate() === t && j > 1950 && j < 2100 ? d.toISOString().slice(0, 10) : "";
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const telefon = (t: string) => { const s = t.trim().replace(/\.0$/, ""); return /^1[5-7]\d{8,9}$/.test(s) ? `0${s}` : s; };

// ---------- Customers and sites ----------

export const KUNDEN_SPALTEN = {
  name: ["kunde", "kundenname", "firma", "firmenname", "name", "auftraggeber", "unternehmen", "kundenbezeichnung", "bezeichnung", "rechnungsempfanger", "rechnungsempfaenger"],
  strasse: ["strasse", "str", "strassehausnummer", "strasseundhausnummer", "adresse", "anschrift", "hausanschrift"],
  plz: ["plz", "postleitzahl"],
  ort: ["ort", "stadt", "gemeinde"],
  plzort: ["plzort", "postleitzahlort"],
  ansprechpartner: ["ansprechpartner", "ansprechpartnerin", "kontakt", "kontaktperson", "ansprechperson", "zuhanden"],
  telefon: ["telefon", "tel", "telefonnummer", "festnetz", "mobil", "handy", "phone", "rufnummer"],
  email: ["email", "mail", "emailadresse", "mailadresse"],
  ustid: ["ustid", "ustidnr", "ustidnummer", "umsatzsteueridentifikationsnummer", "vatid"],
  notiz: ["notiz", "bemerkung", "bemerkungen", "kommentar", "hinweis", "anmerkung"],
  einsatzort: ["einsatzort", "objekt", "objektname", "objektbezeichnung", "liegenschaft", "gebaude", "gebaeude", "baustelle"],
} as const;
type KundenFeld = keyof typeof KUNDEN_SPALTEN;

export type KundeZeile = { name: string; strasse: string; plz: string; ort: string; ansprechpartner: string; telefon: string; email: string; ustid: string; notiz: string; einsatzort: string; problem: string; neu: boolean };

export function kundenLesen(tabelle: string[][], vorhanden: { name: string }[], orte: { name: string; kunde: string }[]): { zeilen: KundeZeile[]; spalten: Record<string, string> } {
  if (tabelle.length < 2) return { zeilen: [], spalten: {} };
  const kopf = tabelle[0].map((x) => String(x ?? "").trim());
  const sp = Object.fromEntries(Object.entries(KUNDEN_SPALTEN).map(([k, n]) => [k, spalte(kopf, [...n])])) as Record<KundenFeld, number>;
  // "Name" also matches a contact column; when there is a clear customer column, that one counts.
  const bekannt = new Set(vorhanden.map((k) => norm(k.name)));
  const ortBekannt = new Set(orte.map((o) => `${norm(o.kunde)}|${norm(o.name)}`));
  const gesehen = new Set<string>(), ortGesehen = new Set<string>();
  const zeilen = tabelle.slice(1, MAX_ZEILEN + 1).map((z): KundeZeile => {
    let plz = zelle(z, sp.plz, 10).replace(/\.0$/, ""), ort = zelle(z, sp.ort, 100);
    const kombi = zelle(z, sp.plzort, 120) || (!plz ? ort : "");
    const m = kombi.match(/^(?:D-)?(\d{4,5})\s+(.+)$/);
    if (m) { plz = m[1]; ort = m[2]; }
    if (/^\d{4}$/.test(plz)) plz = `0${plz}`; // Excel drops the leading zero (Saxony, Thuringia)
    const r = { name: zelle(z, sp.name, 160), strasse: zelle(z, sp.strasse, 160), plz, ort: ort.slice(0, 100), ansprechpartner: zelle(z, sp.ansprechpartner, 160), telefon: telefon(zelle(z, sp.telefon, 60)),
      email: zelle(z, sp.email, 200), ustid: zelle(z, sp.ustid, 20).replace(/\s/g, "").toUpperCase(), notiz: zelle(z, sp.notiz, 500), einsatzort: zelle(z, sp.einsatzort, 160), problem: "", neu: false };
    const key = norm(r.name), okey = `${key}|${norm(r.einsatzort)}`;
    if (r.name.length < 2) r.problem = "Kein Kundenname";
    else if (r.plz && !/^\d{5}$/.test(r.plz)) r.problem = "PLZ ungültig";
    else if (r.email && !EMAIL.test(r.email)) r.problem = "E-Mail ungültig";
    else if (r.einsatzort && (ortBekannt.has(okey) || ortGesehen.has(okey))) r.problem = "Einsatzort schon eingetragen";
    else if (!r.einsatzort && (bekannt.has(key) || gesehen.has(key))) r.problem = bekannt.has(key) ? "Kunde schon eingetragen" : "Doppelt in der Datei";
    r.neu = !r.problem && !bekannt.has(key) && !gesehen.has(key);
    if (!r.problem) { gesehen.add(key); if (r.einsatzort) ortGesehen.add(okey); }
    return r;
  });
  const spalten = Object.fromEntries(Object.entries(sp).filter(([, i]) => i >= 0).map(([k, i]) => [k, kopf[i]]));
  return { zeilen, spalten };
}

// ---------- Certificates of staff ----------

export const NACHWEIS_SPALTEN = {
  vorname: ["vorname", "rufname"],
  nachname: ["nachname", "familienname", "zuname"],
  name: ["name", "mitarbeiter", "mitarbeiterin", "person", "mitarbeitername"],
  bezeichnung: ["nachweis", "bezeichnung", "art", "qualifikation", "schulung", "zertifikat", "dokument", "unterweisung", "nachweisart", "schein"],
  erworben: ["erworben", "ausgestellt", "ausstellungsdatum", "datum", "gultigab", "gueltigab", "erteiltam", "abgelegtam", "von"],
  gueltig_bis: ["gultigbis", "gueltigbis", "ablauf", "ablaufdatum", "ablaufam", "bis", "gultig", "gueltig", "faellig", "fallig", "naechsteprufung", "nachsteprufung"],
} as const;
type NachweisFeld = keyof typeof NACHWEIS_SPALTEN;

export type NachweisZeile = { person: string; personal_id: string | null; bezeichnung: string; erworben: string; gueltig_bis: string; problem: string };

export function nachweiseLesen(tabelle: string[][], personal: { id: string; vorname: string; nachname: string }[], vorhanden: { personal_id: string; bezeichnung: string; gueltig_bis: string | null }[]): { zeilen: NachweisZeile[]; spalten: Record<string, string> } {
  if (tabelle.length < 2) return { zeilen: [], spalten: {} };
  const kopf = tabelle[0].map((x) => String(x ?? "").trim());
  const sp = Object.fromEntries(Object.entries(NACHWEIS_SPALTEN).map(([k, n]) => [k, spalte(kopf, [...n])])) as Record<NachweisFeld, number>;
  const personen = new Map<string, string>();
  for (const p of personal) { personen.set(norm(`${p.vorname} ${p.nachname}`), p.id); personen.set(norm(`${p.nachname} ${p.vorname}`), p.id); }
  const da = new Set(vorhanden.map((v) => `${v.personal_id}|${norm(v.bezeichnung)}|${v.gueltig_bis ?? ""}`));
  const gesehen = new Set<string>();
  const zeilen = tabelle.slice(1, MAX_ZEILEN + 1).map((z): NachweisZeile => {
    let person = `${zelle(z, sp.vorname, 100)} ${zelle(z, sp.nachname, 100)}`.trim();
    if (!person) person = zelle(z, sp.name, 200).replace(/^([^,]+),\s*(.+)$/, "$2 $1");
    const pid = personen.get(norm(person)) ?? null;
    const bezRoh = zelle(z, sp.bezeichnung, 120);
    const erwRoh = zelle(z, sp.erworben, 40), bisRoh = zelle(z, sp.gueltig_bis, 40);
    const r: NachweisZeile = { person, personal_id: pid, bezeichnung: bezRoh, erworben: datumLesen(erwRoh), gueltig_bis: datumLesen(bisRoh), problem: "" };
    const key = `${pid}|${norm(r.bezeichnung)}|${r.gueltig_bis}`;
    if (!person) r.problem = "Kein Name";
    else if (!pid) r.problem = "Person nicht im Personal";
    else if (r.bezeichnung.length < 2) r.problem = "Keine Bezeichnung";
    else if ((erwRoh && !r.erworben) || (bisRoh && !r.gueltig_bis)) r.problem = "Datum nicht lesbar";
    else if (r.erworben && r.gueltig_bis && r.gueltig_bis < r.erworben) r.problem = "Gültig bis vor dem Ausstellungsdatum";
    else if (da.has(key)) r.problem = "Schon eingetragen";
    else if (gesehen.has(key)) r.problem = "Doppelt in der Datei";
    if (!r.problem) gesehen.add(key);
    return r;
  });
  const spalten = Object.fromEntries(Object.entries(sp).filter(([, i]) => i >= 0).map(([k, i]) => [k, kopf[i]]));
  return { zeilen, spalten };
}

// ---------- Pages ----------

type Art = "kunden" | "nachweise";
const ART: Record<Art, { titel: string; zurueck: string; einheit: [string, string]; vorlage: string; spaltenText: string }> = {
  kunden: { titel: "Kunden importieren", zurueck: "/konto/kunden", einheit: ["Zeile", "Zeilen"], vorlage: "﻿Kunde;Einsatzort;Straße;PLZ;Ort;Ansprechpartner;Telefon;E-Mail;USt-IdNr.;Notiz\r\nMuster Immobilien GmbH;Bürohaus Nord;Hauptstraße 1;50667;Köln;Frau Muster;0221 123456;rechnung@muster.example;DE123456789;Reinigung Mo–Fr\r\n",
    spaltenText: "Kunde (oder Firma/Name), Einsatzort oder Objekt, Straße, PLZ, Ort (auch „PLZ Ort“ in einer Spalte), Ansprechpartner, Telefon, E-Mail, USt-IdNr. und Notiz. Mehrere Objekte eines Kunden: je Objekt eine Zeile mit demselben Kundennamen." },
  nachweise: { titel: "Nachweise importieren", zurueck: "/konto/team", einheit: ["Nachweis", "Nachweise"], vorlage: "﻿Vorname;Nachname;Nachweis;Ausgestellt;Gültig bis\r\nEva;Muster;Erste-Hilfe-Kurs;15.03.2025;15.03.2027\r\n",
    spaltenText: "Vorname und Nachname (oder eine Spalte „Name“), Nachweis (Bezeichnung), Ausgestellt und Gültig bis (Datum wie 31.12.2027). Die Person muss schon im Personal stehen; Namen werden genau verglichen." },
};

function uploadSeite(art: Art, bereiche: Bereich[], fehler = ""): string {
  const a = ART[art];
  const orte = bereiche.filter((b) => b.art === "standort");
  return `${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}<p>Lade eine Excel-Datei (.xlsx) oder CSV hoch, zum Beispiel einen Export aus deinem bisherigen Programm. Crewtender erkennt die Spalten selbst und zeigt dir vor dem Import eine Vorschau.</p>
<form method="post" action="/konto/import/${art}" enctype="multipart/form-data" class="upload-felder">
${art === "kunden" && orte.length ? `<label class="ganz">Standort der Kunden<select name="bereich"><option value="firma">Ohne Standort (ganze Firma)</option>${orte.map((b) => `<option value="${b.id}">${escape(b.name)}</option>`).join("")}</select></label>` : ""}
<label class="ganz">Datei (.xlsx oder .csv, höchstens 2 MB und ${MAX_ZEILEN} Zeilen)<input type="file" name="datei" accept=".xlsx,.csv,text/csv" required></label>
<button class="ganz">Vorschau anzeigen</button></form>
<details class="klein-hilfe"><summary>Welche Spalten erkennt Crewtender?</summary><p>${escape(a.spaltenText)} Die erste Zeile muss die Spaltennamen enthalten.</p><p><a href="/konto/import/${art}/vorlage.csv">⬇ Vorlage herunterladen</a></p></details>`;
}

const FELDER: Record<string, string> = { name: "Name", strasse: "Straße", plz: "PLZ", ort: "Ort", plzort: "PLZ Ort", ansprechpartner: "Ansprechpartner", telefon: "Telefon", email: "E-Mail", ustid: "USt-IdNr.", notiz: "Notiz", einsatzort: "Einsatzort", vorname: "Vorname", nachname: "Nachname", bezeichnung: "Nachweis", erworben: "Ausgestellt", gueltig_bis: "Gültig bis" };
const datumDe = (d: string) => (d ? d.split("-").reverse().join(".") : "");

export function vorschau(art: Art, zeilen: (KundeZeile | NachweisZeile)[], spalten: Record<string, string>, schluessel: string, dateiname: string): string {
  const a = ART[art];
  const gut = zeilen.filter((z) => !z.problem);
  const text = (z: KundeZeile | NachweisZeile) => art === "kunden"
    ? (() => { const k = z as KundeZeile; return [`<strong>${escape(k.name || "(ohne Namen)")}</strong>`, `<span class="klein">${escape([k.einsatzort ? `Einsatzort: ${k.einsatzort}` : "", [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "), k.ansprechpartner].filter(Boolean).join(" · "))}${!k.problem && k.einsatzort && !k.neu ? " · weiteres Objekt dieses Kunden" : ""}`]; })()
    : (() => { const n = z as NachweisZeile; return [`<strong>${escape(n.person || "(ohne Namen)")}</strong>`, `<span class="klein">${escape([n.bezeichnung, n.erworben ? `ausgestellt ${datumDe(n.erworben)}` : "", n.gueltig_bis ? `gültig bis ${datumDe(n.gueltig_bis)}` : "ohne Ablauf"].filter(Boolean).join(" · "))}`]; })();
  return `<p><strong>${escape(dateiname)}</strong>: ${zeilen.length} ${zeilen.length === 1 ? "Zeile" : "Zeilen"} gelesen, <strong>${gut.length}</strong> ${gut.length === 1 ? a.einheit[0] : a.einheit[1]} ${gut.length === 1 ? "wird" : "werden"} übernommen${zeilen.length - gut.length ? `, ${zeilen.length - gut.length} übersprungen` : ""}.</p>
<p class="klein">Erkannte Spalten: ${Object.entries(spalten).map(([k, v]) => `${FELDER[k] ?? k} ← „${escape(v)}“`).join(" · ") || "keine"}</p>
<ul class="import-liste">${zeilen.slice(0, 200).map((z) => { const [t1, t2] = text(z); return `<li class="${z.problem ? "uebersprungen" : ""}"><span aria-hidden="true">${z.problem ? "⚠️" : "✅"}</span><span>${t1}${t2}${z.problem ? ` · <b>${escape(z.problem)}</b>` : ""}</span></span></li>`; }).join("")}</ul>
${zeilen.length > 200 ? `<p class="klein">Es werden die ersten 200 Zeilen gezeigt; übernommen werden alle ${gut.length} gültigen.</p>` : ""}
${gut.length ? `<form method="post" action="/konto/import/${art}/bestaetigen"><input type="hidden" name="schluessel" value="${escape(schluessel)}"><button>✅ ${gut.length} ${gut.length === 1 ? a.einheit[0] : a.einheit[1]} übernehmen</button></form>` : `<p class="fehler">Keine Zeile kann übernommen werden.</p>`}
<p><a href="${a.zurueck}">Abbrechen</a></p>`;
}

/** Form for the direct transfer from Lexware Office or sevDesk; the key is only used for this request. */
export function programmFormular(bereiche: Bereich[], fehler = ""): string {
  const orte = bereiche.filter((b) => b.art === "standort");
  return `${fehler ? `<p class="fehler" role="alert">${escape(fehler)}</p>` : ""}<p>Crewtender liest die Kunden direkt aus deinem Rechnungsprogramm und zeigt sie dir vor dem Übernehmen. Der Schlüssel wird nur für diesen einen Abruf benutzt und nicht gespeichert; Crewtender liest nur, es ändert nichts in deinem Programm.</p>
<form method="post" action="/konto/import/programm" class="upload-felder" autocomplete="off">
<label class="ganz">Programm<select name="programm">${Object.entries(PROGRAMME).map(([id, p]) => `<option value="${id}">${escape(p.name)}</option>`).join("")}</select></label>
${orte.length ? `<label class="ganz">Standort der Kunden<select name="bereich"><option value="firma">Ohne Standort (ganze Firma)</option>${orte.map((b) => `<option value="${b.id}">${escape(b.name)}</option>`).join("")}</select></label>` : ""}
<label class="ganz">API-Schlüssel<input type="password" name="api_schluessel" required minlength="10" maxlength="300" autocomplete="off" spellcheck="false"></label>
<button class="ganz">Kunden abrufen und Vorschau zeigen</button></form>
<details class="klein-hilfe"><summary>Wo finde ich den Schlüssel?</summary>${Object.values(PROGRAMME).map((p) => `<p><strong>${escape(p.name)}:</strong> ${escape(p.hilfe)}</p>`).join("")}<p>Nach dem Übernehmen kannst du den Schlüssel im Programm wieder löschen.</p></details>`;
}

/** Overview of all ways to bring existing data in. */
export function uebersichtSeite(): string {
  const weg = (icon: string, titel: string, text: string, link: string, knopf: string) => `<li class="uebernahme-weg"><span aria-hidden="true">${icon}</span><div><strong>${titel}</strong><p class="klein">${text}</p>${link ? `<a class="knopf zweit" href="${link}">${knopf}</a>` : ""}</div></li>`;
  return `<p>So kommen deine vorhandenen Daten in Crewtender, ohne alles abzutippen. Fast jedes Programm kann eine Excel- oder CSV-Datei exportieren; Crewtender erkennt die Spalten selbst und zeigt vor dem Übernehmen eine Vorschau.</p>
<ul class="uebernahme-liste">
${weg("🧑‍🔧", "Personal", "Mitarbeiterliste aus Excel, deinem Lohnprogramm oder vom Steuerberater (DATEV-Stammdatenexport als CSV): Name, Telefon, E-Mail, Berufe, Qualifikationen, Standort.", "/konto/personal/import", "Personal importieren")}
${weg("🏢", "Kunden und Einsatzorte", "Kundenliste aus Excel oder deinem Rechnungsprogramm (z. B. lexoffice, sevDesk: „Kontakte exportieren“): Name, Anschrift, Ansprechpartner, USt-IdNr., dazu die Objekte.", "/konto/import/kunden", "Kunden importieren")}
${weg("🔌", "Direkt aus Lexware Office oder sevDesk", "Kunden mit einem Klick aus deinem Rechnungsprogramm holen: API-Schlüssel dort erzeugen, hier einfügen, Vorschau prüfen. Der Schlüssel wird nicht gespeichert.", "/konto/import/programm", "Rechnungsprogramm verbinden")}
${weg("🎓", "Nachweise und Schulungen", "Erste Hilfe, Sachkunde § 34a, Gesundheitszeugnis, Staplerschein … mit Ablaufdatum. Crewtender erinnert dann rechtzeitig.", "/konto/import/nachweise", "Nachweise importieren")}
${weg("📄", "Firmenunterlagen", "Zertifikate, Versicherungen, Referenzen und Eigenerklärungen als PDF hochladen; sie stehen dann für jedes Angebot bereit.", "/konto/firmenunterlagen", "Unterlagen hochladen")}
${weg("✉️", "Wir helfen beim Umzug", "Du hast eine Liste, die nicht passt? Schick sie an hello@crewtender.eu, wir schauen sie uns an.", "", "")}
</ul>
<p class="klein">Tipp: In Excel „Datei → Speichern unter → CSV (Trennzeichen-getrennt)“ oder direkt als .xlsx hochladen. Die erste Zeile muss die Spaltennamen enthalten.</p>`;
}

const ROLLEN_IMPORT = ["inhaber", "admin", "bearbeiter", "standortleitung"];

export async function datenImport(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/daten-uebernehmen" && !url.pathname.startsWith("/konto/import/")) return null;
  const programmSeite = url.pathname === "/konto/import/programm";
  const m = url.pathname.match(/^\/konto\/import\/(kunden|nachweise)(\/vorlage\.csv|\/bestaetigen)?$/);
  if (url.pathname !== "/konto/daten-uebernehmen" && !m && !programmSeite) return null;
  const art = (m?.[1] ?? "kunden") as Art;
  if (m?.[2] === "/vorlage.csv") return new Response(ART[art].vorlage, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${art === "kunden" ? "Kunden" : "Nachweise"}-Vorlage.csv"` } });
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const titel = url.pathname === "/konto/daten-uebernehmen" ? "Daten übernehmen" : programmSeite ? "Kunden aus dem Rechnungsprogramm" : ART[art].titel;
  const zurueck = url.pathname === "/konto/daten-uebernehmen" ? "/konto" : "/konto/daten-uebernehmen";
  const antwort = (text: string, status = 200) => html(seite(titel, `<p class="konto-zurueck"><a href="${zurueck}" aria-label="Zurück">←</a></p>${text}`, 0, "team"), status, f.s.cookies);
  if (!ROLLEN_IMPORT.includes(f.m.rolle)) return antwort("<p>Daten übernehmen können Inhaber, Admins, Bearbeiter und Standortleitungen.</p>", 403);
  const hinweis = url.searchParams.get("hinweis");
  if (url.pathname === "/konto/daten-uebernehmen") return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis.slice(0, 200))}</strong></p>` : ""}${uebersichtSeite()}`);
  if (!env.DATEN) return antwort('<p class="fehler">Der Import ist gerade nicht verfügbar.</p>', 503);
  const firma = f.m.firma_id;
  const bereicheR = await bereicheLaden(f.s, env, firma);
  const bereiche = bereicheR.ok ? bereicheR.daten : [];
  const ablage = (key: string) => `importe/${firma}/${art}-${key}.json`;

  if (m?.[2] === "/bestaetigen" && request.method === "POST") {
    const key = String((await request.formData()).get("schluessel") ?? "");
    const abgelaufen = () => antwort('<p class="fehler">Der Import ist abgelaufen. Bitte die Datei erneut hochladen.</p>', 400);
    if (!/^[0-9a-f-]{36}$/.test(key)) return abgelaufen();
    const obj = await env.DATEN.get(ablage(key));
    const g = obj ? (await obj.json()) as { user: string; erstellt: number; zeilen: (KundeZeile | NachweisZeile)[]; bereich: string | null } : null;
    if (obj) await env.DATEN.delete(ablage(key));
    if (!g || g.user !== f.s.userId || Date.now() - g.erstellt > 3600_000) return abgelaufen();
    let ok = 0, alle = 0;
    if (art === "kunden") {
      const zeilen = (g.zeilen as KundeZeile[]).filter((z) => !z.problem);
      // New customers first (one per name, address from its first row), then the sites with the customer's id.
      const neu = new Map<string, KundeZeile>();
      for (const z of zeilen) if (z.neu && !neu.has(norm(z.name))) neu.set(norm(z.name), z);
      const kundenZeilen = [...neu.values()].map((z) => ({ firma_id: firma, bereich_id: g.bereich, name: z.name, strasse: z.strasse, plz: z.plz, ort: z.ort, ansprechpartner: z.ansprechpartner, telefon: z.telefon, email: z.email, ustid: z.ustid, notiz: z.notiz }));
      for (let i = 0; i < kundenZeilen.length; i += 100) {
        const r = await db(f.s, env, "kunden", { method: "POST", body: JSON.stringify(kundenZeilen.slice(i, i + 100)) });
        if (r.ok) ok += Math.min(100, kundenZeilen.length - i);
      }
      alle = kundenZeilen.length;
      const ids = await db<{ id: string; name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,name&limit=5000`);
      const idVon = new Map((ids.ok ? ids.daten : []).map((k) => [norm(k.name), k.id]));
      const orte = zeilen.filter((z) => z.einsatzort && idVon.has(norm(z.name))).map((z) => ({ firma_id: firma, kunde_id: idVon.get(norm(z.name)), name: z.einsatzort, strasse: z.strasse, plz: z.plz, ort: z.ort, ansprechpartner: z.ansprechpartner, telefon: z.telefon }));
      let okOrte = 0;
      for (let i = 0; i < orte.length; i += 100) {
        const r = await db(f.s, env, "einsatzorte", { method: "POST", body: JSON.stringify(orte.slice(i, i + 100)) });
        if (r.ok) okOrte += Math.min(100, orte.length - i);
      }
      const hinweis = `${ok} ${ok === 1 ? "Kunde" : "Kunden"}${orte.length ? ` und ${okOrte} ${okOrte === 1 ? "Einsatzort" : "Einsatzorte"}` : ""} übernommen.${ok < alle || okOrte < orte.length ? " Manche Zeilen konnten nicht gespeichert werden." : ""}`;
      return weiterleiten(`/konto/kunden?hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
    }
    const neu = (g.zeilen as NachweisZeile[]).filter((z) => !z.problem && z.personal_id).map((z) => ({ firma_id: firma, personal_id: z.personal_id, bezeichnung: z.bezeichnung, erworben: z.erworben || null, gueltig_bis: z.gueltig_bis || null }));
    for (let i = 0; i < neu.length; i += 100) {
      const r = await db(f.s, env, "personal_nachweise", { method: "POST", body: JSON.stringify(neu.slice(i, i + 100)) });
      if (r.ok) ok += Math.min(100, neu.length - i);
    }
    return weiterleiten(`/konto/daten-uebernehmen?hinweis=${encodeURIComponent(`${ok} von ${neu.length} Nachweisen übernommen.`)}`, f.s.cookies);
  }

  if (programmSeite) {
    if (request.method !== "POST") return antwort(programmFormular(bereiche));
    const form = await request.formData();
    const p = String(form.get("programm") ?? "") as Programm;
    const apiSchluessel = String(form.get("api_schluessel") ?? "").trim();
    const wahl = String(form.get("bereich") ?? "firma");
    const bereich = bereiche.some((b) => b.id === wahl) ? wahl : null;
    if (!(p in PROGRAMME) || apiSchluessel.length < 10 || apiSchluessel.length > 300 || /\s/.test(apiSchluessel)) return antwort(programmFormular(bereiche, "Bitte das Programm wählen und den API-Schlüssel vollständig einfügen."), 400);
    let tabelle: string[][];
    try { tabelle = await PROGRAMME[p].laden(apiSchluessel); }
    catch (e) { return antwort(programmFormular(bereiche, e instanceof Error ? e.message : "Das Programm war nicht erreichbar."), 502); }
    if (tabelle.length < 2) return antwort(programmFormular(bereiche, `In ${PROGRAMME[p].name} wurden keine Kunden gefunden.`), 400);
    const [k, o] = await Promise.all([
      db<{ name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=name&limit=5000`),
      db<{ name: string; kunden: { name: string } | null }[]>(f.s, env, `einsatzorte?firma_id=eq.${firma}&select=name,kunden(name)&limit=5000`),
    ]);
    const erg = kundenLesen(tabelle, k.ok ? k.daten : [], (o.ok ? o.daten : []).map((x) => ({ name: x.name, kunde: x.kunden?.name ?? "" })));
    const key = crypto.randomUUID();
    await env.DATEN.put(ablage(key), JSON.stringify({ user: f.s.userId, erstellt: Date.now(), zeilen: erg.zeilen, bereich }));
    return antwort(vorschau("kunden", erg.zeilen, {}, key, PROGRAMME[p].name));
  }
  if (request.method !== "POST") return antwort(uploadSeite(art, bereiche));
  const form = await request.formData();
  const wahl = String(form.get("bereich") ?? "firma");
  const bereich = bereiche.some((b) => b.id === wahl) ? wahl : null;
  const datei = form.get("datei");
  if (!datei || typeof datei === "string" || datei.size < 1 || datei.size > 2 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(datei.name)) return antwort(uploadSeite(art, bereiche, "Bitte eine .xlsx- oder .csv-Datei mit höchstens 2 MB wählen."), 400);
  let tabelle: string[][];
  try {
    const bytes = new Uint8Array(await datei.arrayBuffer());
    tabelle = /\.xlsx$/i.test(datei.name) ? xlsxLesen(bytes) : csvLesen(textAus(bytes));
  } catch (e) {
    return antwort(uploadSeite(art, bereiche, e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden."), 400);
  }
  let erg: { zeilen: (KundeZeile | NachweisZeile)[]; spalten: Record<string, string> };
  if (art === "kunden") {
    const [k, o] = await Promise.all([
      db<{ name: string }[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=name&limit=5000`),
      db<{ name: string; kunden: { name: string } | null }[]>(f.s, env, `einsatzorte?firma_id=eq.${firma}&select=name,kunden(name)&limit=5000`),
    ]);
    erg = kundenLesen(tabelle, k.ok ? k.daten : [], (o.ok ? o.daten : []).map((x) => ({ name: x.name, kunde: x.kunden?.name ?? "" })));
    if (!erg.spalten.name) return antwort(uploadSeite(art, bereiche, `Keine Spalte „Kunde“, „Firma“ oder „Name“ gefunden. Gefunden: ${tabelle[0]?.filter(Boolean).slice(0, 8).join(", ") ?? "nichts"}.`), 400);
  } else {
    const [p, v] = await Promise.all([
      db<{ id: string; vorname: string; nachname: string }[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=5000`),
      db<{ personal_id: string; bezeichnung: string; gueltig_bis: string | null }[]>(f.s, env, `personal_nachweise?firma_id=eq.${firma}&select=personal_id,bezeichnung,gueltig_bis&limit=20000`),
    ]);
    erg = nachweiseLesen(tabelle, p.ok ? p.daten : [], v.ok ? v.daten : []);
    if (!erg.spalten.bezeichnung) return antwort(uploadSeite(art, bereiche, `Keine Spalte „Nachweis“ oder „Bezeichnung“ gefunden. Gefunden: ${tabelle[0]?.filter(Boolean).slice(0, 8).join(", ") ?? "nichts"}.`), 400);
  }
  if (!erg.zeilen.length) return antwort(uploadSeite(art, bereiche, "In der Datei stehen keine Daten. Die erste Zeile muss die Spaltennamen enthalten."), 400);
  const alt = await env.DATEN.list({ prefix: `importe/${firma}/` });
  await Promise.all(alt.objects.filter((o) => Date.now() - o.uploaded.getTime() > 3600_000).map((o) => env.DATEN!.delete(o.key)));
  const key = crypto.randomUUID();
  await env.DATEN.put(ablage(key), JSON.stringify({ user: f.s.userId, erstellt: Date.now(), zeilen: erg.zeilen, bereich }));
  return antwort(vorschau(art, erg.zeilen, erg.spalten, key, datei.name));
}
