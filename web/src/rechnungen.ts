// T34: Rechnungsentwurf. From the approved hours of a customer and month plus the hourly rate (and surcharge
// percentages) a draft invoice with consecutive number and the legal minimum content (§ 14 UStG) as Word. Nothing is
// sent; the firm checks and sends it itself. Finance access only.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { absatz, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";
import { dezimal, landDerFirma, minuten, naechsterMonat, type Eintrag } from "./stunden.ts";
import { summe, zuschlag } from "./zuschlaege.ts";
import { adresse, type Kunde } from "./kunden.ts";
import { xrechnungXml } from "./xrechnung.ts";

export type Position = { text: string; menge: number; einheit: string; preis: number; betrag: number };
export type Rechnung = { id: string; kunde_id: string | null; nummer: string; monat: string; datum: string; positionen: Position[]; netto: number | string; ust_satz: number | string; erstellt: string };
export type Preis = { satz: number; nacht: number; sonntag: number; feiertag: number };
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rund = (n: number) => Math.round(n * 100) / 100;
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Positions: hours × rate, plus surcharge lines (hours × rate × percent) when percentages are set. */
export function positionen(l: Eintrag[], p: Preis, land: string, monat: string): Position[] {
  const min = l.reduce((n, e) => n + minuten(e), 0), z = summe(l.map((e) => zuschlag(e, land)));
  const pos: Position[] = [{ text: `Personalgestellung ${monatName(monat)} lt. Leistungsnachweis`, menge: dezimal(min), einheit: "Std.", preis: p.satz, betrag: rund(dezimal(min) * p.satz) }];
  for (const [k, t] of [["nacht", "Nachtzuschlag"], ["sonntag", "Sonntagszuschlag"], ["feiertag", "Feiertagszuschlag"]] as const) {
    if (p[k] > 0 && z[k] > 0) { const preis = rund((p.satz * p[k]) / 100); pos.push({ text: `${t} ${zahl(p[k]).replace(",00", "")} %`, menge: dezimal(z[k]), einheit: "Std.", preis, betrag: rund(dezimal(z[k]) * preis) }); }
  }
  return pos;
}
/** Next number per year: RE-2026-0001, RE-2026-0002 … */
export function naechsteNummer(vorhanden: string[], jahr: string): string {
  const max = vorhanden.map((n) => new RegExp(`^RE-${jahr}-(\\d+)$`).exec(n)?.[1]).filter(Boolean).reduce((m, n) => Math.max(m, Number(n)), 0);
  return `RE-${jahr}-${String(max + 1).padStart(4, "0")}`;
}

export type Absender = { name: string; strasse: string; plz: string; ort: string; telefon: string; email: string; steuernummer: string; ustid: string; kleinunternehmer: boolean; zahlungshinweis: string };
export function rechnungDocx(r: Rechnung, kunde: Kunde | null, a: Absender): Uint8Array {
  const netto = Number(r.netto), ust = a.kleinunternehmer ? 0 : rund((netto * Number(r.ust_satz)) / 100);
  const faellig = new Date(Date.parse(`${r.datum}T12:00:00Z`) + 14 * 86400_000).toISOString().slice(0, 10);
  return wordDokument(absatz([a.name, adresse(a)].filter(Boolean).join(" · "), { grau: true, groesse: 16, abstand: 240 })
    + absatz([kunde?.name ?? "", kunde?.ansprechpartner ? `z. Hd. ${kunde.ansprechpartner}` : "", kunde?.strasse ?? "", [kunde?.plz, kunde?.ort].filter(Boolean).join(" ")].filter(Boolean).join("\n"), { abstand: 400 })
    + ueberschrift(`Rechnung ${r.nummer}`, 30)
    + tabelle([["Rechnungsdatum", datum(r.datum)], ["Leistungszeitraum", monatName(r.monat)], ["Rechnungsnummer", r.nummer]], [3200, 6400])
    + tabelle([["Pos.", "Leistung", "Menge", "Einzelpreis", "Betrag"], ...r.positionen.map((p, i) => [String(i + 1), p.text, `${zahl(p.menge)} ${p.einheit}`, euro(p.preis), euro(p.betrag)]),
      ["", "Summe netto", "", "", euro(netto)], ...(a.kleinunternehmer ? [] : [["", `zzgl. ${zahl(Number(r.ust_satz)).replace(",00", "")} % Umsatzsteuer`, "", "", euro(ust)]]), ["", "Rechnungsbetrag", "", "", euro(netto + ust)]], [600, 4300, 1400, 1600, 1700], true)
    + (a.kleinunternehmer ? absatz("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", { abstand: 160 }) : "")
    + absatz(`Zahlbar ohne Abzug bis ${datum(faellig)}.${a.zahlungshinweis ? `\n${a.zahlungshinweis}` : ""}`, { abstand: 300 })
    + absatz([a.steuernummer ? `Steuernummer: ${a.steuernummer}` : "", a.ustid ? `USt-IdNr.: ${a.ustid}` : "", a.telefon ? `Telefon: ${a.telefon}` : "", a.email ? `E-Mail: ${a.email}` : ""].filter(Boolean).join(" · ") || "Steuernummer bitte im Firmenprofil eintragen.", { grau: true, groesse: 16 }));
}

