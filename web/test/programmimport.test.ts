import { test } from "node:test";
import assert from "node:assert/strict";
import { KOPF, lexwareKunden, sevdeskKunden } from "../src/programmimport.ts";
import { kundenLesen, programmFormular } from "../src/datenimport.ts";

const antwort = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });

test("Lexware Office: Kunden mit Rechnungsadresse, Ansprechpartner, USt-IdNr.; Archivierte ohne; Schlüssel als Bearer", async () => {
  const urls: string[] = [];
  const holen = async (url: string, init: RequestInit) => {
    urls.push(url);
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer geheim1234567");
    return antwort({ last: true, content: [
      { company: { name: "Muster Immobilien GmbH", vatRegistrationId: "DE123456789", contactPersons: [{ firstName: "Eva", lastName: "Muster", primary: true, emailAddress: "eva@muster.example", phoneNumber: "0221 1" }] }, addresses: { billing: [{ street: "Hauptstr. 1", zip: "50667", city: "Köln" }] } },
      { person: { firstName: "Max", lastName: "Privat" }, emailAddresses: { private: ["max@x.example"] }, archived: true },
    ] });
  };
  const t = await lexwareKunden("geheim1234567", holen, 0);
  assert.deepEqual(t[0], KOPF);
  assert.equal(t.length, 2);
  assert.deepEqual(t[1].slice(0, 8), ["Muster Immobilien GmbH", "Hauptstr. 1", "50667", "Köln", "Eva Muster", "0221 1", "eva@muster.example", "DE123456789"]);
  assert.match(urls[0], /^https:\/\/api\.lexware\.io\/v1\/contacts\?customer=true/);
  assert.equal(kundenLesen(t, [], []).zeilen[0].problem, "");
});

test("Lexware Office: falscher Schlüssel gibt eine verständliche Meldung", async () => {
  await assert.rejects(lexwareKunden("falsch12345", async () => antwort({}, 401), 0), /nicht angenommen/);
});

test("sevDesk: nur Kunden (Kundennummer oder Kategorie 3), Adresse, Mail/Telefon und Ansprechperson", async () => {
  const daten: Record<string, unknown[]> = {
    Contact: [{ id: "1", name: "Stadtwerke Muster", customerNumber: "1000", vatNumber: "DE999" }, { id: "2", name: "Lieferant AG", category: { id: "2" } }, { id: "3", surename: "Anna", familyname: "Klein", parent: { id: "1" } }],
    ContactAddress: [{ id: "a", contact: { id: "1" }, street: "Ring 2", zip: "04109", city: "Leipzig" }],
    CommunicationWay: [{ id: "w1", contact: { id: "1" }, type: "EMAIL", value: "info@sw.example", main: "1" }, { id: "w2", contact: { id: "3" }, type: "PHONE", value: "0341 2" }],
  };
  const holen = async (url: string, init: RequestInit) => {
    assert.equal((init.headers as Record<string, string>).authorization, "sevtoken12345");
    return antwort({ objects: daten[url.split("/api/v1/")[1].split("?")[0]] });
  };
  const t = await sevdeskKunden("sevtoken12345", holen);
  assert.equal(t.length, 2);
  assert.deepEqual(t[1].slice(0, 8), ["Stadtwerke Muster", "Ring 2", "04109", "Leipzig", "Anna Klein", "0341 2", "info@sw.example", "DE999"]);
});

test("Formular: Schlüssel als Passwortfeld, Hinweis, dass er nicht gespeichert wird", () => {
  const h = programmFormular([]);
  assert.match(h, /type="password" name="api_schluessel"/);
  assert.match(h, /nicht gespeichert/);
  assert.match(h, /app\.lexware\.de\/addons\/public-api/);
});
