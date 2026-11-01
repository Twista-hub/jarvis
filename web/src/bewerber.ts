// T24: Bewerber. Applicants with job, status (new, interview, offer, rejected, hired) and documents; one click turns an
// applicant into a personnel record. Data is deleted 6 months after a rejection (30 days after hiring), when someone of the
// office opens Firma & Team or this page; the files go with it.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Bewerber = { id: string; bereich_id: string | null; vorname: string; nachname: string; email: string; telefon: string; beruf: string; quelle: string; status: string; gespraech: string | null; notiz: string; loeschen_ab: string | null; personal_id: string | null; erstellt: string };
export type Datei = { id: string; bewerber_id: string; name: string; mime: string; groesse: number };
export const STATUS: [string, string, string][] = [["neu", "🆕", "Neu"], ["gespraech", "💬", "Gespräch"], ["zusage", "✅", "Zusage"], ["eingestellt", "🎉", "Eingestellt"], ["absage", "❌", "Absage"]];
const datum = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const TYPEN = ["application/pdf", "image/png", "image/jpeg"];
const passt = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;
const schluessel = (firma: string, bewerber: string, id: string) => `bewerber/${firma}/${bewerber}/${id}`;

export function bewerberSeite(liste: Bewerber[], dateien: Datei[], o: { heute: string; bereiche: { id: string; name: string }[]; berufe: string[] }): string {
  const karte = (b: Bewerber) => {
    const d = dateien.filter((x) => x.bewerber_id === b.id);
    return `<details class="bewerber"><summary><strong>${escape(`${b.vorname} ${b.nachname}`.trim())}</strong><span class="klein">${escape(b.beruf || "ohne Beruf")}${b.gespraech && b.status === "gespraech" ? ` · 💬 ${zeit(b.gespraech)}` : ""}${b.quelle ? ` · ${escape(b.quelle)}` : ""}${d.length ? ` · 📎 ${d.length}` : ""}${b.loeschen_ab ? ` · 🗑️ wird am ${datum(b.loeschen_ab)} gelöscht` : ""}</span></summary>
<p class="klein">${[b.telefon ? `☎️ <a href="tel:${escape(b.telefon.replace(/[^\d+]/g, ""))}">${escape(b.telefon)}</a>` : "", b.email ? `✉️ <a href="mailto:${escape(b.email)}">${escape(b.email)}</a>` : "", `seit ${datum(b.erstellt)}`].filter(Boolean).join(" · ")}</p>${b.notiz ? `<p class="klein">${escape(b.notiz).replace(/\n/g, "<br>")}</p>` : ""}
${d.length ? `<ul class="abwesenheit-liste">${d.map((x) => `<li><span>📎 <a href="/konto/bewerber/datei/${x.id}" target="_blank" rel="noopener">${escape(x.name)}</a></span><form method="post" action="/konto/bewerber" class="termin-weg"><input type="hidden" name="datei_weg" value="${x.id}"><button class="zweit" aria-label="Datei löschen">✕</button></form></li>`).join("")}</ul>` : ""}
<form method="post" action="/konto/bewerber" class="status-wahl"><input type="hidden" name="id" value="${b.id}">${STATUS.filter(([s]) => s !== b.status && s !== "eingestellt").map(([s, i, t]) => `<button name="status" value="${s}" class="zweit">${i} ${t}</button>`).join("")}</form>
${b.status === "gespraech" || b.status === "neu" ? `<form method="post" action="/konto/bewerber" class="zeile-form"><input type="hidden" name="id" value="${b.id}"><label>Gespräch am<input type="datetime-local" name="gespraech" value="${b.gespraech ? new Date(b.gespraech).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16).replace(" ", "T") : ""}"></label><button class="zweit">Speichern</button></form>` : ""}
<form method="post" action="/konto/bewerber" enctype="multipart/form-data" class="zeile-form"><input type="hidden" name="id" value="${b.id}"><label>Unterlage (PDF, PNG, JPG bis 10 MB)<input type="file" name="datei" accept="application/pdf,image/png,image/jpeg" required></label><button class="zweit">Hochladen</button></form>
<div class="knopf-zeile">${b.personal_id ? `<span class="klein">🎉 In der Personalakte</span>` : b.status !== "absage" ? `<form method="post" action="/konto/bewerber"><input type="hidden" name="einstellen" value="${b.id}"><button>➜ Personalakte anlegen</button></form>` : ""}<form method="post" action="/konto/bewerber"><input type="hidden" name="loeschen" value="${b.id}"><button class="zweit">🗑️ Jetzt löschen</button></form></div></details>`;
  };
  const spalten = STATUS.map(([s, i, t]) => { const l = liste.filter((b) => b.status === s); return l.length ? `<section class="bewerber-gruppe"><h2>${i} ${t} <span class="klein">${l.length}</span></h2>${l.map(karte).join("")}</section>` : ""; }).join("");
  return `<p class="klein">Bewerbungen mit Status und Unterlagen. Nach einer Absage löscht Jarvis die Daten nach 6 Monaten (Frist für Ansprüche nach dem AGG), nach der Einstellung nach 30 Tagen; dann steht alles Nötige in der Personalakte. Nur Bearbeiter, Standortleitungen und Admins sehen Bewerber.</p>
<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Bewerbung erfassen</summary><form method="post" action="/konto/bewerber" enctype="multipart/form-data"><input type="hidden" name="aktion" value="neu"><div class="aueg-form">
<label>Vorname<input name="vorname" required maxlength="80"></label><label>Nachname<input name="nachname" maxlength="80"></label>
<label>Telefon<input name="telefon" type="tel" maxlength="60"></label><label>E-Mail<input name="email" type="email" maxlength="200"></label>
<label>Beruf<input name="beruf" maxlength="120" list="bewerber-berufe"></label><datalist id="bewerber-berufe">${o.berufe.map((b) => `<option value="${escape(b)}">`).join("")}</datalist><label>Quelle<input name="quelle" maxlength="120" list="bewerber-quellen" placeholder="z. B. Agentur für Arbeit"></label><datalist id="bewerber-quellen">${["Agentur für Arbeit", "Indeed", "Website", "Empfehlung", "Facebook/Instagram", "Aushang", "Initiativbewerbung"].map((q) => `<option value="${q}">`).join("")}</datalist>
${o.bereiche.length ? `<label class="ganz">Standort<select name="bereich"><option value="">ganze Firma</option>${o.bereiche.map((b) => `<option value="${b.id}">${escape(b.name)}</option>`).join("")}</select></label>` : ""}
<label class="ganz">Notiz<textarea name="notiz" maxlength="1000" rows="2"></textarea></label><label class="ganz">Lebenslauf o. Ä. (freiwillig)<input type="file" name="datei" accept="application/pdf,image/png,image/jpeg"></label></div><button>Speichern</button></form></details>
${spalten || `<p class="treffer-leer">Noch keine Bewerbungen.</p>`}`;
}

