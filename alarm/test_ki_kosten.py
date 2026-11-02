import json
import unittest
from types import SimpleNamespace

import ki


class KiKosten(unittest.TestCase):
    def test_gleicher_text_mit_cache_marke(self):
        items = [{"nr": 0, "titel": "Reinigung Rathaus"}]
        bloecke = ki.bewertung_inhalt("Reinigungsfirma in Aachen", items)
        alt = "Kunde:\nReinigungsfirma in Aachen\n\nAusschreibungen:\n" + json.dumps(items, ensure_ascii=False)
        self.assertEqual("".join(b["text"] for b in bloecke), alt, "Text für die KI bleibt identisch")
        self.assertEqual(bloecke[0]["cache_control"], {"type": "ephemeral"})
        self.assertNotIn("cache_control", bloecke[1], "die wechselnden Ausschreibungen werden nicht gecacht")

    def test_kosten_mit_cache(self):
        ki._kosten[0] = 0.0
        ki._cache[:] = [0, 0]
        u = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_creation_input_tokens=2000, cache_read_input_tokens=0)
        ki._zaehlen(u, "claude-sonnet-5-5")
        self.assertAlmostEqual(ki.kosten(), (1000 * 2 + 2000 * 2 * 1.25 + 500 * 10) / 1e6)
        ki._kosten[0] = 0.0
        u = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_creation_input_tokens=0, cache_read_input_tokens=2000)
        ki._zaehlen(u, "claude-sonnet-5-5")
        self.assertAlmostEqual(ki.kosten(), (1000 * 2 + 2000 * 0.2 + 500 * 10) / 1e6)
        self.assertIn("2000 Tokens gelesen, 2000 geschrieben", ki.cache_stand())


if __name__ == "__main__":
    unittest.main()
