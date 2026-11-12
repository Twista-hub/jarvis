// Question-and-answer pages /fragen and /fragen/<slug> (12.11.2026, Benjamin: "Ja" to all ten). They answer the
// questions people put to a search engine or an AI assistant about public tenders: a clear answer in the first lines,
// facts with their source, live numbers from our catalogue and a link to the public search. German only (German law,
// German trades); no AI at run time, nothing stored.
//
// Legal facts were checked on 12.11.2026: EU thresholds 2026/2027 (Delegated Regulations (EU) 2025/2150–2152),
// Vergabebeschleunigungsgesetz (BGBl. 2026 I Nr. 137, in force 01.07.2026), Bundestariftreuegesetz (BGBl. 2026 I
// Nr. 119, in force 01.05.2026). Only points confirmed by several sources are stated; the UVgO is being revised
// (planned until 31.12.2026): re-check the pages when it is published, and at the latest when STAND changes year.
import { BRANCHEN_VORLAGEN, euro, fmt, mindestlohnHeute, rechnen, STANDARD, MINDESTLOHN_2027, type Eingaben } from "./kalkulation.ts";
import { GEWERKE } from "./gewerke.ts";
import { BUNDESLAENDER } from "./nuts.ts";
import { PLAENE } from "./plaene.ts";
import { VERGLEICH_STAND } from "./rechner.ts";
import type { StartZahlen } from "./rechtliches.ts";
import { escape, seite } from "./seite.ts";

export const STAND = "November 2026";
type Kontext = { zahlen: StartZahlen | null };
/** mitZahlen: the page shows the live numbers of the catalogue (one cached call); the others need no data at all. */
export type Frage = { slug: string; frage: string; kurz: string; mitZahlen?: boolean; inhalt: (k: Kontext) => string; quellen: [string, string][] };

const zahl = (n: number) => n.toLocaleString("de-DE");
const GII = "https://www.gesetze-im-internet.de";
const SUCHE = `<a href="/demo/suche">öffentliche Suche von Crewtender</a>`;

/** One sentence with the live numbers of our catalogue; empty when they are not available. */
const katalogSatz = (z: StartZahlen | null) => z?.offen
  ? `<p>Im Katalog von Crewtender stehen gerade <strong>${zahl(z.offen)} offene Ausschreibungen</strong> aus amtlichen Bekanntmachungen${z.woche ? `, ${zahl(z.woche)} davon sind in den letzten 7 Tagen erschienen` : ""}.</p>`
  : "";

