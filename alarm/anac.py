"""Italian calls for tenders from ANAC's platform "Pubblicità a valore legale" (PVL), the legal publication of all
Italian public procurement notices since 01.01.2024 (all thresholds).

API: https://pubblicitalegale.anticorruzione.it/api/v0/avvisi (JSON, no login; the platform's own web app uses it).
robots.txt: the PVL host serves none (no rules), www.anticorruzione.it allows all (checked 02.11.2026, italien-test.yml).
Licence: ANAC publishes its data under CC BY 4.0 (www.anticorruzione.it/copyright, read 03.11.2026): free reuse incl.
commercial, cite the source and, where possible, link the original page. No contact persons are kept. Details:
docs/italien.md. Usage (test): python3 alarm/anac.py DD/MM/YYYY|YYYY-MM-DD
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://pubblicitalegale.anticorruzione.it/api/v0"
SEITE_LINK = "https://pubblicitalegale.anticorruzione.it/bandi/"
UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)", "Accept": "application/json"}
QUELLE = "Fonte: ANAC – Piattaforma Pubblicità a valore legale (CC BY 4.0)"
SEITE = 100
PAUSE = 3.0
PROVINZEN = json.loads((Path(__file__).parent / "province_it.json").read_text(encoding="utf-8"))
# ANAC gives the CPV only as its official Italian label ("Servizi di pulizia", checked 03.11.2026, italien-cpv.yml).
# Exact labels of the trades we track (alarm/cpv_it.json), then careful word rules; anything else stays without code
# (the AI still reads the label in the description).
CPV_IT = json.loads((Path(__file__).parent / "cpv_it.json").read_text(encoding="utf-8"))
CPV_REGELN = [
    (r"fornitura di personale", "79620000"),
    (r"\bpulizi[ae]\b(?!.*(strad|fogn|caditoi|spurgo|rifiut|condott|serbato|camin|navi|veicol))", "90910000"),
    (r"\b(vigilanza|guardia|pattugliamento)\b|servizi di sorveglianza|servizi di sicurezza", "79710000"),
    (r"zone verdi|giardin|\bparchi\b|taglio alberi|manutenzione alberi", "77310000"),
    (r"^lavori.*(installazione elettric|impianti elettrici|cablaggio)", "45311000"),
    (r"^lavori.*(idraulic|riscaldamento|ventilazione|condizionamento)", "45330000"),
    (r"^lavori di (verniciatura|tinteggiatura)", "45442100"),
    (r"^lavori di intonac", "45410000"),
    (r"^lavori.*falegnameria|installazione di porte e finestre", "45421000"),
    (r"^lavori.*(copertur|tetti)", "45261000"),
    (r"^lavori.*(piastrell|rivestimento di pavimenti|pavimentazione e rivestimento)", "45432000"),
]
_letzter = [0.0]


def _holen(pfad: str, params: dict, versuche: int = 3) -> dict:
    for i in range(versuche):
        warten = PAUSE - (time.monotonic() - _letzter[0])
        if warten > 0:
            time.sleep(warten)
        _letzter[0] = time.monotonic()
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{API}/{pfad}?{urllib.parse.urlencode(params)}", headers=UA), timeout=120) as r:
                daten = json.loads(r.read())
            return daten if isinstance(daten, dict) else {}
        except Exception:  # noqa: BLE001
            if i == versuche - 1:
                raise
            time.sleep(5 * (i + 1))
    return {}


def _tag(tag: str) -> str:
    """'2026-11-02' or '02/11/2026' -> '02/11/2026' (the API's format)."""
    return datetime.fromisoformat(tag).strftime("%d/%m/%Y") if "-" in tag else tag


def bekanntmachungen(tag: str) -> list[dict]:
    """All calls for tenders (Bandi, codiceScheda 2 and 4) published on this day. Raises when unreachable."""
    d, seite, alle = _tag(tag), 0, []
    while seite < 50:  # at most 5,000 per day
        antwort = _holen("avvisi", {"dataPubblicazioneStart": d, "dataPubblicazioneEnd": d, "sortField": "dataPubblicazione",
                                    "sortDirection": "ASC", "page": seite, "size": SEITE, "codiceScheda": "2,4"})
        teil = antwort.get("content") or []
        alle += teil
        seite += 1
        if not teil or seite >= int(antwort.get("totalPages") or 0):
            break
    return alle


def _template(x: dict) -> dict:
    t = x.get("templates") or x.get("template") or []
    return ((t[0] or {}).get("template") or {}) if t and isinstance(t[0], dict) else {}


def _felder(tpl: dict) -> tuple[dict, list[dict]]:
    """All plain fields of all sections, and the lots (items of section C or any list of dicts with a CIG)."""
    felder, lose = {}, []
    for s in tpl.get("sections") or []:
        for k, v in (s.get("fields") or {}).items():
            felder.setdefault(k, v)
        for item in s.get("items") or []:
            if isinstance(item, dict):
                lose.append(item)
    return felder, lose


def _region(ort: str) -> str | None:
    o = (ort or "").strip()
    if re.fullmatch(r"IT[C-I]\d\w?", o.upper()):
        return o.upper()[:4]
    return PROVINZEN.get(o.lower())


def cpv_code(etikett: str) -> str | None:
    e = (etikett or "").strip()
    if m := re.search(r"\b(\d{8})", e):
        return m.group(1)
    if code := CPV_IT.get(e.lower()):
        return code
    return next((c for muster, c in CPV_REGELN if re.search(muster, e.lower())), None)


def lesen(x: dict) -> dict:
    tpl = _template(x)
    meta = tpl.get("metadata") or {}
    felder, lose = _felder(tpl)
    sa = (felder.get("soggetti_sa") or [{}])[0] if isinstance(felder.get("soggetti_sa"), list) else {}
    orte = [str(l.get(k) or "") for l in lose for k in ("luogo_nuts", "luogo_istat") if l.get(k)]
    regioni = sorted({r for o in orte if (r := _region(o))})
    cpv_namen = list(dict.fromkeys(str(l.get("cpv")) for l in lose if l.get("cpv")))
    cpv_codes = list(dict.fromkeys(c for n in cpv_namen if (c := cpv_code(n))))
    werte = [l.get("valore_complessivo_stimato") for l in lose if l.get("valore_complessivo_stimato")]
    link = felder.get("documenti_di_gara_link") or next((l.get("documenti_di_gara_link") for l in lose if l.get("documenti_di_gara_link")), "")
    lose_text = [f"Lotto {l.get('cig') or i + 1}: {l.get('descrizione') or l.get('oggetto') or ''} ({l.get('natura_principale') or ''}, {l.get('cpv') or ''})".strip()
                 for i, l in enumerate(lose)]
    return {
        "id": x.get("idAvviso") or "",
        "titel": (meta.get("titolo") or meta.get("descrizione") or "").strip(),
        "beschreibung": " · ".join(filter(None, [(meta.get("descrizione") or "").strip(), "; ".join(lose_text[:20])])),
        "auftraggeber": (sa.get("denominazione_amministrazione") or "").strip(),
        "orte": list(dict.fromkeys(orte)),
        "regioni": regioni,
        "cpv": cpv_codes,
        "cpv_namen": cpv_namen,
        "frist": x.get("dataScadenza") or "",
        "veroeffentlicht": (x.get("dataPubblicazione") or "")[:10],
        "wert": werte[0] if len(werte) == 1 else (str(sum(float(w) for w in werte if re.fullmatch(r"[\d.]+", str(w)))) if werte else ""),
        "verfahren": felder.get("tipo_procedura_aggiudicazione") or "",
        "ted": meta.get("link_eform_ted") or "",
        "unterlagen": link if str(link).startswith("https://") else "",
        "aktiv": bool(x.get("attivo")) and not x.get("oscurato") and x.get("tipo") == "avviso",
    }


def als_release(a: dict, tag: str) -> dict:
    ort = ", ".join(filter(None, [*a["orte"], *a["regioni"], "Italia"]))
    beschreibung = " · ".join(filter(None, [a["beschreibung"], f"Valore stimato: {a['wert']} €" if a["wert"] else "",
                                            a["verfahren"], f"CPV: {'; '.join(a['cpv_namen'][:5])}" if a["cpv_namen"] else ""]))
    return {
        "ocid": f"anac-{a['id']}",
        "id": f"anac-{a['id']}",
        "date": a["veroeffentlicht"] or tag,
        "tag": ["tender"],
        "tender": {
            "title": a["titel"],
            "description": beschreibung[:4000],
            "items": [{"classification": {"scheme": "CPV", "id": c}} for c in a["cpv"]] + [{"deliveryLocation": {"description": ort}}],
            "tenderPeriod": {"endDate": a["frist"].replace(".000+00:00", "+00:00")} if a["frist"] else {},
            "documents": [{"url": a["unterlagen"] or SEITE_LINK + a["id"]}],
        },
        "buyer": {"name": a["auftraggeber"], "address": {"countryName": "Italien", "locality": (a["orte"] or [""])[0]}},
        "_land": "ITA",
        "_quelle": "ANAC",
        "_anac": {"regioni": a["regioni"], "ted": a["ted"], "seite": SEITE_LINK + a["id"]},
    }


def releases(tag: str) -> list[dict]:
    """Active first publications with a future deadline published on this day; [] when the API is unreachable."""
    jetzt = datetime.now(timezone.utc).isoformat()
    try:
        return [als_release(a, tag) for a in map(lesen, bekanntmachungen(tag))
                if a["aktiv"] and a["titel"] and (not a["frist"] or a["frist"] > jetzt)]
    except Exception as e:  # noqa: BLE001 – an outage must not stop the alarm
        print(f"ANAC nicht erreichbar ({tag}): {type(e).__name__}")
        return []


def ist_ted_kopie(rel: dict) -> bool:
    """Italian TED notices are also on the PVL (which forwards them to TED and is earlier): TED copies are dropped."""
    return rel.get("_quelle") != "ANAC" and rel.get("_land") == "ITA"


if __name__ == "__main__":
    r = releases(sys.argv[1])
    print(f"{len(r)} Ausschreibungen (ANAC PVL)")
    for x in r[:3]:
        print(json.dumps(x, ensure_ascii=False)[:1200])
