"""No network: an empty prepaid credit at the provider stops AI for the run instead of aborting the alarm."""
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
import anthropic  # noqa: E402
import ki  # noqa: E402


def fehler():
    # Built without a real HTTP response (the SDK's transport differs between versions); str() carries the API text.
    e = anthropic.BadRequestError.__new__(anthropic.BadRequestError)
    Exception.__init__(e, "Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'}}")
    return e


class GuthabenTest(unittest.TestCase):
    def setUp(self):
        ki._gesperrt[0] = False

    def test_bewertung_laeuft_ohne_ki_weiter(self):
        client = MagicMock()
        client.messages.create.side_effect = fehler()
        client.beta.messages.create.side_effect = fehler()
        client.messages.batches.create.side_effect = fehler()
        with patch.object(ki, "client", client), patch.object(ki, "_reservieren", return_value="r1"), patch.object(ki.katalog, "abschliessen") as ab:
            items = [{"nr": 0, "titel": "Reinigung", "auftraggeber": "Stadt", "ort": "Köln", "beschreibung": "", "cpv": []}]
            self.assertEqual(ki.score("Firma", items), {})
            self.assertEqual(ki.score_viele("Firma", [items, items]), [{}, {}])
            self.assertEqual(ki.steckbrief("Firma", "{}", "Text"), "")
            self.assertTrue(ki._gesperrt[0])
            self.assertTrue(ab.called, "Reservierung wird mit 0 abgeschlossen")
        self.assertLessEqual(client.messages.create.call_count + client.beta.messages.create.call_count, 1, "nach dem ersten Fehler keine weiteren Anfragen")

    def test_andere_fehler_bleiben_fehler(self):
        self.assertFalse(ki.guthaben_leer(ValueError("credit balance is too low")))


if __name__ == "__main__":
    unittest.main()
