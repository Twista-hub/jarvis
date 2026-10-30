import { cookie, db, html, sitzung, weiterleiten, type KontoEnv } from "./konto.ts";
import { darfFinanzen } from "./rechte.ts";
import { escape, seite } from "./seite.ts";

export const UUID = /^[0-9a-f-]{36}$/;
export type FirmenDatei = { id:string;firma_id:string;name:string;art:string;dateiname:string;mime:string;groesse:number;gueltig_bis:string|null };
export const dateiKey = (d: Pick<FirmenDatei,"firma_id"|"id">) => `bibliothek/${d.firma_id}/${d.id}`;
export const dateiname = (s:string) => s.replace(/[^\p{L}\p{N}._ -]/gu,"_").replace(/^\.+/,"").slice(0,120) || "datei";

export async function aktiveFirma(request: Request, env: KontoEnv, gewaehlt?: string) {
  const s = await sitzung(request,env);
  if (!s) return null;
  const r = await db<{firma_id:string;rolle:string;finanzen:boolean;firmen:{name:string}}[]>(s,env,`mitglieder?user_id=eq.${s.userId}&aktiv=eq.true&select=firma_id,rolle,finanzen,firmen(name)&order=erstellt`);
  if (!r.ok) return null;
  const firma = gewaehlt || new URL(request.url).searchParams.get("firma") || cookie(request,"jv_firma");
  const m = firma ? r.daten.find((x)=>x.firma_id===firma) : r.daten[0];
  return m ? {s,m,admin:["inhaber","admin"].includes(m.rolle),finanzen:darfFinanzen(m.rolle,m.finanzen)} : null;
}

