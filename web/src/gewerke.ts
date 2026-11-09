// Public trade pages for search engines: /ausschreibungen and /ausschreibungen/<gewerk>. Each page shows live numbers
// and recent examples from the tender catalogue (public notice data via gewerk_statistik), what Crewtender does for this
// trade and links to the demo and registration. Plus robots.txt and sitemap.xml.
import { ANLEITUNGEN } from "./hilfecenter.ts";
import { ISO2 } from "./besucher.ts";
import { escape, seite } from "./seite.ts";
import { FR_PFADE } from "./gewerke-fr.ts";
import { LAND_PFADE } from "./gewerke-land.ts";
import { alternativen } from "./gewerke-sprachen.ts";
import { BUNDESLAENDER } from "./nuts.ts";

/** arten: sub-categories shown as chips; danach: what the app does once the contract is won (default DANACH). */
type Gewerk = { slug: string; name: string; h1: string; cpv: string[]; intro: string; vorteile: string[]; fragen: [string, string][]; arten?: string[]; danach?: string[] };

/** After the award: the part no tender service offers (competitor check 09.11.2026, docs/wettbewerb.md). */
const DANACH = ["Schichten oder Einsätze planen, Zusagen sehen, Lücken füllen", "Stunden per Handy erfassen, im Büro freigeben, Lohnliste für DATEV", "Leistungsnachweis zum Unterschreiben und Rechnung, auch als XRechnung"];
export type Statistik = { monat: number; offen: number; beispiele: { id?: string; titel: string; auftraggeber: string; ort: string; frist: string | null; link: string }[]; stand?: string };

const ALLGEMEIN: [string, string][] = [
  ["Was kostet Crewtender?", "Die Registrierung ist kostenlos. Du siehst sofort passende Ausschreibungen für deine Firma und kannst alles in Ruhe ausprobieren."],
  ["Woher kommen die Ausschreibungen?", "Aus den amtlichen Bekanntmachungen (Bekanntmachungsservice des Bundes, EU-Amtsblatt TED). Crewtender liest täglich alle neuen Ausschreibungen in Deutschland, über 1.000 pro Woche."],
];

