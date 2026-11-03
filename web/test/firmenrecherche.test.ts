import assert from "node:assert/strict";
import { test } from "node:test";
import { rechercheProfil } from "../src/firmenrecherche.ts";
import Anthropic from "@anthropic-ai/sdk";
import { kiFehlerart, kiFehlermeldung } from "../src/ki-fehler.ts";

const angaben = { name: "Beispiel GmbH", website: "https://firma.example", beschreibung: "Unsere eigene Firmenbeschreibung.", orte: "Baesweiler", websiteText: "Fliesen und Mosaikarbeiten für Bad und Küche." };
const suche = {
  stop_reason: "end_turn", content: [
    { type: "server_tool_use", name: "web_search", input: { query: "Beispiel GmbH Baesweiler" } },
    { type: "text", text: "Die Firma verlegt Fliesen und Naturstein.", citations: [{ type: "web_search_result_location", title: "Firmenprofil", url: "https://branchen.example/firma", cited_text: "Die Beispiel GmbH aus Baesweiler verlegt Fliesen." }] },
  ],
};
function fake(antworten: unknown[]) {
  const aufrufe: any[] = [];
  const client = { beta: { messages: { create: async (parameter: unknown) => { aufrufe.push(parameter); const a = antworten.shift(); if (a instanceof Error) throw a; return a; } } } } as any;
  return { client, aufrufe };
}

test("Firmenrecherche trennt zitierte Websuche und JSON-Profil und übernimmt echte Quellen", async () => {
  const { client, aufrufe } = fake([suche, { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({
    beschreibung: "Darf die Originalbeschreibung nicht ersetzen.", website_beschreibung: "Fliesenarbeiten für Bad und Küche.",
    websuche_beschreibung: "Die öffentlich zugeordnete Firma verlegt Naturstein.",
    websuche_quellen: [{ titel: "Erfunden", url: "https://erfunden.example" }],
    leistungen: [{ name: "Fliesen und Naturstein", cpv: ["454310"], woerter: ["fliesen", "naturstein"] }],
  }) }] }]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, client);
  assert.equal(aufrufe.length, 2);
  assert.ok(aufrufe[0].tools.some((t: any) => t.name === "web_search"));
  assert.equal(aufrufe[0].output_config.format, undefined, "Websuche darf kein striktes JSON-Format anfordern");
  assert.equal(aufrufe[1].tools, undefined, "JSON-Stufe verwendet nur bereits gelesene Quelldaten");
  assert.equal(aufrufe[1].output_config.format.type, "json_schema");
  assert.match(aufrufe[1].messages[0].content, /branchen.example/);
  assert.equal(r.profil.beschreibung, angaben.beschreibung);
  assert.deepEqual(r.profil.websuche_quellen, [{ titel: "Firmenprofil", url: "https://branchen.example/firma" }]);
  assert.equal(r.suchanfragen, 1);
});

test("SDK-Verbindungsfehler verdecken die Budgetursache nicht und werden nicht wiederholt", async () => {
  const fehler = new Anthropic.APIConnectionError({ cause: new Error("Das KI-Tages- oder Monatsbudget ist erreicht.") });
  assert.equal(fehler.message, "Connection error.");
  assert.equal(kiFehlerart(fehler), "budget");
  assert.match(kiFehlermeldung(fehler), /KI-Tages- oder Monatsbudget/);
  assert.doesNotMatch(kiFehlermeldung(fehler), /Connection error/);
  const { client, aufrufe } = fake([fehler]);
  await assert.rejects(() => rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, client));
  assert.equal(aufrufe.length, 1);
});

test("ein vorübergehender Verbindungsfehler wird einmal automatisch wiederholt", async () => {
  const antwort = { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ websuche_beschreibung: "Belegte Leistungen", leistungen: [{ name: "Fliesen", cpv: [], woerter: ["fliesen"] }] }) }] };
  const { client, aufrufe } = fake([new Anthropic.APIConnectionError({}), suche, antwort]);
  assert.ok((await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, client)).profil.leistungen?.length);
  assert.equal(aufrufe.length, 3);
});

test("alle belegten Firmenstandorte bleiben erhalten; erfundene Quellen werden entfernt", async () => {
  const firmenstandorte = Array.from({ length: 16 }, (_, i) => ({ name: `Standort ${i + 1}`, plz: "", quelle: "https://firma.example/standorte" }));
  firmenstandorte.push({ name: "Unbelegt", plz: "", quelle: "https://erfunden.example" });
  const { client } = fake([suche, { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({
    websuche_beschreibung: "Belegte eigene Niederlassungen.", leistungen: [{ name: "Fliesen", cpv: [], woerter: ["fliesen"] }], firmenstandorte,
  }) }] }]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, { ...angaben, websiteText: "/standorte: Unsere 16 Niederlassungen." }, client);
  assert.equal(r.profil.firmenstandorte?.length, 16);
  assert.ok(r.profil.firmenstandorte?.every((o) => o.quelle === "https://firma.example/standorte"));
});

