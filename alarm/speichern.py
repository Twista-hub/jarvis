"""Writes the hits of the morning report into the firms' Jarvis accounts (Supabase table vorgaenge).

Which firm gets which profile: "firma_id" in alarm/profile.json (by id, not by name: anyone can
create a firm with any name) or the firm of a profile saved in the app (profile_db.py). Reads alarm/treffer.json written by alarm.py.
Usage: SUPABASE_DB_PASSWORD=... python3 alarm/speichern.py
"""
import json
import os
from pathlib import Path

import psycopg
import katalog

from profile_db import im_suchgebiet, laden, nicht_mehr_aktuelle_treffer, verbinden

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
        con.execute("update public.vorgaenge set status='verworfen' where firma_id=%s and status='neu' and id = any(%s)", (firma_id, ausserhalb))
    return len(ausserhalb)


def nicht_mehr_aktuell_verwerfen(con: psycopg.Connection, firma_id: str, aktuelle_treffer: list[dict], kompletter_katalog: bool) -> int:
    """Archive untouched old hits omitted from a complete, current evaluation."""
    if not kompletter_katalog:
        return 0
    rows = con.execute(
        """select id::text, quelle_id from public.vorgaenge
           where firma_id=%s and status='neu' and quelle_id is not null""",
        (firma_id,),
    ).fetchall()
    alte = nicht_mehr_aktuelle_treffer(rows, {str(t["quelle_id"]) for t in aktuelle_treffer})
    if alte:
        con.execute("update public.vorgaenge set status='verworfen' where firma_id=%s and status='neu' and id::text = any(%s)", (firma_id, alte))
    return len(alte)


def unpassende_verwerfen(con, firma_id: str, abgelehnt: list[str]) -> int:
    """Only archive explicitly evaluated rejections, even with a partial catalog."""
    if not abgelehnt:
        return 0
    return con.execute("""update public.vorgaenge set status='verworfen'
        where firma_id=%s and status='neu' and quelle_id = any(%s)""", (firma_id, abgelehnt)).rowcount


def abgelaufene_archivieren(con, firma_id: str) -> int:
    """Untouched hits (new / to check) whose deadline passed more than a day ago go to the archive."""
    n = con.execute("""update public.vorgaenge set status='verworfen'
        where firma_id=%s and status in ('neu','pruefen') and frist < now() - interval '1 day'""", (firma_id,)).rowcount
    return n if isinstance(n, int) and n > 0 else 0


def brief_aktualisieren(alt: str | None, t: dict) -> str | None:
    def teilen(text):
        teile = (text or "").split("\n\n", 3)
        if len(teile) == 4 and teile[0] == "## Jarvis-Bewertung" and teile[1].startswith("**Gesucht:**") and teile[2].startswith("**Warum passend:**"):
            return "\n\n".join(teile[:3]) + "\n\n", teile[3]
        return "", text or ""
    neu = t.get("steckbrief")
    bewertung, inhalt = teilen(neu)
    _, bisher = teilen(alt)
    # Keep uploaded/detailed analyses; replace only the old relevance explanation.
    # An older short overview is refreshed (it gains the key facts); detailed or uploaded analyses stay.
    behalten = bisher.strip() and not bisher.startswith("## Kurzüberblick")
    return bewertung + (bisher if behalten else inhalt) if neu else alt


def firmen_ergebnis(namen: list[str], treffer: list[dict], ausgewertet: dict) -> tuple[list[dict], list[str]]:
    """All hits of a firm's search profiles (H3) as one list, each notice once with its best score, and the
    rejections that every profile agrees on (a notice one profile wants is never archived because another does not)."""
    beste: dict = {}
    for t in treffer:
        if t["profil"] not in namen:
            continue
        alt = beste.get(t["quelle_id"])
        if alt is None or (t.get("punkte") or 0) > (alt.get("punkte") or 0):
            beste[t["quelle_id"]] = t
    abgelehnt = None
    for n in namen:
        menge = set((ausgewertet.get(n) or {}).get("abgelehnt", []))
        abgelehnt = menge if abgelehnt is None else abgelehnt & menge
    return list(beste.values()), sorted((abgelehnt or set()) - set(beste))


