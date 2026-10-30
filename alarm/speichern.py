"""Writes the hits of the morning report into the firms' Jarvis accounts (Supabase table vorgaenge).

Which firm gets which profile: "firma_id" in alarm/profile.json (by id, not by name: anyone can
create a firm with any name) or the firm of a profile saved in the app (profile_db.py). Reads alarm/treffer.json written by alarm.py.
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/speichern.py
"""
import json
from pathlib import Path

import psycopg

from profile_db import laden, verbinden

ROOT = Path(__file__).parent


def bereich(regionen: dict, plz: str) -> str | None:
    """Area of the firm for a postal code (profile.json "regionen": area id -> two-digit prefixes)."""
    return next((b for b, praefixe in regionen.items() if plz[:2] in praefixe), None) if plz else None


def speichern(con: psycopg.Connection, firma_id: str, treffer: list[dict], regionen: dict) -> int:
    neu = 0
    for t in treffer:
        row = con.execute(
            """insert into public.vorgaenge (firma_id, quelle_id, titel, link, frist, punkte, steckbrief, bereich_id)
               values (%s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (firma_id, quelle_id) do update set
                 punkte = coalesce(excluded.punkte, vorgaenge.punkte),
                 frist = coalesce(excluded.frist, vorgaenge.frist),
                 steckbrief = coalesce(excluded.steckbrief, vorgaenge.steckbrief),
                 link = excluded.link,
                 bereich_id = coalesce(vorgaenge.bereich_id, excluded.bereich_id)
               returning (xmax = 0)""",
            (firma_id, t["quelle_id"], t["titel"][:500], t["link"], t.get("frist") or None, t.get("punkte"), t.get("steckbrief"), bereich(regionen, t.get("plz", ""))),
        ).fetchone()
        neu += bool(row and row[0])
    return neu


def main() -> None:
    datei = ROOT / "treffer.json"
    if not datei.exists():
        print("Keine Treffer-Datei.")
        return
    treffer = json.loads(datei.read_text(encoding="utf-8"))
    profile = laden()
    with verbinden() as con:
        for name, profil in profile.items():
            firma_id = profil.get("firma_id")
            if not firma_id:
                continue
            eigene = [t for t in treffer if t["profil"] == name]
            print(f"{profil['name']}: {speichern(con, firma_id, eigene, profil.get('regionen', {}))} neue von {len(eigene)} Treffern")


if __name__ == "__main__":
    main()
