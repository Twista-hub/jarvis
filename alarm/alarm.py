"""Daily tender alarm: reads the German Bekanntmachungsservice export and writes a report.

Source: https://oeffentlichevergabe.de/api/notice-exports?pubDay=YYYY-MM-DD&format=ocds.zip
(all German notices, above and below EU thresholds; licence stated in every file).
Usage: python3 alarm/alarm.py [YYYY-MM-DD ...]   (default: yesterday)
Writes alarm/berichte/<date>.md and prints it.
With ANTHROPIC_API_KEY set, Claude scores the hits and writes Steckbriefe for the best ones
(alarm/steckbriefe/), at most MAX_STECKBRIEFE per run.
"""
import io
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; contact@restockhero.eu)"}
# Portals whose terms and robots.txt allow downloading the public documents (checked by hand).
PORTALE = {"www.dtvp.de"}
MAX_STECKBRIEFE = int(os.environ.get("MAX_STECKBRIEFE", "2"))
STECKBRIEF_AB = 7


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


def item(nr: int, rel: dict) -> dict:
    t = rel.get("tender") or {}
    return {"nr": nr, "titel": t.get("title", "").strip(), "auftraggeber": (rel.get("buyer") or {}).get("name", ""),
            "ort": place(rel), "beschreibung": re.sub(r"\s+", " ", t.get("description", ""))[:1500], "cpv": cpv_codes(t)}


def steckbrief_fuer(ki, name: str, profile: dict, day: str, rel: dict, url: str) -> Path | None:
    """Download the documents (allowed portals only), let Claude write the Steckbrief, save it."""
    if urllib.parse.urlparse(url).netloc not in PORTALE:
        return None
    t = rel.get("tender") or {}
    slug = re.sub(r"[^a-z0-9]+", "-", t.get("title", "").lower())[:50].strip("-")
    out = ROOT / "steckbriefe" / f"{day}-{name}-{slug}.md"
    if out.exists():
        return out
    from texte import bundle
    from unterlagen import download
    with tempfile.TemporaryDirectory() as tmp:
        files = download(url, Path(tmp), verbose=False)
        dokumente, skipped = bundle(files)
        if not dokumente.strip():
            return None
        kopf = json.dumps(item(0, rel) | {"link": url, "veroeffentlicht": day}, ensure_ascii=False)
        text = ki.steckbrief(profile["beschreibung"], kopf, dokumente)
    if not text:
        return None
    note = f"\n\n---\n_Automatisch erstellt von Jarvis am {date.today().isoformat()} aus {len(files)} Dateien"
    note += f" (nicht gelesen: {', '.join(skipped)})" if skipped else ""
    out.parent.mkdir(exist_ok=True)
    out.write_text(text + note + f". Quelle: [{url}]({url}). Ohne Gewähr, bitte vor dem Angebot die Originalunterlagen prüfen._\n", encoding="utf-8")
    return out


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
    ki = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import ki
    lines = [f"# Ausschreibungs-Alarm {', '.join(days)}", "",
             f"{total} neue Ausschreibungen geprüft. Quelle: Bekanntmachungsservice (oeffentlichevergabe.de), Lizenz: {licence or 'siehe Datei'}.", ""]
    briefe = 0
    for name, profile in profiles.items():
        rows = sorted(hits[name], key=lambda h: -h[0])[:40]
        bewertung = ki.score(profile["beschreibung"], [item(i, rel) for i, (_, _, rel, _) in enumerate(rows)]) if ki and rows else {}
        if bewertung:
            rows = [(bewertung.get(i, {}), *r) for i, r in enumerate(rows)]
            rows.sort(key=lambda r: (-r[0].get("punkte", 0), -r[1]))
            weg = [r for r in rows if r[0].get("punkte", 0) < 4]
            rows = [r for r in rows if r[0].get("punkte", 0) >= 4]
        else:
            rows, weg = [({}, *r) for r in rows], []
        lines += [f"## {profile['name']}: {len(rows)} Treffer", ""]
        for b, points, day, rel, reason in rows:
            t = rel.get("tender") or {}
            url = link(rel)
            if b:
                head = f"### {b['punkte']}/10 {t.get('title', '').strip()}"
                desc = f"**{b['kurz']}** {b['grund']}"
            else:
                head = f"### {'★' * min(points, 5)} {t.get('title', '').strip()}"
                desc = re.sub(r"\s+", " ", t.get("description", ""))[:240]
            lines += [head, f"{(rel.get('buyer') or {}).get('name', '')} · {place(rel)} · veröffentlicht {day} · {reason}",
                      "", desc, ""]
            links = f"[Zur Ausschreibung]({url})"
            if b.get("punkte", 0) >= STECKBRIEF_AB and briefe < MAX_STECKBRIEFE:
                pfad = steckbrief_fuer(ki, name, profile, day, rel, url)
                if pfad:
                    briefe += 1
                    links += f" · [📄 Steckbrief](../steckbriefe/{pfad.name})"
            lines += [links, ""]
        if weg:
            lines += [f"_{len(weg)} weitere Treffer passen laut KI nicht (unter 4/10)._", ""]
        if not rows:
            lines += ["Heute nichts Passendes.", ""]
    if ki:
        lines += [f"_KI-Kosten dieses Laufs: {ki.kosten():.2f} $_", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    days = sys.argv[1:] or [(date.today() - timedelta(days=1)).isoformat()]
    report = run(days)
    out = ROOT / "berichte" / f"{days[-1]}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(report)
