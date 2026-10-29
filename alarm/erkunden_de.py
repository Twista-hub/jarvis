"""Exploration of the German Bekanntmachungsservice daily OCDS exports (all thresholds).

Downloads https://oeffentlichevergabe.de/api/notice-exports?pubDay=YYYY-MM-DD&format=ocds.zip
for the last N days, keeps open tenders and matches them against two profiles
by CPV code and keywords. Read-only, public data.
"""
import io
import json
import re
import sys
import time
import urllib.request
import zipfile
from collections import Counter
from datetime import date, timedelta

UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"}

PROFILES = {
    "perlease": {
        "cpv": ("7962", "79952", "79956", "79992", "5552", "553", "5541", "79953", "79954"),
        "words": r"servicepersonal|messepersonal|hostess|garderobe|einlass|eventpersonal|veranstaltungsservice|personalgestellung|bewirtung|catering|servicekr(ä|ae)fte|thekenpersonal|bankett",
    },
    "wpdr": {
        "cpv": ("72413", "7242", "72212224", "72415", "79822500", "72267"),
        "words": r"webseite|website|internetauftritt|internetseite|homepage|barrierefrei|bitv|relaunch|wordpress|typo3|progressive web app|\bpwa\b|onlineportal",
    },
}


def fetch(day):
    url = f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={day.isoformat()}&format=ocds.zip"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def releases(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for name in z.namelist():
            if not name.endswith(".json"):
                continue
            data = json.loads(z.read(name))
            for rel in data.get("releases", []) if isinstance(data, dict) else []:
                yield rel


def cpvs(rel):
    t = rel.get("tender", {})
    codes = []
    for item in t.get("items", []) or []:
        for c in [item.get("classification")] + (item.get("additionalClassifications") or []):
            if c and str(c.get("scheme", "")).upper() == "CPV":
                codes.append(str(c.get("id", "")))
    return codes


def place(rel):
    for p in rel.get("parties", []) or []:
        if "buyer" in (p.get("roles") or []):
            a = p.get("address") or {}
            return f"{a.get('postalCode','')} {a.get('locality','')}".strip()
    return ""


def main(days):
    hits = {k: [] for k in PROFILES}
    tags = Counter()
    total = 0
    for i in range(1, days + 1):
        day = date.today() - timedelta(days=i)
        try:
            blob = fetch(day)
        except Exception as e:  # noqa: BLE001
            print(f"{day}: Fehler {e}")
            continue
        n = 0
        for rel in releases(blob):
            n += 1
            for tag in rel.get("tag", []) or []:
                tags[tag] += 1
            if "tender" not in (rel.get("tag") or []):
                continue
            t = rel.get("tender", {})
            text = f"{t.get('title','')} {t.get('description','')}".lower()
            codes = cpvs(rel)
            for name, prof in PROFILES.items():
                by_cpv = any(c.startswith(prof["cpv"]) for c in codes)
                by_word = re.search(prof["words"], text) is not None
                if by_cpv or by_word:
                    hits[name].append((str(day), (rel.get("buyer") or {}).get("name", ""), place(rel), t.get("title", ""), (t.get("tenderPeriod") or {}).get("endDate", ""), "cpv" if by_cpv else "wort", ",".join(codes[:3])))
        total += n
        print(f"{day}: {n} Meldungen, {len(blob)//1024} KB")
        time.sleep(1)
    print(f"\nGesamt {total} Meldungen in {days} Tagen. Tags: {dict(tags)}")
    for name, rows in hits.items():
        print(f"\n===== {name}: {len(rows)} offene Ausschreibungen")
        for r in rows[:60]:
            print(f"- {r[0]} | {r[1][:50]} | {r[2][:30]} | {r[3][:110]} | Frist {r[4][:10]} | {r[5]} {r[6]}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
