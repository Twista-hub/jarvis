// Settings and account (I1–I5): finer notifications and quiet hours, own name and function, downloading one's own
// data (Art. 15/20 GDPR) and deleting the account, and a help page with frequent questions.
import { COOKIE, db, html, sitzung, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Benachrichtigung = { stunde: number | null; kanal: string; sofort_ab?: number | null; fristen?: boolean; ruhe_von?: number | null; ruhe_bis?: number | null };
const stundeText = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** I1/I2: extra fields of the notification form (immediate top hits, deadline reminders, quiet hours). */
export function benachrichtigungFelder(b: Benachrichtigung | undefined): string {
  const ruhe = (name: string, wert: number | null | undefined, leer: string) => `<select name="${name}"><option value="">${leer}</option>${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${wert === h ? " selected" : ""}>${stundeText(h)}</option>`).join("")}</select>`;
  return `<details class="benachrichtigung-mehr"${b?.sofort_ab || b?.ruhe_von != null || b?.fristen === false ? " open" : ""}><summary>Feiner einstellen</summary>
  <label>Sofort aufs Handy bei Top-Treffern<select name="sofort_ab"><option value="">aus</option>${[9, 8, 7].map((n) => `<option value="${n}"${b?.sofort_ab === n ? " selected" : ""}>ab ${n}/10</option>`).join("")}</select><span class="klein">Kommt, sobald Jarvis den Treffer findet, nicht erst zur gewählten Uhrzeit. Nur mit „Handy“ oder „Mail und Handy“.</span></label>
  <label class="zeile"><input type="checkbox" name="fristen" value="1"${b?.fristen !== false ? " checked" : ""}> Fristen-Erinnerungen (7 und 2 Tage vorher, am Fristtag morgens aufs Handy)</label>
  <div class="ruhe-felder"><label>Ruhezeit von${ruhe("ruhe_von", b?.ruhe_von, "keine")}</label><label>bis${ruhe("ruhe_bis", b?.ruhe_bis, "–")}</label></div>
  <span class="klein">In der Ruhezeit kommen keine Handy-Nachrichten. Die Frist-Nachricht am Morgen kommt dann zum Ende der Ruhezeit.</span>
</details>`;
}

/** Form values → columns; only sent when the form contains the fields. */
export function benachrichtigungAusFormular(f: FormData): Partial<Benachrichtigung> {
  if (!f.has("ruhe_von") && !f.has("sofort_ab")) return {};
  const zahl = (k: string, min: number, max: number) => { const v = String(f.get(k) ?? ""); const n = Number(v); return v !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const von = zahl("ruhe_von", 0, 23), bis = zahl("ruhe_bis", 0, 23);
  return { sofort_ab: zahl("sofort_ab", 5, 10), fristen: f.get("fristen") === "1", ruhe_von: von !== null && bis !== null && von !== bis ? von : null, ruhe_bis: von !== null && bis !== null && von !== bis ? bis : null };
}

/** Time of the last real login (not the hourly token refresh), from the token's "amr" claim. */
export function letzteAnmeldung(token: string): number | null {
  try {
    const teil = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const d = JSON.parse(atob(teil + "=".repeat((4 - (teil.length % 4)) % 4))) as { amr?: { timestamp?: number }[] };
    const zeiten = (d.amr ?? []).map((a) => Number(a.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
    return zeiten.length ? Math.max(...zeiten) * 1000 : null;
  } catch { return null; }
}

/** I3/I4 on "Mein Profil": name and function, data download, delete account. */
export function profilTeil(m: { firma_id: string; anzeigename?: string; funktion?: string; rolle: string }, token: string, jetzt = Date.now(), fehler = ""): string {
  const angemeldet = letzteAnmeldung(token);
  const frisch = angemeldet !== null && jetzt - angemeldet < 30 * 60_000;
  return `<h2>👤 Name und Funktion</h2>
