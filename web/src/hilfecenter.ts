// Public help center (/hilfe, /hilfe/<thema>): step-by-step guides with direct links into the app. Benjamin asked for a
// "Wiki" (03.11.2026). Also covers AI literacy (AI Act Art. 4) and data protection / works council duties of the firms.
// Links into /konto lead to the login first when nobody is signed in.
import { escape } from "./seite.ts";

type Schritt = [text: string, link?: string, knopf?: string];
export type Anleitung = { slug: string; icon: string; titel: string; fuer: string; kurz: string; schritte: Schritt[]; tipps?: string[] };

export const ANLEITUNGEN: Anleitung[] = [
  { slug: "erste-schritte", icon: "🚀", titel: "Erste Schritte: Konto und Firma einrichten", fuer: "Inhaber, Geschäftsführung", kurz: "Registrieren, E-Mail bestätigen, Firmenprüfung abwarten.", schritte: [
    ["Auf „Registrieren“ tippen und Vor- und Nachname, Firma, Anschrift und E-Mail eintragen. Bestätigen, dass du für ein Unternehmen handelst, und den Nutzungsbedingungen zustimmen.", "/registrieren", "Registrieren"],
    ["Die Firmenwebsite angeben. Damit erkennt Crewtender eure Leistungen und Standorte und schaltet die KI-Funktionen für die Probezeit frei. Ohne Website startet ein Demo-Modus ohne KI."],
    ["Den Link in der Bestätigungsmail antippen. Du bist danach direkt angemeldet; die Firmenprüfung startet von selbst und dauert ein bis zwei Minuten."],
    ["Das vorgeschlagene Suchprofil prüfen und speichern (siehe Anleitung „Suchprofil“).", "/konto/suchprofil", "Suchprofil öffnen"],
    ["Im Firmenprofil das Land der Firma prüfen. Schichtplan, Stunden, Lohn und Rechnungen nach deutschem Recht gibt es nur für Firmen in Deutschland.", "/konto/firmenprofil", "Firmenprofil öffnen"],
  ], tipps: ["Crewtender auf dem Handy öffnen und zum Home-Bildschirm hinzufügen, dann fühlt es sich an wie eine App."] },
  { slug: "suchprofil", icon: "🔎", titel: "Suchprofil: die passenden Ausschreibungen finden", fuer: "Büro, Vertrieb", kurz: "Arbeiten, Orte, Umkreis und Ausschlusswörter einstellen.", schritte: [
    ["Mehr → Suchprofil öffnen.", "/konto/suchprofil", "Suchprofil öffnen"],
    ["Unter „Arbeiten“ eintragen, was ihr macht (z. B. Unterhaltsreinigung, Objektschutz). Suchwörter ergänzen, die in Ausschreibungen vorkommen."],
    ["Einsatzorte mit Umkreis festlegen oder ganze Bundesländer bzw. Länder wählen."],
    ["Ausschlusswörter eintragen, die ihr nie machen wollt (z. B. „Krankenhaus“, wenn ihr dort nicht arbeitet)."],
    ["Mit „🔍 Vorschau“ sehen, wie viele Ausschreibungen die Einstellungen in der letzten Woche gefunden hätten, dann speichern."],
    ["Ab jetzt prüft Crewtender jeden Morgen die neuen Bekanntmachungen. Treffer mit 👍 oder 👎 bewerten, damit die Suche besser wird.", "/konto/treffer", "Treffer ansehen"],
  ], tipps: ["Mehrere Geschäftsbereiche? Lege mehrere Suchprofile an, zum Beispiel eines für Reinigung und eines für Sicherheit."] },
  { slug: "nachrichten", icon: "📱", titel: "Nachrichten aufs Handy und Fristen im Kalender", fuer: "alle", kurz: "Mitteilungen einschalten, Uhrzeit wählen, Kalender abonnieren.", schritte: [
    ["Crewtender auf dem Handy öffnen. Auf dem iPhone zuerst Teilen → „Zum Home-Bildschirm“ und Crewtender von dort starten."],
    ["Mehr → Einstellungen → „📱 Nachrichten auf diesem Handy einschalten“ und die Mitteilungen erlauben.", "/konto/einstellungen", "Einstellungen öffnen"],
    ["Uhrzeit und Kanal (Mail, Handy oder beides) wählen. Unter „Feiner einstellen“ gibt es Sofort-Nachrichten für Top-Treffer und eine Ruhezeit."],
    ["Unter Fristen → „📲 Alle Fristen im Handy-Kalender“ die Kalender-Adresse abonnieren. Neue Fristen kommen dann von selbst dazu.", "/konto/fristen", "Fristen öffnen"],
  ] },
  { slug: "team", icon: "👥", titel: "Team einladen und Rechte vergeben", fuer: "Inhaber, Admins", kurz: "Kollegen und Einsatzkräfte einladen, Zugriff bewusst wählen.", schritte: [
    ["Firma & Team → App-Zugänge → „Person einladen“.", "/konto/team", "Firma & Team öffnen"],
    ["Zugriff wählen (die „?“ erklären jede Stufe) und den Standort. Finanzen sind aus und werden nur bei Bedarf freigeschaltet. Das Steuerbüro bekommt den Zugriff „Leser“."],
    ["Die Prüfseite lesen: Sie zeigt, was die Person sehen und tun kann. Erst „Ja, so einladen“ erstellt den Link."],
    ["Viele Einsatzkräfte auf einmal: „Einsatzkräfte einladen“, Personen ankreuzen und die Links per WhatsApp, SMS oder als QR-Code-Ausdruck verteilen.", "/konto/kraefte-einladen", "Einsatzkräfte einladen"],
  ], tipps: ["Rechte nur so weit geben, wie die Arbeit es braucht (Datenschutz). Jede Änderung steht im Änderungsprotokoll."] },
  { slug: "firmenprofil-nachweise", icon: "🏢", titel: "Firmenprofil, Eigenerklärung und Nachweise", fuer: "Büro, Geschäftsführung", kurz: "Firmendaten einmal pflegen, Nachweise mit Ablaufdatum hochladen.", schritte: [
    ["Firma & Team → Firmenprofil: Rechtsform, Register, Gründungsjahr, Beschäftigte, Umsätze, Logo, Steuernummer und Land eintragen.", "/konto/firmenprofil", "Firmenprofil öffnen"],
    ["Präqualifikation und Zertifikate unter „➕ Präqualifikation oder Zertifikat“ ergänzen. Daraus entsteht die Eigenerklärung als Word-Datei."],
    ["Unterlagen → Firmenunterlagen: Versicherung, Handelsregister, Unbedenklichkeitsbescheinigungen hochladen.", "/konto/firmenunterlagen", "Firmenunterlagen öffnen"],
    ["Ohne eingetragenes Datum liest die KI das Ablaufdatum aus PDF oder Foto. Solche Daten sind mit „🔍 KI-Datum, bitte prüfen“ markiert: unter Ändern prüfen und speichern."],
    ["Führungszeugnisse nicht hochladen. In der Personalakte wird nur eingetragen, wann es eingesehen wurde."],
  ] },
  { slug: "angebot", icon: "📥", titel: "Vom Treffer zum Angebot", fuer: "Büro, Kalkulation", kurz: "Unterlagen hochladen, Steckbrief prüfen, kalkulieren, freigeben.", schritte: [
    ["Im Treffer „⬇️ Hier runterladen“ antippen und beim Vergabeportal „Alle herunterladen“ wählen (meist eine ZIP-Datei)."],
    ["Die Datei unter „📥 Vergabeunterlagen“ in der Ausschreibung hochladen. Crewtender schreibt in wenigen Minuten einen ausführlichen Steckbrief.", "/konto/unterlagen", "Unterlagen hochladen"],
    ["Den Steckbrief mit den Originalunterlagen abgleichen, besonders Fristen, Lose und geforderte Nachweise. Er ist von einer KI erstellt und kann Fehler enthalten."],
    ["Unter Kalkulation Stundensatz und Preis je Los rechnen; bei GAEB-Dateien die Einheitspreise im Leistungsverzeichnis eintragen.", "/konto/kalkulation", "Kalkulation öffnen"],
    ["„Angebot vorbereiten“: Crewtender schreibt den Text und hakt passende Nachweise an. Die Firmenleitung gibt frei."],
    ["Die Angebotsmappe herunterladen und selbst im Vergabeportal abgeben. Crewtender reicht nichts selbst ein. Danach unter Angebote Zuschlag oder Absage eintragen.", "/konto/angebote", "Angebote öffnen"],
  ] },
  { slug: "personal", icon: "🧑‍🔧", titel: "Personal anlegen und importieren", fuer: "Personalbüro", kurz: "Einzeln anlegen oder per Excel/CSV übernehmen.", schritte: [
    ["Firma & Team → Personal → „＋ Neue Person“ für einzelne Einträge.", "/konto/team", "Firma & Team öffnen"],
    ["Für viele Personen: „Importieren“, die Vorlage (CSV) herunterladen, ausfüllen und hochladen. „Vorschau anzeigen“ zeigt Fehler vor dem Import.", "/konto/personal/import", "Import öffnen"],
    ["Bei jeder Person unter ✏️ Bearbeiten Qualifikationen mit Ablaufdatum, Wochenstunden und Personalnummer (für den Lohnexport) eintragen."],
    ["Keine Gesundheitsangaben eintragen: Für Krankheit „Nicht verfügbar“ wählen, ohne Grund."],
    ["Personen mit Stundenzetteln oder Stempelzeiten der letzten zwei Jahre lassen sich nicht löschen (Aufbewahrungspflicht). Stattdessen über „Checklisten → Austritt“ den Austritt eintragen."],
  ] },
  { slug: "schichtplan", icon: "📅", titel: "Schichten planen und Ausfälle ersetzen", fuer: "Disposition", kurz: "Schichten anlegen, offene Schichten anbieten, Ersatz finden.", schritte: [
    ["Firma & Team → Schichtplan: Datum, Zeit, Einsatzort und Person, auf Wunsch wöchentlich für bis zu 8 Wochen.", "/konto/schichten", "Schichtplan öffnen"],
    ["Crewtender prüft das Arbeitszeitgesetz (höchstens 10 Stunden, 11 Stunden Ruhezeit, Pausen). Bei einem Hinweis die Planung anpassen oder bewusst bestätigen."],
    ["Offene Schicht: Person leer lassen und den Beruf wählen. Passende Einsatzkräfte bekommen eine Nachricht, wer zuerst tippt, bekommt sie."],
    ["Fällt jemand kurzfristig aus, siehst du es auf der Übersicht. Crewtender schlägt freie Leute vor; ein Tipp auf den Namen plant neu."],
  ] },
  { slug: "stunden-lohn", icon: "⏱️", titel: "Stunden, Stempeluhr und Lohnexport", fuer: "Personalbüro, Lohnbüro", kurz: "Stunden freigeben und als Excel, CSV oder DATEV LODAS ausgeben.", schritte: [
    ["Einsatzkräfte tragen Stunden unter „Meine Einsätze & Daten“ ein oder stempeln mit Kommen, Pause und Gehen."],
    ["Firma & Team → Stundenzettel: prüfen und freigeben, mehrere auf einmal.", "/konto/stunden", "Stundenzettel öffnen"],
    ["Für DATEV LODAS einmalig unter Belege → „⚙️ DATEV-Einstellungen“ Berater- und Mandantennummer und die Lohnarten des Lohnbüros eintragen, auch für die steuerfreien Zuschläge nach § 3b (Nacht 25/40 %, Sonntag 50 %, Feiertag 125/150 %).", "/konto/belege", "Belege öffnen"],
    ["Im Stundenzettel den Monat als „💶 Lohnliste“ (Excel), CSV oder LODAS-Datei herunterladen und dem Lohnbüro geben. Crewtender rechnet keinen Lohn aus."],
  ], tipps: ["Feiertage richten sich nach dem Bundesland des Einsatzorts, nicht nach dem Firmensitz."] },
  { slug: "kunden-rechnung", icon: "🧾", titel: "Kunden, Leistungsnachweis und Rechnung", fuer: "Buchhaltung (mit Finanzfreigabe)", kurz: "Kunde anlegen, Stunden bestätigen lassen, Rechnung ausstellen.", schritte: [
    ["Firma & Team → Kunden & Einsatzorte: „➕ Kunde anlegen“ mit Adresse, Verrechnungssatz und Zuschlägen. Für Bauleistungen an Bauunternehmer „§ 13b“ und die USt-IdNr. eintragen.", "/konto/kunden", "Kunden öffnen"],
    ["Leistungsnachweis: pro Kunde und Monat als Word herunterladen oder mit „🔗 Link“ online bestätigen lassen.", "/konto/leistungsnachweis", "Leistungsnachweis öffnen"],
    ["Rechnungen → „🧾 Rechnungsvorlage (Logo, Texte)“: Logo, Einleitung, Schlusstext und Fußzeile einstellen und die Vorschau prüfen.", "/konto/rechnungen", "Rechnungen öffnen"],
    ["Rechnungen für den Monat erstellen. Sie sind zuerst Entwürfe: prüfen, dann „✓ Ausstellen“. Erst dann bekommt die Rechnung ihre fortlaufende Nummer und lässt sich nicht mehr ändern (GoBD)."],
    ["Fehler in einer ausgestellten Rechnung? Nicht löschen, sondern stornieren („Ja, Stornorechnung erstellen“) und neu ausstellen."],
    ["Für öffentliche Auftraggeber die XRechnung herunterladen und im Portal des Auftraggebers hochladen."],
  ] },
  { slug: "belege-datev", icon: "📸", titel: "Belege erfassen und an DATEV geben", fuer: "Buchhaltung", kurz: "Foto machen, KI-Vorschlag prüfen, Buchungsstapel exportieren.", schritte: [
    ["Mehr → Belege → „📸 Beleg erfassen“: Foto oder PDF wählen und „🤖 Auslesen lassen“ antippen.", "/konto/belege", "Belege öffnen"],
    ["Datum, Lieferant, Betrag, Steuersatz und Kategorie prüfen und speichern. Die KI kann sich verlesen."],
    ["Falsch erfasst? „Beleg stornieren“ statt löschen; der Beleg bleibt für die Aufbewahrung erhalten."],
    ["Den Monat als DATEV-Buchungsstapel herunterladen und dem Steuerbüro geben, oder dem Steuerbüro einen Leser-Zugang einrichten."],
  ] },
  { slug: "ki", icon: "🤖", titel: "Was die KI kann und was nicht", fuer: "alle, die mit Crewtender arbeiten (KI-Kompetenz nach Art. 4 KI-Verordnung)", kurz: "Wofür Crewtender KI nutzt, wo sie irrt und was ihr prüfen müsst.", schritte: [
    ["Crewtender nutzt das KI-Modell Claude von Anthropic für: Bewertung von Ausschreibungen, Steckbriefe aus Vergabeunterlagen, Suchprofil aus der Firmenwebsite, Belege und Ablaufdaten auslesen, Angebotstexte."],
    ["KI-Ergebnisse sind gekennzeichnet (🤖). Sie sind Vorschläge: Fristen, Lose, Nachweise und Beträge immer mit dem Original prüfen, bevor ihr euch darauf verlasst."],
    ["Die KI entscheidet nichts über Menschen. Personalsuche, Ersatzvorschläge, Bewertungen und Schichtplanung arbeiten mit festen Regeln; die Entscheidung trifft immer ein Mensch."],
    ["Keine Personalakten, Gesundheitsdaten oder Führungszeugnisse hochladen. Namen von Ansprechpartnern in Vergabeunterlagen werden vor der KI geschwärzt."],
    ["Die Daten gehen an Anthropic in den USA (Standardvertragsklauseln) und werden dort nicht zum Training genutzt. In der Probezeit gibt es ein festes KI-Kontingent je Firma."],
  ] },
  { slug: "datenschutz-arbeitgeber", icon: "⚖️", titel: "Datenschutz und Betriebsrat: eure Pflichten", fuer: "Inhaber, Personalverantwortliche", kurz: "Was ihr als Arbeitgeber beachten müsst, wenn ihr Personal in Crewtender verwaltet.", schritte: [
    ["Den Vertrag zur Auftragsverarbeitung lesen: Für Personal-, Kunden- und Bewerberdaten seid ihr verantwortlich, wir verarbeiten sie in eurem Auftrag.", "/avv", "AVV lesen"],
    ["Beschäftigte und Bewerber informieren, welche Daten ihr in Crewtender speichert (Art. 13 DSGVO)."],
    ["Gibt es einen Betriebsrat, vor dem Einsatz von Stempeluhr, Rundgängen, Bewertungen und Auswertungen zustimmen lassen (§ 87 Abs. 1 Nr. 6 BetrVG; in anderen Ländern die dortige Vertretung)."],
    ["Keine Gesundheitsangaben, Krankheitsgründe oder Strafregisterdaten in Freitextfelder schreiben."],
    ["Crewtender löscht automatisch nach festen Fristen (z. B. Stempelzeiten nach 2 Jahren). Rechnungen und Belege müsst ihr 8 bis 10 Jahre aufbewahren: Vor dem Löschen des Kontos das Archiv herunterladen.", "/datenschutz", "Datenschutzerklärung"],
  ] },
];

