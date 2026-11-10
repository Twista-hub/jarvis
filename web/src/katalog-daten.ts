import { Unzip, UnzipInflate } from "fflate";
import { BERUFE, BERUF_SYNONYME } from "./berufe.ts";

const KENNUNG = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]{6,12})$/;
export const gueltigeKennung = (noticeId: unknown): boolean => KENNUNG.test(String(noticeId ?? "").toLowerCase());

/** True if a link names only a portal or a list page: no digit after the host (a tender page always carries an id). */
export function nurPortal(url: unknown): boolean {
  const m = /^https?:\/\/[^/?#]+(.*)$/i.exec(String(url ?? "").trim());
  return !m || !/[0-9]/.test(m[1]);
}

/** Page of one notice on oeffentlichevergabe.de; only for a notice id (UUID for EU notices, a number for national ones), otherwise the title search as before. */
export function bekanntmachungsLink(noticeId: unknown, titel: unknown): string {
  const id = String(noticeId ?? "").toLowerCase();
  return KENNUNG.test(id)
    ? `https://oeffentlichevergabe.de/ui/de/notices/${id}`
    : `https://oeffentlichevergabe.de/ui/de/search?q=${encodeURIComponent(String(titel ?? "").replace(/\s+/g, " ").trim().slice(0, 100))}`;
}

// Source data only. No customer profiles, contact lists or private documents are shared.
export type Bedarf = { art: "beruf" | "qualifikation" | "nachweis"; name: string; fundstelle: string; los: string; menge?: number };
export type Bekanntmachung = {
  id: string; quelle: string; quelle_id: string; version: string; quell_datum: string;
  titel: string; beschreibung: string; link: string; auftraggeber: string; auftraggeber_id: string;
  ort: string; plz: string[]; cpv: string[]; frist: string | null; status: string;
  lose: { id: string; titel: string; beschreibung: string; frist: string | null }[];
  bedarf: Bedarf[]; zuschlaege: { id: string; datum: string | null; gewinner: string[]; wert: number | null; waehrung: string; status: string }[];
  vertragsende: string | null; roh: Record<string, any>;
};
export const BERUF_REGELN: [string, RegExp][] = [
  ["Elektriker/in", /elektriker|elektroniker|elektrofachkr[aä]ft/gi], ["Schweißer/in", /schwei[ßs]er/gi],
  ["Maler/in", /maler|lackierer/gi], ["Fliesenleger/in", /fliesenleger/gi], ["Maurer/in", /maurer/gi],
  ["Dachdecker/in", /dachdecker/gi], ["Tischler/in", /tischler|schreiner/gi], ["Koch/Köchin", /k[oö]ch(?:e|in|innen)|\bkoch\b/gi],
  ["Servicekraft", /servicekr[aä]fte?|servicepersonal/gi], ["Reinigungskraft", /reinigungskr[aä]fte?|reinigungspersonal/gi],
  ["Pflegefachkraft", /pflegefachkr[aä]fte?|pflegepersonal/gi], ["Bürokraft", /b[uü]rokr[aä]fte?|b[uü]ropersonal/gi],
  ["Sachbearbeiter/in", /sachbearbeiter(?:in|innen)?/gi], ["Staplerfahrer/in", /staplerfahrer/gi],
  ["Lagerhelfer/in", /lagerhelfer|lagerpersonal/gi], ["Berufskraftfahrer/in", /berufskraftfahrer|lkw.fahrer/gi],
  ["Sicherheitsmitarbeiter/in", /sicherheitsmitarbeiter|wachpersonal/gi], ["Gärtner/in", /g[aä]rtner/gi],
  ["Anlagenmechaniker/in SHK", /anlagenmechaniker|heizungsbauer|sanit[aä]rinstallateur/gi],
];
// Add all other personnel occupations; the explicit rules above cover common inflections/synonyms.
for (const name of Object.values(BERUFE).flat()) {
  if (BERUF_REGELN.some(([n]) => n === name)) continue;
  const stem = name.split("/")[0].replace(/[- ]$/, "");
  const safe = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/kraft/g, "kr(?:aft|äfte)");
  BERUF_REGELN.push([name, new RegExp(safe, "gi")]);
}
// Ausschreibungen verwenden oft andere Berufsbezeichnungen als Personalprofile.
// Aliase werden auf die kanonische Bezeichnung abgebildet; die Fundstelle behält
// weiterhin den Wortlaut aus der Bekanntmachung.
for (const [kanonisch, aliase] of Object.entries(BERUF_SYNONYME)) {
  const index = BERUF_REGELN.findIndex(([name]) => name === kanonisch);
  if (index < 0 || !aliase.length) continue;
  const [name, regex] = BERUF_REGELN[index];
  const aliasMuster = aliase.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  BERUF_REGELN[index] = [name, new RegExp(`(?:${regex.source})|(?:${aliasMuster})`, "giu")];
}
for (let i = 0; i < BERUF_REGELN.length; i++) {
  const [name, regex] = BERUF_REGELN[i];
  BERUF_REGELN[i] = [name, new RegExp(`(?<![\\p{L}])(?:${regex.source})`, "giu")];
}
const QUALI: [string, RegExp][] = [["Staplerschein", /staplerschein|flurf[oö]rdermittelschein/gi], ["Führerschein B", /f[uü]hrerschein.{0,15}(klasse\s*)?\bB\b/gi], ["Schweißprüfung", /schwei[ßs]pr[uü]fung|DIN\s*EN\s*ISO\s*9606/gi], ["Ersthelfer", /ersthelfer/gi], ["Sachkunde § 34a", /34\s*a.{0,15}gewo|sachkundepr[uü]fung/gi]];
// Typical suitability evidence in German tenders; the checklist compares them with the firm's stored documents.
const NACHWEISE: [string, RegExp][] = [
  ["Arbeitnehmerüberlassungserlaubnis", /erlaubnis.{0,40}arbeitnehmer[uü]berlassung|a[uü]g.erlaubnis/gi],
  ["Referenzen", /referenz(?:en|nachweise)?/gi],
  ["ISO 9001", /ISO\s*9001/gi], ["ISO 14001", /ISO\s*14001/gi], ["ISO 45001", /ISO\s*45001/gi],
  ["Betriebshaftpflicht", /betriebshaftpflicht|berufshaftpflicht|haftpflichtversicherung/gi],
  ["Handelsregisterauszug", /handelsregister(?:auszug)?/gi],
  ["Gewerbeanmeldung", /gewerbe(?:anmeldung|schein|erlaubnis)/gi],
  ["Unbedenklichkeitsbescheinigung Finanzamt", /unbedenklichkeitsbescheinigung.{0,40}finanzamt|steuerliche.{0,20}unbedenklichkeit|bescheinigung in steuersachen/gi],
  ["Unbedenklichkeitsbescheinigung Sozialversicherung", /unbedenklichkeitsbescheinigung.{0,40}(?:krankenkasse|sozialversicherung)/gi],
  ["Berufsgenossenschaft", /berufsgenossenschaft|unbedenklichkeitsbescheinigung.{0,30}\bBG\b/gi],
  ["Präqualifizierung", /pr[äa]qualifi(?:kation|zierung)|PQ-VOL|PQ-Bau/gi],
  ["Tariftreueerklärung", /tariftreue/gi],
  ["Bewachungserlaubnis § 34a", /§\s*34a|bewachungserlaubnis/gi],
  ["Umsatznachweis", /umsatz(?:zahlen|nachweis|angaben)/gi],
];
export function bedarfErkennen(text: string, los = ""): Bedarf[] {
  const result: Bedarf[] = [];
  for (const [art, regeln] of [["beruf", BERUF_REGELN], ["qualifikation", QUALI], ["nachweis", NACHWEISE]] as const) {
    for (const [name, regex] of regeln) {
      regex.lastIndex = 0;
      const matches = [...text.matchAll(regex)];
      const m = matches.find((x) => /\b\d{1,5}\s*$/.test(text.slice(Math.max(0, x.index! - 12), x.index))) ?? matches[0];
      if (!m) continue;
      const fundstelle = text.slice(Math.max(0, m.index - 90), m.index + m[0].length + 140);
      const davor = text.slice(Math.max(0, m.index - 12), m.index).match(/\b(\d{1,5})\s*$/);
      result.push({ art, name, fundstelle, los, ...(art === "beruf" && davor ? { menge: Number(davor[1]) } : {}) });
    }
  }
  return result;
}
export async function hash(text: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function mergeRelease(old: any, update: any): any {
  if (update === null || typeof update !== "object") return update;
  if (Array.isArray(update)) {
    if (!update.every((x) => x && typeof x === "object" && x.id)) return update;
    const map = new Map((Array.isArray(old) ? old : []).map((x: any) => [x.id, x]));
    for (const x of update) map.set(x.id, mergeRelease(map.get(x.id), x));
    return [...map.values()];
  }
  return Object.fromEntries([...new Set([...Object.keys(old ?? {}), ...Object.keys(update)])].map((k) => [k, Object.hasOwn(update, k) ? mergeRelease(old?.[k], update[k]) : old[k]]));
}
const zeit = (v: any): string | null => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const str = (v: any, max = 30000) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export async function normalisieren(rel: any, tag: string, vorher?: any): Promise<Bekanntmachung | null> {
  const quelleId = str(rel.ocid || rel.id, 350);
  if (!quelleId) return null;
  const r = mergeRelease(vorher ?? {}, rel), t = r.tender ?? {};
  if (!t.title) return null;
  const datum = zeit(rel.date) || zeit(`${tag}T00:00:00Z`)!;
  const party = (r.parties ?? []).find((p: any) => p.id === r.buyer?.id) ?? {};
  const buyer = mergeRelease(party, r.buyer ?? {}), a = buyer.address ?? {};
  const liefer = (t.items ?? []).map((i: any) => i.deliveryAddress).filter(Boolean);
  const lose = (t.lots ?? []).map((l: any) => ({ id: str(l.id, 100), titel: str(l.title, 500), beschreibung: str(l.description), frist: zeit(l.tenderPeriod?.endDate) }));
  // A procedure remains searchable while at least one lot can still receive bids.
  const frist = [zeit(t.tenderPeriod?.endDate), ...lose.map((l: any) => l.frist)].filter(Boolean).sort().at(-1) || null;
  const tags: string[] = rel.tag ?? [];
  const status = tags.includes("tenderCancellation") || ["cancelled", "unsuccessful", "withdrawn"].includes(t.status) ? "aufgehoben" : tags.includes("contractTermination") || t.status === "complete" ? "abgeschlossen" : (r.awards ?? []).some((x: any) => x.status === "active") || t.status === "awarded" ? "vergeben" : frist ? "offen" : "unbekannt";
  const beschreibung = str(t.description);
  const bedarf = [...bedarfErkennen(beschreibung), ...lose.flatMap((l: any) => bedarfErkennen(l.titel + ". " + l.beschreibung, l.id))].slice(0, 100);
  const zuschlaege = (r.awards ?? []).map((v: any) => ({ id: str(v.id, 100), datum: zeit(v.date), gewinner: (v.suppliers ?? []).map((s: any) => str(s.name, 300)), wert: Number.isFinite(v.value?.amount) ? v.value.amount : null, waehrung: str(v.value?.currency, 10), status: str(v.status, 30) }));
  const cpv = [...new Set<string>((t.items ?? []).flatMap((i: any) => [i.classification, ...(i.additionalClassifications ?? [])]).filter((x: any) => x?.scheme?.toUpperCase() === "CPV").map((x: any) => str(x.id, 30).split("-")[0]))];
  const adresse = liefer.length ? liefer : [a];
  const docs = (t.documents ?? []).filter((d: any) => /^https?:\/\//.test(d.url ?? ""));
  // Without a documents link: the notice's own page on the federal publication service (release id = notice id). The
  // former title search often showed other tenders (Benjamin, 09.11.2026).
  // A documents link that only names the portal (no number in path or query, e.g. http://www.evergabe-online.de or
  // …/NetServer/) opens the portal's start page; then the notice page is the better target (click check 09.11.2026).
  const genau = docs.find((d: any) => !nurPortal(d.url))?.url;
  const link = genau || (gueltigeKennung(rel.id) ? bekanntmachungsLink(rel.id, t.title) : docs[0]?.url || bekanntmachungsLink(rel.id, t.title));
  const auftraggeber = str(buyer.name, 500) || "Auftraggeber nicht angegeben";
  // OCDS party IDs such as ORG-0001 are only local to a notice, never global buyer keys. In German notices
  // buyer.identifier.id is that local id too (diagnosis 08.11.2026), so the database trigger ag_schluessel
  // (migration 20261108280000) replaces this value with bks:<name-slug>[:<plz>].
  const ident = buyer.identifier?.id ? `${buyer.identifier.scheme ?? ""}:${buyer.identifier.id}` : `${auftraggeber.toLowerCase()}|${a.postalCode ?? ""}|${a.locality ?? ""}`;
  const buyerId = await hash(ident);
  const vertragsende = (r.contracts ?? []).map((c: any) => zeit(c.period?.endDate)?.slice(0, 10)).filter(Boolean).sort().at(-1) || null;
  // Keep source evidence needed for later amendments, bounded independently of archive size. `id` is the newest notice id
  // (BT-701): the full eForms notice is only found under it, the UUID in the OCID is the procedure id (BT-04).
  const roh = { ocid: quelleId, id: str(rel.id, 200) || undefined, date: datum, buyer, tender: { ...t, description: beschreibung, documents: docs.slice(0, 20), items: (t.items ?? []).slice(0, 100), lots: (t.lots ?? []).slice(0, 50) }, awards: (r.awards ?? []).slice(0, 30), contracts: (r.contracts ?? []).slice(0, 30) };
  const data = { id: `bks:${quelleId}`, quelle: "bks", quelle_id: quelleId, quell_datum: datum, titel: str(t.title, 1000), beschreibung, link: str(link, 3000), auftraggeber, auftraggeber_id: `bks:${buyerId}`, ort: adresse.map((x: any) => [x.postalCode, x.locality, x.region].filter(Boolean).join(" ")).filter(Boolean).join(" · ") + (liefer.length ? "" : " (Auftraggeberadresse; Einsatzort prüfen)"), plz: [...new Set<string>(adresse.map((x: any) => str(x.postalCode, 15)).filter(Boolean))], cpv, frist, status, lose, bedarf, zuschlaege, vertragsende };
  // The version hash keeps the former link form, so the switch to notice pages (and a new release id alone) is not
  // reported as a change of the tender.
  const { quell_datum: _datum, ...inhalt } = { ...data, link: str(docs[0]?.url || bekanntmachungsLink(null, t.title), 3000) };
  return { ...data, version: await hash(JSON.stringify(inhalt)), roh };
}

// Deadlines (06.11.2026): the OCDS export of oeffentlichevergabe.de carries no tenderPeriod; the deadline for tenders
// (BT-131) and for questions (BT-13) is only in the eForms notice of the same CC0 source. The importer reads the daily
// eForms export alongside and writes the deadlines into the OCDS release, so catalog, search and alarm see them.
export type EformsFristen = { frist: string | null; fragefrist: string | null; lose: Record<string, string> };
const eZeit = (datum?: string, uhr?: string): string | null => {
  const d = datum?.match(/^(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})?$/);
  if (!d) return null;
  const u = uhr?.match(/^(\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})?$/);
  const zone = u?.[2] || d[2] || "+01:00";
  const iso = `${d[1]}T${u ? (u[1].length === 5 ? `${u[1]}:00` : u[1]) : "23:59:59"}${zone}`;
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : null;
};
const ePeriode = (xml: string, element: string): string | null => {
  const m = xml.match(new RegExp(`<cac:${element}>([\\s\\S]*?)</cac:${element}>`));
  if (!m) return null;
  return eZeit(m[1].match(/<cbc:EndDate>([^<]+)</)?.[1]?.trim(), m[1].match(/<cbc:EndTime>([^<]+)</)?.[1]?.trim());
};
const spaeteste = (werte: (string | null)[]) => werte.filter(Boolean).sort().at(-1) as string | undefined ?? null;

