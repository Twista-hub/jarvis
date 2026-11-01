// N11: Nachunternehmer & Partner. The firm's own partner firms per trade, and requests per tender and lot with status.
// Jarvis sends nothing: "Anfrage per Mail" opens the user's own mail program with a prepared text.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, vorgangZugriff, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Partner = { id: string; name: string; gewerke: string[]; ansprechpartner: string; telefon: string; email: string; region: string; bewertung: number | null; notiz: string };
export type Anfrage = { id: string; partner_id: string; los: string; status: "angefragt" | "angebot" | "zugesagt" | "abgesagt"; notiz: string; erstellt: string };
export const ANFRAGE_STATUS: Record<Anfrage["status"], string> = { angefragt: "📨 Angefragt", angebot: "💬 Angebot liegt vor", zugesagt: "✅ Zugesagt", abgesagt: "❌ Abgesagt" };
export const GEWERKE = ["Elektro", "Sanitär", "Heizung", "Lüftung", "Trockenbau", "Maler", "Fliesen", "Bodenbelag", "Dach", "Gerüst", "Tischler", "Metallbau", "Garten- und Landschaftsbau", "Reinigung", "Sicherheitsdienst", "Catering", "Personal"];

export const gewerkeAus = (t: string) => [...new Set(t.split(/[,;\n]/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 2).map((x) => x.slice(0, 60)))].slice(0, 20);
const sterne = (n: number | null) => n ? `${"★".repeat(n)}${"☆".repeat(5 - n)}` : "";
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Prepared request mail to the partner (opened in the user's own mail program). */
export function anfrageMail(p: Pick<Partner, "email" | "ansprechpartner">, v: { titel: string; frist: string | null }, los: string, firma: string): string {
  const frist = v.frist ? new Date(v.frist).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "";
  const betreff = `Anfrage Nachunternehmerleistung: ${v.titel}${los ? ` (${los})` : ""}`.slice(0, 200);
  const text = `${p.ansprechpartner ? `Guten Tag ${p.ansprechpartner}` : "Guten Tag"},\n\nwir möchten uns an der öffentlichen Ausschreibung „${v.titel}“ beteiligen${los ? ` und suchen für ${los} einen Partner` : ""}. Hätten Sie Interesse und Kapazität, die Leistung als Nachunternehmer zu übernehmen?\n\n${frist ? `Die Angebotsfrist ist am ${frist}. ` : ""}Für ein Angebot schicken wir Ihnen gern die Unterlagen.\n\nViele Grüße\n${firma}`;
  return `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
}

export function partnerSeite(liste: Partner[], o: { darfAendern: boolean; gewerk: string; q: string; offen?: string; anzahl: Map<string, number> }): string {
  const alleGewerke = [...new Set(liste.flatMap((p) => p.gewerke))].sort((a, b) => a.localeCompare(b, "de"));
  const such = o.q.trim().toLowerCase();
  const gezeigt = liste.filter((p) => (!o.gewerk || p.gewerke.includes(o.gewerk)) && (!such || `${p.name} ${p.region} ${p.gewerke.join(" ")} ${p.ansprechpartner}`.toLowerCase().includes(such)));
  const chips = alleGewerke.length > 1 ? `<nav class="ordner-chips" aria-label="Gewerk"><a href="/konto/partner"${o.gewerk ? "" : ' aria-current="true"'}>Alle <span>${liste.length}</span></a>${alleGewerke.map((g) => `<a href="/konto/partner?gewerk=${encodeURIComponent(g)}"${g === o.gewerk ? ' aria-current="true"' : ""}>${escape(g)} <span>${liste.filter((p) => p.gewerke.includes(g)).length}</span></a>`).join("")}</nav>` : "";
  const form = (p?: Partner) => `<form method="post" action="/konto/partner">${p ? `<input type="hidden" name="id" value="${p.id}">` : ""}<div class="aueg-form">
<label class="ganz">Firma<input name="name" required maxlength="200" value="${escape(p?.name ?? "")}"></label>
<label class="ganz">Gewerke (mit Komma)<input name="gewerke" maxlength="600" list="gewerke-liste" value="${escape(p?.gewerke.join(", ") ?? "")}" placeholder="z. B. Elektro, Brandmeldeanlagen"></label>
<label>Ansprechpartner<input name="ansprechpartner" maxlength="200" value="${escape(p?.ansprechpartner ?? "")}"></label><label>Region<input name="region" maxlength="200" value="${escape(p?.region ?? "")}" placeholder="z. B. Aachen, 50 km"></label>
<label>Telefon<input name="telefon" type="tel" maxlength="60" value="${escape(p?.telefon ?? "")}"></label><label>E-Mail<input name="email" type="email" maxlength="200" value="${escape(p?.email ?? "")}"></label>
<label>Bewertung<select name="bewertung"><option value="">keine</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${p?.bewertung === n ? " selected" : ""}>${sterne(n)}</option>`).join("")}</select></label>
<label class="ganz">Notiz<input name="notiz" maxlength="1000" value="${escape(p?.notiz ?? "")}" placeholder="z. B. zuverlässig, Präqualifikation vorhanden"></label></div>
<div class="baustein-knoepfe"><button>${p ? "Speichern" : "Partner anlegen"}</button>${p ? `<button name="loeschen" value="${p.id}" class="zweit" formnovalidate>Löschen</button>` : ""}</div></form>`;
  const karte = (p: Partner) => `<li><details${o.offen === p.id ? " open" : ""}><summary><strong>${escape(p.name)}</strong>${p.bewertung ? ` <span class="partner-sterne" aria-label="${p.bewertung} von 5 Sternen">${sterne(p.bewertung)}</span>` : ""}<span class="klein">${[p.gewerke.map(escape).join(", "), p.region && `📍 ${escape(p.region)}`, o.anzahl.get(p.id) ? `${o.anzahl.get(p.id)} ${o.anzahl.get(p.id) === 1 ? "Anfrage" : "Anfragen"}` : ""].filter(Boolean).join(" · ")}</span><span class="klein">${[p.ansprechpartner && `👤 ${escape(p.ansprechpartner)}`, p.telefon && `📞 ${escape(p.telefon)}`, p.email && `✉️ ${escape(p.email)}`].filter(Boolean).join(" · ")}</span></summary>${o.darfAendern ? form(p) : p.notiz ? `<p class="klein">📝 ${escape(p.notiz)}</p>` : ""}</details></li>`;
  return `<p class="klein">Eure Nachunternehmer und Partnerbetriebe. In jeder Ausschreibung könnt ihr sie pro Los anfragen und den Stand festhalten. Nur eure Firma sieht diese Liste.</p>
<datalist id="gewerke-liste">${GEWERKE.map((g) => `<option value="${g}">`).join("")}</datalist>
<form method="get" class="such-zeile"><label class="sr-only" for="partner-suche">Partner suchen</label>${o.gewerk ? `<input type="hidden" name="gewerk" value="${escape(o.gewerk)}">` : ""}<input id="partner-suche" name="q" value="${escape(o.q)}" placeholder="Name, Gewerk oder Region" maxlength="100"><button>Suchen</button></form>
${chips}${gezeigt.length ? `<ul class="baustein-liste partner-liste">${gezeigt.map(karte).join("")}</ul>` : `<p class="treffer-leer">${liste.length ? "Kein Partner passt zur Auswahl." : "Noch keine Partner eingetragen."}</p>`}
${o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ Partner eintragen</summary>${form()}</details>` : ""}`;
}

/** Section on the tender page: requests per lot with status; prices only with finance rights. */
export function partnerTeilHtml(v: { id: string; titel: string; frist: string | null }, partner: Partner[], anfragen: Anfrage[], o: { preise: Map<string, number> | null; darfAendern: boolean; firma: string }): string {
  const name = (id: string) => partner.find((p) => p.id === id);
  const zeile = (a: Anfrage) => {
    const p = name(a.partner_id);
    const preis = o.preise?.get(a.id);
    return `<li class="anfrage-zeile status-${a.status}"><div><strong>${escape(p?.name ?? "Partner")}</strong><span class="klein">${a.los ? `${escape(a.los)} · ` : ""}${ANFRAGE_STATUS[a.status]}${preis !== undefined ? ` · ${euro(preis)}` : ""}${p?.telefon ? ` · 📞 ${escape(p.telefon)}` : ""}</span>${a.notiz ? `<span class="klein">📝 ${escape(a.notiz)}</span>` : ""}</div>
${o.darfAendern ? `<div class="frage-aktionen">${p?.email && a.status === "angefragt" ? `<a class="anfrage-mail" href="${escape(anfrageMail(p, v, a.los, o.firma))}">✉️ Mail</a>` : ""}<details><summary>Stand</summary><form method="post" action="/konto/vorgang/${v.id}/partner"><input type="hidden" name="id" value="${a.id}"><input type="hidden" name="aktion" value="stand"><label>Stand<select name="status">${(Object.entries(ANFRAGE_STATUS) as [Anfrage["status"], string][]).map(([k, t]) => `<option value="${k}"${k === a.status ? " selected" : ""}>${t}</option>`).join("")}</select></label>${o.preise ? `<label>Preis des Partners (€ netto)<input name="preis" inputmode="decimal" value="${preis ?? ""}"></label>` : ""}<label>Notiz<input name="notiz" maxlength="1000" value="${escape(a.notiz)}"></label><button>Speichern</button></form></details><form method="post" action="/konto/vorgang/${v.id}/partner"><input type="hidden" name="id" value="${a.id}"><button name="aktion" value="loeschen" class="zweit" aria-label="Anfrage löschen">✕</button></form></div>` : ""}</li>`;
  };
  const neu = o.darfAendern ? (partner.length ? `<form method="post" action="/konto/vorgang/${v.id}/partner" class="anfrage-neu"><input type="hidden" name="aktion" value="neu"><div class="aueg-form"><label>Partner<select name="partner" required>${partner.map((p) => `<option value="${p.id}">${escape(p.name)}${p.gewerke.length ? ` (${escape(p.gewerke.slice(0, 2).join(", "))})` : ""}</option>`).join("")}</select></label><label>Los oder Leistung<input name="los" maxlength="200" placeholder="z. B. Los 2 Elektro"></label></div><button>Anfrage festhalten</button></form>` : `<p class="klein">Noch keine Partner. <a href="/konto/partner">Partner eintragen</a></p>`) : "";
  const zugesagt = anfragen.filter((a) => a.status === "zugesagt").length;
  return `<h2 id="partner">🤝 Nachunternehmer <span class="klein">${anfragen.length ? `${anfragen.length} angefragt${zugesagt ? ` · ${zugesagt} zugesagt` : ""}` : ""}</span></h2>${anfragen.length ? `<ul class="frage-liste">${anfragen.map(zeile).join("")}</ul>` : ""}${neu}<p class="klein">Nachunternehmer müssen oft im Angebot benannt werden (Nachunternehmerverzeichnis). „✉️ Mail“ öffnet dein Mailprogramm mit einem vorbereiteten Text; Jarvis verschickt nichts selbst.</p>`;
}

export async function partnerTeil(s: Sitzung, env: KontoEnv, v: { id: string; titel: string; frist: string | null; firma_id: string }, rolle: string, finanzen: boolean, firma: string): Promise<string> {
  if (rolle === "mitarbeiter") return "";
  const [p, a] = await Promise.all([
    db<Partner[]>(s, env, `partner?firma_id=eq.${v.firma_id}&select=id,name,gewerke,ansprechpartner,telefon,email,region,bewertung,notiz&order=name&limit=500`),
    db<Anfrage[]>(s, env, `partner_anfragen?vorgang_id=eq.${v.id}&select=id,partner_id,los,status,notiz,erstellt&order=erstellt&limit=100`),
  ]);
  const anfragen = a.ok ? a.daten : [];
  const preise = finanzen && anfragen.length ? await db<{ anfrage_id: string; preis: number | string }[]>(s, env, `partner_preise?anfrage_id=in.(${anfragen.map((x) => x.id).join(",")})&select=anfrage_id,preis`) : null;
  return partnerTeilHtml(v, p.ok ? p.daten : [], anfragen, { preise: finanzen ? new Map((preise?.ok ? preise.daten : []).map((x) => [x.anfrage_id, Number(x.preis)])) : null, darfAendern: !["leser", "mitarbeiter"].includes(rolle), firma });
}

export async function anfrageSpeichern(id: string, request: Request, env: KontoEnv): Promise<Response> {
  const z = await vorgangZugriff(request, env, id);
  if (!z) return weiterleiten("/konto");
  const form = await request.formData();
  const aktion = String(form.get("aktion") ?? ""), aid = String(form.get("id") ?? "");
  const uuid = (x: string) => /^[0-9a-f-]{36}$/.test(x);
  let ok = false;
  if (aktion === "neu" && uuid(String(form.get("partner") ?? ""))) {
    ok = (await db(z.s, env, "partner_anfragen", { method: "POST", body: JSON.stringify({ firma_id: z.v.firma_id, vorgang_id: id, partner_id: String(form.get("partner")), los: String(form.get("los") ?? "").trim().slice(0, 200) }) })).ok;
  } else if (aktion === "stand" && uuid(aid)) {
    const status = String(form.get("status") ?? "");
    if (status in ANFRAGE_STATUS) ok = (await db(z.s, env, `partner_anfragen?id=eq.${aid}&vorgang_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, notiz: String(form.get("notiz") ?? "").trim().slice(0, 1000), geaendert: new Date().toISOString() }) })).ok;
    if (ok && z.finanzen && form.has("preis")) {
      const roh = String(form.get("preis") ?? "").trim().replace(/\s|€/g, "");
      const n = roh ? Number(roh.includes(",") ? roh.replace(/\./g, "").replace(",", ".") : roh) : null;
      if (n === null) await db(z.s, env, `partner_preise?anfrage_id=eq.${aid}`, { method: "DELETE" });
      else if (Number.isFinite(n) && n >= 0 && n < 1e11) await db(z.s, env, "partner_preise?on_conflict=firma_id,anfrage_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: z.v.firma_id, anfrage_id: aid, preis: n, geaendert: new Date().toISOString() }) });
    }
  } else if (aktion === "loeschen" && uuid(aid)) {
    ok = (await db(z.s, env, `partner_anfragen?id=eq.${aid}&vorgang_id=eq.${id}`, { method: "DELETE" })).ok;
  }
  return weiterleiten(`/konto/vorgang/${id}${ok ? "" : `?fehler=${encodeURIComponent("Die Anfrage konnte nicht gespeichert werden.")}`}#partner`, z.s.cookies);
}

