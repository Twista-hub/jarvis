import { db, html, sitzung, vorgangZugriff, unterlagenSteckbrief, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, markdown, seite } from "./seite.ts";

const ID = /^[0-9a-f-]{36}$/;
export const FREIGABE_FELDER: Record<string, string> = { auftrag: "Arbeitsauftrag", fristen: "Fristen", leistungen: "Leistungen / Aufgaben", nachweise: "Anforderungen / Nachweise", einsatz: "Einsatzort und Zeiten", angebot: "Freigegebener Angebotstext" };
type Freigabe = { id: string; firma_id: string; titel: string; inhalte: Record<string,string>; erstellt: string; empfaenger_id: string };

export function freigabeInhalte(form: FormData): Record<string,string> {
  const wahl = form.getAll("wahl").map(String);
  return Object.fromEntries(Object.keys(FREIGABE_FELDER).filter((k) => wahl.includes(k)).map((k) => [k,String(form.get(`text_${k}`) ?? "").trim().slice(0,9000)]).filter(([,v]) => v));
}
export function freigabeAnsicht(inhalte: Record<string,string>): string {
  return Object.entries(FREIGABE_FELDER).filter(([k]) => inhalte[k]).map(([k,t]) => `<section><h2>${t}</h2>${markdown(inhalte[k])}</section>`).join("");
}
function abschnitt(text: string, suche: RegExp): string {
  return [...text.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm)].filter((m) => suche.test(m[1])).map((m) => m[2].trim()).join("\n\n").slice(0,9000);
}

