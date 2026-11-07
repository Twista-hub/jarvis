import assert from "node:assert/strict";
import { test } from "node:test";
import { aboAenderung, aboWechseln, bezahlSitzung, formular, kraefteSetzen, paketKaufen, portalSitzung, signaturGueltig, stripeSichtbar } from "../src/stripe.ts";
import { zusatzTeil } from "../src/plaene.ts";
import { PLAENE, bestellHinweis, planSeite, wechselHinweis } from "../src/plaene.ts";
import { uebersetzen } from "../src/englisch.ts";

const FIRMA = "7548b874-b2ff-42a4-b05d-8971d447e4a9";

test("Stripe: Formular in Klammer-Schreibweise", () => {
  assert.equal(decodeURIComponent(formular({ a: 1, line_items: [{ price: "p1", quantity: 1 }], metadata: { firma: "x" }, leer: undefined })),
    "a=1&line_items[0][price]=p1&line_items[0][quantity]=1&metadata[firma]=x");
});

test("Stripe: Bezahl-Knöpfe im Testmodus nur für den Betreiber", () => {
  assert.equal(stripeSichtbar({}, true), false);
  assert.equal(stripeSichtbar({ STRIPE_SECRET_KEY: "sk_test_x" }, false), false);
  assert.equal(stripeSichtbar({ STRIPE_SECRET_KEY: "sk_test_x" }, true), true);
  assert.equal(stripeSichtbar({ STRIPE_SECRET_KEY: "sk_live_x" }, false), true);
});

test("Stripe: Signatur des Webhooks", async () => {
  const geheim = "whsec_test", body = '{"id":"evt_1"}', t = 1_800_000_000;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(geheim), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  assert.equal(await signaturGueltig(body, `t=${t},v1=${sig}`, geheim, t * 1000), true);
  assert.equal(await signaturGueltig(body + " ", `t=${t},v1=${sig}`, geheim, t * 1000), false, "geänderter Inhalt");
  assert.equal(await signaturGueltig(body, `t=${t},v1=${sig}`, geheim, (t + 600) * 1000), false, "zu alt");
  assert.equal(await signaturGueltig(body, `t=${t}`, geheim, t * 1000), false, "ohne Signatur");
});

test("Stripe: Ereignisse → Plan der Firma", () => {
  const kauf = aboAenderung({ id: "evt_a", type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: FIRMA, customer: "cus_1", subscription: "sub_1", metadata: { plan: "pro", zahlweise: "jahr" } } } })!;
  assert.deepEqual([kauf.firma, kauf.paket, kauf.kunde, kauf.abo, kauf.status, kauf.zahlweise], [FIRMA, "pro", "cus_1", "sub_1", "active", "jahr"]);
  const sub = (status: string, extra = {}) => ({ id: "sub_1", status, customer: "cus_1", metadata: { firma: FIRMA }, items: { data: [{ price: { lookup_key: "crewtender_business_monat" }, current_period_end: 1_800_000_000 }] }, ...extra });
  const wechsel = aboAenderung({ id: "evt_b", type: "customer.subscription.updated", data: { object: sub("active") } })!;
  assert.deepEqual([wechsel.paket, wechsel.zahlweise, wechsel.bis, wechsel.kuendigt], ["business", "monat", new Date(1_800_000_000_000).toISOString(), false]);
  assert.equal(aboAenderung({ id: "evt_c", type: "customer.subscription.updated", data: { object: sub("past_due") } })!.paket, "business", "Zahlung fehlgeschlagen: Plan bleibt während der Wiederholungen");
  assert.equal(aboAenderung({ id: "evt_d", type: "customer.subscription.updated", data: { object: sub("active", { cancel_at_period_end: true }) } })!.kuendigt, true);
  const portal = aboAenderung({ id: "evt_p", type: "customer.subscription.updated", data: { object: sub("active", { cancel_at: 1_790_000_000, cancel_at_period_end: false }) } })!;
  assert.deepEqual([portal.kuendigt, portal.bis, portal.paket], [true, new Date(1_790_000_000_000).toISOString(), "business"]);
  assert.equal(aboAenderung({ id: "evt_r", type: "customer.subscription.updated", data: { object: sub("active", { cancel_at: null }) } })!.kuendigt, false);
  const ende = aboAenderung({ id: "evt_e", type: "customer.subscription.deleted", data: { object: sub("canceled") } })!;
  assert.deepEqual([ende.paket, ende.status], ["kostenlos", "canceled"]);
  assert.equal(aboAenderung({ id: "evt_f", type: "customer.subscription.updated", data: { object: sub("unpaid") } })!.paket, "kostenlos");
  assert.equal(aboAenderung({ id: "evt_g", type: "invoice.paid", data: { object: {} } }), null);
  assert.equal(aboAenderung({ id: "evt_h", type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "x' or 1=1", metadata: { plan: "gold" } } } })!.firma, null, "nur echte Firmen-IDs");
});

