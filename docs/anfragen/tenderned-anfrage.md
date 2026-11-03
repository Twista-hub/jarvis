# Anfrage an TenderNed (Entwurf, nicht verschickt)

**Warum:** Die robots.txt von www.tenderned.nl sperrt die öffentliche Schnittstelle (`/papi/tenderned-rs-tns/…`) und den
RSS-Feed für automatische Abrufe (Lese-Test 03.11.2026, `niederlande-test.yml`). Die Daten selbst sind laut
data.overheid.nl **CC-0** („Alle aankondigingen op TenderNed zijn openbaar“). Mit einer Erlaubnis oder einem Zugang zur
TenderNed-XML-API könnte Jarvis alle niederländischen Ausschreibungen zeigen, auch die nationalen unter den EU-Schwellen
(rund 50 neue Verfahren pro Werktag), statt nur der EU-weiten aus TED.

**An:** functioneelbeheer@tenderned.nl (laut data.overheid.nl Kontakt für Datennutzung und XML-API-Zugang).
Versand nur nach OK von Benjamin.

**Betreff:** Verzoek om toestemming voor geautomatiseerd ophalen van aankondigingen (TNS / XML-API)

---

Geachte heer/mevrouw,

Mijn naam is Benjamin Schiffer, eigenaar van WP Digital Ranger (eenmanszaak, Duitsland). Wij ontwikkelen Jarvis, een
dienst die kleine en middelgrote bedrijven (schoonmaak, beveiliging, bouwvakken, uitzendbureaus) dagelijks attendeert op
openbare aanbestedingen die bij hen passen.

Wij willen graag ook Nederlandse aankondigingen opnemen. De dataset „Aankondigingen van overheidsopdrachten – TenderNed“
staat op data.overheid.nl onder CC-0 en noemt de TNS-webservice als bron. De robots.txt van www.tenderned.nl sluit
geautomatiseerde toegang tot `/papi/` echter uit, en die regel willen wij respecteren.

Daarom vragen wij u:
1. Mogen wij de TNS-webservice (`/papi/tenderned-rs-tns/v2/publicaties`) geautomatiseerd raadplegen, of
2. kunnen wij gebruikersgegevens voor de TenderNed XML-API ontvangen?

Wij zouden maximaal enkele tientallen verzoeken per dag doen (één keer per dag de nieuwe aankondigingen, met pauzes
tussen de verzoeken), met een herkenbare User-Agent („JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)“).
Wij tonen alleen de openbare gegevens van de aankondiging met bronvermelding („Bron: TenderNed“) en een link naar de
oorspronkelijke publicatie, en slaan geen persoonsgegevens van contactpersonen op.

Als u voorwaarden heeft (tijdstip, frequentie, vermelding), passen wij ons daar graag aan.

Met vriendelijke groet,

Benjamin Schiffer
WP Digital Ranger
Rochusstraße 19, 52531 Übach-Palenberg, Duitsland
kontakt@wpdigitalranger.com
https://app.wpdigitalranger.com

---

**Deutsche Zusammenfassung:** Bitte um Erlaubnis, die TNS-Schnittstelle automatisch abzufragen (höchstens einige
Dutzend Abrufe pro Tag, erkennbarer User-Agent, Quellenangabe, Link zum Original, keine Personendaten) oder um Zugang
zur XML-API.
