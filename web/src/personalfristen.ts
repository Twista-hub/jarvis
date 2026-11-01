// T20 Personalfristen (end of probation, fixed-term contracts, residence/work permit) and T21 Führerscheinkontrolle:
// people who drive company vehicles need a check of the original licence every six months (keeper liability).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { FRISTEN, fristen, plusTage } from "./personalakte.ts";
import { absatz, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";

export type FristPerson = { id: string; vorname: string; nachname: string; status: string; fuehrerschein: string[] | null; firmenwagen: boolean; probezeit_bis: string | null; befristet_bis: string | null; aufenthalt_bis: string | null };
export type Kontrolle = { id: string; personal_id: string; datum: string; klassen: string[]; notiz: string; geprueft_von: string | null };
export const INTERVALL_MONATE = 6;
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const plusMonate = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const name = (p: Pick<FristPerson, "vorname" | "nachname">) => `${p.vorname} ${p.nachname}`.trim();

export type KontrollStand = { person: FristPerson; letzte: Kontrolle | null; faellig: string | null; stufe: "rot" | "gelb" | "gruen" };
/** Drivers of company vehicles with last check and next due date: never checked or overdue = red, within 30 days = yellow. */
export function kontrollStaende(personen: FristPerson[], kontrollen: Kontrolle[], heute: string): KontrollStand[] {
  return personen.filter((p) => p.firmenwagen && p.status !== "nicht").map((p) => {
    const letzte = kontrollen.filter((k) => k.personal_id === p.id).sort((a, b) => b.datum.localeCompare(a.datum))[0] ?? null;
    const faellig = letzte ? plusMonate(letzte.datum, INTERVALL_MONATE) : null;
    return { person: p, letzte, faellig, stufe: !faellig || faellig < heute ? "rot" as const : faellig <= plusTage(heute, 30) ? "gelb" as const : "gruen" as const };
  }).sort((a, b) => (a.faellig ?? "0").localeCompare(b.faellig ?? "0"));
}

export function fristenSeite(personen: FristPerson[], kontrollen: Kontrolle[], o: { heute: string; darfAendern: boolean; pruefer: Record<string, string> }): string {
  const faellige = personen.filter((p) => p.status !== "nicht").flatMap((p) => fristen(p, o.heute).map((f) => ({ p, f }))).sort((a, b) => a.f.bis.localeCompare(b.f.bis));
  const spaeter = personen.flatMap((p) => FRISTEN.map(([feld, icon, text]) => ({ p, feld, icon, text, bis: p[feld] as string | null }))).filter((x) => x.bis && x.bis >= o.heute && !faellige.some((y) => y.p.id === x.p.id && y.f.feld === x.feld)).sort((a, b) => a.bis!.localeCompare(b.bis!));
  const st = kontrollStaende(personen, kontrollen, o.heute);
  const kontrollZeile = (k: KontrollStand) => `<li class="${k.stufe === "rot" ? "abgelaufen" : k.stufe === "gelb" ? "bald" : ""}"><div><strong>${escape(name(k.person))}</strong><span class="klein">${(k.person.fuehrerschein ?? []).length ? `🚗 ${escape((k.person.fuehrerschein ?? []).join(", "))} · ` : ""}${k.letzte ? `zuletzt ${datum(k.letzte.datum)}${o.pruefer[k.letzte.geprueft_von ?? ""] ? ` von ${escape(o.pruefer[k.letzte.geprueft_von!])}` : ""} · ${k.stufe === "rot" ? "⚠️ fällig seit" : "nächste"} ${datum(k.faellig!)}` : "⚠️ noch nie kontrolliert"}</span></div>${o.darfAendern ? `<form method="post" action="/konto/personalfristen" class="kontrolle-form"><input type="hidden" name="person" value="${k.person.id}"><input type="date" name="datum" value="${o.heute}" max="${o.heute}" aria-label="Datum der Kontrolle"><button>✓ Geprüft</button></form>` : ""}</li>`;
  return `<h2>⏳ Fristen in nächster Zeit</h2>
${faellige.length ? `<ul class="kontakt-liste zert-liste">${faellige.map(({ p, f }) => `<li class="${f.stufe === "rot" ? "abgelaufen" : "bald"}"><div><strong>${escape(name(p))}</strong><span class="klein">${f.icon} ${f.text} ${datum(f.bis)}${f.bis < o.heute ? " · abgelaufen" : ""}</span></div></li>`).join("")}</ul>` : `<p class="klein">✅ Keine Probezeit, Befristung oder Aufenthaltserlaubnis läuft bald ab.</p>`}
${spaeter.length ? `<details><summary class="klein">Alle weiteren eingetragenen Fristen (${spaeter.length})</summary><ul class="kontakt-liste">${spaeter.slice(0, 200).map((x) => `<li><span>${escape(name(x.p))}</span><span class="klein">${x.icon} ${x.text} ${datum(x.bis!)}</span></li>`).join("")}</ul></details>` : ""}
<p class="klein">Fristen trägst du in der Personalakte der Person ein (✏️ Bearbeiten → 📁 Personalakte → ⏳ Fristen). Vorwarnung: Probezeit 30, Befristung 60, Aufenthaltstitel 90 Tage.</p>
<h2>🚗 Führerscheinkontrolle</h2>
<p class="klein">Wer Firmenfahrzeuge fährt, zeigt alle ${INTERVALL_MONATE} Monate den Original-Führerschein (Halterhaftung, § 21 StVG). Eine Kopie ist nicht nötig; Jarvis speichert nur Datum, Klassen und wer geprüft hat.</p>
${st.length ? `<ul class="kontakt-liste zert-liste kontroll-liste">${st.map(kontrollZeile).join("")}</ul><p><a class="knopf zweit" href="/konto/personalfristen/fuehrerschein.docx" download>📄 Nachweis als Word</a></p>` : `<p class="treffer-leer">Noch niemand als Fahrer markiert. In der Personalakte „Fährt Firmenfahrzeuge“ ankreuzen.</p>`}`;
}

export function kontrollDocx(firma: string, st: KontrollStand[], kontrollen: Kontrolle[], pruefer: Record<string, string>, heute: string): Uint8Array {
  const zeilen = st.flatMap((k) => { const l = kontrollen.filter((x) => x.personal_id === k.person.id).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 4); return l.length ? l.map((x, i) => [i ? "" : name(k.person), (x.klassen.length ? x.klassen : k.person.fuehrerschein ?? []).join(", "), datum(x.datum), pruefer[x.geprueft_von ?? ""] ?? "", i ? "" : k.faellig ? datum(k.faellig) : ""]) : [[name(k.person), (k.person.fuehrerschein ?? []).join(", "), "noch nie", "", "sofort"]]; });
  return wordDokument(ueberschrift("Nachweis Führerscheinkontrolle", 30) + absatz(firma, { fett: true }) + absatz(`Stand: ${datum(heute)} · Kontrolle des Original-Führerscheins alle ${INTERVALL_MONATE} Monate (Halterhaftung, § 21 StVG)`, { grau: true, groesse: 18, abstand: 200 })
    + tabelle([["Fahrer/in", "Klassen", "Geprüft am", "Geprüft von", "Nächste Kontrolle"], ...zeilen], [2600, 1400, 1500, 2200, 1900], true)
    + absatz("", { abstand: 400 }) + absatz("______________________________\nUnterschrift Fuhrparkverantwortliche/r", { abstand: 200 }));
}

