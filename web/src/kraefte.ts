// T43: invite many staff at once. The office ticks people from the personnel list who have no app access yet; Crewtender
// creates one personal link per person (no e-mail needed, valid 14 days, only role "Mitarbeiter", linked to that
// personnel record). The links go out by WhatsApp or SMS from the office phone, or as a printable sheet with QR codes.
// Crewtender sends nothing itself.
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { sha256hex, zufallsToken } from "./kundenlink.ts";
import { qrSvg } from "./qr.ts";

export type Kraft = { id: string; vorname: string; nachname: string; telefon: string; email: string; bereich_id: string | null; status: string; user_id: string | null };
export type OffeneEinladung = { personal_id: string; gueltig_bis: string };
export type Link = { name: string; telefon: string; link: string };

/** Phone number for wa.me (digits with country code, no +) – German numbers starting with 0 get 49. */
export function telefonWa(t: string): string {
  const d = t.replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return `49${d.slice(1)}`;
  return d;
}

export const einladungsText = (firma: string, vorname: string, link: string) =>
  `Hallo ${vorname}, ${firma} nutzt Crewtender für Schichten, Stunden und Urlaub. Hier ist dein persönlicher Zugang (14 Tage gültig): ${link}`;

export function auswahlSeite(kraefte: Kraft[], offen: OffeneEinladung[], hinweis = ""): string {
  const ohne = kraefte.filter((k) => !k.user_id && k.status !== "nicht");
  const offenBis = (id: string) => offen.find((o) => o.personal_id === id)?.gueltig_bis;
  const zeile = (k: Kraft) => {
    const bis = offenBis(k.id);
    return `<label class="kraft-zeile"><input type="checkbox" name="p" value="${k.id}"${bis ? "" : " checked"}><span><strong>${escape(`${k.vorname} ${k.nachname}`.trim())}</strong><span class="klein">${k.telefon ? `📱 ${escape(k.telefon)}` : "ohne Handynummer"}${bis ? ` · Link offen bis ${new Date(bis).toLocaleDateString("de-DE")}` : ""}</span></span></label>`;
  };
  return `<p class="konto-zurueck"><a href="/konto/team" aria-label="Zurück">←</a></p>${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}
<p>Einsatzkräfte ohne App-Zugang. Jede Person bekommt einen eigenen Link: einmal antippen, Passwort wählen, fertig. Danach sieht sie ihre Schichten, Stunden, Urlaub und Spesen.</p>
${ohne.length ? `<form method="post" action="/konto/kraefte-einladen" class="kraefte-form"><div class="knopf-zeile"><button>📲 Links erstellen</button></div>
<div class="kraefte-liste">${ohne.map(zeile).join("")}</div>
<p class="klein">Schon offene Links werden durch neue ersetzt. Die Person wählt beim Anmelden ihre eigene E-Mail-Adresse; der Link verknüpft den Zugang mit ihrer Personalakte und gibt nur die Rolle „Mitarbeiter“.</p></form>`
  : `<p class="leer">Alle Einsatzkräfte haben schon einen Zugang. 🎉</p>`}`;
}

