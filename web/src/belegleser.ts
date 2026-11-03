// Reads a receipt (photo or PDF) with Haiku and pre-fills the receipt form (idea 21). About 0.03 cents per receipt;
// booked on the firm's AI budget (api-budget.ts). The office checks and saves; nothing is saved automatically.
// Prompt and schema are shared with the quality test alarm/belegleser_test.py (web/src/belegleser.json).
import LESER from "./belegleser.json" with { type: "json" };
import { apiClient, type KiEnv } from "./api-budget.ts";

export type Gelesen = { datum: string; lieferant: string; brutto: number; ust_satz: 0 | 7 | 19; gemischt: boolean; kategorie: string; sicher: boolean };
const base64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** Cleans the model's answer: valid date (not in the future, at most 2 years back), amount, rate, category. */
export function gelesenPruefen(roh: unknown, heute: string): Gelesen | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const datum = typeof r.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.datum) && !Number.isNaN(Date.parse(r.datum)) && r.datum <= heute && r.datum >= `${Number(heute.slice(0, 4)) - 2}-01-01` ? r.datum : "";
  const brutto = typeof r.brutto === "number" && r.brutto > 0 && r.brutto <= 1_000_000 ? Math.round(r.brutto * 100) / 100 : 0;
  const satz = [0, 7, 19].includes(Number(r.ust_satz)) ? Number(r.ust_satz) as 0 | 7 | 19 : 19;
  const kategorie = typeof r.kategorie === "string" && (LESER.schema.properties.kategorie.enum as string[]).includes(r.kategorie) ? r.kategorie : "sonstiges";
  return { datum, lieferant: String(r.lieferant ?? "").replace(/\s+/g, " ").trim().slice(0, 160), brutto, ust_satz: satz, gemischt: r.gemischt === true, kategorie, sicher: r.sicher === true && !!datum && brutto > 0 };
}

export async function belegLesen(env: KiEnv, daten: Uint8Array, mime: string, firma: string, heute: string): Promise<Gelesen | null> {
  const quelle = { type: "base64" as const, media_type: mime as never, data: base64(daten) };
  const antwort = await Promise.race([
    apiClient(env, firma).messages.create({
      model: LESER.modell, max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: LESER.schema } },
      system: LESER.system,
      messages: [{ role: "user", content: [mime === "application/pdf" ? { type: "document", source: quelle } : { type: "image", source: quelle }, { type: "text", text: LESER.frage }] as never }],
    } as never) as Promise<{ content: { type: string; text?: string }[]; stop_reason: string }>,
    new Promise<never>((_, nein) => setTimeout(() => nein(new Error("Zeit abgelaufen")), 25_000)),
  ]);
  if (antwort.stop_reason === "refusal") return null;
  try { return gelesenPruefen(JSON.parse(antwort.content.flatMap((b) => (b.type === "text" && b.text ? [b.text] : [])).join("")), heute); } catch { return null; }
}
