"""Fill missing deadlines in the catalog from the eForms exports (06.11.2026).

The OCDS export of oeffentlichevergabe.de (CC0) has no tenderPeriod, so ~34,700 catalog rows from source "bks" had no
deadline and counted as open forever. The deadline for tenders (BT-131) and for questions (BT-13) is in the eForms
notice of the same source. New days get them in the importer (web/src/katalog-daten.ts, eformsFristen); this script
fills the existing rows: catalog frist/status/lots/roh and, for firm records taken over from the catalog, only an empty
deadline (vorgaenge.frist / fragefrist). Nothing else in firm records is changed.

CLI: python3 katalog_fristen.py [--probe]   (--probe: count only, write nothing)
"""
import io
import json
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date, datetime, timedelta

from profile_db import verbinden

UA = "Crewtender-Katalog/1.0 (public procurement index)"
LOS = re.compile(r"<cac:ProcurementProjectLot>(.*?)</cac:ProcurementProjectLot>", re.S)


def zeit(datum: str | None, uhr: str | None) -> str | None:
    d = re.match(r"^(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})?$", (datum or "").strip())
    if not d:
        return None
    u = re.match(r"^(\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})?$", (uhr or "").strip())
    zone = (u and u.group(2)) or d.group(2) or "+01:00"
    zone = "+00:00" if zone == "Z" else zone
    t = (u.group(1) + (":00" if len(u.group(1)) == 5 else "")) if u else "23:59:59"
    try:
        return datetime.fromisoformat(f"{d.group(1)}T{t}{zone}").astimezone().isoformat()
    except ValueError:
        return None


def periode(xml: str, element: str) -> str | None:
    m = re.search(rf"<cac:{element}>(.*?)</cac:{element}>", xml, re.S)
    if not m:
        return None
    ende = re.search(r"<cbc:EndDate>([^<]+)<", m.group(1))
    uhr = re.search(r"<cbc:EndTime>([^<]+)<", m.group(1))
    return zeit(ende and ende.group(1), uhr and uhr.group(1))


def spaeteste(werte):
    werte = [w for w in werte if w]
    return max(werte, key=lambda w: datetime.fromisoformat(w)) if werte else None


def eforms_fristen(xml: str):
    nid = re.search(r'<cbc:ID schemeName="notice-id">([^<]+)<', xml)
    verfahren = re.search(r"<cbc:ContractFolderID>([^<]+)<", xml)
    if not nid and not verfahren:
        return None
    lose, fragen = {}, []
    for m in LOS.finditer(xml):
        los = re.search(r'<cbc:ID schemeName="Lot">([^<]+)<', m.group(1))
        f = periode(m.group(1), "TenderSubmissionDeadlinePeriod")
        if los and f:
            lose[los.group(1).strip()] = f
        fragen.append(periode(m.group(1), "AdditionalInformationRequestPeriod"))
    rest = LOS.sub("", xml)
    frist = spaeteste([periode(rest, "TenderSubmissionDeadlinePeriod"), *lose.values()])
    fragefrist = spaeteste([periode(rest, "AdditionalInformationRequestPeriod"), *fragen])
    if not frist and not fragefrist:
        return None
    ids = [x.group(1).strip() for x in (nid, verfahren) if x]
    return ids, {"frist": frist, "fragefrist": fragefrist, "lose": lose}