export const FRAGEN: Frage[] = [
  {
    slug: "ausschreibungen-finden",
    mitZahlen: true,
    frage: "Wie finde ich öffentliche Ausschreibungen für meine Firma?",
    kurz: "Öffentliche Ausschreibungen stehen kostenlos in amtlichen Bekanntmachungen: beim Bekanntmachungsservice des Bundes, auf den Vergabeplattformen der Länder und, bei großen Aufträgen, in der EU-Datenbank TED. Am schnellsten findest du passende Aufträge, wenn du nach deinem Gewerk und deiner Region suchst und dir neue Treffer automatisch schicken lässt.",
    inhalt: (k) => `<h2>Wo die Ausschreibungen stehen</h2>
<ul>
<li><strong>Bekanntmachungsservice des Bundes</strong> (oeffentlichevergabe.de): sammelt Bekanntmachungen von Bund, Ländern und Kommunen an einer Stelle.</li>
<li><strong>service.bund.de</strong>: Ausschreibungen von Bundes-, Landes- und Kommunalbehörden.</li>
<li><strong>TED</strong> (ted.europa.eu): alle europaweiten Ausschreibungen oberhalb der EU-Schwellenwerte.</li>
<li><strong>Vergabeplattformen der Länder und Kommunen</strong>: dort liegen die Unterlagen, und dort gibst du dein Angebot ab.</li>
</ul>
<h2>So gehst du vor</h2>
<ol>
<li><strong>Nach Gewerk suchen, nicht nach Stichwort allein.</strong> Auftraggeber ordnen jede Ausschreibung einem CPV-Code zu (zum Beispiel 90910000 für Reinigungsdienste). Die Suche nach dem Code findet auch Aufträge, deren Titel dein Stichwort nicht enthält.</li>
<li><strong>Region eingrenzen.</strong> Für Dienstleister mit eigenem Personal zählt die Anfahrt. Suche nach Postleitzahl, Ort oder Bundesland.</li>
<li><strong>Frist und Umfang prüfen.</strong> Lies zuerst Abgabefrist, Lose, Laufzeit und die geforderten Nachweise. Daran entscheidet sich, ob sich ein Angebot lohnt.</li>
<li><strong>Neue Treffer automatisch bekommen.</strong> Jeden Tag selbst zu suchen kostet Zeit. Richte eine gespeicherte Suche ein oder lass dir passende Ausschreibungen schicken.</li>
</ol>
<h2>Mit Crewtender suchen</h2>
${katalogSatz(k.zahlen)}
<p>Die ${SUCHE} ist kostenlos und braucht kein Konto: Gewerk und Ort eingeben, Treffer mit Auftraggeber, Ort und Frist lesen, zum amtlichen Original klicken. Unter den Treffern kannst du die Suche abonnieren und bekommst neue Ausschreibungen einmal pro Woche per E-Mail. Mit einem Konto bewertet Crewtender jede Ausschreibung von 1 bis 10 Punkten für deine Firma.</p>
<p><a href="/ausschreibungen">Alle Gewerke im Überblick</a></p>`,
    quellen: [["Bekanntmachungsservice des Bundes", "https://oeffentlichevergabe.de/"], ["service.bund.de", "https://www.service.bund.de/"], ["TED – Tenders Electronic Daily", "https://ted.europa.eu/de/"]],
  },
  {
    slug: "ausschreibungen-nach-gewerk-und-bundesland",
    mitZahlen: true,
    frage: "Wo finde ich Ausschreibungen für mein Gewerk in meinem Bundesland?",
    kurz: "Wähle dein Gewerk und dein Bundesland: Crewtender zeigt für jede Kombination die offenen öffentlichen Ausschreibungen mit Auftraggeber, Ort und Frist, zum Beispiel Gebäudereinigung in Nordrhein-Westfalen. Die Zahlen stammen aus amtlichen Bekanntmachungen und werden mehrmals täglich neu berechnet.",
    inhalt: (k) => `${katalogSatz(k.zahlen)}
<h2>Beispiele</h2>
<ul>
<li><a href="/ausschreibungen/gebaeudereinigung/nordrhein-westfalen">Ausschreibungen für Gebäudereinigung in Nordrhein-Westfalen</a></li>
<li><a href="/ausschreibungen/sicherheitsdienst/bayern">Ausschreibungen für Sicherheitsdienste in Bayern</a></li>
<li><a href="/ausschreibungen/garten-landschaftsbau-winterdienst/niedersachsen">Ausschreibungen für Garten- und Landschaftsbau in Niedersachsen</a></li>
<li><a href="/ausschreibungen/elektro/baden-wuerttemberg">Ausschreibungen für Elektroarbeiten in Baden-Württemberg</a></li>
</ul>
<h2>Alle Gewerke</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Gewerke">${GEWERKE.map((g) => `<a href="/ausschreibungen/${g.slug}">${escape(g.name)}</a>`).join("")}</nav>
<h2>Alle Bundesländer</h2>
<p>Auf der Seite deines Gewerks findest du die Auswahl „Nach Bundesland“. Die Adresse ist immer gleich aufgebaut: <code>crewtender.eu/ausschreibungen/&lt;gewerk&gt;/&lt;bundesland&gt;</code>.</p>
<nav class="ordner-chips gewerk-liste" aria-label="Bundesländer am Beispiel Gebäudereinigung">${BUNDESLAENDER.map((l) => `<a href="/ausschreibungen/gebaeudereinigung/${l.slug}">${escape(l.name)}</a>`).join("")}</nav>
<h2>Genauer als das Bundesland</h2>
<p>Für die Suche nach Ort oder Postleitzahl nimm die ${SUCHE}: Gewerk und Ort eingeben, zum Beispiel „Reinigung“ und „Köln“ oder die ersten Ziffern der Postleitzahl.</p>
<h2>Warum nicht jede Ausschreibung ein Bundesland hat</h2>
<p>Das Bundesland lesen wir aus dem Ort der Leistung in der Bekanntmachung. Gibt der Auftraggeber dort nur „Deutschland“ an, steht die Ausschreibung beim Gewerk, aber bei keinem Bundesland.</p>`,
    quellen: [["Bekanntmachungsservice des Bundes (Datenquelle)", "https://oeffentlichevergabe.de/"]],
  },
  {
    slug: "kosten-teilnahme",
    frage: "Was kostet die Teilnahme an einer öffentlichen Ausschreibung?",
    kurz: "Die Teilnahme selbst kostet nichts: Die Vergabeunterlagen müssen kostenlos und ohne Registrierung abrufbar sein, und die Abgabe des Angebots über die Vergabeplattform ist für Bieter in aller Regel gebührenfrei. Kosten entstehen durch deine eigene Arbeitszeit, durch Nachweise und, bei größeren Aufträgen, durch Bürgschaften.",
    inhalt: () => `<h2>Was nichts kostet</h2>
<ul>
<li><strong>Bekanntmachung lesen:</strong> amtliche Bekanntmachungen sind öffentlich.</li>
<li><strong>Vergabeunterlagen herunterladen:</strong> Bei europaweiten Verfahren muss der Auftraggeber die Unterlagen unentgeltlich, uneingeschränkt, vollständig und direkt bereitstellen (§ 41 VgV). Unterhalb der Schwellenwerte gilt das nach den dortigen Regeln genauso.</li>
<li><strong>Angebot abgeben:</strong> Angebote gehen elektronisch über die Vergabeplattform des Auftraggebers ein. Die Registrierung dort ist für Bieter üblicherweise kostenlos.</li>
</ul>
<h2>Womit du rechnen musst</h2>
<ul>
<li><strong>Arbeitszeit:</strong> Unterlagen lesen, Ortstermin, Kalkulation, Formulare. Das ist bei den meisten Firmen der größte Posten.</li>
<li><strong>Nachweise:</strong> Auszüge und Bescheinigungen (zum Beispiel Handelsregister, Finanzamt, Krankenkasse, Berufsgenossenschaft, Versicherung) kosten teils Gebühren. Eine Präqualifikation kostet eine jährliche Gebühr, spart aber bei jeder Ausschreibung Arbeit.</li>
<li><strong>Signatur:</strong> Meist genügt die Textform, also Name der erklärenden Person ohne Unterschrift. Eine qualifizierte elektronische Signatur brauchst du nur, wenn der Auftraggeber sie ausdrücklich verlangt.</li>
<li><strong>Sicherheiten:</strong> Vor allem bei größeren Bauaufträgen kann der Auftraggeber eine Bürgschaft für die Vertragserfüllung verlangen. Die Bank oder Versicherung berechnet dafür eine Avalprovision.</li>
<li><strong>Kostenpflichtige Suchdienste:</strong> freiwillig. Die amtlichen Quellen sind kostenlos.</li>
</ul>
<h2>Bekomme ich Geld zurück, wenn ich nicht gewinne?</h2>
<p>Nein. Die Kosten für die Angebotserstellung trägt jeder Bieter selbst. Eine Entschädigung gibt es nur, wenn der Auftraggeber verlangt, dass du Entwürfe, Pläne oder Berechnungen ausarbeitest, und sie in den Unterlagen festgesetzt hat.</p>
<h2>So hältst du den Aufwand klein</h2>
<p>Bewirb dich gezielt: Prüfe zuerst Frist, Umfang und geforderte Nachweise, bevor du kalkulierst. Lege Standardunterlagen einmal an und verwende sie wieder. Crewtender zeigt zu jeder Ausschreibung einen Steckbrief mit Fristen, Losen und Nachweisen und hält deine Firmenunterlagen bereit.</p>`,
    quellen: [["§ 41 VgV: Bereitstellung der Vergabeunterlagen", `${GII}/vgv_2016/__41.html`], ["§ 53 VgV: Form und Übermittlung der Angebote", `${GII}/vgv_2016/__53.html`]],
  },
  {
    slug: "unterlagen-nachweise",
    frage: "Welche Unterlagen und Nachweise brauche ich für ein Angebot bei einer öffentlichen Ausschreibung?",
    kurz: "Du brauchst das ausgefüllte Angebot mit Preisen und die Nachweise deiner Eignung: dass deine Firma den Beruf ausüben darf, wirtschaftlich leistungsfähig ist und vergleichbare Aufträge schon erledigt hat. Seit Juli 2026 genügen dafür zunächst Eigenerklärungen; Bescheinigungen fordert der Auftraggeber in der Regel erst von den Bietern an, die für den Zuschlag in Frage kommen.",
    inhalt: () => `<h2>Was zum Angebot gehört</h2>
<ul>
<li><strong>Angebotsschreiben und Preisblatt</strong> oder das ausgefüllte Leistungsverzeichnis.</li>
<li><strong>Eigenerklärung zur Eignung:</strong> Angaben zur Firma, zu Umsatz, Beschäftigten und Referenzen und die Erklärung, dass keine Ausschlussgründe vorliegen (zum Beispiel Steuerschulden oder schwere Verfehlungen). Bei europaweiten Verfahren kannst du dafür die Einheitliche Europäische Eigenerklärung verwenden.</li>
<li><strong>Erklärungen zu Mindestlohn und Tariftreue</strong>, soweit das Land oder der Bund sie verlangt.</li>
<li><strong>Angaben zu Nachunternehmern und Bietergemeinschaft</strong>, wenn du nicht alles selbst ausführst.</li>
<li><strong>Konzepte</strong>, wenn sie bewertet werden, etwa zu Personal, Qualität oder Einarbeitung.</li>
</ul>
<h2>Typische Nachweise</h2>
<ul>
<li>Auszug aus dem Handelsregister oder Gewerbeanmeldung, bei Handwerk die Eintragung in die Handwerksrolle</li>
<li>Bescheinigungen von Finanzamt, Krankenkasse und Berufsgenossenschaft, dass Steuern und Beiträge gezahlt sind</li>
<li>Nachweis der Betriebshaftpflichtversicherung</li>
<li>Referenzen über vergleichbare Aufträge: bei Liefer- und Dienstleistungen in der Regel aus den letzten drei Jahren, bei Bauleistungen aus den letzten fünf Jahren</li>
<li>Branchennachweise, zum Beispiel die Erlaubnis nach § 34a Gewerbeordnung für Bewachung oder die Erlaubnis zur Arbeitnehmerüberlassung</li>
</ul>
<h2>Was sich 2026 geändert hat</h2>
<ul>
<li><strong>Eigenerklärung zuerst:</strong> Seit dem Vergabebeschleunigungsgesetz (in Kraft seit 1. Juli 2026) soll die Eignung durch Eigenerklärungen nachgewiesen werden. Weitere Unterlagen soll der Auftraggeber nur von den aussichtsreichen Bewerbern oder Bietern verlangen (§ 122 Abs. 3 GWB).</li>
<li><strong>Wettbewerbsregister:</strong> Vor dem Zuschlag fragt der Auftraggeber bei Aufträgen ab 50.000 € netto ab, ob zu deiner Firma Einträge im Wettbewerbsregister stehen. Du musst dafür nichts einreichen.</li>
<li><strong>Tariftreue beim Bund:</strong> Das Bundestariftreuegesetz (in Kraft seit 1. Mai 2026) gilt für Bau- und Dienstleistungsaufträge des Bundes ab 50.000 € netto. Wer den Auftrag ausführt, muss die Arbeitsbedingungen einhalten, die das Bundesarbeitsministerium für die Branche per Verordnung festlegt; das gilt auch für Nachunternehmer. Viele Bundesländer haben eigene Tariftreue- und Vergabegesetze.</li>
</ul>
<h2>Präqualifikation spart Arbeit</h2>
<p>Wer oft anbietet, kann seine Eignung einmal prüfen lassen und dann nur noch die Nummer angeben: für Bauunternehmen im Präqualifikationsverzeichnis (PQ-VOB), für Liefer- und Dienstleistungen im Amtlichen Verzeichnis präqualifizierter Unternehmen der Industrie- und Handelskammern.</p>
<h2>Der häufigste Fehler</h2>
<p>Fehlende oder falsch ausgefüllte Unterlagen führen schnell zum Ausschluss, auch wenn der Preis der beste ist. Maßgeblich ist immer die Liste in den Vergabeunterlagen der einzelnen Ausschreibung. Crewtender liest die Unterlagen und zeigt im Steckbrief, welche Nachweise gefordert sind und welche du schon hinterlegt hast.</p>`,
    quellen: [["§ 122 GWB: Eignung und Eigenerklärungen", `${GII}/gwb/__122.html`], ["Bundestariftreuegesetz", `${GII}/bttg/`], ["§ 46 VgV: Technische und berufliche Leistungsfähigkeit (Referenzen)", `${GII}/vgv_2016/__46.html`], ["§ 50 VgV: Einheitliche Europäische Eigenerklärung", `${GII}/vgv_2016/__50.html`], ["Amtliches Verzeichnis präqualifizierter Unternehmen", "https://amtliches-verzeichnis.ihk.de/"]],
  },
  {
    slug: "ab-welchem-auftragswert",
    frage: "Ab welchem Auftragswert muss öffentlich ausgeschrieben werden?",
    kurz: "Europaweit ausgeschrieben werden muss ab den EU-Schwellenwerten: 2026 und 2027 sind das 5.404.000 € für Bauaufträge und 216.000 € für Liefer- und Dienstleistungen (140.000 € bei obersten und oberen Bundesbehörden), jeweils ohne Umsatzsteuer. Darunter gelten die Regeln von Bund, Ländern und Kommunen mit eigenen Wertgrenzen; der Bund darf seit Juli 2026 bis 50.000 € direkt beauftragen.",
    inhalt: () => `<h2>EU-Schwellenwerte 2026 und 2027</h2>
<div class="tabelle-scroll"><table><thead><tr><th scope="col">Auftrag</th><th scope="col">Wert (netto)</th></tr></thead><tbody>
<tr><td>Bauaufträge</td><td>5.404.000&nbsp;€</td></tr>
<tr><td>Liefer- und Dienstleistungen (Länder, Kommunen, übrige Auftraggeber)</td><td>216.000&nbsp;€</td></tr>
<tr><td>Liefer- und Dienstleistungen oberster und oberer Bundesbehörden</td><td>140.000&nbsp;€</td></tr>
</tbody></table></div>
<p>Die Werte gelten vom 1. Januar 2026 bis zum 31. Dezember 2027. Maßgeblich ist der geschätzte Gesamtwert des Auftrags über die ganze Laufzeit, einschließlich Verlängerungen und aller Lose. Ab diesen Werten muss der Auftraggeber europaweit ausschreiben; die Bekanntmachung erscheint in TED.</p>
<h2>Unterhalb der Schwellenwerte</h2>
<p>Hier gilt Haushaltsrecht: für Liefer- und Dienstleistungen die Unterschwellenvergabeordnung (UVgO), für Bauleistungen die VOB/A. Grundsatz ist die öffentliche oder beschränkte Ausschreibung mit Teilnahmewettbewerb. Bis zu bestimmten Wertgrenzen darf der Auftraggeber einfacher vergeben, etwa beschränkt ohne Teilnahmewettbewerb, als Verhandlungsvergabe oder als Direktauftrag.</p>
<ul>
<li><strong>Bund:</strong> Seit dem 1. Juli 2026 dürfen Bundesbehörden Leistungen bis 50.000 € netto ohne Vergabeverfahren direkt beauftragen (§ 55 Abs. 2 BHO).</li>
<li><strong>Länder und Kommunen:</strong> Jedes Bundesland legt eigene Wertgrenzen fest, und sie werden häufig geändert. Es gibt deshalb keinen bundesweit einheitlichen Betrag, ab dem öffentlich ausgeschrieben werden muss.</li>
</ul>
<p>Die UVgO wird gerade überarbeitet; Bund und Länder wollen die neue Fassung bis Ende 2026 vorlegen.</p>
<h2>Was das für dich bedeutet</h2>
<p>Viele kleinere Aufträge erscheinen nie als öffentliche Ausschreibung, sondern werden direkt oder unter wenigen angefragten Firmen vergeben. Es lohnt sich deshalb, bei den Vergabestellen in deiner Region bekannt zu sein und sich dort, wo es das gibt, in Bieter- oder Unternehmensverzeichnisse eintragen zu lassen. Die öffentlich bekannt gemachten Aufträge findest du in der ${SUCHE}.</p>`,
    quellen: [["§ 106 GWB: Schwellenwerte", `${GII}/gwb/__106.html`], ["Delegierte Verordnung (EU) 2025/2152 (Schwellenwerte 2026/2027)", "https://eur-lex.europa.eu/eli/reg_del/2025/2152/oj"], ["§ 55 BHO: Öffentliche Aufträge des Bundes (Direktauftrag bis 50.000 €)", `${GII}/bho/__55.html`]],
  },
  {
    slug: "stundenverrechnungssatz-kalkulieren",
    frage: "Wie kalkuliere ich den Stundenverrechnungssatz für eine Reinigungs- oder Sicherheits-Ausschreibung?",
    kurz: "Der Stundenverrechnungssatz ist der Stundenlohn plus Lohnnebenkosten, Ausfallzeiten, Zuschläge, Einsatz- und Gemeinkosten sowie Wagnis und Gewinn. Er liegt deshalb deutlich über dem Stundenlohn. Viele Auftraggeber prüfen, ob dein Satz die tariflichen Löhne deckt, und schließen zu niedrige Angebote aus.",
    inhalt: () => {
      const beispiel = (branche: "reinigung" | "sicherheit") => {
        const werte: Eingaben = { ...STANDARD, ...BRANCHEN_VORLAGEN[branche].werte, lohn: Math.max(STANDARD.lohn, mindestlohnHeute()) };
        const r = rechnen(werte, [], {});
        return { name: BRANCHEN_VORLAGEN[branche].name, lohn: werte.lohn, r };
      };
      const a = beispiel("reinigung"), b = beispiel("sicherheit");
      const selbstkosten = a.r.schritte.find((s) => s.name.startsWith("= Selbstkosten"))?.betrag;
      return `<h2>Die Bausteine</h2>
<ol>
<li><strong>Stundenlohn:</strong> der Tariflohn der Lohngruppe, die die Arbeit verlangt, mindestens der gesetzliche Mindestlohn (${fmt(mindestlohnHeute())} € im Jahr 2026, ${fmt(MINDESTLOHN_2027)} € ab 2027). In der Gebäudereinigung und im Sicherheitsgewerbe gelten höhere Branchen- und Tariflöhne.</li>
<li><strong>Lohnnebenkosten:</strong> Arbeitgeberanteile zur Sozialversicherung, Umlagen, Berufsgenossenschaft, meist 21 bis 25 % vom Lohn.</li>
<li><strong>Ausfallzeiten:</strong> Urlaub, Krankheit und Feiertage werden bezahlt, aber nicht abgerechnet, meist 15 bis 25 %.</li>
<li><strong>Zuschläge:</strong> Nacht-, Sonntags- und Feiertagsarbeit nach dem Anteil dieser Stunden am Auftrag.</li>
<li><strong>Einsatzkosten:</strong> Fahrt, Arbeitskleidung, Material, Einarbeitung, Objektleitung.</li>
<li><strong>Gemeinkosten:</strong> Büro, Disposition, Versicherungen, Software.</li>
<li><strong>Wagnis und Gewinn.</strong></li>
</ol>
<h2>Rechenbeispiel ${escape(a.name)}</h2>
<p>Mit ${euro(a.lohn)} Stundenlohn und den üblichen Richtwerten ergibt sich ein Verrechnungssatz von <strong>${euro(a.r.preisProStunde)}</strong> pro Stunde (netto):</p>
<div class="tabelle-scroll"><table class="rechner-tabelle"><tbody>${a.r.schritte.map((s) => `<tr><td>${escape(s.name)}</td><td>${euro(s.betrag)}</td></tr>`).join("")}<tr><td><strong>= Verrechnungssatz</strong></td><td><strong>${euro(a.r.preisProStunde)}</strong></td></tr></tbody></table></div>
<p>${selbstkosten ? `Die Selbstkosten liegen in diesem Beispiel bei ${euro(selbstkosten)} pro Stunde: Darunter verlierst du mit jeder Stunde Geld. ` : ""}Für den ${escape(b.name)} mit mehr Nacht- und Sonntagsstunden ergibt dieselbe Rechnung bei ${euro(b.lohn)} Stundenlohn ${euro(b.r.preisProStunde)} pro Stunde.</p>
<p class="klein">Beispiel mit ${euro(a.lohn)} Stundenlohn und Richtwerten für Nebenkosten, Ausfallzeiten und Zuschläge. Setze deinen Tariflohn und deine eigenen Werte ein.</p>
<p><a class="knopf zweit" href="/stundensatz-rechner">🧮 Mit eigenen Werten rechnen</a></p>
<h2>Worauf Auftraggeber achten</h2>
<ul>
<li><strong>Auskömmlichkeit:</strong> Erscheint ein Preis ungewöhnlich niedrig, muss der Auftraggeber nachfragen und kann das Angebot ausschließen, wenn du den Preis nicht erklären kannst (§ 60 VgV).</li>
<li><strong>Tariflohn und Tariftreue:</strong> Dein Satz muss die Löhne decken, die für den Auftrag gelten. Bei Bundesaufträgen ab 50.000 € gilt seit Mai 2026 das Bundestariftreuegesetz, in vielen Ländern ein Landesgesetz.</li>
<li><strong>Leistungswerte in der Reinigung:</strong> Bewertet wird oft nicht nur der Stundensatz, sondern auch, wie viele Quadratmeter pro Stunde du ansetzt. Zu hohe Leistungswerte drücken den Preis, sind aber im Alltag nicht zu halten.</li>
<li><strong>Preisblatt genau ausfüllen:</strong> Viele Ausschreibungen verlangen die Aufgliederung des Stundensatzes in genau diesen Bausteinen.</li>
</ul>
<h2>In Crewtender</h2>
<p>In der App rechnet Crewtender denselben Weg pro Los einer echten Ausschreibung, mit hinterlegten Tariftabellen, und vergleicht deinen Preis mit früheren Zuschlägen.</p>`;
    },
    quellen: [["§ 60 VgV: Ungewöhnlich niedrige Angebote", `${GII}/vgv_2016/__60.html`], ["Mindestlohngesetz", `${GII}/milog/`], ["Bundestariftreuegesetz", `${GII}/bttg/`]],
  },
  {
    slug: "vergabearten",
    frage: "Was ist der Unterschied zwischen öffentlicher Ausschreibung, beschränkter Ausschreibung und Verhandlungsvergabe?",
    kurz: "Bei der öffentlichen Ausschreibung darf jede Firma ein Angebot abgeben. Bei der beschränkten Ausschreibung fordert der Auftraggeber nur ausgewählte Firmen zum Angebot auf, mit oder ohne vorherigen Teilnahmewettbewerb. Bei der Verhandlungsvergabe darf er mit den Bietern über Angebot und Preis verhandeln. Welche Art erlaubt ist, hängt vom Auftragswert ab.",
    inhalt: () => `<h2>Unterhalb der EU-Schwellenwerte</h2>
<div class="tabelle-scroll"><table><thead><tr><th scope="col">Vergabeart</th><th scope="col">Wer darf anbieten?</th><th scope="col">Verhandeln erlaubt?</th></tr></thead><tbody>
<tr><td>Öffentliche Ausschreibung</td><td>Jede Firma. Die Ausschreibung wird öffentlich bekannt gemacht.</td><td>Nein</td></tr>
<tr><td>Beschränkte Ausschreibung mit Teilnahmewettbewerb</td><td>Jede Firma kann sich bewerben; die geeigneten werden zum Angebot aufgefordert.</td><td>Nein</td></tr>
<tr><td>Beschränkte Ausschreibung ohne Teilnahmewettbewerb</td><td>Nur Firmen, die der Auftraggeber direkt auffordert, in der Regel mindestens drei.</td><td>Nein</td></tr>
<tr><td>Verhandlungsvergabe (bei Bauleistungen: freihändige Vergabe)</td><td>Mit oder ohne Teilnahmewettbewerb; oft direkt aufgeforderte Firmen.</td><td>Ja, über Angebot und Preis</td></tr>
<tr><td>Direktauftrag</td><td>Eine Firma, ohne Vergabeverfahren.</td><td>Formlos</td></tr>
</tbody></table></div>
<h2>Oberhalb der EU-Schwellenwerte</h2>
<p>Dort heißen die Verfahren anders (§ 119 GWB): Das <strong>offene Verfahren</strong> entspricht der öffentlichen Ausschreibung, das <strong>nicht offene Verfahren</strong> der beschränkten Ausschreibung mit Teilnahmewettbewerb, das <strong>Verhandlungsverfahren</strong> der Verhandlungsvergabe. Dazu kommen der wettbewerbliche Dialog und die Innovationspartnerschaft für besondere Fälle.</p>
<h2>Was das für Bieter heißt</h2>
<ul>
<li><strong>Bei Ausschreibungen wird nicht verhandelt.</strong> Dein erstes Angebot ist dein letztes: Preis und Inhalt dürfen nach der Abgabe nicht mehr geändert werden. Kalkuliere deshalb gleich deinen besten vertretbaren Preis.</li>
<li><strong>Teilnahmewettbewerb heißt zwei Schritte:</strong> erst die Bewerbung mit Eignungsnachweisen, dann das Angebot. Wer die erste Frist verpasst, ist draußen.</li>
<li><strong>Ohne Teilnahmewettbewerb bekommst du nur Post, wenn der Auftraggeber dich kennt.</strong> Stelle deine Firma bei den Vergabestellen deiner Region vor.</li>
<li><strong>Fragen sind erlaubt und sinnvoll.</strong> Unklarheiten in den Unterlagen klärst du vor der Abgabe über Bieterfragen; die Antworten gehen an alle.</li>
</ul>
<p>In der Bekanntmachung steht immer, welche Vergabeart gilt. Crewtender zeigt sie zusammen mit Fristen und Losen im Steckbrief.</p>
<p class="klein">Unterhalb der Schwellenwerte gilt die UVgO für Liefer- und Dienstleistungen und die VOB/A für Bauleistungen, jeweils so, wie Bund und Länder sie eingeführt haben. Die UVgO wird 2026 überarbeitet.</p>`,
    quellen: [["§ 119 GWB: Verfahrensarten", `${GII}/gwb/__119.html`], ["§ 15 VgV: Offenes Verfahren", `${GII}/vgv_2016/__15.html`]],
  },
  {
    slug: "zuschlag-und-preis-erfahren",
    frage: "Wie erfahre ich, wer den Zuschlag bekommen hat und zu welchem Preis?",
    kurz: "Als Bieter wirst du informiert: Bei europaweiten Verfahren nennt dir der Auftraggeber vor dem Zuschlag den Namen des Gewinners und die Gründe, warum dein Angebot nicht gewählt wurde. Den Preis erfährst du so meist nicht. Bei großen Aufträgen steht der Auftragswert aber in der Bekanntmachung über den vergebenen Auftrag, und bei Bauaufträgen bekommst du die Angebotssummen aller Bieter.",
    inhalt: () => `<h2>Wenn du mitgeboten hast</h2>
<ul>
<li><strong>Europaweite Verfahren:</strong> Der Auftraggeber muss alle Bieter, die den Zuschlag nicht bekommen, vorher in Textform informieren: Name des erfolgreichen Unternehmens, Gründe für die Ablehnung deines Angebots und der früheste Zeitpunkt des Vertragsschlusses (§ 134 GWB). Der Vertrag darf erst 15 Kalendertage nach dem Absenden geschlossen werden, bei elektronischer Information nach 10 Kalendertagen. In dieser Zeit kannst du die Vergabe überprüfen lassen. Wird eine Leistung über eine Rahmenvereinbarung oder ein dynamisches Beschaffungssystem vergeben, entfällt diese Pflicht seit Juli 2026.</li>
<li><strong>Verfahren unterhalb der Schwellenwerte:</strong> Der Auftraggeber teilt dir mit, dass du den Zuschlag nicht bekommen hast. Auf Verlangen nennt er dir die Gründe, die Vorteile des erfolgreichen Angebots und den Namen des Gewinners.</li>
<li><strong>Bauaufträge nach VOB/A:</strong> Nach der Öffnung der Angebote erhalten die Bieter die Angebotssummen der anderen Bieter. Hier siehst du genau, wo du preislich lagst.</li>
</ul>
<h2>Wenn du nicht mitgeboten hast</h2>
<ul>
<li><strong>Bekanntmachung vergebener Aufträge:</strong> Bei europaweiten Verfahren veröffentlicht der Auftraggeber spätestens 30 Tage nach dem Zuschlag eine Vergabebekanntmachung in TED (§ 39 VgV), in der Regel mit dem Namen des Auftragnehmers und dem Wert des Auftrags.</li>
<li><strong>Kleinere Aufträge:</strong> Nach beschränkten Ausschreibungen und Verhandlungsvergaben ohne Teilnahmewettbewerb informieren viele Auftraggeber auf ihrer Internetseite über vergebene Aufträge ab 25.000 €.</li>
<li><strong>Informationsfreiheit:</strong> Bei Bund und vielen Ländern kannst du Auskunft nach dem Informationsfreiheitsgesetz beantragen. Betriebs- und Geschäftsgeheimnisse wie die Kalkulation eines Mitbewerbers bleiben dabei geschützt.</li>
</ul>
<h2>Warum das wertvoll ist</h2>
<p>Frühere Zuschläge zeigen dir, zu welchen Preisen vergleichbare Aufträge vergeben wurden und wann ein Vertrag ausläuft und neu ausgeschrieben wird. Crewtender wertet bekannt gemachte Zuschläge aus: Der Preisvergleich zeigt frühere Auftragswerte zu ähnlichen Ausschreibungen, und das Neuausschreibungs-Radar meldet, wenn ein laufender Vertrag bald endet.</p>
<h2>Tipp</h2>
<p>Bitte nach einer Absage immer um die Gründe. Die Antwort zeigt dir, ob es am Preis, an den Konzepten oder an fehlenden Unterlagen lag, und macht dein nächstes Angebot besser.</p>`,
    quellen: [["§ 134 GWB: Informations- und Wartepflicht", `${GII}/gwb/__134.html`], ["§ 39 VgV: Vergabebekanntmachung", `${GII}/vgv_2016/__39.html`], ["TED: vergebene Aufträge", "https://ted.europa.eu/de/"]],
  },
  {
    slug: "kleine-firmen-und-neugruendungen",
    mitZahlen: true,
    frage: "Können kleine Firmen und Neugründungen öffentliche Aufträge gewinnen?",
    kurz: "Ja. Öffentliche Auftraggeber müssen Aufträge in Lose aufteilen, damit auch kleine und mittlere Firmen anbieten können, und sie dürfen keine überzogenen Anforderungen an Umsatz oder Referenzen stellen. Wer allein zu klein ist, kann sich mit anderen zu einer Bietergemeinschaft zusammentun oder als Nachunternehmer einsteigen.",
    inhalt: (k) => `<h2>Was das Vergaberecht für kleine Firmen vorsieht</h2>
<ul>
<li><strong>Lose:</strong> Leistungen sind nach Menge (Teillose) und nach Art oder Fachgebiet (Fachlose) aufzuteilen. Mehrere Lose dürfen nur zusammen vergeben werden, wenn wirtschaftliche oder technische Gründe das erfordern (§ 97 Abs. 4 GWB). Du kannst also auf ein einzelnes Gebäude oder ein einzelnes Gewerk bieten.</li>
<li><strong>Umsatz:</strong> Verlangt der Auftraggeber einen Mindestumsatz, darf er in der Regel höchstens das Doppelte des geschätzten Auftragswerts fordern (§ 45 VgV).</li>
<li><strong>Anforderungen müssen zum Auftrag passen:</strong> Eignungskriterien müssen mit dem Auftrag zusammenhängen und angemessen sein (§ 122 GWB).</li>
<li><strong>Weniger Papier:</strong> Seit Juli 2026 genügen zunächst Eigenerklärungen; Bescheinigungen legen in der Regel nur die aussichtsreichen Bieter vor.</li>
</ul>
<h2>Wenn dir Referenzen oder Größe fehlen</h2>
<ul>
<li><strong>Bietergemeinschaft:</strong> Mehrere Firmen geben gemeinsam ein Angebot ab und haften gemeinsam. Umsätze und Referenzen zählen zusammen.</li>
<li><strong>Eignungsleihe:</strong> Du kannst dich auf die Fähigkeiten eines anderen Unternehmens berufen, wenn es dir die Mittel verbindlich zusagt (§ 47 VgV).</li>
<li><strong>Nachunternehmer:</strong> Als Nachunternehmer eines größeren Bieters sammelst du Erfahrung und Referenzen mit öffentlichen Auftraggebern.</li>
<li><strong>Referenzen aus der Privatwirtschaft zählen.</strong> Gefordert sind vergleichbare Leistungen, nicht zwingend öffentliche Aufträge. Bei Neugründungen können auch die Erfahrungen der Inhaber und des Personals belegt werden, wenn die Unterlagen das zulassen.</li>
</ul>
<h2>Wo der Einstieg leichter ist</h2>
<ul>
<li><strong>Kleine Aufträge in deiner Region:</strong> Kommunen, Schulen, Kirchen und kommunale Betriebe vergeben viele kleinere Leistungen.</li>
<li><strong>Verfahren ohne Teilnahmewettbewerb:</strong> Hier fordert der Auftraggeber Firmen direkt auf. Stelle dich bei den Vergabestellen vor und lass dich, wo es das gibt, in Unternehmensverzeichnisse eintragen.</li>
<li><strong>Präqualifikation:</strong> Einmal geprüft, bei jedem Angebot nur noch die Nummer angeben.</li>
</ul>
${katalogSatz(k.zahlen)}
<p>In der ${SUCHE} siehst du ohne Konto, was in deiner Region gerade ausgeschrieben ist. Crewtender zeigt im Steckbrief die Lose einzeln, damit du schnell erkennst, welcher Teil zu deiner Firma passt.</p>`,
    quellen: [["§ 97 GWB: Grundsätze der Vergabe (Lose)", `${GII}/gwb/__97.html`], ["§ 45 VgV: Wirtschaftliche und finanzielle Leistungsfähigkeit", `${GII}/vgv_2016/__45.html`], ["§ 47 VgV: Eignungsleihe", `${GII}/vgv_2016/__47.html`]],
  },
  {
    slug: "ausschreibungsportale-und-kosten",
    frage: "Welche Portale für öffentliche Ausschreibungen gibt es und was kosten sie?",
    kurz: "Die amtlichen Portale sind kostenlos: der Bekanntmachungsservice des Bundes, service.bund.de, die EU-Datenbank TED und die Vergabeplattformen der Länder. Daneben gibt es private Ausschreibungsdienste, die diese Quellen bündeln und durchsuchbar machen; sie kosten je nach Anbieter und Tarif zwischen 0 € und rund 500 € im Monat.",
    inhalt: () => `<h2>Amtliche Portale (kostenlos)</h2>
<div class="tabelle-scroll"><table><thead><tr><th scope="col">Portal</th><th scope="col">Was dort steht</th></tr></thead><tbody>
<tr><td><a href="https://oeffentlichevergabe.de/" rel="noopener">Bekanntmachungsservice</a> (Datenservice Öffentlicher Einkauf)</td><td>Bekanntmachungen von Bund, Ländern und Kommunen an einer Stelle, auch als offene Daten</td></tr>
<tr><td><a href="https://www.service.bund.de/" rel="noopener">service.bund.de</a></td><td>Ausschreibungen von Behörden des Bundes, der Länder und Kommunen</td></tr>
<tr><td><a href="https://ted.europa.eu/de/" rel="noopener">TED</a></td><td>alle europaweiten Ausschreibungen und vergebenen Aufträge</td></tr>
<tr><td><a href="https://www.evergabe-online.de/" rel="noopener">e-Vergabe des Bundes</a></td><td>Unterlagen und Angebotsabgabe für Vergaben des Bundes</td></tr>
<tr><td>Vergabeplattformen der Länder und Kommunen</td><td>Unterlagen und Angebotsabgabe, zum Beispiel der Vergabemarktplatz NRW, die Plattform „Aufträge Bayern“ oder die Hessische Ausschreibungsdatenbank</td></tr>
</tbody></table></div>
<p>Auf den Vergabeplattformen lädst du die Unterlagen und gibst dein Angebot ab. Das ist für Bieter in aller Regel kostenlos; du brauchst nur ein Benutzerkonto.</p>
<h2>Private Ausschreibungsdienste</h2>
<p>Sie sammeln die Bekanntmachungen vieler Quellen, machen sie nach Gewerk und Region durchsuchbar und schicken passende Treffer per E-Mail. Manche fassen zusätzlich die Unterlagen zusammen oder bewerten, ob eine Ausschreibung passt.</p>
<ul>
<li><strong>Kosten:</strong> laut öffentlichen Preisseiten meist zwischen 0 € (einfache Suche) und rund 500 € im Monat; Funktionen mit künstlicher Intelligenz gibt es oft erst in höheren Tarifen, und manche Anbieter nennen Preise nur auf Anfrage.</li>
<li><strong>Worauf du achten solltest:</strong> Welche Quellen sind enthalten? Kannst du nach Region und Gewerk filtern? Gibt es eine Testphase? Wie lange läuft der Vertrag, und wie kündigst du?</li>
</ul>
<p class="klein">Preisspanne nach öffentlich einsehbaren Preisseiten verschiedener Anbieter in Deutschland, Stand ${VERGLEICH_STAND}. Preise und Funktionen können sich ändern.</p>
<h2>Crewtender</h2>
<p>Crewtender liest die amtlichen Bekanntmachungen jede Stunde ein. Die ${SUCHE} ist ohne Konto kostenlos. Die Pläne kosten ${PLAENE.map((p) => `${p.name} ${p.monat} €`).join(", ")} im Monat; neue Firmen testen 30 Tage alle Pro-Funktionen ohne Kreditkarte. Anders als ein reiner Suchdienst rechnet Crewtender auch den Preis mit Tariflöhnen und plant nach dem Zuschlag Personal und Schichten.</p>
<p><a href="/vergleich">Vergleich: Ausschreibungsdienst plus Dienstplan-Software oder Crewtender?</a> · <a href="/preise">Alle Preise</a></p>`,
    quellen: [["Bekanntmachungsservice des Bundes", "https://oeffentlichevergabe.de/"], ["service.bund.de", "https://www.service.bund.de/"], ["TED – Tenders Electronic Daily", "https://ted.europa.eu/de/"]],
  },
];

