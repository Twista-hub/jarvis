import assert from "node:assert/strict";
import { test } from "node:test";
import { aboAenderung, bezahlSitzung, formular, portalSitzung, signaturGueltig, stripeSichtbar } from "../src/stripe.ts";
import { planSeite } from "../src/plaene.ts";
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
