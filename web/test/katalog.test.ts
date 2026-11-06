import assert from "node:assert/strict";
import { test } from "node:test";
import { normalisieren, bedarfErkennen, mergeRelease } from "../src/katalog-daten.ts";
import { markt, teilnahmeCheck } from "../src/markt.ts";
import { apiClient } from "../src/api-budget.ts";

const notice = { ocid: "ocds-test-1", date: "2026-10-29T10:00:00Z", tag: ["tender"], buyer: { id: "ORG-0001", name: "Stadt Test" }, parties: [{ id: "ORG-0001", address: { postalCode: "52531", locality: "Übach" } }], tender: { title: "Rahmenvertrag Elektro", description: "Gesucht werden 3 Elektriker mit Führerschein Klasse B. Zwei Referenzen sind erforderlich.", lots: [{ id: "1", title: "Elektriker", tenderPeriod: { endDate: "2020-01-01T12:00:00Z" } }, { id: "2", title: "Schweißer", description: "2 Schweißer mit Schweißprüfung", tenderPeriod: { endDate: "2100-01-01T12:00:00Z" } }] } };

test("Zentraler Datensatz trennt Lose, nennt Fundstellen und behält letzte offene Losfrist", async () => {
  const n = (await normalisieren(notice, "2026-10-29"))!;
  assert.equal(n.frist, "2100-01-01T12:00:00.000Z");
  assert.equal(n.lose.length, 2);
  assert.ok(n.bedarf.some((b) => b.los === "2" && b.name === "Schweißer/in" && b.menge === 2 && b.fundstelle.includes("Schweißprüfung")));
  assert.ok(n.ort.includes("Übach"));
  assert.ok(n.ort.includes("Auftraggeberadresse"));
});
test("Inhaltscache bleibt trotz erneutem Veröffentlichungszeitpunkt gleich; Änderungen wechseln die Version", async () => {
  const a = (await normalisieren(notice, "2026-10-29"))!;
  const b = (await normalisieren({ ...notice, date: "2026-10-30T12:00:00Z" }, "2026-10-30"))!;
  assert.equal(a.version, b.version);
  const c = (await normalisieren({ ocid: notice.ocid, date: "2026-10-31T10:00:00Z", tag: ["tenderCancellation"] }, "2026-10-31", a.roh))!;
  assert.equal(c.status, "aufgehoben");
  assert.equal(c.titel, a.titel);
  assert.notEqual(c.version, a.version);
});
test("Rohdaten behalten die Bekanntmachungs-ID für den eForms-Abruf", async () => {
  const n = (await normalisieren({ ...notice, ocid: "ocds-mnwr74-5c545fc0-7a49-47c7-8a55-74de14e14ccf", id: "7115ab0c-47ab-4401-91bc-76b316afaadd" }, "2026-11-02"))!;
  assert.equal(n.roh.id, "7115ab0c-47ab-4401-91bc-76b316afaadd");
  assert.equal(n.roh.ocid, "ocds-mnwr74-5c545fc0-7a49-47c7-8a55-74de14e14ccf");
  const ohne = (await normalisieren(notice, "2026-10-29"))!;
  assert.equal(ohne.version, (await normalisieren({ ...notice, id: "7115ab0c-47ab-4401-91bc-76b316afaadd" }, "2026-10-29"))!.version);
});
test("Lokale ORG-IDs verbinden unterschiedliche Auftraggeber nicht miteinander", async () => {
  const a = (await normalisieren(notice, "2026-10-29"))!;
  const b = (await normalisieren({ ...notice, ocid: "ocds-test-2", buyer: { id: "ORG-0001", name: "Andere Stadt" } }, "2026-10-29"))!;
  assert.notEqual(a.auftraggeber_id, b.auftraggeber_id);
  assert.notEqual(a.id, b.id);
});
test("Teilaktualisierung eines Loses erhält andere Lose und vorhandene Anforderungen", () => {
  const r = mergeRelease(notice, { tender: { lots: [{ id: "2", title: "Neue Schweißarbeiten" }] } });
  assert.equal(r.tender.lots.length, 2);
  assert.equal(r.tender.lots[1].description, "2 Schweißer mit Schweißprüfung");
  assert.equal(r.tender.description, notice.tender.description);
});
test("Unbekannte Fristen und Mengen bleiben unbekannt; normale Wörter sind keine Berufe", async () => {
  const n = (await normalisieren({ ocid: "unknown", tender: { title: "Dienstleistung", description: "Normalerweise erfolgt die Abnahme schriftlich." } }, "2026-10-30"))!;
  assert.equal(n.frist, null);
  assert.equal(n.status, "unbekannt");
  assert.equal(n.bedarf.length, 0);
});
test("Branchenübergreifende Synonyme werden kanonisch erkannt und behalten ihre Fundstelle", () => {
  const b = bedarfErkennen("Gesucht sind Fachinformatiker Systemintegration und PV-Monteure sowie Schreinerinnen.");
  assert.ok(b.some((x) => x.name === "Fachinformatiker/in" && x.fundstelle.includes("Fachinformatiker Systemintegration")));
  assert.ok(b.some((x) => x.name === "Solar-/Photovoltaikmonteur/in" && x.fundstelle.includes("PV-Monteure")));
  assert.ok(b.some((x) => x.name === "Tischler/in" && x.fundstelle.includes("Schreinerinnen")));
});
test("Teilnahmecheck vergleicht verfügbare Kräfte und ausreichend lange gültige Nachweise", () => {
  const b = bedarfErkennen("3 Elektriker und eine gültige Arbeitnehmerüberlassungserlaubnis");
  b.push({ art: "nachweis", name: "Arbeitnehmerüberlassungserlaubnis", los: "", fundstelle: "Erlaubnis erforderlich" });
  const r = teilnahmeCheck(b, [{ berufe: ["Elektriker/in"], qualifikationen: [], status: "verfuegbar" }, { berufe: ["Elektriker/in"], qualifikationen: [], status: "einsatz" }], [{ id: "d", firma_id: "f", name: "AÜ-Erlaubnis", art: "nachweis", dateiname: "d.pdf", mime: "application/pdf", groesse: 1, gueltig_bis: "2020-01-01" }], "2100-01-01");
  assert.equal(r[0].gefunden, false);
  assert.ok(r[0].status.includes("1 passende"));
  assert.equal(r.at(-1)!.gefunden, false);
  assert.match(teilnahmeCheck([b.at(-1)!], [], null)[0].status, /Finanzfreigabe/);
});
test("Ohne Budgetledger geht keine Anfrage an die KI-API", async (t) => {
  const spy = t.mock.method(globalThis, "fetch", async () => { throw new Error("API darf nicht aufgerufen werden"); });
  await assert.rejects(() => apiClient({ ANTHROPIC_API_KEY: "test" }).messages.create({ model: "test", max_tokens: 10, messages: [{ role: "user", content: "Test" }] }));
  assert.equal(spy.mock.callCount(), 0);
});
test("Eingeschränkte Mitarbeiter dürfen keine Markt- oder Partnerdaten lesen", async (t) => {
  const token = `h.${btoa(JSON.stringify({ sub: "u", exp: 4000000000 }))}.s`;
  const spy = t.mock.method(globalThis, "fetch", async () => Response.json([{ firma_id: "f", rolle: "mitarbeiter", firmen: { name: "Test" } }]));
  const r = await markt(new Request("https://jarvis.test/konto/markt?ansicht=partner", { headers: { cookie: `jv_at=${token}` } }), { SUPABASE_URL: "https://db.test", SUPABASE_KEY: "public" });
  assert.equal(r!.status, 403);
  assert.equal(spy.mock.callCount(), 1);
});

