// T16: Mitarbeiter-Selbstpflege. Staff with an app login linked to their personnel record see their own assignments,
// request leave (stays "beantragt" until the office confirms) and upload their own proofs. The database only shows
// them their own record (policies "eigene" in 20261101160000).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { GRUENDE, zeitraumText, type Abwesenheit } from "./personal.ts";
import { ampel, NACHWEIS_VORSCHLAEGE, plusTage, type Nachweis } from "./personalakte.ts";
import { ausFormular, meineStundenTeil, type Eintrag } from "./stunden.ts";
import { meineSchichtenTeil, type Schicht } from "./schichten.ts";

export type Ich = { id: string; firma_id: string; vorname: string; nachname: string; berufe: string[]; qualifikationen: string[]; status: string };
export type MeinAuftrag = { titel: string; beginn: string | null; ende: string | null };
export type MeineUnterweisung = { id?: string; titel: string; intervall_monate: number; letzte: string | null; beschreibung?: string; digital?: boolean };
export type MeineUeberlassung = { entleiher: string; von: string; bis: string | null };
export type MeineAbwesenheit = Abwesenheit & { status: string };

const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const plusMonate = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const ID = /^[0-9a-f-]{36}$/;
const DATEI_TYPEN = ["application/pdf", "image/png", "image/jpeg"];
const passtZuTyp = (b: Uint8Array, typ: string) => typ === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 : typ === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;

/** Next due date of an instruction (never done = due now). */
export const naechsteUnterweisung = (u: MeineUnterweisung, heute: string) => u.letzte ? plusMonate(u.letzte, u.intervall_monate || 12) : heute;

