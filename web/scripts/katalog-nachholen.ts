// Catch up catalogue days whose daily export came back empty (10.11.2026).
//
// From 06.11.2026 the daily exports of the Bekanntmachungsservice (pubDay=…, OCDS and eForms) were empty ZIP files, while
// the portal showed new notices and the monthly export (pubMonth=…) contained them (06.11.: 1,128 releases). The hourly
// collector (katalog-worker.ts) marked those days as done with nothing in them, so the catalogue stood still for four days
// and nobody noticed. This script runs in GitHub Actions (the monthly files are too large for the Worker):
//   1. for the last days up to yesterday: is the daily export empty?
//   2. those days are read from the monthly export (same source, CC0 stated in every file) and taken in with the same
//      code as the collector (normalisiereBlock, jarvis_katalog.aufnehmen); deadlines from the monthly eForms export
//   3. it fails (→ workflow „Fehler melden“ → phone message) if the newest notice in the catalogue is older than 3 days
//
// Usage: node --experimental-strip-types scripts/katalog-nachholen.ts [--tage=10] [--probe]
import postgres from "postgres";
import { Unzip, UnzipInflate, strFromU8, unzipSync } from "fflate";
import { eformsKarte, fristenEinsetzen, inStuecken, type EformsFristen } from "../src/katalog-daten.ts";
import { bestehendeBekanntmachungen, normalisiereBlock } from "../src/katalog-plan.ts";

const UA = "Crewtender-Katalog/1.0 (public procurement index)";
const BASIS = "https://oeffentlichevergabe.de/api/notice-exports";
const REF = "juuuifrcxmitkqudqngq";
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Days (YYYY-MM-DD) from `tage` days ago up to yesterday, newest first. */
export function tageBis(heute: string, tage: number): string[] {
  const t0 = Date.parse(`${heute}T00:00:00Z`);
  return Array.from({ length: tage }, (_, i) => new Date(t0 - (i + 1) * 86400000).toISOString().slice(0, 10));
}

/** Number of JSON files in a ZIP without unpacking them. */
export function anzahlJson(zip: Uint8Array): number {
  let n = 0;
  unzipSync(zip, { filter: (f) => { if (f.name.endsWith(".json")) n++; return false; } });
  return n;
}

/** Releases of the wanted days from a monthly OCDS ZIP, file by file (the unpacked month is several hundred MB). */
export function releasesDerTage(zip: Uint8Array, tage: Set<string>): Map<string, any[]> {
  const jeTag = new Map<string, any[]>();
  const unzip = new Unzip((datei) => {
    if (!datei.name.endsWith(".json")) return;
    const teile: Uint8Array[] = [];
    let groesse = 0;
    datei.ondata = (fehler, daten, ende) => {
      if (fehler) throw fehler;
      teile.push(daten); groesse += daten.length;
      if (!ende) return;
      const alles = new Uint8Array(groesse); let o = 0; for (const t of teile) { alles.set(t, o); o += t.length; }
      const pkg = JSON.parse(strFromU8(alles));
      if (!/cc.?zero|creativecommons.org\/publicdomain\/zero/i.test(pkg.license ?? "")) throw new Error("CC0-Lizenz nicht bestätigt");
      for (const rel of pkg.releases ?? []) {
        const tag = String(rel.date ?? "").slice(0, 10);
        if (tage.has(tag)) jeTag.set(tag, [...(jeTag.get(tag) ?? []), rel]);
      }
    };
    datei.start();
  });
  unzip.register(UnzipInflate);
  inStuecken(unzip, zip);
  return jeTag;
}

async function laden(url: string): Promise<Uint8Array> {
  // The source refuses many downloads in a row: wait longer each time instead of pushing on.
  let letzter = "";
  for (const warten of [0, 30000, 90000, 240000]) {
    await pause(warten);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(300000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) { letzter = e instanceof Error ? e.message : String(e); console.log(`${url.split("?")[1]}: ${letzter}`); }
  }
  throw new Error(`Export nicht lesbar: ${letzter}`);
}

async function verbinden(): Promise<postgres.Sql> {
  const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "");
  if (!pw) throw new Error("SUPABASE_DB_PASSWORD fehlt");
  for (const host of ["aws-1-eu-central-1", "aws-0-eu-central-1"]) {
    // Encrypted like the Python jobs (psycopg default); the pooler's own root CA is not in Node's trust store.
    const sql = postgres(`postgresql://postgres.${REF}:${pw}@${host}.pooler.supabase.com:5432/postgres`, { max: 1, prepare: false, connect_timeout: 15, ssl: "require", fetch_types: false });
    try { await sql`select 1`; return sql; } catch { await sql.end({ timeout: 2 }).catch(() => {}); }
  }
  throw new Error("Keine Verbindung zur Datenbank");
}

