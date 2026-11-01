// T6: recurring instructions (occupational safety, hygiene, hazardous substances …): interval in months, who took part
// when, who is due. Several people can be marked at once after a session.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Unterweisung = { id: string; titel: string; intervall_monate: number; beschreibung: string };
export type Teilnahme = { unterweisung_id: string; personal_id: string; datum: string; digital?: boolean };
export type PersonKurz = { id: string; vorname: string; nachname: string; status: string };
export const VORLAGEN: [string, number][] = [["Allgemeine Arbeitsschutzunterweisung", 12], ["Hygieneschulung (§ 43 IfSG, Folgebelehrung)", 24], ["Brandschutzunterweisung", 12], ["Gefahrstoffe", 12], ["Erste Hilfe (Auffrischung)", 24], ["Datenschutz", 12]];

export function plusMonate(d: string, n: number): string {
  const [j, m, t] = d.split("-").map(Number);
  const x = new Date(Date.UTC(j, m - 1 + n, 1));
  const letzter = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), Math.min(t, letzter))).toISOString().slice(0, 10);
}

export type Stand = { personal_id: string; letzte: string | null; faellig: string | null; stufe: "rot" | "gelb" | "gruen"; digital?: boolean };
/** Per person: last participation, next due date; never instructed or overdue = red, due within 30 days = yellow. */
export function staende(u: Unterweisung, personen: PersonKurz[], teilnahmen: Teilnahme[], heute: string): Stand[] {
  const bald = plusMonate(heute, 1);
  return personen.filter((p) => p.status !== "nicht").map((p) => {
    const t = teilnahmen.filter((t) => t.unterweisung_id === u.id && t.personal_id === p.id).sort((a, b) => a.datum.localeCompare(b.datum)).at(-1);
    const letzte = t?.datum ?? null;
    const faellig = letzte ? plusMonate(letzte, u.intervall_monate) : null;
    return { personal_id: p.id, letzte, faellig, stufe: !faellig || faellig < heute ? "rot" : faellig <= bald ? "gelb" : "gruen", digital: !!t?.digital };
  });
}

const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE");

export function unterweisungenSeite(liste: Unterweisung[], personen: PersonKurz[], teilnahmen: Teilnahme[], o: { heute: string; darfAendern: boolean; offen?: string }): string {
  const name = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "?"; };
  const karte = (u: Unterweisung) => {
    const st = staende(u, personen, teilnahmen, o.heute).sort((a, b) => ({ rot: 0, gelb: 1, gruen: 2 }[a.stufe] - { rot: 0, gelb: 1, gruen: 2 }[b.stufe]) || name(a.personal_id).localeCompare(name(b.personal_id), "de"));
    const rot = st.filter((x) => x.stufe === "rot").length, gelb = st.filter((x) => x.stufe === "gelb").length;
    const markieren = o.darfAendern && st.length ? `<form method="post" action="/konto/unterweisungen" class="unterweisung-form"><input type="hidden" name="aktion" value="teilnahme"><input type="hidden" name="unterweisung" value="${u.id}">
<fieldset><legend>Wer hat teilgenommen?</legend><div class="chips">${st.map((x) => `<label><input type="checkbox" name="personal" value="${x.personal_id}"${x.stufe !== "gruen" ? " checked" : ""}><span>${escape(name(x.personal_id))}</span></label>`).join("")}</div></fieldset>
<div class="zwei"><label>Datum<input type="date" name="datum" value="${o.heute}" required></label><button>Als unterwiesen eintragen</button></div></form>` : "";
    return `<details class="unterweisung-karte"${o.offen === u.id || rot ? " open" : ""}><summary><strong>${escape(u.titel)}</strong><span class="klein">alle ${u.intervall_monate} Monate · ${rot ? `⚠️ ${rot} fällig` : "✅ alle aktuell"}${gelb ? ` · ⏳ ${gelb} bald` : ""}</span></summary>
${u.beschreibung ? `<details class="unterweisung-inhalt"><summary class="klein">Inhalt anzeigen</summary><p class="klein">${escape(u.beschreibung).replace(/\n/g, "<br>")}</p></details>` : ""}
<ul class="unterweisung-liste">${st.map((x) => `<li class="${x.stufe}"><span>${escape(name(x.personal_id))}</span><span class="klein">${x.letzte ? `zuletzt ${datum(x.letzte)}${x.digital ? ' <span title="Im Handy selbst bestätigt">📱</span>' : ""} · ${x.stufe === "rot" ? "fällig seit" : "fällig"} ${datum(x.faellig!)}` : "noch nie unterwiesen"}</span></li>`).join("")}</ul>
${markieren}${o.darfAendern ? `<form method="post" action="/konto/unterweisungen" class="termin-weg"><input type="hidden" name="aktion" value="loeschen"><input type="hidden" name="unterweisung" value="${u.id}"><button class="zweit">Unterweisung entfernen</button></form>` : ""}</details>`;
  };
  const neu = o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Unterweisung anlegen</summary><form method="post" action="/konto/unterweisungen"><input type="hidden" name="aktion" value="neu"><div class="aueg-form">
