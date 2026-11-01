// Removing all stored files of deleted firms (R2), used by the own account deletion and by the operator page
// /konto/betreiber (look up a customer login by e-mail and delete it, optionally with the firms it owns alone).
import { db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

/** Every R2 folder that belongs to one firm (see the places that write files). */
export const FIRMEN_ORDNER = ["bibliothek", "personal-fotos", "importe", "angebotsabgaben", "personal_nachweise", "spesen", "unterschriften", "nachweis", "bewerber"];

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

export async function betreiber(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/betreiber") return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const ist = await db<boolean>(s, env, "rpc/ist_betreiber", { method: "POST", body: "{}" });
  if (!ist.ok || ist.daten !== true) return new Response("Nicht gefunden", { status: 404 });
  const antwort = (t: string, status = 200) => { const r = html(seite("Betreiber: Zugang löschen", t, 0, ""), status, s.cookies); r.headers.set("cache-control", "private, no-store"); return r; };
  if (request.method === "POST") {
    const form = await request.formData();
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
  if (!mail) return antwort(betreiberSeite("", null, hinweis));
  const t = await db<Treffer[]>(s, env, "rpc/betreiber_konto_suchen", { method: "POST", body: JSON.stringify({ mail }) });
  return antwort(`${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}${betreiberSeite(mail, t.ok ? t.daten : [])}`);
}
