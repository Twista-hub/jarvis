// N10: Termine & Bieterfragen per tender. Typed appointments (site visit, bidder questions, submission, opening,
// clarification talk) next to the deadlines, and the team's questions to the contracting authority with status.
import { db, weiterleiten, vorgangZugriff, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape } from "./seite.ts";

export type TerminArt = "besichtigung" | "bieterfragen" | "submission" | "eroeffnung" | "gespraech" | "sonstiges";
export const TERMIN_ARTEN: Record<TerminArt, [string, string]> = {
  besichtigung: ["🏗️", "Ortsbesichtigung"], bieterfragen: ["❓", "Bieterfragen"], submission: ["📨", "Submission / Abgabe"],
  eroeffnung: ["🔓", "Angebotseröffnung"], gespraech: ["🤝", "Aufklärungsgespräch"], sonstiges: ["📌", "Termin"],
};
export const istArt = (a: string): a is TerminArt => a in TERMIN_ARTEN;
export type Termin = { id: string; titel: string; zeit: string; art: TerminArt; ort: string; notiz: string };
export type Frage = { id: string; frage: string; status: "offen" | "gestellt" | "beantwortet"; gestellt_am: string | null; antwort: string; erstellt: string };

const zeitText = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const tageBis = (iso: string, jetzt: number) => Math.ceil((Date.parse(iso) - jetzt) / 86400_000);

/** Questions not asked yet as a numbered text to paste into the procurement portal. */
export function fragenText(fragen: Frage[]): string {
  return fragen.filter((f) => f.status === "offen").map((f, i) => `${i + 1}. ${f.frage.trim()}`).join("\n\n");
}

export function termineSeite(v: { id: string; frist: string | null; fragefrist?: string | null }, termine: Termin[], fragen: Frage[], o: { darfAendern: boolean; jetzt?: number }): string {
  const jetzt = o.jetzt ?? Date.now();
  type Zeile = { zeit: string; icon: string; text: string; ort?: string; notiz?: string; id?: string };
  const zeilen: Zeile[] = [
    ...(v.fragefrist ? [{ zeit: v.fragefrist, icon: "❓", text: "Frist für Bieterfragen" }] : []),
    ...(v.frist ? [{ zeit: v.frist, icon: "⏰", text: "Angebotsfrist" }] : []),
    ...termine.map((t) => ({ zeit: t.zeit, icon: TERMIN_ARTEN[t.art]?.[0] ?? "📌", text: t.titel, ort: t.ort, notiz: t.notiz, id: t.id })),
  ].sort((a, b) => a.zeit.localeCompare(b.zeit));
  const zeile = (z: Zeile) => {
    const t = tageBis(z.zeit, jetzt);
    return `<li class="termin-zeile${t < 0 ? " vorbei" : t <= 3 ? " bald" : ""}"><span class="termin-icon" aria-hidden="true">${z.icon}</span><div><strong>${escape(z.text)}</strong><span class="klein">${zeitText(z.zeit)}${t >= 0 ? ` · ${t === 0 ? "heute" : t === 1 ? "morgen" : `in ${t} Tagen`}` : " · vorbei"}</span>${z.ort ? `<span class="klein">📍 ${escape(z.ort)}</span>` : ""}${z.notiz ? `<span class="klein">📝 ${escape(z.notiz)}</span>` : ""}</div>${z.id && o.darfAendern ? `<form method="post" action="/konto/termin"><input type="hidden" name="loeschen" value="${z.id}"><input type="hidden" name="weiter" value="/konto/vorgang/${v.id}#termine"><button class="zweit" aria-label="Termin löschen">✕</button></form>` : ""}</li>`;
  };
  const neu = o.darfAendern ? `<details class="termin-neu"><summary>➕ Termin eintragen</summary><form method="post" action="/konto/termin"><input type="hidden" name="vorgang" value="${v.id}"><input type="hidden" name="weiter" value="/konto/vorgang/${v.id}#termine"><div class="aueg-form">
<label>Art<select name="art">${(Object.entries(TERMIN_ARTEN) as [TerminArt, [string, string]][]).map(([k, [i, t]]) => `<option value="${k}">${i} ${t}</option>`).join("")}</select></label>
<label>Wann?<input name="zeit" type="datetime-local" required></label>
<label class="ganz">Ort oder Treffpunkt<input name="ort" maxlength="300" placeholder="z. B. Pforte Haupteingang"></label>
<label class="ganz">Notiz<input name="notiz" maxlength="1000" placeholder="z. B. Anmeldung bis 2 Tage vorher per Mail"></label></div><button>Termin speichern</button></form></details>` : "";
  const offen = fragen.filter((f) => f.status === "offen");
  const warnung = v.fragefrist && offen.length && tageBis(v.fragefrist, jetzt) >= 0 && tageBis(v.fragefrist, jetzt) <= 3
    ? `<p class="hinweis">⚠️ ${offen.length} ${offen.length === 1 ? "Frage ist" : "Fragen sind"} noch nicht gestellt. Frist für Bieterfragen: ${zeitText(v.fragefrist)}.</p>` : "";
  const frage = (f: Frage) => `<li class="frage-zeile status-${f.status}"><div><p>${escape(f.frage)}</p><span class="klein">${f.status === "offen" ? "🟡 noch nicht gestellt" : f.status === "gestellt" ? `📨 gestellt${f.gestellt_am ? ` am ${new Date(`${f.gestellt_am}T12:00:00Z`).toLocaleDateString("de-DE")}` : ""}` : "✅ beantwortet"}</span>${f.antwort ? `<p class="frage-antwort">↳ ${escape(f.antwort)}</p>` : ""}</div>
${o.darfAendern ? `<div class="frage-aktionen">${f.status === "offen" ? `<form method="post" action="/konto/vorgang/${v.id}/bieterfragen"><input type="hidden" name="id" value="${f.id}"><button name="aktion" value="gestellt" class="zweit">Gestellt</button></form>` : ""}${f.status !== "beantwortet" ? `<details><summary>Antwort</summary><form method="post" action="/konto/vorgang/${v.id}/bieterfragen"><input type="hidden" name="id" value="${f.id}"><input type="hidden" name="aktion" value="antwort"><textarea name="antwort" maxlength="4000" rows="3" required></textarea><button>Speichern</button></form></details>` : ""}<form method="post" action="/konto/vorgang/${v.id}/bieterfragen"><input type="hidden" name="id" value="${f.id}"><button name="aktion" value="loeschen" class="zweit" aria-label="Frage löschen">✕</button></form></div>` : ""}</li>`;
  const fragenBlock = `<h3>Bieterfragen <span class="klein">${offen.length ? `${offen.length} offen` : ""}${fragen.length - offen.length ? ` · ${fragen.length - offen.length} gestellt` : ""}</span></h3>${warnung}
${fragen.length ? `<ul class="frage-liste">${fragen.map(frage).join("")}</ul>` : `<p class="klein">Unklarheiten in den Unterlagen sammelt ihr hier und stellt sie gesammelt über das Vergabeportal.</p>`}
${o.darfAendern ? `<form method="post" action="/konto/vorgang/${v.id}/bieterfragen" class="frage-neu"><input type="hidden" name="aktion" value="neu"><label><span class="unsichtbar">Neue Frage</span><textarea name="frage" rows="2" maxlength="2000" required placeholder="z. B. Sind Sonntagszuschläge im Stundensatz enthalten?"></textarea></label><button>Frage notieren</button></form>` : ""}
${offen.length ? `<details><summary>📋 Offene Fragen als Text fürs Portal</summary><textarea readonly rows="${Math.min(12, offen.length * 3)}" class="fragen-text">${escape(fragenText(fragen))}</textarea><p class="klein">Text markieren, kopieren und im Vergabeportal bei „Bieterfragen“ einfügen. Danach die Fragen als „Gestellt“ markieren.</p></details>` : ""}`;
  return `<h2 id="termine">📅 Termine &amp; Bieterfragen</h2>${zeilen.length ? `<ul class="termin-liste">${zeilen.map(zeile).join("")}</ul>` : `<p class="klein">Noch keine Termine. Ortsbesichtigung oder Eröffnungstermin aus den Unterlagen hier eintragen; sie erscheinen auch unter Fristen und im Kalender-Abo.</p>`}${neu}${fragenBlock}`;
}

