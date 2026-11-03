import assert from "node:assert/strict";
import { test } from "node:test";
import { benachrichtigungAusFormular, benachrichtigungFelder, hilfeSeite, letzteAnmeldung, profilTeil } from "../src/kontoeinstellungen.ts";

const token = (amr: unknown) => `h.${btoa(JSON.stringify({ sub: "u", exp: 4e9, amr })).replace(/=+$/, "")}.s`;

test("I1/I2: Sofort-Nachrichten, Fristen und Ruhezeit aus dem Formular", () => {
  const f = new FormData();
  f.set("sofort_ab", "8"); f.set("fristen", "1"); f.set("ruhe_von", "20"); f.set("ruhe_bis", "7");
  assert.deepEqual(benachrichtigungAusFormular(f), { sofort_ab: 8, fristen: true, ruhe_von: 20, ruhe_bis: 7 });
  f.set("sofort_ab", ""); f.delete("fristen"); f.set("ruhe_bis", "20");
  assert.deepEqual(benachrichtigungAusFormular(f), { sofort_ab: null, fristen: false, ruhe_von: null, ruhe_bis: null }); // gleiche Uhrzeit = keine Ruhezeit
  assert.deepEqual(benachrichtigungAusFormular(new FormData()), {}); // Einrichtungsassistent ändert nichts daran
  const html = benachrichtigungFelder({ stunde: 8, kanal: "push", sofort_ab: 9, fristen: false, ruhe_von: 21, ruhe_bis: 6 });
  assert.match(html, /<option value="9" selected>ab 9\/10/);
  assert.match(html, /name="fristen" value="1">/);
  assert.match(html, /<details class="benachrichtigung-mehr" open>/);
});

test("I3/I4: Konto löschen nur nach frischer Anmeldung, Name und Funktion selbst ändern", () => {
  const jetzt = Date.parse("2026-11-01T12:00:00Z");
  assert.equal(letzteAnmeldung(token([{ method: "password", timestamp: jetzt / 1000 - 60 }, { method: "otp", timestamp: 1 }])), jetzt - 60_000);
  assert.equal(letzteAnmeldung(token(undefined)), null);
  assert.equal(letzteAnmeldung("kaputt"), null);
  const m = { firma_id: "f1", anzeigename: "Eva <x>", funktion: "Dispo", rolle: "bearbeiter" };
  const frisch = profilTeil(m, token([{ timestamp: jetzt / 1000 - 600 }]), jetzt);
  assert.match(frisch, /action="\/konto\/loeschen"/);
  assert.match(frisch, /value="Eva &#60;x&#62;"/);
  assert.match(frisch, /href="\/konto\/daten.json"/);
  const alt = profilTeil(m, token([{ timestamp: jetzt / 1000 - 3600 }]), jetzt, "Fehlertext");
  assert.doesNotMatch(alt, /action="\/konto\/loeschen"/);
  assert.match(alt, /name="weiter" value="\/konto\/profil#loeschen"/);
  assert.match(alt, /<details class="konto-loeschen" id="loeschen" open>/);
});

test("I5: Hilfe mit Suche, Fragen und Kontakt ohne Versprechen", () => {
  const html = hilfeSeite("eva@example.de");
  assert.match(html, /data-hilfe-suche/);
  assert.ok((html.match(/class="hilfe-frage"/g) ?? []).length >= 10);
  assert.match(html, /mailto:kontakt@wpdigitalranger\.com\?subject=Frage%20zu%20Crewtender&body=.*eva%40example\.de/);
  assert.doesNotMatch(html, /Werktag/);
});
