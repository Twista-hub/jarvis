// Settings and account (I1–I5): finer notifications and quiet hours, own name and function, downloading one's own
// data (Art. 15/20 GDPR) and deleting the account, and a help page with frequent questions.
import { dateienLoeschen, eigeneFirmen } from "./loeschen.ts";
import { COOKIE, db, html, sitzung, weiterleiten, type KontoEnv, type Sitzung } from "./konto.ts";
import { escape, seite } from "./seite.ts";

export type Benachrichtigung = { stunde: number | null; kanal: string; sofort_ab?: number | null; fristen?: boolean; ruhe_von?: number | null; ruhe_bis?: number | null };
const stundeText = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** I1/I2: extra fields of the notification form (immediate top hits, deadline reminders, quiet hours). */
export function benachrichtigungFelder(b: Benachrichtigung | undefined): string {
  const ruhe = (name: string, wert: number | null | undefined, leer: string) => `<select name="${name}"><option value="">${leer}</option>${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${wert === h ? " selected" : ""}>${stundeText(h)}</option>`).join("")}</select>`;
  return `<details class="benachrichtigung-mehr"${b?.sofort_ab || b?.ruhe_von != null || b?.fristen === false ? " open" : ""}><summary>Feiner einstellen</summary>
  <label>Sofort aufs Handy bei Top-Treffern<select name="sofort_ab"><option value="">aus</option>${[9, 8, 7].map((n) => `<option value="${n}"${b?.sofort_ab === n ? " selected" : ""}>ab ${n}/10</option>`).join("")}</select><span class="klein">Kommt, sobald Jarvis den Treffer findet, nicht erst zur gewählten Uhrzeit. Nur mit „Handy“ oder „Mail und Handy“.</span></label>
  <label class="zeile"><input type="checkbox" name="fristen" value="1"${b?.fristen !== false ? " checked" : ""}> Fristen-Erinnerungen (7 und 2 Tage vorher, am Fristtag morgens aufs Handy)</label>
  <div class="ruhe-felder"><label>Ruhezeit von${ruhe("ruhe_von", b?.ruhe_von, "keine")}</label><label>bis${ruhe("ruhe_bis", b?.ruhe_bis, "–")}</label></div>
  <span class="klein">In der Ruhezeit kommen keine Handy-Nachrichten. Die Frist-Nachricht am Morgen kommt dann zum Ende der Ruhezeit.</span>
</details>`;
}

/** Form values → columns; only sent when the form contains the fields. */
export function benachrichtigungAusFormular(f: FormData): Partial<Benachrichtigung> {
  if (!f.has("ruhe_von") && !f.has("sofort_ab")) return {};
  const zahl = (k: string, min: number, max: number) => { const v = String(f.get(k) ?? ""); const n = Number(v); return v !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const von = zahl("ruhe_von", 0, 23), bis = zahl("ruhe_bis", 0, 23);
  return { sofort_ab: zahl("sofort_ab", 5, 10), fristen: f.get("fristen") === "1", ruhe_von: von !== null && bis !== null && von !== bis ? von : null, ruhe_bis: von !== null && bis !== null && von !== bis ? bis : null };
}

/** Time of the last real login (not the hourly token refresh), from the token's "amr" claim. */
export function letzteAnmeldung(token: string): number | null {
  try {
    const teil = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const d = JSON.parse(atob(teil + "=".repeat((4 - (teil.length % 4)) % 4))) as { amr?: { timestamp?: number }[] };
    const zeiten = (d.amr ?? []).map((a) => Number(a.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
    return zeiten.length ? Math.max(...zeiten) * 1000 : null;
  } catch { return null; }
}

/** I3/I4 on "Mein Profil": name and function, data download, delete account. */
export function profilTeil(m: { firma_id: string; anzeigename?: string; funktion?: string; rolle: string }, token: string, jetzt = Date.now(), fehler = ""): string {
  const angemeldet = letzteAnmeldung(token);
  const frisch = angemeldet !== null && jetzt - angemeldet < 30 * 60_000;
  return `<h2>👤 Name und Funktion</h2>
