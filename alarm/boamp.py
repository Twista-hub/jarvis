"""French tenders from BOAMP (Bulletin officiel des annonces des marchés publics) via the official DILA open data files.

Source: https://echanges.dila.gouv.fr/OPENDATA/BOAMP/YYYY/MM/DD/<idweb>.xml, one XML per notice, published daily,
Licence Ouverte / Open Licence 2.0 (data.gouv.fr "BOAMP", checked 02.11.2026): free reuse including commercial use,
the source must be named ("Source : BOAMP, DILA"). echanges.dila.gouv.fr has no robots.txt restrictions. We do not use
the Opendatasoft API: its robots.txt disallows /api/ for all crawlers except Googlebot.
BOAMP covers notices above the EU thresholds (also on TED) and national notices from 90 k€ (MAPA, FNS), about
eight times more than TED for France. Only calls for tenders (nature APPEL_OFFRE), no awards and no corrections.
Returns OCDS-like releases as alarm.py expects (like ted.py). Usage (test): python3 alarm/boamp.py YYYY-MM-DD
"""
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from xml.etree import ElementTree

BASIS = "https://echanges.dila.gouv.fr/OPENDATA/BOAMP"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"}
QUELLE = "Source : BOAMP, DILA (Licence Ouverte 2.0)"


def _holen(url: str, versuche: int = 3) -> bytes:
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            if i == versuche - 1:
                raise
            time.sleep(2 * (i + 1))
    return b""


def dateien(tag: str) -> list[str]:
    """Notice files of one publication day (directory listing of the open data server)."""
    j, m, t = tag[:4], tag[5:7], tag[8:10]
    try:
        html = _holen(f"{BASIS}/{j}/{m}/{t}/").decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        if "404" in str(e):
            return []
        raise
    return [f"{BASIS}/{j}/{m}/{t}/{n}" for n in dict.fromkeys(re.findall(r'href="(\d{2}-\d+\.xml)"', html))]


