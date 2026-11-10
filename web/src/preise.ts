// Price page /preise (public) and plan choice /konto/plan (Benjamin, 06.11.2026). Ordering sends a mail to WP Digital
// Ranger; the operator then sets the plan on /konto/betreiber and writes the invoice there (payment by invoice).
import { inAndroidApp } from "./android.ts";
import { aktiveFirma } from "./firmenunterlagen.ts";
import { db, html, weiterleiten, type KontoEnv } from "./konto.ts";
import { ABSENDER, senden, type Mail } from "./mail.ts";
import { PLAENE, PLAN_HINWEISE, PREIS_HINWEISE, bestellHinweis, jahrespreis, planKarten, planName, planSeite, wechselHinweis } from "./plaene.ts";
import { aboWechseln, bezahlSitzung, kraefteSetzen, MIT_KRAEFTEN, PAKET_ANZAHL, paketKaufen, portalSitzung, stripeLive, stripeSichtbar, type StripeEnv } from "./stripe.ts";
import { escape, seite } from "./seite.ts";
import { seoKopf } from "./seo.ts";
import { planStand } from "./plangrenzen.ts";

export const PREISE_BESCHREIBUNG = "Crewtender Preise: Free 0 €, Basis 59 €, Pro 149 €, Business 399 € im Monat. Jährlich 2 Monate geschenkt, Bezahlung per Rechnung, monatlich kündbar.";