test("Stripe: Bezahlseite und Kundenportal werden richtig angefragt", async () => {
  const aufrufe: { url: string; body: string }[] = [];
  const abruf = (async (url: string, init?: RequestInit) => {
    aufrufe.push({ url, body: String(init?.body ?? "") });
    if (url.includes("/prices?")) return Response.json({ data: [{ id: "price_pro_monat" }] });
    if (url.endsWith("/checkout/sessions")) return Response.json({ url: "https://checkout.stripe.com/c/pay/x" });
    return Response.json({ url: "https://billing.stripe.com/p/session/y" });
  }) as typeof fetch;
  const env = { STRIPE_SECRET_KEY: "sk_test_x" };
  assert.equal(await bezahlSitzung(env, { firma: FIRMA, email: "chef@firma.test", plan: "pro", zahlweise: "monat", basis: "https://crewtender.eu" }, abruf), "https://checkout.stripe.com/c/pay/x");
  assert.match(decodeURIComponent(aufrufe[0].url), /lookup_keys\[\]=crewtender_pro_monat/);
  const body = decodeURIComponent(aufrufe[1].body);
  for (const teil of ["mode=subscription", "line_items[0][price]=price_pro_monat", `client_reference_id=${FIRMA}`, "subscription_data[metadata][plan]=pro", "customer_email=chef@firma.test", "success_url=https://crewtender.eu/konto/plan?bezahlt=1", "tax_id_collection[enabled]=true"]) assert.ok(body.includes(teil), teil);
  assert.equal(await portalSitzung(env, "cus_1", "https://crewtender.eu/konto/plan", abruf), "https://billing.stripe.com/p/session/y");
  await assert.rejects(bezahlSitzung({}, { firma: FIRMA, email: "a@b.c", plan: "pro", zahlweise: "monat", basis: "x" }, abruf), /nicht eingerichtet/);
});

test("Plan-Seite: mit Stripe sofort bezahlen oder per Rechnung, Abo verwalten, Testhinweis", () => {
  const ohne = planSeite("kostenlos", "Muster", true);
  assert.doesNotMatch(ohne, /jetzt bezahlen/);
  const mit = planSeite("kostenlos", "Muster", true, "", { stripe: true, test: true });
  assert.match(mit, /Pro jetzt bezahlen/);
  assert.match(mit, /Per Rechnung bestellen/);
  assert.match(mit, /Testmodus/);
  assert.match(mit, /SEPA-Lastschrift/);
  const abo = planSeite("pro", "Muster", true, "", { stripe: true, abo: { status: "active", bis: "2026-12-07T10:00:00Z", kuendigt: false, zahlweise: "monat", kunde: true } });
  assert.match(abo, /Abo aktiv, monatlich, nächste Abbuchung am 7\.12\.2026/);
  assert.match(abo, /Abo verwalten/);
  assert.match(abo, /Zu Business wechseln/);
  assert.doesNotMatch(abo, /Per Rechnung bestellen/);
  assert.match(planSeite("pro", "M", true, "", { stripe: true, abo: { status: "past_due", bis: null, kuendigt: false, zahlweise: "monat", kunde: true } }), /Zahlung ist fehlgeschlagen/);
  assert.match(planSeite("pro", "M", true, "", { stripe: true, abo: { status: "active", bis: "2026-12-07T10:00:00Z", kuendigt: true, zahlweise: "jahr", kunde: true } }), /Gekündigt, läuft bis 7\.12\.2026/);
});

