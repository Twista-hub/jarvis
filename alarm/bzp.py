"""Polish national tenders from the Biuletyn Zamówień Publicznych (BZP) via the public API of e-Zamówienia (UZP).

API: https://ezamowienia.gov.pl/mo-board/api/v1/notice (JSON). Reading BZP notices needs no integration procedure
("Odczyt ogłoszeń … nie wymaga przejścia procedury integracyjnej", ezamowienia.gov.pl/pl/integracja, checked
02.11.2026). Limit 30 requests per minute and IP (HTTP 403 above); from 11.01.2027 at most 100 records per page.
robots.txt has no rules. Reuse: Polish open data act 2021 (Art. 11: no conditions stated = reuse without conditions);
we name the source ("Źródło: Biuletyn Zamówień Publicznych, UZP"). No contact persons are kept.
BZP holds the national notices below the EU thresholds; above them Poland comes from TED. Details: docs/polen.md.
Usage (test): python3 alarm/bzp.py YYYY-MM-DD
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

API = "https://ezamowienia.gov.pl/mo-board/api/v1/notice"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "Accept": "application/json"}
SEITE = 100
PAUSE = 3.0  # seconds between requests: 20 per minute, below the limit of 30
QUELLE = "Źródło: Biuletyn Zamówień Publicznych (UZP)"
WOIWODSCHAFTEN = json.loads((Path(__file__).parent / "woiwodschaften.json").read_text(encoding="utf-8"))
TERYT = {w["teryt"]: slug for slug, w in WOIWODSCHAFTEN.items()}
NUTS = {n: slug for slug, w in WOIWODSCHAFTEN.items() for n in w["nuts"]}
_letzter = [0.0]


def _holen(params: dict, versuche: int = 3) -> list[dict]:
    for i in range(versuche):
        warten = PAUSE - (time.monotonic() - _letzter[0])
        if warten > 0:
            time.sleep(warten)
        _letzter[0] = time.monotonic()
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers=UA), timeout=90) as r:
                daten = json.loads(r.read())
            return daten if isinstance(daten, list) else []
        except Exception as e:  # noqa: BLE001
            if i == versuche - 1:
                raise
            time.sleep(20 if "403" in str(e) else 5 * (i + 1))
    return []


def _zeit(x: dict) -> datetime:
    return datetime.fromisoformat(re.sub(r"(\.\d{6})\d*", r"\1", (x.get("publicationDate") or "1970-01-01T00:00:00").replace("Z", "")))


def bekanntmachungen(tag: str) -> list[dict]:
    """All contract notices published in BZP on this day (UTC), without duplicates. Raises when unreachable.

    The API ignores page numbers and treats PublicationDateTo as a whole day, but PublicationDateFrom is exact and the
    results come oldest first: we walk forward from the last publication time read (checked 02.11.2026)."""
    start = datetime.fromisoformat(tag)
    ende = start + timedelta(days=1)
    von, gesehen = start, {}
    for _ in range(60):  # at most 6,000 notices per day
        liste = _holen({"NoticeType": "ContractNotice", "PublicationDateFrom": von.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3],
                        "PublicationDateTo": start.strftime("%Y-%m-%dT23:59:59"), "PageSize": SEITE})
        neu = 0
        for x in liste:
            if start <= _zeit(x) < ende and x.get("orderObject"):
                schluessel = x.get("bzpNumber") or x.get("objectId")
                neu += schluessel not in gesehen
                gesehen[schluessel] = x
        zeiten = [_zeit(x) for x in liste]
        if len(liste) < SEITE or not zeiten or max(zeiten) >= ende or not neu:
            break
        von = max(zeiten) + timedelta(milliseconds=1)
    return list(gesehen.values())


def _text(html: str) -> str:
    t = re.sub(r"<style[\s\S]*?</style>|<script[\s\S]*?</script>", "", html or "")
    t = re.sub(r"<[^>]+>", "\n", t)
    t = re.sub(r"&nbsp;", " ", t)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def _feld(text: str, name: str, laenge: int = 300) -> str:
    m = re.search(rf"{name}[^\n]*\n\s*([^\n]{{1,{laenge}}})", text)
    return m.group(1).strip() if m else ""


def lesen(x: dict) -> dict:
    """Fields of one BZP notice."""
    text = _text(x.get("htmlBody") or "")
    cpv = list(dict.fromkeys(re.findall(r"\b(\d{8})-\d", x.get("cpvCode") or "")))
    wert = re.search(r"Wartość (?:zamówienia|części)[^\n]*\n\s*([\d .,]+)\s*\n?\s*(PLN|EUR)", text)
    return {
        "nummer": x.get("bzpNumber") or "",
        "titel": (x.get("orderObject") or "").strip(),
        "auftraggeber": (x.get("organizationName") or "").strip(),
        "ort": (x.get("organizationCity") or "").strip(),
        "plz": _feld(text, "Kod pocztowy", 10),
        "woiwodschaft": TERYT.get(x.get("organizationProvince") or ""),
        "art": x.get("orderType") or "",
        "cpv": cpv,
        "frist": x.get("submittingOffersDate") or "",
        "veroeffentlicht": (x.get("publicationDate") or "")[:10],
        "beschreibung": _feld(text, "Krótki opis przedmiotu zamówienia", 3000),
        "wert": f"{wert.group(1).strip()} {wert.group(2)}" if wert else "",
        "link": next((u for u in re.findall(r"https?://[^\s<>\"]+", _feld(text, "Adres strony internetowej prowadzonego postępowania", 400))), ""),
        "tender_id": x.get("tenderId") or "",
    }


def als_release(a: dict, tag: str) -> dict:
    w = WOIWODSCHAFTEN.get(a["woiwodschaft"] or "", {})
    ort = ", ".join(filter(None, [a["plz"], a["ort"], f"woj. {w['name'].lower()}" if w else "", "Polska"]))
    beschreibung = " · ".join(filter(None, [a["beschreibung"], f"Wartość: {a['wert']}" if a["wert"] else ""]))
    return {
        "ocid": a["tender_id"] or f"bzp-{a['nummer']}",
        "id": f"bzp-{a['nummer']}",
        "date": a["veroeffentlicht"] or tag,
        "tag": ["tender"],
        "tender": {
            "title": a["titel"],
            "description": beschreibung[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in a["cpv"]] + [{"deliveryLocation": {"description": ort}, "deliveryAddress": {"postalCode": a["plz"], "locality": a["ort"]}}],
            "tenderPeriod": {"endDate": a["frist"].replace("Z", "+00:00")} if a["frist"] else {},
            "documents": [{"url": a["link"] or "https://ezamowienia.gov.pl/mo-client-board/bzp/list"}],
        },
        "buyer": {"name": a["auftraggeber"], "address": {"countryName": "Polen", "postalCode": a["plz"], "locality": a["ort"]}},
        "_land": "POL",
        "_quelle": "BZP",
        "_bzp": {"nummer": a["nummer"], "woiwodschaft": a["woiwodschaft"], "art": a["art"], "wert": a["wert"]},
    }


def releases(tag: str) -> list[dict]:
    """Contract notices published in BZP on this day; [] when the API is unreachable."""
    try:
        return [als_release(lesen(x), tag) for x in bekanntmachungen(tag)]
    except Exception as e:  # noqa: BLE001 – a BZP outage must not stop the alarm
        print(f"BZP nicht erreichbar ({tag}): {type(e).__name__}")
        return []


def woiwodschaften_der_bekanntmachung(rel: dict) -> set[str]:
    """Voivodeships of a Polish notice: from BZP directly, from TED via the NUTS codes of the place of performance."""
    w = (rel.get("_bzp") or {}).get("woiwodschaft")
    if w:
        return {w}
    texte = " ".join(str((i.get("deliveryLocation") or {}).get("description") or "") for i in (rel.get("tender") or {}).get("items") or [])
    return {NUTS[c[:4]] for c in re.findall(r"\bPL\d{2,3}\b", texte) if c[:4] in NUTS}


if __name__ == "__main__":
    r = releases(sys.argv[1])
    print(f"{len(r)} Ausschreibungen (BZP)")
    for x in r[:3]:
        print(json.dumps(x, ensure_ascii=False)[:900])
