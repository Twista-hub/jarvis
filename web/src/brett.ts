// T19: Schwarzes Brett. Notices from the office to everyone or one location, with read confirmation: the office sees
// who has not read a notice yet. New notices also go out as phone notification (queue, alarm/mail.py).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Mitteilung = { id: string; bereich_id: string | null; titel: string; text: string; gueltig_bis: string | null; erstellt_von: string | null; erstellt: string };
export type Gelesen = { mitteilung_id: string; user_id: string; gelesen: string };
type Mitglied = { user_id: string; rolle: string; anzeigename: string | null; funktion: string | null; aktiv: boolean };
type Bereich = { id: string; name: string; parent_id: string | null };
const datum = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

/** Is area b the area ziel or below it? */
export function imBereich(bereiche: Bereich[], b: string | null, ziel: string): boolean {
  const gesehen = new Set<string>();
  for (let x = b; x && !gesehen.has(x); x = bereiche.find((y) => y.id === x)?.parent_id ?? null) { if (x === ziel) return true; gesehen.add(x); }
  return false;
}

/** Who should read a notice (same rule as the database and the phone notification): active members except the author;
 *  for a location, staff only when their personnel record is there. */
export function empfaenger(m: Pick<Mitteilung, "bereich_id" | "erstellt_von">, mitglieder: Mitglied[], personal: { user_id: string | null; bereich_id: string | null }[], bereiche: Bereich[]): Mitglied[] {
  return mitglieder.filter((x) => x.aktiv && x.user_id !== m.erstellt_von && (!m.bereich_id || x.rolle !== "mitarbeiter"
    || personal.some((p) => p.user_id === x.user_id && imBereich(bereiche, p.bereich_id, m.bereich_id!))));
}

