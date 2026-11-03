// Removing all stored files of deleted firms (R2), used by the own account deletion and by the operator page
// /konto/betreiber (look up a customer login by e-mail and delete it, optionally with the firms it owns alone; list all
// firms and set their AI limit and plan without SQL).
import { db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

/** Every R2 folder that belongs to one firm (see the places that write files). */
export const FIRMEN_ORDNER = ["bibliothek", "personal-fotos", "importe", "angebotsabgaben", "personal_nachweise", "spesen", "unterschriften", "nachweis", "bewerber", "belege", "rechnungen"];

async function ordnerLeeren(env: KontoEnv, praefix: string): Promise<number> {
  let n = 0;
  for (let runde = 0; runde < 50; runde++) {
    const liste = await env.DATEN!.list({ prefix: praefix });
    if (!liste.objects.length) break;
    await env.DATEN!.delete(liste.objects.map((o) => o.key));
    n += liste.objects.length;
    if (!liste.truncated && liste.objects.length < 1000) break;
  }
  return n;
}

/** Deletes the files of the given firms and of their tenders' document checks. Returns the number of files. */
export async function dateienLoeschen(env: KontoEnv, firmen: string[], vorgaenge: string[]): Promise<number> {
  if (!env.DATEN) return 0;
  const id = /^[0-9a-f-]{36}$/;
  let n = 0;
  for (const firma of firmen.filter((f) => id.test(f))) {
    for (const ordner of FIRMEN_ORDNER) n += await ordnerLeeren(env, `${ordner}/${firma}/`);
    n += await ordnerLeeren(env, `kunden/firma-${firma}/`);
    await env.DATEN.delete(`firmenlogo/${firma}`);
  }
  for (const v of vorgaenge.filter((x) => id.test(x))) {
    const verweis = await env.DATEN.get(`auftraege/vorgaenge/${v}.json`);
    const auftrag = verweis ? ((await verweis.json().catch(() => ({}))) as { auftrag?: string }).auftrag : undefined;
    if (auftrag && id.test(auftrag)) n += await ordnerLeeren(env, `auftraege/${auftrag}/`);
    if (verweis) { await env.DATEN.delete(`auftraege/vorgaenge/${v}.json`); n++; }
  }
  return n;
}

/** Firms in which only this login is a member (they disappear with the account) and their tenders. */
export async function eigeneFirmen(s: Parameters<typeof db>[0], env: KontoEnv): Promise<{ firmen: string[]; vorgaenge: string[] }> {
  const m = await db<{ firma_id: string }[]>(s, env, `mitglieder?user_id=eq.${s.userId}&select=firma_id`);
  const firmen: string[] = [];
  for (const { firma_id } of m.ok ? m.daten : []) {
    const alle = await db<{ user_id: string }[]>(s, env, `mitglieder?firma_id=eq.${firma_id}&select=user_id&limit=2`);
    if (alle.ok && alle.daten.length === 1) firmen.push(firma_id);
  }
  const v = firmen.length ? await db<{ id: string }[]>(s, env, `vorgaenge?firma_id=in.(${firmen.join(",")})&select=id&limit=10000`) : null;
  return { firmen, vorgaenge: v?.ok ? v.daten.map((x) => x.id) : [] };
}

type Treffer = { user_id: string; email: string; firma_id: string | null; firma: string | null; rolle: string | null; mitglieder: number | null; allein_inhaber: boolean | null };

export function betreiberSeite(mail: string, treffer: Treffer[] | null, hinweis = ""): string {
  const suche = `<form method="get" action="/konto/betreiber" class="zeile-form"><label>E-Mail-Adresse des Kunden<input type="email" name="mail" required value="${escape(mail)}"></label><button>Suchen</button></form>`;
  if (!treffer) return `${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}<p>Nur für dich als Betreiber: einen Kundenzugang samt Daten und Dateien löschen.</p>${suche}`;
  if (!treffer.length) return `${suche}<p class="treffer-leer">Kein Zugang mit dieser Adresse.</p>`;
  const firmen = treffer.filter((t) => t.firma_id);
  const team = firmen.filter((t) => t.allein_inhaber && (t.mitglieder ?? 0) > 1);
  return `${suche}<h2>${escape(treffer[0].email)}</h2>
${firmen.length ? `<ul class="kontakt-liste">${firmen.map((t) => `<li><div><strong>${escape(t.firma ?? "")}</strong><span class="klein">${escape(t.rolle ?? "")} · ${t.mitglieder} ${t.mitglieder === 1 ? "Mitglied" : "Mitglieder"}${(t.mitglieder ?? 0) === 1 ? " · wird mit gelöscht" : t.allein_inhaber ? " · einziger Inhaber" : " · bleibt bestehen"}</span></div></li>`).join("")}</ul>` : `<p class="klein">Keine Firma.</p>`}
<form method="post" action="/konto/betreiber" class="loeschen-form"><input type="hidden" name="mail" value="${escape(treffer[0].email)}">
${team.length ? `<label class="zeile"><input type="checkbox" name="firmen_mit">Auch die Firmen löschen, deren einziger Inhaber er ist (${team.map((t) => escape(t.firma ?? "")).join(", ")}), mit allen Daten. Die anderen Mitglieder verlieren dann den Zugang.</label>` : ""}
<label>Zur Bestätigung die E-Mail-Adresse noch einmal eintippen<input name="bestaetigung" required autocomplete="off"></label>
<button class="gefahr-voll">Zugang endgültig löschen</button>
<p class="klein">Löscht den Zugang sofort und endgültig, dazu Firmen, in denen er allein ist, mit allen Daten und Dateien (Unterlagen, Fotos, Belege, Unterschriften, Bewerbungen, Nachweise). Nicht rückgängig zu machen.</p></form>`;
}

export type BetreiberFirma = { id: string; name: string; erstellt: string; website: string; paket: string; ki_budget_usd: number | null; ki_verbraucht: number; mitglieder: number; inhaber: string | null; letzte_anmeldung: string | null };

export const PAKETE = ["kostenlos", "test", "basis", "pro", "erfolg"];
/** AI limit choices on the operator page: "" = no limit (null), otherwise USD. */
export const KI_STUFEN: [string, string][] = [["", "ohne Grenze"], ["5.5", "Probe 5,50 $"], ["20", "20 $"], ["0", "Demo, keine KI"]];

const dollar = (x: number) => `${x.toFixed(2).replace(".", ",")} $`;
const tag = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "nie";

/** "1,20 $ von 5,50 $", "ohne Grenze (3,00 $ verbraucht)" or "Demo, keine KI". */
export function kiStand(budget: number | null, verbraucht: number): string {
  if (budget === null) return `ohne Grenze (${dollar(verbraucht)} verbraucht)`;
  if (Number(budget) === 0) return verbraucht > 0 ? `Demo, keine KI (${dollar(verbraucht)} verbraucht)` : "Demo, keine KI";
  return `${dollar(verbraucht)} von ${dollar(Number(budget))}${verbraucht >= Number(budget) ? " · aufgebraucht" : ""}`;
}

/** Form value -> budget: "" = no limit, a number >= 0, undefined when invalid. */
export function kiWert(x: unknown): number | null | undefined {
  const t = String(x ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? Math.round(n * 100) / 100 : undefined;
}

export function firmenListe(firmen: BetreiberFirma[]): string {
  if (!firmen.length) return `<p class="klein">Noch keine Firmen.</p>`;
  return `<ul class="kontakt-liste">${firmen.map((f) => {
    const budget = f.ki_budget_usd === null ? null : Number(f.ki_budget_usd);
    const stufen = KI_STUFEN.some(([w]) => (w === "" ? budget === null : budget !== null && Number(w) === budget)) || budget === null ? KI_STUFEN : [...KI_STUFEN, [String(budget), dollar(budget)] as [string, string]];
    const kiOpt = stufen.map(([w, t]) => `<option value="${w}"${(w === "" ? budget === null : budget !== null && Number(w) === budget) ? " selected" : ""}>${escape(t)}</option>`).join("");
    const paketOpt = PAKETE.map((p) => `<option${p === f.paket ? " selected" : ""}>${p}</option>`).join("");
    return `<li id="firma-${escape(f.id)}"><div><strong>${escape(f.name)}</strong><span class="klein">${escape(f.inhaber ?? "kein Inhaber")} · ${f.mitglieder} ${f.mitglieder === 1 ? "Mitglied" : "Mitglieder"} · seit ${tag(f.erstellt)} · zuletzt angemeldet ${tag(f.letzte_anmeldung)}${f.website ? ` · ${escape(f.website)}` : ""}</span><span class="klein">Plan ${escape(f.paket)} · KI ${escape(kiStand(budget, Number(f.ki_verbraucht ?? 0)))}</span>
<form method="post" action="/konto/betreiber" class="zeile-form"><input type="hidden" name="aktion" value="firma"><input type="hidden" name="firma" value="${escape(f.id)}"><input type="hidden" name="ki_alt" value="${budget === null ? "" : budget}"><input type="hidden" name="paket_alt" value="${escape(f.paket)}">
<label>KI-Grenze<select name="ki">${kiOpt}</select></label><label>Plan<select name="paket">${paketOpt}</select></label><button>Speichern</button></form></div></li>`;
  }).join("")}</ul>`;
}

export async function betreiber(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/betreiber") return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const ist = await db<boolean>(s, env, "rpc/ist_betreiber", { method: "POST", body: "{}" });
  if (!ist.ok || ist.daten !== true) return new Response("Nicht gefunden", { status: 404 });
  const antwort = (t: string, status = 200) => { const r = html(seite("Betreiber", t, 0, ""), status, s.cookies); r.headers.set("cache-control", "private, no-store"); return r; };
  if (request.method === "POST") {
    const form = await request.formData();
    if (form.get("aktion") === "firma") {
      const firma = String(form.get("firma") ?? "");
      const ki = kiWert(form.get("ki")), kiAlt = kiWert(form.get("ki_alt"));
      const paket = String(form.get("paket") ?? ""), paketAlt = String(form.get("paket_alt") ?? "");
      if (!/^[0-9a-f-]{36}$/.test(firma) || ki === undefined || !PAKETE.includes(paket)) return weiterleiten(`/konto/betreiber?hinweis=${encodeURIComponent("Eingabe ungültig.")}`, s.cookies);
      const fehler: string[] = [];
      if (ki !== kiAlt) {
        const r = await db(s, env, "rpc/betreiber_ki_budget", { method: "POST", body: JSON.stringify({ f: firma, budget: ki }) });
        if (!r.ok) fehler.push("KI-Grenze");
      }
      if (paket !== paketAlt) {
        const r = await db(s, env, "rpc/betreiber_paket", { method: "POST", body: JSON.stringify({ f: firma, neu: paket }) });
        if (!r.ok) fehler.push("Plan");
      }
      const hinweis = fehler.length ? `${fehler.join(" und ")} nicht gespeichert.` : ki === kiAlt && paket === paketAlt ? "Nichts geändert." : "Gespeichert.";
      return weiterleiten(`/konto/betreiber?hinweis=${encodeURIComponent(hinweis)}#firma-${firma}`, s.cookies);
    }
    const mail = String(form.get("mail") ?? "").trim().toLowerCase();
    if (String(form.get("bestaetigung") ?? "").trim().toLowerCase() !== mail) return weiterleiten(`/konto/betreiber?mail=${encodeURIComponent(mail)}&hinweis=${encodeURIComponent("Die Bestätigung stimmt nicht mit der Adresse überein.")}`, s.cookies);
    const r = await db<{ firmen: string[]; vorgaenge: string[] }>(s, env, "rpc/betreiber_konto_loeschen", { method: "POST", body: JSON.stringify({ mail, firmen_mit: form.has("firmen_mit") }) });
    if (!r.ok) {
      const grund = /LETZTER_INHABER/.test(r.fehler) ? "Er ist einziger Inhaber einer Firma mit weiteren Mitgliedern. Haken „Auch die Firmen löschen“ setzen oder vorher einen anderen Inhaber bestimmen." : /EIGENES_KONTO/.test(r.fehler) ? "Das eigene Konto bitte unter Mein Profil löschen." : /NICHT_GEFUNDEN/.test(r.fehler) ? "Kein Zugang mit dieser Adresse." : "Löschen hat nicht geklappt.";
      return weiterleiten(`/konto/betreiber?mail=${encodeURIComponent(mail)}&hinweis=${encodeURIComponent(grund)}`, s.cookies);
    }
    const n = await dateienLoeschen(env, r.daten.firmen ?? [], r.daten.vorgaenge ?? []);
    return antwort(betreiberSeite("", null, `${mail} ist gelöscht${r.daten.firmen?.length ? `, dazu ${r.daten.firmen.length} ${r.daten.firmen.length === 1 ? "Firma" : "Firmen"}` : ""} und ${n} ${n === 1 ? "Datei" : "Dateien"}.`));
  }
  const mail = url.searchParams.get("mail")?.trim() ?? "";
  const hinweis = url.searchParams.get("hinweis") ?? "";
  let loeschen = betreiberSeite("", null, hinweis);
  if (mail) {
    const t = await db<Treffer[]>(s, env, "rpc/betreiber_konto_suchen", { method: "POST", body: JSON.stringify({ mail }) });
    loeschen = `${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}${betreiberSeite(mail, t.ok ? t.daten : [])}`;
  }
  const f = await db<BetreiberFirma[]>(s, env, "rpc/betreiber_firmen", { method: "POST", body: "{}" });
  return antwort(`<h2>Zugang löschen</h2>${loeschen}<h2>Firmen${f.ok ? ` (${f.daten.length})` : ""}</h2><p class="klein">KI-Grenze: „ohne Grenze“ für zahlende Kunden und Tester, „Probe 5,50 $“ für neue Firmen mit eigener Website, „Demo“ ohne KI. Der Plan wird später von der Abrechnung gesetzt.</p>${f.ok ? firmenListe(f.daten) : `<p class="hinweis">Firmenliste konnte nicht geladen werden.</p>`}`);
}
