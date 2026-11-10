// Reliable timing for GitHub workflows: started from the Cloudflare cron of the catalogue worker (jarvis-katalog).
/** GitHub skips or delays most scheduled runs of this repository (07.11.2026: 3 of 16 hourly mail runs, no social run).
 *  Cloudflare's cron is reliable, so it starts the hourly mail and the social posts via workflow_dispatch. Both scripts
 *  are idempotent (last mail time, one post per day/slot/network), so an extra GitHub start does no harm. Needs the
 *  secret GH_DISPATCH_TOKEN (fine-grained token, repository Twista-hub/jarvis, Actions: read and write); without it
 *  nothing happens. */
export async function ablaeufeAnstossen(env: { GH_DISPATCH_TOKEN?: string }, jetzt: Date, holen: typeof fetch = fetch): Promise<string[]> {
  if (!env.GH_DISPATCH_TOKEN) return [];
  const stunde = Number(jetzt.toLocaleString("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }));
  // katalog-nachholen.yml: empty daily exports of the source are read from its monthly export (10.11.2026), before the
  // morning mails and once more at midday.
  const ablaeufe = [...([6, 13].includes(stunde) ? ["katalog-nachholen.yml"] : []), ...(stunde >= 7 && stunde <= 20 ? ["mail.yml"] : []), ...(stunde >= 9 && stunde <= 20 ? ["social.yml"] : [])];
  const fehler: string[] = [];
  for (const datei of ablaeufe) {
    const r = await holen(`https://api.github.com/repos/Twista-hub/jarvis/actions/workflows/${datei}/dispatches`, {
      method: "POST", body: JSON.stringify({ ref: "main", ...(datei === "social.yml" ? { inputs: { modus: "posten" } } : {}) }),
      headers: { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "Crewtender-Zeitplan", "x-github-api-version": "2022-11-28" },
    }).catch((e) => ({ ok: false, status: 0, statusText: String(e) }) as Response);
    if (!r.ok) fehler.push(`${datei}: ${r.status}`);
  }
  if (fehler.length) console.log(`Anstoßen fehlgeschlagen: ${fehler.join(", ")}`);
  return ablaeufe;
}
