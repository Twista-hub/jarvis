import unittest

import anac
from profile_db import aus_db, im_suchgebiet

ROH = {
    "idAvviso": "c9aa", "codiceScheda": "P2_16", "tipologia": "BANDI", "tipo": "avviso", "attivo": True, "oscurato": False,
    "dataScadenza": "2099-11-30T14:00:00.000+00:00", "dataPubblicazione": "2026-10-30T07:00:00.004+00:00",
    "templates": [{"template": {
        "metadata": {"link_eform_ted": None, "titolo": None, "descrizione": "Servizio di pulizia degli uffici comunali"},
        "sections": [
            {"name": "SEZ. A - Committente", "fields": {"soggetti_sa": [{"codice_fiscale": "1", "denominazione_amministrazione": "COMUNE DI MILANO"}]}},
            {"name": "SEZ. B - Dati Generali", "fields": {"documenti_di_gara_link": "https://www.sintel.example/gara/1", "tipo_procedura_aggiudicazione": "Aperta"}},
            {"name": "SEZ. C - Oggetto", "items": [
                {"cig": "B123", "natura_principale": "Servizi", "cpv": "90911200-8 Servizi di pulizia di edifici", "luogo_nuts": "Milano", "luogo_istat": "MILANO", "valore_complessivo_stimato": "58000.0"}]},
        ]}, "lingua": "it"}],
}


class AnacTest(unittest.TestCase):
    def test_lesen_und_release(self):
        a = anac.lesen(ROH)
        self.assertEqual(a["titel"], "Servizio di pulizia degli uffici comunali", "ohne Titel zählt die Beschreibung")
        self.assertEqual(a["auftraggeber"], "COMUNE DI MILANO")
        self.assertEqual(a["regioni"], ["ITC4"])
        self.assertEqual(a["cpv"], ["90911200"])
        self.assertTrue(a["aktiv"])
        rel = anac.als_release(a, "2026-10-30")
        self.assertEqual(rel["_land"], "ITA")
        self.assertEqual(rel["tender"]["documents"][0]["url"], "https://www.sintel.example/gara/1")
        self.assertEqual(rel["tender"]["tenderPeriod"]["endDate"], "2099-11-30T14:00:00+00:00")
        self.assertIn("Valore stimato: 58000.0 €", rel["tender"]["description"])
        self.assertTrue(im_suchgebiet(aus_db("f", "F", "x", {"laender": ["ITA"], "regioni": ["ITC4"]}), rel))
        self.assertFalse(im_suchgebiet(aus_db("f", "F", "x", {"laender": ["ITA"], "regioni": ["ITI4"]}), rel))

    def test_nur_aktive_erstveroeffentlichungen(self):
        self.assertFalse(anac.lesen(dict(ROH, tipo="rettifica"))["aktiv"])
        self.assertFalse(anac.lesen(dict(ROH, oscurato=True))["aktiv"])
        alt, anac.bekanntmachungen = anac.bekanntmachungen, lambda tag: [ROH, dict(ROH, idAvviso="x", dataScadenza="2020-01-01T00:00:00.000+00:00")]
        try:
            self.assertEqual([r["id"] for r in anac.releases("2026-10-30")], ["anac-c9aa"], "abgelaufene Frist fällt weg")
        finally:
            anac.bekanntmachungen = alt

    def test_cpv_aus_bezeichnung(self):
        self.assertEqual(anac.cpv_code("Servizi di pulizia"), "90910000")
        self.assertEqual(anac.cpv_code("Servizi di fornitura di personale, compreso personale temporaneo"), "79620000")
        self.assertEqual(anac.cpv_code("Servizi di pulizia e manutenzione di edifici scolastici"), "90910000", "Wortregel")
        self.assertIsNone(anac.cpv_code("Servizi di pulizia delle strade"), "Straßenreinigung ist keine Gebäudereinigung")
        self.assertIsNone(anac.cpv_code("Dispositivi e prodotti medici vari"))
        self.assertEqual(anac.cpv_code("Lavori di installazione di impianti di riscaldamento, ventilazione e condizionamento d'aria"), "45331000")
        self.assertEqual(anac.cpv_code("90911200-8 Servizi di pulizia di edifici"), "90911200")

    def test_regionen(self):
        self.assertEqual(anac._region("Reggio di Calabria"), "ITF6")
        self.assertEqual(anac._region("ITI43"), "ITI4")
        self.assertIsNone(anac._region("ITALIA"))
        self.assertEqual(anac._tag("2026-11-02"), "02/11/2026")


if __name__ == "__main__":
    unittest.main()