const ALLE: Gewerk[] = [
  { slug: "elektro", name: "Elektro", h1: "Öffentliche Ausschreibungen für Elektroarbeiten", cpv: ["45311", "45315", "45317", "45310"], arten: ["Elektroinstallation", "Beleuchtung", "Photovoltaik", "Brandmelde- und Sicherheitstechnik", "Blitzschutz", "Wartung und Prüfung"],
    intro: "Schulen, Kitas, Rathäuser und Wohnungsbaugesellschaften vergeben laufend Elektroinstallation, Beleuchtung, PV-Anlagen und Wartung. Crewtender findet die Aufträge, die zu deinem Betrieb und Einzugsgebiet passen, und sagt in einem Satz, warum.",
    vorteile: ["Elektroinstallation, Sicherheitsbeleuchtung, PV und Wartung getrennt erkannt", "Steckbrief mit Losen, Mengen, Fristen und geforderten Nachweisen (z. B. Eintragung Installateurverzeichnis)", "Kalkulation pro Los mit deinen Stundensätzen"],
    fragen: [["Lohnen sich öffentliche Aufträge für kleine Elektrobetriebe?", "Ja. Viele Ausschreibungen sind in Lose geteilt oder betreffen einzelne Gebäude. Crewtender zeigt dir Größe, Entfernung und Frist auf einen Blick, damit du schnell entscheidest."]] },
  { slug: "sanitaer-heizung-lueftung", name: "Sanitär, Heizung, Lüftung", h1: "Öffentliche Ausschreibungen für Sanitär, Heizung und Lüftung", cpv: ["4533"], arten: ["Heizung und Wärmepumpe", "Lüftung und Klima", "Sanitärinstallation", "Kälteanlagen", "Wartung"],
    intro: "Heizungstausch, Lüftungsanlagen, Sanitärsanierung in Schulen und Verwaltungsgebäuden: SHK gehört zu den am häufigsten ausgeschriebenen Gewerken. Crewtender sortiert die passenden Aufträge nach deinem Standort.",
    vorteile: ["SHK-Leistungen aus Neubau und Sanierung, auch wenn sie in großen Bauvorhaben stecken", "Fristen im Kalender, Erinnerung vor Ablauf", "Steckbrief mit Leistungsumfang und Nachweisen"],
    fragen: [["Wie finde ich SHK-Aufträge in meiner Region?", "Bei der Einrichtung gibst du deinen Firmensitz und Umkreis an. Crewtender zeigt dann nur Ausschreibungen in diesem Gebiet, mit Entfernung in Kilometern."]] },
  { slug: "tischler-schreiner", name: "Tischler und Schreiner", h1: "Öffentliche Ausschreibungen für Tischler- und Schreinerarbeiten", cpv: ["45421"], arten: ["Türen und Fenster", "Innenausbau", "Einbaumöbel", "Bautischlerei"],
    intro: "Türen, Fenster, Innenausbau und Einbaumöbel werden bei fast jedem öffentlichen Bau einzeln vergeben. Crewtender findet die Lose, die zu deiner Werkstatt passen.",
    vorteile: ["Tischlerlose aus großen Bauvorhaben herausgefiltert", "Leistungsverzeichnis (GAEB) direkt einlesen und Einheitspreise eintragen", "Hinweis auf geforderte Referenzen"],
    fragen: [["Kann ich ein GAEB-Leistungsverzeichnis mit Crewtender bearbeiten?", "Ja. Crewtender liest GAEB-Dateien, du trägst die Einheitspreise ein und lädst die Datei für die Abgabe wieder herunter."]] },
  { slug: "gebaeudereinigung", name: "Gebäudereinigung", h1: "Öffentliche Ausschreibungen für Gebäudereinigung und Glasreinigung", cpv: ["90911", "90919", "90910"], arten: ["Unterhaltsreinigung", "Glasreinigung", "Grundreinigung", "Sonderreinigung", "Bauendreinigung", "Winterdienst"], danach: ["Objekte mit Einsatzort, Treffpunkt und Arbeitskleidung, Einsatzkräfte fest zuordnen", "Stunden per Handy, Leistungsnachweis mit Unterschrift des Kunden", "Lohnliste mit Tariflohn Gebäudereinigung für DATEV, Rechnung je Objekt"],
    intro: "Unterhaltsreinigung, Glasreinigung und Grundreinigung für Schulen, Kitas und Verwaltung werden oft in Lose aufgeteilt – ideal auch für kleinere Reinigungsfirmen. Crewtender zeigt dir passende Lose mit Flächen, Intervallen und Laufzeit.",
    vorteile: ["Unterhalts-, Glas- und Sonderreinigung getrennt erkannt", "Kalkulation mit Leistungswerten, Tariflohn Gebäudereinigung und Zuschlägen", "Schichtplan, Stundenzettel und Leistungsnachweis für die Objekte gleich mit dabei"],
    fragen: [["Rechnet Crewtender mit dem Branchenmindestlohn Gebäudereinigung?", "Ja. Die Lohngruppen des Rahmentarifvertrags sind hinterlegt; du kannst eigene Löhne und Zuschläge eintragen."]] },
  { slug: "maler-trockenbau", name: "Maler und Trockenbau", h1: "Öffentliche Ausschreibungen für Maler-, Putz- und Trockenbauarbeiten", cpv: ["45442", "45441", "45410", "45324"], arten: ["Malerarbeiten", "Innenputz", "Fassade", "Trockenbau", "Wärmedämmung"],
    intro: "Malerarbeiten, Putz und Trockenbau stecken in nahezu jeder Sanierung öffentlicher Gebäude. Crewtender findet die einzelnen Gewerke, auch wenn sie Teil eines großen Bauvorhabens sind.",
    vorteile: ["Maler-, Putz- und Trockenbaulose einzeln erkannt", "Entfernung und Frist auf einen Blick", "Steckbrief mit Mengen und Ausführungszeitraum"],
    fragen: [["Sind das nur große Bauprojekte?", "Nein. Viele Vergaben betreffen einzelne Schulen, Kitas oder Wohnungen und sind für Handwerksbetriebe mit wenigen Mitarbeitern machbar."]] },
  { slug: "dach-zimmerer", name: "Dach und Zimmerer", h1: "Öffentliche Ausschreibungen für Dachdecker- und Zimmererarbeiten", cpv: ["45261", "45422"], arten: ["Dachdeckerarbeiten", "Dachabdichtung", "Zimmererarbeiten", "Holzbau", "Klempnerarbeiten"],
    intro: "Dachsanierungen, Aufstockungen und Holzbau für Kitas und Schulen: Crewtender findet die passenden Ausschreibungen in deinem Umkreis und zeigt Frist, Umfang und Nachweise.",
    vorteile: ["Dach-, Zimmerer- und Holzbaulose erkannt", "Fristen und Bieterfragen im Kalender", "Steckbrief mit Zuschlagskriterien"],
    fragen: [["Muss ich für jede Ausschreibung die Unterlagen lesen?", "Nein. Crewtender fasst die Bekanntmachung zusammen. Wenn du Unterlagen hochlädst, liest Crewtender alle Dokumente und schreibt einen ausführlichen Steckbrief."]] },
  { slug: "garten-landschaftsbau-winterdienst", name: "Garten- und Landschaftsbau", h1: "Öffentliche Ausschreibungen für Grünpflege, Garten- und Landschaftsbau und Winterdienst", cpv: ["77310", "77311", "77313", "77314", "90620", "90630"], arten: ["Grünflächenpflege", "Mahd", "Baumpflege", "Spielplätze", "Winterdienst", "Straßenbegleitgrün"], danach: ["Kolonnen und Touren planen, Einsätze per Handy bestätigen", "Stunden je Objekt per Handy erfassen, Geräte als Betriebsmittel verwalten", "Lohnliste für DATEV und Rechnung je Auftraggeber"],
    intro: "Grünflächenpflege, Baumpflege und Winterdienst werden von Kommunen und Wohnungsgesellschaften regelmäßig und oft in Losen vergeben. Crewtender zeigt dir die Aufträge in deinem Gebiet.",
    vorteile: ["Grünpflege, Baumpflege und Winterdienst getrennt erkannt", "Neuausschreibungs-Radar: Verträge, die bald auslaufen", "Schichtplan und Stundenzettel für die Kolonnen"],
    fragen: [["Was ist das Neuausschreibungs-Radar?", "Crewtender merkt sich, wann laufende Verträge enden, und erinnert dich rechtzeitig, bevor dieselbe Leistung neu ausgeschrieben wird."]] },
  { slug: "sicherheitsdienst", name: "Sicherheitsdienst", h1: "Öffentliche Ausschreibungen für Sicherheits- und Bewachungsdienste", cpv: ["79710", "79713", "79714", "79715"], arten: ["Objektschutz", "Pforten- und Empfangsdienst", "Streifendienst", "Veranstaltungsschutz", "Unterkunftsbewachung", "Zugangskontrolle"], danach: ["Dienstplan mit Nacht-, Sonntags- und Feiertagszuschlägen, offene Schichten zum Übernehmen", "§ 34a-Sachkunde und Unterrichtungen mit Ablauf-Warnung, Wachbuch", "Stunden per Handy, Lohnliste für DATEV, Rechnung je Objekt"],
    intro: "Objektschutz, Empfangsdienst, Streifendienst und Veranstaltungsschutz für Behörden, Kliniken und Unterkünfte. Crewtender findet die Ausschreibungen und prüft die geforderten Nachweise wie Sachkunde § 34a GewO.",
    vorteile: ["Bewachung, Empfang und Veranstaltungsschutz erkannt", "Personalsuche nach Qualifikation (z. B. § 34a) für die Besetzung", "Schichtplan mit offenen Schichten zum Selbst-Übernehmen"],
    fragen: [["Hilft Crewtender bei der Personalplanung?", "Ja. Du siehst, wer frei ist und welche Nachweise gültig sind, planst Schichten und lässt Einsatzkräfte offene Schichten per App übernehmen."]] },
  { slug: "bodenbelaege-fliesen", name: "Bodenbeläge und Fliesen", h1: "Öffentliche Ausschreibungen für Bodenbelags- und Fliesenarbeiten", cpv: ["45432", "45431"], arten: ["Bodenbeläge", "Fliesen", "Estrich", "Beschichtungen", "Parkett"],
    intro: "Bodenbeläge, Beschichtungen und Fliesenarbeiten werden bei Sanierungen und Neubauten einzeln vergeben. Crewtender findet die passenden Lose in deinem Umkreis.",
    vorteile: ["Boden- und Fliesenlose aus Bauvorhaben herausgefiltert", "Leistungsverzeichnis (GAEB) einlesen und bepreisen", "Erinnerung an Fristen und Bieterfragen"],
    fragen: [["Wie schnell sehe ich neue Ausschreibungen?", "Jeden Morgen. Auf Wunsch per Mail oder Handy-Nachricht zu deiner Uhrzeit."]] },
  { slug: "zeitarbeit-personaldienstleister", name: "Zeitarbeit und Personaldienstleister", h1: "Öffentliche Ausschreibungen für Zeitarbeit und Arbeitnehmerüberlassung", cpv: ["79620", "79621", "79622", "79624", "79625"], arten: ["Arbeitnehmerüberlassung", "Leihpersonal Gastronomie", "Reinigungskräfte", "Bürokräfte", "Pflegekräfte", "Rahmenverträge"], danach: ["AÜG-Wächter: Equal Pay, Höchstüberlassungsdauer, Branchenzuschläge", "Einsätze beim Kunden planen, Stunden per Handy, Bestätigung durch den Kunden", "Lohnliste und Rechnung je Kunde"],
    intro: "Behörden, Kliniken und Kantinen suchen Leihpersonal für Gastronomie, Reinigung, Büro und Pflege – oft als mehrjähriger Rahmenvertrag. Viele dieser Aufträge laufen nicht unter „Arbeitnehmerüberlassung“, sondern unter der eigentlichen Tätigkeit. Crewtender findet sie trotzdem.",
    vorteile: ["Erkennt Personalbedarf auch in Gastro-, Reinigungs- und Büroausschreibungen", "AÜG-Wächter: Equal Pay, Höchstüberlassungsdauer, Branchenzuschläge", "Stunden, Leistungsnachweis mit Online-Bestätigung durch den Kunden, Lohnliste"],
    fragen: [["Was macht der AÜG-Wächter?", "Er rechnet pro Leiharbeitskraft und Kunde, ab wann Equal Pay und welche Branchenzuschlagsstufe gilt und wann die Höchstüberlassungsdauer endet."]] },
  { slug: "architektur-ingenieurleistungen", name: "Architektur und Ingenieure", h1: "Öffentliche Ausschreibungen für Architektur- und Ingenieurleistungen", cpv: ["7120", "7121", "7122", "7124", "7125", "713", "7152", "7154"], arten: ["Objektplanung", "Tragwerksplanung", "Technische Ausrüstung (TGA)", "Bauleitung", "SiGeKo", "Gutachten"],
    intro: "Kommunen, Länder und Bund vergeben laufend Planungsleistungen nach HOAI: Objektplanung, Tragwerk, technische Ausrüstung, Bauüberwachung und SiGeKo. Crewtender findet die Verfahren, die zu deinem Büro und Einzugsgebiet passen.",
    vorteile: ["Leistungsphasen und Fachplanungen aus der Bekanntmachung erkannt", "Steckbrief mit Teilnahmewettbewerb, Eignungskriterien und geforderten Referenzen", "Fristen für Teilnahmeanträge und Bieterfragen im Kalender"],
    danach: ["Projekte und Termine im Team verteilen, Aufgaben mit Fälligkeit", "Stunden je Projekt erfassen und auswerten", "Rechnung und XRechnung an den Auftraggeber"],
    fragen: [["Findet Crewtender auch VgV-Verfahren mit Teilnahmewettbewerb?", "Ja. Crewtender liest alle Bekanntmachungen und zeigt dir die Frist für den Teilnahmeantrag und die geforderten Referenzen."]] },
  { slug: "strassenbau-kanalbau", name: "Straßen- und Kanalbau", h1: "Öffentliche Ausschreibungen für Straßenbau, Kanalbau und Tiefbau", cpv: ["45233", "45232", "45231", "45221", "45234", "45236", "45247", "45246"], arten: ["Straßen- und Wegebau", "Kanal- und Leitungsbau", "Brückenbau", "Gleisbau", "Pflasterarbeiten", "Wasserbau"],
    intro: "Straßensanierungen, Kanal- und Leitungsbau, Rad- und Wirtschaftswege: Tiefbau gehört zu den am häufigsten ausgeschriebenen Leistungen in Deutschland. Crewtender zeigt dir die Lose in deinem Umkreis mit Frist und Umfang.",
    vorteile: ["Straßen-, Kanal- und Leitungsbau getrennt erkannt", "Leistungsverzeichnis (GAEB) einlesen und bepreisen", "Entfernung zur Baustelle und Ausführungszeitraum auf einen Blick"],
    danach: ["Kolonnen und Baustellen planen, Einsätze per Handy bestätigen", "Stunden je Baustelle per Handy erfassen, Geräte als Betriebsmittel verwalten", "Leistungsnachweis, Rechnung und XRechnung an den Auftraggeber"],
    fragen: [["Kann ich ein GAEB-Leistungsverzeichnis für Tiefbau bepreisen?", "Ja. Crewtender liest GAEB-Dateien, du trägst die Einheitspreise ein und lädst die Datei für die Abgabe wieder herunter."]] },
  { slug: "rohbau-beton-geruestbau", name: "Rohbau, Beton und Gerüstbau", h1: "Öffentliche Ausschreibungen für Rohbau, Betonarbeiten, Mauerwerk und Gerüstbau", cpv: ["45262", "45223", "4521"], arten: ["Rohbau", "Beton- und Stahlbetonarbeiten", "Mauerarbeiten", "Gerüstbau", "Stahlbau", "Betonsanierung"],
    intro: "Rohbau, Beton, Mauerwerk und Gerüste für Schulen, Sporthallen, Feuerwehrhäuser und Verwaltungsbauten werden als eigene Lose vergeben. Crewtender findet sie, auch wenn sie in großen Bauvorhaben stecken.",
    vorteile: ["Rohbau-, Beton-, Mauer- und Gerüstlose erkannt", "Steckbrief mit Mengen, Ausführungszeitraum und Nachweisen", "Kalkulation mit deinen Löhnen und Zuschlägen"],
    fragen: [["Sind auch kleinere Lose dabei?", "Ja. Viele Vergaben betreffen einzelne Gebäude oder Bauabschnitte. Crewtender zeigt Größe, Entfernung und Frist, damit du schnell entscheidest."]] },
  { slug: "abbruch-erdarbeiten", name: "Abbruch und Erdarbeiten", h1: "Öffentliche Ausschreibungen für Abbruch, Erdarbeiten und Baustellenvorbereitung", cpv: ["45110", "45111", "45112", "45113"], arten: ["Abbruch und Rückbau", "Erdarbeiten", "Baugruben", "Schadstoffsanierung", "Baustelleneinrichtung"],
    intro: "Rückbau, Erdarbeiten und Baufeldfreimachung stehen am Anfang fast jeder öffentlichen Baumaßnahme. Crewtender zeigt dir diese Ausschreibungen in deinem Gebiet, mit Frist und Umfang.",
    vorteile: ["Abbruch, Erdbau und Schadstoffsanierung erkannt", "Geforderte Nachweise (z. B. Fachkunde TRGS 519) im Steckbrief", "Entfernung und Ausführungszeitraum auf einen Blick"],
    fragen: [["Wie schnell sehe ich neue Ausschreibungen?", "Jeden Morgen. Auf Wunsch per Mail oder Handy-Nachricht zu deiner Uhrzeit."]] },
  { slug: "it-dienstleistungen", name: "IT-Dienstleistungen", h1: "Öffentliche Ausschreibungen für IT-Dienstleistungen, Software und IT-Betrieb", cpv: ["722", "7225", "7226", "7231", "7241", "7250", "7260", "7261"], arten: ["Softwareentwicklung", "IT-Betrieb und Support", "Webseiten und Portale", "Beratung", "Wartung und Pflege", "Schulung"],
    intro: "Behörden schreiben Softwareentwicklung, Pflege bestehender Systeme, IT-Support und Webprojekte aus, oft als Rahmenvertrag über mehrere Jahre. Crewtender findet die passenden Verfahren und fasst die Anforderungen zusammen.",
    vorteile: ["Entwicklung, Betrieb, Support und Beratung getrennt erkannt", "Steckbrief mit Eignungskriterien, Referenzen und Zuschlagskriterien", "Bieterfragen und Fristen im Kalender"],
    danach: ["Einsätze und Projekte im Team planen", "Stunden je Projekt per Handy oder Browser erfassen", "Leistungsnachweis und Rechnung, auch als XRechnung"],
    fragen: [["Hilft Crewtender bei Rahmenverträgen?", "Ja. Der Steckbrief zeigt Laufzeit, Abrufmengen und Preisblatt, und das Neuausschreibungs-Radar erinnert dich, bevor ein Vertrag ausläuft."]] },
  { slug: "abfall-entsorgung", name: "Abfall und Entsorgung", h1: "Öffentliche Ausschreibungen für Abfallentsorgung und Verwertung", cpv: ["9050", "9051", "9052", "9053"], arten: ["Abfallsammlung", "Containerdienst", "Verwertung", "Sonderabfall", "Altpapier und Wertstoffe"],
    intro: "Kommunen und Landesbetriebe vergeben Sammlung, Transport und Verwertung von Abfällen meist als mehrjährige Verträge in Losen. Crewtender findet die Ausschreibungen in deinem Gebiet.",
    vorteile: ["Sammlung, Containerdienst und Verwertung erkannt", "Laufzeit, Mengen und Lose im Steckbrief", "Neuausschreibungs-Radar für auslaufende Verträge"],
    danach: ["Touren und Fahrer planen, Einsätze per Handy bestätigen", "Stunden per Handy erfassen, Fahrzeuge als Betriebsmittel verwalten", "Lohnliste für DATEV und Rechnung je Auftraggeber"],
    fragen: [["Was ist das Neuausschreibungs-Radar?", "Crewtender merkt sich, wann laufende Verträge enden, und erinnert dich rechtzeitig, bevor dieselbe Leistung neu ausgeschrieben wird."]] },
  { slug: "bildung-kurse", name: "Bildung und Kurse", h1: "Öffentliche Ausschreibungen für Bildung, Kurse und Arbeitsmarktdienstleistungen", cpv: ["8040", "8041", "8042", "8050", "8052", "8053", "8058"], arten: ["Erwachsenenbildung", "Sprach- und Integrationskurse", "Maßnahmen für Jobcenter", "Schulungen", "Coaching"],
    intro: "Jobcenter, Arbeitsagenturen und Verwaltungen vergeben Kurse, Weiterbildungen und Maßnahmen an Bildungsträger, oft regional in Losen. Crewtender findet sie und zeigt Ort, Laufzeit und Teilnehmerzahl.",
    vorteile: ["Maßnahmen und Kurse nach Region und Thema erkannt", "Steckbrief mit Teilnehmerzahl, Laufzeit, Qualifikation der Lehrkräfte und Zulassung", "Fristen und Bieterfragen im Kalender"],
    danach: ["Dozenten und Kurse planen, Ausfälle vertreten", "Nachweise und Qualifikationen der Lehrkräfte mit Ablauf-Warnung", "Stunden erfassen, Lohnliste und Rechnung"],
    fragen: [["Passt Crewtender für Bildungsträger?", "Ja. Du findest die Maßnahmen, planst Dozenten mit ihren Qualifikationen und erfasst die Stunden für Abrechnung und Lohn."]] },
  { slug: "brandschutz-sicherheitstechnik", name: "Brandschutz und Sicherheitstechnik", h1: "Öffentliche Ausschreibungen für Brandschutz, Brandmelde- und Sicherheitstechnik", cpv: ["45343", "45312", "3515", "3523"], arten: ["Brandmeldeanlagen", "Einbruchmeldeanlagen", "Videoüberwachung", "Zutrittskontrolle", "Feuerlöscher und Wartung"],
    intro: "Brandmeldeanlagen, Einbruchmeldetechnik, Zutrittskontrolle und Feuerlöscher werden für Schulen, Kliniken und Verwaltungen regelmäßig neu vergeben oder gewartet. Crewtender findet die passenden Ausschreibungen.",
    vorteile: ["Brandmelde-, Einbruchmelde- und Videotechnik erkannt", "Geforderte Zertifizierungen (z. B. DIN 14675, VdS) im Steckbrief", "Wartungsverträge im Neuausschreibungs-Radar"],
    fragen: [["Erkennt Crewtender geforderte Zertifizierungen?", "Ja. Der Steckbrief listet die geforderten Nachweise, und unter Firmenunterlagen legst du deine Zertifikate mit Ablaufdatum ab."]] },
  { slug: "pflege-soziale-dienste", name: "Pflege und soziale Dienste", h1: "Öffentliche Ausschreibungen für Pflege, Betreuung und soziale Dienste", cpv: ["8531", "8532", "8514", "8511"], arten: ["Ambulante Pflege", "Betreuung", "Schulbegleitung", "Sozialarbeit", "Flüchtlingsbetreuung"],
    intro: "Kommunen und Landkreise vergeben Betreuung, Schulbegleitung, Sozialarbeit und Pflegeleistungen an freie Träger und Dienste. Crewtender findet diese Ausschreibungen und fasst Personalanforderungen und Laufzeit zusammen.",
    vorteile: ["Pflege, Betreuung und Sozialarbeit erkannt", "Steckbrief mit Personalschlüssel, Qualifikationen und Laufzeit", "Kalkulation mit Tariflöhnen und Zuschlägen"],
    danach: ["Dienstplan mit Nacht-, Sonntags- und Feiertagszuschlägen", "Qualifikationen und Nachweise mit Ablauf-Warnung", "Stunden per Handy, Lohnliste und Rechnung"],
    fragen: [["Rechnet Crewtender mit Pflege-Mindestlöhnen?", "Ja. Die Mindestentgelte der Pflege sind hinterlegt; du kannst eigene Löhne und Zuschläge eintragen."]] },
  { slug: "wartung-haustechnik", name: "Wartung Haustechnik", h1: "Öffentliche Ausschreibungen für Wartung und Instandhaltung von Haustechnik", cpv: ["5070", "5071", "5072", "5073", "5075"], arten: ["Heizungswartung", "Lüftung und Klima", "Aufzüge", "Elektrische Anlagen", "Störungsdienst"],
    intro: "Wartung von Heizung, Lüftung, Aufzügen und elektrischen Anlagen wird meist als Rahmenvertrag über mehrere Jahre vergeben. Crewtender findet die Ausschreibungen und erinnert dich, bevor Verträge auslaufen.",
    vorteile: ["Wartungsverträge nach Anlagenart erkannt", "Laufzeit, Objekte und Reaktionszeiten im Steckbrief", "Neuausschreibungs-Radar für auslaufende Verträge"],
    danach: ["Wartungstermine und Bereitschaft planen", "Einsätze per Handy dokumentieren, Leistungsnachweis mit Unterschrift", "Rechnung je Objekt und Auftraggeber"],
    fragen: [["Wann werden Wartungsverträge neu vergeben?", "Meist nach zwei bis vier Jahren. Das Neuausschreibungs-Radar zeigt dir, welche Verträge bald enden."]] },
  { slug: "schuelerbefoerderung-personenverkehr", name: "Schülerbeförderung und Fahrdienste", h1: "Öffentliche Ausschreibungen für Schülerbeförderung und Fahrdienste", cpv: ["6011", "6013", "6014", "6017"], arten: ["Schülerbeförderung", "Behindertenfahrdienst", "Linienverkehr", "Mietwagen mit Fahrer"],
    intro: "Landkreise und Städte vergeben Schülerbeförderung und Fahrdienste meist pro Schuljahr oder für mehrere Jahre, oft in vielen kleinen Losen. Crewtender findet die Lose in deinem Gebiet.",
    vorteile: ["Schülerbeförderung und Fahrdienste nach Region erkannt", "Touren, Fahrzeuganforderungen und Laufzeit im Steckbrief", "Fristen im Kalender"],
    danach: ["Fahrer und Touren planen, Vertretung bei Ausfall", "Führerschein- und Personenbeförderungsschein mit Ablauf-Warnung", "Stunden erfassen, Lohnliste und Rechnung"],
    fragen: [["Prüft Crewtender die Führerscheine meiner Fahrer?", "Crewtender erinnert an die regelmäßige Führerscheinkontrolle und an ablaufende Nachweise wie den Personenbeförderungsschein."]] },
  { slug: "veranstaltungen-messen", name: "Veranstaltungen und Messen", h1: "Öffentliche Ausschreibungen für Veranstaltungen, Messen und Events", cpv: ["7995", "9235", "7952"], arten: ["Veranstaltungsorganisation", "Messebau und Messeteams", "Hostessen und Servicepersonal", "Technik und Bühne"],
    intro: "Ministerien, Messen und Städte vergeben Organisation, Personal und Technik für Veranstaltungen. Crewtender findet die Ausschreibungen und fasst Termine, Orte und Personalbedarf zusammen.",
    vorteile: ["Organisation, Personal und Technik erkannt", "Termine und Personalbedarf im Steckbrief", "Kalkulation mit Zuschlägen für Wochenende und Nacht"],
    fragen: [["Kann ich Messepersonal mit Crewtender planen?", "Ja. Du planst Schichten, Einsatzkräfte übernehmen offene Schichten per App, und die Stunden fließen in Lohnliste und Rechnung."]] },
  { slug: "umzuege-logistik", name: "Umzüge und Logistik", h1: "Öffentliche Ausschreibungen für Umzüge, Transporte und Logistik", cpv: ["6000", "6010", "6310", "98392"], arten: ["Büroumzüge", "Möbeltransporte", "Lagerlogistik", "Kurierdienste"],
    intro: "Behörden, Hochschulen und Kliniken vergeben Umzüge, Transporte und Lagerleistungen, oft als Rahmenvertrag. Crewtender findet die Ausschreibungen in deinem Gebiet.",
    vorteile: ["Umzüge, Transporte und Lager erkannt", "Mengen, Zeitraum und Abrufe im Steckbrief", "Fristen und Bieterfragen im Kalender"],
    fragen: [["Wie schnell sehe ich neue Ausschreibungen?", "Jeden Morgen. Auf Wunsch per Mail oder Handy-Nachricht zu deiner Uhrzeit."]] },
  { slug: "catering-kantine", name: "Catering und Kantine", h1: "Öffentliche Ausschreibungen für Catering, Schulverpflegung und Kantinen", cpv: ["5552", "5551", "5532", "5531"], arten: ["Schul- und Kitaverpflegung", "Kantinenbetrieb", "Catering für Veranstaltungen", "Essen auf Rädern"],
    intro: "Schulträger, Kitas, Behörden und Kliniken vergeben Verpflegung und Kantinenbetrieb, meist für mehrere Jahre. Crewtender findet die Ausschreibungen und zeigt Essenszahlen, Laufzeit und Anforderungen.",
    vorteile: ["Schulverpflegung, Kantine und Catering erkannt", "Essenszahlen, Qualitätsanforderungen und Laufzeit im Steckbrief", "Kalkulation mit Löhnen für Küche und Service"],
    danach: ["Küchen- und Servicepersonal planen, offene Schichten per App", "Gesundheitsbelehrung und Hygieneschulungen mit Ablauf-Warnung", "Stunden, Lohnliste für DATEV und Rechnung"],
    fragen: [["Findet Crewtender auch Leihpersonal für Kantinen?", "Ja. Viele Kantinen suchen Personal über Ausschreibungen für Arbeitnehmerüberlassung oder Servicepersonal; Crewtender erkennt beides."]] },
  { slug: "hausmeister-facility-management", name: "Hausmeister und Facility Management", h1: "Öffentliche Ausschreibungen für Hausmeisterdienste und Facility Management", cpv: ["7033", "7031", "98341"], arten: ["Hausmeisterdienste", "Objektbetreuung", "Empfang und Pforte", "Gebäudemanagement"],
    intro: "Wohnungsgesellschaften, Kommunen und Bundesbehörden vergeben Hausmeisterdienste und Objektbetreuung, oft zusammen mit Reinigung und Winterdienst. Crewtender findet diese Ausschreibungen.",
    vorteile: ["Hausmeister, Objektbetreuung und Gebäudemanagement erkannt", "Objekte, Stunden und Laufzeit im Steckbrief", "Kalkulation mit Löhnen und Zuschlägen"],
    fragen: [["Passt Crewtender für Hausmeisterdienste?", "Ja. Du planst die Objekte und Einsatzkräfte, erfasst die Stunden per Handy und schreibst Leistungsnachweis und Rechnung."]] },
  { slug: "waescherei-textilreinigung", name: "Wäscherei und Textilreinigung", h1: "Öffentliche Ausschreibungen für Wäscherei und Textilreinigung", cpv: ["9831"], arten: ["Wäscherei", "Mietwäsche", "Berufskleidung", "Chemische Reinigung"],
    intro: "Kliniken, Pflegeheime, Feuerwehren und Polizei vergeben Wäsche- und Textilreinigung meist als mehrjährigen Vertrag. Crewtender findet die Ausschreibungen und zeigt Mengen und Laufzeit.",
    vorteile: ["Wäsche, Mietwäsche und Berufskleidung erkannt", "Mengen, Abholung und Laufzeit im Steckbrief", "Neuausschreibungs-Radar für auslaufende Verträge"],
    fragen: [["Wie schnell sehe ich neue Ausschreibungen?", "Jeden Morgen. Auf Wunsch per Mail oder Handy-Nachricht zu deiner Uhrzeit."]] },
];
/** Order by how often the trade is tendered (catalogue, last 90 days, 09.11.2026, Datenbank cpv_haeufigkeit). */
const REIHENFOLGE = ["architektur-ingenieurleistungen", "strassenbau-kanalbau", "rohbau-beton-geruestbau", "abbruch-erdarbeiten", "elektro", "it-dienstleistungen",
  "sanitaer-heizung-lueftung", "tischler-schreiner", "maler-trockenbau", "dach-zimmerer", "gebaeudereinigung", "bodenbelaege-fliesen", "abfall-entsorgung",
  "garten-landschaftsbau-winterdienst", "bildung-kurse", "brandschutz-sicherheitstechnik", "sicherheitsdienst", "pflege-soziale-dienste", "wartung-haustechnik",
  "schuelerbefoerderung-personenverkehr", "veranstaltungen-messen", "umzuege-logistik", "catering-kantine", "hausmeister-facility-management",
  "waescherei-textilreinigung", "zeitarbeit-personaldienstleister"];