export async function termineTeil(s: Sitzung, env: KontoEnv, v: { id: string; frist: string | null; fragefrist?: string | null }, rolle: string): Promise<string> {
  if (rolle === "mitarbeiter") return "";
  const [t, f] = await Promise.all([
    db<Termin[]>(s, env, `eigene_termine?vorgang_id=eq.${v.id}&select=id,titel,zeit,art,ort,notiz&order=zeit&limit=50`),
    db<Frage[]>(s, env, `bieterfragen?vorgang_id=eq.${v.id}&select=id,frage,status,gestellt_am,antwort,erstellt&order=erstellt&limit=200`),
  ]);
  return termineSeite(v, t.ok ? t.daten : [], f.ok ? f.daten : [], { darfAendern: !["leser", "mitarbeiter"].includes(rolle) });
}

export async function bieterfragenSpeichern(id: string, request: Request, env: KontoEnv): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) return weiterleiten("/konto");
  const form = await request.formData();
  const aktion = String(form.get("aktion") ?? ""), fid = String(form.get("id") ?? "");
  const pfad = `bieterfragen?id=eq.${fid}&vorgang_id=eq.${id}`;
  const gueltig = /^[0-9a-f-]{36}$/.test(fid);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const r = aktion === "neu" ? (String(form.get("frage") ?? "").trim().length >= 3 ? await db(z.s, env, "bieterfragen", { method: "POST", body: JSON.stringify({ firma_id: z.v.firma_id, vorgang_id: id, frage: String(form.get("frage")).trim().slice(0, 2000) }) }) : { ok: false })
    : !gueltig ? { ok: false }
    : aktion === "gestellt" ? await db(z.s, env, pfad, { method: "PATCH", body: JSON.stringify({ status: "gestellt", gestellt_am: heute }) })
    : aktion === "antwort" ? await db(z.s, env, pfad, { method: "PATCH", body: JSON.stringify({ status: "beantwortet", antwort: String(form.get("antwort") ?? "").trim().slice(0, 4000) }) })
    : aktion === "loeschen" ? await db(z.s, env, pfad, { method: "DELETE" }) : { ok: false };
  return weiterleiten(`/konto/vorgang/${id}${r.ok ? "" : `?fehler=${encodeURIComponent("Die Bieterfrage konnte nicht gespeichert werden.")}`}#termine`, z.s.cookies);
}