test("Websuche ohne direkte Website-Inhalte erfindet keinen Website-Fund", async () => {
  const { client } = fake([suche, { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({
    website_beschreibung: "Erfundener direkter Website-Fund", websuche_beschreibung: "Belegte öffentlich recherchierte Fliesenarbeiten.",
    leistungen: [{ name: "Fliesenarbeiten", cpv: [], woerter: ["fliesen"] }],
  }) }] }]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, { ...angaben, websiteText: "" }, client);
  assert.equal(r.profil.website_beschreibung, "");
  assert.ok(r.profil.websuche_beschreibung);
});

test("Suchfehler in HTTP-200-Antworten gelten nicht als Erfolg; pausierte Recherche wird fortgesetzt", async () => {
  const { client, aufrufe } = fake([{ stop_reason: "end_turn", content: [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } }] }]);
  await assert.rejects(() => rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, client), /keine belegten Ergebnisse/);
  assert.equal(aufrufe.length, 1);
  const profil = { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ websuche_beschreibung: "Belegte Leistungen", leistungen: [{ name: "Fliesen", cpv: [], woerter: ["fliesen"] }] }) }] };
  const p = fake([{ ...suche, stop_reason: "pause_turn" }, { stop_reason: "end_turn", content: [{ type: "text", text: "Weitere Standorte.", citations: [{ type: "web_search_result_location", title: "Standorte", url: "https://firma.example/standorte" }] }] }, profil]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, p.client);
  assert.equal(p.aufrufe.length, 3);
  assert.equal(p.aufrufe[1].messages.at(-1).role, "assistant", "Fortsetzung schickt die bisherige Antwort mit");
  assert.ok(r.profil.leistungen?.length);
  const m = fake([{ ...suche, stop_reason: "max_tokens" }, profil]);
  assert.ok((await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, m.client)).profil.leistungen?.length, "abgeschnittener Text mit Quellen reicht");
  const ohne = fake([{ stop_reason: "max_tokens", content: [{ type: "text", text: "ohne Quelle" }] }]);
  await assert.rejects(() => rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, ohne.client), /unvollständig/);
  const endlos = fake([{ ...suche, stop_reason: "pause_turn" }, { ...suche, stop_reason: "pause_turn" }, { ...suche, stop_reason: "pause_turn" }]);
  await assert.rejects(() => rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, endlos.client), /unvollständig \(pause_turn\)/);
  assert.equal(endlos.aufrufe.length, 3);
});

test("Treffer gleichnamiger oder ähnlich heißender Firmen zählen nicht als Quelle", async () => {
  const { namensKern, zuordenbar } = await import("../src/firmenrecherche.ts");
  assert.equal(namensKern("WP Digital Ranger GmbH"), "wp digital ranger");
  assert.equal(namensKern("Müller & Söhne e.K."), "müller söhne");
  const a = { name: "WP Digital Ranger", website: "https://wpdigitalranger.com" };
  assert.ok(zuordenbar("https://www.wpdigitalranger.com/leistungen", "", a), "eigene Website");
  assert.ok(zuordenbar("https://branchenbuch.example/x", "WP Digital Ranger – Webdesign in Übach-Palenberg", a), "voller Name");
  assert.ok(!zuordenbar("https://wp-digital.de/portal", "WP Digital Portal", a), "nur ähnlicher Name");
  assert.ok(!zuordenbar("https://www.digital-ranger.uni-bayreuth.de/", "Digital Ranger Uni Bayreuth", a), "anderes Projekt");
  const suche2 = { stop_reason: "end_turn", content: [
    { type: "server_tool_use", name: "web_search", input: { query: "WP Digital Ranger" } },
    { type: "text", text: "Treffer.", citations: [
      { type: "web_search_result_location", title: "WP Digital", url: "https://wp-digital.de/portal", cited_text: "WP Digital Portal" },
      { type: "web_search_result_location", title: "Leistungen", url: "https://wpdigitalranger.com/leistungen", cited_text: "Webseiten und Apps" }] },
  ] };
  const { client, aufrufe } = fake([suche2, { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ websuche_beschreibung: "Webseiten", leistungen: [{ name: "Webseiten", cpv: [], woerter: ["webdesign"] }] }) }] }]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, { ...a, beschreibung: "", orte: "", websiteText: "Webseiten" }, client);
  assert.deepEqual(r.profil.websuche_quellen?.map((q) => q.url), ["https://wpdigitalranger.com/leistungen"]);
  assert.match(aufrufe[0].system, /site:wpdigitalranger\.com/);
});
