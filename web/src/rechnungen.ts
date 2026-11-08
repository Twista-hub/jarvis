// T34: Rechnungen. From the approved hours of a customer and month plus the hourly rate (and surcharge percentages) a
// draft with the legal minimum content (§ 14 UStG) as Word. Nothing is sent; the firm checks and sends it itself.
// GoBD (Rechtsprüfung 03.11.2026, migration 20261103110000): a draft has no number and shows today's master data; on
// "Ausstellen" the database gives the next number of the year and freezes sender, recipient and VAT. An issued invoice
// cannot be changed or deleted, only cancelled by a cancellation invoice (Storno). Finance access only.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { absatz, bild, bildMasse, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";
import { mitLand, einsatzLaender, dezimal, landDerFirma, minuten, naechsterMonat, type Eintrag } from "./stunden.ts";
import { summe, zuschlag } from "./zuschlaege.ts";
import { adresse, landZeile, type Kunde } from "./kunden.ts";
import { fehlendFuerXRechnung, xrechnungXml } from "./xrechnung.ts";

export type Position = { text: string; menge: number; einheit: string; preis: number; betrag: number };
export type Empfaenger = { name: string; ansprechpartner?: string; strasse?: string; plz?: string; ort?: string; land?: string; privat?: boolean; email?: string; leitweg?: string; ustid?: string };
export type Rechnung = { id: string; kunde_id: string | null; nummer: string; monat: string; datum: string; positionen: Position[]; netto: number | string; ust_satz: number | string; erstellt: string; bezahlt_am?: string | null; mahnstufe?: number; gemahnt_am?: string | null; zahlungsziel_tage?: number;
  status?: "entwurf" | "ausgestellt"; art?: "rechnung" | "storno"; bezug_nummer?: string; storniert_durch?: string | null; absender?: Omit<Absender, "kleinunternehmer"> | null; empfaenger?: Empfaenger | null; kleinunternehmer?: boolean | null; ust_betrag?: number | string | null; reverse_charge?: boolean; reverse_charge_eu?: boolean };
/** Columns the pages read. */
export const RECHNUNG_SPALTEN = "id,kunde_id,nummer,monat,datum,positionen,netto,ust_satz,erstellt,bezahlt_am,mahnstufe,gemahnt_am,zahlungsziel_tage,status,art,bezug_nummer,storniert_durch,absender,empfaenger,kleinunternehmer,ust_betrag,reverse_charge,reverse_charge_eu";
export const istEntwurf = (r: Pick<Rechnung, "status">) => r.status === "entwurf";
/** VAT of an invoice: frozen amount once issued, otherwise computed from today's small-business setting. */
export const ustVon = (r: Rechnung, kleinunternehmer: boolean) => r.ust_betrag !== null && r.ust_betrag !== undefined && !istEntwurf(r) ? Number(r.ust_betrag) : (r.kleinunternehmer ?? kleinunternehmer) ? 0 : rund((Number(r.netto) * Number(r.ust_satz)) / 100);
/** Sender and recipient as printed: frozen copy once issued, otherwise today's data. */
export function beteiligte(r: Rechnung, kunde: Kunde | null, a: Absender): { a: Absender; kunde: Kunde | null } {
  if (istEntwurf(r) || !r.absender) return { a, kunde };
  const e = r.empfaenger;
  return { a: { ...r.absender, kleinunternehmer: !!r.kleinunternehmer }, kunde: e ? { ...(kunde ?? {}), id: kunde?.id ?? "", bereich_id: kunde?.bereich_id ?? null, name: e.name, ansprechpartner: e.ansprechpartner ?? "", strasse: e.strasse ?? "", plz: e.plz ?? "", ort: e.ort ?? "", land: e.land || kunde?.land || "DE", email: e.email ?? "", ustid: e.ustid ?? kunde?.ustid ?? "", leitweg_id: e.leitweg ?? "", telefon: kunde?.telefon ?? "", notiz: e.leitweg ? `Leitweg-ID: ${e.leitweg}` : "" } as Kunde : kunde };
}
export const KU_HINWEIS = "Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung nach § 19 Abs. 1 UStG.";
/** § 14a Abs. 5 UStG: mandatory wording when the customer owes the VAT (§ 13b). */
export const RC_HINWEIS = "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).";
/** Reverse charge for a business customer in another EU country (§ 14a Abs. 1 UStG; Art. 196 MwStSystRL). */
export const RC_EU_HINWEIS = "Steuerschuldnerschaft des Leistungsempfängers / Reverse charge (Art. 196 MwStSystRL).";
/** Kind of reverse charge: frozen once issued, otherwise today's customer setting. */
export const istReverseChargeEu = (r: Rechnung, kunde: Kunde | null) => (istEntwurf(r) ? !!kunde?.reverse_charge_eu : !!r.reverse_charge_eu);
/** Reverse charge: frozen once issued; for a draft from today's customer setting (never for small businesses). */
/** § 14 Abs. 4 Satz 1 Nr. 9 UStG: note on the private recipient's two-year retention duty (§ 14b Abs. 1 Satz 5 UStG). */
export const PRIVAT_HINWEIS = "Sie sind als Privatperson gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren. Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die Rechnung ausgestellt wurde (§ 14b Abs. 1 Satz 5 UStG).";
/** Private customer: frozen once issued, otherwise today's customer setting. */
export const istPrivat = (r: Rechnung, kunde: Kunde | null) => (istEntwurf(r) || !r.empfaenger ? !!kunde?.privat : !!r.empfaenger.privat);
export const istReverseCharge = (r: Rechnung, kunde: Kunde | null, kleinunternehmer: boolean) => istEntwurf(r) ? (!!kunde?.ust_13b || !!kunde?.reverse_charge_eu) && !kleinunternehmer : !!r.reverse_charge;
export const neueEntwurfsnummer = () => `ENTWURF-${crypto.randomUUID().slice(0, 8)}`;
/** Invoice template from the firm profile (Rechnungsvorlage): logo, opening and closing text, footer lines. */
export type Vorlage2 = { logo?: { bytes: Uint8Array; typ: "png" | "jpeg" } | null; einleitung?: string; schluss?: string; fuss?: string[] };
/** Footer from the firm profile: legal form, register, management, contact (shown small at the end). */
export function fusszeilen(p: { rechtsform?: string; registergericht?: string; registernummer?: string; geschaeftsfuehrung?: string; website?: string }): string[] {
  return [p.registergericht && p.registernummer ? `${p.registergericht} ${p.registernummer}` : "", p.geschaeftsfuehrung ? `Geschäftsführung: ${p.geschaeftsfuehrung}` : "", p.website ?? ""].filter(Boolean);
}
export type Preis = { satz: number; nacht: number; sonntag: number; feiertag: number };
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rund = (n: number) => Math.round(n * 100) / 100;
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monatName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const tagePlus = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Positions: hours × rate, plus surcharge lines (hours × rate × percent) when percentages are set. The main line uses
 *  the customer's service text with the month (Rechtsprüfung S16), otherwise "Leistungen <Monat> lt. Leistungsnachweis". */