/** Deadlines of one eForms notice, under its notice id (BT-701) and its procedure id (BT-04, part of the OCID). */
export function eformsFristen(xml: string): { ids: string[]; fristen: EformsFristen } | null {
  const id = xml.match(/<cbc:ID schemeName="notice-id">([^<]+)</)?.[1]?.trim();
  const verfahren = xml.match(/<cbc:ContractFolderID>([^<]+)</)?.[1]?.trim();
  if (!id && !verfahren) return null;
  const lose: Record<string, string> = {};
  const fragen: (string | null)[] = [];
  for (const m of xml.matchAll(/<cac:ProcurementProjectLot>([\s\S]*?)<\/cac:ProcurementProjectLot>/g)) {
    const los = m[1].match(/<cbc:ID schemeName="Lot">([^<]+)</)?.[1]?.trim();
    const frist = ePeriode(m[1], "TenderSubmissionDeadlinePeriod");
    if (los && frist) lose[los] = frist;
    fragen.push(ePeriode(m[1], "AdditionalInformationRequestPeriod"));
  }
  const ohneLose = xml.replace(/<cac:ProcurementProjectLot>[\s\S]*?<\/cac:ProcurementProjectLot>/g, "");
  const frist = spaeteste([ePeriode(ohneLose, "TenderSubmissionDeadlinePeriod"), ...Object.values(lose)]);
  const fragefrist = spaeteste([ePeriode(ohneLose, "AdditionalInformationRequestPeriod"), ...fragen]);
  if (!frist && !fragefrist) return null;
  return { ids: [id, verfahren].filter(Boolean) as string[], fristen: { frist, fragefrist, lose } };
}

