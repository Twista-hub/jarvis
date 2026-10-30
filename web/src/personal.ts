// Personnel per location: tiles for the locations on "Firma & Team", one page per location with the workers
// as cards (occupations, qualifications, wage group, phone, availability), and a message page that writes
// a ready text (optionally about a tender) and opens WhatsApp, SMS or e-mail on the phone. Jarvis sends nothing itself.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { bereichPfad } from "./bereiche.ts";
import { escape, seite } from "./seite.ts";
import { GVP, lohnAm } from "./tarife.ts";
import { euro } from "./kalkulation.ts";

export type Kraft = { id: string; firma_id: string; bereich_id: string | null; vorname: string; nachname: string; berufe: string[]; qualifikationen: string[]; eg: string; telefon: string; email: string; status: string; notiz: string };

export const BERUFE: Record<string, string[]> = {
  "Gastronomie & Hotel": ["Servicekraft", "Bankettkraft", "Koch/Köchin", "Küchenhilfe", "Spülkraft", "Barkeeper/in", "Rezeption"],
  "Lager & Logistik": ["Lagerhelfer/in", "Kommissionierer/in", "Staplerfahrer/in", "Fachkraft Lagerlogistik", "Berufskraftfahrer/in", "Kurierfahrer/in"],
  "Produktion & Handwerk": ["Produktionshelfer/in", "Maschinenbediener/in", "Elektriker/in", "Mechatroniker/in", "Schweißer/in", "Schlosser/in", "Maler/in"],
  "Reinigung & Hauswirtschaft": ["Reinigungskraft", "Hauswirtschaftskraft", "Hausmeister/in"],
  "Pflege & Soziales": ["Pflegehelfer/in", "Pflegefachkraft", "Betreuungskraft", "Erzieher/in"],
  "Büro & Empfang": ["Bürokraft", "Kaufmännische Fachkraft", "Empfangskraft", "Sachbearbeiter/in"],
  "Sicherheit & Veranstaltung": ["Sicherheitskraft", "Messehelfer/in", "Promoter/in", "Garderobenkraft"],
};
export const QUALIFIKATIONEN = ["Führerschein B", "Führerschein C/CE", "Staplerschein", "Gesundheitszeugnis (§ 43 IfSG)", "Erste Hilfe", "Sachkunde § 34a", "Deutsch fließend", "Englisch", "Schichtbereit", "Eigenes Auto"];
export const STATUS: Record<string, [string, string]> = { verfuegbar: ["🟢", "Verfügbar"], einsatz: ["🔵", "Im Einsatz"], nicht: ["⚪", "Nicht verfügbar"] };
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

