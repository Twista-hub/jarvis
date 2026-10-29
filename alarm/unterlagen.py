"""Test: download the public tender documents of one project page (e.g. DTVP), politely.

Prints robots.txt, follows download links found on the page (PDF/ZIP/DOCX) and saves
them under alarm/test-unterlagen/<name>/. One request at a time, 1 s pause.
Usage: python3 alarm/unterlagen.py <url> <name>
"""
import re
import sys
import time
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

UA = "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"
url, name = sys.argv[1], sys.argv[2]
out = Path(__file__).parent / "test-unterlagen" / name
out.mkdir(parents=True, exist_ok=True)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
opener.addheaders = [("User-Agent", UA)]

base = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
try:
    print("=== robots.txt\n" + opener.open(base + "/robots.txt", timeout=30).read().decode(errors="replace")[:3000])
except Exception as e:  # noqa: BLE001
    print("robots.txt:", e)

import urllib.robotparser
rp = urllib.robotparser.RobotFileParser(base + "/robots.txt")
try:
    rp.read()
except Exception:  # noqa: BLE001
    pass
if not rp.can_fetch(UA, url):
    print("ABBRUCH: robots.txt erlaubt diese Seite nicht.")
    sys.exit(0)

r = opener.open(url, timeout=60)
html = r.read().decode(errors="replace")
print("=== Seite", r.status, r.geturl(), len(html), "Zeichen")
(out / "seite.html").write_text(html, encoding="utf-8")
links = []
for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
    label = re.sub(r"<[^>]+>|\s+", " ", text).strip()
    full = urllib.parse.urljoin(r.geturl(), href.replace("&amp;", "&"))
    if re.search(r"\.(pdf|zip|docx?|xlsx?)\b|download|document|IBehaviorListener|ILinkListener", full + " " + label, re.I):
        links.append((full, label))
print("=== Links", len(links))
for full, label in links[:80]:
    print("-", label[:80], "|", full[:160])

saved = 0
for full, label in links[:60]:
    if not rp.can_fetch(UA, full):
        print("robots.txt sperrt:", full[:120])
        continue
    time.sleep(1)
    try:
        resp = opener.open(full, timeout=120)
    except Exception as e:  # noqa: BLE001
        print("Fehler", label[:50], e)
        continue
    ctype = resp.headers.get("Content-Type", "")
    disp = resp.headers.get("Content-Disposition", "")
    if "html" in ctype:
        continue
    fname = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disp)
    fname = urllib.parse.unquote(fname.group(1)) if fname else (re.sub(r"[^\w.-]+", "_", label)[:60] or f"datei{saved}")
    data = resp.read()
    (out / fname).write_bytes(data)
    saved += 1
    print(f"gespeichert: {fname} ({len(data)//1024} KB, {ctype})")
print("Dateien gespeichert:", saved)
