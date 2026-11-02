"""Daily French tender stock for the live numbers of the public French trade pages (/fr/appels-d-offres/<métier>).

Reads the BOAMP open data files of the last days (boamp.py, DILA, Licence Ouverte 2.0), keeps only public notice facts
in jarvis_intern.boamp_avis (90 days) and refreshes the cached numbers of the French trades (gewerk_cache "fr:…").
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/boamp_bestand.py [days, default 2 = yesterday and today]
"""
import sys
from datetime import date, timedelta

import boamp

AUFBEWAHREN_TAGE = 90


def zeile(a: dict, tag: str) -> tuple | None:
    """Row for jarvis_intern.boamp_avis; None without a usable link."""
    link = a.get("url_avis") or ""
    if not link.startswith("https://"):
        return None
    publication = (a.get("publication") or tag)[:10]
    limite = boamp._frist(a["limite"]) if a.get("limite") else None
    return (a["idweb"][:40], publication, a["objet"][:1000], (a.get("acheteur") or "")[:500],
            [d for d in a.get("departements") or [] if d][:10], a.get("cpv") or [], limite, link[:500])


def main(tage: int) -> None:
    from profile_db import verbinden
    heute = date.today()
    zeilen, fehler = [], 0
    for i in range(tage):
        tag = (heute - timedelta(days=i)).isoformat()
        try:
            gelesen = boamp.bekanntmachungen(tag)
        except Exception as e:  # noqa: BLE001 – one missing day must not stop the others
            fehler += 1
            print(f"{tag}: BOAMP nicht erreichbar ({type(e).__name__})")
            continue
        neu = [z for z in (zeile(a, tag) for a in gelesen) if z]
        print(f"{tag}: {len(neu)} Aufrufe zum Wettbewerb")
        zeilen += neu
    with verbinden() as con:
        con.execute("set statement_timeout = '5min'")
        with con.cursor() as cur:
            if zeilen:
                cur.executemany("""insert into jarvis_intern.boamp_avis (idweb, publication, titel, acheteur, departements, cpv, limite, link)
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (idweb) do update set publication = excluded.publication, titel = excluded.titel, acheteur = excluded.acheteur,
                      departements = excluded.departements, cpv = excluded.cpv, limite = excluded.limite, link = excluded.link, abgerufen = now()""", zeilen)
        geloescht = con.execute("delete from jarvis_intern.boamp_avis where publication < current_date - %s", (AUFBEWAHREN_TAGE,)).rowcount
        n = con.execute("""update jarvis_intern.gewerk_cache set daten = jarvis_intern.metier_berechnen(praefixe), stand = now()
            where schluessel like 'fr:%'""").rowcount
        bestand = con.execute("select count(*) from jarvis_intern.boamp_avis").fetchone()[0]
        for k, m, o in con.execute("select schluessel, daten->>'monat', daten->>'offen' from jarvis_intern.gewerk_cache where schluessel like 'fr:%' order by schluessel").fetchall():
            print(f"  {k}: {m} in 30 Tagen, {o} offen")
    print(f"Gespeichert: {len(zeilen)}, gelöscht (älter als {AUFBEWAHREN_TAGE} Tage): {geloescht}, Bestand: {bestand}, Gewerke: {n}")
    if fehler == tage:
        sys.exit("BOAMP an keinem Tag erreichbar")


if __name__ == "__main__":
    main(max(1, min(95, int(sys.argv[1]) if len(sys.argv) > 1 else 2)))