import { zipSync, strToU8 } from "fflate";
import { eformsFristen, eformsKarte, fristenEinsetzen } from "../src/katalog-daten.ts";
const EFORMS = `<ContractNotice><cbc:ID schemeName="notice-id">aaaa-1111</cbc:ID><cbc:ContractFolderID>proc-2222</cbc:ContractFolderID>
<cac:ProcurementProjectLot><cbc:ID schemeName="Lot">LOT-0001</cbc:ID><cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-09+01:00</cbc:EndDate>
<cbc:EndTime>10:30:00+01:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod><cac:AdditionalInformationRequestPeriod><cbc:EndDate>2026-12-01+01:00</cbc:EndDate></cac:AdditionalInformationRequestPeriod></cac:TenderingProcess></cac:ProcurementProjectLot>
<cac:ProcurementProjectLot><cbc:ID schemeName="Lot">LOT-0002</cbc:ID><cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-12+01:00</cbc:EndDate></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess></cac:ProcurementProjectLot></ContractNotice>`;
test("Fristen aus eForms: je Los, späteste als Verfahrensfrist, Fragefrist", () => {
  const r = eformsFristen(EFORMS)!;
  assert.deepEqual(r.ids, ["aaaa-1111", "proc-2222"]);
  assert.equal(r.fristen.lose["LOT-0001"], "2026-12-09T09:30:00.000Z");
  assert.equal(r.fristen.lose["LOT-0002"], "2026-12-12T22:59:59.000Z", "ohne Uhrzeit: Tagesende");
  assert.equal(r.fristen.frist, "2026-12-12T22:59:59.000Z");
  assert.equal(r.fristen.fragefrist, "2026-12-01T22:59:59.000Z");
  assert.equal(eformsFristen("<ContractAwardNotice><cbc:ID schemeName=\"notice-id\">x</cbc:ID></ContractAwardNotice>"), null, "Zuschlag ohne Frist");
});

test("Fristen aus eForms: Export-Zip lesen und in die OCDS-Bekanntmachung einsetzen", async () => {
  const karte = eformsKarte(zipSync({ "aaaa-1111-01.xml": strToU8(EFORMS), "liesmich.txt": strToU8("x") }));
  assert.equal(karte.size, 2);
  const rel = { ocid: "ocds-mnwr74-proc-2222", id: "anders", date: "2026-11-04T08:00:00Z", tender: { title: "Reinigung", lots: [{ id: "LOT-0001", title: "Los 1" }, { id: "LOT-0002", title: "Los 2" }] } };
  const mit = fristenEinsetzen(rel, karte);
  assert.equal(mit.tender.tenderPeriod.endDate, "2026-12-12T22:59:59.000Z", "über die Verfahrens-ID gefunden");
  assert.equal(mit.tender.lots[0].tenderPeriod.endDate, "2026-12-09T09:30:00.000Z");
  assert.equal(mit.tender.enquiryPeriod.endDate, "2026-12-01T22:59:59.000Z");
  assert.equal((rel.tender as any).tenderPeriod, undefined, "Original bleibt unverändert");
  const n = (await normalisieren(mit, "2026-11-04"))!;
  assert.equal(n.frist, "2026-12-12T22:59:59.000Z");
  assert.equal(n.status, "offen");
  assert.equal(n.lose[0].frist, "2026-12-09T09:30:00.000Z");
  const schon = { ...rel, tender: { ...rel.tender, tenderPeriod: { endDate: "2027-01-01T00:00:00Z" } } };
  assert.equal(fristenEinsetzen(schon, karte).tender.tenderPeriod.endDate, "2027-01-01T00:00:00Z", "vorhandene Frist bleibt");
  assert.equal(fristenEinsetzen(rel, new Map()), rel);
});
