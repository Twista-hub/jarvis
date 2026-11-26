import json
import os
import sys
import unittest
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
import social as s  # noqa: E402

T = {"id": "bks:ocds-mnwr74-abc", "titel": "Unterhaltsreinigung Grundschulen, Ansprechpartner Herr Max Mustermann, max.mustermann@stadt.de",
     "ort": "50667 Köln (Auftraggeberadresse; Einsatzort prüfen)", "frist": datetime(2026, 12, 9, 9, 30, tzinfo=timezone.utc), "quelle": "bks", "wert": "€1.2m"}


class SocialTest(unittest.TestCase):
    def test_ausschreibung(self):
        for kanal in ("bluesky", "mastodon"):
            t = s.ausschreibung_text(T, kanal)
            self.assertLessEqual(len(t), s.GRENZE[kanal])
            self.assertIn("Public tender", t)
            self.assertIn("⏰ Deadline 9 Dec 2026", t)
            self.assertIn("💶 Est. value €1.2m", t)
            self.assertIn("Source: oeffentlichevergabe.de", t)
            self.assertIn(f"https://crewtender.eu/demo/katalog/bks%3Aocds-mnwr74-abc?utm_source={kanal}&utm_medium=social", t)
            self.assertNotIn("Mustermann", t)
            self.assertNotIn("Auftraggeberadresse", t)
        lang = dict(T, titel="Reinigung " * 60)
        self.assertLessEqual(len(s.ausschreibung_text(lang, "bluesky")), 300, "lange Titel werden gekürzt")
        self.assertEqual(s.ausschreibung_text(dict(T, titel="Los 1"), "bluesky"), "", "lieber kein Post als ein leerer")

    def test_zahl_und_tipp(self):
        z = {"tag": date(2026, 11, 5), "neu": 412, "gewerk": "building cleaning", "gewerk_n": 38}
        t = s.zahl_text(z, "bluesky")
        self.assertIn("412 new public tenders in Germany on Thursday, 5 Nov – 38 of them in building cleaning", t)
        self.assertIn("https://crewtender.eu/?utm_source=bluesky&utm_medium=social", t)
        self.assertEqual(s.zahl_text({"tag": date(2026, 11, 5), "neu": 0}, "bluesky"), "")
        for i in range(len(s.TIPPS)):
            self.assertLessEqual(len(s.tipp_text(i, "bluesky")), 300)
        self.assertIn("utm_source=mastodon", s.tipp_text(0, "mastodon"))

    def test_wert_und_reihenfolge(self):
        self.assertEqual(s.wert_text(1_200_000, "EUR"), "€1.2m")
        self.assertEqual(s.wert_text(450_000, "EUR"), "€450k")
        self.assertEqual(s.wert_text(None, "EUR"), "")
        self.assertEqual([s.art_heute(date(2026, 11, d)) for d in (9, 10, 11, 12)], ["ausschreibung", "zahl", "ausschreibung", "zahl"])
        self.assertIn(s.art_heute(date(2026, 11, 13)), ("tipp", "ausschreibung"))

    def test_ort_ohne_doppelte_leerzeichen(self):
        t = {"id": "bks:x", "titel": "Sicherheitsdienstleistung Objektschutz", "ort": "23966 Wismar DE80J · 18119 Rostock", "frist": "2026-11-20T12:00:00+01:00", "quelle": "bks", "wert": ""}
        self.assertIn("📍 23966 Wismar · 18119 Rostock\n", s.ausschreibung_text(t, "bluesky"))

    def test_termine(self):
        from datetime import datetime
        b = s.BERLIN
        # Tuesday 10.11.2026: the latest slot whose start has come; nothing before 09:00 and from 21:00.
        self.assertEqual([s.slot_jetzt(datetime(2026, 11, 10, h, m, tzinfo=b)) for h, m in ((8, 59), (9, 23), (12, 0), (13, 23), (16, 59), (17, 53), (20, 59), (21, 0))],
                         [None, 1, 1, 2, 2, 3, 3, None])
        # Weekend: one slot from 11:00.
        self.assertEqual([s.slot_jetzt(datetime(2026, 11, 14, h, 23, tzinfo=b)) for h in (9, 11, 15, 21)], [None, 1, 1, None])
        # Morning post rotates on weekdays, the others are tenders; weekends tenders.
        self.assertEqual([s.art_fuer(date(2026, 11, 10), n) for n in (1, 2, 3)], ["zahl", "ausschreibung", "ausschreibung"])
        self.assertEqual(s.art_fuer(date(2026, 11, 14), 1), "ausschreibung")

    def test_bluesky_link_facette(self):
        text = "📢 Test äöü\nhttps://crewtender.eu/?utm_source=bluesky&utm_medium=social"
        f = s.facetten(text)[0]
        self.assertEqual(text.encode()[f["index"]["byteStart"]:f["index"]["byteEnd"]].decode(), "https://crewtender.eu/?utm_source=bluesky&utm_medium=social")

    def test_bilder(self):
        from datetime import datetime, timezone
        t = {"id": "bks:x", "titel": "Unterhaltsreinigung von 6 Schulen, Ansprechpartner Frau Erika Mustermann", "ort": "72108 Rottenburg DE143",
             "frist": datetime(2026, 11, 24, 10, tzinfo=timezone.utc), "quelle": "bks", "wert": "€210k"}
        for b in (s.bild("ausschreibung", t=t), s.bild("zahl", z={"tag": date(2026, 11, 6), "neu": 512, "gewerk": "building cleaning", "gewerk_n": 23}), s.bild("tipp", nr=1)):
            self.assertTrue(b and b[0].startswith(b"\x89PNG") and len(b[0]) < 900_000)
        png, alt = s.bild("ausschreibung", t=t)
        self.assertNotIn("Mustermann", alt)
        self.assertNotIn("DE143", alt)
        self.assertIn("Deadline 24 Nov 2026", alt)