export async function firmenunterlagen(request: Request, env: KontoEnv): Promise<Response|null> {
  const url = new URL(request.url);
  const detail = url.pathname.match(/^\/konto\/firmenunterlage\/([0-9a-f-]{36})\/(herunterladen|loeschen)$/);
  if (url.pathname!=="/konto/firmenunterlagen" && !detail) return null;
  const f = await aktiveFirma(request,env);
  if (!f) return weiterleiten("/konto");
  const antwort = (text:string,status=200) => html(seite("Firmenunterlagen & Vorlagen",text,0,"unterlagen"),status,f.s.cookies);
  if (!f.finanzen || !env.DATEN) return antwort("<p>Für diese Unterlagen brauchst du eine Finanzfreigabe.</p>",403);
  if (detail) {
    const r = await db<FirmenDatei[]>(f.s,env,`firmenunterlagen?id=eq.${detail[1]}&firma_id=eq.${f.m.firma_id}&select=*`);
    const d = r.ok ? r.daten[0] : undefined;
    if (!d) return antwort("<p>Diese Datei ist nicht verfügbar.</p>",404);
    if (detail[2]==="loeschen") {
      if (request.method!=="POST" || !f.admin) return antwort("<p>Nur die Administration darf Dateien löschen.</p>",403);
      const loeschen = await db<{id:string}[]>(f.s,env,`firmenunterlagen?id=eq.${d.id}&firma_id=eq.${d.firma_id}&select=id`,{method:"DELETE",headers:{prefer:"return=representation"}});
      if (!loeschen.ok || !loeschen.daten.length) return antwort('<p class="fehler">Die Datei konnte nicht gelöscht werden.</p>',502);
      await env.DATEN.delete(dateiKey(d));
      return weiterleiten(`/konto/firmenunterlagen?firma=${d.firma_id}`,f.s.cookies);
    }
    const obj = await env.DATEN.get(dateiKey(d));
    if (!obj) return antwort("<p>Die Datei ist nicht mehr vorhanden.</p>",404);
    const headers = new Headers({"content-type":"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(dateiname(d.dateiname))}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"});
    for (const c of f.s.cookies) headers.append("set-cookie",c);
    return new Response(obj.body,{headers});
  }
  let fehler="";
  const form = request.method==="POST" ? await request.formData() : null;
  if (form && String(form.get("firma") ?? "") !== f.m.firma_id) return antwort("<p>Die ausgewählte Firma hat sich geändert. Bitte die Seite neu öffnen.</p>",403);
  if (form) {
    if (!f.admin) return antwort("<p>Nur die Administration darf Dateien hochladen.</p>",403);
    const file = form.get("datei");
    const art = String(form.get("art")??"");
    const name = String(form.get("name")??"").trim().slice(0,200);
    const gueltig = String(form.get("gueltig_bis")??"");
    if (!file || typeof file==="string" || file.size<1 || file.size>20*1024*1024 || !/\.(pdf|docx|xlsx|txt|md|png|jpe?g)$/i.test(file.name) || !["nachweis","vorlage"].includes(art) || !name || (gueltig && !/^\d{4}-\d{2}-\d{2}$/.test(gueltig))) fehler="Bitte eine gültige Datei (höchstens 20 MB), einen Namen und eine Kategorie wählen.";
    else if (art==="vorlage" && !/\.(docx|txt|md)$/i.test(file.name)) fehler="Angebotsvorlagen bitte als Word-Datei (.docx) oder Text (.txt/.md) hochladen.";
    else {
      const d = {id:crypto.randomUUID(),firma_id:f.m.firma_id,name,art,dateiname:dateiname(file.name),mime:file.type||"application/octet-stream",groesse:file.size,gueltig_bis:gueltig||null};
      await env.DATEN.put(dateiKey(d),file.stream());
      let gespeichert = false;
      try {
        const r = await db(f.s,env,"firmenunterlagen",{method:"POST",body:JSON.stringify(d)});
        gespeichert = r.ok;
        if (gespeichert) return weiterleiten(`/konto/firmenunterlagen?firma=${d.firma_id}`,f.s.cookies);
      } finally { if (!gespeichert) await env.DATEN.delete(dateiKey(d)); }
      fehler="Die Datei konnte nicht gespeichert werden. Je Firma sind höchstens 50 Dateien und 200 MB erlaubt.";
    }
  }
  const r = await db<FirmenDatei[]>(f.s,env,`firmenunterlagen?firma_id=eq.${f.m.firma_id}&select=*&order=art,name`);
  if (!r.ok) return antwort('<p class="fehler">Die Unterlagen konnten nicht geladen werden.</p>',502);
  const heute=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Berlin"});
  const ablaufend=r.daten.filter(d=>d.art==="nachweis"&&d.gueltig_bis&&d.gueltig_bis>=heute&&(Date.parse(d.gueltig_bis)-Date.parse(heute))/86400000<=30);
  return antwort(`<p>Nachweise und Angebotsvorlagen für <strong>${escape(f.m.firmen.name)}</strong>. Gespeichert in der EU, bis die Administration sie löscht. Nur Personen mit Finanzfreigabe können sie öffnen.</p>${ablaufend.length?`<aside class="frist-bald"><strong>Nachweis läuft bald ab</strong><ul>${ablaufend.map(d=>`<li>${escape(d.name)} · gültig bis ${escape(d.gueltig_bis!)}</li>`).join("")}</ul><p class="klein">Jarvis sendet zusätzlich Erinnerungen 30, 14, 7 und 2 Tage vorher, wenn Firmenmails für dein Konto eingeschaltet sind.</p></aside>`:""}${fehler?`<p class="fehler">${fehler}</p>`:""}${f.admin?`<form method="post" enctype="multipart/form-data"><input type="hidden" name="firma" value="${f.m.firma_id}"><label>Bezeichnung<input name="name" required maxlength="200" placeholder="z. B. Betriebshaftpflicht"></label><label>Kategorie<select name="art"><option value="nachweis">Nachweis / Firmenunterlage</option><option value="vorlage">Eigene Angebotsvorlage</option></select></label><label>Gültig bis (falls befristet)<input name="gueltig_bis" type="date"></label><label>Datei (maximal 20 MB)<input type="file" name="datei" required accept=".pdf,.docx,.xlsx,.txt,.md,.jpg,.jpeg,.png"></label><button>Unterlage speichern</button></form><details><summary>Eigene Angebotsvorlage verwenden</summary><p>Word- und Textvorlagen können diese Platzhalter enthalten: <code>{{FIRMA}}</code>, <code>{{AUFTRAG}}</code>, <code>{{DATUM}}</code>, <code>{{ANGEBOTSTEXT}}</code>. Jarvis füllt sie beim Herunterladen der Angebotsmappe aus. Eine Vorlage ohne Platzhalter wird unverändert beigelegt.</p></details>`:""}<h2>Gespeicherte Dateien</h2>${r.daten.length?`<ul class="konto-linkliste">${r.daten.map((d)=>`<li><strong>${escape(d.name)}</strong><span class="klein">${d.art==="vorlage"?"Angebotsvorlage":"Nachweis"}${d.gueltig_bis?` · gültig bis ${escape(d.gueltig_bis)}${d.gueltig_bis<heute?" – abgelaufen":""}`:""}</span><a href="/konto/firmenunterlage/${d.id}/herunterladen?firma=${d.firma_id}">Herunterladen</a>${f.admin?`<form method="post" action="/konto/firmenunterlage/${d.id}/loeschen?firma=${d.firma_id}"><button>Datei löschen</button></form>`:""}</li>`).join("")}</ul>`:"<p>Noch keine Unterlagen gespeichert.</p>"}`);
}
