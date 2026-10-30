import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import katalog  # noqa: E402
import ted  # noqa: E402


class TedTest(unittest.TestCase):
    roh = {"publication-number": "749289-2026", "publication-date": "2026-10-29+01:00",
           "notice-title": {"deu": ["Österreich – Reinigung"], "eng": ["Austria – Cleaning"]},
           "buyer-name": {"deu": ["Stadt Wien"]}, "place-of-performance": ["AT130", "AUT", "AUT"],
           "classification-cpv": ["90910000", "90910000"], "deadline-receipt-tender-date-lot": ["2099-11-26+01:00"],
           "links": {"html": {"DEU": "https://ted.europa.eu/de/notice/-/detail/749289-2026"}}}

    def test_release_wie_deutsche_quelle(self):
        r = ted.als_release(self.roh)
        self.assertEqual(r["ocid"], "ted-749289-2026")
        self.assertEqual(r["tender"]["title"], "Österreich – Reinigung")
        self.assertEqual(r["_land"], "AUT")
        self.assertEqual(r["tender"]["tenderPeriod"]["endDate"], "2099-11-26T23:59:00+01:00")
        self.assertEqual([i["classification"]["id"] for i in r["tender"]["items"] if "classification" in i], ["90910000"])
        self.assertEqual(r["tender"]["documents"][0]["url"], "https://ted.europa.eu/de/notice/-/detail/749289-2026")
        self.assertTrue(katalog.offen(r))

    def test_deutschland_und_grossbritannien_nie_ueber_ted(self):
        self.assertEqual(ted.suchen("2026-10-29", ["DEU", "GBR"]), [])

    def test_kurzbrief_nennt_quelle_und_lizenz(self):
        from alarm.alarm import kurzbrief
        text = kurzbrief({"tender": {"title": "Cleaning services"}, "buyer": {"name": "NHS"}, "_land": "GBR", "_quelle": "Find a Tender"}, "2026-10-29")
        self.assertIn("Open Government Licence", text)


class UsaTest(unittest.TestCase):
    def test_ohne_schluessel_nichts(self):
        import os
        import usa
        os.environ.pop("SAM_API_KEY", None)
        self.assertEqual(usa.releases("2026-10-29"), [])

    def test_release(self):
        import usa
        r = usa.als_release({"noticeId": "abc", "title": "Custodial Services", "postedDate": "2026-10-29", "type": "Solicitation",
                             "naicsCode": "561720", "responseDeadLine": "2026-11-20T15:00:00-05:00", "uiLink": "https://sam.gov/opp/abc/view",
                             "fullParentPathName": "DEPT OF DEFENSE.DEPT OF THE ARMY", "placeOfPerformance": {"city": {"name": "Fort Bragg"}, "state": {"code": "NC"}}})
        self.assertEqual(r["_land"], "USA")
        self.assertEqual(r["tender"]["tenderPeriod"]["endDate"], "2026-11-20T15:00:00-05:00")
        self.assertIn("NAICS 561720", r["tender"]["description"])
        self.assertEqual(r["buyer"]["name"], "DEPT OF DEFENSE › DEPT OF THE ARMY")


if __name__ == "__main__":
    unittest.main()
