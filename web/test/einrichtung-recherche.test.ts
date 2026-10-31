import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { bereinigen, einrichtung, profilZuFormular } from "../src/einrichtung.ts";
import type { RechercheAngaben } from "../src/firmenrecherche.ts";

const firma = "11111111-1111-4111-8111-111111111111";
const bereich = "33333333-3333-4333-8333-333333333333";
const token = `h.${btoa(JSON.stringify({ sub: "user", email: "test@example.de", exp: 4_000_000_000 })).replace(/=+$/, "")}.s`;
const env = { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public", ANTHROPIC_API_KEY: "test", ACTIONS_TOKEN: "test" };
const gespeichert = bereinigen({ beschreibung: "Originale Firmenbeschreibung für Fliesen.", recherche_version: 2, recherchiert_am: "2026-10-30T10:00:00Z", websuche_beschreibung: "Frühere Recherche mit Fliesenarbeiten.", leistungen: [{ name: "Fliesen", cpv: ["45431"], woerter: ["fliesen"] }], standorte: [{ name: "Aachen", plz_praefixe: ["52"], bereich_id: bereich }], laender: ["DEU", "NLD"], ausschluss: ["neubau"] });

function api(t: TestContext, rolle = "inhaber", neu = false) {
  const schreibt: { pfad: string; body: any; token: string | null }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    const methode = init?.method ?? "GET";
    const pfad = u.pathname.split("/rest/v1/")[1] ?? u.pathname;
    if (methode !== "GET") {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      schreibt.push({ pfad, body, token: new Headers(init?.headers).get("authorization") });
      if (pfad === "bereiche") return Response.json([{ id: bereich, name: body.name, art: "standort", parent_id: null }]);
      return new Response(null, { status: 204 });
    }
    if (pfad === "mitglieder") return Response.json([{ rolle, firmen: { name: "Musterfirma", website: "https://alt.example", plz: "52062", ort: "Aachen" } }]);
    if (pfad === "bereiche") return Response.json([{ id: bereich, name: "Aachen", art: "standort", parent_id: null }]);
    if (pfad === "suchprofile") return Response.json(neu ? [] : [{ id: "profil", beschreibung: gespeichert.beschreibung, einstellungen: gespeichert, erstlauf: "2026-10-30T11:00:00Z", fertig: "2026-10-30T11:10:00Z" }]);
    throw new Error(`Unerwarteter Abruf: ${u}`);
  });
  return schreibt;
}

function request(form: FormData) {
  form.set("firma", firma);
  return new Request("https://jarvis.test/konto/einrichtung/automatisch", { method: "POST", headers: { cookie: `jv_at=${token}` }, body: form });
}

function dienste(aufrufe: RechercheAngaben[], fehler = false) {
  return {
    website: async (website: string) => ({ text: `Leistungen von ${website}: Fliesen und Naturstein.`, hinweis: "Website gelesen." }),
    recherche: async (_: unknown, angaben: RechercheAngaben) => {
      aufrufe.push(angaben);
      if (fehler) throw new Error("Die öffentliche Recherche ist vorübergehend nicht erreichbar.");
      return { profil: bereinigen({ website_beschreibung: "Fliesen und Naturstein auf der Website.", websuche_beschreibung: "Neue Recherche bestätigt Natursteinarbeiten.", leistungen: [{ name: "Naturstein", cpv: ["45431"], woerter: ["naturstein"] }] }), suchanfragen: 2 };
    },
  };
}

test("erneute Recherche nutzt aktuelle Formulareingaben und speichert auch bei bereits recherchiertem Profil neu", async (t) => {
  const schreibt = api(t);
  const form = profilZuFormular({ ...gespeichert, beschreibung: "Aktuell bearbeitete Firmenbeschreibung." }, "https://neu.example");
  form.set("aktion", "recherche");
  const aufrufe: RechercheAngaben[] = [];
  const r = await einrichtung(request(form), env, () => "", dienste(aufrufe));
  assert.equal(r?.status, 303);
  assert.match(decodeURIComponent(r!.headers.get("location")!), /Firmeninfos aktualisiert: 1 Arbeitsbereiche/);
  assert.equal(aufrufe.length, 1);
  assert.equal(aufrufe[0].website, "https://neu.example");
  assert.equal(aufrufe[0].beschreibung, "Aktuell bearbeitete Firmenbeschreibung.");
  assert.equal(aufrufe[0].orte, "Aachen");
  const profil = schreibt.find((x) => x.pfad === "suchprofile")!.body;
  assert.equal(profil.beschreibung, aufrufe[0].beschreibung);
  assert.match(profil.woerter, /naturstein/);
  assert.ok(Date.parse(profil.einstellungen.recherchiert_am) > Date.parse(gespeichert.recherchiert_am!));
  assert.deepEqual(profil.einstellungen.laender, gespeichert.laender);
  assert.equal(profil.einstellungen.erstlauf_fertig, "2026-10-30T11:10:00Z");
  assert.ok(schreibt.every((x) => x.token === `Bearer ${token}`), "alle Schreibzugriffe bleiben im Benutzerkontext");
  assert.equal(schreibt.some((x) => x.pfad === "benachrichtigungen" || x.pfad.includes("dispatches")), false, "erneute Recherche löst nur die benannte Aktion aus");
});

