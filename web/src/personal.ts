// Personnel per location: tiles for the locations on "Firma & Team", one page per location with the workers
// as cards (occupations, qualifications, wage group, phone, availability), and a message page that writes
// a ready text (optionally about a tender) and opens WhatsApp, SMS or e-mail on the phone. Crewtender sends nothing itself.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { akteAusFormular, akteFelder, akteZeile, nachweiseLaden, nachweisMarken, nachweisTeil, type Akte, type Nachweis } from "./personalakte.ts";
import { bereicheLaden, db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { bereichPfad } from "./bereiche.ts";
import { escape, hilfe, seite } from "./seite.ts";
import { GVP, lohnAm } from "./tarife.ts";
import { euro } from "./kalkulation.ts";
import { auegLaden, fristen as auegFristen, personHinweise } from "./aueg.ts";

export type Kraft = Akte & { foto?: boolean; id: string; firma_id: string; bereich_id: string | null; vorname: string; nachname: string; berufe: string[]; qualifikationen: string[]; tarifvertrag_id: string | null; eg: string; telefon: string; email: string; status: string; notiz: string };
export type Tarifvertrag = { id: string; name: string; geltungsbereich?: string; gruppen: string[]; quelle?: string; quelle_url?: string; gueltig_ab?: string | null; gueltig_bis?: string | null; vorgegeben?: boolean; tarifart?: string; gruppenart?: string; berufe?: string[]; datenstand?: string | null; datenstatus?: string; hinweis?: string };
type AppMitglied = { user_id: string; rolle: string; anzeigename: string; funktion: string };

export function standortleitungBlock(bereich: string, mitglieder: AppMitglied[], zuordnungen: { user_id: string; bereich_id: string }[], admin: boolean): string {
  const ids = zuordnungen.filter((z) => z.bereich_id === bereich).map((z) => z.user_id);
  const leitung = mitglieder.filter((m) => m.rolle === "standortleitung" && ids.includes(m.user_id)).map((m) => m.anzeigename || m.funktion || "Standortleitung").join(", ");
  const text = `Standortleitung: ${escape(leitung || "noch nicht zugeordnet")}`;
  if (!admin) return `<p class="standort-leitung">${text}</p>`;
  const wahl = mitglieder.filter((m) => ["bearbeiter", "leser", "mitarbeiter", "standortleitung"].includes(m.rolle) && !(m.rolle === "standortleitung" && zuordnungen.some((z) => z.user_id === m.user_id && z.bereich_id !== bereich)));
  return `<details class="leitung-zuordnen"><summary>${text} · ${leitung ? "Ergänzen" : "Zuordnen"}</summary>${wahl.length ? `<form method="post" action="/konto/standort/${bereich}/leitung"><label>Person auswählen<select name="person" required><option value="">Bitte auswählen …</option>${wahl.map((m) => `<option value="${escape(m.user_id)}"${ids.includes(m.user_id) && m.rolle === "standortleitung" ? " selected" : ""}>${escape(m.anzeigename || m.funktion || "Teammitglied")}</option>`).join("")}</select></label><p class="klein">Die Person erhält Personal- und Einsatzrechte für diesen Standort. Ihre bisherige Bereichszuordnung wird ersetzt; Finanzzugriff entfällt.</p><button>Als Standortleitung zuordnen</button></form>` : `<p>Noch kein passender App-Zugang vorhanden.</p>`}<p class="klein"><a href="/konto/team#app-zugaenge">Neue Person einladen oder App-Zugänge verwalten</a></p></details>`;
}

/** G4: contact person of a location, with call and mail links; the administration edits it right here. */
export function kontaktBlock(b: Bereich, admin: boolean): string {
  const da = !!(b.ansprechpartner || b.telefon || b.email);
  const zeile = da ? `<p class="standort-kontakt"><span>☎️ <strong>${escape(b.ansprechpartner || "Ansprechpartner")}</strong></span>${b.telefon ? `<a class="knopf-klein" href="tel:${escape(b.telefon.replace(/[^\d+]/g, ""))}">📞 ${escape(b.telefon)}</a>` : ""}${b.email ? `<a class="knopf-klein" href="mailto:${escape(b.email)}">📧 E-Mail</a>` : ""}</p>` : "";
  if (!admin) return zeile;
  return `${zeile}<details class="kontakt-bearbeiten"><summary>${da ? "✏️ Ansprechpartner ändern" : "☎️ Ansprechpartner für diesen Standort eintragen"}</summary><form method="post" action="/konto/standort/${b.id}/kontakt" class="kontakt-form"><label class="ganz">Name<input name="ansprechpartner" maxlength="120" value="${escape(b.ansprechpartner ?? "")}" placeholder="z. B. Anna Berg, Disposition"></label><label>Telefon<input name="telefon" type="tel" maxlength="40" value="${escape(b.telefon ?? "")}"></label><label>E-Mail<input name="email" type="email" maxlength="200" value="${escape(b.email ?? "")}"></label><button class="ganz">Speichern</button></form></details>`;
}

import { BERUFE } from "./berufe.ts";
export { BERUFE } from "./berufe.ts";

export const QUALIFIKATIONEN = [
  "Führerschein B", "Führerschein BE", "Führerschein C/CE", "Führerschein D/DE", "Staplerschein", "Kranschein", "Hubarbeitsbühne",
  "Gesundheitszeugnis (§ 43 IfSG)", "Hygienebelehrung", "Erste Hilfe", "Brandschutzhelfer/in", "Arbeitsschutzunterweisung", "PSA gegen Absturz",
  "Sachkunde § 34a", "Waffensachkunde", "AEVO / Ausbildereignung", "Elektrofachkraft", "Schweißprüfung", "Schweißverfahren MIG/MAG", "Schweißverfahren WIG",
  "Pflegebasiskurs", "Behandlungspflege LG 1/2", "Betreuungskraft § 43b", "Masernschutz nachgewiesen", "Infektionsschutzbelehrung",
  "MS Office", "Excel", "SAP", "DATEV", "ERP-Systeme", "Bürokommunikation", "Datenschutz-Unterweisung",
  "Deutsch fließend", "Deutsch Grundkenntnisse", "Englisch", "Erweitertes Führungszeugnis", "Schichtbereit", "Wochenendbereit", "Eigenes Auto",
];
export const STATUS: Record<string, [string, string]> = { verfuegbar: ["🟢", "Verfügbar"], einsatz: ["🔵", "Im Einsatz"], nicht: ["⚪", "Nicht verfügbar"] };
export const EINSATZ: Record<string, [string, string]> = { geplant: ["📌", "Eingeplant"], angefragt: ["📨", "Angefragt"], zugesagt: ["✅", "Zugesagt"], abgesagt: ["❌", "Abgesagt"] };
export type Einsatz = { id: string; personal_id: string; vorgang_id: string; status: string; vorgaenge?: { titel: string } | null };
const ID = /^[0-9a-f-]{36}$/;

// G2: absences with a period. Neutral reasons only (no health data).
/** Columns of public.personal everyone with access may read. Note, birthday and residence permit come only through
 *  rpc/personal_sicht, which blanks them for readers (Rechtsprüfung D1, migration 20261108120000). */
export const KRAFT_SPALTEN = "id,firma_id,bereich_id,vorname,nachname,berufe,qualifikationen,eg,telefon,email,status,erstellt,tarifvertrag_id,foto,eintritt,beschaeftigung,wochenstunden,fuehrerschein,sprachen,wohn_plz,user_id,probezeit_bis,befristet_bis,firmenwagen,austritt_am,personalnummer,arbeitstage";
export type Abwesenheit = { id: string; personal_id: string; von: string; bis: string; grund: string; notiz: string; status?: string };
export const GRUENDE: Record<string, [string, string]> = { urlaub: ["🌴", "Urlaub"], schulung: ["🎓", "Schulung"], abwesend: ["⏸️", "Nicht verfügbar"] };
const tagMonat = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
export const heuteIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
/** Absence today, if any. */
export function abwesendAm(abw: Abwesenheit[], personal: string, tag = heuteIso()): Abwesenheit | undefined {
  return abw.find((a) => a.personal_id === personal && a.status !== "beantragt" && a.von <= tag && a.bis >= tag);
}
export function zeitraumText(a: Pick<Abwesenheit, "von" | "bis">): string {
  return a.von === a.bis ? tagMonat(a.von) : `${tagMonat(a.von)}–${tagMonat(a.bis)}`;
}

// G3: initials in a colour that stays the same for a person; a photo when one is stored.
const FARBEN = ["#1f5f8b", "#2e8b57", "#8e44ad", "#c0392b", "#d35400", "#16a085", "#7f6a00", "#34495e"];
export function avatar(name: string, schluessel: string, foto?: string, klasse = "person-avatar"): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const initialen = ((teile[0]?.[0] ?? "?") + (teile.length > 1 ? teile[teile.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (const c of schluessel) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return foto
    ? `<img class="${klasse} foto" src="${escape(foto)}" alt="" loading="lazy" width="44" height="44">`
    : `<span class="${klasse}" style="background:${FARBEN[h % FARBEN.length]}" aria-hidden="true">${escape(initialen)}</span>`;
}

/** Form → absence; null when the period is missing or invalid. */
export function abwesenheitAusFormular(f: FormData): { von: string; bis: string; grund: string; notiz: string } | null {
  const datum = (k: string) => { const v = String(f.get(k) ?? ""); const d = new Date(`${v}T12:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null; };
  const von = datum("von"), bis = datum("bis") ?? datum("von");
  const grund = String(f.get("grund") ?? "urlaub");
  if (!von || !bis || bis < von || (Date.parse(bis) - Date.parse(von)) / 86400_000 > 366) return null;
  return { von, bis, grund: GRUENDE[grund] ? grund : "urlaub", notiz: String(f.get("notiz") ?? "").trim().slice(0, 200) };
}

/** Image type by its first bytes (not by the name or the browser's claim). */
export function bildTyp(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Absence list and form inside "Bearbeiten". */
function abwesenheitTeil(k: Kraft, abw: Abwesenheit[], darfAendern: boolean): string {
  const eigene = abw.filter((a) => a.personal_id === k.id).sort((a, b) => a.von.localeCompare(b.von));
  const liste = eigene.length ? `<ul class="abwesenheit-liste">${eigene.map((a) => `<li${a.status === "beantragt" ? ' class="beantragt"' : ""}><span>${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[0]} ${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[1]} ${zeitraumText(a)}${a.status === "beantragt" ? " · ⏳ beantragt" : ""}${a.notiz ? ` · ${escape(a.notiz)}` : ""}</span>${darfAendern ? `${a.status === "beantragt" ? `<form method="post" action="/konto/personal/${k.id}/abwesenheit" class="termin-weg"><input type="hidden" name="bestaetigen" value="${a.id}"><button class="zweit" aria-label="Antrag bestätigen">✓ OK</button></form>` : ""}<form method="post" action="/konto/personal/${k.id}/abwesenheit" class="termin-weg"><input type="hidden" name="loeschen" value="${a.id}"><button class="zweit" aria-label="${a.status === "beantragt" ? "Antrag ablehnen" : "Abwesenheit löschen"}">✕</button></form>` : ""}</li>`).join("")}</ul>` : "";
  if (!darfAendern) return liste;
  return `<div class="abwesenheit-teil"><h4>📅 Abwesenheiten</h4>${liste}<form method="post" action="/konto/personal/${k.id}/abwesenheit" class="abwesenheit-form"><label>Von<input type="date" name="von" required></label><label>Bis<input type="date" name="bis" required></label><label>Grund<select name="grund">${Object.entries(GRUENDE).map(([w, [i, t]]) => `<option value="${w}">${i} ${t}</option>`).join("")}</select></label><button class="zweit">Eintragen</button></form><p class="klein">Bitte keine Gesundheitsangaben: Für Krankheit „Nicht verfügbar“ wählen.</p></div>`;
}

/** Photo upload inside "Bearbeiten" (JPG/PNG/WebP, max. 1 MB). */
function fotoTeil(k: Kraft): string {
  return `<div class="foto-teil"><h4>🖼️ Foto (freiwillig)</h4><form method="post" action="/konto/personal/${k.id}/foto" enctype="multipart/form-data" class="foto-form"><input type="file" name="foto" accept="image/jpeg,image/png,image/webp" required aria-label="Foto auswählen"><button class="zweit">Hochladen</button></form>${k.foto ? `<form method="post" action="/konto/personal/${k.id}/foto" class="termin-weg"><input type="hidden" name="loeschen" value="1"><button class="zweit gefahr">Foto entfernen</button></form>` : ""}<p class="klein">Nur mit Einverständnis der Person. Höchstens 1 MB; sichtbar nur für Mitglieder mit Zugriff auf den Standort.</p></div>`;
}

/** Phone number for wa.me: digits only, German numbers with country code. */
export function waNummer(tel: string): string {
  let n = tel.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = `49${n.slice(1)}`;
  return n.replace(/\D/g, "");
}

/** Tenders that mention one of the person's occupations in the title come first (⭐). */
export function passt(titel: string, berufe: string[]): boolean {
  const t = titel.toLowerCase();
  return berufe.some((b) => b.toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length >= 5).some((w) => t.includes(w.slice(0, 6).replace(/(in|en|er)$/, ""))));
}

export function nachrichtText(k: Pick<Kraft, "vorname">, firma: string, vorgang?: { titel: string; frist: string | null }): string {
  const einsatz = vorgang
    ? `wir hätten voraussichtlich einen Einsatz für dich: „${vorgang.titel}“.${vorgang.frist ? ` Wir bewerben uns bis ${new Date(vorgang.frist).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}.` : ""}\n\nHättest du grundsätzlich Zeit und Interesse? Dann melde dich kurz zurück.`
    : "hättest du in den nächsten Wochen Zeit für einen Einsatz? Melde dich kurz zurück, dann besprechen wir die Details.";
  return `Hallo ${k.vorname},\n\n${einsatz}\n\nViele Grüße\n${firma}`;
}

function egOptionen(tarife: Tarifvertrag[], tarifvertragId: string, gewaehlt: string): string {
  const heute = new Date().toISOString().slice(0, 10);
  return `<option value="">Entgeltgruppe wählen …</option>${tarife.flatMap((t) => t.gruppen.map((g) => `<option value="${escape(g)}" data-tarifvertrag="${escape(t.id)}"${t.id !== tarifvertragId ? " disabled" : ""}${t.id === tarifvertragId && g === gewaehlt ? " selected" : ""}>${t.name === GVP.name && GVP.gruppen.includes(g) ? `EG ${escape(g)} · ${euro(lohnAm(g, heute, 0))}/Std.` : `${escape(t.gruppenart ?? "Gruppe")}: ${escape(g)}`}</option>`)).join("")}`;
}

function chips(name: string, liste: string[], gewaehlt: string[]): string {
  return `<div class="chips">${liste.map((x) => `<label><input type="checkbox" name="${name}" value="${escape(x)}"${gewaehlt.includes(x) ? " checked" : ""}><span>${escape(x)}</span></label>`).join("")}</div>`;
}

export function kraftFormular(k: Partial<Kraft>, aktion: string, knopf: string, qualifikationen: string[] = QUALIFIKATIONEN, tarife: Tarifvertrag[] = []): string {
  const eigene = (k.berufe ?? []).filter((b) => !Object.values(BERUFE).flat().includes(b));
  const tarifvertragId = k.tarifvertrag_id ?? "";
  return `<form method="post" action="${aktion}" class="personal-form">
  <div class="zwei"><label>Vorname<input name="vorname" required maxlength="100" autocomplete="off" value="${escape(k.vorname ?? "")}"></label>
  <label>Nachname<input name="nachname" maxlength="100" autocomplete="off" value="${escape(k.nachname ?? "")}"></label></div>
  <div class="zwei"><label>Telefon<input name="telefon" type="tel" maxlength="40" placeholder="0170 1234567" value="${escape(k.telefon ?? "")}"></label>
  <label>E-Mail (freiwillig)<input name="email" type="email" maxlength="200" value="${escape(k.email ?? "")}"></label></div>
  <div class="zwei"><label>Status<select name="status">${Object.entries(STATUS).map(([v, [i, t]]) => `<option value="${v}"${(k.status ?? "verfuegbar") === v ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label>
  <label>Tarifvertrag<select name="tarifvertrag" required data-tarifvertrag><option value="">Tarifvertrag wählen …</option>${tarife.map((t) => `<option value="${t.id}"${t.id === tarifvertragId ? " selected" : ""}>${escape(t.name)}${t.geltungsbereich ? ` · ${escape(t.geltungsbereich)}` : ""}</option>`).join("")}</select></label>
  <label>Entgeltgruppe<select name="eg" data-tarifgruppen><option value="">${tarifvertragId ? "Entgeltgruppe wählen …" : "Erst Tarifvertrag wählen …"}</option>${egOptionen(tarife, tarifvertragId, k.eg ?? "")}</select></label></div>
  <p class="klein">Hinterlegt sind ${tarife.length === 1 ? "1 Tarif-/Mindestlohneintrag" : `${tarife.length} Tarif-/Mindestlohneinträge`} mit belegten Gruppen. Geltungsbereich und tatsächliche Eingruppierung bitte am verlinkten Vertrag prüfen. <a href="/konto/team#tarifvertraege">Tarifverträge ansehen</a></p>
  <fieldset><legend>Berufe</legend>${Object.entries(BERUFE).map(([gruppe, liste]) => `<details${liste.some((b) => k.berufe?.includes(b)) ? " open" : ""}><summary>${escape(gruppe)}</summary>${chips("berufe", liste, k.berufe ?? [])}</details>`).join("")}
  <label>Weitere Berufe (mit Komma trennen)<input name="weitere" maxlength="200" value="${escape(eigene.join(", "))}"></label></fieldset>
  <details class="qualifikationen-dropdown"><summary>Qualifikationen auswählen <span aria-hidden="true">›</span></summary>${chips("qualifikationen", qualifikationen, k.qualifikationen ?? [])}</details>
  <label>Notiz (freiwillig)<textarea name="notiz" maxlength="500" rows="2" placeholder="z. B. nur Frühschicht, Einsatzradius 30 km">${escape(k.notiz ?? "")}</textarea></label>
  ${akteFelder(k)}
  <button>${knopf}</button>
</form>`;
}

export function ausFormular(f: FormData, qualifikationen: string[] = QUALIFIKATIONEN, tarife: Tarifvertrag[] = []): Omit<Kraft, "id" | "firma_id" | "bereich_id"> {
  const t = (k: string, max: number) => String(f.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const alle = Object.values(BERUFE).flat();
  const berufe = [...f.getAll("berufe").map(String).filter((b) => alle.includes(b)), ...t("weitere", 200).split(",").map((x) => x.trim()).filter(Boolean)].slice(0, 20);
  const status = t("status", 20);
  const tarifvertragId = t("tarifvertrag", 36);
  const tarifvertrag = tarife.find((x) => x.id === tarifvertragId);
  const eg = t("eg", 80);
  return {
    vorname: t("vorname", 100), nachname: t("nachname", 100), berufe: [...new Set(berufe)],
    qualifikationen: f.getAll("qualifikationen").map(String).filter((q) => qualifikationen.includes(q)),
    tarifvertrag_id: tarifvertrag?.id ?? null, eg: tarifvertrag?.gruppen.includes(eg) ? eg : "", telefon: t("telefon", 40), email: t("email", 200),
    status: STATUS[status] ? status : "verfuegbar", notiz: String(f.get("notiz") ?? "").trim().slice(0, 500),
    ...akteAusFormular(f),
  };
}

export function kraftKarte(k: Kraft, darfAendern: boolean, einsaetze: Einsatz[] = [], qualifikationen: string[] = QUALIFIKATIONEN, tarife: Tarifvertrag[] = [], abw: Abwesenheit[] = [], auegHinweis = "", nachweise: Nachweis[] = []): string {
  const eigeneNachweise = nachweise.filter((n) => n.personal_id === k.id);
  const heute = abwesendAm(abw, k.id);
  const [icon, text] = heute ? [(GRUENDE[heute.grund] ?? GRUENDE.abwesend)[0], `${(GRUENDE[heute.grund] ?? GRUENDE.abwesend)[1]} bis ${tagMonat(heute.bis)}`] : STATUS[k.status] ?? STATUS.verfuegbar;
  const name = `${k.vorname} ${k.nachname}`.trim();
  const bald = abw.filter((a) => a.personal_id === k.id && a !== heute && a.von > heuteIso() && a.von <= new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10));
  return `<article class="person-karte">
  <div class="person-kopf">${avatar(name, k.id, k.foto ? `/konto/personal/${k.id}/foto` : undefined)}<div><h3>${escape(name)}</h3><span class="status status-${heute ? "nicht" : k.status}">${icon} ${text}</span>${bald.length ? `<span class="klein abwesenheit-bald">${bald.map((a) => `${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[0]} ${zeitraumText(a)}${a.status === "beantragt" ? " (beantragt)" : ""}`).join(" · ")}</span>` : ""}</div>${darfAendern ? `<a class="stift" href="#bearbeiten-${k.id}" data-oeffne="bearbeiten-${k.id}" aria-label="${escape(name)} bearbeiten" title="Bearbeiten">✏️</a>` : ""}</div>
  ${k.berufe.length ? `<p class="person-berufe">${k.berufe.map((b) => `<span class="marke">${escape(b)}</span>`).join("")}</p>` : ""}
  ${k.qualifikationen.length || k.eg ? `<p class="klein">${[k.eg ? `${escape(tarife.find((t) => t.id === k.tarifvertrag_id)?.name ?? "Tarif")} · ${escape(k.eg)}` : "", ...k.qualifikationen.map(escape)].filter(Boolean).join(" · ")}</p>` : ""}
  ${akteZeile(k, heuteIso())}${nachweisMarken(eigeneNachweise, heuteIso())}
  ${k.notiz ? `<p class="klein">📝 ${escape(k.notiz)}</p>` : ""}
  ${auegHinweis ? `<p class="aueg-hinweis"><a href="/konto/aueg">${escape(auegHinweis)}</a></p>` : ""}
  ${einsaetze.length ? `<ul class="einsatz-kurz">${einsaetze.map((e) => `<li><a href="/konto/vorgang/${e.vorgang_id}#personal">${(EINSATZ[e.status] ?? EINSATZ.geplant)[0]} ${escape(e.vorgaenge?.titel ?? "Ausschreibung")}</a></li>`).join("")}</ul>` : ""}
  <div class="person-aktionen">${k.telefon ? `<a class="knopf-klein" href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">📞 Anrufen</a>` : ""}<a class="knopf-klein" href="/konto/personal/${k.id}/nachricht">💬 Nachricht</a></div>
  ${darfAendern ? `<details id="bearbeiten-${k.id}" class="bearbeiten"><summary>✏️ Bearbeiten</summary>${kraftFormular(k, `/konto/personal/${k.id}`, "Änderungen speichern", qualifikationen, tarife)}${abwesenheitTeil(k, abw, true)}${nachweisTeil(k.id, eigeneNachweise, heuteIso())}${fotoTeil(k)}<form method="post" action="/konto/personal/${k.id}"><input type="hidden" name="aktion" value="loeschen"><button class="knopf-leise">🗑️ Aus der Liste löschen</button></form></details>` : ""}
</article>`;
}

/** Tiles on "Firma & Team": one per location (grouped by region) with the number of available workers. */
export function standortKacheln(bereiche: Bereich[], personal: { id?: string; bereich_id: string | null; status: string }[], leitungen: { user_id: string; name: string; bereich_id: string }[] = [], abw: Abwesenheit[] = []): string {
  const zahl = (id: string | null) => {
    const p = personal.filter((x) => x.bereich_id === id);
    const weg = p.filter((x) => x.id && abwesendAm(abw, x.id)).length;
    return `${p.filter((x) => x.status === "verfuegbar" && !(x.id && abwesendAm(abw, x.id))).length} verfügbar${weg ? ` · ${weg} abwesend` : ""} · ${p.length} gesamt`;
  };
  // Compact rows instead of large tiles: name, staff available and the location head in one line.
  const kachel = (href: string, icon: string, titel: string, hinweis: string, id?: string) => { const leitung = id ? leitungen.find((x) => x.bereich_id === id) : undefined; const kontakt = id ? bereiche.find((x) => x.id === id) : undefined; return `<a class="standort-zeile" href="${href}"><span class="standort-icon" aria-hidden="true">${icon}</span><span class="standort-text"><strong>${escape(titel)}</strong><span class="klein">${hinweis} · ${leitung ? `👤 Leitung: ${escape(leitung.name)}` : "ohne Leitung"}${kontakt?.ansprechpartner || kontakt?.telefon ? ` · ☎️ ${escape([kontakt.ansprechpartner, kontakt.telefon].filter(Boolean).join(", "))}` : ""}</span></span><span class="konto-pfeil" aria-hidden="true">›</span></a>`; };
  if (!bereiche.length) return `<div class="standort-liste">${kachel("/konto/standort/firma", "🏢", "Ganze Firma", zahl(null))}</div>`;
  const oben = bereiche.filter((b) => !b.parent_id);
  const einzeln = oben.filter((b) => !bereiche.some((c) => c.parent_id === b.id));
  const gruppen = oben.filter((b) => bereiche.some((c) => c.parent_id === b.id));
  const ohne = personal.some((x) => !x.bereich_id) ? kachel("/konto/standort/firma", "🏢", "Ohne Standort", zahl(null)) : "";
  return `${einzeln.length || ohne ? `<div class="standort-liste">${einzeln.map((b) => kachel(`/konto/standort/${b.id}`, "📍", b.name, zahl(b.id), b.id)).join("")}${ohne}</div>` : ""}
${gruppen.map((g) => `<section class="org-region"><h3>${escape(g.name)}</h3><div class="standort-liste">${[g, ...bereiche.filter((c) => c.parent_id === g.id)].map((b) => kachel(`/konto/standort/${b.id}`, b.id === g.id ? "🗺️" : "📍", b.id === g.id ? `${b.name} (Region)` : b.name, zahl(b.id), b.id)).join("")}</div></section>`).join("")}`;
}

export function qualifikationenBlock(bereich: string | null, liste: { id: string; name: string; bereich_id: string | null }[], darfAendern: boolean): string {
  const passend = liste.filter((q) => q.bereich_id === bereich);
  return `<details class="qualifikationen-verwalten"><summary>🧰 Qualifikationen verwalten</summary><p class="klein">Eigene Qualifikationen erscheinen nur hier${bereich ? " am Standort" : " in der Firma"} und können bei Einsatzkräften ausgewählt werden.</p>${darfAendern ? `<form method="post" action="/konto/qualifikation"><input type="hidden" name="bereich" value="${bereich ?? ""}"><label>Neue Qualifikation<input name="name" required minlength="2" maxlength="80" placeholder="z. B. Ersthelfer-Ausbildung"></label><button>Qualifikation hinzufügen</button></form>` : ""}${passend.length ? `<ul>${passend.map((q) => `<li>${escape(q.name)}${darfAendern ? ` <form method="post" action="/konto/qualifikation" class="inline-form"><input type="hidden" name="aktion" value="loeschen"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="bereich" value="${bereich ?? ""}"><button class="knopf-leise" aria-label="${escape(q.name)} entfernen">Entfernen</button></form>` : ""}</li>`).join("")}</ul>` : `<p class="klein">Noch keine eigenen Qualifikationen angelegt.</p>`}</details>`;
}

export function tarifvertraegeBlock(tarife: Tarifvertrag[], darfAendern: boolean): string {
  const datum = (d?: string | null) => d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" }) : "offen";
  const vertrag = (t: Tarifvertrag) => `<li><details><summary><strong>${escape(t.name)}</strong>${t.geltungsbereich ? ` · ${escape(t.geltungsbereich)}` : ""}</summary><p class="klein">${escape(t.tarifart ?? "Tarifvertrag")} · ${escape(t.gruppenart ?? "Gruppe")} · gültig ${datum(t.gueltig_ab)} bis ${datum(t.gueltig_bis)}${t.datenstand ? ` · geprüft ${datum(t.datenstand)}` : ""}</p><p>${t.gruppen.map(escape).join(", ")}</p>${t.berufe?.length ? `<p class="klein">Berufsbezug: ${t.berufe.map(escape).join(", ")}</p>` : ""}${t.hinweis ? `<p class="klein">${escape(t.hinweis)}</p>` : ""}${t.quelle ? `<p class="klein">Quelle: ${t.quelle_url ? `<a href="${escape(t.quelle_url)}" target="_blank" rel="noopener">${escape(t.quelle)}</a>` : escape(t.quelle)}</p>` : ""}${t.datenstatus ? `<p class="klein">Datenstand: ${escape(t.datenstatus)}</p>` : ""}${!t.vorgegeben && darfAendern ? `<form method="post" action="/konto/tarifvertrag" class="inline-form"><input type="hidden" name="aktion" value="loeschen"><input type="hidden" name="id" value="${escape(t.id)}"><button class="knopf-leise" aria-label="${escape(t.name)} entfernen">Entfernen</button></form>` : ""}</details></li>`;
  return `<details class="tarifvertraege-verwalten" id="tarifvertraege"><summary>⚖️ Tarifverträge & Entgeltgruppen verwalten</summary><p class="klein">Der Katalog enthält nach Quelle und Region belegte Tarifwerke. NRW-Registerblätter belegen hier Gruppenanzahl und Laufzeit, nicht die Tätigkeitsmerkmale der einzelnen Gruppe. Eine Auswahl ersetzt deshalb keine Prüfung des Originalvertrags. Einträge ohne aktuelle Gruppentabelle erscheinen nicht im Mitarbeiterformular.</p>${tarife.length ? `<ul>${tarife.map(vertrag).join("")}</ul>` : "<p class=\"klein\">Keine Tarifverträge geladen.</p>"}${darfAendern ? `<form method="post" action="/konto/tarifvertrag"><label>Tarifvertrag<input name="name" required minlength="2" maxlength="160" placeholder="z. B. Tarifvertrag Elektrohandwerk NRW"></label><label>Geltungsbereich (Branche/Region)<input name="geltungsbereich" maxlength="240" placeholder="z. B. Elektrohandwerk · NRW"></label><label>Entgeltgruppen des Vertrags (durch Komma trennen)<input name="gruppen" required maxlength="1200" placeholder="z. B. EG 1, EG 2, EG 3"></label><div class="zwei"><label>Gültig ab<input name="gueltig_ab" type="date"></label><label>Gültig bis<input name="gueltig_bis" type="date"></label></div><label>Originalquelle/Vertragsfassung<input name="quelle" required maxlength="500" placeholder="z. B. Entgelttarifvertrag vom …, Link oder Dokument"></label><button>Tarifvertrag hinzufügen</button></form>` : ""}</details>`;
}

async function qualifikationenLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string, bereich: string | null): Promise<{ id: string; name: string; bereich_id: string | null }[]> {
  const r = await db<{ id: string; name: string; bereich_id: string | null }[]>(s, env, `firmen_qualifikationen?firma_id=eq.${firma}&select=id,name,bereich_id&order=name`);
  return r.ok ? r.daten.filter((q) => q.bereich_id === null || q.bereich_id === bereich) : [];
}

export async function tarifvertraegeLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Tarifvertrag[]> {
  const r = await db<Tarifvertrag[]>(s, env, `firmen_tarifvertraege?firma_id=eq.${firma}&select=id,name,geltungsbereich,gruppen,quelle,quelle_url,gueltig_ab,gueltig_bis,vorgegeben,tarifart,gruppenart,berufe,datenstand,datenstatus,hinweis&order=vorgegeben.desc,name`);
  if (r.ok) return r.daten;
  // Keep the existing employee form working during the brief window between web deploy and DB migration.
  const alt = await db<Tarifvertrag[]>(s, env, `firmen_tarifvertraege?firma_id=eq.${firma}&select=id,name,geltungsbereich,gruppen,quelle,gueltig_ab,gueltig_bis,vorgegeben&order=vorgegeben.desc,name`);
  return alt.ok ? alt.daten : [];
}

/** The personnel of one location: numbers, filter, cards and the add form (also shown directly on "Firma & Team"). */
export function personalTeil(alle: Kraft[], url: URL, darfAendern: boolean, aktion: string, einsaetze: Einsatz[] = [], eigeneQualifikationen: string[] = [], tarife: Tarifvertrag[] = [], abw: Abwesenheit[] = [], auegHinweise: Record<string, string> = {}, nachweise: Nachweis[] = []): string {
  // Filter by occupation and status (GET form, works without scripts).
  const beruf = url.searchParams.get("beruf") ?? "";
  const st = url.searchParams.get("status") ?? "";
  const qual = url.searchParams.get("qualifikation") ?? "";
  const gezeigt = alle.filter((k) => (!beruf || k.berufe.includes(beruf)) && (!st || (st === "verfuegbar" ? k.status === st && !abwesendAm(abw, k.id) : k.status === st)) && (!qual || k.qualifikationen.includes(qual)));
  const qualifikationen = [...new Set([...QUALIFIKATIONEN, ...eigeneQualifikationen, ...alle.flatMap((k) => k.qualifikationen)])].sort((a,b)=>a.localeCompare(b,"de"));
  const berufeHier = [...new Set(alle.flatMap((k) => k.berufe))].sort((a, c) => a.localeCompare(c, "de"));
  const filter = alle.length > 3 ? `<form method="get" class="filter-leiste"><label>Beruf<select name="beruf" data-sofort-wahl><option value="">Alle Berufe</option>${berufeHier.map((x) => `<option${x === beruf ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Qualifikation<select name="qualifikation" data-sofort-wahl><option value="">Alle Qualifikationen</option>${qualifikationen.map((x) => `<option${x === qual ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Status<select name="status" data-sofort-wahl><option value="">Alle</option>${Object.entries(STATUS).map(([v, [i, t]]) => `<option value="${v}"${v === st ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label><noscript><button>Filtern</button></noscript></form>` : "";
  const weg = alle.filter((k) => abwesendAm(abw, k.id)).length;
  return `<p class="klein">${alle.filter((k) => k.status === "verfuegbar" && !abwesendAm(abw, k.id)).length} verfügbar · ${alle.filter((k) => k.status === "einsatz").length} im Einsatz${weg ? ` · ${weg} abwesend` : ""} · ${alle.length} gesamt</p>
${alle.length || darfAendern ? `<nav class="aktionsleiste kompakt">${darfAendern ? `<a href="#neu" data-oeffne="neu">＋ Neue Person</a><a class="zweit" href="/konto/personal/import?bereich=${escape(aktion.split("/").pop() ?? "firma")}">📥 Excel-Import</a>` : ""}${alle.length ? `<a class="zweit" href="/konto/rundnachricht">📣 Anschreiben</a>` : ""}</nav>` : ""}
${hilfe("Welche Person soll ich eintragen?", "Erfasse nur Personen, die ihr für Einsätze einplant. Berufe helfen Crewtender, passende Kräfte für Ausschreibungen vorzuschlagen. Die Kontaktangaben nutzt dein Team direkt vom eigenen Gerät.")}
${filter}
<div class="personal-liste">${gezeigt.map((k) => kraftKarte(k, darfAendern, einsaetze.filter((e) => e.personal_id === k.id && e.status !== "abgesagt"), qualifikationen, tarife, abw, auegHinweise[k.id] ?? "", nachweise)).join("") || `<p>${alle.length ? "Niemand passt zu diesem Filter." : "Noch kein Personal eingetragen."}</p>`}</div>
${darfAendern ? `<details class="neu-person" id="neu"${alle.length ? "" : " open"}><summary>Person hinzufügen <span aria-hidden="true">+</span></summary>${kraftFormular({}, aktion, "Person speichern", qualifikationen, tarife)}</details>` : ""}
<p class="klein">Die Daten sieht nur, wer Zugriff auf diesen Standort hat. Trag nur ein, was für die Einsatzplanung nötig ist, und lösche Personen, die nicht mehr für euch arbeiten.</p>`;
}

export async function abwesenheitenLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Abwesenheit[]> {
  const r = await db<Abwesenheit[]>(s, env, `personal_abwesenheiten?firma_id=eq.${firma}&bis=gte.${heuteIso()}&select=id,personal_id,von,bis,grund,notiz,status&order=von&limit=1000`);
  return r.ok ? r.daten : [];
}

export async function einsaetzeLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Einsatz[]> {
  const r = await db<Einsatz[]>(s, env, `einsaetze?firma_id=eq.${firma}&select=id,personal_id,vorgang_id,status,vorgaenge(titel)`);
  return r.ok ? r.daten : [];
}

/** On a tender: the planned people with their status, and a dropdown to plan someone (matching and available first). */
export async function einsatzTeil(s: Parameters<typeof db>[0], env: KontoEnv, v: { id: string; firma_id: string; titel: string }, darfAendern: boolean): Promise<string> {
  const [geplant, pool, abw] = await Promise.all([
    db<(Einsatz & { personal: Kraft | null })[]>(s, env, `einsaetze?vorgang_id=eq.${v.id}&select=id,personal_id,vorgang_id,status,personal(${KRAFT_SPALTEN})&order=erstellt`),
    db<Kraft[]>(s, env, `personal?firma_id=eq.${v.firma_id}&select=${KRAFT_SPALTEN}&order=vorname`),
    abwesenheitenLaden(s, env, v.firma_id),
  ]);
  const liste = geplant.ok ? geplant.daten.filter((e) => e.personal) : [];
  const schon = new Set(liste.map((e) => e.personal_id));
  const frei = (pool.ok ? pool.daten : []).filter((k) => !schon.has(k.id))
    .map((k) => ({ k, rang: (passt(v.titel, k.berufe) ? 0 : 2) + (k.status === "verfuegbar" && !abwesendAm(abw, k.id) ? 0 : 1) + (abwesendAm(abw, k.id) ? 4 : 0) }))
    .sort((a, b) => a.rang - b.rang);
  const zeilen = liste.map((e) => {
    const k = e.personal!;
    const statusWahl = darfAendern
      ? `<form method="post" action="/konto/einsatz/${e.id}" class="einsatz-status"><select name="status" data-sofort-wahl aria-label="Stand für ${escape(k.vorname)}">${Object.entries(EINSATZ).map(([w, [i, t]]) => `<option value="${w}"${w === e.status ? " selected" : ""}>${i} ${t}</option>`).join("")}</select><noscript><button>OK</button></noscript></form>`
      : `<span>${(EINSATZ[e.status] ?? EINSATZ.geplant).join(" ")}</span>`;
    return `<li class="einsatz-zeile">${avatar(`${k.vorname} ${k.nachname}`, k.id, k.foto ? `/konto/personal/${k.id}/foto` : undefined, "person-avatar klein-avatar")}<div><strong>${escape(`${k.vorname} ${k.nachname}`.trim())}</strong><span class="klein">${escape(k.berufe.slice(0, 3).join(", ") || "ohne Beruf")}${(() => { const a = abwesendAm(abw, k.id); return a ? ` · ${(GRUENDE[a.grund] ?? GRUENDE.abwesend).join(" ")} bis ${tagMonat(a.bis)}` : ""; })()}</span></div>${statusWahl}<div class="person-aktionen">${k.telefon ? `<a class="knopf-klein" href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">📞</a>` : ""}<a class="knopf-klein" href="/konto/personal/${k.id}/nachricht?vorgang=${v.id}">💬 Nachricht</a>${darfAendern ? `<form method="post" action="/konto/einsatz/${e.id}"><input type="hidden" name="aktion" value="entfernen"><button class="knopf-leise" aria-label="${escape(k.vorname)} austragen">✕</button></form>` : ""}</div></li>`;
  }).join("");
  const zugesagt = liste.filter((e) => e.status === "zugesagt").length;
  const wahl = darfAendern && frei.length ? `<form method="post" action="/konto/vorgang/${v.id}/einsatz" class="einplanen"><label>Person einplanen<select name="personal" required><option value="">Bitte auswählen …</option>${frei.map(({ k }) => `<option value="${k.id}">${abwesendAm(abw, k.id) ? `${(GRUENDE[abwesendAm(abw, k.id)!.grund] ?? GRUENDE.abwesend)[0]} ` : k.status === "verfuegbar" ? "🟢 " : ""}${passt(v.titel, k.berufe) ? "⭐ " : ""}${escape(`${k.vorname} ${k.nachname}`.trim())}${k.berufe[0] ? ` · ${escape(k.berufe[0])}` : ""}${k.qualifikationen.length ? ` · ${escape(k.qualifikationen.slice(0, 2).join(", "))}` : ""}${k.status !== "verfuegbar" ? ` (${STATUS[k.status]?.[1] ?? k.status})` : ""}</option>`).join("")}</select></label><button>📌 Einplanen</button></form>` : "";
  const leer = pool.ok && !pool.daten.length ? `<p class="klein">Noch kein Personal eingetragen. <a href="/konto/team">Personal unter „Firma & Team“ anlegen →</a></p>` : "";
  return `<h2 id="personal">👷 Personal für diesen Auftrag</h2>${hilfe("Einplanung verstehen", "„Eingeplant“ ist erst eine Vormerkung. Ändere den Stand auf „Angefragt“, wenn du die Person kontaktiert hast, und auf „Zugesagt“, sobald sie den Einsatz bestätigt. ⭐ markiert passende Berufe.")}
<nav class="aktionsleiste"><a href="/konto/vorgang/${v.id}/einsatzplan">🗓️ Einsatzplan schicken</a><a class="zweit" href="/konto/rundnachricht?vorgang=${v.id}">📣 Mehrere anfragen</a></nav>
${liste.length ? `<p class="klein">${liste.length} eingeplant · ${zugesagt} zugesagt</p><ul class="einsatz-liste">${zeilen}</ul>` : `<p class="klein">Noch niemand eingeplant.</p>`}
${wahl}${leer}${frei.some(({ rang }) => rang === 0) ? `<p class="klein">⭐ Beruf passt zur Ausschreibung.</p>` : ""}`;
}

/** With at most one location everything lives on "Firma & Team", so changes lead back there. */
async function heimat(f: { s: Parameters<typeof db>[0]; m: { firma_id: string } }, env: KontoEnv, bereich: string | null): Promise<string> {
  const r = await db<{ id: string }[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id&limit=2`);
  return r.ok && r.daten.length <= 1 ? "/konto/team" : `/konto/standort/${bereich ?? "firma"}`;
}

export async function personal(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const leitungSetzen = url.pathname.match(/^\/konto\/standort\/([0-9a-f-]{36})\/leitung$/);
  if (leitungSetzen && request.method === "POST") {
    const f = await aktiveFirma(request, env);
    if (!f) return weiterleiten("/konto");
    const bid = leitungSetzen[1];
    const ziel = `/konto/standort/${bid}`;
    if (!["inhaber", "admin"].includes(f.m.rolle)) return html(seite("Nicht erlaubt", "<p>Nur Inhaber und Administration dürfen die Standortleitung zuordnen.</p>"), 403, f.s.cookies);
    const uid = String((await request.formData()).get("person") ?? "");
    if (!ID.test(uid)) return weiterleiten(`${ziel}?hinweis=Bitte%20eine%20Person%20auswählen.`, f.s.cookies);
    const r = await db<AppMitglied[]>(f.s, env, `mitglieder?firma_id=eq.${f.m.firma_id}&user_id=eq.${uid}&aktiv=eq.true&select=user_id,rolle,anzeigename,funktion`);
    const m = r.ok ? r.daten[0] : undefined;
    if (!m || !["bearbeiter", "leser", "mitarbeiter", "standortleitung"].includes(m.rolle)) return weiterleiten(`${ziel}?hinweis=Diese%20Person%20kann%20hier%20nicht%20zugeordnet%20werden.`, f.s.cookies);
    const bereiche = await db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id,name,art,parent_id`);
    if (!bereiche.ok || !bereiche.daten.some((b) => b.id === bid && b.art === "standort") || bereiche.daten.some((b) => b.parent_id === bid && b.art === "standort")) return weiterleiten(`${ziel}?hinweis=Bitte%20einen%20einzelnen%20Standort%20wählen.`, f.s.cookies);
    if (m.rolle === "standortleitung") {
      const z = await db<{ bereich_id: string }[]>(f.s, env, `mitglied_bereiche?firma_id=eq.${f.m.firma_id}&user_id=eq.${uid}&select=bereich_id`);
      if (!z.ok || z.daten.some((x) => x.bereich_id !== bid)) return weiterleiten(`${ziel}?hinweis=Diese%20Standortleitung%20ist%20bereits%20anderswo%20zugeordnet.`, f.s.cookies);
    }
    const result = await db(f.s, env, "rpc/mitglied_aktualisieren", { method: "POST", body: JSON.stringify({ f: f.m.firma_id, u: uid, n: m.anzeigename || "", funktion_neu: "Standortleitung", rolle_neu: "standortleitung", finanzen_neu: false, alle: false, bereiche: [bid] }) });
    return weiterleiten(`${ziel}?hinweis=${encodeURIComponent(result.ok ? "Standortleitung zugeordnet." : "Zuordnung nicht möglich. Bitte einen einzelnen Standort dieser Firma wählen.")}`, f.s.cookies);
  }
  const kontaktSetzen = url.pathname.match(/^\/konto\/standort\/([0-9a-f-]{36})\/kontakt$/);
  if (kontaktSetzen && request.method === "POST") {
    const f = await aktiveFirma(request, env);
    if (!f) return weiterleiten("/konto");
    const ziel = await heimat(f, env, kontaktSetzen[1]);
    if (!["inhaber", "admin"].includes(f.m.rolle)) return weiterleiten(`${ziel}?hinweis=${encodeURIComponent("Nur Inhaber und Administration können den Ansprechpartner ändern.")}`, f.s.cookies);
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    const email = t("email", 200);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return weiterleiten(`${ziel}?hinweis=${encodeURIComponent("Bitte eine gültige E-Mail-Adresse eintragen.")}`, f.s.cookies);
    const r = await db(f.s, env, `bereiche?id=eq.${kontaktSetzen[1]}&firma_id=eq.${f.m.firma_id}`, { method: "PATCH", body: JSON.stringify({ ansprechpartner: t("ansprechpartner", 120), telefon: t("telefon", 40), email }) });
    return weiterleiten(`${ziel}?hinweis=${encodeURIComponent(r.ok ? "Ansprechpartner gespeichert." : "Speichern hat nicht geklappt.")}`, f.s.cookies);
  }
  if (url.pathname === "/konto/tarifvertrag" && request.method === "POST") {
    const f = await aktiveFirma(request, env);
    if (!f) return weiterleiten("/konto");
    if (!["inhaber", "admin"].includes(f.m.rolle)) return weiterleiten("/konto/team?hinweis=Nur%20die%20Administration%20kann%20Tarifverträge%20verwalten.", f.s.cookies);
    const form = await request.formData();
    let ok = false;
    if (form.get("aktion") === "loeschen") {
      const id = String(form.get("id") ?? "");
      if (ID.test(id)) { const r = await db(f.s, env, `firmen_tarifvertraege?id=eq.${id}&firma_id=eq.${f.m.firma_id}&vorgegeben=eq.false`, { method: "DELETE" }); ok = r.ok; }
    } else {
      const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
      const geltungsbereich = String(form.get("geltungsbereich") ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
      const gruppen = [...new Set(String(form.get("gruppen") ?? "").split(/[;,\n]/).map((x) => x.trim().replace(/\s+/g, " ")).filter((x) => x.length > 0 && x.length <= 80))].slice(0, 30);
      const quelle = String(form.get("quelle") ?? "").trim().slice(0, 500);
      const ab = String(form.get("gueltig_ab") ?? "");
      const bis = String(form.get("gueltig_bis") ?? "");
      const datumGilt = (x: string) => {
        if (!x) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
        const d = new Date(`${x}T00:00:00.000Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
      };
      if (name.length >= 2 && quelle.length >= 3 && gruppen.length && form.get("gruppen") && datumGilt(ab) && datumGilt(bis) && (!ab || !bis || ab <= bis) && gruppen.length === String(form.get("gruppen") ?? "").split(/[;,\n]/).map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean).length) {
        const r = await db(f.s, env, "firmen_tarifvertraege", { method: "POST", body: JSON.stringify({ firma_id: f.m.firma_id, name, geltungsbereich, gruppen, quelle, gueltig_ab: ab || null, gueltig_bis: bis || null }) });
        ok = r.ok;
      }
    }
    return weiterleiten(`/konto/team?hinweis=${encodeURIComponent(ok ? "Tarifvertrag gespeichert." : "Tarifvertrag konnte nicht gespeichert oder entfernt werden. Prüfe doppelte Namen, Gruppen und ob Personen ihn noch verwenden.")}`, f.s.cookies);
  }
  if (url.pathname === "/konto/qualifikation" && request.method === "POST") {
    const f = await aktiveFirma(request, env);
    if (!f) return weiterleiten("/konto");
    const form = await request.formData();
    const bereich = String(form.get("bereich") ?? "");
    const ziel = bereich && ID.test(bereich) ? `/konto/standort/${bereich}` : "/konto/team";
    let ok = false;
    if (form.get("aktion") === "loeschen") {
      const id = String(form.get("id") ?? "");
      if (ID.test(id)) { const r = await db(f.s, env, `firmen_qualifikationen?id=eq.${id}&firma_id=eq.${f.m.firma_id}`, { method: "DELETE" }); ok = r.ok; }
    } else {
      const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (name.length >= 2 && (!bereich || ID.test(bereich))) {
        const r = await db(f.s, env, "firmen_qualifikationen", { method: "POST", body: JSON.stringify({ firma_id: f.m.firma_id, bereich_id: bereich || null, name, erstellt_von: f.s.userId }) });
        ok = r.ok;
      }
    }
    return weiterleiten(`${ziel}?hinweis=${encodeURIComponent(ok ? "Qualifikationen gespeichert." : "Die Qualifikation konnte nicht gespeichert werden. Prüfe Rechte und doppelte Einträge.")}`, f.s.cookies);
  }
  const einplanen = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/einsatz$/);
  const einsatz = url.pathname.match(/^\/konto\/einsatz\/([0-9a-f-]{36})$/);
  if ((einplanen || einsatz) && request.method === "POST") {
    const f = await aktiveFirma(request, env);
    if (!f) return weiterleiten("/konto");
    const form = await request.formData();
    const zurueck = String(form.get("zurueck") ?? "");
    if (einplanen) {
      const pid = String(form.get("personal") ?? "");
      const status = String(form.get("status") ?? "geplant");
      const ok = ID.test(pid) && (await db(f.s, env, "einsaetze?on_conflict=vorgang_id,personal_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: f.m.firma_id, vorgang_id: einplanen[1], personal_id: pid, status: EINSATZ[status] ? status : "geplant" }) })).ok;
      const hinweis = ok ? "Eingeplant." : "Einplanen hat nicht geklappt.";
      return weiterleiten(zurueck.startsWith("/konto/personal/") ? `${zurueck}${zurueck.includes("?") ? "&" : "?"}hinweis=${encodeURIComponent(hinweis)}` : `/konto/vorgang/${einplanen[1]}${ok ? "" : `?fehler=${encodeURIComponent(hinweis)}`}#personal`, f.s.cookies);
    }
    const e = await db<{ vorgang_id: string }[]>(f.s, env, `einsaetze?id=eq.${einsatz![1]}&select=vorgang_id`);
    const vid = e.ok ? e.daten[0]?.vorgang_id : undefined;
    if (!vid) return weiterleiten("/konto/treffer", f.s.cookies);
    if (form.get("aktion") === "entfernen") await db(f.s, env, `einsaetze?id=eq.${einsatz![1]}`, { method: "DELETE" });
    else {
      const status = String(form.get("status") ?? "");
      if (EINSATZ[status]) await db(f.s, env, `einsaetze?id=eq.${einsatz![1]}`, { method: "PATCH", body: JSON.stringify({ status }) });
    }
    return weiterleiten(`/konto/vorgang/${vid}#personal`, f.s.cookies);
  }
  const standort = url.pathname.match(/^\/konto\/standort\/([0-9a-f-]{36}|firma)$/);
  const einzeln = url.pathname.match(/^\/konto\/personal\/([0-9a-f-]{36})(\/nachricht|\/abwesenheit|\/foto)?$/);
  if (!standort && !einzeln) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  const antwort = (titel: string, inhalt: string, status = 200) => html(seite(titel, `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma & Team">‹</a></p>${inhalt}`, 0, "team"), status, f.s.cookies);

  if (standort) {
    const bid = standort[1] === "firma" ? null : standort[1];
    if (request.method === "POST") {
      if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Personal eintragen.</p>", 403);
      const [qualifikationen, tarife] = await Promise.all([
        qualifikationenLaden(f.s, env, f.m.firma_id, bid),
        tarifvertraegeLaden(f.s, env, f.m.firma_id),
      ]);
      const daten = ausFormular(await request.formData(), [...QUALIFIKATIONEN, ...qualifikationen.map((q) => q.name)], tarife);
      const ziel = await heimat(f, env, bid);
      if (!daten.vorname) return weiterleiten(`${ziel}?hinweis=${encodeURIComponent("Bitte mindestens den Vornamen eintragen.")}`, f.s.cookies);
      const r = await db(f.s, env, "personal", { method: "POST", body: JSON.stringify({ ...daten, firma_id: f.m.firma_id, bereich_id: bid }) });
      return weiterleiten(`${ziel}?hinweis=${encodeURIComponent(r.ok ? `${daten.vorname} ist eingetragen.` : "Das hat nicht geklappt. Hast du Rechte für diesen Standort?")}`, f.s.cookies);
    }
    const [bereiche, liste, qualifikationen, mitglieder, zuordnungen, tarife] = await Promise.all([
      bereicheLaden(f.s, env, f.m.firma_id),
      db<Kraft[]>(f.s, env, `rpc/personal_sicht?f=${f.m.firma_id}&bereich_id=${bid ? `eq.${bid}` : "is.null"}&select=*&order=status,vorname`),
      qualifikationenLaden(f.s, env, f.m.firma_id, bid),
      db<AppMitglied[]>(f.s, env, `mitglieder?firma_id=eq.${f.m.firma_id}&aktiv=eq.true&select=user_id,rolle,anzeigename,funktion`),
      db<{ user_id: string; bereich_id: string }[]>(f.s, env, `mitglied_bereiche?firma_id=eq.${f.m.firma_id}&select=user_id,bereich_id`),
      tarifvertraegeLaden(f.s, env, f.m.firma_id),
    ]);
    const [einsaetze, abw, ueberlassungen, nachweise] = await Promise.all([einsaetzeLaden(f.s, env, f.m.firma_id), abwesenheitenLaden(f.s, env, f.m.firma_id), auegLaden(f.s, env, f.m.firma_id), nachweiseLaden(f.s, env, f.m.firma_id)]);
    const auegHinweise = personHinweise(auegFristen(ueberlassungen, heuteIso()), heuteIso());
    const b = bereiche.ok ? bereiche.daten.find((x) => x.id === bid) : undefined;
    if (bid && !b) return antwort("Nicht gefunden", "<p>Diesen Standort gibt es nicht oder du hast keinen Zugriff.</p>", 404);
    const titel = b ? bereichPfad(bereiche.ok ? bereiche.daten : [], b) : "Ganze Firma";
    const alle = liste.ok ? liste.daten : [];
    const hinweis = url.searchParams.get("hinweis");
    const custom = qualifikationen.map((q) => q.name);
    return antwort(titel, `<h1>📍 ${escape(titel)}</h1>${b ? kontaktBlock(b, ["inhaber", "admin"].includes(f.m.rolle)) : ""}${bid ? standortleitungBlock(bid, mitglieder.ok ? mitglieder.daten : [], zuordnungen.ok ? zuordnungen.daten : [], ["inhaber", "admin"].includes(f.m.rolle)) : ""}${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${personalTeil(alle, url, darfAendern, `/konto/standort/${standort[1]}`, einsaetze, custom, tarife, abw, auegHinweise, nachweise)}${qualifikationenBlock(bid, qualifikationen, darfAendern)}`);
  }

  const pid = einzeln![1];
  const k = await db<Kraft[]>(f.s, env, `rpc/personal_sicht?f=${f.m.firma_id}&id=eq.${pid}&select=*`);
  const kraft = k.ok ? k.daten[0] : undefined;
  if (!kraft || kraft.firma_id !== f.m.firma_id) return antwort("Nicht gefunden", "<p>Diese Person gibt es nicht oder du hast keinen Zugriff.</p>", 404);
  // G3: photo, served only after the row check above (RLS decides who sees the worker).
  if (einzeln![2] === "/foto") {
    const key = `personal-fotos/${kraft.firma_id}/${kraft.id}`;
    if (request.method !== "POST") {
      const obj = kraft.foto ? await env.DATEN?.get(key) : null;
      if (!obj) return new Response("Kein Foto", { status: 404 });
      const kopf = new Uint8Array(await obj.arrayBuffer());
      const headers = new Headers({ "content-type": bildTyp(kopf) ?? "application/octet-stream", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" });
      for (const c of f.s.cookies) headers.append("set-cookie", c);
      return new Response(kopf, { headers });
    }
    const zurueck = `${await heimat(f, env, kraft.bereich_id)}`;
    if (!darfAendern || !env.DATEN) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Fotos ändern.</p>", 403);
    const form = await request.formData();
    if (form.get("loeschen")) {
      await env.DATEN.delete(key);
      await db(f.s, env, `personal?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify({ foto: false }) });
      return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent("Foto entfernt.")}#bearbeiten-${pid}`, f.s.cookies);
    }
    const datei = form.get("foto");
    const daten = datei && typeof datei !== "string" && datei.size > 0 && datei.size <= 1024 * 1024 ? new Uint8Array(await datei.arrayBuffer()) : null;
    if (!daten || !bildTyp(daten)) return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent("Bitte ein Foto als JPG, PNG oder WebP mit höchstens 1 MB wählen.")}#bearbeiten-${pid}`, f.s.cookies);
    const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify({ foto: true }) });
    if (r.ok) await env.DATEN.put(key, daten);
    return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? "Foto gespeichert." : "Das Foto konnte nicht gespeichert werden.")}#bearbeiten-${pid}`, f.s.cookies);
  }
  // G2: absences with a period.
  if (einzeln![2] === "/abwesenheit" && request.method === "POST") {
    const zurueck = await heimat(f, env, kraft.bereich_id);
    if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Abwesenheiten eintragen.</p>", 403);
    const form = await request.formData();
    const weg = String(form.get("loeschen") ?? "");
    let hinweis: string;
    const ok = String(form.get("bestaetigen") ?? "");
    if (ID.test(ok)) {
      // T16: leave requested by the staff member is confirmed by the office.
      const r = await db<{ id: string }[]>(f.s, env, `personal_abwesenheiten?id=eq.${ok}&personal_id=eq.${pid}&status=eq.beantragt&select=id`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "bestaetigt" }) });
      hinweis = r.ok && r.daten.length ? `Antrag von ${kraft.vorname} bestätigt.` : "Bestätigen hat nicht geklappt.";
    } else if (ID.test(weg)) {
      const r = await db(f.s, env, `personal_abwesenheiten?id=eq.${weg}&personal_id=eq.${pid}`, { method: "DELETE" });
      hinweis = r.ok ? "Abwesenheit gelöscht." : "Löschen hat nicht geklappt.";
    } else {
      const a = abwesenheitAusFormular(form);
      if (!a) hinweis = "Bitte Von und Bis angeben (Bis nicht vor Von, höchstens ein Jahr).";
      else {
        const r = await db(f.s, env, "personal_abwesenheiten", { method: "POST", body: JSON.stringify({ ...a, firma_id: f.m.firma_id, personal_id: pid }) });
        hinweis = r.ok ? `${(GRUENDE[a.grund] ?? GRUENDE.abwesend)[1]} ${zeitraumText(a)} für ${kraft.vorname} eingetragen.` : "Eintragen hat nicht geklappt.";
      }
    }
    return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(hinweis)}#bearbeiten-${pid}`, f.s.cookies);
  }
  if (einzeln![2] === "/abwesenheit") return weiterleiten(await heimat(f, env, kraft.bereich_id));
  if (request.method === "POST" && !einzeln![2]) {
    const zurueck = await heimat(f, env, kraft.bereich_id);
    if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Personal ändern.</p>", 403);
    const form = await request.formData();
    if (form.get("aktion") === "loeschen") {
      const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "DELETE" });
      // Art. 17 DSGVO: the person's files go with the record (photo, uploaded certificates; D6 Rechtsprüfung).
      if (r.ok && env.DATEN) await personDateienLoeschen(env.DATEN, kraft.firma_id, pid);
      // Records under retention (§ 17 MiLoG) block the deletion in the database; its message says until when.
      const grund = r.ok ? "" : /"message":"(Aufbewahrungspflicht[^"]+)"/.exec(r.fehler)?.[1] ?? "";
      return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? `${kraft.vorname} ist gelöscht.` : grund ? `${grund} (Austritt über „Checklisten → Austritt“)` : "Löschen hat nicht geklappt.")}`, f.s.cookies);
    }
    const [qualifikationen, tarife] = await Promise.all([
      qualifikationenLaden(f.s, env, f.m.firma_id, kraft.bereich_id),
      tarifvertraegeLaden(f.s, env, f.m.firma_id),
    ]);
    const daten = ausFormular(form, [...QUALIFIKATIONEN, ...qualifikationen.map((q) => q.name)], tarife);
    if (!daten.vorname) return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent("Der Vorname darf nicht leer sein.")}`, f.s.cookies);
    const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify(daten) });
    return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? "Gespeichert." : "Speichern hat nicht geklappt.")}`, f.s.cookies);
  }
  if (!einzeln![2]) return weiterleiten(await heimat(f, env, kraft.bereich_id));

  // Message page: pick a tender (matching ones first), the text is ready, the phone sends it.
  const vorgaenge = await db<{ id: string; titel: string; frist: string | null; status: string }[]>(f.s, env, `vorgaenge?firma_id=eq.${f.m.firma_id}&status=not.in.(verworfen,verloren,abgegeben)&select=id,titel,frist,status&order=erstellt.desc&limit=60`);
  const liste = (vorgaenge.ok ? vorgaenge.daten : []).map((v) => ({ ...v, passt: passt(v.titel, kraft.berufe) })).sort((a, c) => Number(c.passt) - Number(a.passt));
  const vid = url.searchParams.get("vorgang") ?? "";
  const gewaehlt = ID.test(vid) ? liste.find((v) => v.id === vid) : undefined;
  const text = url.searchParams.get("text") ?? nachrichtText(kraft, f.m.firmen.name, gewaehlt);
  const kurz = (t: string) => (t.length > 55 ? `${t.slice(0, 52)}…` : t);
  const nr = waNummer(kraft.telefon);
  const e = encodeURIComponent(text);
  const knoepfe = [
    nr ? `<a class="knopf whatsapp" href="https://wa.me/${nr}?text=${e}" data-basis="https://wa.me/${nr}?text=" target="_blank" rel="noopener">💬 Per WhatsApp schicken</a>` : "",
    kraft.telefon ? `<a class="knopf-klein" href="sms:${escape(kraft.telefon.replace(/[^\d+]/g, ""))}?body=${e}" data-basis="sms:${escape(kraft.telefon.replace(/[^\d+]/g, ""))}?body=">✉️ Per SMS</a>` : "",
    kraft.email ? `<a class="knopf-klein" href="mailto:${escape(kraft.email)}?subject=${encodeURIComponent(gewaehlt ? `Einsatz: ${gewaehlt.titel}` : "Einsatz")}&body=${e}" data-basis="mailto:${escape(kraft.email)}?subject=${encodeURIComponent(gewaehlt ? `Einsatz: ${gewaehlt.titel}` : "Einsatz")}&body=">📧 Per E-Mail</a>` : "",
  ].filter(Boolean).join("");
  return antwort(`Nachricht an ${kraft.vorname}`, `<h1>💬 Nachricht an ${escape(`${kraft.vorname} ${kraft.nachname}`.trim())}</h1>
