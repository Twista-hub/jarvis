"""BZP (Poland): reading the API record, release format, voivodeship filter."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import bzp  # noqa: E402
from profile_db import aus_db, im_suchgebiet  # noqa: E402

HTML = """<style>.x{}</style><h1>Ogłoszenie o zamówieniu</h1><h3>1.5.2.) Miejscowość:</h3><p>Wiśniowa</p>
<h3>1.5.3.) Kod pocztowy:</h3><p>38-124</p><h3>2.6.) Adres strony internetowej prowadzonego postępowania</h3>
<p> https://platformazakupowa.pl/pn/wisniowa/proceedings </p><h3>4.2.2.) Krótki opis przedmiotu zamówienia</h3>
<p>Przedmiotem zamówienia jest zimowe utrzymanie dróg na terenie Gminy Wiśniowa.</p>
<h3>4.2.5.) Wartość części: </h3><p>120000,00</p><p>PLN</p>"""
ROH = {"bzpNumber": "2026/BZP 00514538", "orderObject": "Zimowe utrzymanie dróg", "organizationName": "Gmina Wiśniowa",
       "organizationCity": "Wiśniowa", "organizationProvince": "PL18", "orderType": "Services",
       "cpvCode": "90620000-9 (Usługi odśnieżania),90630000-2 (Usługi usuwania oblodzeń)", "submittingOffersDate": "2026-11-09T08:00:00Z",
       "publicationDate": "2026-11-01T14:18:26.38Z", "htmlBody": HTML, "tenderId": "ocds-148610-abc"}


class BzpTest(unittest.TestCase):
    def test_lesen(self):
        a = bzp.lesen(ROH)
        self.assertEqual(a["plz"], "38-124")
        self.assertEqual(a["woiwodschaft"], "podkarpackie")
        self.assertEqual(a["cpv"], ["90620000", "90630000"])
        self.assertEqual(a["link"], "https://platformazakupowa.pl/pn/wisniowa/proceedings")
        self.assertEqual(a["wert"], "120000,00 PLN")
        self.assertIn("zimowe utrzymanie dróg", a["beschreibung"])

    def test_release_und_gebiet(self):
        rel = bzp.als_release(bzp.lesen(ROH), "2026-11-01")
        self.assertEqual(rel["_land"], "POL")
        self.assertEqual(rel["tender"]["tenderPeriod"]["endDate"], "2026-11-09T08:00:00+00:00")
        self.assertIn("woj. podkarpackie", rel["tender"]["items"][-1]["deliveryLocation"]["description"])
        self.assertEqual(bzp.woiwodschaften_der_bekanntmachung(rel), {"podkarpackie"})
        ted = {"_land": "POL", "tender": {"items": [{"deliveryLocation": {"description": "PL911, Polen"}}]}}
        self.assertEqual(bzp.woiwodschaften_der_bekanntmachung(ted), {"mazowieckie"}, "NUTS PL91 = Mazowieckie")
        self.assertEqual(bzp.woiwodschaften_der_bekanntmachung({"_land": "POL", "tender": {"items": [{"deliveryLocation": {"description": "PL22"}}]}}), {"slaskie"}, "NUTS PL22 = Śląskie, nicht TERYT")
        p = aus_db("f", "F", "x", {"laender": ["POL"], "woiwodschaften": ["mazowieckie", "erfunden"]})
        self.assertEqual(p["woiwodschaften"], ["mazowieckie"])
        self.assertFalse(im_suchgebiet(p, rel))
        self.assertTrue(im_suchgebiet(p, ted))
        self.assertTrue(im_suchgebiet(aus_db("f", "F", "x", {"laender": ["POL"]}), rel), "ohne Auswahl ganz Polen")


if __name__ == "__main__":
    unittest.main()
