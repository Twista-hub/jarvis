// Idea 28 (docs/ideen-arbeitsoberflaeche.md): find a bidding consortium. On a tender, Jarvis suggests the firm's own
// partners whose trades appear in the title or brief (no marketplace: only partners the firm entered itself), and once
// partners have agreed it creates the consortium declaration as Word (lead firm = own firm, joint and several liability).
// Competition law (§ 1 GWB): a consortium is only allowed if there is a factual reason (e.g. not able to perform alone);
// the page says so. Jarvis sends nothing.
import type { Anfrage, Partner } from "./partner.ts";
import { escape } from "./seite.ts";
import { absatz, tabelle, ueberschrift, wordDokument } from "./word.ts";

/** Search words per standard trade (lower case, matched as word beginnings). */
const WORTE: Record<string, string[]> = {
  "Elektro": ["elektro", "beleuchtung", "blitzschutz"], "Sanitär": ["sanitär", "sanitaer", "trinkwasser"], "Heizung": ["heizung", "wärmepumpe"],
  "Lüftung": ["lüftung", "raumluft", "klima"], "Trockenbau": ["trockenbau"], "Maler": ["maler", "anstrich", "tapezier"], "Fliesen": ["fliesen"],
  "Bodenbelag": ["bodenbelag", "parkett", "estrich"], "Dach": ["dach"], "Gerüst": ["gerüst", "geruest"], "Tischler": ["tischler", "schreiner"],
  "Metallbau": ["metallbau", "schlosser", "stahlbau"], "Garten- und Landschaftsbau": ["garten", "landschaftsbau", "grünpflege", "grünflächen", "baumpflege"],
  "Reinigung": ["reinigung", "glasreinigung", "unterhaltsreinigung"], "Sicherheitsdienst": ["sicherheitsdienst", "bewachung", "wachdienst", "objektschutz", "pförtner", "empfangsdienst"],
  "Catering": ["catering", "verpflegung", "kantine"], "Personal": ["arbeitnehmerüberlassung", "personaldienst", "zeitarbeit"],
};
const worte = (gewerk: string) => WORTE[gewerk] ?? [gewerk.toLowerCase().replace(/[^a-zäöüß]/g, "").slice(0, 8)].filter((w) => w.length >= 4);

/** Own partners whose trade appears in the tender text; partners already asked are left out. Best rated first. */
export function passendePartner(text: string, partner: Partner[], anfragen: Pick<Anfrage, "partner_id">[]): { partner: Partner; gewerk: string }[] {
  const t = ` ${text.toLowerCase()}`;
  const gefragt = new Set(anfragen.map((a) => a.partner_id));
  return partner.filter((p) => !gefragt.has(p.id)).flatMap((p) => {
    const g = p.gewerke.find((gw) => worte(gw).some((w) => new RegExp(`[^a-zäöüß]${w}`).test(t)));
    return g ? [{ partner: p, gewerk: g }] : [];
  }).sort((a, b) => (b.partner.bewertung ?? 0) - (a.partner.bewertung ?? 0) || a.partner.name.localeCompare(b.partner.name, "de")).slice(0, 8);
}