export function rechnungenSeite(liste: Rechnung[], kunden: Kunde[], o: { fehlt: string[] }): string {
  const kName = (id: string | null) => kunden.find((k) => k.id === id)?.name ?? "Kunde gelöscht";
  return `<p class="klein">Rechnungsentwürfe aus dem Leistungsnachweis (dort pro Kunde „🧾 Rechnung“). Die Nummern laufen pro Jahr fortlaufend. Jarvis verschickt nichts; bitte prüfen und selbst versenden. „🧾 E-Rechnung“ lädt die Rechnung als XRechnung (für Behörden; Leitweg-ID bei Bedarf in der Kunden-Notiz als „Leitweg-ID: …“).</p>
${o.fehlt.length ? `<p class="hinweis">⚠️ Für vollständige Rechnungen fehlt im <a href="/konto/firmenprofil">Firmenprofil</a>: ${o.fehlt.join(", ")}</p>` : ""}
${liste.length ? `<ul class="kontakt-liste">${liste.map((r) => `<li><div><strong>${escape(r.nummer)} · ${escape(kName(r.kunde_id))}</strong><span class="klein">${datum(r.datum)} · ${monatName(r.monat)} · ${euro(Number(r.netto))} netto</span></div><span class="knopf-zeile"><a class="knopf zweit" href="/konto/rechnungen/${r.id}.docx" download>📄 Word</a><a class="knopf zweit" href="/konto/rechnungen/${r.id}.xml" download title="E-Rechnung im Format XRechnung (z. B. für Behörden)">🧾 E-Rechnung</a><form method="post" action="/konto/rechnungen"><input type="hidden" name="loeschen" value="${r.id}"><button class="zweit" aria-label="Entwurf löschen">✕</button></form></span></li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Rechnungen.</p>`}`;
}

export async function rechnungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const docx = url.pathname.match(/^\/konto\/rechnungen\/([0-9a-f-]{36})\.(docx|xml)$/);
  if (url.pathname !== "/konto/rechnungen" && !docx) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Rechnungen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen || !["inhaber", "admin", "bearbeiter"].includes(f.m.rolle)) return antwort("<p>Rechnungen sehen Personen mit Finanzfreigabe.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const absender = async (): Promise<Absender> => {
    const [fi, pr] = await Promise.all([
      db<{ name: string; strasse: string | null; plz: string | null; ort: string | null; telefon: string | null }[]>(f.s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort,telefon`),
      db<{ email: string; ustid: string; steuernummer: string; kleinunternehmer: boolean; zahlungshinweis: string }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=email,ustid,steuernummer,kleinunternehmer,zahlungshinweis`),
    ]);
    const a = fi.ok ? fi.daten[0] : undefined, p = pr.ok ? pr.daten[0] : undefined;
    return { name: a?.name ?? "", strasse: a?.strasse ?? "", plz: a?.plz ?? "", ort: a?.ort ?? "", telefon: a?.telefon ?? "", email: p?.email ?? "", ustid: p?.ustid ?? "", steuernummer: p?.steuernummer ?? "", kleinunternehmer: !!p?.kleinunternehmer, zahlungshinweis: p?.zahlungshinweis ?? "" };
  };
  if (docx) {
    const r = await db<Rechnung[]>(f.s, env, `rechnungen?id=eq.${docx[1]}&firma_id=eq.${firma}&select=id,kunde_id,nummer,monat,datum,positionen,netto,ust_satz,erstellt`);
    const x = r.ok ? r.daten[0] : undefined;
    if (!x) return new Response("Nicht gefunden", { status: 404 });
    const k = x.kunde_id ? await db<Kunde[]>(f.s, env, `kunden?id=eq.${x.kunde_id}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz`) : null;
    const kunde = k?.ok ? k.daten[0] ?? null : null;
    if (docx[2] === "xml") {
      // Leitweg-ID of public buyers (BT-10): from the customer note ("Leitweg-ID: 05315-…"), otherwise the invoice number.
      const leitweg = /Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})/i.exec(kunde?.notiz ?? "")?.[1] ?? "";
      const h = new Headers({ "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="${x.nummer}.xml"` });
      for (const c of f.s.cookies ?? []) h.append("set-cookie", c);
      return new Response(xrechnungXml(x, kunde, await absender(), leitweg), { headers: h });
    }
    return wordAntwort(rechnungDocx(x, kunde, await absender()), `${x.nummer}.docx`, f.s.cookies);
  }
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/rechnungen?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const weg = String(form.get("loeschen") ?? "");
    if (/^[0-9a-f-]{36}$/.test(weg)) { const r = await db(f.s, env, `rechnungen?id=eq.${weg}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck(r.ok ? "Entwurf gelöscht. Achtung: Die Nummer wird nicht neu vergeben." : "Löschen hat nicht geklappt."); }
    const kid = String(form.get("kunde") ?? ""), monat = String(form.get("monat") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(kid) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return zurueck("Kunde oder Monat fehlt.");
    const [l, pr, alt, land] = await Promise.all([
      db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&kunde_id=eq.${kid}&status=eq.freigegeben&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status&limit=10000`),
      db<{ satz: number | string; zuschlag_nacht: number | string; zuschlag_sonntag: number | string; zuschlag_feiertag: number | string }[]>(f.s, env, `kunden_preise?firma_id=eq.${firma}&kunde_id=eq.${kid}&select=satz,zuschlag_nacht,zuschlag_sonntag,zuschlag_feiertag`),
      db<{ nummer: string }[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&nummer=like.RE-${heute.slice(0, 4)}-*&select=nummer&limit=10000`),
      landDerFirma(f.s, env, firma),
    ]);
    const p = pr.ok ? pr.daten[0] : undefined;
    if (!p) return zurueck("Für diesen Kunden ist kein Verrechnungssatz hinterlegt (Kunden & Einsatzorte).");
    if (!l.ok || !l.daten.length) return zurueck("Keine freigegebenen Stunden für diesen Kunden und Monat.");
    const pos = positionen(l.daten, { satz: Number(p.satz), nacht: Number(p.zuschlag_nacht), sonntag: Number(p.zuschlag_sonntag), feiertag: Number(p.zuschlag_feiertag) }, land, monat);
    const nummern = alt.ok ? alt.daten.map((x) => x.nummer) : [];
    for (let versuch = 0; versuch < 3; versuch++) {
      const nummer = naechsteNummer(nummern, heute.slice(0, 4));
      const r = await db<{ id: string }[]>(f.s, env, "rechnungen?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, kunde_id: kid, nummer, monat, datum: heute, positionen: pos, netto: rund(pos.reduce((n, x) => n + x.betrag, 0)), ust_satz: 19 }) });
      if (r.ok && r.daten.length) return zurueck(`Rechnungsentwurf ${nummer} erstellt.`);
      nummern.push(nummer);
    }
    return zurueck("Rechnung konnte nicht angelegt werden.");
  }
  const [l, k, a] = await Promise.all([
    db<Rechnung[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&select=id,kunde_id,nummer,monat,datum,positionen,netto,ust_satz,erstellt&order=erstellt.desc&limit=500`),
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz&limit=1000`),
    absender(),
  ]);
  const fehlt = [!a.steuernummer && !a.ustid ? "Steuernummer oder USt-IdNr." : "", !a.strasse || !a.ort ? "Anschrift" : "", !a.zahlungshinweis ? "Zahlungshinweis (z. B. Bankverbindung)" : ""].filter(Boolean);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${rechnungenSeite(l.ok ? l.daten : [], k.ok ? k.daten : [], { fehlt })}`);
}
