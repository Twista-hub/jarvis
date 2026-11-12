import assert from "node:assert/strict";
import test from "node:test";
import { APP_KAUF_HINWEIS, appStart, inAndroidApp } from "../src/android.ts";
import { planSeite } from "../src/plaene.ts";
import { planBanner, planSperre } from "../src/plangrenzen.ts";
import { preise, preisSeiteInApp } from "../src/preise.ts";

test("Android-App: Start setzt das Sitzungs-Cookie und leitet ohne den Parameter weiter", () => {
  const r = appStart(new Request("https://crewtender.eu/konto?quelle=app&firma=1"))!;
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/konto?firma=1");
  assert.match(r.headers.get("set-cookie")!, /^jv_app=1; Path=\/; Secure; SameSite=Lax$/, "Sitzungs-Cookie ohne Ablaufdatum");
  assert.equal(appStart(new Request("https://crewtender.eu/konto")), null);
  assert.equal(appStart(new Request("https://crewtender.eu/konto?quelle=app", { method: "POST" })), null);
});

test("Android-App: erkannt am Cookie oder am ersten Aufruf aus der App", () => {
  assert.ok(inAndroidApp(new Request("https://crewtender.eu/konto/plan", { headers: { cookie: "jv_land=DE; jv_app=1" } })));
  assert.ok(inAndroidApp(new Request("https://crewtender.eu/konto", { headers: { referer: "android-app://eu.crewtender.app/" } })));
  assert.ok(!inAndroidApp(new Request("https://crewtender.eu/konto/plan", { headers: { cookie: "jv_app=10; x_jv_app=1" } })));
  assert.ok(!inAndroidApp(new Request("https://crewtender.eu/konto/plan")));
});

test("Android-App: Planseite ohne Preise, Bestellung und Zahlung (Zahlungsrichtlinie von Google Play)", () => {
  const app = planSeite("kostenlos", "Muster GmbH", true, "", { stripe: true, app: true });
  assert.ok(app.includes(APP_KAUF_HINWEIS) && app.includes("Dein Plan: <strong>"));
  assert.ok(!/<form|<button|€|Stripe|bezahlen|crewtender\.eu/i.test(app), "kein Kauf, kein Preis, kein Verweis auf eine Zahlung");
  const web = planSeite("kostenlos", "Muster GmbH", true, "", { stripe: true });
  assert.ok(/<form/.test(web) && /€/.test(web), "im Browser unverändert");
});

test("Android-App: Hinweis auf den Plan ohne Knopf zum Wechseln, Preisseite ohne Preise", async () => {
  const app = planBanner("arbeitsoberflaeche", "basis", true);
  assert.ok(app.includes(APP_KAUF_HINWEIS) && app.includes("gehören zum Plan Pro"));
  assert.ok(!/href=|wechseln<\/a>|€/.test(app), "kein Link zu einem Planwechsel");
  assert.ok(planSperre("unterlagen", "kostenlos", true).includes(APP_KAUF_HINWEIS));
  assert.match(planBanner("arbeitsoberflaeche", "basis"), /href="\/konto\/plan">Zu Pro wechseln<\/a>/, "im Browser unverändert");
  assert.ok(!/€|\d{2,3} /.test(preisSeiteInApp()), "keine Preise");
  const env = {} as Parameters<typeof preise>[1];
  const inApp = (await preise(new Request("https://crewtender.eu/preise", { headers: { cookie: "jv_app=1" } }), env))!;
  const text = await inApp.text();
  assert.ok(text.includes(APP_KAUF_HINWEIS) && !/59 €|149 €|399 €/.test(text));
  assert.equal(inApp.headers.get("cache-control"), "private, no-store");
  const web = await (await preise(new Request("https://crewtender.eu/preise"), env))!.text();
  assert.ok(/59 €/.test(web) && /149 €/.test(web), "im Browser weiter mit Preisen");
});