export async function freigaben(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const detail = url.pathname.match(/^\/konto\/freigabe\/([0-9a-f-]{36})$/);
  const erstellen = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/freigeben$/);
  if (url.pathname !== "/konto/freigaben" && !detail && !erstellen) return null;
  const s = await sitzung(request,env);
  if (!s) return weiterleiten("/konto");
  const antwort = (titel: string, text: string, status=200) => html(seite(titel,text,0,"freigaben"),status,s.cookies);
  if (url.pathname === "/konto/freigaben") {
    const r = await db<Freigabe[]>(s,env,`vorgang_freigaben?empfaenger_id=eq.${s.userId}&select=id,titel,erstellt&order=erstellt.desc`);
    return antwort("Für mich freigegeben", !r.ok ? `<p class="fehler">Die Freigaben konnten nicht geladen werden.</p>` : r.daten.length ? `<ul class="konto-linkliste">${r.daten.map((f)=>`<li><a href="/konto/freigabe/${f.id}">${escape(f.titel)}</a></li>`).join("")}</ul>` : `<p>Noch keine Informationen für dich freigegeben. Dein Chef kann bei einer Ausschreibung „An Mitarbeiter weitergeben“ wählen.</p>`);
  }
  if (detail) {
    if (request.method === "POST") {
      const r = await db<{id:string}[]>(s,env,`vorgang_freigaben?id=eq.${detail[1]}&select=id`,{method:"DELETE",headers:{prefer:"return=representation"}});
      return antwort("Freigabe",r.ok && r.daten.length ? `<p>Die Freigabe wurde widerrufen.</p>` : `<p class="fehler">Die Freigabe konnte nicht widerrufen werden.</p>`);
    }
    const r = await db<Freigabe[]>(s,env,`vorgang_freigaben?id=eq.${detail[1]}&select=id,firma_id,titel,inhalte,erstellt,empfaenger_id`);
    if (!r.ok || !r.daten[0]) return antwort("Nicht gefunden","<p>Diese Freigabe ist nicht verfügbar oder wurde widerrufen.</p>",404);
    const f = r.daten[0];
    const m = await db<{rolle:string}[]>(s,env,`mitglieder?firma_id=eq.${f.firma_id}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle`);
    const admin = m.ok && m.daten.some((x)=>["inhaber","admin"].includes(x.rolle));
    return antwort(f.titel, `<p class="klein">Für dich ausgewählte Informationen</p>${freigabeAnsicht(f.inhalte)}${admin ? `<form method="post" action="${url.pathname}"><button>Freigabe widerrufen</button></form>` : ""}`);
  }
  const z = await vorgangZugriff(request,env,erstellen![1]);
  if (!z || !["inhaber","admin"].includes(z.rolle)) return antwort("Nicht erlaubt","<p>Nur Inhaber und Administration dürfen Informationen weitergeben.</p>",403);
  const empfaenger = await db<{user_id:string;anzeigename:string;funktion:string}[]>(s,env,`mitglieder?firma_id=eq.${z.v.firma_id}&aktiv=eq.true&user_id=neq.${s.userId}&select=user_id,anzeigename,funktion&order=anzeigename`);
  if (!empfaenger.ok) return antwort("Weitergeben",'<p class="fehler">Mitarbeiter konnten nicht geladen werden.</p>',502);
  if (!empfaenger.daten.length) return antwort("Weitergeben",'<p>Lade zuerst Mitarbeiter in deine Firma ein.</p><p><a href="/konto/team">Firma & Team öffnen</a></p>');
  const aus = await unterlagenSteckbrief(env,z.v.id);
  const quelle = aus?.text || z.v.steckbrief || "";
  const vorschlag: Record<string,string> = { auftrag:z.v.titel, fristen: z.v.frist ? `Angebotsfrist: ${new Date(z.v.frist).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})}` : "", leistungen:abschnitt(quelle,/leistungen|lose/i), nachweise:abschnitt(quelle,/vorweisen|nachweise|eignung/i), einsatz:"",angebot:"" };
  let form: FormData | null = null;
  let inhalte: Record<string,string> = {};
  let ziel = "";
  let fehler = "";
  if (request.method === "POST") {
    form = await request.formData();
    ziel = String(form.get("person") ?? "");
    inhalte = freigabeInhalte(form);
    if (!ID.test(ziel) || !empfaenger.daten.some((p)=>p.user_id===ziel) || !Object.keys(inhalte).length) fehler="Bitte eine Person und mindestens einen gefüllten Text auswählen.";
    if (!fehler && form.get("aktion")==="freigeben") {
      const r = await db<{id:string}[]>(s,env,"vorgang_freigaben?on_conflict=vorgang_id,empfaenger_id&select=id",{method:"POST",headers:{prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({firma_id:z.v.firma_id,vorgang_id:z.v.id,empfaenger_id:ziel,erstellt_von:s.userId,titel:z.v.titel.slice(0,300),inhalte,erstellt:new Date().toISOString()})});
      if (r.ok && r.daten[0]) return weiterleiten(`/konto/freigabe/${r.daten[0].id}`,s.cookies);
      fehler="Die Informationen konnten nicht freigegeben werden.";
    }
    if (!fehler && form.get("aktion")==="vorschau") {
      const name = empfaenger.daten.find((p)=>p.user_id===ziel)?.anzeigename || "Mitarbeiter";
      return antwort("Vorschau der Weitergabe",`<p>So sieht <strong>${escape(name)}</strong> die Informationen:</p><article class="treffer-karte"><h2>${escape(z.v.titel)}</h2>${freigabeAnsicht(inhalte)}</article><form method="post" action="${url.pathname}"><input type="hidden" name="person" value="${ziel}">${Object.entries(inhalte).map(([k,v])=>`<input type="hidden" name="wahl" value="${k}"><input type="hidden" name="text_${k}" value="${escape(v)}">`).join("")}<button name="aktion" value="freigeben">Genau diese Informationen freigeben</button><button name="aktion" value="bearbeiten">Auswahl bearbeiten</button></form><p class="klein">Originalunterlagen und interne Kalkulationen sind in dieser Ansicht nicht zugänglich.</p>`);
    }
  }
  const bestehend = await db<{id:string;empfaenger_id:string}[]>(s,env,`vorgang_freigaben?vorgang_id=eq.${z.v.id}&select=id,empfaenger_id`);
  return antwort("An Mitarbeiter weitergeben",`${fehler ? `<p class="fehler">${fehler}</p>` : ""}<p>Wähle die benötigten Texte. Prüfe die Vorschau, besonders wenn ein Abschnitt Preisangaben enthält. Originalunterlagen und interne Kalkulation werden nicht mitgegeben.</p><form method="post" action="${url.pathname}"><label>Empfänger<select name="person" required><option value="">Bitte auswählen</option>${empfaenger.daten.map((p)=>`<option value="${p.user_id}"${ziel===p.user_id?" selected":""}>${escape(p.anzeigename || "Mitarbeiter")} – ${escape(p.funktion)}</option>`).join("")}</select></label>${Object.entries(FREIGABE_FELDER).map(([k,t])=>`<fieldset><label class="zeile"><input type="checkbox" name="wahl" value="${k}"${(form ? Object.hasOwn(inhalte,k) : k==="auftrag") ? " checked":""}>${t} weitergeben</label><label>Text prüfen und anpassen<textarea name="text_${k}" maxlength="9000">${escape(form ? String(form.get(`text_${k}`) ?? "") : vorschlag[k])}</textarea></label></fieldset>`).join("")}<button name="aktion" value="vorschau">Vorschau prüfen</button></form>${bestehend.ok && bestehend.daten.length ? `<h2>Bestehende Freigaben</h2><ul>${bestehend.daten.map((f)=>`<li><a href="/konto/freigabe/${f.id}">${escape(empfaenger.daten.find((p)=>p.user_id===f.empfaenger_id)?.anzeigename || "Freigabe öffnen / widerrufen")}</a></li>`).join("")}</ul>` : ""}`);
}
