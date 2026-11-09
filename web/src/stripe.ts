// Automatic subscriptions with Stripe (Benjamin 07.11.2026). Checkout for a plan, customer portal (cancel, card change,
// invoices) and the webhook that sets the firm's plan. Products and prices are created by the workflow
// "Stripe einrichten" with lookup keys crewtender_<plan>_<monat|jahr>; the webhook secret is set there as well.
// In test mode (sk_test_) only the operator sees the Stripe buttons, so customers never land in a test checkout.
import { katalogDb, type DbEnv } from "./katalog-db.ts";

export type StripeEnv = DbEnv & { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string };
export const BEZAHLPLAENE = ["basis", "pro", "business"] as const;
export type Zahlweise = "monat" | "jahr";

// Live with a secret key (sk_live_) or a restricted key (rk_live_, "full access except sensitive operations").
export const stripeLive = (env: StripeEnv) => /^[sr]k_live_/.test(env.STRIPE_SECRET_KEY ?? "");
/** Stripe buttons: always in live mode, in test mode only for the operator. */
export const stripeSichtbar = (env: StripeEnv, betreiber: boolean) => !!env.STRIPE_SECRET_KEY && (stripeLive(env) || betreiber);
export const preisSchluessel = (plan: string, zahlweise: Zahlweise) => `crewtender_${plan}_${zahlweise}`;
/** Add-ons (07.11.2026): further field workers on the subscription (Pro and Business), Steckbrief pack one-off. */
export const kraftSchluessel = (plan: string, zahlweise: Zahlweise) => `crewtender_kraft_${plan}_${zahlweise}`;
export const PAKET_SCHLUESSEL = "crewtender_steckbriefe_10";
export const PAKET_ANZAHL = 10;
export const MIT_KRAEFTEN = ["pro", "business"];

