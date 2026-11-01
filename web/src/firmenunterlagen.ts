import { cookie, db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { darfFinanzen } from "./rechte.ts";
import { escape, seite } from "./seite.ts";
import { NACHWEIS_TYPEN, vorhanden } from "./nachweise.ts";
import { zipSync } from "fflate";
import { apiClient, type KiEnv } from "./api-budget.ts";
import { referenzenLaden, referenzlisteDocx, type Referenz } from "./referenzen.ts";

export const UUID = /^[0-9a-f-]{36}$/;
export type FirmenDatei = { id:string;firma_id:string;name:string;art:string;dateiname:string;mime:string;groesse:number;gueltig_bis:string|null };
export const dateiKey = (d: Pick<FirmenDatei,"firma_id"|"id">) => `bibliothek/${d.firma_id}/${d.id}`;
export const dateiname = (s:string) => s.replace(/[^\p{L}\p{N}._ -]/gu,"_").replace(/^\.+/,"").slice(0,120) || "datei";

export async function aktiveFirma(request: Request, env: KontoEnv, gewaehlt?: string) {
  const s = await sitzung(request,env);
  if (!s) return null;
  const r = await db<{firma_id:string;rolle:string;finanzen:boolean;firmen:{name:string}}[]>(s,env,`mitglieder?user_id=eq.${s.userId}&aktiv=eq.true&select=firma_id,rolle,finanzen,firmen(name)&order=erstellt`);
  if (!r.ok) return null;
  const firma = gewaehlt || new URL(request.url).searchParams.get("firma") || cookie(request,"jv_firma");
  const m = firma ? r.daten.find((x)=>x.firma_id===firma) : r.daten[0];
  return m ? {s,m,admin:["inhaber","admin"].includes(m.rolle),finanzen:darfFinanzen(m.rolle,m.finanzen)} : null;
}

// Folders: a file without its own folder lands in the folder that fits its name (existing files are sorted too).
export const ORDNER_REGELN: [string, RegExp][] = [
  ["Versicherungen", /haftpflicht|versicherung|deckungssumme/i],
  ["Register & Gewerbe", /handelsregister|gewerbe/i],
  ["Steuern & Sozialversicherung", /finanzamt|krankenkasse|sozialversicherung|berufsgenossenschaft|unbedenklich|unfallversicherung/i],
  ["Erlaubnisse & Zertifikate", /erlaubnis|zertifi|\biso\s?\d|f(ü|ue)hrungszeugnis/i],
  ["Erklärungen", /erkl(ä|ae)rung|tariftreue|mindestlohn/i],
  ["Referenzen & Umsatz", /referenz|umsatz/i],
];
export const STANDARD_ORDNER = [...ORDNER_REGELN.map(([n]) => n), "Angebotsvorlagen", "Sonstiges"];
export function ordnerVon(d: Pick<FirmenDatei, "art" | "name" | "dateiname"> & { ordner?: string | null }): string {
  if (d.ordner) return d.ordner;
  if (d.art === "vorlage") return "Angebotsvorlagen";
  return ORDNER_REGELN.find(([, m]) => m.test(d.name) || m.test(d.dateiname))?.[0] ?? "Sonstiges";
}

/** Content type for the in-app preview; null when the browser cannot show the file (Word, Excel). */
export function vorschauTyp(name: string): string | null {
  const e = name.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? "";
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8" } as Record<string, string>)[e] ?? null;
}

const ABLAUF_SCHEMA = { type: "object", properties: { gueltig_bis: { type: "string" }, fundstelle: { type: "string" } }, required: ["gueltig_bis", "fundstelle"], additionalProperties: false };
const base64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
/** Valid ISO date between 2000 and 2100, else null. */
export function ablaufDatum(roh: string): string | null {
  const m = roh.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || +m[1] < 2000 || +m[1] > 2100) return null;
  const d = new Date(`${roh.trim()}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== roh.trim() ? null : roh.trim();
}
export const ablaufLesbar = (name: string, groesse: number) => groesse <= 5 * 1024 * 1024 && /\.(pdf|png|jpe?g)$/i.test(name);

/** Reads the expiry date from a proof (PDF or photo). Haiku, effort low: about one cent per document. */
export async function ablaufLesen(env: KiEnv, daten: Uint8Array, name: string): Promise<string | null> {
  const pdf = /\.pdf$/i.test(name);
  const quelle = { type: "base64" as const, media_type: (pdf ? "application/pdf" : /\.png$/i.test(name) ? "image/png" : "image/jpeg") as never, data: base64(daten) };
  const antwort = await Promise.race([
    apiClient(env).messages.create({
      model: "claude-haiku-5-5", max_tokens: 300,
      output_config: { effort: "low", format: { type: "json_schema", schema: ABLAUF_SCHEMA } },
      system: "Du liest Nachweise deutscher Firmen (Versicherungsbestätigung, Unbedenklichkeitsbescheinigung, Erlaubnis, Zertifikat, Registerauszug). Gib zurück, bis wann das Dokument gültig ist, als JJJJ-MM-TT: ausdrückliches Gültig-bis- oder Ablaufdatum, Ende des Versicherungszeitraums oder Befristung. Nennt das Dokument nur eine Dauer ab Ausstellung (z. B. „gilt 3 Monate“), rechne vom Ausstellungsdatum. Ist keine Befristung erkennbar, gib einen leeren Text zurück. fundstelle: die kurze Textstelle, auf der das Datum beruht.",
      messages: [{ role: "user", content: [pdf ? { type: "document", source: quelle } : { type: "image", source: quelle }, { type: "text", text: "Bis wann ist dieser Nachweis gültig?" }] as never }],
    } as never) as Promise<{ content: { type: string; text?: string }[]; stop_reason: string }>,
    new Promise<never>((_, nein) => setTimeout(() => nein(new Error("Zeit abgelaufen")), 25_000)),
  ]);
  if (antwort.stop_reason === "refusal") return null;
  const text = antwort.content.flatMap((b) => (b.type === "text" && b.text ? [b.text] : [])).join("");
  return ablaufDatum(String(JSON.parse(text).gueltig_bis ?? ""));
}

const datumDe = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" });

export async function firmenunterlagen(request: Request, env: KontoEnv & Partial<KiEnv>): Promise<Response|null> {
  const url = new URL(request.url);
  const detail = url.pathname.match(/^\/konto\/firmenunterlage\/([0-9a-f-]{36})\/(herunterladen|ansehen|loeschen|aendern)$/);
  const zip = url.pathname === "/konto/firmenunterlagen/zip";
  if (url.pathname!=="/konto/firmenunterlagen" && !detail && !zip) return null;
  const f = await aktiveFirma(request,env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text:string,status=200) => html(seite("Firmenunterlagen & Vorlagen",text,0,"unterlagen"),status,f.s.cookies);
  if (!f.finanzen || !env.DATEN) return antwort("<p>Für diese Unterlagen brauchst du eine Finanzfreigabe.</p>",403);
  const zurueck = (extra = "") => weiterleiten(`/konto/firmenunterlagen?firma=${f.m.firma_id}${extra}`,f.s.cookies);
  const heute=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Berlin"});
  if (zip) {
    const r = await db<FirmenDatei[]>(f.s,env,`firmenunterlagen?firma_id=eq.${f.m.firma_id}&art=eq.nachweis&select=*&order=name`);
    if (!r.ok) return antwort('<p class="fehler">Die Unterlagen konnten nicht geladen werden.</p>',502);
    const ordner = url.searchParams.get("ordner") ?? "";
    const auswahl = r.daten.filter((d) => (!d.gueltig_bis || d.gueltig_bis >= heute) && (!ordner || ordnerVon(d) === ordner));
    const refs = !ordner || ordner === "Referenzen & Umsatz" ? await referenzenLaden(f.s, env, f.m.firma_id) : [];
    const firma = await db<{ name: string }[]>(f.s, env, `firmen?id=eq.${f.m.firma_id}&select=name`);
    const inhalt = await nachweiseZip(env.DATEN, auswahl, refs, firma.ok ? firma.daten[0]?.name ?? "" : "", true);
    if (typeof inhalt === "string") return antwort(`<p class="fehler">${escape(inhalt)}</p>`,409);
    return zipAntwort(inhalt, `Nachweise${ordner ? `_${dateiname(ordner)}` : ""}.zip`, f.s.cookies);
  }
  if (detail) {
    const r = await db<FirmenDatei[]>(f.s,env,`firmenunterlagen?id=eq.${detail[1]}&firma_id=eq.${f.m.firma_id}&select=*`);
    const d = r.ok ? r.daten[0] : undefined;
    if (!d) return antwort("<p>Diese Datei ist nicht verfügbar.</p>",404);
    if (detail[2]==="loeschen") {
      if (request.method!=="POST" || !f.admin) return antwort("<p>Nur die Administration darf Dateien löschen.</p>",403);
      const loeschen = await db<{id:string}[]>(f.s,env,`firmenunterlagen?id=eq.${d.id}&firma_id=eq.${d.firma_id}&select=id`,{method:"DELETE",headers:{prefer:"return=representation"}});
      if (!loeschen.ok || !loeschen.daten.length) return antwort('<p class="fehler">Die Datei konnte nicht gelöscht werden.</p>',502);
      await env.DATEN.delete(dateiKey(d));
      return zurueck();
    }
    if (detail[2]==="aendern") {
      if (request.method!=="POST" || !f.admin) return antwort("<p>Nur die Administration darf Unterlagen ändern.</p>",403);
      const form = await request.formData();
      if (form.get("aktion") === "erkennen") {
        const obj = await env.DATEN.get(dateiKey(d));
        if (!obj || !ablaufLesbar(d.dateiname, d.groesse) || !env.ANTHROPIC_API_KEY) return zurueck("&erkannt=0");
        const datum = await ablaufLesen(env as KiEnv, new Uint8Array(await obj.arrayBuffer()), d.dateiname).catch(() => null);
        if (datum) await db(f.s,env,`firmenunterlagen?id=eq.${d.id}&firma_id=eq.${d.firma_id}`,{method:"PATCH",body:JSON.stringify({gueltig_bis:datum,gueltig_erkannt:true})});
        return zurueck(`&erkannt=${datum ?? "0"}`);
      }
      const ordner = String(form.get("ordner") ?? "").trim().slice(0, 60);
      const gueltig = String(form.get("gueltig_bis") ?? "");
      if (gueltig && !ablaufDatum(gueltig)) return zurueck("&fehler=datum");
      const r2 = await db(f.s,env,`firmenunterlagen?id=eq.${d.id}&firma_id=eq.${d.firma_id}`,{method:"PATCH",body:JSON.stringify({ordner: ordner && ordner !== ordnerVon({ ...d, ordner: null }) ? ordner : null, gueltig_bis: gueltig || null, gueltig_erkannt: gueltig === d.gueltig_bis ? (d as FirmenDatei & { gueltig_erkannt?: boolean }).gueltig_erkannt ?? false : false})});
      return r2.ok ? zurueck(`#datei-${d.id}`) : antwort('<p class="fehler">Die Änderung konnte nicht gespeichert werden.</p>',502);
    }
    const obj = await env.DATEN.get(dateiKey(d));
    if (!obj) return antwort("<p>Die Datei ist nicht mehr vorhanden.</p>",404);
    const typ = detail[2]==="ansehen" ? vorschauTyp(d.dateiname) : null;
    // Preview: shown by the browser itself (PDF viewer, image, text), with no scripts or outside content.
    const headers = new Headers(typ
      ? {"content-type":typ,"content-disposition":`inline; filename*=UTF-8''${encodeURIComponent(dateiname(d.dateiname))}`,"content-security-policy":"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'","cache-control":"private, no-store","x-content-type-options":"nosniff"}
      : {"content-type":"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(dateiname(d.dateiname))}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"});
    for (const c of f.s.cookies) headers.append("set-cookie",c);
    return new Response(obj.body,{headers});
  }
  let fehler="";
  const form = request.method==="POST" ? await request.formData() : null;
  if (form && String(form.get("firma") ?? "") !== f.m.firma_id) return antwort("<p>Die ausgewählte Firma hat sich geändert. Bitte die Seite neu öffnen.</p>",403);
  if (form) {
    if (!f.admin) return antwort("<p>Nur die Administration darf Dateien hochladen.</p>",403);
    const file = form.get("datei");
    // Quick pick: a typical proof, an offer template or "other" (then the free name is needed).
    const vorschlag = String(form.get("vorschlag")??"");
    const art = vorschlag==="__vorlage" ? "vorlage" : String(form.get("art")??"nachweis");
    const name = (String(form.get("name")??"").trim() || (vorschlag==="__vorlage" ? "Angebotsvorlage" : vorschlag.startsWith("__") ? "" : vorschlag)).slice(0,200);
    const gueltig = String(form.get("gueltig_bis")??"");
    const ordnerWahl = String(form.get("ordner")??"").trim().slice(0,60);
    if (!file || typeof file==="string" || file.size<1 || file.size>20*1024*1024 || !/\.(pdf|docx|xlsx|txt|md|png|jpe?g)$/i.test(file.name) || !["nachweis","vorlage"].includes(art) || !name || (gueltig && !ablaufDatum(gueltig))) fehler="Bitte eine gültige Datei (höchstens 20 MB), eine Art auswählen (bei „Sonstige“ eine Bezeichnung eingeben).";
    else if (art==="vorlage" && !/\.(docx|txt|md)$/i.test(file.name)) fehler="Angebotsvorlagen bitte als Word-Datei (.docx) oder Text (.txt/.md) hochladen.";
    else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const d = {id:crypto.randomUUID(),firma_id:f.m.firma_id,name,art,dateiname:dateiname(file.name),mime:file.type||"application/octet-stream",groesse:file.size,gueltig_bis:gueltig||null as string|null,gueltig_erkannt:false,ordner:null as string|null};
      d.ordner = ordnerWahl && ordnerWahl !== ordnerVon(d) ? ordnerWahl : null;
      // No date entered: Jarvis reads it from the document (PDF or photo of a proof).
      let erkannt = "";
      if (art==="nachweis" && !gueltig && ablaufLesbar(file.name, file.size) && env.ANTHROPIC_API_KEY && env.HYPERDRIVE) {
        const datum = await ablaufLesen(env as KiEnv, bytes, file.name).catch(() => null);
        if (datum) { d.gueltig_bis = datum; d.gueltig_erkannt = true; }
        erkannt = `&erkannt=${datum ?? "0"}`;
      }
      await env.DATEN.put(dateiKey(d),bytes);
      let gespeichert = false;
      try {
        const r = await db(f.s,env,"firmenunterlagen",{method:"POST",body:JSON.stringify(d)});
        gespeichert = r.ok;
        if (gespeichert) return zurueck(`${erkannt}#datei-${d.id}`);
      } finally { if (!gespeichert) await env.DATEN.delete(dateiKey(d)); }
      fehler="Die Datei konnte nicht gespeichert werden. Je Firma sind höchstens 50 Dateien und 200 MB erlaubt.";
    }
  }
  const [r, refs] = await Promise.all([
    db<(FirmenDatei & { ordner?: string | null; gueltig_erkannt?: boolean })[]>(f.s,env,`firmenunterlagen?firma_id=eq.${f.m.firma_id}&select=*&order=art,name`),
    referenzenLaden(f.s, env, f.m.firma_id),
  ]);
  if (!r.ok) return antwort('<p class="fehler">Die Unterlagen konnten nicht geladen werden.</p>',502);
  return antwort(unterlagenSeite(r.daten, { firma: f.m.firma_id, firmenname: f.m.firmen.name, admin: f.admin, heute, ordner: url.searchParams.get("ordner") ?? "", name: url.searchParams.get("name") ?? "", erkannt: url.searchParams.get("erkannt") ?? "", fehler: fehler || (url.searchParams.get("fehler") === "datum" ? "Bitte ein gültiges Datum eingeben." : ""), referenzen: refs.length }));
}

