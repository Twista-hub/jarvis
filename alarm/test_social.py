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

    def test_bluesky_link_facette(self):
        text = "📢 Test äöü\nhttps://crewtender.eu/?utm_source=bluesky&utm_medium=social"
        f = s.facetten(text)[0]
        self.assertEqual(text.encode()[f["index"]["byteStart"]:f["index"]["byteEnd"]].decode(), "https://crewtender.eu/?utm_source=bluesky&utm_medium=social")


if __name__ == "__main__":
    unittest.main()
