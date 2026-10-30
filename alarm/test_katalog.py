"""No network or API requests: eligibility and cache invalidation regression tests."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from alarm import katalog
from alarm.alarm import frist


class KatalogTest(unittest.TestCase):
    def test_deadline_and_cancellation(self):
        for status in ["cancelled", "complete", "awarded", "withdrawn"]:
            self.assertFalse(katalog.offen({"tender": {"status": status}}))
        self.assertFalse(katalog.offen({"tender": {"tenderPeriod": {"endDate": "2000-01-01T00:00:00Z"}}}))
        self.assertFalse(katalog.offen({"tag": ["tenderCancellation"]}))
        self.assertTrue(katalog.offen({"tender": {"title": "Unbekannte Frist"}}))

    def test_mixed_lot_deadlines(self):
        t = {"lots": [{"tenderPeriod": {"endDate": "2000-01-01T00:00:00Z"}}, {"tenderPeriod": {"endDate": "2100-01-01T00:00:00Z"}}]}
        self.assertTrue(katalog.offen({"tender": t}))
        self.assertEqual(frist(t), "2100-01-01T00:00:00Z")

    def test_profile_cache_invalidates_when_requirements_change(self):
        a = {"firma_id": "a", "beschreibung": "Elektriker", "regionen": {"x": ["52"]}}
        self.assertEqual(katalog.profil_version(a), katalog.profil_version(dict(reversed(list(a.items())))))
        self.assertNotEqual(katalog.profil_version(a), katalog.profil_version(dict(a, beschreibung="Maler")))
        self.assertNotEqual(katalog.profil_version(a), katalog.profil_version(dict(a, firma_id="b")))

    def test_individual_sources_do_not_share_fallback_scores(self):
        a = {"ocid": "a", "tender": {"title": "Gleicher Titel"}}
        b = {"ocid": "b", "tender": {"title": "Gleicher Titel"}}
        self.assertNotEqual(katalog.schluessel(a), katalog.schluessel(b))
        self.assertNotEqual(katalog.schluessel(a), katalog.schluessel(dict(a, tender={"title": "Geändert"})))

    def test_missing_budget_credentials_disables_api_reservation(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(katalog.reservieren(0.1, "test"))


if __name__ == "__main__":
    unittest.main()
