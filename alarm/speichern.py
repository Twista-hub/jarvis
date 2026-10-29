"""Writes the hits of the morning report into the firms' Jarvis accounts (Supabase table vorgaenge).

Which firm gets which profile: "firma_id" in alarm/profile.json (by id, not by name: anyone can
create a firm with any name). Reads alarm/treffer.json written by alarm.py.
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/speichern.py
"""
import json
import os
import sys
import urllib.parse
from pathlib import Path

import psycopg

ROOT = Path(__file__).parent
REF = "juuuifrcxmitkqudqngq"


def verbinden() -> psycopg.Connection:
    pw = urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"], safe="")
    for host in ("aws-1-eu-central-1", "aws-0-eu-central-1"):
        try:
            return psycopg.connect(f"postgresql://postgres.{REF}:{pw}@{host}.pooler.supabase.com:5432/postgres", connect_timeout=10)
        except psycopg.OperationalError:
            continue
    sys.exit("Keine Verbindung zur Datenbank")


def speichern(con: psycopg.Connection, firma_id: str, treffer: list[dict]) -> int:
    neu = 0
    for t in treffer:
        row = con.execute(
            """insert into public.vorgaenge (firma_id, quelle_id, titel, link, frist, punkte, steckbrief)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (firma_id, quelle_id) do update set
                 punkte = coalesce(excluded.punkte, vorgaenge.punkte),
                 frist = coalesce(excluded.frist, vorgaenge.frist),
                 steckbrief = coalesce(vorgaenge.steckbrief, excluded.steckbrief),
                 link = excluded.link
               returning (xmax = 0)""",
            (firma_id, t["quelle_id"], t["titel"][:500], t["link"], t.get("frist") or None, t.get("punkte"), t.get("steckbrief")),
        ).fetchone()
        neu += bool(row and row[0])
    return neu


def main() -> None:
    datei = ROOT / "treffer.json"
    if not datei.exists():
        print("Keine Treffer-Datei.")
        return
    treffer = json.loads(datei.read_text(encoding="utf-8"))
    profile = json.loads((ROOT / "profile.json").read_text(encoding="utf-8"))
    with verbinden() as con:
        for name, profil in profile.items():
            firma_id = profil.get("firma_id")
            if not firma_id:
                continue
            eigene = [t for t in treffer if t["profil"] == name]
            print(f"{profil['name']}: {speichern(con, firma_id, eigene)} neue von {len(eigene)} Treffern")


if __name__ == "__main__":
    main()