<form method="post" action="/konto/profil/name" class="profil-name"><input type="hidden" name="firma" value="${m.firma_id}">
<label>Dein Name<input name="name" required minlength="2" maxlength="80" autocomplete="name" value="${escape(m.anzeigename ?? "")}"></label>
<label>Funktion<input name="funktion" maxlength="80" value="${escape(m.funktion ?? "")}" placeholder="z. B. Disposition"></label>
<button class="zweit">Speichern</button></form>
<p class="klein">So sieht dich dein Team. Deine Rolle und Rechte ändert nur die Firmenleitung.</p>
<h2 id="daten">🔒 Deine Daten</h2>
<p><a class="knopf zweit" href="/konto/daten.json" download>⬇ Meine Daten herunterladen</a></p>
<p class="klein">Eine Datei mit deinem Konto, deinen Firmenzugängen, Einstellungen, Notizen und eigenen Terminen (Art. 15 und 20 DSGVO). Daten der Firma (Ausschreibungen, Personal) gehören der Firma; die Firmenleitung kann sie anfordern.</p>
<details class="konto-loeschen" id="loeschen"${fehler ? " open" : ""}><summary>Konto löschen</summary>
${fehler ? `<p class="fehler">${escape(fehler)}</p>` : ""}
<p>Dein Zugang wird sofort und endgültig gelöscht. Firmen, in denen du die einzige Person bist, werden mit allen Daten gelöscht. In Firmen mit weiteren Mitgliedern bleiben deren Daten erhalten.</p>
${frisch ? `<form method="post" action="/konto/loeschen"><label>Zur Bestätigung LÖSCHEN eintippen<input name="bestaetigung" required autocomplete="off" pattern="LÖSCHEN|löschen|Löschen"></label><button class="gefahr-voll">Konto endgültig löschen</button></form>`
    : `<p class="klein">Zur Sicherheit musst du dich dafür in den letzten 30 Minuten angemeldet haben.</p><form method="post" action="/abmelden"><input type="hidden" name="weiter" value="/konto/profil#loeschen"><button class="zweit">Neu anmelden</button></form>`}
