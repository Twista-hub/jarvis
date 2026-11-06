export type KiFehlerart = "budget" | "verbindung" | "zeitlimit" | "dienst";

/** Why AI is paused for a firm (jarvis_katalog.ki_sperrgrund, migration 20261106010000). */
export type KiSperre = "demo" | "probe" | "plan" | "topf" | "anfrage" | "monat" | "tag";
export const KI_SPERRE: Record<KiSperre, string> = {
  demo: "Demo-Modus: Crewtender arbeitet noch ohne KI. Die Probezeit mit KI startet, sobald ihr eure Firmenwebsite angebt.",
  probe: "Das KI-Kontingent der Probezeit ist aufgebraucht. Treffer nach Stichworten gibt es weiter; mit einem Plan geht es sofort mit KI weiter.",
  plan: "Das KI-Kontingent eures Plans ist für diesen Monat aufgebraucht. Treffer nach Stichworten gibt es weiter, ab dem 1. wieder mit KI. Mehr Kontingent gibt es mit einem größeren Plan.",
  topf: "Das KI-Kontingent für Gratis-Konten ist für diesen Monat aufgebraucht. Treffer nach Stichworten gibt es weiter, ab dem 1. wieder mit KI; mit einem Plan sofort.",
  anfrage: "Diese Anfrage ist zu groß für die KI. Bitte weniger oder kleinere Dateien auf einmal hochladen.",
  monat: "Die KI von Crewtender ist für diesen Monat ausgelastet. Treffer nach Stichworten gibt es weiter; wir sind informiert und schalten so schnell wie möglich wieder frei.",
  tag: "Die KI von Crewtender ist für heute ausgelastet. Treffer nach Stichworten gibt es weiter, ab morgen wieder mit KI.",
};
const ALLGEMEIN = "Das KI-Kontingent ist gerade aufgebraucht. Bitte später erneut versuchen.";
export const istSperre = (x: unknown): x is KiSperre => typeof x === "string" && Object.prototype.hasOwnProperty.call(KI_SPERRE, x);

/** Thrown by the API client when no AI budget could be reserved; the message names the reason for the customer. */
export class KiBudgetFehler extends Error {
  readonly grund: KiSperre | null;
  constructor(grund: KiSperre | null) {
    super(`KI-Budget: ${grund ? KI_SPERRE[grund] : ALLGEMEIN}`);
    this.grund = grund;
    this.name = "KiBudgetFehler";
  }
}

/** The customer text of a budget stop anywhere in the cause chain (the SDK wraps it in an APIConnectionError). */
export function kiSperrText(fehler: unknown): string | null {
  const gesehen = new Set<unknown>();
  let aktuell = fehler;
  while (aktuell && typeof aktuell === "object" && !gesehen.has(aktuell) && gesehen.size < 8) {
    gesehen.add(aktuell);
    const m = String((aktuell as { message?: unknown }).message ?? "");
    if (m.startsWith("KI-Budget: ")) return m.slice(11);
    aktuell = (aktuell as { cause?: unknown }).cause;
  }
  return null;
}

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
    case "budget": {
      const grund = kiSperrText(fehler);
      if (grund) return `Die KI-Firmenprüfung ist gerade nicht möglich. ${grund} Deine Angaben bleiben erhalten; du kannst die Prüfung später hier erneut starten.`;
      return "Die KI-Firmenprüfung ist gerade nicht möglich: Ohne Firmenwebsite läuft Crewtender im Demo-Modus ohne KI (Probezeit mit KI startet, sobald ihr eure Website angebt), oder das KI-Budget ist erreicht. Deine Angaben bleiben erhalten. Sobald wieder Budget verfügbar ist, kannst du die Prüfung hier erneut starten.";
    }
    case "zeitlimit": return "Die Firmenprüfung hat zu lange gedauert. Bitte versuche es erneut; du musst nichts neu eingeben.";
    case "verbindung": return "Der Recherchedienst ist gerade nicht erreichbar. Bitte versuche es erneut; du musst nichts neu eingeben.";
    default: return "Die Firmenprüfung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut; du musst nichts neu eingeben.";
  }
}