import { CSP } from "../src/app.ts";
test("Sicherheitsregeln: Formulare dürfen nur zu uns und zu Stripe weiterleiten", () => {
  const fa = CSP.split(";").map((x) => x.trim()).find((x) => x.startsWith("form-action"))!;
  assert.equal(fa, "form-action 'self' https://checkout.stripe.com https://billing.stripe.com");
});

test("Plan-Seite mit Stripe ist übersetzt", () => {
  const abo = (x: object) => ({ status: "active", bis: "2026-12-07T10:00:00Z", kuendigt: false, zahlweise: "monat", kunde: true, ...x });
  const seiten = [planSeite("kostenlos", "M", true, "Zahlung abgebrochen. Es wurde nichts berechnet.", { stripe: true, test: true }),
    planSeite("basis", "M", true, "", { stripe: true, abo: abo({}) }), planSeite("basis", "M", true, "", { stripe: true, abo: abo({ kuendigt: true, zahlweise: "jahr" }) }),
    planSeite("pro", "M", true, "", { stripe: true, abo: abo({ status: "past_due", bis: null }) })].join("");
  const en = uebersetzen(seiten, "en");
  for (const t of ["Pay for Pro now", "Order by invoice", "Manage subscription (cancel, payment method, invoices)", "Subscription active, monthly, next payment on 7.12.2026.", "Cancelled, runs until 7.12.2026. Then Free.", "The last payment failed", "Payment cancelled. Nothing was charged.", "Switch to Business"]) assert.ok(en.includes(t), t);
  for (const de of ["jetzt bezahlen", "Abo verwalten", "Abbuchung", "Gekündigt", "Per Rechnung bestellen"]) assert.ok(!en.includes(de), de);
  for (const s of ["fr", "pl", "es", "it"] as const) assert.ok(!uebersetzen(seiten, s).includes("jetzt bezahlen"), s);
});

test("Bestellbestätigung per Rechnung und Planwechsel sind übersetzt", () => {
  const basis = PLAENE.find((p) => p.id === "basis")!, pro = PLAENE.find((p) => p.id === "pro")!;
  const de = planSeite("kostenlos", "M", true, "", { hinweisHtml: bestellHinweis(basis, true, "chef@firma.example") });
  assert.match(de, /Danke! Deine Bestellung ist bei uns: <strong>Basis<\/strong> \(<span>590 € \/ Jahr<\/span>\)/);
  const en = uebersetzen(de, "en");
  for (const t of ["Thank you! We have received your order:", "€590 / year", "We will activate the plan and send the invoice to", "chef@firma.example"]) assert.ok(en.includes(t), t);
  const fr = uebersetzen(planSeite("pro", "M", true, "", { hinweisHtml: wechselHinweis(pro) }), "fr");
  for (const t of ["Plan modifié :", "La différence est facturée au prorata"]) assert.ok(fr.includes(t), t);
  assert.ok(uebersetzen(bestellHinweis(pro, false, "a@b.example"), "pl").includes("149 € / miesiąc"));
  assert.ok(!bestellHinweis(basis, false, "<x>@y").includes("<x>"), "E-Mail wird maskiert");
});

