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

## 3. Schlüssel bei GitHub hinterlegen
1. https://github.com/Twista-hub/jarvis/settings/secrets/actions/new öffnen.
2. Name: **SAM_API_KEY**
3. Secret: den kopierten Schlüssel einfügen → **„Add secret“**.

## 4. Fertig
- Claude oder ChatGPT starten danach den Testlauf „Auslandsquellen testen“ (`.github/workflows/ted.yml`).
- Firmen kreuzen im Suchprofil unter „Länder → Außerhalb Europas“ **USA** an; der tägliche Alarm holt dann
  einmal am Tag die neuen Bundesausschreibungen (eine Anfrage pro Tag, das Tageslimit eines persönlichen Schlüssels reicht).
- Nicht enthalten: Ausschreibungen der Bundesstaaten, Landkreise und Städte (eigene Portale).