const zurueck = `<p class="konto-zurueck"><a href="/fragen" aria-label="Alle Fragen">←</a></p>`;

export function fragenUebersicht(): string {
  return `<p>Kurze, geprüfte Antworten auf die Fragen, die Dienstleister und Handwerksbetriebe zu öffentlichen Aufträgen am häufigsten stellen.</p>
<div class="standort-liste einstellungs-liste">${FRAGEN.map((f) => `<a class="standort-zeile" href="/fragen/${f.slug}"><span class="standort-icon" aria-hidden="true">❓</span><span><strong>${escape(f.frage)}</strong><br><span class="klein">${escape(f.kurz.split(". ")[0])}.</span></span></a>`).join("")}</div>
<p class="klein">Stand: ${STAND}. Fehlt eine Frage? <a href="/kontakt">Schreib uns</a>.</p>`;
}

export function frageSeite(f: Frage, k: Kontext): string {
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "de",
    mainEntity: [{ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.kurz } }] }).replace(/</g, "\\u003c");
  return `${zurueck}<p class="frage-antwort"><strong>Kurz gesagt:</strong> ${escape(f.kurz)}</p>
${f.inhalt(k)}
<h2>Quellen</h2>
<ul>${f.quellen.map(([name, url]) => `<li><a href="${escape(url)}" rel="noopener">${escape(name)}</a></li>`).join("")}</ul>
<p class="klein">Stand: ${STAND}. Allgemeine Information, keine Rechtsberatung. Maßgeblich sind die Vergabeunterlagen der einzelnen Ausschreibung und die Regeln des jeweiligen Auftraggebers.</p>
<section class="start-statt"><h2>Passende Ausschreibungen finden</h2><p>Gewerk und Ort eingeben und sehen, was gerade ausgeschrieben ist. Ohne Konto, kostenlos.</p>
<div class="knopf-zeile"><a class="knopf" href="/demo/suche">Ausschreibungen suchen</a><a class="knopf zweit" href="/registrieren">30 Tage Pro gratis testen</a></div></section>
<h2>Weitere Fragen</h2>
<ul>${FRAGEN.filter((x) => x.slug !== f.slug).map((x) => `<li><a href="/fragen/${x.slug}">${escape(x.frage)}</a></li>`).join("")}</ul>
<script type="application/ld+json">${jsonld}</script>`;
}

