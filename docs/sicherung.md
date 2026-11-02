# Datensicherung

Jede Nacht um 01:23 UTC sichert der Ablauf **Datensicherung** (`.github/workflows/sicherung.yml`) die Datenbank:
alle App-Daten (Schemas `public`, `jarvis_intern`, `jarvis_katalog`) und die Anmeldungen (`auth.users`,
`auth.identities`). Die Datei wird mit dem Passwort aus dem GitHub-Secret `BACKUP_PASSWORT` verschlüsselt
(AES-256, PBKDF2) und in Cloudflare R2 abgelegt: Bucket `jarvis-auftraege`, Ordner `sicherung/`,
Name `jarvis-JJJJ-MM-TT.tar.enc`. Aufbewahrt werden 14 Tage und die Sicherung vom 1. jedes Monats für ein Jahr.
Dateien in R2 (Unterlagen, Fotos, Belege) liegen bei Cloudflare und sind nicht Teil dieser Sicherung.

Schlägt die Sicherung fehl, kommt eine Handy-Nachricht (Ablauf „Fehler melden“).

## Passwort einrichten (einmalig, Benjamin)
1. https://github.com/Twista-hub/jarvis/settings/secrets/actions/new öffnen.
2. Name: `BACKUP_PASSWORT`, Secret: ein langes Passwort (z. B. 5 zufällige Wörter). **Im Passwortmanager
   speichern** – ohne dieses Passwort lässt sich keine Sicherung öffnen.
3. „Add secret“ tippen.

## Wiederherstellen (nur im Notfall, Claude oder ChatGPT mit Benjamin)
1. Datei aus R2 holen: `npx wrangler r2 object get jarvis-auftraege/sicherung/jarvis-JJJJ-MM-TT.tar.enc --remote --jurisdiction eu --file s.tar.enc`
2. Entschlüsseln: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in s.tar.enc -pass env:BACKUP_PASSWORT | tar -xf -`
3. In eine **neue, leere** Datenbank einspielen (nie ungeprüft über die laufende):
   `gzip -dc daten.sql.gz | psql "<Verbindung>"`, danach `gzip -dc anmeldungen.sql.gz | psql "<Verbindung>"`.