export function positionen(l: Eintrag[], p: Preis & { text?: string }, land: string, monat: string): Position[] {
  const min = l.reduce((n, e) => n + minuten(e), 0), z = summe(l.map((e) => zuschlag(e, land)));
  const eigen = (p.text ?? "").replace(/\s+/g, " ").trim();
  const pos: Position[] = [{ text: eigen ? `${eigen} ${monatName(monat)}` : `Leistungen ${monatName(monat)} lt. Leistungsnachweis`, menge: dezimal(min), einheit: "Std.", preis: p.satz, betrag: rund(dezimal(min) * p.satz) }];
  for (const [k, t] of [["nacht", "Nachtzuschlag"], ["sonntag", "Sonntagszuschlag"], ["feiertag", "Feiertagszuschlag"]] as const) {
    if (p[k] > 0 && z[k] > 0) { const preis = rund((p.satz * p[k]) / 100); pos.push({ text: `${t} ${zahl(p[k]).replace(",00", "")} %`, menge: dezimal(z[k]), einheit: "Std.", preis, betrag: rund(dezimal(z[k]) * preis) }); }
  }
  return pos;
}

export type Absender = { name: string; strasse: string; plz: string; ort: string; land?: string; telefon: string; email: string; steuernummer: string; ustid: string; kleinunternehmer: boolean; zahlungshinweis: string };
export function rechnungDocx(r: Rechnung, kundeHeute: Kunde | null, absenderHeute: Absender, vorlage: Vorlage2 = {}): Uint8Array {
  const { a, kunde } = beteiligte(r, kundeHeute, absenderHeute);
  const entwurf = istEntwurf(r), storno = r.art === "storno";
  const rc = istReverseCharge(r, kundeHeute, a.kleinunternehmer);
  const netto = Number(r.netto), ust = rc ? 0 : ustVon(r, a.kleinunternehmer);
  const faellig = tagePlus(r.datum, r.zahlungsziel_tage ?? 14);
  const titel = entwurf ? "Rechnungsentwurf – nicht versenden" : storno ? `Stornorechnung ${r.nummer}` : `Rechnung ${r.nummer}`;
  const kopf: string[][] = entwurf ? [["Leistungszeitraum", monatName(r.monat)], ["Rechnungsnummer", "wird beim Ausstellen vergeben"]]
    : [["Rechnungsdatum", datum(r.datum)], ["Leistungszeitraum", monatName(r.monat)], ["Rechnungsnummer", r.nummer], ...(storno ? [["Storno der Rechnung", r.bezug_nummer ?? ""]] : [])];
  const masse = vorlage.logo ? bildMasse(vorlage.logo.bytes) : null;
  const logoHoehe = 1.6, logoBreite = masse && masse.h ? Math.min(7, logoHoehe * masse.w / masse.h) : 4;
  return wordDokument((vorlage.logo ? bild(1, logoBreite, logoHoehe) : "") + absatz([a.name, adresse(a)].filter(Boolean).join(" · "), { grau: true, groesse: 16, abstand: 240 })
    + absatz([kunde?.name ?? "", kunde?.ansprechpartner ? `z. Hd. ${kunde.ansprechpartner}` : "", kunde?.strasse ?? "", [kunde?.plz, kunde?.ort].filter(Boolean).join(" "), landZeile(kunde)].filter(Boolean).join("\n"), { abstand: 400 })
    + ueberschrift(titel, 30)
    + (vorlage.einleitung && !storno ? absatz(vorlage.einleitung, { abstand: 200 }) : "")
    + tabelle(kopf, [3200, 6400])
    + tabelle([["Pos.", "Leistung", "Menge", "Einzelpreis", "Betrag"], ...r.positionen.map((p, i) => [String(i + 1), p.text, `${zahl(p.menge)} ${p.einheit}`, euro(p.preis), euro(p.betrag)]),
      ["", "Summe netto", "", "", euro(netto)], ...(a.kleinunternehmer || rc ? [] : [["", `zzgl. ${zahl(Number(r.ust_satz)).replace(",00", "")} % Umsatzsteuer`, "", "", euro(ust)]]), ["", "Rechnungsbetrag", "", "", euro(netto + ust)]], [600, 4300, 1400, 1600, 1700], true)
    + (a.kleinunternehmer ? absatz(KU_HINWEIS, { abstand: 160 }) : "")
    + (istPrivat(r, kundeHeute) ? absatz(PRIVAT_HINWEIS, { abstand: 160 }) : "")
    + (rc ? absatz(`${istReverseChargeEu(r, kundeHeute) ? RC_EU_HINWEIS : RC_HINWEIS}${(r.empfaenger?.ustid || kundeHeute?.ustid) ? ` USt-IdNr. des Leistungsempfängers: ${r.empfaenger?.ustid || kundeHeute?.ustid}` : ""}${istReverseChargeEu(r, kundeHeute) && a.ustid ? ` · Unsere USt-IdNr.: ${a.ustid}` : ""}`, { abstand: 160 }) : "")
    + (storno ? absatz(`Diese Stornorechnung hebt die Rechnung ${r.bezug_nummer ?? ""} vollständig auf.`, { abstand: 300 })
      : absatz(`Zahlbar ohne Abzug bis ${entwurf ? `${r.zahlungsziel_tage ?? 14} Tage nach Rechnungsdatum` : datum(faellig)}.${a.zahlungshinweis ? `\n${a.zahlungshinweis}` : ""}`, { abstand: 300 }))
    + (vorlage.schluss ? absatz(vorlage.schluss, { abstand: 300 }) : "")
    + absatz([a.steuernummer ? `Steuernummer: ${a.steuernummer}` : "", a.ustid ? `USt-IdNr.: ${a.ustid}` : "", a.telefon ? `Telefon: ${a.telefon}` : "", a.email ? `E-Mail: ${a.email}` : "", ...(vorlage.fuss ?? [])].filter(Boolean).join(" · ") || "Steuernummer bitte im Firmenprofil eintragen.", { grau: true, groesse: 16 }),
    vorlage.logo ? [{ id: 1, png: vorlage.logo.bytes, typ: vorlage.logo.typ }] : []);
}