export const GEWERKE: Gewerk[] = REIHENFOLGE.map((slug) => ALLE.find((g) => g.slug === slug)!);

const zahl = (n: number) => n.toLocaleString("de-DE");
/** Trade × federal state pages (seo-seiten.ts). */
export const LAENDER_PFADE_DE = () => GEWERKE.flatMap((g) => BUNDESLAENDER.map((l) => `/ausschreibungen/${g.slug}/${l.slug}`));
const laenderChips = (slug: string) => `<h2>Nach Bundesland</h2><nav class="ordner-chips gewerk-liste" aria-label="Bundesländer">${BUNDESLAENDER.map((l) => `<a href="/ausschreibungen/${slug}/${l.slug}">${escape(l.name)}</a>`).join("")}</nav>`;
const datum = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "–";

export function gewerkSeite(g: Gewerk, s: Statistik | null): string {
  const fragen = [...g.fragen, ...ALLGEMEIN];
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fragen.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  return `<h1>${escape(g.h1)}</h1>
<p>${escape(g.intro)}</p>
${s ? `<div class="gewerk-zahlen"><div><strong>${zahl(s.monat)}</strong><span>Ausschreibungen in den letzten 30 Tagen</span></div>${s.monat >= 8 ? `<div><strong>${zahl(Math.round(s.monat * 7 / 30))}</strong><span>neue pro Woche im Schnitt</span></div>` : ""}${s.offen ? `<div><strong>${zahl(s.offen)}</strong><span>davon noch offen</span></div>` : ""}</div>` : ""}
${g.arten?.length ? `<ul class="start-chips gewerk-arten" aria-label="Typische Leistungen">${g.arten.map((a) => `<li>${escape(a)}</li>`).join("")}</ul>` : ""}
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos passende Aufträge finden</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>
${s?.beispiele.length ? `<h2>Aktuelle Ausschreibungen (Auswahl)</h2><ul class="kontakt-liste gewerk-beispiele">${s.beispiele.map((b) => `<li><div>${b.id ? `<a href="/ausschreibung/${encodeURIComponent(b.id)}"><strong>${escape(b.titel)}</strong></a>` : `<strong>${escape(b.titel)}</strong>`}<span class="klein">${escape([b.auftraggeber, b.ort].filter(Boolean).join(" · "))} ${b.frist ? ` · Frist ${datum(b.frist)}` : ""}</span></div></li>`).join("")}</ul><p class="klein">Quelle: amtliche Bekanntmachungen. In Crewtender bekommst du nur die Ausschreibungen, die zu deiner Firma und deinem Gebiet passen, mit Bewertung und Steckbrief.</p>` : ""}
<h2>So hilft Crewtender ${escape(g.name === "Elektro" ? "Elektrobetrieben" : `im Bereich ${g.name}`)}</h2>
<ul>${g.vorteile.map((v) => `<li>${escape(v)}</li>`).join("")}<li>Jeden Morgen die neuen Treffer mit Punkten von 1 bis 10 und einem Satz, warum sie passen</li></ul>
<h2>Und wenn der Auftrag da ist</h2>
<p>Ausschreibungsdienste hören beim Zuschlag auf. In Crewtender geht es in derselben App weiter:</p>
<ul>${(g.danach ?? DANACH).map((v) => `<li>${escape(v)}</li>`).join("")}</ul>
<p><a href="/stundensatz-rechner">🧮 Stundensatz kostenlos berechnen</a> · <a href="/vergleich">Vergleich: Ausschreibungsdienst plus Dienstplan-Software oder Crewtender?</a></p>
${laenderChips(g.slug)}
<h2>Häufige Fragen</h2>
${fragen.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>Weitere Gewerke</h2>
<nav class="ordner-chips gewerk-liste" aria-label="Weitere Gewerke">${GEWERKE.filter((x) => x.slug !== g.slug).map((x) => `<a href="/ausschreibungen/${x.slug}">${escape(x.name)}</a>`).join("")}</nav>
<script type="application/ld+json">${jsonld}</script>`;
}