const kopf = `<p class="konto-zurueck"><a href="/hilfe" aria-label="Zur Übersicht">←</a></p>`;

export function hilfeUebersicht(): string {
  return `<p>Anleitungen Schritt für Schritt. Die Knöpfe führen direkt an die richtige Stelle in Crewtender.</p>
<div class="standort-liste einstellungs-liste">${ANLEITUNGEN.map((a) => `<a class="standort-zeile" href="/hilfe/${a.slug}"><span class="standort-icon" aria-hidden="true">${a.icon}</span><span><strong>${escape(a.titel)}</strong><br><span class="klein">${escape(a.kurz)}</span></span></a>`).join("")}</div>
<p class="klein">Häufige Fragen nach der Anmeldung unter <a href="/konto/hilfe">Mehr → Hilfe</a>. Nicht gefunden? <a href="/kontakt">Schreib uns</a>.</p>`;
}

export function anleitungSeite(a: Anleitung): string {
  const schritte = a.schritte.map(([text, link, knopf]) => `<li><p>${escape(text)}</p>${link ? `<p><a class="knopf zweit" href="${escape(link)}">${escape(knopf ?? "Öffnen")}</a></p>` : ""}</li>`).join("");
  const i = ANLEITUNGEN.indexOf(a), weiter = ANLEITUNGEN[i + 1];
  return `${kopf}<p class="klein">Für: ${escape(a.fuer)}</p><ol class="einfuehrung-schritte anleitung">${schritte}</ol>
${a.tipps?.length ? `<h2>💡 Tipps</h2><ul>${a.tipps.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>` : ""}
${weiter ? `<p><a href="/hilfe/${weiter.slug}">Weiter: ${escape(weiter.titel)} →</a></p>` : ""}<p class="klein">Etwas unklar? <a href="/kontakt">Schreib uns</a>.</p>`;
}

/** Handles /hilfe and /hilfe/<slug>; null otherwise. */
export function hilfecenter(request: Request, seite: (titel: string, inhalt: string) => string): Response | null {
  const p = new URL(request.url).pathname.replace(/\/$/, "");
  if (request.method !== "GET" || (p !== "/hilfe" && !p.startsWith("/hilfe/"))) return null;
  const a = p === "/hilfe" ? null : ANLEITUNGEN.find((x) => `/hilfe/${x.slug}` === p);
  if (p !== "/hilfe" && !a) return new Response(seite("Nicht gefunden", `${kopf}<p>Diese Anleitung gibt es nicht.</p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response(a ? seite(`${a.icon} ${a.titel}`, anleitungSeite(a)) : seite("📚 Hilfe-Center", hilfeUebersicht()), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
