"""Remove old notices from the catalog so it stays below the collector's limits (65,000 notices, 350 MB).

Rule (Benjamin, 24.11.2026): a notice goes when its deadline passed more than 90 days ago, or, without a deadline, when
it was published more than 90 days ago. Kept in any case: awarded or completed procedures (price comparison,
re-tender radar), notices a firm saved as a Vorgang, and the public demo examples. Public CC0 data only; the
change log and the firms' ratings of a removed notice go with it (foreign keys), nothing else of a firm is touched.

CLI: python3 katalog_aufraeumen.py probe | schreiben
"""
import sys

from profile_db import verbinden

TAGE = 90


def ziel(tage: int = TAGE) -> str:
    """SQL condition on public.vergabekatalog k: the notices that may be removed."""
    tage = int(tage)
    return f"""k.status in ('offen', 'unbekannt', 'aufgehoben') and jsonb_array_length(k.zuschlaege) = 0
          and coalesce(k.frist, k.quell_datum) < now() - interval '{tage} days'
          and k.quell_datum < now() - interval '{tage} days'
          and not exists (select 1 from public.vorgaenge v where v.katalog_id = k.id)
          and not exists (select 1 from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id)"""


def stand(con) -> None:
    n, = con.execute("select count(*) from public.vergabekatalog").fetchone()
    print(f"Bestand: {n} Bekanntmachungen (Grenze des Sammlers 65000, web/src/katalog-plan.ts)")
    print("Nach Monat der Veröffentlichung: gesamt / mit Zuschlag oder abgeschlossen / ohne Frist / von Firmen gespeichert")
    for monat, alle, fest, ohne, gespeichert in con.execute("""
            select to_char(k.quell_datum, 'YYYY-MM'), count(*),
                   count(*) filter (where k.status in ('vergeben', 'abgeschlossen') or jsonb_array_length(k.zuschlaege) > 0),
                   count(*) filter (where k.frist is null and k.status in ('offen', 'unbekannt', 'aufgehoben') and jsonb_array_length(k.zuschlaege) = 0),
                   count(*) filter (where exists (select 1 from public.vorgaenge v where v.katalog_id = k.id))
              from public.vergabekatalog k group by 1 order by 1""").fetchall():
        print(f"  {monat}: {alle} / {fest} / {ohne} / {gespeichert}")
    print("Veröffentlicht je Tag (letzte 14 Tage): " + ", ".join(f"{t:%d.%m.} {c}" for t, c in con.execute("""
            select quell_datum::date, count(*) from public.vergabekatalog where quell_datum > current_date - 14 group by 1 order by 1""").fetchall()))
    for tage in (90, 60, 45, 30):
        c, = con.execute(f"select count(*) from public.vergabekatalog k where {ziel(tage)}").fetchone()
        print(f"  Regel mit {tage} Tagen: {c} Bekanntmachungen würden entfernt, {n - c} blieben")


def main() -> None:
    modus = sys.argv[1] if len(sys.argv) > 1 else "probe"
    with verbinden() as con:
        stand(con)
        if modus != "schreiben":
            print("Probelauf: nichts geändert")
            return
        gesamt = 0
        while True:
            r = con.execute(f"""delete from public.vergabekatalog where id in
                                (select k.id from public.vergabekatalog k where {ziel()} limit 2000)""").rowcount
            con.commit()
            gesamt += r
            if not r:
                break
        n, = con.execute("select count(*) from public.vergabekatalog").fetchone()
        print(f"{gesamt} alte Bekanntmachungen entfernt (Regel {TAGE} Tage); Bestand jetzt {n}")


if __name__ == "__main__":
    main()
