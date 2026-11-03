// N9: Leistungsverzeichnis page of a tender: upload the GAEB file (X83/X81/X82), enter unit prices, download the bid
// file X84 for the procurement portal and a list for Excel. Prices need finance rights (like the calculation).
import { db, html, vorgangZugriff, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { ART_TEXT, dekodieren, gaebLesen, gp, lvCsv, ohneSumme, positionen, summen, x84, type Bieter, type Gruppe, type Kopf, type Lv, type Position, type Preis } from "./gaeb.ts";

export type LvZeile = { id: string; dateiname: string; kopf: Kopf; struktur: (Gruppe | Position)[]; preise: Record<string, Preis>; geaendert: string };
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahlText = (v: number | null | undefined, n = 2) => v === null || v === undefined ? "" : v.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n, useGrouping: false });
/** German or English number input ("1.234,50", "1234.5") → number; empty → null; invalid → NaN. */
export function eingabeZahl(t: string): number | null {
  const s = t.trim().replace(/\s|€/g, "");
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^-?\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
}

/** Keeps the stored structure below the database limit by shortening long texts. */
export function kuerzen(lv: Lv): Lv {
  for (const max of [2000, 800, 300, 0]) {
    const kurz = (s: (Gruppe | Position)[]): (Gruppe | Position)[] => s.map((x) => x.k === "g" ? { ...x, kinder: kurz(x.kinder) } : { ...x, lang: x.lang.slice(0, max) });
    const neu = { ...lv, struktur: kurz(lv.struktur) };
    if (JSON.stringify(neu.struktur).length < 3_500_000) return neu;
  }
  throw new Error("Das Leistungsverzeichnis ist zu groß.");
}

