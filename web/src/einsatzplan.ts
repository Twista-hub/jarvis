// Messages to several people and the assignment plan of a tender. Jarvis only prepares the texts: the buttons
// open WhatsApp, SMS or e-mail on the phone (one tap per person, or one SMS / one group message for everyone).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { bereichOptionen } from "./bereiche.ts";
import { escape, seite } from "./seite.ts";
import { EINSATZ, STATUS, passt, waNummer, type Einsatz, type Kraft } from "./personal.ts";

const ID = /^[0-9a-f-]{36}$/;
type Vorgang = { id: string; titel: string; frist: string | null; firma_id: string };
export type Plan = { ort: string; beginn: string | null; ende: string | null; treffpunkt: string; kleidung: string; ansprechpartner: string; hinweise: string };

const BERLIN = "Europe/Berlin";
/** "2026-11-03T07:00" (Berlin wall clock) -> ISO timestamp. */
export function berlinZuIso(lokal: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(lokal)) return null;
  const alsUtc = Date.parse(`${lokal}:00Z`);
  const teile = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(alsUtc)).map((p) => [p.type, p.value]));
  const versatz = Date.parse(`${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}:00Z`) - alsUtc;
  return new Date(alsUtc - versatz).toISOString();
}
/** ISO -> value for <input type="datetime-local"> in Berlin time. */
export function isoZuBerlin(iso: string | null): string {
  if (!iso) return "";
  const t = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}`;
}
const zeit = (iso: string) => `${new Date(iso).toLocaleString("de-DE", { timeZone: BERLIN, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr`;

/** The plan as a message; anrede "" = for a group. */
export function planText(o: { titel: string; firma: string; plan: Plan | null; team: { name: string; beruf: string }[]; anrede: string }): string {
  const p = o.plan;
  const zeilen = [
    o.anrede ? `Hallo ${o.anrede},\n\nhier ist dein Einsatzplan:` : "Hallo zusammen,\n\nhier ist der Einsatzplan:",
    "",
    `📋 ${o.titel}`,
    p?.ort ? `📍 Ort: ${p.ort}` : "",
    p?.beginn ? `🗓️ Beginn: ${zeit(p.beginn)}` : "",
    p?.ende ? `🏁 Ende: ${zeit(p.ende)}` : "",
    p?.treffpunkt ? `🤝 Treffpunkt: ${p.treffpunkt}` : "",
    p?.kleidung ? `👕 Kleidung: ${p.kleidung}` : "",
    p?.ansprechpartner ? `📞 Ansprechpartner: ${p.ansprechpartner}` : "",
    p?.hinweise ? `\nℹ️ ${p.hinweise}` : "",
    o.team.length ? `\n👷 Team (${o.team.length}):\n${o.team.map((t) => `• ${t.name}${t.beruf ? ` (${t.beruf})` : ""}`).join("\n")}` : "",
    "",
    "Bitte kurz bestätigen, dass du dabei bist.",
    "",
    `Viele Grüße\n${o.firma}`,
  ];
  return zeilen.filter((z, i) => z !== "" || zeilen[i - 1] !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

const tel = (k: Kraft) => k.telefon.replace(/[^\d+]/g, "");
const kurz = (t: string, n = 55) => (t.length > n ? `${t.slice(0, n - 3)}…` : t);

/** Buttons for one text: WhatsApp per person, one SMS to all, WhatsApp group, copy. */
function versand(personen: { k: Kraft; text: string }[], gruppenText: string): string {
  const mitNummer = personen.filter(({ k }) => k.telefon);
  const sms = mitNummer.map(({ k }) => tel(k)).join(",");
  return `<div class="versand">
  <p><strong>An alle auf einmal</strong></p>
  <div class="person-aktionen">
    <a class="knopf whatsapp" href="https://wa.me/?text=${encodeURIComponent(gruppenText)}" target="_blank" rel="noopener">💬 In WhatsApp-Gruppe teilen</a>
    ${sms ? `<a class="knopf-klein" href="sms:${escape(sms)}?body=${encodeURIComponent(gruppenText)}">✉️ Eine SMS an alle (${mitNummer.length})</a>` : ""}
    <button type="button" class="knopf-klein" data-kopieren="${escape(gruppenText)}">📋 Text kopieren</button>
  </div>
  <p class="klein">WhatsApp-Gruppe: Du wählst in WhatsApp die Gruppe oder den Chat aus. Eine SMS an alle: Die Empfänger sehen sich gegenseitig nicht, wenn dein Handy einzelne SMS verschickt (Standard bei Android).</p>
  ${personen.length ? `<p><strong>Persönlich, einzeln nacheinander</strong></p><ul class="einsatz-liste">${personen.map(({ k, text }) => {
    const nr = waNummer(k.telefon);
    return `<li class="einsatz-zeile"><div><strong>${escape(`${k.vorname} ${k.nachname}`.trim())}</strong><span class="klein">${escape(k.berufe[0] ?? "")}${k.telefon ? "" : " · keine Telefonnummer"}</span></div><div class="person-aktionen">${nr ? `<a class="knopf-klein" href="https://wa.me/${nr}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">💬 WhatsApp</a><a class="knopf-klein" href="sms:${escape(tel(k))}?body=${encodeURIComponent(text)}">✉️ SMS</a>` : ""}${k.email ? `<a class="knopf-klein" href="mailto:${escape(k.email)}?body=${encodeURIComponent(text)}">📧</a>` : ""}</div></li>`;
  }).join("")}</ul><p class="klein">Jede Nachricht ist mit Vornamen. Tippe nacheinander, WhatsApp öffnet sich jeweils mit dem fertigen Text.</p>` : ""}
</div>`;
}

export async function einsatzplan(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const plan = url.pathname.match(/^\/konto\/vorgang\/([0-9a-f-]{36})\/einsatzplan$/);
  const rund = url.pathname === "/konto/rundnachricht";
  if (!plan && !rund) return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const darfAendern = ["inhaber", "admin", "bearbeiter", "standortleitung"].includes(f.m.rolle);
  if (f.m.rolle === "mitarbeiter") return weiterleiten("/konto");
  const antwort = (titel: string, zurueck: string, inhalt: string, status = 200) => html(seite(titel, `<p class="konto-zurueck"><a href="${zurueck}" aria-label="Zurück">‹</a></p>${inhalt}`, 0, plan ? "treffer" : "team"), status, f.s.cookies);

  if (rund) {
    if (request.method === "POST") {
      // Mark everyone written to as "angefragt" at the chosen tender.
      const form = await request.formData();
      const vid = String(form.get("vorgang") ?? "");
      const ids = form.getAll("personal").map(String).filter((x) => ID.test(x));
      const ok = darfAendern && ID.test(vid) && ids.length > 0 && (await db(f.s, env, "einsaetze?on_conflict=vorgang_id,personal_id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(ids.map((personal_id) => ({ firma_id: f.m.firma_id, vorgang_id: vid, personal_id, status: "angefragt" }))) })).ok;
      return weiterleiten(ok ? `/konto/vorgang/${vid}#personal` : `/konto/rundnachricht?hinweis=${encodeURIComponent("Eintragen hat nicht geklappt.")}`, f.s.cookies);
    }
    const bereich = url.searchParams.get("bereich") ?? "";
    const beruf = url.searchParams.get("beruf") ?? "";
    const status = url.searchParams.has("status") ? url.searchParams.get("status")! : "verfuegbar";
    const vid = url.searchParams.get("vorgang") ?? "";
    const [bereiche, alle, vorgaenge] = await Promise.all([
      db<Bereich[]>(f.s, env, `bereiche?firma_id=eq.${f.m.firma_id}&select=id,name,art,parent_id`),
      db<Kraft[]>(f.s, env, `personal?firma_id=eq.${f.m.firma_id}&select=*&order=vorname`),
      db<Vorgang[]>(f.s, env, `vorgaenge?firma_id=eq.${f.m.firma_id}&status=not.in.(verworfen,verloren,abgegeben)&select=id,titel,frist,firma_id&order=erstellt.desc&limit=60`),
    ]);
    const pool = alle.ok ? alle.daten : [];
    const gewaehlt = (vorgaenge.ok ? vorgaenge.daten : []).find((v) => v.id === vid);
    const personen = pool.filter((k) => (!bereich || k.bereich_id === bereich) && (!beruf || k.berufe.includes(beruf)) && (!status || k.status === status));
    const einsatz = gewaehlt
      ? `wir haben voraussichtlich einen Einsatz: „${gewaehlt.titel}“.${gewaehlt.frist ? ` Wir bewerben uns bis ${new Date(gewaehlt.frist).toLocaleDateString("de-DE", { timeZone: BERLIN })}.` : ""}\n\nWer hätte grundsätzlich Zeit und Interesse? Bitte kurz zurückmelden.`
      : "wer hätte in den nächsten Wochen Zeit für einen Einsatz? Bitte kurz zurückmelden, dann besprechen wir die Details.";
    const kern = url.searchParams.get("text") ?? einsatz;
    const text = (anrede: string) => `Hallo ${anrede},\n\n${kern}\n\nViele Grüße\n${f.m.firmen.name}`;
    const berufe = [...new Set(pool.flatMap((k) => k.berufe))].sort((a, b) => a.localeCompare(b, "de"));
    const filter = `<form method="get" action="/konto/rundnachricht" class="filter-leiste">
  ${bereiche.ok && bereiche.daten.length ? `<label>Standort<select name="bereich" data-sofort-wahl><option value="">Alle Standorte</option>${bereichOptionen(bereiche.daten, bereich)}</select></label>` : ""}
  <label>Beruf<select name="beruf" data-sofort-wahl><option value="">Alle Berufe</option>${berufe.map((b) => `<option${b === beruf ? " selected" : ""}>${escape(b)}</option>`).join("")}</select></label>
  <label>Status<select name="status" data-sofort-wahl><option value="">Alle</option>${Object.entries(STATUS).map(([w, [i, t]]) => `<option value="${w}"${w === status ? " selected" : ""}>${i} ${t}</option>`).join("")}</select></label>
  <label>Worum geht es?<select name="vorgang" data-sofort-wahl><option value="">Allgemein: Zeit für einen Einsatz?</option>${(vorgaenge.ok ? vorgaenge.daten : []).map((v) => `<option value="${v.id}"${v.id === vid ? " selected" : ""}>${beruf && passt(v.titel, [beruf]) ? "⭐ " : ""}${escape(kurz(v.titel))}</option>`).join("")}</select></label>
  <noscript><button>Anzeigen</button></noscript>
</form>`;
    const hinweis = url.searchParams.get("hinweis");
    return antwort("Rundnachricht", "/konto/team", `<h1>📣 Mehrere anschreiben</h1>
${hinweis ? `<p class="fehler">${escape(hinweis)}</p>` : ""}
${filter}
<p class="klein">${personen.length} ${personen.length === 1 ? "Person passt" : "Personen passen"} zur Auswahl.</p>
${personen.length ? `<form method="get" action="/konto/rundnachricht">${[["bereich", bereich], ["beruf", beruf], ["status", status], ["vorgang", vid]].map(([n, w]) => `<input type="hidden" name="${n}" value="${escape(w)}">`).join("")}
  <label>Text (kannst du ändern; Anrede und Gruß setzt Jarvis automatisch)<textarea name="text" rows="7" maxlength="2000">${escape(kern)}</textarea></label>
  <button class="knopf-leise">Geänderten Text übernehmen</button>
</form>
${versand(personen.map((k) => ({ k, text: text(k.vorname) })), text("zusammen"))}
${gewaehlt && darfAendern ? `<form method="post" action="/konto/rundnachricht"><input type="hidden" name="vorgang" value="${gewaehlt.id}">${personen.map((k) => `<input type="hidden" name="personal" value="${k.id}">`).join("")}<button>📨 Alle ${personen.length} bei der Ausschreibung als „angefragt“ eintragen</button></form>` : ""}` : `<p>Ändere die Auswahl oben, zum Beispiel Status „Alle“.</p>`}`);
  }

  // Assignment plan of one tender.
  const vid = plan![1];
  const v = await db<Vorgang[]>(f.s, env, `vorgaenge?id=eq.${vid}&select=id,titel,frist,firma_id`);
  const vorgang = v.ok ? v.daten[0] : undefined;
  if (!vorgang || vorgang.firma_id !== f.m.firma_id) return antwort("Nicht gefunden", "/konto/treffer", "<p>Diese Ausschreibung gibt es nicht oder du darfst sie nicht sehen.</p>", 404);
  if (request.method === "POST") {
    if (!darfAendern) return antwort("Nicht erlaubt", `/konto/vorgang/${vid}`, "<p>Nur Bearbeiter und Admins können den Einsatzplan ändern.</p>", 403);
    const form = await request.formData();
    const t = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
    const daten = { vorgang_id: vid, firma_id: f.m.firma_id, ort: t("ort", 300), beginn: berlinZuIso(t("beginn", 16)), ende: berlinZuIso(t("ende", 16)), treffpunkt: t("treffpunkt", 300), kleidung: t("kleidung", 300), ansprechpartner: t("ansprechpartner", 300), hinweise: t("hinweise", 2000), geaendert: new Date().toISOString() };
    const r = await db(f.s, env, "einsatzplaene?on_conflict=vorgang_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(daten) });
    return weiterleiten(`/konto/vorgang/${vid}/einsatzplan?hinweis=${encodeURIComponent(r.ok ? "Einsatzplan gespeichert. Jetzt verschicken:" : "Speichern hat nicht geklappt.")}#versand`, f.s.cookies);
  }
  const [p, e] = await Promise.all([
    db<Plan[]>(f.s, env, `einsatzplaene?vorgang_id=eq.${vid}&select=*`),
    db<(Einsatz & { personal: Kraft | null })[]>(f.s, env, `einsaetze?vorgang_id=eq.${vid}&select=id,personal_id,vorgang_id,status,personal(*)&order=erstellt`),
  ]);
  const gespeichert = p.ok ? p.daten[0] ?? null : null;
  const wer = url.searchParams.get("wer") ?? "zugesagt";
  const eingeplant = (e.ok ? e.daten : []).filter((x) => x.personal && x.status !== "abgesagt");
  const empfaenger = eingeplant.filter((x) => wer === "alle" || x.status === "zugesagt").map((x) => x.personal!);
  const teamZeigen = url.searchParams.get("team") === "1";
  const team = teamZeigen ? empfaenger.map((k) => ({ name: `${k.vorname} ${k.nachname}`.trim(), beruf: k.berufe[0] ?? "" })) : [];
  const text = (anrede: string) => planText({ titel: vorgang.titel, firma: f.m.firmen.name, plan: gespeichert, team, anrede });
  const hinweis = url.searchParams.get("hinweis");
  const formular = darfAendern ? `<details${gespeichert ? "" : " open"}><summary>✏️ ${gespeichert ? "Plan ändern" : "Plan ausfüllen"}</summary><form method="post" action="/konto/vorgang/${vid}/einsatzplan" class="personal-form">
  <label>Einsatzort<input name="ort" maxlength="300" placeholder="z. B. Messe Düsseldorf, Halle 5, Eingang Nord" value="${escape(gespeichert?.ort ?? "")}"></label>
  <div class="zwei"><label>Beginn<input type="datetime-local" name="beginn" value="${isoZuBerlin(gespeichert?.beginn ?? null)}"></label>
  <label>Ende<input type="datetime-local" name="ende" value="${isoZuBerlin(gespeichert?.ende ?? null)}"></label></div>
  <label>Treffpunkt<input name="treffpunkt" maxlength="300" placeholder="z. B. 15 Minuten vorher am Personaleingang" value="${escape(gespeichert?.treffpunkt ?? "")}"></label>
  <label>Kleidung<select name="kleidung">${["", "Schwarze Hose, weißes Hemd/Bluse, schwarze Schuhe", "Komplett schwarz", "Sicherheitsschuhe S3 und Arbeitskleidung", "Wird vor Ort gestellt"].concat(gespeichert?.kleidung && !["", "Schwarze Hose, weißes Hemd/Bluse, schwarze Schuhe", "Komplett schwarz", "Sicherheitsschuhe S3 und Arbeitskleidung", "Wird vor Ort gestellt"].includes(gespeichert.kleidung) ? [gespeichert.kleidung] : []).map((k) => `<option value="${escape(k)}"${k === (gespeichert?.kleidung ?? "") ? " selected" : ""}>${k ? escape(k) : "keine Angabe"}</option>`).join("")}</select></label>
  <label>Ansprechpartner vor Ort<input name="ansprechpartner" maxlength="300" placeholder="z. B. Frau Weber, 0170 1234567" value="${escape(gespeichert?.ansprechpartner ?? "")}"></label>
  <label>Hinweise<textarea name="hinweise" rows="3" maxlength="2000" placeholder="z. B. Ausweis mitbringen, Parken auf P3">${escape(gespeichert?.hinweise ?? "")}</textarea></label>
  <button>Plan speichern</button>
</form></details>` : "";
  const auswahl = `<form method="get" action="/konto/vorgang/${vid}/einsatzplan" class="filter-leiste"><label>An wen?<select name="wer" data-sofort-wahl><option value="zugesagt"${wer === "zugesagt" ? " selected" : ""}>✅ Nur Zugesagte (${eingeplant.filter((x) => x.status === "zugesagt").length})</option><option value="alle"${wer === "alle" ? " selected" : ""}>Alle Eingeplanten (${eingeplant.length})</option></select></label><label class="zeile"><input type="checkbox" name="team" value="1"${teamZeigen ? " checked" : ""} data-sofort-wahl> Teamliste mitschicken</label><noscript><button>Übernehmen</button></noscript></form>`;
  return antwort("Einsatzplan", `/konto/vorgang/${vid}#personal`, `<h1>🗓️ Einsatzplan</h1>
<p><strong>${escape(vorgang.titel)}</strong></p>
${hinweis ? `<p role="status"><strong>${escape(hinweis)}</strong></p>` : ""}
${formular}
<h2 id="versand">Verschicken</h2>
${eingeplant.length ? auswahl : `<p class="klein">Noch niemand eingeplant. <a href="/konto/vorgang/${vid}#personal">Personal einplanen →</a></p>`}
<label>Vorschau<textarea rows="14" readonly>${escape(text(""))}</textarea></label>
${versand(empfaenger.map((k) => ({ k, text: text(k.vorname) })), text(""))}
<p class="klein">Die Nachrichten gehen von deinem Handy aus. Jarvis verschickt selbst nichts.</p>`);
}
