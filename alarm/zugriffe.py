"""Read only: who visits crewtender.eu, from Cloudflare's own analytics (no tracking of our own, no AI, no database).

Three sources, each printed as plain lines for the workflow log:
  1. daily totals (httpRequests1dGroups): page views, unique visitors, requests, countries, browsers, status codes
  2. details of the last days (httpRequestsAdaptiveGroups, as far back as the plan allows): referring sites, paths,
     countries, networks (who: provider of the visitor's connection), devices, browsers, user agents
  3. Web Analytics (the beacon on public pages since 08.11.2026): only real browsers, so it separates people from crawlers

Usage: CF_TOKEN=... CF_ACCOUNT=... python3 alarm/zugriffe.py [tage]
"""
import json
import os
import sys
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone

ZONE_NAME = "crewtender.eu"
API = "https://api.cloudflare.com/client/v4"
STATISCH = ("/assets", "/app.js", "/favicon", "/og-", "/icon", "/manifest", "/sw", "/cdn-cgi", "/robots.txt", "/apple-touch")


def cf(url: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {os.environ['CF_TOKEN']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def gql(query: str, variablen: dict) -> tuple[dict, str]:
    try:
        r = cf(f"{API}/graphql", {"query": query, "variables": variablen})
    except Exception as e:  # noqa: BLE001
        return {}, f"{type(e).__name__}: {e}"
    if r.get("errors"):
        return r.get("data") or {}, "; ".join(str(f.get("message")) for f in r["errors"])[:400]
    return r.get("data") or {}, ""


def tabelle(titel: str, zaehler: Counter, n: int = 25, zweit: Counter | None = None) -> None:
    print(f"\n== {titel}")
    if not zaehler:
        print("   (keine Daten)")
    for k, v in zaehler.most_common(n):
        print(f"   {v:>7}" + (f"  neu {zweit.get(k, 0):>6}" if zweit is not None else "") + f"  {k or '(leer)'}")


def main() -> None:
    tage = max(1, min(90, int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 30))
    zonen = cf(f"{API}/zones?name={ZONE_NAME}")
    if not zonen.get("result"):
        print("Zone nicht lesbar (Token ohne Zonen-Recht?)", zonen.get("errors"))
        return
    zone = zonen["result"][0]["id"]
    print(f"Zone {ZONE_NAME}, Tarif {zonen['result'][0].get('plan', {}).get('name')}, Stand {datetime.now(timezone.utc):%d.%m.%Y %H:%M} UTC")

    # 1. Daily totals
    bis, von = date.today(), date.today() - timedelta(days=tage)
    q = """query($z:String!,$v:Date!,$b:Date!){viewer{zones(filter:{zoneTag:$z}){
      httpRequests1dGroups(limit:100,filter:{date_geq:$v,date_leq:$b},orderBy:[date_ASC]){dimensions{date}
        sum{requests pageViews threats countryMap{clientCountryName requests threats} browserMap{uaBrowserFamily pageViews} responseStatusMap{edgeResponseStatus requests}}
        uniq{uniques}}}}}"""
    d, fehler = gql(q, {"z": zone, "v": str(von), "b": str(bis)})
    if fehler:
        print("TAGESWERTE Fehler:", fehler)
    laender, bedrohung, browser, status = Counter(), Counter(), Counter(), Counter()
    print(f"\n== Tageswerte der letzten {tage} Tage (alle Abrufe, auch Suchmaschinen und Roboter)")
    for g in ((d.get("viewer") or {}).get("zones") or [{}])[0].get("httpRequests1dGroups", []):
        s = g["sum"]
        print(f"   {g['dimensions']['date']}: Seitenaufrufe {s['pageViews']:>6}, Besucher (eindeutige Adressen) {g['uniq']['uniques']:>5}, Anfragen {s['requests']:>7}, abgewehrt {s['threats']:>4}")
        for c in s.get("countryMap") or []:
            laender[c["clientCountryName"]] += c["requests"]
            bedrohung[c["clientCountryName"]] += c["threats"]
        for b in s.get("browserMap") or []:
            browser[b["uaBrowserFamily"]] += b["pageViews"]
        for r in s.get("responseStatusMap") or []:
            status[str(r["edgeResponseStatus"])] += r["requests"]
    tabelle(f"Länder, {tage} Tage (Anfragen)", laender, 30)
    tabelle(f"Browser-Familien, {tage} Tage (Seitenaufrufe)", browser, 20)
    tabelle(f"Antwort-Codes, {tage} Tage (Anfragen)", status, 12)

    # 2. Details, as far back as the plan allows
    d, fehler = gql("""query($z:String!){viewer{zones(filter:{zoneTag:$z}){settings{httpRequestsAdaptiveGroups{maxDuration notOlderThan enabled}}}}}""", {"z": zone})
    grenzen = (((d.get("viewer") or {}).get("zones") or [{}])[0].get("settings") or {}).get("httpRequestsAdaptiveGroups") or {}
    print(f"\nDetaildaten: {grenzen or fehler}")
    max_dauer = int(grenzen.get("maxDuration") or 86400)
    zurueck = min(int(grenzen.get("notOlderThan") or 86400), tage * 86400) - 600
    jetzt = datetime.now(timezone.utc).replace(microsecond=0)
    fenster, start = [], jetzt - timedelta(seconds=zurueck)
    while start < jetzt:
        ende = min(jetzt, start + timedelta(seconds=min(max_dauer, 86400) - 1))
        fenster.append((start, ende))
        start = ende + timedelta(seconds=1)
    print(f"Detailzeitraum: {fenster[0][0]:%d.%m. %H:%M} bis {jetzt:%d.%m. %H:%M} UTC, nur Besucher-Anfragen (ohne interne Abrufe)")
    felder = {
        "clientRefererHost": "Woher: verweisende Seite (Anfragen, neu = neue Besuche)",
        "clientCountryName": "Woher: Land (Anfragen, neu = neue Besuche)",
        "clientASNDescription": "Wer: Netz des Besuchers (Anfragen, neu = neue Besuche)",
        "clientRequestPath": "Was: aufgerufene Seiten (ohne Bilder und Skripte)",
        "clientRequestHTTPHost": "Über welche Adresse",
        "clientDeviceType": "Gerät",
        "userAgentBrowser": "Browser",
        "userAgent": "Kennung des Programms (zeigt Suchmaschinen und Roboter)",
        "edgeResponseStatus": "Antwort-Codes",
    }
    for feld, titel in felder.items():
        anfragen, besuche, meldung = Counter(), Counter(), ""
        for a, e in fenster:
            q = """query($z:String!,$a:Time!,$e:Time!){viewer{zones(filter:{zoneTag:$z}){
              httpRequestsAdaptiveGroups(limit:400,filter:{datetime_geq:$a,datetime_leq:$e,requestSource:"eyeball"},orderBy:[count_DESC]){count sum{visits} dimensions{wert:%s}}}}}""" % feld
            d, fehler = gql(q, {"z": zone, "a": a.strftime("%Y-%m-%dT%H:%M:%SZ"), "e": e.strftime("%Y-%m-%dT%H:%M:%SZ")})
            meldung = fehler or meldung
            for g in ((d.get("viewer") or {}).get("zones") or [{}])[0].get("httpRequestsAdaptiveGroups", []):
                w = str(g["dimensions"]["wert"])
                if feld == "clientRequestPath" and w.startswith(STATISCH):
                    continue
                anfragen[w] += g["count"]
                besuche[w] += g["sum"]["visits"]
        if meldung:
            print(f"\n== {titel}: nicht verfügbar ({meldung})")
            continue
        tabelle(titel, anfragen, 60 if feld == "clientRequestPath" else 40 if feld == "userAgent" else 30, besuche)
        if feld == "clientRefererHost":
            print(f"   Summe Anfragen {sum(anfragen.values())}, neue Besuche {sum(besuche.values())}")

    # 3. Web Analytics: real browsers only
    konto = os.environ.get("CF_ACCOUNT", "").strip()
    seit = (jetzt - timedelta(days=min(tage, 30))).strftime("%Y-%m-%dT%H:%M:%SZ")
    for feld, titel in {"date": "Echte Browser je Tag", "refererHost": "Echte Browser: verweisende Seite", "countryName": "Echte Browser: Land",
                        "requestPath": "Echte Browser: Seiten", "deviceType": "Echte Browser: Gerät", "userAgentBrowser": "Echte Browser: Browser"}.items():
        q = """query($k:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$k}){
          rumPageloadEventsAdaptiveGroups(limit:200,filter:{datetime_geq:$s,datetime_leq:$e,requestHost_like:"%%crewtender.eu"},orderBy:[count_DESC]){count sum{visits} dimensions{wert:%s}}}}}""" % feld
        d, fehler = gql(q, {"k": konto, "s": seit, "e": jetzt.strftime("%Y-%m-%dT%H:%M:%SZ")})
        if fehler:
            print(f"\n== {titel}: nicht verfügbar ({fehler})")
            continue
        zeilen = ((d.get("viewer") or {}).get("accounts") or [{}])[0].get("rumPageloadEventsAdaptiveGroups", [])
        auf, bes = Counter(), Counter()
        for g in zeilen:
            auf[str(g["dimensions"]["wert"])] += g["count"]
            bes[str(g["dimensions"]["wert"])] += g["sum"]["visits"]
        if feld == "date":
            print(f"\n== {titel} (Seitenaufrufe, neu = Besuche)")
            for k in sorted(auf):
                print(f"   {k}: Seitenaufrufe {auf[k]:>5}, Besuche {bes[k]:>5}")
            print(f"   Summe: Seitenaufrufe {sum(auf.values())}, Besuche {sum(bes.values())}")
        else:
            tabelle(titel + " (Seitenaufrufe, neu = Besuche)", auf, 40, bes)


if __name__ == "__main__":
    main()