/** Deletes applicants whose deletion date has passed, files first. Called when the office opens the page or Firma & Team. */
export async function aufraeumen(s: Sitzung, env: KontoEnv, firma: string, heute: string): Promise<number> {
  const r = await db<{ id: string; bewerber_dateien: { id: string }[] }[]>(s, env, `bewerber?firma_id=eq.${firma}&loeschen_ab=lt.${heute}&select=id,bewerber_dateien(id)&limit=200`);
  if (!r.ok || !r.daten.length) return 0;
  for (const b of r.daten) for (const d of b.bewerber_dateien ?? []) await env.DATEN?.delete(schluessel(firma, b.id, d.id));
  const weg = await db<{ id: string }[]>(s, env, `bewerber?firma_id=eq.${firma}&id=in.(${r.daten.map((b) => b.id).join(",")})&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
  return weg.ok ? weg.daten.length : 0;
}

export async function bewerber(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const dateiPfad = url.pathname.match(/^\/konto\/bewerber\/datei\/([0-9a-f-]{36})$/);
  if (url.pathname !== "/konto/bewerber" && !dateiPfad) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Bewerber", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (!["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle)) return antwort("<p>Bewerber sehen Bearbeiter, Standortleitungen und Admins.</p>", 403);
  const firma = f.m.firma_id;
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (dateiPfad) {
    const d = await db<Datei[]>(f.s, env, `bewerber_dateien?id=eq.${dateiPfad[1]}&firma_id=eq.${firma}&select=id,bewerber_id,name,mime,groesse`);
    const x = d.ok ? d.daten[0] : undefined;
    const obj = x ? await env.DATEN?.get(schluessel(firma, x.bewerber_id, x.id)) : null;
    if (!x || !obj) return new Response("Nicht gefunden", { status: 404 });
    const h = new Headers({ "content-type": x.mime, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(x.name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    for (const c of f.s.cookies) h.append("set-cookie", c);
    return new Response(obj.body, { headers: h });
  }
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/bewerber?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const uuid = (k: string) => /^[0-9a-f-]{36}$/.test(t(k, 36)) ? t(k, 36) : "";
    const hochladen = async (bid: string): Promise<string> => {
      const dt = form.get("datei");
      if (!dt || typeof dt === "string" || !dt.size) return "";
      const bytes = new Uint8Array(await dt.arrayBuffer());
      if (dt.size > 10 * 1024 * 1024 || !TYPEN.includes(dt.type) || !passt(bytes, dt.type)) return "Bitte PDF, PNG oder JPG bis 10 MB.";
      const id = crypto.randomUUID();
      await env.DATEN?.put(schluessel(firma, bid, id), bytes, { httpMetadata: { contentType: dt.type } });
      const r = await db(f.s, env, "bewerber_dateien", { method: "POST", body: JSON.stringify({ id, firma_id: firma, bewerber_id: bid, name: dt.name.replace(/[^\wäöüÄÖÜß.\- ]+/g, "_").slice(0, 200), mime: dt.type, groesse: dt.size }) });
      if (!r.ok) { await env.DATEN?.delete(schluessel(firma, bid, id)); return "Datei konnte nicht gespeichert werden."; }
      return "ok";
    };
    if (uuid("datei_weg")) {
      const d = await db<Datei[]>(f.s, env, `bewerber_dateien?id=eq.${uuid("datei_weg")}&firma_id=eq.${firma}&select=id,bewerber_id,name,mime,groesse`, { method: "DELETE", headers: { prefer: "return=representation" } });
      if (d.ok && d.daten[0]) await env.DATEN?.delete(schluessel(firma, d.daten[0].bewerber_id, d.daten[0].id));
      return zurueck(d.ok && d.daten.length ? "Datei gelöscht." : "Löschen hat nicht geklappt.");
    }
    if (uuid("loeschen")) {
      const d = await db<{ id: string }[]>(f.s, env, `bewerber_dateien?bewerber_id=eq.${uuid("loeschen")}&firma_id=eq.${firma}&select=id`);
      for (const x of d.ok ? d.daten : []) await env.DATEN?.delete(schluessel(firma, uuid("loeschen"), x.id));
      const r = await db<{ id: string }[]>(f.s, env, `bewerber?id=eq.${uuid("loeschen")}&firma_id=eq.${firma}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return zurueck(r.ok && r.daten.length ? "Bewerbung mit allen Unterlagen gelöscht." : "Löschen hat nicht geklappt.");
    }
    if (uuid("einstellen")) {
      const b = await db<Bewerber[]>(f.s, env, `bewerber?id=eq.${uuid("einstellen")}&firma_id=eq.${firma}&select=id,bereich_id,vorname,nachname,email,telefon,beruf,personal_id`);
      const x = b.ok ? b.daten[0] : undefined;
      if (!x) return zurueck("Bewerbung nicht gefunden.");
      if (x.personal_id) return zurueck("Schon in der Personalakte.");
      const p = await db<{ id: string }[]>(f.s, env, "personal?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, bereich_id: x.bereich_id, vorname: x.vorname, nachname: x.nachname, telefon: x.telefon, email: x.email, berufe: x.beruf ? [x.beruf] : [], eintritt: heute }) });
      if (!p.ok || !p.daten.length) return zurueck("Personalakte konnte nicht angelegt werden. Hast du Rechte für diesen Standort?");
      await db(f.s, env, `bewerber?id=eq.${x.id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ status: "eingestellt", personal_id: p.daten[0].id }) });
      return zurueck(`${x.vorname} ist jetzt in der Personalakte (Eintritt heute, bitte anpassen). Tipp: unter Checklisten den Einstieg starten.`);
    }
    if (t("aktion", 10) === "neu") {
      const zeile = { firma_id: firma, vorname: t("vorname", 80), nachname: t("nachname", 80), telefon: t("telefon", 60), email: t("email", 200), beruf: t("beruf", 120), quelle: t("quelle", 120), notiz: String(form.get("notiz") ?? "").trim().slice(0, 1000), bereich_id: uuid("bereich") || null };
      if (!zeile.vorname) return zurueck("Bitte mindestens den Vornamen angeben.");
      const r = await db<{ id: string }[]>(f.s, env, "bewerber?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(zeile) });
      if (!r.ok || !r.daten.length) return zurueck("Speichern hat nicht geklappt. Hast du Rechte für diesen Standort?");
      const h = await hochladen(r.daten[0].id);
      return zurueck(h && h !== "ok" ? `Bewerbung gespeichert, aber: ${h}` : "Bewerbung gespeichert.");
    }
    const id = uuid("id");
    if (!id) return zurueck("Unbekannte Aktion.");
    if (form.has("status")) {
      const st = t("status", 20);
      if (!STATUS.some(([s]) => s === st) || st === "eingestellt") return zurueck("Unbekannter Status.");
      const r = await db(f.s, env, `bewerber?id=eq.${id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ status: st }) });
      return zurueck(r.ok ? (st === "absage" ? "Absage vermerkt. Die Daten werden in 6 Monaten gelöscht." : "Status geändert.") : "Ändern hat nicht geklappt.");
    }
    if (form.has("gespraech")) {
      const g = t("gespraech", 16);
      const r = await db(f.s, env, `bewerber?id=eq.${id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ gespraech: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(g) ? new Date(`${g}:00${berlinOffset(g)}`).toISOString() : null, status: "gespraech" }) });
      return zurueck(r.ok ? "Gesprächstermin gespeichert." : "Speichern hat nicht geklappt.");
    }
    const h = await hochladen(id);
    return zurueck(h === "ok" ? "Unterlage hochgeladen." : h || "Bitte eine Datei wählen.");
  }
  await aufraeumen(f.s, env, firma, heute);
  const [l, d, b, be] = await Promise.all([
    db<Bewerber[]>(f.s, env, `bewerber?firma_id=eq.${firma}&select=id,bereich_id,vorname,nachname,email,telefon,beruf,quelle,status,gespraech,notiz,loeschen_ab,personal_id,erstellt&order=erstellt.desc&limit=500`),
    db<Datei[]>(f.s, env, `bewerber_dateien?firma_id=eq.${firma}&select=id,bewerber_id,name,mime,groesse&limit=3000`),
    db<{ id: string; name: string }[]>(f.s, env, `bereiche?firma_id=eq.${firma}&select=id,name&order=name`),
    db<{ berufe: string[] }[]>(f.s, env, `personal?firma_id=eq.${firma}&select=berufe&limit=3000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${bewerberSeite(l.ok ? l.daten : [], d.ok ? d.daten : [], { heute, bereiche: b.ok ? b.daten : [], berufe: [...new Set((be.ok ? be.daten : []).flatMap((x) => x.berufe))].sort((x, y) => x.localeCompare(y, "de")) })}`);
}

/** "+01:00" or "+02:00" for a local Berlin date and time (summer time from the last Sunday in March to the last Sunday in October). */
export function berlinOffset(lokal: string): string {
  const d = new Date(`${lokal}:00Z`);
  const letzterSonntag = (m: number) => { const x = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x; };
  const start = letzterSonntag(2); start.setUTCHours(2); const ende = letzterSonntag(9); ende.setUTCHours(3);
  return d >= start && d < ende ? "+02:00" : "+01:00";
}
