"""Daily tender alarm: reads the German Bekanntmachungsservice export and writes a report.

Source: https://oeffentlichevergabe.de/api/notice-exports?pubDay=YYYY-MM-DD&format=ocds.zip
(all German notices, above and below EU thresholds; licence stated in every file).
Usage: python3 alarm/alarm.py [YYYY-MM-DD ...]   (default: yesterday)
Writes alarm/berichte/<date>.md and prints it.
With ANTHROPIC_API_KEY set, Claude scores the hits and writes Steckbriefe for the best ones
(alarm/steckbriefe/), at most MAX_STECKBRIEFE per firm and day: the best hits and those with the most work.
"""
import io
import itertools
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parent
UPLOAD = "https://app.wpdigitalranger.com/"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"}
# Portals whose terms and robots.txt allow downloading the documents for our service (checked by hand).
# Not DTVP: its AGB (29.10.2026) forbid systematic downloads of notices and documents for commercial offers.
PORTALE: set[str] = set()
MAX_STECKBRIEFE = int(os.environ.get("MAX_STECKBRIEFE") or "4")  # per firm and day (Benjamin, 31.10.2026); first run of a new firm 10 (01.11.2026)
STECKBRIEF_AB = 7
MIN_PASSUNG = 6
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


def cpv_praefix(code: str) -> str:
    """Trailing zeros denote a parent class; CPV divisions have at least two digits."""
    return code[:max(2, len(code.rstrip("0")))] if re.fullmatch(r"\d{2,8}", code) else code


def score(profile: dict, text: str, codes: list[str]) -> tuple[int, str]:
    """0 = no match. Higher = better fit. Returns (score, reason)."""
    if re.search(profile["exclude"], text) or re.search(profile.get("exclude_schnell") or r"(?!x)x", text):
        return 0, ""
    excluded = codes and all(c.startswith(tuple(cpv_praefix(p) for p in profile["exclude_cpv"])) for c in codes)
    by_cpv = [c for c in codes if c.startswith(tuple(cpv_praefix(p) for p in profile["cpv"]))]
    for prefix, context in profile.get("cpv_needs_context", {}).items():
        by_cpv = [c for c in by_cpv if not c.startswith(cpv_praefix(prefix)) or re.search(context, text)]
    word = re.search(profile["words"], text)
    if not by_cpv and (not word or excluded):
        return 0, ""
    points = (2 if by_cpv else 0) + (1 if word else 0) + (2 if re.search(profile["strong"], text) else 0)
    reason = ", ".join(filter(None, [f"CPV {by_cpv[0]}" if by_cpv else "", f"„{word.group(0)}“" if word else ""]))
    return points, reason


def auftraggeber_in(namen: list[str], rel: dict) -> bool:
    """Whether the buyer is one of the given names (part of the name is enough: "stadt koeln")."""
    if not namen:
        return False
    from profile_db import namen_norm
    buyer = f" {namen_norm((rel.get('buyer') or {}).get('name', ''))} "
    return any(f" {n} " in buyer or (len(n) >= 8 and n in buyer) for n in namen)


def wert_erlaubt(profile: dict, rel: dict) -> bool:
    """Contract value filter (H5). Notices without a value pass unless the firm switched that off."""
    unten, oben = profile.get("wert_min"), profile.get("wert_max")
    if not unten and not oben:
        return True
    t = rel.get("tender") or {}
    wert = betrag(t.get("value")) or sum(betrag(l.get("value")) for l in t.get("lots") or [])
    if not wert:
        return profile.get("wert_unbekannt", True)
    return (not unten or wert >= unten) and (not oben or wert <= oben)


def ohne_ki_passend(profile: dict, rel: dict) -> bool:
    """Without a fresh AI rating require concrete evidence of the requested trade."""
    t = rel.get("tender") or {}
    titel = (t.get("title") or "").lower()
    text = f"{titel} {t.get('description') or ''}".lower()
    stark = profile.get("strong") or r"(?!x)x"
    return bool(re.search(stark, titel) or (
        any(c.startswith(tuple(cpv_praefix(p) for p in profile.get("cpv") or [])) for c in cpv_codes(t))
        and re.search(stark, text)))


