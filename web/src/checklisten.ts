// T25: Einstieg und Austritt. A checklist per person (contract, social security, instruction, equipment, app access …;
// when leaving: access blocked, keys and equipment back, certificate …). Points can be ticked off and added.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Punkt = { id: string; personal_id: string; art: string; titel: string; reihenfolge: number; erledigt: string | null };
type Person = { id: string; vorname: string; nachname: string; eintritt: string | null; austritt_am: string | null; status: string; firmenwagen?: boolean };
export const VORLAGEN: Record<string, string[]> = {
  einstieg: ["Arbeitsvertrag unterschrieben", "Personalfragebogen ausgefüllt", "Sozialversicherungsnummer und Krankenkasse ans Lohnbüro", "Steuer-ID ans Lohnbüro", "Bankverbindung ans Lohnbüro (nicht in Jarvis)", "Aufenthaltstitel / Arbeitserlaubnis geprüft (falls nötig)", "Sofortmeldung bei der Rentenversicherung (falls Branche es verlangt)", "Erstunterweisung Arbeitsschutz", "Schutzausrüstung ausgegeben", "Führerschein kontrolliert (falls Firmenfahrzeug)", "App-Zugang eingerichtet und mit Personalakte verknüpft"],
  austritt: ["Kündigung / Aufhebungsvertrag schriftlich", "Resturlaub und Überstunden geklärt", "Schutzausrüstung, Kleidung und Schlüssel zurück", "Firmenfahrzeug, Tankkarte, Werkzeug zurück", "App-Zugang gesperrt", "Abmeldung bei der Sozialversicherung (Lohnbüro)", "Arbeitsbescheinigung erstellt", "Arbeitszeugnis erstellt", "Offene Schichten neu besetzt"],
};
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const name = (p: Pick<Person, "vorname" | "nachname">) => `${p.vorname} ${p.nachname}`.trim();

export function checklistenSeite(punkte: Punkt[], personen: Person[], o: { darfAendern: boolean; heute: string }): string {
  const gruppen = [...new Set(punkte.map((p) => `${p.personal_id}|${p.art}`))].map((k) => { const [pid, art] = k.split("|"); return { pid, art, l: punkte.filter((p) => p.personal_id === pid && p.art === art).sort((a, b) => a.reihenfolge - b.reihenfolge) }; });
  const offen = gruppen.filter((g) => g.l.some((p) => !p.erledigt)), fertig = gruppen.filter((g) => g.l.every((p) => p.erledigt));
  const karte = (g: (typeof gruppen)[number], auf: boolean) => {
    const p = personen.find((x) => x.id === g.pid), n = g.l.filter((x) => x.erledigt).length;
    return `<details class="checkliste"${auf ? " open" : ""}><summary><strong>${g.art === "einstieg" ? "👋" : "🚪"} ${escape(p ? name(p) : "?")}</strong><span class="klein">${g.art === "einstieg" ? `Einstieg${p?.eintritt ? ` am ${datum(p.eintritt)}` : ""}` : `Austritt${p?.austritt_am ? ` am ${datum(p.austritt_am)}` : ""}`} · ${n} von ${g.l.length} erledigt</span><span class="profil-balken"><span style="width:${Math.round((n / g.l.length) * 100)}%"></span></span></summary>
<ul class="aufgaben-liste">${g.l.map((x) => `<li class="aufgabe${x.erledigt ? " erledigt" : ""}">${o.darfAendern ? `<form method="post" action="/konto/checklisten"><input type="hidden" name="id" value="${x.id}"><button name="aktion" value="${x.erledigt ? "offen" : "erledigt"}" class="aufgabe-haken" aria-label="${x.erledigt ? "Wieder öffnen" : "Erledigt"}">${x.erledigt ? "☑" : "☐"}</button></form>` : `<span class="aufgabe-haken">${x.erledigt ? "☑" : "☐"}</span>`}<div><span class="aufgabe-titel">${escape(x.titel)}</span>${x.erledigt ? `<span class="klein">erledigt ${datum(x.erledigt.slice(0, 10))}</span>` : x.titel.startsWith("App-Zugang") ? `<span class="klein"><a href="/konto/team#app-zugaenge">→ App-Zugänge</a></span>` : x.titel.startsWith("Schutzausrüstung") ? `<span class="klein"><a href="/konto/psa">→ Schutzausrüstung</a></span>` : x.titel.startsWith("Führerschein") ? `<span class="klein"><a href="/konto/personalfristen">→ Führerscheinkontrolle</a></span>` : ""}</div>${o.darfAendern ? `<form method="post" action="/konto/checklisten"><input type="hidden" name="id" value="${x.id}"><button name="aktion" value="weg" class="zweit" aria-label="Punkt entfernen">✕</button></form>` : ""}</li>`).join("")}</ul>
${o.darfAendern ? `<form method="post" action="/konto/checklisten" class="zeile-form"><input type="hidden" name="aktion" value="punkt"><input type="hidden" name="person" value="${g.pid}"><input type="hidden" name="art" value="${g.art}"><label>Weiterer Punkt<input name="titel" maxlength="160" required></label><button class="zweit">➕</button></form>` : ""}</details>`;
  };
  const start = o.darfAendern ? `<details class="termin-neu"${gruppen.length ? "" : " open"}><summary>➕ Checkliste starten</summary><form method="post" action="/konto/checklisten"><input type="hidden" name="aktion" value="start"><div class="aueg-form">
<label class="ganz">Person<select name="person" required>${personen.map((p) => `<option value="${p.id}">${escape(name(p))}</option>`).join("")}</select></label>
<label>Art<select name="art"><option value="einstieg">👋 Einstieg</option><option value="austritt">🚪 Austritt</option></select></label><label>Datum (Eintritt / Austritt)<input type="date" name="datum" value="${o.heute}"></label></div><button>Starten</button><p class="klein">Jarvis legt die üblichen Punkte an; eigene Punkte kannst du ergänzen. Beim Austritt wird das Austrittsdatum in der Personalakte vermerkt.</p></form></details>` : "";
  return `${start}${offen.length ? `<h2>Offen</h2>${offen.map((g) => karte(g, offen.length <= 2)).join("")}` : `<p class="klein">✅ Keine offenen Checklisten.</p>`}${fertig.length ? `<h2>Erledigt</h2>${fertig.map((g) => karte(g, false)).join("")}` : ""}`;
}

