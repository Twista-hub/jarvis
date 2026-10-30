import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { db, html, sitzung, unterlagenSteckbrief, vorgangZugriff, weiterleiten, type KontoEnv } from "./konto.ts";
import { dateiKey, dateiname, UUID, type FirmenDatei } from "./firmenunterlagen.ts";
import { escape, markdown, seite } from "./seite.ts";
import { rechnen, euro, type Eingaben, type Los } from "./kalkulation.ts";

type Mappe = { id:string;firma_id:string;vorgang_id:string;text:string;unterlagen_ids:string[];vorlage_id:string|null;erstellt:string };
export function dokumentePruefen(ids:string[], vorlage:string|null, dateien:FirmenDatei[], stichtag:string): string {
  const alle=[...new Set([...ids,...(vorlage?[vorlage]:[])])];
  if (alle.length>15 || alle.some((id)=>!UUID.test(id))) return "Bitte höchstens 15 Dateien auswählen.";
  const auswahl=alle.map((id)=>dateien.find((d)=>d.id===id));
  if (auswahl.some((d)=>!d)) return "Eine ausgewählte Datei ist nicht mehr verfügbar. Bitte die Auswahl aktualisieren.";
  if (auswahl.some((d)=>d!.gueltig_bis && d!.gueltig_bis<stichtag)) return "Ein ausgewählter Nachweis oder eine Vorlage ist vor der Angebotsfrist abgelaufen. Bitte erneuern oder aus der Mappe entfernen.";
  if (auswahl.reduce((s,d)=>s+d!.groesse,0)>30*1024*1024) return "Die Angebotsmappe darf höchstens 30 MB umfassen.";
  if (vorlage && dateien.find((d)=>d.id===vorlage)?.art!=="vorlage") return "Bitte eine Angebotsvorlage auswählen.";
  if (ids.some((id)=>dateien.find((d)=>d.id===id)?.art!=="nachweis")) return "Bitte als Unterlagen nur Nachweise auswählen.";
  return "";
}
const xmlEscape=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const xmlText=(s:string)=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
export function platzhalter(text:string, werte:Record<string,string>):string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g,(voll,k:string)=>werte[k]??voll);
}
export function wordVorlage(daten:Uint8Array, werte:Record<string,string>): Uint8Array {
  let gesamt=0;
  const files=unzipSync(daten,{filter:(f)=>{gesamt+=f.originalSize;if(f.originalSize>8*1024*1024 || gesamt>20*1024*1024) throw new Error("Die Word-Vorlage ist entpackt zu groß.");return true;}});
  if (!files["word/document.xml"]) throw new Error("Die Datei ist keine gültige Word-Vorlage.");
  for (const key of Object.keys(files).filter((k)=>/^word\/(document|header\d+|footer\d+)\.xml$/.test(k))) {
    const xml=strFromU8(files[key]);
    const ersetzt=xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,(p)=>{
      const texte=[...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
      const text=texte.map((m)=>xmlText(m[1])).join("");
      if(!/\{\{[A-Z_]+\}\}/.test(text)) return p;
      const neu=platzhalter(text,werte);
      if(/\{\{[A-Z_]+\}\}/.test(neu)) throw new Error("Die Vorlage enthält unbekannte Platzhalter.");
      let erstes=true;
      return p.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g,(_m,a,b)=>{const wert=erstes?xmlEscape(neu).replace(/\n/g,'</w:t><w:br/><w:t xml:space="preserve">'):"";erstes=false;return a+wert+b;});
    });
    files[key]=strToU8(ersetzt);
  }
  return zipSync(files);
}

