import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { konto } from "../src/konto.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const vorgang = "33333333-3333-4333-8333-333333333333";
const token = `h.${btoa(JSON.stringify({ sub: user, email: "test@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;

function mockKontoApi(t: TestContext, liste: unknown[] = [], rolle = "inhaber", suchprofile: unknown[] = [], mehrereFirmen = false) {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const pfad = url.pathname.split("/rest/v1/")[1] ?? "";
    let daten: unknown = [];
    if (pfad === "mitglieder" && url.searchParams.has("user_id")) {
      daten = [{ firma_id: firma, rolle, erstellt: "2026-01-01T00:00:00Z", user_id: user, firmen: { name: "Musterfirma", paket: "kostenlos" } }];
    } else if (pfad === "mitglieder" && url.searchParams.has("firma_id")) {
      daten = [{ firma_id: firma, rolle, erstellt: "2026-01-01T00:00:00Z", user_id: user }];
    } else if (pfad === "vorgaenge" && url.searchParams.has("id")) {
      daten = [{ id: vorgang, firma_id: firma, titel: "Beispielauftrag", link: "https://portal.test/auftrag", frist: null, status: "neu", punkte: 8, erstellt: "2026-01-01T00:00:00Z", steckbrief: "Bekanntmachung" }];
    }
    if (pfad === "vorgaenge" && !url.searchParams.has("id")) daten = liste;
    if (pfad === "suchprofile") daten = suchprofile;
    if (mehrereFirmen && pfad === "mitglieder" && url.searchParams.has("user_id")) (daten as any[]).push({ firma_id: "44444444-4444-4444-8444-444444444444", rolle, erstellt: "2026-01-02T00:00:00Z", user_id: user, firmen: { name: "Zweite Firma", paket: "kostenlos" } });
    return new Response(JSON.stringify(daten), { status: 200, headers: { "content-type": "application/json" } });
  });
}

async function seite(pfad: string, dateiProfil?: (firma: string) => { beschreibung: string } | undefined): Promise<string> {
  const response = await konto(new Request(`https://jarvis.test${pfad}`, { headers: { cookie: `jv_at=${token}` } }), {
    SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public",
  }, dateiProfil);
  assert.ok(response);
  assert.equal(response.status, 200);
  return response.text();
}

test("Konto-Übersicht zeigt die sechs großen Bereiche und feste Mobilnavigation", async (t) => {
  mockKontoApi(t);
  const html = await seite("/konto");
  for (const titel of ["Ausschreibungen", "Fristen", "Unterlagen", "Kalkulation", "Firma &#38; Team", "Suchprofil"]) {
    assert.ok(html.includes(titel), `Kachel fehlt: ${titel}`);
  }
  assert.match(html, /class="konto-kacheln"/);
  assert.match(html, /class="konto-nav"/);
  assert.match(html, /position: fixed/);
});

test("Unterseiten bieten Zurück und behalten Einstellungen mit Handy-Nachrichten", async (t) => {
  mockKontoApi(t);
  for (const [pfad, titel] of [
    ["/konto/treffer", "Ausschreibungen"], ["/konto/fristen", "Fristen"],
    ["/konto/unterlagen", "Unterlagen"], ["/konto/kalkulation", "Kalkulation"],
    ["/konto/team", "Firma &#38; Team"], ["/konto/einstellungen", "Einstellungen"],
  ]) {
    const html = await seite(pfad);
    assert.ok(html.includes(titel), `${pfad} zeigt Überschrift`);
    assert.match(html, /aria-label="Zur Übersicht" title="Zur Übersicht"><span aria-hidden="true">←<\/span>/);
    assert.doesNotMatch(html, /← Zurück/);
    assert.ok(html.includes("class=\"konto-nav\""), `${pfad} zeigt Mobilnavigation`);
  }
  const einstellungen = await seite("/konto/einstellungen");
  assert.match(einstellungen, /id="push-an"/);
  assert.match(einstellungen, /id="push-test"/);
  assert.match(einstellungen, /id="push-status"/);
});

test("Ausschreibungsdetail behält den Upload für Vergabeunterlagen", async (t) => {
  mockKontoApi(t);
  const html = await seite(`/konto/vorgang/${vorgang}`);
  assert.match(html, /action="\/konto\/vorgang\/33333333-3333-4333-8333-333333333333\/unterlagen"/);
  assert.match(html, /type="file" multiple required data-sofort/);
  assert.match(html, /Hier runterladen/);
});

