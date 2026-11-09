import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from katalog_links import releases, waehlen  # noqa: E402


class KatalogLinksTest(unittest.TestCase):
    def test_releases_nur_mit_kennung(self):
        paket = {"releases": [
            {"ocid": "ocds-mnwr74-ccece6a8-f15d-46d6-a0e8-9e9de4d274d0", "id": "0A1B2C3D-0000-4000-8000-000000000001", "date": "2026-11-02T10:00:00Z"},
            {"ocid": "ocds-mnwr74-25960800", "id": "25960800", "date": "2026-10-31T10:00:00Z"},
            {"ocid": "ocds-mnwr74-x", "id": "kaputt"},
            {"id": "12345678"},
        ]}
        self.assertEqual(releases(paket), [
            ("ocds-mnwr74-ccece6a8-f15d-46d6-a0e8-9e9de4d274d0", "0a1b2c3d-0000-4000-8000-000000000001", "2026-11-02T10:00:00Z"),
            ("ocds-mnwr74-25960800", "25960800", "2026-10-31T10:00:00Z"),
        ])

    def test_waehlen_naechstes_datum(self):
        k = [("aaaaaaaa-0000-4000-8000-000000000001", "2026-10-01T08:00:00Z"), ("bbbbbbbb-0000-4000-8000-000000000002", "2026-11-02T09:00:00Z")]
        self.assertEqual(waehlen(k, "2026-11-02T10:00:00+00:00"), "bbbbbbbb-0000-4000-8000-000000000002")
        self.assertEqual(waehlen(k, "2026-10-01T00:00:00+00:00"), "aaaaaaaa-0000-4000-8000-000000000001")
        self.assertIsNone(waehlen([], "2026-11-02T10:00:00+00:00"))


class AlarmLinkTest(unittest.TestCase):
    def test_portal_startseite_wird_bekanntmachung(self):
        from alarm import alarm
        rel = {"id": "25960800", "tender": {"title": "x", "documents": [{"url": "http://www.evergabe-online.de"}]}}
        self.assertEqual(alarm.link(rel), "https://oeffentlichevergabe.de/ui/de/notices/25960800")
        rel["tender"]["documents"].append({"url": "https://www.subreport.de/E12537398"})
        self.assertEqual(alarm.link(rel), "https://www.subreport.de/E12537398")
        self.assertEqual(alarm.link({"tender": {"title": "x", "documents": [{"url": "https://www.tender24.de"}]}}), "https://www.tender24.de")


if __name__ == "__main__":
    unittest.main()
