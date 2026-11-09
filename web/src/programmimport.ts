// Customers straight from the invoicing program (09.11.2026): Lexware Office (formerly lexoffice) and sevDesk have free
// public APIs. The customer creates an API key there and pastes it once; Crewtender reads the customer contacts with it
// and hands them to the same preview as the Excel import (datenimport.ts). The key is used for this one request only and
// is never stored or logged. Read access only, no AI.
//   Lexware: https://developers.lexware.io/docs/ (GET /v1/contacts?customer=true, Bearer, max. 2 requests/s, 250/page)
//   sevDesk: https://api.sevdesk.de/openapi.yaml (GET /Contact, /ContactAddress, /CommunicationWay; header Authorization)

export const KOPF = ["Kunde", "Straße", "PLZ", "Ort", "Ansprechpartner", "Telefon", "E-Mail", "USt-IdNr", "Notiz"];
type Holen = (url: string, init: RequestInit) => Promise<Response>;
const warten = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX = 2000;

async function json(holen: Holen, url: string, kopf: Record<string, string>): Promise<unknown> {
  for (let versuch = 0; versuch < 3; versuch++) {
    const r = await holen(url, { headers: { accept: "application/json", ...kopf } });
    if (r.status === 429) { await warten(1500 * (versuch + 1)); continue; }
    if (r.status === 401 || r.status === 403) throw new Error("Der API-Schlüssel wurde nicht angenommen. Bitte prüfen, ob er vollständig kopiert ist und Lesezugriff auf Kontakte hat.");
    if (!r.ok) throw new Error(`Das Programm hat mit Fehler ${r.status} geantwortet. Bitte später noch einmal versuchen.`);
    return r.json();
  }
  throw new Error("Das Programm hat zu viele Anfragen gemeldet. Bitte in einer Minute noch einmal versuchen.");
}

type LexKontakt = {
  archived?: boolean; note?: string;
  company?: { name?: string; vatRegistrationId?: string; contactPersons?: { firstName?: string; lastName?: string; primary?: boolean; emailAddress?: string; phoneNumber?: string }[] };
  person?: { firstName?: string; lastName?: string };
  addresses?: { billing?: { street?: string; zip?: string; city?: string; supplement?: string }[] };
  emailAddresses?: Record<string, string[]>; phoneNumbers?: Record<string, string[]>;
};

/** Customer contacts from Lexware Office as rows with the header KOPF. */
export async function lexwareKunden(schluessel: string, holen: Holen = fetch, pause = 600): Promise<string[][]> {
  const zeilen: string[][] = [KOPF];
  for (let seite = 0; seite < 20 && zeilen.length <= MAX; seite++) {
    if (seite) await warten(pause); // 2 requests per second at most
    const d = await json(holen, `https://api.lexware.io/v1/contacts?customer=true&size=100&page=${seite}`, { authorization: `Bearer ${schluessel}` }) as { content?: LexKontakt[]; last?: boolean };
    for (const k of d.content ?? []) {
      if (k.archived) continue;
      const name = k.company?.name ?? [k.person?.firstName, k.person?.lastName].filter(Boolean).join(" ");
      const a = k.addresses?.billing?.[0] ?? {};
      const p = k.company?.contactPersons?.find((x) => x.primary) ?? k.company?.contactPersons?.[0];
      const erste = (m?: Record<string, string[]>, ...arten: string[]) => arten.map((x) => m?.[x]?.[0]).find(Boolean) ?? "";
      zeilen.push([name ?? "", a.street ?? "", a.zip ?? "", a.city ?? "", p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "",
        p?.phoneNumber || erste(k.phoneNumbers, "business", "office", "mobile", "other"), p?.emailAddress || erste(k.emailAddresses, "business", "office", "other"),
        k.company?.vatRegistrationId ?? "", k.note ?? ""]);
    }
    if (d.last !== false || !(d.content ?? []).length) break;
  }
  return zeilen;
}

type SevObjekt = { id: string; contact?: { id: string }; parent?: { id: string } | null };
type SevKontakt = SevObjekt & { name?: string; surename?: string; familyname?: string; customerNumber?: string; category?: { id: string }; vatNumber?: string; description?: string };
type SevAdresse = SevObjekt & { street?: string; zip?: string; city?: string };
type SevWeg = SevObjekt & { type?: string; value?: string; main?: string | boolean };

async function sevListe<T>(holen: Holen, pfad: string, schluessel: string): Promise<T[]> {
  const alle: T[] = [];
  for (let offset = 0; offset < 10_000; offset += 1000) {
    const d = await json(holen, `https://my.sevdesk.de/api/v1/${pfad}${pfad.includes("?") ? "&" : "?"}limit=1000&offset=${offset}`, { authorization: schluessel }) as { objects?: T[] };
    alle.push(...(d.objects ?? []));
    if ((d.objects ?? []).length < 1000) break;
  }
  return alle;
}

/** Customers from sevDesk (contacts with a customer number or the category "Kunde", id 3) as rows with the header KOPF. */
export async function sevdeskKunden(schluessel: string, holen: Holen = fetch): Promise<string[][]> {
  const [kontakte, adressen, wege] = [await sevListe<SevKontakt>(holen, "Contact?depth=1", schluessel), await sevListe<SevAdresse>(holen, "ContactAddress", schluessel), await sevListe<SevWeg>(holen, "CommunicationWay", schluessel)];
  const adresse = new Map<string, SevAdresse>();
  for (const a of adressen) if (a.contact?.id && !adresse.has(a.contact.id)) adresse.set(a.contact.id, a);
  const weg = (id: string, typ: string) => wege.filter((w) => w.contact?.id === id && w.type === typ).sort((x, y) => Number(y.main === true || y.main === "1") - Number(x.main === true || x.main === "1"))[0]?.value ?? "";
  const personen = kontakte.filter((k) => k.parent?.id);
  const zeilen: string[][] = [KOPF];
  for (const k of kontakte) {
    if (k.parent?.id || !(k.customerNumber || k.category?.id === "3")) continue;
    const name = k.name || [k.surename, k.familyname].filter(Boolean).join(" ");
    const a = adresse.get(k.id) ?? {} as SevAdresse;
    const p = personen.find((x) => x.parent?.id === k.id);
    zeilen.push([name, a.street ?? "", a.zip ?? "", a.city ?? "", p ? [p.surename, p.familyname].filter(Boolean).join(" ") : "",
      weg(k.id, "PHONE") || (p ? weg(p.id, "PHONE") : ""), weg(k.id, "EMAIL") || (p ? weg(p.id, "EMAIL") : ""), k.vatNumber ?? "", k.description ?? ""]);
    if (zeilen.length > MAX) break;
  }
  return zeilen;
}

export const PROGRAMME = {
  lexware: { name: "Lexware Office (früher lexoffice)", hilfe: "In Lexware Office: https://app.lexware.de/addons/public-api öffnen, „Schlüssel erzeugen“, die Nutzungsbedingungen bestätigen und den Schlüssel kopieren.", laden: lexwareKunden },
  sevdesk: { name: "sevDesk", hilfe: "In sevDesk: Einstellungen → Benutzer → dein Benutzer → API-Token kopieren.", laden: sevdeskKunden },
} as const;
export type Programm = keyof typeof PROGRAMME;
