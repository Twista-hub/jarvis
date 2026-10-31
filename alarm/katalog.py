"""Shared, versioned notice facts and firm-private evaluation cache."""
import hashlib
import json
import os
from datetime import datetime, timezone
from profile_db import verbinden

BEWERTUNG_METHODE = "score-v2"


def offen(rel):
    tender = rel.get("tender") or {}
    if tender.get("status") in ("cancelled", "withdrawn", "unsuccessful", "complete", "awarded"):
        return False
    if set(rel.get("tag") or []) & {"tenderCancellation", "contractTermination"}:
        return False
    if any(a.get("status") == "active" for a in rel.get("awards") or []):
        return False
    deadlines = [tender.get("tenderPeriod", {}).get("endDate")]
    deadlines += [(l.get("tenderPeriod") or {}).get("endDate") for l in tender.get("lots") or []]
    valid = []
    for d in filter(None, deadlines):
        try:
            parsed = datetime.fromisoformat(d.replace("Z", "+00:00"))
            valid.append(parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc))
        except ValueError:
            continue
    return not valid or max(valid) > datetime.now(timezone.utc)


class KatalogBestand:
    """A server-side cursor keeps the full known catalog readable in small batches."""
    def __init__(self, luecken):
        self.luecken = luecken
        self.vollstaendig = False

    def __iter__(self):
        with verbinden() as con:
            with con.cursor(name="jarvis_offene_bekanntmachungen") as cursor:
                cursor.execute("""select id,version,roh,quell_datum,auftraggeber_id from public.vergabekatalog
                    where status in ('offen','unbekannt') and (frist is null or frist>now())
                    order by quell_datum desc,id""")
                while rows := cursor.fetchmany(250):
                    for kid, version, rel, datum, buyer in rows:
                        yield datum.date().isoformat(), dict(rel, _katalog_id=kid, _katalog_version=version, _auftraggeber_id=buyer)
        self.vollstaendig = True


def bestand():
    if not os.environ.get("SUPABASE_DB_PASSWORD"):
        return None
    try:
        with verbinden() as con:
            if not con.execute("select to_regclass('public.vergabekatalog')").fetchone()[0]:
                return None
            if not con.execute("select letzter_erfolg from public.katalog_quellen where id='bks' and letzter_erfolg is not null").fetchone():
                return None
            luecken = con.execute("select rueckstand_tage from public.katalog_quellen where id='bks'").fetchone()[0]
        print("Gemeinsamer Bestand: vollständiger Durchlauf in Blöcken zu 250 Bekanntmachungen.")
        return KatalogBestand(luecken)
    except Exception:
        print("Katalog vorübergehend nicht erreichbar; täglicher Quellenabruf bleibt verfügbar.")
        return None


def profil_version(profil):
    # The display threshold does not change the scores, so changing it must not trigger a paid re-scoring.
    inhalt = {k: v for k, v in profil.items() if k != "min_punkte"}
    return hashlib.sha256(json.dumps(inhalt, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def schluessel(rel):
    return (rel.get("_katalog_id") or rel.get("ocid") or rel.get("id"),
            rel.get("_katalog_version") or hashlib.sha256(json.dumps(rel, sort_keys=True).encode()).hexdigest())


def bewertungen(profil):
    if not os.environ.get("SUPABASE_DB_PASSWORD") or not profil.get("firma_id"):
        return {}
    try:
        with verbinden() as con:
            rows = con.execute("select katalog_id,version,ergebnis from jarvis_katalog.bewertungen where firma_id=%s and profil_version=%s and methode=%s", (profil["firma_id"], profil_version(profil), BEWERTUNG_METHODE)).fetchall()
        return {(k, v): e for k, v, e in rows}
    except Exception:
        return {}


def bewertung_speichern(profil, rel, ergebnis):
    if not rel.get("_katalog_id") or not profil.get("firma_id"):
        return
    with verbinden() as con:
        con.execute("""insert into jarvis_katalog.bewertungen(firma_id,katalog_id,version,profil_version,methode,ergebnis)
          values(%s,%s,%s,%s,%s,%s::jsonb) on conflict do nothing""",
          (profil["firma_id"], rel["_katalog_id"], rel["_katalog_version"], profil_version(profil), BEWERTUNG_METHODE, json.dumps(ergebnis)))


def reservieren(betrag, zweck):
    if not os.environ.get("SUPABASE_DB_PASSWORD"):
        return None  # Budget checks fail closed; no customer API request without a ledger.
    with verbinden() as con:
        return con.execute("select jarvis_katalog.ki_reservieren(%s::numeric,%s)", (betrag, zweck)).fetchone()[0]


def abschliessen(i, betrag):
    with verbinden() as con:
        con.execute("select jarvis_katalog.ki_abschliessen(%s,%s::numeric)", (i, betrag))
