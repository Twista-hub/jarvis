"""BOAMP open data notices -> releases (local fixtures, no network)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import boamp  # noqa: E402

def ann(nature: str, statut: str, donnees: str, limite: str = "<DATE_LIMITE_REPONSE>2026-12-02T12:00:00</DATE_LIMITE_REPONSE>") -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?><jo:ann xmlns:jo="http://boamp.journal-officiel.gouv.fr/XML/3.2.5">
<GESTION><REFERENCE><IDWEB>26-106360</IDWEB><TYPE_AVIS><FAMILLE><FNS/></FAMILLE><PERIMETRE><FNSimple/></PERIMETRE><NATURE><{nature}/></NATURE><STATUT><{statut}/></STATUT></TYPE_AVIS></REFERENCE>
<INDEXATION><SCHEMA>3.2.5</SCHEMA><NOMORGANISME>France terre d'asile - siège social</NOMORGANISME><DATE_PUBLICATION>2026-11-02</DATE_PUBLICATION>{limite}
<DESCRIPTEURS><DESCRIPTEUR><CODE>331</CODE><LIBELLE>Surveillance</LIBELLE></DESCRIPTEUR><DESCRIPTEUR><CODE>138</CODE><LIBELLE>Gardiennage</LIBELLE></DESCRIPTEUR></DESCRIPTEURS>
<NATURE_MARCHE><SERVICES/></NATURE_MARCHE><DEP_PUBLICATION>75</DEP_PUBLICATION><RESUME_OBJET>Prestations de gardiennage et de surveillance</RESUME_OBJET></INDEXATION></GESTION>
<DONNEES>{donnees}</DONNEES></jo:ann>""".encode()

FNS = """<FNSimple><organisme><nomOfficiel>France terre d'asile</nomOfficiel><ville>PARIS</ville><cp>75018</cp></organisme><initial><communication><urlDocConsul>https://www.marches-publics.info/x?Idm=1</urlDocConsul></communication>
<natureMarche><intitule>Gardiennage</intitule><codeCPV><objetPrincipal><classPrincipale>79713000</classPrincipale></objetPrincipal></codeCPV><description>Le présent marché a pour objet des prestations de gardiennage des établissements.</description></natureMarche></initial></FNSimple>"""


class BoampTest(unittest.TestCase):
    def test_aufruf_wird_release(self):
        a = boamp.lesen(ann("APPEL_OFFRE", "INITIAL", FNS))
        self.assertEqual(a["idweb"], "26-106360")
        self.assertEqual(a["cpv"], ["79713000"])
        self.assertEqual(a["cp"], "75018")
        self.assertEqual(a["descripteurs"], ["Surveillance", "Gardiennage"])
        r = boamp.als_release(a, "2026-11-02")
        self.assertEqual(r["ocid"], "boamp-26-106360")
        self.assertEqual(r["_land"], "FRA")
        self.assertEqual(r["tender"]["tenderPeriod"]["endDate"], "2026-12-02T12:00:00+01:00")
        self.assertEqual(r["tender"]["documents"][0]["url"], "https://www.boamp.fr/pages/avis/?q=idweb:26-106360")
        self.assertIn("Gardiennage", r["tender"]["description"])
        self.assertIn("Département 75", r["tender"]["items"][-1]["deliveryLocation"]["description"])

    def test_zuschlag_und_berichtigung_werden_ausgelassen(self):
        self.assertIsNone(boamp.lesen(ann("ATTRIBUTION", "INITIAL", FNS)))
        self.assertIsNone(boamp.lesen(ann("APPEL_OFFRE", "RECTIFICATIF", FNS)))
        self.assertIsNone(boamp.lesen(b"kein xml"))

    def test_fristen(self):
        self.assertEqual(boamp._frist("2026-07-02T12:00:00"), "2026-07-02T12:00:00+02:00")
        self.assertEqual(boamp._frist("2026-12-15T16:00:00Z"), "2026-12-15T16:00:00+00:00")
        self.assertEqual(boamp._frist("2026-12-01T12:30:00+01:00"), "2026-12-01T12:30:00+01:00")


if __name__ == "__main__":
    unittest.main()
