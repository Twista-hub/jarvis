import { BERUFE, BERUF_SYNONYME } from "./berufe.ts";

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
  const link = docs[0]?.url || `https://oeffentlichevergabe.de/ui/de/search?q=${encodeURIComponent(str(t.title, 100))}`;
  const auftraggeber = str(buyer.name, 500) || "Auftraggeber nicht angegeben";
  // OCDS party IDs such as ORG-0001 are only local to a notice, never global buyer keys.
  const ident = buyer.identifier?.id ? `${buyer.identifier.scheme ?? ""}:${buyer.identifier.id}` : `${auftraggeber.toLowerCase()}|${a.postalCode ?? ""}|${a.locality ?? ""}`;
  const buyerId = await hash(ident);
  const vertragsende = (r.contracts ?? []).map((c: any) => zeit(c.period?.endDate)?.slice(0, 10)).filter(Boolean).sort().at(-1) || null;
  // Keep source evidence needed for later amendments, bounded independently of archive size.
  const roh = { ocid: quelleId, date: datum, buyer, tender: { ...t, description: beschreibung, documents: docs.slice(0, 20), items: (t.items ?? []).slice(0, 100), lots: (t.lots ?? []).slice(0, 50) }, awards: (r.awards ?? []).slice(0, 30), contracts: (r.contracts ?? []).slice(0, 30) };
  const data = { id: `bks:${quelleId}`, quelle: "bks", quelle_id: quelleId, quell_datum: datum, titel: str(t.title, 1000), beschreibung, link: str(link, 3000), auftraggeber, auftraggeber_id: `bks:${buyerId}`, ort: adresse.map((x: any) => [x.postalCode, x.locality, x.region].filter(Boolean).join(" ")).filter(Boolean).join(" · ") + (liefer.length ? "" : " (Auftraggeberadresse; Einsatzort prüfen)"), plz: [...new Set<string>(adresse.map((x: any) => str(x.postalCode, 15)).filter(Boolean))], cpv, frist, status, lose, bedarf, zuschlaege, vertragsende };
  const { quell_datum: _datum, ...inhalt } = data;
  return { ...data, version: await hash(JSON.stringify(inhalt)), roh };
}