export function ichSeite(d: { ich: Ich; auftraege: MeinAuftrag[]; ueberlassungen: MeineUeberlassung[]; abwesenheiten: MeineAbwesenheit[]; nachweise: Nachweis[]; unterweisungen: MeineUnterweisung[]; heute: string; stunden?: Eintrag[]; schichten?: Schicht[] }): string {
  const { ich, heute } = d;
  const laufend = (von: string | null, bis: string | null) => (!von || von <= heute) && (!bis || bis >= heute);
  const einsaetze = [
    ...d.ueberlassungen.filter((u) => !u.bis || u.bis >= heute).map((u) => ({ titel: `Überlassung an ${u.entleiher}`, von: u.von, bis: u.bis })),
    ...d.auftraege.filter((a) => !a.ende || a.ende >= heute).map((a) => ({ titel: a.titel, von: a.beginn, bis: a.ende })),
  ].sort((a, b) => (a.von ?? "").localeCompare(b.von ?? ""));
  const laufendeTitel = [...new Set([...(d.schichten ?? []).filter((s) => s.datum === heute && s.ort).map((s) => s.ort), ...d.ueberlassungen.filter((u) => laufend(u.von, u.bis)).map((u) => u.entleiher), ...d.auftraege.filter((a) => laufend(a.beginn, a.ende)).map((a) => a.titel)])].slice(0, 10);
  const zeitraum = (von: string | null, bis: string | null) => von && bis ? `${datum(von)} – ${datum(bis)}` : von ? `ab ${datum(von)}` : bis ? `bis ${datum(bis)}` : "ohne festes Ende";
  const abw = d.abwesenheiten.filter((a) => a.bis >= heute).sort((a, b) => a.von.localeCompare(b.von));
  const unterweisungen = d.unterweisungen.map((u) => ({ ...u, faellig: naechsteUnterweisung(u, heute) })).sort((a, b) => a.faellig.localeCompare(b.faellig));
  return `<div class="ich-kopf"><h2>👋 Hallo ${escape(ich.vorname)}</h2><p class="klein">${escape([ich.berufe.join(", "), ich.qualifikationen.join(", ")].filter(Boolean).join(" · ")) || "Beruf noch nicht eingetragen"}</p></div>
<details class="ausfall-melden"><summary>🚨 Ich falle kurzfristig aus</summary><form method="post" action="/konto/ich"><input type="hidden" name="aktion" value="ausfall"><div class="aueg-form"><label>Wann?<select name="tag"><option value="${heute}">heute</option><option value="${plusTage(heute, 1)}">morgen</option></select></label><label>Notiz (freiwillig)<input name="notiz" maxlength="200" placeholder="z. B. Kind krank, Auto kaputt"></label></div><button>Ausfall melden</button><p class="klein">Bitte keine Gesundheitsangaben. Deine Schichten an dem Tag werden abgesagt und das Büro wird benachrichtigt. Eine Krankmeldung gibst du wie gewohnt ab.</p></form></details>
<div class="ich-raster">
<section><h3>📋 Meine Einsätze</h3>${einsaetze.length ? `<ul class="kontakt-liste ich-liste">${einsaetze.map((e) => `<li class="${laufend(e.von, e.bis) ? "aktiv" : ""}"><div><strong>${escape(e.titel)}</strong><span class="klein">${zeitraum(e.von, e.bis)}${laufend(e.von, e.bis) ? " · läuft" : ""}</span></div></li>`).join("")}</ul>` : `<p class="treffer-leer">Gerade keine Einsätze eingetragen.</p>`}</section>
${meineSchichtenTeil(d.schichten ?? [], heute)}${d.stunden ? meineStundenTeil(d.stunden, laufendeTitel, heute) : ""}
<section><h3>🌴 Urlaub &amp; Abwesenheit</h3>${abw.length ? `<ul class="kontakt-liste ich-liste">${abw.map((a) => `<li class="${a.status === "beantragt" ? "bald" : ""}"><div><strong>${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[0]} ${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[1]} ${zeitraumText(a)}</strong><span class="klein">${a.status === "beantragt" ? "⏳ beantragt, wartet auf das Büro" : "✅ bestätigt"}${a.notiz ? ` · ${escape(a.notiz)}` : ""}</span></div>${a.status === "beantragt" ? `<form method="post" action="/konto/ich"><input type="hidden" name="zurueckziehen" value="${a.id}"><button class="zweit" aria-label="Antrag zurückziehen">✕</button></form>` : ""}</li>`).join("")}</ul>` : ""}
<details class="termin-neu"${abw.length ? "" : " open"}><summary>➕ Urlaub beantragen</summary><form method="post" action="/konto/ich"><input type="hidden" name="aktion" value="urlaub"><div class="aueg-form"><label>Von<input type="date" name="von" required min="${heute}"></label><label>Bis<input type="date" name="bis" required min="${heute}"></label><label>Grund<select name="grund"><option value="urlaub">🌴 Urlaub</option><option value="abwesend">⏸️ Nicht verfügbar</option></select></label><label>Notiz<input name="notiz" maxlength="200"></label></div><button>Beantragen</button><p class="klein">Das Büro bestätigt den Antrag. Bitte keine Gesundheitsangaben: Für Krankheit „Nicht verfügbar“ wählen und Bescheinigungen wie gewohnt abgeben.</p></form></details></section>
<section><h3>🎓 Meine Nachweise</h3>${d.nachweise.length ? `<ul class="kontakt-liste ich-liste">${d.nachweise.map((n) => { const a = ampel(n.gueltig_bis, heute); return `<li class="${a === "rot" ? "abgelaufen" : a === "gelb" ? "bald" : ""}"><div><strong>${escape(n.bezeichnung)}</strong><span class="klein">${n.gueltig_bis ? `${a === "rot" ? "⚠️ abgelaufen am" : a === "gelb" ? "⏳ gültig bis" : "gültig bis"} ${datum(n.gueltig_bis)}` : "ohne Ablauf"}${n.datei_name ? ` · <a href="/konto/ich/nachweis/${n.id}">📎 Datei</a>` : ""}</span></div></li>`; }).join("")}</ul>` : `<p class="treffer-leer">Noch keine Nachweise.</p>`}
<details class="termin-neu"><summary>➕ Nachweis hochladen</summary><form method="post" action="/konto/ich" enctype="multipart/form-data"><input type="hidden" name="aktion" value="nachweis"><div class="aueg-form"><label class="ganz">Qualifikation<input name="bezeichnung" list="nachweis-vorschlaege" required maxlength="120"></label><datalist id="nachweis-vorschlaege">${NACHWEIS_VORSCHLAEGE.map((v) => `<option value="${v}">`).join("")}</datalist><label>Erworben<input type="date" name="erworben"></label><label>Gültig bis<input type="date" name="gueltig_bis"></label><label class="ganz">Datei (PDF, PNG oder JPG bis 5 MB)<input type="file" name="datei" accept="application/pdf,image/png,image/jpeg" required></label></div><button>Hochladen</button><p class="klein">Ein Foto mit dem Handy reicht. Das Büro sieht den Nachweis sofort in deiner Personalakte.</p></form></details></section>
<section><h3>🦺 Unterweisungen</h3>${unterweisungen.length ? `<ul class="kontakt-liste ich-liste">${unterweisungen.map((u) => { const st = u.faellig < heute || !u.letzte ? "abgelaufen" : u.faellig <= plusTage(heute, 30) ? "bald" : ""; return `<li class="${st} unterweisung-ich"><div><strong>${escape(u.titel)}</strong><span class="klein">${u.letzte ? `zuletzt ${datum(u.letzte)}${u.digital ? " 📱" : ""} · ${st === "abgelaufen" ? "⚠️ fällig seit" : "nächste"} ${datum(u.faellig)}` : "⚠️ noch nicht unterwiesen"}</span>${u.id && st && u.beschreibung ? `<details${st === "abgelaufen" ? " open" : ""}><summary class="klein">Inhalt lesen</summary><p class="klein">${escape(u.beschreibung).replace(/\n/g, "<br>")}</p></details>` : ""}</div>${u.id && st && u.letzte !== heute ? `<form method="post" action="/konto/ich"><input type="hidden" name="aktion" value="unterweisung"><input type="hidden" name="id" value="${u.id}"><button class="zweit">✓ Gelesen und verstanden</button></form>` : ""}</li>`; }).join("")}</ul><p class="klein">Mit „Gelesen und verstanden“ bestätigst du die Unterweisung mit Datum. Fragen? Sprich vorher deine Vorgesetzten an.</p>` : `<p class="treffer-leer">Keine Unterweisungen eingetragen.</p>`}</section>
</div>
<p class="klein">Stimmt etwas nicht? Sag im Büro Bescheid; deine Stammdaten pflegt das Büro.</p>`;
}