</details>`;
}

const HILFE: [string, [string, string][]][] = [
  ["🔎 Suche und Treffer", [
    ["Wie findet Jarvis Ausschreibungen?", "Jarvis prüft jeden Tag die öffentlichen Bekanntmachungen (Bekanntmachungsservice des Bundes, auf Wunsch auch europäische Länder) und vergleicht sie mit eurem Suchprofil: Arbeiten, Suchwörter, Einsatzorte und Filter. Die passenden bewertet eine KI mit 1 bis 10 Punkten."],
    ["Warum sehe ich einen Treffer nicht?", "Er liegt vielleicht außerhalb eures Suchgebiets, unter der Mindestpunktzahl, enthält ein Ausschlusswort oder ist abgelaufen. Im Suchprofil zeigt „🔍 Vorschau“, wie viele Ausschreibungen eure Einstellungen in der letzten Woche gefunden hätten."],
    ["Was bedeuten 👍 und 👎?", "Damit sagst du Jarvis, ob ein Treffer passt. Nach 👎 kannst du ein Wort aus dem Titel übernehmen, dann blendet Jarvis solche Ausschreibungen künftig aus."],
    ["Was ist ein Steckbrief?", "Eine Zusammenfassung der Ausschreibung: Leistung, Lose, Fristen, Nachweise, Eignung. Für die besten Treffer schreibt Jarvis täglich bis zu 4 Steckbriefe. Mit hochgeladenen Vergabeunterlagen wird er ausführlicher."],
  ]],
  ["⏰ Fristen und Nachrichten", [
    ["Wann bekomme ich Nachrichten?", "Zu deiner gewählten Uhrzeit per Mail, aufs Handy oder beides, aber nur, wenn es Neues gibt. Fristen-Erinnerungen kommen 7 und 2 Tage vorher und am Fristtag morgens aufs Handy. Unter Einstellungen → „Feiner einstellen“ legst du Sofort-Nachrichten für Top-Treffer und eine Ruhezeit fest."],
    ["Wie kommen Nachrichten aufs Handy?", "Öffne Jarvis auf dem Handy, tippe unter Einstellungen auf „📱 Nachrichten auf diesem Handy einschalten“ und erlaube die Mitteilungen. Auf dem iPhone muss Jarvis dafür zuerst zum Home-Bildschirm hinzugefügt werden (Teilen → „Zum Home-Bildschirm“)."],
    ["Kann ich die Fristen in meinem Kalender sehen?", "Ja: Unter Fristen → „📲 Alle Fristen im Handy-Kalender“ eine private Kalender-Adresse erzeugen und abonnieren. Neue Fristen kommen dann von selbst dazu."],
  ]],
  ["📥 Unterlagen und Angebote", [
    ["Wohin mit Nachweisen wie Versicherung oder Handelsregister?", "Unter Unterlagen → Firmenunterlagen. Jarvis liest das Ablaufdatum aus PDF oder Foto, erinnert vor dem Ablauf und legt passende Nachweise jedem Angebot bei."],
    ["Wie entsteht ein Angebot?", "In der Ausschreibung „Angebot vorbereiten“ wählen: Jarvis schreibt den Text mit den Preisen aus der Kalkulation und hakt die passenden Nachweise an. Die Firmenleitung gibt es frei; abgegeben wird im Vergabeportal von euch selbst. Jarvis reicht nichts selbst ein."],
    ["Wie lange bleiben hochgeladene Vergabeunterlagen gespeichert?", "30 Tage. Firmenunterlagen und Vorlagen bleiben, bis die Firmenleitung sie löscht."],
    ["Was sind Textbausteine?", "Texte, die in vielen Angeboten vorkommen, zum Beispiel Firmenvorstellung, Vertretungsregelung oder Schlussformel. Unter Mehr → Textbausteine anlegen; beim Angebot anhaken, Jarvis hängt sie an und setzt Firma, Auftrag, Auftraggeber und Datum ein."],
    ["Was mache ich mit einer GAEB-Datei (.X83)?", "In der Ausschreibung „📐 Leistungsverzeichnis (GAEB)“ öffnen und die X83-Datei aus den Vergabeunterlagen einlesen. Dann die Einheitspreise eintragen (für Stundenpositionen und Aufschläge gibt es „Preise auf einmal setzen“) und die Angebotsdatei X84 herunterladen. Sie liegt auch in der Angebotsmappe und wird im Vergabeportal hochgeladen."],
    ["Wo sehe ich den Stand aller Angebote?", "Unter Mehr → Angebote: in Arbeit, wartet auf Chef, abgegeben, Zuschlag oder Absage, dazu die Gewinnquote. Nach der Entscheidung des Auftraggebers trägst du dort Zuschlag oder Absage ein."],
  ]],
  ["🏗️ Aufträge, Markt und Auswertung", [
    ["Was passiert nach dem Zuschlag?", "Der Auftrag erscheint unter Laufende Aufträge. Dort trägst du Laufzeit, Verlängerung, die Frist für die Entscheidung über die Verlängerung, benötigte Personen und den Ansprechpartner ein. Jarvis warnt rechtzeitig vor Fristen und vor dem Vertragsende."],
    ["Was zeigt der Neuausschreibungs-Radar?", "Vergebene Aufträge aus eurem Bereich, deren Vertrag bald endet. Auftraggeber schreiben meist einige Monate vorher neu aus. Mit „🔔 Erinnern“ landet ein Termin unter Fristen. Das Vertragsende ist eine Prognose aus den Bekanntmachungen."],
    ["Was steht auf den Auftraggeber-Seiten?", "Eure Ausschreibungen und Angebote bei diesem Auftraggeber, was dort gerade offen ist, frühere Zuschläge mit Gewinner und Wert, die Kontaktstelle aus der Bekanntmachung und eure eigenen Ansprechpartner."],
    ["Woher kommen die Förderprogramme?", "Aus der Förderdatenbank des Bundes. Jarvis prüft jeden Morgen die neuen Programme gegen euer Suchprofil und gibt eine Einschätzung von 1 bis 10. Ob ihr antragsberechtigt seid, entscheidet der Fördergeber."],
    ["Was zeigt die Auswertung?", "Treffer pro Monat, wie viele davon zum Angebot und zum Zuschlag wurden, die Gewinnquote pro Quartal, den Umsatz (mit Finanzfreigabe), häufige Gründe für 👎 und für Inhaber und Admins die KI-Kosten eurer Firma."],
    ["Wo trage ich Ortsbesichtigung und Bieterfragen ein?", "In der Ausschreibung unter „📅 Termine & Bieterfragen“: Termine mit Art und Ort (sie stehen auch unter Fristen und im Kalender-Abo) und Fragen an den Auftraggeber. Offene Fragen gibt es als fertigen Text zum Einfügen ins Vergabeportal."],
    ["Wie frage ich Nachunternehmer an?", "Partnerbetriebe einmal unter Mehr → Nachunternehmer & Partner anlegen. In der Ausschreibung unter „🤝 Nachunternehmer“ pro Los anfragen, mit „✉️ Mail“ öffnet sich dein Mailprogramm mit einem vorbereiteten Text. Stand und Preis des Partners hältst du dort fest."],
    ["Wo pflege ich Firmendaten für Ausschreibungen?", "Unter Firma & Team → Firmenprofil: Rechtsform, Register, Gründungsjahr, Beschäftigte, Umsatz der letzten drei Jahre, Logo, Präqualifikation und Zertifikate. Daraus entsteht die Eigenerklärung (Word); sie liegt auch in jeder Angebotsmappe."],
    ["Wie behalte ich Qualifikationen und Unterweisungen im Blick?", "Bei jeder Person unter ✏️ Bearbeiten → „Qualifikationen mit Nachweis“ mit Ablaufdatum und Datei eintragen. Unter Firma & Team → Unterweisungen sieht man, wer fällig ist, und trägt nach einer Schulung alle auf einmal ein. Oben auf Firma & Team warnt Jarvis vor Abläufen."],
    ["Wie finde ich schnell passendes Personal?", "Firma & Team → Personalsuche: Beruf, Qualifikation, Zeitraum, Einsatzort mit Umkreis, Führerschein und Sprache. Ganz freie Personen stehen oben, die Entfernung rechnet Jarvis von der Wohnort-PLZ."],
    ["Wie verwalte ich Bewerbungen?", "Firma & Team → Bewerber: Bewerbung mit Kontakt, Beruf und Lebenslauf erfassen, Status setzen (Gespräch, Zusage, Absage) und mit „➜ Personalakte anlegen“ übernehmen. Nach einer Absage löscht Jarvis die Daten automatisch nach 6 Monaten."],
    ["Wie behalte ich Schutzausrüstung im Blick?", "Firma & Team → Schutzausrüstung: Artikel, Größe, Ausgabe- und Austauschdatum eintragen. Jarvis warnt 30 Tage vor dem Austausch; das Ausgabeprotokoll zum Unterschreiben lädst du pro Person als Word."],
    ["Was gehört zum Einstieg und Austritt?", "Firma & Team → Einstieg & Austritt: Checkliste für eine Person starten. Jarvis legt die üblichen Punkte an (Vertrag, Lohnbüro, Unterweisung, PSA, App-Zugang bzw. Rückgabe, Zugang sperren, Zeugnis); eigene Punkte lassen sich ergänzen."],
    ["Wie sehe ich Resturlaub und wer wann fehlt?", "Firma & Team → Urlaub: pro Person Anspruch und Übertrag eintragen, Jarvis rechnet genommene und beantragte Urlaubstage (Mo–Fr ohne Feiertage) und den Rest. Der Teamkalender zeigt den Monat und warnt, wenn ein Viertel des Teams gleichzeitig fehlt."],
    ["Wofür sind Einsatz-Bewertungen?", "Rückmeldungen der Kunden nach einem Einsatz: Sterne, ob gern wieder, Notiz. Nur das Büro sieht sie. Wer bei einem Kunden „nicht wieder“ hat, taucht dort nicht mehr in den Ersatzvorschlägen auf."],
    ["Wie erstelle ich einen Leistungsnachweis für den Kunden?", "Firma & Team → Leistungsnachweis: Pro Kunde und Monat lädst du eine Word-Datei mit allen freigegebenen Stunden, Nacht-, Sonntags- und Feiertagsstunden und einem Unterschriftsfeld. Mit Finanzfreigabe steht auch der Betrag aus dem Verrechnungssatz darauf."],
    ["Wie werden Zuschläge berechnet?", "Aus den Stundenzetteln: Nacht 23–6 Uhr, Sonntag und gesetzliche Feiertage. Die Feiertage richten sich nach dem Bundesland im Firmenprofil (sonst nach der PLZ der Firma). Pausen werden anteilig abgezogen. Die Stunden stehen in der App, in der Excel-Datei und im Leistungsnachweis."],
    ["Wofür sind Kunden und Einsatzorte?", "Firma & Team → Kunden & Einsatzorte: Adresse, Ansprechpartner und Verrechnungssatz pro Kunde, dazu Einsatzorte mit Treffpunkt, Kleidung und Hinweisen. Beim Schichtplanen wählst du den Einsatzort; die Einsatzkraft sieht dann alle Infos mit Kartenlink. Stunden werden dem Kunden automatisch zugeordnet, wenn der Einsatz so heißt wie Kunde oder Einsatzort."],
    ["Was passiert, wenn jemand kurzfristig ausfällt?", "Die Einsatzkraft tippt unter „Meine Einsätze & Daten“ auf „Ich falle kurzfristig aus“ (heute oder morgen, ohne Grund). Ihre Schichten werden abgesagt, das Büro sieht den Ausfall sofort auf der Übersicht und im Schichtplan und bekommt eine Handy-Nachricht. Jarvis schlägt passende freie Leute vor; ein Tipp auf den Namen plant die Schicht neu."],
    ["Wie tragen Mitarbeitende ihre Stunden ein?", "Unter „Meine Einsätze & Daten“ → ⏱️ Meine Stunden: Datum, Beginn, Ende und Pause. Das Büro gibt die Stunden unter Firma & Team → Stundenzettel frei (mehrere auf einmal) und lädt den Monat als Excel für Lohn und Rechnung herunter. Jarvis weist auf zu kurze Pausen und mehr als 10 Stunden am Tag hin."],
    ["Wie plane ich Schichten?", "Firma & Team → Schichtplan: Datum, Zeit, Person und Ort, auf Wunsch an mehreren Wochentagen und für bis zu 8 Wochen. Die Person bekommt eine Handy-Nachricht und sagt in der App zu oder ab. Absagen meldet Jarvis dir; Schichten zählen in der Disposition als Einsatz."],
    ["Wie erreiche ich alle Mitarbeitenden auf einmal?", "Firma & Team → Schwarzes Brett: Mitteilung für alle oder einen Standort. Alle bekommen eine Handy-Nachricht; du siehst, wer schon gelesen hat und wer noch nicht."],
    ["Wie behalte ich Probezeit, Befristungen und Führerscheine im Blick?", "Fristen in der Personalakte eintragen (✏️ Bearbeiten → 📁 Personalakte → ⏳ Fristen) und „Fährt Firmenfahrzeuge“ ankreuzen. Firma & Team → Personalfristen zeigt, was bald abläuft, und wer zur halbjährlichen Führerscheinkontrolle muss; der Nachweis lässt sich als Word herunterladen."],
    ["Können Mitarbeitende Unterweisungen im Handy bestätigen?", "Ja. Fällige Unterweisungen stehen unter „Meine Einsätze & Daten“ mit ihrem Inhalt. Mit „Gelesen und verstanden“ wird die Teilnahme mit Datum gespeichert und unter Unterweisungen mit 📱 markiert."],
    ["Wer vertritt mich im Urlaub?", "Firma & Team → Vertretung: Zeitraum und Vertretung eintragen. Solange bekommst du keine Erinnerungen; die Vertretung bekommt die Fristen und sieht auf der Übersicht deine offenen Aufgaben und Ausschreibungen. Rechte ändern sich dadurch nicht."],
    ["Wie verteile ich Aufgaben im Team?", "Auf jeder Ausschreibung unter „Aufgaben“ oder unter Firma & Team → Aufgaben: Aufgabe, Person und Datum. Jede Person sieht ihre offenen Aufgaben auf der Übersicht und hakt sie dort ab."],
    ["Reicht unser Personal für einen Auftrag?", "Hat Jarvis Lose mit Tätigkeit aus den Unterlagen gelesen, zeigt die Ausschreibung „Reicht unser Personal?“: grob benötigte Personen pro Los und wie viele davon diese Woche frei sind. Firma & Team → Kapazität zeigt pro Beruf, wer in den nächsten 3 Monaten frei ist."],
    ["Wie behalte ich TÜV und Wartung von Fahrzeugen und Geräten im Blick?", "Firma & Team → Fahrzeuge & Geräte: Bezeichnung, Prüfung (z. B. HU/AU, UVV, DGUV V3) und nächster Termin. Jarvis warnt 30 Tage vorher oben auf Firma & Team; die Ausstattung steht auch in der Eigenerklärung."],
    ["Können Mitarbeitende Urlaub selbst beantragen?", "Ja. Lade die Person mit dem Zugriff „Einsatzkraft“ ein und verknüpfe den Zugang unter App-Zugänge mit ihrer Personalakte. Dann sieht sie „Meine Einsätze & Daten“: eigene Einsätze, Urlaubsanträge und Nachweise zum Hochladen. Anträge bestätigst du bei der Person unter ✏️ Bearbeiten."],
    ["Wer ist wann wo eingesetzt?", "Die Disposition (Mehr oder Firma & Team) zeigt pro Woche alle Personen mit Einsätzen, Urlaub und Schulungen; Filter „Frei“ zeigt, wer verfügbar ist. Neue Einsätze lassen sich direkt eintragen."],
    ["Was macht der AÜG-Wächter?", "Für Zeitarbeitsfirmen: Pro Leiharbeitskraft und Kunde berechnet er, wann Equal Pay (nach 9 Monaten) gilt und wann die Höchstüberlassungsdauer (18 Monate) endet, mit der 3-Monats-Regel für Unterbrechungen. Ohne Gewähr; Tarifverträge können abweichen."],
  ]],
  ["💶 Abrechnung und Einsatzkräfte", [
    ["Wie schreibe ich eine Rechnung aus den Stunden?", "Leistungsnachweis → beim Kunden „🧾 Rechnung“ (nur mit Finanzfreigabe und Verrechnungssatz beim Kunden). Jarvis legt einen Entwurf mit fortlaufender Nummer an: freigegebene Stunden mal Satz, dazu Nacht-, Sonntags- und Feiertagszuschläge in Prozent, die du beim Kunden einträgst. Die Word-Datei prüfst du und verschickst sie selbst. Steuernummer und Kleinunternehmer-Hinweis kommen aus dem Firmenprofil."],
    ["Wie kommt die Lohnliste zum Steuerbüro?", "Stundenzettel → „💶 Lohnliste“ (Excel) oder „CSV“. Pro Person: Personalnummer, Stunden, davon Nacht, Sonntag, Feiertag, Urlaubs- und Schulungstage, Ausfälle, freigegebene Spesen und der Stand des Zeitkontos. Die Datei kann das Lohnbüro einlesen; Jarvis rechnet keinen Lohn aus."],
    ["Was zeigt das Arbeitszeitkonto?", "Soll aus den Wochenstunden in der Personalakte (Montag bis Freitag, ohne Feiertage und bestätigte Abwesenheiten) gegen die freigegebenen Stunden, Monat für Monat. Startdatum und Anfangssaldo (z. B. Überstunden aus dem alten System) legst du pro Person fest. Die Einsatzkraft sieht ihren Stand in „Meine Einsätze & Daten“."],
    ["Wie reichen Einsatzkräfte Spesen ein?", "In „Meine Einsätze & Daten“ → „Beleg einreichen“: Art, Betrag, Datum und ein Foto vom Beleg. Das Büro gibt unter Spesen frei oder lehnt ab; freigegebene Spesen stehen in der Lohnliste."],
    ["Wie funktioniert die Stempeluhr?", "Einsatzkräfte tippen in „Meine Einsätze & Daten“ auf Kommen, Pause, Weiter und Gehen. Es zählt die Uhrzeit des Servers, Nachtragen in die Vergangenheit geht dort nicht. Bei „Gehen“ legt Jarvis den Stundenzettel an, den das Büro wie gewohnt freigibt. Auf Wunsch prüft das Handy einmal, ob die Person in der Nähe des Einsatzorts ist; gespeichert wird nur ja oder nein."],
    ["Was sind Branchenzuschläge?", "Für Zeitarbeit: Beim Kunden die Branche wählen (z. B. Metall und Elektro) oder die fünf Stufen selbst eintragen. Der AÜG-Wächter zeigt pro Leiharbeitskraft die aktuelle Stufe und ab wann die nächste gilt (nach 6 Wochen, 3, 5, 7 und 9 Monaten; Unterbrechungen verschieben das). Bitte den Tarifvertrag gegenprüfen."],
    ["Wie bestätigt der Kunde die Stunden online?", "Leistungsnachweis → „🔗 Link“ beim Kunden. Jarvis friert die Stunden des Monats ein und erzeugt einen geheimen Link (30 Tage gültig). Du schickst ihn per WhatsApp oder Mail; der Kunde braucht kein Konto, prüft und bestätigt mit Namen und Unterschrift oder stellt eine Rückfrage. Du bekommst eine Handy-Nachricht, die Bestätigung steht im Word-Nachweis."],
    ["Wie unterschreiben Einsatzkräfte im Handy?", "Für den Empfang von Schutzausrüstung und die Stunden des Vormonats erscheint in „Meine Einsätze & Daten“ ein Feld zum Unterschreiben mit dem Finger. Die Unterschrift steht danach im Stundennachweis (Word) und ist im Büro sichtbar."],
    ["Wie lade ich viele Einsatzkräfte auf einmal ein?", "Firma & Team → „Einsatzkräfte einladen“ (nur Inhaber und Admins). Personen ankreuzen, Jarvis erstellt pro Person einen eigenen Link ohne E-Mail-Adresse. Tippe auf WhatsApp oder SMS, oder druck die Seite mit QR-Codes aus und verteil sie vor Ort. Der Link gilt 14 Tage, gibt nur die Rolle Einsatzkraft und verknüpft den Zugang gleich mit der Personalakte."],
    ["Können Einsatzkräfte offene Schichten selbst nehmen?", "Ja. Lass beim Anlegen einer Schicht die Person leer und wähle den Beruf. Alle passenden Einsatzkräfte im Bereich bekommen eine Handy-Nachricht und sehen die Schicht unter „Offene Schichten“. Wer zuerst tippt, bekommt sie; du wirst benachrichtigt. Wer an dem Tag abwesend ist oder schon eine Schicht hat, kann nicht übernehmen."],
    ["Gibt es die Mitarbeiter-Ansicht in anderen Sprachen?", "Ja. Oben in „Meine Einsätze & Daten“ wählt jede Person Deutsch, Englisch, Polnisch, Rumänisch, Türkisch, Ukrainisch oder Arabisch. Übersetzt sind Überschriften, Knöpfe und die wichtigsten Hinweise; was das Büro selbst schreibt (z. B. Infos zum Einsatzort), bleibt wie eingegeben."],
    ["Zeigt Jarvis Geburtstage und Jubiläen?", "Ja, wenn in der Personalakte Geburtstag bzw. Eintritt eingetragen ist. Oben in Firma & Team erscheinen Geburtstage und Firmenjubiläen (1, 5, 10, 15 … Jahre) der nächsten 7 Tage."],
  ]],
  ["👥 Team und Konto", [
    ["Wie lade ich Kolleginnen und Kollegen ein?", "Unter Firma & Team → App-Zugänge → „Person einladen“. Zugriff und Bereich musst du bewusst auswählen (die „?“ erklären jede Stufe), Finanzen sind aus. Vor dem Einladen zeigt Jarvis eine Prüfseite, was die Person sehen und tun kann; erst nach „Ja, so einladen“ wird der Link erstellt. Dasselbe gilt beim Ändern von Rechten. Viele Einsatzkräfte auf einmal: „Einsatzkräfte einladen“ (Links per WhatsApp, SMS oder QR-Code). Wer welche Standorte und Finanzen sieht, legt die Firmenleitung fest."],
    ["Wie lösche ich mein Konto?", "Unter Mein Profil → „Konto löschen“. Bist du die letzte Inhaberin oder der letzte Inhaber einer Firma mit weiteren Mitgliedern, übertrage die Inhaberrolle vorher an jemand anderen."],
    ["Wo liegen unsere Daten und wer sieht sie?", "Gespeichert in Rechenzentren in der EU. Jeder sieht nur die Daten seiner Firma und der Bereiche, für die er freigeschaltet ist; Finanzen nur mit Finanzfreigabe. Einzelheiten stehen in der Datenschutzerklärung."],
  ]],
];

/** N8: the way through Jarvis in steps, each with a link to the place in the app. */
export const EINFUEHRUNG = `<details class="hilfe-einfuehrung" open><summary><strong>🧭 So arbeitest du mit Jarvis</strong></summary><ol class="einfuehrung-schritte">${[
  ["/konto/suchprofil", "Suchprofil einrichten", "Was ihr macht und wo ihr arbeitet. Jarvis sucht danach jeden Tag."],
  ["/konto/treffer", "Treffer prüfen", "👍 oder 👎, die besten mit ⭐ merken. Fristen stehen im Kalender."],
  ["/konto/unterlagen", "Unterlagen hochladen", "Vergabeunterlagen für den ausführlichen Steckbrief, Nachweise einmalig unter Firmenunterlagen."],
  ["/konto/kalkulation", "Kalkulieren", "Stundensatz und Preis je Los; bei GAEB-Dateien die Einheitspreise im Leistungsverzeichnis."],
  ["/konto/angebote", "Angebot und Freigabe", "Jarvis schreibt das Angebot, der Chef gibt frei, du lädst die Mappe herunter und gibst im Portal ab."],
  ["/konto/auftraege", "Nach dem Zuschlag", "Laufzeit, Leute und Verlängerung im Blick behalten; die Auswertung zeigt, was sich lohnt."],
].map(([href, titel, text]) => `<li><a href="${href}"><strong>${titel}</strong></a><span class="klein">${text}</span></li>`).join("")}</ol></details>`;

/** I5: frequent questions with a search field (works without scripts as plain sections) and a contact button. */
export function hilfeSeite(email: string): string {
  const betreff = encodeURIComponent("Frage zu Jarvis");
  const text = encodeURIComponent(`Hallo,\n\nmeine Frage:\n\n\n---\nKonto: ${email}`);
  return `${EINFUEHRUNG}<label class="hilfe-suche"><span class="unsichtbar">Hilfe durchsuchen</span><input type="search" placeholder="🔍 Frage suchen, z. B. Handy oder Fristen" data-hilfe-suche></label>
