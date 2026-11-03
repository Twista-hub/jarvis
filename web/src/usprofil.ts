// US bidder profile (/konto/us-profil): SAM.gov registration, NAICS, small-business status and SBA certifications.
// The "May I bid?" light (ampel.ts) reads it. Office team reads, owners and admins change (table us_bieterprofil).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { GROESSE, ZERTIFIKATE, type UsProfil } from "./ampel.ts";
import { appSprache } from "./englisch.ts";
import { db, html, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";
import { auslaufend, vertragsTabelle } from "./usaspending.ts";

export async function usProfilLaden(s: Sitzung, env: KontoEnv, firma: string): Promise<UsProfil | null> {
  const r = await db<UsProfil[]>(s, env, `us_bieterprofil?firma_id=eq.${firma}&select=uei,cage,sam_gueltig_bis,naics,klein_naics,zertifikate,umsatz_durchschnitt,mitarbeiter`);
  return r.ok ? r.daten[0] ?? null : null;
}

const codes = (x: string) => [...new Set(x.split(/[\s,;]+/).map((c) => c.trim()).filter((c) => /^\d{6}$/.test(c)))].slice(0, 100);

/** Reads the form; returns the row or an error text. */
export function usProfilAusFormular(form: FormData, de: boolean): UsProfil | string {
  const t = (k: string) => String(form.get(k) ?? "").trim();
  const uei = t("uei").toUpperCase().replace(/\s/g, ""), cage = t("cage").toUpperCase().replace(/\s/g, "");
  if (uei && !/^[A-Z0-9]{12}$/.test(uei)) return de ? "Die UEI hat 12 Zeichen (Buchstaben und Ziffern)." : "The UEI has 12 characters (letters and digits).";
  if (cage && !/^[A-Z0-9]{5}$/.test(cage)) return de ? "Der CAGE-Code hat 5 Zeichen." : "The CAGE code has 5 characters.";
  const bis = t("sam_gueltig_bis");
  if (bis && !/^\d{4}-\d{2}-\d{2}$/.test(bis)) return de ? "Bitte ein gültiges Datum eingeben." : "Please enter a valid date.";
  const zahl = (k: string) => { const v = t(k).replace(/[$,.\s]/g, ""); return v ? Number(v) : null; };
  const umsatz = zahl("umsatz_durchschnitt"), mitarbeiter = zahl("mitarbeiter");
  if ((umsatz !== null && (!Number.isFinite(umsatz) || umsatz < 0)) || (mitarbeiter !== null && (!Number.isInteger(mitarbeiter) || mitarbeiter < 0))) return de ? "Umsatz und Mitarbeiter als ganze Zahlen eingeben." : "Enter revenue and employees as whole numbers.";
  const naics = codes(t("naics"));
  return {
    uei, cage, sam_gueltig_bis: bis || null, naics,
    klein_naics: form.getAll("klein_naics").map(String).filter((c) => naics.includes(c)),
    zertifikate: form.getAll("zertifikate").map(String).filter((z) => z in ZERTIFIKATE),
    umsatz_durchschnitt: umsatz, mitarbeiter,
  };
}

export function usProfilFormular(p: UsProfil | null, de: boolean, darf: boolean, hinweis = ""): string {
  const t = (a: string, b: string) => de ? a : b;
  const w = (x: unknown) => escape(x == null ? "" : String(x));
  const naics = p?.naics ?? [];
  const aus = darf ? "" : " disabled";
  return `<p class="konto-zurueck"><a href="/konto" aria-label="${t("Zurück", "Back")}">←</a></p>
${hinweis ? `<p class="hinweis" role="status">${escape(hinweis)}</p>` : ""}
<p>${t("Damit Crewtender bei jeder US-Ausschreibung sagen kann, ob ihr bieten dürft (Set-aside, Größe, Registrierung).", "So Crewtender can tell you for every US tender whether you may bid (set-aside, size, registration).")}</p>
<form method="post" action="/konto/us-profil" class="formular">
<h2>SAM.gov</h2>
<label>Unique Entity ID (UEI)<input name="uei" value="${w(p?.uei)}" maxlength="12" autocomplete="off" placeholder="${t("12 Zeichen, steht in SAM.gov", "12 characters, shown in SAM.gov")}"${aus}></label>
<label>CAGE Code<input name="cage" value="${w(p?.cage)}" maxlength="5" autocomplete="off"${aus}></label>
<label>${t("Registrierung gültig bis", "Registration expires")}<input type="date" name="sam_gueltig_bis" value="${w(p?.sam_gueltig_bis)}"${aus}></label>
<p class="klein">${t("Noch nicht registriert? Die Registrierung auf sam.gov ist kostenlos. Wer dafür Geld verlangt, ist ein Dienstleister oder Betrüger.", "Not registered yet? Registration on sam.gov is free. Anyone charging for it is a service provider or a scam.")} <a href="https://sam.gov/content/entity-registration" rel="noopener" target="_blank">sam.gov</a></p>
<h2>NAICS</h2>
<label>${t("Eure NAICS-Codes (mit Komma)", "Your NAICS codes (comma separated)")}<input name="naics" value="${w(naics.join(", "))}" placeholder="561720, 561730"${aus}></label>
${naics.length ? `<fieldset><legend>${t("Für welche seid ihr in SAM.gov „small“?", "Which ones are you listed as \"small\" for in SAM.gov?")}</legend>${naics.map((c) => `<label class="zeile"><input type="checkbox" name="klein_naics" value="${c}"${p?.klein_naics.includes(c) ? " checked" : ""}${aus}> ${c}${GROESSE[c]?.umsatz ? ` <span class="klein">(${de ? `Grenze ${GROESSE[c].umsatz} Mio. $` : `limit $${GROESSE[c].umsatz}M`})</span>` : ""}</label>`).join("")}</fieldset>` : ""}
<label>${t("Durchschnittlicher Jahresumsatz der letzten 5 Jahre in $ (optional)", "Average annual revenue, last 5 years, in $ (optional)")}<input name="umsatz_durchschnitt" inputmode="numeric" value="${w(p?.umsatz_durchschnitt)}"${aus}></label>
<label>${t("Mitarbeiter (optional)", "Employees (optional)")}<input name="mitarbeiter" inputmode="numeric" value="${w(p?.mitarbeiter)}"${aus}></label>
<h2>${t("SBA-Zertifizierungen", "SBA certifications")}</h2>
${Object.entries(ZERTIFIKATE).map(([k, n]) => `<label class="zeile"><input type="checkbox" name="zertifikate" value="${k}"${p?.zertifikate.includes(k) ? " checked" : ""}${aus}> ${escape(de ? n.de : n.en)}</label>`).join("")}
<p class="klein">${t("Nur ankreuzen, was bei MySBA Certifications bestätigt ist. Falsche Angaben gegenüber Behörden sind strafbar.", "Only check what MySBA Certifications has approved. False statements to the government are a crime.")}</p>
${darf ? `<button>${t("Speichern", "Save")}</button>` : `<p class="klein">${t("Ändern dürfen Inhaber und Admins.", "Only owners and admins can change this.")}</p>`}
</form>`;
}

export async function usProfil(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/us-profil") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const de = appSprache(request) === "de";
  const titel = de ? "US-Bieterprofil" : "US bidder profile";
  const antwort = (t: string, status = 200) => html(seite(titel, t, 0, "einstellungen"), status, f.s.cookies);
  if (f.m.rolle === "mitarbeiter") return antwort(`<p>${de ? "Das sieht das Büroteam." : "Visible to the office team."}</p>`, 403);
  if (request.method === "POST") {
    if (!f.admin) return weiterleiten(`/konto/us-profil?hinweis=${encodeURIComponent(de ? "Ändern dürfen Inhaber und Admins." : "Only owners and admins can change this.")}`, f.s.cookies);
    const p = usProfilAusFormular(await request.formData(), de);
    if (typeof p === "string") return antwort(usProfilFormular(await usProfilLaden(f.s, env, f.m.firma_id), de, true, p), 400);
    const r = await db(f.s, env, "us_bieterprofil?on_conflict=firma_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ firma_id: f.m.firma_id, ...p, geaendert: new Date().toISOString() }) });
    return weiterleiten(`/konto/us-profil?hinweis=${encodeURIComponent(r.ok ? (de ? "Gespeichert." : "Saved.") : (de ? "Speichern hat nicht geklappt." : "Could not save."))}`, f.s.cookies);
  }
  return antwort(usProfilFormular(await usProfilLaden(f.s, env, f.m.firma_id), de, f.admin, url.searchParams.get("hinweis") ?? ""));
}

const STAATEN = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI".split(" ");

/** /konto/us-radar: federal contracts in a NAICS and state that end in 6–18 months (they will be tendered again). */
export async function usRadar(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/konto/us-radar" || request.method !== "GET") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const de = appSprache(request) === "de";
  const t = (a: string, b: string) => de ? a : b;
  if (f.m.rolle === "mitarbeiter") return html(seite(t("Auslaufende US-Verträge", "US contracts ending soon"), `<p>${t("Das sieht das Büroteam.", "Visible to the office team.")}</p>`, 0, "treffer"), 403, f.s.cookies);
  const profil = await usProfilLaden(f.s, env, f.m.firma_id);
  const naics = /^\d{6}$/.test(url.searchParams.get("naics") ?? "") ? url.searchParams.get("naics")! : profil?.naics[0] ?? "";
  const staat = STAATEN.includes((url.searchParams.get("staat") ?? "").toUpperCase()) ? url.searchParams.get("staat")!.toUpperCase() : "";
  const formular = `<form method="get" action="/konto/us-radar" class="zeile-form"><label>NAICS<input name="naics" inputmode="numeric" maxlength="6" value="${escape(naics)}" required${profil?.naics.length ? ` list="eigene-naics"` : ""}></label>${profil?.naics.length ? `<datalist id="eigene-naics">${profil.naics.map((n) => `<option value="${n}">`).join("")}</datalist>` : ""}<label>${t("Bundesstaat", "State")}<select name="staat" required><option value="">–</option>${STAATEN.map((x) => `<option${x === staat ? " selected" : ""}>${x}</option>`).join("")}</select></label><button>${t("Anzeigen", "Show")}</button></form>`;
  let ergebnis = "";
  if (naics && staat) {
    const liste = await auslaufend(naics, staat, (env as { WARTEN?: (p: Promise<unknown>) => void }).WARTEN);
    ergebnis = liste === null ? `<p class="fehler">${t("USAspending.gov ist gerade nicht erreichbar.", "USAspending.gov is not reachable right now.")}</p>`
      : !liste.length ? `<p class="klein">${t("Keine Verträge, die in 6 bis 18 Monaten enden.", "No contracts ending in 6 to 18 months.")}</p>`
      : `<p>${t(`${liste.length} Bundesverträge mit NAICS ${naics} in ${staat} enden in 6 bis 18 Monaten. Die Behörden schreiben sie meist vorher neu aus, oft mit „Sources Sought“. Jetzt Kontakt zum Contracting Officer aufnehmen und das Capability Statement schicken.`, `${liste.length} federal contracts with NAICS ${naics} in ${staat} end in 6 to 18 months. Agencies usually re-compete them before that, often starting with a sources sought notice. Reach out to the contracting officer now and send your capability statement.`)}</p>${vertragsTabelle(liste, de ? "de" : "en")}`;
  }
  return html(seite(t("Auslaufende US-Verträge", "US contracts ending soon"), `<p class="konto-zurueck"><a href="/konto" aria-label="${t("Zurück", "Back")}">←</a></p><p class="leise">${t("Recompete-Radar: Wer hat welchen Bundesvertrag, und wann läuft er aus?", "Recompete radar: who holds which federal contract, and when does it end?")}</p>${formular}${ergebnis}<p class="klein">${t("Quelle: USAspending.gov (offene Daten des US-Finanzministeriums), Enddatum ohne noch nicht gezogene Optionen.", "Source: USAspending.gov (US Treasury open data); end date without options not yet exercised.")}</p>`, 0, "treffer"), 200, f.s.cookies);
}