export async function ich(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const datei = url.pathname.match(/^\/konto\/ich\/nachweis\/([0-9a-f-]{36})$/);
  if (url.pathname === "/konto/zugang/personal") return zugangVerknuepfen(request, env);
  if (url.pathname !== "/konto/ich" && !datei) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const firma = f.m.firma_id;
  const antwort = (t: string, status = 200) => html(seite("Meine Einsätze & Daten", `<p class="konto-zurueck"><a href="/konto" aria-label="Zurück zur Übersicht">←</a></p>${t}`, 0, ""), status, f.s.cookies);
  const p = await db<Ich[]>(f.s, env, `personal?firma_id=eq.${firma}&user_id=eq.${f.s.userId}&select=id,firma_id,vorname,nachname,berufe,qualifikationen,status`);
  const person = p.ok ? p.daten[0] : undefined;
  if (!person) return antwort(`<p>Dein Zugang ist noch nicht mit deiner Personalakte verknüpft.</p><p class="klein">Ein Inhaber oder Admin verknüpft das unter Firma &amp; Team → App-Zugänge.</p>`, datei ? 404 : 200);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const schluessel = (id: string) => `personal_nachweise/${firma}/${person.id}/${id}`;
  if (datei) {
    const n = await db<Nachweis[]>(f.s, env, `personal_nachweise?id=eq.${datei[1]}&personal_id=eq.${person.id}&select=id,datei_name,datei_mime`);
    const nw = n.ok ? n.daten[0] : undefined;
    const obj = nw?.datei_name ? await env.DATEN?.get(schluessel(nw.id)) : null;
    if (!nw || !obj) return new Response("Nicht gefunden", { status: 404 });
    const headers = new Headers({ "content-type": nw.datei_mime ?? "application/octet-stream", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(nw.datei_name!)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    for (const c of f.s.cookies) headers.append("set-cookie", c);
    return new Response(obj.body, { headers });
  }
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/ich?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const d = (k: string) => { const v = t(k, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v ? v : null; };
    const weg = t("zurueckziehen", 36);
    if (ID.test(weg)) {
      const r = await db<{ id: string }[]>(f.s, env, `personal_abwesenheiten?id=eq.${weg}&personal_id=eq.${person.id}&status=eq.beantragt&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return zurueck(r.ok && r.daten.length ? "Antrag zurückgezogen." : "Zurückziehen hat nicht geklappt.");
    }
    if (t("aktion", 20) === "urlaub") {
      const von = d("von"), bis = d("bis") ?? von;
      if (!von || !bis || bis < von || von < heute || (Date.parse(bis) - Date.parse(von)) / 86400_000 > 366) return zurueck("Bitte Von und Bis prüfen (nicht in der Vergangenheit, höchstens ein Jahr).");
      const grund = t("grund", 20) === "abwesend" ? "abwesend" : "urlaub";
      const r = await db(f.s, env, "personal_abwesenheiten", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: person.id, von, bis, grund, notiz: t("notiz", 200), status: "beantragt" }) });
      return zurueck(r.ok ? `${grund === "urlaub" ? "Urlaub" : "Abwesenheit"} ${zeitraumText({ von, bis })} beantragt. Das Büro bestätigt.` : "Beantragen hat nicht geklappt.");
    }
    if (t("aktion", 20) === "nachweis") {
      const zeile = { id: crypto.randomUUID(), firma_id: firma, personal_id: person.id, bezeichnung: t("bezeichnung", 120), erworben: d("erworben"), gueltig_bis: d("gueltig_bis"), datei_name: null as string | null, datei_mime: null as string | null, datei_groesse: null as number | null };
      if (zeile.bezeichnung.length < 2 || (zeile.erworben && zeile.gueltig_bis && zeile.gueltig_bis < zeile.erworben)) return zurueck("Bitte Qualifikation angeben (gültig bis nicht vor erworben).");
      const dt = form.get("datei");
      if (!dt || typeof dt === "string" || !dt.size) return zurueck("Bitte eine Datei wählen.");
      const bytes = new Uint8Array(await dt.arrayBuffer());
      if (dt.size > 5 * 1024 * 1024 || !DATEI_TYPEN.includes(dt.type) || !passtZuTyp(bytes, dt.type)) return zurueck("Bitte ein PDF, PNG oder JPG bis 5 MB wählen.");
      Object.assign(zeile, { datei_name: dt.name.replace(/[^\wäöüÄÖÜß.\- ]+/g, "_").slice(0, 200), datei_mime: dt.type, datei_groesse: dt.size });
      await env.DATEN?.put(schluessel(zeile.id), bytes, { httpMetadata: { contentType: zeile.datei_mime! } });
      const r = await db(f.s, env, "personal_nachweise", { method: "POST", body: JSON.stringify(zeile) });
      if (!r.ok) await env.DATEN?.delete(schluessel(zeile.id));
      return zurueck(r.ok ? "Nachweis hochgeladen." : "Hochladen hat nicht geklappt.");
    }
    // T17: own hours (only while still open), T18: answer a shift, T22: confirm an instruction.
    if (t("aktion", 20) === "stunden") {
      const e = ausFormular(form, heute, true);
      if (typeof e === "string") return weiterleiten(`/konto/ich?hinweis=${encodeURIComponent(e)}#stunden`, f.s.cookies);
      const r = await db(f.s, env, "stundenzettel", { method: "POST", body: JSON.stringify({ ...e, firma_id: firma, personal_id: person.id }) });
      return weiterleiten(`/konto/ich?hinweis=${encodeURIComponent(r.ok ? "Stunden gespeichert. Das Büro gibt sie frei." : "Speichern hat nicht geklappt.")}#stunden`, f.s.cookies);
    }
    if (ID.test(t("stunde_loeschen", 36))) {
      const r = await db<{ id: string }[]>(f.s, env, `stundenzettel?id=eq.${t("stunde_loeschen", 36)}&personal_id=eq.${person.id}&status=eq.erfasst&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
      return weiterleiten(`/konto/ich?hinweis=${encodeURIComponent(r.ok && r.daten.length ? "Eintrag gelöscht." : "Freigegebene Einträge ändert nur das Büro.")}#stunden`, f.s.cookies);
    }
    if (t("aktion", 20) === "schicht" && ID.test(t("id", 36)) && ["zugesagt", "abgesagt"].includes(t("antwort", 10))) {
      const r = await db<boolean>(f.s, env, "rpc/schicht_antworten", { method: "POST", body: JSON.stringify({ s: t("id", 36), a: t("antwort", 10) }) });
      return weiterleiten(`/konto/ich?hinweis=${encodeURIComponent(r.ok && r.daten ? (t("antwort", 10) === "zugesagt" ? "Schicht zugesagt." : "Schicht abgesagt. Das Büro wird benachrichtigt.") : "Das ging nicht (vergangene Schicht?).")}#schichten`, f.s.cookies);
    }
    if (t("aktion", 20) === "ausfall") {
      const tag = d("tag");
      if (!tag || (tag !== heute && tag !== plusTage(heute, 1))) return zurueck("Bitte heute oder morgen wählen.");
      const r = await db<number>(f.s, env, "rpc/ausfall_melden", { method: "POST", body: JSON.stringify({ tag, notiz: t("notiz", 200) }) });
      const n = r.ok ? Number(r.daten) : -1;
      return zurueck(n >= 0 ? `Ausfall für ${tag === heute ? "heute" : "morgen"} gemeldet.${n ? ` ${n} ${n === 1 ? "Schicht ist" : "Schichten sind"} abgesagt.` : ""} Das Büro ist informiert. Gute Besserung, falls du krank bist!` : n === -2 ? "Für diesen Tag bist du schon als abwesend eingetragen." : "Melden hat nicht geklappt. Bitte ruf im Büro an.");
    }
    if (t("aktion", 20) === "unterweisung" && ID.test(t("id", 36))) {
      const r = await db<boolean>(f.s, env, "rpc/unterweisung_bestaetigen", { method: "POST", body: JSON.stringify({ u: t("id", 36) }) });
      return zurueck(r.ok && r.daten ? "Unterweisung bestätigt. Danke!" : "Bestätigen hat nicht geklappt.");
    }
    return zurueck("Unbekannte Aktion.");
  }
  const vor = `${new Date(Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10)}`;
  const [a, u, abw, n, uw, st, sch] = await Promise.all([
    db<MeinAuftrag[]>(f.s, env, "rpc/meine_auftraege", { method: "POST", body: JSON.stringify({ f: firma }) }),
    db<MeineUeberlassung[]>(f.s, env, `ueberlassungen?personal_id=eq.${person.id}&select=entleiher,von,bis&order=von.desc&limit=20`),
    db<MeineAbwesenheit[]>(f.s, env, `personal_abwesenheiten?personal_id=eq.${person.id}&bis=gte.${heute}&select=id,personal_id,von,bis,grund,notiz,status&order=von&limit=50`),
    db<Nachweis[]>(f.s, env, `personal_nachweise?personal_id=eq.${person.id}&select=id,personal_id,bezeichnung,erworben,gueltig_bis,datei_name,datei_mime&order=bezeichnung&limit=100`),
    db<MeineUnterweisung[]>(f.s, env, "rpc/meine_unterweisungen", { method: "POST", body: JSON.stringify({ f: firma }) }),
    db<Eintrag[]>(f.s, env, `stundenzettel?personal_id=eq.${person.id}&datum=gte.${vor}&select=id,personal_id,datum,beginn,ende,pause_min,einsatz,notiz,status&order=datum.desc&limit=200`),
    db<Schicht[]>(f.s, env, `schichten?personal_id=eq.${person.id}&datum=gte.${heute}&select=id,personal_id,bereich_id,datum,beginn,ende,ort,notiz,antwort,einsatzort_id,einsatzorte(id,kunde_id,name,strasse,plz,ort,ansprechpartner,telefon,treffpunkt,kleidung,hinweise)&order=datum,beginn&limit=60`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${ichSeite({ ich: person, auftraege: a.ok ? a.daten : [], ueberlassungen: u.ok ? u.daten : [], abwesenheiten: abw.ok ? abw.daten : [], nachweise: n.ok ? n.daten : [], unterweisungen: uw.ok ? uw.daten : [], heute, stunden: st.ok ? st.daten : [], schichten: sch.ok ? sch.daten : [] })}`);
}

/** Admin: link a staff login (role "Einsatzkraft") to a personnel record, or remove the link. */
async function zugangVerknuepfen(request: Request, env: KontoEnv): Promise<Response> {
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (request.method !== "POST" || !f.admin) return new Response("Nicht erlaubt", { status: 403 });
  const form = await request.formData();
  const zurueck = (h: string) => weiterleiten(`/konto/team?hinweis=${encodeURIComponent(h)}#app-zugaenge`, f.s.cookies);
  const user = String(form.get("user") ?? ""), pid = String(form.get("personal") ?? "");
  if (!ID.test(user) || (pid && !ID.test(pid))) return zurueck("Bitte Person auswählen.");
  const firma = f.m.firma_id;
  const mg = await db<{ rolle: string }[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${user}&select=rolle`);
  if (!mg.ok || mg.daten[0]?.rolle !== "mitarbeiter") return zurueck("Verknüpfen geht nur für Zugänge mit der Rolle Einsatzkraft.");
  const los = await db(f.s, env, `personal?firma_id=eq.${firma}&user_id=eq.${user}`, { method: "PATCH", body: JSON.stringify({ user_id: null }) });
  if (!los.ok) return zurueck("Verknüpfen hat nicht geklappt.");
  if (!pid) return zurueck("Verknüpfung entfernt.");
  const r = await db<{ id: string }[]>(f.s, env, `personal?id=eq.${pid}&firma_id=eq.${firma}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ user_id: user }) });
  return zurueck(r.ok && r.daten.length ? "Zugang mit der Personalakte verknüpft. Die Person sieht jetzt „Meine Einsätze & Daten“." : "Verknüpfen hat nicht geklappt (vielleicht schon mit einem anderen Zugang verknüpft).");
}
