"""New funding programmes from the Förderdatenbank des Bundes (RSS) for the morning report.

Licence: texts CC BY-ND 4.0 DE (Namensnennung, keine Bearbeitung). So the report shows only the
original title, the link and our own assessment; descriptions are used for scoring only.
robots.txt allows the feed (Crawl-delay 30); we fetch it once per run.
Usage: python3 alarm/foerder.py   (prints the parsed feed)
"""
import email.utils
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

FEED = "https://www.foerderdatenbank.de/FDB/DE/Service/RSS/Functions/foerderprogram_rssnewsfeed.xml"
QUELLE = "Quelle: [Förderdatenbank des Bundes](https://www.foerderdatenbank.de), Lizenz CC BY-ND 4.0 DE. Einschätzung: Jarvis."
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"}


def fetch() -> bytes:
    with urllib.request.urlopen(urllib.request.Request(FEED, headers=UA), timeout=60) as r:
        return r.read()


def parse(blob: bytes) -> list[dict]:
    """RSS 2.0 items -> [{titel, link, tag (YYYY-MM-DD or ''), text}]"""
    out = []
    for it in ET.fromstring(blob).iter("item"):
        def get(name: str) -> str:
            return (it.findtext(name) or "").strip()
        tag = ""
        if get("pubDate"):
            try:
                tag = email.utils.parsedate_to_datetime(get("pubDate")).date().isoformat()
            except (TypeError, ValueError):
                pass
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", get("description"))).strip()
        if get("title") and get("link"):
            out.append({"titel": get("title"), "link": get("link"), "tag": tag, "text": text})
    return out


def neue(items: list[dict], days: list[str]) -> list[dict]:
    """Programmes published on the report days; with no dates in the feed, all of them."""
    if not any(i["tag"] for i in items):
        return items
    return [i for i in items if i["tag"] in days]


def abschnitt(profiles: dict, ki, days: list[str]) -> list[str]:
    try:
        items = neue(parse(fetch()), days)
    except Exception as e:  # the tender report must not fail because of this feed
        return ["## Förderprogramme", "", f"_Förderdatenbank nicht erreichbar ({type(e).__name__})._", ""]
    lines = ["## Förderprogramme", ""]
    if not items:
        return lines + ["Keine neuen Förderprogramme.", "", f"_{QUELLE}_", ""]
    if not ki:
        lines += [f"- [{i['titel']}]({i['link']})" for i in items[:30]]
        return lines + ["", f"_{QUELLE}_", ""]
    liste = [{"nr": n, "titel": i["titel"], "beschreibung": i["text"][:1500]} for n, i in enumerate(items[:60])]
    for name, profile in profiles.items():
        bewertung = ki.foerder_score(profile["beschreibung"], liste)
        passend = sorted((b for b in bewertung.values() if b.get("punkte", 0) >= 6), key=lambda b: -b["punkte"])
        lines += [f"### Für {profile['name']}", ""]
        for b in passend[:5]:
            i = items[b["nr"]]
            lines += [f"- **{b['punkte']}/10** [{i['titel']}]({i['link']}): {b['grund']}"]
        lines += [""] if passend else ["Nichts Passendes.", ""]
    return lines + [f"_{len(items)} neue Programme geprüft. {QUELLE}_", ""]


if __name__ == "__main__":
    blob = fetch()
    print(blob[:1500].decode("utf-8", "replace"))
    items = parse(blob)
    print(f"\n{len(items)} Einträge")
    for i in items[:15]:
        print(i["tag"], "|", i["titel"], "|", i["link"], "|", i["text"][:120])
    sys.exit(0 if items else 1)