type Datei = FirmenDatei & { ordner?: string | null; gueltig_erkannt?: boolean };
/** The documents page: folders as chips, one compact row per file with preview, download and a ⋯ menu. */
export function unterlagenSeite(dateien: Datei[], o: { firma: string; firmenname: string; admin: boolean; heute: string; ordner: string; name: string; erkannt: string; fehler: string; referenzen: number }): string {
  const tage = (iso: string) => Math.round((Date.parse(iso) - Date.parse(o.heute)) / 86400000);
  const ablaufend = dateien.filter((d) => d.art === "nachweis" && d.gueltig_bis && d.gueltig_bis >= o.heute && tage(d.gueltig_bis) <= 30);
  const abgelaufen = dateien.filter((d) => d.art === "nachweis" && d.gueltig_bis && d.gueltig_bis < o.heute);
  const ordnerListe = [...new Set(dateien.map(ordnerVon))].sort((a, b) => (STANDARD_ORDNER.indexOf(a) + 1 || 99) - (STANDARD_ORDNER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const gewaehlt = ordnerListe.includes(o.ordner) ? o.ordner : "";
  const basis = `/konto/firmenunterlagen?firma=${o.firma}`;
  const chips = ordnerListe.length > 1 ? `<nav class="ordner-chips" aria-label="Ordner"><a href="${basis}"${gewaehlt ? "" : ' aria-current="true"'}>Alle <span>${dateien.length}</span></a>${ordnerListe.map((n) => `<a href="${basis}&ordner=${encodeURIComponent(n)}"${n === gewaehlt ? ' aria-current="true"' : ""}>${escape(n)} <span>${dateien.filter((d) => ordnerVon(d) === n).length}</span></a>`).join("")}</nav>` : "";
  const hinweis = o.erkannt ? (ablaufDatum(o.erkannt) ? `<p class="erfolg" role="status">🔍 Jarvis hat im Dokument „gültig bis ${datumDe(o.erkannt)}“ erkannt. Bitte kurz prüfen; über ⋯ kannst du es ändern.</p>` : `<p class="hinweis" role="status">🔍 Jarvis hat im Dokument kein Ablaufdatum gefunden. Ist der Nachweis befristet, trage das Datum über ⋯ ein.</p>`) : "";
  const warnung = ablaufend.length || abgelaufen.length ? `<aside class="ablauf-warnung"><strong>⚠️ ${ablaufend.length + abgelaufen.length === 1 ? "Ein Nachweis braucht" : `${ablaufend.length + abgelaufen.length} Nachweise brauchen`} Ersatz</strong><ul>${[...abgelaufen, ...ablaufend].map((d) => `<li><span>${escape(d.name)}</span><span class="${d.gueltig_bis! < o.heute ? "abgelaufen" : "bald"}">${d.gueltig_bis! < o.heute ? "abgelaufen" : `noch ${tage(d.gueltig_bis!)} Tage`}</span></li>`).join("")}</ul></aside>` : "";
  const ordnerFeld = (wert: string, id: string) => `<label>Ordner<input name="ordner" list="${id}" maxlength="60" value="${escape(wert)}" placeholder="automatisch"></label><datalist id="${id}">${[...new Set([...STANDARD_ORDNER, ...ordnerListe])].map((n) => `<option value="${escape(n)}">`).join("")}</datalist>`;
  const upload = o.admin ? `<details class="upload-neu"${o.name || !dateien.length ? " open" : ""}><summary>➕ Unterlage hochladen</summary><form method="post" enctype="multipart/form-data" class="upload-felder"><input type="hidden" name="firma" value="${o.firma}">${schnellauswahl(dateien, o.heute, o.name)}${ordnerFeld("", "ordner-neu")}<label>Gültig bis<input name="gueltig_bis" type="date"></label><label class="ganz">Datei (PDF, Foto, Word, Excel; max. 20 MB)<input type="file" name="datei" required accept=".pdf,.docx,.xlsx,.txt,.md,.jpg,.jpeg,.png"></label><p class="klein ganz">Ohne Datum liest Jarvis das Ablaufdatum aus PDF oder Foto selbst (ca. 1 Cent).</p><button class="ganz">Unterlage speichern</button></form></details>` : "";
  const zeile = (d: Datei) => {
    const status = d.art === "vorlage" ? "Vorlage" : !d.gueltig_bis ? "unbefristet" : d.gueltig_bis < o.heute ? "abgelaufen" : `bis ${datumDe(d.gueltig_bis)}`;
    const farbe = d.art === "vorlage" || !d.gueltig_bis ? "" : d.gueltig_bis < o.heute ? " rot" : tage(d.gueltig_bis) <= 30 ? " gelb" : " gruen";
    const menue = o.admin ? `<details class="datei-menue"><summary aria-label="Mehr zu ${escape(d.name)}">⋯</summary><div class="datei-menue-inhalt"><form method="post" action="/konto/firmenunterlage/${d.id}/aendern?firma=${o.firma}" class="datei-aendern">${ordnerFeld(ordnerVon(d), `ordner-${d.id}`)}${d.art === "nachweis" ? `<label>Gültig bis<input name="gueltig_bis" type="date" value="${escape(d.gueltig_bis ?? "")}"></label>` : ""}<button>Speichern</button></form>${d.art === "nachweis" && ablaufLesbar(d.dateiname, d.groesse) ? `<form method="post" action="/konto/firmenunterlage/${d.id}/aendern?firma=${o.firma}"><input type="hidden" name="aktion" value="erkennen"><button class="zweit">🔍 Datum von Jarvis lesen lassen</button></form>` : ""}<form method="post" action="/konto/firmenunterlage/${d.id}/loeschen?firma=${o.firma}"><button class="zweit gefahr">Datei löschen</button></form></div></details>` : "";
    return `<li class="datei" id="datei-${d.id}"><span class="datei-symbol" aria-hidden="true">${/\.pdf$/i.test(d.dateiname) ? "📄" : /\.(png|jpe?g)$/i.test(d.dateiname) ? "🖼️" : /\.xlsx$/i.test(d.dateiname) ? "📊" : "📝"}</span><span class="datei-text"><strong>${escape(d.name)}</strong><span class="klein"><span class="datei-status${farbe}">${status}</span>${d.gueltig_erkannt ? ' <span title="Von Jarvis aus dem Dokument gelesen">🔍</span>' : ""} · ${escape(d.dateiname)}</span></span><span class="datei-aktionen">${vorschauTyp(d.dateiname) ? `<a href="/konto/firmenunterlage/${d.id}/ansehen?firma=${o.firma}" target="_blank" rel="noopener" title="Ansehen" aria-label="${escape(d.name)} ansehen">👁</a>` : ""}<a href="/konto/firmenunterlage/${d.id}/herunterladen?firma=${o.firma}" title="Herunterladen" aria-label="${escape(d.name)} herunterladen">⬇</a>${menue}</span></li>`;
  };
  const sichtbar = ordnerListe.filter((n) => !gewaehlt || n === gewaehlt);
  const liste = dateien.length ? sichtbar.map((n) => `<h2 class="ordner-titel">📁 ${escape(n)}</h2><ul class="datei-liste">${dateien.filter((d) => ordnerVon(d) === n).map(zeile).join("")}</ul>`).join("") : `<p class="treffer-leer">Noch keine Unterlagen gespeichert.</p>`;
  const gueltige = dateien.filter((d) => d.art === "nachweis" && (!d.gueltig_bis || d.gueltig_bis >= o.heute) && (!gewaehlt || ordnerVon(d) === gewaehlt)).length;
  const werkzeuge = `<div class="unterlagen-werkzeuge">${gueltige || o.referenzen ? `<a class="knopf zweit" href="/konto/firmenunterlagen/zip?firma=${o.firma}${gewaehlt ? `&ordner=${encodeURIComponent(gewaehlt)}` : ""}">📦 ${gewaehlt ? "Ordner" : "Alle Nachweise"} als Zip</a>` : ""}<a class="knopf zweit" href="/konto/referenzen?firma=${o.firma}">📋 Referenzen${o.referenzen ? ` (${o.referenzen})` : ""}</a></div>`;
  return `${hinweis}${o.fehler ? `<p class="fehler">${escape(o.fehler)}</p>` : ""}${warnung}${upload}${werkzeuge}${chips}${liste}<details class="klein-hilfe"><summary>Eigene Angebotsvorlage verwenden</summary><p>Word- und Textvorlagen können diese Platzhalter enthalten: <code>{{FIRMA}}</code>, <code>{{AUFTRAG}}</code>, <code>{{DATUM}}</code>, <code>{{ANGEBOTSTEXT}}</code>. Jarvis füllt sie beim Herunterladen der Angebotsmappe aus.</p></details><p class="klein">Gespeichert in der EU für ${escape(o.firmenname)}. Nur Personen mit Finanzfreigabe können die Dateien öffnen.</p>`;
}

const ordnerPfad = (n: string) => n.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "").slice(0, 60) || "Ordner";
/** Zip with the proofs (in folders) and, when there are references, the reference list as Word file. */
export async function nachweiseZip(bucket: R2Bucket, dateien: FirmenDatei[], refs: Referenz[], firma: string, mitOrdnern: boolean): Promise<Uint8Array | string> {
  if (!dateien.length && !refs.length) return "Es gibt keine gültigen Nachweise zum Herunterladen.";
  if (dateien.reduce((s, d) => s + d.groesse, 0) > 60 * 1024 * 1024) return "Zusammen sind die Nachweise größer als 60 MB. Bitte einzelne Ordner herunterladen.";
  const inhalt: Record<string, Uint8Array> = {};
  for (const d of dateien) {
    const obj = await bucket.get(dateiKey(d));
    if (!obj) continue;
    let pfad = `${mitOrdnern ? `${ordnerPfad(ordnerVon(d))}/` : ""}${dateiname(d.name)}${d.dateiname.match(/\.[a-z0-9]+$/i)?.[0] ?? ""}`;
    for (let i = 2; inhalt[pfad]; i++) pfad = pfad.replace(/(\.[a-z0-9]+)?$/i, ` (${i})$1`);
    inhalt[pfad] = new Uint8Array(await obj.arrayBuffer());
  }
  if (refs.length) inhalt[`${mitOrdnern ? "Referenzen & Umsatz/" : ""}Referenzliste.docx`] = referenzlisteDocx(firma, refs);
  return zipSync(inhalt, { level: 0 });
}

export function zipAntwort(zip: Uint8Array, name: string, cookies: string[]): Response {
  const headers = new Headers({ "content-type": "application/zip", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(zip, { headers });
}

/** Dropdown of the usual proofs (✅ = already stored and valid), an offer template, or other with a free name. */
export function schnellauswahl(dateien: FirmenDatei[], heute: string, gewuenscht = ""): string {
  const passt = NACHWEIS_TYPEN.find((t) => t.name === gewuenscht);
  const optionen = NACHWEIS_TYPEN.map((t) => `<option value="${escape(t.name)}"${t === passt ? " selected" : ""}>${vorhanden(t, dateien, heute) ? "✅ " : ""}${escape(t.name)}</option>`).join("");
  const sonst = !!gewuenscht && !passt;
  return `<label>Was lädst du hoch?<select name="vorschlag" data-vorschlag><option value="" disabled${gewuenscht ? "" : " selected"}>Bitte auswählen …</option><optgroup label="Nachweise">${optionen}</optgroup><optgroup label="Weitere"><option value="__vorlage">Eigene Angebotsvorlage (Word)</option><option value="__sonst"${sonst ? " selected" : ""}>Sonstige Unterlage (eigene Bezeichnung)</option></optgroup></select></label>
<label data-bezeichnung>Bezeichnung <span class="klein">(frei änderbar)</span><input name="name" maxlength="200" placeholder="z. B. Tarifvertrag GVP" value="${escape(sonst ? gewuenscht : "")}"></label>`;
}
