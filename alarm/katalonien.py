"""Catalan tenders from the open data portal of the Generalitat (Socrata dataset ybgg-dgi6, "Contractació pública a
Catalunya: publicacions a la Plataforma de serveis de contractació pública"). Covers all Catalan contracting authorities
(Generalitat, municipalities, provinces), below and above the EU thresholds; one row per lot and publication phase.

API: https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json (SoQL). robots.txt of the portal only blocks
search/browse pages; contractaciopublica.cat allows robots (crawl-delay 1). Licence: see docs/spanien.md (checked before
use). Licence: "Llicència oberta d'ús d'informació – Catalunya" (checked 02.11.2026): reuse, distribution and
transformation allowed worldwide; cite the source with the date of the last update, no Generalitat logos. Spain's
national platform PLACSP is not used: its robots.txt disallows everything.
Usage (test): python3 alarm/katalonien.py YYYY-MM-DD
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

API = "https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "Accept": "application/json"}
QUELLE = "Font: Plataforma de serveis de contractació pública, Generalitat de Catalunya (dades obertes)"
SEITE = 1000
KATALONIEN_AKTIV = True  # licence confirmed 02.11.2026 (docs/spanien.md)


def _holen(params: dict, versuche: int = 3) -> list[dict]:
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers=UA), timeout=90) as r:
                daten = json.loads(r.read())
            return daten if isinstance(daten, list) else []
        except Exception:  # noqa: BLE001
            if i == versuche - 1:
                raise
            time.sleep(5 * (i + 1))
    return []


def bekanntmachungen(tag: str) -> list[dict]:
    """Calls for tenders (phase "Anunci de licitació") published on this day, one row per lot."""
    start = datetime.fromisoformat(tag)
    ende = start + timedelta(days=1)
    where = (f"fase_publicacio='Anunci de licitació' AND data_publicacio_anunci >= '{start:%Y-%m-%dT%H:%M:%S}' "
             f"AND data_publicacio_anunci < '{ende:%Y-%m-%dT%H:%M:%S}'")
    zeilen, offset = [], 0
    while True:
        teil = _holen({"$where": where, "$limit": SEITE, "$offset": offset, "$order": "codi_expedient,numero_lot"})
        zeilen += teil
        if len(teil) < SEITE:
            return zeilen
        offset += SEITE
        time.sleep(1)


def _url(feld) -> str:
    u = feld.get("url", "") if isinstance(feld, dict) else str(feld or "")
    return u if u.startswith("https://") else ""


def zusammenfassen(zeilen: list[dict]) -> list[dict]:
    """One tender per file number (codi_expedient + body): lots become one entry with all lots and CPV codes."""
    gruppen: dict[str, list[dict]] = {}
    for z in zeilen:
        gruppen.setdefault(f"{z.get('codi_organ', '')}/{z.get('codi_expedient', '')}", []).append(z)
    aus = []
    for schluessel, teil in gruppen.items():
        z = teil[0]
        lose = [f"Lot {t.get('numero_lot')}: {t.get('descripcio_lot', '')}".strip() for t in teil if t.get("numero_lot")]
        aus.append({
            "id": schluessel,
            "titel": (z.get("denominacio") or "").strip(),
            "beschreibung": " · ".join(filter(None, [(z.get("objecte_contracte") or "").strip(), "; ".join(lose[:20])])),
            "auftraggeber": (z.get("nom_organ") or "").strip(),
            "ort": (z.get("lloc_execucio") or "").strip(),
            "nuts": sorted({t.get("codi_nuts") for t in teil if t.get("codi_nuts")}),
            "cpv": list(dict.fromkeys(c for t in teil for c in re.findall(r"\b(\d{8})-?\d?\b", t.get("codi_cpv") or ""))),
            "frist": z.get("termini_presentacio_ofertes") or "",
            "wert": z.get("valor_estimat_expedient") or z.get("valor_estimat_contracte") or "",
            "art": z.get("tipus_contracte") or "",
            "verfahren": z.get("procediment") or "",
            "veroeffentlicht": (z.get("data_publicacio_anunci") or "")[:10],
            "link": _url(z.get("enllac_publicacio")),
        })
    return aus


def _frist(wert: str) -> str:
    """Catalan deadlines carry no offset: local time Madrid (CET/CEST)."""
    w = wert[:19]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", w):
        return ""
    return w + ("+01:00" if w[5:7] in ("01", "02", "03", "11", "12") else "+02:00")


def als_release(a: dict, tag: str) -> dict:
    ort = ", ".join(filter(None, [a["ort"], *a["nuts"], "Catalunya", "España"]))
    beschreibung = " · ".join(filter(None, [a["beschreibung"], f"Valor estimat: {a['wert']} €" if a["wert"] else "", a["art"], a["verfahren"]]))
    frist = _frist(a["frist"])
    return {
        "ocid": f"cat-{a['id']}",
        "id": f"cat-{a['id']}",
        "date": a["veroeffentlicht"] or tag,
        "tag": ["tender"],
        "tender": {
            "title": a["titel"],
            "description": beschreibung[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in a["cpv"]] + [{"deliveryLocation": {"description": ort}}],
            "tenderPeriod": {"endDate": frist} if frist else {},
            "documents": [{"url": a["link"] or "https://contractaciopublica.cat"}],
        },
        "buyer": {"name": a["auftraggeber"], "address": {"countryName": "Spanien", "locality": a["ort"]}},
        "_land": "ESP",
        "_quelle": "Katalonien",
    }


def releases(tag: str) -> list[dict]:
    """Calls for tenders published in Catalonia on this day; [] when unreachable or not switched on."""
    if not KATALONIEN_AKTIV:
        return []
    try:
        return [als_release(a, tag) for a in zusammenfassen(bekanntmachungen(tag)) if a["titel"]]
    except Exception as e:  # noqa: BLE001 – an outage must not stop the alarm
        print(f"Katalonien nicht erreichbar ({tag}): {type(e).__name__}")
        return []


if __name__ == "__main__":
    KATALONIEN_AKTIV = True
    r = releases(sys.argv[1])
    print(f"{len(r)} Ausschreibungen (Katalonien)")
    for x in r[:3]:
        print(json.dumps(x, ensure_ascii=False)[:900])
