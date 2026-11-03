import test from "node:test";
import assert from "node:assert/strict";
import { mahnungDocx, rechnungenSeite, zahlstatus, type Absender, type Rechnung } from "../src/rechnungen.ts";
import type { Kunde } from "../src/kunden.ts";

const r = (x: Partial<Rechnung> = {}): Rechnung => ({ id: "11111111-1111-1111-1111-111111111111", kunde_id: "k", nummer: "RE-2026-0001", monat: "2026-10", datum: "2026-11-01", positionen: [], netto: 1000, ust_satz: 19, erstellt: "", ...x });
const a: Absender = { name: "Muster GmbH", strasse: "Weg 1", plz: "52531", ort: "Übach", telefon: "", email: "", steuernummer: "1", ustid: "", kleinunternehmer: false, zahlungshinweis: "IBAN DE89 3704 0044 0532 0130 00" };

test("Mahnwesen: Status, Summen, Knöpfe und Mahnschreiben", () => {
  assert.equal(zahlstatus(r(), "2026-11-15").art, "offen", "am Fälligkeitstag noch offen");
  assert.deepEqual(zahlstatus(r(), "2026-11-20"), { art: "ueberfaellig", faellig: "2026-11-15", tage: 5 });
  assert.equal(zahlstatus(r({ bezahlt_am: "2026-11-10" }), "2026-12-01").art, "bezahlt");
  const k = [{ id: "k", name: "Stadt X" }] as unknown as Kunde[];
  const html = rechnungenSeite([r(), r({ id: "22222222-2222-2222-2222-222222222222", nummer: "RE-2026-0002", bezahlt_am: "2026-11-05" })], k, { fehlt: [], heute: "2026-11-20" });
  assert.match(html, /1\.190,00\s€<\/strong> offen \(1\)/);
  assert.match(html, /überfällig \(1\)/);
  assert.match(html, /5 Tage überfällig/);
  assert.match(html, /name="mahnen"[^>]*><button class="zweit" >✉️ Zahlungserinnerung/);
  assert.match(html, /bezahlt am 05\.11\.2026/);
  const brief = new TextDecoder().decode(mahnungDocx(r({ mahnstufe: 2 }), null, a, "2026-11-20"));
  assert.ok(brief.length > 100, "Word-Datei erzeugt");
});
