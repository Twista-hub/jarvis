"""Builds alarm/geo/plz.json (postal code -> [lat, lon]) from the GeoNames postal code file for Germany.

Source: GeoNames, https://download.geonames.org/export/zip/ (CC BY 4.0, attribution "GeoNames").
Usage: python3 alarm/geo/plz_bauen.py DE.txt
"""
import json
import sys
from pathlib import Path

punkte: dict[str, list[list[float]]] = {}
for zeile in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    teile = zeile.split("\t")
    if len(teile) < 11 or teile[0] != "DE" or not teile[1].isdigit() or len(teile[1]) != 5:
        continue
    try:
        punkte.setdefault(teile[1], []).append([float(teile[9]), float(teile[10])])
    except ValueError:
        continue
# One point per postal code: the mean of its places, rounded to about 100 m.
plz = {k: [round(sum(p[0] for p in v) / len(v), 3), round(sum(p[1] for p in v) / len(v), 3)] for k, v in sorted(punkte.items())}
Path(__file__).with_name("plz.json").write_text(json.dumps(plz, separators=(",", ":")), encoding="utf-8")
print(f"{len(plz)} Postleitzahlen geschrieben")
