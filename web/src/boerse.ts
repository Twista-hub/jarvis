// Idea 26 (docs/ideen-arbeitsoberflaeche.md): job exchange between Jarvis firms. BUILT, BUT SWITCHED OFF:
// it goes live only when the terms of use were checked by a lawyer (platform duties under the DSA, notice procedure,
// liability for subcontractors' minimum wage and social security) and Benjamin agreed. Then set BOERSE_AKTIV = true.
// Firms post (part) jobs; office users of other firms register interest; contact details are exchanged only after
// the posting firm accepts (RPC boerse_kontakt). Every job can be reported (table boerse_meldungen, operator only).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { GEWERKE } from "./partner.ts";
import { escape, seite } from "./seite.ts";

export const BOERSE_AKTIV = false;

export type Job = { id: string; firma_id: string; titel: string; gewerk: string; plz: string; ort: string; von: string | null; bis: string | null; beschreibung: string; status: string; ablauf: string; erstellt: string };
export type Interesse = { id: string; auftrag_id: string; firma_id: string; nachricht: string; status: string; erstellt: string };
export type Kontakt = { firma: string; ort: string; telefon: string; email: string };
const datum = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const zeitraum = (j: Job) => j.von || j.bis ? `${j.von ? datum(j.von) : "…"} – ${j.bis ? datum(j.bis) : "…"}` : "Zeitraum offen";
const STATUS: Record<string, string> = { offen: "⏳ offen", angenommen: "✅ angenommen", abgelehnt: "❌ abgelehnt", vergeben: "🤝 vergeben", geschlossen: "⛔ geschlossen" };
const kontaktHtml = (k: Kontakt | undefined) => k ? `<span class="klein">📇 ${escape(k.firma)}${k.ort ? `, ${escape(k.ort)}` : ""}${k.telefon ? ` · 📞 ${escape(k.telefon)}` : ""}${k.email ? ` · ✉️ <a href="mailto:${escape(k.email)}">${escape(k.email)}</a>` : ""}</span>` : "";
const knopf = (felder: Record<string, string>, text: string, zweit = true) => `<form method="post" action="/konto/boerse">${Object.entries(felder).map(([k, v]) => `<input type="hidden" name="${k}" value="${escape(v)}">`).join("")}<button${zweit ? ' class="zweit"' : ""}>${text}</button></form>`;

