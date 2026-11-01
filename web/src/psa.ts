// T23: Schutzausrüstung (PSA). What was issued to whom, in which size and when, the replacement date and returns;
// an issue record as Word to sign. Staff see their own equipment.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { absatz, tabelle, ueberschrift, wordAntwort, wordDokument } from "./word.ts";

export type Psa = { id: string; personal_id: string; artikel: string; groesse: string; menge: number; ausgegeben: string; austausch: string | null; zurueck: string | null; notiz: string };
type Person = { id: string; vorname: string; nachname: string; status: string };
export const PSA_ARTIKEL = ["Sicherheitsschuhe S3", "Sicherheitsschuhe S1P", "Warnweste", "Schutzhelm", "Arbeitshandschuhe", "Schnittschutzhandschuhe", "Gehörschutz", "Schutzbrille", "Arbeitshose", "Arbeitsjacke", "Wetterschutzjacke", "Dienstkleidung / Shirt", "Kochjacke", "Schürze", "Atemschutzmaske FFP2", "Auffanggurt (PSAgA)"];
const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const stufe = (p: Pick<Psa, "austausch" | "zurueck">, heute: string) => p.zurueck || !p.austausch ? "" : p.austausch < heute ? "rot" : p.austausch <= plusTage(heute, 30) ? "gelb" : "";
const name = (p: Pick<Person, "vorname" | "nachname">) => `${p.vorname} ${p.nachname}`.trim();

/** Last size per item and person (as a hint when issuing again). */
export function groessen(liste: Psa[], personal: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const p of [...liste].filter((x) => x.personal_id === personal && x.groesse).sort((a, b) => a.ausgegeben.localeCompare(b.ausgegeben))) r[p.artikel] = p.groesse;
  return r;
}

export function psaSeite(liste: Psa[], personen: Person[], o: { heute: string; darfAendern: boolean }): string {
  const aktiv = liste.filter((p) => !p.zurueck);
  const faellig = aktiv.filter((p) => stufe(p, o.heute)).sort((a, b) => (a.austausch ?? "").localeCompare(b.austausch ?? ""));
  const pName = (id: string) => { const p = personen.find((x) => x.id === id); return p ? name(p) : "?"; };
  const zeile = (p: Psa, mitName: boolean) => { const st = stufe(p, o.heute); return `<li class="${st === "rot" ? "abgelaufen" : st === "gelb" ? "bald" : ""}"><div><strong>${mitName ? `${escape(pName(p.personal_id))} · ` : ""}${escape(p.artikel)}${p.groesse ? ` <span class="klein">Gr. ${escape(p.groesse)}</span>` : ""}${p.menge > 1 ? ` <span class="klein">× ${p.menge}</span>` : ""}</strong><span class="klein">ausgegeben ${datum(p.ausgegeben)}${p.austausch ? ` · ${st === "rot" ? "⚠️ Austausch fällig seit" : "Austausch"} ${datum(p.austausch)}` : ""}${p.notiz ? ` · ${escape(p.notiz)}` : ""}</span></div>${o.darfAendern ? `<form method="post" action="/konto/psa"><input type="hidden" name="zurueck" value="${p.id}"><button class="zweit" title="Zurückgegeben">↩︎</button></form>` : ""}</li>`; };
  const proPerson = personen.filter((p) => aktiv.some((x) => x.personal_id === p.id)).map((p) => `<details class="psa-person"><summary><strong>${escape(name(p))}</strong><span class="klein">${aktiv.filter((x) => x.personal_id === p.id).length} Teile${aktiv.some((x) => x.personal_id === p.id && stufe(x, o.heute)) ? " · ⚠️ Austausch" : ""}</span></summary><ul class="kontakt-liste zert-liste">${aktiv.filter((x) => x.personal_id === p.id).map((x) => zeile(x, false)).join("")}</ul><p><a class="knopf zweit" href="/konto/psa/${p.id}.docx" download>📄 Ausgabeprotokoll (Word)</a></p></details>`).join("");
  const form = o.darfAendern ? `<details class="termin-neu"${liste.length ? "" : " open"}><summary>➕ PSA ausgeben</summary><form method="post" action="/konto/psa"><div class="aueg-form">
<label class="ganz">Person<select name="person" required>${personen.filter((p) => p.status !== "nicht").map((p) => `<option value="${p.id}">${escape(name(p))}</option>`).join("")}</select></label>
<label class="ganz">Artikel<input name="artikel" required maxlength="120" list="psa-artikel"></label><datalist id="psa-artikel">${PSA_ARTIKEL.map((a) => `<option value="${a}">`).join("")}</datalist>
<label>Größe<input name="groesse" maxlength="20" placeholder="z. B. 43, L"></label><label>Menge<input name="menge" type="number" min="1" max="99" value="1"></label>
<label>Ausgegeben am<input name="ausgegeben" type="date" required value="${o.heute}"></label><label>Austausch am<input name="austausch" type="date" value="${plusTage(o.heute, 365)}"></label>
<label class="ganz">Notiz<input name="notiz" maxlength="300"></label></div><button>Ausgabe speichern</button></form></details>` : "";
  return `<p class="klein">Ausgegebene Schutzausrüstung mit Größe und Austauschtermin. Jarvis warnt 30 Tage vorher. Das Ausgabeprotokoll unterschreibt die Person bei der Übergabe (Nachweis nach PSA-Benutzungsverordnung).</p>
${faellig.length ? `<h2>⚠️ Austausch fällig</h2><ul class="kontakt-liste zert-liste">${faellig.map((p) => zeile(p, true)).join("")}</ul>` : liste.length ? `<p class="klein">✅ Kein Austausch in den nächsten 30 Tagen.</p>` : ""}${form}
${proPerson ? `<h2>Pro Person</h2>${proPerson}` : `<p class="treffer-leer">Noch keine Ausgabe eingetragen.</p>`}`;
}

