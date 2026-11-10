# Crewtender für Android (Google Play)

Die App ist eine Trusted Web Activity: eine dünne Android-Hülle, die https://crewtender.eu im Vollbild öffnet.
Paket: `eu.crewtender.app` (endgültig, lässt sich nach dem ersten Hochladen nie mehr ändern). Konto: WP Digital Ranger.

- `twa-manifest.json`: Einstellungen für Bubblewrap. **Vor jedem Hochladen `appVersionCode` um 1 erhöhen.**
- Gebaut wird nur in GitHub Actions (Ablauf „Android-App“, `.github/workflows/android.yml`), nichts hängt an einem PC.
- Signaturschlüssel (Upload-Schlüssel `crewtender-upload`): liegt nur im privaten R2-Speicher
  (`jarvis-auftraege/android/crewtender-upload.keystore`), nie im Repo. Sein Passwort ist das GitHub-Secret
  `ANDROID_SCHLUESSEL_PASSWORT`, das Benjamin selbst anlegt. Google verwahrt den eigentlichen App-Signaturschlüssel
  (Play App Signing); geht der Upload-Schlüssel verloren, lässt er sich in der Play Console zurücksetzen.
- `/.well-known/assetlinks.json` (web/src/app.ts, `APP_FINGERABDRUECKE`) muss den SHA-256 des **App-Signaturschlüssels**
  aus der Play Console enthalten (Test und Veröffentlichung → App-Integrität), dazu den des Upload-Schlüssels für
  direkt installierte Test-APKs. Sonst zeigt die App eine Adressleiste.
- In der App gibt es keinen Kauf: Pläne bucht man auf der Website (Zahlungsrichtlinie von Google Play).

Modi des Ablaufs: `probe` (baut mit einem Wegwerf-Schlüssel, prüft nur die Technik), `schluessel` (legt einmalig den
Upload-Schlüssel an und zeigt seinen Fingerabdruck), `bauen` (baut das signierte App-Bundle zum Hochladen).