export async function personalfristen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/personalfristen" && url.pathname !== "/konto/personalfristen/fuehrerschein.docx") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Personalfristen", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort("<p>Das sieht das Büroteam.</p>", 403);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/personalfristen?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Eintragen dürfen Bearbeiter, Standortleitungen und Admins.");
    const pid = String(form.get("person") ?? ""), d = String(form.get("datum") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(pid) || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > heute || d < plusTage(heute, -366)) return zurueck("Bitte ein Datum bis heute wählen.");
    const p = await db<{ fuehrerschein: string[] | null; vorname: string }[]>(f.s, env, `personal?id=eq.${pid}&firma_id=eq.${firma}&select=fuehrerschein,vorname`);
    if (!p.ok || !p.daten.length) return zurueck("Person nicht gefunden.");
    const r = await db(f.s, env, "fuehrerschein_kontrollen", { method: "POST", body: JSON.stringify({ firma_id: firma, personal_id: pid, datum: d, klassen: p.daten[0].fuehrerschein ?? [], geprueft_von: f.s.userId }) });
    return zurueck(r.ok ? `Kontrolle für ${p.daten[0].vorname} eingetragen. Nächste in ${INTERVALL_MONATE} Monaten.` : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?");
  }
  const [p, k, m, fn] = await Promise.all([
    db<FristPerson[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status,fuehrerschein,firmenwagen,probezeit_bis,befristet_bis,aufenthalt_bis&order=vorname&limit=3000`),
    db<Kontrolle[]>(f.s, env, `fuehrerschein_kontrollen?firma_id=eq.${firma}&select=id,personal_id,datum,klassen,notiz,geprueft_von&order=datum.desc&limit=5000`),
    db<{ user_id: string; anzeigename: string | null }[]>(f.s, env, `mitglieder?firma_id=eq.${firma}&select=user_id,anzeigename`),
    db<{ name: string }[]>(f.s, env, `firmen?id=eq.${firma}&select=name`),
  ]);
  const pruefer = Object.fromEntries((m.ok ? m.daten : []).map((x) => [x.user_id, x.anzeigename || ""]));
  const personen = p.ok ? p.daten : [], kontrollen = k.ok ? k.daten : [];
  if (url.pathname.endsWith(".docx")) return wordAntwort(kontrollDocx(fn.ok ? fn.daten[0]?.name ?? "" : "", kontrollStaende(personen, kontrollen, heute), kontrollen, pruefer, heute), `Fuehrerscheinkontrolle_${heute}.docx`, f.s.cookies);
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${fristenSeite(personen, kontrollen, { heute, darfAendern, pruefer })}`);
}
