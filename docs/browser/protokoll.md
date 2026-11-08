# Protokoll des Browser-Chats

Neueste Einträge oben. Keine Passwörter oder Codes (öffentliches Repo).

## Konten-Übersicht Crewtender
| Dienst | Name / @ | Status | Link |
|---|---|---|---|
| Domain crewtender.eu | Namecheap → Cloudflare | gekauft 03.11.2026 (Benjamin), Cloudflare aktiv | |
| E-Mail hello@crewtender.eu | Cloudflare Email Routing → kontakt@wpdigitalranger.com | aktiv 03.11.2026 | |
| Instagram | @crew_tender (Unternehmenskonto, Kategorie Software; Anmeldung mit kontakt@wpdigitalranger.com, laut Benjamin 03.11.) | angelegt 03.11.2026 (Benjamin), eingerichtet, mit Facebook-Seite Crewtender verbunden (06.11.2026) | https://www.instagram.com/crew_tender/ |
| Facebook-Seite | Crewtender (Kategorie Software) | angelegt 03.11.2026 unter Benjamins persönlichem Profil, mit Instagram @crew_tender verbunden (06.11.2026) | https://www.facebook.com/profile.php?id=61596423171638 |
| LinkedIn-Seite | Crewtender | angelegt (Benjamin, bestätigt 06.11.2026) | Link noch eintragen |
| Bluesky | @crewtender.eu (Anmeldung kontakt@wpdigitalranger.com) | angelegt 03.11.2026 (Benjamin), eingerichtet, Domain-Handle verifiziert, E-Mail bestätigt | https://bsky.app/profile/crewtender.eu |
| Mastodon | @crewtender@mastodon.social (Anmeldung kontakt@wpdigitalranger.com) | angelegt 03.11.2026 (Benjamin), eingerichtet | https://mastodon.social/@crewtender |

## Regel für Anmeldungen (Benjamin, 03.11.2026)
- **Alle Crewtender-Konten werden mit kontakt@wpdigitalranger.com angemeldet** (eine Adresse, echtes Postfach).
- hello@crewtender.eu ist nur die **öffentliche** Kontaktadresse in Profilen und auf der Website (leitet an kontakt@ weiter).

## Einträge