export function ergebnisSeite(links: Link[], firma: string): string {
  const karte = (l: Link) => {
    const tel = telefonWa(l.telefon), text = einladungsText(firma, l.name.split(" ")[0], l.link);
    return `<article class="einladung-karte"><div class="einladung-qr">${qrSvg(l.link, `QR-Code für ${l.name}`)}</div><div><h3>${escape(l.name)}</h3>
<div class="knopf-zeile teilen nicht-drucken">${tel ? `<a class="knopf" href="https://wa.me/${tel}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="knopf zweit" href="sms:+${tel}?&body=${encodeURIComponent(text)}">SMS</a>` : `<a class="knopf" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp (Kontakt wählen)</a>`}</div>
<label class="nicht-drucken">Link<input readonly value="${escape(l.link)}"></label><p class="klein nur-drucken">Mit der Handykamera scannen, Passwort wählen, fertig. Gültig 14 Tage.</p></div></article>`;
  };
  return `<p class="konto-zurueck"><a href="/konto/kraefte-einladen" aria-label="Zurück">←</a></p>
<p class="nicht-drucken">${links.length} ${links.length === 1 ? "Link" : "Links"} erstellt, je 14 Tage gültig. Tippe pro Person auf WhatsApp oder SMS; dein Handy öffnet die Nachricht mit fertigem Text. Oder druck die Seite aus und verteil die QR-Codes vor Ort.</p>
<div class="knopf-zeile nicht-drucken"><button type="button" class="zweit" data-drucken>🖨️ Drucken (QR-Codes)</button></div>
<div class="einladungen-karten">${links.map(karte).join("")}</div>
<p class="klein nicht-drucken">Crewtender verschickt nichts selbst. Jeder Link gehört zu genau einer Person; bitte nicht weitergeben. Die Links erscheinen nur jetzt im Klartext. Verlorene Links einfach neu erstellen.</p>`;
}

export async function kraefteEinladen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/kraefte-einladen") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  if (!f.admin) return html(seite("Einsatzkräfte einladen", "<p>Einladen dürfen Inhaber und Administration.</p>", 0, "team"), 403, f.s.cookies);
  const firma = f.m.firma_id;
  const [k, e] = await Promise.all([
    db<Kraft[]>(f.s, env, `personal?firma_id=eq.${firma}&select=id,vorname,nachname,telefon,email,bereich_id,status,user_id&order=vorname,nachname&limit=3000`),
    db<OffeneEinladung[]>(f.s, env, `einladungen?firma_id=eq.${firma}&personal_id=not.is.null&angenommen=is.null&gueltig_bis=gt.${new Date().toISOString()}&select=personal_id,gueltig_bis&limit=3000`),
  ]);
  const kraefte = k.ok ? k.daten : [];
  if (request.method !== "POST") return html(seite("Einsatzkräfte einladen", auswahlSeite(kraefte, e.ok ? e.daten : [], url.searchParams.get("hinweis") ?? ""), 0, "team"), 200, f.s.cookies);
  const form = await request.formData();
  const ids = new Set(form.getAll("p").map(String));
  const gewaehlt = kraefte.filter((x) => ids.has(x.id) && !x.user_id && x.status !== "nicht").slice(0, 200);
  if (!gewaehlt.length) return weiterleiten(`/konto/kraefte-einladen?hinweis=${encodeURIComponent("Bitte mindestens eine Person ankreuzen.")}`, f.s.cookies);
  await db(f.s, env, `einladungen?firma_id=eq.${firma}&angenommen=is.null&personal_id=in.(${gewaehlt.map((x) => x.id).join(",")})`, { method: "DELETE" });
  const tokens = gewaehlt.map(() => zufallsToken());
  const zeilen = await Promise.all(gewaehlt.map(async (x, i) => ({
    firma_id: firma, email: "", rolle: "mitarbeiter", anzeigename: `${x.vorname} ${x.nachname}`.trim().slice(0, 200), funktion: "Einsatzkraft",
    finanzen: false, bereich_ids: x.bereich_id ? [x.bereich_id] : [], personal_id: x.id, token_hash: await sha256hex(tokens[i]), erstellt_von: f.s.userId,
  })));
  const r = await db(f.s, env, "einladungen", { method: "POST", body: JSON.stringify(zeilen) });
  if (!r.ok) return weiterleiten(`/konto/kraefte-einladen?hinweis=${encodeURIComponent("Die Links konnten nicht erstellt werden.")}`, f.s.cookies);
  const links = gewaehlt.map((x, i) => ({ name: `${x.vorname} ${x.nachname}`.trim(), telefon: x.telefon, link: new URL(`/einladung?token=${tokens[i]}`, request.url).toString() }));
  const antwort = html(seite("Links für Einsatzkräfte", ergebnisSeite(links, f.m.firmen.name), 0, "team"), 200, f.s.cookies);
  antwort.headers.set("cache-control", "private, no-store");
  return antwort;
}
