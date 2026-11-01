// N1: all offers of the firm at a glance with their stage (in progress, waiting for the boss, approved, submitted,
// award, rejection). Amounts only for people with finance access; everyone else sees the stage from the tender status.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { abstand } from "./fristen.ts";
import { escape, seite } from "./seite.ts";

export type Stand = "arbeit" | "chef" | "freigegeben" | "abgegeben" | "zuschlag" | "absage";
export const STAENDE: Record<Stand, [string, string]> = {
  arbeit: ["✏️", "In Arbeit"], chef: ["⏳", "Wartet auf Chef"], freigegeben: ["✅", "Freigegeben"],
  abgegeben: ["📨", "Abgegeben"], zuschlag: ["🏆", "Zuschlag"], absage: ["❌", "Absage"],
};
type V = { id: string; titel: string; frist: string | null; status: string; kaufverantwortlich_id: string | null; geaendert?: string | null };
type Mappe = { id: string; vorgang_id: string; erstellt: string; freigabe_status: string; text?: string };
type Abgabe = { mappe_id: string; abgegeben_am: string; portal: string };
export type Zeile = { v: V; stand: Stand; netto: number | null; abgegeben: string | null; ueberarbeiten: boolean };

/** Net total from the offer text ("| | **Gesamt netto** | | | **12.345,00 €** |"), null if not found. */
export function nettoAusText(text: string | undefined): number | null {
  const m = text?.match(/Gesamt netto\**\s*\|[^\n]*?\*\*([\d.]+,\d{2})\s*€\*\*/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

/** Stage of each tender from its status, its latest offer version and a recorded submission. */
export function staende(vorgaenge: V[], mappen: Mappe[], abgaben: Abgabe[]): Zeile[] {
  return vorgaenge.map((v) => {
    const eigene = mappen.filter((m) => m.vorgang_id === v.id).sort((a, b) => b.erstellt.localeCompare(a.erstellt));
    const letzte = eigene[0];
    const abgabe = abgaben.filter((a) => eigene.some((m) => m.id === a.mappe_id)).sort((a, b) => b.abgegeben_am.localeCompare(a.abgegeben_am))[0];
    const stand: Stand = v.status === "gewonnen" ? "zuschlag" : v.status === "verloren" ? "absage"
      : abgabe || v.status === "abgegeben" ? "abgegeben"
      : letzte?.freigabe_status === "wartet" ? "chef" : letzte?.freigabe_status === "genehmigt" ? "freigegeben" : "arbeit";
    return { v, stand, netto: nettoAusText(letzte?.text), abgegeben: abgabe?.abgegeben_am ?? null, ueberarbeiten: stand === "arbeit" && letzte?.freigabe_status === "abgelehnt" };
  });
}

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function uebersichtSeite(zeilen: Zeile[], o: { filter: string; finanzen: boolean; darfAendern: boolean; personen: Record<string, string>; jetzt?: number }): string {
  const jetzt = o.jetzt ?? Date.now();
  const filter = (Object.keys(STAENDE) as Stand[]).includes(o.filter as Stand) ? o.filter as Stand : "";
  const zahl = (s: Stand) => zeilen.filter((z) => z.stand === s).length;
  const entschieden = zahl("zuschlag") + zahl("absage");
  const summe = (s: Stand) => zeilen.filter((z) => z.stand === s && z.netto).reduce((x, z) => x + (z.netto ?? 0), 0);
  const kennzahlen = `<div class="angebot-kennzahlen"><div><strong>${zeilen.filter((z) => ["arbeit", "chef", "freigegeben"].includes(z.stand)).length}</strong><span>in Vorbereitung</span></div><div><strong>${zahl("abgegeben")}</strong><span>warten auf Entscheidung${o.finanzen && summe("abgegeben") ? `<br>${euro(summe("abgegeben"))}` : ""}</span></div><div><strong>${entschieden ? `${Math.round((zahl("zuschlag") / entschieden) * 100)} %` : "–"}</strong><span>gewonnen${entschieden ? ` (${zahl("zuschlag")} von ${entschieden})` : ""}${o.finanzen && summe("zuschlag") ? `<br>${euro(summe("zuschlag"))}` : ""}</span></div></div>`;
  const chips = `<nav class="ordner-chips" aria-label="Stand"><a href="/konto/angebote"${filter ? "" : ' aria-current="true"'}>Alle <span>${zeilen.length}</span></a>${(Object.entries(STAENDE) as [Stand, [string, string]][]).filter(([s]) => zahl(s)).map(([s, [i, t]]) => `<a href="/konto/angebote?stand=${s}"${s === filter ? ' aria-current="true"' : ""}>${i} ${t} <span>${zahl(s)}</span></a>`).join("")}</nav>`;
  const reihenfolge: Stand[] = ["chef", "arbeit", "freigegeben", "abgegeben", "zuschlag", "absage"];
  const gezeigt = zeilen.filter((z) => !filter || z.stand === filter).sort((a, b) => reihenfolge.indexOf(a.stand) - reihenfolge.indexOf(b.stand) || (a.v.frist ?? "9").localeCompare(b.v.frist ?? "9"));
  const zeile = (z: Zeile) => {
    const [icon, text] = STAENDE[z.stand];
    const offen = ["arbeit", "chef", "freigegeben"].includes(z.stand);
    const frist = z.v.frist && offen ? `<span class="${Date.parse(z.v.frist) - jetzt < 3 * 86400_000 ? "frist-knapp" : ""}">⏰ ${abstand(z.v.frist, jetzt)}</span>` : "";
    const wer = z.v.kaufverantwortlich_id ? o.personen[z.v.kaufverantwortlich_id] : "";
    const ziel = o.finanzen ? `/konto/vorgang/${z.v.id}/angebot` : `/konto/vorgang/${z.v.id}`;
    const knoepfe = o.darfAendern && z.stand === "abgegeben" ? `<div class="angebot-entscheidung">${[["gewonnen", "🏆 Zuschlag"], ["verloren", "❌ Absage"]].map(([s, t]) => `<form method="post" action="/konto/status"><input type="hidden" name="id" value="${z.v.id}"><input type="hidden" name="weiter" value="/konto/angebote${filter ? `?stand=${filter}` : ""}"><button name="status" value="${s}" class="zweit">${t}</button></form>`).join("")}</div>` : "";
    return `<li class="angebot-zeile stand-${z.stand}"><a href="${ziel}" class="angebot-titel"><strong>${escape(z.v.titel)}</strong><span class="klein"><span class="stand-marke">${icon} ${text}</span>${z.ueberarbeiten ? " · vom Chef zurückgegeben" : ""}${frist ? ` · ${frist}` : ""}${z.abgegeben ? ` · abgegeben ${new Date(z.abgegeben).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}` : ""}${wer ? ` · 👤 ${escape(wer)}` : ""}</span></a>${o.finanzen && z.netto ? `<span class="angebot-summe">${euro(z.netto)}</span>` : ""}${knoepfe}</li>`;
  };
  return `${kennzahlen}${chips}${gezeigt.length ? `<ul class="angebot-liste">${gezeigt.map(zeile).join("")}</ul>` : `<p class="treffer-leer">${zeilen.length ? "In diesem Stand gibt es gerade nichts." : "Noch keine Angebote. Merke dir eine Ausschreibung mit ⭐ und bereite dort das Angebot vor."}</p>`}<p class="klein">${o.finanzen ? "Summen aus der jeweils letzten Angebotsversion (netto)." : "Summen sieht, wer eine Finanzfreigabe hat."} Zuschlag oder Absage trägst du nach der Entscheidung des Auftraggebers ein.</p>`;
}

export async function angebotsUebersicht(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/angebote") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text: string, status = 200) => html(seite("Angebote", text, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Angebotsübersicht sieht das Büroteam.</p>", 403);
  const [v, mappen, abgaben, mitglieder] = await Promise.all([
    db<V[]>(f.s, env, `vorgaenge?firma_id=eq.${f.m.firma_id}&status=in.(angebot,abgegeben,gewonnen,verloren)&select=id,titel,frist,status,kaufverantwortlich_id,geaendert&order=frist.asc.nullslast&limit=500`),
    f.finanzen ? db<Mappe[]>(f.s, env, `angebotsmappen?firma_id=eq.${f.m.firma_id}&select=id,vorgang_id,erstellt,freigabe_status,text&order=erstellt.desc&limit=500`) : Promise.resolve({ ok: true as const, daten: [] as Mappe[] }),
    f.finanzen ? db<Abgabe[]>(f.s, env, `angebotsabgaben?firma_id=eq.${f.m.firma_id}&select=mappe_id,abgegeben_am,portal&limit=500`) : Promise.resolve({ ok: true as const, daten: [] as Abgabe[] }),
    db<{ user_id: string; anzeigename: string }[]>(f.s, env, `mitglieder?firma_id=eq.${f.m.firma_id}&select=user_id,anzeigename`),
  ]);
  if (!v.ok) return antwort('<p class="fehler">Die Angebote konnten nicht geladen werden.</p>', 502);
  const zeilen = staende(v.daten, mappen.ok ? mappen.daten : [], abgaben.ok ? abgaben.daten : []);
  const personen = Object.fromEntries((mitglieder.ok ? mitglieder.daten : []).map((x) => [x.user_id, x.anzeigename || "Ohne Namen"]));
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${uebersichtSeite(zeilen, { filter: url.searchParams.get("stand") ?? "", finanzen: f.finanzen, darfAendern: ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle), personen })}`);
}
