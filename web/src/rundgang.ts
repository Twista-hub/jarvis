// Idea 11: patrol rounds and guard log for security firms. The office sets QR checkpoints per place of work
// (/konto/rundgaenge, printable QR sheet), staff scan them with the phone camera (/k/<token>, stored with server time
// by rundgang_scannen) and write guard log entries (report, incident, handover). Office: everything of the firm;
// staff: only their own entries (row level security, migration 20261103040000).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { qrSvg } from "./qr.ts";
import { escape, seite } from "./seite.ts";

type Ort = { id: string; name: string };
type Punkt = { id: string; einsatzort_id: string; name: string; token: string };
type Scan = { zeit: string; kontrollpunkt_id: string; personal_id: string };
type Eintrag = { zeit: string; art: string; text: string; einsatzort_id: string | null; personal_id: string };
type Person = { id: string; vorname: string; nachname: string };
const ADRESSE = "https://app.wpdigitalranger.com";
const ART: Record<string, string> = { meldung: "📝 Meldung", vorfall: "⚠️ Vorfall", uebergabe: "🔁 Übergabe" };
const zeit = (z: string) => new Date(z).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export const scanLink = (token: string) => `${ADRESSE}/k/${token}`;

export function rundgangSeite(orte: Ort[], punkte: Punkt[], scans: Scan[], eintraege: Eintrag[], personen: Person[], darfAendern: boolean): string {
  const pName = (id: string) => { const p = personen.find((x) => x.id === id); return p ? `${p.vorname} ${p.nachname}`.trim() : "–"; };
  const punkt = (id: string) => punkte.find((x) => x.id === id);
  const oName = (id: string | null) => orte.find((x) => x.id === id)?.name ?? "";
  return `<p class="klein">Kontrollpunkte als QR-Code ausdrucken und vor Ort anbringen. Die Einsatzkraft scannt sie mit der Handy-Kamera; Jarvis speichert Zeit und Person. Ins Wachbuch schreiben Einsatzkräfte Meldungen, Vorfälle und Übergaben.</p>
${orte.length ? orte.map((o) => {
    const liste = punkte.filter((p) => p.einsatzort_id === o.id);
    return `<details${liste.length ? "" : " open"}><summary>📍 ${escape(o.name)} (${liste.length} Kontrollpunkte)</summary>
${liste.length ? `<ul class="kontakt-liste">${liste.map((p) => `<li><div><strong>${escape(p.name)}</strong><span class="klein">${scans.filter((s) => s.kontrollpunkt_id === p.id).length} Scans in 7 Tagen</span></div>${darfAendern ? `<form method="post" action="/konto/rundgaenge"><input type="hidden" name="weg" value="${p.id}"><button class="zweit" aria-label="Kontrollpunkt löschen">✕</button></form>` : ""}</li>`).join("")}</ul><p><a class="knopf zweit" href="/konto/rundgaenge/qr?ort=${o.id}">🖨️ QR-Codes drucken</a></p>` : ""}
${darfAendern ? `<form method="post" action="/konto/rundgaenge" class="formular-zeile"><input type="hidden" name="ort" value="${o.id}"><label>Neuer Kontrollpunkt <input name="name" required maxlength="120" placeholder="z. B. Notausgang Nord"></label><button class="zweit">Hinzufügen</button></form>` : ""}</details>`;
  }).join("") : `<p class="treffer-leer">Zuerst unter <a href="/konto/kunden">Kunden &amp; Einsatzorte</a> einen Einsatzort anlegen.</p>`}
<h2>Rundgänge (letzte 7 Tage)</h2>
${scans.length ? `<table><tr><th>Zeit</th><th>Kontrollpunkt</th><th>Einsatzort</th><th>Person</th></tr>${scans.map((s) => { const p = punkt(s.kontrollpunkt_id); return `<tr><td>${zeit(s.zeit)}</td><td>${escape(p?.name ?? "gelöscht")}</td><td>${escape(oName(p?.einsatzort_id ?? null))}</td><td>${escape(pName(s.personal_id))}</td></tr>`; }).join("")}</table>` : `<p class="treffer-leer">Noch keine Scans.</p>`}
<h2>Wachbuch (letzte 14 Tage)</h2>
${eintraege.length ? `<ul class="kontakt-liste">${eintraege.map((e) => `<li><div><strong>${ART[e.art] ?? e.art} · ${zeit(e.zeit)}</strong><span class="klein">${escape([oName(e.einsatzort_id), pName(e.personal_id)].filter(Boolean).join(" · "))}</span><span>${escape(e.text)}</span></div></li>`).join("")}</ul>` : `<p class="treffer-leer">Noch keine Einträge.</p>`}`;
}

