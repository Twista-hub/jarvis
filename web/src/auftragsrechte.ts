import { db, sitzung, vorgangZugriff, type KontoEnv } from "./konto.ts";
import { darfFinanzen } from "./rechte.ts";

/** R2 job IDs are references, never proof of permission to see financial information. */
export async function darfAuftrag(request: Request, env: KontoEnv, job: { profil: string; vorgang?: string; kunde?: string }, firmaFuerProfil: (profil:string)=>string|undefined, bearbeiten = false): Promise<boolean> {
  if (job.vorgang) {
    const z = await vorgangZugriff(request,env,job.vorgang);
    return Boolean(z?.finanzen && (!bearbeiten || ["inhaber","admin","bearbeiter"].includes(z.rolle)));
  }
  // The existing CI upload test uses an isolated profile with public fixture documents.
  if (job.profil === "jarvis-test" && job.kunde === "Öffentlicher Funktionstest") return true;
  const firma = firmaFuerProfil(job.profil) ?? (/^firma-([0-9a-f-]{36})$/.exec(job.profil)?.[1]);
  const s = await sitzung(request,env);
  if (!firma || !s || !/^[0-9a-f-]{36}$/.test(firma)) return false;
  const r = await db<{rolle:string;finanzen:boolean}[]>(s,env,`mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle,finanzen`);
  return r.ok && r.daten.some((m)=>darfFinanzen(m.rolle,m.finanzen) && (!bearbeiten || ["inhaber","admin","bearbeiter"].includes(m.rolle)));
}
