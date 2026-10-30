import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { personFormular } from "../src/mitarbeiter.ts";
import { BERUFE, ausFormular, kraftFormular, kraftKarte, nachrichtText, passt, personal, personalTeil, qualifikationenBlock, standortKacheln, waNummer, type Kraft, type Tarifvertrag } from "../src/personal.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const ort = "22222222-2222-4222-8222-222222222222";
const pid = "33333333-3333-4333-8333-333333333333";
const tarifId = "88888888-8888-4888-8888-888888888888";
const tarif: Tarifvertrag = { id: tarifId, name: "Zeitarbeit GVP/DGB", gruppen: ["1", "2a", "2b", "3"] };
const token = `h.${btoa(JSON.stringify({ sub: "u1", email: "chef@test.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;
const eva: Kraft = { id: pid, firma_id: firma, bereich_id: ort, vorname: "Eva", nachname: "Muster", berufe: ["Servicekraft", "Bankettkraft"], qualifikationen: ["Gesundheitszeugnis (§ 43 IfSG)"], tarifvertrag_id: tarifId, eg: "2a", telefon: "0170 123 45 67", email: "", status: "verfuegbar", notiz: "" };

test("WhatsApp-Nummer: deutsche Nummern bekommen die 49", () => {
  assert.equal(waNummer("0170 123 45 67"), "491701234567");
  assert.equal(waNummer("+49 (170) 1234567"), "491701234567");
  assert.equal(waNummer("0041 79 1234567"), "41791234567");
});

test("passende Ausschreibung erkennt den Beruf im Titel", () => {
  assert.ok(passt("Servicekräfte für das Betriebsrestaurant", ["Servicekraft"]));
  assert.ok(!passt("Reinigung von Büroflächen", ["Servicekraft"]));
});

test("Nachricht nennt Vorname, Ausschreibung und Firma", () => {
  const t = nachrichtText(eva, "PerLease", { titel: "Bankett Messe", frist: "2026-11-20T10:00:00Z" });
  assert.match(t, /^Hallo Eva,/);
  assert.match(t, /„Bankett Messe“/);
  assert.match(t, /PerLease$/);
});

test("Karte: Name, Berufe, Anrufen, Nachricht und Stift zum Bearbeiten", () => {
  const html = kraftKarte(eva, true);
  assert.match(html, />EM</);
  assert.match(html, /Servicekraft/);
  assert.match(html, /href="tel:01701234567"/);
  assert.match(html, /class="stift"/);
  assert.doesNotMatch(kraftKarte(eva, false), /class="stift"/);
});

test("Standort-Kacheln mit Zahlen pro Standort, Regionen als Überschrift", () => {
  const html = standortKacheln([
    { id: "r", name: "Nord", art: "standort", parent_id: null },
    { id: ort, name: "Hamburg", art: "standort", parent_id: "r" },
  ], [{ bereich_id: ort, status: "verfuegbar" }, { bereich_id: ort, status: "einsatz" }]);
  assert.match(html, /<h3>Nord<\/h3>/);
  assert.match(html, new RegExp(`href="/konto/standort/${ort}".*Hamburg.*1 verfügbar · 2 gesamt`));
});

test("Organisationsbaum zeigt Standortleitung und deckt mehrere Branchen ab", () => {
  const html = standortKacheln([{ id: ort, name: "Berlin", art: "standort", parent_id: null }], [], [{ user_id: "chef", name: "Samira Leitung", bereich_id: ort }]);
  assert.match(html, /Leitung: Samira Leitung/);
  assert.ok(Object.keys(BERUFE).some((x) => x.includes("Büro")));
  assert.ok(Object.values(BERUFE).flat().includes("Schweißer/in"));
  assert.ok(Object.values(BERUFE).flat().includes("Maler/in"));
});

test("Standortleitung erhält beim Rollenwechsel einen einzelnen, gültigen Standort zur Auswahl", () => {
  const region = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Nord", art: "standort", parent_id: null };
  const site = { id: ort, name: "Hamburg", art: "standort", parent_id: region.id };
  const html = personFormular({ user_id: "user", rolle: "bearbeiter", funktion: "Sachbearbeitung" }, firma, [region, site], [], false);
  assert.match(html, /name="rolle" data-rolle/);
  assert.match(html, /data-bereich-einzel hidden/);
  assert.match(html, /Wähle genau einen Standort aus/);
  assert.match(html, new RegExp(`<input type="radio" name="bereiche" value="${ort}"`));
  assert.doesNotMatch(html.match(/data-bereich-einzel[^]*?<\/fieldset>/)?.[0] ?? "", new RegExp(`value="${region.id}"`));
});

test("Eigene Qualifikationen erscheinen beim Eintragen, in der Filterung und Verwaltung", () => {
  const q = "Fachkunde für Hubarbeitsbühnen";
  assert.match(kraftFormular({}, "/save", "Speichern", [q]), new RegExp(q));
  const html = personalTeil([eva], new URL("https://jarvis.test/konto/standort/" + ort + `?qualifikation=${encodeURIComponent(eva.qualifikationen[0])}`), true, "/save", [], [q]);
  assert.match(html, /Qualifikation/);
  assert.match(html, /Gesundheitszeugnis/);
  const verwaltung = qualifikationenBlock(ort, [{ id: pid, name: q, bereich_id: ort }], true);
  assert.match(verwaltung, /Qualifikation hinzufügen/);
  assert.match(verwaltung, /Fachkunde für Hubarbeitsbühnen/);
});

test("Tarifvertrag wählt nur eigene Entgeltgruppen; Qualifikationen sind mehrfach ankreuzbar", () => {
  const andere: Tarifvertrag = { id: "99999999-9999-4999-8999-999999999999", name: "Maler- und Lackiererhandwerk NRW", gruppen: ["Geselle", "Meister"] };
  const html = kraftFormular({ tarifvertrag_id: tarifId, eg: "2a" }, "/save", "Speichern", ["Staplerschein", "Ersthelfer"], [tarif, andere]);
  assert.match(html, /name="tarifvertrag" required data-tarifvertrag/);
  assert.match(html, /data-tarifvertrag="88888888[^\"]*" selected>EG 2a/);
  assert.match(html, /data-tarifvertrag="99999999[^\"]*" disabled>Geselle/);
  assert.match(html, /Qualifikationen auswählen/);
  assert.match(html, /name="qualifikationen" value="Staplerschein"/);
  const form = new FormData();
  form.set("vorname", "Tom"); form.set("tarifvertrag", tarifId); form.set("eg", "2a");
  form.append("qualifikationen", "Staplerschein"); form.append("qualifikationen", "Ersthelfer");
  const parsed = ausFormular(form, ["Staplerschein", "Ersthelfer"], [tarif, andere]);
  assert.equal(parsed.tarifvertrag_id, tarifId);
  assert.equal(parsed.eg, "2a");
  assert.deepEqual(parsed.qualifikationen, ["Staplerschein", "Ersthelfer"]);
});

function mock(t: TestContext) {
  const aufrufe: { url: string; method: string; body?: string }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    aufrufe.push({ url: url.pathname + url.search, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const pfad = url.pathname.split("/rest/v1/")[1] ?? "";
    let daten: unknown = [];
    if (pfad === "mitglieder") daten = [{ firma_id: firma, rolle: "inhaber", finanzen: true, firmen: { name: "PerLease" } }];
    if (pfad === "bereiche") daten = [{ id: ort, name: "Hamburg", art: "standort", parent_id: null }];
    if (pfad === "personal") daten = [eva];
    if (pfad === "firmen_tarifvertraege") daten = [tarif];
    if (pfad === "vorgaenge") daten = [{ id: "44444444-4444-4444-8444-444444444444", titel: "Reinigung Rathaus", frist: null, status: "neu" }, { id: "55555555-5555-4555-8555-555555555555", titel: "Servicekräfte Bankett", frist: null, status: "neu" }];
    return new Response(init?.method === "POST" || init?.method === "PATCH" ? "" : JSON.stringify(daten), { status: 200 });
  });
  return aufrufe;
}
const anfrage = (pfad: string, init: RequestInit = {}) => new Request(`https://jarvis.test${pfad}`, { ...init, headers: { cookie: `jv_at=${token}`, ...(init.headers ?? {}) } });
const env = { SUPABASE_URL: "https://sb.test", SUPABASE_KEY: "pk" };