export function uebersichtGewerke(): string {
  return `<h1>Öffentliche Ausschreibungen nach Gewerk</h1><p>Crewtender liest jeden Tag alle neuen öffentlichen Ausschreibungen in Deutschland und zeigt Handwerksbetrieben, Dienstleistern und Personaldienstleistern die passenden. Wähle dein Gewerk:</p>
<div class="konto-kacheln team-werkzeuge">${GEWERKE.map((g) => `<a class="konto-kachel" href="/ausschreibungen/${g.slug}"><strong>${escape(g.name)}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
<div class="knopf-zeile"><a class="knopf" href="/registrieren">Kostenlos registrieren</a><a class="knopf zweit" href="/demo">🎬 Demo ansehen</a></div>`;
}

const meta = (html: string, beschreibung: string, url: string, paar = "") => html.replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">${paar ? `\n${paar}` : ""}`);

export function sitemap(adresse: string): string {
  const pfade = ["/", ...Object.keys(ISO2).map((l) => `/${l.toLowerCase()}`), "/ausschreibungen", ...GEWERKE.map((g) => `/ausschreibungen/${g.slug}`), ...LAENDER_PFADE_DE(), ...FR_PFADE, ...LAND_PFADE, "/demo", "/preise", "/stundensatz-rechner", "/vergleich", "/us/sam-registration", "/datenschutz", "/impressum", "/kontakt", "/partner", "/partner/bedingungen", "/hilfe", ...ANLEITUNGEN.map((x) => `/hilfe/${x.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pfade.map((p) => `<url><loc>${adresse}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
}
export const ROBOTS = (adresse: string) => `User-agent: *\nAllow: /\nDisallow: /konto\nDisallow: /nachweis/\nDisallow: /portal/\nDisallow: /einladung\nDisallow: /auftrag/\nSitemap: ${adresse}/sitemap-seiten.xml\nSitemap: ${adresse}/sitemap-ausschreibungen.xml\nSitemap: ${adresse}/sitemap-auftraggeber.xml\n`;

type GewerkEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; WARTEN?: (p: Promise<unknown>) => void };

export async function gewerke(request: Request, env: GewerkEnv, adresse: string, antwort: (html: string) => Response): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/robots.txt") return new Response(ROBOTS(adresse), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
  // /sitemap-seiten.xml: same list under a new name – the Search Console kept "could not be read" for /sitemap.xml (08.11.2026).
  if (url.pathname === "/sitemap.xml" || url.pathname === "/sitemap-seiten.xml") return new Response(sitemap(adresse), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
  if (url.pathname === "/ausschreibungen" || url.pathname === "/ausschreibungen/") {
    const r = antwort(meta(seite("Ausschreibungen nach Gewerk", uebersichtGewerke()), "Öffentliche Ausschreibungen für Handwerk, Reinigung, Sicherheitsdienst und Zeitarbeit: Crewtender findet täglich die passenden Aufträge für deine Firma.", `${adresse}/ausschreibungen`, alternativen(adresse, null)));
    r.headers.set("cache-control", "public, max-age=3600");
    r.headers.delete("x-robots-tag");
    return r;
  }
  const m = url.pathname.match(/^\/ausschreibungen\/([a-z-]+)\/?$/);
  const g = m ? GEWERKE.find((x) => x.slug === m[1]) : undefined;
  if (!m) return null;
  if (!g) return new Response(null, { status: 301, headers: { location: "/ausschreibungen" } });
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const schluessel = new Request(`${adresse}/ausschreibungen/${g.slug}?cache=5`);
  const alt = await cache?.match(schluessel).catch(() => undefined);
  if (alt) return alt;
  let s: Statistik | null = null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/gewerk_statistik`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ praefixe: g.cpv }) });
    if (r.ok) s = (await r.json()) as Statistik | null;
  } catch { s = null; }
  const r = antwort(meta(seite(g.h1, gewerkSeite(g, s)), `${g.h1}: ${s ? `${zahl(s.monat)} Ausschreibungen in den letzten 30 Tagen. ` : ""}Crewtender findet täglich die passenden Aufträge für deinen Betrieb – kostenlos registrieren.`, `${adresse}/ausschreibungen/${g.slug}`, alternativen(adresse, g.slug)));
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.delete("x-robots-tag");
  if (cache && s) env.WARTEN?.(cache.put(schluessel, r.clone()).catch(() => undefined));
  return r;
}
