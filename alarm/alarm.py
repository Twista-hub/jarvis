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
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
UPLOAD = "https://app.wpdigitalranger.com/"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"}
# Portals whose terms and robots.txt allow downloading the documents for our service (checked by hand).
# Not DTVP: its AGB (29.10.2026) forbid systematic downloads of notices and documents for commercial offers.
PORTALE: set[str] = set()
MAX_STECKBRIEFE = int(os.environ.get("MAX_STECKBRIEFE", "2"))
STECKBRIEF_AB = 7
FIRMA = os.environ.get("FIRMA", "") if re.fullmatch(r"[0-9a-f-]{36}", os.environ.get("FIRMA", "")) else ""


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


def frist(tender: dict) -> str | None:
    """Whole procedure deadline; otherwise the last lot deadline. Individual lots remain separate."""
    ende = (tender.get("tenderPeriod") or {}).get("endDate")
    lose = [(l.get("tenderPeriod") or {}).get("endDate") for l in tender.get("lots") or []]
    return max(filter(None, [ende, *lose]), default=None)


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


def plz(rel: dict) -> str:
    """German postal code of the place of performance, else of the buyer ('' if none)."""
    orte = [i.get("deliveryAddress") or {} for i in (rel.get("tender") or {}).get("items") or []]
    orte += [(rel.get("buyer") or {}).get("address") or {}] + [p.get("address") or {} for p in rel.get("parties") or [] if "buyer" in (p.get("roles") or [])]
    for o in orte:
        m = re.search(r"\b(\d{5})\b", f"{o.get('postalCode', '')} {o.get('locality', '')} {o.get('streetAddress', '')}")
        if m:
            return m.group(1)
    return ""


def item(nr: int, rel: dict) -> dict:
    t = rel.get("tender") or {}
    return {"nr": nr, "titel": t.get("title", "").strip(), "auftraggeber": (rel.get("buyer") or {}).get("name", ""),
            "ort": place(rel), "beschreibung": re.sub(r"\s+", " ", t.get("description", ""))[:1500], "cpv": cpv_codes(t)}


