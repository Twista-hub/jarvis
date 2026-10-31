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

    def test_suchen_laeuft_ueber_seitenindex_weiter(self):
        import json
        import os
        import urllib.parse
        import usa
        from unittest.mock import patch

        class Antwort:
            def __init__(self, daten):
                self.daten = daten

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

            def read(self):
                return json.dumps(self.daten).encode()

        erste = [{"noticeId": str(i)} for i in range(1000)]
        zweite = [{"noticeId": str(i)} for i in range(1000, 1500)]
        antworten = [Antwort({"totalRecords": 1500, "opportunitiesData": erste}),
                     Antwort({"totalRecords": 1500, "opportunitiesData": zweite})]
        with patch.dict(os.environ, {"SAM_API_KEY": "test-secret"}), patch("usa.urllib.request.urlopen", side_effect=antworten) as abruf:
            resultate = usa.suchen("2026-10-29")

        self.assertEqual(len(resultate), 1500)
        offsets = [urllib.parse.parse_qs(abruf.call_args_list[i].args[0].full_url.split("?", 1)[1])["offset"][0]
                   for i in range(2)]
        self.assertEqual(offsets, ["0", "1"])

    def test_suchen_begrenzt_seitenzahl(self):
        import json
        import os
        import usa
        from unittest.mock import patch
        from contextlib import redirect_stdout
        from io import StringIO

        class Antwort:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

            def read(self):
                return json.dumps({"totalRecords": 3000, "opportunitiesData": [{"noticeId": "x"}] * 1000}).encode()

        protokoll = StringIO()
        with patch.dict(os.environ, {"SAM_API_KEY": "test-secret"}), \
                patch.object(usa, "MAX_SEITEN_PRO_DATUM", 2), \
                patch("usa.urllib.request.urlopen", side_effect=[Antwort(), Antwort()]) as abruf, \
                redirect_stdout(protokoll):
            resultate = usa.suchen("2026-10-29")

        self.assertEqual(len(resultate), 2000)
        self.assertEqual(abruf.call_count, 2)
        self.assertIn("Sicherheitsgrenze", protokoll.getvalue())

    def test_suchen_begrenzt_gesamtaufrufe_je_lauf(self):
        import json
        import os
        import usa
        from unittest.mock import patch
        from contextlib import redirect_stdout
        from io import StringIO

        class Antwort:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

            def read(self):
                return json.dumps({"totalRecords": 2000, "opportunitiesData": [{"noticeId": "x"}] * 1000}).encode()

        protokoll = StringIO()
        with patch.dict(os.environ, {"SAM_API_KEY": "test-secret"}), \
                patch.object(usa, "_api_aufrufe", 0), \
                patch.object(usa, "MAX_API_AUFRUFE_PRO_LAUF", 1), \
                patch("usa.urllib.request.urlopen", return_value=Antwort()) as abruf, \
                redirect_stdout(protokoll):
            erster_tag = usa.suchen("2026-10-29")
            zweiter_tag = usa.suchen("2026-10-28")

        self.assertEqual(len(erster_tag), 1000)
        self.assertEqual(zweiter_tag, [])
        self.assertEqual(abruf.call_count, 1)
        self.assertIn("Laufgrenze", protokoll.getvalue())

    def test_sam_fehlerprotokoll_leakt_api_schluessel_nicht(self):
        import os
        import usa
        from unittest.mock import patch
        from contextlib import redirect_stdout
        from io import StringIO

        geheim = "nicht-im-protokoll"
        protokoll = StringIO()
        with patch.dict(os.environ, {"SAM_API_KEY": geheim}), \
                patch("usa.urllib.request.urlopen", side_effect=RuntimeError(f"URL enthielt {geheim}")), \
                redirect_stdout(protokoll):
            self.assertEqual(usa.releases("2026-10-29"), [])

        self.assertNotIn(geheim, protokoll.getvalue())


if __name__ == "__main__":
    unittest.main()