export function kraftFormular(k: Partial<Kraft>, aktion: string, knopf: string): string {
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
  <fieldset><legend>Qualifikationen</legend>${chips("qualifikationen", QUALIFIKATIONEN, k.qualifikationen ?? [])}</fieldset>
  <label>Notiz (freiwillig)<textarea name="notiz" maxlength="500" rows="2" placeholder="z. B. nur Frühschicht, Einsatzradius 30 km">${escape(k.notiz ?? "")}</textarea></label>
  <button>${knopf}</button>
</form>`;
}

function ausFormular(f: FormData): Omit<Kraft, "id" | "firma_id" | "bereich_id"> {
  const t = (k: string, max: number) => String(f.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const alle = Object.values(BERUFE).flat();
  const berufe = [...f.getAll("berufe").map(String).filter((b) => alle.includes(b)), ...t("weitere", 200).split(",").map((x) => x.trim()).filter(Boolean)].slice(0, 20);
  const status = t("status", 20);
  const eg = t("eg", 3);
  return {
    vorname: t("vorname", 100), nachname: t("nachname", 100), berufe: [...new Set(berufe)],
    qualifikationen: f.getAll("qualifikationen").map(String).filter((q) => QUALIFIKATIONEN.includes(q)),
    eg: GVP.gruppen.includes(eg) ? eg : "", telefon: t("telefon", 40), email: t("email", 200),
    status: STATUS[status] ? status : "verfuegbar", notiz: String(f.get("notiz") ?? "").trim().slice(0, 500),
  };
}

export function kraftKarte(k: Kraft, darfAendern: boolean): string {
  const [icon, text] = STATUS[k.status] ?? STATUS.verfuegbar;
  const name = `${k.vorname} ${k.nachname}`.trim();
  const initialen = (k.vorname[0] ?? "") + (k.nachname[0] ?? "");
  return `<article class="person-karte">
  <div class="person-kopf"><span class="person-avatar" aria-hidden="true">${escape(initialen.toUpperCase())}</span><div><h3>${escape(name)}</h3><span class="status status-${k.status}">${icon} ${text}</span></div>${darfAendern ? `<a class="stift" href="#bearbeiten-${k.id}" data-oeffne="bearbeiten-${k.id}" aria-label="${escape(name)} bearbeiten" title="Bearbeiten">✏️</a>` : ""}</div>
  ${k.berufe.length ? `<p class="person-berufe">${k.berufe.map((b) => `<span class="marke">${escape(b)}</span>`).join("")}</p>` : ""}
  ${k.qualifikationen.length || k.eg ? `<p class="klein">${[k.eg ? `EG ${escape(k.eg)}` : "", ...k.qualifikationen.map(escape)].filter(Boolean).join(" · ")}</p>` : ""}
  ${k.notiz ? `<p class="klein">📝 ${escape(k.notiz)}</p>` : ""}
  <div class="person-aktionen">${k.telefon ? `<a class="knopf-klein" href="tel:${escape(k.telefon.replace(/[^\d+]/g, ""))}">📞 Anrufen</a>` : ""}<a class="knopf-klein" href="/konto/personal/${k.id}/nachricht">💬 Nachricht</a></div>
  ${darfAendern ? `<details id="bearbeiten-${k.id}" class="bearbeiten"><summary>✏️ Bearbeiten</summary>${kraftFormular(k, `/konto/personal/${k.id}`, "Änderungen speichern")}<form method="post" action="/konto/personal/${k.id}"><input type="hidden" name="aktion" value="loeschen"><button class="knopf-leise">🗑️ Aus der Liste löschen</button></form></details>` : ""}
</article>`;
}

/** Tiles on "Firma & Team": one per location (grouped by region) with the number of available workers. */
export function standortKacheln(bereiche: Bereich[], personal: { bereich_id: string | null; status: string }[]): string {
  const zahl = (id: string | null) => {
    const p = personal.filter((x) => x.bereich_id === id);
    return `${p.filter((x) => x.status === "verfuegbar").length} verfügbar · ${p.length} gesamt`;
  };
  const kachel = (href: string, icon: string, titel: string, hinweis: string) => `<a class="konto-kachel" href="${href}"><span class="konto-icon" aria-hidden="true">${icon}</span><strong>${escape(titel)}</strong><span class="klein">${hinweis}</span><span class="konto-pfeil" aria-hidden="true">›</span></a>`;
  if (!bereiche.length) return `<div class="konto-kacheln standort-kacheln">${kachel("/konto/standort/firma", "🏢", "Ganze Firma", zahl(null))}</div>`;
  const oben = bereiche.filter((b) => !b.parent_id);
  const einzeln = oben.filter((b) => !bereiche.some((c) => c.parent_id === b.id));
  const gruppen = oben.filter((b) => bereiche.some((c) => c.parent_id === b.id));
  const ohne = personal.some((x) => !x.bereich_id) ? kachel("/konto/standort/firma", "🏢", "Ohne Standort", zahl(null)) : "";
  return `${einzeln.length || ohne ? `<div class="konto-kacheln standort-kacheln">${einzeln.map((b) => kachel(`/konto/standort/${b.id}`, "📍", b.name, zahl(b.id))).join("")}${ohne}</div>` : ""}
${gruppen.map((g) => `<h3>${escape(g.name)}</h3><div class="konto-kacheln standort-kacheln">${[g, ...bereiche.filter((c) => c.parent_id === g.id)].map((b) => kachel(`/konto/standort/${b.id}`, b.id === g.id ? "🗺️" : "📍", b.id === g.id ? `${b.name} (Region)` : b.name, zahl(b.id))).join("")}</div>`).join("")}`;
}

export async function personal(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
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
      const daten = ausFormular(await request.formData());
      if (!daten.vorname) return weiterleiten(`/konto/standort/${standort[1]}?hinweis=${encodeURIComponent("Bitte mindestens den Vornamen eintragen.")}`, f.s.cookies);
      const r = await db(f.s, env, "personal", { method: "POST", body: JSON.stringify({ ...daten, firma_id: f.m.firma_id, bereich_id: bid }) });
      return weiterleiten(`/konto/standort/${standort[1]}?hinweis=${encodeURIComponent(r.ok ? `${daten.vorname} ist eingetragen.` : "Das hat nicht geklappt. Hast du Rechte für diesen Standort?")}`, f.s.cookies);
    }
    const [bereiche, liste] = await Promise.all([
      db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id,name,art,parent_id`),
      db<Kraft[]>(f.s, env, `personal?firma_id=eq.${f.m.firma_id}&bereich_id=${bid ? `eq.${bid}` : "is.null"}&select=*&order=status,vorname`),
    ]);
    const b = bereiche.ok ? bereiche.daten.find((x) => x.id === bid) : undefined;
    if (bid && !b) return antwort("Nicht gefunden", "<p>Diesen Standort gibt es nicht oder du hast keinen Zugriff.</p>", 404);
    const titel = b ? bereichPfad(bereiche.ok ? bereiche.daten : [], b) : "Ganze Firma";
    const alle = liste.ok ? liste.daten : [];
    // Filter by occupation and status (GET form, works without scripts).
    const beruf = url.searchParams.get("beruf") ?? "";
    const st = url.searchParams.get("status") ?? "";
    const gezeigt = alle.filter((k) => (!beruf || k.berufe.includes(beruf)) && (!st || k.status === st));
    const berufeHier = [...new Set(alle.flatMap((k) => k.berufe))].sort((a, c) => a.localeCompare(c, "de"));
    const hinweis = url.searchParams.get("hinweis");
    const filter = alle.length > 3 ? `<form method="get" class="filter-leiste"><label>Beruf<select name="beruf" data-sofort-wahl><option value="">Alle Berufe</option>${berufeHier.map((x) => `<option${x === beruf ? " selected" : ""}>${escape(x)}</option>`).join("")}</select></label><label>Status<select name="status" data-sofort-wahl><option value="">Alle</option>${Object.entries(STATUS).map(([v, [i, t]]) => `<option value="${v}"${v === st ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label><noscript><button>Filtern</button></noscript></form>` : "";
    return antwort(titel, `<h1>📍 ${escape(titel)}</h1>
${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}
<p class="klein">${alle.filter((k) => k.status === "verfuegbar").length} verfügbar · ${alle.filter((k) => k.status === "einsatz").length} im Einsatz · ${alle.length} gesamt</p>
${darfAendern && alle.length ? `<p><a class="knopf" href="#neu" data-oeffne="neu">➕ Person hinzufügen</a></p>` : ""}
${filter}
<div class="personal-liste">${gezeigt.map((k) => kraftKarte(k, darfAendern)).join("") || `<p>${alle.length ? "Niemand passt zu diesem Filter." : "Noch kein Personal eingetragen."}</p>`}</div>
${darfAendern ? `<details class="neu-person" id="neu"${alle.length ? "" : " open"}><summary>➕ Person hinzufügen</summary>${kraftFormular({}, `/konto/standort/${standort[1]}`, "Person speichern")}</details>` : ""}
<p class="klein">Die Daten sieht nur, wer Zugriff auf diesen Standort hat. Trag nur ein, was für die Einsatzplanung nötig ist, und lösche Personen, die nicht mehr für euch arbeiten.</p>`);
  }

  const pid = einzeln![1];
  const k = await db<Kraft[]>(f.s, env, `personal?id=eq.${pid}&select=*`);
  const kraft = k.ok ? k.daten[0] : undefined;
  if (!kraft || kraft.firma_id !== f.m.firma_id) return antwort("Nicht gefunden", "<p>Diese Person gibt es nicht oder du hast keinen Zugriff.</p>", 404);
  const zurueck = `/konto/standort/${kraft.bereich_id ?? "firma"}`;
  if (request.method === "POST" && !einzeln![2]) {
    if (!darfAendern) return antwort("Nicht erlaubt", "<p>Nur Bearbeiter und Admins können Personal ändern.</p>", 403);
    const form = await request.formData();
    if (form.get("aktion") === "loeschen") {
      const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "DELETE" });
      return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? `${kraft.vorname} ist gelöscht.` : "Löschen hat nicht geklappt.")}`, f.s.cookies);
    }
    const daten = ausFormular(form);
    if (!daten.vorname) return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent("Der Vorname darf nicht leer sein.")}`, f.s.cookies);
    const r = await db(f.s, env, `personal?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify(daten) });
    return weiterleiten(`${zurueck}?hinweis=${encodeURIComponent(r.ok ? "Gespeichert." : "Speichern hat nicht geklappt.")}`, f.s.cookies);
  }
  if (!einzeln![2]) return weiterleiten(zurueck);

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
<div class="person-aktionen gross">${knoepfe || `<p>Für ${escape(kraft.vorname)} ist keine Telefonnummer oder E-Mail eingetragen.</p>`}</div>
<p class="klein">Die Nachricht geht von deinem Handy aus, mit deiner Nummer bzw. deinem Mailprogramm. Jarvis verschickt selbst nichts.</p>`);
}
