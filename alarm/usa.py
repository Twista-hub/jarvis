"""US federal tenders via the SAM.gov Get Opportunities API (v2).

Needs the free public API key of a SAM.gov account in the secret SAM_API_KEY (Benjamin requests it himself,
docs/anleitung-sam-gov.md). Without the key nothing is fetched. One request per day with up to 1,000 notices,
so even the small daily quota of a personal key is enough. Only federal agencies: states, counties and cities
run their own portals and are not included.
Releases are converted to the OCDS-like shape alarm.py expects.
Usage (test): python3 alarm/usa.py YYYY-MM-DD
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date

API = "https://api.sam.gov/opportunities/v2/search"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "Accept": "application/json"}
# o = solicitation, k = combined synopsis/solicitation (open calls for offers); no award notices.
ARTEN = "o,k"


def _us_datum(tag: str) -> str:
    return date.fromisoformat(tag).strftime("%m/%d/%Y")


def suchen(tag: str) -> list[dict]:
    schluessel = os.environ.get("SAM_API_KEY", "").strip()
    if not schluessel:
        return []
    url = f"{API}?{urllib.parse.urlencode({'api_key': schluessel, 'postedFrom': _us_datum(tag), 'postedTo': _us_datum(tag), 'ptype': ARTEN, 'limit': 1000, 'offset': 0})}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return json.loads(r.read()).get("opportunitiesData") or []


def als_release(n: dict) -> dict:
    ort = n.get("placeOfPerformance") or {}
    stadt = ((ort.get("city") or {}).get("name") or "").strip()
    staat = ((ort.get("state") or {}).get("code") or "").strip()
    frist = (n.get("responseDeadLine") or "").strip()
    link = n.get("uiLink") or f"https://sam.gov/opp/{n.get('noticeId', '')}/view"
    behoerde = (n.get("fullParentPathName") or "").replace(".", " › ")
    return {
        "ocid": f"sam-{n.get('noticeId', '')}",
        "id": f"sam-{n.get('noticeId', '')}",
        "date": (n.get("postedDate") or "")[:10],
        "tag": ["tender"],
        "tender": {
            "title": (n.get("title") or "").strip(),
            # The full description is a separate, key-protected link; title, codes and agency are enough to score.
            "description": " · ".join(filter(None, [n.get("type"), f"NAICS {n['naicsCode']}" if n.get("naicsCode") else "", f"PSC {n['classificationCode']}" if n.get("classificationCode") else "", n.get("solicitationNumber")])),
            "items": [{"deliveryLocation": {"description": ", ".join(filter(None, [stadt, staat, "USA"]))}}],
            "tenderPeriod": {"endDate": frist} if frist else {},
            "documents": [{"url": link}],
        },
        "buyer": {"name": behoerde or "US-Bundesbehörde", "address": {"countryName": "USA"}},
        "_land": "USA",
        "_quelle": "SAM.gov",
    }


def releases(tag: str) -> list[dict]:
    try:
        return [als_release(n) for n in suchen(tag) if str(n.get("active", "Yes")).lower() == "yes"]
    except Exception as e:  # noqa: BLE001 – a SAM.gov outage must not stop the German alarm
        print(f"SAM.gov nicht erreichbar ({tag}): {e}")
        return []


if __name__ == "__main__":
    if not os.environ.get("SAM_API_KEY"):
        sys.exit("SAM_API_KEY fehlt (siehe docs/anleitung-sam-gov.md).")
    roh = suchen(sys.argv[1])
    print(f"{len(roh)} Ausschreibungen")
    for n in roh[:5]:
        print(json.dumps(als_release(n), ensure_ascii=False)[:600])
