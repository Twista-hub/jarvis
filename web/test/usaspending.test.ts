import test from "node:test";
import assert from "node:assert/strict";
import { auslaufend, auswerten, gleicheBehoerde, marktKasten, median, vergleichbare } from "../src/usaspending.ts";

const roh = { results: [
  { "Award ID": "36C24824P1027", "Recipient Name": "HAMHED LLC", "Award Amount": 22771169.52, "Start Date": "2024-03-30", "End Date": "2027-08-29", "Awarding Agency": "Department of Veterans Affairs", "Awarding Sub Agency": "Department of Veterans Affairs", Description: "MIAMI VA JANITORIAL CONTRACT", generated_internal_id: "CONT_AWD_36C24824P1027_3600_-NONE-_-NONE-" },
  { "Award ID": "FA282322C0001", "Recipient Name": "GLOBAL CONNECTIONS", "Award Amount": 3000000, "Start Date": "2021-10-01", "End Date": "2026-09-30", "Awarding Agency": "Department of Defense", "Awarding Sub Agency": "Department of the Air Force", Description: "BASE CUSTODIAL", generated_internal_id: "X" },
  { "Award ID": "A3", "Recipient Name": "C", "Award Amount": 1000000, "Start Date": "2024-01-01", "End Date": "2027-12-31", "Awarding Agency": "Department of Veterans Affairs", "Awarding Sub Agency": "", Description: "", generated_internal_id: "Y" },
] };

test("USAspending: Antwort lesen, Median, Link zur Vertragsseite", () => {
  const v = auswerten(roh);
  assert.equal(v.length, 3);
  assert.equal(v[0].link, "https://www.usaspending.gov/award/CONT_AWD_36C24824P1027_3600_-NONE-_-NONE-");
  assert.equal(median(v.map((x) => x.betrag)), 3000000);
  assert.equal(median([]), 0);
});

test("USAspending: Abfrage, Auslauf-Fenster 6–18 Monate, ungültige Eingaben, Ausfall", async () => {
  const alt = globalThis.fetch;
  let body: { filters: { naics_codes: { require: string[] }; place_of_performance_locations: { state: string }[] }; sort: string } | null = null;
  globalThis.fetch = (async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response(JSON.stringify(roh)); }) as typeof fetch;
  try {
    const jetzt = new Date("2026-11-02T12:00:00Z");
    assert.equal((await vergleichbare("561720", "FL", undefined, jetzt))!.length, 3);
    assert.deepEqual(body!.filters.naics_codes.require, ["561720"]);
    assert.equal(body!.filters.place_of_performance_locations[0].state, "FL");
    const a = (await auslaufend("561720", "FL", undefined, jetzt))!;
    assert.deepEqual(a.map((x) => x.id), ["36C24824P1027", "A3"].filter((id) => id !== "A3" || "2027-12-31" <= "2028-05-02"));
    assert.deepEqual(await vergleichbare("abc", "FL"), []);
    globalThis.fetch = (async () => new Response("x", { status: 500 })) as typeof fetch;
    assert.equal(await vergleichbare("561730", "TX", undefined, jetzt), null);
  } finally { globalThis.fetch = alt; }
});

test("USAspending: Kasten mit Median, Vorgänger gleicher Behörde, zweisprachig", () => {
  const v = auswerten(roh);
  const en = marktKasten("561720", "FL", "VETERANS AFFAIRS, DEPARTMENT OF › Department of Veterans Affairs", v, "en");
  assert.match(en, /median <strong>\$3M<\/strong>/);
  const de = marktKasten("561720", "FL", "", v, "de");
  assert.match(de, /Median <strong>3 Mio\. \$<\/strong>/);
  assert.match(de, /us-radar\?naics=561720&amp;staat=FL/);
  assert.match(marktKasten("561720", "FL", "", null, "en"), /not reachable/);
  assert.match(marktKasten("561720", "FL", "", [], "de"), /Keine Bundesverträge/);
  assert.ok(gleicheBehoerde("Department of Veterans Affairs", "VETERANS AFFAIRS, DEPARTMENT OF.VETERANS AFFAIRS, DEPARTMENT OF.246-NETWORK CONTRACT OFFICE 6"));
  assert.ok(gleicheBehoerde("Department of Defense", "DEPT OF DEFENSE.DEPT OF THE ARMY.AMC"));
  assert.ok(!gleicheBehoerde("Department of Defense", "VETERANS AFFAIRS, DEPARTMENT OF"));
  const mitVorgaenger = marktKasten("561720", "FL", "VETERANS AFFAIRS, DEPARTMENT OF.VETERANS AFFAIRS, DEPARTMENT OF.246-NETWORK", v, "de");
  assert.match(mitVorgaenger, /bisherige Auftragnehmer[\s\S]*HAMHED LLC/);
});
