import { db, sitzung, type KontoEnv } from "./konto.ts";

type UploadDienste = {
  pruefen: (dateien: File[]) => Promise<[string, number] | null>;
  starten: (dateien: File[], kontext: { firma: string; vorgang: string; titel: string }) => Promise<{ id: string; erstellt: string }>;
};

export async function unterlagenOhneTreffer(request: Request, env: KontoEnv & { DATEN: R2Bucket }, dienste: UploadDienste): Promise<Response> {
  const s = await sitzung(request, env);
  if (!s) return Response.redirect(new URL("/konto", request.url).toString(), 303);
  const form = await request.formData();
  const firma = String(form.get("firma") ?? "");
  const bereich = String(form.get("bereich") ?? "");
  const zurueck = (text: string) => new Response(null, { status: 303, headers: [["location", `/konto/unterlagen?hinweis=${encodeURIComponent(text)}`], ...s.cookies.map((c): [string, string] => ["set-cookie", c])] });
  if (!/^[0-9a-f-]{36}$/.test(firma) || (bereich && !/^[0-9a-f-]{36}$/.test(bereich))) return zurueck("Bitte wähle eine gültige Firma und einen gültigen Bereich.");
  const rechte = await db<{ rolle: string }[]>(s, env, `mitglieder?firma_id=eq.${firma}&user_id=eq.${s.userId}&aktiv=eq.true&select=rolle`);
  if (!rechte.ok || !rechte.daten.some((m) => ["inhaber", "admin", "bearbeiter"].includes(m.rolle))) return zurueck("Du darfst für diese Firma keine Unterlagen hochladen.");
  const dateien = form.getAll("dateien").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (!dateien.length || dateien.length > 40 || dateien.reduce((sum, f) => sum + f.size, 0) > 60 * 1024 * 1024) return zurueck("Bitte 1 bis 40 Dateien mit insgesamt höchstens 60 MB auswählen.");
  const titel = String(form.get("titel") ?? "").trim().slice(0, 300);
  if (!titel) return zurueck("Bitte gib einen Titel für die Unterlagen ein.");
  const fehler = await dienste.pruefen(dateien);
  if (fehler) return zurueck(fehler[0]);
  // The new tender is checked by the same row permissions as the normal tender list.
  const v = await db<{ id: string }[]>(s, env, "vorgaenge?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ firma_id: firma, bereich_id: bereich || null, titel, status: "pruefen" }) });
  if (!v.ok || !v.daten[0]) return zurueck("Die Ausschreibung konnte nicht angelegt werden. Bitte prüfe deine Bereichsrechte.");
  const job = await dienste.starten(dateien, { firma, vorgang: v.daten[0].id, titel });
  await env.DATEN.put(`auftraege/vorgaenge/${v.daten[0].id}.json`, JSON.stringify({ auftrag: job.id, erstellt: job.erstellt }));
  const response = new Response(null, { status: 303, headers: { location: `/konto/vorgang/${v.daten[0].id}` } });
  for (const c of s.cookies) response.headers.append("set-cookie", c);
  return response;
}
