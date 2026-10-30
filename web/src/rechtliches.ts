// Legal pages (Impressum, Datenschutz, Nutzungsbedingungen, AVV) and the start page.
// Drafts written by Claude, checked by Benjamin; no legal advice. Fill in the FIRMA fields below.
import { escape } from "./seite.ts";

export const FIRMA = {
  name: "Benjamin Schiffer",
  firma: "WP Digital Ranger",
  strasse: "Rochusstraße 19", // e.g. "Musterstraße 1"
  ort: "52531 Übach-Palenberg", // e.g. "12345 Musterstadt"
  telefon: "", // optional
  email: "kontakt@wpdigitalranger.com",
  ustId: "", // USt-IdNr., if any
  kleinunternehmer: true, // true: § 19 UStG
  aufsicht: "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213 Düsseldorf, www.ldi.nrw.de", // data protection authority of the state, e.g. "Landesbeauftragte für Datenschutz ..., https://..."
  stand: "30.10.2026",
};

const fehlt = (wert: string, was: string) => (wert ? escape(wert) : `<span class="fehler">[${was} fehlt]</span>`);

const anschrift = () =>
  `${escape(FIRMA.name)}, ${escape(FIRMA.firma)}<br>${fehlt(FIRMA.strasse, "Straße")}<br>${fehlt(FIRMA.ort, "PLZ und Ort")}`;

export function impressum(): string {
  return `<h2>Angaben gemäß § 5 DDG</h2>
<p>${anschrift()}</p>
<h2>Kontakt</h2>
<p>E-Mail: <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>${FIRMA.telefon ? `<br>Telefon: ${escape(FIRMA.telefon)}` : ""}</p>
${FIRMA.ustId ? `<h2>Umsatzsteuer</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${escape(FIRMA.ustId)}</p>` : FIRMA.kleinunternehmer ? `<h2>Umsatzsteuer</h2><p>Kleinunternehmer nach § 19 UStG, daher keine Umsatzsteuer.</p>` : ""}
<h2>Verantwortlich für den Inhalt</h2>
<p>${escape(FIRMA.name)}, Anschrift wie oben.</p>
<h2>Verbraucherstreitbeilegung</h2>
<p>Jarvis richtet sich nur an Unternehmen. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<h2>Quellen</h2>
<p>Ausschreibungen: Bekanntmachungsservice des Bundes (oeffentlichevergabe.de), Lizenz CC0. Förderprogramme: Förderdatenbank des Bundes, Lizenz CC BY-ND 4.0 DE (nur Titel und Link). Die Bewertungen und Steckbriefe erstellt Jarvis selbst.</p>`;
}

const DIENSTLEISTER = [
  ["Cloudflare, Inc., San Francisco (USA)", "Betrieb der Webseite, Speicher für hochgeladene Unterlagen (Rechenzentren in der EU), Umwandlung der Dateien in Text", "EU-US Data Privacy Framework, Standardvertragsklauseln"],
  ["Supabase, Inc., San Francisco (USA)", "Anmeldung und Datenbank (Firmen, Mitglieder, Ausschreibungen); Server in Frankfurt am Main", "Standardvertragsklauseln"],
  ["Anthropic, PBC, San Francisco (USA)", "KI-Modell Claude: liest Bekanntmachungen und Unterlagen und schreibt Bewertungen und Steckbriefe. Laut Anbieter werden API-Daten nicht zum Training verwendet", "Standardvertragsklauseln"],
  ["Namecheap, Inc., Phoenix (USA)", "E-Mail-Postfach kontakt@wpdigitalranger.com: Anmelde-Links, Einladungen und Nachrichten", "Standardvertragsklauseln"],
  ["GitHub, Inc. (Microsoft), San Francisco (USA)", "Tägliche Auswertung der öffentlichen Ausschreibungen mit den Suchprofilen der Firmen", "EU-US Data Privacy Framework, Standardvertragsklauseln"],
];

