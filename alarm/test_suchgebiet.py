import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from alarm.profile_db import im_suchgebiet, nicht_mehr_aktuelle_treffer


def bekanntmachung(plz="", ort=""):
    return {"tender": {"items": [{
        "deliveryAddress": {"postalCode": plz, "locality": ort},
        "deliveryLocation": {"description": f"{plz} {ort}".strip()},
    }]}}


class SuchgebietTest(unittest.TestCase):
    def test_profile_without_location_remains_nationwide(self):
        self.assertTrue(im_suchgebiet({}, bekanntmachung("80331", "München")))

    def test_postcode_prefix_limits_delivery_area(self):
        profil = {"suchorte": [{"name": "Bad Wildungen", "plz_praefixe": ["34"]}]}
        self.assertTrue(im_suchgebiet(profil, bekanntmachung("34537", "Bad Wildungen")))
        self.assertFalse(im_suchgebiet(profil, bekanntmachung("80331", "München")))

    def test_missing_prefix_uses_exact_delivery_town(self):
        profil = {"suchorte": [{"name": "Bad Wildungen", "plz_praefixe": []}]}
        self.assertTrue(im_suchgebiet(profil, bekanntmachung("34537", "Bad Wildungen")))
        self.assertFalse(im_suchgebiet(profil, bekanntmachung("34537", "Kassel")))
        self.assertFalse(im_suchgebiet(profil, bekanntmachung()))

    def test_buyer_office_is_not_used_as_performance_location(self):
        profil = {"suchorte": [{"name": "Bad Wildungen", "plz_praefixe": []}]}
        rel = bekanntmachung()
        rel["buyer"] = {"address": {"locality": "Bad Wildungen", "postalCode": "34537"}}
        self.assertFalse(im_suchgebiet(profil, rel))

    def test_complete_search_archives_old_unmatched_ids_only(self):
        old = [("one", "still-open"), ("two", "withdrawn"), ("three", "outside")]
        self.assertEqual(nicht_mehr_aktuelle_treffer(old, {"still-open"}), ["two", "three"])


if __name__ == "__main__":
    unittest.main()
