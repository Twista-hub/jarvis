"""Read-only probe: why does /api/notices/<uuid>?format=eforms return 404? (oeffentlichevergabe.de, CC0)
Checks robots.txt and documentation pages, then a few releases of one daily OCDS export against the notice API
and the daily eForms export. No secrets, a handful of requests with the usual user agent."""
import io, json, re, sys, time, urllib.request, zipfile
import xml.etree.ElementTree as ET

UA = {"User-Agent": "JarvisAlarm/0.1 (WP Digital Ranger; kontakt@wpdigitalranger.com)"}
BASE = "https://oeffentlichevergabe.de"
DAY = sys.argv[1] if len(sys.argv) > 1 else "2026-11-02"
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def get(url, n=400):
    time.sleep(1)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            body = r.read()
            print(f"{r.status} {r.headers.get('Content-Type')} {len(body)} B  {url}")
            return body
    except urllib.error.HTTPError as e:
        print(f"{e.code} {url}  {e.read()[:n]!r}")
    except Exception as e:  # noqa: BLE001
        print(f"FEHLER {url}: {e}")
    return None


print("== robots / Doku ==")
r = get(f"{BASE}/robots.txt")
if r:
    print(r.decode(errors="replace")[:1500])
print("== OCDS-Export ==")
blob = get(f"{BASE}/api/notice-exports?pubDay={DAY}&format=ocds.zip")
rels = []
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    for name in z.namelist()[:400]:
        if name.endswith(".json"):
            d = json.loads(z.read(name))
            for rel in d.get("releases", []):
                if (rel.get("tender") or {}).get("title"):
                    rels.append((name, rel))
print(len(rels), "Releases gelesen")
for name, rel in rels[:1]:
    print("--", name, "ocid", rel.get("ocid"), "id", rel.get("id"), "tag", rel.get("tag"), "date", rel.get("date"))
    print("   tender.id", (rel.get("tender") or {}).get("id"), "keys", sorted(rel))
    for k in ("relatedProcesses", "planning"):
        if rel.get(k):
            print("  ", k, json.dumps(rel[k])[:300])
    kand = {re.search(UUID, str(rel.get("ocid"))).group(0) if re.search(UUID, str(rel.get("ocid"))) else None,
            re.search(UUID, str(rel.get("id"))).group(0) if re.search(UUID, str(rel.get("id"))) else None,
            str(rel.get("id"))} - {None}
    for k in kand:
        for v in ("", "&noticeVersion=1"):
            b = get(f"{BASE}/api/notices/{k}?format=eforms{v}", 200)
            if b:
                print("   XML-Anfang:", b[:300])
    if kand:
        get(f"{BASE}/api/notices/{sorted(kand)[0]}", 300)

print("== eForms-Export ==")
xb = get(f"{BASE}/api/notice-exports?pubDay={DAY}&format=eforms.zip")
if xb:
    with zipfile.ZipFile(io.BytesIO(xb)) as z:
        names = z.namelist()
        print(len(names), "Dateien; Beispiele:", names[:5])
        ocids = {re.search(UUID, r["ocid"]).group(0): r for _, r in rels if re.search(UUID, str(r.get("ocid")))}
        ids = {re.search(UUID, r["id"]).group(0): r for _, r in rels if re.search(UUID, str(r.get("id")))}
        treffer = {"ContractFolderID=ocid": 0, "NoticeID=release.id": 0, "Dateiname=release.id": 0, "geprueft": 0}
        for n in names[:300]:
            if not n.endswith(".xml"):
                continue
            root = ET.fromstring(z.read(n))
            folder = next((e.text for e in root.iter() if e.tag.endswith("}ContractFolderID")), None)
            nid = next((e.text for e in root if e.tag.endswith("}ID")), None)
            ver = next((e.text for e in root if e.tag.endswith("}VersionID")), None)
            if treffer["geprueft"] < 3:
                print("  ", n, "root", root.tag.split('}')[-1], "ID", nid, "Version", ver, "ContractFolderID", folder, "Länge", len(z.read(n)))
            treffer["geprueft"] += 1
            treffer["ContractFolderID=ocid"] += folder in ocids
            treffer["NoticeID=release.id"] += nid in ids
            treffer["Dateiname=release.id"] += any(i in n for i in ids)
        print("ZUORDNUNG", treffer)

print("== Neuer Abruf (alarm.eforms_text) mit Katalogzeilen ohne Release-ID ==")
sys.path.insert(0, "alarm")
from datetime import datetime, timezone
from alarm import eforms_text
geprueft = 0
for _, rel in rels:
    if geprueft >= 4 or not (rel.get("tag") and "tender" in rel["tag"]):
        continue
    if re.search(UUID, rel["ocid"]).group(0) == rel["id"] and geprueft >= 2:
        continue
    geprueft += 1
    utc = datetime.fromisoformat(rel["date"]).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    roh = {"ocid": rel["ocid"], "date": utc, "tender": rel["tender"]}
    text = eforms_text(roh)
    print(rel["ocid"], "Notice", rel["id"], "→", len(text), "Zeichen;", "Frist" if "TenderSubmissionDeadline" in text else "ohne Frist")
    text = eforms_text(roh | {"id": rel["id"]})
    print("   mit id →", len(text), "Zeichen")
