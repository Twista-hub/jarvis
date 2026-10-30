import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync,unzipSync,strToU8,strFromU8 } from "fflate";
import { dokumentePruefen, wordVorlage, platzhalter, angebote } from "../src/angebote.ts";
import { firmenunterlagen, type FirmenDatei } from "../src/firmenunterlagen.ts";

const firma="11111111-1111-4111-8111-111111111111",vorgang="22222222-2222-4222-8222-222222222222",datei="33333333-3333-4333-8333-333333333333",mappe="44444444-4444-4444-8444-444444444444";
const token=`h.${btoa(JSON.stringify({sub:"user",exp:4000000000}))}.s`;
const doc:FirmenDatei={id:datei,firma_id:firma,name:"Versicherung",dateiname:"Versicherung.pdf",mime:"application/pdf",groesse:10,gueltig_bis:"2099-01-01",art:"nachweis"};

test("Angebotsmappe weist fehlende, abgelaufene und zu große Unterlagen zurück",()=>{
  assert.equal(dokumentePruefen([datei],null,[doc],"2026-10-30"),"");
  assert.match(dokumentePruefen([datei],null,[],"2026-10-30"),/nicht mehr verfügbar/);
  assert.match(dokumentePruefen([datei],null,[{...doc,gueltig_bis:"2026-11-01"}],"2026-11-02"),/abgelaufen/);
  assert.match(dokumentePruefen([datei],null,[{...doc,groesse:32*1024*1024}],"2026-10-30"),/30 MB/);
  assert.match(dokumentePruefen([],datei,[doc],"2026-10-30"),/Angebotsvorlage/);
});

test("Eigene Word-Vorlage wird auch bei über mehrere Textläufe verteilten Platzhaltern sicher ausgefüllt",()=>{
  const xml='<w:document><w:body><w:p><w:r><w:t>{{FIR</w:t></w:r><w:r><w:t>MA}}</w:t></w:r></w:p><w:p><w:r><w:t>{{ANGEBOTSTEXT}}</w:t></w:r></w:p></w:body></w:document>';
  const daten=zipSync({"word/document.xml":strToU8(xml)});
  const aus=unzipSync(wordVorlage(daten,{FIRMA:"A & B",ANGEBOTSTEXT:"Service <sauber>\nAngebot 100 €"}));
  const text=strFromU8(aus["word/document.xml"]);
  assert.match(text,/A &amp; B/);assert.match(text,/&lt;sauber&gt;/);assert.match(text,/w:br/);assert.doesNotMatch(text,/\{\{/);
  assert.equal(platzhalter("{{FIRMA}} / {{UNBEKANNT}}",{FIRMA:"ABC"}),"ABC / {{UNBEKANNT}}");
});

test("Paket enthält nur die ausgewählten Nachweise und den freigegebenen Angebotstext",async(t)=>{
  t.mock.method(globalThis,"fetch",async(input:string)=>{
    const url=new URL(input);const table=url.pathname.split("/").pop();
    let daten:unknown=[];
    if(table==="angebotsmappen")daten=[{id:mappe,firma_id:firma,vorgang_id:vorgang,text:"Unser Angebot: 100 € netto",unterlagen_ids:[datei],vorlage_id:null,erstellt:"2026-10-30"}];
    if(table==="vorgaenge")daten=[{id:vorgang,firma_id:firma,titel:"Servicepersonal",frist:null}];
    if(table==="mitglieder")daten=[{rolle:"inhaber"}];
    if(table==="firmen")daten=[{name:"Beispielfirma"}];
    if(table==="firmenunterlagen")daten=[doc,{...doc,id:"55555555-5555-4555-8555-555555555555",name:"Interne Strategie"}];
    return Response.json(daten);
  });
  const keys:string[]=[];
  const env={SUPABASE_URL:"https://db.test",SUPABASE_KEY:"public",DATEN:{get:async(key:string)=>{keys.push(key);return{arrayBuffer:async()=>strToU8("Nachweis").buffer}}} as any};
  const r=await angebote(new Request(`https://x/konto/angebotsmappe/${mappe}/herunterladen`,{headers:{cookie:`jv_at=${token}`}}),env);
  assert.equal(r!.status,200);
  const paket=unzipSync(new Uint8Array(await r!.arrayBuffer()));
  assert.deepEqual(Object.keys(paket).sort(),["01_Versicherung.pdf","Angebot.html","Pruefliste.txt"].sort());
  assert.match(strFromU8(paket["Angebot.html"]),/100 € netto/);
  assert.deepEqual(keys,[`bibliothek/${firma}/${datei}`]);
});

test("Finanzfreigabe allein erlaubt Lesern keine Bibliotheks-Uploads",async(t)=>{
  t.mock.method(globalThis,"fetch",async()=>Response.json([{firma_id:firma,rolle:"leser",finanzen:true,firmen:{name:"Firma"}}]));
  const put=t.mock.fn();
  const form=new FormData();form.set("firma",firma);form.set("name","Datei");form.set("art","nachweis");form.set("datei",new File(["Datei"],"datei.pdf"));
  const r=await firmenunterlagen(new Request("https://x/konto/firmenunterlagen",{method:"POST",headers:{cookie:`jv_at=${token}`},body:form}),{SUPABASE_URL:"https://db.test",SUPABASE_KEY:"public",DATEN:{put} as any});
  assert.equal(r!.status,403);assert.equal(put.mock.callCount(),0);
});
