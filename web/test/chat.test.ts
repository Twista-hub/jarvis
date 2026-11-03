import test from "node:test";
import assert from "node:assert/strict";
import { raumLink, raumListe, raumSchluessel, raumSeite } from "../src/chat.ts";

const B = "11111111-1111-4111-8111-111111111111", O = "22222222-2222-4222-8222-222222222222";

test("Chat: Raum-Schlüssel und Links", () => {
  assert.equal(raumSchluessel({ bereich_id: null, einsatzort_id: null }), "firma");
  assert.equal(raumSchluessel({ bereich_id: B, einsatzort_id: null }), `b:${B}`);
  assert.equal(raumSchluessel({ bereich_id: null, einsatzort_id: O }), `o:${O}`);
  assert.equal(raumLink({ bereich_id: null, einsatzort_id: null }), "/konto/chat?raum=firma");
  assert.equal(raumLink({ bereich_id: null, einsatzort_id: O }), `/konto/chat?o=${O}`);
});

test("Chat: Liste zeigt Ungelesenes, Seite schützt vor HTML und zeigt Löschen nur für eigene Nachrichten", () => {
  const liste = raumListe([{ bereich_id: null, einsatzort_id: null, name: "Ganze Firma", letzte: "2026-11-03T08:00:00Z", ungelesen: 2 }, { bereich_id: null, einsatzort_id: O, name: "Messe <Halle 3>", letzte: null, ungelesen: 0 }], "2026-11-03");
  assert.match(liste, /<strong>2 neu<\/strong>/);
  assert.match(liste, /Messe &#60;Halle 3&#62;/);
  assert.match(liste, /noch keine Nachricht/);
  assert.match(raumListe([], "2026-11-03"), /in keinem Chat/);
  const mitglieder = [{ user_id: "ich", anzeigename: "Benjamin", funktion: null }, { user_id: "kollege", anzeigename: "Ayşe", funktion: null }];
  const nachrichten = [
    { id: "a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: "kollege", text: "<script>x</script>\nZeile 2", erstellt: "2026-11-03T07:30:00Z" },
    { id: "b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: "ich", text: "Bin da", erstellt: "2026-11-03T07:35:00Z" },
  ];
  const seite = raumSeite({ bereich_id: null, einsatzort_id: O, name: "Messe" }, nachrichten, { ich: "ich", admin: false, mitglieder, heute: "2026-11-03" });
  assert.doesNotMatch(seite, /<script>/);
  assert.match(seite, /&#60;script&#62;x&#60;\/script&#62;<br>Zeile 2/);
  assert.match(seite, /Ayşe · 08:30/);
  assert.equal((seite.match(/name="loeschen"/g) ?? []).length, 1, "nur die eigene Nachricht ist löschbar");
  assert.match(seite, new RegExp(`action="/konto/chat\\?o=${O}"`));
  const admin = raumSeite({ bereich_id: null, einsatzort_id: null, name: "Ganze Firma" }, nachrichten, { ich: "ich", admin: true, mitglieder, heute: "2026-11-03" });
  assert.equal((admin.match(/name="loeschen"/g) ?? []).length, 2, "Inhaber/Admin können alles entfernen");
  assert.match(raumSeite({ bereich_id: B, einsatzort_id: null, name: "Berlin" }, [], { ich: "ich", admin: false, mitglieder, heute: "2026-11-03" }), /Noch keine Nachricht/);
});