${HILFE.map(([titel, fragen]) => `<section class="hilfe-gruppe"><h2>${titel}</h2>${fragen.map(([f, a]) => `<details class="hilfe-frage"><summary>${escape(f)}</summary><p>${escape(a)}</p></details>`).join("")}</section>`).join("")}
<p class="hilfe-leer" data-hilfe-leer hidden>Keine passende Frage gefunden. Schreib uns einfach.</p>
<section class="hilfe-kontakt"><h2>✉️ Noch Fragen?</h2><p>Schreib uns einfach, am besten mit kurzer Beschreibung, wo es hakt.</p><p><a class="knopf" href="mailto:kontakt@wpdigitalranger.com?subject=${betreff}&body=${text}">Nachricht schreiben</a></p><p class="klein">Öffnet dein Mailprogramm. kontakt@wpdigitalranger.com</p></section>`;
}

/** Own data as JSON (only what the person may see anyway, read with their rights). */
export async function datenExport(s: Sitzung, env: KontoEnv): Promise<Record<string, unknown>> {
  const lesen = async (pfad: string) => { const r = await db<unknown[]>(s, env, pfad); return r.ok ? r.daten : []; };
  const [zugaenge, nachrichten, notizen, termine, geraete, kalender] = await Promise.all([
    lesen(`mitglieder?user_id=eq.${s.userId}&select=firma_id,rolle,funktion,anzeigename,finanzen,alle_bereiche,aktiv,erstellt,firmen(name)`),
    lesen(`benachrichtigungen?user_id=eq.${s.userId}&select=firma_id,stunde,kanal,sofort_ab,fristen,ruhe_von,ruhe_bis,letzte_mail`),
    lesen(`vorgang_notizen?user_id=eq.${s.userId}&select=vorgang_id,text,erstellt`),
    lesen(`eigene_termine?user_id=eq.${s.userId}&select=titel,zeit,vorgang_id,erstellt`),
    lesen(`push_abos?user_id=eq.${s.userId}&select=erstellt`),
    lesen(`kalender_abos?user_id=eq.${s.userId}&select=firma_id`),
  ]);
  return {
    hinweis: "Deine bei Jarvis gespeicherten Daten (Art. 15 und 20 DSGVO). Daten der Firmen selbst kann die jeweilige Firmenleitung anfordern.",
    exportiert_am: new Date().toISOString(),
    konto: { id: s.userId, email: s.email },
    firmenzugaenge: zugaenge, benachrichtigungen: nachrichten, notizen, eigene_termine: termine,
    handys_fuer_nachrichten: geraete.length, kalender_abos: kalender.length,
  };
}

export async function kontoEinstellungen(request: Request, env: KontoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (!["/konto/profil/name", "/konto/daten.json", "/konto/loeschen", "/konto/hilfe"].includes(p)) return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten(`/anmelden?weiter=${encodeURIComponent(p === "/konto/daten.json" ? "/konto/profil#daten" : p)}`);
  if (p === "/konto/hilfe") return html(seite("Hilfe", `<p class="konto-zurueck"><a href="/konto/einstellungen" aria-label="Zurück zu den Einstellungen">←</a></p>${hilfeSeite(s.email)}`, 0, "einstellungen"), 200, s.cookies);
  if (p === "/konto/daten.json") {
    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="jarvis-meine-daten-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" });
    for (const c of s.cookies) headers.append("set-cookie", c);
    return new Response(JSON.stringify(await datenExport(s, env), null, 2), { headers });
  }
  if (request.method !== "POST") return weiterleiten("/konto/profil", s.cookies);
  const form = await request.formData();
  if (p === "/konto/profil/name") {
    const firma = String(form.get("firma") ?? "");
    const r = /^[0-9a-f-]{36}$/.test(firma) ? await db(s, env, "rpc/mein_profil", { method: "POST", body: JSON.stringify({ f: firma, name: String(form.get("name") ?? ""), funktion: String(form.get("funktion") ?? "") }) }) : null;
    return weiterleiten(`/konto/profil?hinweis=${encodeURIComponent(r?.ok ? "Name und Funktion gespeichert." : "Bitte einen Namen mit mindestens 2 Zeichen eintragen.")}`, s.cookies);
  }
  // Delete account: confirmation word and a recent login, then the database deletes the login (and firms where
  // the person was alone); their stored files are removed here.
  const zurueck = (fehler: string) => weiterleiten(`/konto/profil?loeschfehler=${encodeURIComponent(fehler)}#loeschen`, s.cookies);
  if (String(form.get("bestaetigung") ?? "").trim().toUpperCase() !== "LÖSCHEN") return zurueck("Bitte zur Bestätigung LÖSCHEN eintippen.");
  const angemeldet = letzteAnmeldung(s.token);
  if (angemeldet === null || Date.now() - angemeldet > 30 * 60_000) return zurueck("Bitte melde dich zur Sicherheit neu an und versuche es dann noch einmal.");
  // Firms that disappear with the account and their tenders, read before deleting (afterwards they are gone).
  const vorher = await eigeneFirmen(s, env);
  const r = await db<string[]>(s, env, "rpc/konto_loeschen", { method: "POST", body: "{}" });
  if (!r.ok) return zurueck(/LETZTER_INHABER/.test(r.fehler) ? "Du bist die letzte Inhaberin bzw. der letzte Inhaber einer Firma mit weiteren Mitgliedern. Übertrage die Inhaberrolle unter Firma & Team zuerst an jemand anderen." : "Das Konto konnte nicht gelöscht werden. Bitte schreib uns über die Hilfe.");
  const geloescht = Array.isArray(r.daten) ? r.daten.filter((f) => typeof f === "string") : [];
  await dateienLoeschen(env, geloescht, vorher.vorgaenge).catch((e) => console.warn(`Dateien nach Kontolöschung: ${e instanceof Error ? e.message : String(e)}`));
  return html(seite("Konto gelöscht", `<p><strong>Dein Konto ist gelöscht.</strong></p><p>Danke, dass du Jarvis genutzt hast. Du kannst dich jederzeit neu registrieren.</p><p><a href="/">Zur Startseite</a></p>`), 200, [`jv_at=; ${COOKIE}; Max-Age=0`, `jv_rt=; ${COOKIE}; Max-Age=0`, `jv_firma=; ${COOKIE}; Max-Age=0`]);
}
