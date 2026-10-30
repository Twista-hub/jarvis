"""Tenders from the United Kingdom via Find a Tender (all UK public procurement notices).

Find a Tender publishes OCDS releases, the same format as the German Bekanntmachungsservice, so the releases go
straight into alarm.py; only the country (_land = "GBR") and the source are added. Notice data is under the
Open Government Licence v3 (checked 30.10.2026, alarm/quellen.md): reuse allowed with attribution.
Contracts Finder (England, small contracts) is not used yet: its terms page could not be read.
Usage (test): python3 alarm/uk.py YYYY-MM-DD
"""
import json
import sys
import urllib.parse
import urllib.request

UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "Accept": "application/json"}
FTS = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages"
MAX_SEITEN = 20


def _get(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return json.loads(r.read())


def find_a_tender(tag: str) -> list[dict]:
    url = f"{FTS}?{urllib.parse.urlencode({'stages': 'tender', 'updatedFrom': f'{tag}T00:00:00', 'updatedTo': f'{tag}T23:59:59', 'limit': 100})}"
    out = []
    for _ in range(MAX_SEITEN):
        daten = _get(url)
        out += daten.get("releases") or []
        url = (daten.get("links") or {}).get("next")
        if not url:
            break
    return out


def releases(tag: str) -> list[dict]:
    """Open tender notices of one day, tagged with the country; duplicates by OCID removed."""
    gesehen, out = set(), []
    for name, holen in (("Find a Tender", find_a_tender),):
        try:
            for rel in holen(tag):
                key = rel.get("ocid") or rel.get("id")
                if key in gesehen or not any(str(t).startswith("tender") for t in rel.get("tag") or []):
                    continue
                gesehen.add(key)
                out.append(dict(rel, _land="GBR", _quelle=name))
        except Exception as e:  # noqa: BLE001 – a UK outage must not stop the German alarm
            print(f"{name} nicht erreichbar ({tag}): {e}")
    return out


if __name__ == "__main__":
    for name, holen in (("Find a Tender", find_a_tender),):
        try:
            r = holen(sys.argv[1])
            print(f"{name}: {len(r)} Releases")
            for rel in r[:3]:
                t = rel.get("tender") or {}
                print(" -", rel.get("ocid"), rel.get("tag"), "|", t.get("title"), "|", (t.get("tenderPeriod") or {}).get("endDate"), "|", (rel.get("buyer") or {}).get("name"))
        except Exception as e:  # noqa: BLE001
            print(f"{name}: Fehler {e}")
