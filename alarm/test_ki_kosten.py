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


    def test_vorfilter(self):
        aufrufe = []

        def bewerten(model, beschreibung, items, sprache):
            aufrufe.append((model, [x["nr"] for x in items], [x["titel"] for x in items]))
            if model == ki.MODEL_VORFILTER:
                return {x["nr"]: {"nr": x["nr"], "punkte": 2 if "Bäckerei" in x["titel"] else 7, "kurz": "k", "grund": "Haiku"} for x in items}
            return {x["nr"]: {"nr": x["nr"], "punkte": 9, "kurz": "k", "grund": "Sonnet"} for x in items}

        alt, ki._bewerten = ki._bewerten, bewerten
        alt_schwelle, ki.VORFILTER_SCHWELLE = ki.VORFILTER_SCHWELLE, 3
        try:
            items = [{"nr": 0, "titel": "Reinigung Schule"}, {"nr": 1, "titel": "Bäckerei Brötchen"}, {"nr": 2, "titel": "Glasreinigung"}]
            r = ki.score("Reinigungsfirma", items)
        finally:
            ki._bewerten, ki.VORFILTER_SCHWELLE = alt, alt_schwelle
        self.assertEqual(aufrufe[1], (ki.MODEL_BEWERTEN, [0, 1], ["Reinigung Schule", "Glasreinigung"]), "Sonnet sieht nur die Kandidaten, neu nummeriert")
        self.assertEqual({k: (v["punkte"], v["grund"]) for k, v in r.items()}, {0: (9, "Sonnet"), 1: (2, "Haiku"), 2: (9, "Sonnet")})
        self.assertTrue(r[1]["vorfilter"])


if __name__ == "__main__":
    unittest.main()


class Batch(unittest.TestCase):
    def test_score_viele_gleiches_ergebnis_wie_einzeln(self):
        from types import SimpleNamespace as N
        import json as j
        gesendet = []

        def antwort(model, items):
            if model == ki.MODEL_VORFILTER:
                return {"bewertungen": [{"nr": x["nr"], "punkte": 2 if "Bäckerei" in x["titel"] else 7, "kurz": "k", "grund": "Haiku"} for x in items]}
            return {"bewertungen": [{"nr": x["nr"], "punkte": 9, "kurz": "k", "grund": "Sonnet"} for x in items]}

        class Batches:
            def create(self, requests):
                gesendet.append(requests)
                self.r = requests
                return N(id="b1", processing_status="ended")

            def retrieve(self, i):
                return N(id=i, processing_status="ended")

            def results(self, i):
                for q in self.r:
                    items = j.loads(q["params"]["messages"][0]["content"][1]["text"].split("\n", 1)[1])
                    msg = N(usage=N(input_tokens=100, output_tokens=50, cache_creation_input_tokens=0, cache_read_input_tokens=0),
                            stop_reason="end_turn", content=[N(type="text", text=j.dumps(antwort(q["params"]["model"], items)))])
                    yield N(custom_id=q["custom_id"], result=N(type="succeeded", message=msg))

        alt = (ki.client, ki._reservieren, ki.katalog.abschliessen, ki.VORFILTER_SCHWELLE)
        ki.client = N(messages=N(batches=Batches()))
        ki._reservieren = lambda kwargs: "r"
        ki.katalog.abschliessen = lambda r, k: None
        ki.VORFILTER_SCHWELLE = 3
        try:
            pakete = [[{"nr": 0, "titel": "Reinigung Schule"}, {"nr": 1, "titel": "Bäckerei Brötchen"}], [{"nr": 0, "titel": "Bäckerei"}]]
            r = ki.score_viele("Reinigungsfirma", pakete)
        finally:
            ki.client, ki._reservieren, ki.katalog.abschliessen, ki.VORFILTER_SCHWELLE = alt
        self.assertEqual(len(gesendet), 2, "ein Vorfilter-Batch, ein Sonnet-Batch")
        self.assertEqual([q["params"]["model"] for q in gesendet[1]], [ki.MODEL_BEWERTEN], "Paket 2 braucht kein Sonnet")
        self.assertNotIn("fallbacks", gesendet[0][0]["params"], "Batch kennt keine Ersatzmodell-Regel")
        self.assertEqual({k: v["grund"] for k, v in r[0].items()}, {0: "Sonnet", 1: "Haiku"})
        self.assertEqual({k: v["grund"] for k, v in r[1].items()}, {0: "Haiku"})