export function meinePsaTeil(liste: Psa[], heute: string): string {
  const l = liste.filter((p) => !p.zurueck);
  return l.length ? `<section><h3>🦺 Meine Schutzausrüstung</h3><ul class="kontakt-liste ich-liste">${l.map((p) => `<li class="${stufe(p, heute) === "rot" ? "abgelaufen" : stufe(p, heute) === "gelb" ? "bald" : ""}"><div><strong>${escape(p.artikel)}${p.groesse ? ` <span class="klein">Gr. ${escape(p.groesse)}</span>` : ""}</strong><span class="klein">seit ${datum(p.ausgegeben)}${p.austausch ? ` · Austausch ${datum(p.austausch)}` : ""}</span></div></li>`).join("")}</ul></section>` : "";
}

export function psaDocx(firma: string, p: Pick<Person, "vorname" | "nachname">, liste: Psa[], heute: string): Uint8Array {
  return wordDokument(ueberschrift("Ausgabeprotokoll Persönliche Schutzausrüstung", 28) + absatz(firma, { fett: true }) + absatz(`Mitarbeiter/in: ${name(p)} · Stand ${datum(heute)}`, { abstand: 200 })
    + tabelle([["Artikel", "Größe", "Menge", "Ausgegeben", "Austausch"], ...liste.map((x) => [x.artikel, x.groesse, String(x.menge), datum(x.ausgegeben), x.austausch ? datum(x.austausch) : ""])], [3600, 1100, 900, 2000, 2000], true)
    + absatz("", { abstand: 160 }) + absatz("Ich habe die oben aufgeführte Schutzausrüstung erhalten, bin in die Benutzung unterwiesen worden und werde sie bestimmungsgemäß tragen. Beschädigungen oder Verlust melde ich sofort.", { abstand: 600 })
    + absatz("______________________________          ______________________________\nOrt, Datum, Unterschrift Mitarbeiter/in              Unterschrift Arbeitgeber", { abstand: 200 }));
}

export async function psa(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const docx = url.pathname.match(/^\/konto\/psa\/([0-9a-f-]{36})\.docx$/);
  if (url.pathname !== "/konto/psa" && !docx) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const antwort = (t: string, status = 200) => html(seite("Schutzausrüstung", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${t}`, 0, "team"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto/ich", f.s.cookies);
  const firma = f.m.firma_id;
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (request.method === "POST") {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/psa?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    if (!darfAendern) return zurueck("Eintragen dürfen Bearbeiter, Standortleitungen und Admins.");
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const d = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(t(k, 10)) ? t(k, 10) : null;
    if (/^[0-9a-f-]{36}$/.test(t("zurueck", 36))) {
      const r = await db(f.s, env, `psa_ausgaben?id=eq.${t("zurueck", 36)}&firma_id=eq.${firma}`, { method: "PATCH", body: JSON.stringify({ zurueck: heute }) });
      return zurueck(r.ok ? "Als zurückgegeben vermerkt." : "Das hat nicht geklappt.");
    }
    const zeile = { firma_id: firma, personal_id: t("person", 36), artikel: t("artikel", 120), groesse: t("groesse", 20), menge: Math.min(99, Math.max(1, Math.round(Number(t("menge", 2)) || 1))), ausgegeben: d("ausgegeben") ?? heute, austausch: d("austausch"), notiz: t("notiz", 300) };
    if (!/^[0-9a-f-]{36}$/.test(zeile.personal_id) || zeile.artikel.length < 2) return zurueck("Bitte Person und Artikel angeben.");
    const r = await db(f.s, env, "psa_ausgaben", { method: "POST", body: JSON.stringify(zeile) });
    return zurueck(r.ok ? "Ausgabe gespeichert." : "Speichern hat nicht geklappt. Hast du Rechte für den Standort dieser Person?");
  }
  const [l, p] = await Promise.all([
    db<Psa[]>(f.s, env, `psa_ausgaben?firma_id=eq.${firma}&select=id,personal_id,artikel,groesse,menge,ausgegeben,austausch,zurueck,notiz&order=ausgegeben.desc&limit=5000`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,status&order=vorname&limit=3000`),
  ]);
  const liste = l.ok ? l.daten : [], personen = p.ok ? p.daten : [];
  if (docx) {
    const person = personen.find((x) => x.id === docx[1]);
    if (!person) return antwort("<p>Person nicht gefunden.</p>", 404);
    const fn = await db<{ name: string }[]>(f.s, env, `firmen?id=eq.${firma}&select=name`);
    return wordAntwort(psaDocx(fn.ok ? fn.daten[0]?.name ?? "" : "", person, liste.filter((x) => x.personal_id === person.id && !x.zurueck), heute), `PSA_${name(person).replace(/[^\wäöüÄÖÜß-]+/g, "_")}.docx`, f.s.cookies);
  }
  const hinweis = url.searchParams.get("hinweis");
  return antwort(`${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${psaSeite(liste, personen, { heute, darfAendern })}`);
}