for (const [actor, target, erlaubt] of [["inhaber", "bearbeiter", true], ["bearbeiter", "bearbeiter", false], ["inhaber", "inhaber", false]] as const) {
  test(`Direkte Leitungszuordnung: ${actor} zu ${target}, erlaubt=${erlaubt}`, async (t) => {
    let gespeichert: any;
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/rest/v1/")[1];
      if (table === "rpc/mitglied_aktualisieren") { gespeichert = JSON.parse(String(init?.body)); return Response.json(null); }
      if (table === "mitglieder") return Response.json(url.searchParams.has("firma_id") ? [{ user_id: pid, rolle: target, anzeigename: "Samira", funktion: "Disposition" }] : [{ firma_id: firma, rolle: actor, firmen: { name: "Test" } }]);
      if (table === "bereiche") return Response.json([{ id: ort, name: "Hamburg", art: "standort", parent_id: null }]);
      return Response.json([]);
    });
    const r = await personal(anfrage(`/konto/standort/${ort}/leitung`, { method: "POST", body: new URLSearchParams({ person: pid }) }), env);
    assert.ok(r);
    if (erlaubt) {
      assert.deepEqual(gespeichert.bereiche, [ort]);
      assert.equal(gespeichert.rolle_neu, "standortleitung");
      assert.equal(gespeichert.finanzen_neu, false);
      assert.equal(gespeichert.alle, false);
      assert.match(r.headers.get("location")!, /Standortleitung%20zugeordnet/);
    } else assert.equal(gespeichert, undefined);
  });
}

