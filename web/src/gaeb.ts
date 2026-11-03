// N9: GAEB DA XML (3.x) bill of quantities. Reads an X81/X82/X83 file into positions, and writes the bid file X84
// with the firm's unit prices (schema order per item: Qty, UP, IT; categories carry Totals). No external XML
// library: a small reader that refuses DOCTYPE/ENTITY declarations, so uploaded files cannot expand entities.

export type Knoten = { name: string; attr: Record<string, string>; kinder: (Knoten | string)[] };

const ENTITAETEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const entschluesseln = (t: string) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return ENTITAETEN[e] ?? m;
});
const lokal = (n: string) => n.slice(n.indexOf(":") + 1);

/** Minimal XML reader for GAEB files: elements, attributes, text, CDATA; comments and PIs are skipped. */
export function xmlLesen(xml: string): Knoten {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Die Datei enthält DOCTYPE- oder ENTITY-Angaben und wird aus Sicherheitsgründen nicht gelesen.");
  const wurzel: Knoten = { name: "#", attr: {}, kinder: [] };
  const stapel: Knoten[] = [wurzel];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) { const t = xml.slice(i); if (t.trim()) stapel.at(-1)!.kinder.push(entschluesseln(t)); break; }
    if (lt > i) { const t = xml.slice(i, lt); if (t.trim() || stapel.length > 1) stapel.at(-1)!.kinder.push(entschluesseln(t)); }
    if (xml.startsWith("<!--", lt)) { const e = xml.indexOf("-->", lt + 4); if (e < 0) throw new Error("Kommentar nicht geschlossen"); i = e + 3; continue; }
    if (xml.startsWith("<![CDATA[", lt)) { const e = xml.indexOf("]]>", lt + 9); if (e < 0) throw new Error("CDATA nicht geschlossen"); stapel.at(-1)!.kinder.push(xml.slice(lt + 9, e)); i = e + 3; continue; }
    if (xml.startsWith("<?", lt)) { const e = xml.indexOf("?>", lt + 2); if (e < 0) throw new Error("Steueranweisung nicht geschlossen"); i = e + 2; continue; }
    if (xml.startsWith("<!", lt)) throw new Error("Unbekannte Deklaration");
    // Find the end of the tag, honouring quoted attribute values.
    let j = lt + 1, q = "";
    for (; j < n; j++) { const c = xml[j]; if (q) { if (c === q) q = ""; } else if (c === '"' || c === "'") q = c; else if (c === ">") break; }
    if (j >= n) throw new Error("Tag nicht geschlossen");
    const inhalt = xml.slice(lt + 1, j);
    i = j + 1;
    if (inhalt[0] === "/") {
      const name = lokal(inhalt.slice(1).trim());
      const offen = stapel.pop();
      if (!offen || offen.name !== name || !stapel.length) throw new Error(`Unerwartetes Ende von <${name}>`);
      continue;
    }
    const leer = inhalt.endsWith("/");
    const roh = leer ? inhalt.slice(0, -1) : inhalt;
    const m = roh.match(/^\s*([^\s/>]+)/);
    if (!m) throw new Error("Leerer Tag");
    const k: Knoten = { name: lokal(m[1]), attr: {}, kinder: [] };
    for (const a of roh.slice(m[0].length).matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      if (!a[1].startsWith("xmlns")) k.attr[lokal(a[1])] = entschluesseln(a[3] ?? a[4] ?? "");
    }
    stapel.at(-1)!.kinder.push(k);
    if (!leer) { stapel.push(k); if (stapel.length > 200) throw new Error("Zu tief verschachtelt"); }
  }
  if (stapel.length !== 1) throw new Error(`<${stapel.at(-1)!.name}> nicht geschlossen`);
  const el = wurzel.kinder.find((x): x is Knoten => typeof x !== "string");
  if (!el) throw new Error("Kein XML-Inhalt");
  return el;
}

