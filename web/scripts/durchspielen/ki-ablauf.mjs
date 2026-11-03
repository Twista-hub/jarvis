// End-to-end flows with the real Claude API against the test server (server.ts) and the throwaway database:
// 1. sign-up -> new firm -> automatic company research (website + web search) -> search profile
// 2. receipts: "Auslesen lassen" on synthetic receipts (alarm/musterbelege.py)
// 3. company proofs: upload, Jarvis reads the expiry date (alarm/musternachweise.py)
// 4. tender documents (public Bundesbank tender) -> Steckbrief with lots -> calculation
// Prints what happened (invented data and public documents only) and the AI costs booked.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const APP = process.env.APP ?? "http://127.0.0.1:8790";
const INHABER = "0000000b-0000-4000-8000-00000000be01", NEU = "0000000b-0000-4000-8000-00000000ae01";
const [BELEGE, NACHWEISE, UNTERLAGEN] = process.argv.slice(2);
const sql = (q) => execFileSync("psql", ["-tA", "-c", q]).toString().trim();
const text = (html) => html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
const ergebnis = [];
const melde = (bereich, ok, was) => { ergebnis.push({ bereich, ok, was }); console.log(`${ok ? "✅" : "❌"} [${bereich}] ${was}`); };
async function app(pfad, { nutzer = INHABER, firma, body, methode } = {}) {
  const cookie = `test_nutzer=${nutzer}${firma ? `; jv_firma=${firma}` : ""}`;
  const r = await fetch(APP + pfad, { method: methode ?? (body ? "POST" : "GET"), body, headers: { cookie }, redirect: "manual" });
  return { status: r.status, ort: r.headers.get("location") ?? "", html: await r.text() };
}
const NUR = (process.env.NUR ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const teil = (name) => !NUR.length || NUR.includes(name);
const t0 = Date.now(); const dauer = () => `${Math.round((Date.now() - t0) / 1000)} s`;
const demo = sql("select id from public.firmen where name = 'Rheinland Facility Service GmbH (Beispiel)'");

// ---------- 1. Sign-up, new firm, automatic research ----------
if (teil("recherche")) try {
  let r = await app("/konto", { nutzer: NEU });
  melde("Einstieg", /firma|Firma/.test(text(r.html)), `Neues Konto ohne Firma: Startseite fragt nach der Firma (HTTP ${r.status})`);
  r = await app("/konto/firma", { nutzer: NEU, body: new URLSearchParams({ name: "WP Digital Ranger" }) });
  const firma = /firma=([0-9a-f-]{36})/.exec(r.ort)?.[1];
  melde("Einstieg", !!firma, `Firma angelegt, weiter zu ${r.ort.replace(/[0-9a-f-]{36}/, ":id")}`);
  r = await app(`/konto/einrichtung?firma=${firma}`, { nutzer: NEU, firma });
  const form = /<form[^>]*action="\/konto\/einrichtung\/automatisch"[\s\S]*?<\/form>/.exec(r.html)?.[0] ?? "";
  const felder = new URLSearchParams();
  const roh = (v) => (v ?? "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const m of form.matchAll(/<input\b[^>]*>/g)) { const n = /name="([^"]+)"/.exec(m[0])?.[1]; if (n) felder.set(n, roh(/value="([^"]*)"/.exec(m[0])?.[1])); }
  for (const m of form.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) felder.set(m[1], roh(m[2]));
  felder.set("website", "https://wpdigitalranger.com");
  melde("Einstieg", form.length > 0, `Seite „Firma prüfen“ startet die automatische Prüfung (Felder: ${[...felder.keys()].join(", ")})`);
  const tr = Date.now();
  r = await app("/konto/einrichtung/automatisch", { nutzer: NEU, firma, body: felder });
  const sek = Math.round((Date.now() - tr) / 1000);
  const e = JSON.parse(sql(`select coalesce(einstellungen, '{}')::text from public.suchprofile where firma_id = '${firma}' and bereich_id is null`) || "{}");
  const leistungen = (e.leistungen ?? []).map((l) => `${l.name} (${(l.woerter ?? []).slice(0, 4).join(", ")})`);
  melde("Firmenrecherche", leistungen.length > 0, `${sek} s, ${leistungen.length} Arbeitsbereiche: ${leistungen.join(" · ").slice(0, 400)}`);
  melde("Firmenrecherche", Boolean(e.website_beschreibung), `Website gelesen: ${(e.website_beschreibung ?? "").slice(0, 300) || "nichts"}${e.website_hinweis ? ` (Hinweis: ${e.website_hinweis})` : ""}`);
  melde("Firmenrecherche", true, `Quellen: ${(e.websuche_quellen ?? []).map((q) => q.url).slice(0, 4).join(", ") || "keine"}; Standorte: ${(e.firmenstandorte ?? e.standorte ?? []).map((o) => o.name).join(", ") || "keine"}`);
  const seite = text(r.html || (await app(r.ort || `/konto/suchprofil?firma=${firma}`, { nutzer: NEU, firma })).html);
  melde("Firmenrecherche", !/schiefgegangen/.test(seite), `Danach angezeigt: ${seite.slice(0, 300)}`);
} catch (e) { melde("Firmenrecherche", false, `Abbruch: ${String(e).slice(0, 200)}`); }

// ---------- 2. Receipts ----------
if (teil("belege")) try {
  const wahr = JSON.parse(readFileSync(join(BELEGE, "wahrheit.json"), "utf8"));
  let richtig = 0, gesamt = 0;
  for (const datei of Object.keys(wahr).slice(0, 8)) {
    const fd = new FormData();
    fd.set("aktion", "lesen"); fd.set("monat", wahr[datei].datum.slice(0, 7));
    fd.set("beleg", new Blob([readFileSync(join(BELEGE, datei))], { type: datei.endsWith(".pdf") ? "application/pdf" : datei.endsWith(".png") ? "image/png" : "image/jpeg" }), datei);
    const r = await app("/konto/belege", { firma: demo, body: fd });
    const wert = (n) => new RegExp(`name="${n}"[^>]*value="([^"]*)"`).exec(r.html)?.[1] ?? "";
    const kat = /<select name="kategorie">[\s\S]*?<option value="([a-z]+)" selected/.exec(r.html)?.[1] ?? "";
    const brutto = Number(wert("brutto").replace(",", "."));
    const ok = wert("datum") === wahr[datei].datum && Math.abs(brutto - wahr[datei].brutto) < 0.01;
    gesamt++; if (ok) richtig++;
    melde("Belege lesen", ok, `${datei}: Datum ${wert("datum")} (soll ${wahr[datei].datum}), Betrag ${brutto} (soll ${wahr[datei].brutto}), Lieferant „${wert("lieferant")}“, Kategorie ${kat || "–"} (soll ${wahr[datei].kategorie})`);
  }
  melde("Belege lesen", richtig === gesamt, `${richtig} von ${gesamt} Belegen mit richtigem Datum und Betrag`);
} catch (e) { melde("Belege lesen", false, `Abbruch: ${String(e).slice(0, 200)}`); }

// ---------- 3. Company proofs: expiry date ----------
if (teil("nachweise")) try {
  const wahr = JSON.parse(readFileSync(join(NACHWEISE, "wahrheit.json"), "utf8"));
  let richtig = 0;
  for (const [datei, soll] of Object.entries(wahr)) {
    const fd = new FormData();
    fd.set("firma", demo); fd.set("art", "nachweis"); fd.set("name", `Test ${datei}`);
    fd.set("datei", new Blob([readFileSync(join(NACHWEISE, datei))], { type: "image/png" }), datei);
    await app(`/konto/firmenunterlagen?firma=${demo}`, { firma: demo, body: fd });
    const ist = sql(`select coalesce(gueltig_bis::text, '') from public.firmenunterlagen where firma_id = '${demo}' and name = 'Test ${datei}'`);
    const ok = [soll].flat().includes(ist);
    if (ok) richtig++;
    melde("Nachweise Datum", ok, `${datei}: erkannt „${ist || "kein Ablauf"}“, erwartet „${[soll].flat().join(" oder ") || "kein Ablauf"}“`);
  }
  melde("Nachweise Datum", richtig === Object.keys(wahr).length, `${richtig} von ${Object.keys(wahr).length} Nachweisen richtig`);
} catch (e) { melde("Nachweise Datum", false, `Abbruch: ${String(e).slice(0, 200)}`); }

// ---------- 4. Tender documents -> Steckbrief -> calculation ----------
if (teil("steckbrief")) try {
  const v = sql(`select id from public.vorgaenge where firma_id = '${demo}' and titel like 'Servicepersonal für Kongresse%'`);
  const fd = new FormData();
  const dateien = readdirSync(UNTERLAGEN).filter((d) => /^(A0|B0|B5)_/.test(d));
  for (const d of dateien) fd.append("dateien", new Blob([readFileSync(join(UNTERLAGEN, d))], { type: "application/pdf" }), d);
  const r = await app(`/konto/vorgang/${v}/unterlagen`, { firma: demo, body: fd });
  melde("Steckbrief", r.status === 303 && !/fehler=/.test(r.ort), `${dateien.length} Vergabeunterlagen hochgeladen (${dateien.map((d) => basename(d).slice(0, 30)).join("; ")}) → ${r.ort.replace(/[0-9a-f-]{36}/, ":id")}`);
  const tw = Date.now();
  await fetch(APP + "/__test/warten");
  const seite = await app(`/konto/vorgang/${v}`, { firma: demo });
  const t = text(seite.html);
  const lose = (seite.html.match(/\bLos\b/g) ?? []).length;
  melde("Steckbrief", /Steckbrief aus den Vergabeunterlagen|Lose|Eignung/.test(t), `nach ${Math.round((Date.now() - tw) / 1000)} s fertig; Seite zeigt ${lose}× „Los“. Auszug: ${t.slice(t.indexOf("Steckbrief"), t.indexOf("Steckbrief") + 700)}`);
  const link = /href="(\/auftrag\/[0-9a-z-]+)#kalkulation"/.exec(seite.html)?.[1];
  melde("Kalkulation", !!link, `Link zur Kalkulation auf der Ausschreibungsseite: ${link ? "vorhanden" : "fehlt"}`);
  const k = await app(link ?? `/konto/vorgang/${v}`, { firma: demo });
  const kt = text(k.html);
  melde("Kalkulation", k.status === 200 && /€/.test(kt), `Kalkulation (HTTP ${k.status}): ${kt.slice(kt.indexOf("Kalkulation"), kt.indexOf("Kalkulation") + 500)}`);
} catch (e) { melde("Steckbrief", false, `Abbruch: ${String(e).slice(0, 200)}`); }

// ---------- AI costs ----------
try {
  console.log("\nKI-Kosten: " + sql("select zweck || ': ' || count(*) || ' Anfragen, ' || round(sum(coalesce(verbraucht, reserviert)), 3) || ' $' from jarvis_katalog.ki_kosten group by zweck").replace(/\n/g, " · "));
} catch (e) { console.log("KI-Kosten nicht lesbar: " + String(e).slice(0, 100)); }
console.log(`\nDauer ${dauer()} · ${ergebnis.filter((x) => x.ok).length} ok, ${ergebnis.filter((x) => !x.ok).length} nicht ok`);