test("Standortseite zeigt das Personal als Karten und das Formular zum Hinzufügen", async (t) => {
  mock(t);
  const r = await personal(anfrage(`/konto/standort/${ort}`), env);
  const html = await r!.text();
  assert.equal(r!.status, 200);
  assert.match(html, /📍 Hamburg/);
  assert.match(html, /class="person-karte"/);
  assert.match(html, /Person hinzufügen/);
});

test("Person anlegen speichert Berufe und Standort", async (t) => {
  const aufrufe = mock(t);
  const body = new URLSearchParams([["vorname", "Tom"], ["berufe", "Koch/Köchin"], ["berufe", "Erfunden"], ["weitere", "Grillmeister"], ["tarifvertrag", tarifId], ["eg", "3"], ["status", "einsatz"]]);
  const r = await personal(anfrage(`/konto/standort/${ort}`, { method: "POST", body }), env);
  assert.equal(r!.status, 303);
  const post = JSON.parse(aufrufe.find((a) => a.method === "POST")!.body!);
  assert.deepEqual(post.berufe, ["Koch/Köchin", "Grillmeister"]);
  assert.equal(post.bereich_id, ort);
  assert.equal(post.tarifvertrag_id, tarifId);
  assert.equal(post.eg, "3");
  assert.equal(post.status, "einsatz");
});

test("Nachrichtenseite: passende Ausschreibung zuerst, WhatsApp-Link mit Text", async (t) => {
  mock(t);
  const r = await personal(anfrage(`/konto/personal/${pid}/nachricht?vorgang=55555555-5555-4555-8555-555555555555`), env);
  const html = await r!.text();
  assert.match(html, /<option value="">Allgemein[^<]*<\/option><option value="55555555[^"]*" selected>⭐ Servicekräfte Bankett/);
  assert.match(html, /href="https:\/\/wa\.me\/491701234567\?text=Hallo%20Eva/);
});

test("Ausschreibung: eingeplantes Personal mit Status und Auswahl, passende zuerst", async (t) => {
  const { einsatzTeil } = await import("../src/personal.ts");
  const tom: Kraft = { ...eva, id: "66666666-6666-4666-8666-666666666666", vorname: "Tom", berufe: ["Reinigungskraft"] };
  const ina: Kraft = { ...eva, id: "77777777-7777-4777-8777-777777777777", vorname: "Ina", berufe: ["Servicekraft"] };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const pfad = new URL(String(input)).pathname.split("/rest/v1/")[1];
    const daten = pfad === "einsaetze" ? [{ id: "e1", personal_id: pid, vorgang_id: "v1", status: "zugesagt", personal: eva }] : [eva, tom, ina];
    return new Response(JSON.stringify(daten), { status: 200 });
  });
  const html = await einsatzTeil({ token: "t", userId: "u", email: "", cookies: [] }, env, { id: "v1", firma_id: firma, titel: "Servicekräfte Bankett" }, true);
  assert.match(html, /1 eingeplant · 1 zugesagt/);
  assert.match(html, /<option value="zugesagt" selected>✅ Zugesagt/);
  assert.match(html, /<option value="">Bitte auswählen …<\/option><option value="77777777[^"]*">🟢 ⭐ Ina/);
  assert.doesNotMatch(html, new RegExp(`<option value="${pid}">`), "schon Eingeplante nicht noch einmal anbieten");
});
