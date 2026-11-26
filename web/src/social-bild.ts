// Pictures of the automatic Facebook/Instagram posts (alarm/social_meta.py, 26.11.2026). Instagram takes a picture
// only from a public address, so the Social run stores it in the bucket under social/ and this route hands it out.
// Only names of the form 2026-11-27-zahl.jpg under social/ are reachable; everything else in the bucket stays private.
const NAME = /^\/social\/bild\/(\d{4}-\d{2}-\d{2}-[a-z]{3,20}\.jpg)$/;

/** Bucket key for a public post picture, or null when the path is not one. */
export function socialBildSchluessel(pfad: string): string | null {
  const m = NAME.exec(pfad);
  return m ? `social/${m[1]}` : null;
}

export async function socialBild(pfad: string, env: { DATEN: R2Bucket }): Promise<Response | null> {
  const schluessel = socialBildSchluessel(pfad);
  if (!schluessel) return null;
  const bild = await env.DATEN.get(schluessel);
  if (!bild) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  return new Response(bild.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
}