export async function partnerVerwalten(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/partner") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Nachunternehmer & Partner", `<p class="konto-zurueck"><a href="/konto/einstellungen" aria-label="Zurück">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Die Partnerliste sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string, offen = "") => weiterleiten(`/konto/partner?hinweis=${encodeURIComponent(h)}${offen ? `&offen=${offen}` : ""}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Inhaber, Admins, Bearbeiter und Standortleitungen.");
    const uuid = (k: string) => { const v = String(form.get(k) ?? ""); return /^[0-9a-f-]{36}$/.test(v) ? v : ""; };
    if (uuid("loeschen")) {
      const r = await db(f.s, env, `partner?id=eq.${uuid("loeschen")}&firma_id=eq.${firma}`, { method: "DELETE" });
      return zurueck(r.ok ? "Partner gelöscht." : "Löschen hat nicht geklappt.");
    }
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const bew = Number(form.get("bewertung"));
    const zeile = { name: t("name", 200), gewerke: gewerkeAus(String(form.get("gewerke") ?? "")), ansprechpartner: t("ansprechpartner", 200), telefon: t("telefon", 60), email: t("email", 200), region: t("region", 200), bewertung: bew >= 1 && bew <= 5 ? bew : null, notiz: t("notiz", 1000) };
    if (zeile.name.length < 2 || (zeile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(zeile.email))) return zurueck("Bitte einen Firmennamen und eine gültige E-Mail angeben.");
    const r = uuid("id")
      ? await db(f.s, env, `partner?id=eq.${uuid("id")}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(zeile) })
      : await db(f.s, env, "partner", { method: "POST", body: JSON.stringify({ ...zeile, firma_id: firma }) });
    return zurueck(r.ok ? "Partner gespeichert." : "Speichern hat nicht geklappt.", uuid("id"));
  }
  const [p, a] = await Promise.all([
    db<Partner[]>(f.s, env, `partner?firma_id=eq.${firma}&select=id,name,gewerke,ansprechpartner,telefon,email,region,bewertung,notiz&order=name&limit=500`),
    db<{ partner_id: string }[]>(f.s, env, `partner_anfragen?firma_id=eq.${firma}&select=partner_id&limit=5000`),
  ]);
  const anzahl = new Map<string, number>();
  for (const x of a.ok ? a.daten : []) anzahl.set(x.partner_id, (anzahl.get(x.partner_id) ?? 0) + 1);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${partnerSeite(p.ok ? p.daten : [], { darfAendern, gewerk: url.searchParams.get("gewerk") ?? "", q: url.searchParams.get("q") ?? "", offen: url.searchParams.get("offen") ?? "", anzahl })}`);
}