/** Handles /fragen and /fragen/<slug>; null otherwise. The live numbers are fetched only for the pages that show them. */
export async function fragen(request: Request, adresse: string, antwort: (html: string) => Response, zahlen: () => Promise<StartZahlen | null>): Promise<Response | null> {
  const p = new URL(request.url).pathname.replace(/\/$/, "");
  if (request.method !== "GET" || (p !== "/fragen" && !p.startsWith("/fragen/"))) return null;
  const f = p === "/fragen" ? null : FRAGEN.find((x) => `/fragen/${x.slug}` === p);
  if (p !== "/fragen" && !f) return new Response(null, { status: 301, headers: { location: "/fragen" } });
  const beschreibung = f ? f.kurz : "Antworten auf häufige Fragen zu öffentlichen Ausschreibungen: finden, Kosten, Nachweise, Wertgrenzen, Kalkulation, Vergabearten, Zuschlag, Einstieg für kleine Firmen.";
  const kurzBeschreibung = beschreibung.length > 300 ? `${beschreibung.slice(0, 297).replace(/\s+\S*$/, "")} …` : beschreibung;
  const inhalt = f ? frageSeite(f, { zahlen: f.mitZahlen ? await zahlen().catch(() => null) : null }) : fragenUebersicht();
  const html = seite(f ? f.frage : "Fragen und Antworten zu öffentlichen Ausschreibungen", inhalt)
    .replace("</title>", `</title>\n<meta name="description" content="${escape(kurzBeschreibung)}">\n<meta property="og:description" content="${escape(kurzBeschreibung)}">\n<link rel="canonical" href="${escape(`${adresse}${f ? `/fragen/${f.slug}` : "/fragen"}`)}">`);
  const r = antwort(html);
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.delete("x-robots-tag");
  r.headers.set("x-jv-sprache", "de"); // written in German only; no half-translated page
  return r;
}
