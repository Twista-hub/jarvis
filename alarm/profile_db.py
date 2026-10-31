"""Search profiles: alarm/profile.json (set up by hand) plus the profiles firms saved with the setup
assistant in the app (table suchprofile). A saved profile replaces the hand-made one of the same firm.
Without SUPABASE_DB_PASSWORD only profile.json is used."""
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).parent
REF = "juuuifrcxmitkqudqngq"
NIE = r"(?!x)x"  # a pattern that never matches (an empty pattern would match everything)


def verbinden():
    import psycopg
    pw = urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"], safe="")
    for host in ("aws-1-eu-central-1", "aws-0-eu-central-1"):
        try:
            return psycopg.connect(f"postgresql://postgres.{REF}:{pw}@{host}.pooler.supabase.com:5432/postgres", connect_timeout=10)
        except psycopg.OperationalError:
            continue
    sys.exit("Keine Verbindung zur Datenbank")


def muster(woerter: list[str]) -> str:
    """Regex for a word list; umlauts also match their ae/oe/ue spelling."""
    teile = []
    for w in woerter:
        e = re.escape(w.lower().strip())
        for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
            e = e.replace(a, f"({a}|{b})")
        if e:
            teile.append(e)
    return "|".join(teile) or NIE


def im_suchgebiet(profile: dict, rel: dict) -> bool:
    """Limit app profiles to tender delivery locations; profiles without places stay nationwide."""
    suchorte = profile.get("suchorte") or []
    if not suchorte:
        return True
    items = (rel.get("tender") or {}).get("items") or []
    if not items:
        return False
    for ort in suchorte:
        name = re.sub(r"\s+", " ", str(ort.get("name", ""))).strip().casefold()
        praefixe = [str(p) for p in ort.get("plz_praefixe", []) if re.fullmatch(r"\d{2}", str(p))]
        for item in items:
            adresse = item.get("deliveryAddress") or {}
            beschreibung = (item.get("deliveryLocation") or {}).get("description") or ""
            ortstext = " ".join(str(adresse.get(k, "")) for k in ("postalCode", "locality", "streetAddress")) + " " + str(beschreibung)
            if praefixe:
                postleitzahl = re.search(r"\b(\d{5})\b", ortstext)
                if postleitzahl and postleitzahl.group(1)[:2] in praefixe:
                    return True
            elif name and re.search(rf"(?<![\w]){re.escape(name)}(?![\w])", ortstext, re.IGNORECASE):
                return True
    return False


def aus_db(firma_id: str, name: str, beschreibung: str, e: dict) -> dict:
    """Converts a saved profile into the format of profile.json."""
    leistungen = e.get("leistungen") or []
    woerter = muster([w for l in leistungen for w in l.get("woerter", [])])
    return {
        "name": name,
        "cpv": sorted({c for l in leistungen for c in l.get("cpv", [])}),
        "words": woerter,
        "strong": woerter,
        "exclude": muster(e.get("ausschluss") or []),
        "exclude_cpv": e.get("ausschluss_cpv") or [],
        "beschreibung": beschreibung,
        "firma_id": firma_id,
        # These locations constrain which notices enter this firm's hit list.
        "suchorte": [{"name": o.get("name", ""), "plz_praefixe": o.get("plz_praefixe", [])}
                     for o in e.get("standorte") or [] if o.get("name")],
        "regionen": {o["bereich_id"]: o.get("plz_praefixe", []) for o in e.get("standorte") or [] if o.get("bereich_id")},
        # Countries to search (ISO3). Germany = Bekanntmachungsservice, others = TED. Default: Germany only.
        "laender": [l for l in e.get("laender") or ["DEU"] if isinstance(l, str) and len(l) == 3] or ["DEU"],
    }


def laden() -> dict:
    profile = json.loads((ROOT / "profile.json").read_text(encoding="utf-8"))
    if not os.environ.get("SUPABASE_DB_PASSWORD"):
        return profile
    try:
        with verbinden() as con:
            rows = con.execute(
                """select s.firma_id::text, f.name, s.beschreibung, s.einstellungen from public.suchprofile s
                   join public.firmen f on f.id = s.firma_id where s.aktiv and s.bereich_id is null""").fetchall()
    except Exception as e:  # noqa: BLE001 - the alarm still runs with the hand-made profiles
        print(f"Suchprofile aus der App nicht geladen: {e}", file=sys.stderr)
        return profile
    for firma_id, name, beschreibung, e in rows:
        if not (e or {}).get("leistungen"):
            continue
        key = next((k for k, p in profile.items() if p.get("firma_id") == firma_id), f"firma-{firma_id}")
        profile[key] = aus_db(firma_id, name, beschreibung, e)
    try:
        with verbinden() as con:
            abos = con.execute("select firma_id::text,auftraggeber_id from public.auftraggeber_abos").fetchall() if con.execute("select to_regclass('public.auftraggeber_abos')").fetchone()[0] else []
        for p in profile.values():
            p["beobachtete_auftraggeber"] = [buyer for f, buyer in abos if f == p.get("firma_id")]
    except Exception:
        print("Auftraggeber-Beobachtungen vorübergehend nicht geladen", file=sys.stderr)
    print(f"Suchprofile: {len(profile)} ({len(rows)} aus der App)", file=sys.stderr)
    return profile