def export_lesen(tag: str) -> dict | None:
    req = urllib.request.Request(f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={tag}&format=eforms.zip", headers={"User-Agent": UA})
    daten = None
    # The source refuses connections after many downloads in a row: wait longer each time instead of pushing on.
    for versuch, pause in enumerate((0, 30, 90, 240)):
        time.sleep(pause)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                daten = r.read(30_000_000)
            break
        except Exception as e:  # noqa: BLE001
            print(f"{tag}: eForms-Export nicht lesbar, Versuch {versuch + 1} ({e})")
    if daten is None:
        return None
    karte = {}
    with zipfile.ZipFile(io.BytesIO(daten)) as z:
        for name in z.namelist():
            if name.endswith(".xml") and z.getinfo(name).file_size < 5_000_000:
                r = eforms_fristen(z.read(name).decode("utf-8", "replace"))
                if r:
                    for i in r[0]:
                        karte[i] = r[1]
    return karte


def main() -> None:
    probe = "--probe" in sys.argv
    with verbinden() as con:
        zeilen = con.execute("""select id, roh, lose, status, (quell_datum at time zone 'UTC')::date from public.vergabekatalog
                                where quelle = 'bks' and frist is null and status in ('offen', 'unbekannt')""").fetchall()
    print(f"{len(zeilen)} Bekanntmachungen ohne Frist")
    tage = sorted({d + timedelta(days=k) for *_, d in zeilen for k in (-1, 0, 1)} - {date.today(), date.today() + timedelta(days=1)})
    karte, fehlt = {}, []
    for tag in tage:
        teil = export_lesen(tag.isoformat())
        if teil is None:
            fehlt.append(tag.isoformat())
        else:
            karte.update(teil)
        time.sleep(6)
    print(f"{len(tage) - len(fehlt)} von {len(tage)} Tagesexporten gelesen, {len(karte)} Einträge mit Frist"
          + (f"; nicht lesbar: {', '.join(fehlt)} (beim nächsten Lauf erneut)" if fehlt else ""))
    neu = []
    for kid, roh, lose, status, _ in zeilen:
        roh = roh or {}
        verfahren = re.sub(r"^ocds-[a-z0-9]+-", "", str(roh.get("ocid") or kid.removeprefix("bks:")))
        f = karte.get(str(roh.get("id") or "")) or karte.get(verfahren)
        if not f or not f["frist"] and not f["fragefrist"]:
            continue
        t = dict(roh.get("tender") or {})
        if f["frist"] and not (t.get("tenderPeriod") or {}).get("endDate"):
            t["tenderPeriod"] = {**(t.get("tenderPeriod") or {}), "endDate": f["frist"]}
        if f["fragefrist"] and not (t.get("enquiryPeriod") or {}).get("endDate"):
            t["enquiryPeriod"] = {**(t.get("enquiryPeriod") or {}), "endDate": f["fragefrist"]}
        t["lots"] = [l if (l.get("tenderPeriod") or {}).get("endDate") or l.get("id") not in f["lose"]
                     else {**l, "tenderPeriod": {**(l.get("tenderPeriod") or {}), "endDate": f["lose"][l["id"]]}} for l in t.get("lots") or []]
        lose_neu = [{**l, "frist": l.get("frist") or f["lose"].get(l.get("id"))} for l in (lose or [])]
        frist = spaeteste([f["frist"], *[l["frist"] for l in lose_neu if l.get("frist")]])
        neu.append((frist, "offen" if frist and status == "unbekannt" else status, json.dumps(lose_neu), json.dumps({**roh, "tender": t}), kid))
    zukunft = sum(1 for x in neu if x[0] and datetime.fromisoformat(x[0]) > datetime.now().astimezone())
    print(f"{len(neu)} Bekanntmachungen bekommen eine Frist, davon noch offen (Frist in der Zukunft): {zukunft}")
    if probe:
        print("Probelauf: nichts geschrieben")
        return
    with verbinden() as con:
        for i in range(0, len(neu), 500):
            with con.cursor() as c:
                c.executemany("update public.vergabekatalog set frist = %s, status = %s, lose = %s::jsonb, roh = %s::jsonb where id = %s and frist is null", neu[i:i + 500])
            con.commit()
        n = con.execute("""update public.vorgaenge v set frist = k.frist from public.vergabekatalog k
                           where v.katalog_id = k.id and v.frist is null and k.frist is not null""").rowcount
        m = con.execute("""update public.vorgaenge v set fragefrist = (k.roh->'tender'->'enquiryPeriod'->>'endDate')::timestamptz from public.vergabekatalog k
                           where v.katalog_id = k.id and v.fragefrist is null and k.roh->'tender'->'enquiryPeriod'->>'endDate' is not null""").rowcount
        con.commit()
        rest = con.execute("select count(*) from public.vergabekatalog where quelle = 'bks' and frist is null and status in ('offen', 'unbekannt')").fetchone()[0]
    print(f"Geschrieben. Vorgänge der Firmen: {n} Fristen und {m} Fragefristen nachgetragen. Ohne Frist bleiben {rest} Bekanntmachungen (meist Zuschläge oder Vorinformationen).")


if __name__ == "__main__":
    main()
