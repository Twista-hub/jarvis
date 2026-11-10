import assert from "node:assert/strict";
import test from "node:test";
import { aboFormular, aboSeiten, bestaetigungsMail, EINWILLIGUNG, suchAbo, suchName } from "../src/suchabo.ts";
import { demoSuchSeite } from "../src/demo.ts";

const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "k" } as any;
const post = (felder: Record<string, string>, pfad = "/abo") => new Request(`https://crewtender.eu${pfad}`, { method: "POST", body: new URLSearchParams(felder) });
const token = "ab".repeat(32);

test("Such-Abo: Formular nur nach einer Suche, mit Einwilligung, Falle für Roboter und ohne Skript-Lücke", () => {
  assert.equal(aboFormular("", ""), "");
  const f = aboFormular(`Reinigung "><script>`, "52");
  assert.ok(!f.includes("<script>"));
  assert.match(f, /action="\/abo" data-demo-frei/);
  assert.match(f, /name="zustimmung" value="ja" required/);
  assert.match(f, /name="webseite" tabindex="-1"/);
  assert.ok(f.includes(EINWILLIGUNG) && f.includes('href="/datenschutz"'));
  assert.equal(suchName("Maler", ""), "„Maler“");
  assert.equal(suchName("", "Köln"), "in Köln");
  const seite = demoSuchSeite({ q: "Maler", ort: "50", alle: false, treffer: [], beispiele: [] });
  assert.match(seite, /Neue Treffer per E-Mail/, "auch ohne Treffer: gerade dann lohnt das Abo");
  assert.ok(!demoSuchSeite({ q: "", ort: "", alle: false, treffer: [], beispiele: [] }).includes("abo-kasten"));
  assert.ok(!demoSuchSeite({ q: "Maler", ort: "", alle: false, treffer: null, beispiele: [] }).includes("abo-kasten"), "bei gestörter Suche kein Abo");
});

test("Such-Abo: Bestätigungsmail nennt die Suche, den Link und den Absender", () => {
  const m = bestaetigungsMail("kunde@firma.de", "Gebäudereinigung", "52", token);
  assert.equal(m.subject, "Bitte bestätigen: neue Ausschreibungen für „Gebäudereinigung“ in 52");
  assert.ok(m.text.includes(`https://crewtender.eu/abo/bestaetigen/${token}`));
  assert.match(m.text, /Rochusstraße 19, 52531 Übach-Palenberg/);
  assert.match(m.text, /löschen wir die Adresse nach 7 Tagen/);
  assert.throws(() => bestaetigungsMail("kunde@firma.de\nbcc: x@y.de", "a", "", token));
  assert.throws(() => bestaetigungsMail("kunde@firma.de", "a", "", "kurz"));
});

test("Such-Abo: Wege und Eingabeprüfung ohne Datenbank", async () => {
  assert.equal(await suchAbo(new Request("https://crewtender.eu/demo/suche"), env), null);
  assert.equal(await suchAbo(new Request("https://crewtender.eu/abonnieren"), env), null);
  assert.equal((await suchAbo(new Request("https://crewtender.eu/abo"), env))!.status, 303);
  const falle = (await suchAbo(post({ q: "Maler", email: "x@y.de", zustimmung: "ja", webseite: "http://spam" }), env))!;
  assert.equal(falle.status, 200); assert.match(await falle.text(), /Fast fertig/);
  assert.equal((await suchAbo(post({ q: "Maler", email: "keine-adresse", zustimmung: "ja" }), env))!.status, 400);
  const ohne = (await suchAbo(post({ q: "Maler", email: "x@y.de" }), env))!;
  assert.equal(ohne.status, 400); assert.match(await ohne.text(), /Häkchen/);
  assert.equal((await suchAbo(post({ email: "x@y.de", zustimmung: "ja" }), env))!.status, 303, "ohne Suche kein Abo");
  const ohneDb = (await suchAbo(post({ q: "Maler", email: "x@y.de", zustimmung: "ja" }), env))!;
  assert.equal(ohneDb.status, 503, "ohne Datenbank klare Meldung statt Absturz");
  assert.equal(ohneDb.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("Such-Abo: Bestätigen und Abmelden per Link", async () => {
  const alt = globalThis.fetch; const rufe: string[] = [];
  globalThis.fetch = (async (u: any, o: any) => { rufe.push(`${String(u).split("/rpc/")[1]} ${o.body}`); return new Response(String(u).includes("unbekannt") ? "null" : String(u).endsWith("abmelden") ? "true" : JSON.stringify({ suche: "Maler", gebiet: "50" }), { status: 200 }); }) as any;
  try {
    const ok = (await suchAbo(new Request(`https://crewtender.eu/abo/bestaetigen/${token}`), env))!;
    assert.equal(ok.status, 200); assert.match(await ok.text(), /Abo bestätigt[\s\S]*„Maler“ in 50[\s\S]*30 Tage Pro gratis testen/);
    const seite = (await suchAbo(new Request(`https://crewtender.eu/abo/abmelden/${token}`), env))!;
    assert.match(await seite.text(), new RegExp(`action="/abo/abmelden/${token}"`));
    assert.ok(!rufe.some((r) => r.startsWith("such_abo_abmelden")), "Ansehen der Seite meldet noch nicht ab (Link-Prüfer der Mailprogramme)");
    const weg = (await suchAbo(post({}, `/abo/abmelden/${token}`), env))!;
    assert.match(await weg.text(), /Abgemeldet/);
    assert.ok(rufe.some((r) => r.startsWith("such_abo_abmelden") && r.includes(token)));
    assert.equal((await suchAbo(new Request("https://crewtender.eu/abo/bestaetigen/zu-kurz"), env))!.status, 404);
  } finally { globalThis.fetch = alt; }
  assert.match(aboSeiten.gesendet("Maler", ""), /Spam-Ordner/);
});
