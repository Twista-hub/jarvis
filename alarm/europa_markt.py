"""Market analysis Europe (read only): how many contract notices per country and trade appeared on TED in the last
N days. Uses the TED Search API v3 count (limit 1, totalNoticeCount); TED reuse allowed (see alarm/ted.py).
Usage: python3 alarm/europa_markt.py [tage] [--probe]
"""
import json
import sys
import time
import urllib.request
from datetime import date, timedelta

API = "https://api.ted.europa.eu/v3/notices/search"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "content-type": "application/json"}
ARTEN = "(cn-standard cn-social cn-desg subco)"
# Same trades and CPV prefixes as web/src/gewerke.ts
GEWERKE = {
    "Elektro": ["45311", "45315", "45317", "45310"],
    "SHK": ["4533"],
    "Tischler": ["45421"],
    "Reinigung": ["90911", "90919", "90910"],
    "Maler/Trockenbau": ["45442", "45441", "45410", "45324"],
    "Dach/Zimmerer": ["45261", "45422"],
    "GaLaBau/Winterdienst": ["77310", "77311", "77313", "77314", "90620", "90630"],
    "Sicherheit": ["79710", "79713", "79714", "79715"],
    "Boden/Fliesen": ["45432", "45431"],
    "Zeitarbeit": ["79620", "79621", "79622", "79624", "79625"],
}
LAENDER = ["DEU", "AUT", "CHE", "FRA", "BEL", "NLD", "LUX", "ITA", "ESP", "PRT", "POL", "CZE", "DNK", "SWE", "FIN", "NOR",
           "IRL", "HUN", "ROU", "BGR", "HRV", "SVN", "SVK", "GRC", "EST", "LVA", "LTU", "CYP", "MLT", "ISL", "LIE"]


def zaehlen(query: str) -> int:
    body = json.dumps({"query": query, "fields": ["publication-number"], "limit": 1, "page": 1, "scope": "ALL", "paginationMode": "PAGE_NUMBER"}).encode()
    for versuch in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API, data=body, headers=UA, method="POST"), timeout=60) as r:
                return int(json.loads(r.read()).get("totalNoticeCount") or 0)
        except Exception as e:  # noqa: BLE001
            fehler = e
            time.sleep(2 + 3 * versuch)
    print(f"  Fehler: {fehler} bei {query[:120]}", file=sys.stderr)
    return -1


def cpv_teil(praefixe: list[str]) -> str:
    return "(" + " OR ".join(f"classification-cpv={p}*" for p in praefixe) + ")"


def main() -> None:
    tage = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 60
    bis = date.today()
    von = bis - timedelta(days=tage)
    zeit = f"publication-date>={von:%Y%m%d} AND publication-date<={bis:%Y%m%d}"
    if "--probe" in sys.argv:
        for q in [f"{zeit} AND notice-type IN {ARTEN} AND buyer-country=FRA",
                  f"{zeit} AND notice-type IN {ARTEN} AND buyer-country=FRA AND classification-cpv=90911*",
                  f"{zeit} AND notice-type IN {ARTEN} AND buyer-country=FRA AND classification-cpv IN (90911000 90911200)"]:
            print(zaehlen(q), q)
        return
    print(f"TED, Auftragsbekanntmachungen {von} bis {bis} ({tage} Tage)\n")
    zeilen = []
    for land in LAENDER:
        gesamt = zaehlen(f"{zeit} AND notice-type IN {ARTEN} AND buyer-country={land}")
        werte = {g: zaehlen(f"{zeit} AND notice-type IN {ARTEN} AND buyer-country={land} AND {cpv_teil(p)}") for g, p in GEWERKE.items()}
        summe = sum(v for v in werte.values() if v > 0)
        zeilen.append((land, gesamt, summe, werte))
        print(f"{land}: gesamt {gesamt}, unsere Gewerke {summe}", flush=True)
    zeilen.sort(key=lambda z: -z[2])
    kopf = "| Land | alle | unsere 10 Gewerke | " + " | ".join(GEWERKE) + " |"
    print("\n" + kopf + "\n|" + "---|" * (len(GEWERKE) + 3))
    for land, gesamt, summe, werte in zeilen:
        print(f"| {land} | {gesamt} | {summe} | " + " | ".join(str(werte[g]) for g in GEWERKE) + " |")


if __name__ == "__main__":
    main()