<label class="ganz">Thema<input name="titel" required maxlength="120" list="unterweisung-vorlagen"></label><datalist id="unterweisung-vorlagen">${VORLAGEN.map(([t]) => `<option value="${t}">`).join("")}</datalist>
<label>Alle … Monate<input name="intervall" type="number" min="1" max="60" value="12" required></label><label class="ganz">Inhalt (freiwillig; Einsatzkräfte lesen ihn im Handy und bestätigen)<textarea name="beschreibung" maxlength="4000" rows="3"></textarea></label></div><button>Anlegen</button></form>
${!liste.length ? `<form method="post" action="/konto/unterweisungen"><input type="hidden" name="aktion" value="vorlagen"><button class="zweit">Die üblichen 3 anlegen (Arbeitsschutz, Hygiene, Brandschutz)</button></form>` : ""}</details>` : "";
  const faelligGesamt = liste.reduce((s, u) => s + staende(u, personen, teilnahmen, o.heute).filter((x) => x.stufe === "rot").length, 0);
  return `<p class="klein">Wiederkehrende Unterweisungen der Einsatzkräfte. Jarvis zeigt, wer fällig ist; nach einer Unterweisung alle Teilnehmenden auf einmal eintragen. Personen mit Status „nicht verfügbar“ sind ausgenommen.</p>
${liste.length ? `<p class="${faelligGesamt ? "hinweis" : "klein"}">${faelligGesamt ? `⚠️ ${faelligGesamt} offene Unterweisungen` : "✅ Alle Unterweisungen aktuell."}</p>${liste.map(karte).join("")}` : `<p class="treffer-leer">Noch keine Unterweisungen angelegt.</p>`}${neu}`;
}

export async function unterweisungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/unterweisungen") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Unterweisungen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Unterweisungen sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string, offen = "") => weiterleiten(`/konto/unterweisungen?hinweis=${encodeURIComponent(h)}${offen ? `&offen=${offen}` : ""}`, f.s.cookies);
    if (!darfAendern) return zurueck("Eintragen dürfen Bearbeiter, Standortleitungen und Admins.");
    const aktion = String(form.get("aktion") ?? ""), uid = String(form.get("unterweisung") ?? "");
    const uuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);
    if (aktion === "neu" || aktion === "vorlagen") {
      const zeilen = aktion === "vorlagen" ? VORLAGEN.slice(0, 3).map(([titel, m]) => ({ firma_id: firma, titel, intervall_monate: m })) : [{ firma_id: firma, titel: String(form.get("titel") ?? "").trim().slice(0, 120), intervall_monate: Math.min(60, Math.max(1, Math.round(Number(form.get("intervall")) || 12))), beschreibung: String(form.get("beschreibung") ?? "").trim().slice(0, 4000) }];
      if (zeilen.some((z) => z.titel.length < 2)) return zurueck("Bitte ein Thema angeben.");
      const r = await db(f.s, env, "unterweisungen", { method: "POST", body: JSON.stringify(zeilen) });
      return zurueck(r.ok ? "Angelegt." : "Anlegen hat nicht geklappt.");
    }
    if (aktion === "teilnahme" && uuid(uid)) {
      const d = String(form.get("datum") ?? ""), leute = form.getAll("personal").map(String).filter(uuid).slice(0, 2000);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > heute || !leute.length) return zurueck("Bitte Personen und ein Datum (nicht in der Zukunft) wählen.", uid);
      const r = await db(f.s, env, "unterweisung_teilnahmen?on_conflict=unterweisung_id,personal_id,datum", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(leute.map((p) => ({ firma_id: firma, unterweisung_id: uid, personal_id: p, datum: d }))) });
      return zurueck(r.ok ? `${leute.length} ${leute.length === 1 ? "Person" : "Personen"} eingetragen.` : "Eintragen hat nicht geklappt. Hast du Rechte für die Standorte dieser Personen?", uid);
    }
    if (aktion === "loeschen" && uuid(uid)) {
      const r = await db(f.s, env, `unterweisungen?id=eq.${uid}&firma_id=eq.${firma}`, { method: "DELETE" });
      return zurueck(r.ok ? "Unterweisung entfernt." : "Entfernen hat nicht geklappt.");
    }
    return zurueck("Das ging nicht.");
  }
  const [u, p, t] = await Promise.all([
    db<Unterweisung[]>(f.s, env, `unterweisungen?firma_id=eq.${firma}&select=id,titel,intervall_monate,beschreibung&order=titel`),
    db<PersonKurz[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&order=vorname&limit=3000`),
    db<Teilnahme[]>(f.s, env, `unterweisung_teilnahmen?firma_id=eq.${firma}&select=unterweisung_id,personal_id,datum,digital&limit=20000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${unterweisungenSeite(u.ok ? u.daten : [], p.ok ? p.daten : [], t.ok ? t.daten : [], { heute, darfAendern, offen: url.searchParams.get("offen") ?? "" })}`);
}
