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
# These words describe places, rooms or generic work; alone they do not identify a trade.
ALLGEMEIN = {"bad", "bäder", "baeder", "boden", "böden", "boeden", "bau", "arbeit", "arbeiten",
             "leistung", "leistungen", "sanierung", "firma", "unternehmen", "alles", "dazu",
             "drumherum", "umgebung", "suchen", "suche", "und", "oder", "für", "mit"}


def verbinden():
    import psycopg
    pw = urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"], safe="")
    # Short GitHub jobs use transaction pooling, leaving session slots for Hyperdrive.
    # Cursors and SET LOCAL stay inside their existing explicit transactions.
    for port in (6543, 5432):
        for host in ("aws-1-eu-central-1", "aws-0-eu-central-1"):
            try:
                return psycopg.connect(f"postgresql://postgres.{REF}:{pw}@{host}.pooler.supabase.com:{port}/postgres", connect_timeout=10, prepare_threshold=None)
            except psycopg.OperationalError:
                continue
    sys.exit("Keine Verbindung zur Datenbank")


# Filler words never count as search words (the AI suggestion once produced "dazu", "umgebung"); shared with the app.
FUELLWOERTER = set(json.load(open(os.path.join(os.path.dirname(__file__), "..", "web", "src", "fuellwoerter.json"), encoding="utf-8")))


def suchwort(w: str) -> bool:
    """A usable search word: at least 3 letters and not only filler words."""
    teile = re.findall(r"\w+", str(w).lower())
    return len(str(w).strip()) >= 3 and any(t not in FUELLWOERTER for t in teile)


def muster(woerter: list[str]) -> str:
    """Regex for a word list; umlauts also match their ae/oe/ue spelling."""
    teile = []
    for w in woerter:
        e = re.escape(w.lower().strip())
        for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
            e = e.replace(a, f"({a}|{b})")
        if e:
            # Match the start of a word, including German compounds (Fliesenarbeiten).
            # Short words must be complete: IT must not match 'Sanitär'.
            teile.append(r"(?<!\w)" + e + (r"(?!\w)" if len(w.strip()) <= 3 else ""))
    return "|".join(teile) or NIE


