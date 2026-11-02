"""AI texts in English for English-speaking firms; German profiles unchanged (same prompt, same profile version)."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
import ki  # noqa: E402
import profile_db  # noqa: E402
from alarm import alarm  # noqa: E402


class SpracheTest(unittest.TestCase):
    def test_sprache_aus_einstellungen_und_laendern(self):
        self.assertEqual(profile_db.sprache({"laender": ["USA"]}), "en")
        self.assertEqual(profile_db.sprache({"laender": ["DEU", "USA"]}), "de")
        self.assertEqual(profile_db.sprache({}), "de")
        self.assertEqual(profile_db.sprache({"sprache": "en", "laender": ["DEU"]}), "en")
        self.assertEqual(profile_db.sprache({"sprache": "de", "laender": ["USA"]}), "de")

    def test_steckbrief_anleitung(self):
        self.assertEqual(ki.anleitung("de"), ki.STECKBRIEF_ANLEITUNG)
        en = ki.anleitung("en")
        self.assertIn("Englisch (US)", en)
        self.assertIn("„nicht angegeben“", en)

    def test_bewertung_englisch_nur_wenn_gewuenscht(self):
        gesehen = []

        def create(**kw):
            gesehen.append(kw["system"])
            return None
        with mock.patch.object(ki, "_create", side_effect=create):
            ki.score("Firma", [{"nr": 0, "titel": "x"}])
            ki.score("Firma", [{"nr": 0, "titel": "x"}], "en")
        self.assertNotIn("English", gesehen[0])
        self.assertIn("in English (US)", gesehen[1])

    def test_aufruf_deutscher_profile_unveraendert(self):
        self.assertEqual(alarm.sprach_arg({"sprache": "de"}), {})
        self.assertEqual(alarm.sprach_arg({}), {})
        self.assertEqual(alarm.sprach_arg({"sprache": "en"}), {"sprache": "en"})


if __name__ == "__main__":
    unittest.main()
