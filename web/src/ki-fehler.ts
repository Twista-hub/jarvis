export type KiFehlerart = "budget" | "verbindung" | "zeitlimit" | "dienst";

/** The SDK wraps exceptions from its fetch hook in an APIConnectionError. */
export function kiFehlerart(fehler: unknown): KiFehlerart | undefined {
  const gesehen = new Set<unknown>();
  let aktuell = fehler;
  let art: KiFehlerart | undefined;
  while (aktuell && typeof aktuell === "object" && !gesehen.has(aktuell) && gesehen.size < 8) {
    gesehen.add(aktuell);
    const e = aktuell as { message?: unknown; name?: unknown; cause?: unknown; status?: unknown };
    const text = `${e.name || ""} ${e.message || ""}`;
    if (/budget|KI-Ausgabelimit/i.test(text)) return "budget";
    if (/timeout|timed out|Zeitlimit/i.test(text)) art = "zeitlimit";
    else if (art !== "zeitlimit" && /connection|Verbindung|network|fetch failed|Datenbankzugang/i.test(text)) art = "verbindung";
    if (!art && [429, 500, 502, 503, 529].includes(Number(e.status))) art = "dienst";
    aktuell = e.cause;
  }
  return art;
}

export function kiFehlermeldung(fehler: unknown): string {
  switch (kiFehlerart(fehler)) {
    case "budget": return "Die KI-Firmenprüfung ist gerade nicht möglich: Ohne Firmenwebsite läuft Jarvis im Demo-Modus ohne KI (Probezeit mit KI startet, sobald ihr eure Website angebt), oder das KI-Budget ist erreicht. Deine Angaben bleiben erhalten. Sobald wieder Budget verfügbar ist, kannst du die Prüfung hier erneut starten.";
    case "zeitlimit": return "Die Firmenprüfung hat zu lange gedauert. Bitte versuche es erneut; du musst nichts neu eingeben.";
    case "verbindung": return "Der Recherchedienst ist gerade nicht erreichbar. Bitte versuche es erneut; du musst nichts neu eingeben.";
    default: return "Die Firmenprüfung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut; du musst nichts neu eingeben.";
  }
}
