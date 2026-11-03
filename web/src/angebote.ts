import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { anhaengen, bausteineFeld, bausteineLaden } from "./textbausteine.ts";
import { lvDateien } from "./lv.ts";
import { eigenerklaerungDocx, profilLaden, profilWerte } from "./firmenprofil.ts";
import { db, html, sitzung, unterlagenSteckbrief, vorgangZugriff, weiterleiten, type KontoEnv } from "./konto.ts";
import { aktiveFirma, dateiKey, dateiname, UUID, type FirmenDatei } from "./firmenunterlagen.ts";
import { escape, markdown, seite } from "./seite.ts";
import { referenzenLaden, referenzlisteDocx } from "./referenzen.ts";
import { vorlageFuerBereich, type Eingaben, type Los, type LosWerte } from "./kalkulation.ts";
import type { TarifWahl } from "./tarife.ts";
import { angebotsText, auswahlSeite, passendeNachweise, preise, type Preise } from "./angebotsauswahl.ts";

type Mappe = { id:string;firma_id:string;vorgang_id:string;text:string;unterlagen_ids:string[];vorlage_id:string|null;erstellt:string;freigabe_status:string;freigabe_von:string|null;freigabe_am:string|null;freigabe_notiz:string };
type Abgabe = { id:string;firma_id:string;mappe_id:string;portal:string;dateiname:string;mime:string;groesse:number;abgegeben_am:string;angebotsmappen?:{vorgang_id:string} };
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
  const beleg=url.pathname.match(/^\/konto\/angebotsabgabe\/([0-9a-f-]{36})\/beleg$/);
  if(url.pathname==="/konto/angebotsfreigaben") return freigabenListe(request,env);
  if(!erstellen && !herunterladen && !beleg) return null;
  const s=await sitzung(request,env);
  if(!s) return weiterleiten("/konto");
  const antwort=(titel:string,text:string,status=200)=>html(seite(titel,text,0,"kalkulation"),status,s.cookies);
  let mappe:Mappe|undefined;
  if(herunterladen){const r=await db<Mappe[]>(s,env,`angebotsmappen?id=eq.${herunterladen[1]}&select=*`);mappe=r.ok?r.daten[0]:undefined;if(!mappe)return antwort("Nicht gefunden","<p>Die Angebotsmappe ist nicht verfügbar.</p>",404);}
  if(beleg){const r=await db<Abgabe[]>(s,env,`angebotsabgaben?id=eq.${beleg[1]}&select=*`);const a=r.ok?r.daten[0]:undefined;if(!a)return antwort("Nicht gefunden","<p>Dieser Abgabenachweis ist nicht verfügbar.</p>",404);const obj=await env.DATEN?.get(`angebotsabgaben/${a.firma_id}/${a.id}`);if(!obj)return antwort("Datei fehlt","<p>Der Nachweis ist nicht mehr gespeichert.</p>",404);const h=new Headers({"content-type":"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(dateiname(a.dateiname))}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"});for(const c of s.cookies)h.append("set-cookie",c);return new Response(obj.body,{headers:h});}
  const z=await vorgangZugriff(request,env,mappe?.vorgang_id || erstellen![1]);
  if(!z?.finanzen || !env.DATEN) return antwort("Nicht erlaubt","<p>Für Angebotsmappen brauchst du Zugriff auf die Ausschreibung und eine Finanzfreigabe.</p>",403);
  const leser=z.rolle==="leser";
  const admin=["inhaber","admin"].includes(z.rolle);
  const bearbeiter=admin || z.rolle==="bearbeiter";
  // Read the form once: a request body can only be read one time.
  const formular=request.method==="POST"?await request.formData():null;
  if(formular && erstellen){
    const f=formular;
    if(String(f.get("aktion"))==="freigeben" || String(f.get("aktion"))==="ablehnen"){
      if(!admin)return antwort("Nicht erlaubt","<p>Nur Inhaber oder Administration können Angebotsmappen freigeben.</p>",403);
      // K9: approval only after the AI fact sheet was checked against the original documents.
      if(String(f.get("aktion"))==="freigeben"&&f.get("geprueft")!=="ja")return antwort("Bitte bestätigen","<p class=\"fehler\">Bitte vor der Freigabe bestätigen, dass Fristen, Lose, Preise und Nachweise mit den Originalunterlagen abgeglichen sind.</p>",400);
      const id=String(f.get("mappe")||"");const status=String(f.get("aktion"))==="freigeben"?"genehmigt":"abgelehnt";const notiz=String(f.get("notiz")||"").slice(0,2000);
      const r=await db(s,env,`angebotsmappen?id=eq.${id}&vorgang_id=eq.${z.v.id}`,{method:"PATCH",body:JSON.stringify({freigabe_status:status,freigabe_von:s.userId,freigabe_am:new Date().toISOString(),freigabe_notiz:notiz})});
      if(r.ok)return weiterleiten(`/konto/vorgang/${z.v.id}/angebot?freigabe=${status}`,s.cookies);
      return antwort("Freigabe nicht gespeichert",'<p class="fehler">Die Mappe wurde nicht geändert. Vielleicht ist die Freigabe bereits bearbeitet worden.</p>',409);
    }
    if(String(f.get("aktion"))==="abgabe"){
      if(!bearbeiter)return antwort("Nicht erlaubt","<p>Für den Abgabenachweis brauchst du eine Bearbeiterrolle mit Finanzfreigabe.</p>",403);
      const mappeId=String(f.get("mappe")||"");const mr=await db<Mappe[]>(s,env,`angebotsmappen?id=eq.${mappeId}&vorgang_id=eq.${z.v.id}&select=*`);const m=mr.ok?mr.daten[0]:undefined;
      const file=f.get("beleg");const portal=String(f.get("portal")||"").trim().slice(0,200);
      if(!m||m.freigabe_status!=="genehmigt"||!file||typeof file==="string"||file.size<1||file.size>10*1024*1024||!(["application/pdf","image/png","image/jpeg"].includes(file.type))||!portal)return antwort("Abgabenachweis unvollständig",'<p class="fehler">Bitte Portal eintragen und den Eingangsbeleg als PDF, PNG oder JPG (maximal 10 MB) hochladen.</p>',400);
      const a:Abgabe={id:crypto.randomUUID(),firma_id:z.v.firma_id,mappe_id:m.id,portal,dateiname:dateiname(file.name),mime:file.type,groesse:file.size,abgegeben_am:new Date().toISOString()};const key=`angebotsabgaben/${a.firma_id}/${a.id}`;
      await env.DATEN!.put(key,file.stream());let gespeichert=false;
      try{const r=await db<Abgabe[]>(s,env,"angebotsabgaben?select=*",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify(a)});gespeichert=r.ok&&!!r.daten[0];if(gespeichert)return weiterleiten(`/konto/vorgang/${z.v.id}/angebot?abgabe=gespeichert`,s.cookies);}
      finally{if(!gespeichert)await env.DATEN!.delete(key);}
      return antwort("Abgabenachweis nicht gespeichert",'<p class="fehler">Die Abgabe wurde nicht protokolliert.</p>',409);
    }
  }
  const firma=await db<{name:string}[]>(s,env,`firmen?id=eq.${z.v.firma_id}&select=name`);
  const firmenname=firma.ok?firma.daten[0]?.name||"Firma":"Firma";
  // N7: text modules and the values for their placeholders (buyer from the catalog when known).
  const bausteine=herunterladen?[]:await bausteineLaden(s,env,z.v.firma_id);
  const ag=z.v.katalog_id?await db<{auftraggeber:string}[]>(s,env,`vergabekatalog?id=eq.${encodeURIComponent(z.v.katalog_id)}&select=auftraggeber&limit=1`):null;
  // T2: company master data for placeholders, the suitability declaration and the logo in the offer.
  const profil=await profilLaden(s,env,z.v.firma_id,true);
  const heuteIso=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Berlin"});
  const platz={FIRMA:firmenname,AUFTRAG:z.v.titel,AUFTRAGGEBER:ag?.ok?ag.daten[0]?.auftraggeber??"":"",DATUM:new Date().toLocaleDateString("de-DE",{timeZone:"Europe/Berlin"}),...profilWerte(profil.firma,profil.profil,profil.zertifikate,heuteIso)};
  const docs=await db<FirmenDatei[]>(s,env,`firmenunterlagen?firma_id=eq.${z.v.firma_id}&select=*&order=name`);
  if(!docs.ok) return antwort("Angebot vorbereiten",'<p class="fehler">Die Firmenunterlagen konnten nicht geladen werden.</p>',502);
  const heute=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Berlin"});
  const stichtag=z.v.frist && z.v.frist.slice(0,10)>heute?z.v.frist.slice(0,10):heute;
  if(herunterladen && mappe){
    if(mappe.freigabe_status!=="genehmigt")return antwort("Freigabe erforderlich",'<p>Die Firmenleitung muss diese Angebotsversion erst freigeben.</p><p><a href="/konto/vorgang/'+z.v.id+'/angebot">Zur Angebotsmappe</a></p>',403);
    const fehler=dokumentePruefen(mappe.unterlagen_ids,mappe.vorlage_id,docs.daten,stichtag);
    if(fehler || /\[\[|\{\{[A-Z_]+\}\}/.test(mappe.text)) return antwort("Mappe noch nicht fertig",`<p class="fehler">${escape(fehler || "Bitte die markierten Platzhalter im Angebotstext ausfüllen.")}</p><p><a href="/konto/vorgang/${z.v.id}/angebot">Entwurf bearbeiten</a></p>`,409);
    const dateien:Record<string,Uint8Array>={};
    const logoObj=profil.profil?.logo?await env.DATEN.get(`firmenlogo/${z.v.firma_id}`):null;
    const logo=logoObj?`<img src="data:${profil.profil!.logo};base64,${btoa(Array.from(new Uint8Array(await logoObj.arrayBuffer()),(b)=>String.fromCharCode(b)).join(""))}" alt="" style="max-height:70px;max-width:240px">`:"";
    const absender=[profil.firma.strasse,[profil.firma.plz,profil.firma.ort].filter(Boolean).join(" "),profil.firma.telefon,profil.profil?.email].filter((x)=>x&&String(x).trim()).map((x)=>escape(String(x))).join(" · ");
    dateien["Angebot.html"]=strToU8(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Angebot</title><style>body{font:16px/1.6 system-ui;max-width:800px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid #ccc;margin-bottom:16px}header p{font-size:13px;color:#555;margin:0}@media print{body{margin:0}}</style><header><div><h1>${escape(firmenname)}</h1>${absender?`<p>${absender}</p>`:""}</div>${logo}</header>${markdown(mappe.text)}</html>`);
    const werte={...platz,ANGEBOTSTEXT:mappe.text};
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
    // References asked for in the tender: the list from the references form goes along as a Word file.
    if(/referenz/i.test(`${z.v.steckbrief??""}\n${mappe.text}`)){const refs=await referenzenLaden(s,env,z.v.firma_id);if(refs.length){dateien["Referenzliste.docx"]=referenzlisteDocx(firmenname,refs);protokoll.push(`Referenzliste (${refs.length} Referenzen)`);}}
    // T2: the suitability declaration with company data, revenue, staff and certificates.
    const refAnzahl=(await referenzenLaden(s,env,z.v.firma_id)).length;
    dateien["Eigenerklaerung_Eignung.docx"]=eigenerklaerungDocx(firmenname,profil.firma,profil.profil,profil.kennzahlen??[],profil.zertifikate,refAnzahl,heuteIso,profil.ausstattung);protokoll.push("Eigenerklärung zur Eignung (mit dem Formular des Auftraggebers abgleichen)");
    // N9: the bid file (GAEB X84) and the price list, when the tender has a bill of quantities.
    for(const [name,inhalt] of Object.entries(await lvDateien(s,env,z.v.id,z.v.firma_id))){dateien[name]=strToU8(inhalt);protokoll.push(name.endsWith(".X84")?`Angebotsdatei ${name} (im Vergabeportal hochladen)`:`Preisliste ${name}`);}
    dateien["Pruefliste.txt"]=strToU8(protokoll.join("\n"));
    const zip=zipSync(dateien,{level:0});
    const headers=new Headers({"content-type":"application/zip","content-disposition":'attachment; filename="Angebotsmappe.zip"',"cache-control":"private, no-store","x-content-type-options":"nosniff"});
    for(const c of s.cookies)headers.append("set-cookie",c);
    return new Response(zip,{headers});
  }
  const alt=await db<Mappe[]>(s,env,`angebotsmappen?vorgang_id=eq.${z.v.id}&select=*&order=erstellt.desc&limit=1`);
  mappe=alt.ok?alt.daten[0]:undefined;
  // Lots and prices from the uploaded documents and their calculation (or the firm's standard values).
  const aus=await unterlagenSteckbrief(env,z.v.id);
  const lese=async<T>(key:string)=>{const o=await env.DATEN!.get(key);return o?(await o.json()) as T:null;};
  const lose=aus?await lese<Los[]>(`auftraege/${aus.auftrag}/lose.json`)??[]:[];
  const kalk=aus?await lese<{eingaben:Eingaben;mengen:Record<string,number>;proLos?:LosWerte;tarif?:TarifWahl}>(`auftraege/${aus.auftrag}/kalkulation.json`):null;
  const [fv,bereiche]=await Promise.all([
    db<{bereich_id:string|null;eingaben:Eingaben}[]>(s,env,`kalkulationsvorlagen?firma_id=eq.${z.v.firma_id}&select=bereich_id,eingaben`),
    db<{id:string;parent_id:string|null}[]>(s,env,`bereiche?firma_id=eq.${z.v.firma_id}&select=id,parent_id`),
  ]);
  const standardwerte=fv.ok?vorlageFuerBereich(z.v.bereich_id,bereiche.ok?bereiche.daten:[],fv.daten):undefined;
  const p:Preise=preise(lose,kalk,standardwerte ?? null);
  const kalkLink=aus?.text?`/auftrag/${aus.auftrag}#kalkulation`:"/konto/kalkulation";
  const passend=passendeNachweise(`${aus?.text??""}\n${z.v.steckbrief??""}`,docs.daten,stichtag);
  const upload=`/konto/firmenunterlagen?firma=${z.v.firma_id}`;
  // References entered as a form count as present: the offer folder adds the reference list (Word).
  const refListe=passend.fehlen.includes("Referenzen")&&(await referenzenLaden(s,env,z.v.firma_id)).length>0;
  if(refListe)passend.fehlen=passend.fehlen.filter((n)=>n!=="Referenzen");
  const namen=(ids:string[])=>[...ids.map((id)=>docs.daten.find((d)=>d.id===id)?.name).filter((n):n is string=>!!n),...(refListe?["Referenzliste"]:[])];
  // Step 1: choose the lots (when there are lots and no draft yet, or on request).
  if(!formular && !leser && p.zeilen.length && (!mappe || url.searchParams.has("neu"))){
    return antwort("Angebot vorbereiten",`<p><strong>${escape(z.v.titel)}</strong></p>${auswahlSeite(z.v.id,p,{namen:namen(passend.ids),fehlen:passend.fehlen},upload,kalkLink)}`);
  }
  let text=mappe?.text || angebotsText({titel:z.v.titel,firma:firmenname,zeilen:p.zeilen,proStunde:p.proStunde,nachweise:namen(passend.ids)});
  let ids=mappe?.unterlagen_ids||passend.ids;
  let vorlage=mappe?.vorlage_id||"";
  let fehler="";
  if(formular && String(formular.get("aktion")??"")==="vorauswahl"){
    // Step 2: the chosen lots become the offer text; the matching proofs are pre-ticked. Not saved yet.
    const gewaehlt=new Set(formular.getAll("lose").map(String));
    ids=passend.ids;
    text=angebotsText({titel:z.v.titel,firma:firmenname,zeilen:p.zeilen.filter((r)=>gewaehlt.has(r.nr)),proStunde:p.proStunde,nachweise:namen(ids)});
  } else if(formular){
    if(leser)return antwort("Nicht erlaubt","<p>Als Leser darfst du Angebotsmappen ansehen, aber keine neuen Entwürfe speichern.</p>",403);
    const form=formular;text=String(form.get("text")??"").trim();
    const gewaehlt=new Set(form.getAll("baustein").map(String));
    if(gewaehlt.size)text=anhaengen(text,bausteine.filter((b)=>gewaehlt.has(b.id)),platz);ids=[...new Set(form.getAll("unterlagen").map(String))];vorlage=String(form.get("vorlage")??"");
    fehler=dokumentePruefen(ids,vorlage||null,docs.daten,stichtag);
    if(!text || text.length>50000)fehler="Bitte einen Angebotstext mit höchstens 50.000 Zeichen eingeben.";
    if(!fehler){const r=await db<Mappe[]>(s,env,"angebotsmappen?select=*",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({firma_id:z.v.firma_id,vorgang_id:z.v.id,text,unterlagen_ids:ids,vorlage_id:vorlage||null})});if(r.ok&&r.daten[0])return weiterleiten(`/konto/vorgang/${z.v.id}/angebot?gespeichert=1`,s.cookies);fehler="Der Entwurf konnte nicht gespeichert werden.";}
  }
  const fertig=mappe&&!/\[\[|\{\{[A-Z_]+\}\}/.test(mappe.text)&&!dokumentePruefen(mappe.unterlagen_ids,mappe.vorlage_id,docs.daten,stichtag);
  const abgaben=mappe?await db<Abgabe[]>(s,env,`angebotsabgaben?firma_id=eq.${z.v.firma_id}&select=id,mappe_id,portal,dateiname,mime,groesse,abgegeben_am,angebotsmappen(vorgang_id)&order=abgegeben_am.desc&limit=100`):null;const belegListe=abgaben?.ok?(abgaben.daten.filter(a=>a.angebotsmappen?.vorgang_id===z.v.id)):[ ];const belegDieseMappe=belegListe.some(a=>a.mappe_id===mappe?.id);
  const approval=mappe?.freigabe_status==="wartet"?`<p><strong>Wartet auf Chef-Freigabe.</strong></p>${admin?`<form method="post"><input type="hidden" name="mappe" value="${mappe.id}"><label>Notiz an die erstellende Person<textarea name="notiz" maxlength="2000"></textarea></label><label class="zeile"><input type="checkbox" name="geprueft" value="ja" required> <span>Fristen, Lose, Preise und geforderte Nachweise sind mit den Originalunterlagen abgeglichen (der Steckbrief ist von einer KI erstellt).</span></label><button name="aktion" value="freigeben">Angebot freigeben</button><button name="aktion" value="ablehnen" formnovalidate>Überarbeiten lassen</button></form>`:""}`:mappe?.freigabe_status==="genehmigt"?`<p>✅ Von der Firmenleitung freigegeben${mappe.freigabe_am?` am ${escape(new Date(mappe.freigabe_am).toLocaleString("de-DE"))}`:""}.</p>`:`<p>Überarbeitung nötig${mappe?.freigabe_notiz?`: ${escape(mappe.freigabe_notiz)}`:"."}</p>`;
  const abgabeForm=mappe?.freigabe_status==="genehmigt"&&bearbeiter&&!belegDieseMappe?`<h2>Nach Einreichung im Portal</h2><p>Nach dem manuellen Einreichen hier den Eingangsbeleg speichern. Crewtender übermittelt nichts selbst.</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="aktion" value="abgabe"><input type="hidden" name="mappe" value="${mappe.id}"><label>Vergabeportal<input name="portal" required maxlength="200" value="${escape(z.v.link||"")}" placeholder="Name des Portals"></label><label>Eingangsbestätigung (PDF, PNG oder JPG, max. 10 MB)<input type="file" name="beleg" required accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"></label><button>Abgabe und Eingangsbeleg protokollieren</button></form>`:"";
  const abgabeStatus=belegListe.map(a=>`<p>📨 Abgegeben am ${escape(new Date(a.abgegeben_am).toLocaleString("de-DE"))} über ${escape(a.portal)} · <a href="/konto/angebotsabgabe/${a.id}/beleg">Eingangsbeleg ansehen</a></p>`).join("");
  return antwort("Angebot vorbereiten",`<p><strong>${escape(z.v.titel)}</strong></p><p>Crewtender hat das Angebot mit den Preisen aus der Kalkulation geschrieben und die passenden Nachweise angehakt. Lies es kurz durch und speichere es; danach gibt die Firmenleitung es frei. Interne Löhne, Aufschläge und Gewinne stehen nicht im Angebot.</p>${p.zeilen.length&&!leser?`<p><a href="/konto/vorgang/${z.v.id}/angebot?neu=1">↺ Lose neu auswählen</a> · <a href="${kalkLink}">💶 Kalkulation ändern</a></p>`:""}${passend.fehlen.length?`<aside class="nachweis-popup"><strong>⚠️ Noch nicht hochgeladen:</strong> ${passend.fehlen.map(escape).join(", ")}. <a href="${upload}">Jetzt hochladen →</a></aside>`:""}${fehler?`<p class="fehler">${escape(fehler)}</p>`:""}${url.searchParams.has("gespeichert")?"<p>Entwurf gespeichert. Er wartet jetzt auf die Freigabe der Firmenleitung.</p>":""}${url.searchParams.has("freigabe")?`<p>Freigabestatus gespeichert.</p>`:""}${url.searchParams.has("abgabe")?"<p>Abgabe und Eingangsbeleg wurden protokolliert.</p>":""}<form method="post"><label>Angebotstext<textarea name="text" maxlength="50000" rows="20" required${leser?" readonly":""}>${escape(text)}</textarea></label>${leser?"":bausteineFeld(bausteine,text,!mappe,platz)}<fieldset><legend>Nachweise beilegen</legend>${docs.daten.filter((d)=>d.art==="nachweis").map((d)=>`<label class="zeile"><input type="checkbox" name="unterlagen" value="${d.id}"${ids.includes(d.id)?" checked":""}${d.gueltig_bis&&d.gueltig_bis<stichtag?" disabled":""}>${escape(d.name)}${d.gueltig_bis?` · gültig bis ${escape(d.gueltig_bis)}${d.gueltig_bis<stichtag?" (erneuern)":""}`:""}</label>`).join("")||"<p>Noch keine Nachweise hinterlegt.</p>"}</fieldset><label>Eigene Angebotsvorlage<select name="vorlage"><option value="">Standardangebot von Crewtender</option>${docs.daten.filter((d)=>d.art==="vorlage").map((d)=>`<option value="${d.id}"${vorlage===d.id?" selected":""}>${escape(d.name)}</option>`).join("")}</select></label>${!leser?"<button>Entwurf speichern und Vorschau aktualisieren</button>":""}</form><p><a href="/konto/firmenunterlagen?firma=${z.v.firma_id}">Firmenunterlagen & Vorlagen verwalten</a></p>${mappe?`<h2>Gespeicherte Vorschau</h2><article class="treffer-karte">${markdown(mappe.text)}</article>${approval}${fertig&&mappe.freigabe_status==="genehmigt"?`<p><a class="knopf" href="/konto/angebotsmappe/${mappe.id}/herunterladen">Angebotsmappe herunterladen</a></p>`:fertig&&mappe.freigabe_status==="wartet"?"<p>Der Download wird nach der Freigabe verfügbar.</p>":"<p>Für den Download bitte fehlende Textstellen ergänzen und ungültige Nachweise ersetzen.</p>"}${abgabeStatus}${abgabeForm}`:""}<p class="klein">Vor der Abgabe geforderte Formulare, Signaturen und Vollständigkeit prüfen. Die Mappe enthält das druckbare Angebot, die ausgefüllte Vorlage und die ausgewählten Originalnachweise. Die Abgabe erfolgt im vorgesehenen Vergabeportal.</p>${z.v.link&&/^https?:\/\//.test(z.v.link)?`<p><a href="${escape(z.v.link)}" target="_blank" rel="noopener">Vergabeportal öffnen</a></p>`:""}`);
}

async function freigabenListe(request:Request,env:KontoEnv):Promise<Response>{
  const f=await aktiveFirma(request,env);if(!f)return weiterleiten("/konto");
  const antwort=(t:string,s=200)=>html(seite("Chef-Freigaben",t,0,"angebot"),s,f.s.cookies);
  if(!f.admin||!f.finanzen)return antwort("<p>Nur Inhaber und Administration mit Finanzfreigabe sehen die Chef-Freigaben.</p>",403);
  const r=await db<(Mappe & {vorgaenge:{titel:string}})[]>(f.s,env,`angebotsmappen?firma_id=eq.${f.m.firma_id}&freigabe_status=eq.wartet&select=id,vorgang_id,erstellt,text,freigabe_status,vorgaenge(titel)&order=erstellt.desc`);
  if(!r.ok)return antwort('<p class="fehler">Freigaben konnten nicht geladen werden.</p>',502);
  const body=`<h2>Wartende Angebotsmappen</h2>${r.daten.length?`<ul class="konto-linkliste">${r.daten.map(m=>`<li><strong>${escape(m.vorgaenge?.titel||"Ausschreibung")}</strong><span class="klein">Entwurf vom ${escape(new Date(m.erstellt).toLocaleString("de-DE"))}</span><a href="/konto/vorgang/${m.vorgang_id}/angebot">Angebot prüfen und freigeben →</a></li>`).join("")}</ul>`:"<p>Aktuell wartet kein Angebot auf Freigabe.</p>"}`;
  return antwort(body);
}