const MAHNSTUFE = ["", "Zahlungserinnerung", "1. Mahnung", "2. Mahnung"];

/** Payment status of an invoice on a given day (Berlin date): paid, open until the due date, or overdue by n days. */
export function zahlstatus(r: Rechnung, heute: string): { art: "bezahlt" | "offen" | "ueberfaellig" | "storniert" | "entwurf"; faellig: string; tage: number } {
  const faellig = tagePlus(r.datum, r.zahlungsziel_tage ?? 14);
  if (istEntwurf(r)) return { art: "entwurf", faellig, tage: 0 };
  if (r.storniert_durch || r.art === "storno") return { art: "storniert", faellig, tage: 0 };
  if (r.bezahlt_am) return { art: "bezahlt", faellig, tage: 0 };
  const tage = Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${faellig}T12:00:00Z`)) / 86400_000);
  return tage > 0 ? { art: "ueberfaellig", faellig, tage } : { art: "offen", faellig, tage };
}

/** Dunning letter for the current level (1 reminder, 2 first, 3 second dunning); new deadline 7 days, no fees added. */
export function mahnungDocx(r: Rechnung, kundeHeute: Kunde | null, absenderHeute: Absender, heute: string): Uint8Array {
  const { a, kunde } = beteiligte(r, kundeHeute, absenderHeute);
  const netto = Number(r.netto), betragGesamt = netto + ustVon(r, a.kleinunternehmer);
  const stufe = Math.min(3, Math.max(1, r.mahnstufe ?? 1));
  const frist = datum(tagePlus(heute, 7));
  const privat = istPrivat(r, kundeHeute);
  const text = stufe === 1
    ? `sicher ist es Ihrer Aufmerksamkeit entgangen: Für unsere Rechnung ${r.nummer} vom ${datum(r.datum)} konnten wir noch keinen Zahlungseingang feststellen. Wir bitten Sie, den Betrag bis zum ${frist} zu überweisen. Sollten Sie inzwischen bezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.`
    : stufe === 2
      ? `leider ist unsere Rechnung ${r.nummer} vom ${datum(r.datum)} trotz Zahlungserinnerung weiterhin offen. Wir bitten Sie, den Betrag bis spätestens ${frist} zu begleichen.`
      : `trotz Zahlungserinnerung und Mahnung ist unsere Rechnung ${r.nummer} vom ${datum(r.datum)} noch immer nicht bezahlt. Bitte überweisen Sie den Betrag bis spätestens ${frist}. Nach Ablauf dieser Frist behalten wir uns weitere Schritte vor, insbesondere ${privat ? "Verzugszinsen in Höhe von 5 Prozentpunkten über dem Basiszinssatz (§ 288 Abs. 1 BGB)." : "Verzugszinsen (§ 288 BGB, gegenüber Unternehmern 9 Prozentpunkte über dem Basiszinssatz) und die Verzugspauschale von 40 € (§ 288 Abs. 5 BGB)."}`;
  return wordDokument(absatz([a.name, adresse(a)].filter(Boolean).join(" · "), { grau: true, groesse: 16, abstand: 240 })
    + absatz([kunde?.name ?? "", kunde?.ansprechpartner ? `z. Hd. ${kunde.ansprechpartner}` : "", kunde?.strasse ?? "", [kunde?.plz, kunde?.ort].filter(Boolean).join(" "), landZeile(kunde)].filter(Boolean).join("\n"), { abstand: 400 })
    + absatz(datum(heute), { abstand: 240 })
    + ueberschrift(`${MAHNSTUFE[stufe]} zur Rechnung ${r.nummer}`, 28)
    + absatz(`${privat && kunde?.name ? `Guten Tag ${kunde.name},` : "Sehr geehrte Damen und Herren,"}\n\n${text}`, { abstand: 240 })
    + tabelle([["Rechnung", r.nummer], ["Rechnungsdatum", datum(r.datum)], ["Fällig seit", datum(zahlstatus(r, heute).faellig)], ["Offener Betrag", euro(betragGesamt)], ["Zahlbar bis", frist]], [3200, 6400])
    + absatz(`${a.zahlungshinweis ? `${a.zahlungshinweis}\n\n` : ""}Mit freundlichen Grüßen\n${a.name}`, { abstand: 300 }));
}

export type Vorlage = { id: string; kunde_id: string; text: string; betrag: number | string; aktiv: boolean; letzter_monat: string | null };

/** Positions of a recurring invoice: one flat line "<text> <month>". */
export function vorlagePositionen(v: Vorlage, monat: string): Position[] {
  const b = rund(Number(v.betrag));
  return [{ text: `${v.text} ${monatName(monat)}`, menge: 1, einheit: "pauschal", preis: b, betrag: b }];
}

/** Templates still to be billed for this month (active, not yet billed for it). */
export const offeneVorlagen = (l: Vorlage[], monat: string) => l.filter((v) => v.aktiv && (v.letzter_monat ?? "") < monat);

/** Stored original of an issued invoice (GoBD: the document as handed out, independent of later template changes). */
export const originalSchluessel = (firma: string, id: string) => `rechnungen/${firma}/${id}.docx`;

/** Invoice template of a firm: logo from the firm profile, opening/closing text, footer lines. */
export async function vorlageLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Vorlage2> {
  const p = await db<{ logo: string | null; rechnung_einleitung: string; rechnung_schluss: string; rechtsform: string; registergericht: string; registernummer: string; geschaeftsfuehrung: string; website: string }[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=logo,rechnung_einleitung,rechnung_schluss,rechtsform,registergericht,registernummer,geschaeftsfuehrung,website`);
  const x = p.ok ? p.daten[0] : undefined;
  const obj = x?.logo ? await env.DATEN?.get(`firmenlogo/${firma}`) : null;
  return { logo: obj ? { bytes: new Uint8Array(await obj.arrayBuffer()), typ: x!.logo === "image/png" ? "png" : "jpeg" } : null, einleitung: x?.rechnung_einleitung ?? "", schluss: x?.rechnung_schluss ?? "", fuss: x ? fusszeilen(x) : [] };
}

