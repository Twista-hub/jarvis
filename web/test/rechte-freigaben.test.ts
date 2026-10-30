import assert from "node:assert/strict";
import { test } from "node:test";
import { darfFinanzen } from "../src/rechte.ts";
import { darfAuftrag } from "../src/auftragsrechte.ts";
import { freigabeInhalte, freigabeAnsicht } from "../src/freigaben.ts";
import { bereichOptionen } from "../src/bereiche.ts";

const firma="11111111-1111-4111-8111-111111111111";
const vorgang="22222222-2222-4222-8222-222222222222";
const token=`h.${btoa(JSON.stringify({sub:"user",exp:4000000000}))}.s`;
const env={SUPABASE_URL:"https://db.test",SUPABASE_KEY:"public"};
const request=()=>new Request("https://jarvis.test/auftrag/id",{headers:{cookie:`jv_at=${token}`}});

test("Finanzrechte müssen ausdrücklich gesetzt werden und gelten nie für eingeschränkte Mitarbeiter",()=>{
  assert.equal(darfFinanzen("bearbeiter"),false);
  assert.equal(darfFinanzen("leser"),false);
  assert.equal(darfFinanzen("mitarbeiter",true),false);
  assert.equal(darfFinanzen("bearbeiter",true),true);
  assert.equal(darfFinanzen("inhaber"),true);
});

test("Weitergabe speichert und rendert nur ausdrücklich ausgewählte, erlaubte Textfelder",()=>{
  const form=new FormData();
  form.append("wahl","auftrag");form.append("wahl","interne_kalkulation");
  form.set("text_auftrag","Service am Messestand");form.set("text_leistungen","Nicht ausgewählt");form.set("text_interne_kalkulation","Gewinn 50 Prozent");
  assert.deepEqual(freigabeInhalte(form),{auftrag:"Service am Messestand"});
  const html=freigabeAnsicht({auftrag:"Service am Messestand",interne_kalkulation:"GEHEIM",einsatz:"<script>Angriff</script>"});
  assert.doesNotMatch(html,/GEHEIM|<script>/);
  assert.match(html,/Service am Messestand/);
});

test("R2-Auftrags-ID erlaubt weder anonymen Zugriff noch Zugriff ohne aktuelle Finanzfreigabe",async(t)=>{
  let rolle="bearbeiter",finanzen=false;
  t.mock.method(globalThis,"fetch",async(input:string)=>{
    const url=new URL(input);
    return Response.json(url.pathname.endsWith("vorgaenge")?[{id:vorgang,firma_id:firma,titel:"Ausschreibung"}]:[{rolle,finanzen}]);
  });
  assert.equal(await darfAuftrag(new Request("https://x/"),env,{profil:"p",vorgang},()=>firma),false);
  assert.equal(await darfAuftrag(request(),env,{profil:"p",vorgang},()=>firma),false);
  finanzen=true;
  assert.equal(await darfAuftrag(request(),env,{profil:"p",vorgang},()=>firma),true);
  rolle="mitarbeiter";
  assert.equal(await darfAuftrag(request(),env,{profil:"p",vorgang},()=>firma),false);
  rolle="leser";
  assert.equal(await darfAuftrag(request(),env,{profil:"p",vorgang},()=>firma,true),false);
  assert.equal(await darfAuftrag(request(),env,{profil:"unbekannt"},()=>undefined),false);
  finanzen=false;
  assert.equal(await darfAuftrag(request(),env,{profil:"alt"},()=>firma),false);
});

test("Standortauswahl enthält alle vier Regionen und sechzehn untergeordneten Standorte",()=>{
  const bereiche=Array.from({length:4},(_,r)=>({id:`region${r}`,name:`Region ${r}`,art:"team",parent_id:null as string|null}));
  for(let r=0;r<4;r++)for(let s=0;s<4;s++)bereiche.push({id:`standort${r}${s}`,name:`Standort ${r}${s}`,art:"standort",parent_id:`region${r}`});
  const html=bereichOptionen(bereiche,"standort23");
  assert.equal([...html.matchAll(/<option /g)].length,20);
  assert.match(html,/<option value="standort23" selected>Region 2 › Standort 23/);
});
