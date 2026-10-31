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

/** Reserve the maximum request cost before sending data to the official API.
 * Streaming reservations stay charged conservatively when exact usage cannot be settled.
 */
export function apiClient(env: KiEnv): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, fetch: async (input, init) => {
    if (!env.HYPERDRIVE) throw new Error("KI-Budgetprüfung nicht erreichbar. Bitte später erneut versuchen.");
    const body = JSON.parse(String(init?.body ?? "{}"));
    const output = Number(body.max_tokens);
    if (!output || output > 32000) throw new Error("Ungültiges KI-Ausgabelimit");
    const key = String(body.model ?? "");
    const preise = body.fallbacks ? [5, 20] : key.includes("haiku") ? [0.125, 0.5] : key.includes("sonnet") ? [2.5, 10] : [5, 20];
    // A UTF-8 byte is a conservative token bound, including JSON/prompt overhead.
    const worst = kiReserve(new TextEncoder().encode(String(init?.body)).length, output, preise[0], preise[1], webSuchNutzung(body.tools));
    const id = await katalogDb(env, async (sql) => (await sql`select jarvis_katalog.ki_reservieren(${worst}::numeric,'web') as id`)[0]?.id);
    if (!id) throw new Error("Das KI-Tages- oder Monatsbudget ist erreicht. Bitte später erneut versuchen.");
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
        if (kosten !== null) await katalogDb(env, async (sql) => { await sql`select jarvis_katalog.ki_abschliessen(${id},${kosten}::numeric)`; });
      }
      return response;
    })();
    env.WARTEN?.(abrechnung.catch(() => undefined));
    return abrechnung;
  } });
}
