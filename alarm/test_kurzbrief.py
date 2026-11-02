import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import alarm.alarm as alarm_modul
from alarm.alarm import bewertungsabschnitt, eckdaten, kurzbrief, steckbrief_auswahl


class KurzbriefTest(unittest.TestCase):
    def test_notice_facts_remain_available_without_ai(self):
        text = kurzbrief({"buyer": {"name": "ITZBund"}, "tender": {
            "title": "Beschaffung und Haushalt", "description": "Bürokräfte\n in Bonn",
            "tenderPeriod": {"endDate": "2026-11-11T12:00:00Z"},
        }}, "2026-10-21")
        for fact in ["ITZBund", "Beschaffung und Haushalt", "Bürokräfte in Bonn", "2026-10-21", "11.11.2026, 13:00"]:
            self.assertIn(fact, text)
        self.assertIn("Vergabeunterlagen wurden nicht geprüft", text)

    def test_missing_facts_are_not_invented(self):
        self.assertIn("nicht angegeben", kurzbrief({}, "2026-10-30"))

    def test_ai_match_reason_is_saved_with_the_brief(self):
        text = bewertungsabschnitt({"kurz": "Fliesenarbeiten in öffentlichen Gebäuden", "grund": "Die Leistung passt zum Angebot der Firma."})
        self.assertIn("Gesucht:", text)
        self.assertIn("Warum passend:", text)
        self.assertIn("passt zum Angebot", text)


    def test_key_facts_from_the_notice(self):
        text = eckdaten({"lots": [{"title": "Küche", "value": {"amount": 120000}}, {"title": "Service", "value": {"amount": 80000}}],
                         "contractPeriod": {"durationInDays": 730},
                         "items": [{"quantity": 5000, "unit": {"name": "Stunden"}, "description": "Servicekräfte"}]})
        for fakt in ["**Lose:** 2 (Küche; Service)", "200.000 €", "730 Tage", "5000 Stunden Servicekräfte"]:
            self.assertIn(fakt, text)

    def test_daily_steckbriefe_for_best_and_largest_hits(self):
        gross = {"ocid": "gross", "tender": {"title": "Groß", "value": {"amount": 900000}}}
        rows = [({"punkte": 9}, 1, "2026-10-30", {"ocid": "beste", "tender": {"title": "Beste"}}, ""),
                ({"punkte": 8}, 1, "2026-10-30", {"ocid": "zweite", "tender": {"title": "Zweite"}}, ""),
                ({"punkte": 6}, 1, "2026-10-30", gross, "")]
        alt = alarm_modul.MAX_STECKBRIEFE
        alarm_modul.MAX_STECKBRIEFE = 2
        try:
            gewaehlt = steckbrief_auswahl("test-ohne-dateien", rows)
        finally:
            alarm_modul.MAX_STECKBRIEFE = alt
        self.assertEqual({r[3]["ocid"] for r in rows if id(r[3]) in gewaehlt}, {"beste", "gross"})


if __name__ == "__main__":
    unittest.main()


class FristLesbarTest(unittest.TestCase):
    def test_frist_lesbar(self):
        frist_lesbar = alarm_modul.frist_lesbar
        self.assertEqual(frist_lesbar("2026-11-30T12:00:00+01:00"), "30.11.2026, 12:00")
        self.assertEqual(frist_lesbar("2026-11-30"), "30.11.2026")
        self.assertEqual(frist_lesbar("2026-11-30T11:00:00Z"), "30.11.2026, 12:00", "UTC in deutscher Zeit")
        self.assertEqual(frist_lesbar("bald"), "bald")
        self.assertIsNone(frist_lesbar(None))
