// Personnel per location: tiles for the locations on "Firma & Team", one page per location with the workers
// as cards (occupations, qualifications, wage group, phone, availability), and a message page that writes
// a ready text (optionally about a tender) and opens WhatsApp, SMS or e-mail on the phone. Jarvis sends nothing itself.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { bereichPfad } from "./bereiche.ts";
import { escape, hilfe, seite } from "./seite.ts";
import { GVP, lohnAm } from "./tarife.ts";
import { euro } from "./kalkulation.ts";

export type Kraft = { id: string; firma_id: string; bereich_id: string | null; vorname: string; nachname: string; berufe: string[]; qualifikationen: string[]; eg: string; telefon: string; email: string; status: string; notiz: string };

export const BERUFE: Record<string, string[]> = {
  "Büro & Verwaltung": ["Bürokraft", "Sachbearbeiter/in", "Kaufmännische Fachkraft", "Bürokaufmann/-frau", "Empfangskraft", "Datenerfasser/in", "Buchhalter/in", "Lohnbuchhalter/in", "Personalreferent/in", "Kundenservice"],
  "Bau & Ausbau": ["Maurer/in", "Maler/in", "Lackierer/in", "Trockenbauer/in", "Fliesenleger/in", "Dachdecker/in", "Zimmerer/Zimmerin", "Tischler/in", "Bauhelfer/in", "Baugeräteführer/in"],
  "Elektro, Metall & Technik": ["Elektriker/in", "Elektroniker/in", "Mechatroniker/in", "Schweißer/in", "Schlosser/in", "Industriemechaniker/in", "Anlagenmechaniker/in SHK", "Kfz-Mechatroniker/in", "Maschinenbediener/in", "Produktionshelfer/in"],
  "Lager & Logistik": ["Lagerhelfer/in", "Kommissionierer/in", "Staplerfahrer/in", "Fachkraft Lagerlogistik", "Berufskraftfahrer/in", "Kurierfahrer/in", "Fahrer/in"],
  "Gastronomie & Hotel": ["Servicekraft", "Bankettkraft", "Koch/Köchin", "Küchenhilfe", "Spülkraft", "Barkeeper/in", "Rezeptionist/in", "Housekeeping"],
  "Reinigung & Hauswirtschaft": ["Reinigungskraft", "Gebäudereiniger/in", "Hauswirtschaftskraft", "Hausmeister/in"],
  "Pflege, Medizin & Soziales": ["Pflegehelfer/in", "Pflegefachkraft", "Medizinische/r Fachangestellte/r", "Betreuungskraft", "Erzieher/in", "Sozialassistent/in"],
  "Einzelhandel & Verkauf": ["Verkäufer/in", "Kassierer/in", "Warenverräumer/in", "Einzelhandelskaufmann/-frau", "Promoter/in"],
  "Sicherheit & Veranstaltung": ["Sicherheitskraft", "Messehelfer/in", "Veranstaltungstechniker/in", "Garderobenkraft", "Ordner/in"],
  "Garten & Agrar": ["Garten- und Landschaftsbauer/in", "Gärtner/in", "Landwirtschaftliche/r Helfer/in"],
};
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

function egOptionen(gewaehlt: string): string {
  const heute = new Date().toISOString().slice(0, 10);
  return `<option value="">keine Angabe</option>${GVP.gruppen.map((g) => `<option value="${g}"${g === gewaehlt ? " selected" : ""}>EG ${g} · ${euro(lohnAm(g, heute, 0))}/Std.</option>`).join("")}`;
}

function chips(name: string, liste: string[], gewaehlt: string[]): string {
  return `<div class="chips">${liste.map((x) => `<label><input type="checkbox" name="${name}" value="${escape(x)}"${gewaehlt.includes(x) ? " checked" : ""}><span>${escape(x)}</span></label>`).join("")}</div>`;
}

