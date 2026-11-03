// Typical proofs in German tenders: recognise them in the Steckbrief and check whether the firm has already
// uploaded them (Firmenunterlagen). Simple word matching, no AI call, so it costs nothing per page view.
import type { FirmenDatei } from "./firmenunterlagen.ts";
import { escape } from "./seite.ts";

export type NachweisTyp = { name: string; muster: RegExp };

export const NACHWEIS_TYPEN: NachweisTyp[] = [
  { name: "Erlaubnis zur Arbeitnehmerüberlassung", muster: /(arbeitnehmer|personal)(ü|ue)berlassung.{0,40}erlaubnis|erlaubnis.{0,40}(ü|ue)berlassung|a(ü|ue)g.{0,3}erlaubnis|an(ü|ue).{0,3}erlaubnis/i },
  { name: "Handelsregisterauszug", muster: /handelsregister/i },
  { name: "Gewerbeanmeldung", muster: /gewerbeanmeldung|gewerbeschein/i },
  { name: "Unbedenklichkeitsbescheinigung Finanzamt", muster: /unbedenklichkeit.{0,40}finanz|finanzamt.{0,40}unbedenklich|steuerliche unbedenklich/i },
  { name: "Unbedenklichkeitsbescheinigung Krankenkasse", muster: /unbedenklichkeit.{0,40}(kranken|sozialversicherung)|(krankenkasse|sozialversicherung).{0,40}unbedenklich/i },
  { name: "Bescheinigung der Berufsgenossenschaft", muster: /berufsgenossenschaft|unfallversicherung/i },
  { name: "Betriebshaftpflichtversicherung", muster: /haftpflicht|versicherungsnachweis|deckungssumme/i },
  { name: "Referenzen", muster: /referenz/i },
  { name: "Auszug aus dem Gewerbezentralregister", muster: /gewerbezentralregister/i },
  { name: "Führungszeugnis", muster: /f(ü|ue)hrungszeugnis/i },
  { name: "Tariftreue- und Mindestlohnerklärung", muster: /tariftreue|mindestlohn/i },
  { name: "Zertifikat (z. B. ISO)", muster: /\biso\s?\d{4,5}|zertifizierung|zertifikat/i },
  { name: "Umsatzangaben", muster: /umsatz/i },
];

/** Proof types mentioned in a text. */
export function geforderte(text: string): NachweisTyp[] {
  return NACHWEIS_TYPEN.filter((t) => t.muster.test(text));
}

/** The firm's valid proof for this type (by name or file name), if any. */
export function vorhanden(typ: NachweisTyp, dateien: FirmenDatei[], stichtag: string): FirmenDatei | undefined {
  return dateien.find((d) => d.art === "nachweis" && (!d.gueltig_bis || d.gueltig_bis >= stichtag) && (typ.muster.test(d.name) || typ.muster.test(d.dateiname)));
}

/**
 * Marks each list item and table row in the "what you must provide" part of a rendered Steckbrief:
 * ✅ when the firm has the proof, ⚠️ with a pop-up and upload link when it is missing.
 * Only the section whose heading mentions Nachweise/vorweisen/Eignung is touched.
 */
export function nachweiseMarkieren(html: string, dateien: FirmenDatei[] | null, stichtag: string, uploadLink: string): string {
  return html.replace(/(<h2[^>]*>[^<]*(vorweisen|nachweis|eignung)[^<]*<\/h2>)([\s\S]*?)(?=<h2|$)/gi, (_v, kopf: string, _w, teil: string) => {
    const markiert = teil.replace(/<(li|tr)>([\s\S]*?)<\/\1>/g, (eintrag, tag: string, inhalt: string) => {
      const typen = geforderte(inhalt.replace(/<[^>]+>/g, " "));
      if (!typen.length || /nicht angegeben/i.test(inhalt)) return eintrag;
      const zeichen = typen.map((t) => {
        if (!dateien) return "";
        const d = vorhanden(t, dateien, stichtag);
        if (d) return ` <span class="nachweis-ok" title="${escape(t.name)} liegt vor: ${escape(d.name)}">✅</span>`;
        const link = `${uploadLink}${uploadLink.includes("?") ? "&" : "?"}name=${encodeURIComponent(t.name)}`;
        return ` <details class="nachweis-fehlt"><summary title="${escape(t.name)} fehlt">⚠️</summary><span class="nachweis-popup"><strong>${escape(t.name)}</strong> ist noch nicht in deinen Firmenunterlagen (oder abgelaufen). Lade ihn einmal hoch, dann legt Crewtender ihn jedem Angebot bei. <a href="${escape(link)}">Jetzt hochladen →</a></span></details>`;
      }).join("");
      if (tag === "tr") return eintrag.replace(/<\/td>(?![\s\S]*<\/td>)/, `${zeichen}</td>`);
      return `<li>${inhalt}${zeichen}</li>`;
    });
    return kopf + markiert;
  });
}