/** Section on the tender page below the subcontractor requests. */
export function bgeTeilHtml(v: { id: string }, vorschlaege: { partner: Partner; gewerk: string }[], zugesagt: number, darfAendern: boolean): string {
  const vorschlag = vorschlaege.length ? `<p class="klein">Passend aus deinen Partnern (Gewerk kommt in der Ausschreibung vor):</p><ul class="frage-liste">${vorschlaege.map(({ partner: p, gewerk }) => `<li class="anfrage-zeile"><div><strong>${escape(p.name)}</strong><span class="klein">${escape(gewerk)}${p.region ? ` · ${escape(p.region)}` : ""}${p.bewertung ? ` · ${"★".repeat(p.bewertung)}` : ""}</span></div>${darfAendern ? `<form method="post" action="/konto/vorgang/${v.id}/partner"><input type="hidden" name="aktion" value="neu"><input type="hidden" name="partner" value="${p.id}"><input type="hidden" name="los" value="${escape(gewerk)}"><button class="zweit">➕ Anfrage festhalten</button></form>` : ""}</li>`).join("")}</ul>` : "";
  return `<details class="bge"${zugesagt ? " open" : ""}><summary>👥 Bietergemeinschaft</summary>${vorschlag}
${zugesagt ? `<p><a class="knopf" href="/konto/vorgang/${v.id}/bietergemeinschaft.docx" download>📄 Bietergemeinschaftserklärung (Word)</a></p><p class="klein">Mitglieder: deine Firma (federführend) und alle Partner mit „✅ Zugesagt“; Leistungsteil = Los/Leistung der Anfrage. Gibt die Vergabestelle ein eigenes Formular vor, bitte dieses verwenden.</p>` : `<p class="klein">Sobald ein Partner zugesagt hat, erstellt Jarvis hier die Bietergemeinschaftserklärung.</p>`}
<p class="klein">⚖️ Eine Bietergemeinschaft ist nur erlaubt, wenn es einen sachlichen Grund gibt (z. B. allein nicht leistungsfähig, fehlendes Gewerk oder zu wenig Kapazität). Keine Preisabsprachen mit Firmen, die getrennt bieten (§ 1 GWB). Im Zweifel den Grund im Angebot kurz begründen.</p></details>`;
}

export type Mitglied = { name: string; anschrift: string; leistung: string };
/** Consortium declaration (common form: members, authorised lead member, joint and several liability, signatures). */
export function bgeErklaerungDocx(v: { titel: string; link?: string | null }, fuehrend: Mitglied, partner: Mitglied[]): Uint8Array {
  const alle = [{ ...fuehrend, leistung: fuehrend.leistung || "Gesamtkoordination" }, ...partner];
  const datumHeute = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  return wordDokument(
    ueberschrift("Erklärung der Bietergemeinschaft", 30)
    + absatz(`Vergabeverfahren: ${v.titel}${v.link ? `\n${v.link}` : ""}`, { abstand: 200 })
    + absatz("Wir, die nachstehend aufgeführten Unternehmen, bilden für dieses Vergabeverfahren eine Bietergemeinschaft und geben gemeinsam ein Angebot ab.", { abstand: 160 })
    + tabelle([["Nr.", "Mitglied (Firma, Anschrift)", "Leistungsteil"], ...alle.map((m, i) => [`${i + 1}${i === 0 ? " (federführend)" : ""}`, `${m.name}${m.anschrift ? `\n${m.anschrift}` : "\n\n"}`, m.leistung])], [1700, 4600, 3000], true)
    + absatz("Wir erklären:", { fett: true, abstand: 80 })
    + absatz(`1. Bevollmächtigter Vertreter der Bietergemeinschaft ist ${fuehrend.name}. Es vertritt die Mitglieder gegenüber dem Auftraggeber rechtsverbindlich, auch bei der Abgabe und Änderung des Angebots und beim Abschluss und der Ausführung des Vertrags.`, { abstand: 80 })
    + absatz("2. Im Auftragsfall bilden wir eine Arbeitsgemeinschaft. Alle Mitglieder haften dem Auftraggeber gegenüber gesamtschuldnerisch.", { abstand: 80 })
    + absatz("3. Der bevollmächtigte Vertreter ist berechtigt, Zahlungen mit befreiender Wirkung für den Auftraggeber entgegenzunehmen.", { abstand: 80 })
    + absatz("4. Die Bildung der Bietergemeinschaft beruht auf einer selbstständigen unternehmerischen Entscheidung; die Mitglieder wären allein nicht oder nicht wirtschaftlich in der Lage, den Auftrag auszuführen. Absprachen mit anderen Bietern wurden nicht getroffen.", { abstand: 240 })
    + tabelle([["Mitglied", "Ort, Datum", "Name in Druckbuchstaben, Unterschrift, Stempel"], ...alle.map((m) => [m.name, `\n, ${datumHeute}`, "\n\n"])], [3000, 2300, 4000], true)
    + absatz("Vorlage aus Jarvis. Bitte vor Abgabe mit den Vorgaben der Vergabestelle abgleichen; ein vorgegebenes Formular hat Vorrang.", { grau: true, groesse: 16 }),
  );
}
