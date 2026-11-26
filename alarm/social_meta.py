"""Automatic posts for Crewtender on Facebook and Instagram (Benjamin 26.11.2026: "Bereite die Automatik vor").

Meta gives no simple posting access to a small own app, so the post goes to a Make.com scenario of Crewtender's own
Make account: this script sends one JSON message to the scenario's webhook, Make posts it on the Facebook page
"Crewtender" and on Instagram @crew_tender. Fields: message (Facebook text with link), link, caption (Instagram text,
"link in bio" and hashtags), image_url (upright picture 1080×1350, JPEG).

One post per weekday, from 17:00 Berlin: Mon and Thu a current public tender, Tue and Fri the number of the day, Wed a
feature tip. Instagram takes a picture only from a public address: the picture is stored in the bucket under social/
and served by the website (web/src/social-bild.ts). English like the other channels; only real public notices, no
names of persons, no notice twice (jarvis_intern.social_posts, kanal 'meta').

Secret MAKE_WEBHOOK_URL (GitHub → Settings → Secrets and variables → Actions): the address of the Make webhook.
Without it nothing is sent. The address is never printed. For the upload: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

Called by social.py: `posten` (in the slot), `meta` (now, once per day), `meta-probe` (texts and picture size only),
`meta-bild` (stores today's picture as …-probe.jpg and checks its public address; posts nothing).
"""
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import social as s

AB_STUNDE = 17  # Berlin; no posts from s.ENDE
EIMER = "jarvis-auftraege"
FOTO_GEWERK = {"building cleaning": "fenster", "security services": "team", "temporary staffing": "team", "catering": "team",
               "landscaping & winter service": "team"}  # every other trade: haeuser
FOTO_TIPP = ["unterlagen", "lupe", "wecker", "checkliste", "team", "haeuser"]  # same order as s.TIPPS
MARKE = {"building cleaning": "#gebäudereinigung", "security services": "#sicherheitsdienst", "temporary staffing": "#zeitarbeit",
         "electrical work": "#elektro", "plumbing & heating": "#shk", "painting & drywall": "#maler", "landscaping & winter service": "#galabau",
         "roofing & carpentry": "#dachdecker", "joinery": "#tischler", "flooring & tiling": "#fliesenleger", "catering": "#catering"}
MARKEN = "#publictenders #ausschreibung #vergabe"
SATZ = "Crewtender finds tenders like this every morning – and tells you which ones fit."


def art_meta(heute: date) -> str | None:
    """Mon tender, Tue number, Wed tip, Thu tender, Fri number; nothing at the weekend."""
    return {1: "ausschreibung", 2: "zahl", 3: "tipp", 4: "ausschreibung", 5: "zahl"}.get(heute.isoweekday())


def faellig(jetzt: datetime) -> bool:
    return art_meta(jetzt.date()) is not None and AB_STUNDE <= jetzt.hour < s.ENDE


def ausschreibung_texte(t: dict) -> dict:
    url = s.adresse("/demo/katalog/" + urllib.parse.quote(t["id"], safe=""), "facebook")
    ort = s.ort_kurz(t)
    kopf = "📢 Public tender in Germany: " + s.kuerzen(s.sauber(t["titel"]), 160)
    zeilen = [f"📍 {s.kuerzen(ort, 60)}" if ort else "", f"⏰ Bid deadline: {s.datum_en(t['frist'])}",
              f"💶 Est. value {t['wert']}" if t.get("wert") else "", f"Source: {s.QUELLE.get(t.get('quelle'), 'official notice')}"]
    rumpf = kopf + "\n" + "\n".join(z for z in zeilen if z)
    marke = MARKE.get(t.get("gewerk") or "", "")
    return {"message": f"{rumpf}\n\n👉 Details: {url}\n{SATZ}", "link": url,
            "caption": f"{rumpf}\n\n{SATZ}\n👉 Details and more tenders: link in bio\n\n{MARKEN}{' ' + marke if marke else ''}"}


def zahl_texte(z: dict) -> dict:
    url = s.adresse("/", "facebook")
    rumpf = (f"📊 Number of the day: {z['neu']:,} new public tenders in Germany on {z['tag'].strftime('%A, %-d %b')}"
             + (f" – {z['gewerk_n']} of them in {z['gewerk']}" if z.get("gewerk_n") else "")
             + ".\nCrewtender reads them all every morning and picks the ones that fit your company.")
    marke = MARKE.get(z.get("gewerk") or "", "")
    return {"message": f"{rumpf}\n👉 {url}\nSource: oeffentlichevergabe.de", "link": url,
            "caption": f"{rumpf}\n👉 Free trial: link in bio\nSource: oeffentlichevergabe.de\n\n{MARKEN}{' ' + marke if marke else ''}"}


def tipp_texte(nr: int) -> dict:
    satz, pfad = s.TIPPS[nr % len(s.TIPPS)]
    url = s.adresse(pfad, "facebook")
    return {"message": f"💡 Crewtender tip: {satz}\n👉 See it in the demo: {url}", "link": url,
            "caption": f"💡 Crewtender tip: {satz}\n👉 Try the demo: link in bio\n\n{MARKEN} #handwerk #gebäudereinigung"}