test("Fehler bei erneuter Recherche erhalten Formularwerte und überschreiben kein bestehendes Profil", async (t) => {
  const schreibt = api(t);
  const form = profilZuFormular({ ...gespeichert, beschreibung: "Noch nicht gespeicherte Firmenbeschreibung." }, "https://neu.example");
  form.set("aktion", "recherche");
  const r = await einrichtung(request(form), env, () => "", dienste([], true));
  assert.equal(r?.status, 502);
  const html = await r!.text();
  assert.match(html, /Noch nicht gespeicherte Firmenbeschreibung/);
  assert.match(html, /value="https:\/\/neu.example"/);
  assert.match(html, /Firmenrecherche wurde nicht abgeschlossen/);
  assert.equal(schreibt.length, 0);
});

test("unerlaubter Website-Wechsel startet keine kostenpflichtige Recherche", async (t) => {
  const schreibt = api(t, "admin");
  const aufrufe: RechercheAngaben[] = [];
  const r = await einrichtung(request(profilZuFormular(gespeichert, "https://neu.example")), env, () => "", dienste(aufrufe));
  assert.equal(r?.status, 403);
  assert.equal(aufrufe.length, 0);
  assert.equal(schreibt.length, 0);
});

test("automatische Ersteinrichtung speichert weiter und startet die erste Ausschreibungssuche", async (t) => {
  const schreibt = api(t, "inhaber", true);
  const r = await einrichtung(request(new FormData()), env, () => "", dienste([]));
  assert.equal(r?.headers.get("location"), `/konto?firma=${firma}`);
  assert.equal(schreibt.filter((x) => x.pfad.includes("dispatches")).length, 1);
  assert.equal(schreibt.some((x) => x.pfad === "benachrichtigungen"), false);
});

test("neue Firma bekommt die automatische Prüfseite ohne manuelle Suchprofil-Einrichtung", async (t) => {
  api(t, "inhaber", true);
  const r = await einrichtung(new Request(`https://jarvis.test/konto/einrichtung?firma=${firma}`, { headers: { cookie: `jv_at=${token}` } }), env, () => "");
  const html = await r!.text();
  assert.match(html, /data-auto-einrichtung/);
  assert.match(html, /Firma prüfen und Suche einrichten/);
  assert.match(html, /Leistungen und Standorte/);
  assert.doesNotMatch(html, /name="l0_name"/);
});

test("Budgetfehler beim Erstlauf hält die Eingaben dauerhaft und zeigt den klaren Wiederholungsknopf", async (t) => {
  const schreibt = api(t, "inhaber", true);
  const form = new FormData(); form.set("website", "https://neu.example"); form.set("beschreibung", "Eigene neue Beschreibung bleibt erhalten.");
  const dienst = dienste([]);
  dienst.recherche = async () => { throw new Error("Connection error.", { cause: new Error("KI-Budget ist erreicht") }); };
  const r = await einrichtung(request(form), env, () => "", dienst);
  const html = await r!.text();
  assert.match(html, /KI-Tages- oder Monatsbudget/);
  assert.doesNotMatch(html, /Connection error/);
  assert.match(html, /Firmenprüfung erneut versuchen/);
  assert.doesNotMatch(html, /data-auto-einrichtung|Speichern und Ausschreibungen suchen/);
  const gespeichert = schreibt.find((x) => x.pfad === "suchprofile")!;
  assert.equal(gespeichert.body.beschreibung, "Eigene neue Beschreibung bleibt erhalten.");
  assert.equal(gespeichert.body.einstellungen.recherche_status, "wartet");
  assert.equal(gespeichert.body.einstellungen.recherche_website, "https://neu.example");
  assert.equal(gespeichert.token, `Bearer ${token}`);
  assert.equal(schreibt.some((x) => x.pfad.includes("dispatches")), false);
});

test("16 recherchierte Niederlassungen werden angelegt, gespeichert und erweitern nicht das gewählte Suchgebiet", async (t) => {
  const schreibt = api(t);
  const dienst = dienste([]);
  const original = dienst.recherche;
  dienst.recherche = async (...args) => {
    const r = await original(...args);
    r.profil.firmenstandorte = Array.from({ length: 16 }, (_, i) => ({ name: `Niederlassung ${i}`, plz: "", quelle: "https://firma.example/standorte" }));
    return r;
  };
  const form = new FormData(); form.set("aktion", "recherche");
  const r = await einrichtung(request(form), env, () => "", dienst);
  assert.equal(r?.status, 303);
  assert.equal(schreibt.filter((x) => x.pfad === "bereiche").length, 16);
  const p = schreibt.find((x) => x.pfad === "suchprofile")!.body.einstellungen;
  assert.equal(p.firmenstandorte.length, 16);
  assert.ok(p.firmenstandorte.every((o: { bereich_id?: string }) => o.bereich_id));
  assert.deepEqual(p.standorte, gespeichert.standorte);
});
