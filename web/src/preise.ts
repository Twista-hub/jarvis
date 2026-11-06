// Price page /preise (public) and plan choice /konto/plan (Benjamin, 06.11.2026). Ordering sends a mail to WP Digital
// Ranger; the operator then sets the plan on /konto/betreiber and writes the invoice there (payment by invoice).
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { ABSENDER, senden, type Mail } from "./mail.ts";
import { PLAENE, PREIS_HINWEISE, jahrespreis, planKarten, planName, planSeite, preisText } from "./plaene.ts";
import { escape, seite } from "./seite.ts";
import { seoKopf } from "./seo.ts";

export const PREISE_BESCHREIBUNG = "Crewtender Preise: Free 0 €, Basis 59 €, Pro 149 €, Business 399 € im Monat. Jährlich 2 Monate geschenkt, Bezahlung per Rechnung, monatlich kündbar.";

export function preisSeiteInhalt(): string {
  return `<p class="klein">Ausschreibungen finden, Angebote schreiben, Team planen. Starte kostenlos und wechsle, wenn es passt.</p>
${planKarten()}${PREIS_HINWEISE}
<p class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos testen</a><a class="knopf zweit" href="/demo">Demo ansehen</a></p>
<h2>Häufige Fragen</h2>
<details><summary>Brauche ich eine Kreditkarte?</summary><p>Nein. Du startest kostenlos. Für einen bezahlten Plan bekommst du eine Rechnung und zahlst per Überweisung.</p></details>
<details><summary>Wie kündige ich?</summary><p>Monatliche Pläne zum Monatsende, ein kurzes Schreiben an kontakt@wpdigitalranger.com reicht. Jahrespläne laufen 12 Monate.</p></details>
<details><summary>Was passiert mit meinen Daten, wenn ich kündige?</summary><p>Bis zum Ende kannst du alles herunterladen. Danach löschen wir die Daten der Firma innerhalb von 30 Tagen.</p></details>`;
}

export function bestellMail(o: { firma: string; email: string; plan: string; zahlweise: "monat" | "jahr"; firmaId: string }): Mail {
  const p = PLAENE.find((x) => x.id === o.plan)!;
  const betrag = o.zahlweise === "jahr" ? `${jahrespreis(p.monat)} € pro Jahr` : `${p.monat} € pro Monat`;
  return {
    from: ABSENDER, to: ABSENDER.email, reply: { name: o.firma.replace(/[\r\n"<>]+/g, " ").slice(0, 100), email: o.email },
    subject: `Bestellung: ${p.name} (${o.zahlweise === "jahr" ? "jährlich" : "monatlich"}) – ${o.firma.replace(/[\r\n]+/g, " ").slice(0, 80)}`,
    text: `Neue Bestellung über crewtender.eu/konto/plan\n\nFirma: ${o.firma}\nFirmen-ID: ${o.firmaId}\nBestellt von: ${o.email}\nPlan: ${p.name}\nZahlweise: ${o.zahlweise === "jahr" ? "jährlich (12 Monate zum Preis von 10)" : "monatlich"}\nBetrag: ${betrag}\n\nNächste Schritte: Plan unter https://crewtender.eu/konto/betreiber setzen, Rechnung unter https://crewtender.eu/konto/betreiber/rechnungen schreiben.\n`,
  };
}

export async function preise(request: Request, env: KontoEnv & { SMTP_PASSWORD?: string }): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/preise" && request.method === "GET") {
    const r = html(seite("Preise", preisSeiteInhalt()).replace("</title>", `</title>${seoKopf({ beschreibung: PREISE_BESCHREIBUNG, url: "https://crewtender.eu/preise" })}<link rel="canonical" href="https://crewtender.eu/preise">`));
    r.headers.delete("x-robots-tag");
    r.headers.set("cache-control", "public, max-age=600");
    return r;
  }
  if (url.pathname !== "/konto/plan") return null;
  const f = await aktiveFirma(request, env);
  if (!f) return weiterleiten("/konto");
  const darf = ["inhaber", "admin"].includes(f.m.rolle);
  const fi = await db<{ name: string; paket: string }[]>(f.s, env, `firmen?id=eq.${f.m.firma_id}&select=name,paket`);
  const firma = fi.ok ? fi.daten[0] : undefined;
  if (request.method === "POST") {
    if (!darf) return weiterleiten("/konto/plan", f.s.cookies);
    const form = await request.formData();
    const plan = String(form.get("plan") ?? ""), zahlweise = form.get("zahlweise") === "jahr" ? "jahr" : "monat";
    const p = PLAENE.find((x) => x.id === plan && x.monat > 0);
    if (!p) return weiterleiten(`/konto/plan?hinweis=${encodeURIComponent("Bitte einen Plan wählen.")}`, f.s.cookies);
    let ok = true;
    try { await senden(env, bestellMail({ firma: firma?.name ?? "", email: f.s.email, plan, zahlweise, firmaId: f.m.firma_id })); } catch { ok = false; }
    const text = ok ? `Danke! Deine Bestellung „${p.name}“ (${preisText(p, zahlweise === "jahr")}) ist bei uns. Wir schalten den Plan frei und schicken die Rechnung an ${f.s.email}.` : "Die Bestellung konnte nicht gesendet werden. Bitte schreib uns an kontakt@wpdigitalranger.com.";
    return weiterleiten(`/konto/plan?hinweis=${encodeURIComponent(text)}`, f.s.cookies);
  }
  return html(seite("Plan & Preise", planSeite(firma?.paket ?? "kostenlos", firma?.name ?? "", darf, url.searchParams.get("hinweis") ?? ""), 0, "einstellungen"), 200, f.s.cookies);
}