export function kraftFormular(k: Partial<Kraft>, aktion: string, knopf: string, qualifikationen: string[] = QUALIFIKATIONEN): string {
  const eigene = (k.berufe ?? []).filter((b) => !Object.values(BERUFE).flat().includes(b));
  return `<form method="post" action="${aktion}" class="personal-form">
  <div class="zwei"><label>Vorname<input name="vorname" required maxlength="100" autocomplete="off" value="${escape(k.vorname ?? "")}"></label>
  <label>Nachname<input name="nachname" maxlength="100" autocomplete="off" value="${escape(k.nachname ?? "")}"></label></div>
  <div class="zwei"><label>Telefon<input name="telefon" type="tel" maxlength="40" placeholder="0170 1234567" value="${escape(k.telefon ?? "")}"></label>
  <label>E-Mail (freiwillig)<input name="email" type="email" maxlength="200" value="${escape(k.email ?? "")}"></label></div>
  <div class="zwei"><label>Status<select name="status">${Object.entries(STATUS).map(([v, [i, t]]) => `<option value="${v}"${(k.status ?? "verfuegbar") === v ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label>
  <label>Entgeltgruppe (Tarif ${escape(GVP.name)})<select name="eg">${egOptionen(k.eg ?? "")}</select></label></div>
  <fieldset><legend>Berufe</legend>${Object.entries(BERUFE).map(([gruppe, liste]) => `<details${liste.some((b) => k.berufe?.includes(b)) ? " open" : ""}><summary>${escape(gruppe)}</summary>${chips("berufe", liste, k.berufe ?? [])}</details>`).join("")}
  <label>Weitere Berufe (mit Komma trennen)<input name="weitere" maxlength="200" value="${escape(eigene.join(", "))}"></label></fieldset>
  <fieldset><legend>Qualifikationen</legend>${chips("qualifikationen", qualifikationen, k.qualifikationen ?? [])}</fieldset>
  <label>Notiz (freiwillig)<textarea name="notiz" maxlength="500" rows="2" placeholder="z. B. nur Frühschicht, Einsatzradius 30 km">${escape(k.notiz ?? "")}</textarea></label>
  <button>${knopf}</button>
</form>`;
}

function ausFormular(f: FormData, qualifikationen: string[] = QUALIFIKATIONEN): Omit<Kraft, "id" | "firma_id" | "bereich_id"> {
  const t = (k: string, max: number) => String(f.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const alle = Object.values(BERUFE).flat();
  const berufe = [...f.getAll("berufe").map(String).filter((b) => alle.includes(b)), ...t("weitere", 200).split(",").map((x) => x.trim()).filter(Boolean)].slice(0, 20);
  const status = t("status", 20);
  const eg = t("eg", 3);
  return {
    vorname: t("vorname", 100), nachname: t("nachname", 100), berufe: [...new Set(berufe)],
    qualifikationen: f.getAll("qualifikationen").map(String).filter((q) => qualifikationen.includes(q)),
    eg: GVP.gruppen.includes(eg) ? eg : "", telefon: t("telefon", 40), email: t("email", 200),
    status: STATUS[status] ? status : "verfuegbar", notiz: String(f.get("notiz") ?? "").trim().slice(0, 500),
  };
}

export function kraftKarte(k: Kraft, darfAendern: boolean, einsaetze: Einsatz[] = [], qualifikationen: string[] = QUALIFIKATIONEN): string {
  const [icon, text] = STATUS[k.status] ?? STATUS.verfuegbar;
  const name = `${k.vorname} ${k.nachname}`.trim();
  const initialen = (k.vorname[0] ?? "") + (k.nachname[0] ?? "");
  return `<article class="person-karte">
  <div class="person-kopf"><span class="person-avatar" aria-hidden="true">${escape(initialen.toUpperCase())}</span><div><h3>${escape(name)}</h3><span class="status status-${k.status}">${icon} ${text}</span></div>${darfAendern ? `<a class="stift" href="#bearbeiten-${k.id}" data-oeffne="bearbeiten-${k.id}" aria-label="${escape(name)} bearbeiten" title="Bearbeiten">✏️</a>` : ""}</div>
  ${k.berufe.length ? `<p class="person-berufe">${k.berufe.map((b) => `<span class="marke">${escape(b)}</span>`).join("")}</p>` : ""}
  ${k.qualifikationen.length || k.eg ? `<p class="klein">${[k.eg ? `EG ${escape(k.eg)}` : "", ...k.qualifikationen.map(escape)].filter(Boolean).join(" · ")}</p>` : ""}
  ${k.notiz ? `<p class="klein">📝 ${escape(k.notiz)}</p>` : ""}
  ${einsaetze.length ? `<ul class="einsatz-kurz">${einsaetze.map((e) => `<li><a href="/konto/vorgang/${e.vorgang_id}#personal">${(EINSATZ[e.status] ?? EINSATZ.geplant)[0]} ${escape(e.vorgaenge?.titel ?? "Ausschreibung")}</a></li>`).join("")}</ul>` : ""}
  <div class="person-aktionen">${k.telefon ? `<a class="knopf-klein" href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">📞 Anrufen</a>` : ""}<a class="knopf-klein" href="/konto/personal/${k.id}/nachricht">💬 Nachricht</a></div>
  ${darfAendern ? `<details id="bearbeiten-${k.id}" class="bearbeiten"><summary>✏️ Bearbeiten</summary>${kraftFormular(k, `/konto/personal/${k.id}`, "Änderungen speichern", qualifikationen)}<form method="post" action="/konto/personal/${k.id}"><input type="hidden" name="aktion" value="loeschen"><button class="knopf-leise">🗑️ Aus der Liste löschen</button></form></details>` : ""}
</article>`;
}

/** Tiles on "Firma & Team": one per location (grouped by region) with the number of available workers. */
export function standortKacheln(bereiche: Bereich[], personal: { bereich_id: string | null; status: string }[], leitungen: { user_id: string; name: string; bereich_id: string }[] = []): string {
  const zahl = (id: string | null) => {
    const p = personal.filter((x) => x.bereich_id === id);
    return `${p.filter((x) => x.status === "verfuegbar").length} verfügbar · ${p.length} gesamt`;
  };
  const kachel = (href: string, icon: string, titel: string, hinweis: string, id?: string) => { const leitung = id ? leitungen.find((x) => x.bereich_id === id) : undefined; return `<a class="konto-kachel" href="${href}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${hinweis}</span>${leitung ? `<span class="klein">👤 Leitung: ${escape(leitung.name)}</span>` : `<span class="klein">👤 Keine Standortleitung zugeordnet</span>`}<span class="konto-pfeil" aria-hidden="true">›</span></a>`; };
  if (!bereiche.length) return `<div class="konto-kacheln standort-kacheln">${kachel("/konto/standort/firma", "🏢", "Ganze Firma", zahl(null))}</div>`;
  const oben = bereiche.filter((b) => !b.parent_id);
  const einzeln = oben.filter((b) => !bereiche.some((c) => c.parent_id === b.id));
  const gruppen = oben.filter((b) => bereiche.some((c) => c.parent_id === b.id));
  const ohne = personal.some((x) => !x.bereich_id) ? kachel("/konto/standort/firma", "🏢", "Ohne Standort", zahl(null)) : "";
  return `${einzeln.length || ohne ? `<div class="konto-kacheln standort-kacheln">${einzeln.map((b) => kachel(`/konto/standort/${b.id}`, "📍", b.name, zahl(b.id), b.id)).join("")}${ohne}</div>` : ""}
${gruppen.map((g) => `<section class="org-region"><h3>${escape(g.name)}</h3><div class="konto-kacheln standort-kacheln">${[g, ...bereiche.filter((c) => c.parent_id === g.id)].map((b) => kachel(`/konto/standort/${b.id}`, b.id === g.id ? "🗺️" : "📍", b.id === g.id ? `${b.name} (Region)` : b.name, zahl(b.id), b.id)).join("")}</div></section>`).join("")}`;
}

export function qualifikationenBlock(bereich: string | null, liste: { id: string; name: string; bereich_id: string | null }[], darfAendern: boolean): string {
  const passend = liste.filter((q) => q.bereich_id === bereich);
  return `<details class="qualifikationen-verwalten"><summary>🧰 Qualifikationen verwalten</summary><p class="klein">Eigene Qualifikationen erscheinen nur hier${bereich ? " am Standort" : " in der Firma"} und können bei Einsatzkräften ausgewählt werden.</p>${darfAendern ? `<form method="post" action="/konto/qualifikation"><input type="hidden" name="bereich" value="${bereich ?? ""}"><label>Neue Qualifikation<input name="name" required minlength="2" maxlength="80" placeholder="z. B. Ersthelfer-Ausbildung"></label><button>Qualifikation hinzufügen</button></form>` : ""}${passend.length ? `<ul>${passend.map((q) => `<li>${escape(q.name)}${darfAendern ? ` <form method="post" action="/konto/qualifikation" class="inline-form"><input type="hidden" name="aktion" value="loeschen"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="bereich" value="${bereich ?? ""}"><button class="knopf-leise" aria-label="${escape(q.name)} entfernen">Entfernen</button></form>` : ""}</li>`).join("")}</ul>` : `<p class="klein">Noch keine eigenen Qualifikationen angelegt.</p>`}</details>`;
}

async function qualifikationenLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string, bereich: string | null): Promise<{ id: string; name: string; bereich_id: string | null }[]> {
  const r = await db<{ id: string; name: string; bereich_id: string | null }[]>(s, env, `firmen_qualifikationen?firma_id=eq.${firma}&select=id,name,bereich_id&order=name`);
  return r.ok ? r.daten.filter((q) => q.bereich_id === null || q.bereich_id === bereich) : [];
}

