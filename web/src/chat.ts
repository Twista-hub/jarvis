// Idee 39: Team-Chat je Firma, Standort und Einsatzort (ohne Übersetzung). Who is in a room is decided by the database
// (jarvis_intern.im_chat): office by location rights, staff by their location and their shifts at a site (from 14 days
// ago on). New messages go out as phone notification (queue, alarm/mail.py); messages are deleted after 180 days.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Raum = { bereich_id: string | null; einsatzort_id: string | null; name: string; letzte: string | null; ungelesen: number };
export type Nachricht = { id: string; user_id: string | null; text: string; erstellt: string };
type Mitglied = { user_id: string; anzeigename: string | null; funktion: string | null };
const ID = /^[0-9a-f-]{36}$/;

/** Key of a room in URLs and in chat_gelesen. */
export const raumSchluessel = (r: Pick<Raum, "bereich_id" | "einsatzort_id">): string => r.bereich_id ? `b:${r.bereich_id}` : r.einsatzort_id ? `o:${r.einsatzort_id}` : "firma";
export const raumLink = (r: Pick<Raum, "bereich_id" | "einsatzort_id">): string => `/konto/chat?${r.bereich_id ? `b=${r.bereich_id}` : r.einsatzort_id ? `o=${r.einsatzort_id}` : "raum=firma"}`;
const symbol = (r: Pick<Raum, "bereich_id" | "einsatzort_id">) => r.bereich_id ? "📍" : r.einsatzort_id ? "🏢" : "👥";

const zeit = (d: string, heute: string) => {
  const t = new Date(d);
  const tag = t.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const uhr = t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return tag === heute ? uhr : `${t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })} ${uhr}`;
};

export function raumListe(raeume: Raum[], heute: string): string {
  if (!raeume.length) return `<p class="treffer-leer">Du bist noch in keinem Chat.</p>`;
  return `<div class="standort-liste">${raeume.map((r) => `<a class="standort-zeile${r.ungelesen ? " chat-neu" : ""}" href="${raumLink(r)}"><span class="standort-name">${symbol(r)} ${escape(r.name)}</span><span class="klein">${r.ungelesen ? `<strong>${r.ungelesen} neu</strong> · ` : ""}${r.letzte ? `zuletzt ${zeit(r.letzte, heute)}` : "noch keine Nachricht"}</span></a>`).join("")}</div>
<p class="klein">👥 ganze Firma · 📍 Standort · 🏢 Einsatzort. Einsatzkräfte sind im Chat ihres Standorts und der Einsatzorte, an denen sie in den letzten 14 Tagen oder demnächst eine Schicht haben. Nachrichten werden nach 180 Tagen gelöscht.</p>`;
}

export function raumSeite(raum: Pick<Raum, "bereich_id" | "einsatzort_id" | "name">, liste: Nachricht[], o: { ich: string; admin: boolean; mitglieder: Mitglied[]; heute: string }): string {
  const name = (id: string | null) => { const m = o.mitglieder.find((x) => x.user_id === id); return m ? m.anzeigename || m.funktion || "Ohne Namen" : "Ehemalige Person"; };
  const ziel = raumLink(raum);
  const blasen = liste.map((n) => {
    const eigen = n.user_id === o.ich;
    return `<div class="chat-blase${eigen ? " eigen" : ""}"><p class="klein">${eigen ? "Du" : escape(name(n.user_id))} · ${zeit(n.erstellt, o.heute)}</p><p>${escape(n.text).replace(/\n/g, "<br>")}</p>${eigen || o.admin ? `<form method="post" action="${ziel}"><input type="hidden" name="loeschen" value="${n.id}"><button class="zweit" aria-label="Nachricht löschen">✕</button></form>` : ""}</div>`;
  }).join("");
  return `<h2>${symbol(raum)} ${escape(raum.name)}</h2><p><a href="/konto/chat">← Alle Chats</a> · <a href="${ziel}">↻ Aktualisieren</a> <span class="klein">· neue Nachrichten erscheinen von selbst</span></p>
<div class="chat-verlauf" data-chat-stand="${escape(liste.at(-1)?.erstellt ?? "")}" data-chat-pruefen="${ziel.replace("/konto/chat?", "/konto/chat/stand?")}">${blasen || `<p class="treffer-leer">Noch keine Nachricht. Schreib die erste.</p>`}</div>
<form method="post" action="${ziel}" class="chat-form"><label>Nachricht<textarea name="text" required maxlength="1000" rows="3" placeholder="z. B. Treffpunkt morgen 6:45 Uhr am Eingang Süd"></textarea></label><button>Senden</button>
<p class="klein">Alle im Chat bekommen eine Handy-Nachricht (wenn eingeschaltet, innerhalb einer Stunde zwischen 6 und 21 Uhr). Bitte keine Gesundheitsangaben.</p></form>`;
}

