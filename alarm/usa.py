"""US federal tenders via the SAM.gov Get Opportunities API (v2).

Needs the free public API key of a SAM.gov account in the secret SAM_API_KEY (Benjamin requests it himself,
docs/anleitung-sam-gov.md). Without the key nothing is fetched. It requests up to 1,000 notices per page and
follows the API's page-index offset for up to ten pages per requested date and twenty requests per process
run. Most dates use one request; the scheduled run normally requests one date, while first-run backfills and
manual multi-date runs may use more.
The API's daily request quota depends on the account role. Only federal agencies: states, counties and cities
run their own portals. Releases are converted to the OCDS-like shape alarm.py expects.
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
SEITE_GROESSE = 1000
MAX_SEITEN_PRO_DATUM = 10
MAX_API_AUFRUFE_PRO_LAUF = 20
_api_aufrufe = 0


class _KontingentGrenze(Exception):
    pass


def _us_datum(tag: str) -> str:
    return date.fromisoformat(tag).strftime("%m/%d/%Y")


def suchen(tag: str) -> list[dict]:
    schluessel = os.environ.get("SAM_API_KEY", "").strip()
    if not schluessel:
        return []

    def seite(offset: int) -> dict:
        global _api_aufrufe
        if _api_aufrufe >= MAX_API_AUFRUFE_PRO_LAUF:
            raise _KontingentGrenze
        _api_aufrufe += 1
        # The API defines offset as a page index, not a record offset.
        url = f"{API}?{urllib.parse.urlencode({'api_key': schluessel, 'postedFrom': _us_datum(tag), 'postedTo': _us_datum(tag), 'ptype': ARTEN, 'limit': SEITE_GROESSE, 'offset': offset})}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            return json.loads(r.read())

    try:
        erste = seite(0)
    except _KontingentGrenze:
        print(f"SAM.gov ({tag}): Laufgrenze bei {MAX_API_AUFRUFE_PRO_LAUF} API-Aufrufen erreicht; Datum nicht abgefragt.")
        return []
    resultate = erste.get("opportunitiesData") or []
    try:
        gesamt = max(int(erste.get("totalRecords", len(resultate))), len(resultate))
    except (TypeError, ValueError):
        gesamt = len(resultate)

    benoetigte_seiten = (gesamt + SEITE_GROESSE - 1) // SEITE_GROESSE
    seiten = min(benoetigte_seiten, MAX_SEITEN_PRO_DATUM)
    if benoetigte_seiten > MAX_SEITEN_PRO_DATUM:
        print(f"SAM.gov ({tag}): {gesamt} Treffer; Sicherheitsgrenze bei {MAX_SEITEN_PRO_DATUM} Seiten, Rest bleibt offen.")

    for offset in range(1, seiten):
        try:
            daten = seite(offset).get("opportunitiesData") or []
        except _KontingentGrenze:
            print(f"SAM.gov ({tag}): Laufgrenze bei {MAX_API_AUFRUFE_PRO_LAUF} API-Aufrufen erreicht; weitere Seiten ausgelassen.")
            break
        if not daten:
            print(f"SAM.gov ({tag}): Seite {offset + 1} leer; weitere Seiten nicht geladen.")
            break
        resultate.extend(daten)
    return resultate


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
        "_us": us_daten(n),
    }


# Set-aside codes of the Opportunities API (typeOfSetAside) → certification the bidder needs (see web/src/ampel.ts).
def us_daten(n: dict) -> dict:
    """Structured SAM.gov fields stored with the hit (vorgaenge.us) for the eligibility light and deadline tracker."""
    ort = n.get("placeOfPerformance") or {}
    kontakt = next((k for k in n.get("pointOfContact") or [] if k.get("type") == "primary"), (n.get("pointOfContact") or [None])[0]) or {}
    d = {
        "notice_id": n.get("noticeId") or "",
        "solicitation": n.get("solicitationNumber") or "",
        "art": n.get("type") or "",
        "naics": str(n.get("naicsCode") or ""),
        "psc": n.get("classificationCode") or "",
        "set_aside": n.get("typeOfSetAside") or "",
        "set_aside_text": n.get("typeOfSetAsideDescription") or "",
        "frist": (n.get("responseDeadLine") or "").strip(),
        "veroeffentlicht": n.get("postedDate") or "",
        "archiv": n.get("archiveDate") or "",
        "staat": ((ort.get("state") or {}).get("code") or ""),
        "stadt": ((ort.get("city") or {}).get("name") or ""),
        "plz": str(ort.get("zip") or ""),
        "kontakt": {k: str(kontakt.get(f) or "")[:200] for k, f in (("name", "fullName"), ("email", "email"), ("telefon", "phone"))} if kontakt else {},
    }
    return {k: (v[:300] if isinstance(v, str) else v) for k, v in d.items() if v}


def releases(tag: str) -> list[dict]:
    try:
        return [als_release(n) for n in suchen(tag) if str(n.get("active", "Yes")).lower() == "yes"]
    except Exception as e:  # noqa: BLE001 – never print the request URL; it contains the API key
        status = getattr(e, "code", None)
        fehler = f"HTTP {status}" if status else type(e).__name__
        print(f"SAM.gov nicht erreichbar ({tag}): {fehler}")
        return []


if __name__ == "__main__":
    if not os.environ.get("SAM_API_KEY"):
        sys.exit("SAM_API_KEY fehlt (siehe docs/anleitung-sam-gov.md).")
    roh = suchen(sys.argv[1])
    print(f"{len(roh)} Ausschreibungen")
    for n in roh[:5]:
        print(json.dumps(als_release(n), ensure_ascii=False)[:600])
