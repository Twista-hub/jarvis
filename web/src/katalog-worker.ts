import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { unzipSync } from "fflate";
import { nachholLimit, releaseBloecke, normalisiereBlock } from "./katalog-plan.ts";

type Env = DbEnv & { AKTIV: string; SAMMLER: Workflow };
const UA = "Jarvis-Katalog/1.0 (public procurement index)";
import { katalogDb, type DbEnv } from "./katalog-db.ts";
export class KatalogSammler extends WorkflowEntrypoint<Env> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const limit = nachholLimit(_event.payload);
    const fehlgeschlagen: string[] = [];
    const tage = await step.do("Aufträge vorbereiten", async () => katalogDb(this.env, async (sql) => {
      const [quelle] = await sql`select erlaubt from public.katalog_quellen where id='bks'`;
      if (!quelle?.erlaubt) throw new Error("Quelle nicht freigegeben");
      // Never evade a source's robots restrictions. A changed policy pauses collection.
      const robots = await fetch("https://oeffentlichevergabe.de/robots.txt", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (robots.status !== 404) {
        if (!robots.ok) throw new Error("robots.txt nicht prüfbar");
        const text = await robots.text();
        if (/^\s*Disallow\s*:\s*\S/im.test(text)) throw new Error("Quellenregeln geändert; erneute Prüfung nötig");
      }
      if ((await sql`select pg_database_size(current_database()) as groesse`)[0].groesse > 350_000_000) throw new Error("Speichergrenze erreicht; Sammlung pausiert");
      if ((await sql`select count(*)::int as n from public.vergabekatalog`)[0].n > 50000) throw new Error("Bestandsgrenze erreicht; Sammlung pausiert");
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const backfill = await sql`select d::date::text as tag from generate_series(current_date-60,current_date-2,interval '1 day') d left join jarvis_katalog.exporte e on e.quelle='bks' and e.tag=d::date where coalesce(e.fertig,false)=false and (e.naechster_versuch is null or e.naechster_versuch<now()) order by d desc limit ${limit}`;
      await sql`update public.katalog_quellen set letzter_versuch=now() where id='bks'`;
      // Bound operational tables without discarding current notices or customer records.
      await sql`delete from public.katalog_aenderungen where zeit<now()-interval '90 days'`;
      await sql`delete from jarvis_katalog.bewertungen where erstellt<now()-interval '180 days'`;
      return [...new Set([today, yesterday, ...backfill.map((x) => String(x.tag))])];
    }));
    for (const tag of tage) {
      await step.do(`Export ${tag}`, { retries: { limit: 2, delay: "30 seconds", backoff: "exponential" }, timeout: "5 minutes" }, async () => {
        try {
          return await katalogDb(this.env, async (sql) => {
            if ((await sql`select pg_database_size(current_database()) as groesse`)[0].groesse > 350_000_000 || (await sql`select count(*)::int as n from public.vergabekatalog`)[0].n >= 50000) throw new Error("Speichergrenze erreicht");
            const [alt] = await sql`select * from jarvis_katalog.exporte where quelle='bks' and tag=${tag}`;
            if (alt?.naechster_versuch && new Date(alt.naechster_versuch).getTime() > Date.now()) return;
            const headers: Record<string, string> = { "User-Agent": UA };
            if (alt?.etag && alt.fertig) headers["If-None-Match"] = alt.etag;
            const response = await fetch(`https://oeffentlichevergabe.de/api/notice-exports?pubDay=${tag}&format=ocds.zip`, { headers, signal: AbortSignal.timeout(90000) });
            if (response.status === 304) {
              await sql`update public.katalog_quellen set letzter_erfolg=now(),fehler=null where id='bks'`;
              return;
            }
            if (!response.ok) throw new Error(`Export HTTP ${response.status}`);
            if (Number(response.headers.get("content-length")) > 24_000_000) throw new Error("Export zu groß");
            // Read a bounded stream rather than allocating an unbounded body.
            const reader = response.body!.getReader(); let total = 0; const chunks: Uint8Array[] = [];
            try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > 24_000_000) throw new Error("Export zu groß"); chunks.push(value); } } finally { await reader.cancel(); }
            const zip = new Uint8Array(total); let offset = 0; for (const c of chunks) { zip.set(c, offset); offset += c.length; }
            const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", zip))).map((x) => x.toString(16).padStart(2, "0")).join("");
            if (checksum !== alt?.checksum) {
              let expanded = 0;
              const files = unzipSync(zip, { filter: (file) => { expanded += file.originalSize; if (expanded > 24_000_000) throw new Error("Entpackgrenze erreicht"); return file.name.endsWith(".json"); } });
              for (const teil of releaseBloecke(Object.values(files))) {
                  const ids = teil.map((rel: any) => `bks:${rel.ocid || rel.id}`);
                  const bisher = await sql`select id,roh,quell_datum from public.vergabekatalog where id=any(${ids}::text[])`;
                  const bestehend = new Map(bisher.map((r) => [String(r.id), { roh: r.roh, quell_datum: r.quell_datum }]));
                  const batch = await normalisiereBlock(teil, bestehend, tag);
                  if (batch.length) await sql`select jarvis_katalog.aufnehmen(${sql.json(batch)})`;
              }
            }
            await sql`insert into jarvis_katalog.exporte(quelle,tag,etag,checksum,zuletzt,fertig,versuche) values('bks',${tag},${response.headers.get("etag")},${checksum},now(),true,0) on conflict(quelle,tag) do update set etag=excluded.etag,checksum=excluded.checksum,zuletzt=now(),fertig=true,versuche=0,naechster_versuch=null`;
            await sql`update public.katalog_quellen set letzter_erfolg=now(),fehler=null,bestand_ab=(select min(tag) from jarvis_katalog.exporte where quelle='bks' and fertig),bestand_bis=(select max(tag) from jarvis_katalog.exporte where quelle='bks' and fertig),rueckstand_tage=(select count(*) from generate_series(current_date-60,current_date-1,interval '1 day') d where not exists(select 1 from jarvis_katalog.exporte e where e.quelle='bks' and e.tag=d::date and e.fertig)) where id='bks'`;
          });
        } catch (e) {
          fehlgeschlagen.push(tag);
          console.error(`Export ${tag}: ${e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen"}`);
          await katalogDb(this.env, async (sql) => {
            await sql`insert into jarvis_katalog.exporte(quelle,tag,versuche,naechster_versuch) values('bks',${tag},1,now()+interval '1 hour') on conflict(quelle,tag) do update set fertig=false,versuche=jarvis_katalog.exporte.versuche+1,naechster_versuch=now()+least(interval '24 hours',interval '1 hour'*power(2,least(jarvis_katalog.exporte.versuche,4)))`;
            await sql`update public.katalog_quellen set fehler='Ein Export konnte nicht verarbeitet werden. Wiederholung ist eingeplant.' where id='bks'`;
          });
          // Keep processing other days; this failed day remains in the persistent retry queue.
        }
      });
    }
    return step.do("Importstand melden", async () => katalogDb(this.env, async (sql) => {
      const [stand] = await sql`select count(*)::int as offen from generate_series(current_date-60,current_date-1,interval '1 day') d where not exists(select 1 from jarvis_katalog.exporte e where e.quelle='bks' and e.tag=d::date and e.fertig)`;
      await sql`update public.katalog_quellen set rueckstand_tage=${stand.offen},fehler=${fehlgeschlagen.length ? `${fehlgeschlagen.length} Tagesimporte fehlgeschlagen; Wiederholung eingeplant.` : null} where id='bks'`;
      return { importtage_offen: stand.offen, fehlgeschlagen };
    }));
  }
}
export default {
  fetch() { return new Response("Nicht gefunden", { status: 404 }); },
  async scheduled(event: ScheduledController, env: Env) {
    if (env.AKTIV !== "1") return;
    await env.SAMMLER.create({ id: `bks-${Math.floor(event.scheduledTime / 3600000)}` });
  },
};
