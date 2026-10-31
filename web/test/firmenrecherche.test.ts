import assert from "node:assert/strict";
import { test } from "node:test";
import { rechercheProfil } from "../src/firmenrecherche.ts";

const angaben = { name: "Beispiel GmbH", website: "https://firma.example", beschreibung: "Unsere eigene Firmenbeschreibung.", orte: "Baesweiler", websiteText: "Fliesen und Mosaikarbeiten für Bad und Küche." };
const suche = {
  stop_reason: "end_turn", content: [
    { type: "server_tool_use", name: "web_search", input: { query: "Beispiel GmbH Baesweiler" } },
    { type: "text", text: "Die Firma verlegt Fliesen und Naturstein.", citations: [{ type: "web_search_result_location", title: "Firmenprofil", url: "https://branchen.example/firma" }] },
  ],
};
function fake(antworten: unknown[]) {
  const aufrufe: any[] = [];
  const client = { beta: { messages: { create: async (parameter: unknown) => { aufrufe.push(parameter); return antworten.shift(); } } } } as any;
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

test("Websuche ohne direkte Website-Inhalte erfindet keinen Website-Fund", async () => {
  const { client } = fake([suche, { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({
    website_beschreibung: "Erfundener direkter Website-Fund", websuche_beschreibung: "Belegte öffentlich recherchierte Fliesenarbeiten.",
    leistungen: [{ name: "Fliesenarbeiten", cpv: [], woerter: ["fliesen"] }],
  }) }] }]);
  const r = await rechercheProfil({ ANTHROPIC_API_KEY: "test" }, { ...angaben, websiteText: "" }, client);
  assert.equal(r.profil.website_beschreibung, "");
  assert.ok(r.profil.websuche_beschreibung);
});

test("Suchfehler in HTTP-200-Antworten und pausierte Recherchen gelten nicht als Erfolg", async () => {
  for (const antwort of [
    { stop_reason: "end_turn", content: [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } }] },
    { ...suche, stop_reason: "pause_turn" },
  ]) {
    const { client, aufrufe } = fake([antwort]);
    await assert.rejects(() => rechercheProfil({ ANTHROPIC_API_KEY: "test" }, angaben, client), /keine belegten Ergebnisse|unvollständig/);
    assert.equal(aufrufe.length, 1);
  }
});
