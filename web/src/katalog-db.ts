import postgres from "postgres";
const REF = "juuuifrcxmitkqudqngq";
export async function katalogDb<T>(password: string, action: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  if (!password) throw new Error("Datenbankzugang fehlt");
  for (const host of ["aws-1-eu-central-1", "aws-0-eu-central-1"]) {
    const sql = postgres({ host: `${host}.pooler.supabase.com`, port: 5432, database: "postgres", username: `postgres.${REF}`, password, ssl: { rejectUnauthorized: true }, max: 1, prepare: false, connect_timeout: 10, idle_timeout: 1, fetch_types: false });
    try {
      await sql`select 1`;
    } catch { await sql.end({ timeout: 1 }); continue; }
    try { return await action(sql); } finally { await sql.end({ timeout: 2 }); }
  }
  throw new Error("Jarvis-Datenbank nicht erreichbar");
}
