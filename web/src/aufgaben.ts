// T13: Aufgaben im Team. To-dos with a responsible person and due date, optionally for a tender (also shown there).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Aufgabe = { id: string; vorgang_id: string | null; titel: string; zustaendig_id: string | null; faellig: string | null; erledigt: string | null; vorgaenge?: { titel: string } | null };
type Person = { user_id: string; anzeigename: string | null; funktion: string | null; rolle: string; aktiv: boolean };
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

export function stufe(a: Aufgabe, heute: string): "erledigt" | "rot" | "gelb" | "offen" {
  if (a.erledigt) return "erledigt";
  if (!a.faellig) return "offen";
  const morgen = new Date(`${heute}T12:00:00Z`); morgen.setUTCDate(morgen.getUTCDate() + 2);
  return a.faellig < heute ? "rot" : a.faellig <= morgen.toISOString().slice(0, 10) ? "gelb" : "offen";
}

export function sortieren(liste: Aufgabe[]): Aufgabe[] {
  return [...liste].sort((a, b) => Number(!!a.erledigt) - Number(!!b.erledigt) || (a.faellig ?? "9999").localeCompare(b.faellig ?? "9999") || a.titel.localeCompare(b.titel, "de"));
}

/** List of tasks with tick-off and delete; `zurueck` is the page to return to. */
export function aufgabenListe(liste: Aufgabe[], namen: Record<string, string>, o: { heute: string; darfAendern: boolean; ich: string; zurueck: string; mitVorgang: boolean }): string {
  if (!liste.length) return "";
  return `<ul class="aufgaben-liste">${sortieren(liste).map((a) => {
    const st = stufe(a, o.heute);
    const darf = o.darfAendern || a.zustaendig_id === o.ich;
    return `<li class="aufgabe ${st}">${darf ? `<form method="post" action="/konto/aufgaben"><input type="hidden" name="id" value="${a.id}"><input type="hidden" name="zurueck" value="${escape(o.zurueck)}"><button name="aktion" value="${a.erledigt ? "offen" : "erledigt"}" class="aufgabe-haken" aria-label="${a.erledigt ? "Wieder öffnen" : "Erledigt"}">${a.erledigt ? "☑" : "☐"}</button></form>` : `<span class="aufgabe-haken">${a.erledigt ? "☑" : "☐"}</span>`}
<div><span class="aufgabe-titel">${escape(a.titel)}</span><span class="klein">${[a.zustaendig_id ? `👤 ${escape(namen[a.zustaendig_id] ?? "?")}` : "niemand zugeordnet", a.faellig ? `${st === "rot" ? "⚠️ überfällig seit" : "fällig"} ${datum(a.faellig)}` : "", o.mitVorgang && a.vorgang_id ? `<a href="/konto/vorgang/${a.vorgang_id}">📋 ${escape(a.vorgaenge?.titel ?? "Ausschreibung")}</a>` : ""].filter(Boolean).join(" · ")}</span></div>
${o.darfAendern ? `<form method="post" action="/konto/aufgaben"><input type="hidden" name="id" value="${a.id}"><input type="hidden" name="zurueck" value="${escape(o.zurueck)}"><button name="aktion" value="loeschen" class="zweit" aria-label="Aufgabe löschen">✕</button></form>` : ""}</li>`;
  }).join("")}</ul>`;
}

