# Zusatzbedingungen Auftragsbörse – ENTWURF zur anwaltlichen Prüfung

> Stand 03.11.2026, geschrieben von Claude als Vorlage. **Keine Rechtsberatung.** Erst nach Prüfung durch eine
> Anwältin/einen Anwalt (IT-/Plattformrecht, idealerweise mit Arbeits-/Sozialversicherungsrecht) verwenden.
> Die Funktion ist gebaut, aber abgeschaltet (`BOERSE_AKTIV = false` in `web/src/boerse.ts`).

## Teil A – Fragen an die Anwältin / den Anwalt

1. **Digital Services Act (VO (EU) 2022/2065):** Jarvis wäre mit der Börse ein Hostingdienst, wohl auch eine
   „Online-Plattform“ (öffentliche Verbreitung an andere Firmen der Plattform). WP Digital Ranger ist ein
   Kleinstunternehmen. Stimmt unsere Annahme, dass dann vor allem Art. 11, 12 (Kontaktstellen), 14 (AGB),
   16 (Melde- und Abhilfeverfahren), 17 (Begründung bei Sperren) und 18 (Meldung von Straftaten) gelten und die
   Art. 20–28 sowie 30–32 wegen Art. 19 und 29 nicht? Reicht der Meldeweg „⚑ Melden“ plus E-Mail?
2. **P2B-Verordnung (VO (EU) 2019/1150):** Ist sie anwendbar, obwohl die Börse nur zwischen Unternehmen
   vermittelt (keine Verbraucher)? Unsere Annahme: nein.
3. **Haftung des Auftraggebers für Nachunternehmer** (§ 13 MiLoG, § 14 AEntG, § 28e Abs. 3a SGB IV, § 150 Abs. 3
   SGB VII): Reicht unser Hinweis, oder müssen wir Nachweise (z. B. Unbedenklichkeitsbescheinigungen) technisch
   abfragen? Trifft uns als Plattform selbst eine Haftung?
4. **Arbeitnehmerüberlassung:** Wie formulieren wir das Verbot verdeckter Arbeitnehmerüberlassung (AÜG) und von
   Scheinselbstständigkeit, ohne Personaldienstleistern mit Erlaubnis die Nutzung zu verbieten?
5. **Öffentliche Aufträge:** Weitergabe nur mit Zustimmung der Vergabestelle (Nachunternehmerregeln, § 4 Abs. 8
   VOB/B, § 4 Abs. 4 VOL/B bzw. Vertrag). Reicht ein Hinweis?
6. **Kartellrecht (§ 1 GWB):** Reicht das Verbot, Preise oder Angebote zu laufenden Ausschreibungen abzusprechen?
7. **Datenschutz:** Weitergabe der Kontaktdaten nach Annahme eines Interesses – Rechtsgrundlage Art. 6 Abs. 1
   lit. b/f DSGVO; Ergänzung der Datenschutzerklärung (Abschnitt „Auftragsbörse“) nötig. Sind wir hier
   Verantwortlicher (nicht Auftragsverarbeiter)?
8. **Spätere Provision** („Erfolg“-Plan in `docs/abos.md`): Was ändert sich, wenn wir für vermittelte Aufträge
   Geld nehmen (Maklerrecht, Transparenz der Vergütung)?
9. Passt die Einbeziehung als Zusatzbedingungen per Häkchen beim ersten Öffnen der Börse?

## Teil B – Text (Entwurf)

### Zusatzbedingungen für die Auftragsbörse

Stand: [Datum]

**1. Geltung.** Diese Zusatzbedingungen ergänzen die Nutzungsbedingungen von Jarvis für die Funktion
„Auftragsbörse“. Bei Widersprüchen gehen sie für die Börse vor. Wer die Börse nutzt, bestätigt sie beim ersten Öffnen.

**2. Was die Börse ist.** In der Börse können Firmen, die Jarvis nutzen, Aufträge oder Teile von Aufträgen
einstellen („Auftraggeber“), und andere Firmen können Interesse bekunden („Interessent“). Wir stellen nur die
technische Möglichkeit bereit. Wir werden nicht Vertragspartner, vermitteln nicht aktiv, prüfen Angaben, Firmen und
Leistungen nicht vorab und übernehmen keine Gewähr dafür, dass ein Vertrag zustande kommt oder erfüllt wird.
Verträge schließen Auftraggeber und Interessent direkt miteinander.

**3. Wer teilnehmen darf.** Nur Unternehmer im Sinne von § 14 BGB mit Sitz in der EU, und nur Nutzer mit der Rolle
Inhaber, Admin oder Bearbeiter. Lesende Nutzer sehen die Börse, handeln aber nicht.

**4. Sichtbarkeit und Kontakt.** Ein eingestellter Auftrag ist für Büro-Nutzer anderer Firmen mit Firmenname,
Titel, Gewerk, Ort, Zeitraum und Beschreibung 30 Tage sichtbar (höchstens 90 Tage). Kontaktdaten (Anschrift,
Telefon, E-Mail) sehen Auftraggeber und Interessent erst, wenn der Auftraggeber ein Interesse annimmt. Der
Auftraggeber kann einen Auftrag jederzeit schließen oder als vergeben markieren.

**5. Erlaubte Inhalte.** Eingestellt werden dürfen nur echte, rechtmäßige Aufträge oder Teil-Aufträge aus dem
eigenen Geschäft. Nicht erlaubt sind insbesondere:
a) Arbeitnehmerüberlassung ohne die dafür nötige Erlaubnis, Scheinwerkverträge oder Scheinselbstständigkeit;
b) Angebote, die erkennbar gegen Mindestlohn, Branchenmindestlöhne, Arbeitszeit- oder Arbeitsschutzrecht verstoßen
   oder zur Schwarzarbeit auffordern;