### Erledigt (08.11.2026) – Stripe-Einstellungen Livebetrieb (Auftrag `docs/auftraege/crewtender-stripe-live.md`)
Alles im Livebetrieb, Konto Crewtender (Stripe ist nur im Chrome-Hauptprofil angemeldet, nicht im Crewtender-Profil).
1. Öffentliche Angaben: geändert, Support-E-Mail jetzt hello@crewtender.eu (vorher kontakt@wpdigitalranger.com). Name und Website waren richtig. Support-Telefon bleibt eingetragen (Pflichtfeld bei Stripe).
2. Branding: war richtig (Crewtender-Icon, #1f6feb).
3. Rechnungs-Fußzeile: live war leer (nur in der Sandbox gesetzt), jetzt eingetragen und nach Neuladen geprüft. Keine Steuersätze.
4. Zahlungsbelege (Erfolgreiche Zahlungen, Rückerstattungen): waren an.
5. Abo-Mails: neu an: bevorstehende Verlängerungen, ablaufende Karten, fehlgeschlagene Kartenzahlungen, fehlgeschlagene Lastschriften (kein Aufpreis). Schon richtig: Verlängerung 7 Tage vorher, fertiggestellte Rechnungen und Stornorechnungen senden. Nicht angefasst: Testzeitraum-Erinnerung, Änderungen bei Zahlungsmethoden, Smart Retries.
Keine Schlüssel angesehen, nichts Kostenpflichtiges, keine Produkte/Preise/Webhooks geändert.

### Erledigt (08.11.2026) – Facebook und Instagram, Woche 46 (Auftrag `docs/auftraege/crewtender-woche-46.md`)
Woche 46 in der Meta Business Suite geplant, alles um 18:00 Uhr, öffentlich, nichts beworben:
- Di 10.11., Facebook: `0-di-auftragswert-korrigiert.png`. Gelöscht und neu geplant, weil Meta beim Bearbeiten das alte Bild behielt. Alte ID 4665561463724729, neue ID 1112797828401694.
- Di 10.11., Instagram: `0-di-auftragswert-korrigiert.png`. Bearbeitet, Bild und Text ersetzt.
- Mi 11.11., Facebook + Instagram: `1-mi-fristen.png`
- Fr 13.11., Facebook + Instagram: `2-fr-zahl-der-woche.png`
- Mo 16.11., Facebook + Instagram: `3-mo-ausschreibung-der-woche.png`

Texte wie im Auftrag; Facebook mit Link (utm_source=facebook), Instagram „link in bio“ und Hashtags. Alle 8 Posts in der Liste „Geplant“ geprüft. Keine Passwörter, nichts Kostenpflichtiges, Bewerben jedes Mal abgelehnt.

Erfahrungen für die nächsten Aufträge:
- Die Business Suite öffnete zuerst mit der Demopin-Seite; vor jedem Schritt prüfen, dass oben „Crewtender“ gewählt ist (hier vor jeder Änderung umgestellt).
- Ein Klick in die Tagesspalte des Planers legt einen neuen Entwurf an; bestehende Posts über Content → Geplante Beiträge öffnen.
- Bild tauschen beim Bearbeiten greift bei Facebook nicht (Instagram schon): Facebook-Post löschen und neu planen.
- Der Facebook-Editor verschluckt beim Laden der Link-Vorschau manchmal die letzten Zeichen; Text nach dem Tippen am Ende kontrollieren.
- Instagram-Autovervollständigung ändert Hashtags (#handwerk → #handwerkliebe); nach dem Hashtag in einen freien Bereich klicken.

### 07.11.2026 – Browser-Chat: Stripe live freigeschaltet
- Auf Benjamins OK freigeschaltet. Persönliche Daten, Bank, Zwei-Faktor und das Absenden („Zustimmen und absenden“) hat Benjamin selbst gemacht. Stripe hat das Live-Konto „Crewtender“ geöffnet.
- **Gewählt:** Einzelunternehmen, Kategorie „Software as a Service“, Zahlungsbeschreibung CREWTENDER.EU, Radar Lite (gratis).
- **Abgewählt:** Stripe Tax (wegen § 19 UStG nicht nötig), Managed Payments (+3,5 %), Radar Standard/Plus/Pro, Climate-Beitrag. Die Support-Telefonnummer wird nicht auf Belegen angezeigt.
- **Billing-Einstellungen** aus der Sandbox ins Live-Konto kopiert. Das Live-Kundenportal hat die gleichen Einstellungen wie das Test-Portal.
- **Öffentliche Angaben** (gelten auch für den Testmodus): Name Crewtender, Website https://crewtender.eu, Support-E-Mail kontakt@wpdigitalranger.com, Datenschutz https://crewtender.eu/datenschutz, Nutzungsbedingungen https://crewtender.eu/nutzungsbedingungen. Damit sind auch die Rechtslinks im Kundenportal gesetzt. „Rechtsgültiger Firmenname“ ist leer (kein Handelsregister).
- **Zahlungsmethoden live:** Karten und Apple Pay an, Google Pay eingeschaltet. Für SEPA-Lastschrift will Stripe live noch Ausweis und Selfie (Stripe Identity), das macht Benjamin.
- Es gibt **keinen Live-Secret-Key** in GitHub. Im Repo liegt nur `STRIPE_SECRET_KEY` (Test). Ein Live-Key kommt erst, wenn der Crewtender-Chat ihn braucht.

### 07.11.2026 – Browser-Chat: Stripe (Test)
- **Kontoname:** Crewtender (umbenannt von „Neues Unternehmen“). Login kontakt@wpdigitalranger.com, E-Mail bestätigt, einziges Konto unter dem Login. Alles in der Sandbox / im Testmodus, Livebetrieb nicht freigeschaltet.
- **3.1 Öffentliche Angaben:** nicht möglich. Stripe verlangt dafür vorher „Produkte aktivieren“ (Livebetrieb).
- **3.2 Branding:** erledigt. Symbol profil.png, Markenfarbe #1f6feb.
- **3.3 Rechnungen:** erledigt. Fußzeile mit § 19 UStG, Anschrift und USt-IdNr. gespeichert. Rechnungs-PDFs in E-Mails waren schon an.
- **3.4 Kunden-E-Mails:** erledigt. „Erfolgreiche Zahlungen“ und „Rückerstattungen“ an.
- **3.5 Fehlgeschlagene Zahlungen:** erledigt. Smart Retries an (8 Versuche in 2 Wochen), SEPA mit automatischer Wiederholung. Nach dem letzten Fehlversuch wird das Abo gekündigt. E-Mails bei fehlgeschlagener Karten- und Lastschriftzahlung an.
- **3.6 Zahlungsmethoden:** erledigt. Karten, SEPA-Lastschrift, Apple Pay und Google Pay an. Stripe hatte von sich aus weitere an (u. a. Klarna, Amazon Pay, Link, Bancontact, EPS). Die habe ich nicht angefasst.
- **3.7 Kundenportal:** aktiv, mit Test-Link. Erlaubt sind Zahlungsmethode, Rechnungsadresse, Rechnungen und Kündigung zum Periodenende. Planwechsel ist aus. Die Links zu Nutzungsbedingungen und Datenschutz kommen aus den öffentlichen Angaben und fehlen deshalb noch (siehe 3.1).
- **Schlüssel:** ja. Benjamin hat `STRIPE_SECRET_KEY` als Repository-Secret eingetragen (07.11., 13:59 UTC). Den Wert hat der Browser-Chat nicht gesehen.

### 06.11.2026 – Browser-Chat: Instagram-Posts eingeplant
- **Weg:** eigene Instagram-Posts. Bei geplanten Facebook-Posts ist das Feld „Posten in“ gesperrt, Instagram lässt sich dort nicht anhaken. Neu angelegt in der Business Suite (Portfolio crewtender), Ziel nur @crew_tender, Texte aus dem Auftrag (mit „link in bio“ und Hashtags):
  - 07.11.2026, 18:00: post3-registerkarten.png („From tender to team. One app. …“)
  - 10.11.2026, 18:00: post2-auftragswert.png („📑 Around 500 new public tenders every morning. …“)
- Beide stehen unter Content → „Geplant“. Werbung jeweils abgelehnt („Vielleicht später“).
- **Profil-Link:** stimmt, im Profil steht crewtender.eu.
- **Achtung, Facebook doppelt:** Unter „Geplant“ steht jeder Facebook-Post **zweimal** (07.11. und 10.11., je 18:00). Wahrscheinlich hat der Planer heute Morgen nichts angezeigt, und die Posts wurden neu angelegt, obwohl die alten noch da waren. Auf Benjamins OK („Ja, je einen löschen“) wurde je ein Duplikat gelöscht. Jetzt ist jeder Post genau einmal geplant: Facebook 07.11. und 10.11., Instagram 07.11. und 10.11., je 18:00 Uhr.

### 06.11.2026 – Browser-Chat: Anthropic-Guthaben
Nur gelesen. Nichts gekauft, kein Limit geändert, nichts verknüpft.
- **Organisation:** „Twista's Individual Org“ (API-Plan für Einzelpersonen). Das ist die **einzige** Organisation im Console-Konto. Dort liegen die Schlüssel „jarvis-alarm“ (Arbeitsbereich Jarvis, erstellt 29.10., bisher 16,23 $) und „Streik app“ (1,07 $). Achtung: Das Console-Konto läuft über die RestockHero-Mailadresse. Eine eigene Jarvis-Organisation gibt es nicht.
- **Credit balance:** -0,09 $ (offener Betrag, die API ist gesperrt, bis Guthaben da ist). Gekauft waren 5,95 $ (01.10.), 11,90 $ (03.10.) und 23,80 $ (30.10.).
- **Promotional credits:** keine.
- **Monthly spend limit:** Organisation 40 $ (18,93 $ verbraucht, 47 %), Arbeitsbereich Jarvis 30 $ (17,86 $, 60 %). Zurücksetzung am 01.12.2026.
- **Verknüpfung mit Max:** In claude.ai (Max, verlängert sich am 01.12.2026) gibt es unter Einstellungen → Abrechnung noch **keinen** Bereich zum Verknüpfen einer Organisation oder für API-Guthaben. Nicht erledigt, ab 07./08.11. erneut prüfen.
- Hinweis: Die Console heißt jetzt platform.claude.com, die Abrechnung liegt unter /settings/billing und die Limits unter /settings/spend-limits.

### 06.11.2026 – Crewtender Facebook: 2 Posts neu eingeplant
- Beim Social-Media-Check war auf der Facebook-Seite nichts mehr geplant. Auf Benjamins OK („Ja, neu einplanen“) neu angelegt:
  - 07.11.2026, 18:00: post3-registerkarten.png, Text „From tender to team. One app. …“
  - 10.11.2026, 18:00: post2-auftragswert.png, Text „📑 Around 500 new public tenders every morning. …“
- Texte aus docs/auftraege/crewtender-facebook-planen.md. In der Content-Bibliothek unter „Geplant“ geprüft: beide da.

### 06.11.2026 – Claude Code: Mail-Weiterleitung und LinkedIn
- Weiterleitung kontakt@wpdigitalranger.com → restockhero.contact@gmail.com (Kopie bleibt in kontakt@) funktioniert, Label „Crewtender“ in Gmail. Testmail um 07:03 angekommen. Ältere Mails wurden nicht nachträglich weitergeleitet.
- LinkedIn-Unternehmensseite laut Benjamin angelegt. Link bei Gelegenheit in der Konten-Übersicht ergänzen.

### 06.11.2026 – Browser-Chat: Mail-Weiterleitung
- Private Email (kontakt@wpdigitalranger.com, neue Oberfläche): Settings → Forwarding → „Add a forwarding address“ restockhero.contact@gmail.com → Save (Benjamin war angemeldet und hat gespeichert). „Email forwarding“ an, **„Keep an email copy“ an**, nach dem Neuladen geprüft. Keine Regeln geändert, nichts gelöscht.
- Gmail (restockhero.contact@gmail.com): neues Label „Crewtender“ und Filter `to:(kontakt@wpdigitalranger.com OR hello@crewtender.eu)` → Label „Crewtender“ (auch auf vorhandene Mails angewendet). Bestehende Filter unverändert.
- **Test ok:** Benjamins Mail „Test Weiterleitung“ (06.11., 07:03) liegt in kontakt@ und in Gmail im Posteingang mit Label „Crewtender“.

### 06.11.2026 – Browser-Chat: Instagram mit Facebook verbunden
- **Benjamin hat die Konten selbst verbunden.** Der Browser-Chat hat nur geprüft: Facebook als Seite Crewtender → Einstellungen → Verknüpfte Konten → Instagram.
- Ergebnis: **verbunden.** Unter „Connected Instagram“ steht crewtender @crew_tender, „Zugriff auf Instagram-Nachrichten im Postfach“ ist an.
- RestockHero-Seite, @restockhero, Make und Buffer nicht angefasst. Nichts gepostet, nichts bezahlt, keine Werbung.

### 04.11.2026 – Browser-Chat: Search Console Demopin, Prüfung gestartet
- Vorher live geprüft (Googlebot): /event/9113 und /event/886 haben jetzt eigene Titel mit Datum („– Oct 26, 2026, Upper Marlboro“ bzw. „– Oct 6, 2026“) und eigene Canonicals. Eine unbekannte URL liefert 404.
- sc-domain:demopin.app → Seiten: „Fehlerbehebung überprüfen“ gestartet für „Duplikat – Google hat eine andere Seite als der Nutzer als kanonische Seite bestimmt“ (433 Seiten) und „Soft 404“ (2). Startdatum 04.11.26. Google braucht meist einige Tage bis zwei Wochen.
- Sitemap nicht neu eingereicht (Adresse bleibt https://demopin.app/sitemap.xml).

### 04.11.2026 – Claude Code: SEO umgesetzt (aus der Bestandsaufnahme)
- Live: Titel ohne doppeltes „Crewtender“, Beschreibung und Vorschaubild für geteilte Links (Open Graph, https://crewtender.eu/og-v1.jpg), strukturierte Daten (Organisation, Web-App) auf der Startseite, HEAD-Anfragen antworten jetzt 200 statt 404, Hilfe-Center (15 Seiten) und Kontakt in der Sitemap.
- Die Datei `C:\Dokumente\Jarvis\seo-auftrag-2026-11-04.md` liegt nur auf Benjamins PC; umgesetzt nach den Stichpunkten oben. Offen: „/ vs. /de“ (Entscheidung Benjamin) und Gewerk×Region-Seiten (bitte den Auftragstext unter `docs/auftraege/` ablegen).
- Search Console: Google-Konto ist laut Benjamin für Demopin, RestockHero und Crewtender dasselbe (Ausnahme von der kontakt@-Regel). Sitemap in ein paar Tagen erneut prüfen.

### 04.11.2026 – Browser-Chat: Google Search Console eingerichtet
- Domain-Property **sc-domain:crewtender.eu** im selben Google-Konto wie Demopin und RestockHero angelegt (Benjamins Wunsch).
- Bestätigung über DNS: Cloudflare-TXT `@` mit `google-site-verification=…` hinzugefügt (manuell, Google bekam keinen Zugriff auf Cloudflare). Google meldet „Inhaberschaft bestätigt“. **Den TXT-Eintrag nicht löschen.** Andere DNS-Einträge nicht angefasst.
- Sitemap https://crewtender.eu/sitemap.xml eingereicht. Status direkt danach „Konnte nicht abgerufen werden“ (bei neuen Properties oft nur vorläufig; per GET liefert die Sitemap 200). In ein paar Tagen erneut prüfen.
- Indexierung für https://crewtender.eu/de beantragt.

### 04.11.2026 – Browser-Chat: SEO-Bestandsaufnahme
- Crewtender ist **noch nicht** in der Google Search Console. Anmeldung (Domain-Property per DNS bei Cloudflare) folgt nach Benjamins Entscheidung, welches Google-Konto.
- SEO-Auftrag für Claude Code: C:\Dokumente\Jarvis\seo-auftrag-2026-11-04.md (Titel doppelt, Description, Open Graph, HEAD-404, / vs. /de, JSON-LD, Gewerk×Region-Seiten).

### 04.11.2026 – Browser-Chat: Repo öffentlich
- Twista-hub/jarvis auf **Public** umgestellt (GitHub Actions waren blockiert, weil die Gratis-Minuten für private Repos im November aufgebraucht waren: $14,19 von $12). Öffentliche Repos verbrauchen keine Actions-Minuten.
- Geprüft: https://github.com/Twista-hub/jarvis ist ohne Anmeldung erreichbar, Sichtbarkeit „public“.
- Twista-hub/restockhero nicht angefasst (bleibt privat). Keine Zahlungsdaten, Budgets unverändert, sonst nichts geändert.
- Ältere Workflow-Läufe mit „spending limit“-Fehler ggf. neu starten (Claude Code).

### 03.11.2026 – Claude Code: Protokoll gelesen
- crewtender.eu verweist jetzt per `rel="me"` auf https://mastodon.social/@crewtender → in Mastodon unter „Profil bearbeiten“ einmal speichern, dann zeigt das Website-Feld den grünen Haken.
- Offen: Instagram ↔ Facebook verbinden (Benjamin selbst, eigenes Anmeldefenster). Hinweis: Wochentage im Facebook-Auftrag waren falsch, die Daten (05./07./10.11.) gelten.

### 03.11.2026 – Browser-Chat: Facebook-Reels und geplante Posts
- **Instagram mit der Facebook-Seite verbinden: nicht erledigt.** Business Suite (Seite Crewtender, ohne RestockHero-Portfolio) → „Instagram verknüpfen“ öffnet ein eigenes Instagram-Anmeldefenster außerhalb meines Tabs. Das muss Benjamin machen. Abgebrochen, nichts verknüpft.
- **Reels auf Facebook „Crewtender“ veröffentlicht** (nur Facebook, keine Story, keine Gruppen):
  - 03.11.2026, 21:30: reel1-ausschreibungen.mp4 (Englisch), Text „Find your next public contract. 👉 https://crewtender.eu“, Musik „Pulse Of Innovation“ (Giulio Cercato).
  - 03.11.2026, 21:33: reel2-team.mp4 (Deutsch), Text „Auftrag gewinnen. Dann das Team planen. 👉 https://crewtender.eu“, Musik „Kingdom“ (Ross Lara, wie bei Instagram).
- **Bild-Posts geplant** (Facebook „Crewtender“, öffentlich, nicht beworben), Texte wie im Auftrag:
  - Do 05.11.2026, 18:00: post1-ausschreibungen.png
  - Sa 07.11.2026, 18:00: post3-registerkarten.png
  - Di 10.11.2026, 18:00: post2-auftragswert.png
  - Hinweis: Im Auftrag stand Mi/Fr/Mo. Diese Wochentage passen zu 2025, die Daten wurden wie angegeben übernommen.

### 03.11.2026 – Browser-Chat: Bluesky und Mastodon
- **Bluesky:** RestockHero war angemeldet, deshalb über „Weiteren Account hinzufügen“ gearbeitet, an RestockHero nichts geändert. Benjamin hat das Konto mit kontakt@wpdigitalranger.com angelegt (crewtender.bsky.social).
- Profil: Anzeigename „Crewtender“, Logo (profil.png), Banner (facebook-titel.png), Bio „Find public tenders, write bids, plan your crew – the app for trades and service companies. 🌐 crewtender.eu · ✉️ hello@crewtender.eu“.
- Handle auf **@crewtender.eu** umgestellt: Cloudflare-DNS TXT `_atproto` angelegt (Wert `did=did:plc:b3idabsinmfvxsddvyr4i23h`, öffentlich), Bluesky meldet „Domain verifiziert“. MX- und Mail-TXT-Einträge nicht angefasst. E-Mail von Benjamin bestätigt.
- **Mastodon:** Mit Benjamins OK RestockHero bei mastodon.social abgemeldet (Wiederanmeldung macht Benjamin). Benjamin hat **@crewtender@mastodon.social** mit kontakt@wpdigitalranger.com angelegt.
- Profil: Anzeigename „Crewtender“, Logo, Banner (beide mit Bildbeschreibung), gleiche Bio. Zusatzfelder: Website → https://crewtender.eu, Legal notice → https://crewtender.eu/impressum.
- Nichts gepostet, keine Nachrichten.

### 03.11.2026 – Claude Code: Umzug abgeschlossen
- Alle Links in App und Mails zeigen auf https://crewtender.eu, app.wpdigitalranger.com leitet weiter. Website-Felder in Facebook/LinkedIn/Instagram bleiben https://crewtender.eu.

### 03.11.2026 – Browser-Chat: Supabase umgestellt (Schritt 7)
- Mit Benjamins OK im Projekt jarvis → Authentication → URL Configuration: **Site URL** `https://crewtender.eu` gespeichert („Successfully updated site URL“).
- **Redirect URL** `https://crewtender.eu/**` hinzugefügt. Die Einträge `https://app.wpdigitalranger.com/**` und `https://jarvis-alarm.benschiffer79.workers.dev/**` bleiben stehen (jetzt 3 URLs).
- → Claude Code Bescheid geben: **Supabase umgestellt**.

### 03.11.2026 – Claude Code: crewtender.eu ist live
- https://crewtender.eu zeigt die App, https://crewtender.eu/impressum das Impressum, www leitet weiter. app.wpdigitalranger.com läuft parallel.
- Nächster Auftrag: Schritt 7 in `docs/auftraege/crewtender-domain.md` (Supabase URL-Konfiguration).

### 03.11.2026 – Browser-Chat: Instagram
- Benjamin hat das Konto mit hello@crewtender.eu angelegt. Benutzername **@crew_tender** („crewtender“ war vergeben), Name „crewtender“.
- Profilbild (Logo), Bio auf Englisch: „Find public tenders, write bids, plan your crew – for trades & service companies. 🌐 crewtender.eu · ✉️ hello@crewtender.eu“. Link crewtender.eu ist im Profil sichtbar.
- Auf Unternehmenskonto umgestellt, Kategorie Software (sichtbar). Öffentlicher Kontakt nur E-Mail hello@crewtender.eu, keine Telefonnummer, keine Adresse. Nicht mit RestockHero (@restockhero6) oder dessen Meta-Portfolio verknüpft, nichts gepostet.
- LinkedIn: Benjamin hat das Titelbild fürs persönliche Profil hochgeladen.

### 03.11.2026 – Browser-Chat: Links auf crewtender.eu umgestellt
- Auf Benjamins Wunsch überall https://crewtender.eu statt app.wpdigitalranger.com: Facebook-Link, LinkedIn-Kontaktinfo (Website, Geschäftlich).
- Facebook-Impressum jetzt ohne persönlichen Namen: „Crewtender ist ein Angebot von WP Digital Ranger. Impressum: https://crewtender.eu/impressum“. Der volle Name steht nur auf der Impressum-Seite selbst (Pflicht beim Einzelunternehmen).
- **Für Claude Code:** crewtender.eu zeigt noch die Namecheap-Weiterleitung (A-Record + www-CNAME), https antwortet nicht. Die App muss auf https://crewtender.eu laufen, und https://crewtender.eu/impressum muss das Impressum zeigen.

### 03.11.2026 – Browser-Chat: LinkedIn
- Benjamin hat ein persönliches LinkedIn-Konto angelegt (mit seiner geschäftlichen Adresse bei WP Digital Ranger).
- Profil eingerichtet (Englisch): Headline „Founder of Crewtender · Public tenders & crew planning for trades and service companies | WP Digital Ranger“, Branche Softwareentwicklung, Info-Text (Handwerk/Bau zuerst, dann Reinigung, Sicherheit, Personal, Catering), Website https://app.wpdigitalranger.com (Geschäftlich). Premium und Verifizierung nicht genutzt.
- Titelbild fürs persönliche Profil: `docs/design/crewtender/linkedin-profil-titel.png` (1584×396). Lädt Benjamin selbst hoch (LinkedIn öffnet nur den Datei-Dialog). Profilfoto: echtes Foto von Benjamin, nicht das Logo.
- Facebook-Bio auf Handwerk erweitert: „Find public tenders, write bids, plan your crew – the app for trades and service companies: construction, cleaning, security, staffing and catering.“
- Unternehmensseite noch nicht möglich: LinkedIn meldet „Funktion nicht verfügbar … warten Sie bitte mindestens einen Tag“. Ab 04.11.2026 erneut versuchen.

### 03.11.2026 – Browser-Chat: Bilder und Facebook-Seite
- Bilder erstellt (Farben der WP-Digital-Ranger-Marke, Zeichen: offenes „C“ mit Häkchen und zwei „Crew“-Punkten): `docs/design/crewtender/` → profil.png (1080×1080), facebook-titel.png (1640×624), linkedin-titel.png (1128×191), crewtender-zeichen.svg.
- Facebook-Seite „Crewtender“ angelegt, als Benjamin Schiffer (nicht unter Demopin oder RestockHero). Bio auf Englisch (Short bio aus dem Auftrag, Benjamins Wunsch: international), Website https://app.wpdigitalranger.com, E-Mail hello@crewtender.eu, Impressum-Text mit Link auf https://app.wpdigitalranger.com/impressum. Profil- und Titelbild hochgeladen. WhatsApp nicht verknüpft, keine Freunde eingeladen, keine Werbe-Mails, nichts gepostet.

### 03.11.2026 – Browser-Chat: crewtender.eu bei Cloudflare
- Cloudflare-Konto geprüft: „Benschiffer79@gmail.com's Account“ (darin liegen wpdigitalranger.com und der Worker jarvis-alarm).
- crewtender.eu hinzugefügt, Tarif Free, DNS-Scan bestätigt (Namecheap-Parkeinträge: 1 A, 1 CNAME, 5 MX, 1 TXT).
- Cloudflare-Nameserver: `hugh.ns.cloudflare.com`, `irma.ns.cloudflare.com`. Nächster Schritt: bei Namecheap eintragen.
- Namecheap: Nameserver auf Custom DNS (hugh/irma.ns.cloudflare.com) umgestellt.
- Cloudflare-Status: **Active** („Your domain is now protected by Cloudflare“), 03.11.2026. Nächster Schritt: Email Routing.
- Email Routing: Zieladresse kontakt@wpdigitalranger.com hinzugefügt, von Benjamin bestätigt.
- Regel **hello@crewtender.eu → kontakt@wpdigitalranger.com** angelegt, Status Active.
- Mit Benjamins OK die 6 vom DNS-Scan übernommenen Namecheap-Mail-Einträge gelöscht (MX eforward1–5.registrar-servers.com, TXT spf.efwd). Danach die Cloudflare-Einträge hinzugefügt: MX route1–3.mx.cloudflare.net, SPF, DKIM. A- und www-CNAME der Namecheap-Parkseite sind noch da, die räumt Claude Code auf.
- Catch-all bleibt vorerst aus (optional, nach Benjamins Entscheidung).
- **Stand Auftrag crewtender-domain: Domain gekauft 03.11.2026, Cloudflare-Konto Benschiffer79@gmail.com's Account, Status Active, hello@crewtender.eu aktiv.** → Claude Code Bescheid geben: Domain fertig.

### 03.11.2026 – Claude Code
- Ordner angelegt. Auftrag: `docs/auftraege/crewtender-konten.md`.
