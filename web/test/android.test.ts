import assert from "node:assert/strict";
import test from "node:test";
import { APP_KAUF_HINWEIS, appStart, inAndroidApp } from "../src/android.ts";
import { planSeite } from "../src/plaene.ts";

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