async function main() {
  const probe = process.argv.includes("--probe");
  const tage = Math.min(40, Math.max(1, Number(process.argv.find((a) => a.startsWith("--tage="))?.slice(7)) || 10));
  const heute = new Date().toISOString().slice(0, 10);
  const leer: string[] = [];
  for (const tag of tageBis(heute, tage)) {
    const n = anzahlJson(await laden(`${BASIS}?pubDay=${tag}&format=ocds.zip`));
    if (!n) leer.push(tag);
    await pause(4000);
  }
  console.log(leer.length ? `Leere Tagesexporte: ${leer.sort().join(", ")}` : `Alle ${tage} Tagesexporte haben Inhalt.`);
  const sql = await verbinden();
  try {
    let aufgenommen = 0;
    for (const monat of [...new Set(leer.map((t) => t.slice(0, 7)))].sort()) {
      const wanted = new Set(leer.filter((t) => t.startsWith(monat)));
      const jeTag = releasesDerTage(await laden(`${BASIS}?pubMonth=${monat}&format=ocds.zip`), wanted);
      console.log(`Monatsexport ${monat}: ${[...wanted].sort().map((t) => `${t}: ${jeTag.get(t)?.length ?? 0}`).join(", ")}`);
      if (![...jeTag.values()].some((r) => r.length) || probe) continue;
      const [{ groesse, n }] = await sql`select pg_database_size(current_database()) as groesse, (select count(*)::int from public.vergabekatalog) as n`;
      if (Number(groesse) > 350_000_000 || n >= 50000) throw new Error("Speicher- oder Bestandsgrenze erreicht; nichts aufgenommen");
      await pause(6000);
      let fristen = new Map<string, EformsFristen>();
      try { fristen = eformsKarte(await laden(`${BASIS}?pubMonth=${monat}&format=eforms.zip`)); } catch (e) { console.log(`eForms ${monat} nicht lesbar, Fristen trägt der Ablauf Katalog-Fristen nach: ${e instanceof Error ? e.message : e}`); }
      for (const tag of [...jeTag.keys()].sort()) {
        const roh = jeTag.get(tag)!; const zuGross: string[] = []; let neu = 0;
        for (let i = 0; i < roh.length; i += 40) {
          const teil = roh.slice(i, i + 40).map((rel) => fristenEinsetzen(rel, fristen));
          const bisher = await bestehendeBekanntmachungen(sql, teil.map((rel) => `bks:${rel.ocid || rel.id}`));
          const bestehend = new Map(bisher.map((r) => [String(r.id), { roh: r.roh, quell_datum: r.quell_datum }]));
          // Already taken in by an earlier run (same or newer state): nothing to write.
          const offen = teil.filter((rel) => { const b = bestehend.get(`bks:${rel.ocid || rel.id}`); return !b || new Date(b.quell_datum).getTime() < Date.parse(rel.date); });
          const batch = await normalisiereBlock(offen, bestehend, tag, zuGross);
          if (batch.length) await sql`select jarvis_katalog.aufnehmen(${sql.json(batch as any)})`;
          neu += batch.length;
        }
        aufgenommen += neu;
        console.log(`${tag}: ${roh.length} Bekanntmachungen gelesen, ${neu} aufgenommen oder aktualisiert${zuGross.length ? `, ${zuGross.length} über dem Größenlimit` : ""}`);
      }
    }
    const [{ neueste, alter }] = await sql`select max(quell_datum) as neueste, extract(epoch from now() - max(quell_datum)) / 3600 as alter from public.vergabekatalog where quelle = 'bks'`;
    console.log(`${probe ? "Probelauf, nichts geschrieben. " : `${aufgenommen} aufgenommen oder aktualisiert. `}Neueste Bekanntmachung im Katalog: ${neueste ? new Date(neueste).toISOString() : "keine"}`);
    // Sunday evening to Monday morning can be quiet; three full days without a new notice never is.
    if (!probe && (alter == null || Number(alter) > 72)) throw new Error(`Katalog veraltet: neueste Bekanntmachung ist ${Math.round(Number(alter) / 24)} Tage alt`);
  } finally { await sql.end({ timeout: 5 }); }
}

if (process.argv[1]?.endsWith("katalog-nachholen.ts")) main().catch((e) => { console.error(`::error::${e instanceof Error ? e.message : e}`); process.exit(1); });