class MetaTest(unittest.TestCase):
    """Facebook and Instagram through the Make webhook (social_meta.py)."""

    def test_termine(self):
        import social_meta as m
        b = s.BERLIN
        self.assertEqual([m.art_meta(date(2026, 11, d)) for d in range(23, 30)], ["ausschreibung", "zahl", "tipp", "ausschreibung", "zahl", None, None])
        self.assertEqual([m.faellig(datetime(2026, 11, 27, h, 11, tzinfo=b)) for h in (9, 16, 17, 20, 21)], [False, False, True, True, False])
        self.assertFalse(m.faellig(datetime(2026, 11, 28, 18, 0, tzinfo=b)), "am Wochenende kein Post")
        self.assertEqual(m.bild_name(date(2026, 11, 27), "zahl"), "2026-11-27-zahl.jpg")

    def test_texte(self):
        import social_meta as m
        t = m.ausschreibung_texte(dict(T, gewerk="building cleaning"))
        self.assertEqual(t["link"], "https://crewtender.eu/demo/katalog/bks%3Aocds-mnwr74-abc?utm_source=facebook&utm_medium=social")
        self.assertIn(t["link"], t["message"])
        self.assertIn("⏰ Bid deadline: 9 Dec 2026", t["message"])
        self.assertLessEqual(len(t["message"]), 600)
        self.assertNotIn("https://", t["caption"], "Instagram: Links sind nicht klickbar")
        self.assertIn("link in bio", t["caption"])
        self.assertIn("#publictenders #ausschreibung #vergabe #gebäudereinigung", t["caption"])
        for text in t.values():
            self.assertNotIn("Mustermann", text)
        z = m.zahl_texte({"tag": date(2026, 11, 26), "neu": 1412, "gewerk": "joinery", "gewerk_n": 38})
        self.assertIn("1,412 new public tenders in Germany on Thursday, 26 Nov – 38 of them in joinery", z["message"])
        self.assertIn("https://crewtender.eu/?utm_source=facebook&utm_medium=social", z["message"])
        self.assertNotIn("https://", z["caption"])
        for i in range(len(s.TIPPS)):
            tp = m.tipp_texte(i)
            self.assertIn("utm_source=facebook", tp["message"])
            self.assertNotIn("https://", tp["caption"])
        self.assertEqual(len(m.FOTO_TIPP), len(s.TIPPS))

    def test_ablauf_ohne_netz(self):
        """Without the secret nothing is sent; with it: picture stored, one message, one row; the address stays secret."""
        import social_meta as m

        class Con:
            def __init__(self, schon=False):
                self.schon, self.sql = schon, []

            def execute(self, sql, werte=()):
                self.sql.append((sql, werte))
                gepostet = "where tag" in sql and self.schon
                zahl = "count(*)" in sql
                return type("R", (), {"fetchone": lambda self_: (1,) if gepostet else (0,) if zahl else None, "fetchall": lambda self_: []})()

            def commit(self):
                pass

        jetzt = datetime(2026, 11, 25, 17, 11, tzinfo=s.BERLIN)  # Wednesday: tip
        alt = {k: os.environ.pop(k, None) for k in ("MAKE_WEBHOOK_URL",)}
        gesendet, abgelegt = [], []
        orig = (m.bild_hochladen, m.senden, m.wrangler)
        m.bild_hochladen = lambda daten, name: abgelegt.append((len(daten), name)) or f"https://crewtender.eu/social/bild/{name}"
        m.senden = lambda n: gesendet.append(n)
        m.wrangler = lambda *a: None
        try:
            c = Con()
            m.posten(c, jetzt)
            self.assertEqual(gesendet, [], "ohne Secret wird nichts gesendet")
            os.environ["MAKE_WEBHOOK_URL"] = "https://hook.example/geheim"
            m.posten(Con(schon=True), jetzt)
            self.assertEqual(gesendet, [], "nur ein Post am Tag")
            m.posten(Con(), datetime(2026, 11, 25, 12, 0, tzinfo=s.BERLIN))
            self.assertEqual(gesendet, [], "vor 17 Uhr nichts")
            c = Con()
            m.posten(c, jetzt)
            self.assertEqual(len(gesendet), 1)
            n = gesendet[0]
            self.assertEqual(sorted(n), ["caption", "image_url", "link", "message"])
            self.assertEqual(n["image_url"], "https://crewtender.eu/social/bild/2026-11-25-tipp.jpg")
            self.assertGreater(abgelegt[0][0], 20000)
            eintrag = [w for q, w in c.sql if q.startswith("insert into jarvis_intern.social_posts")]
            self.assertEqual(len(eintrag), 1)
            self.assertNotIn("geheim", json.dumps([n, [str(x) for x in eintrag[0]]]))
        finally:
            m.bild_hochladen, m.senden, m.wrangler = orig
            os.environ.pop("MAKE_WEBHOOK_URL", None)
            for k, v in alt.items():
                if v is not None:
                    os.environ[k] = v

    def test_bilder_hochkant(self):
        import io
        from PIL import Image
        import social_bild as sb
        for daten, alt_text in (sb.ausschreibung_bild_hoch("Unterhaltsreinigung von 6 Schulen im Stadtgebiet", "72108 Rottenburg", "24 Nov 2026", "€210k", "oeffentlichevergabe.de", "fenster"),
                                sb.zahl_bild_hoch(1412, "new public tenders in Germany on Thursday, 26 Nov", "38 of them in joinery"),
                                sb.tipp_bild_hoch(s.TIPPS[0][0], "unterlagen"), sb.tipp_bild_hoch(s.TIPPS[1][0], "gibt-es-nicht")):
            bild = Image.open(io.BytesIO(daten))
            self.assertEqual((bild.format, bild.size), ("JPEG", (1080, 1350)), "Instagram: JPEG im Format 4:5")
            self.assertLess(len(daten), 600_000)
            self.assertTrue(alt_text)

if __name__ == "__main__":
    unittest.main()
