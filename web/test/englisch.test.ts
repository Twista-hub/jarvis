import test from "node:test";
import assert from "node:assert/strict";
import { appSprache, englisch, sprachFuss, sprachWechsel, wort, wortschatz } from "../src/englisch.ts";
import { seite } from "../src/seite.ts";

test("Englisch: Wörterbuch geladen, genaue Treffer und Platzhalter", () => {
  const w = wortschatz();
  assert.ok(w.genau > 1200, `nur ${w.genau} genaue Einträge`);
  assert.ok(w.muster > 50, `nur ${w.muster} Muster`);
  assert.equal(wort("Mein Profil"), "My profile");
  assert.equal(wort("in 3 Tagen"), "in 3 days");
  assert.equal(wort("Perlease GmbH"), null, "Firmennamen bleiben");
  assert.equal(wort("Hinweise zu Treffer"), null, "Platzhalter sind nur Zahlen");
});

test("Englisch: ganze Seite, Attribute, geschützte Bereiche, Entities", () => {
  const html = seite("Fristen", `<h2>Mein Profil</h2><p>in 12 Tagen</p><input placeholder="E-Mail-Adresse"><a title="Zur Übersicht">x</a><code>Speichern</code><textarea>Speichern</textarea><p>Perlease GmbH &amp; Co</p><p>Müller &#38; Söhne</p>`, 0, "fristen");
  const en = englisch(html);
  assert.match(en, /<html lang="en"/);
  assert.match(en, /<h2>My profile<\/h2>/);
  assert.match(en, /<p>in 12 days<\/p>/);
  assert.match(en, /placeholder="Email address"/);
  assert.match(en, /title="Back to overview"/);
  assert.match(en, /<code>Speichern<\/code>/);
  assert.match(en, /<textarea>Speichern<\/textarea>/);
  assert.match(en, /Perlease GmbH &amp; Co/);
  assert.match(en, /Müller &#38; Söhne/);
  assert.match(en, /<span>Overview<\/span>/, "Konto-Navigation");
  assert.match(en, /Terms of use/);
  assert.doesNotMatch(en, /Nutzungsbedingungen/);
});

test("Englisch: Sprache aus Cookie oder Land, Umschalter im Fuß, Wechsel-Route", () => {
  const anfrage = (cookie = "", land = "DE", url = "https://x/konto") => new Request(url, { headers: { cookie, "cf-ipcountry": land } });
  assert.equal(appSprache(anfrage("", "DE")), "de");
  assert.equal(appSprache(anfrage("", "US")), "en");
  assert.equal(appSprache(anfrage("", "ES")), "en", "ohne eigene App-Sprache Englisch");
  assert.equal(appSprache(anfrage("jv_psprache=de", "US")), "de");
  assert.equal(appSprache(anfrage("jv_psprache=en", "DE")), "en");
  const fuss = sprachFuss(seite("x", "<p>y</p>"), "de", "/konto/treffer?stand=neu");
  assert.match(fuss, /href="\/sprache\?zu=en&amp;weiter=%2Fkonto%2Ftreffer%3Fstand%3Dneu"[^>]*>🌐 English<\/a>/);
  assert.match(sprachFuss(seite("x", "<p>y</p>"), "en", "/"), /zu=de[^>]*>🌐 Deutsch</);
  const r = sprachWechsel(anfrage("", "DE", "https://x/sprache?zu=en&weiter=/konto/fristen"))!;
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/konto/fristen");
  assert.match(r.headers.get("set-cookie") ?? "", /jv_psprache=en; Path=\/; Max-Age=31536000/);
  assert.equal(sprachWechsel(anfrage("", "DE", "https://x/sprache?zu=en&weiter=//boese.de"))!.headers.get("location"), "/");
  assert.equal(sprachWechsel(anfrage("", "DE", "https://x/konto")), null);
});

test("Englisch: feste Steckbrief-Marken aus der KI werden übersetzt, Inhalt bleibt", () => {
  assert.equal(wort("Passt das zum Kunden? 7/10"), "Good fit for you? 7/10");
  assert.equal(wort("Steckbrief: Janitorial services, VA clinic"), "Fact sheet: Janitorial services, VA clinic");
  assert.equal(wort("nicht angegeben"), "not specified");
  const en = englisch(seite("x", "<h2>⏰ Fristen</h2><table><tr><td><strong>Auftraggeber</strong></td><td>Department of Veterans Affairs</td></tr></table><p><strong>Gesucht:</strong> Janitorial services</p>"));
  assert.match(en, /<h2>⏰ Deadlines<\/h2>/);
  assert.match(en, /<strong>Contracting authority<\/strong>/);
  assert.match(en, /<strong>Wanted:<\/strong> Janitorial services/);
});
