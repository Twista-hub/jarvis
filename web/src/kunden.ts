// T33: Kunden und Einsatzorte. One list of customers (address, contact, hourly rate only with finance access) and their
// sites with what staff need on the day (address, contact on site, meeting point, clothing, notes; T31).
// Shifts, time sheets and the proof of work (T29) use it.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { ustIdPasst } from "./xrechnung.ts";
/** Countries a customer can be in (ISO 3166 codes, used for the address on invoices and in the XRechnung). */
export const KUNDEN_LAENDER: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", NL: "Niederlande", BE: "Belgien", LU: "Luxemburg", FR: "Frankreich", DK: "Dänemark", PL: "Polen", CZ: "Tschechien", IT: "Italien", ES: "Spanien", SE: "Schweden", FI: "Finnland", IE: "Irland", PT: "Portugal", GR: "Griechenland", HU: "Ungarn", RO: "Rumänien", BG: "Bulgarien", SK: "Slowakei", SI: "Slowenien", HR: "Kroatien", EE: "Estland", LV: "Lettland", LT: "Litauen", MT: "Malta", CY: "Zypern", GB: "Vereinigtes Königreich", NO: "Norwegen", US: "USA" };
/** Other EU member states (reverse charge EU, EC sales list). */
export const EU_LAENDER = ["AT", "BE", "BG", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"];
/** Postcode check per country: five digits in Germany, otherwise 3–10 letters, digits, spaces or hyphens. */
export const plzPasst = (plz: string, land: string) => (land === "DE" ? /^\d{5}$/ : /^[0-9A-Za-z][0-9A-Za-z -]{1,8}[0-9A-Za-z]$/).test(plz);

export type Kunde = { id: string; bereich_id: string | null; name: string; strasse: string; plz: string; ort: string; land?: string; ansprechpartner: string; telefon: string; email: string; notiz: string; bz_tarif?: string; bz_prozente?: (number | string)[]; ust_13b?: boolean; reverse_charge_eu?: boolean; privat?: boolean; ustid?: string; leitweg_id?: string };
export type Einsatzort = { id: string; kunde_id: string | null; name: string; strasse: string; plz: string; ort: string; ansprechpartner: string; telefon: string; treffpunkt: string; kleidung: string; hinweise: string };
export type Preis = { kunde_id: string; satz: number | string; zuschlag_nacht?: number | string; zuschlag_sonntag?: number | string; zuschlag_feiertag?: number | string; leistungstext?: string };
// T38: sector surcharge agreements (temporary work). Only the metal/electrical preset is filled in; please check against the current agreement.
export const BZ_VORLAGEN: Record<string, number[]> = { "Metall- und Elektroindustrie (TV BZ ME)": [15, 20, 30, 45, 50] };
export const BZ_STUFEN = ["6 Wochen", "3 Monate", "5 Monate", "7 Monate", "9 Monate"];
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
/** Country line of an address abroad (empty for Germany). */
export const landZeile = (x: { land?: string } | null | undefined) => (x?.land && x.land !== "DE" ? KUNDEN_LAENDER[x.land] ?? x.land : "");
export const adresse = (x: { strasse: string; plz: string; ort: string }) => [x.strasse, [x.plz, x.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
/** Map link for an address (opens the phone's map app via OpenStreetMap search). */
export const kartenLink = (x: { strasse: string; plz: string; ort: string; name?: string }) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(adresse(x) || x.name || "")}`;

const kundeFelder = (k: Partial<Kunde>, bereiche: { id: string; name: string }[], preis: string | null, zuschlaege: [string, string, string] = ["", "", ""], leistungstext = "") => `<div class="aueg-form">
<label class="ganz">Name<input name="name" required maxlength="160" value="${escape(k.name ?? "")}"></label>
<label class="ganz">Straße und Nr.<input name="strasse" maxlength="160" value="${escape(k.strasse ?? "")}"></label>
<label>PLZ<input name="plz" maxlength="10" pattern="[0-9A-Za-z \\-]{3,10}" value="${escape(k.plz ?? "")}"></label><label>Ort<input name="ort" maxlength="100" value="${escape(k.ort ?? "")}"></label>
<label>Land<select name="land">${Object.entries(KUNDEN_LAENDER).map(([c, n]) => `<option value="${c}"${(k.land || "DE") === c ? " selected" : ""}>${n}</option>`).join("")}</select><span class="klein">Kunde im Ausland: Ob deutsche Umsatzsteuer anfällt (Ort der Leistung, § 3a UStG), klärt bitte die Steuerberatung. Crewtender ändert den Steuersatz dafür nicht von selbst.</span></label>
<label>Ansprechpartner<input name="ansprechpartner" maxlength="160" value="${escape(k.ansprechpartner ?? "")}"></label><label>Telefon<input name="telefon" type="tel" maxlength="60" value="${escape(k.telefon ?? "")}"></label>
<label class="ganz">E-Mail (auch für die E-Rechnung)<input name="email" type="email" maxlength="200" value="${escape(k.email ?? "")}"></label>
${bereiche.length ? `<label>Standort<select name="bereich"><option value="">ganze Firma</option>${bereiche.map((b) => `<option value="${b.id}"${k.bereich_id === b.id ? " selected" : ""}>${escape(b.name)}</option>`).join("")}</select></label>` : ""}
${preis !== null ? `<label class="ganz">Leistungstext auf der Rechnung<input name="leistungstext" maxlength="200" value="${escape(leistungstext)}" placeholder="z. B. Unterhaltsreinigung Objekt Hauptstraße (Monat wird angehängt)"></label><label>Verrechnungssatz (€/Std., netto)<input name="satz" inputmode="decimal" maxlength="9" value="${escape(preis)}" placeholder="z. B. 32,50"></label><fieldset class="ganz"><legend>Zuschläge auf der Rechnung (% vom Satz)</legend><div class="drei"><label>Nacht<input name="z_nacht" inputmode="decimal" maxlength="6" value="${escape(zuschlaege[0])}"></label><label>Sonntag<input name="z_sonntag" inputmode="decimal" maxlength="6" value="${escape(zuschlaege[1])}"></label><label>Feiertag<input name="z_feiertag" inputmode="decimal" maxlength="6" value="${escape(zuschlaege[2])}"></label></div></fieldset>` : ""}
<details class="ganz bz-felder"${(k.bz_prozente ?? []).length ? " open" : ""}><summary class="klein">Branchenzuschläge Zeitarbeit (TV BZ)</summary><label>Tarif<input name="bz_tarif" maxlength="80" list="bz-vorlagen" value="${escape(k.bz_tarif ?? "")}" placeholder="z. B. Metall- und Elektroindustrie (TV BZ ME)"></label><datalist id="bz-vorlagen">${Object.keys(BZ_VORLAGEN).map((v) => `<option value="${v}">`).join("")}</datalist>
<p class="klein">Zuschlag in % nach Einsatzdauer beim Kunden:</p><div class="fuenf">${BZ_STUFEN.map((st, i) => `<label title="nach ${st}">${st.replace(" Wochen", " Wo.").replace(" Monate", " Mon.")}<input name="bz_${i}" inputmode="decimal" maxlength="5" value="${escape(String((k.bz_prozente ?? [])[i] ?? ""))}"></label>`).join("")}</div><p class="klein">Leer lassen, wenn kein Branchenzuschlag gilt. Bei der Vorlage Metall/Elektro füllt Crewtender 15/20/30/45/50 % aus; bitte mit dem aktuellen Tarifvertrag abgleichen.</p></details>
<label>USt-IdNr. des Kunden<input name="ustid" maxlength="20" value="${escape(k.ustid ?? "")}" placeholder="DE123456789"></label>
<label>Leitweg-ID (nur öffentliche Auftraggeber, für die XRechnung)<input name="leitweg_id" maxlength="46" pattern="[0-9A-Za-z\-]{5,46}" value="${escape(k.leitweg_id ?? "")}" placeholder="z. B. 05315-12345-67"></label>
<label class="zeile ganz"><input type="checkbox" name="privat"${k.privat ? " checked" : ""}>Privatperson (kein Unternehmen): Rechnungen bekommen den Pflichthinweis zur Aufbewahrung (§ 14 Abs. 4 Nr. 9 UStG, z. B. bei Reinigung oder Arbeiten am Haus), Mahnungen die Verzugszinsen für Verbraucher.</label>
<label class="zeile ganz"><input type="checkbox" name="reverse_charge_eu"${k.reverse_charge_eu ? " checked" : ""}>Reverse Charge EU: Kunde ist ein Unternehmen in einem anderen EU-Land und die Leistung ist dort steuerbar (z. B. Personal für eine Firma in Österreich). Rechnungen dann ohne Umsatzsteuer mit Hinweis, Zusammenfassende Meldung nötig. <strong>Nicht</strong> für Arbeiten an Gebäuden in Deutschland – dort gilt deutsche Umsatzsteuer. Vorschlag, im Zweifel Steuerbüro fragen.</label>
<label class="zeile ganz"><input type="checkbox" name="ust_13b"${k.ust_13b ? " checked" : ""}>Kunde schuldet die Umsatzsteuer (§ 13b UStG): z. B. Gebäudereinigung für einen Gebäudereiniger oder Bauleistung für ein Bauunternehmen. Rechnungen dann ohne Umsatzsteuer mit Hinweis. Nachweis (z. B. USt 1 TG) beim Kunden anfordern und ablegen.</label>
<label class="ganz">Notiz<input name="notiz" maxlength="500" value="${escape(k.notiz ?? "")}"></label></div>`;

const ortFelder = (o: Partial<Einsatzort>) => `<div class="aueg-form">
<label class="ganz">Bezeichnung<input name="name" required maxlength="160" value="${escape(o.name ?? "")}" placeholder="z. B. Messe Halle 3, Baustelle Hauptstraße"></label>
<label class="ganz">Straße und Nr.<input name="strasse" maxlength="160" value="${escape(o.strasse ?? "")}"></label>
<label>PLZ<input name="plz" maxlength="5" inputmode="numeric" pattern="\\d{5}" value="${escape(o.plz ?? "")}"></label><label>Ort<input name="ort" maxlength="100" value="${escape(o.ort ?? "")}"></label>
<label>Ansprechpartner vor Ort<input name="ansprechpartner" maxlength="160" value="${escape(o.ansprechpartner ?? "")}"></label><label>Telefon<input name="telefon" type="tel" maxlength="60" value="${escape(o.telefon ?? "")}"></label>
<label class="ganz">Treffpunkt<input name="treffpunkt" maxlength="300" value="${escape(o.treffpunkt ?? "")}" placeholder="z. B. Eingang Süd, beim Pförtner melden"></label>
<label class="ganz">Kleidung / Ausrüstung<input name="kleidung" maxlength="300" value="${escape(o.kleidung ?? "")}" placeholder="z. B. schwarze Hose, Sicherheitsschuhe S3"></label>
<label class="ganz">Hinweise<textarea name="hinweise" maxlength="1000" rows="2">${escape(o.hinweise ?? "")}</textarea></label></div>`;

/** Site details as staff see them on their shift (T31). */
export function ortInfo(o: Einsatzort): string {
  const a = adresse(o);
  return [a ? `<span>📍 <a href="${kartenLink(o)}" target="_blank" rel="noopener">${escape(a)}</a></span>` : "",
    o.ansprechpartner || o.telefon ? `<span>👤 ${escape(o.ansprechpartner)}${o.telefon ? ` · <a href="tel:${escape(o.telefon.replace(/[^\d+]/g, ""))}">${escape(o.telefon)}</a>` : ""}</span>` : "",
    o.treffpunkt ? `<span>🚪 ${escape(o.treffpunkt)}</span>` : "", o.kleidung ? `<span>👕 ${escape(o.kleidung)}</span>` : "",
    o.hinweise ? `<span>ℹ️ ${escape(o.hinweise).replace(/\n/g, "<br>")}</span>` : ""].filter(Boolean).join("");
}

export function kundenSeite(kunden: Kunde[], orte: Einsatzort[], preise: Preis[], o: { darfAendern: boolean; finanzen: boolean; bereiche: { id: string; name: string }[]; offen?: string }): string {
  const preis = (id: string) => { const p = preise.find((x) => x.kunde_id === id); return p ? Number(p.satz) : null; };
  const zuschlaegeVon = (id: string): [string, string, string] => { const p = preise.find((x) => x.kunde_id === id); const f = (v?: number | string) => Number(v ?? 0) ? String(Number(v)).replace(".", ",") : ""; return [f(p?.zuschlag_nacht), f(p?.zuschlag_sonntag), f(p?.zuschlag_feiertag)]; };
  const ortZeile = (x: Einsatzort) => `<li><details${o.offen === x.id ? " open" : ""}><summary><strong>${escape(x.name)}</strong><span class="klein">${escape(adresse(x) || "ohne Adresse")}${x.treffpunkt ? ` · 🚪 ${escape(x.treffpunkt)}` : ""}</span></summary><div class="ort-info">${ortInfo(x)}<p class="klein"><a href="/konto/chat?o=${x.id}">💬 Chat zu diesem Einsatzort</a></p></div>
${o.darfAendern ? `<details class="ort-bearbeiten"><summary class="klein">✏️ Bearbeiten</summary><form method="post" action="/konto/kunden"><input type="hidden" name="aktion" value="ort"><input type="hidden" name="id" value="${x.id}"><input type="hidden" name="kunde" value="${x.kunde_id ?? ""}">${ortFelder(x)}<div class="knopf-zeile"><button>Speichern</button><button name="loeschen" value="1" class="zweit">Löschen</button></div></form></details>` : ""}</details></li>`;
  const karte = (k: Kunde) => {
    const l = orte.filter((x) => x.kunde_id === k.id), p = preis(k.id);
    return `<article class="kunde-karte" id="kunde-${k.id}"><h3>🏢 ${escape(k.name)}</h3><p class="klein">${[escape(adresse(k)), k.ansprechpartner ? `👤 ${escape(k.ansprechpartner)}` : "", k.telefon ? `☎️ ${escape(k.telefon)}` : "", o.finanzen && p !== null ? `💶 ${euro(p)}/Std.` : ""].filter(Boolean).join(" · ")}</p>
${l.length ? `<ul class="ort-liste">${l.map(ortZeile).join("")}</ul>` : `<p class="klein">Noch kein Einsatzort.</p>`}
${o.darfAendern ? `<details class="termin-neu"><summary>➕ Einsatzort</summary><form method="post" action="/konto/kunden"><input type="hidden" name="aktion" value="ort"><input type="hidden" name="kunde" value="${k.id}">${ortFelder({ strasse: k.strasse, plz: k.plz, ort: k.ort })}<button>Einsatzort speichern</button></form></details>
<details class="termin-neu"><summary>✏️ Kunde bearbeiten</summary><form method="post" action="/konto/kunden"><input type="hidden" name="aktion" value="kunde"><input type="hidden" name="id" value="${k.id}">${kundeFelder(k, o.bereiche, o.finanzen ? (p !== null ? String(p).replace(".", ",") : "") : null, zuschlaegeVon(k.id), preise.find((x) => x.kunde_id === k.id)?.leistungstext ?? "")}<div class="knopf-zeile"><button>Speichern</button><button name="loeschen" value="1" class="zweit">Kunde löschen</button></div></form></details>` : ""}</article>`;
  };
  const ohne = orte.filter((x) => !x.kunde_id);
  return `<p class="klein">Kunden und ihre Einsatzorte. Beim Planen einer Schicht wählst du den Einsatzort; die Einsatzkraft sieht dann Adresse mit Karte, Ansprechpartner, Treffpunkt und Kleidung. Stunden werden dem Kunden zugeordnet, wenn der Einsatz so heißt wie Kunde oder Einsatzort.${o.finanzen ? "" : " Verrechnungssätze sehen nur Personen mit Finanzfreigabe."}</p>
${o.darfAendern ? `<p class="klein"><a href="/konto/import/kunden">⬆ Kunden und Einsatzorte aus Excel oder CSV übernehmen</a></p>` : ""}
${o.darfAendern ? `<details class="termin-neu"${kunden.length ? "" : " open"}><summary>➕ Kunde anlegen</summary><form method="post" action="/konto/kunden"><input type="hidden" name="aktion" value="kunde">${kundeFelder({}, o.bereiche, o.finanzen ? "" : null)}<button>Kunde speichern</button></form></details>` : ""}
${kunden.length ? kunden.map(karte).join("") : `<p class="treffer-leer">Noch keine Kunden.</p>`}
${ohne.length ? `<h2>Einsatzorte ohne Kunde</h2><ul class="ort-liste">${ohne.map(ortZeile).join("")}</ul>` : ""}`;
}

export async function kundenLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string, finanzen: boolean) {
  const [k, o, p] = await Promise.all([
    db<Kunde[]>(s, env, `kunden?firma_id=eq.${firma}&select=id,bereich_id,name,strasse,plz,ort,land,ansprechpartner,telefon,email,notiz,bz_tarif,bz_prozente,ust_13b,reverse_charge_eu,privat,ustid,leitweg_id&order=name&limit=1000`),
    db<Einsatzort[]>(s, env, `einsatzorte?firma_id=eq.${firma}&select=id,kunde_id,name,strasse,plz,ort,ansprechpartner,telefon,treffpunkt,kleidung,hinweise&order=name&limit=3000`),
    finanzen ? db<Preis[]>(s, env, `kunden_preise?firma_id=eq.${firma}&select=kunde_id,satz,zuschlag_nacht,zuschlag_sonntag,zuschlag_feiertag,leistungstext&limit=1000`) : Promise.resolve(null),
  ]);
  return { kunden: k.ok ? k.daten : [], orte: o.ok ? o.daten : [], preise: p?.ok ? p.daten : [] };
}

export async function kunden(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/kunden") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Kunden & Einsatzorte", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string, anker = "") => weiterleiten(`/konto/kunden?hinweis=${encodeURIComponent(h)}${anker}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter, Standortleitungen und Admins.");
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const uuid = (k: string) => /^[0-9a-f-]{36}$/.test(t(k, 36)) ? t(k, 36) : "";
    const plz = /^\d{5}$/.test(t("plz", 5)) ? t("plz", 5) : "";
    const id = uuid("id"), loeschen = form.get("loeschen") === "1";
    if (t("aktion", 10) === "ort") {
      const kunde = uuid("kunde") || null;
      if (loeschen && id) { const r = await db<{ id: string }[]>(f.s, env, `einsatzorte?id=eq.${id}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } }); return zurueck(r.ok && r.daten.length ? "Einsatzort gelöscht." : "Löschen hat nicht geklappt.", kunde ? `#kunde-${kunde}` : ""); }
      const zeile = { firma_id: firma, kunde_id: kunde, name: t("name", 160), strasse: t("strasse", 160), plz, ort: t("ort", 100), ansprechpartner: t("ansprechpartner", 160), telefon: t("telefon", 60), treffpunkt: t("treffpunkt", 300), kleidung: t("kleidung", 300), hinweise: String(form.get("hinweise") ?? "").trim().slice(0, 1000) };
      if (zeile.name.length < 2) return zurueck("Bitte eine Bezeichnung angeben.");
      const r = id ? await db(f.s, env, `einsatzorte?id=eq.${id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(zeile) }) : await db(f.s, env, "einsatzorte", { method: "POST", body: JSON.stringify(zeile) });
      return zurueck(r.ok ? "Einsatzort gespeichert." : "Speichern hat nicht geklappt.", kunde ? `#kunde-${kunde}` : "");
    }
    if (loeschen && id) { const r = await db<{ id: string }[]>(f.s, env, `kunden?id=eq.${id}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } }); return zurueck(r.ok && r.daten.length ? "Kunde gelöscht." : "Löschen hat nicht geklappt."); }
    const bzTarif = t("bz_tarif", 80);
    const land = Object.hasOwn(KUNDEN_LAENDER, t("land", 2)) ? t("land", 2) : "DE", plzKunde = t("plz", 10).toUpperCase();
    const pz = (k: string) => { const n = Number(t(k, 6).replace(",", ".")); return t(k, 6) && Number.isFinite(n) && n >= 0 && n <= 300 ? Math.round(n * 100) / 100 : null; };
    let bz = [0, 1, 2, 3, 4].map((i) => pz(`bz_${i}`));
    if (bz.every((x) => x === null) && BZ_VORLAGEN[bzTarif]) bz = BZ_VORLAGEN[bzTarif];
    const zeile = { firma_id: firma, name: t("name", 160), strasse: t("strasse", 160), plz: plzPasst(plzKunde, land) ? plzKunde : "", ort: t("ort", 100), ansprechpartner: t("ansprechpartner", 160), telefon: t("telefon", 60), email: t("email", 200), notiz: t("notiz", 500), bereich_id: uuid("bereich") || null,
      bz_tarif: bzTarif, bz_prozente: bz.some((x) => x !== null) ? bz.map((x) => x ?? 0) : [], ust_13b: form.get("ust_13b") === "on" && form.get("privat") !== "on", reverse_charge_eu: form.get("reverse_charge_eu") === "on", privat: form.get("privat") === "on", ustid: t("ustid", 20).toUpperCase().replace(/[\s-]/g, ""), land, leitweg_id: /^[0-9A-Za-z-]{5,46}$/.test(t("leitweg_id", 46).replace(/\s/g, "")) ? t("leitweg_id", 46).replace(/\s/g, "") : "" };
    if (zeile.name.length < 2) return zurueck("Bitte einen Namen angeben.");
    if (plzKunde && !zeile.plz) return zurueck(land === "DE" ? "Die PLZ in Deutschland hat 5 Ziffern." : "Bitte die Postleitzahl prüfen.");
    if (form.get("privat") === "on" && form.get("ust_13b") === "on") return zurueck("Eine Privatperson kann die Umsatzsteuer nicht nach § 13b schulden. Bitte eines von beiden abwählen.");
    if (zeile.reverse_charge_eu && (zeile.ust_13b || zeile.privat || !EU_LAENDER.includes(land) || !zeile.ustid)) return zurueck("Reverse Charge EU geht nur bei einem Unternehmen in einem anderen EU-Land mit USt-IdNr. (nicht zusammen mit § 13b oder Privatperson).");
    if (!ustIdPasst(zeile.ustid)) return zurueck("Die USt-IdNr. beginnt mit dem Ländercode, z. B. DE123456789 oder ATU12345678.");
    const r = id ? await db<{ id: string }[]>(f.s, env, `kunden?id=eq.${id}&firma_id=eq.${firma}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(zeile) })
      : await db<{ id: string }[]>(f.s, env, "kunden?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(zeile) });
    if (!r.ok || !r.daten.length) return zurueck(r.ok ? "Speichern hat nicht geklappt." : /duplicate|23505/.test(r.fehler) ? "Diesen Kunden gibt es schon." : "Speichern hat nicht geklappt. Hast du Rechte für diesen Standort?");
    const kid = r.daten[0].id, satzText = t("satz", 9).replace(",", ".");
    if (f.finanzen && form.has("satz")) {
      const satz = Number(satzText);
      if (satzText && Number.isFinite(satz) && satz >= 0 && satz <= 10000) await db(f.s, env, "kunden_preise?on_conflict=firma_id,kunde_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, kunde_id: kid, satz: Math.round(satz * 100) / 100, zuschlag_nacht: pz("z_nacht") ?? 0, zuschlag_sonntag: pz("z_sonntag") ?? 0, zuschlag_feiertag: pz("z_feiertag") ?? 0, leistungstext: t("leistungstext", 200), geaendert: new Date().toISOString() }) });
      else if (!satzText) await db(f.s, env, `kunden_preise?firma_id=eq.${firma}&kunde_id=eq.${kid}`, { method: "DELETE" });
    }
    return zurueck("Kunde gespeichert.", `#kunde-${kid}`);
  }
  const [d, b] = await Promise.all([kundenLaden(f.s, env, firma, f.finanzen), db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`)]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${kundenSeite(d.kunden, d.orte, d.preise, { darfAendern, finanzen: f.finanzen, bereiche: b.ok ? b.daten : [] })}`);
}
