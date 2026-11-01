"""Display filters of the search profile (H2, H4, H5): they decide what is shown, never cause a paid re-scoring."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from alarm import alarm  # noqa: E402
import katalog  # noqa: E402
from alarm.profile_db import aus_db, zusatz_profile  # noqa: E402
from alarm.speichern import firmen_ergebnis  # noqa: E402

GRUND = {"leistungen": [{"name": "Reinigung", "cpv": ["90910000"], "woerter": ["reinigung"]}], "ausschluss": ["neubau"]}


def rel(buyer="Stadt Köln – Gebäudewirtschaft", wert=None, lose=()):
    t = {"title": "Unterhaltsreinigung Rathaus", "description": "", "lots": [{"value": {"amount": v}} for v in lose]}
    if wert is not None:
        t["value"] = {"amount": wert}
    return {"buyer": {"name": buyer}, "tender": t}


class Filter(unittest.TestCase):
    def test_auftraggeber_namen_ohne_umlaute_und_teilweise(self):
        p = aus_db("f", "F", "", dict(GRUND, auftraggeber_aus=["Stadt Köln"], auftraggeber_bevorzugt=["Uniklinik"]), "")
        self.assertTrue(alarm.auftraggeber_in(p["auftraggeber_aus"], rel()))
        self.assertFalse(alarm.auftraggeber_in(p["auftraggeber_aus"], rel("Stadtwerke Kölnbach")))
        self.assertFalse(alarm.auftraggeber_in(p["auftraggeber_bevorzugt"], rel()))
        self.assertFalse(alarm.auftraggeber_in([], rel()))

    def test_auftragswert(self):
        p = aus_db("f", "F", "", dict(GRUND, wert_min=50000, wert_max=500000), "")
        self.assertTrue(alarm.wert_erlaubt(p, rel(wert=120000)))
        self.assertFalse(alarm.wert_erlaubt(p, rel(wert=20000)))
        self.assertFalse(alarm.wert_erlaubt(p, rel(wert=900000)))
        self.assertTrue(alarm.wert_erlaubt(p, rel(lose=(30000, 40000))))  # lots add up to 70.000
        self.assertTrue(alarm.wert_erlaubt(p, rel()))  # unknown value is shown by default
        streng = aus_db("f", "F", "", dict(GRUND, wert_min=50000, wert_unbekannt=False), "")
        self.assertFalse(alarm.wert_erlaubt(streng, rel()))
        self.assertTrue(alarm.wert_erlaubt(aus_db("f", "F", "", GRUND, ""), rel(wert=1)))

    def test_schnellausschluss_wirkt_wie_ausschluss(self):
        p = aus_db("f", "F", "", dict(GRUND, ausschluss_schnell=["fenster"]), "")
        self.assertEqual(alarm.score(p, "reinigung der fensterflächen", ["90910000"])[0], 0)
        self.assertGreater(alarm.score(p, "reinigung der büros", ["90910000"])[0], 0)

    def test_filter_aendern_die_profilversion_nicht(self):
        basis = aus_db("f", "F", "Beschreibung", GRUND, "10115")
        mit = aus_db("f", "F", "Beschreibung", dict(GRUND, ausschluss_schnell=["fenster"], auftraggeber_aus=["Bundeswehr"],
                                                    auftraggeber_bevorzugt=["Stadt Aachen"], wert_min=50000, wert_max=10**6, wert_unbekannt=False), "10115")
        self.assertEqual(katalog.profil_version(basis), katalog.profil_version(mit))
        anders = aus_db("f", "F", "Beschreibung", dict(GRUND, ausschluss=["neubau", "abriss"]), "10115")
        self.assertNotEqual(katalog.profil_version(basis), katalog.profil_version(anders))


class MehrereProfile(unittest.TestCase):
    ZUSATZ = [{"id": "a1b2c3d4-0000-4000-8000-000000000001", "name": "Winterdienst", "woerter": ["winterdienst", "schneeräumung"],
               "ausschluss": ["streusalz lieferung"], "bereich_id": "11111111-1111-4111-8111-111111111111", "min_punkte": 5},
              {"id": "kaputt", "name": "X", "woerter": ["x"]}, {"id": "a1b2c3d4-0000-4000-8000-000000000002", "name": "Leer", "woerter": []}]

    def test_zusatzprofil_erbt_gebiet_und_filter_hat_eigene_woerter(self):
        e = dict(GRUND, zusatzprofile=self.ZUSATZ, wert_min=50000, standorte=[{"name": "Berlin", "plz_praefixe": ["10"]}])
        z = zusatz_profile("firma-f", "f", "Perlease", "Personaldienstleister", e, "10115")
        self.assertEqual(list(z), ["firma-f#a1b2c3d4"])  # invalid id and empty word list are ignored
        p = z["firma-f#a1b2c3d4"]
        self.assertEqual((p["zusatz"], p["haupt_id"], p["bereich_id"], p["min_punkte"], p["wert_min"]), (True, "firma-f", "11111111-1111-4111-8111-111111111111", 5, 50000))
        self.assertEqual(p["suchorte"], [{"name": "Berlin", "plz_praefixe": ["10"]}])
        self.assertGreater(alarm.score(p, "winterdienst für schulen", [])[0], 0)
        self.assertEqual(alarm.score(p, "reinigung der büros", ["90910000"])[0], 0)  # main profile's work is not in it
        self.assertEqual(alarm.score(p, "winterdienst und neubau", [])[0], 0)  # main exclusions apply too
        self.assertIn("Winterdienst", p["beschreibung"])
        haupt = aus_db("f", "Perlease", "Personaldienstleister", GRUND, "10115")
        self.assertEqual(katalog.profil_version(haupt), katalog.profil_version(aus_db("f", "Perlease", "Personaldienstleister", dict(GRUND, zusatzprofile=self.ZUSATZ), "10115")))

    def test_firmenergebnis_einmal_beste_punktzahl_und_nur_gemeinsame_ablehnungen(self):
        treffer = [{"profil": "f", "quelle_id": "A", "punkte": 6}, {"profil": "f#z", "quelle_id": "A", "punkte": 9},
                   {"profil": "f#z", "quelle_id": "B", "punkte": 7}, {"profil": "andere", "quelle_id": "C", "punkte": 8}]
        ausgewertet = {"f": {"abgelehnt": ["B", "D", "E"]}, "f#z": {"abgelehnt": ["D", "A"]}}
        eigene, abgelehnt = firmen_ergebnis(["f", "f#z"], treffer, ausgewertet)
        self.assertEqual(sorted((t["quelle_id"], t["punkte"]) for t in eigene), [("A", 9), ("B", 7)])
        self.assertEqual(abgelehnt, ["D"])  # B is wanted by the further profile, E only rejected by one profile

    def test_steckbrieflimit_gilt_je_firma(self):
        profiles = {"f": {"firma_id": "x"}, "f#z": {"firma_id": "x", "zusatz": True}, "g": {"firma_id": "y"}}
        self.assertEqual(alarm.firmen_namen(profiles, "f#z"), ["f", "f#z"])
        self.assertEqual(alarm.firmen_namen({"h": {}}, "h"), ["h"])
        import tempfile
        from datetime import date
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp, patch.object(alarm, "ROOT", Path(tmp)):
            (Path(tmp) / "steckbriefe").mkdir()
            r = {"ocid": "o1", "tender": {"title": "Winterdienst Schulen"}}
            datei = alarm.steckbrief_datei("f", "2026-11-01", r)
            datei.write_text(f"Text\n_Automatisch erstellt von Jarvis am {date.today().isoformat()} aus …_", encoding="utf-8")
            alarm.steckbrief_datei("f#z", "2026-11-01", {"ocid": "o2", "tender": {"title": "Reinigung"}}).write_text(f"am {date.today().isoformat()} ", encoding="utf-8")
            self.assertEqual(alarm.steckbriefe_heute(["f", "f#z"]), 2)  # both profiles count towards the firm's limit
            self.assertEqual(alarm.vorhandener_steckbrief(["f#z", "f"], "2026-11-01", r), datei)  # no second paid Steckbrief


if __name__ == "__main__":
    unittest.main()