test("Zusatzkäufe: Einsatzkräfte im Abo, Steckbrief-Paket, Planwechsel", async () => {
  const kraftSub = (status: string, menge: number) => ({ id: "sub_1", status, customer: "cus_1", metadata: { firma: FIRMA }, items: { data: [
    { id: "si_plan", price: { lookup_key: "crewtender_pro_monat" }, current_period_end: 1_800_000_000 },
    { id: "si_kraft", quantity: menge, price: { lookup_key: "crewtender_kraft_pro_monat" } }] } });
  const a = aboAenderung({ id: "evt_k", type: "customer.subscription.updated", data: { object: kraftSub("active", 12) } })!;
  assert.deepEqual([a.paket, a.kraefte], ["pro", 12], "Plan aus dem richtigen Posten, Kräfte gezählt");
  assert.equal(aboAenderung({ id: "evt_k2", type: "customer.subscription.deleted", data: { object: kraftSub("canceled", 12) } })!.kraefte, 0);
  const paket = aboAenderung({ id: "evt_p", type: "checkout.session.completed", data: { object: { mode: "payment", payment_status: "paid", client_reference_id: FIRMA, customer: "cus_1", metadata: { art: "steckbriefe", anzahl: "10" } } } })!;
  assert.deepEqual([paket.steckbriefe, paket.paket, paket.kraefte, paket.firma], [10, null, null, FIRMA]);
  assert.equal(aboAenderung({ id: "evt_p2", type: "checkout.session.completed", data: { object: { mode: "payment", payment_status: "unpaid", metadata: { art: "steckbriefe", anzahl: "10" } } } }), null, "unbezahlt: nichts");

  const aufrufe: { url: string; body: string }[] = [];
  const abruf = (async (url: string, init?: RequestInit) => {
    aufrufe.push({ url, body: decodeURIComponent(String(init?.body ?? "")) });
    if (url.includes("/prices?")) return Response.json({ data: [{ id: `price_${/lookup_keys\[\]=([a-z_0-9]+)/.exec(decodeURIComponent(url))?.[1]}` }] });
    if (url.endsWith("/checkout/sessions")) return Response.json({ url: "https://checkout.stripe.com/c/pay/paket" });
    if (url.includes("/subscriptions/") && !init?.body) return Response.json(kraftSub("active", 3));
    return Response.json({});
  }) as typeof fetch;
  const env = { STRIPE_SECRET_KEY: "sk_test_x" };
  await kraefteSetzen(env, "sub_1", 20, "pro", "monat", abruf);
  assert.ok(aufrufe.at(-1)!.body.includes("items[0][id]=si_kraft") && aufrufe.at(-1)!.body.includes("items[0][quantity]=20"), "Menge geändert");
  await kraefteSetzen(env, "sub_1", 0, "pro", "monat", abruf);
  assert.ok(aufrufe.at(-1)!.body.includes("items[0][deleted]=true"), "0 entfernt den Posten");
  await assert.rejects(kraefteSetzen(env, "sub_1", 5, "basis", "monat", abruf), /Pro und Business/);
  await aboWechseln(env, "sub_1", "basis", "monat", abruf);
  const wechsel = aufrufe.at(-1)!.body;
  assert.ok(wechsel.includes("items[0][id]=si_plan") && wechsel.includes("items[0][price]=price_crewtender_basis_monat") && wechsel.includes("items[1][deleted]=true"), "Basis: Einsatzkräfte enden");
  await aboWechseln(env, "sub_1", "business", "jahr", abruf);
  assert.ok(aufrufe.at(-1)!.body.includes("items[1][price]=price_crewtender_kraft_business_jahr"), "Business jährlich: Kräfte-Preis wechselt mit");
  assert.equal(await paketKaufen(env, { firma: FIRMA, email: "chef@firma.test", basis: "https://crewtender.eu" }, abruf), "https://checkout.stripe.com/c/pay/paket");
  const kauf = aufrufe.at(-1)!.body;
  for (const teil of ["mode=payment", "line_items[0][price]=price_crewtender_steckbriefe_10", "metadata[art]=steckbriefe", "metadata[anzahl]=10", "invoice_creation[enabled]=true", "success_url=https://crewtender.eu/konto/plan?paket=1"]) assert.ok(kauf.includes(teil), teil);
});

test("Plan-Seite: Zusatz nur ab Basis, Einsatzkräfte nur ab Pro", () => {
  const stand = (plan: string) => ({ plan, paket: plan, probe_bis: null, grenzen: {}, zusatz: { einsatzkraefte: 4, steckbrief_guthaben: 3 }, genutzt: { buero: 1, buero_offen: 0, einsatzkraefte: 0, einsatzkraefte_offen: 0, standorte: 1, steckbriefe: 0 } });
  assert.equal(zusatzTeil(stand("kostenlos"), { paket: true, kraefte: true }), "");
  assert.equal(zusatzTeil(stand("probe"), { paket: true, kraefte: true }), "");
  const basis = zusatzTeil(stand("basis"), { paket: true, kraefte: false });
  assert.ok(!basis.includes('value="kraefte"') && basis.includes("Paket kaufen") && basis.includes("Guthaben: 3 Steckbriefe"));
  const business = zusatzTeil(stand("business"), { paket: false, kraefte: false });
  assert.ok(business.includes('value="4"') && business.includes("je 3 € pro Monat (ab der 501. Einsatzkraft 2,50 €)") && business.includes("Per Rechnung bestellen"));
});