export function boerseSeite(d: { firma: string; jobs: Job[]; interessen: Interesse[]; namen: Map<string, string>; kontakte: Map<string, Kontakt>; gewerk: string; darf: boolean; heute: string }): string {
  const fremde = d.jobs.filter((j) => j.firma_id !== d.firma && j.status === "offen" && (!d.gewerk || j.gewerk === d.gewerk));
  const eigene = d.jobs.filter((j) => j.firma_id === d.firma);
  const meine = d.interessen.filter((i) => i.firma_id === d.firma);
  const jobKopf = (j: Job) => `<strong>${escape(j.titel)}</strong><span class="klein">${j.gewerk ? `${escape(j.gewerk)} · ` : ""}${escape([j.plz, j.ort].filter(Boolean).join(" ") || "Ort offen")} · ${zeitraum(j)}</span>${j.beschreibung ? `<span class="klein">${escape(j.beschreibung)}</span>` : ""}`;
  const melden = (j: Job) => `<details><summary class="klein">⚑ Melden</summary><form method="post" action="/konto/boerse"><input type="hidden" name="melden" value="${j.id}"><label>Was ist das Problem?<input name="grund" required minlength="3" maxlength="1000" placeholder="z. B. Scheinselbstständigkeit, Lohndumping, Fake"></label><button class="zweit">Melden</button></form></details>`;
  const fremdeHtml = fremde.length ? `<ul class="kontakt-liste">${fremde.map((j) => {
    const ich = meine.find((i) => i.auftrag_id === j.id);
    return `<li><div><span class="klein">${escape(d.namen.get(j.firma_id) ?? "Firma")}</span>${jobKopf(j)}${ich ? `<span class="klein">Dein Interesse: ${STATUS[ich.status]}</span>${kontaktHtml(d.kontakte.get(ich.id))}` : ""}</div><span class="knopf-zeile">${d.darf ? ich ? ich.status === "offen" ? knopf({ zurueckziehen: ich.id }, "Zurückziehen") : "" : `<details><summary>🙋 Interesse</summary><form method="post" action="/konto/boerse"><input type="hidden" name="interesse" value="${j.id}"><label>Nachricht (freiwillig)<textarea name="nachricht" maxlength="1000" rows="2" placeholder="z. B. 3 Leute ab März frei, Referenzen auf Anfrage"></textarea></label><button>Interesse senden</button></form></details>` : ""}${melden(j)}</span></li>`;
  }).join("")}</ul>` : `<p class="treffer-leer">Gerade keine passenden Aufträge anderer Firmen.</p>`;
  const eigeneHtml = eigene.length ? `<ul class="kontakt-liste">${eigene.map((j) => {
    const ints = d.interessen.filter((i) => i.auftrag_id === j.id);
    return `<li><div>${jobKopf(j)}<span class="klein">${STATUS[j.status]}${j.status === "offen" ? ` · sichtbar bis ${datum(j.ablauf)}` : ""} · ${ints.length} Interessent${ints.length === 1 ? "" : "en"}</span>
${ints.map((i) => `<div class="anfrage-zeile"><strong>${escape(d.namen.get(i.firma_id) ?? "Firma")}</strong> <span class="klein">${STATUS[i.status]}${i.nachricht ? ` · ${escape(i.nachricht)}` : ""}</span>${kontaktHtml(d.kontakte.get(i.id))}${d.darf && i.status === "offen" ? `<span class="knopf-zeile">${knopf({ annehmen: i.id }, "✅ Annehmen (Kontakt tauschen)", false)}${knopf({ ablehnen: i.id }, "Ablehnen")}</span>` : ""}</div>`).join("")}</div>
${d.darf && j.status === "offen" ? `<span class="knopf-zeile">${knopf({ vergeben: j.id }, "🤝 Vergeben")}${knopf({ schliessen: j.id }, "⛔ Schließen")}</span>` : ""}</li>`;
  }).join("")}</ul>` : `<p class="treffer-leer">Du hast noch keinen Auftrag eingestellt.</p>`;
  const neu = d.darf ? `<details class="termin-neu"><summary>➕ Auftrag einstellen</summary><form method="post" action="/konto/boerse"><input type="hidden" name="aktion" value="neu"><div class="aueg-form">
<label class="ganz">Titel<input name="titel" required minlength="3" maxlength="160" placeholder="z. B. Glasreinigung Bürohaus, 2 Tage"></label><label>Gewerk<select name="gewerk"><option value="">–</option>${GEWERKE.map((g) => `<option>${escape(g)}</option>`).join("")}</select></label>
<label>PLZ<input name="plz" inputmode="numeric" pattern="\\d{5}" maxlength="5"></label><label>Ort<input name="ort" maxlength="100"></label><label>Von<input type="date" name="von" min="${d.heute}"></label><label>Bis<input type="date" name="bis" min="${d.heute}"></label>
<label class="ganz">Beschreibung<textarea name="beschreibung" maxlength="2000" rows="3" placeholder="Umfang, Anforderungen (Zertifikate, Sprachen), keine Preise anderer Bieter"></textarea></label></div><button>Einstellen (30 Tage sichtbar)</button>
<p class="klein">Sichtbar für Büro-Nutzer anderer Firmen in Jarvis: Firmenname, Titel, Gewerk, Ort, Zeitraum, Beschreibung. Deine Kontaktdaten sieht nur, wen du annimmst.</p></form></details>` : "";
  return `<p class="klein">Aufträge oder Teil-Aufträge, die ihr allein nicht schafft, an andere Firmen geben – oder Aufträge anderer übernehmen. ${d.darf ? "" : "Als Leser kannst du nur ansehen."}</p>
<p class="hinweis">⚖️ Wer einen Auftrag weitergibt, haftet für Mindestlohn und (im Bau) Sozialbeiträge des Nachunternehmers (§ 13 MiLoG, § 14 AEntG, § 28e SGB IV). Vor der Vergabe Nachweise einholen (z. B. Unbedenklichkeitsbescheinigungen). Keine Absprachen zu öffentlichen Ausschreibungen, bei denen ihr getrennt bietet (§ 1 GWB). Verstöße bitte mit „⚑ Melden“.</p>
${neu}<h2>📋 Meine Aufträge</h2>${eigeneHtml}
<h2>🔎 Aufträge anderer Firmen</h2><nav class="ordner-chips" aria-label="Gewerk"><a href="/konto/boerse"${d.gewerk ? "" : ' aria-current="page"'}>Alle</a>${[...new Set(d.jobs.filter((j) => j.firma_id !== d.firma && j.gewerk).map((j) => j.gewerk))].map((g) => `<a href="/konto/boerse?gewerk=${encodeURIComponent(g)}"${g === d.gewerk ? ' aria-current="page"' : ""}>${escape(g)}</a>`).join("")}</nav>${fremdeHtml}`;
}