def speichern(con: psycopg.Connection, firma_id: str, treffer: list[dict], regionen: dict, bereich_je_profil: dict | None = None, neue_ids: list | None = None) -> int:
    neu = 0
    for t in treffer:
        bisher = con.execute("select steckbrief from public.vorgaenge where firma_id=%s and quelle_id=%s for update", (firma_id, t["quelle_id"])).fetchone()
        brief = brief_aktualisieren(bisher[0] if bisher else None, t)
        row = con.execute(
            """insert into public.vorgaenge (firma_id, quelle_id, titel, link, frist, punkte, steckbrief, bereich_id,katalog_id,katalog_version,entfernung_km,fragefrist)
               values (%s, %s, %s, %s, %s, %s, %s, %s,%s,%s,%s,%s)
               on conflict (firma_id, quelle_id) do update set
                 punkte = excluded.punkte,
                 frist = coalesce(excluded.frist, vorgaenge.frist),
                 steckbrief = case
                   when vorgaenge.steckbrief is distinct from %s and nullif(trim(vorgaenge.steckbrief),'') is not null
                     then vorgaenge.steckbrief
                   else excluded.steckbrief end,
                 link = excluded.link, katalog_id=coalesce(excluded.katalog_id,vorgaenge.katalog_id),katalog_version=coalesce(excluded.katalog_version,vorgaenge.katalog_version),
                 bereich_id = coalesce(vorgaenge.bereich_id, excluded.bereich_id),
                 entfernung_km = excluded.entfernung_km, fragefrist = coalesce(excluded.fragefrist, vorgaenge.fragefrist)
               returning (xmax = 0), id::text""",
            (firma_id, t["quelle_id"], t["titel"][:500], t["link"], t.get("frist") or None, t.get("punkte"), brief, (bereich_je_profil or {}).get(t.get("profil")) or bereich(regionen, t.get("plz", "")),t.get("katalog_id"),t.get("katalog_version"),t.get("entfernung_km"),t.get("fragefrist"), bisher[0] if bisher else None),
        ).fetchone()
        neu += bool(row and row[0])
        if row and row[0] and neue_ids is not None and len(row) > 1:
            neue_ids.append(row[1])
    return neu


def foerder_speichern(con, firma_id: str, foerder: dict, name: str) -> int:
    """N2: funding programmes (shared) and this firm's AI scores. Marks set by the firm (stand) stay."""
    programme = {p["id"]: p for p in foerder.get("programme") or [] if str(p.get("link", "")).startswith("https://www.foerderdatenbank.de/")}
    eigene = [b for b in (foerder.get("bewertungen") or {}).get(name) or [] if b.get("id") in programme]
    for b in eigene:
        p = programme[b["id"]]
        con.execute("""insert into public.foerderprogramme (id, titel, link, veroeffentlicht) values (%s, %s, %s, %s)
            on conflict (id) do update set titel = excluded.titel""", (p["id"][:600], p["titel"][:600], p["link"][:600], p.get("tag")))
        con.execute("""insert into public.foerder_bewertungen (firma_id, programm_id, punkte, grund) values (%s, %s, %s, %s)
            on conflict (firma_id, programm_id) do update set punkte = excluded.punkte, grund = excluded.grund, bewertet = now()""",
                    (firma_id, p["id"][:600], max(1, min(10, int(b["punkte"]))), str(b.get("grund", ""))[:600]))
    return len(eigene)


def zwischenspeichern(profil: dict, treffer: list[dict], stand: dict) -> bool:
    """During a run: upsert confirmed hits right away and record the progress. Never stops the run."""
    firma_id = profil.get("firma_id")
    if not firma_id or not os.environ.get("SUPABASE_DB_PASSWORD"):
        return False
    neue_ids: list = []
    try:
        with verbinden() as con:
            if treffer:
                speichern(con, firma_id, treffer, profil.get("regionen", {}), {t["profil"]: profil.get("bereich_id") for t in treffer}, neue_ids)
            if not profil.get("zusatz"):  # the progress shown in the app belongs to the main profile
                con.execute("""update public.suchprofile set einstellungen = einstellungen ||
                    jsonb_build_object('suchlauf_zwischenstand', %s::jsonb) where firma_id=%s and bereich_id is null""",
                            (json.dumps(stand), firma_id))
        # After the commit: immediate phone message for top hits (I1).
        import mail
        mail.sofort_nach_speichern({firma_id: neue_ids})
        return True
    except (Exception, SystemExit) as e:  # verbinden() exits when the database is unreachable
        print(f"Zwischenstand nicht gespeichert ({type(e).__name__}); Ergebnis folgt am Ende.")
        return False