def eforms_text(rel: dict) -> str:
    """The full notice (eForms XML, same CC0 source) as 'field: value' lines: selection criteria,
    award criteria, deadlines and lots that the OCDS export leaves out. '' if not available."""
    # The notice id is the UUID inside the OCID (ocds-<prefix>-<uuid>); the release id may carry a version suffix.
    kandidaten = [m.group(0) for f in (rel.get("ocid", ""), rel.get("id", ""))
                  if (m := re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", str(f)))]
    root, fehler = None, ""
    for notice_id in dict.fromkeys(kandidaten):
        for version in ("", "&noticeVersion=1"):
            url = f"https://oeffentlichevergabe.de/api/notices/{notice_id}?format=eforms{version}"
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                    root = ET.fromstring(r.read())
                break
            except Exception as e:  # noqa: BLE001
                fehler = f"{url}: {e}"
        if root is not None:
            break
    if root is None:
        print(f"eForms nicht geladen ({fehler or 'keine Bekanntmachungs-ID'})", file=sys.stderr)
        return ""
    zeilen, pfad = [], []

    def lauf(el):
        name = el.tag.split("}")[-1]
        pfad.append(name)
        text = (el.text or "").strip()
        if text and not len(el):
            zeilen.append(f"{'/'.join(pfad[-3:])}: {text}")
        for kind in el:
            lauf(kind)
        pfad.pop()

    lauf(root)
    print(f"eForms geladen: {len(zeilen)} Felder", file=sys.stderr)
    return "\n".join(z for z in zeilen if "UBLExtension" not in z)[:50000]


def kurzbrief(rel: dict, day: str) -> str:
    """Always retain the notice facts, even when the AI budget is exhausted."""
    t = rel.get("tender") or {}
    beschreibung = re.sub(r"\s+", " ", t.get("description") or "").strip()
    return (f"## Kurzüberblick\n\n{t.get('title', '').strip()}\n\n"
            f"**Auftraggeber:** {(rel.get('buyer') or {}).get('name') or 'nicht angegeben'}\n\n"
            f"**Ort:** {place(rel) or 'nicht angegeben'}\n\n"
            f"**Veröffentlicht:** {day}\n\n"
            + (f"**Land:** {(rel.get('buyer') or {}).get('address', {}).get('countryName', '')} · Quelle: TED (Amt für Veröffentlichungen der EU)\n\n" if rel.get("_quelle") == "TED" else "")
            + ("**Land:** Großbritannien · Quelle: Find a Tender. Contains public sector information licensed under the Open Government Licence v3.0.\n\n" if rel.get("_quelle") == "Find a Tender" else "")
            + ("**Land:** USA (Bundesbehörde) · Quelle: SAM.gov\n\n" if rel.get("_quelle") == "SAM.gov" else "")
            + f"**Angebotsfrist:** {frist(t) or 'nicht angegeben'}\n\n"
            f"{beschreibung or 'Keine Leistungsbeschreibung in der Bekanntmachung vorhanden.'}\n\n"
            "_Dieser Kurzüberblick enthält Angaben aus der öffentlichen Bekanntmachung. "
            "Die Vergabeunterlagen wurden nicht geprüft. Für die ausführliche Analyse bitte die Unterlagen hochladen._")


def steckbrief_datei(name: str, day: str, rel: dict) -> Path:
    t = rel.get("tender") or {}
    slug = re.sub(r"[^a-z0-9]+", "-", t.get("title", "").lower())[:50].strip("-")
    import hashlib
    version = hashlib.sha256((str(rel.get("ocid") or rel.get("id")) + str(rel.get("_katalog_version", ""))).encode()).hexdigest()[:12]
    return ROOT / "steckbriefe" / f"{day}-{name}-{slug}-{version}.md"


def steckbrief_fuer(ki, name: str, profile: dict, day: str, rel: dict, url: str) -> Path | None:
    """Let Claude write the Steckbrief: from the documents on allowed portals, otherwise from the notice itself."""
    out = steckbrief_datei(name, day, rel)
    if out.exists():
        return out
    kopf = json.dumps(item(0, rel) | {"link": url, "veroeffentlicht": day}, ensure_ascii=False)
    if urllib.parse.urlparse(url).netloc in PORTALE:
        from texte import bundle
        from unterlagen import download
        with tempfile.TemporaryDirectory() as tmp:
            files = download(url, Path(tmp), verbose=False)
            dokumente, skipped = bundle(files)
        quelle = f"aus {len(files)} Vergabeunterlagen" + (f" (nicht gelesen: {', '.join(skipped)})" if skipped else "")
    else:
        voll = eforms_text(rel)
        dokumente = ("Nur die öffentliche Bekanntmachung, keine Vergabeunterlagen.\n"
                     + (f"Vollständige Bekanntmachung (eForms, Feldname: Wert):\n{voll}\n\n" if voll else "")
                     + "Kurzfassung (OCDS):\n" + json.dumps(rel, ensure_ascii=False)[:40000])
        quelle = "aus der vollständigen Bekanntmachung (die Vergabeunterlagen selbst hat Jarvis nicht gelesen)"
    if not dokumente.strip():
        return None
    text = ki.steckbrief(profile["beschreibung"], kopf, dokumente)
    if not text:
        return None
    out.parent.mkdir(exist_ok=True)
    out.write_text(f"{text}\n\n---\n_Automatisch erstellt von Jarvis am {date.today().isoformat()} {quelle}. "
                   f"Quelle: [{url}]({url}). Ohne Gewähr, vor dem Angebot bitte die Originalunterlagen prüfen._\n", encoding="utf-8")
    return out


def run(days: list[str]) -> str:
    from profile_db import laden
    import katalog
    profiles = laden()
    if FIRMA:  # first run right after the setup assistant: only this firm
        profiles = {k: p for k, p in profiles.items() if p.get("firma_id") == FIRMA}
        if not profiles:
            sys.exit(f"Kein Suchprofil für Firma {FIRMA}")
    hits = {k: [] for k in profiles}
    seen, total, licence = set(), 0, ""
    gemeinsam = katalog.bestand()
    inputs = gemeinsam if gemeinsam is not None else [(day, rel) for day in sorted(days, reverse=True) for _, rel in releases(fetch(day))]
    # Other European countries via TED, only for profiles that chose them (Germany comes from the Bekanntmachungsservice).
    ausland = sorted({l for p in profiles.values() for l in p.get("laender", ["DEU"]) if l != "DEU"})
    if ausland:
        import ted
        inputs = list(inputs) + [(day, rel) for day in days for rel in ted.releases(day, [l for l in ausland if l not in ("GBR", "USA")])]
    if "GBR" in ausland:  # not in TED since Brexit
        import uk
        inputs = list(inputs) + [(day, rel) for day in days for rel in uk.releases(day)]
    if "USA" in ausland:  # federal agencies via SAM.gov, only with SAM_API_KEY
        import usa
        inputs = list(inputs) + [(day, rel) for day in days for rel in usa.releases(day)]
    for day, rel in sorted(inputs, key=lambda r: (r[0], r[1].get("date", "")), reverse=True):
        key = rel.get("ocid") or rel.get("id") or link(rel)
        if key in seen:
            continue
        seen.add(key)
        if gemeinsam is None and not any(str(tag).startswith("tender") for tag in rel.get("tag") or []):
            continue
        if not katalog.offen(rel):
            continue
        total += 1
        t = rel.get("tender") or {}
        text = f"{t.get('title', '')} {t.get('description', '')}".lower()
        codes = cpv_codes(t)
        land = rel.get("_land") or "DEU"
        for name, profile in profiles.items():
            if land not in profile.get("laender", ["DEU"]):
                continue
            points, reason = score(profile, text, codes)
            beobachtet = rel.get("_auftraggeber_id") in profile.get("beobachtete_auftraggeber", [])
            if points or beobachtet:
                hits[name].append((max(points, 1), day, dict(rel, _beobachtet=beobachtet), "Beobachteter Auftraggeber" if beobachtet else reason))
    ki = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import ki
    lines = [f"# Ausschreibungs-Alarm {', '.join(days)}", "",
             f"{total} offene Bekanntmachungen im erfassten Bestand geprüft. Quelle: Bekanntmachungsservice (oeffentlichevergabe.de), Lizenz: {licence or 'siehe Datei'}.", ""]
    briefe = 0
    treffer = []  # for the firms' accounts in the app (alarm/speichern.py)
    for name, profile in profiles.items():
        alle = sorted(hits[name], key=lambda h: -h[0])
        cache = katalog.bewertungen(profile)
        neu = [r for r in alle if katalog.schluessel(r[2]) not in cache][:40]
        neue_bewertung = ki.score(profile["beschreibung"], [item(i, r[2]) for i, r in enumerate(neu)]) if ki and neu else {}
        for i, ergebnis in neue_bewertung.items():
            if 0 <= i < len(neu):
                rel = neu[i][2]
                katalog.bewertung_speichern(profile, rel, ergebnis)
                cache[katalog.schluessel(rel)] = ergebnis
        # Include cached hits as well as new deterministic matches; no daily re-scoring of unchanged texts.
        rows = alle[:200]
        bewertung = {i: cache[katalog.schluessel(r[2])] for i, r in enumerate(rows) if katalog.schluessel(r[2]) in cache}
        if bewertung:
            rows = [(bewertung.get(i, {}), *r) for i, r in enumerate(rows)]
            rows.sort(key=lambda r: (-r[0].get("punkte", 0), -r[1]))
            weg = [r for r in rows if r[0] and r[0].get("punkte", 0) < 4 and not r[3].get("_beobachtet")]
            rows = [r for r in rows if not r[0] or r[0].get("punkte", 0) >= 4 or r[3].get("_beobachtet")]
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
            links = f"[Zur Ausschreibung]({url}) · [⬆️ Unterlagen prüfen lassen]({UPLOAD}?titel={urllib.parse.quote(t.get('title', '').strip()[:200])})"
            cache = steckbrief_datei(name, day, rel)
            pfad = cache if cache.exists() else None
            if not pfad and b.get("punkte", 0) >= STECKBRIEF_AB and briefe < MAX_STECKBRIEFE:
                pfad = steckbrief_fuer(ki, name, profile, day, rel, url)
                if pfad:
                    briefe += 1
            if pfad:
                links += f" · [📄 Steckbrief](../steckbriefe/{pfad.name})"
            lines += [links, ""]
            treffer.append({"profil": name, "quelle_id": rel.get("ocid") or rel.get("id") or url, "titel": t.get("title", "").strip(),
                            "link": url, "frist": frist(t),
                            "punkte": b.get("punkte") or None, "plz": plz(rel), "steckbrief": pfad.read_text(encoding="utf-8") if pfad else kurzbrief(rel, day), "steckbrief_kurz": not bool(pfad), "katalog_id": rel.get("_katalog_id"), "katalog_version": rel.get("_katalog_version")})
        if weg:
            lines += [f"_{len(weg)} weitere Treffer passen laut KI nicht (unter 4/10)._", ""]
        if not rows:
            lines += ["Heute nichts Passendes.", ""]
    (ROOT / "treffer.json").write_text(json.dumps(treffer, ensure_ascii=False), encoding="utf-8")
    import foerder
    lines += foerder.abschnitt(profiles, ki, days)
    if ki:
        lines += [f"_KI-Kosten dieses Laufs: {ki.kosten():.2f} $_", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    # First run for a new firm: the last 7 days, so the first hit list comes right away.
    days = sys.argv[1:] or [(date.today() - timedelta(days=d)).isoformat() for d in (range(7, 0, -1) if FIRMA else [1])]
    report = run(days)
    out = ROOT / "berichte" / (f"erstlauf-{FIRMA[:8]}-{days[-1]}.md" if FIRMA else f"{days[-1]}.md")
    out.parent.mkdir(exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(report)
