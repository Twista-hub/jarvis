"""Distances between German postal codes for the search radius (coordinates: alarm/geo/plz.json, GeoNames CC BY 4.0)."""
import json
import math
import re
from functools import lru_cache
from pathlib import Path

DATEI = Path(__file__).parent / "geo" / "plz.json"


@lru_cache(maxsize=1)
def _tabelle() -> dict:
    return json.loads(DATEI.read_text(encoding="utf-8")) if DATEI.exists() else {}


def koordinaten(plz: str):
    """[lat, lon] of a five-digit postal code, or None when unknown."""
    return _tabelle().get(plz) if re.fullmatch(r"\d{5}", str(plz or "")) else None


def entfernung_km(a, b) -> float:
    """Great-circle distance in km between two [lat, lon] points."""
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))