export function brettSeite(liste: Mitteilung[], o: { ich: string; buero: boolean; darfSchreiben: boolean; admin: boolean; gelesen: Gelesen[]; mitglieder: Mitglied[]; personal: { user_id: string | null; bereich_id: string | null }[]; bereiche: Bereich[]; heute: string }): string {
  const name = (id: string | null) => { const m = o.mitglieder.find((x) => x.user_id === id); return m ? m.anzeigename || m.funktion || "Ohne Namen" : "Büro"; };
  const karte = (m: Mitteilung) => {
    const ichGelesen = m.erstellt_von === o.ich || o.gelesen.some((g) => g.mitteilung_id === m.id && g.user_id === o.ich);
    const emp = o.buero ? empfaenger(m, o.mitglieder, o.personal, o.bereiche) : [];
    const offen = emp.filter((e) => !o.gelesen.some((g) => g.mitteilung_id === m.id && g.user_id === e.user_id));
    return `<article class="mitteilung${ichGelesen ? "" : " neu"}"><h3>📌 ${escape(m.titel)}</h3><p class="klein">${escape(name(m.erstellt_von))} · ${datum(m.erstellt)} · ${m.bereich_id ? `📍 ${escape(o.bereiche.find((b) => b.id === m.bereich_id)?.name ?? "Standort")}` : "für alle"}${m.gueltig_bis ? ` · bis ${datum(m.gueltig_bis)}` : ""}</p>
${m.text ? `<p>${escape(m.text).replace(/\n/g, "<br>")}</p>` : ""}<div class="mitteilung-fuss">${ichGelesen ? `<span class="klein">✓ gelesen</span>` : `<form method="post" action="/konto/brett"><input type="hidden" name="gelesen" value="${m.id}"><button>✓ Gelesen</button></form>`}
${o.buero && emp.length ? `<details class="gelesen-liste"><summary class="klein">👁 ${emp.length - offen.length} von ${emp.length} gelesen</summary>${offen.length ? `<p class="klein">Noch nicht gelesen: ${offen.map((e) => escape(e.anzeigename || e.funktion || "Ohne Namen")).join(", ")}</p>` : `<p class="klein">Alle haben gelesen.</p>`}</details>` : ""}
${m.erstellt_von === o.ich || o.admin ? `<form method="post" action="/konto/brett"><input type="hidden" name="loeschen" value="${m.id}"><button class="zweit" aria-label="Mitteilung löschen">✕</button></form>` : ""}</div></article>`;
  };
  const form = o.darfSchreiben ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Mitteilung schreiben</summary><form method="post" action="/konto/brett"><input type="hidden" name="aktion" value="neu"><div class="aueg-form">
<label class="ganz">Titel<input name="titel" required maxlength="120" placeholder="z. B. Betriebsversammlung am Freitag"></label>
<label class="ganz">Text<textarea name="text" maxlength="2000" rows="4"></textarea></label>
<label>Für<select name="bereich"><option value="">alle</option>${o.bereiche.map((b) => `<option value="${b.id}">📍 ${escape(b.name)}</option>`).join("")}</select></label><label>Anzeigen bis (freiwillig)<input type="date" name="gueltig_bis" min="${o.heute}"></label></div><button>Veröffentlichen</button><p class="klein">Alle Empfänger bekommen eine Handy-Nachricht (wenn eingeschaltet, innerhalb einer Stunde zwischen 6 und 21 Uhr).</p></form></details>` : "";
  return `${form}${liste.length ? liste.map(karte).join("") : `<p class="treffer-leer">Keine aktuellen Mitteilungen.</p>`}`;
}

/** Number of unread notices for the overview banner. */
export async function ungelesen(s: Sitzung, env: KontoEnv, firma: string, heute: string): Promise<number> {
  const [m, g] = await Promise.all([
    db<{ id: string; erstellt_von: string | null }[]>(s, env, `mitteilungen?firma_id=eq.${firma}&or=(gueltig_bis.is.null,gueltig_bis.gte.${heute})&erstellt=gte.${new Date(Date.now() - 60 * 86400_000).toISOString()}&select=id,erstellt_von&limit=100`),
    db<{ mitteilung_id: string }[]>(s, env, `mitteilung_gelesen?firma_id=eq.${firma}&user_id=eq.${s.userId}&select=mitteilung_id&limit=1000`),
  ]);
  const gelesen = new Set((g.ok ? g.daten : []).map((x) => x.mitteilung_id));
  return (m.ok ? m.daten : []).filter((x) => x.erstellt_von !== s.userId && !gelesen.has(x.id)).length;
}

export async function brett(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/brett") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  const buero = f.m.rolle !== "mitarbeiter";
  const darfSchreiben = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const antwort = (t: string, status = 200) => html(seite("Schwarzes Brett", `<p class="konto-zurueck"><a href="${buero ? "/konto/team" : "/konto"}" aria-label="Zurück">←</a></p>${t}`, 0, buero ? "team" : ""), status, f.s.cookies);
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/brett?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const id = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    if (id("gelesen")) {
      await db(f.s, env, "mitteilung_gelesen?on_conflict=mitteilung_id,user_id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ mitteilung_id: id("gelesen"), firma_id: firma }) });
      return weiterleiten("/konto/brett", f.s.cookies);
    }
    if (id("loeschen")) {
      const r = await db<{ id: string }[]>(f.s, env, `mitteilungen?id=eq.${id("loeschen")}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return zurueck(r.ok && r.daten.length ? "Mitteilung gelöscht." : "Löschen hat nicht geklappt.");
    }
    if (!darfSchreiben) return zurueck("Mitteilungen schreibt das Büroteam.");
    const t = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
    const bis = t("gueltig_bis", 10);
    const zeile = { firma_id: firma, erstellt_von: f.s.userId, titel: t("titel", 120).replace(/\s+/g, " "), text: t("text", 2000).replace(/\r\n/g, "\n"), bereich_id: id("bereich") || null, gueltig_bis: /^\d{4}-\d{2}-\d{2}$/.test(bis) && bis >= heute ? bis : null };
    if (zeile.titel.length < 2) return zurueck("Bitte einen Titel angeben.");
    const r = await db(f.s, env, "mitteilungen", { method: "POST", body: JSON.stringify(zeile) });
    return zurueck(r.ok ? "Mitteilung veröffentlicht." : f.m.rolle === "standortleitung" ? "Standortleitungen schreiben nur für ihren eigenen Standort." : "Veröffentlichen hat nicht geklappt.");
  }
  const [m, g, mg, p, b] = await Promise.all([
    db<Mitteilung[]>(f.s, env, `mitteilungen?firma_id=eq.${firma}&or=(gueltig_bis.is.null,gueltig_bis.gte.${heute})&select=id,bereich_id,titel,text,gueltig_bis,erstellt_von,erstellt&order=erstellt.desc&limit=50`),
    db<Gelesen[]>(f.s, env, `mitteilung_gelesen?firma_id=eq.${firma}&select=mitteilung_id,user_id,gelesen&limit=20000`),
    db<Mitglied[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,rolle,anzeigename,funktion,aktiv`),
    buero ? db<{ user_id: string | null; bereich_id: string | null }[]>(f.s, env, `personal?firma_id=eq.${firma}&user_id=not.is.null&select=user_id,bereich_id&limit=3000`) : Promise.resolve(null),
    db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name,parent_id&order=name`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${brettSeite(m.ok ? m.daten : [], { ich: f.s.userId, buero, darfSchreiben, admin: f.admin, gelesen: g.ok ? g.daten : [], mitglieder: mg.ok ? mg.daten : [], personal: p?.ok ? p.daten : [], bereiche: b.ok ? b.daten : [], heute })}`);
}
