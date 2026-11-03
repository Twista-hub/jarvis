// References as a form (E4): the firm enters its past contracts once; Crewtender builds the reference list
// for offers as a Word file and adds it to the proof zip and the offer folder.
import { strToU8, zipSync } from "fflate";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { escape, seite } from "./seite.ts";

export type Referenz = { id: string; firma_id: string; auftraggeber: string; leistung: string; ort: string | null; von: string | null; bis: string | null; laufend: boolean; auftragswert: number | null; personal: number | null; ansprechpartner: string | null; kontakt: string | null };

export async function referenzenLaden(s: Sitzung, env: KontoEnv, firma: string): Promise<Referenz[]> {
  const r = await db<Referenz[]>(s, env, `referenzen?firma_id=eq.${firma}&select=*&order=von.desc.nullslast,erstellt.desc`);
  return r.ok ? r.daten : [];
}

const monat = (iso: string | null) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric", timeZone: "UTC" }) : "";
export function zeitraum(r: Pick<Referenz, "von" | "bis" | "laufend">): string {
  if (!r.von && !r.bis) return r.laufend ? "laufend" : "";
  return `${monat(r.von) || "?"} – ${r.laufend ? "laufend" : monat(r.bis) || "?"}`;
}
export const euro = (n: number | null) => n === null || n === undefined ? "" : `${Number(n).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`;

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absatz = (text: string, opts: { fett?: boolean; groesse?: number } = {}) =>
  `<w:p><w:r><w:rPr>${opts.fett ? "<w:b/>" : ""}${opts.groesse ? `<w:sz w:val="${opts.groesse}"/>` : ""}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p>`;
const zelle = (text: string, breite: number, kopf = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="${breite}" w:type="dxa"/>${kopf ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF3"/>' : ""}</w:tcPr>${text.split("\n").map((t) => absatz(t, { fett: kopf, groesse: 18 })).join("")}</w:tc>`;

/** Reference list as a small Word file (landscape table), built without a template. */
export function referenzlisteDocx(firma: string, refs: Referenz[], stand = new Date()): Uint8Array {
  const spalten: [string, number, (r: Referenz, i: number) => string][] = [
    ["Nr.", 500, (_r, i) => String(i + 1)],
    ["Auftraggeber", 2300, (r) => r.auftraggeber + (r.ort ? `\n${r.ort}` : "")],
    ["Leistung", 4300, (r) => r.leistung],
    ["Zeitraum", 1700, (r) => zeitraum(r)],
    ["Auftragswert", 1400, (r) => euro(r.auftragswert)],
    ["Personal", 1000, (r) => r.personal ? `${r.personal}` : ""],
    ["Ansprechpartner", 3000, (r) => [r.ansprechpartner, r.kontakt].filter(Boolean).join("\n")],
  ];
  const rand = '<w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("") + "</w:tblBorders>";
  const tabelle = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${rand}<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${spalten.map(([, b]) => `<w:gridCol w:w="${b}"/>`).join("")}</w:tblGrid>`
    + `<w:tr><w:trPr><w:tblHeader/></w:trPr>${spalten.map(([t, b]) => zelle(t, b, true)).join("")}</w:tr>`
    + refs.map((r, i) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${spalten.map(([, b, f]) => zelle(f(r, i), b)).join("")}</w:tr>`).join("") + "</w:tbl>";
  const body = absatz(`Referenzliste ${firma}`, { fett: true, groesse: 32 }) + absatz(`Stand: ${stand.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`, { groesse: 20 }) + tabelle
    + '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr>';
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  });
}

/** Form values → row; null when a required field is missing or a value is invalid. */
export function referenzAusFormular(f: FormData): Omit<Referenz, "id" | "firma_id"> | null {
  const t = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const datum = (k: string) => { const v = t(k, 10); return /^\d{4}-\d{2}(-\d{2})?$/.test(v) ? (v.length === 7 ? `${v}-01` : v) : null; };
  const zahl = (k: string) => { const v = t(k, 20).replace(/\./g, "").replace(",", "."); return v && Number.isFinite(+v) && +v >= 0 ? +v : null; };
  const r = { auftraggeber: t("auftraggeber", 200), leistung: t("leistung", 500), ort: t("ort", 100) || null, von: datum("von"), bis: datum("bis"), laufend: f.get("laufend") === "1", auftragswert: zahl("auftragswert"), personal: zahl("personal") === null ? null : Math.round(zahl("personal")!), ansprechpartner: t("ansprechpartner", 200) || null, kontakt: t("kontakt", 200) || null };
  if (!r.auftraggeber || !r.leistung || (r.von && r.bis && r.bis < r.von)) return null;
  if (r.laufend) r.bis = null;
  return r;
}

function formular(r: Partial<Referenz>, firma: string, knopf: string): string {
  const v = (k: keyof Referenz) => escape(String(r[k] ?? ""));
  return `<form method="post" action="/konto/referenzen?firma=${firma}" class="referenz-felder">${r.id ? `<input type="hidden" name="id" value="${r.id}">` : ""}
<label>Auftraggeber<input name="auftraggeber" required maxlength="200" value="${v("auftraggeber")}" placeholder="z. B. Stadt Aachen"></label>
<label>Ort<input name="ort" maxlength="100" value="${v("ort")}" placeholder="z. B. Aachen"></label>
<label class="ganz">Leistung<textarea name="leistung" required maxlength="500" rows="2" placeholder="z. B. Unterhaltsreinigung Rathaus, 4.500 m²">${v("leistung")}</textarea></label>
<label>Von<input name="von" type="month" value="${escape((r.von ?? "").slice(0, 7))}"></label>
<label>Bis<input name="bis" type="month" value="${escape((r.bis ?? "").slice(0, 7))}"></label>
<label class="haken ganz"><input type="checkbox" name="laufend" value="1"${r.laufend ? " checked" : ""}> Auftrag läuft noch</label>
<label>Auftragswert (€)<input name="auftragswert" inputmode="decimal" value="${r.auftragswert ?? ""}" placeholder="z. B. 120000"></label>
<label>Eingesetzte Kräfte<input name="personal" inputmode="numeric" value="${r.personal ?? ""}" placeholder="z. B. 6"></label>
<label>Ansprechpartner<input name="ansprechpartner" maxlength="200" value="${v("ansprechpartner")}" placeholder="z. B. Frau Meier, Gebäudemanagement"></label>
<label>Telefon oder E-Mail<input name="kontakt" maxlength="200" value="${v("kontakt")}"></label>
<button class="ganz">${knopf}</button></form>`;
}

