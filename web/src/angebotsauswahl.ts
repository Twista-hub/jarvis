// "Angebot vorbereiten" step 1: pick the lots, Jarvis writes the complete offer text with prices from the
// calculation and attaches the matching proofs. Nothing left to fill in by hand.
import type { FirmenDatei } from "./firmenunterlagen.ts";
import { euro, fmt, rechnen, STANDARD, type Eingaben, type Los, type LosWerte } from "./kalkulation.ts";
import { geforderte, vorhanden } from "./nachweise.ts";
import { escape } from "./seite.ts";

export type LosZeile = { nr: string; name: string; stunden: number; netto: number; zeitraum: string };
export type Preise = { zeilen: LosZeile[]; proStunde: number; kalkuliert: boolean };

/** Prices per lot from the saved calculation of the uploaded documents (or the firm's/standard values). */
export function preise(lose: Los[], kalk: { eingaben: Eingaben; mengen: Record<string, number>; proLos?: LosWerte } | null, vorlage: Eingaben | null): Preise {
  const eingaben = kalk?.eingaben ?? vorlage ?? STANDARD;
  const mengen = kalk?.mengen ?? Object.fromEntries(lose.map((l) => [l.nr, /stunde|std/i.test(l.einheit) ? l.menge : 0]));
  const r = rechnen(eingaben, lose, mengen, kalk?.proLos ?? {});
  return {
    zeilen: r.lose.map((z) => ({ nr: z.los.nr, name: z.los.name, stunden: z.stunden, netto: z.netto, zeitraum: z.los.zeitraum })),
    proStunde: r.preisProStunde,
    kalkuliert: !!kalk,
  };
}

/** Proofs named in the Steckbrief: the firm's matching files (pre-ticked) and the missing ones. */
export function passendeNachweise(steckbrief: string, dateien: FirmenDatei[], stichtag: string): { ids: string[]; fehlen: string[] } {
  const ids: string[] = [];
  const fehlen: string[] = [];
  // Lines saying "nicht angegeben" do not ask for anything.
  const gefordert = steckbrief.split("\n").filter((z) => !/nicht angegeben/i.test(z)).join("\n");
  for (const typ of geforderte(gefordert)) {
    const d = vorhanden(typ, dateien, stichtag);
    if (d) ids.push(d.id);
    else fehlen.push(typ.name);
  }
  return { ids: [...new Set(ids)], fehlen };
}

export function auswahlSeite(vid: string, p: Preise, nachweise: { namen: string[]; fehlen: string[] }, uploadLink: string, kalkLink: string): string {
  const zeilen = p.zeilen.map((z) => `<label class="zeile"><input type="checkbox" name="lose" value="${escape(z.nr)}" checked>
    <span>Los ${escape(z.nr)}: ${escape(z.name)}<br><span class="klein">${z.stunden ? `${fmt(z.stunden)} Std. · ` : ""}${euro(z.netto)} netto</span></span></label>`).join("");
  return `<p>Hake an, worauf ihr bieten wollt. Jarvis schreibt daraus das Angebot mit Preisen und legt die passenden Nachweise bei. Danach kannst du alles noch ändern.</p>
<form method="post" action="/konto/vorgang/${vid}/angebot">
  <input type="hidden" name="aktion" value="vorauswahl">
  <fieldset><legend>Lose</legend>${zeilen}</fieldset>
  <p class="klein">Preise aus ${p.kalkuliert ? "deiner Kalkulation" : "deinen Standardwerten (noch keine eigene Kalkulation für diese Ausschreibung)"}: ${euro(p.proStunde)} netto pro Stunde. <a href="${escape(kalkLink)}">Kalkulation ändern</a></p>
  <button>Angebot erstellen</button>
</form>
${nachweise.namen.length ? `<p>📎 Wird beigelegt: ${nachweise.namen.map(escape).join(", ")}</p>` : ""}
${nachweise.fehlen.length ? `<aside class="nachweis-popup"><strong>⚠️ Noch nicht hochgeladen:</strong> ${nachweise.fehlen.map(escape).join(", ")}.<br><a href="${escape(uploadLink)}">Jetzt in den Firmenunterlagen hochladen →</a></aside>` : ""}`;
}

/** The finished offer text (Markdown), without placeholders. */
export function angebotsText(o: { titel: string; firma: string; zeilen: LosZeile[]; proStunde: number; nachweise: string[] }): string {
  const summe = o.zeilen.reduce((s, z) => s + z.netto, 0);
  const tabelle = o.zeilen.length
    ? `| Los | Leistung | Menge | Preis netto |\n|---|---|---|---|\n${o.zeilen.map((z) => `| ${z.nr} | ${z.name} | ${z.stunden ? `${fmt(z.stunden)} Stunden` : "–"} | ${euro(z.netto)} |`).join("\n")}\n| | **Gesamt netto** | | **${euro(summe)}** |\n`
    : "";
  return [
    `# Angebot: ${o.titel}`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    o.zeilen.length ? `hiermit bieten wir für die Ausschreibung „${o.titel}“ die folgenden Lose an:` : `hiermit bieten wir für die Ausschreibung „${o.titel}“ an.`,
    "",
    tabelle,
    `Unser Verrechnungssatz beträgt ${euro(o.proStunde)} netto je Stunde. Alle Preise verstehen sich zuzüglich der gesetzlichen Umsatzsteuer.`,
    "",
    "Wir erbringen die Leistung gemäß der Leistungsbeschreibung und den Vertragsbedingungen der Vergabeunterlagen. An unser Angebot halten wir uns bis zum Ablauf der dort genannten Bindefrist gebunden.",
    "",
    o.nachweise.length ? `Beigefügte Nachweise: ${o.nachweise.join(", ")}.` : "",
    "",
    "Mit freundlichen Grüßen",
    "",
    o.firma,
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}
