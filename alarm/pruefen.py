"""Check data sources: robots.txt and the key sentences of terms pages.
Usage: python3 alarm/pruefen.py <url> [<url> ...]"""
import html
import re
import sys
import urllib.parse
import urllib.request

UA = "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"
KEY = re.compile(r"automat|crawl|robot|scrap|systemat|auslesen|abruf|weiterverwend|weiterverwert|re-?use|reuse|commercial|kommerz|"
                 r"gewerbl|lizenz|licen[cs]e|cc[ -]?by|cc0|datenlizenz|open data|urheber|copyright|vervielf|api|schnittstelle|rss|export", re.I)


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode(errors="replace")


for url in sys.argv[1:]:
    print("=" * 100, "\n", url)
    base = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
    try:
        robots = get(base + "/robots.txt")
        print("--- robots.txt (Auszug)\n" + "\n".join(robots.splitlines()[:40]))
    except Exception as e:  # noqa: BLE001
        print("--- robots.txt:", e)
    try:
        page = get(url)
    except Exception as e:  # noqa: BLE001
        print("--- Seite:", e)
        continue
    text = re.sub(r"(?is)<(script|style|nav|header|footer).*?</\1>", " ", page)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", text))
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    print(f"--- Seite ({len(lines)} Zeilen), Treffer:")
    shown = set()
    for i, line in enumerate(lines):
        if KEY.search(line):
            for j in range(max(0, i - 1), min(len(lines), i + 2)):
                if j not in shown:
                    print(lines[j][:600])
                    shown.add(j)
            print("  …")
    links = sorted(set(re.findall(r'href="([^"]*(?:nutzung|agb|impressum|bedingung|terms|legal|lizenz|licen|open-?data|api|rss)[^"]*)"', page, re.I)))
    print("--- Links:", "\n".join(urllib.parse.urljoin(url, l) for l in links[:30]))
