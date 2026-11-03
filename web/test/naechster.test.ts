import test from "node:test";
import assert from "node:assert/strict";
import { naechsterSchritt, type SchrittDaten } from "../src/naechster.ts";

const basis: SchrittDaten = { id: "11111111-1111-4111-8111-111111111111", status: "neu", frist: "2026-12-01T10:00:00Z", mitUnterlagen: false, laeuft: false, mappe: "keine", finanzen: true, darfAendern: true, admin: true, kalkulation: "/konto/kalkulation", portal: "https://portal.example/a", heute: "2026-11-03" };
const titel = (h: string) => /<h2>([^<]*)<\/h2>/.exec(h)?.[1] ?? "";

test("Nächster Schritt folgt dem Bearbeitungsstand", () => {
  assert.equal(titel(naechsterSchritt(basis)), "Passt das zu euch?");
  assert.match(naechsterSchritt(basis), /name="status" value="pruefen"/);
  assert.match(naechsterSchritt(basis), /name="weiter" value="\/konto\/vorgang\/1111/);
  assert.equal(titel(naechsterSchritt({ ...basis, status: "pruefen" })), "Vergabeunterlagen hochladen");
  assert.equal(titel(naechsterSchritt({ ...basis, status: "pruefen", laeuft: true })), "Crewtender liest die Unterlagen");
  assert.equal(titel(naechsterSchritt({ ...basis, status: "pruefen", mitUnterlagen: true })), "Preis kalkulieren und entscheiden");
  assert.equal(titel(naechsterSchritt({ ...basis, status: "angebot" })), "Angebot vorbereiten");
  assert.equal(titel(naechsterSchritt({ ...basis, status: "angebot", mappe: "wartet" })), "Angebot wartet auf Freigabe");
  assert.equal(titel(naechsterSchritt({ ...basis, status: "angebot", mappe: "abgelehnt" })), "Angebot überarbeiten");
  assert.match(naechsterSchritt({ ...basis, status: "angebot", mappe: "genehmigt" }), /value="abgegeben"/);
  assert.match(naechsterSchritt({ ...basis, status: "abgegeben" }), /value="gewonnen".*value="verloren"/s);
  assert.match(naechsterSchritt({ ...basis, status: "gewonnen" }), /\/konto\/auftraege\?offen=/);
  assert.equal(naechsterSchritt({ ...basis, status: "verloren" }), "");
  assert.equal(titel(naechsterSchritt({ ...basis, frist: "2026-10-01T10:00:00Z" })), "Frist abgelaufen");
});

test("Ohne Bearbeitungsrecht keine Status-Knöpfe, ohne Finanzfreigabe keine Kalkulation", () => {
  assert.doesNotMatch(naechsterSchritt({ ...basis, darfAendern: false }), /action="\/konto\/status"/);
  assert.doesNotMatch(naechsterSchritt({ ...basis, status: "pruefen", mitUnterlagen: true, finanzen: false }), /Kalkulation"/);
  assert.doesNotMatch(naechsterSchritt({ ...basis, status: "angebot", mappe: "wartet", admin: false }), /Zur Freigabe/);
});
