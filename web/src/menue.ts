// The "Mehr" menu (/konto/einstellungen) lists up to ~50 tools. Grouped like the "Firma & Team" page so people find
// things by topic. Which entries someone sees is still decided where the rows are built (roles, finance access).
import { escape } from "./seite.ts";

const GRUPPEN: [string, string[]][] = [
  ["Konto & Suche", ["/konto/profil", "/konto/einstellungen", "/konto/plan", "/konto/suchprofil", "/konto/team"]],
  ["Ausschreibungen & Angebote", ["/konto/unterlagen", "/konto/angebote", "/konto/kalkulation", "/konto/textbausteine", "/konto/partner", "/konto/markt", "/konto/auftraggeber", "/konto/radar", "/konto/foerderung", "/konto/auftraege", "/konto/auswertung"]],
  ["Planung & Personal", ["/konto/ich", "/konto/schichten", "/konto/disposition", "/konto/stunden", "/konto/zeitkonto", "/konto/spesen", "/konto/urlaub", "/konto/aufgaben", "/konto/vertretung", "/konto/kapazitaet", "/konto/personalfristen", "/konto/bewerber", "/konto/checklisten", "/konto/psa", "/konto/bewertungen", "/konto/personalauswertung", "/konto/kraefte-einladen"]],
  ["Abrechnung & Kunden", ["/konto/kunden", "/konto/leistungsnachweis", "/konto/rechnungen", "/konto/belege", "/konto/nachkalkulation", "/konto/umsatzsteuer", "/konto/kundenportal", "/konto/rundgaenge"]],
  ["Firma", ["/konto/firmenprofil", "/konto/brett", "/konto/chat", "/konto/organigramm", "/konto/betriebsmittel", "/konto/rechte", "/konto/protokoll"]],
  ["Hilfe", ["/konto/hilfe"]],
];

/** Rows (<a class="standort-zeile" href="…">) in topic groups with headings; duplicates are shown once. */
export function menueGruppieren(zeilen: string): string {
  const eintraege = [...zeilen.matchAll(/<a class="standort-zeile" href="([^"]+)">[\s\S]*?<\/a>/g)].map((m) => ({ pfad: m[1].split(/[?#]/)[0], html: m[0] }));
  const gesehen = new Set<string>();
  const gruppe = (titel: string, liste: typeof eintraege) => {
    const neu = liste.filter((e) => !gesehen.has(e.pfad) && gesehen.add(e.pfad));
    return neu.length ? `<h3 class="werkzeug-gruppe">${escape(titel)}</h3><div class="standort-liste einstellungs-liste">${neu.map((e) => e.html).join("")}</div>` : "";
  };
  const bekannt = new Set(GRUPPEN.flatMap(([, p]) => p));
  return GRUPPEN.map(([titel, pfade]) => gruppe(titel, pfade.flatMap((p) => eintraege.filter((e) => e.pfad === p)))).join("")
    + gruppe("Weitere", eintraege.filter((e) => !bekannt.has(e.pfad)));
}
