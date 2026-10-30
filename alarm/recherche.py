"""Research a company: public web pages (only where robots.txt allows) and EU award notices on TED.

Usage: python3 alarm/recherche.py "<search term>" <url> [<url> ...]
TED: official search API (https://api.ted.europa.eu), full-text search for the term.
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser

UA = "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"


def get(url: str, data: bytes | None = None, headers: dict | None = None) -> str:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode(errors="replace")


def erlaubt(url: str) -> bool:
    parts = urllib.parse.urlparse(url)
    rp = urllib.robotparser.RobotFileParser(f"{parts.scheme}://{parts.netloc}/robots.txt")
    try:
        rp.read()
    except Exception:  # noqa: BLE001
        return False
    return rp.can_fetch(UA, url)


def text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", page)
    links = sorted(set(re.findall(r'href="(https?://[^"]+|/[^"]*)"', page)))
    body = html.unescape(re.sub(r"<[^>]+>", "\n", page))
    body = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", body)).strip()
    return body[:12000] + "\n--- Links:\n" + "\n".join(links[:120])


def ted(begriff: str) -> None:
    print("=" * 100, f"\nTED-Suche: {begriff}")
    body = json.dumps({
        "query": f'FT ~ "{begriff}"',
        "fields": ["publication-number", "notice-type", "publication-date", "notice-title", "buyer-name", "buyer-city"],
        "limit": 100,
        "scope": "ALL",
        "paginationMode": "PAGE_NUMBER",
    }).encode()
    try:
        res = json.loads(get("https://api.ted.europa.eu/v3/notices/search", body, {"Content-Type": "application/json"}))
    except Exception as e:  # noqa: BLE001
        print("TED-Fehler:", getattr(e, "read", lambda: b"")().decode(errors="replace")[:2000] or e)
        return
    print("Treffer:", res.get("totalNoticeCount"))
    for n in res.get("notices", []):
        def eins(feld):
            v = n.get(feld)
            if isinstance(v, dict):
                v = v.get("deu") or v.get("eng") or next(iter(v.values()), "")
            if isinstance(v, list):
                v = v[0] if v else ""
            return str(v)
        print(f"{eins('publication-date')[:10]} | {eins('notice-type')} | {eins('publication-number')} | {eins('buyer-name')} ({eins('buyer-city')}) | {eins('notice-title')[:150]}")
        print(f"   https://ted.europa.eu/de/notice/-/detail/{eins('publication-number')}")


if __name__ == "__main__":
    ted(sys.argv[1])
    for url in sys.argv[2:]:
        print("=" * 100, "\n", url)
        if not erlaubt(url):
            print("robots.txt erlaubt den Abruf nicht (oder ist nicht lesbar), übersprungen.")
            continue
        try:
            print(text(get(url)))
        except Exception as e:  # noqa: BLE001
            print("Fehler:", e)
