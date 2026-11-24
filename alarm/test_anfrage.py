import unittest

from alarm.anfrage_senden import lesen, nachricht


class Anfrage(unittest.TestCase):
    # The real requests live in the private project (Twista-hub/jarvis-intern, docs/anfragen/); the test uses a sample
    # in the same layout.
    MUSTER = """# Anfrage an ein Portal

> Entwurf.

**Warum:** Deutsche Zusammenfassung für Benjamin, wird nicht mitgeschickt.

**An:** daten@portal.example (Kontakt laut Portal).

**Betreff:** Solicitud de autorización

---

Estimados señores:

Le escribe Benjamin Schiffer (WP Digital Ranger).

Atentamente,
Benjamin Schiffer

---

Deutsch (nur für Benjamin): Bitte um Erlaubnis für den automatischen Abruf.
"""

    def test_entwuerfe(self):
        e, betreff, text = lesen(self.MUSTER)
        self.assertEqual(e, "daten@portal.example")
        self.assertEqual(betreff, "Solicitud de autorización")
        self.assertTrue(text.startswith("Estimados señores"))
        self.assertNotIn("Deutsch", text, "deutsche Zusammenfassung wird nicht mitgeschickt")
        self.assertIn("Benjamin Schiffer", text)
        m = nachricht(e, betreff, text)
        self.assertEqual(m["Bcc"], "kontakt@wpdigitalranger.com")
        self.assertIn("wpdigitalranger.com", m["From"])

if __name__ == "__main__":
    unittest.main()
