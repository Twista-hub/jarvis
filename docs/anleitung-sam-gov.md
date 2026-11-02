# SAM.gov-Schlüssel (USA, Bundesausschreibungen) – Anleitung für Benjamin

Jarvis holt US-Ausschreibungen der Bundesbehörden über die offizielle SAM.gov-Schnittstelle (`alarm/usa.py`).
Dafür braucht es einen kostenlosen persönlichen „Public API Key“. Den beantragst und hinterlegst du selbst;
der Schlüssel gehört nicht in den Chat.

## 1. Konto bei SAM.gov anlegen (einmalig, ca. 10 Minuten)
1. https://sam.gov öffnen, oben rechts auf **„Sign In“** tippen.
2. Die Anmeldung läuft über **login.gov** (US-Regierungsdienst): **„Create an account“**, E-Mail
   (z. B. kontakt@wpdigitalranger.com), Passwort und eine zweite Sicherheitsstufe (Authenticator-App oder SMS) einrichten.
3. Danach zurück auf SAM.gov, die Kontodaten (Name, Firma) ausfüllen. Eine Registrierung als Bieter
   („Entity Registration“) ist **nicht** nötig.

## 2. Schlüssel erzeugen
1. Angemeldet oben rechts auf dein Profil → **„Account Details“**.
2. Im Abschnitt **„API Key“** dein Passwort eingeben und den Schlüssel anzeigen bzw. erzeugen.
3. Den Schlüssel kopieren.

Hinweis: Die Bezeichnungen der Knöpfe können sich bei SAM.gov ändern. Der Schlüssel läuft nach etwa
**90 Tagen** ab und muss dann an derselben Stelle erneuert werden (Jarvis meldet es im Bericht, wenn SAM.gov nicht antwortet).
Das tägliche Kontingent richtet sich nach deiner SAM.gov-Kontorolle. Jarvis fragt 1.000 Ergebnisse pro API-Seite ab und kann bei Bedarf bis zu zehn Seiten pro Datum laden. Zum Kontingentschutz sind es höchstens 20 API-Aufrufe pro Alarmprozess. Ein Ersteinrichtungslauf über sieben Tage macht normalerweise sieben Aufrufe, kann bei Folgeseiten mehr benötigen; häufige manuelle Läufe können das Tageskontingent verbrauchen.

## 3. Schlüssel bei GitHub hinterlegen
1. https://github.com/Twista-hub/jarvis/settings/secrets/actions/new öffnen.
2. Name: **SAM_API_KEY**
3. Secret: den kopierten Schlüssel einfügen → **„Add secret“**.

## 4. Fertig
- Claude oder ChatGPT starten danach den Testlauf „Auslandsquellen testen“ (`.github/workflows/ted.yml`).
- Firmen kreuzen im Suchprofil unter „Länder → Außerhalb Europas“ **USA** an; der tägliche Alarm holt dann
  einmal am Tag die neuen Bundesausschreibungen (eine Anfrage pro Tag, das Tageslimit eines persönlichen Schlüssels reicht).
- Nicht enthalten: Ausschreibungen der Bundesstaaten, Landkreise und Städte (eigene Portale).

## 5. Höheres Kontingent (1.000 statt 10 Abrufe am Tag) – Stand 02.11.2026
Ein persönlicher Schlüssel ohne Rolle erlaubt nur 10 Abrufe am Tag. Mit einer Rolle bei einer registrierten Firma sind
es 1.000 (Quelle: GSA-Ratenlimits, Sekundärquelle, siehe `docs/usa-recherche.md` 3.2). Die Rolle bekommt, wer für
WP Digital Ranger eine UEI anlegt (wird automatisch „Entity Administrator“).

1. https://sam.gov → **„Sign In“** (gleiches login.gov-Konto wie oben).
2. Oben **„Workspace“** → bei „Entity Management“ **„Get Started“** → **„Get Unique Entity ID“** (nur UEI,
   keine volle Bieter-Registrierung; kostenlos, niemand anderes darf dafür Geld verlangen).
3. Angaben genau wie im Handelsregister/Gewerbeschein: „WP Digital Ranger“, Rochusstraße 19, 52531 Übach-Palenberg,
   Germany. SAM.gov prüft Name und Adresse; bei ausländischen Firmen ggf. Dokument hochladen (Gewerbeanmeldung).
4. Fragt SAM.gov nach einem **NCAGE-Code**: kostenlos beantragen unter https://eportal.nspa.nato.int/Codification/CageTool/home.aspx
   (Dauer einige Tage bis Wochen). Neuere Hinweise sagen, NCAGE sei nur für Verteidigungsaufträge Pflicht; im Zweifel
   Federal Service Desk fragen: https://www.fsd.gov.
5. Nach Freigabe: **„Account Details“** → **„API Key“** neu erzeugen und bei GitHub `SAM_API_KEY` ersetzen
   (https://github.com/Twista-hub/jarvis/settings/secrets/actions).
6. Claude/ChatGPT Bescheid geben: dann wird die Laufgrenze in `alarm/usa.py` angehoben und Beschreibungen/Anhänge
   für Treffer werden nachgeladen.