const dienstleisterTabelle = () =>
  `<table><tr><th>Dienstleister</th><th>Wofür</th><th>Grundlage für die Übermittlung</th></tr>${DIENSTLEISTER.map((z) => `<tr>${z.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`).join("")}</table>`;

export function datenschutz(): string {
  return `<p class="klein">Stand: ${FIRMA.stand}</p>
<h2>1. Verantwortlicher</h2>
<p>${anschrift()}<br>E-Mail: <a href="mailto:${FIRMA.email}">${FIRMA.email}</a></p>
<h2>2. Was Jarvis macht</h2>
<p>Jarvis sucht jeden Tag öffentliche Ausschreibungen, bewertet, ob sie zu einer Firma passen, und schreibt Steckbriefe. Kunden können Vergabeunterlagen hochladen, die Jarvis auswertet. Jarvis richtet sich nur an Unternehmen.</p>
<h2>3. Welche Daten wir verarbeiten</h2>
<ul>
<li><strong>Beim Aufruf der Seite:</strong> technisch nötige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser). Sie werden vom Betreiber der Server (Cloudflare) kurz zur Sicherheit und Fehlersuche gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb).</li>
<li><strong>Konto:</strong> Name, E-Mail-Adresse, Passwort (nur verschlüsselt gespeichert), Name, Anschrift und freiwillig Telefonnummer der Firma, Zeitpunkt der Registrierung, der Zustimmung und der Anmeldung, Zugehörigkeit zu Firmen, Funktion im Betrieb, Zugriffsrechte und Bereiche. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
<li><strong>Firmendaten:</strong> Firmenname, Standorte, Suchprofil, Ausschreibungen mit Stand und Notizen, Kalkulationswerte.</li>
<li><strong>Hochgeladene Unterlagen:</strong> Vergabeunterlagen einer Ausschreibung. Sie können Namen und Kontaktdaten von Ansprechpartnern des Auftraggebers enthalten. Sie werden nur für den Steckbrief gelesen und <strong>nach 30 Tagen gelöscht</strong>. Bitte keine Unterlagen mit Daten eurer Mitarbeiter hochladen (z. B. Lebensläufe).</li>
<li><strong>Firmenunterlagen, Angebotsvorlagen, Angebotsmappen und Abgabenachweise:</strong> Von der Firma bewusst hinterlegte Nachweise, Vorlagen und Eingangsbelege sowie Angebotsentwürfe bleiben bis zur Löschung durch die Administration bzw. zum Ende des Firmenkontos gespeichert. Der Zugriff erfolgt entsprechend den vergebenen Rechten. Ein Ablaufdatum eines Nachweises verhindert die Verwendung in einer neuen Angebotsmappe nach diesem Datum, löscht die Datei aber nicht automatisch. Wenn Firmenmails eingeschaltet sind, werden Ablauf-Erinnerungen 30, 14, 7 und 2 Tage vorher an Mitglieder mit Finanzzugriff versendet.</li>
<li><strong>Tägliche Nachricht:</strong> Nur wenn du selbst eine Uhrzeit wählst, schicken wir dir einmal am Tag neue Treffer und Fristen-Erinnerungen per Mail oder aufs Handy. Für Handy-Nachrichten speichern wir die Push-Adresse, die dein Browser dafür vergibt; die Nachricht läuft über den Push-Dienst deines Browsers (z. B. Google oder Apple), enthält dabei aber keinen Text: den holt dein Handy danach direkt bei uns. Abschalten jederzeit in der Übersicht unter „Tägliche Nachricht“. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</li>
<li><strong>Einladungen:</strong> E-Mail-Adresse der eingeladenen Person, damit wir den Einladungs-Link schicken können.</li>
</ul>
<h2>4. Cookies</h2>
<p>Wir setzen nur technisch nötige Cookies: für die Anmeldung (jv_at, jv_rt, jv_pkce) und die zuletzt gewählte Firma (jv_firma). Es gibt keine Werbung, keine Analyse und kein Tracking. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG.</p>
<h2>5. Dienstleister</h2>
<p>Wir nutzen diese Dienstleister als Auftragsverarbeiter (Art. 28 DSGVO). Einige sitzen in den USA. Die Übermittlung ist durch die genannten Garantien abgesichert.</p>
${dienstleisterTabelle()}
<h2>6. Speicherdauer</h2>
<p>Hochgeladene Unterlagen und daraus erstellte Steckbriefe: 30 Tage. Wiederverwendbare Firmenunterlagen und Vorlagen: bis zur Löschung durch die Administration oder bis zum Ende des Firmenkontos. Angebotsentwürfe und Textfreigaben sowie weitere Kontodaten und Firmendaten: solange das Konto besteht; danach werden sie gelöscht, außer wir müssen sie aus gesetzlichen Gründen aufbewahren (z. B. Rechnungen 8 bis 10 Jahre).</p>
<h2>7. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f DSGVO. Schreib dazu an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren${FIRMA.aufsicht ? `, zum Beispiel bei der für uns zuständigen: ${escape(FIRMA.aufsicht)}` : ""}.</p>
<h2>8. Pflicht zur Angabe</h2>
<p>Ohne E-Mail-Adresse ist keine Anmeldung möglich. Alles andere ist freiwillig.</p>`;
}

export function nutzungsbedingungen(): string {
  return `<p class="klein">Stand: ${FIRMA.stand}</p>
<h2>1. Anbieter und Geltung</h2>
<p>Jarvis ist ein Angebot von ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} („wir“). Diese Bedingungen gelten für alle Firmen und Personen, die Jarvis nutzen („Kunde“). Jarvis richtet sich nur an Unternehmer im Sinne von § 14 BGB.</p>
<h2>2. Leistung</h2>
<ul>
<li>Jarvis sucht täglich öffentliche Ausschreibungen nach dem Suchprofil des Kunden, bewertet sie und schreibt Steckbriefe aus der öffentlichen Bekanntmachung.</li>
<li>Der Kunde kann Vergabeunterlagen hochladen. Jarvis schreibt daraus einen ausführlichen Steckbrief und hilft bei der Kalkulation.</li>
<li>Firmen können Nachweise und eigene Vorlagen hinterlegen, Angebotsentwürfe bearbeiten und eine Angebotsmappe herunterladen. Angebotsversionen müssen vor dem Download durch die Firmenleitung freigegeben werden. Die Abgabe erfolgt durch den Kunden über den vorgesehenen Weg der Vergabestelle; das Erstellen oder Herunterladen einer Mappe ist keine Abgabe. Ein nachträglich hochgeladener Eingangsbeleg dokumentiert die vom Kunden gemeldete Abgabe.</li>
<li>Jarvis lädt Vergabeunterlagen nicht selbst von Portalen herunter, deren Bedingungen das verbieten. Den Download macht der Kunde selbst über den Link zum Portal.</li>
</ul>
<h2>3. KI und keine Gewähr</h2>
<p>Bewertungen, Steckbriefe und Kalkulationen erstellt eine KI. Sie können unvollständig oder falsch sein. Maßgeblich sind allein die Originalunterlagen der Vergabestelle. Der Kunde prüft vor jedem Angebot Fristen, Anforderungen und Preise selbst. Jarvis ist keine Rechts- oder Steuerberatung. Wir garantieren nicht, dass Jarvis jede passende Ausschreibung findet.</p>
<h2>4. Pflichten des Kunden</h2>
<ul>
<li>Der Kunde lädt nur Unterlagen hoch, die er nutzen darf, und beachtet die Bedingungen der Vergabeportale.</li>
<li>Der Kunde lädt keine besonderen Kategorien personenbezogener Daten (Art. 9 DSGVO) und möglichst keine Daten seiner Mitarbeiter hoch.</li>
<li>Zugänge sind persönlich. Der Kunde lädt nur Personen ein, die für ihn arbeiten, und entfernt sie, wenn sie ausscheiden.</li>
</ul>
<h2>5. Preise</h2>
<p>Die Preise und das Paket vereinbaren wir mit jeder Firma gesondert. Während einer Vorschau oder Testphase ist Jarvis kostenlos.</p>
<h2>6. Verfügbarkeit</h2>
<p>Wir bemühen uns um einen störungsfreien Betrieb, schulden aber keine bestimmte Verfügbarkeit. Wartung und Störungen bei Dienstleistern können zu Unterbrechungen führen.</p>
<h2>7. Haftung</h2>
<p>Wir haften unbeschränkt bei Vorsatz, grober Fahrlässigkeit und bei Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, typischen Schaden, höchstens auf die Vergütung der letzten 12 Monate. Für verpasste Fristen, nicht gefundene Ausschreibungen oder verlorene Vergabeverfahren haften wir nicht, soweit sie auf Angaben der KI beruhen, die der Kunde nach Nummer 3 selbst prüfen muss.</p>
<h2>8. Datenschutz</h2>
<p>Soweit wir für den Kunden personenbezogene Daten verarbeiten, gilt der <a href="/avv">Vertrag zur Auftragsverarbeitung</a>. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
<h2>9. Laufzeit und Kündigung</h2>
<p>Beide Seiten können jederzeit zum Monatsende kündigen, sofern nichts anderes vereinbart ist. Nach dem Ende löschen wir die Daten der Firma innerhalb von 30 Tagen.</p>
<h2>10. Schluss</h2>
<p>Es gilt deutsches Recht. Gerichtsstand ist, soweit zulässig, unser Sitz. Änderungen dieser Bedingungen teilen wir per E-Mail mit; widerspricht der Kunde nicht innerhalb von 4 Wochen, gelten sie als angenommen. Auf diese Folge weisen wir in der Mitteilung hin.</p>`;
}

export function avv(): string {
  return `<p>Vertrag nach Art. 28 DSGVO zwischen der Firma, die Jarvis nutzt („Verantwortlicher“), und ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} („Auftragsverarbeiter“). Er gilt mit der Nutzung von Jarvis. Stand: ${FIRMA.stand}.</p>
<h2>1. Gegenstand</h2>
<p>Der Auftragsverarbeiter betreibt für den Verantwortlichen den Ausschreibungs-Alarm Jarvis gemäß den <a href="/nutzungsbedingungen">Nutzungsbedingungen</a>. Dauer: solange Jarvis genutzt wird.</p>
<h2>2. Art der Daten und Betroffene</h2>
<ul>
<li>Daten: Namen und E-Mail-Adressen der Nutzer, Rollen, Firmen- und Standortdaten, Notizen und Bearbeitungsstände, hochgeladene Vergabeunterlagen (darin ggf. Kontaktdaten von Ansprechpartnern der Vergabestellen).</li>
<li>Betroffene: Mitarbeiter des Verantwortlichen, Ansprechpartner von Vergabestellen.</li>
<li>Zweck: Suchen, Bewerten und Auswerten von Ausschreibungen, Zusammenarbeit im Team.</li>
</ul>
<h2>3. Pflichten des Auftragsverarbeiters</h2>
<ul>
<li>Er verarbeitet die Daten nur auf dokumentierte Weisung des Verantwortlichen; die Nutzung der Funktionen von Jarvis gilt als Weisung.</li>
<li>Personen mit Zugriff sind zur Vertraulichkeit verpflichtet.</li>
<li>Er trifft die technischen und organisatorischen Maßnahmen nach Nummer 6.</li>
<li>Er unterstützt den Verantwortlichen bei Anfragen Betroffener und bei Pflichten nach Art. 32 bis 36 DSGVO.</li>
<li>Er meldet Verletzungen des Schutzes personenbezogener Daten unverzüglich, möglichst innerhalb von 24 Stunden.</li>
<li>Nach Ende des Auftrags löscht er die Daten innerhalb von 30 Tagen oder gibt sie auf Wunsch vorher heraus.</li>
<li>Er stellt alle nötigen Informationen zum Nachweis dieser Pflichten bereit und ermöglicht Überprüfungen nach vorheriger Anmeldung.</li>
</ul>
<h2>4. Unterauftragsverarbeiter</h2>
<p>Der Verantwortliche genehmigt diese Unterauftragsverarbeiter. Über neue informiert der Auftragsverarbeiter vorher per E-Mail; der Verantwortliche kann aus wichtigem Grund innerhalb von 14 Tagen widersprechen.</p>
${dienstleisterTabelle()}
<h2>5. Drittländer</h2>
<p>Übermittlungen in die USA erfolgen nur auf Grundlage der in der Tabelle genannten Garantien (Art. 44 ff. DSGVO).</p>
<h2>6. Technische und organisatorische Maßnahmen</h2>
<ul>
<li>Verschlüsselte Übertragung (HTTPS), Speicherung der Unterlagen in Rechenzentren in der EU.</li>
<li>Anmeldung mit Passwort (nur verschlüsselt gespeichert, mindestens 8 Zeichen) oder per E-Mail-Link; Sitzungs-Cookies nur über HTTPS und nicht für Skripte lesbar.</li>
<li>Rechte auf Datenbank-Ebene: Jeder sieht nur die Daten seiner Firma und seiner Bereiche.</li>
<li>Hochgeladene Unterlagen werden automatisch nach 30 Tagen gelöscht.</li>
<li>Zugänge zu den Dienstleistern sind auf den Auftragsverarbeiter beschränkt und mit starker Anmeldung geschützt.</li>
<li>Sicherungen der Datenbank durch den Anbieter.</li>
</ul>
<h2>7. Schluss</h2>
<p>Bei Widersprüchen geht dieser Vertrag den Nutzungsbedingungen vor, soweit es um Datenschutz geht. Wer einen unterschriebenen Vertrag braucht, schreibt an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>.</p>`;
}

export function startseite(beispiel: string): string {
  return `<h1>Jarvis findet passende Ausschreibungen für deine Firma</h1>
<p>Jeden Morgen liest Jarvis alle neuen öffentlichen Ausschreibungen in Deutschland, rund 500 am Tag, und zeigt dir nur die, die zu deiner Firma passen.</p>
<h2>So funktioniert's</h2>
<ol>
<li><strong>Treffer jeden Morgen:</strong> Jarvis bewertet jede Ausschreibung mit 1 bis 10 Punkten und sagt in einem Satz, warum sie passt oder nicht, sortiert nach deinen Standorten.</li>
<li><strong>Steckbrief auf einen Blick:</strong> Fristen, Lose, Mengen, geforderte Nachweise und Referenzen, Zuschlagskriterien und eine klare Empfehlung.</li>
<li><strong>Unterlagen prüfen und kalkulieren:</strong> Tippe auf „Hier runterladen“, wähle die Datei aus, und Jarvis liest alle Vergabeunterlagen. Danach rechnet er mit deinen Löhnen den Angebotspreis pro Stunde und pro Los aus.</li>
</ol>
<p><a class="knopf" href="/registrieren">Jetzt registrieren</a></p>
<p>Schon ein Konto? <a href="/anmelden">Anmelden</a></p>
<p class="klein">Nach der Bestätigung deiner E-Mail-Adresse geht es sofort los. Fragen an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>.</p>
<h2>Beispiel-Steckbrief</h2>
<details><summary>Leihpersonal für die Gastronomie der Deutschen Bundesbank (aufklappen)</summary>${beispiel}</details>`;
}
