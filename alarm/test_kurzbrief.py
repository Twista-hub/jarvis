import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from alarm.alarm import kurzbrief


class KurzbriefTest(unittest.TestCase):
    def test_notice_facts_remain_available_without_ai(self):
        text = kurzbrief({"buyer": {"name": "ITZBund"}, "tender": {
            "title": "Beschaffung und Haushalt", "description": "Bürokräfte\n in Bonn",
            "tenderPeriod": {"endDate": "2026-11-11T12:00:00Z"},
        }}, "2026-10-21")
        for fact in ["ITZBund", "Beschaffung und Haushalt", "Bürokräfte in Bonn", "2026-10-21", "2026-11-11"]:
            self.assertIn(fact, text)
        self.assertIn("Vergabeunterlagen wurden nicht geprüft", text)

    def test_missing_facts_are_not_invented(self):
        self.assertIn("nicht angegeben", kurzbrief({}, "2026-10-30"))


if __name__ == "__main__":
    unittest.main()