export function lvSeite(vorgang: { id: string; titel: string }, lv: LvZeile | null, o: { darfAendern: boolean; hinweis?: string }): string {
  const zurueck = `<p class="konto-zurueck"><a href="/konto/vorgang/${vorgang.id}" aria-label="Zurück zur Ausschreibung">←</a></p><p><strong>${escape(vorgang.titel)}</strong></p>`;
  const hinweis = o.hinweis ? `<p role="status"><strong>${escape(o.hinweis)}</strong></p>` : "";
  const upload = o.darfAendern ? `<form method="post" enctype="multipart/form-data" class="lv-upload"><input type="hidden" name="aktion" value="hochladen"><label>${lv ? "Neue Version hochladen (ersetzt das LV, Preise gleicher Positionen bleiben)" : "GAEB-Datei aus den Vergabeunterlagen"}<input type="file" name="datei" accept=".x83,.x81,.x82,.xml,.X83,.X81,.X82" required></label><button>${lv ? "Ersetzen" : "Einlesen"}</button></form>` : "";
  if (!lv) return `${zurueck}${hinweis}<p>Viele Bau- und Handwerksausschreibungen liefern das Leistungsverzeichnis als GAEB-Datei (Endung <strong>.X83</strong>). Crewtender liest die Positionen ein, du trägst die Einheitspreise ein und bekommst die Angebotsdatei <strong>.X84</strong> für das Vergabeportal.</p>${upload || "<p>Hochladen dürfen Bearbeiter mit Finanzfreigabe.</p>"}<p class="klein">Unterstützt: GAEB DA XML 3.0 bis 3.3 (X81, X82, X83). Ältere Formate (GAEB 90, GAEB 2000) bitte beim Auftraggeber als X83 anfordern.</p>`;
  const alle = positionen(lv.struktur);
  const s = summen(lv.struktur, lv.preise);
  const ausgefuellt = alle.filter((p) => gp(p, lv.preise[p.id]) !== null).length;
  const kopf = `<div class="angebot-kennzahlen lv-kennzahlen"><div><strong>${alle.length}</strong><span>Positionen</span></div><div><strong>${ausgefuellt}</strong><span>mit Preis${s.offen ? `<br>${s.offen} offen` : ""}</span></div><div><strong>${euro(s.gesamt)}</strong><span>Angebotssumme netto${s.nebenbei ? `<br>+ ${euro(s.nebenbei)} Bedarf/Wahl` : ""}</span></div></div>
<p class="klein">${escape(lv.kopf.projekt || lv.kopf.lvName)}${lv.kopf.projektLabel ? ` · ${escape(lv.kopf.projektLabel)}` : ""} · ${escape(lv.dateiname)} · GAEB ${escape(lv.kopf.version)}, Phase ${escape(lv.kopf.dp)}</p>
<nav class="aktionsleiste"><a href="/konto/vorgang/${vorgang.id}/lv.x84" download>⬇️ Angebotsdatei (X84)</a><a class="zweit" href="/konto/vorgang/${vorgang.id}/lv.csv" download>📊 Liste für Excel</a></nav>
${s.offen ? `<p class="hinweis">⚠️ ${s.offen} ${s.offen === 1 ? "Position hat" : "Positionen haben"} noch keinen Preis. In der X84-Datei stehen sie ohne Preis.</p>` : ""}`;
  const werkzeuge = o.darfAendern ? `<details class="lv-werkzeuge"><summary>⚡ Preise auf einmal setzen</summary><form method="post"><input type="hidden" name="aktion" value="werkzeug"><div class="aueg-form">
<label>Preis für alle Stundenpositionen (h, Std)<input name="stunden" inputmode="decimal" placeholder="z. B. 48,50"></label>
<label>Alle Preise ändern um (%)<input name="prozent" inputmode="decimal" placeholder="z. B. 5 oder -3"></label></div><button>Anwenden</button></form></details>` : "";
  const zeile = (p: Position) => {
    const pr = lv.preise[p.id], v = gp(p, pr);
    const ep = o.darfAendern ? `<input name="ep:${escape(p.id)}" inputmode="decimal" value="${zahlText(pr?.ep, lv.kopf.nachkomma)}" aria-label="Einheitspreis ${escape(p.oz)}">` : `<span>${pr ? zahlText(pr.ep, lv.kopf.nachkomma) : "–"}</span>`;
    const menge = p.mengeOffen ? (o.darfAendern ? `<input name="menge:${escape(p.id)}" inputmode="decimal" value="${zahlText(pr?.menge, 3)}" aria-label="Menge ${escape(p.oz)}" class="lv-menge">` : zahlText(pr?.menge, 3) || "?") : p.menge === null ? "" : zahlText(p.menge, p.menge % 1 ? 3 : 0);
    return `<li class="lv-pos${ohneSumme(p) ? " lv-neben" : ""}${v === null ? " lv-offen" : ""}"><div class="lv-text"><span class="lv-oz">${escape(p.oz)}</span>${p.lang && p.lang !== p.kurz ? `<details><summary>${escape(p.kurz || "Ohne Kurztext")}</summary><p class="klein lv-lang">${escape(p.lang)}</p></details>` : `<span>${escape(p.kurz || "Ohne Kurztext")}</span>`}${p.art !== "normal" ? `<span class="lv-art">${ART_TEXT[p.art]}</span>` : ""}</div>
<div class="lv-zahlen"><span class="lv-menge-text">${menge} ${escape(p.einheit)}</span><label class="lv-ep">EP ${ep}</label><span class="lv-gp">${v === null ? "–" : euro(v)}</span></div></li>`;
  };
  const ebene = (liste: (Gruppe | Position)[], tiefe: number): string => liste.map((x) => x.k === "p" ? "" : `<section class="lv-gruppe"><h${Math.min(5, 2 + tiefe)} class="lv-titel"><span>${escape(x.oz)} ${escape(x.titel)}</span><span class="klein">${euro(s.gruppen.get(x.id) ?? 0)}</span></h${Math.min(5, 2 + tiefe)}>${ebene(x.kinder, tiefe + 1)}</section>`).join("") + (liste.some((x) => x.k === "p") ? `<ul class="lv-liste">${liste.filter((x): x is Position => x.k === "p").map(zeile).join("")}</ul>` : "");
  const knopf = `<div class="lv-speichern"><button>Preise speichern</button></div>`;
  const inhalt = o.darfAendern ? `<form method="post" class="lv-form"><input type="hidden" name="aktion" value="preise">${alle.length > 15 ? knopf : ""}${ebene(lv.struktur, 0)}${knopf}</form>` : ebene(lv.struktur, 0);
  return `${zurueck}${hinweis}${kopf}${werkzeuge}${inhalt}<details class="lv-ersetzen"><summary>Datei ersetzen oder entfernen</summary>${upload}${o.darfAendern ? `<form method="post"><input type="hidden" name="aktion" value="loeschen"><button class="zweit">LV entfernen</button></form>` : ""}</details>
<p class="klein">Bedarfs- und Wahlpositionen bekommen einen Preis, zählen aber nicht zur Angebotssumme (außer „mit Gesamtbetrag“). Die X84-Datei im Vergabeportal hochladen bzw. mit der Bieter-Software des Portals einlesen und vor der Abgabe dort prüfen.</p>`;
}