const kind = (k: Knoten | undefined, name: string) => k?.kinder.find((x): x is Knoten => typeof x !== "string" && x.name === name);
const kinder = (k: Knoten | undefined, name: string) => (k?.kinder ?? []).filter((x): x is Knoten => typeof x !== "string" && x.name === name);
const pfad = (k: Knoten | undefined, ...namen: string[]) => namen.reduce<Knoten | undefined>((x, n) => kind(x, n), k);
/** All text below a node; paragraphs and line breaks become line breaks. */
export function textVon(k: Knoten | undefined): string {
  if (!k) return "";
  const teile: string[] = [];
  const lauf = (x: Knoten | string) => {
    if (typeof x === "string") { teile.push(x); return; }
    if (x.name === "br") teile.push("\n");
    x.kinder.forEach(lauf);
    if (x.name === "p") teile.push("\n");
  };
  k.kinder.forEach(lauf);
  return teile.join("").replace(/[ \t\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type PosArt = "normal" | "pauschal" | "bedarf_ohne" | "bedarf_mit" | "wahl";
export type Position = { k: "p"; id: string; oz: string; rno: string; rnoIndex?: string; kurz: string; lang: string; menge: number | null; einheit: string; art: PosArt; mengeOffen?: boolean };
export type Gruppe = { k: "g"; id: string; oz: string; rno: string; titel: string; kinder: (Gruppe | Position)[] };
export type Kopf = { version: string; dp: string; projekt: string; projektLabel: string; lvName: string; waehrung: string; boqId: string; nachkomma: number; bkdn: string };
export type Lv = { kopf: Kopf; struktur: (Gruppe | Position)[] };

export const ART_TEXT: Record<PosArt, string> = { normal: "", pauschal: "Pauschal", bedarf_ohne: "Bedarfsposition (ohne Gesamtbetrag)", bedarf_mit: "Bedarfsposition (mit Gesamtbetrag)", wahl: "Wahlposition" };
/** Positions whose total does not enter the bid total. */
export const ohneSumme = (p: Position) => p.art === "bedarf_ohne" || p.art === "wahl";

const zahl = (t: string) => { const s = t.trim(); if (!s) return null; const v = Number(s.replace(/\s/g, "")); return Number.isFinite(v) ? v : null; };

function serialisieren(k: Knoten): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attr = Object.entries(k.attr).map(([a, v]) => ` ${a}="${esc(v).replace(/"/g, "&quot;")}"`).join("");
  return k.kinder.length ? `<${k.name}${attr}>${k.kinder.map((x) => typeof x === "string" ? esc(x) : serialisieren(x)).join("")}</${k.name}>` : `<${k.name}${attr}/>`;
}

/** Decodes the file bytes using the encoding named in the XML declaration (UTF-8 or ISO-8859-1/Windows-1252). */
export function dekodieren(bytes: Uint8Array): string {
  let anfang = "";
  for (let i = 0; i < Math.min(200, bytes.length); i++) anfang += String.fromCharCode(bytes[i]);
  const enc = anfang.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
  if (/8859|1252|latin/.test(enc)) { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; }
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

/** Reads a GAEB DA XML 3.x bill of quantities (exchange phases 81, 82, 83). */
export function gaebLesen(xml: string): Lv {
  if (/^\s*(T0|00)|^#begin\[/m.test(xml.slice(0, 400)) && !xml.includes("<")) throw new Error("Das ist eine ältere GAEB-Datei (GAEB 90 oder GAEB 2000). Bitte beim Auftraggeber die Datei im Format GAEB DA XML (Endung .X83) anfordern.");
  const root = xmlLesen(xml);
  if (root.name !== "GAEB") throw new Error("Das ist keine GAEB-XML-Datei.");
  const version = textVon(pfad(root, "GAEBInfo", "Version"));
  if (!/^3\./.test(version)) throw new Error(`GAEB-Version ${version || "unbekannt"} wird nicht unterstützt. Unterstützt wird GAEB DA XML 3.0 bis 3.3.`);
  const award = kind(root, "Award");
  const dp = textVon(kind(award, "DP"));
  if (!["81", "82", "83"].includes(dp)) throw new Error(`Austauschphase ${dp || "unbekannt"}: Bitte das Leistungsverzeichnis zur Angebotsabgabe (X83, X81 oder X82) hochladen.`);
  const boq = kind(award, "BoQ");
  if (!boq) throw new Error("Die Datei enthält kein Leistungsverzeichnis.");
  const info = kind(boq, "BoQInfo");
  const prj = kind(root, "PrjInfo");
  const kopf: Kopf = {
    version, dp, projekt: textVon(kind(prj, "NamePrj")).slice(0, 300), projektLabel: textVon(kind(prj, "LblPrj")).slice(0, 500),
    lvName: (textVon(kind(info, "Name")) || textVon(kind(info, "LblBoQ")) || "LV").slice(0, 300),
    waehrung: textVon(pfad(award, "AwardInfo", "Cur")) || textVon(kind(prj, "Cur")) || "EUR",
    boqId: textVon(pfad(award, "AwardInfo", "BoQID")) || boq.attr.ID || "",
    nachkomma: Math.min(3, Math.max(2, Number(textVon(kind(prj, "UPFracDig"))) || 2)),
    bkdn: kinder(info, "BoQBkdn").map(serialisieren).join(""),
  };
  let anzahl = 0;
  const lesen = (body: Knoten | undefined, eltern: string): (Gruppe | Position)[] => {
    const out: (Gruppe | Position)[] = [];
    for (const c of kinder(body, "BoQCtgy")) {
      const rno = c.attr.RNoPart ?? "";
      const oz = [eltern, rno].filter(Boolean).join(".");
      out.push({ k: "g", id: c.attr.ID ?? `G${oz}`, oz, rno, titel: textVon(kind(c, "LblTx")).slice(0, 500), kinder: lesen(kind(c, "BoQBody"), oz) });
    }
    for (const liste of kinder(body, "Itemlist")) for (const it of kinder(liste, "Item")) {
      if (++anzahl > 20000) throw new Error("Mehr als 20.000 Positionen werden nicht unterstützt.");
      const rno = it.attr.RNoPart ?? "";
      const provis = textVon(kind(it, "Provis"));
      const ja = (n: string) => { const x = kind(it, n); return !!x && textVon(x).toLowerCase() !== "no"; };
      const alnSer = textVon(kind(it, "ALNSerNo"));
      const art: PosArt = provis === "WithoutTotal" ? "bedarf_ohne" : provis === "WithTotal" ? "bedarf_mit" : ja("LumpSumItem") || ja("GlobItem") ? "pauschal" : kind(it, "ALNGroupNo") && alnSer && alnSer !== "0" ? "wahl" : "normal";
      const desc = kind(it, "Description");
      const outline = pfad(desc, "CompleteText", "OutlineText") ?? kind(desc, "OutlineText");
      const detail = pfad(desc, "CompleteText", "DetailTxt") ?? kind(desc, "DetailTxt");
      const lang = textVon(detail);
      const kurz = (textVon(outline) || lang.split("\n")[0] || "").slice(0, 300);
      out.push({ k: "p", id: it.attr.ID ?? `P${anzahl}`, oz: [eltern, rno].filter(Boolean).join("."), rno, ...(it.attr.RNoIndex ? { rnoIndex: it.attr.RNoIndex } : {}),
        kurz, lang: lang.slice(0, 2000), menge: zahl(textVon(kind(it, "Qty"))), einheit: textVon(kind(it, "QU")).slice(0, 20), art, ...(ja("QtyTBD") ? { mengeOffen: true } : {}) });
    }
    return out;
  };
  const struktur = lesen(kind(boq, "BoQBody"), "");
  if (!anzahl) throw new Error("Im Leistungsverzeichnis wurden keine Positionen gefunden.");
  return { kopf, struktur };
}

export function positionen(s: (Gruppe | Position)[]): Position[] {
  return s.flatMap((x) => x.k === "p" ? [x] : positionen(x.kinder));
}

export type Preis = { ep: number; menge?: number };
const runden = (v: number, n = 2) => { const f = 10 ** n; return Math.round((v + Math.sign(v) * Number.EPSILON) * f) / f; };
/** Item total: quantity × unit price, rounded to cents. Lump sums: the price is the total. */
export function gp(p: Position, preis: Preis | undefined): number | null {
  if (!preis || !Number.isFinite(preis.ep)) return null;
  const menge = p.mengeOffen ? preis.menge ?? null : p.menge;
  if (p.art === "pauschal" && (menge === null || menge === 0)) return runden(preis.ep);
  return menge === null ? null : runden(menge * preis.ep);
}

export function summen(s: (Gruppe | Position)[], preise: Record<string, Preis>): { gesamt: number; nebenbei: number; offen: number; gruppen: Map<string, number> } {
  const gruppen = new Map<string, number>();
  let offen = 0, nebenbei = 0;
  const lauf = (liste: (Gruppe | Position)[]): number => liste.reduce((sum, x) => {
    if (x.k === "g") { const g = lauf(x.kinder); gruppen.set(x.id, runden(g)); return sum + g; }
    const v = gp(x, preise[x.id]);
    if (v === null) { offen++; return sum; }
    if (ohneSumme(x)) { nebenbei += v; return sum; }
    return sum + v;
  }, 0);
  const gesamt = runden(lauf(s));
  return { gesamt, nebenbei: runden(nebenbei), offen, gruppen };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dez = (v: number, n = 2) => v.toFixed(n);
export type Bieter = { name: string; strasse: string; plz: string; ort: string; telefon?: string; email?: string };

/** The bid file X84 (GAEB DA XML, same version as the tender) with unit and total prices. */
export function x84(lv: Lv, preise: Record<string, Preis>, bieter: Bieter, heute = new Date().toISOString().slice(0, 10)): string {
  const k = lv.kopf, s = summen(lv.struktur, preise);
  const ns = /^3\.0/.test(k.version) ? "http://www.gaeb.de/GAEB_DA_XML/200407" : `http://www.gaeb.de/GAEB_DA_XML/DA84/${k.version}`;
  const t = (name: string, wert: string) => `<${name}>${esc(wert)}</${name}>`;
  const ebene = (liste: (Gruppe | Position)[]): string => {
    const gruppen = liste.filter((x): x is Gruppe => x.k === "g"), pos = liste.filter((x): x is Position => x.k === "p");
    return `${gruppen.map((g) => `<BoQCtgy ID="${esc(g.id)}" RNoPart="${esc(g.rno)}"><BoQBody>${ebene(g.kinder)}</BoQBody><Totals>${t("Total", dez(s.gruppen.get(g.id) ?? 0))}</Totals></BoQCtgy>`).join("")}${pos.length ? `<Itemlist>${pos.map((p) => {
      const preis = preise[p.id], v = gp(p, preis);
      // The quantity of the tender (or the one the bidder entered for open quantities) helps importing software.
      const menge = p.mengeOffen ? preis?.menge : p.menge ?? undefined;
      return `<Item ID="${esc(p.id)}" RNoPart="${esc(p.rno)}"${p.rnoIndex ? ` RNoIndex="${esc(p.rnoIndex)}"` : ""}>${menge !== undefined ? t("Qty", dez(menge, 3)) : ""}${preis && Number.isFinite(preis.ep) ? t("UP", dez(preis.ep, k.nachkomma)) : ""}${v !== null ? t("IT", dez(v)) : ""}</Item>`;
    }).join("")}</Itemlist>` : ""}`;
  };
  const adresse = `<Address>${t("Name1", bieter.name.slice(0, 40))}${t("Street", bieter.strasse.slice(0, 40))}${t("PCode", bieter.plz.slice(0, 10))}${t("City", bieter.ort.slice(0, 40))}${bieter.telefon ? t("Phone", bieter.telefon.slice(0, 40)) : ""}${bieter.email ? t("Email", bieter.email.slice(0, 60)) : ""}</Address>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<GAEB xmlns="${ns}"><GAEBInfo>${t("Version", k.version)}${t("Date", heute)}${t("ProgSystem", "Crewtender")}${t("ProgName", "Crewtender")}</GAEBInfo><PrjInfo>${t("NamePrj", k.projekt || k.lvName)}${k.projektLabel ? t("LblPrj", k.projektLabel) : ""}</PrjInfo><Award>${t("DP", "84")}<AwardInfo>${k.boqId ? t("BoQID", k.boqId) : ""}${t("Cur", k.waehrung)}</AwardInfo><CTR>${adresse}</CTR><BoQ ID="${esc(k.boqId || "BoQ1")}"><BoQInfo>${t("Name", k.lvName)}${k.bkdn}<Totals>${t("Total", dez(s.gesamt))}</Totals></BoQInfo><BoQBody>${ebene(lv.struktur)}</BoQBody></BoQ></Award></GAEB>\n`;
}

/** Semicolon-separated list for Excel (German decimal comma), with a sum row. */
export function lvCsv(lv: Lv, preise: Record<string, Preis>): string {
  const z = (v: number | null, n = 2) => v === null ? "" : v.toFixed(n).replace(".", ",");
  const zelle = (t: string) => `"${t.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const zeilen = [["OZ", "Kurztext", "Menge", "Einheit", "Einheitspreis", "Gesamtpreis", "Art"].map(zelle).join(";")];
  const lauf = (liste: (Gruppe | Position)[]) => { for (const x of liste) {
    if (x.k === "g") { zeilen.push([zelle(x.oz), zelle(x.titel), "", "", "", "", ""].join(";")); lauf(x.kinder); continue; }
    const pr = preise[x.id];
    zeilen.push([zelle(x.oz), zelle(x.kurz), z(x.mengeOffen ? pr?.menge ?? null : x.menge, 3), zelle(x.einheit), z(pr ? pr.ep : null, lv.kopf.nachkomma), z(gp(x, pr)), zelle(ART_TEXT[x.art])].join(";"));
  } };
  lauf(lv.struktur);
  const s = summen(lv.struktur, preise);
  zeilen.push(["", zelle("Gesamt netto"), "", "", "", z(s.gesamt), ""].join(";"));
  return `﻿${zeilen.join("\r\n")}\r\n`;
}
