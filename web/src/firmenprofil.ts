// T1–T3: Firmenprofil. Master data asked for in tenders (legal form, register, founding year, staff, revenue of the last
// three years, logo), prequalification and certificates with expiry. Jarvis puts them into offers (placeholders), the
// suitability declaration (Word) and the offer folder.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { LAENDER, landAusPlz } from "./zuschlaege.ts";
import { ausstattungText } from "./betriebsmittel.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { absatz, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";

export type Profil = { rechtsform: string; registergericht: string; registernummer: string; gruendungsjahr: number | null; mitarbeiter: number | null; website: string; email: string; ustid: string; geschaeftsfuehrung: string; taetigkeit: string; logo: string | null; bundesland?: string; steuernummer?: string; kleinunternehmer?: boolean; zahlungshinweis?: string };
export type Firma = { name: string; strasse: string | null; plz: string | null; ort: string | null; telefon: string | null };
export type Kennzahl = { jahr: number; umsatz: number | string | null; beschaeftigte: number | null };
export type Zertifikat = { id: string; art: string; bezeichnung: string; nummer: string; aussteller: string; gueltig_bis: string | null };
export const ZERT_ARTEN: Record<string, string> = { pq_vob: "Präqualifikation VOB (PQ-Verein)", avpq: "Präqualifikation Liefer-/Dienstleistungen (AVPQ)", iso9001: "ISO 9001 Qualitätsmanagement", iso14001: "ISO 14001 Umweltmanagement", iso45001: "ISO 45001 Arbeitsschutz", scc: "SCC / SCP Arbeitssicherheit", sonstiges: "Sonstiges Zertifikat" };
const LEER: Profil = { rechtsform: "", registergericht: "", registernummer: "", gruendungsjahr: null, mitarbeiter: null, website: "", email: "", ustid: "", geschaeftsfuehrung: "", taetigkeit: "", logo: null };
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE");
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const anschrift = (f: Firma) => [f.strasse, [f.plz, f.ort].filter(Boolean).join(" ")].filter((x) => x && x.trim()).join(", ");
export const register = (p: Profil) => [p.registergericht, p.registernummer].filter(Boolean).join(", ");

/** Values for the placeholders in text modules and Word templates. */
export function profilWerte(f: Firma, p: Profil | null, zert: Zertifikat[], heute: string): Record<string, string> {
  const q = p ?? LEER;
  const pq = zert.filter((z) => ["pq_vob", "avpq"].includes(z.art) && (!z.gueltig_bis || z.gueltig_bis >= heute)).map((z) => `${z.bezeichnung}${z.nummer ? ` (Nr. ${z.nummer})` : ""}`).join(", ");
  return { RECHTSFORM: q.rechtsform, GRUENDUNGSJAHR: q.gruendungsjahr ? String(q.gruendungsjahr) : "", MITARBEITER: q.mitarbeiter !== null ? String(q.mitarbeiter) : "", ANSCHRIFT: anschrift(f), REGISTER: register(q), GESCHAEFTSFUEHRUNG: q.geschaeftsfuehrung, PQ: pq };
}

/** Which master data is still missing (the declaration and offers need it). */
export function fehlt(f: Firma, p: Profil | null, kennzahlen: Kennzahl[] | null, zert: Zertifikat[], heute: string): string[] {
  const q = p ?? LEER;
  const jahr = Number(heute.slice(0, 4));
  return [
    !anschrift(f) || !f.plz ? "Anschrift" : "", !q.rechtsform ? "Rechtsform" : "", !q.registernummer && !/einzel|gbr/i.test(q.rechtsform) ? "Handelsregister" : "",
    !q.gruendungsjahr ? "Gründungsjahr" : "", q.mitarbeiter === null ? "Mitarbeiterzahl" : "", !q.geschaeftsfuehrung ? "Geschäftsführung / Inhaber" : "",
    kennzahlen && [jahr - 1, jahr - 2, jahr - 3].some((j) => !kennzahlen.some((k) => k.jahr === j && k.umsatz !== null)) ? "Umsatz der letzten 3 Jahre" : "",
    !q.logo ? "Logo" : "", zert.some((z) => z.gueltig_bis && z.gueltig_bis < heute) ? "abgelaufenes Zertifikat erneuern" : "",
  ].filter(Boolean);
}

