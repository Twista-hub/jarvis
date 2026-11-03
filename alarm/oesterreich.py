"""Austrian tenders below and above the EU thresholds from the statutory "Kerndaten" (BVergG 2018 § 59 ff.).

Every contracting authority (or its platform) publishes a Kerndatenquelle (KDQ: list of links with lastmod) and lists
it on data.gv.at; the data are open under CC BY 4.0 (data.gv.at terms of use, checked 03.11.2026). This module finds
the KDQs via the data.gv.at search API, reads only items changed on the requested day and keeps contract notices
(eForms ContractNotice or the older Austrian KD_8_1 forms); awards are skipped.

Rules (CLAUDE.md): robots.txt of each host is checked before fetching (incl. Crawl-delay); hosts that signal
"ai-input=no" (Content-Signal, e.g. ANKÖ) are skipped because Jarvis rates notices with AI. Own user agent.
Usage (test): python3 alarm/oesterreich.py YYYY-MM-DD
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

UA = "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"
SUCHE = "https://www.data.gv.at/api/hub/search/search?q=kerndaten&limit=100"
QUELLE = "Kerndaten (data.gv.at, CC BY 4.0)"
MAX_JE_QUELLE = 150   # items read per source and day
MAX_GESAMT = 600      # items read per day in total
_robots: dict = {}


def holen(url: str, limit: int = 25_000_000, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/xml, application/json, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit + 1)[:limit]


def erlaubt(url: str) -> tuple[bool, float]:
    """(allowed, crawl delay in s) for our user agent; hosts with Content-Signal ai-input=no count as not allowed."""
    teile = urllib.parse.urlsplit(url)
    host = f"{teile.scheme}://{teile.netloc}"
    if host not in _robots:
        rp, text = urllib.robotparser.RobotFileParser(), ""
        try:
            text = holen(host + "/robots.txt", 500_000, 15).decode("utf-8", "replace")
            if "<html" in text[:500].lower():  # a 404 page instead of a robots.txt = no rules
                text = ""
        except Exception:  # noqa: BLE001 – no robots.txt = no restrictions
            text = ""
        rp.parse(text.splitlines())
        ki_verbot = bool(re.search(r"ai-input\s*=\s*no", text, re.I))
        _robots[host] = (rp, ki_verbot)
    rp, ki_verbot = _robots[host]
    if ki_verbot or not rp.can_fetch(UA, url):
        return False, 0.0
    return True, float(rp.crawl_delay(UA) or 0.5)


def quellen(daten: dict | None = None) -> list[str]:
    """KDQ links of all Kerndaten metadata sets on data.gv.at (only http(s) XML/API links, no PDFs or web pages)."""
    if daten is None:
        try:
            daten = json.loads(holen(SUCHE, 10_000_000))
        except Exception as e:  # noqa: BLE001
            print(f"data.gv.at nicht erreichbar: {type(e).__name__}")
            return []
    links = []
    for r in (daten.get("result") or {}).get("results") or []:
        titel = str((r.get("title") or {}).get("de") or "")
        if "kerndaten" not in titel.lower():
            continue
        for d in r.get("distributions") or []:
            for feld in ("access_url", "download_url"):  # piveau returns lists, older CKAN plain strings
                werte = d.get(feld) or []
                for u in ([werte] if isinstance(werte, str) else werte):
                    u = str(u)
                    if re.match(r"https?://", u) and not re.search(r"\.(pdf|docx?|html?)$|onedrive|/kontakt|/projekte/", u, re.I):
                        links.append(u)
    return sorted(set(links))


def lokal(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def eintraege(kdq: bytes, tag: str) -> list[str]:
    """Item URLs of a KDQ whose lastmod falls on the given day (or the day before, for late updates)."""
    tage = {tag, (date.fromisoformat(tag) - timedelta(days=1)).isoformat()}
    try:
        wurzel = ET.fromstring(kdq)
    except ET.ParseError:
        return []
    urls = []
    for item in wurzel.iter():
        if lokal(item.tag) != "item":
            continue
        if str(item.get("lastmod") or "")[:10] not in tage:
            continue
        u = next((c.text for c in item if lokal(c.tag) == "url" and c.text), None)
        if u:
            urls.append(u.strip())
    return urls


def _text(e) -> str:
    return re.sub(r"\s+", " ", "".join(e.itertext())).strip() if e is not None else ""


def _finde(wurzel, pfad: list[str]):
    """First element along a path of local tag names (namespace-agnostic)."""
    knoten = [wurzel]
    for name in pfad:
        knoten = [k for n in knoten for k in n.iter() if lokal(k.tag) == name]
        if not knoten:
            return None
    return knoten[0]


def lesen(xml: bytes, url: str) -> dict | None:
    """A contract notice as plain fields, or None for awards and other notice types."""
    try:
        w = ET.fromstring(xml)
    except ET.ParseError:
        return None
    art = lokal(w.tag)
    if art == "ContractNotice":  # eForms (EU standard, used by Austrian platforms since 2023/2026)
        projekt = _finde(w, ["ProcurementProject"])
        titel = _text(_finde(projekt, ["Name"])) if projekt is not None else ""
        beschreibung = _text(_finde(projekt, ["Description"])) if projekt is not None else ""
        cpv = [_text(e) for e in w.iter() if lokal(e.tag) == "ItemClassificationCode" and _text(e)]
        frist_d, frist_z = _text(_finde(w, ["TenderSubmissionDeadlinePeriod", "EndDate"])), _text(_finde(w, ["TenderSubmissionDeadlinePeriod", "EndTime"]))
        ort = _finde(projekt, ["RealizedLocation"]) if projekt is not None else None
        plz = _text(_finde(ort, ["PostalZone"])) if ort is not None else ""
        stadt = _text(_finde(ort, ["CityName"])) if ort is not None else ""
        nuts = _text(_finde(ort, ["CountrySubentityCode"])) if ort is not None else ""
        org = _finde(w, ["Organization"])
        auftraggeber = _text(_finde(org, ["PartyName", "Name"])) if org is not None else ""
        if not plz and org is not None:
            plz, stadt = _text(_finde(org, ["PostalZone"])), stadt or _text(_finde(org, ["CityName"]))
        wert = _text(_finde(w, ["EstimatedOverallContractAmount"]))
        frist = f"{frist_d[:10]}T{(frist_z or '23:59:00')[:8]}" if frist_d else ""
        doku = _text(_finde(w, ["CallForTendersDocumentReference", "URI"]))
    elif art.startswith("KD_8_1"):  # older Austrian Kerndaten form for notices
        titel = _text(_finde(w, ["OBJECT_CONTRACT", "TITLE"]))
        beschreibung = _text(_finde(w, ["OBJECT_CONTRACT", "SHORT_DESCR"]))
        cpv = [str(e.get("CODE")) for e in w.iter() if lokal(e.tag) == "CPV_CODE" and e.get("CODE")]
        frist = _text(_finde(w, ["DATE_RECEIPT_TENDERS"])) or _text(_finde(w, ["DATETIME_RECEIPT_TENDERS"]))
        nuts_e = next((e for e in w.iter() if lokal(e.tag) == "NUTS" and e.get("CODE")), None)
        nuts = nuts_e.get("CODE") if nuts_e is not None else ""
        ort_text = _text(_finde(w, ["MAIN_SITE"]))
        plz = (re.search(r"\b(\d{4})\b", ort_text) or [None, ""])[1] if ort_text else ""
        stadt = ort_text
        auftraggeber = _text(_finde(w, ["ADDRESS_CONTRACTING_BODY", "OFFICIALNAME"]))
        wert = _text(_finde(w, ["VAL_ESTIMATED_TOTAL"]))
        doku = _text(_finde(w, ["URL_DOCUMENT"])) or _text(_finde(w, ["URL_PARTICIPATION"]))
    else:
        return None
    if not titel:
        return None
    return {"id": url.rstrip("/").rsplit("/", 1)[-1].split("=")[-1][:80], "titel": titel[:400], "beschreibung": beschreibung[:3000],
            "cpv": sorted({c.split("-")[0] for c in cpv if re.fullmatch(r"\d{8}(-\d)?", c)}), "frist": frist,
            "plz": plz if re.fullmatch(r"\d{4}", plz or "") else "", "ort": stadt[:120], "nuts": nuts if re.fullmatch(r"AT\d{0,3}", nuts or "") else "",
            "auftraggeber": auftraggeber[:300], "wert": wert, "link": doku or url, "quelle_url": url}


def als_release(a: dict, tag: str) -> dict:
    ort = ", ".join(filter(None, [f"{a['plz']} {a['ort']}".strip(), a["nuts"], "Österreich"]))
    beschreibung = " · ".join(filter(None, [a["beschreibung"], f"Geschätzter Wert: {a['wert']} €" if a["wert"] else ""]))
    return {
        "ocid": f"at-kd-{a['id']}", "id": f"at-kd-{a['id']}", "date": tag, "tag": ["tender"],
        "tender": {
            "title": a["titel"], "description": beschreibung[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in a["cpv"]] + [{"deliveryLocation": {"description": ort}, "deliveryAddress": {"postalCode": a["plz"], "locality": a["ort"], "countryName": "Österreich"}}],
            "tenderPeriod": {"endDate": a["frist"]} if a["frist"] else {},
            "documents": [{"url": a["link"]}],
        },
        "buyer": {"name": a["auftraggeber"], "address": {"countryName": "Österreich", "postalCode": a["plz"], "locality": a["ort"]}},
        "_land": "AUT", "_quelle": QUELLE, "_at": {"nuts": a["nuts"], "kerndaten": a["quelle_url"]},
    }


def releases(tag: str) -> list[dict]:
    """Contract notices with a future (or unknown) deadline changed on this day; [] if data.gv.at is unreachable."""
    jetzt = datetime.now(timezone.utc).isoformat()[:16]
    gesehen, ergebnis, gelesen = set(), [], 0
    for kdq_url in quellen():
        ok, pause = erlaubt(kdq_url)
        if not ok:
            continue
        try:
            urls = eintraege(holen(kdq_url), tag)[:MAX_JE_QUELLE]
        except Exception as e:  # noqa: BLE001 – one broken source must not stop the others
            print(f"Kerndatenquelle nicht lesbar ({urllib.parse.urlsplit(kdq_url).netloc}): {type(e).__name__}")
            continue
        for u in urls:
            if gelesen >= MAX_GESAMT:
                break
            ok, pause = erlaubt(u)
            if not ok:
                continue
            time.sleep(min(pause, 10))
            gelesen += 1
            try:
                a = lesen(holen(u, 5_000_000), u)
            except Exception:  # noqa: BLE001
                continue
            if not a or (a["frist"] and a["frist"][:16] < jetzt):
                continue
            schluessel = (a["titel"].lower(), a["auftraggeber"].lower())
            if schluessel in gesehen:  # same notice on two platforms
                continue
            gesehen.add(schluessel)
            ergebnis.append(als_release(a, tag))
    return ergebnis


def ist_ted_kopie(rel: dict, nationale_titel: set) -> bool:
    """Austrian TED notices also published as Kerndaten (same title) are dropped in favour of the national copy."""
    return rel.get("_land") == "AUT" and rel.get("_quelle") != QUELLE and str((rel.get("tender") or {}).get("title", "")).lower() in nationale_titel


if __name__ == "__main__":
    tag = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()
    print(f"{len(quellen())} Kerndatenquellen auf data.gv.at")
    r = releases(tag)
    print(f"{len(r)} Ausschreibungen am {tag}")
    for x in r[:15]:
        t = x["tender"]
        print("-", t["title"][:90], "|", x["buyer"]["name"][:50], "|", t["items"][-1]["deliveryLocation"]["description"], "| Frist", (t.get("tenderPeriod") or {}).get("endDate"))
