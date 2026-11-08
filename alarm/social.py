"""Automatic posts for Crewtender on Bluesky and Mastodon (Benjamin 06.11.2026).

Weekdays three posts (about 09:00, 13:00 and 17:00 Berlin), weekends one (about 11:00), on both networks. The morning
post rotates: a current public tender (title, place, deadline, estimated value, source), a number of the day, now and then
a feature tip; the other posts are tenders (since 08.11.2026; before only one post on weekdays). English, link to crewtender.eu with
utm_source=bluesky|mastodon and utm_medium=social. Only real public notices (oeffentlichevergabe.de, CC0); no names of
persons; no notice twice (jarvis_intern.social_posts); Bluesky at most 300 characters. Rather no post than an empty one.

Secrets (GitHub → Settings → Secrets and variables → Actions): BLUESKY_APP_PASSWORD (app password of @crewtender.eu),
MASTODON_TOKEN (access token of @crewtender@mastodon.social, scope write:statuses). A network without its secret is skipped.

CLI: python3 social.py probe   – show today's texts for every kind, post nothing, write nothing
     python3 social.py posten  – post the post of the current slot (once per day, slot and network; nothing outside a slot)
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")
SEITE = "https://crewtender.eu"
BLUESKY_HANDLE = "crewtender.eu"
MASTODON = "https://mastodon.social"
GRENZE = {"bluesky": 300, "mastodon": 500}
UA = "Crewtender-Social/1.0 (+https://crewtender.eu)"
QUELLE = {"bks": "oeffentlichevergabe.de", "ted": "TED (EU)"}
# Crewtender's trades (same CPV prefixes as the trade pages in web/src/gewerke.ts).
GEWERKE = [("building cleaning", ["90911", "90919", "90910"]), ("security services", ["79710", "79713", "79714", "79715"]),
           ("temporary staffing", ["79620", "79621", "79622", "79624", "79625"]), ("electrical work", ["45311", "45315", "45317", "45310"]),
           ("plumbing & heating", ["4533"]), ("painting & drywall", ["45442", "45441", "45410", "45324"]),
           ("landscaping & winter service", ["77310", "77311", "77313", "77314", "90620", "90630"]), ("roofing & carpentry", ["45261", "45422"]),
           ("joinery", ["45421"]), ("flooring & tiling", ["45432", "45431"]), ("catering", ["5552", "5532", "5551"])]
TIPPS = [
    ("Upload the tender documents and Crewtender writes a fact sheet: lots, quantities, deadlines and required evidence.", "/demo/ausschreibung/00000000-0000-4000-8000-000000000001"),
    ("Try it without signing up: search real public tenders by keyword and region in the demo.", "/demo/suche"),
    ("Never miss a deadline: Crewtender reminds you 7 and 2 days before the bid is due.", "/demo/fristen"),
    ("Every morning Crewtender rates new tenders for your company, 1–10, with a short reason.", "/demo/treffer"),
    ("Shift plan, timesheets and proof of service in one place – and an app for your crew in 6 languages.", "/demo/schichten"),
    ("Light, dark or technical: switch the look with the palette button at the top right.", "/demo"),
]
DIENSTE = {"building cleaning", "security services", "temporary staffing", "landscaping & winter service", "catering"}
STRASSE = re.compile(r"^[\wäöüß.-]*(straße|strasse|str\.|weg|platz|allee|gasse|ring)\s*\d", re.I)
NUTS = re.compile(r"\bDE[0-9A-Z]{1,3}\b")
NAMEN = re.compile(r"\b(Herrn?|Frau|Mr\.?|Mrs\.?|Ms\.?)\s+(?:(?:Dr|Prof)\.\s+)*[A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)?")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def adresse(pfad: str, kanal: str) -> str:
    return f"{SEITE}{pfad}{'&' if '?' in pfad else '?'}utm_source={kanal}&utm_medium=social"


def sauber(text: str) -> str:
    return re.sub(r"\s+", " ", EMAIL.sub("", NAMEN.sub("", text or ""))).strip(" -–;,")


def kuerzen(text: str, n: int) -> str:
    return text if len(text) <= n else text[: max(0, n - 1)].rstrip(" ,;:-–") + "…"


def wert_text(betrag, waehrung) -> str:
    try:
        b = float(betrag)
    except (TypeError, ValueError):
        return ""
    if b <= 0:
        return ""
    zeichen = "€" if (waehrung or "EUR").upper() == "EUR" else f"{waehrung} "
    return f"{zeichen}{b / 1e6:.1f}m".replace(".0m", "m") if b >= 1e6 else f"{zeichen}{round(b / 1e3):,}k"


def datum_en(wert) -> str:
    d = wert if isinstance(wert, datetime) else datetime.fromisoformat(str(wert))
    return d.astimezone(BERLIN).strftime("%-d %b %Y")


def ausschreibung_text(t: dict, kanal: str) -> str:
    url = adresse("/demo/katalog/" + urllib.parse.quote(t["id"], safe=""), kanal)
    ort = re.sub(r"\s+", " ", NUTS.sub("", sauber(t.get("ort") or "").replace(" (Auftraggeberadresse; Einsatzort prüfen)", ""))).strip(" ·")
    zeilen = [f"📍 {kuerzen(ort, 60)}" if ort else "",
              f"⏰ Deadline {datum_en(t['frist'])}",
              f"💶 Est. value {t['wert']}" if t.get("wert") else "",
              f"Source: {QUELLE.get(t.get('quelle'), 'official notice')}"]
    rest = "\n" + "\n".join(z for z in zeilen if z) + "\n" + url
    if kanal == "mastodon":
        rest += "\n#PublicTender #Ausschreibung"
    kopf = "📢 Public tender in Germany: "
    platz = GRENZE[kanal] - len(kopf) - len(rest) - 2
    titel = kuerzen(sauber(t["titel"]), min(platz, 140))
    return f"{kopf}{titel}{rest}" if len(titel) >= 15 else ""


def zahl_text(z: dict, kanal: str) -> str:
    tag = z["tag"].strftime("%A, %-d %b")
    text = (f"📊 Number of the day: {z['neu']} new public tenders in Germany on {tag}"
            + (f" – {z['gewerk_n']} of them in {z['gewerk']}" if z.get("gewerk_n") else "")
            + ".\nCrewtender picks the ones that fit your company every morning.\n" + adresse("/", kanal))
    if kanal == "mastodon":
        text += "\n#PublicTender #Ausschreibung"
    return text if z.get("neu") else ""


def tipp_text(nr: int, kanal: str) -> str:
    satz, pfad = TIPPS[nr % len(TIPPS)]
    return f"💡 Crewtender tip: {satz}\n{adresse(pfad, kanal)}"


def art_heute(heute: date) -> str:
    """Mon tender, Tue number, Wed tender, Thu number, Fri tip (odd weeks a tender)."""
    w = heute.isoweekday()
    return {1: "ausschreibung", 2: "zahl", 3: "ausschreibung", 4: "zahl"}.get(w, "tipp" if heute.isocalendar()[1] % 2 == 0 else "ausschreibung")


SLOT_START = {1: 9, 2: 13, 3: 17}  # weekdays, Berlin hour; weekends one slot from 11
ENDE = 21  # no posts from 21:00 Berlin


def slot_jetzt(jetzt: datetime) -> int | None:
    """Latest slot whose start has come today (Berlin): weekdays 09 → 1, 13 → 2, 17 → 3; weekends 11 → 1; none before the
    first start or from 21:00. GitHub skips or delays scheduled runs, so a later run catches up the latest missed slot
    (only that one, no burst of old posts)."""
    h = jetzt.hour
    if h >= ENDE:
        return None
    if jetzt.isoweekday() > 5:
        return 1 if h >= 11 else None
    erreicht = [n for n, start in SLOT_START.items() if h >= start]
    return max(erreicht) if erreicht else None


def art_fuer(heute: date, slot: int) -> str:
    """The weekday morning post rotates (art_heute); every other slot posts a tender."""
    return art_heute(heute) if slot == 1 and heute.isoweekday() <= 5 else "ausschreibung"


def ausschreibung_waehlen(con) -> dict | None:
    praefixe = [p + "%" for _, ps in GEWERKE for p in ps]
    zeilen = con.execute("""
        select k.id, k.titel, k.ort, k.frist, k.quelle, k.roh->'tender'->'value', k.roh->'tender'->'lots', k.cpv
        from public.vergabekatalog k
        where k.quelle = 'bks' and k.status in ('offen', 'unbekannt') and k.frist > now() + interval '7 days'
          and k.quell_datum > now() - interval '5 days'
          and exists (select 1 from unnest(k.cpv) c where c like any(%s))
          and not exists (select 1 from jarvis_intern.social_posts p where p.katalog_id = k.id)
        order by k.quell_datum desc limit 60""", (praefixe,)).fetchall()
    kandidaten = []
    for kid, titel, ort, frist, quelle, wert, lose, cpv in zeilen:
        # The value only when it clearly belongs to this tender (one lot at most): a multi-lot project value would
        # make a small lot look huge.
        w = wert_text((wert or {}).get("amount"), (wert or {}).get("currency")) if len(lose or []) <= 1 else ""
        t = {"id": kid, "titel": titel, "ort": ort, "frist": frist, "quelle": quelle, "wert": w}
        if not ausschreibung_text(t, "bluesky"):
            continue
        dienst = any(c.startswith(p) for name, ps in GEWERKE if name in DIENSTE for p in ps for c in (cpv or []))
        punkte = 3 * dienst + bool(w) + (25 <= len(sauber(titel)) <= 120) - 3 * bool(STRASSE.match(sauber(titel)))
        kandidaten.append((punkte, t))
    return max(kandidaten, key=lambda x: x[0])[1] if kandidaten else None


def zahl_waehlen(con, heute: date) -> dict | None:
    """Most recent day of the last 5 with a full import (at least 50 calls for tender), and one trade in turn."""
    for k in range(1, 6):
        tag = heute - timedelta(days=k)
        neu = con.execute("""select count(*) from public.vergabekatalog where quelle = 'bks' and frist is not null
                             and (quell_datum at time zone 'Europe/Berlin')::date = %s""", (tag,)).fetchone()[0]
        if neu >= 50:
            break
    else:
        return None
    zahlen = []
    for name, ps in GEWERKE:
        n = con.execute("""select count(*) from public.vergabekatalog where quelle = 'bks' and frist is not null
                           and (quell_datum at time zone 'Europe/Berlin')::date = %s and exists (select 1 from unnest(cpv) c where c like any(%s))""",
                        (tag, [p + "%" for p in ps])).fetchone()[0]
        zahlen.append((n, name))
    n, name = max(zahlen)
    return {"tag": tag, "neu": neu, "gewerk": name, "gewerk_n": n} if n >= 3 else {"tag": tag, "neu": neu}


def facetten(text: str) -> list:
    roh = text.encode()
    out = []
    for m in re.finditer(r"https://\S+", text):
        start = len(text[: m.start()].encode())
        out.append({"index": {"byteStart": start, "byteEnd": start + len(m.group().encode())},
                    "features": [{"$type": "app.bsky.richtext.facet#link", "uri": m.group()}]})
    assert all(f["index"]["byteEnd"] <= len(roh) for f in out)
    return out


def anfrage(url: str, daten: dict | None = None, kopf: dict | None = None, form: bool = False) -> dict:
    body = urllib.parse.urlencode(daten).encode() if form else json.dumps(daten).encode() if daten is not None else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" if form else "application/json", **(kopf or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


def bluesky(text: str) -> str:
    s = anfrage("https://bsky.social/xrpc/com.atproto.server.createSession", {"identifier": BLUESKY_HANDLE, "password": os.environ["BLUESKY_APP_PASSWORD"]})
    rec = {"$type": "app.bsky.feed.post", "text": text, "createdAt": datetime.now(ZoneInfo("UTC")).isoformat(timespec="milliseconds").replace("+00:00", "Z"), "langs": ["en"], "facets": facetten(text)}
    r = anfrage("https://bsky.social/xrpc/com.atproto.repo.createRecord", {"repo": s["did"], "collection": "app.bsky.feed.post", "record": rec},
                {"Authorization": f"Bearer {s['accessJwt']}"})
    return r.get("uri", "")


def mastodon(text: str, schluessel: str) -> str:
    r = anfrage(f"{MASTODON}/api/v1/statuses", {"status": text, "visibility": "public", "language": "en"},
                {"Authorization": f"Bearer {os.environ['MASTODON_TOKEN']}", "Idempotency-Key": schluessel}, form=True)
    return r.get("url", "")


def texte(con, art: str, heute: date) -> tuple[str, dict | None, dict]:
    """(kind actually used, chosen notice, text per network); falls back to a tip, never to an empty post."""
    if art == "ausschreibung" and (t := ausschreibung_waehlen(con)):
        return art, t, {k: ausschreibung_text(t, k) for k in GRENZE}
    if art == "zahl" and (z := zahl_waehlen(con, heute)):
        return art, None, {k: zahl_text(z, k) for k in GRENZE}
    nr = con.execute("select count(*) from jarvis_intern.social_posts where art = 'tipp' and kanal = 'mastodon'").fetchone()[0]
    return "tipp", None, {k: tipp_text(nr, k) for k in GRENZE}


def main() -> None:
    from profile_db import verbinden
    modus = sys.argv[1] if len(sys.argv) > 1 else "probe"
    jetzt = datetime.now(BERLIN)
    heute = jetzt.date()
    with verbinden() as con:
        if modus == "probe":
            for art in ("ausschreibung", "zahl", "tipp"):
                benutzt, _, t = texte(con, art, heute)
                for kanal, text in t.items():
                    print(f"--- {art} → {benutzt}, {kanal}, {len(text)} Zeichen (Grenze {GRENZE[kanal]})\n{text}\n")
            print(f"Heute ({heute:%A}): " + ", ".join(f"Termin {n} {art_fuer(heute, n)}" for n in ((1,) if heute.isoweekday() > 5 else (1, 2, 3))))
            return
        slot = slot_jetzt(jetzt)
        if slot is None:
            print(f"Kein Posttermin ({jetzt:%a %H:%M} Berlin).")
            return
        offen = [k for k in GRENZE if not con.execute("select 1 from jarvis_intern.social_posts where tag = %s and kanal = %s and slot = %s", (heute, k, slot)).fetchone()]
        if not offen:
            print(f"Termin {slot} heute schon gepostet.")
            return
        art, t, txt = texte(con, art_fuer(heute, slot), heute)
        for kanal, text in txt.items():
            if kanal not in offen:
                print(f"{kanal}: Termin {slot} heute schon gepostet.")
                continue
            secret = {"bluesky": "BLUESKY_APP_PASSWORD", "mastodon": "MASTODON_TOKEN"}[kanal]
            if not os.environ.get(secret):
                print(f"{kanal}: Secret {secret} fehlt, übersprungen.")
                continue
            if not text or len(text) > GRENZE[kanal]:
                print(f"{kanal}: kein gültiger Text, übersprungen.")
                continue
            try:
                ziel = bluesky(text) if kanal == "bluesky" else mastodon(text, f"crewtender-{heute}-{slot}")
            except Exception as e:  # noqa: BLE001
                print(f"{kanal}: Posten fehlgeschlagen ({type(e).__name__}: {str(e)[:200]})")
                continue
            con.execute("insert into jarvis_intern.social_posts (tag, kanal, slot, art, katalog_id, text, adresse) values (%s, %s, %s, %s, %s, %s, %s)",
                        (heute, kanal, slot, art, t["id"] if t else None, text, ziel[:500]))
            con.commit()
            print(f"{kanal}: gepostet (Termin {slot}, {art}) {ziel}")


if __name__ == "__main__":
    main()