def quelle_id(rel: dict) -> str:
    return str(rel.get("ocid") or rel.get("id") or link(rel))


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


def sprach_arg(profile: dict) -> dict:
    """Language for the AI only when it is not German (German profiles call the AI exactly as before)."""
    return {"sprache": profile["sprache"]} if profile.get("sprache") in ("en", "fr", "pl") else {}


def frist_lesbar(wert: str | None) -> str | None:
    """Deadline for reading: 2026-11-30T12:00:00+01:00 → 30.11.2026, 12:00 (local time as written by the source;
    UTC values, as the German notice service writes them, in German time)."""
    if not wert:
        return None
    try:
        d = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return wert
    if len(wert) <= 10:
        return d.strftime("%d.%m.%Y")
    if d.utcoffset() == timedelta(0):
        from zoneinfo import ZoneInfo
        d = d.astimezone(ZoneInfo("Europe/Berlin"))
    return d.strftime("%d.%m.%Y, %H:%M")


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
            + ("**Land:** Frankreich · Quelle: BOAMP, DILA (Licence Ouverte 2.0)\n\n" if rel.get("_quelle") == "BOAMP" else "")
            + ("**Land:** Polen · Quelle: Biuletyn Zamówień Publicznych (UZP)\n\n" if rel.get("_quelle") == "BZP" else "")
            + f"**Angebotsfrist:** {frist_lesbar(frist(t)) or 'nicht angegeben'}\n\n"
            + eckdaten(t)
            + f"{beschreibung or 'Keine Leistungsbeschreibung in der Bekanntmachung vorhanden.'}\n\n"
            "_Dieser Kurzüberblick enthält Angaben aus der öffentlichen Bekanntmachung. "
            "Die Vergabeunterlagen wurden nicht geprüft. Für die ausführliche Analyse bitte die Unterlagen hochladen._")


def betrag(v) -> float:
    try:
        return float((v or {}).get("amount") or 0)
    except (TypeError, ValueError):
        return 0.0


def umfang(t: dict) -> float:
    """Rough size of the work: estimated value of the whole procedure, else of its lots, else the number of lots."""
    wert = betrag(t.get("value")) or sum(betrag(l.get("value")) for l in t.get("lots") or [])
    return wert or len(t.get("lots") or [])


def eckdaten(t: dict) -> str:
    """Key facts read straight from the notice (no AI): lots, estimated value, term and quantities."""
    teile = []
    lose = t.get("lots") or []
    if lose:
        namen = "; ".join(str(l.get("title") or l.get("id") or "").strip() for l in lose[:10])
        teile.append(f"**Lose:** {len(lose)}" + (f" ({namen}{' …' if len(lose) > 10 else ''})" if namen.strip("; ") else ""))
    wert = betrag(t.get("value")) or sum(betrag(l.get("value")) for l in lose)
    if wert:
        teile.append(f"**Geschätzter Auftragswert:** {wert:,.0f} €".replace(",", "."))
    zeiten = [p for p in [t.get("contractPeriod"), *((l.get("contractPeriod") for l in lose))] if p]
    for z in zeiten[:1]:
        if z.get("durationInDays"):
            teile.append(f"**Laufzeit:** {z['durationInDays']} Tage")
        elif z.get("startDate") or z.get("endDate"):
            teile.append(f"**Laufzeit:** {str(z.get('startDate') or '?')[:10]} bis {str(z.get('endDate') or '?')[:10]}")
    mengen = [f"{i.get('quantity')} {(i.get('unit') or {}).get('name') or ''}".strip() + (f" {i.get('description')[:80]}" if i.get("description") else "")
              for i in t.get("items") or [] if i.get("quantity")]
    if mengen:
        teile.append("**Mengen:** " + "; ".join(mengen[:5]))
    return "".join(f"{x}\n\n" for x in teile)


