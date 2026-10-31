import postgres from "postgres";

/** Database access for Workers. Goes through Cloudflare Hyperdrive: the Supabase pooler presents its own root CA
 * (Supabase Root 2021 CA), which Workers cannot verify themselves; Hyperdrive verifies it (verify-full). */
export type DbEnv = { HYPERDRIVE?: { connectionString: string } };

export async function katalogDb<T>(env: DbEnv, action: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  if (!env.HYPERDRIVE) throw new Error("Datenbankzugang fehlt");
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 1, fetch_types: false });
  try { return await action(sql); } finally { await sql.end({ timeout: 2 }); }
}