export function vorlageFormular(v: { einleitung: string; schluss: string; logo: boolean }): string {
  return `<details><summary>🧾 Rechnungsvorlage (Logo, Texte)</summary><form method="post" action="/konto/rechnungen" class="formular-zeile">
<input type="hidden" name="aktion" value="vorlage"><label class="ganz">Einleitung (über den Positionen)<textarea name="rechnung_einleitung" rows="2" maxlength="1000" placeholder="z. B. Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:">${escape(v.einleitung)}</textarea></label>
<label class="ganz">Schlusstext (unter dem Zahlungshinweis)<textarea name="rechnung_schluss" rows="2" maxlength="1000" placeholder="z. B. Mit freundlichen Grüßen">${escape(v.schluss)}</textarea></label><button class="zweit">Vorlage speichern</button></form>
<p class="klein">${v.logo ? "✓ Das Logo aus dem Firmenprofil steht oben auf jeder Rechnung." : "Kein Logo: Ein Logo lädst du im <a href=\"/konto/firmenprofil\">Firmenprofil</a> hoch."} Die Fußzeile füllt Crewtender aus dem Firmenprofil (Steuernummer, Kontakt, Registergericht, Geschäftsführung). Beim Ausstellen speichert Crewtender die fertige Rechnung, spätere Änderungen an der Vorlage ändern sie nicht mehr. <a href="/konto/rechnungen/vorschau.docx" download>📄 Vorschau mit Beispieldaten</a></p></details>`;
}

export function vorlagenBereich(vorlagen: Vorlage[], kunden: Kunde[], monat: string): string {
  const kName = (id: string) => kunden.find((k) => k.id === id)?.name ?? "Kunde gelöscht";
  const offen = offeneVorlagen(vorlagen, monat);
  return `<details${vorlagen.length ? "" : " open"}><summary>🔁 Wiederkehrende Rechnungen (${vorlagen.length})</summary>
<p class="klein">Feste Monatsbeträge, z. B. Unterhaltsreinigung pauschal. Einmal pro Monat erstellt Crewtender daraus nummerierte Entwürfe.</p>
${vorlagen.length ? `<ul class="kontakt-liste">${vorlagen.map((v) => `<li><div><strong>${escape(kName(v.kunde_id))}</strong><span class="klein">${escape(v.text)} · ${euro(Number(v.betrag))} netto / Monat${v.letzter_monat ? ` · zuletzt ${monatName(v.letzter_monat)}` : ""}${v.aktiv ? "" : " · pausiert"}</span></div><form method="post" action="/konto/rechnungen"><input type="hidden" name="vorlage_weg" value="${v.id}"><button class="zweit" aria-label="Vorlage löschen">✕</button></form></li>`).join("")}</ul>` : ""}
${offen.length ? `<form method="post" action="/konto/rechnungen"><input type="hidden" name="vorlagen_monat" value="${monat}"><button>Rechnungen für ${monatName(monat)} erstellen (${offen.length})</button></form>` : vorlagen.length ? `<p class="klein">✓ Für ${monatName(monat)} sind alle wiederkehrenden Rechnungen erstellt.</p>` : ""}
${kunden.length ? `<form method="post" action="/konto/rechnungen" class="formular-zeile"><label>Kunde <select name="vorlage_kunde" required>${kunden.map((k) => `<option value="${k.id}">${escape(k.name)}</option>`).join("")}</select></label><label>Leistung <input name="vorlage_text" required maxlength="200" placeholder="Unterhaltsreinigung pauschal"></label><label>Betrag netto (€) <input name="vorlage_betrag" required inputmode="decimal" placeholder="1200"></label><button class="zweit">Vorlage speichern</button></form>` : `<p class="klein">Zuerst unter Kunden &amp; Einsatzorte einen Kunden anlegen.</p>`}
</details>`;
}

