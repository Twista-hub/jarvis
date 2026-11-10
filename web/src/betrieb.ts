// Operator page: state of operations at a glance (10.11.2026, after the catalogue stood still unnoticed for four days).
// One read-only call (public.betreiber_betrieb), judged here without any AI.
import { escape } from "./seite.ts";

export type Betrieb = {
  jetzt?: string; katalog_neueste?: string | null; katalog_24h?: number; katalog_7t?: number;
  quelle?: { letzter_erfolg?: string | null; fehler?: string | null; rueckstand_tage?: number } | null;
  zahlen_stand?: string | null; letzte_mail?: string | null; push_haengt?: number; social_zuletzt?: string | null;
  fehler_48h?: number; fehler_letzter?: { zeit?: string; text?: string } | null;
  ki?: { limit_usd?: number; reserviert?: number } | null; ki_firmen_aktiv?: number; datenbank_bytes?: number; firmen?: number;
};
export type Zustand = "gruen" | "gelb" | "rot" | "grau";
export type Zeile = { name: string; zustand: Zustand; text: string };

const stunden = (von: string | null | undefined, jetzt: number): number | null => { const t = von ? Date.parse(von) : NaN; return Number.isFinite(t) ? (jetzt - t) / 3600000 : null; };
const vor = (h: number | null): string => h === null ? "noch nie" : h < 1 ? "vor weniger als 1 Stunde" : h < 48 ? `vor ${Math.round(h)} Stunden` : `vor ${Math.round(h / 24)} Tagen`;
const nachAlter = (h: number | null, gelbAb: number, rotAb: number): Zustand => h === null ? "rot" : h >= rotAb ? "rot" : h >= gelbAb ? "gelb" : "gruen";
const zahl = (n: number) => n.toLocaleString("de-DE");

/** Rows of the operations box. Limits: catalogue 36 h / 72 h (weekends bring fewer but never no notices), public numbers
 *  13 h / 25 h (recomputed every 6 h), database 350 / 450 MB (free plan: 500 MB, the collector pauses at 350). */
export function betriebZeilen(d: Betrieb, jetzt = Date.parse(d.jetzt ?? "") || Date.now()): Zeile[] {
  const zeilen: Zeile[] = [];
  const kat = stunden(d.katalog_neueste, jetzt);
  zeilen.push({ name: "Ausschreibungen", zustand: nachAlter(kat, 36, 72), text: `neueste ${vor(kat)} · ${zahl(d.katalog_24h ?? 0)} in 24 Stunden · ${zahl(d.katalog_7t ?? 0)} in 7 Tagen` });
  const q = d.quelle ?? {};
  zeilen.push({ name: "Abruf beim Bund", zustand: q.fehler ? "gelb" : nachAlter(stunden(q.letzter_erfolg, jetzt), 6, 24), text: q.fehler ? String(q.fehler) : `letzter erfolgreicher Abruf ${vor(stunden(q.letzter_erfolg, jetzt))}${(q.rueckstand_tage ?? 0) > 0 ? ` · ${q.rueckstand_tage} Tage noch nicht eingelesen` : ""}` });
  const z = stunden(d.zahlen_stand, jetzt);
  zeilen.push({ name: "Zahlen auf den öffentlichen Seiten", zustand: nachAlter(z, 13, 25), text: `berechnet ${vor(z)}` });
  const f = d.fehler_48h ?? 0;
  zeilen.push({ name: "Fehlermeldungen", zustand: f ? "gelb" : "gruen", text: f ? `${f} in 48 Stunden, zuletzt: ${d.fehler_letzter?.text ?? ""}` : "keine in 48 Stunden" });
  const p = d.push_haengt ?? 0;
  zeilen.push({ name: "Handy-Nachrichten", zustand: p ? "gelb" : "gruen", text: p ? `${p} warten seit über 1 Stunde auf den Versand` : "keine wartet auf den Versand" });
  const m = stunden(d.letzte_mail, jetzt);
  zeilen.push({ name: "Tägliche Mail", zustand: "grau", text: m === null ? "noch keine verschickt" : `letzte ${vor(m)} (kommt nur, wenn jemand neue Treffer hat)` });
  const s = stunden(d.social_zuletzt, jetzt);
  zeilen.push({ name: "Bluesky und Mastodon", zustand: nachAlter(s, 36, 96), text: `letzter Post ${vor(s)}` });
  const limit = Number(d.ki?.limit_usd ?? 0), verbraucht = Number(d.ki?.reserviert ?? 0), anteil = limit > 0 ? verbraucht / limit : 0;
  zeilen.push({ name: "KI-Kosten im Monat", zustand: anteil >= 0.9 ? "rot" : anteil >= 0.7 ? "gelb" : "gruen", text: `${verbraucht.toFixed(2).replace(".", ",")} von ${limit.toFixed(0)} $ · tägliche KI-Suche für ${d.ki_firmen_aktiv ?? 0} ${(d.ki_firmen_aktiv ?? 0) === 1 ? "Firma" : "Firmen"}` });
  const mb = (d.datenbank_bytes ?? 0) / 1e6;
  zeilen.push({ name: "Datenbank", zustand: mb >= 450 ? "rot" : mb >= 350 ? "gelb" : "gruen", text: `${Math.round(mb)} von 500 MB (Abruf pausiert ab 350 MB)` });
  return zeilen;
}

const MARKE: Record<Zustand, string> = { gruen: "✓", gelb: "!", rot: "✕", grau: "·" };
const WORT: Record<Zustand, string> = { gruen: "in Ordnung", gelb: "prüfen", rot: "Störung", grau: "Hinweis" };

export function betriebKasten(d: Betrieb | null): string {
  if (!d) return `<h2>Betrieb</h2><p class="hinweis">Der Betriebszustand konnte nicht geladen werden.</p>`;
  const zeilen = betriebZeilen(d);
  const schlimmste: Zustand = zeilen.some((x) => x.zustand === "rot") ? "rot" : zeilen.some((x) => x.zustand === "gelb") ? "gelb" : "gruen";
  const kopf = schlimmste === "gruen" ? "Alles läuft." : schlimmste === "gelb" ? "Bitte ansehen:" : "Störung:";
  const auffaellig = zeilen.filter((x) => x.zustand === schlimmste && schlimmste !== "gruen").map((x) => x.name).join(", ");
  return `<h2>Betrieb</h2><p class="betrieb-kopf ${schlimmste}" role="status"><strong>${kopf}</strong>${auffaellig ? ` ${escape(auffaellig)}` : ""}</p>
<ul class="betrieb-liste">${zeilen.map((x) => `<li class="${x.zustand}"><span class="betrieb-marke" aria-hidden="true">${MARKE[x.zustand]}</span><span><strong>${escape(x.name)}</strong> <span class="sr-only">(${WORT[x.zustand]})</span><br><span class="klein">${escape(x.text)}</span></span></li>`).join("")}</ul>`;
}
