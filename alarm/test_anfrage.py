import unittest

from alarm.anfrage_senden import lesen, nachricht


class Anfrage(unittest.TestCase):
    def test_entwuerfe(self):
        for datei, an, wort in [("docs/anfragen/placsp-anfrage.md", "datos.abiertos@hacienda.gob.es", "Estimados señores"),
                                ("docs/anfragen/tenderned-anfrage.md", "functioneelbeheer@tenderned.nl", "Geachte heer/mevrouw")]:
            e, betreff, text = lesen(open(datei, encoding="utf-8").read())
            self.assertEqual(e, an)
            self.assertTrue(text.startswith(wort))
            self.assertNotIn("Deutsch", text, "deutsche Zusammenfassung wird nicht mitgeschickt")
            self.assertIn("Benjamin Schiffer", text)
            m = nachricht(e, betreff, text)
            self.assertEqual(m["Bcc"], "kontakt@wpdigitalranger.com")
            self.assertIn("wpdigitalranger.com", m["From"])


if __name__ == "__main__":
    unittest.main()