/** OCDS release with the eForms deadlines filled in where the release has none (copy; the release itself stays). */
export function fristenEinsetzen(rel: any, karte: Map<string, EformsFristen>): any {
  if (!rel?.tender || !karte.size) return rel;
  const verfahren = String(rel.ocid ?? "").replace(/^ocds-[a-z0-9]+-/, "");
  const f = karte.get(String(rel.id ?? "")) ?? karte.get(verfahren);
  if (!f) return rel;
  const t = rel.tender;
  const lots = (t.lots ?? []).map((l: any) => (l?.tenderPeriod?.endDate || !f.lose[l?.id] ? l : { ...l, tenderPeriod: { ...(l.tenderPeriod ?? {}), endDate: f.lose[l.id] } }));
  return { ...rel, tender: { ...t, lots: t.lots ? lots : t.lots,
    tenderPeriod: t.tenderPeriod?.endDate || !f.frist ? t.tenderPeriod : { ...(t.tenderPeriod ?? {}), endDate: f.frist },
    enquiryPeriod: t.enquiryPeriod?.endDate || !f.fragefrist ? t.enquiryPeriod : { ...(t.enquiryPeriod ?? {}), endDate: f.fragefrist } } };
}

/** Deadlines of a whole daily eForms export (zip), read file by file so only one notice is in memory at a time. */
export function eformsKarte(zip: Uint8Array, grenze = 5_000_000): Map<string, EformsFristen> {
  const karte = new Map<string, EformsFristen>();
  const unzip = new Unzip((datei) => {
    if (!datei.name.endsWith(".xml")) return;
    const teile: Uint8Array[] = [];
    let groesse = 0;
    datei.ondata = (fehler, daten, ende) => {
      if (fehler || groesse > grenze) return;
      groesse += daten.length;
      if (groesse > grenze) return;
      teile.push(daten);
      if (!ende) return;
      const alles = new Uint8Array(groesse);
      let o = 0;
      for (const t of teile) { alles.set(t, o); o += t.length; }
      const r = eformsFristen(new TextDecoder().decode(alles));
      if (r) for (const id of r.ids) karte.set(id, r.fristen);
    };
    datei.start();
  });
  unzip.register(UnzipInflate);
  inStuecken(unzip, zip);
  return karte;
}

/** Feeds a ZIP to fflate's streaming Unzip in pieces: one push with a whole month (6,000 files) recurses once per file
 *  and overflows the call stack. */
export function inStuecken(unzip: { push(daten: Uint8Array, ende?: boolean): void }, zip: Uint8Array, stueck = 65536): void {
  if (!zip.length) { unzip.push(zip, true); return; }
  for (let i = 0; i < zip.length; i += stueck) unzip.push(zip.subarray(i, i + stueck), i + stueck >= zip.length);
}
