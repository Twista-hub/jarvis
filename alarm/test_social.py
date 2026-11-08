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
        # Monday 10.11.2026: the latest slot whose start has come; nothing before 09:00 and from 21:00.
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


if __name__ == "__main__":
    unittest.main()