def inhalt(con, art: str, heute: date) -> tuple[str, dict | None, dict, tuple[bytes, str]]:
    """(kind actually used, chosen notice, texts, picture as JPEG with alt text); falls back to a tip, never empty."""
    import social_bild as sb
    if art == "ausschreibung" and (t := s.ausschreibung_waehlen(con)):
        b = sb.ausschreibung_bild_hoch(s.sauber(t["titel"]), s.kuerzen(s.ort_kurz(t), 40), s.datum_en(t["frist"]), t.get("wert") or "",
                                       s.QUELLE.get(t.get("quelle"), "official notice"), FOTO_GEWERK.get(t.get("gewerk") or "", "haeuser"))
        return art, t, ausschreibung_texte(t), b
    if art == "zahl" and (z := s.zahl_waehlen(con, heute)):
        b = sb.zahl_bild_hoch(z["neu"], f"new public tenders in Germany on {z['tag'].strftime('%A, %-d %b')}",
                              f"{z['gewerk_n']} of them in {z['gewerk']}" if z.get("gewerk_n") else "")
        return art, None, zahl_texte(z), b
    nr = con.execute("select count(*) from jarvis_intern.social_posts where art = 'tipp' and kanal = 'meta'").fetchone()[0]
    return "tipp", None, tipp_texte(nr), sb.tipp_bild_hoch(s.TIPPS[nr % len(s.TIPPS)][0], FOTO_TIPP[nr % len(FOTO_TIPP)])


def bild_name(heute: date, art: str) -> str:
    return f"{heute.isoformat()}-{art}.jpg"


def wrangler(*teile: str) -> None:
    web = Path(__file__).parent.parent / "web"
    r = subprocess.run(["npx", "--yes", "wrangler@4", "r2", "object", *teile, "--remote", "--jurisdiction", "eu"], cwd=web, capture_output=True, text=True, timeout=240)
    if r.returncode:
        raise RuntimeError("Ablage fehlgeschlagen: " + (r.stderr or r.stdout).strip().splitlines()[-1][:200])


def bild_hochladen(daten: bytes, name: str) -> str:
    """Stores the picture in the bucket and returns its public address once the website hands it out."""
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(daten)
    try:
        wrangler("put", f"{EIMER}/social/{name}", "--file", f.name, "--content-type", "image/jpeg")
    finally:
        os.unlink(f.name)
    url = f"{s.SEITE}/social/bild/{name}"
    for versuch in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": s.UA}), timeout=30) as r:
                if r.status == 200 and r.headers.get("content-type", "").startswith("image/jpeg"):
                    return url
        except Exception:  # noqa: BLE001
            pass
        time.sleep(3)
    raise RuntimeError("Bild ist unter der öffentlichen Adresse nicht abrufbar")


def senden(nachricht: dict) -> None:
    """One message to the Make webhook. The address is a secret and never appears in an error text."""
    req = urllib.request.Request(os.environ["MAKE_WEBHOOK_URL"], data=json.dumps(nachricht).encode(), headers={"Content-Type": "application/json", "User-Agent": s.UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status != 200:
                raise RuntimeError(f"Make-Webhook antwortet mit {r.status}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Make-Webhook antwortet mit {e.code}") from None
    except urllib.error.URLError:
        raise RuntimeError("Make-Webhook nicht erreichbar") from None


def posten(con, jetzt: datetime, erzwingen: bool = False, probe: bool = False, nur_bild: bool = False) -> None:
    heute = jetzt.date()
    art = art_meta(heute) or ("tipp" if erzwingen or probe or nur_bild else None)
    if nur_bild:  # test of storage and public address without posting: today's picture under the name …-probe.jpg
        benutzt, _, _, b = inhalt(con, art, heute)
        print(f"meta-bild: {benutzt}, {len(b[0]) // 1024} KB, öffentlich unter {bild_hochladen(b[0], bild_name(heute, 'probe'))}")
        return
    if probe:
        benutzt, _, txt, b = inhalt(con, art, heute)
        print(f"--- Facebook/Instagram heute: {benutzt}\nFacebook ({len(txt['message'])} Zeichen):\n{txt['message']}\n\nInstagram ({len(txt['caption'])} Zeichen):\n{txt['caption']}\n"
              f"Bild: {len(b[0]) // 1024} KB JPEG, Alt-Text: {b[1]}\nWebhook-Secret: {'gesetzt' if os.environ.get('MAKE_WEBHOOK_URL') else 'fehlt'}")
        return
    if not (erzwingen or faellig(jetzt)):
        return
    if not os.environ.get("MAKE_WEBHOOK_URL"):
        print("meta: Secret MAKE_WEBHOOK_URL fehlt, Facebook/Instagram übersprungen.")
        return
    if con.execute("select 1 from jarvis_intern.social_posts where tag = %s and kanal = 'meta'", (heute,)).fetchone():
        print("meta: heute schon gepostet.")
        return
    benutzt, t, txt, b = inhalt(con, art, heute)
    url = bild_hochladen(b[0], bild_name(heute, benutzt))
    senden({**txt, "image_url": url})
    con.execute("insert into jarvis_intern.social_posts (tag, kanal, slot, art, katalog_id, text, adresse) values (%s, 'meta', 3, %s, %s, %s, %s)",
                (heute, benutzt, t["id"] if t else None, txt["message"][:600], url))
    con.commit()
    print(f"meta: an Make übergeben ({benutzt}) {url}")
    alt = heute - timedelta(days=45)
    if art_meta(alt):  # tidy up: the picture of 45 days ago (a fallback tip of that day stays; harmless)
        try:
            wrangler("delete", f"{EIMER}/social/{bild_name(alt, art_meta(alt))}")
        except Exception:  # noqa: BLE001
            pass
