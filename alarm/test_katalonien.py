"""Catalonia: rows per lot become one tender, release format, Spanish region filter."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import katalonien  # noqa: E402
from profile_db import aus_db, im_suchgebiet  # noqa: E402

ZEILEN = [
    {"codi_organ": "1", "codi_expedient": "E-1", "denominacio": "Neteja d'escoles", "objecte_contracte": "Servei de neteja de centres educatius",
     "nom_organ": "Ajuntament de Girona", "lloc_execucio": "Girona", "codi_nuts": "ES512", "codi_cpv": "90911200-8", "numero_lot": "1",
     "descripcio_lot": "Escoles nord", "termini_presentacio_ofertes": "2026-11-20T14:00:00.000", "valor_estimat_expedient": "250000",
     "data_publicacio_anunci": "2026-11-02T08:00:00.000", "enllac_publicacio": {"url": "https://contractaciopublica.cat/ca/detall-publicacio/x/1"}},
    {"codi_organ": "1", "codi_expedient": "E-1", "denominacio": "Neteja d'escoles", "codi_nuts": "ES512", "codi_cpv": "90919200-4", "numero_lot": "2",
     "descripcio_lot": "Escoles sud", "data_publicacio_anunci": "2026-11-02T08:00:00.000"},
]


class KataloniénTest(unittest.TestCase):
    def test_zusammenfassen_und_release(self):
        a = katalonien.zusammenfassen(ZEILEN)
        self.assertEqual(len(a), 1)
        self.assertEqual(a[0]["cpv"], ["90911200", "90919200"])
        self.assertIn("Lot 2: Escoles sud", a[0]["beschreibung"])
        rel = katalonien.als_release(a[0], "2026-11-02")
        self.assertEqual(rel["_land"], "ESP")
        self.assertEqual(rel["tender"]["tenderPeriod"]["endDate"], "2026-11-20T14:00:00+01:00")
        self.assertEqual(rel["tender"]["documents"][0]["url"], "https://contractaciopublica.cat/ca/detall-publicacio/x/1")
        self.assertTrue(im_suchgebiet(aus_db("f", "F", "x", {"laender": ["ESP"], "comunidades": ["ES51"]}), rel))
        self.assertFalse(im_suchgebiet(aus_db("f", "F", "x", {"laender": ["ESP"], "comunidades": ["ES30"]}), rel))


if __name__ == "__main__":
    unittest.main()
