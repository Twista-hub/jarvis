# Auftrag für den Browser-Chat: Cloudflare-Regel gegen Roboter-Last auf crewtender.eu (19.11.2026)

Hintergrund: Metas Crawler `meta-externalagent` ruft seit 17.11.2026 rund 3.500 Adressen je Stunde ab und hält sich
nicht an robots.txt; am 18.11. waren es 89.464 Anfragen bei einer Tagesgrenze von 100.000 (kostenloser Worker-Tarif).
Die Website antwortet solchen Abrufen seit 19.11. mit 404, aber auch das zählt als Anfrage. Eine Cloudflare-Regel sperrt
sie, bevor sie zählen. Gesperrt werden: Metas KI-Crawler ganz, die SEO-Roboter AhrefsBot und MJ12bot ganz (bringen
keine Besucher) und alle Roboter auf `/sprache`. Nicht gesperrt: Google, Bing, ChatGPT, Perplexity, Claude und die
Link-Vorschau von Facebook/WhatsApp (`facebookexternalhit`).

Kopiertext:

```
Aufgabe: Im Cloudflare-Dashboard für die Domain crewtender.eu eine Sicherheitsregel anlegen, die bestimmte Roboter
sperrt. Nur diese eine Regel anlegen, sonst nichts ändern.

1. Öffne https://dash.cloudflare.com und wähle die Domain "crewtender.eu".
2. Gehe links zu "Sicherheit" > "Sicherheitsregeln" (in der älteren Ansicht: "Sicherheit" > "WAF" >
   "Benutzerdefinierte Regeln") und klicke "Regel erstellen" > "Benutzerdefinierte Regeln".
3. Regelname: Roboter-Last begrenzen
4. Klicke "Ausdruck bearbeiten" und füge genau diesen Ausdruck ein (eine Zeile):

(http.user_agent contains "meta-externalagent") or (http.user_agent contains "AhrefsBot") or (http.user_agent contains "MJ12bot") or (http.request.uri.path eq "/sprache" and http.request.method eq "GET" and (http.user_agent contains "bot" or http.user_agent contains "Bot" or http.user_agent contains "crawler" or http.user_agent contains "Crawler" or http.user_agent contains "externalagent"))

5. Aktion: "Blockieren".
6. Klicke "Bereitstellen".
7. Melde: ob die Regel aktiv ist, ihren Namen und ob Cloudflare eine Fehlermeldung zum Ausdruck gezeigt hat
   (dann den genauen Wortlaut).

Regeln: Keine anderen Regeln, DNS-Einträge oder Einstellungen ändern, keinen Tarif wechseln, nichts kaufen,
keine Passwörter eingeben. Wenn das Menü anders heißt oder die Regel nicht angelegt werden kann: stopp und melde,
was du siehst.
```

Ergebnis bitte in `docs/browser/protokoll.md` eintragen.