export async function angebote(request:Request,env:KontoEnv):Promise<Response|null> {
  const url=new URL(request.url);
  const erstellen=url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/angebot$/);
  const herunterladen=url.pathname.match(/^\/konto\/angebotsmappe\/([0-9a-f-]{36})\/herunterladen$/);
  if(!erstellen && !herunterladen) return null;
  const s=await sitzung(request,env);
  if(!s) return weiterleiten("/konto");
  const antwort=(titel:string,text:string,status=200)=>html(seite(titel,text,0,"kalkulation"),status,s.cookies);
  let mappe:Mappe|undefined;
  if(herunterladen){const r=await db<Mappe[]>(s,env,`angebotsmappen?id=eq.${herunterladen[1]}&select=*`);mappe=r.ok?r.daten[0]:undefined;if(!mappe)return antwort("Nicht gefunden","<p>Die Angebotsmappe ist nicht verfügbar.</p>",404);}
  const z=await vorgangZugriff(request,env,mappe?.vorgang_id || erstellen![1]);
  if(!z?.finanzen || !env.DATEN) return antwort("Nicht erlaubt","<p>Für Angebotsmappen brauchst du Zugriff auf die Ausschreibung und eine Finanzfreigabe.</p>",403);
  const leser=z.rolle==="leser";
  const firma=await db<{name:string}[]>(s,env,`firmen?id=eq.${z.v.firma_id}&select=name`);
  const firmenname=firma.ok?firma.daten[0]?.name||"Firma":"Firma";
  const docs=await db<FirmenDatei[]>(s,env,`firmenunterlagen?firma_id=eq.${z.v.firma_id}&select=*&order=name`);
  if(!docs.ok) return antwort("Angebot vorbereiten",'<p class="fehler">Die Firmenunterlagen konnten nicht geladen werden.</p>',502);
  const heute=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Berlin"});
  const stichtag=z.v.frist && z.v.frist.slice(0,10)>heute?z.v.frist.slice(0,10):heute;
  if(herunterladen && mappe){
    const fehler=dokumentePruefen(mappe.unterlagen_ids,mappe.vorlage_id,docs.daten,stichtag);
    if(fehler || /\[\[|\{\{[A-Z_]+\}\}/.test(mappe.text)) return antwort("Mappe noch nicht fertig",`<p class="fehler">${escape(fehler || "Bitte die markierten Platzhalter im Angebotstext ausfüllen.")}</p><p><a href="/konto/vorgang/${z.v.id}/angebot">Entwurf bearbeiten</a></p>`,409);
    const dateien:Record<string,Uint8Array>={};
    dateien["Angebot.html"]=strToU8(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Angebot</title><style>body{font:16px/1.6 system-ui;max-width:800px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}@media print{body{margin:0}}</style><h1>${escape(firmenname)}</h1>${markdown(mappe.text)}</html>`);
    const werte={FIRMA:firmenname,AUFTRAG:z.v.titel,DATUM:new Date().toLocaleDateString("de-DE",{timeZone:"Europe/Berlin"}),ANGEBOTSTEXT:mappe.text};
    const protokoll=[`Angebotsmappe: ${z.v.titel}`,`Entwurf vom ${mappe.erstellt}`,"Vor der Abgabe Originalanforderungen, Preisblatt, Unterschriften und alle geforderten Nachweise prüfen.","Dieses Paket wurde vorbereitet; es wurde kein Angebot beim Auftraggeber abgegeben.","", "Ausgewählte Unterlagen:"];
    for(const [index,id] of [...mappe.unterlagen_ids,...(mappe.vorlage_id?[mappe.vorlage_id]:[])].entries()){
      const d=docs.daten.find((d)=>d.id===id)!;
      const obj=await env.DATEN.get(dateiKey(d));
      if(!obj) return antwort("Datei fehlt","<p>Eine ausgewählte Datei fehlt im Speicher. Bitte die Mappe erneut zusammenstellen.</p>",409);
      let data:Uint8Array=new Uint8Array(await obj.arrayBuffer());
      if(d.art==="vorlage"){
        try{if(/\.docx$/i.test(d.dateiname))data=wordVorlage(data,werte);else{const text=platzhalter(strFromU8(data),werte);if(/\{\{[A-Z_]+\}\}/.test(text))throw new Error("Unbekannte Platzhalter in der Vorlage.");data=strToU8(text);}}
        catch(e){return antwort("Vorlage prüfen",`<p class="fehler">${escape(e instanceof Error?e.message:"Vorlage konnte nicht ausgefüllt werden.")}</p>`,409);}
      }
      dateien[`${String(index+1).padStart(2,"0")}_${dateiname(d.dateiname)}`]=data;
      protokoll.push(`${d.name}${d.gueltig_bis?` (gültig bis ${d.gueltig_bis})`:""}`);
    }
    dateien["Pruefliste.txt"]=strToU8(protokoll.join("\n"));
    const zip=zipSync(dateien,{level:0});
    const headers=new Headers({"content-type":"application/zip","content-disposition":'attachment; filename="Angebotsmappe.zip"',"cache-control":"private, no-store","x-content-type-options":"nosniff"});
    for(const c of s.cookies)headers.append("set-cookie",c);
    return new Response(zip,{headers});
  }
  const alt=await db<Mappe[]>(s,env,`angebotsmappen?vorgang_id=eq.${z.v.id}&select=*&order=erstellt.desc&limit=1`);
  mappe=alt.ok?alt.daten[0]:undefined;
  let preis="[[Angebotspreis ergänzen]]";
  const aus=await unterlagenSteckbrief(env,z.v.id);
  if(aus){const obj=await env.DATEN.get(`auftraege/${aus.auftrag}/kalkulation.json`);if(obj){const k=await obj.json() as {eingaben:Eingaben;mengen:Record<string,number>};const l=await env.DATEN.get(`auftraege/${aus.auftrag}/lose.json`);const lose=l?await l.json() as Los[]:[];const ergebnis=rechnen(k.eingaben,lose,k.mengen);preis=lose.length&&ergebnis.netto>0?`${euro(ergebnis.netto)} netto gesamt`:`${euro(ergebnis.preisProStunde)} netto pro Stunde`;}}
  let text=mappe?.text || `Angebot: ${z.v.titel}\n\nSehr geehrte Damen und Herren,\n\nhiermit bieten wir die angefragte Leistung an.\n\nLeistungsumfang und Ausführung: [[Leistungen und Ausführungszeiten ergänzen]]\n\nAngebotspreis: ${preis}\n\nBindung / Gültigkeit unseres Angebots: [[Gültigkeit ergänzen]]\n\nDie ausgewählten Nachweise liegen diesem Angebot bei.\n\nMit freundlichen Grüßen\n${firmenname}`;
  let ids=mappe?.unterlagen_ids||[];
  let vorlage=mappe?.vorlage_id||"";
  let fehler="";
  if(request.method==="POST"){
    if(leser)return antwort("Nicht erlaubt","<p>Als Leser darfst du Angebotsmappen ansehen, aber keine neuen Entwürfe speichern.</p>",403);
    const form=await request.formData();text=String(form.get("text")??"").trim();ids=[...new Set(form.getAll("unterlagen").map(String))];vorlage=String(form.get("vorlage")??"");
    fehler=dokumentePruefen(ids,vorlage||null,docs.daten,stichtag);
    if(!text || text.length>50000)fehler="Bitte einen Angebotstext mit höchstens 50.000 Zeichen eingeben.";
    if(!fehler){const r=await db<Mappe[]>(s,env,"angebotsmappen?select=*",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({firma_id:z.v.firma_id,vorgang_id:z.v.id,text,unterlagen_ids:ids,vorlage_id:vorlage||null})});if(r.ok&&r.daten[0])return weiterleiten(`/konto/vorgang/${z.v.id}/angebot?gespeichert=1`,s.cookies);fehler="Der Entwurf konnte nicht gespeichert werden.";}
  }
  const fertig=mappe&&!/\[\[|\{\{[A-Z_]+\}\}/.test(mappe.text)&&!dokumentePruefen(mappe.unterlagen_ids,mappe.vorlage_id,docs.daten,stichtag);
  return antwort("Angebot vorbereiten",`<p><strong>${escape(z.v.titel)}</strong></p><p>Jarvis übernimmt den vorhandenen Angebotspreis aus der Kalkulation. Prüfe den Text, ergänze die markierten Stellen und wähle die benötigten Nachweise. Interne Löhne, Aufschläge und Gewinne erscheinen nicht automatisch im Angebot.</p>${fehler?`<p class="fehler">${escape(fehler)}</p>`:""}${url.searchParams.has("gespeichert")?"<p>Entwurf gespeichert.</p>":""}<form method="post"><label>Angebotstext<textarea name="text" maxlength="50000" rows="20" required${leser?" readonly":""}>${escape(text)}</textarea></label><fieldset><legend>Nachweise beilegen</legend>${docs.daten.filter((d)=>d.art==="nachweis").map((d)=>`<label class="zeile"><input type="checkbox" name="unterlagen" value="${d.id}"${ids.includes(d.id)?" checked":""}${d.gueltig_bis&&d.gueltig_bis<stichtag?" disabled":""}>${escape(d.name)}${d.gueltig_bis?` · gültig bis ${escape(d.gueltig_bis)}${d.gueltig_bis<stichtag?" (erneuern)":""}`:""}</label>`).join("")||"<p>Noch keine Nachweise hinterlegt.</p>"}</fieldset><label>Eigene Angebotsvorlage<select name="vorlage"><option value="">Standardangebot von Jarvis</option>${docs.daten.filter((d)=>d.art==="vorlage").map((d)=>`<option value="${d.id}"${vorlage===d.id?" selected":""}>${escape(d.name)}</option>`).join("")}</select></label>${!leser?"<button>Entwurf speichern und Vorschau aktualisieren</button>":""}</form><p><a href="/konto/firmenunterlagen?firma=${z.v.firma_id}">Firmenunterlagen & Vorlagen verwalten</a></p>${mappe?`<h2>Gespeicherte Vorschau</h2><article class="treffer-karte">${markdown(mappe.text)}</article>${fertig?`<p><a class="knopf" href="/konto/angebotsmappe/${mappe.id}/herunterladen">Angebotsmappe herunterladen</a></p>`:"<p>Für den Download bitte fehlende Textstellen ergänzen und ungültige Nachweise ersetzen.</p>"}`:""}<p class="klein">Vor der Abgabe geforderte Formulare, Signaturen und Vollständigkeit prüfen. Die Mappe enthält das druckbare Angebot, die ausgefüllte Vorlage und die ausgewählten Originalnachweise. Die Abgabe erfolgt im vorgesehenen Vergabeportal.</p>${z.v.link&&/^https?:\/\//.test(z.v.link)?`<p><a href="${escape(z.v.link)}" target="_blank" rel="noopener">Vergabeportal öffnen</a></p>`:""}`);
}