async function firmaAlsBieter(s: Sitzung, env: KontoEnv, firma: string): Promise<Bieter> {
  const r = await db<{ name: string; strasse: string | null; plz: string | null; ort: string | null; telefon: string | null }[]>(s, env, `firmen?id=eq.${firma}&select=name,strasse,plz,ort,telefon`);
  const f = r.ok ? r.daten[0] : undefined;
  return { name: f?.name ?? "Firma", strasse: f?.strasse ?? "", plz: f?.plz ?? "", ort: f?.ort ?? "", telefon: f?.telefon ?? "" };
}

export async function lvLaden(s: Sitzung, env: KontoEnv, vorgang: string): Promise<LvZeile | null> {
  const r = await db<LvZeile[]>(s, env, `leistungsverzeichnisse?vorgang_id=eq.${vorgang}&select=id,dateiname,kopf,struktur,preise,geaendert&limit=1`);
  return r.ok ? r.daten[0] ?? null : null;
}

/** Files for the offer folder: the bid file and the price list, when a bill of quantities exists. */
export async function lvDateien(s: Sitzung, env: KontoEnv, vorgang: string, firma: string): Promise<Record<string, string>> {
  const lv = await lvLaden(s, env, vorgang);
  if (!lv) return {};
  const name = lv.dateiname.replace(/\.[^.]*$/, "") || "LV";
  return { [`${name}.X84`]: x84(lv, lv.preise, await firmaAlsBieter(s, env, firma)), [`${name}_Preise.csv`]: lvCsv(lv, lv.preise) };
}

