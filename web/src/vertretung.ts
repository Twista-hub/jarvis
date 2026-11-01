// T12: Vertretung. Who covers for whom in which period. During the absence the absent person gets no reminders, the
// cover gets the deadlines (alarm/mail.py) and sees the absent person's tenders and tasks on the overview.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Vertretung = { id: string; user_id: string; vertreter_id: string; von: string; bis: string; notiz: string };
type Person = { user_id: string; anzeigename: string | null; funktion: string | null; rolle: string; aktiv: boolean };
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export const aktiv = (v: Pick<Vertretung, "von" | "bis">, heute: string) => v.von <= heute && v.bis >= heute;

/** Banner on the overview for the person covering today. */
export function vertretungHinweis(vertretungen: Vertretung[], ich: string, namen: Record<string, string>, heute: string, zahlen: Record<string, { vorgaenge: number; aufgaben: number }>): string {
  const meine = vertretungen.filter((v) => v.vertreter_id === ich && aktiv(v, heute));
  const selbst = vertretungen.find((v) => v.user_id === ich && aktiv(v, heute));
  return [...meine.map((v) => { const z = zahlen[v.user_id] ?? { vorgaenge: 0, aufgaben: 0 }; return `<aside class="vertretung-hinweis" role="status">🔁 Du vertrittst <strong>${escape(namen[v.user_id] ?? "jemanden")}</strong> bis ${datum(v.bis)}: <a href="/konto/aufgaben?fuer=${v.user_id}">${z.aufgaben} ${z.aufgaben === 1 ? "Aufgabe" : "Aufgaben"}</a> · ${z.vorgaenge} ${z.vorgaenge === 1 ? "Ausschreibung" : "Ausschreibungen"} in kaufmännischer Zuständigkeit. Fristen-Erinnerungen bekommst du mit.</aside>`; }),
    selbst ? `<aside class="vertretung-hinweis" role="status">🌴 Du bist bis ${datum(selbst.bis)} abwesend und wirst von <strong>${escape(namen[selbst.vertreter_id] ?? "jemandem")}</strong> vertreten. Erinnerungen bekommst du solange nicht.</aside>` : ""].join("");
}

export function vertretungSeite(liste: Vertretung[], personen: Person[], o: { ich: string; admin: boolean; heute: string }): string {
  const name = (id: string) => { const p = personen.find((x) => x.user_id === id); return p ? p.anzeigename || p.funktion || "Ohne Namen" : "?"; };
  const waehlbar = personen.filter((p) => p.aktiv && p.rolle !== "mitarbeiter");
  const zeile = (v: Vertretung) => `<li class="${aktiv(v, o.heute) ? "aktiv" : ""}"><div><strong>${escape(name(v.user_id))}</strong> → ${escape(name(v.vertreter_id))}<span class="klein">${datum(v.von)} – ${datum(v.bis)}${aktiv(v, o.heute) ? " · läuft gerade" : ""}${v.notiz ? ` · ${escape(v.notiz)}` : ""}</span></div>${v.user_id === o.ich || o.admin ? `<form method="post" action="/konto/vertretung"><input type="hidden" name="loeschen" value="${v.id}"><button class="zweit" aria-label="Vertretung löschen">✕</button></form>` : ""}</li>`;
  const form = `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Vertretung eintragen</summary><form method="post" action="/konto/vertretung"><div class="aueg-form">
<label class="ganz">Wer ist abwesend?<select name="person">${(o.admin ? waehlbar : waehlbar.filter((p) => p.user_id === o.ich)).map((p) => `<option value="${p.user_id}"${p.user_id === o.ich ? " selected" : ""}>${escape(p.anzeigename || p.funktion || "Ohne Namen")}${p.user_id === o.ich ? " (ich)" : ""}</option>`).join("")}</select></label>
<label class="ganz">Vertretung<select name="vertreter" required>${waehlbar.map((p) => `<option value="${p.user_id}"${p.user_id === waehlbar.find((x) => x.user_id !== o.ich)?.user_id ? " selected" : ""}>${escape(p.anzeigename || p.funktion || "Ohne Namen")}</option>`).join("")}</select></label>
<label>Von<input type="date" name="von" required value="${o.heute}"></label><label>Bis<input type="date" name="bis" required></label>
<label class="ganz">Notiz<input name="notiz" maxlength="300" placeholder="z. B. Urlaub, Messe"></label></div><button>Speichern</button></form></details>`;
  const kommend = liste.filter((v) => v.bis >= o.heute).sort((a, b) => a.von.localeCompare(b.von));
  return `<p class="klein">Während der Abwesenheit bekommt die abwesende Person keine Erinnerungen. Die Vertretung bekommt die Fristen-Erinnerungen (wenn sie die tägliche Nachricht eingeschaltet hat) und sieht auf der Übersicht Aufgaben und Ausschreibungen der abwesenden Person. Rechte ändern sich dadurch nicht.</p>
${kommend.length ? `<ul class="kontakt-liste vertretung-liste">${kommend.map(zeile).join("")}</ul>` : `<p class="treffer-leer">Keine laufenden oder geplanten Vertretungen.</p>`}${form}`;
}

export async function vertretungenLaden(s: Sitzung, env: KontoEnv, firma: string, heute: string): Promise<Vertretung[]> {
  const r = await db<Vertretung[]>(s, env, `vertretungen?firma_id=eq.${firma}&bis=gte.${heute}&select=id,user_id,vertreter_id,von,bis,notiz&order=von&limit=200`);
  return r.ok ? r.daten : [];
}

export async function vertretung(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/vertretung") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Vertretung", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Vertretungen trägt das Büroteam ein.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/vertretung?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const uuid = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    if (uuid("loeschen")) {
      const r = await db<{ id: string }[]>(f.s, env, `vertretungen?id=eq.${uuid("loeschen")}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return zurueck(r.ok && r.daten.length ? "Vertretung gelöscht." : "Löschen hat nicht geklappt.");
    }
    const person = uuid("person") || f.s.userId, vertreter = uuid("vertreter"), von = String(form.get("von") ?? ""), bis = String(form.get("bis") ?? "");
    const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d));
    if (!vertreter || vertreter === person || !ok(von) || !ok(bis) || bis < von) return zurueck("Bitte Vertretung und Zeitraum prüfen (nicht man selbst, Ende nicht vor dem Beginn).");
    const r = await db(f.s, env, "vertretungen", { method: "POST", body: JSON.stringify({ firma_id: firma, user_id: person, vertreter_id: vertreter, von, bis, notiz: String(form.get("notiz") ?? "").trim().slice(0, 300) }) });
    return zurueck(r.ok ? "Vertretung gespeichert." : "Speichern hat nicht geklappt. Andere Personen dürfen nur Admins eintragen.");
  }
  const [liste, personen] = await Promise.all([
    vertretungenLaden(f.s, env, firma, heute),
    db<Person[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,anzeigename,funktion,rolle,aktiv&order=anzeigename`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${vertretungSeite(liste, personen.ok ? personen.daten : [], { ich: f.s.userId, admin: f.admin, heute })}`);
}