export function aufgabeForm(personen: Person[], o: { vorgang?: string; zurueck: string; ich: string; vorgaenge?: { id: string; titel: string }[] }): string {
  const leute = personen.filter((p) => p.aktiv && p.rolle !== "mitarbeiter");
  return `<form method="post" action="/konto/aufgaben" class="aufgabe-neu"><input type="hidden" name="aktion" value="neu"><input type="hidden" name="zurueck" value="${escape(o.zurueck)}">${o.vorgang ? `<input type="hidden" name="vorgang" value="${o.vorgang}">` : ""}<div class="aueg-form">
<label class="ganz">Aufgabe<input name="titel" required maxlength="300" placeholder="z. B. Preisblatt ausfüllen"></label>
<label>Wer?<select name="zustaendig"><option value="">niemand</option>${leute.map((p) => `<option value="${p.user_id}"${p.user_id === o.ich ? " selected" : ""}>${escape(p.anzeigename || p.funktion || "Ohne Namen")}</option>`).join("")}</select></label>
<label>Bis wann?<input type="date" name="faellig"></label>
${o.vorgaenge?.length ? `<label class="ganz">Zur Ausschreibung (freiwillig)<select name="vorgang"><option value="">keine</option>${o.vorgaenge.slice(0, 80).map((v) => `<option value="${v.id}">${escape(v.titel.length > 70 ? `${v.titel.slice(0, 67)}…` : v.titel)}</option>`).join("")}</select></label>` : ""}</div><button>Aufgabe anlegen</button></form>`;
}

/** Section on the tender page. */
export async function aufgabenTeil(s: Sitzung, env: KontoEnv, v: { id: string; firma_id: string }, rolle: string, heute: string): Promise<string> {
  if (rolle === "mitarbeiter") return "";
  const [a, p] = await Promise.all([
    db<Aufgabe[]>(s, env, `aufgaben?vorgang_id=eq.${v.id}&select=id,vorgang_id,titel,zustaendig_id,faellig,erledigt&order=erstellt&limit=100`),
    db<Person[]>(s, env, `mitglieder?firma_id=eq.${v.firma_id}&select=user_id,anzeigename,funktion,rolle,aktiv`),
  ]);
  const liste = a.ok ? a.daten : [], personen = p.ok ? p.daten : [];
  const namen = Object.fromEntries(personen.map((x) => [x.user_id, x.anzeigename || x.funktion || "Ohne Namen"]));
  const darf = !["leser", "mitarbeiter"].includes(rolle);
  const offen = liste.filter((x) => !x.erledigt).length;
  return `<h2 id="aufgaben">✅ Aufgaben <span class="klein">${liste.length ? `${offen} offen` : ""}</span></h2>${aufgabenListe(liste, namen, { heute, darfAendern: darf, ich: s.userId, zurueck: `/konto/vorgang/${v.id}#aufgaben`, mitVorgang: false })}${darf ? `<details class="termin-neu"${liste.length ? "" : ""}><summary>➕ Aufgabe</summary>${aufgabeForm(personen, { vorgang: v.id, zurueck: `/konto/vorgang/${v.id}#aufgaben`, ich: s.userId })}</details>` : ""}`;
}

