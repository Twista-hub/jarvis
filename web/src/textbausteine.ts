// N7: Textbausteine. Recurring offer texts of the firm (company profile, quality, staffing, closing) with
// placeholders; ticked on the offer page, they are appended to the offer text.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Baustein = { id: string; titel: string; kategorie: string; text: string; immer: boolean };
export const PLATZHALTER: [string, string][] = [["{{FIRMA}}", "Name eurer Firma"], ["{{AUFTRAG}}", "Titel der Ausschreibung"], ["{{AUFTRAGGEBER}}", "Auftraggeber"], ["{{DATUM}}", "heutiges Datum"],
  ["{{RECHTSFORM}}", "Rechtsform"], ["{{GRUENDUNGSJAHR}}", "Gründungsjahr"], ["{{MITARBEITER}}", "Beschäftigte"], ["{{ANSCHRIFT}}", "Anschrift"], ["{{REGISTER}}", "Handelsregister"], ["{{GESCHAEFTSFUEHRUNG}}", "Geschäftsführung"], ["{{PQ}}", "Präqualifikation"]];
export const KATEGORIEN = ["Einleitung", "Firmenvorstellung", "Personal und Vertretung", "Qualität", "Konzept", "Schluss", "Allgemein"];
export const BEISPIELE: Omit<Baustein, "id">[] = [
  { titel: "Firmenvorstellung", kategorie: "Firmenvorstellung", immer: true, text: "{{FIRMA}} ({{RECHTSFORM}}) erbringt seit {{GRUENDUNGSJAHR}} Leistungen dieser Art für öffentliche und private Auftraggeber. Mit {{MITARBEITER}} Beschäftigten sind wir eingearbeitet, zuverlässig und mit den Anforderungen vertraut. [[Schwerpunkte ergänzen]]" },
  { titel: "Personaleinsatz und Vertretung", kategorie: "Personal und Vertretung", immer: false, text: "Für den Auftrag „{{AUFTRAG}}“ setzen wir festes Stammpersonal ein. Ausfälle durch Urlaub oder Krankheit überbrücken wir mit eingewiesenen Vertretungskräften, sodass die vereinbarte Besetzung jederzeit gewährleistet ist. Eine feste Ansprechperson koordiniert den Einsatz." },
  { titel: "Qualitätssicherung", kategorie: "Qualität", immer: false, text: "Wir sichern die Qualität durch regelmäßige Kontrollen vor Ort, dokumentierte Einweisungen und kurze Wege bei Rückfragen. Mängel beheben wir umgehend und informieren den Auftraggeber über die getroffenen Maßnahmen." },
  { titel: "Schlussformel", kategorie: "Schluss", immer: true, text: "Wir würden uns freuen, den Auftrag für {{AUFTRAGGEBER}} auszuführen, und stehen für Rückfragen jederzeit zur Verfügung.\n\nMit freundlichen Grüßen\n{{FIRMA}}" },
];

export function ausfuellen(text: string, werte: Record<string, string>): string {
  return text.replace(/\{\{(FIRMA|AUFTRAG|AUFTRAGGEBER|DATUM|RECHTSFORM|GRUENDUNGSJAHR|MITARBEITER|ANSCHRIFT|REGISTER|GESCHAEFTSFUEHRUNG|PQ)\}\}/g, (m, k: string) => werte[k] || m);
}

/** Appends the ticked text modules (in category order) that are not in the text yet. */
export function anhaengen(text: string, gewaehlt: Baustein[], werte: Record<string, string>): string {
  const rang = (k: string) => { const i = KATEGORIEN.indexOf(k); return i < 0 ? KATEGORIEN.length : i; };
  const neu = [...gewaehlt].sort((a, b) => rang(a.kategorie) - rang(b.kategorie) || a.titel.localeCompare(b.titel, "de"))
    .map((b) => ausfuellen(b.text.trim(), werte)).filter((t) => t && !text.includes(t));
  return neu.length ? `${text.trimEnd()}\n\n${neu.join("\n\n")}` : text;
}

/** Checkbox list for the offer page; on the first draft the "always" modules are pre-ticked. */
export function bausteineFeld(liste: Baustein[], text: string, ersterEntwurf: boolean, werte: Record<string, string>): string {
  if (!liste.length) return `<p class="klein">📚 Wiederkehrende Texte (Firmenvorstellung, Qualität, Schluss) kannst du als <a href="/konto/textbausteine">Textbausteine</a> speichern.</p>`;
  return `<fieldset class="baustein-auswahl"><legend>📚 Textbausteine anhängen</legend>${liste.map((b) => {
    const drin = text.includes(ausfuellen(b.text.trim(), werte));
    return `<label class="zeile"><input type="checkbox" name="baustein" value="${b.id}"${!drin && ersterEntwurf && b.immer ? " checked" : ""}${drin ? " disabled" : ""}><span>${escape(b.titel)}${drin ? ' <span class="klein">· schon im Text</span>' : ""}</span></label>`;
  }).join("")}<p class="klein">Angehakte Bausteine kommen beim Speichern ans Ende des Angebotstexts. <a href="/konto/textbausteine">Bausteine bearbeiten</a></p></fieldset>`;
}

