"""Plan limits in the daily search and the notifications (migration 20261107020000)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
import mail  # noqa: E402
import profile_db  # noqa: E402

BERLIN = ZoneInfo("Europe/Berlin")


class PlanGrenzenTest(unittest.TestCase):
    def test_free_nur_montags_einmal_pro_woche(self):
        montag = datetime(2026, 11, 9, 7, tzinfo=BERLIN)
        self.assertTrue(mail.woechentlich_faellig("kostenlos", None, montag))
        self.assertTrue(mail.woechentlich_faellig("kostenlos", montag - timedelta(days=7), montag))
        self.assertFalse(mail.woechentlich_faellig("kostenlos", montag - timedelta(days=2), montag))
        self.assertFalse(mail.woechentlich_faellig("kostenlos", None, montag + timedelta(days=1)))

    def test_andere_plaene_taeglich(self):
        dienstag = datetime(2026, 11, 10, 7, tzinfo=BERLIN)
        for plan in ("basis", "pro", "probe", "business", "test", None):
            self.assertTrue(mail.woechentlich_faellig(plan, dienstag - timedelta(days=1), dienstag), plan)

    def test_suche_nach_plan_gekuerzt(self):
        e = {"laender": ["DEU", "AUT", "FRA"], "zusatzprofile": [{"id": "a"}, {"id": "b"}, {"id": "c"}]}
        frei = profile_db.nach_plan(e, "kostenlos")
        self.assertEqual((frei["laender"], frei["zusatzprofile"]), (["DEU"], []))
        basis = profile_db.nach_plan(e, "basis")
        self.assertEqual((basis["laender"], len(basis["zusatzprofile"])), (["DEU", "AUT"], 2))
        for plan in ("pro", "probe", "business", "test", None):
            self.assertIs(profile_db.nach_plan(e, plan), e)
        self.assertEqual(len(e["zusatzprofile"]), 3, "gespeicherte Einstellungen bleiben unverändert")


if __name__ == "__main__":
    unittest.main()
