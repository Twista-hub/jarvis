import { escape } from "./seite.ts";

export type Firmenstandort = { name: string; plz: string; quelle: string; bereich_id?: string };

export function standorteBereinigen(werte: unknown): Firmenstandort[] {
  const gesehen = new Set<string>();
  return (Array.isArray(werte) ? werte : []).flatMap((o) => {
    if (!o || typeof o !== "object") return [];
    const name = String(o.name || "").replace(/\s+/g, " ").trim().slice(0, 120);
    let quelle = "";
    try { const u = new URL(String(o.quelle)); if (u.protocol === "https:" && !u.username && !u.password) quelle = u.toString().slice(0, 500); } catch { /* Only safe source links. */ }
    const key = name.toLocaleLowerCase("de");
    if (!name || !quelle || gesehen.has(key)) return [];
    gesehen.add(key);
    return [{ name, plz: /^\d{5}$/.test(String(o.plz)) ? String(o.plz) : "", quelle,
      ...(/^[0-9a-f-]{36}$/.test(String(o.bereich_id)) ? { bereich_id: String(o.bereich_id) } : {}) }];
  }).slice(0, 40);
}

export function firmenstandorteKarte(werte: unknown): string {
  const standorte = standorteBereinigen(werte);
  if (!standorte.length) return "";
  return `<article class="firmen-fund firmen-standorte"><h3>${standorte.length} Firmenstandort${standorte.length === 1 ? "" : "e"} gefunden</h3>
    <ul>${standorte.map((o) => `<li><span>${escape(o.plz ? `${o.plz} ${o.name}` : o.name)}</span><a href="${escape(o.quelle)}" target="_blank" rel="noopener noreferrer" aria-label="Quelle für ${escape(o.name)}">Quelle</a></li>`).join("")}</ul>
    <p class="klein">Als Firmenstandorte hinterlegt. Das Suchgebiet ändert sich dadurch nicht. <a href="/konto/team">Firma & Team öffnen</a></p></article>`;
}
