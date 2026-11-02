// Error alarm (see migration fehler_alarm): the app reports unexpected errors to the operator's phone. The database
// limits repeats, so reporting from many requests at once is harmless.
export type FehlerEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; WARTEN?: (p: Promise<unknown>) => void };

export function fehlerText(e: unknown): string {
  const t = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  // No personal data in the message: drop e-mail addresses and long numbers.
  return t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "…@…").replace(/\d{6,}/g, "…").slice(0, 220);
}

export function fehlerMelden(env: FehlerEnv, art: string, text: string): Promise<void> {
  const p = fetch(`${env.SUPABASE_URL}/rest/v1/rpc/fehler_melden`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ art, text: text.slice(0, 300) }) })
    .then(() => undefined, () => undefined);
  env.WARTEN?.(p);
  return p;
}
