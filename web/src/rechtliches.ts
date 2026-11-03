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
  stand: "03.11.2026", // Rechtsprüfung: AVV covers the whole app, liability, changes, trial (docs/recht/pruefung-2026-11.md)
  standDatenschutz: "03.11.2026", // chat, patrols, customer portal, AI purposes, operator message, retention
};

const fehlt = (wert: string, was: string) => (wert ? escape(wert) : `<span class="fehler">[${was} fehlt]</span>`);

const anschrift = () =>
  `${escape(FIRMA.name)}, ${escape(FIRMA.firma)}<br>${fehlt(FIRMA.strasse, "Straße")}<br>${fehlt(FIRMA.ort, "PLZ und Ort")}`;

export function impressum(): string {
  return `<h2>Angaben gemäß § 5 DDG</h2>
<p>${anschrift()}</p>
<h2>Kontakt</h2>
<p>E-Mail: <a href="mailto:${FIRMA.email}">${FIRMA.email}</a><br>Kontaktformular: <a href="/kontakt">crewtender.eu/kontakt</a>${FIRMA.telefon ? `<br>Telefon: ${escape(FIRMA.telefon)}` : ""}</p>
${FIRMA.ustId ? `<h2>Umsatzsteuer</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${escape(FIRMA.ustId)}</p>` : FIRMA.kleinunternehmer ? `<h2>Umsatzsteuer</h2><p>Kleinunternehmer nach § 19 UStG, daher keine Umsatzsteuer.</p>` : ""}
<h2>Verantwortlich für den Inhalt</h2>
<p>${escape(FIRMA.name)}, Anschrift wie oben.</p>
<h2>Verbraucherstreitbeilegung</h2>
<p>Crewtender richtet sich nur an Unternehmen. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<h2>Quellen</h2>
<p>Ausschreibungen: Bekanntmachungsservice des Bundes (oeffentlichevergabe.de), Lizenz CC0; BOAMP, DILA (Frankreich), Licence Ouverte 2.0; TED, Amt für Veröffentlichungen der EU (Weiterverwendung mit Quellenangabe); Biuletyn Zamówień Publicznych, UZP (Polen); Plataforma de serveis de contractació pública, Generalitat de Catalunya (Spanien), Llicència oberta d'ús d'informació – Catalunya; SAM.gov und USAspending.gov (USA, öffentliche Daten der US-Bundesregierung); ANAC (Italien), Lizenz CC BY 4.0; Kerndaten nach BVergG 2018 über data.gv.at (Österreich), Lizenz CC BY 4.0 (übersetzt und zusammengefasst). Postleitzahl-Koordinaten: GeoNames, Lizenz CC BY 4.0. Förderprogramme: Förderdatenbank des Bundes, Lizenz CC BY-ND 4.0 DE (nur Titel und Link). Die Bewertungen und Steckbriefe erstellt Crewtender selbst.</p>`;
}

const DIENSTLEISTER = [
  ["Cloudflare, Inc., San Francisco (USA)", "Betrieb der Webseite, Speicher für hochgeladene Unterlagen (Rechenzentren in der EU), Umwandlung der Dateien in Text", "EU-US Data Privacy Framework, Standardvertragsklauseln"],
  ["Supabase, Inc., San Francisco (USA)", "Anmeldung und Datenbank (Firmen, Mitglieder, Ausschreibungen); Server in Frankfurt am Main", "Standardvertragsklauseln"],
  ["Anthropic, PBC, San Francisco (USA)", "KI-Modell Claude: liest Bekanntmachungen und hochgeladene Vergabeunterlagen, erstellt Firmen-Suchprofile mit einer begrenzten Websuche (Firmenname, Website-Text, Firmensitz), liest Belegfotos (Betrag, Datum, Lieferant), Ablaufdaten auf Firmennachweisen und Lose aus Steckbriefen und schreibt Bewertungen und Steckbriefe. Keine Daten aus der Personalakte. Laut Anbieter werden API-Daten nicht zum Training verwendet und nur für eine begrenzte Zeit gespeichert", "Standardvertragsklauseln"],
  ["Namecheap, Inc., Phoenix (USA)", "E-Mail-Postfach kontakt@wpdigitalranger.com: Anmelde-Links, Einladungen und Nachrichten", "Standardvertragsklauseln"],
  ["GitHub, Inc. (Microsoft), San Francisco (USA)", "Tägliche Auswertung der öffentlichen Ausschreibungen mit den Suchprofilen der Firmen; nächtliche verschlüsselte Datensicherung", "EU-US Data Privacy Framework, Standardvertragsklauseln"],
];