test("Status-Reiter trennen Vorgänge, Fristen berücksichtigen nur laufende Ausschreibungen", async (t) => {
  const tag = new Date(Date.now() + 2 * 86400_000).toISOString();
  const basis = { id: vorgang, frist: tag, erstellt: "2026-01-01T00:00:00Z", punkte: 8 };
  mockKontoApi(t, [{ ...basis, titel: "Neuer Auftrag", status: "neu" }, { ...basis, titel: "Angebot läuft", status: "angebot" }, { ...basis, titel: "Schon abgegeben", status: "abgegeben" }, { ...basis, titel: "Archivierter Auftrag", status: "gewonnen" }]);
  const neu = await seite("/konto/treffer");
  assert.match(neu, /Neuer Auftrag/);
  assert.match(neu, /<article class="treffer-karte">/);
  assert.doesNotMatch(neu, /<table>/);
  assert.match(neu, /action="\/konto\/status"/);
  assert.match(neu, /name="weiter" value="\/konto\/treffer\?stand=neu"/);
  assert.doesNotMatch(neu, /Archivierter Auftrag/);
  const archiv = await seite("/konto/treffer?stand=archiv");
  assert.match(archiv, /Archivierter Auftrag/);
  assert.doesNotMatch(archiv, /Neuer Auftrag/);
  const fristen = await seite("/konto/fristen");
  assert.match(fristen, /frist-bald/);
  assert.match(fristen, /Angebot läuft/);
  assert.doesNotMatch(fristen, /Schon abgegeben/);
});

test("Unterlagenformular benötigt keinen Zugangscode; Leser sehen keine Änderungsformulare", async (t) => {
  mockKontoApi(t, [], "leser");
  const html = await seite("/konto/unterlagen");
  assert.doesNotMatch(html, /type="file"/);
  const team = await seite("/konto/team");
  assert.doesNotMatch(team, /action="\/konto\/einladen"/);
  assert.doesNotMatch(team, /action="\/konto\/bereich"/);
});