export async function chat(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/chat" && url.pathname !== "/konto/chat/stand") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  const buero = f.m.rolle !== "mitarbeiter";
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const antwort = (t: string, status = 200) => html(seite("Team-Chat", `<p class="konto-zurueck"><a href="${buero ? "/konto/team" : "/konto"}" aria-label="Zurück">←</a></p>${t}`, 0, buero ? "team" : ""), status, f.s.cookies);
  if (f.m.rolle === "leser") return antwort(`<p class="treffer-leer">Der Team-Chat ist nur für das Team, nicht für Lesezugänge.</p>`);
  const b = ID.test(url.searchParams.get("b") ?? "") ? url.searchParams.get("b")! : null;
  const o = !b && ID.test(url.searchParams.get("o") ?? "") ? url.searchParams.get("o")! : null;
  const offen = b || o || url.searchParams.get("raum") === "firma";
  const r = await db<Raum[]>(f.s, env, "rpc/meine_chats", { method: "POST", body: JSON.stringify({ f: firma }) });
  const raeume = r.ok ? r.daten : [];
  if (!offen) {
    const hinweis = url.searchParams.get("hinweis");
    return antwort(`<h2>💬 Team-Chat</h2>${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${raumListe(raeume, heute)}`);
  }
  let raum: Pick<Raum, "bereich_id" | "einsatzort_id" | "name"> | undefined = raeume.find((x) => x.bereich_id === b && x.einsatzort_id === o);
  // A site without current shifts is not listed, but the office can still open its chat (from the customer page).
  if (!raum && o && buero) {
    const e = await db<{ name: string }[]>(f.s, env, `einsatzorte?id=eq.${o}&firma_id=eq.${firma}&select=name`);
    if (e.ok && e.daten.length) raum = { bereich_id: null, einsatzort_id: o, name: e.daten[0].name };
  }
  if (!raum) return weiterleiten(`/konto/chat?hinweis=${encodeURIComponent("Diesen Chat gibt es nicht oder du bist nicht dabei.")}`, f.s.cookies);
  const ziel = raumLink(raum);
  if (url.pathname === "/konto/chat/stand") {
    // Polled by the open chat page (app.js): time of the newest message in this room, nothing else.
    const filterStand = `firma_id=eq.${firma}&bereich_id=${raum.bereich_id ? `eq.${raum.bereich_id}` : "is.null"}&einsatzort_id=${raum.einsatzort_id ? `eq.${raum.einsatzort_id}` : "is.null"}`;
    const r = await db<{ erstellt: string }[]>(f.s, env, `chat_nachrichten?${filterStand}&select=erstellt&order=erstellt.desc&limit=1`);
    return new Response(JSON.stringify({ letzte: r.ok ? r.daten[0]?.erstellt ?? "" : "" }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (request.method === "POST") {
    const form = await request.formData();
    const loeschen = String(form.get("loeschen") ?? "");
    if (ID.test(loeschen)) {
      await db(f.s, env, `chat_nachrichten?id=eq.${loeschen}&firma_id=eq.${firma}`, { method: "DELETE" });
      return weiterleiten(ziel, f.s.cookies);
    }
    const text = String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000);
    if (text) {
      const neu = await db(f.s, env, "chat_nachrichten", { method: "POST", body: JSON.stringify({ firma_id: firma, bereich_id: raum.bereich_id, einsatzort_id: raum.einsatzort_id, user_id: f.s.userId, text }) });
      if (!neu.ok) return weiterleiten(`/konto/chat?hinweis=${encodeURIComponent("Senden hat nicht geklappt.")}`, f.s.cookies);
    }
    return weiterleiten(ziel, f.s.cookies);
  }
  const filter = `firma_id=eq.${firma}&bereich_id=${raum.bereich_id ? `eq.${raum.bereich_id}` : "is.null"}&einsatzort_id=${raum.einsatzort_id ? `eq.${raum.einsatzort_id}` : "is.null"}`;
  const [n, mg] = await Promise.all([
    db<Nachricht[]>(f.s, env, `chat_nachrichten?${filter}&select=id,user_id,text,erstellt&order=erstellt.desc&limit=100`),
    db<Mitglied[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,anzeigename,funktion`),
    db(f.s, env, "chat_gelesen?on_conflict=firma_id,user_id,raum", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, raum: raumSchluessel(raum), zuletzt: new Date().toISOString() }) }),
  ]);
  const liste = (n.ok ? n.daten : []).reverse();
  return antwort(raumSeite(raum, liste, { ich: f.s.userId, admin: f.admin, mitglieder: mg.ok ? mg.daten : [], heute }));
}

/** Unread chat messages over all rooms, for the overview tile. */
export async function chatUngelesen(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<number> {
  const r = await db<Raum[]>(s, env, "rpc/meine_chats", { method: "POST", body: JSON.stringify({ f: firma }) });
  return r.ok ? r.daten.reduce((a, x) => a + (x.ungelesen || 0), 0) : 0;
}