export function qrBogen(ort: Ort, punkte: Punkt[]): string {
  return `<h1>Kontrollpunkte: ${escape(ort.name)}</h1><p class="klein">Ausschneiden und am jeweiligen Ort anbringen. Scannen mit der Handy-Kamera (angemeldet in Jarvis).</p>
<div class="qr-bogen">${punkte.map((p) => `<figure class="qr-karte">${qrSvg(scanLink(p.token), p.name)}<figcaption><strong>${escape(p.name)}</strong><br>${escape(ort.name)}</figcaption></figure>`).join("")}</div>
<style>.qr-bogen{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}.qr-karte{border:1px dashed #999;padding:12px;margin:0;text-align:center;break-inside:avoid}.qr-karte svg{width:150px;height:150px}</style>`;
}

export function scanSeite(ergebnis: { punkt: string; ort: string; zeit: string } | null, token: string, hinweis = ""): string {
  if (!ergebnis) return `<h1>Kontrollpunkt nicht erkannt</h1><p>Der Code gehört nicht zu deiner Firma oder du bist nicht als Einsatzkraft eingetragen.</p><p><a href="/konto">Zur Übersicht</a></p>`;
  return `${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}<h1>✅ ${escape(ergebnis.punkt)}</h1><p>${escape(ergebnis.ort)} · erfasst um ${zeit(ergebnis.zeit)}</p>
<h2>Ins Wachbuch schreiben</h2>
<form method="post" action="/k/${escape(token)}"><label>Art <select name="art"><option value="meldung">Meldung</option><option value="vorfall">Vorfall</option><option value="uebergabe">Übergabe</option></select></label>
<label>Text <textarea name="text" required maxlength="2000" rows="4" placeholder="z. B. Alles in Ordnung / Tür 3 offen vorgefunden und verschlossen"></textarea></label><button>Eintragen</button></form>
<p><a href="/konto">Zur Übersicht</a></p>`;
}