const dienstleisterTabelle = () =>
  `<table><tr><th>Dienstleister</th><th>Wofür</th><th>Grundlage für die Übermittlung</th></tr>${DIENSTLEISTER.map((z) => `<tr>${z.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`).join("")}</table>`;

export function datenschutz(): string {
  return `<p class="klein">Stand: ${FIRMA.standDatenschutz}</p>
<h2>1. Verantwortlicher</h2>
<p>${anschrift()}<br>E-Mail: <a href="mailto:${FIRMA.email}">${FIRMA.email}</a></p>
<h2>2. Was Crewtender macht</h2>
<p>Crewtender sucht jeden Tag öffentliche Ausschreibungen, bewertet, ob sie zu einer Firma passen, und schreibt Steckbriefe. Kunden können Vergabeunterlagen hochladen, die Crewtender auswertet. Dazu bietet Crewtender eine Arbeitsoberfläche für Personal, Einsatzplanung, Zeiterfassung, Abrechnung, Kunden und Team-Chat. Für die Daten, die eine Firma dort über ihr Personal, ihre Bewerber und ihre Kunden einträgt, ist die Firma verantwortlich; wir verarbeiten sie in ihrem Auftrag (<a href="/avv">Vertrag zur Auftragsverarbeitung</a>). Crewtender richtet sich nur an Unternehmen.</p>
<h2>3. Welche Daten wir verarbeiten</h2>
<ul>
<li><strong>Beim Aufruf der Seite:</strong> technisch nötige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser). Sie werden vom Betreiber der Server (Cloudflare) kurz zur Sicherheit und Fehlersuche gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb).</li>
<li><strong>Kontaktformular:</strong> Name, E-Mail-Adresse und Nachricht. Wir schicken sie als E-Mail an unser Postfach (Namecheap) und nutzen sie nur zur Beantwortung. Keine Speicherung in der Datenbank; die Mail löschen wir, wenn die Anfrage erledigt ist und keine Aufbewahrungspflicht besteht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Anfrage zu einem Vertrag) oder lit. f (Beantwortung von Anfragen).</li>
<li><strong>Konto:</strong> Name, E-Mail-Adresse, Passwort (nur verschlüsselt gespeichert), Name, Anschrift und freiwillig Telefonnummer der Firma, Zeitpunkt der Registrierung, der Zustimmung und der Anmeldung, Zugehörigkeit zu Firmen, Funktion im Betrieb, Zugriffsrechte und Bereiche. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
<li><strong>Firmendaten:</strong> Firmenname, Standorte, freiwillig angegebene Website, Suchprofil, Ausschreibungen mit Stand und Notizen, Kalkulationswerte. Bei der automatischen Suche zum Einrichten des Suchprofils werden Firmenname, Website und Firmensitz an die öffentliche Websuche von Anthropic übermittelt; passende öffentliche Fundstellen werden mit URL im Profil gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Bei jeder neuen Anmeldung erhält der Betreiber eine Handy-Nachricht mit dem Firmennamen, um Missbrauch zu erkennen (Art. 6 Abs. 1 lit. f DSGVO).</li>
<li><strong>Hochgeladene Unterlagen:</strong> Vergabeunterlagen einer Ausschreibung. Sie können Namen und Kontaktdaten von Ansprechpartnern des Auftraggebers enthalten. Sie werden nur für den Steckbrief gelesen und <strong>nach 30 Tagen gelöscht</strong>. Bitte keine Unterlagen mit Daten eurer Mitarbeiter hochladen (z. B. Lebensläufe). Die Texte gehen zum Lesen an den KI-Dienst Anthropic (siehe Dienstleister).</li>
<li><strong>Ansprechpartner bei Auftraggebern und Partnerbetrieben:</strong> Name, Funktion, dienstliche Telefonnummer und E-Mail-Adresse sowie eine Notiz und Bewertung, die eine Firma selbst einträgt, Ansprechpartner von Verträgen und Anfragen an Nachunternehmer. Die Firma ist dafür verantwortlich; wir verarbeiten die Daten in ihrem Auftrag. Sichtbar nur für das Büroteam dieser Firma; gelöscht, wenn die Firma den Eintrag oder ihr Konto löscht.</li>
<li><strong>Personal der Firma (Einsatzplanung):</strong> Name, Berufe, Qualifikationen, Entgeltgruppe, Telefonnummer, freiwillig E-Mail-Adresse und Foto, Verfügbarkeit, Abwesenheitszeiträume (nur „Urlaub“, „Schulung“ oder „nicht verfügbar“, ohne Gesundheitsangaben), Einsätze bei Kunden mit Zeitraum (für die Fristen nach dem AÜG), Eintrittsdatum, Beschäftigungsart, Wochenstunden, Führerscheinklassen, Sprachen, Wohnort-Postleitzahl (nur für die Entfernung zum Einsatzort), Qualifikationsnachweise mit Ablaufdatum und freiwillig hochgeladener Datei, Teilnahme an Unterweisungen und Notiz der Arbeitskräfte, die eine Firma selbst einträgt. Die Firma ist dafür verantwortlich; wir verarbeiten die Daten in ihrem Auftrag (Vertrag zur Auftragsverarbeitung). Sichtbar nur für Mitglieder mit Zugriff auf den Standort; gespeichert, bis die Firma sie löscht. Nachrichten an diese Personen verschickt Crewtender nicht selbst, sie gehen über WhatsApp, SMS oder Mail vom Gerät der Firma.</li>
<li><strong>Selbstpflege durch Mitarbeitende:</strong> Verknüpft eine Firma den App-Zugang einer Einsatzkraft mit ihrer Personalakte, sieht diese Person nur ihre eigenen Daten: eigene Einsätze, eigene Abwesenheiten, eigene Nachweise und Unterweisungen. Sie kann Urlaub beantragen (bis zur Bestätigung durch das Büro als „beantragt“ gespeichert) und eigene Nachweise hochladen. Daten anderer Personen sieht sie nicht.</li>
<li><strong>Stunden, Schichten, Mitteilungen (seit November 2026):</strong> Stundenzettel (Datum, Beginn, Ende, Pause, Einsatz, Notiz, Freigabe durch wen und wann), Schichten (Datum, Zeit, Ort, Zusage oder Absage), Mitteilungen am Schwarzen Brett mit Lesebestätigung (wer hat wann gelesen), Personalfristen (Ende der Probezeit, Ende einer Befristung, Gültigkeit von Aufenthaltstitel oder Arbeitserlaubnis – nur das Datum, keine Kopie), Führerscheinkontrollen (Datum, Klassen, wer geprüft hat) und digital bestätigte Unterweisungen (Datum, Uhrzeit). Einsatzkräfte sehen davon nur ihre eigenen Daten. Für Handy-Nachrichten zu neuen Schichten und Mitteilungen speichern wir Titel und Kurztext höchstens 30 Tage. Die Firma ist verantwortlich, wir verarbeiten im Auftrag; gespeichert, bis die Firma löscht (Änderungen an Stunden, Schichten und Kontrollen stehen 12 Monate im Änderungsprotokoll).</li>
<li><strong>Kunden, Einsatzorte, Leistungsnachweise:</strong> Kunden der Firma (Name, Anschrift, Ansprechpartner, Telefon, E-Mail, Notiz; Verrechnungssatz nur für Personen mit Finanzfreigabe) und Einsatzorte (Adresse, Ansprechpartner vor Ort, Treffpunkt, Kleidung, Hinweise). Einsatzkräfte sehen nur den Einsatzort ihrer eigenen Schicht. Leistungsnachweise und Zuschlagsstunden (Nacht, Sonntag, Feiertag) berechnet Crewtender aus den freigegebenen Stundenzetteln und speichert dafür nichts zusätzlich. Meldet eine Einsatzkraft einen kurzfristigen Ausfall, speichern wir nur den Tag und dass es kurzfristig war, ohne Grund und ohne Gesundheitsangaben. Bei Führungs- und Gesundheitszeugnissen speichert Crewtender nur das Datum der Einsicht, keine Kopie.</li>
<li><strong>Bewerbungen, Schutzausrüstung, Checklisten, Urlaub, Bewertungen:</strong> Bewerberdaten (Name, Kontakt, Beruf, Quelle, Status, Gesprächstermin, Notiz, hochgeladene Unterlagen) sehen nur Bearbeiter, Standortleitungen und Admins; sie werden 6 Monate nach einer Absage (mögliche Ansprüche nach dem AGG), 30 Tage nach der Einstellung bzw. 12 Monate nach der letzten Änderung ohne Entscheidung gelöscht. Dazu ausgegebene Schutzausrüstung (Artikel, Größe, Datum, Austausch, Rückgabe), Einstiegs- und Austritts-Checklisten mit Austrittsdatum, Urlaubskonten (Anspruch, Übertrag) und Einsatz-Bewertungen durch Kunden (Sterne, ob gern wieder, Notiz). Bewertungen und Checklisten sieht nur das Büro (keine Lesezugänge wie das Steuerbüro); Einsatzkräfte sehen ihre eigene Schutzausrüstung und ihr Urlaubskonto. Die Firma ist verantwortlich, wir verarbeiten im Auftrag.</li>
<li><strong>Team-Organisation:</strong> Vertretungen (wer vertritt wen von wann bis wann, freiwillige Notiz), Aufgaben (Titel, zuständige Person, Fälligkeit, erledigt am) sowie Fahrzeuge und Geräte (Bezeichnung, Kennzeichen oder Inventarnummer, Prüfart und nächster Prüftermin). Sichtbar für das Büroteam der Firma, nicht für Einsatzkräfte; gespeichert, bis die Firma sie löscht. Während einer Vertretung gehen Fristen-Erinnerungen an die Vertretung statt an die abwesende Person. <strong>Team-Chat:</strong> Nachrichten (Text, wer, wann) je Firma, Standort oder Einsatzort; sichtbar nur für die Personen in diesem Chat, gelöscht nach 180 Tagen. <strong>Rundgänge und Wachbuch:</strong> Scan eines Kontrollpunkts (wer, wann, welcher Punkt) und Einträge ins Wachbuch; sichtbar für das Büro des jeweiligen Standorts, nicht für Lesezugänge. <strong>Kundenportal:</strong> Über einen geheimen Link sieht ein Kunde der Firma die Leistungsnachweise (Summen ohne Namen), auf Wunsch Rechnungen und Kontrollgänge sowie bei Vorfällen nur Zeit und Objekt, keinen Text; der Kunde kann Meldungen schicken. Gespeichert ist nur ein Hash des Links; die Firma kann ihn jederzeit abschalten. Die Firma ist verantwortlich, wir verarbeiten im Auftrag.</li>
<li><strong>Firmenunterlagen, Angebotsvorlagen, Angebotsmappen und Abgabenachweise:</strong> Von der Firma bewusst hinterlegte Nachweise, Vorlagen und Eingangsbelege sowie Angebotsentwürfe bleiben bis zur Löschung durch die Administration bzw. zum Ende des Firmenkontos gespeichert. Der Zugriff erfolgt entsprechend den vergebenen Rechten. Ein Ablaufdatum eines Nachweises verhindert die Verwendung in einer neuen Angebotsmappe nach diesem Datum, löscht die Datei aber nicht automatisch. Wenn Firmenmails eingeschaltet sind, werden Ablauf-Erinnerungen 30, 14, 7 und 2 Tage vorher an Mitglieder mit Finanzzugriff versendet.</li>
<li><strong>Tägliche Nachricht:</strong> Nur wenn du selbst eine Uhrzeit wählst, schicken wir dir einmal am Tag neue Treffer und Fristen-Erinnerungen per Mail oder aufs Handy. Für Handy-Nachrichten speichern wir die Push-Adresse, die dein Browser dafür vergibt; die Nachricht läuft über den Push-Dienst deines Browsers (z. B. Google oder Apple), enthält dabei aber keinen Text: den holt dein Handy danach direkt bei uns. Abschalten jederzeit in der Übersicht unter „Tägliche Nachricht“. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</li>
<li><strong>Abrechnung, Zeiterfassung, Unterschriften (seit November 2026):</strong> Rechnungen (Nummer, Kunde, Monat, Positionen, Beträge, beim Ausstellen eingefrorene Absender- und Empfängerdaten; nur mit Finanzfreigabe; ausgestellte Rechnungen werden nicht gelöscht, sondern storniert), Belege (Datum, Lieferant, Betrag, Datei; auf Wunsch liest der KI-Dienst das Belegfoto, das Büro prüft den Vorschlag; Belege werden storniert statt gelöscht), Personalnummer und Geburtstag in der Personalakte (Geburtstag nur für die Erinnerung im Büro), Spesen mit Belegfoto (Art, Betrag, Datum, Notiz, Freigabe), Arbeitszeitkonto (Startdatum und Anfangssaldo; Soll und Ist werden aus den Stunden berechnet), Stempelzeiten (Kommen, Pause, Weiter, Gehen mit der Uhrzeit des Servers). Bei der Stempeluhr fragt das Handy freiwillig einmal nach dem Standort; wir vergleichen ihn im Moment des Stempelns mit der Postleitzahl des Einsatzorts und speichern nur „am Einsatzort ja/nein“, nie die Koordinaten. Unterschriften mit dem Finger (Bild, Datum, wofür) für den Empfang von Schutzausrüstung und die Monatsstunden. Kunden-Bestätigungslinks: eingefrorene Stundenliste des Monats, Name der bestätigenden Person, Anmerkung, freiwillige Unterschrift, Zeitpunkt; der Link ist 30 Tage gültig, gespeichert ist nur ein Hash des Links. Einladungslinks für Einsatzkräfte ohne E-Mail-Adresse (14 Tage gültig, nur ein Hash gespeichert). Die Firma ist verantwortlich, wir verarbeiten im Auftrag. Crewtender verschickt Rechnungen und Links nicht selbst.</li>
<li><strong>Datensicherung und Fehlermeldungen:</strong> Jede Nacht wird die Datenbank verschlüsselt gesichert (im Cloudflare-Speicher mit Rechenzentren in der EU; erstellt über GitHub Actions). Tagessicherungen werden nach 14 Tagen gelöscht, Monatssicherungen nach einem Jahr; gelöschte Daten verschwinden spätestens dann auch aus den Sicherungen. Technische Fehlermeldungen an den Betreiber enthalten keine Namen oder E-Mail-Adressen und werden nach 30 Tagen gelöscht.</li>
<li><strong>Einladungen:</strong> E-Mail-Adresse der eingeladenen Person, damit wir den Einladungs-Link schicken können (bei Links für Einsatzkräfte nur Name und Verknüpfung zur Personalakte).</li>
</ul>
<h2>4. Cookies</h2>
<p>Wir setzen nur technisch nötige Cookies: für die Anmeldung (jv_at, jv_rt, jv_pkce), die zuletzt gewählte Firma (jv_firma) sowie für deine Auswahl und Bedienung: Sprache, Land, Darstellung und Ansicht (jv_psprache, jv_sprache, jv_land, jv_darstellung, jv_ansicht), zuletzt geöffnete Ausschreibungen und letzter Besuch (jv_zuletzt, jv_gesehen) und ob die Einführung schon gezeigt wurde (jv_einfuehrung). Es gibt keine Werbung, keine Analyse und kein Tracking. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG.</p>
<h2>5. Dienstleister</h2>
<p>Wir nutzen diese Dienstleister als Auftragsverarbeiter (Art. 28 DSGVO). Einige sitzen in den USA. Die Übermittlung ist durch die genannten Garantien abgesichert.</p>
${dienstleisterTabelle()}
<h2>6. Speicherdauer</h2>
<p>Hochgeladene Unterlagen und daraus erstellte Steckbriefe: 30 Tage. Wiederverwendbare Firmenunterlagen und Vorlagen: bis zur Löschung durch die Administration oder bis zum Ende des Firmenkontos. Änderungsprotokoll (wer hat wann was in der Firma geändert, nur für Inhaber sichtbar): 12 Monate. Handy-Nachrichten (Titel und Kurztext): 30 Tage. Team-Chat: 180 Tage. Stundenzettel, Stempelzeiten und Überlassungen einer Person: mindestens 2 Jahre (§ 17 MiLoG), so lange lässt sich die Person nicht löschen. Angebotsentwürfe und Textfreigaben sowie weitere Kontodaten und Firmendaten: solange das Konto besteht; danach werden sie gelöscht. Rechnungen und Belege muss die Firma selbst 8 bis 10 Jahre aufbewahren (§ 147 AO, § 14b UStG); vor dem Löschen des Kontos bieten wir dafür ein vollständiges Archiv zum Herunterladen an. Automatisch gelöscht, jeweils gerechnet ab Ende des Kalenderjahres: Stempelzeiten, Rundgang-Scans und Einsatzbewertungen nach 2 Jahren, Abwesenheiten und Wachbuch-Einträge nach 3 Jahren. Fotos und Nachweisdateien einer Person löschen wir mit der Person.</p>
<h2>7. Deine Rechte</h2>
<p>Unter „Mein Profil“ kannst du deine Daten selbst herunterladen, deinen Namen ändern und dein Konto löschen.</p>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f DSGVO. Schreib dazu an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren${FIRMA.aufsicht ? `, zum Beispiel bei der für uns zuständigen: ${escape(FIRMA.aufsicht)}` : ""}.</p>
<h2>8. Pflicht zur Angabe</h2>
<p>Ohne E-Mail-Adresse ist keine Anmeldung möglich. Alles andere ist freiwillig.</p>`;
}

export function nutzungsbedingungen(): string {
  return `<p class="klein">Stand: ${FIRMA.stand}</p>
<h2>1. Anbieter und Geltung</h2>
<p>Crewtender ist ein Angebot von ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} („wir“). Diese Bedingungen gelten für alle Firmen und Personen, die Crewtender nutzen („Kunde“). Crewtender richtet sich nur an Unternehmer im Sinne von § 14 BGB.</p>
<h2>2. Leistung</h2>
<ul>
<li>Crewtender sucht täglich öffentliche Ausschreibungen nach dem Suchprofil des Kunden, bewertet sie und schreibt Steckbriefe aus der öffentlichen Bekanntmachung. Dazu kommt eine Arbeitsoberfläche für Personal, Einsatzplanung, Zeiterfassung, Abrechnung, Kunden und Team-Chat. Funktionen nach deutschem Recht (z. B. Lohn, Zuschläge, Rechnungen, Umsatzsteuer) gibt es nur für Firmen in Deutschland; sie ersetzen keine Prüfung durch Steuerbüro oder Lohnbuchhaltung.</li>
<li>Der Kunde kann Vergabeunterlagen hochladen. Crewtender schreibt daraus einen ausführlichen Steckbrief und hilft bei der Kalkulation.</li>
<li>Firmen können Nachweise und eigene Vorlagen hinterlegen, Angebotsentwürfe bearbeiten und eine Angebotsmappe herunterladen. Angebotsversionen müssen vor dem Download durch die Firmenleitung freigegeben werden. Die Abgabe erfolgt durch den Kunden über den vorgesehenen Weg der Vergabestelle; das Erstellen oder Herunterladen einer Mappe ist keine Abgabe. Ein nachträglich hochgeladener Eingangsbeleg dokumentiert die vom Kunden gemeldete Abgabe.</li>
<li>Crewtender lädt Vergabeunterlagen nicht selbst von Portalen herunter, deren Bedingungen das verbieten. Den Download macht der Kunde selbst über den Link zum Portal.</li>
</ul>
<h2>3. KI und keine Gewähr</h2>
<p>Bewertungen, Steckbriefe und Kalkulationen erstellt eine KI. Sie können unvollständig oder falsch sein. Maßgeblich sind allein die Originalunterlagen der Vergabestelle. Der Kunde prüft vor jedem Angebot Fristen, Anforderungen und Preise selbst. Crewtender ist keine Rechts- oder Steuerberatung. Wir garantieren nicht, dass Crewtender jede passende Ausschreibung findet.</p>
<h2>4. Pflichten des Kunden</h2>
<ul>
<li>Der Kunde lädt nur Unterlagen hoch, die er nutzen darf, und beachtet die Bedingungen der Vergabeportale.</li>
<li>Der Kunde ist für die Daten verantwortlich, die er über sein Personal, seine Bewerber und Kunden einträgt, und informiert diese Personen (Art. 13 DSGVO). Er trägt keine Gesundheitsangaben oder andere besondere Kategorien (Art. 9 DSGVO) und keine Strafregisterdaten (Art. 10 DSGVO) in Freitexte ein. Funktionen, die Leistung oder Verhalten von Beschäftigten auswerten können (z. B. Stempeluhr, Bewertungen, Rundgänge), setzt er nur ein, soweit das bei ihm erlaubt ist; mit Betriebsrat beachtet er dessen Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG).</li>
<li>Zugänge sind persönlich. Der Kunde lädt nur Personen ein, die für ihn arbeiten, und entfernt sie, wenn sie ausscheiden.</li>
</ul>
<h2>5. Preise</h2>
<p>Die Preise und das Paket vereinbaren wir mit jeder Firma gesondert. Während einer Vorschau oder Testphase ist Crewtender kostenlos; eine Testphase endet von selbst, ohne dass ein kostenpflichtiges Paket beginnt. Für Tests kann der Umfang der KI-Auswertungen begrenzt sein. Preise verstehen sich zuzüglich Umsatzsteuer, soweit sie anfällt.</p>
<h2>6. Verfügbarkeit</h2>
<p>Wir bemühen uns um einen störungsfreien Betrieb, schulden aber keine bestimmte Verfügbarkeit. Wartung und Störungen bei Dienstleistern können zu Unterbrechungen führen.</p>
<h2>7. Haftung</h2>
<p>Wir haften unbeschränkt bei Vorsatz, grober Fahrlässigkeit und bei Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, typischen Schaden, höchstens auf die Vergütung der letzten 12 Monate. Bei einer kostenlosen Nutzung (Vorschau, Testphase) haften wir entsprechend § 521 und § 599 BGB nur für Vorsatz und grobe Fahrlässigkeit, für einfache Fahrlässigkeit also nicht. Satz 1 bleibt in allen Fällen unberührt. Für verpasste Fristen, nicht gefundene Ausschreibungen oder verlorene Vergabeverfahren haften wir bei einfacher Fahrlässigkeit nicht, soweit sie auf Angaben der KI beruhen, die der Kunde nach Nummer 3 selbst prüfen muss.</p>
<h2>8. Datenschutz</h2>
<p>Soweit wir für den Kunden personenbezogene Daten verarbeiten, gilt der <a href="/avv">Vertrag zur Auftragsverarbeitung</a>. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
<h2>9. Laufzeit und Kündigung</h2>
<p>Beide Seiten können jederzeit zum Monatsende kündigen, sofern nichts anderes vereinbart ist. Bis zum Ende kann der Kunde seine Daten herunterladen (z. B. Archiv aller Rechnungen und Belege, Stunden, Lohnliste). Nach dem Ende löschen wir die Daten der Firma innerhalb von 30 Tagen; aus den verschlüsselten Sicherungen verschwinden sie spätestens nach einem Jahr.</p>
<h2>10. Schluss</h2>
<p>Es gilt deutsches Recht. Gerichtsstand ist, soweit zulässig, unser Sitz. Änderungen dieser Bedingungen teilen wir per E-Mail mit. Änderungen, die den Kunden nicht schlechter stellen oder nur neue Funktionen betreffen, gelten als angenommen, wenn der Kunde nicht innerhalb von 4 Wochen widerspricht; auf diese Folge weisen wir in der Mitteilung hin. Änderungen an Preisen oder Hauptleistungen brauchen die Zustimmung des Kunden; ohne Zustimmung kann jede Seite zum Monatsende kündigen.</p>`;
}

export function avv(): string {
  return `<p>Vertrag nach Art. 28 DSGVO zwischen der Firma, die Crewtender nutzt („Verantwortlicher“), und ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} („Auftragsverarbeiter“). Er gilt mit der Nutzung von Crewtender. Stand: ${FIRMA.stand}.</p>
<h2>1. Gegenstand</h2>
<p>Der Auftragsverarbeiter betreibt für den Verantwortlichen die Software Crewtender gemäß den <a href="/nutzungsbedingungen">Nutzungsbedingungen</a>: Ausschreibungssuche und -auswertung, Angebote, Personalverwaltung, Einsatzplanung, Zeiterfassung, Abrechnung, Bewerbermanagement, Kundenverwaltung mit Kundenportal, Rundgänge und Wachbuch sowie Team-Chat. Dauer: solange Crewtender genutzt wird.</p>
<h2>2. Art der Daten und Betroffene</h2>
<ul>
<li>Daten: Namen, Kontaktdaten und Rollen der Nutzer; Firmen- und Standortdaten, Notizen und Bearbeitungsstände; hochgeladene Vergabeunterlagen (darin ggf. Kontaktdaten von Ansprechpartnern der Vergabestellen); Personaldaten (Stammdaten, Berufe, Qualifikationen und Nachweise mit Ablaufdatum, Entgeltgruppe und Stundenlohn, Abwesenheiten ohne Grund, Schichten, Stundenzettel, Stempelzeiten mit „am Einsatzort ja/nein“, Spesen, Unterweisungen, Schutzausrüstung, Bewertungen durch Kunden, Unterschriften, Überlassungen nach dem AÜG); Bewerberdaten; Kunden und Einsatzorte; Rechnungen und Belege; Rundgang-Scans und Wachbucheinträge; Chat-Nachrichten. Besondere Kategorien (Art. 9 DSGVO) und Strafregisterdaten (Art. 10 DSGVO) sollen nicht eingetragen werden; für Führungs- und Gesundheitszeugnisse speichert Crewtender nur das Datum der Einsicht.</li>
<li>Betroffene: Beschäftigte, Leiharbeitskräfte und Bewerber des Verantwortlichen, Nutzer, Kunden und deren Ansprechpartner, Ansprechpartner von Vergabestellen und Partnerbetrieben.</li>
<li>Zweck: Suchen, Bewerten und Auswerten von Ausschreibungen, Angebotserstellung, Personal- und Einsatzplanung, Zeiterfassung, Abrechnung und Zusammenarbeit im Team.</li>
</ul>
<h2>3. Pflichten des Auftragsverarbeiters</h2>
<ul>
<li>Er verarbeitet die Daten nur auf dokumentierte Weisung des Verantwortlichen; die Nutzung der Funktionen von Crewtender gilt als Weisung. Hält er eine Weisung für rechtswidrig, weist er den Verantwortlichen unverzüglich darauf hin (Art. 28 Abs. 3 Unterabsatz 2 DSGVO).</li>
<li>Personen mit Zugriff sind zur Vertraulichkeit verpflichtet.</li>
<li>Er trifft die technischen und organisatorischen Maßnahmen nach Nummer 6.</li>
<li>Er unterstützt den Verantwortlichen bei Anfragen Betroffener und bei Pflichten nach Art. 32 bis 36 DSGVO.</li>
<li>Er meldet Verletzungen des Schutzes personenbezogener Daten unverzüglich, möglichst innerhalb von 24 Stunden.</li>
<li>Nach Ende des Auftrags löscht er die Daten innerhalb von 30 Tagen oder gibt sie auf Wunsch vorher in gängigen Formaten (CSV, Excel, Word, XRechnung, Originaldateien) heraus; aus den verschlüsselten Sicherungen verschwinden sie spätestens nach einem Jahr.</li>
<li>Er stellt alle nötigen Informationen zum Nachweis dieser Pflichten bereit und ermöglicht Überprüfungen nach vorheriger Anmeldung.</li>
</ul>
<h2>4. Unterauftragsverarbeiter</h2>
<p>Der Verantwortliche genehmigt diese Unterauftragsverarbeiter. Der Auftragsverarbeiter verpflichtet sie vertraglich auf dieselben Datenschutzpflichten (Art. 28 Abs. 4 DSGVO). Über neue informiert er vorher per E-Mail; der Verantwortliche kann aus wichtigem Grund innerhalb von 14 Tagen widersprechen.</p>
${dienstleisterTabelle()}
<h2>5. Drittländer</h2>
<p>Übermittlungen in die USA erfolgen nur auf Grundlage der in der Tabelle genannten Garantien (Art. 44 ff. DSGVO).</p>
<h2>6. Technische und organisatorische Maßnahmen</h2>
<ul>
<li>Verschlüsselte Übertragung (HTTPS), Speicherung der Unterlagen in Rechenzentren in der EU.</li>
<li>Anmeldung mit Passwort (nur verschlüsselt gespeichert, mindestens 8 Zeichen) oder per E-Mail-Link; Sitzungs-Cookies nur über HTTPS und nicht für Skripte lesbar.</li>
<li>Rechte auf Datenbank-Ebene: Jeder sieht nur die Daten seiner Firma und seiner Bereiche.</li>
<li>Hochgeladene Unterlagen werden automatisch nach 30 Tagen gelöscht.</li>
<li>Änderungsprotokoll: Änderungen an Personal, Standorten, Zugängen und Ausschreibungen werden mit Person und Zeit festgehalten, sind nur für Inhaber sichtbar und werden nach 12 Monaten gelöscht.</li>
<li>Zugänge zu den Dienstleistern sind auf den Auftragsverarbeiter beschränkt und mit starker Anmeldung geschützt.</li>
<li>Nächtliche verschlüsselte Sicherung der Datenbank (AES-256) im Cloudflare-Speicher mit Rechenzentren in der EU; Tagessicherungen 14 Tage, Monatssicherungen ein Jahr.</li>
</ul>
<h2>7. Schluss</h2>
<p>Bei Widersprüchen geht dieser Vertrag den Nutzungsbedingungen vor, soweit es um Datenschutz geht. Wer einen unterschriebenen Vertrag braucht, schreibt an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>.</p>`;
}

export function startseite(beispiel: string): string {
  return `<h1>Crewtender findet passende Ausschreibungen für deine Firma</h1>
<p>Jeden Morgen liest Crewtender alle neuen öffentlichen Ausschreibungen in Deutschland, rund 500 am Tag, und zeigt dir nur die, die zu deiner Firma passen.</p>
<h2>So funktioniert's</h2>
<ol>
<li><strong>Treffer jeden Morgen:</strong> Crewtender bewertet jede Ausschreibung mit 1 bis 10 Punkten und sagt in einem Satz, warum sie passt oder nicht, sortiert nach deinen Standorten.</li>
<li><strong>Steckbrief auf einen Blick:</strong> Fristen, Lose, Mengen, geforderte Nachweise und Referenzen, Zuschlagskriterien und eine klare Empfehlung.</li>
<li><strong>Unterlagen prüfen und kalkulieren:</strong> Tippe auf „Hier runterladen“, wähle die Datei aus, und Crewtender liest alle Vergabeunterlagen. Danach rechnet er mit deinen Löhnen den Angebotspreis pro Stunde und pro Los aus.</li>
</ol>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Jetzt registrieren</a><a class="knopf zweit" href="/demo">🎬 Erst ansehen (Demo ohne Anmeldung)</a></div>
<p>Schon ein Konto? <a href="/anmelden">Anmelden</a></p>
<p class="klein">Nach der Bestätigung deiner E-Mail-Adresse geht es sofort los. Fragen an <a href="mailto:${FIRMA.email}">${FIRMA.email}</a>.</p>
<h2>Ausschreibungen nach Gewerk</h2>
<p><a href="/ausschreibungen/elektro">Elektro</a> · <a href="/ausschreibungen/sanitaer-heizung-lueftung">Sanitär, Heizung, Lüftung</a> · <a href="/ausschreibungen/tischler-schreiner">Tischler</a> · <a href="/ausschreibungen/gebaeudereinigung">Gebäudereinigung</a> · <a href="/ausschreibungen/maler-trockenbau">Maler und Trockenbau</a> · <a href="/ausschreibungen/dach-zimmerer">Dach und Zimmerer</a> · <a href="/ausschreibungen/garten-landschaftsbau-winterdienst">Garten- und Landschaftsbau</a> · <a href="/ausschreibungen/sicherheitsdienst">Sicherheitsdienst</a> · <a href="/ausschreibungen/bodenbelaege-fliesen">Bodenbeläge und Fliesen</a> · <a href="/ausschreibungen/zeitarbeit-personaldienstleister">Zeitarbeit</a> · <a href="/ausschreibungen">alle</a></p>
<h2>Beispiel-Steckbrief</h2>
<details><summary>Leihpersonal für die Gastronomie der Deutschen Bundesbank (aufklappen)</summary>${beispiel}</details>`;
}