/** application/x-www-form-urlencoded with Stripe's bracket notation for nested objects and arrays. */
export function formular(daten: Record<string, unknown>, praefix = ""): string {
  const teile: string[] = [];
  for (const [k, v] of Object.entries(daten)) {
    if (v === undefined || v === null) continue;
    const name = praefix ? `${praefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => teile.push(typeof x === "object" ? formular(x as Record<string, unknown>, `${name}[${i}]`) : `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(x))}`));
    else if (typeof v === "object") teile.push(formular(v as Record<string, unknown>, name));
    else teile.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  }
  return teile.filter(Boolean).join("&");
}

async function stripe<T>(env: StripeEnv, pfad: string, daten?: Record<string, unknown>, abruf: typeof fetch = fetch): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe ist nicht eingerichtet");
  const r = await abruf(`https://api.stripe.com/v1/${pfad}`, {
    method: daten ? "POST" : "GET",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(daten ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: daten ? formular(daten) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${json.error?.message ?? "Fehler"}`);
  return json;
}

async function preisId(env: StripeEnv, plan: string, zahlweise: Zahlweise, abruf?: typeof fetch, schluessel = preisSchluessel(plan, zahlweise)): Promise<string> {
  const r = await stripe<{ data: { id: string }[] }>(env, `prices?active=true&lookup_keys[]=${encodeURIComponent(schluessel)}`, undefined, abruf);
  if (!r.data[0]) throw new Error("Preis bei Stripe nicht gefunden");
  return r.data[0].id;
}

/** Checkout page for a new subscription. Returns the Stripe URL to redirect to. */
export async function bezahlSitzung(env: StripeEnv, o: { firma: string; email: string; plan: string; zahlweise: Zahlweise; kunde?: string | null; basis: string }, abruf?: typeof fetch): Promise<string> {
  const preis = await preisId(env, o.plan, o.zahlweise, abruf);
  const meta = { firma: o.firma, plan: o.plan, zahlweise: o.zahlweise };
  const s = await stripe<{ url: string }>(env, "checkout/sessions", {
    mode: "subscription", line_items: [{ price: preis, quantity: 1 }], client_reference_id: o.firma, metadata: meta,
    subscription_data: { metadata: meta }, ...(o.kunde ? { customer: o.kunde, customer_update: { address: "auto", name: "auto" } } : { customer_email: o.email }),
    billing_address_collection: "required", tax_id_collection: { enabled: true }, locale: "auto",
    success_url: `${o.basis}/konto/plan?bezahlt=1`, cancel_url: `${o.basis}/konto/plan?abgebrochen=1`,
  }, abruf);
  return s.url;
}

type AboPosten = { id: string; quantity?: number; price?: { lookup_key?: string | null } };
const aboLaden = (env: StripeEnv, abo: string, abruf?: typeof fetch) =>
  stripe<{ items: { data: AboPosten[] }; cancel_at?: number | null; cancel_at_period_end?: boolean }>(env, `subscriptions/${encodeURIComponent(abo)}`, undefined, abruf);
const istKraft = (p: AboPosten) => /^crewtender_kraft_/.test(p.price?.lookup_key ?? "");

/** Plan change of an existing subscription (prorated). Booked field workers move to the new plan's price, or end when
 *  the new plan has none (Basis). The webhook then sets the new plan. */
export async function aboWechseln(env: StripeEnv, abo: string, plan: string, zahlweise: Zahlweise, abruf?: typeof fetch): Promise<void> {
  const preis = await preisId(env, plan, zahlweise, abruf);
  const sub = await aboLaden(env, abo, abruf);
  const planPosten = sub.items.data.find((p) => ausSchluessel(p.price?.lookup_key)) ?? sub.items.data[0];
  const kraefte = sub.items.data.filter(istKraft);
  const kraftPreis = kraefte.length && MIT_KRAEFTEN.includes(plan) ? await preisId(env, plan, zahlweise, abruf, kraftSchluessel(plan, zahlweise)) : "";
  await stripe(env, `subscriptions/${encodeURIComponent(abo)}`, {
    items: [{ id: planPosten.id, price: preis }, ...kraefte.map((k) => (kraftPreis ? { id: k.id, price: kraftPreis } : { id: k.id, deleted: true }))],
    // Choosing a plan continues the subscription, also after a cancellation in the portal. Stripe takes only one of the
    // two fields: cancel_at_period_end (older way) or cancel_at ("" = unset, the portal's way since 2025).
    proration_behavior: "create_prorations", ...(sub.cancel_at_period_end ? { cancel_at_period_end: false } : sub.cancel_at ? { cancel_at: "" } : {}), metadata: { plan, zahlweise },
  }, abruf);
}

/** Sets the number of further field workers on the subscription (0 removes them; prorated). */
export async function kraefteSetzen(env: StripeEnv, abo: string, anzahl: number, plan: string, zahlweise: Zahlweise, abruf?: typeof fetch): Promise<void> {
  if (!MIT_KRAEFTEN.includes(plan)) throw new Error("Weitere Einsatzkräfte gibt es in Pro und Business");
  const sub = await aboLaden(env, abo, abruf);
  const da = sub.items.data.find(istKraft);
  if (!anzahl && !da) return;
  const preis = await preisId(env, plan, zahlweise, abruf, kraftSchluessel(plan, zahlweise));
  const posten = !anzahl ? { id: da!.id, deleted: true } : da ? { id: da.id, price: preis, quantity: anzahl } : { price: preis, quantity: anzahl };
  await stripe(env, `subscriptions/${encodeURIComponent(abo)}`, { items: [posten], proration_behavior: "create_prorations" }, abruf);
}

/** Checkout for a Steckbrief pack (one-off payment with invoice). The webhook adds the credit. */
export async function paketKaufen(env: StripeEnv, o: { firma: string; email: string; kunde?: string | null; basis: string }, abruf?: typeof fetch): Promise<string> {
  const preis = await preisId(env, "", "monat", abruf, PAKET_SCHLUESSEL);
  const meta = { firma: o.firma, art: "steckbriefe", anzahl: PAKET_ANZAHL };
  const s = await stripe<{ url: string }>(env, "checkout/sessions", {
    mode: "payment", line_items: [{ price: preis, quantity: 1 }], client_reference_id: o.firma, metadata: meta,
    invoice_creation: { enabled: true, invoice_data: { metadata: meta } },
    ...(o.kunde ? { customer: o.kunde, customer_update: { address: "auto", name: "auto" } } : { customer_email: o.email, customer_creation: "always" }),
    billing_address_collection: "required", tax_id_collection: { enabled: true }, locale: "auto",
    success_url: `${o.basis}/konto/plan?paket=1`, cancel_url: `${o.basis}/konto/plan?abgebrochen=1`,
  }, abruf);
  return s.url;
}

/** Customer portal: cancel, change card or bank account, download invoices. */
export async function portalSitzung(env: StripeEnv, kunde: string, zurueck: string, abruf?: typeof fetch): Promise<string> {
  return (await stripe<{ url: string }>(env, "billing_portal/sessions", { customer: kunde, return_url: zurueck }, abruf)).url;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
/** Stripe-Signature check (HMAC-SHA256 over "t.body", 5 minutes tolerance). */
export async function signaturGueltig(body: string, kopf: string, geheim: string, jetzt = Date.now()): Promise<boolean> {
  const teile = Object.fromEntries(kopf.split(",").map((x) => x.split("=", 2) as [string, string]).filter((x) => x.length === 2));
  const t = Number(teile.t);
  const signaturen = kopf.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !signaturen.length || Math.abs(jetzt / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(geheim), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const soll = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return signaturen.some((s) => s.length === soll.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ soll.charCodeAt(i)), 0) === 0);
}

export type AboAenderung = { ereignis: string; typ: string; firma: string | null; paket: string | null; kunde: string | null; abo: string | null; status: string | null; bis: string | null; zahlweise: Zahlweise | null; kuendigt: boolean | null; kraefte?: number | null; steckbriefe?: number | null };
const AKTIV = new Set(["active", "trialing", "past_due"]);
const ausSchluessel = (k?: string | null): { plan: string; zahlweise: Zahlweise } | null => {
  const m = k?.match(/^crewtender_(basis|pro|business)_(monat|jahr)$/);
  return m ? { plan: m[1], zahlweise: m[2] as Zahlweise } : null;
};
const zeit = (s?: number | null) => (typeof s === "number" && s > 0 ? new Date(s * 1000).toISOString() : null);
const uuid = (x: unknown) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);

/** What a Stripe event means for the firm; null for events Crewtender ignores. */
export function aboAenderung(e: { id: string; type: string; data: { object: any } }): AboAenderung | null {
  const o = e.data?.object ?? {};
  // Steckbrief pack paid (one-off checkout): only the credit changes.
  if (e.type === "checkout.session.completed" && o.mode === "payment" && o.metadata?.art === "steckbriefe" && o.payment_status === "paid") {
    const anzahl = Math.min(1000, Math.max(0, Math.floor(Number(o.metadata?.anzahl) || 0)));
    return { ereignis: e.id, typ: e.type, firma: uuid(o.client_reference_id ?? o.metadata?.firma), paket: null, kunde: o.customer ?? null, abo: null,
      status: null, bis: null, zahlweise: null, kuendigt: null, kraefte: null, steckbriefe: anzahl };
  }
  if (e.type === "checkout.session.completed" && o.mode === "subscription") {
    const plan = BEZAHLPLAENE.includes(o.metadata?.plan) ? o.metadata.plan : null;
    return { ereignis: e.id, typ: e.type, firma: uuid(o.client_reference_id ?? o.metadata?.firma), paket: plan, kunde: o.customer ?? null, abo: o.subscription ?? null,
      status: "active", bis: null, zahlweise: o.metadata?.zahlweise === "jahr" ? "jahr" : o.metadata?.zahlweise === "monat" ? "monat" : null, kuendigt: false };
  }
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(e.type)) {
    const posten: AboPosten[] = o.items?.data ?? [];
    const item: any = posten.find((p) => ausSchluessel(p.price?.lookup_key)) ?? posten[0];
    const k = ausSchluessel(item?.price?.lookup_key);
    const kraefte = posten.filter(istKraft).reduce((n, p) => n + Math.max(0, Number(p.quantity) || 0), 0);
    const status = e.type === "customer.subscription.deleted" ? "canceled" : String(o.status ?? "");
    const aktiv = AKTIV.has(status);
    return { ereignis: e.id, typ: e.type, firma: uuid(o.metadata?.firma), paket: aktiv ? (k?.plan ?? null) : "kostenlos", kunde: o.customer ?? null, abo: o.id ?? null,
      // The customer portal (API 2025+) cancels with cancel_at = period end instead of cancel_at_period_end.
      status, bis: zeit(o.cancel_at) ?? zeit(item?.current_period_end ?? o.current_period_end), zahlweise: k?.zahlweise ?? null, kuendigt: !!o.cancel_at_period_end || !!zeit(o.cancel_at),
      kraefte: aktiv ? kraefte : 0, steckbriefe: null };
  }
  return null;
}

export type Zahlung = { ereignis: string; rechnung: string; kunde: string | null; firma: string | null; betrag_cent: number; gezahlt: string };
/** Paid invoice (subscription or Steckbrief pack) for the referral commission; null for everything else. */
export function zahlungAusEreignis(e: { id: string; type: string; data: { object: any } }): Zahlung | null {
  if (e.type !== "invoice.paid") return null;
  const o = e.data?.object ?? {};
  if (typeof o.id !== "string" || !/^in_[A-Za-z0-9]{6,80}$/.test(o.id) || String(o.currency ?? "eur").toLowerCase() !== "eur") return null;
  const meta = o.parent?.subscription_details?.metadata ?? o.subscription_details?.metadata ?? o.metadata ?? {};
  const betrag = Math.max(0, Math.floor(Number(o.amount_paid) || 0));
  return { ereignis: e.id, rechnung: o.id, kunde: typeof o.customer === "string" ? o.customer : null, firma: uuid(meta.firma), betrag_cent: betrag,
    gezahlt: zeit(o.status_transitions?.paid_at) ?? zeit(o.created) ?? new Date().toISOString() };
}

export type Erstattung = { ereignis: string; zahlung: string; rechnung: string | null; kunde: string | null; erstattet_cent: number; zeit: string | null };
/** Refunded charge (charge.refunded, amount_refunded is cumulative) or chargeback (charge.dispute.funds_withdrawn, the
 *  charge is fetched for customer and invoice): the referral commission of that payment is cancelled (09.11.2026). */
export function erstattungAusCharge(ereignis: string, c: any, betrag?: number): Erstattung | null {
  if (!c || typeof c.id !== "string" || !/^(ch|py)_[A-Za-z0-9]{6,80}$/.test(c.id) || String(c.currency ?? "eur").toLowerCase() !== "eur") return null;
  const cent = Math.max(0, Math.floor(Number(betrag ?? c.amount_refunded) || 0));
  if (!cent) return null;
  const rechnung = typeof c.invoice === "string" && /^in_[A-Za-z0-9]{6,80}$/.test(c.invoice) ? c.invoice : typeof c.invoice?.id === "string" ? c.invoice.id : null;
  return { ereignis, zahlung: c.id, rechnung, kunde: typeof c.customer === "string" ? c.customer : null, erstattet_cent: cent, zeit: zeit(c.created) };
}

/** POST /stripe/webhook */
export async function stripeWebhook(request: Request, env: StripeEnv): Promise<Response> {
  const body = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET || !(await signaturGueltig(body, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET))) return new Response("Signatur ungültig", { status: 400 });
  let e: { id: string; type: string; data: { object: unknown } };
  try { e = JSON.parse(body); } catch { return new Response("kein JSON", { status: 400 }); }
  if (e.type === "charge.refunded" || e.type === "charge.dispute.funds_withdrawn") {
    const o = (e.data?.object ?? {}) as any;
    let r: Erstattung | null = null;
    if (e.type === "charge.refunded") r = erstattungAusCharge(e.id, o);
    else if (typeof o.charge === "string") {
      // The dispute carries only the charge id; customer and creation time come from the charge (read-only request).
      const c = await stripe<any>(env, `charges/${encodeURIComponent(o.charge)}`).catch(() => null);
      // Cumulative like amount_refunded: earlier refunds of the same charge plus the disputed amount.
      r = erstattungAusCharge(e.id, c, (Number(o.amount) || 0) + (Number(c?.amount_refunded) || 0));
    }
    if (r) await katalogDb(env, (sql) => sql`select jarvis_intern.erstattung_erfasst(${r!.ereignis}, ${r!.zahlung}, ${r!.rechnung}, ${r!.kunde}, ${r!.erstattet_cent}::int, ${r!.zeit}::timestamptz)`);
    return Response.json({ ok: true });
  }
  const z = zahlungAusEreignis(e as never);
  if (z) {
    await katalogDb(env, (sql) => sql`select jarvis_intern.zahlung_erfasst(${z.ereignis}, ${z.rechnung}, ${z.kunde}, ${z.firma}::uuid, ${z.betrag_cent}::int, ${z.gezahlt}::timestamptz)`);
    return Response.json({ ok: true });
  }
  const a = aboAenderung(e as never);
  if (!a) return Response.json({ ok: true, ignoriert: e.type });
  await katalogDb(env, (sql) => sql`select jarvis_intern.stripe_ereignis(${a.ereignis}, ${a.typ}, ${a.firma}::uuid, ${a.paket}, ${a.kunde}, ${a.abo}, ${a.status}, ${a.bis}::timestamptz, ${a.zahlweise}, ${a.kuendigt}, ${a.kraefte ?? null}::int, ${a.steckbriefe ?? null}::int)`);
  return Response.json({ ok: true });
}
