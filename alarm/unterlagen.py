"""Download the public tender documents of one project page (e.g. DTVP), politely.

Respects robots.txt for every request, one request at a time with a pause.
CLI: python3 alarm/unterlagen.py <url> <name>  -> alarm/test-unterlagen/<name>/
"""
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from http.cookiejar import CookieJar
from pathlib import Path

UA = "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"


def download(url: str, out: Path, limit: int = 60, verbose: bool = True) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    opener.addheaders = [("User-Agent", UA)]
    base = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
    rp = urllib.robotparser.RobotFileParser(base + "/robots.txt")
    try:
        rp.read()
    except Exception:  # noqa: BLE001
        pass
    if not rp.can_fetch(UA, url):
        if verbose:
            print("ABBRUCH: robots.txt erlaubt diese Seite nicht.")
        return []
    r = opener.open(url, timeout=60)
    html = r.read().decode(errors="replace")
    links = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        label = re.sub(r"<[^>]+>|\s+", " ", text).strip()
        full = urllib.parse.urljoin(r.geturl(), href.replace("&amp;", "&"))
        if re.search(r"\.(pdf|zip|docx?|xlsx?)\b|download|document|IBehaviorListener|ILinkListener", full + " " + label, re.I):
            links.append((full, label))
    saved = []
    for full, label in links[:limit]:
        if not rp.can_fetch(UA, full):
            continue
        time.sleep(1)
        try:
            resp = opener.open(full, timeout=120)
        except Exception as e:  # noqa: BLE001
            if verbose:
                print("Fehler", label[:50], e)
            continue
        ctype = resp.headers.get("Content-Type", "")
        if "html" in ctype:
            continue
        disp = resp.headers.get("Content-Disposition", "")
        m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disp)
        fname = urllib.parse.unquote(m.group(1)) if m else (re.sub(r"[^\w.-]+", "_", label)[:60] or f"datei{len(saved)}")
        path = out / Path(fname).name
        path.write_bytes(resp.read())
        saved.append(path)
        if verbose:
            print(f"gespeichert: {path.name} ({path.stat().st_size // 1024} KB)")
    return saved


if __name__ == "__main__":
    files = download(sys.argv[1], Path(__file__).parent / "test-unterlagen" / sys.argv[2])
    print("Dateien gespeichert:", len(files))
