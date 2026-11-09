"""Replace the old title-search links of catalog notices with the notice page on oeffentlichevergabe.de (09.11.2026).

Until 09.11.2026 the importer linked to the portal search with the notice title (…/ui/de/search?q=<title>); the search
shows thousands of other notices (Benjamin: "Digitales Kulturwerk Lübeck" opened unrelated tenders). The notice page is
…/ui/de/notices/<notice id>. For national notices the number in the OCDS id is the notice id (migration
20261110000000 fixes those in the database). For EU notices the OCDS id carries the procedure UUID, not the notice
UUID, and older rows did not keep the release id; this script reads the public daily OCDS exports (CC0) of those days and
takes the release id from there. Only the link of the catalog row and of firm records still holding the old search link
is changed. Since the click check of 09.11.2026 also links that only name a portal (no number after the host, e.g.
http://www.evergabe-online.de): they opened the portal's start page.

CLI: python3 katalog_links.py [--probe]
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
SUCHE = "https://oeffentlichevergabe.de/ui/de/search?q=%"
# Title search or a link without any number after the host (only the portal's start or list page).
ERSETZEN = "(link like 'https://oeffentlichevergabe.de/ui/de/search?q=%%' or substring(link from '^https?://[^/?#]+(.*)$') !~ '[0-9]')"
SEITE = "https://oeffentlichevergabe.de/ui/de/notices/"
KENNUNG = re.compile(r"^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]{6,12})$")


def releases(paket: dict) -> list[tuple[str, str, str]]:
    """(ocid, release id, date) of every release in one OCDS package with a usable notice id."""
    aus = []
    for rel in paket.get("releases") or []:
        ocid, rid = str(rel.get("ocid") or ""), str(rel.get("id") or "").lower()
        if ocid and KENNUNG.match(rid):
            aus.append((ocid, rid, str(rel.get("date") or "")))
    return aus


def waehlen(kandidaten: list[tuple[str, str]], quell_datum: str) -> str | None:
    """The release published closest to the row's source date (a procedure can have several notices)."""
    if not kandidaten:
        return None
    try:
        ziel = datetime.fromisoformat(quell_datum.replace("Z", "+00:00"))
    except ValueError:
        return kandidaten[-1][0]

    def abstand(k):
        try:
            return abs((datetime.fromisoformat(k[1].replace("Z", "+00:00")) - ziel).total_seconds())
        except ValueError:
            return float("inf")
    return min(kandidaten, key=abstand)[0]


def export_lesen(tag: str) -> list[tuple[str, str, str]] | None:
    req = urllib.request.Request(f"https://oeffentlichevergabe.de/api/notice-exports?pubDay={tag}&format=ocds.zip", headers={"User-Agent": UA})
    daten = None
    # The source refuses connections after many downloads in a row: wait longer each time instead of pushing on.
    for versuch, pause in enumerate((0, 30, 90, 240)):
        time.sleep(pause)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                daten = r.read(30_000_000)
            break
        except Exception as e:  # noqa: BLE001
            print(f"{tag}: OCDS-Export nicht lesbar, Versuch {versuch + 1} ({e})")
    if daten is None:
        return None
    aus = []
    with zipfile.ZipFile(io.BytesIO(daten)) as z:
        for name in z.namelist():
            if name.endswith(".json") and z.getinfo(name).file_size < 30_000_000:
                paket = json.loads(z.read(name))
                if not re.search(r"cc.?zero|creativecommons.org/publicdomain/zero", str(paket.get("license") or ""), re.I):
                    raise SystemExit("CC0-Lizenz im Export nicht bestätigt, abgebrochen.")
                aus.extend(releases(paket))
    return aus


def main() -> None:
    probe = "--probe" in sys.argv
    with verbinden() as con:
        zeilen = con.execute("""select id, quelle_id, quell_datum, (quell_datum at time zone 'UTC')::date from public.vergabekatalog
                                where quelle = 'bks' and """ + ERSETZEN).fetchall()
    print(f"{len(zeilen)} Bekanntmachungen mit Suchlink oder nur Portal-Startseite")
    tage = sorted({d + timedelta(days=k) for *_, d in zeilen for k in (-1, 0, 1)} - {date.today(), date.today() + timedelta(days=1)})
    karte: dict[str, list[tuple[str, str]]] = {}
    fehlt = []
    for tag in tage:
        teil = export_lesen(tag.isoformat())
        if teil is None:
            fehlt.append(tag.isoformat())
        else:
            for ocid, rid, datum in teil:
                karte.setdefault(ocid, []).append((rid, datum))
        time.sleep(6)
    print(f"{len(tage) - len(fehlt)} von {len(tage)} Tagesexporten gelesen"
          + (f"; nicht lesbar: {', '.join(fehlt)} (beim nächsten Lauf erneut)" if fehlt else ""))
    neu = []
    for kid, quelle_id, quell_datum, _ in zeilen:
        rid = waehlen(karte.get(quelle_id) or [], quell_datum.isoformat())
        if rid:
            neu.append((SEITE + rid, kid))
    print(f"{len(neu)} Bekanntmachungen bekommen die Seite der Bekanntmachung, ohne Treffer bleiben {len(zeilen) - len(neu)}")
    for link, kid in neu[:5]:
        print(f"  {kid} -> {link}")
    if probe:
        print("Probelauf: nichts geschrieben")
        return
    with verbinden() as con:
        for i in range(0, len(neu), 500):
            with con.cursor() as c:
                c.executemany("update public.vergabekatalog set link = %s where id = %s and " + ERSETZEN, neu[i:i + 500])
            con.commit()
        n = con.execute("""update public.vorgaenge v set link = k.link from public.vergabekatalog k
                           where (v.link like %s or substring(v.link from '^https?://[^/?#]+(.*)$') !~ '[0-9]')
                             and k.quelle = 'bks' and k.link like %s
                             and (v.katalog_id = k.id or v.quelle_id = k.quelle_id or v.quelle_id = k.id)""", (SUCHE, SEITE + "%")).rowcount
        con.commit()
        rest = con.execute("select count(*) from public.vergabekatalog where quelle = 'bks' and " + ERSETZEN).fetchone()[0]
    print(f"Geschrieben. Vorgänge der Firmen: {n} Links ersetzt. Mit Suchlink oder Portal-Startseite bleiben {rest} Bekanntmachungen.")


if __name__ == "__main__":
    main()