export async function rundgaenge(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const scan = url.pathname.match(/^\/k\/([0-9a-f]{32})$/);
  if (!scan && !url.pathname.startsWith("/konto/rundgaenge")) return null;
  const f = await aktiveFirma(request, env);
  // Not logged in → login (and back to the scanned point); logged in without firm → overview.
  if (!f) return weiterleiten(await sitzung(request, env) ? "/konto" : `/anmelden?weiter=${encodeURIComponent(url.pathname)}`);
  if (scan) {
    const token = scan[1];
    const r = await db<{ punkt: string; ort: string; zeit: string; einsatzort_id: string; firma_id: string } | null>(f.s, env, "rpc/rundgang_scannen", { method: "POST", body: JSON.stringify({ token }) });
    const e = r.ok ? r.daten : null;
    let hinweis = url.searchParams.get("hinweis") ?? "";
    if (e && request.method === "POST") {
      const form = await request.formData();
      const text = String(form.get("text") ?? "").trim().slice(0, 2000), art = String(form.get("art") ?? "meldung");
      const p = await db<{ id: string }[]>(f.s, env, `personal?firma_id=eq.${e.firma_id}&user_id=eq.${f.s.userId}&select=id&limit=1`);
      const pid = p.ok ? p.daten[0]?.id : undefined;
      const w = pid && text.length >= 2 && ART[art] ? await db(f.s, env, "wachbuch", { method: "POST", body: JSON.stringify({ firma_id: e.firma_id, einsatzort_id: e.einsatzort_id, personal_id: pid, art, text }) }) : null;
      hinweis = w?.ok ? "Im Wachbuch eingetragen." : "Eintrag hat nicht geklappt.";
      return weiterleiten(`/k/${token}?hinweis=${encodeURIComponent(hinweis)}`, f.s.cookies);
    }
    return html(seite("Kontrollpunkt", scanSeite(e, token, hinweis)), e ? 200 : 404, f.s.cookies);
  }
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto", f.s.cookies);
  const firma = f.m.firma_id, darfAendern = ["inhaber", "admin", "bearbeiter"].includes(f.m.rolle);
  if (request.method === "POST" && darfAendern) {
    const form = await request.formData();
    const zurueck = (h: string) => weiterleiten(`/konto/rundgaenge?hinweis=${encodeURIComponent(h)}`, f.s.cookies);
    const weg = String(form.get("weg") ?? "");
    if (/^[0-9a-f-]{36}$/.test(weg)) { const r = await db(f.s, env, `kontrollpunkte?id=eq.${weg}&firma_id=eq.${firma}`, { method: "DELETE" }); return zurueck(r.ok ? "Kontrollpunkt gelöscht." : "Löschen hat nicht geklappt."); }
    const ort = String(form.get("ort") ?? ""), name = String(form.get("name") ?? "").trim().slice(0, 120);
    if (!/^[0-9a-f-]{36}$/.test(ort) || name.length < 2) return zurueck("Name des Kontrollpunkts fehlt.");
    const r = await db(f.s, env, "kontrollpunkte", { method: "POST", body: JSON.stringify({ firma_id: firma, einsatzort_id: ort, name }) });
    return zurueck(r.ok ? `Kontrollpunkt „${name}“ angelegt.` : "Anlegen hat nicht geklappt.");
  }
  const [o, p] = await Promise.all([
    db<Ort[]>(f.s, env, `einsatzorte?firma_id=eq.${firma}&select=id,name&order=name&limit=500`),
    db<Punkt[]>(f.s, env, `kontrollpunkte?firma_id=eq.${firma}&select=id,einsatzort_id,name,token&order=erstellt&limit=2000`),
  ]);
  const orte = o.ok ? o.daten : [], punkte = p.ok ? p.daten : [];
  if (url.pathname === "/konto/rundgaenge/qr") {
    const ort = orte.find((x) => x.id === url.searchParams.get("ort"));
    if (!ort) return weiterleiten("/konto/rundgaenge", f.s.cookies);
    return html(seite("QR-Codes drucken", qrBogen(ort, punkte.filter((x) => x.einsatzort_id === ort.id))), 200, f.s.cookies);
  }
  const seit7 = new Date(Date.now() - 7 * 86400_000).toISOString(), seit14 = new Date(Date.now() - 14 * 86400_000).toISOString();
  const [s, w, pe] = await Promise.all([
    db<Scan[]>(f.s, env, `rundgang_scans?firma_id=eq.${firma}&zeit=gte.${seit7}&select=zeit,kontrollpunkt_id,personal_id&order=zeit.desc&limit=1000`),
    db<Eintrag[]>(f.s, env, `wachbuch?firma_id=eq.${firma}&zeit=gte.${seit14}&select=zeit,art,text,einsatzort_id,personal_id&order=zeit.desc&limit=500`),
    db<Person[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname&limit=5000`),
  ]);
  const hinweis = url.searchParams.get("hinweis");
  return html(seite("Rundgänge & Wachbuch", `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück zu Firma &amp; Team">←</a></p>${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}${rundgangSeite(orte, punkte, s.ok ? s.daten : [], w.ok ? w.daten : [], pe.ok ? pe.daten : [], darfAendern)}`, 0, "team"), 200, f.s.cookies);
}
