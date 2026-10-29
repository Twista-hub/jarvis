"""Which portals host the documents of recent notices? Counts the host of tender.documents[].url.
Usage: python3 alarm/portale.py [tage]"""
import sys
import urllib.parse
from collections import Counter
from datetime import date, timedelta

from alarm import fetch, releases

tage = int(sys.argv[1]) if len(sys.argv) > 1 else 7
hosts, total = Counter(), 0
for n in range(1, tage + 1):
    day = (date.today() - timedelta(days=n)).isoformat()
    try:
        blob = fetch(day)
    except Exception as e:  # noqa: BLE001
        print(day, "Fehler", e)
        continue
    for _, rel in releases(blob):
        if "tender" not in (rel.get("tag") or []):
            continue
        total += 1
        docs = [d.get("url") for d in (rel.get("tender") or {}).get("documents") or [] if d.get("url")]
        hosts[urllib.parse.urlparse(docs[0]).netloc.lower() if docs else "(kein Link)"] += 1
print(f"{total} Ausschreibungen in {tage} Tagen")
for host, n in hosts.most_common(40):
    print(f"{n:6d} {100 * n / total:5.1f} %  {host}")
