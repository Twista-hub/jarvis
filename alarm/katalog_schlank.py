"""Shrink the raw data (roh) of closed or expired catalog notices on the database server (no download, no egress).

What stays and why: see migration 20261106040000_katalog_roh_schlank.sql (jarvis_intern.roh_schlank). Open notices
(the set the alarm rates and writes Steckbriefe for) keep their full raw data. Afterwards VACUUM FULL gives the space back,
so pg_database_size (the importer pauses at 350 MB) shows the real size.

CLI: python3 katalog_schlank.py probe | schreiben
"""
import sys

import psycopg

from profile_db import verbinden

# Not open: the complement of the alarm's open set, with 3 days grace for late amendments.
ZIEL = """not (k.status in ('offen', 'unbekannt') and (k.frist is null or k.frist > now() - interval '3 days'))
          and not coalesce((k.roh->>'_schlank')::boolean, false)"""


def groesse(con) -> str:
    db, kat = con.execute("select pg_database_size(current_database()), pg_total_relation_size('public.vergabekatalog')").fetchone()
    return f"Datenbank {db / 1e6:.0f} MB, davon Katalog {kat / 1e6:.0f} MB"


def main() -> None:
    modus = sys.argv[1] if len(sys.argv) > 1 else "probe"
    with verbinden() as con:
        print("Vorher:", groesse(con))
        n, alt, neu = con.execute(f"""select count(*), coalesce(sum(pg_column_size(k.roh)), 0), coalesce(sum(pg_column_size(jarvis_intern.roh_schlank(k.roh))), 0)
                                      from public.vergabekatalog k where {ZIEL}""").fetchone()
        print(f"{n} abgeschlossene oder abgelaufene Bekanntmachungen: Rohdaten {alt / 1e6:.0f} MB → {neu / 1e6:.0f} MB")
        if modus != "schreiben":
            print("Probelauf: nichts geändert")
            return
        gesamt = 0
        while True:
            r = con.execute(f"""update public.vergabekatalog set roh = jarvis_intern.roh_schlank(roh)
                                where id in (select k.id from public.vergabekatalog k where {ZIEL} limit 2000)""").rowcount
            con.commit()
            gesamt += r
            if not r:
                break
        print(f"{gesamt} Bekanntmachungen verkleinert")
    # Give the space back (outside a transaction).
    con = verbinden()
    con.autocommit = True
    try:
        con.execute("vacuum full analyze public.vergabekatalog")
        print("Platz freigegeben (VACUUM FULL).")
    except psycopg.Error as e:
        print(f"VACUUM FULL nicht möglich ({type(e).__name__}); normales VACUUM.")
        con.execute("vacuum analyze public.vergabekatalog")
    print("Nachher:", groesse(con))
    con.close()


if __name__ == "__main__":
    main()
