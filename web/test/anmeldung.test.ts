import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { anmeldung, registrierFormular, registrierungPruefen } from "../src/anmeldung.ts";
import { websiteNormalisieren } from "../src/webseite.ts";

const env = { SUPABASE_URL: "https://sb.test", SUPABASE_KEY: "pk" };
const token = `h.${btoa(JSON.stringify({ sub: "u1", email: "neu@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;

function mockAuth(t: TestContext, antwort: (pfad: string, body: any) => [number, unknown]) {
  const aufrufe: { pfad: string; body: any }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    aufrufe.push({ pfad: u.pathname + u.search, body });
    const [status, daten] = antwort(u.pathname, body);
    return new Response(JSON.stringify(daten), { status, headers: { "content-type": "application/json" } });
  });
  return aufrufe;
}

const formular = (pfad: string, felder: Record<string, string>) =>
  new Request(`https://jarvis.test${pfad}`, { method: "POST", body: new URLSearchParams(felder) });

test("registration needs name, firm, address, e-mail, password and consent", () => {
  const w = { vorname: "Eva", nachname: "Muster", firma: "Muster GmbH", strasse: "Weg 1", plz: "52531", ort: "Übach", email: "eva@muster.de" };
  assert.equal(registrierungPruefen(w, "geheim123", true, false), "");
  assert.match(registrierungPruefen({ ...w, website: "javascript:alert(1)" }, "geheim123", true, false), /Website-Adresse/);
  assert.match(registrierungPruefen({ ...w, plz: "123" }, "geheim123", true, false), /Postleitzahl/);
  assert.match(registrierungPruefen(w, "kurz", true, false), /8 Zeichen/);
  assert.match(registrierungPruefen(w, "geheim123", false, false), /zustimmen/);
  assert.equal(registrierungPruefen({ vorname: "Eva", nachname: "Muster", email: "eva@muster.de" }, "geheim123", true, true), "", "invited people need no firm");
});

test("invited people see no firm fields", () => {
  assert.match(registrierFormular({}, "", "/konto"), /name="firma"/);
  assert.match(registrierFormular({}, "", "/konto"), /name="website"/);
  assert.doesNotMatch(registrierFormular({}, "", "/einladung?token=abc"), /name="firma"/);
  assert.doesNotMatch(registrierFormular({}, "", "/einladung?token=abc"), /name="website"/);
});

test("Anmeldung erklärt automatische Website-Auswertung nach E-Mail-Bestätigung", () => {
  const html = registrierFormular({}, "", "/konto");
  assert.match(html, /Nach der E-Mail-Bestätigung startet die Firmenprüfung automatisch/);
  assert.match(html, /passendere Ausschreibungen/);
});

test("Firmenwebsite wird für bessere Ergebnisse empfohlen, bleibt aber optional", () => {
  const html = registrierFormular({}, "", "/konto");
  assert.match(html, /für bessere Ergebnisse empfohlen/);
  assert.match(html, /Leistungen und Standorte genauer/);
  assert.match(html, /Ohne Website ist die Registrierung auch möglich/);
  assert.doesNotMatch(html, /name="website"[^>]*required/);
});

test("company website is normalized and restricted to HTTPS addresses", () => {
  assert.equal(websiteNormalisieren("www.muster.de"), "https://www.muster.de");
  assert.equal(websiteNormalisieren("http://muster.de/leistungen#team"), "https://muster.de/leistungen");
  assert.equal(websiteNormalisieren("https://user:pass@muster.de"), "");
  assert.equal(websiteNormalisieren("javascript:alert(1)"), "");
});

test("sign-up sends the firm data and no PKCE challenge, so the mail link works in any browser", async (t) => {
  const aufrufe = mockAuth(t, () => [200, { id: "u1" }]);
  const r = await anmeldung(formular("/registrieren", { vorname: "Eva", nachname: "Muster", firma: "Muster GmbH", website: "www.muster.de", strasse: "Weg 1", plz: "52531", ort: "Übach", email: "Eva@Muster.de", passwort: "geheim123", zustimmung: "ja", weiter: "/konto" }), env);
  assert.equal(r?.status, 200);
  assert.match(await r!.text(), /Fast geschafft/);
  const signup = aufrufe.find((a) => a.pfad.startsWith("/auth/v1/signup"))!;
  assert.equal(signup.body.email, "eva@muster.de");
  assert.equal(signup.body.data.firma, "Muster GmbH");
  assert.equal(signup.body.data.website, "https://www.muster.de");
  assert.equal(signup.body.code_challenge, undefined);
  assert.match(decodeURIComponent(decodeURIComponent(signup.pfad)), /redirect_to=https:\/\/jarvis\.test\/anmelden\/fertig\?weiter=\/konto/);
});

test("login with password sets the session cookies", async (t) => {
  mockAuth(t, () => [200, { access_token: token, refresh_token: "r1", expires_in: 3600 }]);
  const r = await anmeldung(formular("/anmelden", { email: "neu@example.de", passwort: "geheim123", weiter: "/konto/treffer" }), env);
  assert.equal(r?.status, 303);
  assert.equal(r!.headers.get("location"), "/konto/treffer");
  assert.match(r!.headers.getSetCookie().join(";"), /jv_at=/);
});

test("unconfirmed e-mail gets a clear hint", async (t) => {
  mockAuth(t, () => [400, { error_code: "email_not_confirmed" }]);
  const r = await anmeldung(formular("/anmelden", { email: "neu@example.de", passwort: "geheim123" }), env);
  assert.match(await r!.text(), /bestätige zuerst/);
});

test("mail link: tokens from the fragment become cookies, but only from our own page", async (t) => {
  mockAuth(t, () => [200, { id: "u1" }]);
  const body = JSON.stringify({ access_token: token, refresh_token: "r1", expires_in: 3600, typ: "magiclink", weiter: "/konto" });
  const fremd = await anmeldung(new Request("https://jarvis.test/anmelden/sitzung", { method: "POST", headers: { origin: "https://boese.test", "content-type": "application/json" }, body }), env);
  assert.equal(fremd?.status, 403);
  const r = await anmeldung(new Request("https://jarvis.test/anmelden/sitzung", { method: "POST", headers: { origin: "https://jarvis.test", "content-type": "application/json" }, body }), env);
  assert.equal(r?.status, 200);
  assert.deepEqual(await r!.json(), { weiter: "/konto" });
  assert.match(r!.headers.getSetCookie().join(";"), /jv_rt=r1/);
  const neu = await anmeldung(new Request("https://jarvis.test/anmelden/sitzung", { method: "POST", headers: { origin: "https://jarvis.test", "content-type": "application/json" }, body: body.replace("magiclink", "recovery") }), env);
  assert.deepEqual(await neu!.json(), { weiter: "/konto/passwort" });
});

test("landing page of the mail link hands over to app.js", async () => {
  const r = await anmeldung(new Request("https://jarvis.test/anmelden/fertig?weiter=/konto"), env);
  const text = await r!.text();
  assert.match(text, /id="anmeldung" data-weiter="\/konto"/);
  assert.match(text, /id="anmeldung-fehler" hidden/);
});

test("magic link request uses the implicit flow", async (t) => {
  const aufrufe = mockAuth(t, () => [200, {}]);
  await anmeldung(formular("/anmelden/link", { email: "neu@example.de", weiter: "/konto" }), env);
  assert.equal(aufrufe[0].body.code_challenge, undefined);
  assert.equal(aufrufe[0].body.create_user, true);
});
