"""Writes the hits of the morning report into the firms' Jarvis accounts (Supabase table vorgaenge).

Which firm gets which profile: "firma_id" in alarm/profile.json (by id, not by name: anyone can
create a firm with any name) or the firm of a profile saved in the app (profile_db.py). Reads alarm/treffer.json written by alarm.py.
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/speichern.py
"""
import json
from pathlib import Path

import psycopg

from profile_db import im_suchgebiet, laden, verbinden

ROOT = Path(__file__).parent


def bereich(regionen: dict, plz: str) -> str | None:
    """Area of the firm for a postal code (profile.json "regionen": area id -> two-digit prefixes)."""
    return next((b for b, praefixe in regionen.items() if plz[:2] in praefixe), None) if plz else None


def ausserhalb_gebiet_verwerfen(con: psycopg.Connection, firma_id: str, suchorte: list[dict]) -> int:
    """Archive stale, untouched search hits after a firm narrows its search area."""
    if not suchorte:
        return 0  # Empty means nationwide; do not change existing work.
    rows = con.execute(
        """select v.id, k.ort, k.plz from public.vorgaenge v
           join public.vergabekatalog k on k.id=v.katalog_id
           where v.firma_id=%s and v.status='neu'""",
        (firma_id,),
    ).fetchall()
    ausserhalb = []
    for vorgang_id, ort, plz_werte in rows:
        items = [{"deliveryLocation": {"description": ort or ""},
                  "deliveryAddress": {"postalCode": p}}
                 for p in (plz_werte or [""])]
        if not im_suchgebiet({"suchorte": suchorte}, {"tender": {"items": items}}):
            ausserhalb.append(vorgang_id)
    if ausserhalb:
        con.execute("update public.vorgaenge set status='verworfen' where id = any(%s)", (ausserhalb,))
    return len(ausserhalb)


def speichern(con: psycopg.Connection, firma_id: str, treffer: list[dict], regionen: dict) -> int:
    neu = 0
    for t in treffer:
        row = con.execute(
            """insert into public.vorgaenge (firma_id, quelle_id, titel, link, frist, punkte, steckbrief, bereich_id,katalog_id,katalog_version)
               values (%s, %s, %s, %s, %s, %s, %s, %s,%s,%s)
               on conflict (firma_id, quelle_id) do update set
                 punkte = coalesce(excluded.punkte, vorgaenge.punkte),
                 frist = coalesce(excluded.frist, vorgaenge.frist),
                 steckbrief = case
                   when position('## Jarvis-Bewertung' in excluded.steckbrief)>0 and nullif(trim(vorgaenge.steckbrief),'') is not null
                     then case when position('## Jarvis-Bewertung' in vorgaenge.steckbrief)>0 then vorgaenge.steckbrief
                       else excluded.steckbrief||E'\\n\\n'||vorgaenge.steckbrief end
                   when %s and nullif(trim(vorgaenge.steckbrief),'') is not null then vorgaenge.steckbrief
                   else coalesce(excluded.steckbrief, vorgaenge.steckbrief) end,
                 link = excluded.link, katalog_id=coalesce(excluded.katalog_id,vorgaenge.katalog_id),katalog_version=coalesce(excluded.katalog_version,vorgaenge.katalog_version),
                 bereich_id = coalesce(vorgaenge.bereich_id, excluded.bereich_id)
               returning (xmax = 0)""",
            (firma_id, t["quelle_id"], t["titel"][:500], t["link"], t.get("frist") or None, t.get("punkte"), t.get("steckbrief"), bereich(regionen, t.get("plz", "")),t.get("katalog_id"),t.get("katalog_version"), t.get("steckbrief_kurz", False)),
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
            verworfen = ausserhalb_gebiet_verwerfen(con, firma_id, profil.get("suchorte") or [])
            print(f"{profil['name']}: {speichern(con, firma_id, eigene, profil.get('regionen', {}))} neue von {len(eigene)} Treffern")
            if verworfen:
                print(f"{profil['name']}: {verworfen} alte, unbearbeitete Treffer außerhalb des Suchgebiets ins Archiv verschoben")


if __name__ == "__main__":
    main()
