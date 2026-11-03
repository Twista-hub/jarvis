import Anthropic from "@anthropic-ai/sdk";
import { katalogDb, type DbEnv } from "./katalog-db.ts";

export type KiEnv = DbEnv & { ANTHROPIC_API_KEY: string; WARTEN?: (p: Promise<unknown>) => void };
export function webSuchNutzung(tools: unknown): number {
  return Array.isArray(tools) ? tools.reduce((sum, tool) => {
    if (!tool || typeof tool !== "object" || !String((tool as Record<string, unknown>).type ?? "").startsWith("web_search_")) return sum;
    const max = Number((tool as Record<string, unknown>).max_uses ?? 0);
    return sum + (Number.isFinite(max) ? Math.max(0, Math.min(10, Math.floor(max))) : 0);
  }, 0) : 0;
}

export function kiReserve(bytes: number, output: number, inputPreis: number, outputPreis: number, webSuchen = 0): number {
  const tokenReserve = Math.ceil((bytes * inputPreis + output * outputPreis) / 100) / 10000;
  // Web search costs $0.01/request. Reserve an additional $0.03/search for retrieved-text tokens.
  return tokenReserve + Math.max(0, Math.min(10, webSuchen)) * 0.04;
}

export function kiKosten(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; server_tool_use?: { web_search_requests?: number } | null }, inputPreis: number, outputPreis: number): number {
  const tokens = (usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)) * inputPreis + usage.output_tokens * outputPreis;
  return tokens / 1e6 + (usage.server_tool_use?.web_search_requests ?? 0) * 0.01;
}

type Nutzung = Parameters<typeof kiKosten>[0];
/** Usage of a streamed answer (server-sent events): message_start carries input and cache tokens, message_delta the
 * final output tokens (and web searches). null if the stream ended without usage. */
export function streamNutzung(sse: string): Nutzung | null {
  let nutzung: Nutzung | null = null;
  for (const zeile of sse.split("\n")) {
    if (!zeile.startsWith("data:")) continue;
    let e: any;
    try { e = JSON.parse(zeile.slice(5)); } catch { continue; }
    const u = e?.type === "message_start" ? e.message?.usage : e?.type === "message_delta" ? e.usage : null;
    if (!u) continue;
    const alt: Nutzung = nutzung ?? { input_tokens: 0, output_tokens: 0 };
    nutzung = { ...alt, ...Object.fromEntries(Object.entries(u).filter(([, v]) => v !== null && v !== undefined)) } as Nutzung;
  }
  return nutzung && (nutzung.input_tokens || nutzung.output_tokens) ? nutzung : null;
}

/** Reserve the maximum request cost before sending data to the official API.
 * Streamed answers are settled with the real usage read from a copy of the stream; if that copy cannot be read to the
 * end, the reservation stays charged conservatively (ki_reservieren settles it later by estimate).
 */
/** firma: the firm the requests are for; the booking then shows up in that firm's evaluation (N6). */
export function apiClient(env: KiEnv, firma?: string | null): Anthropic {
  const fuer = firma && /^[0-9a-f-]{36}$/.test(firma) ? firma : null;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, fetch: async (input, init) => {
    if (!env.HYPERDRIVE) throw new Error("KI-Budgetprüfung nicht erreichbar. Bitte später erneut versuchen.");
    const body = JSON.parse(String(init?.body ?? "{}"));
    const output = Number(body.max_tokens);
    if (!output || output > 32000) throw new Error("Ungültiges KI-Ausgabelimit");
    const key = String(body.model ?? "");
    const preise = body.fallbacks ? [5, 20] : key.includes("haiku") ? [0.125, 0.5] : key.includes("sonnet") ? [2.5, 10] : [5, 20];
    // A UTF-8 byte is a conservative token bound, including JSON/prompt overhead.
    const worst = kiReserve(new TextEncoder().encode(String(init?.body)).length, output, preise[0], preise[1], webSuchNutzung(body.tools));
    const id = await katalogDb(env, async (sql) => (fuer ? await sql`select jarvis_katalog.ki_reservieren_fuer(${worst}::numeric,'web',${fuer}::uuid) as id` : await sql`select jarvis_katalog.ki_reservieren(${worst}::numeric,'web') as id`)[0]?.id);
    if (!id) throw new Error("Das KI-Tages- oder Monatsbudget oder das KI-Kontingent der Probezeit ist erreicht. Bitte später erneut versuchen.");
    // Settlement runs on its own: when a page stops waiting (time limit), it still records the real cost if the
    // worker lives long enough. Reservations that stay open are settled later by ki_reservieren (estimate).
    const abrechnung = (async () => {
      const response = await fetch(input, init);
      if (!body.stream || !response.ok) {
        let kosten: number | null = response.ok ? null : (response.status >= 400 && response.status < 500 ? 0 : null);
        if (response.ok) {
          const data: any = await response.clone().json().catch(() => null);
          if (data?.usage) kosten = kiKosten(data.usage, preise[0], preise[1]);
        }
        if (kosten !== null) await katalogDb(env, async (sql) => { await sql`select jarvis_katalog.ki_abschliessen(${id},${kosten}::numeric), jarvis_katalog.ki_protokoll(${id},${key},${response.headers.get("request-id") ?? ""})`; });
      } else if (response.body) {
        // Before 03.11.2026 streams kept the worst-case reservation (Steckbrief booked at ~1.2-2.5 $ instead of ~0.4-0.8 $).
        const [fuerSdk, fuerAbrechnung] = response.body.tee();
        const lesen = (async () => {
          const nutzung = streamNutzung(await new Response(fuerAbrechnung).text());
          if (nutzung) await katalogDb(env, async (sql) => { await sql`select jarvis_katalog.ki_abschliessen(${id},${kiKosten(nutzung, preise[0], preise[1])}::numeric), jarvis_katalog.ki_protokoll(${id},${key},${response.headers.get("request-id") ?? ""})`; });
        })();
        env.WARTEN?.(lesen.catch(() => undefined));
        return new Response(fuerSdk, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      return response;
    })();
    env.WARTEN?.(abrechnung.catch(() => undefined));
    return abrechnung;
  } });
}

/** Firm of an upload job: "firma-<id>" or a configured profile with firma_id (N6 cost booking). */
export function firmaVonProfil(profil: string | undefined, profile: Record<string, { firma_id?: string }> = {}): string | null {
  if (!profil) return null;
  const m = profil.match(/^firma-([0-9a-f-]{36})$/);
  return m ? m[1] : profile[profil]?.firma_id ?? null;
}