def _lokal(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _alle(wurzel, name: str) -> list:
    return [e for e in wurzel.iter() if _lokal(e.tag) == name]


def _text(e) -> str:
    return re.sub(r"\s+", " ", "".join(e.itertext())).strip() if e is not None else ""


def _erstes(wurzel, *namen: str) -> str:
    for n in namen:
        for e in _alle(wurzel, n):
            t = _text(e)
            if t:
                return t
    return ""


def lesen(xml: bytes) -> dict | None:
    """Fields of one BOAMP notice; None when it is not a call for tenders (award, correction) or unreadable."""
    try:
        wurzel = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        return None
    gestion = next(iter(_alle(wurzel, "GESTION")), None)
    if gestion is None:
        return None
    nature = next(iter(_alle(gestion, "NATURE")), None)
    if nature is None or not any(_lokal(k.tag) == "APPEL_OFFRE" for k in nature):
        return None
    statut = next(iter(_alle(gestion, "STATUT")), None)
    if statut is not None and not any(_lokal(k.tag) == "INITIAL" for k in statut):
        return None
    famille = next((_lokal(k.tag) for f in _alle(gestion, "FAMILLE") for k in f), "")
    donnees = next(iter(_alle(wurzel, "DONNEES")), wurzel)
    beschreibung = " ".join(dict.fromkeys(t for t in (_erstes(donnees, "description"), _erstes(donnees, "principales"), _erstes(donnees, "Description")) if t and len(t) > 20))
    cpv = list(dict.fromkeys(re.findall(r"\b(\d{8})\b", " ".join(_text(e) for n in ("classPrincipale", "classSupplementaire", "ItemClassificationCode") for e in _alle(donnees, n)))))
    cps = [c for c in (_text(e) for e in _alle(donnees, "cp")) if re.fullmatch(r"\d{5}", c)]
    cps += [c for c in (_text(e) for e in _alle(donnees, "PostalZone")) if re.fullmatch(r"\d{5}", c)]
    urls = [u for u in (_text(e) for n in ("urlDocConsul", "urlProfilAcheteur", "URI", "url") for e in _alle(donnees, n)) if u.startswith("http")]
    idweb = _erstes(gestion, "IDWEB")
    return {
        "idweb": idweb,
        "famille": famille,
        "acheteur": _erstes(gestion, "NOMORGANISME"),
        "publication": _erstes(gestion, "DATE_PUBLICATION"),
        "limite": _erstes(gestion, "DATE_LIMITE_REPONSE"),
        "objet": _erstes(gestion, "RESUME_OBJET") or _erstes(donnees, "intitule", "objet"),
        "descripteurs": [_text(e) for e in _alle(gestion, "LIBELLE")],
        "nature_marche": next((_lokal(k.tag).lower() for n in _alle(gestion, "NATURE_MARCHE") for k in n), ""),
        "departements": [_text(e) for e in _alle(gestion, "DEP_PUBLICATION")],
        "description": beschreibung[:4000],
        "cpv": cpv,
        "cp": cps[0] if cps else "",
        "ville": _erstes(donnees, "ville", "CityName"),
        "url_doc": next(iter(urls), ""),
        "url_avis": f"https://www.boamp.fr/pages/avis/?q=idweb:{idweb}" if idweb else "",
    }


def _frist(wert: str) -> str:
    """BOAMP deadlines come with or without offset; without one they are French local time (CET/CEST)."""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?", wert):
        return wert + ("+01:00" if wert[5:7] in ("01", "02", "03", "11", "12") else "+02:00")
    return wert.replace("Z", "+00:00")


def als_release(a: dict, tag: str) -> dict:
    ort = ", ".join(filter(None, [a["cp"], a["ville"], ("Département " + "/".join(a["departements"][:5])) if a["departements"] else "", "France"]))
    beschreibung = " · ".join(filter(None, [", ".join(a["descripteurs"]), a["description"]]))
    return {
        "ocid": f"boamp-{a['idweb']}",
        "id": f"boamp-{a['idweb']}",
        "date": a["publication"] or tag,
        "tag": ["tender"],
        "tender": {
            "title": a["objet"],
            "description": beschreibung[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in a["cpv"]] + [{"deliveryLocation": {"description": ort}}],
            "tenderPeriod": {"endDate": _frist(a["limite"])} if a["limite"] else {},
            "documents": [{"url": u} for u in (a["url_avis"], a["url_doc"]) if u],
        },
        "buyer": {"name": a["acheteur"], "address": {"countryName": "Frankreich", "postalCode": a["cp"], "locality": a["ville"]}},
        "_land": "FRA",
        "_quelle": "BOAMP",
        "_boamp": {"famille": a["famille"], "nature_marche": a["nature_marche"], "departements": a["departements"]},
    }


def bekanntmachungen(tag: str) -> list[dict]:
    """Fields (lesen) of all calls for tenders published on BOAMP on this day. Raises when the server is unreachable."""
    urls = dateien(tag)
    with ThreadPoolExecutor(max_workers=4) as pool:
        inhalte = list(pool.map(lambda u: _holen(u), urls))
    return [a for a in map(lesen, inhalte) if a and a["idweb"] and a["objet"]]


def releases(tag: str) -> list[dict]:
    """Calls for tenders published on BOAMP on this day; [] when the server is unreachable."""
    try:
        return [als_release(a, tag) for a in bekanntmachungen(tag)]
    except Exception as e:  # noqa: BLE001 – a BOAMP outage must not stop the alarm
        print(f"BOAMP nicht erreichbar ({tag}): {type(e).__name__}")
        return []


if __name__ == "__main__":
    r = releases(sys.argv[1])
    print(f"{len(r)} Ausschreibungen (Aufrufe zum Wettbewerb)")
    for x in r[:5]:
        print(json.dumps(x, ensure_ascii=False)[:900])