export function referenzenSeite(refs: Referenz[], o: { firma: string; admin: boolean; fehler?: string }): string {
  const liste = refs.length ? `<ul class="referenz-liste">${refs.map((r) => `<li class="referenz" id="ref-${r.id}"><div class="referenz-kopf"><strong>${escape(r.auftraggeber)}</strong><span class="klein">${escape([r.ort, zeitraum(r)].filter(Boolean).join(" · "))}</span></div><p>${escape(r.leistung)}</p><div class="referenz-fakten">${r.auftragswert !== null ? `<span>💶 ${euro(r.auftragswert)}</span>` : ""}${r.personal ? `<span>👥 ${r.personal} Kräfte</span>` : ""}${r.ansprechpartner || r.kontakt ? `<span>☎️ ${escape([r.ansprechpartner, r.kontakt].filter(Boolean).join(", "))}</span>` : ""}</div>${o.admin ? `<details class="datei-menue"><summary aria-label="Referenz bearbeiten">⋯</summary><div class="datei-menue-inhalt">${formular(r, o.firma, "Änderung speichern")}<form method="post" action="/konto/referenzen?firma=${o.firma}"><input type="hidden" name="loeschen" value="${r.id}"><button class="zweit gefahr">Referenz löschen</button></form></div></details>` : ""}</li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Referenzen. Trage frühere Aufträge einmal ein, dann legt Crewtender die Referenzliste jedem Angebot bei, das Referenzen verlangt.</p>`;
  return `${o.fehler ? `<p class="fehler">${escape(o.fehler)}</p>` : ""}<div class="unterlagen-werkzeuge">${refs.length ? `<a class="knopf" href="/konto/referenzen/liste.docx?firma=${o.firma}">⬇ Referenzliste (Word)</a>` : ""}<a class="knopf zweit" href="/konto/firmenunterlagen?firma=${o.firma}">📁 Firmenunterlagen</a></div>${o.admin ? `<details class="upload-neu"${refs.length ? "" : " open"}><summary>➕ Referenz hinzufügen</summary>${formular({}, o.firma, "Referenz speichern")}</details>` : ""}${liste}<p class="klein">Höchstens 100 Referenzen je Firma. Nur Personen mit Finanzfreigabe sehen sie.</p>`;
}

export async function referenzen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/referenzen" && url.pathname !== "/konto/referenzen/liste.docx") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Referenzen", `<p class="konto-zurueck"><a href="/konto/firmenunterlagen?firma=${f.m.firma_id}" aria-label="Zurück zu den Unterlagen">←</a></p>${text}`, 0, "unterlagen"), status, f.s.cookies);
  if (!f.finanzen) return antwort("<p>Für Referenzen brauchst du eine Finanzfreigabe.</p>", 403);
  const zurueck = (anker = "") => weiterleiten(`/konto/referenzen?firma=${f.m.firma_id}${anker}`, f.s.cookies);
  if (url.pathname.endsWith(".docx")) {
    const refs = await referenzenLaden(f.s, env, f.m.firma_id);
    const headers = new Headers({ "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="Referenzliste.docx"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
    for (const c of f.s.cookies) headers.append("set-cookie", c);
    return new Response(referenzlisteDocx(f.m.firmen.name, refs), { headers });
  }
  let fehler = "";
  if (request.method === "POST") {
    if (!f.admin) return antwort("<p>Nur Inhaber und Administration dürfen Referenzen ändern.</p>", 403);
    const form = await request.formData();
    const weg = String(form.get("loeschen") ?? "");
    if (/^[0-9a-f-]{36}$/.test(weg)) {
      const r = await db(f.s, env, `referenzen?id=eq.${weg}&firma_id=eq.${f.m.firma_id}`, { method: "DELETE" });
      if (r.ok) return zurueck();
      fehler = "Die Referenz konnte nicht gelöscht werden.";
    } else {
      const daten = referenzAusFormular(form);
      const id = String(form.get("id") ?? "");
      if (!daten) fehler = "Bitte Auftraggeber und Leistung eintragen (das Ende darf nicht vor dem Beginn liegen).";
      else {
        const r = /^[0-9a-f-]{36}$/.test(id)
          ? await db(f.s, env, `referenzen?id=eq.${id}&firma_id=eq.${f.m.firma_id}`, { method: "PATCH", body: JSON.stringify(daten) })
          : await db(f.s, env, "referenzen", { method: "POST", body: JSON.stringify({ ...daten, firma_id: f.m.firma_id }) });
        if (r.ok) return zurueck(id ? `#ref-${id}` : "");
        fehler = "Die Referenz konnte nicht gespeichert werden (höchstens 100 je Firma).";
      }
    }
  }
  return antwort(referenzenSeite(await referenzenLaden(f.s, env, f.m.firma_id), { firma: f.m.firma_id, admin: f.admin, fehler }), fehler ? 400 : 200);
}
