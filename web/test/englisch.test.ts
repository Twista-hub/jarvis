import test from "node:test";
import assert from "node:assert/strict";
import { appSprache, englisch, sprachFuss, sprachWechsel, uebersetzen, wort, wortschatz } from "../src/englisch.ts";
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
  assert.match(englisch('<textarea name="n" placeholder="z. B. Muster GmbH">Speichern</textarea>'), /placeholder="e\.g\. Acme Ltd">Speichern<\/textarea>/);
  assert.match(en, /Perlease GmbH &amp; Co/);
  assert.match(en, /Müller &#38; Söhne/);
  assert.match(en, /<span>Overview<\/span>/, "Konto-Navigation");
  assert.match(en, /Terms of use/);
  assert.doesNotMatch(en, /Nutzungsbedingungen/);
});

test("Englisch: Sprache aus Cookie oder Land, Umschalter im Fuß, Wechsel-Route", () => {
  const anfrage = (cookie = "", land = "DE", url = "https://x/konto", browser = "") => new Request(url, { headers: { cookie, "cf-ipcountry": land, "accept-language": browser } });
  // English is the standard (04.11.2026): without an own choice the browser language decides, never the IP alone.
  assert.equal(appSprache(anfrage("", "DE", undefined, "de-DE,de;q=0.9")), "de");
  assert.equal(appSprache(anfrage("", "DE")), "en", "ohne Browsersprache Englisch, auch aus Deutschland");
  assert.equal(appSprache(anfrage("", "US")), "en");
  assert.equal(appSprache(anfrage("", "IT", undefined, "it-IT")), "it", "Italien hat eine eigene App-Sprache");
  assert.equal(appSprache(anfrage("", "NL", undefined, "nl-NL")), "en", "ohne eigene App-Sprache Englisch");
  assert.equal(appSprache(anfrage("jv_psprache=de", "US")), "de");
  assert.equal(appSprache(anfrage("jv_psprache=en", "DE")), "en");
  assert.equal(appSprache(anfrage("", "FR", undefined, "fr-FR")), "fr");
  assert.equal(appSprache(anfrage("jv_psprache=fr", "DE")), "fr");
  assert.equal(appSprache(anfrage("jv_psprache=it", "FR")), "it");
  assert.equal(appSprache(anfrage("jv_psprache=nl", "FR")), "en", "Niederländisch hat keine App-Sprache");
  const fuss = sprachFuss(seite("x", "<p>y</p>"), "de", "/konto/treffer?stand=neu");
  assert.match(fuss, /href="\/sprache\?zu=en&amp;weiter=%2Fkonto%2Ftreffer%3Fstand%3Dneu"[^>]*>🌐 English<\/a>/);
  assert.match(fuss, /zu=fr[^>]*>Français<\/a>/);
  assert.match(sprachFuss(seite("x", "<p>y</p>"), "en", "/"), /zu=de[^>]*>🌐 Deutsch</);
  assert.match(sprachFuss(seite("x", "<p>y</p>"), "fr", "/"), /zu=de[^>]*>🌐 Deutsch<\/a> · <a[^>]*zu=en[^>]*>English</);
  assert.match(sprachWechsel(anfrage("", "DE", "https://x/sprache?zu=fr&weiter=/"))!.headers.get("set-cookie") ?? "", /jv_psprache=fr;/);
  assert.match(sprachWechsel(anfrage("", "DE", "https://x/sprache?zu=xx&weiter=/"))!.headers.get("set-cookie") ?? "", /jv_psprache=de;/);
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

test("Französisch: Wörterbuch, ganze Seite, Steckbrief-Marken", () => {
  const w = wortschatz("fr");
  assert.ok(w.genau > 1200, `nur ${w.genau} genaue Einträge`);
  assert.ok(w.muster > 50, `nur ${w.muster} Muster`);
  assert.match(wort("in 3 Tagen", "fr") ?? "", /3/);
  assert.equal(wort("Perlease GmbH", "fr"), null);
  assert.equal(wort("Steckbrief: Nettoyage des locaux", "fr"), "Fiche synthèse : Nettoyage des locaux");
  const fr = uebersetzen(seite("x", "<h2>Mein Profil</h2><p><strong>Gesucht:</strong> Nettoyage</p><input placeholder=\"E-Mail-Adresse\">"), "fr");
  assert.match(fr, /<html lang="fr"/);
  assert.doesNotMatch(fr, /Mein Profil|E-Mail-Adresse/);
  assert.match(fr, /<strong>Objet :<\/strong> Nettoyage/);
  assert.equal(uebersetzen("<p>Mein Profil</p>", "de"), "<p>Mein Profil</p>");
  assert.equal(wort("Nettoyage de bureaux suchen", "fr"), "Rechercher : Nettoyage de bureaux");
  assert.equal(wort("Office cleaning suchen"), "Search for Office cleaning");
  assert.equal(wort("Arbeit suchen"), "Search work", "feste Einträge gehen vor");
  assert.equal(wort("in\u00a03 Tagen"), "in 3 days", "geschützte Leerzeichen");
});

test("Polnisch: Wörterbuch, Sprache aus Land, Umschalter", () => {
  const w = wortschatz("pl");
  assert.ok(w.genau > 1500, `nur ${w.genau} genaue Einträge`);
  assert.equal(wort("Steckbrief: Sprzątanie biur", "pl"), "Karta przetargu: Sprzątanie biur");
  const pl = uebersetzen(seite("x", "<h2>Mein Profil</h2>"), "pl");
  assert.match(pl, /<html lang="pl"/);
  assert.doesNotMatch(pl, /Mein Profil/);
  const anfrage = (cookie = "", land = "PL") => new Request("https://x/konto", { headers: { cookie, "cf-ipcountry": land, "accept-language": "pl-PL,pl;q=0.9" } });
  assert.equal(appSprache(anfrage()), "pl");
  assert.equal(appSprache(anfrage("jv_psprache=pl", "DE")), "pl");
  assert.match(sprachFuss(seite("x", "<p>y</p>"), "de", "/"), /zu=pl[^>]*>Polski<\/a>/);
});

test("Spanisch: Wörterbuch und Sprache aus Land", () => {
  assert.ok(wortschatz("es").genau > 1500);
  assert.equal(wort("Steckbrief: Limpieza", "es"), "Ficha de la licitación: Limpieza");
  assert.equal(appSprache(new Request("https://x/", { headers: { "cf-ipcountry": "ES", "accept-language": "es-ES" } })), "es");
  assert.doesNotMatch(uebersetzen(seite("x", "<h2>Mein Profil</h2>"), "es"), /Mein Profil/);
});