export async function boerse(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!BOERSE_AKTIV || url.pathname !== "/konto/boerse") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich", f.s.cookies);
  const firma = f.m.firma_id, darf = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const id = (k: string) => /^[0-9a-f-]{36}$/.test(t(k, 36)) ? t(k, 36) : "";
    const zurueck = (h: string) => weiterleiten(`/konto/boerse?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (id("melden")) { const r = await db(f.s, env, "boerse_meldungen", { method: "POST", body: JSON.stringify({ auftrag_id: id("melden"), grund: t("grund", 1000) }) }); return zurueck(r.ok ? "Danke, wir prüfen die Meldung." : "Melden hat nicht geklappt."); }
    if (!darf) return zurueck("Ändern dürfen Bearbeiter und Admins.");
    if (t("aktion", 5) === "neu") {
      const datumOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
      const r = await db(f.s, env, "boerse_auftraege", { method: "POST", body: JSON.stringify({ firma_id: firma, titel: t("titel", 160), gewerk: GEWERKE.includes(t("gewerk", 60)) ? t("gewerk", 60) : "", plz: /^\d{5}$/.test(t("plz", 5)) ? t("plz", 5) : "", ort: t("ort", 100), von: datumOk(t("von", 10)), bis: datumOk(t("bis", 10)), beschreibung: String(form.get("beschreibung") ?? "").trim().slice(0, 2000) }) });
      return zurueck(r.ok ? "Auftrag eingestellt, 30 Tage sichtbar." : "Bitte Titel (mind. 3 Zeichen) und Zeitraum prüfen.");
    }
    if (id("interesse")) { const r = await db(f.s, env, "boerse_interessen", { method: "POST", body: JSON.stringify({ auftrag_id: id("interesse"), firma_id: firma, nachricht: String(form.get("nachricht") ?? "").trim().slice(0, 1000) }) }); return zurueck(r.ok ? "Interesse gesendet. Die Firma bekommt eine Handy-Nachricht." : "Interesse ging nicht (schon gesendet oder Auftrag geschlossen)."); }
    if (id("zurueckziehen")) { await db(f.s, env, `boerse_interessen?id=eq.${id("zurueckziehen")}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck("Interesse zurückgezogen."); }
    for (const [feld, status] of [["annehmen", "angenommen"], ["ablehnen", "abgelehnt"]] as const) if (id(feld)) {
      const r = await db<{ id: string }[]>(f.s, env, `boerse_interessen?id=eq.${id(feld)}&status=eq.offen&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status }) });
      return zurueck(r.ok && r.daten.length ? status === "angenommen" ? "Angenommen – ihr seht jetzt gegenseitig die Kontaktdaten." : "Abgelehnt." : "Nichts geändert.");
    }
    for (const [feld, status] of [["vergeben", "vergeben"], ["schliessen", "geschlossen"]] as const) if (id(feld)) {
      const r = await db<{ id: string }[]>(f.s, env, `boerse_auftraege?id=eq.${id(feld)}&firma_id=eq.${firma}&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status }) });
      return zurueck(r.ok && r.daten.length ? "Gespeichert." : "Nichts geändert.");
    }
    return zurueck("Nichts geändert.");
  }
  const [j, i] = await Promise.all([
    db<Job[]>(f.s, env, `boerse_auftraege?select=id,firma_id,titel,gewerk,plz,ort,von,bis,beschreibung,status,ablauf,erstellt&order=erstellt.desc&limit=500`),
    db<Interesse[]>(f.s, env, `boerse_interessen?select=id,auftrag_id,firma_id,nachricht,status,erstellt&order=erstellt.desc&limit=1000`),
  ]);
  const jobs = j.ok ? j.daten : [], interessen = i.ok ? i.daten : [];
  const ids = [...new Set([...jobs.map((x) => x.firma_id), ...interessen.map((x) => x.firma_id)].filter((x) => x !== firma))];
  const n = ids.length ? await db<{ id: string; name: string }[]>(f.s, env, "rpc/boerse_firmennamen", { method: "POST", body: JSON.stringify({ ids }) }) : null;
  const angenommen = interessen.filter((x) => x.status === "angenommen").slice(0, 50);
  const kontakte = new Map<string, Kontakt>((await Promise.all(angenommen.map(async (x) => { const r = await db<Kontakt[]>(f.s, env, "rpc/boerse_kontakt", { method: "POST", body: JSON.stringify({ interesse: x.id }) }); return [x.id, r.ok ? r.daten[0] : undefined] as const; }))).filter((x): x is readonly [string, Kontakt] => !!x[1]));
  const hinweis = url.searchParams.get("hinweis");
  return html(seite("Auftragsbörse", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${boerseSeite({ firma, jobs, interessen, namen: new Map((n?.ok ? n.daten : []).map((x) => [x.id, x.name])), kontakte, gewerk: url.searchParams.get("gewerk") ?? "", darf, heute })}`, 0, "team"), 200, f.s.cookies);
}
