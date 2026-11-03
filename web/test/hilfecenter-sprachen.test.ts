import assert from "node:assert/strict";
import { test } from "node:test";
import { ANLEITUNGEN, hilfecenter } from "../src/hilfecenter.ts";
import { uebersetzen, wort, type AppSprache } from "../src/englisch.ts";
import { escape, seite } from "../src/seite.ts";

const SPRACHEN: Exclude<AppSprache, "de">[] = ["en", "fr", "pl", "es", "it"];
const PFADE = ["/hilfe", "/hilfe/gibt-es-nicht", ...ANLEITUNGEN.map((a) => `/hilfe/${a.slug}`)];
// Brand names stay as they are in every language.
const MARKEN = new Set(["Jarvis", "WP Digital Ranger ·"]);
const TEILE = /(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<textarea[\s\S]*?<\/textarea>|<code[\s\S]*?<\/code>|<[^>]+>)/;
const ent = (t: string) => t.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

async function deutsch(pfad: string): Promise<string> {
  const r = hilfecenter(new Request(`https://jarvis.test${pfad}`), (t, i) => seite(t, i));
  assert.ok(r, pfad);
  return r.text();
}

test("help center in en/fr/pl/es/it: every visible text node of every page is translated", async () => {
  for (const pfad of PFADE) {
    const de = await deutsch(pfad);
    const deTeile = de.split(TEILE);
    for (const l of SPRACHEN) {
      const uebersetzt = uebersetzen(de, l);
      assert.match(uebersetzt, new RegExp(`<html lang="${l}"`), `${pfad} ${l}`);
      const teile = uebersetzt.split(TEILE);
      assert.equal(teile.length, deTeile.length, `${pfad} ${l}: structure kept`);
      for (let i = 0; i < deTeile.length; i += 2) {
        const kern = deTeile[i].trim();
        if (!kern || !/\p{L}/u.test(kern) || MARKEN.has(ent(kern))) continue;
        // A text may only stay unchanged when the dictionary keeps it on purpose (e.g. "Kontakt" in Polish).
        if (teile[i].trim() === kern) assert.equal(wort(ent(kern), l), ent(kern), `${pfad} ${l}: still German: ${kern}`);
      }
      assert.doesNotMatch(uebersetzt, /aria-label="Zur Übersicht"/, `${pfad} ${l}: back link label`);
    }
  }
});

test("help center in en/fr/pl/es/it: titles, steps, buttons and tips of each guide are no longer German", async () => {
  for (const a of ANLEITUNGEN) {
    const de = await deutsch(`/hilfe/${a.slug}`);
    for (const l of SPRACHEN) {
      const t = uebersetzen(de, l);
      const titel = /<title>([\s\S]*?)<\/title>/.exec(t)?.[1] ?? "";
      assert.ok(!titel.includes(escape(a.titel)) && titel.startsWith(a.icon), `${a.slug} ${l}: page title ${titel}`);
      assert.ok(!t.includes(`<h1>${escape(`${a.icon} ${a.titel}`)}</h1>`), `${a.slug} ${l}: heading`);
      assert.ok(!t.includes(`Für: ${escape(a.fuer)}`), `${a.slug} ${l}: "Für:" line`);
      for (const [text, , knopf] of a.schritte) {
        assert.ok(!t.includes(escape(text)), `${a.slug} ${l}: step still German: ${text}`);
        if (knopf) assert.ok(!t.includes(`>${escape(knopf)}</a>`) || wort(knopf, l) === knopf, `${a.slug} ${l}: button ${knopf}`);
      }
      for (const tipp of a.tipps ?? []) assert.ok(!t.includes(escape(tipp)), `${a.slug} ${l}: tip ${tipp}`);
      if (a.tipps?.length) assert.ok(!t.includes("💡 Tipps"), `${a.slug} ${l}: tips heading`);
      assert.ok(!t.includes("Weiter: "), `${a.slug} ${l}: "Weiter:" link`);
    }
  }
  // Spot checks of the wording.
  const erste = await deutsch("/hilfe/erste-schritte");
  assert.match(uebersetzen(erste, "en"), /<title>🚀 Getting started: set up your account and company · Jarvis<\/title>/);
  assert.match(uebersetzen(erste, "en"), /For: Owners, management/);
  assert.match(uebersetzen(erste, "fr"), /Pour : Gérants, direction/);
  assert.match(uebersetzen(erste, "en"), /Next: Search profile: find the right tenders →/);
  const ki = await deutsch("/hilfe/datenschutz-arbeitgeber");
  assert.match(uebersetzen(ki, "en"), /Art\. 13 GDPR/);
  assert.match(uebersetzen(ki, "fr"), /art\. 13 RGPD/);
  assert.match(uebersetzen(ki, "pl"), /art\. 13 RODO/);
  assert.match(uebersetzen(ki, "es"), /art\. 13 RGPD/);
  assert.match(uebersetzen(ki, "it"), /art\. 13 GDPR/);
});

test("help center in en/fr/pl/es/it: overview and 404 page", async () => {
  const ueb = await deutsch("/hilfe");
  const fehlt = await deutsch("/hilfe/gibt-es-nicht");
  const erwartet: Record<string, [string, string]> = {
    en: ["📚 Help center", "This guide does not exist."], fr: ["📚 Centre d'aide", "Ce guide n'existe pas."], pl: ["📚 Centrum pomocy", "Taka instrukcja nie istnieje."],
    es: ["📚 Centro de ayuda", "Esta guía no existe."], it: ["📚 Centro assistenza", "Questa guida non esiste."],
  };
  for (const l of SPRACHEN) {
    const u = uebersetzen(ueb, l);
    assert.ok(u.includes(`<h1>${escape(erwartet[l][0])}</h1>`), `${l}: overview heading`);
    assert.ok(!u.includes("Anleitungen Schritt für Schritt"), `${l}: intro`);
    for (const a of ANLEITUNGEN) assert.ok(!u.includes(escape(a.kurz)) && !u.includes(`<strong>${escape(a.titel)}</strong>`), `${l}: ${a.slug} in overview`);
    const f = uebersetzen(fehlt, l);
    assert.ok(f.includes(escape(erwartet[l][1])) && !f.includes("Diese Anleitung gibt es nicht."), `${l}: 404 text`);
  }
});
