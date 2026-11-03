import assert from "node:assert/strict";
import { test } from "node:test";
import { kontakt, kontaktMail, kontaktPruefen, KONTAKT_TAGESLIMIT } from "../src/kontakt.ts";
import { impressum, datenschutz } from "../src/rechtliches.ts";

const r2 = () => {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => (m.has(k) ? { text: async () => m.get(k)! } : null), put: async (k: string, v: string) => { m.set(k, v); } } as never as R2Bucket & { m: Map<string, string> };
};
const post = (felder: Record<string, string>) => new Request("https://jarvis.test/kontakt", { method: "POST", body: new URLSearchParams(felder) });
const seite = (t: string, i: string) => `<h1>${t}</h1>${i}`;

test("contact form: validation, header-safe mail to our own mailbox", () => {
  const w = { name: "Eva Muster", email: "eva@muster.de", nachricht: "Frage zum Preis für 50 Mitarbeiter." };
  assert.equal(kontaktPruefen(w), "");
  assert.match(kontaktPruefen({ ...w, email: "keine" }), /E-Mail/);
  assert.match(kontaktPruefen({ ...w, nachricht: "kurz" }), /mindestens/);
  const m = kontaktMail({ ...w, name: "Eva\r\nBcc: x@y.de" });
  assert.equal(m.to, "kontakt@wpdigitalranger.com");
  assert.equal(m.reply.email, "eva@muster.de");
  assert.ok(!/[\r\n]/.test(m.subject) && !/[\r\n]/.test(m.reply.name));
});

test("contact form: honeypot, no SMTP fallback, daily limit; linked from imprint and privacy policy", async () => {
  const env = { DATEN: r2() };
  assert.equal(await kontakt(new Request("https://jarvis.test/konto"), env, seite), null);
  assert.match(await (await kontakt(new Request("https://jarvis.test/kontakt"), env, seite))!.text(), /Nachricht senden/);
  const gut = { name: "Eva", email: "eva@muster.de", nachricht: "Bitte um Rückruf wegen Angebot." };
  const bot = await kontakt(post({ ...gut, webseite: "http://spam" }), env, seite);
  assert.equal(bot!.status, 200);
  assert.equal(env.DATEN.m.size, 0, "bots are not counted and nothing is sent");
  const ohne = await kontakt(post(gut), env, seite);
  assert.equal(ohne!.status, 503, "without SMTP the visitor gets the e-mail address");
  assert.match(await ohne!.text(), /kontakt@wpdigitalranger\.com/);
  env.DATEN.m.set(`kontakt/zaehler/${new Date().toISOString().slice(0, 10)}`, String(KONTAKT_TAGESLIMIT));
  assert.equal((await kontakt(post(gut), env, seite))!.status, 429);
  assert.match(impressum(), /href="\/kontakt"/);
  assert.match(datenschutz(), /Kontaktformular/);
});