def steckbriefe_heute(namen) -> int:
    """Steckbriefe already written today for this firm, over all its search profiles (the limit applies per firm and day)."""
    heute = f"am {date.today().isoformat()} "
    return sum(heute in f.read_text(encoding="utf-8") for n in ([namen] if isinstance(namen, str) else namen)
               for f in (ROOT / "steckbriefe").glob(f"*-{n}-*.md"))


def firmen_namen(profiles: dict, name: str) -> list[str]:
    """All profile keys of the same firm (main profile and further profiles, H3); the main profile first."""
    firma = profiles[name].get("firma_id")
    return sorted((k for k, p in profiles.items() if firma and p.get("firma_id") == firma), key=lambda k: (bool(profiles[k].get("zusatz")), k)) or [name]


def vorhandener_steckbrief(namen: list[str], day: str, rel: dict) -> Path | None:
    """A Steckbrief another profile of the same firm already wrote for this notice (no second paid one)."""
    return next((d for d in (steckbrief_datei(n, day, rel) for n in namen) if d.exists()), None)


def steckbrief_auswahl(name: str, rows: list, namen: list[str] | None = None) -> set:
    """Half of the daily Steckbriefe for the best hits, the rest for the hits with the most work."""
    namen = namen or [name]
    frei = MAX_STECKBRIEFE - steckbriefe_heute(namen)
    offen = [r for r in rows if r[0] and not vorhandener_steckbrief(namen, r[2], r[3])]
    beste = sorted((r for r in offen if r[0].get("punkte", 0) >= STECKBRIEF_AB),
                   key=lambda r: (-r[0].get("punkte", 0), -umfang(r[3].get("tender") or {})))
    # First run of a new firm (FIRMA set): simply the best hits; daily runs: half best, half most work.
    gewaehlt = beste[:max(0, frei if os.environ.get("FIRMA") else (frei + 1) // 2)]
    rest = sorted((r for r in offen if r not in gewaehlt and umfang(r[3].get("tender") or {})),
                  key=lambda r: (-umfang(r[3].get("tender") or {}), -r[0].get("punkte", 0)))
    gewaehlt += rest[:max(0, frei - len(gewaehlt))]
    gewaehlt += [r for r in beste if r not in gewaehlt][:max(0, frei - len(gewaehlt))]
    return {id(r[3]) for r in gewaehlt}


def bewertungsabschnitt(bewertung: dict) -> str:
    """Short, user-facing explanation returned by the AI relevance scoring."""
    kurz, grund = bewertung.get("kurz"), bewertung.get("grund")
    return f"## Jarvis-Bewertung\n\n**Gesucht:** {kurz}\n\n**Warum passend:** {grund}\n\n" if kurz and grund else ""


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
    text = ki.steckbrief(profile["beschreibung"], kopf, dokumente, **sprach_arg(profile))
    if not text:
        return None
    out.parent.mkdir(exist_ok=True)
    out.write_text(f"{text}\n\n---\n_Automatisch erstellt von Jarvis am {date.today().isoformat()} {quelle}. "
                   f"Quelle: [{url}]({url}). Ohne Gewähr, vor dem Angebot bitte die Originalunterlagen prüfen._\n", encoding="utf-8")
    return out


def treffer_eintrag(name: str, b: dict, day: str, rel: dict, pfad: Path | None = None) -> dict:
    t = rel.get("tender") or {}
    url = link(rel)
    return {"profil": name, "quelle_id": rel.get("ocid") or rel.get("id") or url, "titel": t.get("title", "").strip(),
            "link": url, "frist": frist(t),
            "punkte": b.get("punkte") or None, "plz": plz(rel),
            "steckbrief": (bewertungsabschnitt(b)
                           + (pfad.read_text(encoding="utf-8") if pfad else kurzbrief(rel, day))),
            "steckbrief_kurz": not bool(pfad), "katalog_id": rel.get("_katalog_id"), "katalog_version": rel.get("_katalog_version"),
            "fragefrist": ((t.get("enquiryPeriod") or {}).get("endDate") or None),
            **({"us": rel["_us"]} if rel.get("_us") else {})}


def entfernung(profile: dict, rel: dict):
    """Distance in km from the nearest firm location to the place of performance (None if unknown)."""
    from geo_radius import entfernung_km, koordinaten
    ziel = koordinaten(plz(rel))
    punkte = [p for p in profile.get("suchpunkte") or [] if p.get("lat") is not None]
    return round(min(entfernung_km([p["lat"], p["lon"]], ziel) for p in punkte), 1) if ziel and punkte else None


def zwischenstand(name: str, profile: dict, alle: list, cache: dict, gespeichert: set, namen: list[str] | None = None) -> None:
    """Puts confirmed hits into the app while the run continues, so the first ones can be read right away."""
    import katalog
    import speichern
    neue = []
    for points, day, rel, _ in alle:
        b = cache.get(katalog.schluessel(rel))
        schwelle = profile.get("min_punkte", MIN_PASSUNG) - (2 if auftraggeber_in(profile.get("auftraggeber_bevorzugt") or [], rel) else 0)
        if not (rel.get("_beobachtet") or (b and b.get("punkte", 0) >= schwelle)):
            continue
        eintrag = treffer_eintrag(name, b or {}, day, rel, vorhandener_steckbrief(namen or [name], day, rel)) | {"entfernung_km": entfernung(profile, rel)}
        if eintrag["quelle_id"] not in gespeichert:
            neue.append(eintrag)
    bewertet = sum(katalog.schluessel(r[2]) in cache for r in alle)
    passend = len(gespeichert) + len(neue)
    stand = {"zeit": datetime.now(timezone.utc).isoformat(), "treffer": passend, "bewertet": bewertet, "kandidaten": len(alle)}
    if speichern.zwischenspeichern(profile, neue, stand):
        gespeichert.update(e["quelle_id"] for e in neue)


def run(days: list[str]) -> str:
    from profile_db import im_suchgebiet, laden
    import katalog
    profiles = laden()
    if FIRMA:  # first run right after the setup assistant: only this firm
        profiles = {k: p for k, p in profiles.items() if p.get("firma_id") == FIRMA}
        if not profiles:
            sys.exit(f"Kein Suchprofil für Firma {FIRMA}")
    hits = {k: [] for k in profiles}
    abgelehnt = {k: set() for k in profiles}
    seen, total, licence = set(), 0, ""
    gemeinsam = katalog.bestand()
    inputs = gemeinsam if gemeinsam is not None else ((day, rel) for day in sorted(days, reverse=True) for _, rel in releases(fetch(day)))
    # Other European countries via TED, only for profiles that chose them (Germany comes from the Bekanntmachungsservice).
    ausland = sorted({l for p in profiles.values() for l in p.get("laender", ["DEU"]) if l != "DEU"})
    if ausland:
        import ted
        inputs = itertools.chain(inputs, ((day, rel) for day in sorted(days, reverse=True) for rel in ted.releases(day, [l for l in ausland if l not in ("GBR", "USA", "FRA")])))
    if "POL" in ausland:  # Poland: national notices below the EU thresholds from BZP (above them TED, see above)
        import bzp
        inputs = itertools.chain(inputs, ((day, rel) for day in sorted(days, reverse=True) for rel in bzp.releases(day)))
    if "FRA" in ausland:  # France from BOAMP (includes the EU notices of TED plus national ones from 90 k€)
        import boamp
        inputs = itertools.chain(inputs, ((day, rel) for day in sorted(days, reverse=True) for rel in boamp.releases(day)))
    if "GBR" in ausland:  # not in TED since Brexit
        import uk
        inputs = itertools.chain(inputs, ((day, rel) for day in sorted(days, reverse=True) for rel in uk.releases(day)))
    if "USA" in ausland:  # federal agencies via SAM.gov, only with SAM_API_KEY
        import usa
        inputs = itertools.chain(inputs, ((day, rel) for day in sorted(days, reverse=True) for rel in usa.releases(day)))
    for day, rel in inputs:
        key = rel.get("ocid") or rel.get("id") or link(rel)
        if key in seen:
            continue
        seen.add(key)
        if gemeinsam is None and not any(str(tag).startswith("tender") for tag in rel.get("tag") or []):
            continue
        if not katalog.offen(rel):
            for name in profiles:
                abgelehnt[name].add(quelle_id(rel))
            continue
        total += 1
        t = rel.get("tender") or {}
        text = f"{t.get('title', '')} {t.get('description', '')}".lower()
        codes = cpv_codes(t)
        land = rel.get("_land") or "DEU"
        for name, profile in profiles.items():
            if land not in profile.get("laender", ["DEU"]):
                abgelehnt[name].add(quelle_id(rel))
                continue
            if not im_suchgebiet(profile, rel):
                abgelehnt[name].add(quelle_id(rel))
                continue
            beobachtet = rel.get("_auftraggeber_id") in profile.get("beobachtete_auftraggeber", [])
            # Excluded buyers and contract values outside the range never reach the (paid) rating.
            if not beobachtet and (auftraggeber_in(profile.get("auftraggeber_aus") or [], rel) or not wert_erlaubt(profile, rel)):
                abgelehnt[name].add(quelle_id(rel))
                continue
            points, reason = score(profile, text, codes)
            if points or beobachtet:
                hits[name].append((max(points, 1), day, dict(rel, _beobachtet=beobachtet), "Beobachteter Auftraggeber" if beobachtet else reason))
            else:
                abgelehnt[name].add(quelle_id(rel))
    ki = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import ki
    lines = [f"# Ausschreibungs-Alarm {', '.join(days)}", "",
             f"{total} offene Bekanntmachungen im erfassten Bestand geprüft. Quelle: Bekanntmachungsservice (oeffentlichevergabe.de), Lizenz: {licence or 'siehe Datei'}.", ""]
    briefe = 0
    treffer = []  # for the firms' accounts in the app (alarm/speichern.py)
    staende = {}
    for name, profile in profiles.items():
        if ki:
            ki.FIRMA[0] = profile.get("firma_id")
        lines += [f"Suchgebiet {profile['name']}: {len(profile.get('suchorte') or [])} Standorte" if profile.get("suchorte") else f"Suchgebiet {profile['name']}: bundesweit", ""]
        alle = sorted(hits[name], key=lambda h: -h[0])
        cache = katalog.bewertungen(profile)
        neu = [r for r in alle if katalog.schluessel(r[2]) not in cache]
        gespeichert: set = set()
        namen = firmen_namen(profiles, name)
        zwischenstand(name, profile, alle, cache, gespeichert, namen)
        # Small batches fit within the remaining budget more often than a reservation
        # for 40 notices and 16,000 output tokens. The global hard limits still apply.
        if ki:
            for anfang in range(0, len(neu), 8):
                stapel = neu[anfang:anfang + 8]
                neue_bewertung = ki.score(profile["beschreibung"], [item(i, r[2]) for i, r in enumerate(stapel)], **sprach_arg(profile))
                if not neue_bewertung:
                    break
                for i, ergebnis in neue_bewertung.items():
                    if 0 <= i < len(stapel):
                        rel = stapel[i][2]
                        katalog.bewertung_speichern(profile, rel, ergebnis)
                        cache[katalog.schluessel(rel)] = ergebnis
                zwischenstand(name, profile, alle, cache, gespeichert, namen)
        # Include cached hits as well as new deterministic matches; no daily re-scoring of unchanged texts.
        rows = alle
        bewertung = {i: cache[katalog.schluessel(r[2])] for i, r in enumerate(rows) if katalog.schluessel(r[2]) in cache}
        rows = [(bewertung.get(i, {}), *r) for i, r in enumerate(rows)]
        rows.sort(key=lambda r: (-r[0].get("punkte", 0), -r[1]))
        def passend(r):
            # Preferred buyers (H4) pass with two points less.
            schwelle = profile.get("min_punkte", MIN_PASSUNG) - (2 if auftraggeber_in(profile.get("auftraggeber_bevorzugt") or [], r[3]) else 0)
            return r[3].get("_beobachtet") or (r[0].get("punkte", 0) >= schwelle if r[0] else ohne_ki_passend(profile, r[3]))
        offen = [r for r in rows if not r[0]]
        weg = [r for r in rows if r[0] and not passend(r)]
        rows = [r for r in rows if passend(r)]
        abgelehnt[name].update(quelle_id(r[3]) for r in weg)
        staende[name] = {"katalog_geprueft": total, "kandidaten": len(alle), "bewertet": len(alle) - len(offen),
                         "ausstehend": len(offen), "importtage_offen": getattr(gemeinsam, "luecken", None)}
        lines += [f"Bewertung: {len(alle) - len(offen)} von {len(alle)} Kandidaten geprüft; {len(offen)} noch offen.", ""]
        lines += [f"## {profile['name']}: {len(rows)} Treffer", ""]
        auswahl = steckbrief_auswahl(name, rows, namen)
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
            pfad = vorhandener_steckbrief(namen, day, rel)
            if ki and not pfad and id(rel) in auswahl:
                pfad = steckbrief_fuer(ki, name, profile, day, rel, url)
                if pfad:
                    briefe += 1
            if pfad:
                links += f" · [📄 Steckbrief](../steckbriefe/{pfad.name})"
            lines += [links, ""]
            treffer.append(treffer_eintrag(name, b, day, rel, pfad) | {"entfernung_km": entfernung(profile, rel)})
        if weg:
            lines += [f"_{len(weg)} weitere Kandidaten aussortiert: unter {profile.get('min_punkte', MIN_PASSUNG)}/10 oder ohne eindeutigen Leistungsbezug._", ""]
            lines += ["<details><summary>Aussortierte Kandidaten und Gründe</summary>", ""]
            for b, _, _, rel, grund in weg[:40]:
                lines += [f"- {b.get('punkte', 'ohne KI')}/10 · {(rel.get('tender') or {}).get('title', '')}: {b.get('grund') or grund}"]
            lines += ["", "</details>", ""]
        if not rows:
            lines += ["Noch keine bestätigten Treffer; Bewertungen stehen noch aus." if offen else "Heute nichts Passendes.", ""]
    kompletter_katalog = gemeinsam is not None and getattr(gemeinsam, "vollstaendig", True) and not ausland and getattr(gemeinsam, "luecken", 0) == 0 and not any(s["ausstehend"] for s in staende.values())
    import foerder
    # Funding programmes once per firm (main profile), not again for every further search profile.
    foerderung: dict = {}
    try:  # the hits must be saved even if the funding part fails
        lines += foerder.abschnitt({k: p for k, p in profiles.items() if not p.get("zusatz")}, ki, days, foerderung)
    except Exception as e:  # noqa: BLE001
        foerderung = {}
        lines += ["## Förderprogramme", "", f"_Förderprogramme nicht geprüft ({type(e).__name__})._", ""]
    (ROOT / "treffer.json").write_text(json.dumps({
        "katalog_vollstaendig": kompletter_katalog, "treffer": treffer,
        "foerder": foerderung,
        "profile": {name: {"version": katalog.profil_version(p), "abgelehnt": sorted(abgelehnt[name]), "suchstand": staende[name]} for name, p in profiles.items()},
    }, ensure_ascii=False), encoding="utf-8")
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