export async function aufgaben(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/aufgaben") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Aufgaben", t, 0, "treffer"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Aufgaben sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darf = !["leser", "mitarbeiter"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const roh = String(form.get("zurueck") ?? "");
    const ziel = /^\/konto\/(aufgaben(\?[\w=&-]*)?|vorgang\/[0-9a-f-]{36}#aufgaben)$/.test(roh) ? roh : "/konto/aufgaben";
    const zurueck = (h: string) => weiterleiten(ziel.includes("#") ? ziel.replace("#", `?hinweis=${encodeURIComponent(h)}#`) : `${ziel}${ziel.includes("?") ? "&" : "?"}hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const uuid = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    const aktion = String(form.get("aktion") ?? "");
    if (aktion === "neu") {
      if (!darf) return zurueck("Aufgaben anlegen dürfen Bearbeiter und Admins.");
      const titel = String(form.get("titel") ?? "").replace(/\s+/g, " ").trim().slice(0, 300), faellig = String(form.get("faellig") ?? "");
      if (titel.length < 2) return zurueck("Bitte die Aufgabe beschreiben.");
      const r = await db(f.s, env, "aufgaben", { method: "POST", body: JSON.stringify({ firma_id: firma, titel, zustaendig_id: uuid("zustaendig") || null, faellig: /^\d{4}-\d{2}-\d{2}$/.test(faellig) ? faellig : null, vorgang_id: uuid("vorgang") || null }) });
      return zurueck(r.ok ? "Aufgabe angelegt." : "Anlegen hat nicht geklappt.");
    }
    if (!uuid("id") || (aktion === "loeschen" && !darf)) return zurueck("Das ging nicht.");
    const pfad = `aufgaben?id=eq.${uuid("id")}&firma_id=eq.${firma}`;
    const r = aktion === "loeschen" ? await db(f.s, env, pfad, { method: "DELETE" })
      : await db(f.s, env, pfad, { method: "PATCH", body: JSON.stringify({ erledigt: aktion === "erledigt" ? new Date().toISOString() : null }) });
    return zurueck(!r.ok ? "Das hat nicht geklappt." : aktion === "loeschen" ? "Aufgabe gelöscht." : aktion === "erledigt" ? "Erledigt. 👍" : "Wieder offen.");
  }
  const ansicht = ["meine", "alle", "erledigt"].includes(url.searchParams.get("ansicht") ?? "") ? url.searchParams.get("ansicht")! : "meine";
  const fuer = /^[0-9a-f-]{36}$/.test(url.searchParams.get("fuer") ?? "") ? url.searchParams.get("fuer")! : "";
  const [a, p, v] = await Promise.all([
    db<Aufgabe[]>(f.s, env, `aufgaben?firma_id=eq.${firma}${ansicht === "erledigt" ? "&erledigt=not.is.null&order=erledigt.desc" : "&erledigt=is.null&order=faellig.nullslast"}${fuer ? `&zustaendig_id=eq.${fuer}` : ansicht === "meine" ? `&zustaendig_id=eq.${f.s.userId}` : ""}&select=id,vorgang_id,titel,zustaendig_id,faellig,erledigt,vorgaenge(titel)&limit=300`),
    db<Person[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,anzeigename,funktion,rolle,aktiv`),
    darf ? db<{ id: string; titel: string }[]>(f.s, env, `vorgaenge?firma_id=eq.${firma}&status=in.(neu,pruefen,angebot,abgegeben,gewonnen)&select=id,titel&order=erstellt.desc&limit=80`) : Promise.resolve({ ok: true as const, daten: [] }),
  ]);
  const personen = p.ok ? p.daten : [];
  const namen = Object.fromEntries(personen.map((x) => [x.user_id, x.anzeigename || x.funktion || "Ohne Namen"]));
  const liste = a.ok ? a.daten : [];
  const chips = `<nav class="ordner-chips" aria-label="Ansicht">${[["meine", "Meine"], ["alle", "Alle offenen"], ["erledigt", "Erledigt"]].map(([k, t]) => `<a href="/konto/aufgaben?ansicht=${k}"${k === ansicht && !fuer ? ' aria-current="true"' : ""}>${t}</a>`).join("")}${fuer ? `<a href="/konto/aufgaben?fuer=${fuer}" aria-current="true">🔁 ${escape(namen[fuer] ?? "Vertretung")}</a>` : ""}</nav>`;
  const hinweis = url.searchParams.get("hinweis");
  const zurueck = `/konto/aufgaben?${fuer ? `fuer=${fuer}` : `ansicht=${ansicht}`}`;
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${chips}${aufgabenListe(liste, namen, { heute, darfAendern: darf, ich: f.s.userId, zurueck, mitVorgang: true }) || `<p class="treffer-leer">${ansicht === "erledigt" ? "Noch nichts erledigt." : "Keine offenen Aufgaben. 🎉"}</p>`}${darf ? `<details class="termin-neu"><summary>➕ Aufgabe anlegen</summary>${aufgabeForm(personen, { zurueck, ich: f.s.userId, vorgaenge: v.ok ? v.daten : [] })}</details>` : ""}<p class="klein">Aufgaben zu einer Ausschreibung stehen auch dort. Überfällige sind rot, fällige in 2 Tagen gelb.</p>`);
}