export async function checklisten(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/checklisten") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Einstieg & Austritt", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/checklisten?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Ändern dürfen Bearbeiter, Standortleitungen und Admins.");
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const id = /^[0-9a-f-]{36}$/.test(t("id", 36)) ? t("id", 36) : "", pid = /^[0-9a-f-]{36}$/.test(t("person", 36)) ? t("person", 36) : "", art = t("art", 10) === "austritt" ? "austritt" : "einstieg";
    const aktion = t("aktion", 10);
    if (id && ["erledigt", "offen"].includes(aktion)) {
      await db(f.s, env, `checklisten_punkte?id=eq.${id}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(aktion === "erledigt" ? { erledigt: new Date().toISOString(), erledigt_von: f.s.userId } : { erledigt: null, erledigt_von: null }) });
      return weiterleiten("/konto/checklisten", f.s.cookies);
    }
    if (id && aktion === "weg") { await db(f.s, env, `checklisten_punkte?id=eq.${id}&firma_id=eq.${firma}`, { method: "DELETE" }); return weiterleiten("/konto/checklisten", f.s.cookies); }
    if (!pid) return zurueck("Bitte eine Person wählen.");
    if (aktion === "punkt") {
      const r = await db(f.s, env, "checklisten_punkte", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: pid, art, titel: t("titel", 160), reihenfolge: 999 }) });
      return zurueck(r.ok ? "Punkt ergänzt." : "Das hat nicht geklappt.");
    }
    if (aktion === "start") {
      const da = await db<{ id: string }[]>(f.s, env, `checklisten_punkte?firma_id=eq.${firma}&personal_id=eq.${pid}&art=eq.${art}&select=id&limit=1`);
      if (da.ok && da.daten.length) return zurueck("Diese Checkliste gibt es für die Person schon.");
      const d = /^\d{4}-\d{2}-\d{2}$/.test(t("datum", 10)) ? t("datum", 10) : null;
      const r = await db(f.s, env, "checklisten_punkte", { method: "POST", body: JSON.stringify(VORLAGEN[art].map((titel, i) => ({ firma_id: firma, personal_id: pid, art, titel, reihenfolge: i }))) });
      if (r.ok && d) await db(f.s, env, `personal?id=eq.${pid}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify(art === "austritt" ? { austritt_am: d } : { eintritt: d }) });
      return zurueck(r.ok ? `Checkliste ${art === "austritt" ? "Austritt" : "Einstieg"} angelegt.` : "Anlegen hat nicht geklappt. Hast du Rechte für den Standort dieser Person?");
    }
    return zurueck("Unbekannte Aktion.");
  }
  const [pk, p] = await Promise.all([
    db<Punkt[]>(f.s, env, `checklisten_punkte?firma_id=eq.${firma}&select=id,personal_id,art,titel,reihenfolge,erledigt&order=reihenfolge&limit=5000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,eintritt,austritt_am,status&order=vorname&limit=3000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${checklistenSeite(pk.ok ? pk.daten : [], p.ok ? p.daten : [], { darfAendern, heute })}`);
}
