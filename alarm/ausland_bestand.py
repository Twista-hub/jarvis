"""Daily Polish and Spanish tender stock for the live numbers of the public trade pages (/pl/przetargi/<branża>,
/es/licitaciones/<oficio>).

Poland: BZP national notices (bzp.py, e-Zamówienia API, open data act). Spain: Catalan calls for tenders (katalonien.py,
Llicència oberta d'ús d'informació – Catalunya). Keeps only public notice facts in jarvis_intern.ausland_avis (90 days)
and refreshes the cached numbers of these trades (gewerk_cache "pl:…", "es:…").
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/ausland_bestand.py [days, default 2 = yesterday and today]
"""
import sys
from datetime import date, timedelta

import bzp
import katalonien

AUFBEWAHREN_TAGE = 90
BZP_LINK = "https://ezamowienia.gov.pl/mp-client/search/list/"


def zeile_pl(a: dict, tag: str) -> tuple | None:
    """Row from a read BZP notice (bzp.lesen); link to the procedure on e-Zamówienia or the buyer's platform."""
    tid = a.get("tender_id") or ""
    link = BZP_LINK + tid if tid.startswith("ocds-") else a.get("link") or ""
    if not link.startswith("https://") or not a.get("titel"):
        return None
    w = bzp.WOIWODSCHAFTEN.get(a.get("woiwodschaft") or "")
    frist = (a.get("frist") or "").replace("Z", "+00:00") or None
    return ("pl", f"bzp-{a['nummer']}"[:120], (a.get("veroeffentlicht") or tag)[:10], a["titel"][:1000], a.get("auftraggeber", "")[:500],
            f"woj. {w['name'].lower()}" if w else (a.get("ort") or "")[:120], a.get("cpv") or [], frist, link[:500])


def zeile_es(a: dict, tag: str) -> tuple | None:
    """Row from a merged Catalan tender (katalonien.zusammenfassen)."""
    if not a.get("link") or not a.get("titel"):
        return None
    return ("es", f"cat-{a['id']}"[:120], a.get("veroeffentlicht") or tag, a["titel"][:1000], a.get("auftraggeber", "")[:500],
            (a.get("ort") or "Catalunya")[:120], a.get("cpv") or [], katalonien._frist(a.get("frist") or "") or None, a["link"][:500])


def lesen(tag: str) -> tuple[list[tuple], int]:
    zeilen, fehler = [], 0
    for name, holen in (("BZP", lambda: [zeile_pl(bzp.lesen(x), tag) for x in bzp.bekanntmachungen(tag)]),
                        ("Katalonien", lambda: [zeile_es(a, tag) for a in katalonien.zusammenfassen(katalonien.bekanntmachungen(tag))])):
        try:
            neu = [z for z in holen() if z]
        except Exception as e:  # noqa: BLE001 – one missing source/day must not stop the others
            fehler += 1
            print(f"{tag}: {name} nicht erreichbar ({type(e).__name__})")
            continue
        print(f"{tag}: {name} {len(neu)} Ausschreibungen")
        zeilen += neu
    return zeilen, fehler


def main(tage: int) -> None:
    from profile_db import verbinden
    heute = date.today()
    zeilen, fehler = [], 0
    for i in range(tage):
        z, f = lesen((heute - timedelta(days=i)).isoformat())
        zeilen += z
        fehler += f
    with verbinden() as con:
        con.execute("set statement_timeout = '5min'")
        with con.cursor() as cur:
            if zeilen:
                cur.executemany("""insert into jarvis_intern.ausland_avis (land, id, publication, titel, auftraggeber, region, cpv, frist, link)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (land, id) do update set publication = excluded.publication, titel = excluded.titel, auftraggeber = excluded.auftraggeber,
                      region = excluded.region, cpv = excluded.cpv, frist = excluded.frist, link = excluded.link, abgerufen = now()""", zeilen)
        geloescht = con.execute("delete from jarvis_intern.ausland_avis where publication < current_date - %s", (AUFBEWAHREN_TAGE,)).rowcount
        n = con.execute("""update jarvis_intern.gewerk_cache set daten = jarvis_intern.land_berechnen(left(schluessel, 2), praefixe), stand = now()
            where schluessel ~ '^(pl|es):'""").rowcount
        for land, anzahl in con.execute("select land, count(*) from jarvis_intern.ausland_avis group by land order by land").fetchall():
            print(f"Bestand {land}: {anzahl}")
        for k, m, o in con.execute("select schluessel, daten->>'monat', daten->>'offen' from jarvis_intern.gewerk_cache where schluessel ~ '^(pl|es):' order by schluessel").fetchall():
            print(f"  {k}: {m} in 30 Tagen, {o} offen")
    print(f"Gespeichert: {len(zeilen)}, gelöscht (älter als {AUFBEWAHREN_TAGE} Tage): {geloescht}, Gewerke: {n}")
    if fehler == 2 * tage:
        sys.exit("Keine Quelle an keinem Tag erreichbar")


if __name__ == "__main__":
    main(max(1, min(95, int(sys.argv[1]) if len(sys.argv) > 1 else 2)))