def standort_schluessel(name: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFKC", name).lower()
    text = re.sub(r"\((?:zentrale|hauptsitz|hauptniederlassung|niederlassung|standort)\)", "", text)
    text = re.sub(r"^(?:standort|niederlassung|geschäftsstelle)\s*[:–-]?\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def suchorte_fuer_standorte(e: dict) -> list[dict]:
    bisher = e.get("standorte") or []
    firmenstandorte = [o for o in e.get("firmenstandorte") or []
                      if isinstance(o, dict) and o.get("name") and str(o.get("quelle", "")).startswith("https://")][:40]
    if e.get("suchgebiet_modus") == "manuell" or not firmenstandorte:
        return bisher
    result, gesehen = [], set()
    for o in firmenstandorte:
        key = standort_schluessel(str(o["name"]))
        if key in gesehen:
            continue
        gesehen.add(key)
        alt = next((a for a in bisher if (o.get("bereich_id") and a.get("bereich_id") == o["bereich_id"])
                    or standort_schluessel(str(a.get("name", ""))) == key), {})
        plz = str(o.get("plz") or "")
        praefixe = sorted({str(p) for p in alt.get("plz_praefixe") or [] if re.fullmatch(r"\d{2}", str(p))}
                          | ({plz[:2]} if re.fullmatch(r"\d{5}", plz) else set()))
        bereich = o.get("bereich_id") or alt.get("bereich_id")
        result.append({"name": o["name"], "plz_praefixe": praefixe, **({"bereich_id": bereich} if bereich else {})})
    return result


def suchpunkte(e: dict, firmen_plz: str = "") -> list[dict]:
    """Coordinates of the locations Crewtender searches around: researched locations with a postal code, else the firm's seat."""
    from geo_radius import koordinaten
    quellen = [(str(o.get("name", "")), str(o.get("plz") or "")) for o in e.get("firmenstandorte") or [] if isinstance(o, dict)]
    if e.get("suchgebiet_modus") == "manuell" or not quellen:
        orte = e.get("standorte") or []
        quellen = [(str(o.get("name", "")), str(o.get("plz") or (firmen_plz if len(orte) <= 1 else ""))) for o in orte] or [("Firmensitz", firmen_plz)]
    punkte = []
    for name, plz in quellen[:40]:
        k = koordinaten(plz)
        if k:
            punkte.append({"name": name or plz, "plz": plz, "lat": k[0], "lon": k[1]})
    return punkte


DEPARTEMENTS = {c for r in json.loads((ROOT / "departements.json").read_text(encoding="utf-8")).values() for c in r}
WOIWODSCHAFTEN = set(json.loads((ROOT / "woiwodschaften.json").read_text(encoding="utf-8")))
COMUNIDADES = set(json.loads((ROOT / "comunidades.json").read_text(encoding="utf-8")))
REGIONI = set(json.loads((ROOT / "regioni.json").read_text(encoding="utf-8")))
BUNDESLAENDER_AT = set(json.loads((ROOT / "bundeslaender_at.json").read_text(encoding="utf-8")))


def nuts_der_bekanntmachung(rel: dict, land: str) -> set[str]:
    """NUTS-2 regions (e.g. ES30) named in the places of a notice (TED gives NUTS-3 codes such as ES300)."""
    texte = " ".join(str((i.get("deliveryLocation") or {}).get("description") or "") for i in (rel.get("tender") or {}).get("items") or [])
    # Italian codes have a letter in third place (ITC4, ITI43); Spanish and Polish ones only digits.
    return {c[:4] for c in re.findall(rf"\b{land}[0-9A-Z]\d{{1,2}}\b", texte)}


def departement_aus_plz(plz: str) -> str | None:
    """Département of a French postal code: 75011 → 75, 20000 → 2A, 20200 → 2B, 97400 → 974."""
    if not re.fullmatch(r"\d{5}", plz or ""):
        return None
    code = ("2A" if int(plz[2]) <= 1 else "2B") if plz.startswith("20") else plz[:3] if plz.startswith("97") else plz[:2]
    return code if code in DEPARTEMENTS else None


def departements_der_bekanntmachung(rel: dict) -> set[str]:
    """Départements of a French notice: BOAMP publication départements, else the postal codes of the places."""
    deps = {str(d).strip().upper() for d in (rel.get("_boamp") or {}).get("departements") or []}
    deps = {d.zfill(2) if d.isdigit() and len(d) == 1 else d[1:] if len(d) == 3 and d.startswith("0") else d for d in deps} & DEPARTEMENTS
    if deps:
        return deps
    texte = [str((i.get("deliveryAddress") or {}).get("postalCode", "")) + " " + str((i.get("deliveryLocation") or {}).get("description") or "")
             for i in (rel.get("tender") or {}).get("items") or []]
    texte.append(str(((rel.get("buyer") or {}).get("address") or {}).get("postalCode") or ""))
    return {d for t in texte for plz in re.findall(r"\b(\d{5})\b", t) if (d := departement_aus_plz(plz))}


def im_suchgebiet(profile: dict, rel: dict) -> bool:
    """Limit app profiles to tender delivery locations; profiles without places stay nationwide."""
    # France: the chosen départements decide (no choice = all of France). German search places and the km radius do
    # not apply to French notices: their postal codes would collide with German ones (75… Pforzheim vs. 75… Paris).
    if rel.get("_land") == "ITA":
        gewaehlt = set(profile.get("regioni") or [])
        bekannt = (set((rel.get("_anac") or {}).get("regioni") or []) or nuts_der_bekanntmachung(rel, "IT")) & REGIONI
        return not gewaehlt or not bekannt or bool(gewaehlt & bekannt)
    if rel.get("_land") == "AUT":  # federal states from the NUTS code of the place (national Kerndaten and TED)
        gewaehlt = set(profile.get("bundeslaender") or [])
        bekannt = (nuts_der_bekanntmachung(rel, "AT") | {str((rel.get("_at") or {}).get("nuts") or "")[:4]}) & BUNDESLAENDER_AT
        return not gewaehlt or not bekannt or bool(gewaehlt & bekannt)
    if rel.get("_land") == "ESP":
        gewaehlt = set(profile.get("comunidades") or [])
        bekannt = nuts_der_bekanntmachung(rel, "ES") & COMUNIDADES
        return not gewaehlt or not bekannt or bool(gewaehlt & bekannt)
    if rel.get("_land") == "POL":
        from bzp import woiwodschaften_der_bekanntmachung
        gewaehlt = set(profile.get("woiwodschaften") or [])
        bekannt = woiwodschaften_der_bekanntmachung(rel)
        return not gewaehlt or not bekannt or bool(gewaehlt & bekannt)
    if rel.get("_land") == "FRA":
        gewaehlt = set(profile.get("departements") or [])
        bekannt = departements_der_bekanntmachung(rel)
        return not gewaehlt or not bekannt or bool(gewaehlt & bekannt)
    suchorte = profile.get("suchorte") or []
    if not suchorte:
        return True
    items = (rel.get("tender") or {}).get("items") or []
    if not items:
        return False
    # Radius in km around the firm's locations, when set and the notice names a known postal code.
    radius = profile.get("radius_km")
    punkte = [p for p in profile.get("suchpunkte") or [] if p.get("lat") is not None]
    # The coordinates are German postal codes only; other countries are matched by place names and prefixes below.
    if radius and punkte and (rel.get("_land") or "DEU") == "DEU":
        from geo_radius import entfernung_km, koordinaten
        bekannt = False
        for item in items:
            text = str((item.get("deliveryAddress") or {}).get("postalCode", "")) + " " + str((item.get("deliveryLocation") or {}).get("description") or "")
            for plz in re.findall(r"\b(\d{5})\b", text):
                ziel = koordinaten(plz)
                if ziel:
                    bekannt = True
                    if any(entfernung_km([p["lat"], p["lon"]], ziel) <= radius for p in punkte):
                        return True
        if bekannt:
            return False  # Known place outside every radius; names alone do not override the distance.
    for ort in suchorte:
        name = standort_schluessel(str(ort.get("name", "")))
        praefixe = [str(p) for p in ort.get("plz_praefixe", []) if re.fullmatch(r"\d{2}", str(p))]
        for item in items:
            adresse = item.get("deliveryAddress") or {}
            beschreibung = (item.get("deliveryLocation") or {}).get("description") or ""
            ortstext = " ".join(str(adresse.get(k, "")) for k in ("postalCode", "locality", "streetAddress")) + " " + str(beschreibung)
            if praefixe:
                postleitzahl = re.search(r"\b(\d{5})\b", ortstext)
                if postleitzahl and postleitzahl.group(1)[:2] in praefixe:
                    return True
            if name and re.search(rf"(?<![\w]){re.escape(name)}(?![\w])", ortstext, re.IGNORECASE):
                return True
    return False


def nicht_mehr_aktuelle_treffer(vorgaenge: list[tuple[str, str]], aktuelle_ids: set[str]) -> list[str]:
    """IDs of untouched search hits absent from a complete, current search result."""
    return [vorgang_id for vorgang_id, quelle_id in vorgaenge if quelle_id not in aktuelle_ids]


def namen_norm(text: str) -> str:
    """Buyer names compared without case, umlauts and punctuation ("Stadt Köln" = "stadt koeln")."""
    t = str(text or "").lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def namen_liste(werte) -> list[str]:
    return [n for n in (namen_norm(w) for w in (werte if isinstance(werte, list) else [])[:30]) if len(n) >= 3]


def betrag_oder_none(wert):
    try:
        n = float(wert)
    except (TypeError, ValueError):
        return None
    return n if 0 < n <= 1e10 else None


def aus_db(firma_id: str, name: str, beschreibung: str, e: dict, firmen_plz: str = "") -> dict:
    """Converts a saved profile into the format of profile.json."""
    leistungen = e.get("leistungen") or []
    standorte = suchorte_fuer_standorte(e)
    ortswoerter = {w for o in standorte for w in re.findall(r"\w+", str(o.get("name", "")).lower())}
    woerter = muster([w for l in leistungen for w in l.get("woerter", []) if suchwort(w)])
    stark = muster([w for l in leistungen for w in l.get("woerter", [])
                    if suchwort(w) and w.lower().strip() not in ALLGEMEIN | ortswoerter])
    firmen_prefix = firmen_plz[:2] if re.fullmatch(r"\d{5}", str(firmen_plz or "")) else ""
    def plz_bereiche(o: dict) -> list[str]:
        return o.get("plz_praefixe") or ([firmen_prefix] if firmen_prefix and len(standorte) == 1 else [])
    bewertungstext = "\n\n".join(filter(None, [
        "Gesuchte Arbeiten: " + ", ".join(l.get("name", "") for l in leistungen),
        beschreibung.strip(), str(e.get("website_beschreibung") or "").strip(),
        str(e.get("websuche_beschreibung") or "").strip()]))
    return {
        "name": name,
        "cpv": sorted({c for l in leistungen for c in l.get("cpv", [])}),
        "words": woerter,
        "strong": stark,
        "exclude": muster(e.get("ausschluss") or []),
        "exclude_cpv": e.get("ausschluss_cpv") or [],
        # Preserve the user's description in the app; give scoring both sources explicitly.
        "beschreibung": bewertungstext,
        "firma_id": firma_id,
        # These locations constrain which notices enter this firm's hit list.
        # If the simple fallback could not derive a postal area, use the firm's postal area
        # as a wider starting point for a single named search location instead of exact-city-only.
        "suchorte": [{"name": o.get("name", ""), "plz_praefixe": plz_bereiche(o)}
                     for o in standorte if o.get("name")],
        "regionen": {o["bereich_id"]: plz_bereiche(o) for o in standorte if o.get("bereich_id")},
        # Countries to search (ISO3). Germany = Bekanntmachungsservice, others = TED. Default: Germany only.
        "laender": [l for l in e.get("laender") or ["DEU"] if isinstance(l, str) and len(l) == 3] or ["DEU"],
        # Language of AI texts: chosen at setup (app language), else English when no German-speaking country is searched.
        # Only set for English, so German profiles keep their version (katalog.profil_version) and are not re-scored.
        **({"sprache": sprache(e)} if sprache(e) != "de" else {}),
        # French départements (search area for French notices); only set when chosen, like the language.
        **({"departements": deps} if (deps := sorted({str(d).upper() for d in e.get("departements") or []} & DEPARTEMENTS)) else {}),
        # Polish voivodeships (search area for Polish notices), only when chosen.
        **({"woiwodschaften": woj} if (woj := sorted({str(w) for w in e.get("woiwodschaften") or []} & WOIWODSCHAFTEN)) else {}),
        # Spanish autonomous communities (NUTS-2), only when chosen.
        **({"comunidades": com} if (com := sorted({str(c).upper() for c in e.get("comunidades") or []} & COMUNIDADES)) else {}),
        # Italian regions (NUTS-2), only when chosen.
        **({"regioni": reg} if (reg := sorted({str(c).upper() for c in e.get("regioni") or []} & REGIONI)) else {}),
        # Austrian federal states (NUTS-2), only when chosen.
        **({"bundeslaender": bl} if (bl := sorted({str(c).upper() for c in e.get("bundeslaender") or []} & BUNDESLAENDER_AT)) else {}),
        # Search radius in km and the coordinates of the firm's locations (postal codes via GeoNames).
        "radius_km": min(300, max(10, int(e.get("radius_km")))) if str(e.get("radius_km") or "").isdigit() else None,
        # Region mode: also rate notices without matching words when the known place is within the radius.
        "regionsmodus": e.get("regionsmodus") is True,
        "suchpunkte": suchpunkte(e, firmen_plz),
        # Lowest score shown as a hit (set in the app, default 6/10).
        "min_punkte": min(9, max(3, int(e.get("min_punkte") or 6))) if str(e.get("min_punkte") or "6").isdigit() else 6,
        # Filters that only decide what is shown (H2, H4, H5); they are not part of the profile version, so changing
        # them never triggers a paid re-scoring (katalog.profil_version).
        "exclude_schnell": muster(e.get("ausschluss_schnell") or []),
        "auftraggeber_bevorzugt": namen_liste(e.get("auftraggeber_bevorzugt")),
        "auftraggeber_aus": namen_liste(e.get("auftraggeber_aus")),
        "wert_min": betrag_oder_none(e.get("wert_min")),
        "wert_max": betrag_oder_none(e.get("wert_max")),
        "wert_unbekannt": e.get("wert_unbekannt", True) is not False,
        **({"standorte": standorte, "suchgebiet_modus": "firmenstandorte"}
           if e.get("firmenstandorte") and e.get("suchgebiet_modus") != "manuell" else {}),
    }


def zusatz_profile(key: str, firma_id: str, name: str, beschreibung: str, e: dict, firmen_plz: str = "") -> dict:
    """Further search profiles of a firm (H3, e.g. one per business area): same search area and filters as the main
    profile, own search words, exclusions, minimum score and optionally an area that receives the hits."""
    result = {}
    for z in (e.get("zusatzprofile") or [])[:3]:
        if not isinstance(z, dict) or not re.fullmatch(r"[0-9a-f-]{8,36}", str(z.get("id", ""))):
            continue
        woerter = [str(w) for w in z.get("woerter") or [] if 3 <= len(str(w).strip()) <= 60 and suchwort(w)][:30]
        if not str(z.get("name", "")).strip() or not woerter:
            continue
        teil = dict(e, leistungen=[{"name": str(z["name"])[:60], "cpv": [], "woerter": woerter}],
                    ausschluss=list(e.get("ausschluss") or []) + [str(w) for w in z.get("ausschluss") or []][:30],
                    min_punkte=z.get("min_punkte") or e.get("min_punkte"), zusatzprofile=[])
        p = aus_db(firma_id, f"{name} · {str(z['name'])[:60]}", "\n\n".join(filter(None, [str(z.get("beschreibung") or "")[:500], beschreibung])), teil, firmen_plz)
        bereich = str(z.get("bereich_id") or "")
        p.update(zusatz=True, haupt_id=key, **({"bereich_id": bereich} if re.fullmatch(r"[0-9a-f-]{36}", bereich) else {}))
        result[f"{key}#{str(z['id'])[:8]}"] = p
    return result


DEUTSCHSPRACHIG = {"DEU", "AUT", "CHE", "LIE", "LUX"}
FRANZOESISCHSPRACHIG = {"FRA", "BEL", "MCO"}
# Language of the AI texts when a firm searches only countries of one language (besides German, which always wins).
LANDESSPRACHE = {**{l: "fr" for l in FRANZOESISCHSPRACHIG}, "POL": "pl", "ESP": "es", "ITA": "it", "SMR": "it", "VAT": "it"}
SPRACHEN = ("de", "en", "fr", "pl", "es", "it")


def sprache(e: dict) -> str:
    """Language of the AI texts of a firm: einstellungen.sprache wins, else derived from the search countries (any
    German-speaking country → German, only countries of one other language → that language, otherwise English)."""
    if e.get("sprache") in SPRACHEN:
        return e["sprache"]
    laender = [l for l in e.get("laender") or ["DEU"] if isinstance(l, str)]
    if any(l in DEUTSCHSPRACHIG for l in laender):
        return "de"
    eigene = {LANDESSPRACHE.get(l) for l in laender}
    return eigene.pop() if len(eigene) == 1 and None not in eigene else "en"


# Plan limits of the search (mirror of SQL jarvis_intern.plan_grenze, migration 20261107020000): number of countries and
# further search profiles. Plans not listed (pro, probe, business, test) search all chosen countries and up to 3 extras.
PLAN_LAENDER = {"kostenlos": 1, "basis": 2}
PLAN_ZUSATZ = {"kostenlos": 0, "basis": 2}


def nach_plan(e: dict, plan: str | None) -> dict:
    """Search settings cut to the firm's plan (after a downgrade nothing is deleted, the search just uses less)."""
    if not plan or plan not in PLAN_LAENDER:
        return e
    laender = [l for l in e.get("laender") or ["DEU"] if isinstance(l, str) and len(l) == 3] or ["DEU"]
    return dict(e, laender=laender[:PLAN_LAENDER[plan]], zusatzprofile=list(e.get("zusatzprofile") or [])[:PLAN_ZUSATZ[plan]])


def plaene(con) -> dict:
    """Effective plan per firm; empty while the plan function is not there yet."""
    try:
        if not con.execute("select to_regprocedure('jarvis_intern.plan_von(uuid)')").fetchone()[0]:
            return {}
        return dict(con.execute("select id::text, jarvis_intern.plan_von(id) from public.firmen").fetchall())
    except Exception as e:  # noqa: BLE001 - without plans the search runs as before
        print(f"Pläne nicht geladen: {e}", file=sys.stderr)
        return {}


def laden() -> dict:
    profile = json.loads((ROOT / "profile.json").read_text(encoding="utf-8"))
    if not os.environ.get("SUPABASE_DB_PASSWORD"):
        return {k: p for k, p in profile.items() if not p.get("pausiert")}
    try:
        with verbinden() as con:
            rows = con.execute(
                """select s.firma_id::text, f.name, s.beschreibung, s.einstellungen, f.plz from public.suchprofile s
                   join public.firmen f on f.id = s.firma_id where s.aktiv and s.bereich_id is null""").fetchall()
            plan_je_firma = plaene(con)
    except Exception as e:  # noqa: BLE001 - the alarm still runs with the hand-made profiles
        print(f"Suchprofile aus der App nicht geladen: {e}", file=sys.stderr)
        return profile
    for firma_id, name, beschreibung, e, plz in rows:
        # Example firms (supabase/demo) never take part in the daily paid AI search; only a run started by hand for exactly
        # this firm (alarm.yml input "firma") searches for them.
        if not (e or {}).get("leistungen") or ((e or {}).get("demo") is True and os.environ.get("FIRMA") != firma_id):
            continue
        e = nach_plan(e or {}, plan_je_firma.get(firma_id))
        key = next((k for k, p in profile.items() if p.get("firma_id") == firma_id and not p.get("zusatz")), f"firma-{firma_id}")
        profile[key] = aus_db(firma_id, name, beschreibung, e, plz)
        profile.update(zusatz_profile(key, firma_id, name, beschreibung, e, plz))
    try:
        with verbinden() as con:
            abos = con.execute("select firma_id::text,auftraggeber_id from public.auftraggeber_abos").fetchall() if con.execute("select to_regclass('public.auftraggeber_abos')").fetchone()[0] else []
        for p in profile.values():
            # Watched buyers only in the main profile, so their notices are not listed twice.
            p["beobachtete_auftraggeber"] = [] if p.get("zusatz") else [buyer for f, buyer in abos if f == p.get("firma_id")]
    except Exception:
        print("Auftraggeber-Beobachtungen vorübergehend nicht geladen", file=sys.stderr)
    # Paused hand-made profiles (profile.json "pausiert") take no part in the daily paid search either.
    profile = {k: p for k, p in profile.items() if not p.get("pausiert") or os.environ.get("FIRMA") == p.get("firma_id")}
    print(f"Suchprofile: {len(profile)} ({len(rows)} aus der App)", file=sys.stderr)
    return profile