export function rechnungenSeite(liste: Rechnung[], kunden: Kunde[], o: { fehlt: string[]; heute?: string; kleinunternehmer?: boolean }): string {
  const kName = (id: string | null) => kunden.find((k) => k.id === id)?.name ?? "Kunde gelöscht";
  const heute = o.heute ?? new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const brutto = (r: Rechnung) => Number(r.netto) + ustVon(r, !!o.kleinunternehmer);
  const offen = liste.filter((r) => ["offen", "ueberfaellig"].includes(zahlstatus(r, heute).art)), ueber = offen.filter((r) => zahlstatus(r, heute).art === "ueberfaellig");
  const nummerVon = (id: string | null | undefined) => liste.find((x) => x.id === id)?.nummer ?? "";
  const summe = (l: Rechnung[]) => euro(l.reduce((n, r) => n + brutto(r), 0));
  const status = (r: Rechnung) => {
    const z = zahlstatus(r, heute);
    if (z.art === "entwurf") return "📝 Entwurf, noch nicht ausgestellt";
    if (z.art === "storniert") return r.art === "storno" ? `↩︎ Stornorechnung zu ${escape(r.bezug_nummer ?? "")}` : `↩︎ storniert durch ${escape(nummerVon(r.storniert_durch))}`;
    return z.art === "bezahlt" ? `✅ bezahlt am ${datum(r.bezahlt_am!)}` : z.art === "ueberfaellig" ? `<strong class="frist-bald">⚠️ ${z.tage} Tage überfällig</strong>${r.mahnstufe ? ` · ${MAHNSTUFE[r.mahnstufe]} am ${datum(r.gemahnt_am ?? heute)}` : ""}` : `offen, fällig ${datum(z.faellig)}`;
  };
  const knoepfe = (r: Rechnung) => {
    const z = zahlstatus(r, heute);
    const form = (feld: string, text: string, label: string) => `<form method="post" action="/konto/rechnungen"><input type="hidden" name="${feld}" value="${r.id}"><button class="zweit" ${label ? `aria-label="${label}"` : ""}>${text}</button></form>`;
    const word = `<a class="knopf zweit" href="/konto/rechnungen/${r.id}.docx" download>📄 Word${z.art === "entwurf" ? " (Entwurf)" : ""}</a>`;
    if (z.art === "entwurf") return `<form method="post" action="/konto/rechnungen"><input type="hidden" name="ausstellen" value="${r.id}"><button>✓ Ausstellen</button></form>${word}${form("loeschen", "✕", "Entwurf löschen")}`;
    const xml = `<a class="knopf zweit" href="/konto/rechnungen/${r.id}.xml" download title="E-Rechnung im Format XRechnung">🧾 E-Rechnung</a>`;
    const storno = r.art !== "storno" && z.art !== "storniert" ? `<details class="storno"><summary class="knopf zweit">↩︎ Stornieren</summary><form method="post" action="/konto/rechnungen"><input type="hidden" name="stornieren" value="${r.id}"><p class="klein">Erstellt eine Stornorechnung mit eigener Nummer, die diese Rechnung vollständig aufhebt. Das lässt sich nicht rückgängig machen.</p><button>Ja, Stornorechnung erstellen</button></form></details>` : "";
    if (z.art === "storniert") return `${word}${xml}`;
    return (z.art === "bezahlt" ? form("offen", "↩︎", "Wieder als offen markieren")
      : form("bezahlt", "✓ Bezahlt", "") + (z.art === "ueberfaellig" && (r.mahnstufe ?? 0) < 3 ? form("mahnen", `✉️ ${MAHNSTUFE[(r.mahnstufe ?? 0) + 1]}`, "") : "")
        + (r.mahnstufe ? `<a class="knopf zweit" href="/konto/rechnungen/${r.id}.mahnung.docx" download>📄 ${MAHNSTUFE[r.mahnstufe]}</a>` : "")) + word + xml + storno;
  };
  return `<p class="klein">Rechnungsentwürfe entstehen aus dem Leistungsnachweis (dort pro Kunde „🧾 Rechnung“) oder aus wiederkehrenden Rechnungen. Erst „✓ Ausstellen“ vergibt die fortlaufende Nummer und das Rechnungsdatum; danach ist die Rechnung unveränderlich und lässt sich nur noch stornieren (Pflicht nach GoBD). Crewtender verschickt nichts; bitte prüfen und selbst versenden. „🧾 E-Rechnung“ lädt die Rechnung als XRechnung: Behörden verlangen sie schon heute (Leitweg-ID in der Kunden-Notiz als „Leitweg-ID: …“), zwischen Unternehmen wird sie ab 2027/2028 Pflicht. <a href="/konto/archiv.zip" download>⬇ Archiv aller Rechnungen und Belege (ZIP)</a></p>
${o.fehlt.length ? `<p class="hinweis">⚠️ Für vollständige Rechnungen fehlt im <a href="/konto/firmenprofil">Firmenprofil</a>: ${o.fehlt.join(", ")}</p>` : ""}
${liste.length ? `<p class="gewerk-zahlen"><span><strong>${summe(offen)}</strong> offen (${offen.length})</span>${ueber.length ? ` <span><strong>${summe(ueber)}</strong> überfällig (${ueber.length})</span>` : ""}</p>` : ""}
${liste.length ? `<ul class="kontakt-liste">${liste.map((r) => `<li><div><strong>${istEntwurf(r) ? "Entwurf" : escape(r.nummer)} · ${escape(r.empfaenger?.name ?? kName(r.kunde_id))}</strong><span class="klein">${istEntwurf(r) ? "" : `${datum(r.datum)} · `}${monatName(r.monat)} · ${euro(Number(r.netto))} netto · ${status(r)}</span></div><span class="knopf-zeile">${knoepfe(r)}</span></li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Rechnungen.</p>`}`;
}

/** Read-only view (tax adviser): all buttons that change something are forms; downloads are links and stay. */
export const ohneFormulare = (h: string) => h.replace(/<form[\s\S]*?<\/form>/g, "");

export async function rechnungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const docx = url.pathname.match(/^\/konto\/rechnungen\/([0-9a-f-]{36})\.(docx|xml|mahnung\.docx)$/);
  if (url.pathname !== "/konto/rechnungen" && url.pathname !== "/konto/rechnungen/vorschau.docx" && !docx) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Rechnungen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!f.finanzen || !["inhaber", "admin", "bearbeiter", "leser"].includes(f.m.rolle)) return antwort("<p>Rechnungen sehen Personen mit Finanzfreigabe.</p>", 403);
  const nurLesen = f.m.rolle === "leser"; // tax adviser: read and download only
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const absender = async (): Promise<Absender> => {
    const [fi, pr] = await Promise.all([
      db<{ name: string; strasse: string | null; plz: string | null; ort: string | null; telefon: string | null }[]>(f.s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort,telefon`),
      db<{ email: string; ustid: string; steuernummer: string; kleinunternehmer: boolean; zahlungshinweis: string; land: string | null }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=email,ustid,steuernummer,kleinunternehmer,zahlungshinweis,land`),
    ]);
    const a = fi.ok ? fi.daten[0] : undefined, p = pr.ok ? pr.daten[0] : undefined;
    return { name: a?.name ?? "", strasse: a?.strasse ?? "", plz: a?.plz ?? "", ort: a?.ort ?? "", land: p?.land && p.land !== "XX" ? p.land : "DE", telefon: a?.telefon ?? "", email: p?.email ?? "", ustid: p?.ustid ?? "", steuernummer: p?.steuernummer ?? "", kleinunternehmer: !!p?.kleinunternehmer, zahlungshinweis: p?.zahlungshinweis ?? "" };
  };
  if (url.pathname === "/konto/rechnungen/vorschau.docx") {
    const beispiel: Rechnung = { id: "vorschau", kunde_id: null, nummer: "RE-2026-0001", monat: heute.slice(0, 7), datum: heute, netto: 1500, ust_satz: 19, erstellt: "", status: "ausgestellt",
      positionen: [{ text: `Leistungen ${monatName(heute.slice(0, 7))} lt. Leistungsnachweis`, menge: 50, einheit: "Std.", preis: 30, betrag: 1500 }], empfaenger: { name: "Beispielkunde GmbH", strasse: "Musterweg 1", plz: "50667", ort: "Köln" } };
    const a = await absender();
    return wordAntwort(rechnungDocx({ ...beispiel, absender: a, kleinunternehmer: a.kleinunternehmer, ust_betrag: a.kleinunternehmer ? 0 : 285 }, null, a, await vorlageLaden(f.s, env, firma)), "Rechnungsvorlage-Vorschau.docx", f.s.cookies);
  }
  if (docx) {
    const r = await db<Rechnung[]>(f.s, env, `rechnungen?id=eq.${docx[1]}&firma_id=eq.${firma}&select=${RECHNUNG_SPALTEN}`);
    const x = r.ok ? r.daten[0] : undefined;
    if (!x) return new Response("Nicht gefunden", { status: 404 });
    const k = x.kunde_id ? await db<Kunde[]>(f.s, env, `kunden?id=eq.${x.kunde_id}&select=id,bereich_id,name,strasse,plz,ort,land,ansprechpartner,telefon,email,notiz,leitweg_id,ustid,ust_13b,reverse_charge_eu,privat`) : null;
    const kunde = k?.ok ? k.daten[0] ?? null : null;
    if (docx[2] === "mahnung.docx") {
      if (!x.mahnstufe) return new Response("Noch keine Mahnung", { status: 404 });
      return wordAntwort(mahnungDocx(x, kunde, await absender(), heute), `${MAHNSTUFE[x.mahnstufe].replace(/\W+/g, "-")}-${x.nummer}.docx`, f.s.cookies);
    }
    if (docx[2] === "xml") {
      if (istEntwurf(x)) return antwort(`<p>Eine E-Rechnung gibt es erst nach dem Ausstellen. <a href="/konto/rechnungen">Zurück</a></p>`, 409);
      const b = beteiligte(x, kunde, await absender());
      // Leitweg-ID of public buyers (BT-10): frozen at issue time from the customer note ("Leitweg-ID: 05315-…").
      const leitweg = x.empfaenger?.leitweg || kunde?.leitweg_id || /Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})/i.exec(kunde?.notiz ?? "")?.[1] || "";
      const fehlt = fehlendFuerXRechnung(b.a, b.kunde, leitweg);
      if (fehlt.length) return antwort(`<p>Für eine gültige E-Rechnung fehlt:</p><ul>${fehlt.map((x) => `<li>${escape(x)}</li>`).join("")}</ul><p class="knopf-zeile"><a class="knopf zweit" href="/konto/firmenprofil">Firmenprofil</a> <a class="knopf zweit" href="/konto/kunden">Kunden &amp; Einsatzorte</a> <a class="knopf zweit" href="/konto/rechnungen">Zurück</a></p><p class="klein">Bei ausgestellten Rechnungen zählen Anschrift, E-Mail und USt-IdNr. des Kunden vom Ausstelltag.</p>`, 409);
      const h = new Headers({ "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="${x.nummer}.xml"` });
      for (const c of f.s.cookies ?? []) h.append("set-cookie", c);
      return new Response(xrechnungXml(x, b.kunde, b.a, leitweg), { headers: h });
    }
    // Issued: the original stored at issue time; older invoices (before 03.11.2026) are rendered from the frozen data.
    const original = !istEntwurf(x) ? await env.DATEN?.get(originalSchluessel(firma, x.id)) : null;
    if (original) return wordAntwort(new Uint8Array(await original.arrayBuffer()), `${x.nummer}.docx`, f.s.cookies);
    return wordAntwort(rechnungDocx(x, kunde, await absender(), await vorlageLaden(f.s, env, firma)), `${istEntwurf(x) ? `Rechnungsentwurf-${x.monat}` : x.nummer}.docx`, f.s.cookies);
  }
  if (request.method === "POST" && nurLesen) return antwort("<p>Mit Leserechten kannst du Rechnungen nur ansehen und herunterladen.</p>", 403);
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/rechnungen?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    // GoBD: keep the document exactly as issued (logo and texts of that day) next to the frozen data.
    const originalAblegen = async (nummer: string) => {
      const n = await db<Rechnung[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&nummer=eq.${encodeURIComponent(nummer)}&select=${RECHNUNG_SPALTEN}`);
      const x = n.ok ? n.daten[0] : undefined;
      if (x && env.DATEN) await env.DATEN.put(originalSchluessel(firma, x.id), rechnungDocx(x, null, await absender(), await vorlageLaden(f.s, env, firma)), { httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    };
    if (form.get("aktion") === "vorlage") {
      const r = await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, rechnung_einleitung: String(form.get("rechnung_einleitung") ?? "").trim().slice(0, 1000), rechnung_schluss: String(form.get("rechnung_schluss") ?? "").trim().slice(0, 1000) }) });
      return zurueck(r.ok ? "Rechnungsvorlage gespeichert." : "Speichern hat nicht geklappt (nur Inhaber und Admins).");
    }
    for (const [feld, daten, text] of [["bezahlt", { bezahlt_am: heute }, "Als bezahlt markiert."], ["offen", { bezahlt_am: null }, "Wieder offen."]] as const) {
      const id = String(form.get(feld) ?? "");
      if (/^[0-9a-f-]{36}$/.test(id)) { const r = await db(f.s, env, `rechnungen?id=eq.${id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(daten) }); return zurueck(r.ok ? text : "Speichern hat nicht geklappt."); }
    }
    // Issue / cancel through the database functions (number counter, frozen data, GoBD); their message is shown as is.
    const dbFehler = (t: string) => /"message":"([^"]+)"/.exec(t)?.[1] ?? "";
    for (const [feld, fn, ok] of [["ausstellen", "rechnung_ausstellen", "ausgestellt"], ["stornieren", "rechnung_stornieren", "erstellt (Stornorechnung)"]] as const) {
      const id = String(form.get(feld) ?? "");
      if (/^[0-9a-f-]{36}$/.test(id)) {
        const r = await db<string>(f.s, env, `rpc/${fn}`, { method: "POST", body: JSON.stringify({ r: id }) });
        if (r.ok) await originalAblegen(r.daten);
        return zurueck(r.ok ? `Rechnung ${r.daten} ${ok}. Bitte herunterladen und selbst versenden.` : dbFehler(r.fehler) || "Das hat nicht geklappt.");
      }
    }
    const mahnen = String(form.get("mahnen") ?? "");
    if (/^[0-9a-f-]{36}$/.test(mahnen)) {
      const alt = await db<{ mahnstufe: number }[]>(f.s, env, `rechnungen?id=eq.${mahnen}&firma_id=eq.${firma}&select=mahnstufe`);
      const stufe = Math.min(3, (alt.ok ? alt.daten[0]?.mahnstufe ?? 0 : 0) + 1);
      const r = await db(f.s, env, `rechnungen?id=eq.${mahnen}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ mahnstufe: stufe, gemahnt_am: heute }) });
      return zurueck(r.ok ? `${MAHNSTUFE[stufe]} vorbereitet: bitte „📄 ${MAHNSTUFE[stufe]}“ herunterladen und selbst versenden.` : "Speichern hat nicht geklappt.");
    }
    const vk = String(form.get("vorlage_kunde") ?? "");
    if (/^[0-9a-f-]{36}$/.test(vk)) {
      const betrag = Number(String(form.get("vorlage_betrag") ?? "").replace(/\./g, "").replace(",", "."));
      const text = String(form.get("vorlage_text") ?? "").trim().slice(0, 200);
      if (!(betrag > 0) || text.length < 2) return zurueck("Leistung und Betrag angeben.");
      const r = await db(f.s, env, "rechnungsvorlagen", { method: "POST", body: JSON.stringify({ firma_id: firma, kunde_id: vk, text, betrag: rund(betrag) }) });
      return zurueck(r.ok ? "Vorlage gespeichert." : "Vorlage konnte nicht gespeichert werden.");
    }
    const vw = String(form.get("vorlage_weg") ?? "");
    if (/^[0-9a-f-]{36}$/.test(vw)) { const r = await db(f.s, env, `rechnungsvorlagen?id=eq.${vw}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck(r.ok ? "Vorlage gelöscht." : "Löschen hat nicht geklappt."); }
    const vm = String(form.get("vorlagen_monat") ?? "");
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(vm)) {
      const vl = await db<Vorlage[]>(f.s, env, `rechnungsvorlagen?firma_id=eq.${firma}&select=id,kunde_id,text,betrag,aktiv,letzter_monat&limit=500`);
      let n = 0;
      for (const v of offeneVorlagen(vl.ok ? vl.daten : [], vm)) {
        const pos = vorlagePositionen(v, vm);
        const r = await db<{ id: string }[]>(f.s, env, "rechnungen?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, kunde_id: v.kunde_id, nummer: neueEntwurfsnummer(), monat: vm, datum: heute, positionen: pos, netto: pos[0].betrag, ust_satz: 19 }) });
        if (r.ok && r.daten.length) { n++; await db(f.s, env, `rechnungsvorlagen?id=eq.${v.id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ letzter_monat: vm }) }); }
      }
      return zurueck(n ? `${n} Rechnungsentwürfe für ${monatName(vm)} erstellt. Bitte prüfen und ausstellen.` : "Keine Entwürfe erstellt.");
    }
    const weg = String(form.get("loeschen") ?? "");
    if (/^[0-9a-f-]{36}$/.test(weg)) { const r = await db(f.s, env, `rechnungen?id=eq.${weg}&firma_id=eq.${firma}&status=eq.entwurf`, { method: "DELETE" }); return zurueck(r.ok ? "Entwurf gelöscht." : "Ausgestellte Rechnungen werden nicht gelöscht, sondern storniert."); }
    const kid = String(form.get("kunde") ?? ""), monat = String(form.get("monat") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(kid) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return zurueck("Kunde oder Monat fehlt.");
    const [l, pr, land] = await Promise.all([
      db<Eintrag[]>(f.s, env, `stundenzettel?firma_id=eq.${firma}&kunde_id=eq.${kid}&status=eq.freigegeben&datum=gte.${monat}-01&datum=lt.${naechsterMonat(monat)}-01&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status,kunde_id&limit=10000`),
      db<{ satz: number | string; leistungstext?: string; zuschlag_nacht: number | string; zuschlag_sonntag: number | string; zuschlag_feiertag: number | string }[]>(f.s, env, `kunden_preise?firma_id=eq.${firma}&kunde_id=eq.${kid}&select=satz,leistungstext,zuschlag_nacht,zuschlag_sonntag,zuschlag_feiertag`),
      landDerFirma(f.s, env, firma),
    ]);
    if (l.ok) l.daten = mitLand(l.daten, await einsatzLaender(f.s, env, firma));
    const p = pr.ok ? pr.daten[0] : undefined;
    if (!p) return zurueck("Für diesen Kunden ist kein Verrechnungssatz hinterlegt (Kunden & Einsatzorte).");
    if (!l.ok || !l.daten.length) return zurueck("Keine freigegebenen Stunden für diesen Kunden und Monat.");
    const pos = positionen(l.daten, { satz: Number(p.satz), nacht: Number(p.zuschlag_nacht), sonntag: Number(p.zuschlag_sonntag), feiertag: Number(p.zuschlag_feiertag), text: p.leistungstext }, land, monat);
    const r = await db<{ id: string }[]>(f.s, env, "rechnungen?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, kunde_id: kid, nummer: neueEntwurfsnummer(), monat, datum: heute, positionen: pos, netto: rund(pos.reduce((n, x) => n + x.betrag, 0)), ust_satz: 19 }) });
    return zurueck(r.ok && r.daten.length ? "Rechnungsentwurf erstellt. Bitte prüfen und dann „✓ Ausstellen“." : "Rechnung konnte nicht angelegt werden.");
  }
  const vorlagen = await db<Vorlage[]>(f.s, env, `rechnungsvorlagen?firma_id=eq.${firma}&select=id,kunde_id,text,betrag,aktiv,letzter_monat&order=erstellt&limit=500`);
  const [l, k, a] = await Promise.all([
    db<Rechnung[]>(f.s, env, `rechnungen?firma_id=eq.${firma}&select=${RECHNUNG_SPALTEN}&order=erstellt.desc&limit=500`),
    db<Kunde[]>(f.s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,ansprechpartner,telefon,email,notiz&limit=1000`),
    absender(),
  ]);
  const fehlt = [!a.steuernummer && !a.ustid ? "Steuernummer oder USt-IdNr." : "", !a.strasse || !a.ort ? "Anschrift" : "", !a.zahlungshinweis ? "Zahlungshinweis (z. B. Bankverbindung)" : ""].filter(Boolean);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${nurLesen ? ohneFormulare(rechnungenSeite(l.ok ? l.daten : [], k.ok ? k.daten : [], { fehlt: [], heute, kleinunternehmer: a.kleinunternehmer })) : rechnungenSeite(l.ok ? l.daten : [], k.ok ? k.daten : [], { fehlt, heute, kleinunternehmer: a.kleinunternehmer }) + vorlageFormular(await (async () => { const v = await db<{ rechnung_einleitung: string; rechnung_schluss: string; logo: string | null }[]>(f.s, env, `firmenprofil?firma_id=eq.${firma}&select=rechnung_einleitung,rechnung_schluss,logo`); const x = v.ok ? v.daten[0] : undefined; return { einleitung: x?.rechnung_einleitung ?? "", schluss: x?.rechnung_schluss ?? "", logo: !!x?.logo }; })()) + vorlagenBereich(vorlagen.ok ? vorlagen.daten : [], k.ok ? k.daten : [], heute.slice(0, 7))}`);
}
