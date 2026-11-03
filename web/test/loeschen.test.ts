import assert from "node:assert/strict";
import { test } from "node:test";
import { betreiberSeite, dateienLoeschen, FIRMEN_ORDNER, firmenListe, kiStand, kiWert, type BetreiberFirma } from "../src/loeschen.ts";

const F = "11111111-1111-4111-8111-111111111111", V = "33333333-3333-4333-8333-333333333333", A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ANDERE = "22222222-2222-4222-8222-222222222222";
function r2(keys: string[], json: Record<string, unknown> = {}) {
  const daten = new Set(keys);
  return { daten, DATEN: {
    list: async ({ prefix }: { prefix: string }) => ({ objects: [...daten].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
    delete: async (k: string | string[]) => { for (const x of [k].flat()) daten.delete(x); },
    get: async (k: string) => daten.has(k) ? { json: async () => json[k] } : null,
  } };
}

test("Kontolöschung räumt alle Dateien der Firma auf, fremde bleiben", async () => {
  const eigene = [...FIRMEN_ORDNER.map((o) => `${o}/${F}/x`), `firmenlogo/${F}`, `kunden/firma-${F}/kalkulation.json`, `auftraege/vorgaenge/${V}.json`, `auftraege/${A}/dateien/a.pdf`, `auftraege/${A}/ergebnis.md`];
  const fremd = [`spesen/${ANDERE}/x`, `bibliothek/${ANDERE}/y`, `auftraege/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/x`];
  const { daten, DATEN } = r2([...eigene, ...fremd], { [`auftraege/vorgaenge/${V}.json`]: { auftrag: A } });
  const n = await dateienLoeschen({ DATEN } as never, [F, "kein-uuid"], [V]);
  assert.deepEqual([...daten].sort(), fremd.sort());
  assert.equal(n, eigene.length - 1, "Logo wird ohne Zählung gelöscht");
  assert.ok(FIRMEN_ORDNER.includes("unterschriften") && FIRMEN_ORDNER.includes("bewerber") && FIRMEN_ORDNER.includes("nachweis"));
});

test("Betreiber-Seite: Firmen, Haken nur bei Team-Firma, Bestätigung", () => {
  assert.match(betreiberSeite("", null), /E-Mail-Adresse des Kunden/);
  assert.match(betreiberSeite("x@y.de", []), /Kein Zugang/);
  const t = [{ user_id: "u", email: "kunde@weg.de", firma_id: F, firma: "Weg GmbH", rolle: "inhaber", mitglieder: 1, allein_inhaber: true }, { user_id: "u", email: "kunde@weg.de", firma_id: ANDERE, firma: "Team <GmbH>", rolle: "inhaber", mitglieder: 3, allein_inhaber: true }];
  const s = betreiberSeite("kunde@weg.de", t);
  assert.match(s, /Weg GmbH[\s\S]*wird mit gelöscht/);
  assert.match(s, /einziger Inhaber/);
  assert.match(s, /name="firmen_mit"[^>]*>Auch die Firmen löschen, deren einziger Inhaber er ist \(Team (&lt;|&#60;)GmbH(&gt;|&#62;)\)/);
  assert.match(s, /name="bestaetigung" required/);
  assert.doesNotMatch(betreiberSeite("kunde@weg.de", [t[0]]), /firmen_mit/);
});

import { fehlerText } from "../src/fehler.ts";
test("Fehlermeldung an den Betreiber ohne persönliche Daten", () => {
  const t = fehlerText(new TypeError("Kunde max.mustermann@firma.de, Telefon 017112345678 nicht gefunden"));
  assert.equal(t, "TypeError: Kunde …@…, Telefon … nicht gefunden");
  assert.ok(fehlerText("x".repeat(500)).length <= 220);
});

test("Betreiber: KI-Stand und Eingabe der KI-Grenze", () => {
  assert.equal(kiStand(null, 3), "ohne Grenze (3,00 $ verbraucht)");
  assert.equal(kiStand(0, 0), "Demo, keine KI");
  assert.equal(kiStand(5.5, 1.2), "1,20 $ von 5,50 $");
  assert.match(kiStand(5.5, 5.6), /aufgebraucht/);
  assert.equal(kiWert(""), null);
  assert.equal(kiWert("5,5"), 5.5);
  assert.equal(kiWert("0"), 0);
  assert.equal(kiWert("-1"), undefined);
  assert.equal(kiWert("abc"), undefined);
});

test("Betreiber: Firmenliste mit Plan, KI-Grenze und Formular", () => {
  const f: BetreiberFirma = { id: F, name: "Test <GmbH>", erstellt: "2026-11-03T10:00:00Z", website: "test.de", paket: "kostenlos", ki_budget_usd: 5.5, ki_verbraucht: 0.4, mitglieder: 1, inhaber: "a@test.de", letzte_anmeldung: null };
  const s = firmenListe([f]);
  assert.match(s, /Test &lt;GmbH&gt;|Test &#60;GmbH&#62;/);
  assert.match(s, /a@test\.de · 1 Mitglied · seit 03\.11\.2026 · zuletzt angemeldet nie · test\.de/);
  assert.match(s, /0,40 \$ von 5,50 \$/);
  assert.match(s, /<option value="5.5" selected>Probe 5,50 \$<\/option>/);
  assert.match(s, /<option selected>kostenlos<\/option>/);
  assert.match(s, /name="ki_alt" value="5.5"/);
  assert.match(s, /name="aktion" value="firma"/);
  const ohne = firmenListe([{ ...f, ki_budget_usd: null }]);
  assert.match(ohne, /<option value="" selected>ohne Grenze/);
  assert.match(ohne, /name="ki_alt" value=""/);
  assert.match(firmenListe([{ ...f, ki_budget_usd: 12.5 }]), /<option value="12.5" selected>12,50 \$/);
  assert.match(firmenListe([]), /Noch keine Firmen/);
});
