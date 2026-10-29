"""Daily tender alarm: reads the German Bekanntmachungsservice export and writes a report.

Source: https://oeffentlichevergabe.de/api/notice-exports?pubDay=YYYY-MM-DD&format=ocds.zip
(all German notices, above and below EU thresholds; licence stated in every file).
Usage: python3 alarm/alarm.py [YYYY-MM-DD ...]   (default: yesterday)
Writes alarm/berichte/<date>.md and prints it.
"""
import io
import json
import re
import sys
import urllib.request
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"}


def fetch(day: str) -> bytes:
    url = f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={day}&format=ocds.zip"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def releases(blob: bytes):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for name in z.namelist():
            if name.endswith(".json"):
                data = json.loads(z.read(name))
                for rel in data.get("releases", []) if isinstance(data, dict) else []:
                    yield data.get("license", ""), rel


def cpv_codes(tender: dict) -> list[str]:
    codes = []
    for item in tender.get("items") or []:
        for c in [item.get("classification")] + (item.get("additionalClassifications") or []):
            if c and str(c.get("scheme", "")).upper() == "CPV":
                codes.append(str(c.get("id", "")).split("-")[0])
    return codes


def score(profile: dict, text: str, codes: list[str]) -> tuple[int, str]:
    """0 = no match. Higher = better fit. Returns (score, reason)."""
    if re.search(profile["exclude"], text):
        return 0, ""
    excluded = codes and all(c.startswith(tuple(profile["exclude_cpv"])) for c in codes)
    by_cpv = [c for c in codes if c.startswith(tuple(profile["cpv"]))]
    for prefix, context in profile.get("cpv_needs_context", {}).items():
        by_cpv = [c for c in by_cpv if not c.startswith(prefix) or re.search(context, text)]
    word = re.search(profile["words"], text)
    if not by_cpv and (not word or excluded):
        return 0, ""
    points = (2 if by_cpv else 0) + (1 if word else 0) + (2 if re.search(profile["strong"], text) else 0)
    reason = ", ".join(filter(None, [f"CPV {by_cpv[0]}" if by_cpv else "", f"„{word.group(0)}“" if word else ""]))
    return points, reason


def link(rel: dict) -> str:
    for d in (rel.get("tender") or {}).get("documents") or []:
        if d.get("url"):
            return d["url"]
    return f"https://oeffentlichevergabe.de/ui/de/search?q={urllib.request.quote((rel.get('tender') or {}).get('title', '')[:80])}"


def place(rel: dict) -> str:
    a = (rel.get("buyer") or {}).get("address") or {}
    for item in (rel.get("tender") or {}).get("items") or []:
        loc = (item.get("deliveryLocation") or {}).get("description")
        if loc:
            return loc
    return f"{a.get('postalCode', '')} {a.get('locality', '')}".strip()


def run(days: list[str]) -> str:
    profiles = json.loads((ROOT / "profile.json").read_text(encoding="utf-8"))
    hits = {k: [] for k in profiles}
    seen, total, licence = set(), 0, ""
    for day in days:
        for licence, rel in releases(fetch(day)):
            if "tender" not in (rel.get("tag") or []):
                continue
            total += 1
            t = rel.get("tender") or {}
            key = (t.get("title", "").strip().lower(), (rel.get("buyer") or {}).get("name", ""))
            if key in seen:
                continue
            seen.add(key)
            text = f"{t.get('title', '')} {t.get('description', '')}".lower()
            codes = cpv_codes(t)
            for name, profile in profiles.items():
                points, reason = score(profile, text, codes)
                if points:
                    hits[name].append((points, day, rel, reason))
    lines = [f"# Ausschreibungs-Alarm {', '.join(days)}", "",
             f"{total} neue Ausschreibungen geprüft. Quelle: Bekanntmachungsservice (oeffentlichevergabe.de), Lizenz: {licence or 'siehe Datei'}.", ""]
    for name, profile in profiles.items():
        rows = sorted(hits[name], key=lambda h: -h[0])
        lines += [f"## {profile['name']}: {len(rows)} Treffer", ""]
        for points, day, rel, reason in rows[:40]:
            t = rel.get("tender") or {}
            stars = "★" * min(points, 5)
            desc = re.sub(r"\s+", " ", t.get("description", ""))[:240]
            lines += [f"### {stars} {t.get('title', '').strip()}",
                      f"{(rel.get('buyer') or {}).get('name', '')} · {place(rel)} · veröffentlicht {day} · {reason}",
                      "", desc, "", f"[Zur Ausschreibung]({link(rel)})", ""]
        if not rows:
            lines += ["Heute nichts Passendes.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    days = sys.argv[1:] or [(date.today() - timedelta(days=1)).isoformat()]
    report = run(days)
    out = ROOT / "berichte" / f"{days[-1]}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(report)