export async function leistungsverzeichnis(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/lv(\.x84|\.csv)?$/);
  if (!m) return null;
  const z = await vorgangZugriff(request, env, m[1]);
  if (!z) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Leistungsverzeichnis", t, 0, "kalkulation"), status, z.s.cookies);
  if (!z.finanzen) return antwort("<p>Das Leistungsverzeichnis mit Preisen sieht, wer eine Finanzfreigabe hat.</p>", 403);
  const darfAendern = ["inhaber", "admin", "bearbeiter"].includes(z.rolle);
  const id = z.v.id;
  const zurueck = (h: string) => weiterleiten(`/konto/vorgang/${id}/lv?hinweis=${encodeURIComponent(h)}`, z.s.cookies);
  if (m[2]) {
    const lv = await lvLaden(z.s, env, id);
    if (!lv) return antwort("<p>Noch kein Leistungsverzeichnis eingelesen.</p>", 404);
    const name = lv.dateiname.replace(/\.[^.]*$/, "") || "LV";
    const inhalt = m[2] === ".x84" ? x84(lv, lv.preise, await firmaAlsBieter(z.s, env, z.v.firma_id)) : lvCsv(lv, lv.preise);
    const headers = new Headers({ "content-type": m[2] === ".x84" ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${name}${m[2] === ".x84" ? ".X84" : "_Preise.csv"}`)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
    for (const c of z.s.cookies) headers.append("set-cookie", c);
    return new Response(inhalt, { headers });
  }
  if (request.method === "POST") {
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter mit Finanzfreigabe.");
    const form = await request.formData();
    const aktion = String(form.get("aktion") ?? "");
    const alt = await lvLaden(z.s, env, id);
    if (aktion === "hochladen") {
      const datei = form.get("datei");
      if (!datei || typeof datei === "string" || datei.size < 50 || datei.size > 15 * 1024 * 1024) return zurueck("Bitte eine GAEB-Datei (höchstens 15 MB) auswählen.");
      let lv: Lv;
      try { lv = kuerzen(gaebLesen(dekodieren(new Uint8Array(await datei.arrayBuffer())))); }
      catch (e) { return zurueck(`Die Datei konnte nicht gelesen werden: ${e instanceof Error ? e.message : "unbekannter Fehler"}`); }
      const ids = new Set(positionen(lv.struktur).map((p) => p.id));
      const preise = Object.fromEntries(Object.entries(alt?.preise ?? {}).filter(([k]) => ids.has(k)));
      const zeile = { firma_id: z.v.firma_id, vorgang_id: id, dateiname: datei.name.replace(/[^\w.\- äöüÄÖÜß]/g, "_").slice(0, 200), kopf: lv.kopf, struktur: lv.struktur, preise, geaendert: new Date().toISOString() };
      const r = await db(z.s, env, "leistungsverzeichnisse?on_conflict=firma_id,vorgang_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(zeile) });
      return zurueck(r.ok ? `${ids.size} Positionen eingelesen${Object.keys(preise).length ? `, ${Object.keys(preise).length} Preise übernommen` : ""}.` : "Speichern hat nicht geklappt.");
    }
    if (!alt) return zurueck("Bitte zuerst eine GAEB-Datei einlesen.");
    if (aktion === "loeschen") {
      const r = await db(z.s, env, `leistungsverzeichnisse?id=eq.${alt.id}`, { method: "DELETE" });
      return zurueck(r.ok ? "Leistungsverzeichnis entfernt." : "Entfernen hat nicht geklappt.");
    }
    const preise: Record<string, Preis> = { ...alt.preise };
    const alle = positionen(alt.struktur);
    let fehler = 0;
    if (aktion === "preise") {
      for (const p of alle) {
        if (!form.has(`ep:${p.id}`)) continue;
        const ep = eingabeZahl(String(form.get(`ep:${p.id}`)));
        const menge = p.mengeOffen ? eingabeZahl(String(form.get(`menge:${p.id}`) ?? "")) : null;
        if (ep === null) { delete preise[p.id]; continue; }
        if (Number.isNaN(ep) || ep < 0 || ep > 1e9 || (menge !== null && (Number.isNaN(menge) || menge < 0))) { fehler++; continue; }
        preise[p.id] = { ep: Math.round(ep * 1000) / 1000, ...(menge !== null ? { menge } : {}) };
      }
    } else if (aktion === "werkzeug") {
      const std = eingabeZahl(String(form.get("stunden") ?? "")), pct = eingabeZahl(String(form.get("prozent") ?? ""));
      if ((std !== null && (Number.isNaN(std) || std < 0)) || (pct !== null && (Number.isNaN(pct) || pct < -90 || pct > 500))) return zurueck("Bitte gültige Zahlen eingeben.");
      if (std !== null) for (const p of alle) if (/^(h|std\.?|stunden?|stde?\.?)$/i.test(p.einheit.trim())) preise[p.id] = { ...preise[p.id], ep: std };
      if (pct !== null) for (const k of Object.keys(preise)) preise[k] = { ...preise[k], ep: Math.round(preise[k].ep * (1 + pct / 100) * 100) / 100 };
    }
    const r = await db(z.s, env, `leistungsverzeichnisse?id=eq.${alt.id}`, { method: "PATCH", body: JSON.stringify({ preise, geaendert: new Date().toISOString() }) });
    return zurueck(!r.ok ? "Speichern hat nicht geklappt." : fehler ? `Gespeichert. ${fehler} ungültige Eingaben wurden übersprungen.` : `Gespeichert. Angebotssumme: ${euro(summen(alt.struktur, preise).gesamt)}.`);
  }
  return antwort(lvSeite({ id, titel: z.v.titel }, await lvLaden(z.s, env, id), { darfAendern, hinweis: url.searchParams.get("hinweis") ?? "" }));
}