/** T2: "Eigenerklärung zur Eignung" with company data, revenue and staff, certificates; to compare with the form of the authority. */
export function eigenerklaerungDocx(name: string, f: Firma, p: Profil | null, kennzahlen: Kennzahl[], zert: Zertifikat[], referenzen: number, heute: string, ausstattung = ""): Uint8Array {
  const q = p ?? LEER;
  const daten: [string, string][] = [
    ["Firma", name], ["Rechtsform", q.rechtsform], ["Anschrift", anschrift(f)], ["Telefon", f.telefon ?? ""], ["E-Mail", q.email], ["Internet", q.website],
    ["Handelsregister", register(q)], ["USt-IdNr.", q.ustid], ["Geschäftsführung / Inhaber", q.geschaeftsfuehrung], ["Gründungsjahr", q.gruendungsjahr ? String(q.gruendungsjahr) : ""],
    ["Beschäftigte (aktuell)", q.mitarbeiter !== null ? String(q.mitarbeiter) : ""],
    ...(ausstattung ? [["Technische Ausstattung", ausstattung] as [string, string]] : []),
  ];
  const jahr = Number(heute.slice(0, 4));
  const jahre = [jahr - 3, jahr - 2, jahr - 1];
  const kz = (j: number) => kennzahlen.find((k) => k.jahr === j);
  const body = ueberschrift("Eigenerklärung zur Eignung", 32) + absatz(name, { fett: true, groesse: 24 }) + absatz(`Stand: ${datum(heute)}`, { grau: true, groesse: 18, abstand: 200 })
    + ueberschrift("1. Angaben zum Unternehmen") + tabelle(daten.map(([a, b]) => [a, b || "—"]), [3200, 6400])
    + (q.taetigkeit ? ueberschrift("2. Tätigkeitsbereich") + absatz(q.taetigkeit, { abstand: 200 }) : "")
    + ueberschrift(`${q.taetigkeit ? 3 : 2}. Umsatz und Beschäftigte der letzten drei Geschäftsjahre`)
    + tabelle([["Geschäftsjahr", "Umsatz (netto)", "Beschäftigte (Jahresdurchschnitt)"], ...jahre.map((j) => [String(j), kz(j)?.umsatz != null ? euro(Number(kz(j)!.umsatz)) : "—", kz(j)?.beschaeftigte != null ? String(kz(j)!.beschaeftigte) : "—"])], [2400, 3600, 3600], true)
    + ueberschrift(`${q.taetigkeit ? 4 : 3}. Präqualifikation und Zertifikate`)
    + (zert.length ? tabelle([["Nachweis", "Nummer", "gültig bis"], ...zert.map((z) => [z.bezeichnung, z.nummer || "—", z.gueltig_bis ? datum(z.gueltig_bis) : "unbefristet"])], [4800, 2600, 2200], true) : absatz("Keine Angaben.", { abstand: 200 }))
    + ueberschrift(`${q.taetigkeit ? 5 : 4}. Referenzen`) + absatz(referenzen ? `${referenzen} Referenzen, siehe beigefügte Referenzliste.` : "Siehe Angebot.", { abstand: 300 })
    + absatz("Wir erklären, dass die Angaben vollständig und richtig sind. Auf Verlangen legen wir die entsprechenden Nachweise vor.", { abstand: 600 })
    + absatz("______________________________          ______________________________\nOrt, Datum                                                   Unterschrift, Stempel", { abstand: 400 })
    + absatz("Hinweis: Viele Vergabestellen verlangen ihr eigenes Formular (z. B. Formblatt 124 VHB). Die Angaben dann dorthin übernehmen.", { grau: true, groesse: 16 });
  return wordDokument(body);
}