<form method="get" action="/konto/personal/${pid}/nachricht">
  <label>Worum geht es?<select name="vorgang" data-sofort-wahl><option value="">Allgemein: Zeit für einen Einsatz?</option>${liste.map((v) => `<option value="${v.id}"${v.id === gewaehlt?.id ? " selected" : ""}>${v.passt ? "⭐ " : ""}${escape(kurz(v.titel))}</option>`).join("")}</select></label>
  ${liste.some((v) => v.passt) ? `<p class="klein">⭐ passt zu den Berufen von ${escape(kraft.vorname)}.</p>` : ""}
  <noscript><button>Text erstellen</button></noscript>
</form>
<form method="get" action="/konto/personal/${pid}/nachricht">
  ${gewaehlt ? `<input type="hidden" name="vorgang" value="${gewaehlt.id}">` : ""}
  <label>Text (kannst du ändern)<textarea name="text" rows="9" maxlength="2000" data-nachricht>${escape(text)}</textarea></label>
  <noscript><button class="knopf-leise">Geänderten Text übernehmen</button></noscript>
</form>
${url.searchParams.get("hinweis") ? `<p role="status"><strong>${escape(url.searchParams.get("hinweis")!)}</strong></p>` : ""}
<div class="person-aktionen gross">${knoepfe || `<p>Für ${escape(kraft.vorname)} ist keine Telefonnummer oder E-Mail eingetragen.</p>`}</div>
${hilfe("Was passiert beim Senden?", "WhatsApp, SMS oder E-Mail öffnet die jeweilige App mit einem vorbereiteten Text. Du kannst ihn vor dem Senden ändern. Crewtender verschickt die Nachricht nicht selbst.")}
${gewaehlt && darfAendern ? `<form method="post" action="/konto/vorgang/${gewaehlt.id}/einsatz"><input type="hidden" name="personal" value="${pid}"><input type="hidden" name="status" value="angefragt"><input type="hidden" name="zurueck" value="/konto/personal/${pid}/nachricht?vorgang=${gewaehlt.id}"><button>📨 Bei der Ausschreibung als „angefragt“ eintragen</button></form>` : ""}
<p class="klein">Die Nachricht geht von deinem Handy aus, mit deiner Nummer bzw. deinem Mailprogramm. Crewtender verschickt selbst nichts.</p>`);
}

/** Removes a deleted person's files from R2: photo and everything under personal_nachweise/<firma>/<person>/. */
export async function personDateienLoeschen(r2: Pick<R2Bucket, "delete" | "list">, firma: string, person: string): Promise<number> {
  const keys = [`personal-fotos/${firma}/${person}`];
  let cursor: string | undefined;
  do {
    const l = await r2.list({ prefix: `personal_nachweise/${firma}/${person}/`, cursor });
    keys.push(...l.objects.map((o) => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < keys.length; i += 1000) await r2.delete(keys.slice(i, i + 1000));
  return keys.length;
}