export async function bausteineLaden(s: Sitzung, env: KontoEnv, firma: string): Promise<Baustein[]> {
  const r = await db<Baustein[]>(s, env, `textbausteine?firma_id=eq.${firma}&select=id,titel,kategorie,text,immer&order=kategorie,titel&limit=200`);
  return r.ok ? r.daten : [];
}

export function bausteineSeite(liste: Baustein[], o: { darfAendern: boolean; offen?: string }): string {
  const formular = (b?: Baustein) => `<form method="post" action="/konto/textbausteine">${b ? `<input type="hidden" name="id" value="${b.id}">` : ""}<div class="aueg-form">
<label>Titel<input name="titel" required maxlength="120" value="${escape(b?.titel ?? "")}" placeholder="z. B. Firmenvorstellung"></label>
<label>Bereich<input name="kategorie" list="baustein-kategorien" maxlength="60" value="${escape(b?.kategorie ?? "Allgemein")}"></label>
<label class="ganz">Text<textarea name="text" rows="6" maxlength="10000" required>${escape(b?.text ?? "")}</textarea></label></div>
<label class="zeile"><input type="checkbox" name="immer"${b?.immer ? " checked" : ""}> Bei neuen Angeboten automatisch anhaken</label>
<div class="baustein-knoepfe"><button>${b ? "Speichern" : "Baustein anlegen"}</button>${b ? `<button name="loeschen" value="${b.id}" class="zweit" formnovalidate>Löschen</button>` : ""}</div></form>`;
  const gruppen = new Map<string, Baustein[]>();
  for (const b of liste) gruppen.set(b.kategorie, [...(gruppen.get(b.kategorie) ?? []), b]);
  const karte = (b: Baustein) => `<li><details${o.offen === b.id ? " open" : ""}><summary><strong>${escape(b.titel)}</strong>${b.immer ? ' <span class="radar-marke">immer</span>' : ""}<span class="klein baustein-vorschau">${escape(b.text.replace(/\s+/g, " ").slice(0, 110))}${b.text.length > 110 ? "…" : ""}</span></summary>${o.darfAendern ? formular(b) : `<p class="baustein-text">${escape(b.text)}</p>`}</details></li>`;
  return `<p class="klein">Texte, die in vielen Angeboten vorkommen. Auf der Seite „Angebot vorbereiten“ hakst du sie an, Jarvis hängt sie an das Angebot. Platzhalter: ${PLATZHALTER.map(([p, t]) => `<code>${p}</code> ${t}`).join(" · ")}. Stellen in <code>[[…]]</code> muss man vor dem Download ausfüllen.</p>
<datalist id="baustein-kategorien">${KATEGORIEN.map((k) => `<option value="${k}">`).join("")}</datalist>
${liste.length ? [...gruppen].map(([k, l]) => `<h2>${escape(k)}</h2><ul class="baustein-liste">${l.map(karte).join("")}</ul>`).join("") : `<p class="treffer-leer">Noch keine Textbausteine.</p>${o.darfAendern ? `<form method="post" action="/konto/textbausteine"><input type="hidden" name="aktion" value="beispiele"><button class="zweit">4 Beispiele anlegen (Firmenvorstellung, Personal, Qualität, Schluss)</button></form>` : ""}`}
${o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Neuer Baustein</summary>${formular()}</details>` : ""}`;
}

export async function textbausteineSeite(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/textbausteine") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Textbausteine", `<p class="konto-zurueck"><a href="/konto/einstellungen" aria-label="Zurück">←</a></p>${t}`, 0, "einstellungen"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Textbausteine sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string, offen = "") => weiterleiten(`/konto/textbausteine?hinweis=${encodeURIComponent(h)}${offen ? `&offen=${offen}` : ""}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Inhaber, Admins und Bearbeiter.");
    const uuid = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    if (form.get("aktion") === "beispiele") {
      const r = await db(f.s, env, "textbausteine", { method: "POST", body: JSON.stringify(BEISPIELE.map((b) => ({ ...b, firma_id: firma }))) });
      return zurueck(r.ok ? "4 Beispiele angelegt. Passe sie an eure Firma an." : "Anlegen hat nicht geklappt.");
    }
    if (uuid("loeschen")) {
      const r = await db(f.s, env, `textbausteine?id=eq.${uuid("loeschen")}&firma_id=eq.${firma}`, { method: "DELETE" });
      return zurueck(r.ok ? "Baustein gelöscht." : "Löschen hat nicht geklappt.");
    }
    const zeile = { titel: String(form.get("titel") ?? "").trim().slice(0, 120), kategorie: String(form.get("kategorie") ?? "").trim().slice(0, 60) || "Allgemein", text: String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 10000), immer: form.get("immer") === "on", geaendert: new Date().toISOString() };
    if (zeile.titel.length < 2 || !zeile.text) return zurueck("Bitte Titel und Text angeben.");
    const r = uuid("id")
      ? await db(f.s, env, `textbausteine?id=eq.${uuid("id")}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(zeile) })
      : await db(f.s, env, "textbausteine", { method: "POST", body: JSON.stringify({ ...zeile, firma_id: firma }) });
    return zurueck(r.ok ? "Baustein gespeichert." : "Speichern hat nicht geklappt.", uuid("id"));
  }
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${bausteineSeite(await bausteineLaden(f.s, env, firma), { darfAendern, offen: url.searchParams.get("offen") ?? "" })}`);
}
