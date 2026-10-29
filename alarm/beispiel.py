"""Prints one full OCDS release that matches a keyword, to learn the field layout."""
import io, json, sys, urllib.request, zipfile
from datetime import date, timedelta

word = sys.argv[1].lower()
day = date.today() - timedelta(days=int(sys.argv[2]) if len(sys.argv) > 2 else 2)
url = f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={day.isoformat()}&format=ocds.zip"
blob = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "JarvisAlarm/0.1"}), timeout=120).read()
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    for name in z.namelist():
        data = json.loads(z.read(name))
        for rel in data.get("releases", []):
            if word in json.dumps(rel, ensure_ascii=False).lower() and "tender" in rel.get("tag", []):
                print(json.dumps({k: v for k, v in data.items() if k != "releases"}, ensure_ascii=False)[:800])
                print(json.dumps(rel, ensure_ascii=False, indent=1)[:9000])
                sys.exit(0)
print("nichts gefunden")
