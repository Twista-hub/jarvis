import test from "node:test";
import assert from "node:assert/strict";
import { darfZaehlen, quelleVon, zaehlung } from "../src/zaehler.ts";

const seite = () => new Response("<p>x</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
const anfrage = (url: string, kopf: Record<string, string> = {}) => new Request(url, { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Safari/604.1", ...kopf } });

test("Zähler: Quelle aus verweisender Seite oder utm_source", () => {
  assert.deepEqual(quelleVon("chatgpt.com"), { kanal: "ki", quelle: "chatgpt" });
  assert.deepEqual(quelleVon("www.perplexity.ai"), { kanal: "ki", quelle: "perplexity" });
  assert.deepEqual(quelleVon("gemini.google.com"), { kanal: "ki", quelle: "gemini" });
  assert.deepEqual(quelleVon("www.google.de"), { kanal: "suche", quelle: "google" });
  assert.deepEqual(quelleVon("google.co.uk"), { kanal: "suche", quelle: "google" });
  assert.deepEqual(quelleVon("m.facebook.com"), { kanal: "social", quelle: "facebook" });
  assert.deepEqual(quelleVon("instagram"), { kanal: "social", quelle: "instagram" });
  assert.deepEqual(quelleVon("capterra", "verzeichnis"), { kanal: "verzeichnis", quelle: "capterra" });
  assert.deepEqual(quelleVon("Handwerker-Forum.de"), { kanal: "sonstige", quelle: "handwerker-forum.de" });
  assert.equal(quelleVon("  "), null);
});

test("Zähler: nur Ankünfte von außen auf öffentlichen Seiten", () => {
  assert.deepEqual(zaehlung(anfrage("https://crewtender.eu/ausschreibungen/elektro", { referer: "https://chatgpt.com/" }), seite()), { kanal: "ki", quelle: "chatgpt" });
  assert.deepEqual(zaehlung(anfrage("https://crewtender.eu/?utm_source=chatgpt.com"), seite()), { kanal: "ki", quelle: "chatgpt" });
  assert.deepEqual(zaehlung(anfrage("https://crewtender.eu/?utm_source=g2&utm_medium=verzeichnis"), seite()), { kanal: "verzeichnis", quelle: "g2" });
  assert.equal(zaehlung(anfrage("https://crewtender.eu/preise"), seite()), null, "ohne Verweis nichts");
  assert.equal(zaehlung(anfrage("https://crewtender.eu/preise", { referer: "https://www.crewtender.eu/" }), seite()), null, "eigene Seite");
  assert.equal(zaehlung(anfrage("https://crewtender.eu/preise?h=google~~~", { referer: "https://www.google.de/" }), seite()), null, "Klick innerhalb der Seite wurde schon gezählt");
  assert.equal(zaehlung(anfrage("https://crewtender.eu/konto", { referer: "https://www.google.de/" }), seite()), null, "Kundenbereich");
  assert.equal(zaehlung(anfrage("https://crewtender.eu/sprache?zu=en", { referer: "https://www.google.de/" }), seite()), null);
  assert.equal(zaehlung(anfrage("https://crewtender.eu/", { referer: "https://www.google.de/" }), new Response("", { status: 404, headers: { "content-type": "text/html" } })), null, "nur ausgelieferte Seiten");
  assert.equal(zaehlung(anfrage("https://crewtender.eu/robots.txt", { referer: "https://www.google.de/" }), seite()), null);
  assert.equal(zaehlung(anfrage("https://crewtender.eu/", { referer: "https://www.google.de/", "sec-purpose": "prefetch" }), seite()), null);
});

test("Zähler: Suchroboter zählen nicht, Abrufe für einen Menschen schon", () => {
  const von = (ua: string) => zaehlung(anfrage("https://crewtender.eu/ausschreibungen/elektro", { "user-agent": ua, referer: "https://www.google.de/" }), seite());
  assert.equal(von("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)"), null);
  assert.equal(von("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), null);
  assert.equal(von("curl/8.5.0"), null);
  assert.equal(von("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0 Safari/537.36"), null);
  assert.deepEqual(von("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"), { kanal: "ki-abruf", quelle: "chatgpt" });
  assert.deepEqual(von("Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)"), { kanal: "ki-abruf", quelle: "perplexity" });
});

test("Zähler: höchstens 30 Datenbankaufrufe je Minute", () => {
  const t = 1_800_000_000_000;
  let erlaubt = 0;
  for (let i = 0; i < 100; i++) if (darfZaehlen(t + i)) erlaubt++;
  assert.equal(erlaubt, 30);
  assert.equal(darfZaehlen(t + 61_000), true, "nächste Minute wieder frei");
});

test("Zähler: Vorschau-Abrufe von Mastodon- und Bluesky-Servern sind keine Besuche", () => {
  const mit = (ua: string) => zaehlung(new Request("https://crewtender.eu/?utm_source=mastodon&utm_medium=social", { headers: { "user-agent": ua } }), seite());
  assert.equal(mit("http.rb/5.2.0 (Mastodon/4.3.1; +https://mastodon.social/)"), null);
  assert.equal(mit("Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)"), null);
  assert.deepEqual(mit("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36"), { kanal: "social", quelle: "mastodon" });
});
