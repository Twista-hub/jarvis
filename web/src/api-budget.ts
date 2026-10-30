import Anthropic from "@anthropic-ai/sdk";
import { katalogDb } from "./katalog-db.ts";

export type KiEnv = { ANTHROPIC_API_KEY: string; SUPABASE_DB_PASSWORD?: string };
/** Reserve the maximum request cost before sending data to the official API.
 * Streaming reservations stay charged conservatively when exact usage cannot be settled.
 */
export function apiClient(env: KiEnv): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, fetch: async (input, init) => {
    if (!env.SUPABASE_DB_PASSWORD) throw new Error("KI-Budgetprüfung nicht erreichbar. Bitte später erneut versuchen.");
    const body = JSON.parse(String(init?.body ?? "{}"));
    const output = Number(body.max_tokens);
    if (!output || output > 32000) throw new Error("Ungültiges KI-Ausgabelimit");
    const key = String(body.model ?? "");
    const preise = body.fallbacks ? [5, 20] : key.includes("haiku") ? [0.125, 0.5] : key.includes("sonnet") ? [2.5, 10] : [5, 20];
    // A UTF-8 byte is a conservative token bound, including JSON/prompt overhead.
    const worst = Math.ceil((new TextEncoder().encode(String(init?.body)).length * preise[0] + output * preise[1]) / 100) / 10000;
    const id = await katalogDb(env.SUPABASE_DB_PASSWORD, async (sql) => (await sql`select jarvis_katalog.ki_reservieren(${worst},'web') as id`)[0]?.id);
    if (!id) throw new Error("Das KI-Tages- oder Monatsbudget ist erreicht. Bitte später erneut versuchen.");
    const response = await fetch(input, init);
    if (!body.stream || !response.ok) {
      let kosten: number | null = response.ok ? null : (response.status >= 400 && response.status < 500 ? 0 : null);
      if (response.ok) {
        const data: any = await response.clone().json().catch(() => null);
        if (data?.usage) kosten = ((data.usage.input_tokens + (data.usage.cache_creation_input_tokens ?? 0) + (data.usage.cache_read_input_tokens ?? 0)) * preise[0] + data.usage.output_tokens * preise[1]) / 1e6;
      }
      if (kosten !== null) await katalogDb(env.SUPABASE_DB_PASSWORD, async (sql) => { await sql`select jarvis_katalog.ki_abschliessen(${id},${kosten})`; });
    }
    return response;
  } });
}