export function profilSeite(name: string, f: Firma, p: Profil | null, kennzahlen: Kennzahl[] | null, zert: Zertifikat[], o: { admin: boolean; heute: string; finanzen?: boolean }): string {
  const q = p ?? LEER;
  const offen = fehlt(f, p, kennzahlen, zert, o.heute);
  const fertig = 9 - offen.filter((x) => !x.includes("erneuern")).length;
  const stand = `<div class="profil-stand"><div class="profil-balken" role="img" aria-label="${fertig} von 9 Angaben"><span style="width:${Math.round((fertig / 9) * 100)}%"></span></div><span class="klein">${offen.length ? `Es fehlt noch: ${offen.map(escape).join(", ")}` : "✅ Alles da, was Ausschreibungen meist abfragen."}</span></div>`;
  const ro = o.admin ? "" : " disabled";
  const feld = (n: string, label: string, wert: string | number | null, extra = "") => `<label>${label}<input name="${n}" value="${escape(wert === null ? "" : String(wert))}"${extra}${ro}></label>`;
  const stamm = `<form method="post" action="/konto/firmenprofil" class="profil-form"><input type="hidden" name="aktion" value="stamm"><div class="aueg-form">
<label class="ganz">Firmenname<input name="name" required maxlength="200" value="${escape(name)}"${ro}></label>
${feld("strasse", "Straße und Nr.", f.strasse ?? "", ' maxlength="200"')}${feld("plz", "PLZ", f.plz ?? "", ' maxlength="10" inputmode="numeric"')}
${feld("ort", "Ort", f.ort ?? "", ' maxlength="100"')}${feld("telefon", "Telefon", f.telefon ?? "", ' maxlength="40" type="tel"')}
${feld("email", "E-Mail", q.email, ' maxlength="200" type="email"')}${feld("website", "Internet", q.website, ' maxlength="200"')}
<label>Rechtsform<input name="rechtsform" list="rechtsformen" maxlength="60" value="${escape(q.rechtsform)}"${ro}></label><datalist id="rechtsformen">${["Einzelunternehmen", "GbR", "OHG", "KG", "GmbH", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "AG", "eG", "e. K."].map((r) => `<option value="${r}">`).join("")}</datalist>
${feld("gruendungsjahr", "Gründungsjahr", q.gruendungsjahr, ' inputmode="numeric" maxlength="4"')}
${feld("registergericht", "Registergericht", q.registergericht, ' maxlength="100" placeholder="z. B. Amtsgericht Aachen"')}${feld("registernummer", "Registernummer", q.registernummer, ' maxlength="60" placeholder="z. B. HRB 12345"')}
${feld("geschaeftsfuehrung", "Geschäftsführung / Inhaber", q.geschaeftsfuehrung, ' maxlength="300"')}${feld("mitarbeiter", "Beschäftigte (aktuell)", q.mitarbeiter, ' inputmode="numeric"')}
${feld("ustid", "USt-IdNr. (falls vorhanden)", q.ustid, ' maxlength="20" placeholder="DE123456789"')}${feld("steuernummer", "Steuernummer", q.steuernummer ?? "", ' maxlength="30" placeholder="für Rechnungen"')}<label class="zeile"><input type="checkbox" name="kleinunternehmer"${q.kleinunternehmer ? " checked" : ""}${ro}>Kleinunternehmer (§ 19 UStG, keine Umsatzsteuer)</label>
<label class="ganz">Zahlungshinweis auf Rechnungen<input name="zahlungshinweis" maxlength="300" value="${escape(q.zahlungshinweis ?? "")}" placeholder="z. B. Bankverbindung: IBAN DE.. · Musterbank"${ro}></label>
<label class="ganz">Bundesland (für Feiertage und Zuschläge)<select name="bundesland"${ro ? " disabled" : ""}><option value="">aus der PLZ${landAusPlz(f.plz) ? ` (${LAENDER[landAusPlz(f.plz)]})` : ""}</option>${Object.entries(LAENDER).map(([k, n]) => `<option value="${k}"${q.bundesland === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
<label class="ganz">Tätigkeitsbereich (kurz, für Angebote)<textarea name="taetigkeit" rows="3" maxlength="2000"${ro}>${escape(q.taetigkeit)}</textarea></label></div>
${o.admin ? "<button>Speichern</button>" : '<p class="klein">Ändern dürfen Inhaber und Admins.</p>'}</form>`;
  const jahr = Number(o.heute.slice(0, 4));
  const jahre = [jahr - 1, jahr - 2, jahr - 3];
  const kz = kennzahlen === null ? `<p class="klein">Umsatz und Beschäftigte der Vorjahre sieht, wer eine Finanzfreigabe hat.</p>` : `<form method="post" action="/konto/firmenprofil" class="profil-form"><input type="hidden" name="aktion" value="kennzahlen"><table class="auswertung-tabelle"><thead><tr><th>Jahr</th><th>Umsatz netto (€)</th><th>Beschäftigte</th></tr></thead><tbody>${jahre.map((j) => { const k = kennzahlen.find((x) => x.jahr === j); return `<tr><td>${j}</td><td><input name="umsatz_${j}" inputmode="numeric" value="${k?.umsatz != null ? Math.round(Number(k.umsatz)) : ""}" aria-label="Umsatz ${j}"${ro}></td><td><input name="beschaeftigte_${j}" inputmode="numeric" value="${k?.beschaeftigte ?? ""}" aria-label="Beschäftigte ${j}"${ro}></td></tr>`; }).join("")}</tbody></table>${o.admin ? "<button>Kennzahlen speichern</button>" : ""}</form>`;
  const logo = `<div class="logo-teil">${q.logo ? `<img src="/konto/firmenlogo" alt="Logo ${escape(name)}" class="firmenlogo">` : `<span class="klein">Noch kein Logo.</span>`}${o.admin ? `<form method="post" action="/konto/firmenprofil" enctype="multipart/form-data" class="foto-form"><input type="hidden" name="aktion" value="logo"><input type="file" name="logo" accept="image/png,image/jpeg" required aria-label="Logo auswählen"><button class="zweit">Hochladen</button></form>${q.logo ? `<form method="post" action="/konto/firmenprofil" class="termin-weg"><input type="hidden" name="aktion" value="logo_weg"><button class="zweit">Entfernen</button></form>` : ""}` : ""}</div><p class="klein">PNG oder JPG, höchstens 500 KB. Erscheint oben im Angebot.</p>`;
  const zeile = (z: Zertifikat) => { const ab = z.gueltig_bis && z.gueltig_bis < o.heute, bald = z.gueltig_bis && !ab && z.gueltig_bis <= new Date(Date.parse(o.heute) + 90 * 86400_000).toISOString().slice(0, 10);
    return `<li class="${ab ? "abgelaufen" : bald ? "bald" : ""}"><div><strong>${escape(z.bezeichnung)}</strong><span class="klein">${[z.nummer && `Nr. ${escape(z.nummer)}`, z.aussteller && escape(z.aussteller), z.gueltig_bis ? `${ab ? "⚠️ abgelaufen am" : bald ? "⏳ gültig bis" : "gültig bis"} ${datum(z.gueltig_bis)}` : "unbefristet"].filter(Boolean).join(" · ")}</span></div>${o.admin ? `<form method="post" action="/konto/firmenprofil"><input type="hidden" name="aktion" value="zert_weg"><input type="hidden" name="id" value="${z.id}"><button class="zweit" aria-label="Zertifikat löschen">✕</button></form>` : ""}</li>`; };
  const zertForm = o.admin ? `<details class="termin-neu"><summary>➕ Präqualifikation oder Zertifikat</summary><form method="post" action="/konto/firmenprofil"><input type="hidden" name="aktion" value="zert"><div class="aueg-form">
<label class="ganz">Art<select name="art">${Object.entries(ZERT_ARTEN).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
<label class="ganz">Bezeichnung (leer = Art)<input name="bezeichnung" maxlength="200"></label><label>Nummer<input name="nummer" maxlength="100"></label><label>Gültig bis<input name="gueltig_bis" type="date"></label>
<label class="ganz">Aussteller<input name="aussteller" maxlength="200" placeholder="z. B. PQ-Verein, TÜV"></label></div><button>Speichern</button></form></details>` : "";
  return `${stand}
<nav class="aktionsleiste"><a href="/konto/firmenprofil/eigenerklaerung.docx" download>📄 Eigenerklärung (Word)</a>${o.finanzen === false ? "" : `<a class="zweit" href="/konto/referenzen">📚 Referenzen</a>`}</nav>
<h2>🏢 Stammdaten</h2>${stamm}
<h2>🖼️ Logo</h2>${logo}
<h2>📈 Umsatz und Beschäftigte</h2>${kz}
<h2>🏅 Präqualifikation und Zertifikate</h2>${zert.length ? `<ul class="kontakt-liste zert-liste">${zert.map(zeile).join("")}</ul>` : `<p class="klein">Noch keine eingetragen. Eine Präqualifikation (PQ-VOB oder AVPQ) ersetzt in vielen Verfahren die Einzelnachweise.</p>`}${zertForm}
<p class="klein">Jarvis setzt diese Angaben in die Eigenerklärung und in Textbausteine ein (Platzhalter wie {{RECHTSFORM}}, {{GRUENDUNGSJAHR}}, {{MITARBEITER}}, {{PQ}}). Die Eigenerklärung liegt auch in der Angebotsmappe.</p>`;
}

export async function profilLaden(s: Sitzung, env: KontoEnv, firma: string, finanzen: boolean) {
  const [f, p, k, z, bm] = await Promise.all([
    db<(Firma & { name: string })[]>(s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort,telefon`),
    db<Profil[]>(s, env, `firmenprofil?firma_id=eq.${firma}&select=rechtsform,registergericht,registernummer,gruendungsjahr,mitarbeiter,website,email,ustid,geschaeftsfuehrung,taetigkeit,logo,bundesland,steuernummer,kleinunternehmer,zahlungshinweis`),
    finanzen ? db<Kennzahl[]>(s, env, `firmen_kennzahlen?firma_id=eq.${firma}&select=jahr,umsatz,beschaeftigte&order=jahr.desc&limit=10`) : Promise.resolve(null),
    db<Zertifikat[]>(s, env, `firmen_zertifikate?firma_id=eq.${firma}&select=id,art,bezeichnung,nummer,aussteller,gueltig_bis&order=gueltig_bis.nullslast`),
    db<{ art: string }[]>(s, env, `betriebsmittel?firma_id=eq.${firma}&select=art&limit=2000`),
  ]);
  const firm = f.ok ? f.daten[0] : undefined;
  return { name: firm?.name ?? "Firma", firma: { name: firm?.name ?? "", strasse: firm?.strasse ?? "", plz: firm?.plz ?? "", ort: firm?.ort ?? "", telefon: firm?.telefon ?? "" } as Firma, profil: p.ok ? p.daten[0] ?? null : null, kennzahlen: k ? (k.ok ? k.daten : []) : null, zertifikate: z.ok ? z.daten : [], ausstattung: ausstattungText(bm.ok ? bm.daten : []) };
}