export function preisSeiteInhalt(): string {
  return `<p class="klein">Ausschreibungen finden, Angebote schreiben, Team planen. Starte mit 30 Tagen Pro gratis und wechsle, wenn es passt.</p>
${planKarten()}${PREIS_HINWEISE}
<p class="knopf-zeile"><a class="knopf" href="/registrieren">30 Tage Pro gratis testen</a><a class="knopf zweit" href="/demo">Demo ansehen</a></p>
<h2>Häufige Fragen</h2>
<details><summary>Brauche ich eine Kreditkarte?</summary><p>Nein. Die 30 Tage Pro laufen ohne Kreditkarte und enden von selbst; danach geht es mit Free weiter. Erst für einen bezahlten Plan brauchst du eine Zahlungsart.</p></details>
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

/** Order of an add-on by invoice (field workers or a Steckbrief pack): mail to the operator, who books it on /konto/betreiber. */
export function zusatzMail(o: { firma: string; email: string; firmaId: string; was: string }): Mail {
  return {
    from: ABSENDER, to: ABSENDER.email, reply: { name: o.firma.replace(/[\r\n"<>]+/g, " ").slice(0, 100), email: o.email },
    subject: `Zusatz-Bestellung – ${o.firma.replace(/[\r\n]+/g, " ").slice(0, 80)}`,
    text: `Zusatz-Bestellung über crewtender.eu/konto/plan\n\nFirma: ${o.firma}\nFirmen-ID: ${o.firmaId}\nBestellt von: ${o.email}\nBestellt: ${o.was}\n\nEintragen auf crewtender.eu/konto/betreiber (Zusatz), Rechnung über Kundenrechnungen.\n`,
  };
}

type Firma = { name: string; paket: string; stripe_kunde: string | null; stripe_abo: string | null; abo_status: string | null; abo_bis: string | null; abo_kuendigt: boolean; abo_zahlweise: string | null; zusatz_einsatzkraefte?: number };
export async function preise(request: Request, env: KontoEnv & StripeEnv & { SMTP_PASSWORD?: string }): Promise<Response | null> {
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
  const fi = await db<Firma[]>(f.s, env, `firmen?id=eq.${f.m.firma_id}&select=name,paket,stripe_kunde,stripe_abo,abo_status,abo_bis,abo_kuendigt,abo_zahlweise,zusatz_einsatzkraefte`);
  const firma = fi.ok ? fi.daten[0] : undefined;
  const betreiber = !!env.STRIPE_SECRET_KEY && !stripeLive(env) ? await db<boolean>(f.s, env, "rpc/ist_betreiber", { method: "POST", body: "{}" }).then((r) => r.ok && r.daten === true) : false;
  const mitStripe = darf && stripeSichtbar(env, betreiber);
  const zurueck = (code: string) => weiterleiten(`/konto/plan?hinweis=${encodeURIComponent(code)}`, f.s.cookies);
  const inApp = inAndroidApp(request);
  if (request.method === "POST") {
    if (!darf || inApp) return weiterleiten("/konto/plan", f.s.cookies);
    const form = await request.formData();
    const weg = String(form.get("weg") ?? "rechnung");
    if (weg === "portal" && mitStripe && firma?.stripe_kunde) {
      try { return Response.redirect(await portalSitzung(env, firma.stripe_kunde, `${url.origin}/konto/plan`), 303); } catch { return zurueck("portal"); }
    }
    // Add-ons: further field workers (Pro, Business) and Steckbrief packs (from Basis).
    if (weg === "kraefte" || weg === "paket") {
      const stand = await planStand(f.s, env, f.m.firma_id);
      const aktivesAbo = !!firma?.stripe_abo && ["active", "trialing", "past_due"].includes(firma.abo_status ?? "");
      const sendenZusatz = async (was: string) => {
        try { await senden(env, zusatzMail({ firma: firma?.name ?? "", email: f.s.email, firmaId: f.m.firma_id, was })); return zurueck("zusatz_bestellt"); } catch { return zurueck("fehler"); }
      };
      if (weg === "paket") {
        if (!stand || ["kostenlos", "probe"].includes(stand.plan)) return zurueck("zusatz_plan");
        if (mitStripe) {
          try { return Response.redirect(await paketKaufen(env, { firma: f.m.firma_id, email: f.s.email, kunde: firma?.stripe_kunde, basis: url.origin }), 303); } catch { return zurueck("bezahlseite"); }
        }
        return sendenZusatz(`Steckbrief-Paket (${PAKET_ANZAHL} Steckbriefe, 15 €)`);
      }
      const anzahl = Math.floor(Number(form.get("anzahl")));
      if (!Number.isFinite(anzahl) || anzahl < 0 || anzahl > 2000) return zurueck("zusatz_anzahl");
      if (!stand || !MIT_KRAEFTEN.includes(stand.plan)) return zurueck("zusatz_plan");
      if (mitStripe && aktivesAbo && firma?.paket && MIT_KRAEFTEN.includes(firma.paket)) {
        try { await kraefteSetzen(env, firma.stripe_abo!, anzahl, firma.paket, firma.abo_zahlweise === "jahr" ? "jahr" : "monat"); return zurueck("kraefte_ok"); } catch { return zurueck("bezahlseite"); }
      }
      return sendenZusatz(`Weitere Einsatzkräfte: insgesamt ${anzahl} zusätzlich (bisher ${firma?.zusatz_einsatzkraefte ?? 0})`);
    }
    const plan = String(form.get("plan") ?? ""), zahlweise = form.get("zahlweise") === "jahr" ? "jahr" : "monat";
    const p = PLAENE.find((x) => x.id === plan && x.monat > 0);
    if (!p) return zurueck("plan");
    if (weg === "stripe" && mitStripe) {
      try {
        const aktiv = firma?.stripe_abo && ["active", "trialing", "past_due"].includes(firma.abo_status ?? "");
        if (aktiv) {
          await aboWechseln(env, firma!.stripe_abo!, plan, zahlweise);
          return weiterleiten(`/konto/plan?gewechselt=${encodeURIComponent(p.id)}`, f.s.cookies);
        }
        return Response.redirect(await bezahlSitzung(env, { firma: f.m.firma_id, email: f.s.email, plan, zahlweise, kunde: firma?.stripe_kunde, basis: url.origin }), 303);
      } catch (e) {
        console.warn(`Stripe: ${e instanceof Error ? e.message : e}`);
        return zurueck("bezahlseite");
      }
    }
    let ok = true;
    try { await senden(env, bestellMail({ firma: firma?.name ?? "", email: f.s.email, plan, zahlweise, firmaId: f.m.firma_id })); } catch { ok = false; }
    return ok ? weiterleiten(`/konto/plan?bestellt=${encodeURIComponent(p.id)}&zahlweise=${zahlweise}`, f.s.cookies) : zurueck("fehler");
  }
  const hinweis = url.searchParams.get("bezahlt") ? "Danke! Die Zahlung ist durch. Der Plan wird in wenigen Sekunden freigeschaltet; die Rechnung kommt per E-Mail."
    : url.searchParams.get("paket") ? "Danke! Das Steckbrief-Paket ist bezahlt. Die Steckbriefe stehen in wenigen Sekunden bereit; die Rechnung kommt per E-Mail."
    : url.searchParams.get("abgebrochen") ? "Zahlung abgebrochen. Es wurde nichts berechnet." : PLAN_HINWEISE[url.searchParams.get("hinweis") ?? ""] ?? "";
  const bestellt = PLAENE.find((x) => x.monat > 0 && x.id === url.searchParams.get("bestellt"));
  const gewechselt = PLAENE.find((x) => x.monat > 0 && x.id === url.searchParams.get("gewechselt"));
  const hinweisHtml = bestellt ? bestellHinweis(bestellt, url.searchParams.get("zahlweise") === "jahr", f.s.email) : gewechselt ? wechselHinweis(gewechselt) : undefined;
  const abo = firma ? { status: firma.abo_status, bis: firma.abo_bis, kuendigt: !!firma.abo_kuendigt, zahlweise: firma.abo_zahlweise, kunde: !!firma.stripe_kunde } : null;
  return html(seite("Plan & Preise", planSeite(firma?.paket ?? "kostenlos", firma?.name ?? "", darf, hinweis, { stripe: mitStripe, abo, test: !stripeLive(env), hinweisHtml, app: inApp, stand: await planStand(f.s, env, f.m.firma_id), zusatzOnline: { paket: mitStripe, kraefte: mitStripe && !!firma?.stripe_abo && ["active", "trialing", "past_due"].includes(firma.abo_status ?? "") } }), 0, "einstellungen"), 200, f.s.cookies);
}