<form method="post" action="/konto/profil/name" class="profil-name"><input type="hidden" name="firma" value="${m.firma_id}">
<label>Dein Name<input name="name" required minlength="2" maxlength="80" autocomplete="name" value="${escape(m.anzeigename ?? "")}"></label>
<label>Funktion<input name="funktion" maxlength="80" value="${escape(m.funktion ?? "")}" placeholder="z. B. Disposition"></label>
<button class="zweit">Speichern</button></form>
<p class="klein">So sieht dich dein Team. Deine Rolle und Rechte ändert nur die Firmenleitung.</p>
<h2 id="daten">🔒 Deine Daten</h2>
<p><a class="knopf zweit" href="/konto/daten.json" download>⬇ Meine Daten herunterladen</a></p>
<p class="klein">Eine Datei mit deinem Konto, deinen Firmenzugängen, Einstellungen, Notizen und eigenen Terminen (Art. 15 und 20 DSGVO). Daten der Firma (Ausschreibungen, Personal) gehören der Firma; die Firmenleitung kann sie anfordern.</p>
<details class="konto-loeschen" id="loeschen"${fehler ? " open" : ""}><summary>Konto löschen</summary>
${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
<p>Dein Zugang wird sofort und endgültig gelöscht. Firmen, in denen du die einzige Person bist, werden mit allen Daten gelöscht. In Firmen mit weiteren Mitgliedern bleiben deren Daten erhalten.</p>
${frisch ? `<form method="post" action="/konto/loeschen"><label>Zur Bestätigung LÖSCHEN eintippen<input name="bestaetigung" required autocomplete="off" pattern="LÖSCHEN|löschen|Löschen"></label><button class="gefahr-voll">Konto endgültig löschen</button></form>`
    : `<p class="klein">Zur Sicherheit musst du dich dafür in den letzten 30 Minuten angemeldet haben.</p><form method="post" action="/abmelden"><input type="hidden" name="weiter" value="/konto/profil#loeschen"><button class="zweit">Neu anmelden</button></form>`}
</details>`;
}

const HILFE: [string, [string, string][]][] = [
  ["🔎 Suche und Treffer", [
    ["Wie findet Jarvis Ausschreibungen?", "Jarvis prüft jeden Tag die öffentlichen Bekanntmachungen (Bekanntmachungsservice des Bundes, auf Wunsch auch europäische Länder) und vergleicht sie mit eurem Suchprofil: Arbeiten, Suchwörter, Einsatzorte und Filter. Die passenden bewertet eine KI mit 1 bis 10 Punkten."],
    ["Warum sehe ich einen Treffer nicht?", "Er liegt vielleicht außerhalb eures Suchgebiets, unter der Mindestpunktzahl, enthält ein Ausschlusswort oder ist abgelaufen. Im Suchprofil zeigt „🔍 Vorschau“, wie viele Ausschreibungen eure Einstellungen in der letzten Woche gefunden hätten."],
    ["Was bedeuten 👍 und 👎?", "Damit sagst du Jarvis, ob ein Treffer passt. Nach 👎 kannst du ein Wort aus dem Titel übernehmen, dann blendet Jarvis solche Ausschreibungen künftig aus."],
    ["Was ist ein Steckbrief?", "Eine Zusammenfassung der Ausschreibung: Leistung, Lose, Fristen, Nachweise, Eignung. Für die besten Treffer schreibt Jarvis täglich bis zu 4 Steckbriefe. Mit hochgeladenen Vergabeunterlagen wird er ausführlicher."],
  ]],
  ["⏰ Fristen und Nachrichten", [
    ["Wann bekomme ich Nachrichten?", "Zu deiner gewählten Uhrzeit per Mail, aufs Handy oder beides, aber nur, wenn es Neues gibt. Fristen-Erinnerungen kommen 7 und 2 Tage vorher und am Fristtag morgens aufs Handy. Unter Einstellungen → „Feiner einstellen“ legst du Sofort-Nachrichten für Top-Treffer und eine Ruhezeit fest."],
    ["Wie kommen Nachrichten aufs Handy?", "Öffne Jarvis auf dem Handy, tippe unter Einstellungen auf „📱 Nachrichten auf diesem Handy einschalten“ und erlaube die Mitteilungen. Auf dem iPhone muss Jarvis dafür zuerst zum Home-Bildschirm hinzugefügt werden (Teilen → „Zum Home-Bildschirm“)."],
    ["Kann ich die Fristen in meinem Kalender sehen?", "Ja: Unter Fristen → „📲 Alle Fristen im Handy-Kalender“ eine private Kalender-Adresse erzeugen und abonnieren. Neue Fristen kommen dann von selbst dazu."],
  ]],
  ["📥 Unterlagen und Angebote", [
    ["Wohin mit Nachweisen wie Versicherung oder Handelsregister?", "Unter Unterlagen → Firmenunterlagen. Jarvis liest das Ablaufdatum aus PDF oder Foto, erinnert vor dem Ablauf und legt passende Nachweise jedem Angebot bei."],
    ["Wie entsteht ein Angebot?", "In der Ausschreibung „Angebot vorbereiten“ wählen: Jarvis schreibt den Text mit den Preisen aus der Kalkulation und hakt die passenden Nachweise an. Die Firmenleitung gibt es frei; abgegeben wird im Vergabeportal von euch selbst. Jarvis reicht nichts selbst ein."],
    ["Wie lange bleiben hochgeladene Vergabeunterlagen gespeichert?", "30 Tage. Firmenunterlagen und Vorlagen bleiben, bis die Firmenleitung sie löscht."],
  ]],
  ["👥 Team und Konto", [
    ["Wie lade ich Kolleginnen und Kollegen ein?", "Unter Firma & Team → App-Zugänge eine Einladung per Mail schicken und die Rolle wählen. Wer welche Standorte und Finanzen sieht, legt die Firmenleitung fest."],
    ["Wie lösche ich mein Konto?", "Unter Mein Profil → „Konto löschen“. Bist du die letzte Inhaberin oder der letzte Inhaber einer Firma mit weiteren Mitgliedern, übertrage die Inhaberrolle vorher an jemand anderen."],
    ["Wo liegen unsere Daten und wer sieht sie?", "Gespeichert in Rechenzentren in der EU. Jeder sieht nur die Daten seiner Firma und der Bereiche, für die er freigeschaltet ist; Finanzen nur mit Finanzfreigabe. Einzelheiten stehen in der Datenschutzerklärung."],
  ]],
];

/** I5: frequent questions with a search field (works without scripts as plain sections) and a contact button. */
export function hilfeSeite(email: string): string {
  const betreff = encodeURIComponent("Frage zu Jarvis");
  const text = encodeURIComponent(`Hallo,\n\nmeine Frage:\n\n\n---\nKonto: ${email}`);
  return `<label class="hilfe-suche"><span class="unsichtbar">Hilfe durchsuchen</span><input type="search" placeholder="🔍 Frage suchen, z. B. Handy oder Fristen" data-hilfe-suche></label>
${HILFE.map(([titel, fragen]) => `<section class="hilfe-gruppe"><h2>${titel}</h2>${fragen.map(([f, a]) => `<details class="hilfe-frage"><summary>${escape(f)}</summary><p>${escape(a)}</p></details>`).join("")}</section>`).join("")}
<p class="hilfe-leer" data-hilfe-leer hidden>Keine passende Frage gefunden. Schreib uns einfach.</p>
<section class="hilfe-kontakt"><h2>✉️ Noch Fragen?</h2><p>Schreib uns einfach, am besten mit kurzer Beschreibung, wo es hakt.</p><p><a class="knopf" href="mailto:kontakt@wpdigitalranger.com?subject=${betreff}&body=${text}">Nachricht schreiben</a></p><p class="klein">Öffnet dein Mailprogramm. kontakt@wpdigitalranger.com</p></section>`;
}

/** Own data as JSON (only what the person may see anyway, read with their rights). */
export async function datenExport(s: Sitzung, env: KontoEnv): Promise<Record<string, unknown>> {
  const lesen = async (pfad: string) => { const r = await db<unknown[]>(s, env, pfad); return r.ok ? r.daten : []; };
  const [zugaenge, nachrichten, notizen, termine, geraete, kalender] = await Promise.all([
    lesen(`mitglieder?user_id=eq.${s.userId}&select=firma_id,rolle,funktion,anzeigename,finanzen,alle_bereiche,aktiv,erstellt,firmen(name)`),
    lesen(`benachrichtigungen?user_id=eq.${s.userId}&select=firma_id,stunde,kanal,sofort_ab,fristen,ruhe_von,ruhe_bis,letzte_mail`),
    lesen(`vorgang_notizen?user_id=eq.${s.userId}&select=vorgang_id,text,erstellt`),
    lesen(`eigene_termine?user_id=eq.${s.userId}&select=titel,zeit,vorgang_id,erstellt`),
    lesen(`push_abos?user_id=eq.${s.userId}&select=erstellt`),
    lesen(`kalender_abos?user_id=eq.${s.userId}&select=firma_id`),
  ]);
  return {
    hinweis: "Deine bei Jarvis gespeicherten Daten (Art. 15 und 20 DSGVO). Daten der Firmen selbst kann die jeweilige Firmenleitung anfordern.",
    exportiert_am: new Date().toISOString(),
    konto: { id: s.userId, email: s.email },
    firmenzugaenge: zugaenge, benachrichtigungen: nachrichten, notizen, eigene_termine: termine,
    handys_fuer_nachrichten: geraete.length, kalender_abos: kalender.length,
  };
}

export async function kontoEinstellungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (!["/konto/profil/name", "/konto/daten.json", "/konto/loeschen", "/konto/hilfe"].includes(p)) return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten(`/anmelden?weiter=${encodeURIComponent(p === "/konto/daten.json" ? "/konto/profil#daten" : p)}`);
  if (p === "/konto/hilfe") return html(seite("Hilfe", `<p class="konto-zurueck"><a href="/konto/einstellungen" aria-label="Zurück zu den Einstellungen">←</a></p>${hilfeSeite(s.email)}`, 0, "einstellungen"), 200, s.cookies);
  if (p === "/konto/daten.json") {
    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="jarvis-meine-daten-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" });
    for (const c of s.cookies) headers.append("set-cookie", c);
    return new Response(JSON.stringify(await datenExport(s, env), null, 2), { headers });
  }
  if (request.method !== "POST") return weiterleiten("/konto/profil", s.cookies);
  const form = await request.formData();
  if (p === "/konto/profil/name") {
    const firma = String(form.get("firma") ?? "");
    const r = /^[0-9a-f-]{36}$/.test(firma) ? await db(s, env, "rpc/mein_profil", { method: "POST", body: JSON.stringify({ f: firma, name: String(form.get("name") ?? ""), funktion: String(form.get("funktion") ?? "") }) }) : null;
    return weiterleiten(`/konto/profil?hinweis=${encodeURIComponent(r?.ok ? "Name und Funktion gespeichert." : "Bitte einen Namen mit mindestens 2 Zeichen eintragen.")}`, s.cookies);
  }
  // Delete account: confirmation word and a recent login, then the database deletes the login (and firms where
  // the person was alone); their stored files are removed here.
  const zurueck = (fehler: string) => weiterleiten(`/konto/profil?loeschfehler=${encodeURIComponent(fehler)}#loeschen`, s.cookies);
  if (String(form.get("bestaetigung") ?? "").trim().toUpperCase() !== "LÖSCHEN") return zurueck("Bitte zur Bestätigung LÖSCHEN eintippen.");
  const angemeldet = letzteAnmeldung(s.token);
  if (angemeldet === null || Date.now() - angemeldet > 30 * 60_000) return zurueck("Bitte melde dich zur Sicherheit neu an und versuche es dann noch einmal.");
  const r = await db<string[]>(s, env, "rpc/konto_loeschen", { method: "POST", body: "{}" });
  if (!r.ok) return zurueck(/LETZTER_INHABER/.test(r.fehler) ? "Du bist die letzte Inhaberin bzw. der letzte Inhaber einer Firma mit weiteren Mitgliedern. Übertrage die Inhaberrolle unter Firma & Team zuerst an jemand anderen." : "Das Konto konnte nicht gelöscht werden. Bitte schreib uns über die Hilfe.");
  if (env.DATEN && Array.isArray(r.daten)) {
    for (const firma of r.daten.filter((f) => /^[0-9a-f-]{36}$/.test(f))) {
      for (const praefix of ["bibliothek", "personal-fotos", "importe", "angebotsabgaben"]) {
        for (let runde = 0; runde < 20; runde++) {
          const liste = await env.DATEN.list({ prefix: `${praefix}/${firma}/` });
          if (!liste.objects.length) break;
          await env.DATEN.delete(liste.objects.map((o) => o.key));
        }
      }
    }
  }
  return html(seite("Konto gelöscht", `<p><strong>Dein Konto ist gelöscht.</strong></p><p>Danke, dass du Jarvis genutzt hast. Du kannst dich jederzeit neu registrieren.</p><p><a href="/">Zur Startseite</a></p>`), 200, [`jv_at=; ${COOKIE}; Max-Age=0`, `jv_rt=; ${COOKIE}; Max-Age=0`, `jv_firma=; ${COOKIE}; Max-Age=0`]);
}
