"""Tenders from other European countries via the TED Search API v3 (EU Publications Office).

Reuse: TED legal notice (checked 30.10.2026): notices "können zu kommerziellen oder nichtkommerziellen Zwecken
frei weiterverwendet werden"; metadata CC0; the API needs no key. German notices come from the
Bekanntmachungsservice, so Germany is never fetched here.
Returns releases in the same OCDS-like shape as the German source, so scoring and storage stay the same.
Usage (test): python3 alarm/ted.py YYYY-MM-DD AUT,NLD
"""
import json
import re
import sys
import urllib.request

API = "https://api.ted.europa.eu/v3/notices/search"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "content-type": "application/json"}
FELDER = ["publication-number", "publication-date", "notice-type", "notice-title", "buyer-name", "buyer-country",
          "classification-cpv", "deadline-receipt-tender-date-lot", "place-of-performance", "description-proc", "links"]
# Contract notices only (no awards, no prior information).
ARTEN = "(cn-standard cn-social cn-desg subco)"
SEITE = 250
MAX_SEITEN = 20

# EU/EEA countries TED covers (ISO 3166-1 alpha-3) with German names for the search profile.
LAENDER = {
    "DEU": "Deutschland", "AUT": "Österreich", "BEL": "Belgien", "BGR": "Bulgarien", "HRV": "Kroatien", "CYP": "Zypern",
    "CZE": "Tschechien", "DNK": "Dänemark", "EST": "Estland", "FIN": "Finnland", "FRA": "Frankreich", "GRC": "Griechenland",
    "HUN": "Ungarn", "IRL": "Irland", "ITA": "Italien", "LVA": "Lettland", "LTU": "Litauen", "LUX": "Luxemburg",
    "MLT": "Malta", "NLD": "Niederlande", "POL": "Polen", "PRT": "Portugal", "ROU": "Rumänien", "SVK": "Slowakei",
    "SVN": "Slowenien", "ESP": "Spanien", "SWE": "Schweden", "NOR": "Norwegen", "ISL": "Island", "LIE": "Liechtenstein",
    "CHE": "Schweiz",
}


def _text(wert, sprachen=("deu", "eng")) -> str:
    """TED returns multilingual fields as {"deu": [...], "eng": [...], ...} or plain lists/strings."""
    if isinstance(wert, dict):
        for s in sprachen:
            if wert.get(s):
                return _text(wert[s])
        return _text(next(iter(wert.values()), ""))
    if isinstance(wert, list):
        return " ".join(_text(w) for w in wert if w)
    return str(wert or "").strip()


def _liste(wert) -> list[str]:
    if isinstance(wert, list):
        return [str(w) for w in wert if w]
    return [str(wert)] if wert else []


def suchen(tag: str, laender: list[str]) -> list[dict]:
    laender = sorted({l for l in laender if l in LAENDER and l != "DEU"})
    if not laender:
        return []
    query = f"publication-date={tag.replace('-', '')} AND buyer-country IN ({' '.join(laender)}) AND notice-type IN {ARTEN}"
    notices, seite = [], 1
    while seite <= MAX_SEITEN:
        body = json.dumps({"query": query, "fields": FELDER, "limit": SEITE, "page": seite, "scope": "ALL", "paginationMode": "PAGE_NUMBER"}).encode()
        req = urllib.request.Request(API, data=body, headers=UA, method="POST")
        with urllib.request.urlopen(req, timeout=120) as r:
            daten = json.loads(r.read())
        neu = daten.get("notices") or []
        notices += neu
        if len(neu) < SEITE:
            break
        seite += 1
    return notices


def _frist(wert: str) -> str:
    """'2026-11-26+01:00' (date with offset) -> ISO timestamp at the end of that day; full timestamps stay."""
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})?", wert)
    return f"{m.group(1)}T23:59:00{m.group(2) or '+01:00'}".replace("Z", "+00:00") if m else wert


def als_release(n: dict) -> dict:
    """TED notice -> OCDS-like release as used by alarm.py (title, description, CPV, deadline, link, buyer, country)."""
    nummer = _text(n.get("publication-number"))
    html = (n.get("links") or {}).get("html") or {}
    url = (html.get("DEU") or html.get("ENG") or next(iter(html.values()), "")) if isinstance(html, dict) else _text(html)
    url = url or f"https://ted.europa.eu/de/notice/-/detail/{nummer}"
    orte = list(dict.fromkeys(_liste(n.get("place-of-performance"))))
    land = next((l for l in _liste(n.get("buyer-country")) + orte if l in LAENDER), "")
    ort = ", ".join(LAENDER.get(o, o) for o in orte)
    fristen = sorted(_frist(f) for f in _liste(n.get("deadline-receipt-tender-date-lot")))
    cpv = list(dict.fromkeys(_liste(n.get("classification-cpv"))))
    return {
        "ocid": f"ted-{nummer}",
        "id": f"ted-{nummer}",
        "date": _text(n.get("publication-date"))[:10],
        "tag": ["tender"],
        "tender": {
            "title": _text(n.get("notice-title")),
            "description": _text(n.get("description-proc"))[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in cpv] + ([{"deliveryLocation": {"description": ort}}] if ort else []),
            "tenderPeriod": {"endDate": fristen[-1]} if fristen else {},
            "documents": [{"url": url}],
        },
        "buyer": {"name": _text(n.get("buyer-name")), "address": {"countryName": LAENDER.get(land, land)}},
        "_land": land,
        "_quelle": "TED",
    }


def releases(tag: str, laender: list[str]) -> list[dict]:
    try:
        return [als_release(n) for n in suchen(tag, laender)]
    except Exception as e:  # noqa: BLE001 – a TED outage must not stop the German alarm
        print(f"TED nicht erreichbar ({tag}): {e}")
        return []


if __name__ == "__main__":
    tag, laender = sys.argv[1], sys.argv[2].split(",")
    roh = suchen(tag, laender)
    print(f"{len(roh)} Bekanntmachungen")
    if roh:
        print(json.dumps(roh[0], ensure_ascii=False, indent=1)[:4000])
        for n in roh[:5]:
            print(json.dumps(als_release(n), ensure_ascii=False)[:800])
