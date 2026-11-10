import assert from "node:assert/strict";
import test from "node:test";
import { betriebKasten, betriebZeilen, type Betrieb } from "../src/betrieb.ts";

const jetzt = "2026-11-10T14:00:00Z";
const gut: Betrieb = { jetzt, katalog_neueste: "2026-11-10T09:00:00Z", katalog_24h: 480, katalog_7t: 3100, quelle: { letzter_erfolg: "2026-11-10T13:10:00Z", fehler: null, rueckstand_tage: 0 },
  zahlen_stand: "2026-11-10T07:42:00Z", letzte_mail: "2026-11-10T06:00:00Z", push_haengt: 0, social_zuletzt: "2026-11-10T12:23:00Z", fehler_48h: 0, fehler_letzter: null,
  ki: { limit_usd: 90, reserviert: 14.68 }, ki_firmen_aktiv: 0, datenbank_bytes: 221_000_000, firmen: 5 };

test("Betrieb: alles in Ordnung", () => {
  const z = betriebZeilen(gut);
  assert.ok(z.every((x) => x.zustand === "gruen" || x.zustand === "grau"), JSON.stringify(z.filter((x) => x.zustand !== "gruen")));
  assert.match(betriebKasten(gut), /Alles läuft\./);
  assert.match(z.find((x) => x.name === "KI-Kosten im Monat")!.text, /14,68 von 90 \$ · tägliche KI-Suche für 0 Firmen/);
});

test("Betrieb: stehender Katalog fällt auf (Ausfall 06.–09.11.2026)", () => {
  const z = betriebZeilen({ ...gut, katalog_neueste: "2026-11-05T19:00:00Z", katalog_24h: 0, katalog_7t: 602 });
  const k = z.find((x) => x.name === "Ausschreibungen")!;
  assert.equal(k.zustand, "rot");
  assert.match(k.text, /neueste vor 5 Tagen · 0 in 24 Stunden/);
  assert.match(betriebKasten({ ...gut, katalog_neueste: "2026-11-05T19:00:00Z" }), /Störung:<\/strong> Ausschreibungen/);
  assert.equal(betriebZeilen({ ...gut, katalog_neueste: "2026-11-08T20:00:00Z" }).find((x) => x.name === "Ausschreibungen")!.zustand, "gelb", "42 Stunden: prüfen");
});

test("Betrieb: Fehlermeldung, volle Datenbank, KI-Grenze, fehlende Daten", () => {
  const z = betriebZeilen({ ...gut, fehler_48h: 2, fehler_letzter: { text: "„Katalog nachholen“ ist fehlgeschlagen." }, datenbank_bytes: 460_000_000, ki: { limit_usd: 90, reserviert: 85 }, quelle: { fehler: "Ein Export konnte nicht verarbeitet werden." } });
  const nach = (n: string) => z.find((x) => x.name === n)!;
  assert.equal(nach("Fehlermeldungen").zustand, "gelb"); assert.match(nach("Fehlermeldungen").text, /2 in 48 Stunden, zuletzt: „Katalog nachholen“/);
  assert.equal(nach("Datenbank").zustand, "rot"); assert.equal(nach("KI-Kosten im Monat").zustand, "rot"); assert.equal(nach("Abruf beim Bund").zustand, "gelb");
  assert.equal(betriebZeilen({ jetzt }).find((x) => x.name === "Ausschreibungen")!.zustand, "rot", "ohne Daten nie grün");
  assert.match(betriebKasten(null), /konnte nicht geladen werden/);
  assert.ok(!betriebKasten({ ...gut, fehler_48h: 1, fehler_letzter: { text: "<script>" } }).includes("<script>"));
});
