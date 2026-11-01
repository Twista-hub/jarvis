import { aktiveFirma, nachweiseZip, zipAntwort, type FirmenDatei } from "./firmenunterlagen.ts";
import { referenzenLaden, type Referenz } from "./referenzen.ts";
import { db, html, weiterleiten, vorgangZugriff, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { bedarfErkennen, hash, type Bekanntmachung, type Bedarf } from "./katalog-daten.ts";

const datum = (x: string | null) => x ? new Date(x).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "nicht angegeben";
const text = (f: FormData, name: string, max: number) => String(f.get(name) ?? "").trim().slice(0, max);
const VORSCHLAEGE: Record<string, string> = { region: "Einsatzorte und PLZ-Bereiche im Suchprofil prüfen.", taetigkeit: "Leistungen, passende Suchwörter und Ausschlüsse schärfen.", groesse: "Gewünschte Auftragsgröße und Personalstärke in der Firmenbeschreibung ergänzen.", frist: "Benachrichtigungen und interne Vorbereitungszeit prüfen." };
const GRUENDE: Record<string, string> = { region: "Falsche Region", taetigkeit: "Andere Tätigkeit", groesse: "Unpassende Auftragsgröße", frist: "Frist zu kurz", passt: "Passt gut" };
type V = { id: string; firma_id: string; katalog_id?: string | null; katalog_version?: string | null; link?: string | null; steckbrief?: string | null; frist?: string | null; bereich_id?: string | null };
async function bekanntmachung(s: Sitzung, env: KontoEnv, v: V): Promise<Bekanntmachung | null> {
  if (!v.katalog_id && !v.link) return null;
  const filter = v.katalog_id ? `id=eq.${encodeURIComponent(v.katalog_id)}` : `link=eq.${encodeURIComponent(v.link!)}`;
  const r = await db<Bekanntmachung[]>(s, env, `vergabekatalog?${filter}&select=id,quelle,quelle_id,titel,version,quell_datum,auftraggeber,auftraggeber_id,beschreibung,ort,plz,cpv,frist,status,lose,bedarf,zuschlaege,vertragsende,link&limit=1`);
  return r.ok ? r.daten[0] ?? null : null;
}
/** References entered as a form count as the proof "Referenzen" (the list is built as a Word file). */
export const REFERENZ_ID = "referenzliste";
export function mitReferenzen(dateien: FirmenDatei[], refs: Referenz[], firma: string): FirmenDatei[] {
  return refs.length ? [...dateien, { id: REFERENZ_ID, firma_id: firma, name: `Referenzen (Referenzliste aus Jarvis, ${refs.length} Einträge)`, art: "nachweis", dateiname: "Referenzliste.docx", mime: "", groesse: 0, gueltig_bis: null }] : dateien;
}

/** The firm's valid proofs that this tender asks for, plus the references when they are asked for. */
async function nachweiseFuerVorgang(s: Sitzung, env: KontoEnv, v: V): Promise<{ dateien: FirmenDatei[]; refs: Referenz[] } | null> {
  const n = await bekanntmachung(s, env, v);
  const bedarf = (n?.bedarf ?? bedarfErkennen(v.steckbrief ?? "")).filter((b) => b.art === "nachweis");
  const [d, refs] = await Promise.all([db<FirmenDatei[]>(s, env, `firmenunterlagen?firma_id=eq.${v.firma_id}&select=*`), referenzenLaden(s, env, v.firma_id)]);
  if (!d.ok) return null;
  const checks = teilnahmeCheck(bedarf, [], mitReferenzen(d.daten, refs, v.firma_id), v.frist);
  const gefunden = checks.flatMap((c) => c.gefunden && "dokument" in c && c.dokument ? [c.dokument as FirmenDatei] : []);
  const dateien = [...new Map(gefunden.filter((x) => x.id !== REFERENZ_ID).map((x) => [x.id, x])).values()];
  return { dateien, refs: gefunden.some((x) => x.id === REFERENZ_ID) ? refs : [] };
}

const bedarfKey = (b: Bedarf) => `${b.los}|${b.art}|${b.name}`.slice(0, 200);
const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

export function teilnahmeCheck(bedarf: Bedarf[], personal: { berufe: string[]; qualifikationen: string[]; status: string }[], unterlagen: FirmenDatei[] | null, frist?: string | null) {
  return bedarf.map((b) => {
    const name = norm(b.name);
    if (b.art === "nachweis") {
      if (unterlagen === null) return { b, status: "Nachweisabgleich benötigt Finanzfreigabe", gefunden: false };
      // Match by the distinctive words of the requirement (e.g. "haftpflicht", "iso 9001", "handelsregister").
      const suchwoerter = name.includes("arbeitnehmer") ? ["erlaubnis", "aug", "aueg"] : name.includes("unbedenklichkeit") ? [name.includes("finanz") ? "finanzamt" : "kranken", "unbedenklich"] : name.includes("iso") ? [name.replace(/\s+/g, "")] : name.split(/[^a-z0-9§]+/).filter((w) => w.length >= 5).slice(0, 2).map((w) => w.slice(0, 7));
      const stichtag = frist && frist.slice(0, 10) > new Date().toISOString().slice(0, 10) ? frist.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const passend = unterlagen.filter((x) => suchwoerter.some((w) => norm(x.name).replace(/\s+/g, "").includes(w.replace(/\s+/g, ""))));
      const d = passend.find((x) => !x.gueltig_bis || x.gueltig_bis >= stichtag);
      const abgelaufen = !d && passend.length ? passend[0] : undefined;
      return { b, status: d ? "Passender, gültiger Nachweis hinterlegt – Inhalt prüfen" : abgelaufen ? "Nachweis hinterlegt, aber zur Frist nicht mehr gültig" : "Kein passender gültiger Nachweis hinterlegt", gefunden: !!d, dokument: d ?? abgelaufen };
    }
    const passend = personal.filter((p) => p.status === "verfuegbar" && (b.art === "beruf" ? p.berufe : p.qualifikationen).some((x) => norm(x) === name));
    return { b, status: `${passend.length} passende verfügbare Kräfte im sichtbaren Personalbestand${b.menge ? ` · Text nennt ${b.menge}` : " · benötigte Anzahl nicht sicher erkannt"}`, gefunden: passend.length > 0 && (!b.menge || passend.length >= b.menge) };
  });
}

export async function teilnahmeTeil(s: Sitzung, env: KontoEnv, v: V, finanzrecht: boolean, bearbeiten: boolean, losWahl = ""): Promise<string> {
  const n = await bekanntmachung(s, env, v);
  const los = n?.lose.find((l) => l.id === losWahl);
  const bedarf = (n?.bedarf ?? bedarfErkennen(v.steckbrief ?? "")).filter((b) => !los || !b.los || b.los === los.id);
  const version = n?.version ?? await hash(v.steckbrief ?? "");
  const [p, d, bestaetigt, feedback] = await Promise.all([
    db<{ berufe: string[]; qualifikationen: string[]; status: string }[]>(s, env, `personal?firma_id=eq.${v.firma_id}${v.bereich_id ? `&bereich_id=eq.${v.bereich_id}` : ""}&select=berufe,qualifikationen,status&limit=1000`),
    finanzrecht ? Promise.all([db<FirmenDatei[]>(s, env, `firmenunterlagen?firma_id=eq.${v.firma_id}&select=*`), referenzenLaden(s, env, v.firma_id)]).then(([r, refs]) => r.ok ? { ok: true as const, daten: mitReferenzen(r.daten, refs, v.firma_id) } : r) : Promise.resolve(null),
    db<{ schluessel: string; bestaetigt: boolean; quelle_version: string }[]>(s, env, `bedarf_bestaetigungen?vorgang_id=eq.${v.id}&firma_id=eq.${v.firma_id}&select=schluessel,bestaetigt,quelle_version`),
    db<{ grund: string; notiz: string }[]>(s, env, `treffer_feedback?vorgang_id=eq.${v.id}&firma_id=eq.${v.firma_id}&select=grund,notiz`),
  ]);
  const checks = teilnahmeCheck(bedarf, p.ok ? p.daten : [], d?.ok ? d.daten : null, los?.frist ?? v.frist);
  const rows = checks.map(({ b, status, gefunden }) => {
    const ok = bestaetigt.ok && bestaetigt.daten.some((x) => x.schluessel === bedarfKey(b) && x.bestaetigt && x.quelle_version === version);
    return `<li><strong>${escape(b.name)}</strong>${b.los ? ` · Los ${escape(b.los)}` : ""}<br>${gefunden ? "✓" : "○"} ${escape(b.art === "nachweis" || p.ok ? status : "Personalbestand nicht geladen – kein Abgleich möglich")}${!gefunden && b.art === "beruf" ? ` · <a href="/konto/markt?ansicht=partner&q=${encodeURIComponent(b.name)}">Partner suchen</a>` : ""}<details><summary>Fundstelle${ok ? " · bestätigt" : " · Vorschlag prüfen"}</summary><blockquote>${escape(b.fundstelle)}</blockquote>${bearbeiten ? `<form method="post" action="/konto/vorgang/${v.id}/bedarf"><input type="hidden" name="schluessel" value="${escape(bedarfKey(b))}"><input type="hidden" name="bestaetigt" value="${ok ? "0" : "1"}"><button class="knopf-klein">${ok ? "Bestätigung zurücknehmen" : "Anforderung bestätigen"}</button></form>` : ""}</details></li>`;
  }).join("");
  const stand = n ? `<p>Quelle: ${escape(n.quelle)} · Stand ${datum(n.quell_datum)} · ${escape(n.status)}${n.frist ? ` · aktuelle Frist ${datum(n.frist)}` : " · Frist unbekannt"}</p>${v.katalog_version && n.version !== v.katalog_version ? `<p role="status"><strong>Die Bekanntmachung wurde seit der letzten Zuordnung geändert. Frist und Anforderungen erneut prüfen.</strong></p>` : ""}${["aufgehoben", "vergeben", "abgeschlossen"].includes(n.status) ? `<p class="fehler">Diese Ausschreibung ist laut Quelle nicht mehr offen.</p>` : ""}` : "";
  let aenderungen = "";
  if (n) {
    const a = await db<{ zeit: string; details: Record<string, any> }[]>(s, env, `katalog_aenderungen?katalog_id=eq.${encodeURIComponent(n.id)}&select=zeit,details&order=zeit.desc&limit=5`);
    if (a.ok && a.daten.length) aenderungen = `<details><summary>Änderungsverlauf</summary><ul>${a.daten.map((x) => `<li>${datum(x.zeit)} · ${x.details.frist_vorher !== x.details.frist_neu ? `Frist: ${datum(x.details.frist_vorher)} → ${datum(x.details.frist_neu)} · ` : ""}${x.details.status_vorher !== x.details.status_neu ? `Status: ${escape(x.details.status_neu)} · ` : ""}${x.details.leistungen_geaendert || x.details.lose_geaendert ? "Leistung oder Lose geändert" : "Bekanntmachung aktualisiert"}</li>`).join("")}</ul></details>`;
  }
  const rueck = feedback.ok ? feedback.daten[0] : undefined;
  let ergebnisForm = "";
  if (finanzrecht) {
    const ergebnisse = await db<any[]>(s, env, `angebotsergebnisse?firma_id=eq.${v.firma_id}&vorgang_id=eq.${v.id}&select=umsatz,kosten,notiz`);
    const e = ergebnisse.ok ? ergebnisse.daten[0] : undefined;
    ergebnisForm = bearbeiten ? `<details><summary>Wirtschaftliches Ergebnis erfassen</summary><p class="klein">Freiwillige eigene Ist-Angaben für die spätere Auswertung. Keine Übernahme öffentlicher Auftragswerte als eigener Umsatz.</p><form method="post" action="/konto/vorgang/${v.id}/ergebnis"><label>Tatsächlicher Umsatz (€)<input type="number" name="umsatz" min="0" max="999999999" step="0.01" value="${e?.umsatz ?? ""}"></label><label>Tatsächliche Kosten (€)<input type="number" name="kosten" min="0" max="999999999" step="0.01" value="${e?.kosten ?? ""}"></label><label>Notiz<input name="notiz" maxlength="500" value="${escape(e?.notiz ?? "")}"></label><button>Ergebnis speichern</button></form></details>` : "";
  }
  const losAuswahl = n && n.lose.length > 1 ? `<form method="get" action="/konto/vorgang/${v.id}"><label>Los für die Teilnahmeprüfung<select name="los"><option value="">Alle Lose als Überblick</option>${n.lose.map((l) => `<option value="${escape(l.id)}"${los?.id === l.id ? " selected" : ""}>Los ${escape(l.id)} · ${escape(l.titel)}</option>`).join("")}</select></label><button>Los prüfen</button></form>` : "";
  const nachweise = checks.filter((c) => c.b.art === "nachweis");
  const liste = nachweise.length ? `<section class="nachweis-check" id="nachweise"><h2>✅ Nachweise für dieses Angebot <span class="check-zahl">${nachweise.filter((c) => c.gefunden).length}/${nachweise.length} vorhanden</span></h2><ul>${nachweise.map((c) => {
    const dok = "dokument" in c ? c.dokument as FirmenDatei | undefined : undefined;
    return `<li class="${c.gefunden ? "ok" : "fehlt"}"><span aria-hidden="true">${c.gefunden ? "✓" : "✗"}</span><span><strong>${escape(c.b.name)}</strong>${c.b.los ? ` · Los ${escape(c.b.los)}` : ""}<br><span class="klein">${d === null ? "Abgleich braucht die Finanzfreigabe" : dok ? `${escape(dok.name)}${dok.gueltig_bis ? ` · gültig bis ${datum(dok.gueltig_bis)}` : ""}${c.gefunden ? "" : " · abgelaufen"}` : "Noch nicht in den Firmenunterlagen"}</span></span>${!c.gefunden && d !== null ? `<a href="/konto/firmenunterlagen?firma=${v.firma_id}&name=${encodeURIComponent(c.b.name)}">Hochladen</a>` : ""}</li>`;
  }).join("")}</ul>${nachweise.some((c) => c.gefunden) ? `<p class="nachweis-zip"><a class="knopf zweit" href="/konto/vorgang/${v.id}/nachweise.zip">📦 Vorhandene Nachweise als Zip</a></p>` : ""}<p class="klein">Erkannt aus der Bekanntmachung und den Losen. Prüfe zusätzlich die Vergabeunterlagen.</p></section>` : "";
  return `<section>${liste}${stand}${aenderungen}<details><summary>Können wir den Auftrag übernehmen?${checks.length ? ` <span class="check-zahl">${checks.filter((c) => c.gefunden).length}/${checks.length} erfüllt</span>` : ""}</summary>${losAuswahl}<p class="klein">Planungshilfe aus Textfundstellen und euren hinterlegten Daten. Unbekannte Anforderungen, Verfügbarkeit und Nachweise vor der Abgabe prüfen. Es wird niemand automatisch eingeplant.</p>${v.frist && Date.parse(v.frist) < Date.now() ? `<p class="fehler">Die gespeicherte Angebotsfrist ist abgelaufen.</p>` : !v.frist ? `<p>Die Angebotsfrist ist unbekannt – zuerst beim Portal prüfen.</p>` : ""}${rows ? `<ul class="teilnahme-liste">${rows}</ul>` : `<p>Aus dem vorhandenen Text wurden noch keine sicheren Berufs- oder Nachweisanforderungen erkannt. Lade die Vergabeunterlagen hoch.</p>`}${n?.lose?.length ? `<details><summary>Lose und eigene Fristen</summary><ul>${n.lose.map((l) => `<li>Los ${escape(l.id)} · ${escape(l.titel)} · Frist ${datum(l.frist)}</li>`).join("")}</ul></details>` : ""}</details></section>${bearbeiten ? `<details><summary>Passt dieser Treffer?</summary><form method="post" action="/konto/vorgang/${v.id}/rueckmeldung"><label>Rückmeldung<select name="grund">${Object.entries(GRUENDE).map(([key, label]) => `<option value="${key}"${rueck?.grund === key ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>Ergänzung<input name="notiz" maxlength="500" value="${escape(rueck?.notiz ?? "")}"></label><button>Rückmeldung speichern</button></form></details>` : ""}${ergebnisForm}`;
}

export async function markt(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const zip = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/nachweise\.zip$/);
  if (zip) {
    const z = await vorgangZugriff(request, env, zip[1]);
    if (!z) return weiterleiten("/konto");
    if (!z.finanzen || !env.DATEN) return html(seite("Nicht erlaubt", "<p>Für Nachweise brauchst du eine Finanzfreigabe.</p>"), 403, z.s.cookies);
    const auswahl = await nachweiseFuerVorgang(z.s, env, z.v);
    const firma = await db<{ name: string }[]>(z.s, env, `firmen?id=eq.${z.v.firma_id}&select=name`);
    const inhalt = auswahl ? await nachweiseZip(env.DATEN, auswahl.dateien, auswahl.refs, firma.ok ? firma.daten[0]?.name ?? "" : "", false) : "Die Unterlagen konnten nicht geladen werden.";
    if (typeof inhalt === "string") return html(seite("Nachweise", `<p class="fehler">${escape(inhalt)}</p><p><a href="/konto/vorgang/${z.v.id}#nachweise">Zurück zur Ausschreibung</a></p>`), 409, z.s.cookies);
    return zipAntwort(inhalt, `Nachweise_${z.v.titel.replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 50) || "Ausschreibung"}.zip`, z.s.cookies);
  }
  const rueck = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/(rueckmeldung|bedarf|ergebnis)$/);
  if (rueck && request.method === "POST") {
    const z = await vorgangZugriff(request, env, rueck[1]);
    if (!z || !["inhaber", "admin", "bearbeiter", "standortleitung"].includes(z.rolle)) return html(seite("Nicht erlaubt", "<p>Keine Bearbeitungsrechte.</p>"), 403);
    const f = await request.formData(); const daten: Record<string, any> = { firma_id: z.v.firma_id, vorgang_id: z.v.id };
    let table = "treffer_feedback";
    if (rueck[2] === "ergebnis") {
      if (!z.finanzen) return html(seite("Nicht erlaubt", "<p>Finanzfreigabe erforderlich.</p>"), 403);
      table = "angebotsergebnisse";
      const betrag = (key: string) => { const raw = text(f, key, 30); if (!raw) return null; const x = Number(raw.replace(",", ".")); return Number.isFinite(x) && x >= 0 && x <= 999999999 ? Math.round(x * 100) / 100 : NaN; };
      daten.umsatz = betrag("umsatz"); daten.kosten = betrag("kosten"); daten.notiz = text(f, "notiz", 500); daten.aktualisiert = new Date().toISOString();
      if (Number.isNaN(daten.umsatz) || Number.isNaN(daten.kosten)) return html(seite("Ungültiger Betrag", "<p>Bitte gültige Beträge eintragen.</p>"), 400);
    } else if (rueck[2] === "bedarf") {
      const n = await bekanntmachung(z.s, env, z.v); const key = text(f, "schluessel", 200);
      if (!(n?.bedarf ?? bedarfErkennen(z.v.steckbrief ?? "")).some((b) => bedarfKey(b) === key)) return html(seite("Ungültige Auswahl", "<p>Diese Textanforderung ist nicht mehr aktuell.</p>"), 400);
      table = "bedarf_bestaetigungen"; daten.schluessel = key; daten.bestaetigt = f.get("bestaetigt") === "1"; daten.quelle_version = n?.version ?? await hash(z.v.steckbrief ?? "");
    } else { daten.grund = text(f, "grund", 30); daten.notiz = text(f, "notiz", 500); if (!GRUENDE[daten.grund]) return html(seite("Ungültige Auswahl", "<p>Bitte einen Rückmeldungsgrund wählen.</p>"), 400); }
    const r = await db(z.s, env, `${table}?on_conflict=${table === "bedarf_bestaetigungen" ? "firma_id,vorgang_id,schluessel" : "firma_id,vorgang_id"}`, { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(daten) });
    // Thumbs on the hit list send the user back to the list they came from.
    const zurueck = String(f.get("weiter") ?? "");
    // 👎 "does not fit" by someone who may edit the search profile: offer words to exclude (H2).
    const vorschlag = r.ok && daten.grund === "taetigkeit" && ["inhaber", "admin"].includes(z.rolle) ? `vorschlag=${z.v.id}` : "";
    if (r.ok && /^\/konto\/treffer(\?|$)/.test(zurueck) && !/[\r\n]/.test(zurueck)) return weiterleiten(vorschlag ? `${zurueck}${zurueck.includes("?") ? "&" : "?"}${vorschlag}` : zurueck, z.s.cookies);
    return weiterleiten(`/konto/vorgang/${z.v.id}${r.ok ? (vorschlag ? `?${vorschlag}` : "") : "?fehler=Speichern%20fehlgeschlagen"}`, z.s.cookies);
  }
  if (!url.pathname.startsWith("/konto/markt")) return null;
  const f = await aktiveFirma(request, env); if (!f) return weiterleiten("/konto");
  if (f.m.rolle === "mitarbeiter") return html(seite("Nicht erlaubt", "<p>Dieser Bereich benötigt Zugriff auf vollständige Ausschreibungen.</p>"), 403, f.s.cookies);
  const firma = f.m.firma_id;
  if (request.method === "POST") {
    const form = await request.formData(); let ok = false;
    if (url.pathname === "/konto/markt/uebernehmen" && ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle)) {
      const r = await db<string>(f.s, env, "rpc/katalog_uebernehmen", { method: "POST", body: JSON.stringify({ f: firma, k: text(form, "id", 400), b: null }) });
      if (r.ok && typeof r.daten === "string") return weiterleiten(`/konto/vorgang/${r.daten}`, f.s.cookies);
    } else if (url.pathname === "/konto/markt/beobachten" && f.admin) {
      const id = text(form, "auftraggeber", 400);
      if (form.get("aktion") === "entfernen") ok = (await db(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&auftraggeber_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })).ok;
      else {
        const n = await db<{ auftraggeber: string }[]>(f.s, env, `vergabekatalog?auftraggeber_id=eq.${encodeURIComponent(id)}&select=auftraggeber&limit=1`);
        if (n.ok && n.daten[0]) ok = (await db(f.s, env, "auftraggeber_abos?on_conflict=firma_id,auftraggeber_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, auftraggeber_id: id, name: n.daten[0].auftraggeber }) })).ok;
      }
    } else if (url.pathname === "/konto/markt/partner" && f.admin) {
      const name = text(form, "name", 200), leistungen = text(form, "leistungen", 2000);
      if (name.length >= 2 && leistungen.length >= 2) ok = (await db(f.s, env, "partnerprofile?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: firma, name, leistungen, region: text(form, "region", 500), kontakt: text(form, "kontakt", 300), sichtbar: form.has("sichtbar"), geaendert: new Date().toISOString() }) })).ok;
    }
    return weiterleiten(`/konto/markt?ansicht=${url.pathname.endsWith("partner") ? "partner" : "offen"}&hinweis=${encodeURIComponent(ok ? "Gespeichert." : "Konnte nicht gespeichert werden. Prüfe Rechte und Angaben.")}`, f.s.cookies);
  }
  const tab = url.searchParams.get("ansicht") ?? "offen";
  const tabs = `<nav class="reiter" aria-label="Marktbereiche">${[["offen", "Aufträge"], ["bedarf", "Marktbedarf"], ["partner", "Partner"], ["ergebnisse", "Ergebnisse"], ["quellen", "Datenstand"]].map(([key, name]) => `<a href="/konto/markt?ansicht=${key}"${tab === key ? ' aria-current="page"' : ""}>${name}</a>`).join("")}<a href="/konto/radar">🔮 Radar</a></nav>`;
  const quellen = await db<any[]>(f.s, env, "katalog_quellen?select=*");
  if (!quellen.ok) return html(seite("Markt & Chancen", `${tabs}<p>Der gemeinsame Bestand wird gerade eingerichtet. Deine bisherigen Ausschreibungen bleiben unter <a href="/konto/treffer">Treffer</a> erreichbar.</p>`, 0, "treffer"), 200, f.s.cookies);
  let body = "";
  if (tab === "offen") {
    const q = (url.searchParams.get("q") ?? "").slice(0, 300), gebiet = (url.searchParams.get("gebiet") ?? "").slice(0, 100), buyer = (url.searchParams.get("auftraggeber") ?? "").slice(0, 400), zustand = url.searchParams.get("zustand") === "zuschlaege" ? "zuschlaege" : "offen";
    const [r, abos] = await Promise.all([
      db<Bekanntmachung[]>(f.s, env, "rpc/katalog_suche?select=id,quelle,quelle_id,titel,version,quell_datum,auftraggeber,auftraggeber_id,beschreibung,ort,plz,cpv,frist,status,lose,bedarf,zuschlaege,vertragsende,link", { method: "POST", body: JSON.stringify({ f: firma, suche: q, gebiet, kaeufer: buyer, zustand }) }),
      db<{ auftraggeber_id: string; name: string }[]>(f.s, env, `auftraggeber_abos?firma_id=eq.${firma}&select=auftraggeber_id,name`),
    ]);
    const beobachtet = abos.ok ? abos.daten : [];
    body = `<form method="get" class="markt-suche"><label>Leistung oder Beruf<input name="q" value="${escape(q)}" maxlength="300"></label><label>Ort oder PLZ<input name="gebiet" value="${escape(gebiet)}" maxlength="100"></label><label>Auftraggeber<select name="auftraggeber"><option value="">Alle Auftraggeber</option>${beobachtet.map((a) => `<option value="${escape(a.auftraggeber_id)}"${a.auftraggeber_id === buyer ? " selected" : ""}>${escape(a.name)}</option>`).join("")}</select></label><label>Bestand<select name="zustand"><option value="offen">Offene Ausschreibungen</option><option value="zuschlaege"${zustand === "zuschlaege" ? " selected" : ""}>Veröffentlichte Zuschläge</option></select></label><button>Suchen</button></form><p class="klein">${r.ok ? r.daten.length : 0} Treffer · höchstens 60 pro Suche. Bekannte abgelaufene Fristen werden bei offenen Aufträgen ausgeschlossen; unbekannte Fristen bleiben gekennzeichnet.</p>`;
    body += r.ok ? `<div class="treffer-karten">${r.daten.map((n) => `<article class="treffer-karte"><h2>${escape(n.titel)}</h2><p>${escape(n.auftraggeber)} · ${escape(n.ort)}</p><p>${escape(n.status)} · Frist: ${datum(n.frist)}</p><details><summary>Bekanntmachung und Lose</summary><p>${escape(n.beschreibung || "Keine Beschreibung vorhanden.")}</p>${n.lose.length ? `<ul>${n.lose.map((l) => `<li>Los ${escape(l.id)}: ${escape(l.titel)} · ${datum(l.frist)}</li>`).join("")}</ul>` : ""}<p class="klein">Quelle: ${escape(n.quelle)} · veröffentlicht ${datum(n.quell_datum)} · <a href="${escape(n.link)}" target="_blank" rel="noopener">Original öffnen</a></p>${n.zuschlaege.map((z) => `<p>Zuschlag ${datum(z.datum)} · ${z.gewinner.map(escape).join(", ") || "Gewinner nicht veröffentlicht"}${z.wert !== null ? ` · veröffentlichter Gesamtwert ${z.wert.toLocaleString("de-DE")} ${escape(z.waehrung)}` : " · Wert nicht veröffentlicht"}. Daraus ergibt sich kein verlässlicher Stundenpreis.</p>`).join("")}</details><div class="markt-aktionen">${["inhaber", "admin", "bearbeiter"].includes(f.m.rolle) && ["offen", "unbekannt"].includes(n.status) ? `<form method="post" action="/konto/markt/uebernehmen"><input type="hidden" name="id" value="${escape(n.id)}"><button>In meine Ausschreibungen übernehmen</button></form>` : ""}${f.admin ? `<form method="post" action="/konto/markt/beobachten"><input type="hidden" name="auftraggeber" value="${escape(n.auftraggeber_id)}">${beobachtet.some((a) => a.auftraggeber_id === n.auftraggeber_id) ? `<input type="hidden" name="aktion" value="entfernen"><button class="knopf-klein">Beobachtung beenden</button>` : `<button class="knopf-klein">Auftraggeber beobachten</button>`}</form>` : ""}</div></article>`).join("") || "<p>Noch keine Treffer zu dieser Suche. Der Datenbestand wird schrittweise aufgebaut.</p>"}</div>` : `<p>Suche konnte nicht geladen werden. Bitte erneut versuchen.</p>`;
  } else if (tab === "bedarf") {
    const r = await db<any>(f.s, env, "rpc/katalog_statistik", { method: "POST", body: JSON.stringify({ f: firma }) });
    const d = r.ok ? r.daten : {};
    body = `<h2>Bedarf im erfassten Markt</h2><p>${d.gesamt ?? 0} Bekanntmachungen · ${d.offen ?? 0} noch offen · ${d.unbekannte_frist ?? 0} ohne bekannte Frist.</p><p class="klein">Auswertung des erfassten Bestands. Häufigkeit einer Textnennung ist keine Zahl freier Stellen und kein vollständiges Marktbild.</p><h3>Gesuchte Berufsgruppen</h3><ul>${(d.berufe ?? []).map((x: any) => `<li>${escape(x.name)} · ${x.anzahl} Textnennungen</li>`).join("") || "<li>Noch keine auswertbaren Anforderungen.</li>"}</ul><h3>Regionen</h3><ul>${(d.regionen ?? []).map((x: any) => `<li>PLZ ${escape(x.plz_praefix)}… · ${x.anzahl} Bekanntmachungen</li>`).join("")}</ul><h3>Künftige Chancen</h3><p><a class="knopf zweit" href="/konto/radar">🔮 Radar für deine Branche öffnen</a></p><p class="klein">Prognosen aus veröffentlichten Vertragsenden. Vorbereitungsdatum = Vertragsende minus 90 Tage; keine zugesicherte Neuausschreibung.</p><ul>${(d.prognosen ?? []).map((x: any) => `<li>${escape(x.auftraggeber)}: ${escape(x.titel)} · Vertrag endet ${datum(x.vertragsende)} · Vorbereitung ab ${datum(x.vorbereitung_ab)} · <strong>Prognose</strong></li>`).join("") || "<li>Noch keine passenden Vertragsenden veröffentlicht.</li>"}</ul><h3>Wiederkehrende Beschaffungen</h3><ul>${(d.wiederkehrend ?? []).map((x: any) => `<li>${escape(x.auftraggeber)} · ${escape(x.titel)} · ${x.anzahl} getrennte Bekanntmachungen seit ${datum(x.zuerst)}</li>`).join("") || "<li>Für belastbare Wiederholungsmuster reicht die erfasste Historie noch nicht.</li>"}</ul>`;
  } else if (tab === "partner") {
    const r = await db<any[]>(f.s, env, "partnerprofile?sichtbar=eq.true&select=firma_id,name,leistungen,region,kontakt&limit=100");
    const own = f.admin ? await db<any[]>(f.s, env, `partnerprofile?firma_id=eq.${firma}&select=*`) : null;
    const p = own?.ok ? own.daten[0] ?? {} : {};
    const suche = (url.searchParams.get("q") ?? "").slice(0, 200);
    body = `<p>Partnerprofile werden nur nach ausdrücklicher Freigabe durch die jeweilige Firma angezeigt. Kontaktaufnahme erfolgt durch dich; Jarvis verschickt nichts.</p><form method="get"><input type="hidden" name="ansicht" value="partner"><label>Benötigte Leistung oder Region<input name="q" value="${escape(suche)}"></label><button>Partner suchen</button></form><div class="treffer-karten">${(r.ok ? r.daten : []).filter((x) => x.firma_id !== firma && (!suche || norm(suche).split(/[^a-z0-9äöü]+/).filter((w) => w.length > 2).every((w) => norm(x.leistungen + " " + x.region).includes(w)))).map((x) => `<article class="treffer-karte"><h2>${escape(x.name)}</h2><p>${escape(x.leistungen)}</p><p>${escape(x.region)}</p><p>Freigegebener Kontakt: ${escape(x.kontakt || "nicht angegeben")}</p></article>`).join("") || "<p>Noch keine passenden freigegebenen Partnerprofile.</p>"}</div>${f.admin ? `<details><summary>Eigenes Partnerprofil</summary><form method="post" action="/konto/markt/partner"><label>Firmenname<input name="name" required minlength="2" maxlength="200" value="${escape(p.name ?? f.m.firmen.name)}"></label><label>Leistungen<textarea name="leistungen" required minlength="2" maxlength="2000">${escape(p.leistungen ?? "")}</textarea></label><label>Regionen<input name="region" maxlength="500" value="${escape(p.region ?? "")}"></label><label>Öffentlich freizugebender Kontakt<input name="kontakt" maxlength="300" value="${escape(p.kontakt ?? "")}"></label><label class="zeile"><input type="checkbox" name="sichtbar"${p.sichtbar ? " checked" : ""}>Dieses Profil für andere angemeldete Firmen sichtbar machen</label><button>Partnerprofil speichern</button></form></details>` : ""}`;
  } else if (tab === "ergebnisse") {
    const [v, feedback] = await Promise.all([db<any[]>(f.s, env, `vorgaenge?firma_id=eq.${firma}&select=status,vergabekatalog(ort,cpv)&limit=10000`), db<any[]>(f.s, env, `treffer_feedback?firma_id=eq.${firma}&select=grund&limit=10000`)]);
    const list = v.ok ? v.daten : []; const gewonnen = list.filter((x) => x.status === "gewonnen").length, verloren = list.filter((x) => x.status === "verloren").length;
    body = `<h2>Eigene Angebotsergebnisse</h2><p>${gewonnen} gewonnen · ${verloren} verloren · ${list.filter((x) => x.status === "abgegeben").length} warten auf Entscheidung.</p><p>${gewonnen + verloren ? `${Math.round(100 * gewonnen / (gewonnen + verloren))} % gewonnen unter den ${gewonnen + verloren} entschiedenen Vorgängen.` : "Noch keine entschiedenen Vorgänge erfasst."}</p><p class="klein">Eigene Statusangaben; keine extern bestätigte Zuschlagsstatistik. Es werden nur Vorgänge ausgewertet, auf die du Zugriff hast.</p><h3>Suchprofil verbessern</h3><ul>${Object.entries(GRUENDE).map(([key, label]) => { const n = (feedback.ok ? feedback.daten : []).filter((x) => x.grund === key).length; return n ? `<li>${label}: ${n}${key !== "passt" ? ` · ${VORSCHLAEGE[key]}` : ""}</li>` : ""; }).join("") || "<li>Noch keine Rückmeldungen. Am Treffer kannst du einen Grund angeben.</li>"}</ul><p><a href="/konto/suchprofil">Suchprofil prüfen</a></p>`;
    const gruppen = new Map<string, { gewonnen: number; verloren: number }>();
    for (const x of list.filter((x) => ["gewonnen", "verloren"].includes(x.status))) {
      const region = x.vergabekatalog?.ort || "Ort unbekannt";
      const g = gruppen.get(region) ?? { gewonnen: 0, verloren: 0 };
      if (x.status === "gewonnen") g.gewonnen++; else g.verloren++;
      gruppen.set(region, g);
    }
    if (gruppen.size) body += `<h3>Ergebnisse nach Einsatzort</h3><ul>${[...gruppen].map(([ort, g]) => `<li>${escape(ort)} · ${g.gewonnen} gewonnen / ${g.verloren} verloren</li>`).join("")}</ul>`;
    if (f.finanzen) {
      const ist = await db<any[]>(f.s, env, `angebotsergebnisse?firma_id=eq.${firma}&select=umsatz,kosten,vorgaenge(titel,status)&limit=10000`);
      const werte = (ist.ok ? ist.daten : []).filter((x) => x.umsatz !== null && x.kosten !== null);
      if (werte.length) body += `<h3>Eigene wirtschaftliche Ergebnisse</h3><p>${werte.length} Vorgänge mit Umsatz und Kosten · Differenz gesamt ${werte.reduce((sum, x) => sum + Number(x.umsatz) - Number(x.kosten), 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}.</p><ul>${werte.map((x) => `<li>${escape(x.vorgaenge?.titel ?? "Vorgang")} · ${Number(x.umsatz - x.kosten).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</li>`).join("")}</ul><p class="klein">Aus freiwilligen eigenen Ist-Angaben; keine Aussage über noch nicht erfasste Kosten.</p>`;
      else body += `<p>Wirtschaftliche Ergebnisse kannst du direkt am Treffer freiwillig erfassen.</p>`;
    }
  } else {
    body = `<h2>Quellen und Datenstand</h2>${quellen.daten.map((q) => `<article class="treffer-karte"><h3>${escape(q.name)}</h3><p>Letzter erfolgreicher Abruf: ${datum(q.letzter_erfolg)} · ${q.erlaubt ? "freigegeben" : "pausiert"}</p><p>Erfasster Zeitraum: ${datum(q.bestand_ab)} bis ${datum(q.bestand_bis)} · noch ${q.rueckstand_tage} Tage beim Erstaufbau offen.</p>${q.fehler ? `<p role="status">${escape(q.fehler)}</p>` : ""}${q.letzter_erfolg && Date.now() - Date.parse(q.letzter_erfolg) > 4 * 3600000 ? "<p>Datenstand ist älter als vier Stunden. Aktualisierungen können fehlen.</p>" : ""}<p>Lizenz: ${escape(q.lizenz)} · Quellenprüfung ${datum(q.geprueft)}</p></article>`).join("")}<h2>Kostenkontrolle</h2><p>Der Sammler nutzt keine KI. Bewertungen werden nach Ausschreibungs- und Suchprofilversion wiederverwendet. Für KI-Anfragen wird vorab ein Höchstbetrag reserviert; bei nicht erreichbarer Budgetprüfung bleibt die Anfrage gesperrt.</p><p>Gemeinsame KI-Grenzen: höchstens 3 US-Dollar pro UTC-Tag und 20 US-Dollar pro Kalendermonat. Streaming-Aufrufe werden vorsichtig mit ihrer Obergrenze gezählt. Speicher- und Auftragsgrenzen begrenzen den Sammler zusätzlich.</p><p class="klein">Das ist kein vollständiger Rechnungsbetrag der Anbieter. Infrastrukturkosten sind gesondert zu beachten; es werden keine neuen kostenpflichtigen Pläne gebucht.</p>`;
    if (f.admin) {
      const kosten = await db<any>(f.s, env, "rpc/katalog_budgetstatus", { method: "POST", body: JSON.stringify({ f: firma }) });
      if (kosten.ok) body += `<p>KI-Budget belegt: ${Number(kosten.daten.monat ?? 0).toFixed(2)} / 20 USD im Monat, ${Number(kosten.daten.tag ?? 0).toFixed(2)} / 3 USD heute (UTC). Wiederverwendbare Bewertungen dieser Firma: ${Number(kosten.daten.cache ?? 0)}.</p>`;
    }
  }
  const info = quellen.daten.some((q) => !q.letzter_erfolg || q.rueckstand_tage > 0) ? `<p role="status">Der gemeinsame Bestand wird aufgebaut. Er enthält noch nicht alle offenen Ausschreibungen.</p>` : "";
  return html(seite("Markt & Chancen", `${tabs}${url.searchParams.get("hinweis") ? `<p role="status">${escape(url.searchParams.get("hinweis")!)}</p>` : ""}${info}${body}`, 0, "treffer"), 200, f.s.cookies);
}