def main() -> None:
    datei = ROOT / "treffer.json"
    if not datei.exists():
        print("Keine Treffer-Datei.")
        return
    geladen = json.loads(datei.read_text(encoding="utf-8"))
    if isinstance(geladen, list):  # Older alarm output did not include catalog completeness.
        treffer, kompletter_katalog = geladen, False
    else:
        treffer, kompletter_katalog = geladen.get("treffer", []), bool(geladen.get("katalog_vollstaendig"))
    profile = laden()
    ausgewertet = geladen.get("profile") if isinstance(geladen, dict) else None
    if ausgewertet is not None:
        profile = {name: p for name, p in profile.items() if name in ausgewertet}
    else:
        # Legacy output cannot prove that firms without hits were evaluated.
        profile = {name: p for name, p in profile.items() if any(t["profil"] == name for t in treffer)}
        kompletter_katalog = False
    neue_je_firma: dict = {}
    with verbinden() as con:
        for name, profil in profile.items():
            firma_id = profil.get("firma_id")
            if not firma_id or profil.get("zusatz"):
                continue  # further profiles are handled together with their firm's main profile
            # H3: all search profiles of this firm together (the main profile first).
            namen = [name] + [k for k, p in profile.items() if p.get("zusatz") and p.get("firma_id") == firma_id]
            bericht = (ausgewertet or {}).get(name, {})
            geaendert = [k for k in namen if (ausgewertet or {}).get(k) and (ausgewertet or {})[k].get("version") != katalog.profil_version(profile[k])]
            if geaendert:
                print(f"{profil['name']}: Profil wurde während des Laufs geändert; Ergebnis wird nicht übernommen.")
                con.execute("""update public.suchprofile set einstellungen = einstellungen ||
                    jsonb_build_object('erstlauf_fertig', now(), 'suchlauf_fehler', true)
                    where firma_id=%s and bereich_id is null""", (firma_id,))
                continue
            eigene, abgelehnt = firmen_ergebnis(namen, treffer, ausgewertet or {name: bericht})
            unpassend = unpassende_verwerfen(con, firma_id, abgelehnt)
            verworfen = ausserhalb_gebiet_verwerfen(con, firma_id, profil.get("suchorte") or [])
            nicht_aktuell = nicht_mehr_aktuell_verwerfen(con, firma_id, eigene, kompletter_katalog)
            neu = speichern(con, firma_id, eigene, profil.get("regionen", {}), {k: profile[k].get("bereich_id") for k in namen}, neue_je_firma.setdefault(firma_id, []))
            abgelaufen = abgelaufene_archivieren(con, firma_id)
            foerder = foerder_speichern(con, firma_id, geladen.get("foerder") or {} if isinstance(geladen, dict) else {}, name)
            if foerder:
                print(f"{profil['name']}: {foerder} Förderprogramme bewertet")
            ergebnis = {"treffer": len(eigene), "neu": neu, "ungeprueft": sum(t.get("punkte") is None for t in eigene),
                        "archiviert": unpassend + verworfen + nicht_aktuell, "abgelaufen": abgelaufen, **bericht.get("suchstand", {})}
            suchgebiet = {"standorte": profil["standorte"], "suchgebiet_modus": "firmenstandorte"} if profil.get("suchgebiet_modus") == "firmenstandorte" else {}
            # Coordinates for the map in the app (the app does not load the postal code table itself).
            suchgebiet["suchpunkte"] = profil.get("suchpunkte") or []
            con.execute("""update public.suchprofile set einstellungen = einstellungen ||
                jsonb_build_object('erstlauf_fertig', now(), 'suchlauf_ergebnis', %s::jsonb, 'suchlauf_fehler', false) || %s::jsonb
                where firma_id=%s and bereich_id is null""", (json.dumps(ergebnis), json.dumps(suchgebiet), firma_id))
            print(f"{profil['name']}: {neu} neue von {len(eigene)} Treffern; {ergebnis['ungeprueft']} ohne KI-Bewertung; {ergebnis['archiviert']} unpassende unbearbeitete Treffer archiviert")
            if suchgebiet.get("standorte"):
                print(f"{profil['name']}: Suche an allen {len(profil['standorte'])} Firmenstandorten gespeichert")
            if verworfen:
                print(f"{profil['name']}: {verworfen} alte, unbearbeitete Treffer außerhalb des Suchgebiets ins Archiv verschoben")
            if nicht_aktuell:
                print(f"{profil['name']}: {nicht_aktuell} alte, unbearbeitete und im aktuellen Katalog fehlende Treffer archiviert")
    # After the commit: immediate phone messages for new top hits (I1).
    import mail
    gesendet = mail.sofort_nach_speichern(neue_je_firma)
    if gesendet:
        print(f"{gesendet} Sofort-Nachrichten aufs Handy")


if __name__ == "__main__":
    main()
