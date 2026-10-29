"""Exploration: how many fitting public tenders exist? Read-only, public data.

Sources:
- TED (EU, above thresholds): https://api.ted.europa.eu/v3/notices/search (no key)
- oeffentlichevergabe.de (DE, all thresholds): probe only, to find the open-data endpoint
"""
import json
import sys
import urllib.request
from datetime import date, timedelta

UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)", "Content-Type": "application/json"}

SUMMARY = []

PROFILES = {
    "perlease": ["79620000", "79952000", "79952100", "79956000", "79992000", "55520000", "55300000", "55410000", "79953000", "79954000"],
    "wpdr": ["72413000", "72420000", "72212224", "72415000", "79822500", "72267000", "72421000", "72422000"],
}


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=UA, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:1500]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA["User-Agent"]})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers), r.read()[:3000]
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()[:1500]
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def ted(profile, codes, days):
    since = (date.today() - timedelta(days=days)).strftime("%Y%m%d")
    cpv = " OR ".join(f"classification-cpv={c}" for c in codes)
    query = f"({cpv}) AND (place-of-performance=DEU OR buyer-country=DEU) AND publication-date>={since}"
    fields = ["publication-number", "notice-title", "buyer-name", "classification-cpv", "publication-date", "deadline-receipt-tender-date-lot", "notice-type"]
    status, data = post("https://api.ted.europa.eu/v3/notices/search", {"query": query, "fields": fields, "limit": 50, "page": 1, "scope": "ACTIVE", "checkQuerySyntax": False})
    print(f"\n===== TED {profile} ({days} Tage) HTTP {status}")
    print("Query:", query)
    if status != 200:
        print(data)
        return
    print("Treffer gesamt:", data.get("totalNoticeCount"))
    SUMMARY.append(f"TED {profile}: {data.get('totalNoticeCount')} in {days} Tagen")
    for n in data.get("notices", [])[:40]:
        title = n.get("notice-title") or {}
        t = title.get("deu") or title.get("eng") or next(iter(title.values()), "") if isinstance(title, dict) else title
        buyer = n.get("buyer-name") or {}
        b = (buyer.get("deu") or buyer.get("eng") or next(iter(buyer.values()), [""])) if isinstance(buyer, dict) else buyer
        if isinstance(b, list):
            b = b[0] if b else ""
        if isinstance(t, list):
            t = t[0] if t else ""
        print(f"- {n.get('publication-date','')[:10]} | {str(b)[:60]} | {str(t)[:110]} | Frist {n.get('deadline-receipt-tender-date-lot')} | {n.get('publication-number')}")


def probe_oev():
    print("\n===== oeffentlichevergabe.de")
    for path in ["/robots.txt", "/api", "/api/notice-exports?pubDay=" + (date.today() - timedelta(days=2)).isoformat() + "&format=ocds.zip", "/documentation", "/api-docs", "/swagger-ui/index.html", "/v3/api-docs"]:
        status, headers, body = get("https://oeffentlichevergabe.de" + path)
        ctype = headers.get("Content-Type", headers.get("content-type", ""))
        print(f"--- {path}: HTTP {status} {ctype} {len(body)} Bytes")
        if "zip" not in ctype and "octet" not in ctype:
            print(body[:800].decode(errors="replace"))


if __name__ == "__main__":
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    for name, codes in PROFILES.items():
        ted(name, codes, days)
    print("\n".join(["", "ZUSAMMENFASSUNG"] + SUMMARY))