test("Kalkulationswerte werden mit Firmenbezug über den Personentoken gespeichert", async (t) => {
  let body: any;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${token}`);
    return new Response(null, { status: 204 });
  });
  const r = await konto(new Request("https://jarvis.test/konto/kalkulation", {
    method: "POST", headers: { cookie: `jv_at=${token}` }, body: new URLSearchParams({ firma, lohn: "18,50", nebenkosten: "23", ausfall: "20", zuschlaege: "0", gemeinkosten: "15", gewinn: "8", sonstiges: "1" }),
  }), { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public" });
  assert.equal(r!.status, 303);
  assert.match(r!.headers.get("location")!, /^\/konto\/kalkulation/);
  assert.equal(body.firma_id, firma);
  assert.equal(body.bereich_id, null);
  assert.equal(body.eingaben.lohn, 18.5);
});

test("Übersicht bleibt ohne Kontodaten und Einrichtung; Firmenwechsel ist nur im Profil", async (t) => {
  mockKontoApi(t, [], "inhaber", [], true);
  const html = await seite("/konto");
  const body = html.slice(html.indexOf("<body>"));
  assert.doesNotMatch(body, /Angemeldet als|test@example.de|Deine Rolle|Paket:|Suche einrichten/);
  assert.match(body, /href="\/konto\/profil" aria-label="Mein Profil"/);
  assert.doesNotMatch(body, /Firma wechseln|name="firma"/);
  const profil = await seite("/konto/profil");
  assert.match(profil, /test@example.de/);
  assert.match(profil, /action="\/konto\/profil"/);
  assert.match(profil, /<option value="44444444-4444-4444-8444-444444444444">Zweite Firma/);
  assert.match(profil, /action="\/abmelden"/);
});

test("Bereits hinterlegtes Firmenprofil wird als eingerichtet erkannt", async (t) => {
  mockKontoApi(t);
  const vorlage = (id: string) => id === firma ? { beschreibung: "Wir vermitteln Servicepersonal." } : undefined;
  const html = await seite("/konto/suchprofil", vorlage);
  assert.match(html, /Die Suche für Musterfirma ist eingerichtet/);
  assert.match(html, /Suchprofil anpassen/);
  assert.doesNotMatch(html, />Suche einrichten</);
  assert.match(html, /Wir vermitteln Servicepersonal/);
});

test("fehlende Firmenrecherche wird für Admins nachgeholt; Leser und fertige Profile starten keine neue Recherche", async (t) => {
  const alt = [{ id: "profil", beschreibung: "Wir verlegen Fliesen.", websuche_beschreibung: "", erstlauf: null }];
  const request = () => new Request("https://jarvis.test/konto/suchprofil", { headers: { cookie: `jv_at=${token}` } });
  const env = { SUPABASE_URL: "https://supabase.test", SUPABASE_KEY: "public" };
  mockKontoApi(t, [], "inhaber", alt);
  const r = await konto(request(), env);
  assert.equal(r?.status, 303);
  assert.equal(r?.headers.get("location"), `/konto/einrichtung?firma=${firma}&automatisch=1`);
  mockKontoApi(t, [], "leser", alt);
  assert.equal((await konto(request(), env))?.status, 200);
  mockKontoApi(t, [], "inhaber", [{ ...alt[0], recherche_version: "2" }]);
  assert.equal((await konto(request(), env))?.status, 200);
});

test("Gespeichertes Suchprofil zeigt eigene, Website- und Websuch-Funde getrennt", async (t) => {
  const profile: unknown[] = [{ id: "profil", beschreibung: "Eigene Firmenbeschreibung", website_beschreibung: "Auf der Website gefundene Leistungen", websuche_beschreibung: "Im öffentlichen Firmenprofil gefundene Leistungen", erstlauf: null }];
  mockKontoApi(t, [], "inhaber", profile);
  const eingerichtet = await seite("/konto/suchprofil");
  assert.match(eingerichtet, /Die Suche für Musterfirma ist eingerichtet/);
  assert.match(eingerichtet, /Suchprofil anpassen/);
  assert.match(eingerichtet, /Deine Beschreibung[\s\S]*Eigene Firmenbeschreibung/);
  assert.match(eingerichtet, /Auf der Website gefunden[\s\S]*Auf der Website gefundene Leistungen/);
  assert.match(eingerichtet, /In öffentlichen Suchen gefunden[\s\S]*Im öffentlichen Firmenprofil gefundene Leistungen/);
  profile.length = 0;
  const leer = await seite("/konto/suchprofil");
  assert.match(leer, /noch keine Suche eingerichtet/);
  assert.match(leer, />Suche einrichten</);
  assert.doesNotMatch(leer, /Suchprofil anpassen/);
});


test("Unterlagen: Schnellauswahl der vorhandenen Ausschreibungen, neueste zuerst", async (t) => {
  mockKontoApi(t, [
    { id: vorgang, titel: "Alte Ausschreibung", link: null, frist: "2026-11-20T10:00:00Z", status: "neu", punkte: 9, erstellt: "2026-10-01T00:00:00Z" },
    { id: "55555555-5555-4555-8555-555555555555", titel: "Neue Ausschreibung", link: null, frist: null, status: "pruefen", punkte: 5, erstellt: "2026-10-29T00:00:00Z" },
    { id: "66666666-6666-4666-8666-666666666666", titel: "Verworfen", link: null, frist: null, status: "verworfen", punkte: 2, erstellt: "2026-10-30T00:00:00Z" },
  ]);
  const html = await seite("/konto/unterlagen");
  assert.match(html, /<select name="vorgang" data-auswahl><option value="">➕ Neue Ausschreibung<\/option><option value="55555555[^"]*">Neue Ausschreibung<\/option><option value="33333333[^"]*">Alte Ausschreibung \(Frist 20\.11\.2026\)/);
  assert.doesNotMatch(html, />Verworfen</);
  assert.doesNotMatch(html, /name="titel" required/);
});

test("Kalkulation: alle offenen Ausschreibungen als Karten, ohne Unterlagen geht es zum Hochladen", async (t) => {
  mockKontoApi(t, [
    { id: vorgang, titel: "Rahmenvertrag für Arbeitnehmerüberlassung im Bereich Zentrale Dienste mit sehr langem Titel", link: null, frist: "2026-11-20T10:00:00Z", status: "neu", punkte: 9, erstellt: "2026-10-01T00:00:00Z" },
    { id: "66666666-6666-4666-8666-666666666666", titel: "Verworfen", link: null, frist: null, status: "verworfen", punkte: 2, erstellt: "2026-10-30T00:00:00Z" },
  ]);
  const html = await seite("/konto/kalkulation");
  assert.match(html, /class="auswahl-liste"/);
  assert.match(html, new RegExp(`href="/konto/vorgang/${vorgang}#unterlagen"><strong>Rahmenvertrag`));
  assert.match(html, /Erst Unterlagen hochladen/);
  assert.doesNotMatch(html, />Verworfen</);
});

test("Firma & Team mit nur einem Standort zeigt das Personal direkt", async (t) => {
  mockKontoApi(t);
  const html = await seite("/konto/team");
  assert.match(html, /Organisationsbaum/);
  assert.match(html, /Einsatzpersonal/);
  assert.match(html, /Person hinzufügen/);
  assert.doesNotMatch(html, /class="konto-kacheln standort-kacheln"/);
});