c) Absprachen über Preise, Angebote oder das Fernbleiben bei Ausschreibungen, an denen die Beteiligten getrennt
   teilnehmen (§ 1 GWB);
d) die Weitergabe öffentlicher Aufträge ohne die nötige Zustimmung der Vergabestelle;
e) personenbezogene Daten von Beschäftigten oder Dritten in der Beschreibung (außer dem eigenen Firmennamen);
f) Werbung ohne konkreten Auftrag, irreführende Angaben, Inhalte, die Rechte Dritter verletzen.

**6. Pflichten bei der Weitergabe.** Wer einen Auftrag weitergibt, ist selbst dafür verantwortlich, die Eignung
und Zuverlässigkeit des Nachunternehmers zu prüfen und die gesetzlichen Pflichten einzuhalten. Hinweis: Der
Auftraggeber kann für Mindestlohn und Branchenmindestlöhne der Beschäftigten seiner Nachunternehmer haften (§ 13
MiLoG, § 14 AEntG), im Baugewerbe auch für Sozialversicherungsbeiträge (§ 28e Abs. 3a SGB IV) und
Unfallversicherungsbeiträge (§ 150 Abs. 3 SGB VII). Wir empfehlen, Nachweise (z. B. Unbedenklichkeitsbescheinigungen
von Krankenkassen und Berufsgenossenschaft, Gewerbeanmeldung, ggf. AÜG-Erlaubnis) vor Vertragsschluss einzuholen.

**7. Melden von Inhalten.** Jeder Nutzer kann einen Auftrag über „⚑ Melden“ melden; daneben nehmen wir Meldungen
– auch von Personen ohne Jarvis-Zugang – an [E-Mail Kontaktstelle] entgegen. Eine Meldung soll erklären, warum der
Inhalt rechtswidrig ist oder gegen diese Bedingungen verstößt, und den Auftrag genau bezeichnen. Wir bestätigen den
Eingang, prüfen zeitnah und sorgfältig und teilen dem Meldenden unsere Entscheidung mit.

**8. Maßnahmen.** Verstößt ein Inhalt gegen Gesetz oder diese Bedingungen, können wir ihn ausblenden oder löschen
und bei schweren oder wiederholten Verstößen die Nutzung der Börse für die Firma sperren. Wir teilen der
betroffenen Firma die Maßnahme mit Begründung mit (betroffener Inhalt, Art der Maßnahme, Tatsachen und Gründe,
Rechtsgrundlage oder verletzte Regel, Möglichkeiten, sich zu wehren). Die Firma kann uns innerhalb von 6 Monaten
widersprechen; wir prüfen dann erneut. Liegen Anhaltspunkte für eine Straftat vor, die Leben oder Sicherheit von
Personen bedroht, informieren wir die Behörden.

**9. Kontaktstellen.** Für Behörden, die EU-Kommission und Nutzer: [E-Mail Kontaktstelle], Sprachen Deutsch und
Englisch.

**10. Kosten.** Die Börse ist derzeit kostenlos. Führen wir Entgelte oder Provisionen ein, teilen wir das vorher
mit; sie gelten nur für danach eingestellte Aufträge.

**11. Haftung.** Es gilt Nummer 7 der Nutzungsbedingungen. Für Inhalte der Firmen, für das Zustandekommen oder die
Erfüllung von Verträgen zwischen Firmen und für Angaben über Firmen haften wir nicht, soweit wir nicht nach dem
Gesetz zwingend haften. Jede Firma stellt uns von Ansprüchen Dritter frei, die auf ihren rechtswidrigen Inhalten
oder Verstößen gegen Nummer 5 beruhen, soweit sie dies zu vertreten hat.

**12. Datenschutz.** Für die Anzeige der Aufträge und die Weitergabe der Kontaktdaten nach Annahme sind wir
Verantwortlicher (Art. 6 Abs. 1 lit. b und f DSGVO). Einzelheiten in der Datenschutzerklärung, Abschnitt
„Auftragsbörse“. Die Firmen verarbeiten die erhaltenen Kontaktdaten jeweils in eigener Verantwortung.

**13. Ende.** Die Börse kann jede Firma jederzeit nicht mehr nutzen; eigene Aufträge schließt sie selbst. Wir
können die Börse mit einer Frist von 4 Wochen einstellen. Nach dem Ende der Jarvis-Nutzung löschen wir die Aufträge
und Interessen der Firma nach Nummer 9 der Nutzungsbedingungen.

## Teil C – Was technisch schon passt / noch fehlt

| Punkt | Stand |
|---|---|
| Kontakt erst nach Annahme | ✅ (RPC `boerse_kontakt`, Rechte-Test) |
| Höchstdauer 90 Tage, Standard 30 | ✅ (Datenbank-Regel) |
| Meldeweg in der App | ✅ (`boerse_meldungen`, nur Betreiber liest) |
| Meldung ohne Jarvis-Zugang (E-Mail) | ⏳ Kontaktstelle festlegen (z. B. kontakt@wpdigitalranger.com) |
| Eingangsbestätigung und Entscheidung an Meldende | ⏳ Betreiber-Ansicht für Meldungen + Mailtext |
| Begründung bei Sperre, Widerspruch | ⏳ Betreiber-Knopf „Ausblenden mit Begründung“ |
| Bestätigung der Zusatzbedingungen beim ersten Öffnen | ⏳ Häkchen + Speicherung (Datum, Version) |
| Datenschutzerklärung Abschnitt „Auftragsbörse“ | ⏳ nach Prüfung ergänzen |

Die ⏳-Punkte baue ich, sobald der Text geprüft ist (ca. 1 Arbeitssitzung).