export async function firmenprofil(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!["/konto/firmenprofil", "/konto/firmenprofil/eigenerklaerung.docx", "/konto/firmenlogo"].includes(url.pathname)) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  const antwort = (t: string, status = 200) => html(seite("Firmenprofil", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das Firmenprofil sieht das Büroteam.</p>", 403);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (url.pathname === "/konto/firmenlogo") {
    const obj = await env.DATEN?.get(`firmenlogo/${firma}`);
    if (!obj) return new Response("Kein Logo", { status: 404 });
    return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "image/png", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
  }
  if (url.pathname.endsWith(".docx")) {
    const d = await profilLaden(f.s, env, firma, f.finanzen);
    const refs = await db<{ id: string }[]>(f.s, env, `referenzen?firma_id=eq.${firma}&select=id`);
    return wordAntwort(eigenerklaerungDocx(d.name, d.firma, d.profil, d.kennzahlen ?? [], d.zertifikate, refs.ok ? refs.daten.length : 0, heute, d.ausstattung), `Eigenerklaerung_${d.name.replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 60)}.docx`, f.s.cookies);
  }
  if (request.method === "POST") {
    const zurueck = (h: string) => weiterleiten(`/konto/firmenprofil?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!f.admin) return zurueck("Ändern dürfen Inhaber und Admins.");
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const zahl = (k: string, min: number, max: number) => { const v = t(k, 20).replace(/\./g, "").replace(",", "."); if (!v) return null; const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : NaN; };
    const aktion = t("aktion", 20);
    if (aktion === "stamm") {
      const gj = zahl("gruendungsjahr", 1800, 2100), ma = zahl("mitarbeiter", 0, 1000000);
      if (t("name", 200).length < 2 || Number.isNaN(gj) || Number.isNaN(ma) || (t("email", 200) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t("email", 200)))) return zurueck("Bitte die Angaben prüfen (Name, Jahr, Zahl, E-Mail).");
      // The firm's row (name, address) may only be changed by the owner (database rule); admins save the profile.
      const firmenZeile = f.m.rolle === "inhaber" ? await db(f.s, env, `firmen?id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ name: t("name", 200), strasse: t("strasse", 200), plz: t("plz", 10), ort: t("ort", 100), telefon: t("telefon", 40) }) }) : { ok: true };
      const r = await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, rechtsform: t("rechtsform", 60), registergericht: t("registergericht", 100), registernummer: t("registernummer", 60), gruendungsjahr: gj, mitarbeiter: ma, website: t("website", 200), email: t("email", 200), ustid: t("ustid", 20).toUpperCase().replace(/\s/g, ""), geschaeftsfuehrung: t("geschaeftsfuehrung", 300), taetigkeit: String(form.get("taetigkeit") ?? "").trim().slice(0, 2000), bundesland: String(form.get("bundesland") ?? "") in LAENDER ? String(form.get("bundesland")) : "", steuernummer: t("steuernummer", 30), kleinunternehmer: form.get("kleinunternehmer") === "on", zahlungshinweis: t("zahlungshinweis", 300), geaendert: new Date().toISOString() }) });
      return zurueck(r.ok && firmenZeile.ok ? `Gespeichert.${f.m.rolle !== "inhaber" ? " Name und Anschrift kann nur der Inhaber ändern." : ""}` : "Speichern hat nicht geklappt.");
    }
    if (aktion === "kennzahlen") {
      if (!f.finanzen) return zurueck("Dafür brauchst du eine Finanzfreigabe.");
      const jahr = Number(heute.slice(0, 4));
      const zeilen = [jahr - 1, jahr - 2, jahr - 3].map((j) => ({ firma_id: firma, jahr: j, umsatz: zahl(`umsatz_${j}`, 0, 1e13), beschaeftigte: zahl(`beschaeftigte_${j}`, 0, 1000000) }));
      if (zeilen.some((z) => Number.isNaN(z.umsatz) || Number.isNaN(z.beschaeftigte))) return zurueck("Bitte nur Zahlen eintragen.");
      const r = await db(f.s, env, "firmen_kennzahlen?on_conflict=firma_id,jahr", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(zeilen) });
      return zurueck(r.ok ? "Kennzahlen gespeichert." : "Speichern hat nicht geklappt.");
    }
    if (aktion === "logo" || aktion === "logo_weg") {
      if (!env.DATEN) return zurueck("Speicher nicht verfügbar.");
      if (aktion === "logo_weg") { await env.DATEN.delete(`firmenlogo/${firma}`); await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, logo: null }) }); return zurueck("Logo entfernt."); }
      const datei = form.get("logo");
      if (!datei || typeof datei === "string" || datei.size < 50 || datei.size > 512000 || !["image/png", "image/jpeg"].includes(datei.type)) return zurueck("Bitte ein PNG oder JPG bis 500 KB wählen.");
      const bytes = new Uint8Array(await datei.arrayBuffer());
      const echt = datei.type === "image/png" ? bytes[0] === 0x89 && bytes[1] === 0x50 : bytes[0] === 0xff && bytes[1] === 0xd8;
      if (!echt) return zurueck("Die Datei ist kein gültiges Bild.");
      await env.DATEN.put(`firmenlogo/${firma}`, bytes, { httpMetadata: { contentType: datei.type } });
      const r = await db(f.s, env, "firmenprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, logo: datei.type }) });
      return zurueck(r.ok ? "Logo gespeichert." : "Speichern hat nicht geklappt.");
    }
    if (aktion === "zert") {
      const art = t("art", 20) in ZERT_ARTEN ? t("art", 20) : "sonstiges";
      const bis = t("gueltig_bis", 10);
      const r = await db(f.s, env, "firmen_zertifikate", { method: "POST", body: JSON.stringify({ firma_id: firma, art, bezeichnung: t("bezeichnung", 200) || ZERT_ARTEN[art], nummer: t("nummer", 100), aussteller: t("aussteller", 200), gueltig_bis: /^\d{4}-\d{2}-\d{2}$/.test(bis) ? bis : null }) });
      return zurueck(r.ok ? "Zertifikat gespeichert." : "Speichern hat nicht geklappt.");
    }
    if (aktion === "zert_weg" && /^[0-9a-f-]{36}$/.test(t("id", 36))) {
      const r = await db(f.s, env, `firmen_zertifikate?id=eq.${t("id", 36)}&firma_id=eq.${firma}`, { method: "DELETE" });
      return zurueck(r.ok ? "Zertifikat gelöscht." : "Löschen hat nicht geklappt.");
    }
    return zurueck("Das ging nicht.");
  }
  const d = await profilLaden(f.s, env, firma, f.finanzen);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${profilSeite(d.name, d.firma, d.profil, d.kennzahlen, d.zertifikate, { admin: f.admin, heute, finanzen: f.finanzen })}`);
}
