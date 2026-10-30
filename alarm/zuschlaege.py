"""Find a company in the German notice exports (Bekanntmachungsservice, CC0): award notices and any mention.
Usage: python3 alarm/zuschlaege.py <begriff> <tage>"""
import io
import json
import sys
import urllib.request
import zipfile
from datetime import date, timedelta

UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"}
begriff, tage = sys.argv[1].lower(), int(sys.argv[2])
funde = 0
for n in range(1, tage + 1):
    day = (date.today() - timedelta(days=n)).isoformat()
    url = f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={day}&format=ocds.zip"
    try:
        blob = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
    except Exception as e:  # noqa: BLE001
        print(day, "Fehler:", e)
        continue
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for name in z.namelist():
            if not name.endswith(".json"):
                continue
            raw = z.read(name)
            if begriff.encode() not in raw.lower():
                continue
            for rel in json.loads(raw).get("releases", []):
                text = json.dumps(rel, ensure_ascii=False)
                if begriff not in text.lower():
                    continue
                funde += 1
                t = rel.get("tender") or {}
                rollen = {p.get("name"): p.get("roles") for p in rel.get("parties") or [] if begriff in json.dumps(p, ensure_ascii=False).lower()}
                werte = [a.get("value") for a in rel.get("awards") or [] if a.get("value")]
                print(f"{day} | {','.join(rel.get('tag') or [])} | {(rel.get('buyer') or {}).get('name', '')} | {t.get('title', '')[:140]}")
                print(f"   Rolle: {rollen} | Wert: {werte[:3]} | ocid {rel.get('ocid')}")
print(f"{funde} Funde in {tage} Tagen")
