import test from "node:test";
import assert from "node:assert/strict";
import { besucher, landesSeite, startLaender, wahlCookies } from "../src/besucher.ts";

const anfrage = (land: string, cookie = "", sprache = "") => {
  const r = new Request("https://x/", { headers: { "cf-ipcountry": land, cookie, "accept-language": sprache } });
  return r;
};

test("Besucher: Englisch ist der Standard, Browsersprache vor IP, Cookie und Adresse gehen vor", () => {
  assert.deepEqual(besucher(anfrage("US")), { land: "US", iso3: "USA", sprache: "en", explizit: false });
  assert.equal(besucher(anfrage("ES")).sprache, "en", "ohne Browsersprache Englisch, auch in Spanien");
  assert.equal(besucher(anfrage("ES", "", "es-ES,es;q=0.9")).sprache, "es");
  assert.equal(besucher(anfrage("DE", "", "de-DE,de;q=0.9,en;q=0.8")).sprache, "de");
  assert.equal(besucher(anfrage("DE", "", "en-GB")).sprache, "en");
  assert.equal(besucher(anfrage("SE", "", "sv-SE")).sprache, "en", "Sprache, die wir nicht anbieten: Englisch");
  assert.equal(besucher(anfrage("BE", "", "nl-BE,nl;q=0.9")).sprache, "nl");
  assert.equal(besucher(anfrage("JP", "", "ja,en;q=0.5")).iso3, null);
  assert.equal(besucher(anfrage("JP", "", "ja,en;q=0.5")).sprache, "en");
  // Own choice: address /xx or cookie → language of that country as before.
  assert.equal(besucher(anfrage("US"), "fr").sprache, "fr");
  assert.equal(besucher(anfrage("US"), "at").sprache, "de");
  assert.equal(besucher(anfrage("US", "", "fr-CH"), "ch").sprache, "fr");
  assert.equal(besucher(anfrage("US", "jv_land=DE")).land, "DE");
  assert.equal(besucher(anfrage("US", "jv_land=DE")).sprache, "de");
  assert.equal(besucher(anfrage("US", "jv_land=DE")).explizit, true);
  assert.equal(besucher(anfrage("US", "jv_psprache=es")).sprache, "es");
  assert.equal(besucher(anfrage("US"), "fr").land, "FR");
  assert.equal(besucher(anfrage("")).land, "DE");
  assert.deepEqual(startLaender(anfrage("US")), ["USA"]);
  assert.deepEqual(startLaender(anfrage("JP")), ["DEU"]);
  assert.equal(wahlCookies("us", "xx").length, 1);
  assert.equal(wahlCookies("zz", "en").length, 1);
});

test("Startseite ohne eigene Wahl: international auf Englisch, Link zur Landesseite, kanonisch /", () => {
  const welt = landesSeite(besucher(anfrage("FR")), "https://a", "");
  assert.match(welt.inhalt, /across Europe and in the United States/);
  assert.match(welt.inhalt, /<a href="\/fr" hreflang="fr" lang="fr">🇫🇷 France →<\/a>/);
  assert.match(welt.kopf, /canonical" href="https:\/\/a\/"/);
  const bot = landesSeite(besucher(anfrage("US")), "https://a", "");
  assert.doesNotMatch(bot.inhalt, /SAM\.gov registration|set-asides/, "keine US-Texte auf der internationalen Seite");
  assert.match(bot.inhalt, /🇺🇸/);
  const de = landesSeite(besucher(anfrage("DE", "", "de-DE")), "https://a", "");
  assert.doesNotMatch(de.inhalt, /class="hinweis"><a href="\/de"/, "gleiche Sprache: kein Hinweis");
  assert.match(landesSeite(besucher(anfrage("US"), "us"), "https://a", "").kopf, /canonical" href="https:\/\/a\/us"/);
});

test("Landesseite: Sprache, Land, Quelle, kein Behörden-Eindruck, hreflang", () => {
  const us = landesSeite({ land: "US", iso3: "USA", sprache: "en" }, "https://a", "");
  assert.match(us.inhalt, /public tenders in the United States/);
  assert.match(us.inhalt, /SAM\.gov/);
  assert.match(us.inhalt, /set-asides/);
  assert.match(us.inhalt, /not a government agency/);
  assert.match(us.kopf, /canonical" href="https:\/\/a\/us"/);
  assert.match(us.kopf, /hreflang="es-ES"/);
  const es = landesSeite({ land: "ES", iso3: "ESP", sprache: "es" }, "https://a", "");
  assert.match(es.inhalt, /licitaciones públicas de España/);
  assert.match(es.inhalt, /TED/);
  const jp = landesSeite({ land: "JP", iso3: null, sprache: "en" }, "https://a", "");
  assert.match(jp.inhalt, /href="\/\?sprache=de"/);
  assert.match(jp.inhalt, /Netherlands<\/a> · <a href="\/no"/);
  assert.match(jp.inhalt, /don&#39;t cover your country yet/);
});