/** The personnel of one location: numbers, filter, cards and the add form (also shown directly on "Firma & Team"). */
export function personalTeil(alle: Kraft[], url: URL, darfAendern: boolean, aktion: string, einsaetze: Einsatz[] = [], eigeneQualifikationen: string[] = []): string {
  // Filter by occupation and status (GET form, works without scripts).
  const beruf = url.searchParams.get("beruf") ?? "";
  const st = url.searchParams.get("status") ?? "";
  const qual = url.searchParams.get("qualifikation") ?? "";
  const gezeigt = alle.filter((k) => (!beruf || k.berufe.includes(beruf)) && (!st || k.status === st) && (!qual || k.qualifikationen.includes(qual)));
  const qualifikationen = [...new Set([...QUALIFIKATIONEN, ...eigeneQualifikationen, ...alle.flatMap((k) => k.qualifikationen)])].sort((a,b)=>a.localeCompare(b,"de"));
  const berufeHier = [...new Set(alle.flatMap((k) => k.berufe))].sort((a, c) => a.localeCompare(c, "de"));
  const filter = alle.length > 3 ? `<form method="get" class="filter-leiste"><label>Beruf<select name="beruf" data-sofort-wahl><option value="">Alle Berufe</option>${berufeHier.map((x) => `<option${x === beruf ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Qualifikation<select name="qualifikation" data-sofort-wahl><option value="">Alle Qualifikationen</option>${qualifikationen.map((x) => `<option${x === qual ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Status<select name="status" data-sofort-wahl><option value="">Alle</option>${Object.entries(STATUS).map(([v, [i, t]]) => `<option value="${v}"${v === st ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label><noscript><button>Filtern</button></noscript></form>` : "";
  return `<p class="klein">${alle.filter((k) => k.status === "verfuegbar").length} verfügbar · ${alle.filter((k) => k.status === "einsatz").length} im Einsatz · ${alle.length} gesamt</p>
${darfAendern && alle.length ? `<p><a class="knopf" href="#neu" data-oeffne="neu">➕ Person hinzufügen</a></p>` : ""}
${hilfe("Welche Person soll ich eintragen?", "Erfasse nur Personen, die ihr für Einsätze einplant. Berufe helfen Jarvis, passende Kräfte für Ausschreibungen vorzuschlagen. Die Kontaktangaben nutzt dein Team direkt vom eigenen Gerät.")}
${filter}
<div class="personal-liste">${gezeigt.map((k) => kraftKarte(k, darfAendern, einsaetze.filter((e) => e.personal_id === k.id && e.status !== "abgesagt"), qualifikationen)).join("") || `<p>${alle.length ? "Niemand passt zu diesem Filter." : "Noch kein Personal eingetragen."}</p>`}</div>
${darfAendern ? `<details class="neu-person" id="neu"${alle.length ? "" : " open"}><summary>➕ Person hinzufügen</summary>${kraftFormular({}, aktion, "Person speichern", qualifikationen)}</details>` : ""}
<p class="klein">Die Daten sieht nur, wer Zugriff auf diesen Standort hat. Trag nur ein, was für die Einsatzplanung nötig ist, und lösche Personen, die nicht mehr für euch arbeiten.</p>`;
}

export async function einsaetzeLaden(s: Parameters<typeof db>[0], env: KontoEnv, firma: string): Promise<Einsatz[]> {
  const r = await db<Einsatz[]>(s, env, `einsaetze?firma_id=eq.${firma}&select=id,personal_id,vorgang_id,status,vorgaenge(titel)`);
  return r.ok ? r.daten : [];
}

/** On a tender: the planned people with their status, and a dropdown to plan someone (matching and available first). */
export async function einsatzTeil(s: Parameters<typeof db>[0], env: KontoEnv, v: { id: string; firma_id: string; titel: string }, darfAendern: boolean): Promise<string> {
  const [geplant, pool] = await Promise.all([
    db<(Einsatz & { personal: Kraft | null })[]>(s, env, `einsaetze?vorgang_id=eq.${v.id}&select=id,personal_id,vorgang_id,status,personal(*)&order=erstellt`),
    db<Kraft[]>(s, env, `personal?firma_id=eq.${v.firma_id}&select=*&order=vorname`),
  ]);
  const liste = geplant.ok ? geplant.daten.filter((e) => e.personal) : [];
  const schon = new Set(liste.map((e) => e.personal_id));
  const frei = (pool.ok ? pool.daten : []).filter((k) => !schon.has(k.id))
    .map((k) => ({ k, rang: (passt(v.titel, k.berufe) ? 0 : 2) + (k.status === "verfuegbar" ? 0 : 1) }))
    .sort((a, b) => a.rang - b.rang);
  const zeilen = liste.map((e) => {
    const k = e.personal!;
    const statusWahl = darfAendern
      ? `<form method="post" action="/konto/einsatz/${e.id}" class="einsatz-status"><select name="status" data-sofort-wahl aria-label="Stand für ${escape(k.vorname)}">${Object.entries(EINSATZ).map(([w, [i, t]]) => `<option value="${w}"${w === e.status ? " selected" : ""}>${i} ${t}</option>`).join("")}</select><noscript><button>OK</button></noscript></form>`
      : `<span>${(EINSATZ[e.status] ?? EINSATZ.geplant).join(" ")}</span>`;
    return `<li class="einsatz-zeile"><div><strong>${escape(`${k.vorname} ${k.nachname}`.trim())}</strong><span class="klein">${escape(k.berufe.slice(0, 3).join(", ") || "ohne Beruf")}</span></div>${statusWahl}<div class="person-aktionen">${k.telefon ? `<a class="knopf-klein" href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">📞</a>` : ""}<a class="knopf-klein" href="/konto/personal/${k.id}/nachricht?vorgang=${v.id}">💬 Nachricht</a>${darfAendern ? `<form method="post" action="/konto/einsatz/${e.id}"><input type="hidden" name="aktion" value="entfernen"><button class="knopf-leise" aria-label="${escape(k.vorname)} austragen">✕</button></form>` : ""}</div></li>`;
  }).join("");
  const zugesagt = liste.filter((e) => e.status === "zugesagt").length;
  const wahl = darfAendern && frei.length ? `<form method="post" action="/konto/vorgang/${v.id}/einsatz" class="einplanen"><label>Person einplanen<select name="personal" required><option value="">Bitte auswählen …</option>${frei.map(({ k }) => `<option value="${k.id}">${k.status === "verfuegbar" ? "🟢 " : ""}${passt(v.titel, k.berufe) ? "⭐ " : ""}${escape(`${k.vorname} ${k.nachname}`.trim())}${k.berufe[0] ? ` · ${escape(k.berufe[0])}` : ""}${k.qualifikationen.length ? ` · ${escape(k.qualifikationen.slice(0, 2).join(", "))}` : ""}${k.status !== "verfuegbar" ? ` (${STATUS[k.status]?.[1] ?? k.status})` : ""}</option>`).join("")}</select></label><button>📌 Einplanen</button></form>` : "";
  const leer = pool.ok && !pool.daten.length ? `<p class="klein">Noch kein Personal eingetragen. <a href="/konto/team">Personal unter „Firma & Team“ anlegen →</a></p>` : "";
  return `<h2 id="personal">👷 Personal für diesen Auftrag</h2>${hilfe("Einplanung verstehen", "„Eingeplant“ ist erst eine Vormerkung. Ändere den Stand auf „Angefragt“, wenn du die Person kontaktiert hast, und auf „Zugesagt“, sobald sie den Einsatz bestätigt. ⭐ markiert passende Berufe.")}
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
  const einzeln = url.pathname.match(/^\/konto\/personal\/([0-9a-f-]{36})(\/nachricht)?$/);
  if (!standort && !einzeln) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const darfAendern = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  const antwort = (titel: string, inhalt: string, status = 200) => html(seite(titel, `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma & Team">‹</a></p>${inhalt}`, 0, "team"), status, f.s.cookies);

  if (standort) {
    const bid = standort[1] === "firma" ? null : standort[1];
    if (request.method === "POST") {
      if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Personal eintragen.</p>", 403);
      const qualifikationen = await qualifikationenLaden(f.s, env, f.m.firma_id, bid);
      const daten = ausFormular(await request.formData(), [...QUALIFIKATIONEN, ...qualifikationen.map((q) => q.name)]);
      const ziel = await heimat(f, env, bid);
      if (!daten.vorname) return weiterleiten(`${ziel}?hinweis=${encodeURIComponent("Bitte mindestens den Vornamen eintragen.")}`, f.s.cookies);
      const r = await db(f.s, env, "personal", { method: "POST", body: JSON.stringify({ ...daten, firma_id: f.m.firma_id, bereich_id: bid }) });
      return weiterleiten(`${ziel}?hinweis=${encodeURIComponent(r.ok ? `${daten.vorname} ist eingetragen.` : "Das hat nicht geklappt. Hast du Rechte für diesen Standort?")}`, f.s.cookies);
    }
    const [bereiche, liste, qualifikationen, mitglieder, zuordnungen] = await Promise.all([
      db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id,name,art,parent_id`),
      db<Kraft[]>(f.s, env, `personal?firma_id=eq.${f.m.firma_id}&bereich_id=${bid ? `eq.${bid}` : "is.null"}&select=*&order=status,vorname`),
      qualifikationenLaden(f.s, env, f.m.firma_id, bid),
      db<{ user_id: string; rolle: string; anzeigename: string; funktion: string }[]>(f.s, env, `mitglieder?firma_id=eq.${f.m.firma_id}&aktiv=eq.true&rolle=eq.standortleitung&select=user_id,rolle,anzeigename,funktion`),
      db<{ user_id: string; bereich_id: string }[]>(f.s, env, `mitglied_bereiche?firma_id=eq.${f.m.firma_id}&select=user_id,bereich_id`),
    ]);
    const einsaetze = await einsaetzeLaden(f.s, env, f.m.firma_id);
    const b = bereiche.ok ? bereiche.daten.find((x) => x.id === bid) : undefined;
    if (bid && !b) return antwort("Nicht gefunden", "<p>Diesen Standort gibt es nicht oder du hast keinen Zugriff.</p>", 404);
    const titel = b ? bereichPfad(bereiche.ok ? bereiche.daten : [], b) : "Ganze Firma";
    const alle = liste.ok ? liste.daten : [];
    const hinweis = url.searchParams.get("hinweis");
    const custom = qualifikationen.map((q) => q.name);
    const leitungIds = zuordnungen.ok ? zuordnungen.daten.filter((z) => z.bereich_id === bid).map((z) => z.user_id) : [];
    const leitung = mitglieder.ok ? mitglieder.daten.filter((x) => leitungIds.includes(x.user_id)).map((x) => x.anzeigename || x.funktion || "Standortleitung").join(", ") : "";
    return antwort(titel, `<h1>📍 ${escape(titel)}</h1>${bid ? `<p class="standort-leitung">👤 <strong>Standortleitung:</strong> ${escape(leitung || "noch nicht zugeordnet")}</p>` : ""}${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${personalTeil(alle, url, darfAendern, `/konto/standort/${standort[1]}`, einsaetze, custom)}${qualifikationenBlock(bid, qualifikationen, darfAendern)}`);
  }

  const pid = einzeln![1];
  const k = await db<Kraft[]>(f.s, env, `personal?id=eq.${pid}&select=*`);
  const kraft = k.ok ? k.daten[0] : undefined;
  if (!kraft || kraft.firma_id !== f.m.firma_id) return antwort("Nicht gefunden", "<p>Diese Person gibt es nicht oder du hast keinen Zugriff.</p>", 404);
  if (request.method === "POST" && !einzeln![2]) {
    const zurueck = await heimat(f, env, kraft.bereich_id);
    if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Personal ändern.</p>", 403);
    const form = await request.formData();
    if (form.get("aktion") === "loeschen") {
      const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "DELETE" });
      return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? `${kraft.vorname} ist gelöscht.` : "Löschen hat nicht geklappt.")}`, f.s.cookies);
    }
    const qualifikationen = await qualifikationenLaden(f.s, env, f.m.firma_id, kraft.bereich_id);
    const daten = ausFormular(form, [...QUALIFIKATIONEN, ...qualifikationen.map((q) => q.name)]);
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
${hilfe("Was passiert beim Senden?", "WhatsApp, SMS oder E-Mail öffnet die jeweilige App mit einem vorbereiteten Text. Du kannst ihn vor dem Senden ändern. Jarvis verschickt die Nachricht nicht selbst.")}
${gewaehlt && darfAendern ? `<form method="post" action="/konto/vorgang/${gewaehlt.id}/einsatz"><input type="hidden" name="personal" value="${pid}"><input type="hidden" name="status" value="angefragt"><input type="hidden" name="zurueck" value="/konto/personal/${pid}/nachricht?vorgang=${gewaehlt.id}"><button>📨 Bei der Ausschreibung als „angefragt“ eintragen</button></form>` : ""}
<p class="klein">Die Nachricht geht von deinem Handy aus, mit deiner Nummer bzw. deinem Mailprogramm. Jarvis verschickt selbst nichts.</p>`);
}
