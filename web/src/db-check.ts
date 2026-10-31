import { katalogDb } from "./katalog-db.ts";
import { apiClient, type KiEnv } from "./api-budget.ts";

/** One-time deployment probe. Zero is rejected before any reservation row is written. */
export async function datenbankPruefen(code: string, hashErwartet: string | undefined, env: KiEnv, ki = false): Promise<Response> {
  if (!hashErwartet || !/^[a-f0-9]{64}$/.test(hashErwartet) || !code) return new Response("Not found", { status: 404 });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)));
  const hash = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== hashErwartet) return new Response("Not found", { status: 404 });
  try {
    const pruefung = await katalogDb(env, async (sql) => (await sql`
      select jarvis_katalog.ki_reservieren(0::numeric, 'web-smoke') is null as budgetfunktion
    `)[0]);
    if (!pruefung?.budgetfunktion) throw new Error("Budgetfunktion nicht erreichbar");
    // Optional: one tiny real request through the same budget path the app uses (costs a fraction of a cent).
    if (ki) {
      const m = await apiClient(env).messages.create({ model: "claude-haiku-5-5", max_tokens: 16, messages: [{ role: "user", content: "Antworte nur mit: ok" }] });
      if (!m.content.length) throw new Error("KI-Antwort leer");
    }
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const fehler = e instanceof Error ? e.message.slice(0, 180) : "Unbekannter Datenbankfehler";
    console.error("Hyperdrive-Verbindungstest fehlgeschlagen", fehler);
    return Response.json({ ok: false, error: fehler }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
