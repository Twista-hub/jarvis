import unittest

import ausland_bestand as ab


class AuslandBestand(unittest.TestCase):
    def test_polen_zeile(self):
        a = {"nummer": "2026/BZP 1", "titel": "Sprzątanie urzędu", "auftraggeber": "Gmina Kraków", "ort": "Kraków", "woiwodschaft": "malopolskie",
             "cpv": ["90911200"], "frist": "2026-11-20T09:00:00Z", "veroeffentlicht": "2026-11-02", "link": "", "tender_id": "ocds-148610-abc"}
        z = ab.zeile_pl(a, "2026-11-02")
        self.assertEqual(z[0:4], ("pl", "bzp-2026/BZP 1", "2026-11-02", "Sprzątanie urzędu"))
        self.assertEqual(z[5], "woj. małopolskie")
        self.assertEqual(z[7], "2026-11-20T09:00:00+00:00")
        self.assertEqual(z[8], "https://ezamowienia.gov.pl/mp-client/search/list/ocds-148610-abc")
        self.assertIsNone(ab.zeile_pl({**a, "tender_id": "", "link": "http://unsicher"}, "2026-11-02"))
        self.assertEqual(ab.zeile_pl({**a, "tender_id": "", "link": "https://platforma.example/x"}, "2026-11-02")[8], "https://platforma.example/x")

    def test_katalonien_zeile(self):
        a = {"id": "org/exp-1", "titel": "Neteja escola", "auftraggeber": "Ajuntament de Girona", "ort": "Girona", "cpv": ["90911200"],
             "frist": "2026-11-20T14:00:00.000", "veroeffentlicht": "2026-11-02", "link": "https://contractaciopublica.cat/ca/detall-publicacio/1"}
        z = ab.zeile_es(a, "2026-11-02")
        self.assertEqual(z[0:2], ("es", "cat-org/exp-1"))
        self.assertEqual(z[7], "2026-11-20T14:00:00+01:00")
        self.assertIsNone(ab.zeile_es({**a, "link": ""}, "2026-11-02"))


if __name__ == "__main__":
    unittest.main()
